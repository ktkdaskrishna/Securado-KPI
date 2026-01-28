"""CRM Sales Service Routes - Opportunities, Accounts, Activities, KPIs

Handles:
- Opportunity listing with canonical + overrides merged
- Stage/probability overrides (never touch canonical)
- Bluesheet probability assessment
- Activities CRUD
- Notes under opportunities
- Accounts with 360 view
- KPIs tracking
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import logging

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc, PipelineStages
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.routes import get_current_user
from services.crm_sales.models import (
    StageUpdate, ProbabilityUpdate, ActivityCreate, ActivityUpdate,
    AccountCreate, KPICreate, BluesheetUpdate, NoteCreate
)
from services.crm_sales.bluesheet import (
    calculate_bluesheet_probability, get_bluesheet_form_options,
    BUYING_INFLUENCES, COMPETITION_STATUS, BUDGET_STATUS
)

logger = logging.getLogger(__name__)

opportunities_router = APIRouter(prefix="/opportunities", tags=["opportunities"])
leads_router = APIRouter(prefix="/leads", tags=["leads"])
accounts_router = APIRouter(prefix="/accounts", tags=["accounts"])
activities_router = APIRouter(prefix="/activities", tags=["activities"])
kpis_router = APIRouter(prefix="/kpis", tags=["kpis"])
receivables_router = APIRouter(prefix="/receivables", tags=["receivables"])


# ==================== OPPORTUNITIES ====================

async def merge_with_overrides(records: List, org_id: str, app_db) -> List:
    """Merge canonical records with overrides"""
    canonical_ids = [r.get("canonical_id") for r in records]
    overrides = await app_db.overrides.find({
        "canonical_id": {"$in": canonical_ids},
        "org_id": org_id
    }).to_list(1000)
    
    override_map = {o["canonical_id"]: o for o in overrides}
    
    merged = []
    for record in records:
        merged_record = serialize_doc(record)
        override = override_map.get(record.get("canonical_id"))
        if override:
            for key in ["stage", "probability", "owner"]:
                if key in override:
                    merged_record[key] = override[key]
            merged_record["has_overrides"] = True
        else:
            merged_record["has_overrides"] = False
        
        # Normalize stage to frontend expected values
        merged_record["stage"] = normalize_stage(merged_record.get("stage"))
        
        merged.append(merged_record)
    
    return merged


# Stage mapping from Odoo to frontend expected values
STAGE_MAPPING = {
    # Common Odoo CRM stages
    "new": "qualified",
    "enquiry": "qualified",
    "qualified": "qualified",
    "qualification": "qualified",
    "qualified opportunity": "qualified",
    "prospect": "qualified",
    "proposition": "proposal",
    "proposal": "proposal",
    "proposal sent": "proposal",
    "in- progress": "proposal",
    "in-progress": "proposal",
    "in progress": "proposal",
    "negotiation": "negotiation",
    "won": "closed_won",
    "closed won": "closed_won",
    "closed_won": "closed_won",
    "lost": "closed_lost",
    "closed lost": "closed_lost",
    "closed_lost": "closed_lost",
    # Default mapping for any unrecognized stage
}


def normalize_stage(stage: str) -> str:
    """Normalize Odoo stage names to frontend expected values"""
    if not stage:
        return "qualified"
    
    stage_lower = stage.lower().strip()
    
    # Direct match
    if stage_lower in STAGE_MAPPING:
        return STAGE_MAPPING[stage_lower]
    
    # Check if it's already a valid frontend stage
    valid_stages = ["qualified", "proposal", "negotiation", "closed_won", "closed_lost"]
    if stage_lower in valid_stages:
        return stage_lower
    
    # Fuzzy matching based on keywords
    if "new" in stage_lower or "enquir" in stage_lower or "qualif" in stage_lower:
        return "qualified"
    if "prop" in stage_lower:
        return "proposal"
    if "negot" in stage_lower:
        return "negotiation"
    if "won" in stage_lower:
        return "closed_won"
    if "lost" in stage_lower:
        return "closed_lost"
    
    # Default fallback
    return "qualified"


def parse_date_from_string(date_str):
    """Parse date from various string formats"""
    if not date_str or date_str == 'False':
        return None
    
    if isinstance(date_str, datetime):
        return date_str
    
    if isinstance(date_str, str):
        for fmt in ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S']:
            try:
                return datetime.strptime(date_str[:len(fmt.replace('%', ''))].strip(), fmt)
            except (ValueError, TypeError):
                continue
        try:
            if len(date_str) >= 10:
                return datetime.strptime(date_str[:10], '%Y-%m-%d')
        except (ValueError, TypeError):
            pass
    return None


def apply_date_filters(records: list, year: str = None, quarter: str = None, date_field: str = 'create_date') -> list:
    """Apply year and quarter filters to records"""
    if not year and not quarter:
        return records
    
    filtered = []
    quarter_months = {
        "Q1": [1, 2, 3], 
        "Q2": [4, 5, 6], 
        "Q3": [7, 8, 9], 
        "Q4": [10, 11, 12]
    }
    
    for record in records:
        date_value = None
        for field in [date_field, 'create_date', 'close_date', 'date_open', 'write_date']:
            if record.get(field):
                date_value = parse_date_from_string(record.get(field))
                if date_value:
                    break
        
        if not date_value:
            if not year:
                filtered.append(record)
            continue
        
        if year:
            if str(date_value.year) != str(year):
                continue
        
        if quarter:
            months = quarter_months.get(quarter, [])
            if date_value.month not in months:
                continue
        
        filtered.append(record)
    
    return filtered


@opportunities_router.get("")
async def list_opportunities(
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    stage: Optional[str] = None,
    year: Optional[str] = Query(None, description="Filter by year (e.g., 2024, 2025, 2026)"),
    quarter: Optional[str] = Query(None, description="Filter by quarter (Q1, Q2, Q3, Q4)"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """List opportunities (type=opportunity) with overrides applied and optional filters"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    logger.info(f"Opportunities list request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Build query - ONLY type=opportunity (exclude leads)
    query = {
        "org_id": current_user.get("org_id", "default"),
        "type": "opportunity"  # Filter to only opportunities
    }
    
    # Apply non-date filters
    if stage:
        query["stage"] = stage
    if sales_rep:
        query["owner_name"] = sales_rep
    if team_id:
        query["team_id"] = team_id
    if account:
        query["account_name"] = account
    
    # Get from canonical - get more records if filtering to ensure we have enough after date filter
    fetch_limit = limit * 10 if (year or quarter) else limit
    records = await canonical_db.opportunities.find(query).skip(skip).limit(fetch_limit).to_list(fetch_limit)
    
    # Apply date-based filters using the improved helper function
    records = apply_date_filters(records, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    # Trim to requested limit
    records = records[:limit]
    
    logger.info(f"After filtering: {len(records)} opportunities")
    
    # Merge with overrides
    merged = await merge_with_overrides(records, current_user.get("org_id", "default"), app_db)
    
    return merged


@opportunities_router.get("/export")
async def export_opportunities_excel(
    stage: Optional[str] = None,
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    current_user: dict = Depends(get_current_user)
):
    """Export opportunities to Excel format"""
    from fastapi.responses import StreamingResponse
    import pandas as pd
    import io
    
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Build query
    query = {"org_id": org_id, "type": "opportunity"}
    if stage:
        query["stage"] = stage
    if sales_rep:
        query["owner_name"] = sales_rep
    if account:
        query["account_name"] = account
    
    # Get all matching records
    records = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Apply date filters
    if year or quarter:
        records = apply_date_filters(records, year=year, quarter=quarter)
    
    # Merge with overrides
    merged = await merge_with_overrides(records, org_id, app_db)
    
    # Build data for Excel
    data = []
    for opp in merged:
        data.append({
            "Opportunity Name": opp.get("name", ""),
            "Account": opp.get("account_name", ""),
            "Stage": opp.get("stage", ""),
            "Sale Value (OMR)": opp.get("sale_value", 0) or 0,
            "Probability (%)": opp.get("probability", 0) or 0,
            "Product Category": opp.get("solution_category", ""),
            "Product Manager": opp.get("product_manager", ""),
            "Sales Rep": opp.get("owner_name", ""),
            "Won Date": opp.get("won_at", opp.get("date_closed", "")),
            "Created Date": opp.get("create_date", ""),
            "Close Date": opp.get("close_date", ""),
            "Budget Status": opp.get("budget_status", ""),
            "Email": opp.get("email", ""),
            "Phone": opp.get("phone", ""),
        })
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Create Excel file in memory
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Opportunities')
    
    output.seek(0)
    
    # Generate filename with filters
    filename_parts = ["opportunities"]
    if year:
        filename_parts.append(f"{year}")
    if quarter:
        filename_parts.append(f"{quarter}")
    if stage:
        filename_parts.append(stage)
    filename = "_".join(filename_parts) + ".xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@opportunities_router.get("/kanban")
async def opportunities_kanban(
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """Get opportunities (type=opportunity) organized by stage for kanban view"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Kanban request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Build query for non-date filters - ONLY type=opportunity
    query = {
        "org_id": org_id,
        "type": "opportunity"  # Filter to only opportunities
    }
    if sales_rep:
        query["owner_name"] = sales_rep
    if team_id:
        query["team_id"] = team_id
    if account:
        query["account_name"] = account
    
    # Get all opportunities
    records = await canonical_db.opportunities.find(query).to_list(1000)
    
    # Apply date filters
    records = apply_date_filters(records, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    logger.info(f"Kanban after filtering: {len(records)} opportunities")
    
    # Merge with overrides
    merged = await merge_with_overrides(records, org_id, app_db)
    
    # Organize by stage
    kanban = {stage: [] for stage in PipelineStages.all()}
    kanban["unknown"] = []
    
    for record in merged:
        stage = record.get("stage", "unknown") or "unknown"
        if stage in kanban:
            kanban[stage].append(record)
        else:
            kanban["unknown"].append(record)
    
    return {
        "stages": PipelineStages.all(),
        "data": kanban,
        "filtered": any([year, quarter, sales_rep, team_id, account]),
        "total_count": len(merged)
    }


@opportunities_router.get("/{opp_id}")
async def get_opportunity(
    opp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single opportunity with overrides"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    record = await canonical_db.opportunities.find_one({
        "canonical_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    if not record:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    merged = await merge_with_overrides([record], current_user.get("org_id", "default"), app_db)
    return merged[0]


@opportunities_router.patch("/{opp_id}/stage")
async def update_opportunity_stage(
    opp_id: str,
    stage_data: StageUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update opportunity stage (stored as override, not touching canonical)"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    
    # Verify opportunity exists
    opp = await canonical_db.opportunities.find_one({
        "canonical_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Get old value for event
    old_override = await app_db.overrides.find_one({
        "canonical_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    old_stage = old_override.get("stage") if old_override else opp.get("stage")
    
    # Upsert override
    override_id = generate_id()
    await app_db.overrides.update_one(
        {
            "canonical_id": opp_id,
            "org_id": current_user.get("org_id", "default")
        },
        {
            "$set": {
                "id": override_id,
                "canonical_id": opp_id,
                "org_id": current_user.get("org_id", "default"),
                "entity_type": "opportunity",
                "stage": stage_data.stage,
                "updated_at": now_utc(),
                "updated_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    # Emit override event
    await emit_event(
        event_type=Topics.CRM_OVERRIDE_UPSERTED,
        payload={
            "override_id": override_id,
            "canonical_id": opp_id,
            "entity_type": "opportunity",
            "field": "stage",
            "old_value": old_stage,
            "new_value": stage_data.stage,
            "updated_by": current_user["id"]
        },
        producer="crm-sales-service",
        org_id=current_user.get("org_id", "default")
    )
    
    logger.info(f"Stage updated for {opp_id}: {old_stage} -> {stage_data.stage}")
    
    return {
        "success": True,
        "message": "Stage updated",
        "canonical_id": opp_id,
        "stage": stage_data.stage
    }


@opportunities_router.post("/{opp_id}/calculate-probability")
async def calculate_probability(
    opp_id: str,
    prob_data: ProbabilityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update opportunity probability (as override)"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    
    # Verify opportunity exists
    opp = await canonical_db.opportunities.find_one({
        "canonical_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Upsert override
    await app_db.overrides.update_one(
        {
            "canonical_id": opp_id,
            "org_id": current_user.get("org_id", "default")
        },
        {
            "$set": {
                "probability": prob_data.probability,
                "updated_at": now_utc(),
                "updated_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Probability updated",
        "canonical_id": opp_id,
        "probability": prob_data.probability
    }


@opportunities_router.get("/{opp_id}/messages")
async def get_opportunity_messages(
    opp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get messages/communications for an opportunity"""
    app_db = get_app_db()
    
    # Get notes from database
    notes = await app_db.notes.find({
        "opportunity_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    }).sort("created_at", -1).to_list(100)
    
    if notes:
        return serialize_doc(notes)
    
    # Return empty list if no notes
    return []


@opportunities_router.post("/{opp_id}/notes")
async def create_opportunity_note(
    opp_id: str,
    note_data: NoteCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a note under an opportunity"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    
    # Verify opportunity exists
    opp = await canonical_db.opportunities.find_one({
        "canonical_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    note_doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "opportunity_id": opp_id,
        "content": note_data.content,
        "note_type": note_data.note_type,
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "Unknown"),
        "created_at": now_utc()
    }
    
    await app_db.notes.insert_one(note_doc)
    
    logger.info(f"Note created for opportunity {opp_id}")
    return serialize_doc(note_doc)


@opportunities_router.get("/{opp_id}/activities")
async def get_opportunity_activities(
    opp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all activities for an opportunity (from both canonical and app DB)"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get the opportunity to find its source_record_id
    opp = await canonical_db.opportunities.find_one({
        "canonical_id": opp_id,
        "org_id": org_id
    })
    
    # Build query conditions for activities
    # Activities can be linked by:
    # 1. opportunity_id (canonical_id format)
    # 2. opportunity_id (source_record_id format - integer from Odoo)
    query_conditions = [
        {"opportunity_id": opp_id, "org_id": org_id},
    ]
    
    if opp and opp.get("source_record_id"):
        # Also look for activities linked by the Odoo record ID
        source_id = opp.get("source_record_id")
        query_conditions.extend([
            {"opportunity_id": source_id, "org_id": org_id},
            {"opportunity_id": int(source_id) if source_id.isdigit() else source_id, "org_id": org_id},
        ])
    
    # Fetch from canonical DB (synced from Odoo)
    canonical_activities = await canonical_db.activities.find({
        "$or": query_conditions
    }).sort("date_deadline", -1).to_list(100)
    
    # Fetch from app DB (manually created)
    app_activities = await app_db.activities.find({
        "opportunity_id": opp_id,
        "org_id": org_id
    }).sort("created_at", -1).to_list(100)
    
    # Combine and deduplicate
    all_activities = canonical_activities + app_activities
    
    # Normalize activity format for frontend
    normalized = []
    for act in all_activities:
        normalized.append({
            "id": act.get("canonical_id") or act.get("id") or str(act.get("_id")),
            "type": act.get("activity_type", "").lower().replace(" ", "_") or "todo",
            "subject": act.get("summary") or act.get("subject") or "Activity",
            "description": act.get("note") or act.get("description") or "",
            "status": act.get("state") or act.get("status") or "pending",
            "completed": act.get("state") == "done" or act.get("completed", False),
            "created_at": act.get("created_at") or act.get("synced_at"),
            "date_deadline": act.get("date_deadline"),
            "user_id": act.get("user_id") or act.get("assigned_user_id"),
            "assigned_user": act.get("assigned_user"),  # Added: user name for display
            "source_system": act.get("source_system", "local"),
        })
    
    return serialize_doc(normalized)


# ==================== LOG MESSAGES ====================

@opportunities_router.get("/{opp_id}/logs")
async def get_opportunity_logs(
    opp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get log messages (chatter history) for an opportunity"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get the opportunity to find its source_record_id
    opp = await canonical_db.opportunities.find_one({
        "canonical_id": opp_id,
        "org_id": org_id
    })
    
    # Build query - look for logs by both canonical_id and source_record_id
    query_conditions = [
        {"opportunity_id": opp_id, "org_id": org_id},
    ]
    
    if opp and opp.get("source_record_id"):
        source_id = str(opp.get("source_record_id"))
        query_conditions.extend([
            {"opportunity_id": source_id, "org_id": org_id},
        ])
    
    # Fetch log messages
    logs = await canonical_db.log_messages.find({
        "$or": query_conditions
    }).sort("date", -1).to_list(100)
    
    # Normalize for frontend
    normalized = []
    for log in logs:
        # Clean HTML from body
        import re
        body = log.get("body", "") or ""
        body_clean = log.get("body_clean") or re.sub('<[^>]+>', '', body).strip()
        
        normalized.append({
            "id": log.get("canonical_id") or str(log.get("_id")),
            "author": log.get("author_name", "System"),
            "author_id": log.get("author_id"),
            "body": body_clean,
            "body_html": body,
            "date": log.get("date"),
            "message_type": log.get("message_type", "comment"),
            "source_system": log.get("source_system", "local"),
        })
    
    return serialize_doc(normalized)


# ==================== BLUESHEET ====================

@opportunities_router.get("/{opp_id}/bluesheet")
async def get_bluesheet(
    opp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get Bluesheet assessment for an opportunity"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    
    # Get opportunity
    opp = await canonical_db.opportunities.find_one({
        "canonical_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Get bluesheet data
    bluesheet = await app_db.bluesheets.find_one({
        "opportunity_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    # Get activities for this opportunity
    activities = await app_db.activities.find({
        "opportunity_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    }).to_list(100)
    
    # Calculate probability
    bluesheet_data = bluesheet or {}
    probability_result = calculate_bluesheet_probability(
        serialize_doc(opp),
        bluesheet_data,
        serialize_doc(activities)
    )
    
    return {
        "opportunity_id": opp_id,
        "bluesheet": serialize_doc(bluesheet_data) if bluesheet else None,
        "calculated_probability": probability_result,
        "form_options": get_bluesheet_form_options()
    }


@opportunities_router.put("/{opp_id}/bluesheet")
async def update_bluesheet(
    opp_id: str,
    bluesheet_data: BluesheetUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update Bluesheet assessment for an opportunity"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    
    # Verify opportunity exists
    opp = await canonical_db.opportunities.find_one({
        "canonical_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Prepare bluesheet document
    bluesheet_doc = {
        "opportunity_id": opp_id,
        "org_id": current_user.get("org_id", "default"),
        "buying_influences": [bi.model_dump() for bi in (bluesheet_data.buying_influences or [])],
        "competition_status": bluesheet_data.competition_status,
        "budget_status": bluesheet_data.budget_status,
        "timeline_notes": bluesheet_data.timeline_notes,
        "win_strategy": bluesheet_data.win_strategy,
        "key_issues": bluesheet_data.key_issues or [],
        "updated_at": now_utc(),
        "updated_by": current_user["id"]
    }
    
    # Upsert bluesheet
    await app_db.bluesheets.update_one(
        {"opportunity_id": opp_id, "org_id": current_user.get("org_id", "default")},
        {"$set": bluesheet_doc},
        upsert=True
    )
    
    # Get activities to calculate probability
    activities = await app_db.activities.find({
        "opportunity_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    }).to_list(100)
    
    # Calculate new probability
    probability_result = calculate_bluesheet_probability(
        serialize_doc(opp),
        bluesheet_doc,
        serialize_doc(activities)
    )
    
    # Update override with calculated probability
    import uuid
    override_id = f"override_{opp_id}"
    await app_db.overrides.update_one(
        {"canonical_id": opp_id, "org_id": current_user.get("org_id", "default")},
        {
            "$set": {
                "id": override_id,
                "canonical_id": opp_id,
                "org_id": current_user.get("org_id", "default"),
                "probability": round(probability_result["probability"]),
                "bluesheet_probability": probability_result["probability"],
                "updated_at": now_utc(),
                "updated_by": current_user["id"]
            },
            "$setOnInsert": {
                "created_at": now_utc()
            }
        },
        upsert=True
    )
    
    logger.info(f"Bluesheet updated for {opp_id}, probability: {probability_result['probability']}")
    
    return {
        "success": True,
        "calculated_probability": probability_result,
        "bluesheet": bluesheet_doc
    }


@opportunities_router.post("/{opp_id}/bluesheet/calculate")
async def calculate_bluesheet_only(
    opp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Recalculate Bluesheet probability without saving"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    
    # Get opportunity
    opp = await canonical_db.opportunities.find_one({
        "canonical_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Get bluesheet data
    bluesheet = await app_db.bluesheets.find_one({
        "opportunity_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    # Get activities
    activities = await app_db.activities.find({
        "opportunity_id": opp_id,
        "org_id": current_user.get("org_id", "default")
    }).to_list(100)
    
    # Calculate
    probability_result = calculate_bluesheet_probability(
        serialize_doc(opp),
        bluesheet or {},
        serialize_doc(activities)
    )
    
    return probability_result


# ==================== LEADS ====================

@leads_router.get("")
async def list_leads(
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    stage: Optional[str] = None,
    year: Optional[str] = Query(None, description="Filter by year (e.g., 2024, 2025, 2026)"),
    quarter: Optional[str] = Query(None, description="Filter by quarter (Q1, Q2, Q3, Q4)"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """List leads (type=lead) with overrides applied and optional filters"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    logger.info(f"Leads list request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Build query - ONLY type=lead (exclude opportunities)
    query = {
        "org_id": current_user.get("org_id", "default"),
        "type": "lead"  # Filter to only leads
    }
    
    # Apply non-date filters
    if stage:
        query["stage"] = stage
    if sales_rep:
        query["owner_name"] = sales_rep
    if team_id:
        query["team_id"] = team_id
    if account:
        query["account_name"] = account
    
    # Get from canonical - get more records if filtering
    fetch_limit = limit * 10 if (year or quarter) else limit
    records = await canonical_db.opportunities.find(query).skip(skip).limit(fetch_limit).to_list(fetch_limit)
    
    # Apply date-based filters
    records = apply_date_filters(records, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    # Trim to requested limit
    records = records[:limit]
    
    logger.info(f"After filtering: {len(records)} leads")
    
    # Merge with overrides
    merged = await merge_with_overrides(records, current_user.get("org_id", "default"), app_db)
    
    return merged


@leads_router.get("/kanban")
async def leads_kanban(
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """Get leads (type=lead) organized by stage for kanban view"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Leads Kanban request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Build query - ONLY type=lead
    query = {
        "org_id": org_id,
        "type": "lead"
    }
    if sales_rep:
        query["owner_name"] = sales_rep
    if team_id:
        query["team_id"] = team_id
    if account:
        query["account_name"] = account
    
    # Get all leads
    records = await canonical_db.opportunities.find(query).to_list(1000)
    
    # Apply date filters
    records = apply_date_filters(records, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    logger.info(f"Leads Kanban after filtering: {len(records)} leads")
    
    # Merge with overrides
    merged = await merge_with_overrides(records, org_id, app_db)
    
    # Lead stages - different from opportunity stages
    lead_stages = ["new", "qualified", "proposition", "won", "lost"]
    
    # Organize by stage
    kanban = {stage: [] for stage in lead_stages}
    kanban["unknown"] = []
    
    for record in merged:
        stage = (record.get("stage", "unknown") or "unknown").lower()
        # Normalize stage names
        if "new" in stage or "enquiry" in stage:
            kanban["new"].append(record)
        elif "qualified" in stage or "qualification" in stage:
            kanban["qualified"].append(record)
        elif "proposition" in stage or "proposal" in stage:
            kanban["proposition"].append(record)
        elif "won" in stage:
            kanban["won"].append(record)
        elif "lost" in stage:
            kanban["lost"].append(record)
        else:
            kanban["unknown"].append(record)
    
    return {
        "stages": lead_stages,
        "data": kanban,
        "filtered": any([year, quarter, sales_rep, team_id, account]),
        "total_count": len(merged)
    }


@leads_router.get("/stats")
async def leads_stats(
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """Get leads statistics"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Build query - ONLY type=lead
    query = {
        "org_id": org_id,
        "type": "lead"
    }
    if sales_rep:
        query["owner_name"] = sales_rep
    
    # Get all leads
    records = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Apply date filters
    records = apply_date_filters(records, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    # Calculate stats
    total_leads = len(records)
    total_value = sum(r.get("amount", 0) or 0 for r in records)
    
    # By stage
    new_leads = len([r for r in records if "new" in (r.get("stage") or "").lower() or "enquiry" in (r.get("stage") or "").lower()])
    qualified_leads = len([r for r in records if "qualified" in (r.get("stage") or "").lower()])
    converted_leads = len([r for r in records if "won" in (r.get("stage") or "").lower()])
    lost_leads = len([r for r in records if "lost" in (r.get("stage") or "").lower()])
    
    conversion_rate = (converted_leads / total_leads * 100) if total_leads > 0 else 0
    
    return {
        "total_leads": total_leads,
        "total_value": total_value,
        "new_leads": new_leads,
        "qualified_leads": qualified_leads,
        "converted_leads": converted_leads,
        "lost_leads": lost_leads,
        "conversion_rate": round(conversion_rate, 1),
        "filtered": any([year, quarter, sales_rep])
    }


@leads_router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single lead with overrides"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    record = await canonical_db.opportunities.find_one({
        "canonical_id": lead_id,
        "org_id": current_user.get("org_id", "default"),
        "type": "lead"
    })
    
    if not record:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    merged = await merge_with_overrides([record], current_user.get("org_id", "default"), app_db)
    return merged[0]


@leads_router.post("/{lead_id}/convert")
async def convert_lead_to_opportunity(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Convert a lead to an opportunity"""
    canonical_db = get_canonical_db()
    
    # Get the lead
    lead = await canonical_db.opportunities.find_one({
        "canonical_id": lead_id,
        "org_id": current_user.get("org_id", "default"),
        "type": "lead"
    })
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Update the type to opportunity
    await canonical_db.opportunities.update_one(
        {"canonical_id": lead_id},
        {"$set": {"type": "opportunity", "updated_at": now_utc()}}
    )
    
    logger.info(f"Lead {lead_id} converted to opportunity")
    
    return {
        "success": True,
        "message": "Lead converted to opportunity",
        "lead_id": lead_id
    }


# ==================== ACCOUNTS ====================

@accounts_router.get("")
async def list_accounts(
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """List accounts with optional filters"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Accounts list request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Base query
    query = {"org_id": org_id}
    
    # Get all accounts first
    accounts = await canonical_db.accounts.find(query).to_list(1000)
    
    # If we need to filter by sales_rep or year, we need to check related opportunities
    if sales_rep or year or quarter:
        # Get opportunities that match the filter
        opp_query = {"org_id": org_id}
        if sales_rep:
            opp_query["owner_name"] = sales_rep
        
        opps = await canonical_db.opportunities.find(opp_query).to_list(10000)
        
        # Apply date filters on opportunities
        opps = apply_date_filters(opps, year=year, quarter=quarter, date_field=date_field or 'create_date')
        
        # Get unique account names from filtered opportunities
        valid_accounts = set(o.get("account_name") for o in opps if o.get("account_name"))
        
        # Filter accounts to only those with matching opportunities
        accounts = [a for a in accounts if a.get("name") in valid_accounts]
    
    logger.info(f"Accounts after filtering: {len(accounts)}")
    
    return serialize_doc(accounts)


@accounts_router.post("")
async def create_account(
    account_data: AccountCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create account (stored in app DB, not canonical)"""
    app_db = get_app_db()
    
    account_doc = {
        "id": generate_id(),
        "canonical_id": f"local_account_{generate_id()[:8]}",
        "org_id": current_user.get("org_id", "default"),
        "source_system": "local",
        "created_by": current_user["id"],
        "created_at": now_utc(),
        **account_data.model_dump()
    }
    
    await app_db.local_accounts.insert_one(account_doc)
    return serialize_doc(account_doc)


@accounts_router.get("/{account_id}/360")
async def get_account_360(
    account_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get 360 view of account"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Try canonical first
    account = await canonical_db.accounts.find_one({
        "canonical_id": account_id,
        "org_id": org_id
    })
    
    # Try local accounts
    if not account:
        account = await app_db.local_accounts.find_one({
            "id": account_id,
            "org_id": org_id
        })
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Get related opportunities by account_id or account_name
    account_name = account.get("name")
    source_record_id = account.get("source_record_id")
    
    opp_query = {"org_id": org_id, "$or": [{"account_name": account_name}]}
    if source_record_id:
        opp_query["$or"].append({"account_id": str(source_record_id)})
    
    opps = await canonical_db.opportunities.find(opp_query).to_list(100)
    
    # Get related contacts by account_id
    contact_query = {"org_id": org_id}
    if source_record_id:
        contact_query["$or"] = [
            {"account_id": str(source_record_id)},
            {"account_name": account_name}
        ]
    else:
        contact_query["account_name"] = account_name
    
    contacts = await canonical_db.contacts.find(contact_query).to_list(50)
    
    # Get related invoices by account_id or account_name
    invoice_query = {"org_id": org_id}
    if source_record_id:
        invoice_query["$or"] = [
            {"account_id": str(source_record_id)},
            {"account_name": account_name}
        ]
    else:
        invoice_query["account_name"] = account_name
    
    invoices = await canonical_db.invoices.find(invoice_query).sort("invoice_date", -1).to_list(20)
    
    # Get related activities
    activities = await app_db.activities.find({
        "account_id": account_id,
        "org_id": org_id
    }).to_list(100)
    
    result = serialize_doc(account)
    result["opportunities"] = serialize_doc(opps)
    # Use sale_value (custom field) if available, otherwise fall back to amount
    result["total_value"] = sum(
        float(o.get("sale_value", 0) or 0) or float(o.get("amount", 0) or 0) 
        for o in opps
    )
    result["opportunities_count"] = len(opps)
    
    # Calculate Won Deals for this account
    won_opps = [o for o in opps if (o.get("stage") or "").lower() == "won"]
    result["won_count"] = len(won_opps)
    result["won_value"] = sum(
        float(o.get("sale_value", 0) or 0) or float(o.get("amount", 0) or 0) 
        for o in won_opps
    )
    
    # Format contacts for display
    result["contacts"] = []
    for contact in contacts:
        result["contacts"].append({
            "id": contact.get("canonical_id") or str(contact.get("_id")),
            "name": contact.get("name", "Unknown"),
            "title": contact.get("title") or contact.get("function") or "",
            "email": contact.get("email") or "",
            "phone": contact.get("phone") or ""
        })
    
    # Format invoices for display
    result["invoices"] = []
    total_invoiced = 0
    total_outstanding = 0
    for inv in invoices:
        amount = inv.get("amount_total", 0) or 0
        result["invoices"].append({
            "id": inv.get("canonical_id") or str(inv.get("_id")),
            "invoice_number": inv.get("invoice_number"),
            "amount": amount,
            "currency": inv.get("currency", "OMR"),
            "invoice_date": inv.get("invoice_date"),
            "due_date": inv.get("due_date"),
            "status": inv.get("payment_state", "pending")
        })
        total_invoiced += amount
        if inv.get("payment_state") != "paid":
            total_outstanding += amount
    
    result["total_invoiced"] = total_invoiced
    result["total_outstanding"] = total_outstanding
    result["invoices_count"] = len(invoices)
    
    result["activities"] = serialize_doc(activities)
    result["activities_count"] = len(activities)
    
    return result


# ==================== ACTIVITIES ====================

@activities_router.get("")
async def list_activities(
    opportunity_id: Optional[str] = None,
    account_id: Optional[str] = None,
    status: Optional[str] = None,
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """List CRM activities from both canonical (synced) and app (local) databases.
    Only returns activities related to CRM (crm.lead), not project tasks.
    """
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Activities list request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Build query for canonical CRM activities ONLY
    # Include activities with res_model='crm.lead' OR activities with opportunity_id (from crm.activity.report)
    canonical_query = {
        "org_id": org_id,
        "$or": [
            {"res_model": "crm.lead"},
            {"opportunity_id": {"$exists": True, "$ne": None}}
        ]
    }
    app_query = {"org_id": org_id}
    
    if opportunity_id:
        canonical_query = {
            "org_id": org_id,
            "opportunity_id": opportunity_id
        }
        app_query["opportunity_id"] = opportunity_id
    if account_id:
        app_query["account_id"] = account_id
    if sales_rep:
        canonical_query["$or"] = [
            {"assigned_user": sales_rep},
            {"salesperson": sales_rep}
        ]
        app_query["owner_name"] = sales_rep
    
    # Fetch CRM activities from canonical DB (synced from Odoo)
    canonical_activities = await canonical_db.activities.find(canonical_query).to_list(10000)
    
    # Fetch from app DB (manually created)
    app_activities = await app_db.activities.find(app_query).to_list(1000)
    
    # Normalize both sets to consistent format
    all_activities = []
    
    for act in canonical_activities:
        # Get the original activity type and use it directly (not normalized to generic bucket)
        original_type = act.get("activity_type") or "To Do"
        normalized = {
            "id": act.get("canonical_id") or str(act.get("_id")),
            "type": original_type.lower().replace(" ", "_"),
            "type_display": original_type,  # Original type for display
            "subject": act.get("summary") or act.get("opportunity_name") or "Activity",
            "description": act.get("note") or "",
            "status": "completed" if (act.get("state") == "done" or act.get("completed_at")) else "pending",
            "owner_name": act.get("assigned_user") or act.get("salesperson") or "System",
            "due_date": act.get("date_deadline"),
            "created_at": act.get("created_at") or act.get("completed_at") or act.get("synced_at"),
            "create_date": act.get("create_date") or act.get("completed_at") or act.get("synced_at"),
            "opportunity_id": act.get("opportunity_id"),
            "opportunity_name": act.get("opportunity_name"),
            "customer_name": act.get("customer_name"),
            "source": "odoo"
        }
        # Apply status filter if provided
        if status and normalized["status"] != status:
            continue
        all_activities.append(normalized)
    
    for act in app_activities:
        normalized = {
            "id": act.get("id") or str(act.get("_id")),
            "type": act.get("type") or "task",
            "subject": act.get("subject") or "Activity",
            "description": act.get("description") or "",
            "status": act.get("status") or "pending",
            "owner_name": act.get("owner_name") or "Unknown",
            "due_date": act.get("due_date"),
            "created_at": act.get("created_at"),
            "create_date": act.get("created_at"),
            "opportunity_id": act.get("opportunity_id"),
            "source": "local"
        }
        # Apply status filter if provided
        if status and normalized["status"] != status:
            continue
        all_activities.append(normalized)
    
    # Apply date filters
    all_activities = apply_date_filters(all_activities, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    logger.info(f"Activities after filtering: {len(all_activities)}")
    
    # Sort by due_date or created_at
    all_activities.sort(key=lambda x: str(x.get("due_date") or x.get("created_at") or ""), reverse=True)
    
    return serialize_doc(all_activities)


@activities_router.get("/stats")
async def get_activity_stats(current_user: dict = Depends(get_current_user)):
    """Get CRM activity statistics. Only counts CRM-related activities, not project tasks."""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get CRM activities from canonical DB 
    # Include activities with res_model='crm.lead' OR activities with opportunity_id (from crm.activity.report)
    canonical_activities = await canonical_db.activities.find({
        "org_id": org_id,
        "$or": [
            {"res_model": "crm.lead"},
            {"opportunity_id": {"$exists": True, "$ne": None}}
        ]
    }).to_list(10000)
    
    # Get activities from app DB
    app_activities = await app_db.activities.find({"org_id": org_id}).to_list(1000)
    
    # NOTE: Project tasks (canonical_db.tasks) are NOT included in CRM activity stats
    
    # Combine and categorize
    calls = 0
    emails = 0
    meetings = 0
    task_count = 0
    completed = 0
    pending = 0
    overdue = 0
    
    # Track all detailed activity types
    detailed_types = {}
    
    for act in canonical_activities:
        act_type = (act.get("activity_type") or "To Do")
        act_type_lower = act_type.lower()
        
        # Count detailed types
        detailed_types[act_type] = detailed_types.get(act_type, 0) + 1
        
        # Also categorize into main buckets for backward compatibility
        if "call" in act_type_lower or "phone" in act_type_lower:
            calls += 1
        elif "email" in act_type_lower or "mail" in act_type_lower:
            emails += 1
        elif "meet" in act_type_lower or "demo" in act_type_lower or "site visit" in act_type_lower or "poc" in act_type_lower or "workshop" in act_type_lower or "roundtable" in act_type_lower:
            meetings += 1
        else:
            task_count += 1
        
        # Check for completion
        if act.get("state") == "done" or act.get("completed_at"):
            completed += 1
        else:
            pending += 1
    
    for act in app_activities:
        act_type = (act.get("type") or "task")
        act_type_lower = act_type.lower()
        
        # Count detailed types
        detailed_types[act_type] = detailed_types.get(act_type, 0) + 1
        
        if act_type_lower == "call":
            calls += 1
        elif act_type_lower == "email":
            emails += 1
        elif act_type_lower == "meeting":
            meetings += 1
        else:
            task_count += 1
        
        status = act.get("status")
        if status == "completed":
            completed += 1
        elif status == "overdue":
            overdue += 1
        else:
            pending += 1
    
    total = calls + emails + meetings + task_count
    
    # Sort detailed types by count
    sorted_detailed_types = dict(sorted(detailed_types.items(), key=lambda x: -x[1]))
    
    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "overdue": overdue,
        "by_type": {
            "calls": calls,
            "emails": emails,
            "meetings": meetings,
            "tasks": task_count
        },
        "detailed_types": sorted_detailed_types
    }


@activities_router.post("")
async def create_activity(
    activity_data: ActivityCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create activity"""
    app_db = get_app_db()
    
    activity_doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "status": "pending",
        "completed": False,
        "created_by": current_user["id"],
        "owner_name": current_user.get("name", "Unknown"),
        "created_at": now_utc(),
        **activity_data.model_dump()
    }
    
    await app_db.activities.insert_one(activity_doc)
    
    # Emit event
    await emit_event(
        event_type=Topics.CRM_ACTIVITY_UPDATED,
        payload={
            "activity_id": activity_doc["id"],
            "action": "created",
            "activity_type": activity_data.type,
            "opportunity_id": activity_data.opportunity_id
        },
        producer="crm-sales-service",
        org_id=current_user.get("org_id", "default")
    )
    
    return serialize_doc(activity_doc)


@activities_router.patch("/{activity_id}/status")
async def update_activity_status(
    activity_id: str,
    update_data: ActivityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update activity status"""
    app_db = get_app_db()
    
    update_fields = {"updated_at": now_utc()}
    if update_data.status:
        update_fields["status"] = update_data.status
    if update_data.completed is not None:
        update_fields["completed"] = update_data.completed
    if update_data.notes:
        update_fields["notes"] = update_data.notes
    
    result = await app_db.activities.update_one(
        {"id": activity_id, "org_id": current_user.get("org_id", "default")},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Emit event
    await emit_event(
        event_type=Topics.CRM_ACTIVITY_UPDATED,
        payload={
            "activity_id": activity_id,
            "action": "updated",
            "activity_type": "unknown",
            "opportunity_id": None
        },
        producer="crm-sales-service",
        org_id=current_user.get("org_id", "default")
    )
    
    return {"success": True, "message": "Activity updated"}


@activities_router.patch("/{activity_id}/complete")
async def complete_activity(
    activity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark activity as completed"""
    app_db = get_app_db()
    
    result = await app_db.activities.update_one(
        {"id": activity_id, "org_id": current_user.get("org_id", "default")},
        {"$set": {"status": "completed", "completed": True, "completed_at": now_utc()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    return {"success": True, "message": "Activity completed"}


# ==================== KPIS ====================

@kpis_router.get("")
async def list_kpis(current_user: dict = Depends(get_current_user)):
    """List KPIs"""
    app_db = get_app_db()
    
    kpis = await app_db.kpis.find({"org_id": current_user.get("org_id", "default")}).to_list(100)
    
    if not kpis:
        # Return default KPIs
        return [
            {"id": "1", "name": "Win Rate", "target_value": 35, "current_value": 28, "unit": "percent", "change": 5.2},
            {"id": "2", "name": "Average Deal Size", "target_value": 100000, "current_value": 85000, "unit": "currency", "change": 12.5},
            {"id": "3", "name": "Sales Cycle", "target_value": 45, "current_value": 52, "unit": "days", "change": -8.3},
            {"id": "4", "name": "Monthly Calls", "target_value": 500, "current_value": 423, "unit": "number", "change": 15.0}
        ]
    
    return serialize_doc(kpis)


@kpis_router.post("")
async def create_kpi(
    kpi_data: KPICreate,
    current_user: dict = Depends(get_current_user)
):
    """Create KPI"""
    app_db = get_app_db()
    
    kpi_doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "change": 0,
        "created_at": now_utc(),
        **kpi_data.model_dump()
    }
    
    await app_db.kpis.insert_one(kpi_doc)
    return serialize_doc(kpi_doc)


@kpis_router.put("/{kpi_id}")
async def update_kpi(
    kpi_id: str,
    kpi_data: KPICreate,
    current_user: dict = Depends(get_current_user)
):
    """Update KPI"""
    app_db = get_app_db()
    
    result = await app_db.kpis.update_one(
        {"id": kpi_id, "org_id": current_user.get("org_id", "default")},
        {"$set": {**kpi_data.model_dump(), "updated_at": now_utc()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    return {"success": True, "message": "KPI updated"}


@kpis_router.delete("/{kpi_id}")
async def delete_kpi(
    kpi_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete KPI"""
    app_db = get_app_db()
    
    result = await app_db.kpis.delete_one({
        "id": kpi_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    return {"success": True, "message": "KPI deleted"}


# ==================== RECEIVABLES ====================

@receivables_router.get("")
async def list_receivables(
    current_user: dict = Depends(get_current_user),
    status: str = Query(None, description="Filter by payment status: pending, paid, overdue, all"),
    account: str = Query(None, description="Filter by account name"),
    year: str = Query(None, description="Filter by year (based on invoice_date)"),
    quarter: str = Query(None, description="Filter by quarter (Q1, Q2, Q3, Q4)"),
    limit: int = Query(200, description="Maximum number of records")
):
    """List receivables/invoices from synced Odoo data with contextual filters"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Receivables request - status: {status}, account: {account}, year: {year}, quarter: {quarter}")
    
    # Build query
    query = {"org_id": org_id}
    
    # Filter by account if provided
    if account:
        query["account_name"] = account
    
    # Fetch all invoices first (we'll filter by status and date in Python for more flexibility)
    invoices = await canonical_db.invoices.find(query).sort("due_date", -1).limit(500).to_list(500)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Apply date filters
    if year or quarter:
        quarter_months = {
            "Q1": ["01", "02", "03"], 
            "Q2": ["04", "05", "06"], 
            "Q3": ["07", "08", "09"], 
            "Q4": ["10", "11", "12"]
        }
        filtered = []
        for inv in invoices:
            inv_date = inv.get("invoice_date")
            if not inv_date:
                continue
            
            if year and not str(inv_date).startswith(str(year)):
                continue
            
            if quarter:
                months = quarter_months.get(quarter, [])
                inv_month = str(inv_date)[5:7] if len(str(inv_date)) >= 7 else ""
                if inv_month not in months:
                    continue
            
            filtered.append(inv)
        invoices = filtered
    
    # Format for frontend and apply status filter
    result = []
    stats = {"total": 0, "pending": 0, "overdue": 0, "paid": 0}
    
    for inv in invoices:
        payment_state = inv.get("payment_state", "not_paid")
        due_date = inv.get("due_date", "")
        amount = inv.get("amount_total") or 0
        
        # Determine status
        if payment_state == "paid":
            computed_status = "paid"
        elif due_date and due_date < today:
            computed_status = "overdue"
        else:
            computed_status = "pending"
        
        # Update stats
        stats["total"] += amount
        stats[computed_status] += amount
        
        # Apply status filter
        if status and status != "all" and computed_status != status:
            continue
        
        result.append({
            "id": inv.get("canonical_id") or str(inv.get("_id")),
            "invoice_number": inv.get("invoice_number"),
            "account": inv.get("account_name") or "Unknown",
            "account_id": inv.get("account_id"),
            "amount": amount,
            "currency": inv.get("currency", "OMR"),
            "due_date": due_date,
            "invoice_date": inv.get("invoice_date"),
            "status": computed_status,
            "payment_state": payment_state,
            "source_system": inv.get("source_system", "odoo")
        })
    
    # Limit results
    result = result[:limit]
    
    logger.info(f"Receivables: returning {len(result)} invoices. Stats: {stats}")
    
    return {
        "invoices": serialize_doc(result),
        "stats": stats,
        "filters_applied": {
            "status": status,
            "account": account,
            "year": year,
            "quarter": quarter
        }
    }


@receivables_router.get("/stats")
async def get_receivables_stats(
    current_user: dict = Depends(get_current_user),
    year: str = Query(None, description="Filter by year"),
    quarter: str = Query(None, description="Filter by quarter")
):
    """Get receivables statistics with optional date filters"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Fetch all invoices
    invoices = await canonical_db.invoices.find({"org_id": org_id}).to_list(1000)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Apply date filters
    if year or quarter:
        quarter_months = {
            "Q1": ["01", "02", "03"], 
            "Q2": ["04", "05", "06"], 
            "Q3": ["07", "08", "09"], 
            "Q4": ["10", "11", "12"]
        }
        filtered = []
        for inv in invoices:
            inv_date = inv.get("invoice_date")
            if not inv_date:
                continue
            
            if year and not str(inv_date).startswith(str(year)):
                continue
            
            if quarter:
                months = quarter_months.get(quarter, [])
                inv_month = str(inv_date)[5:7] if len(str(inv_date)) >= 7 else ""
                if inv_month not in months:
                    continue
            
            filtered.append(inv)
        invoices = filtered
    
    # Calculate stats
    stats = {
        "total_invoiced": 0,
        "total_pending": 0,
        "total_overdue": 0,
        "total_paid": 0,
        "count_total": 0,
        "count_pending": 0,
        "count_overdue": 0,
        "count_paid": 0
    }
    
    for inv in invoices:
        payment_state = inv.get("payment_state", "not_paid")
        due_date = inv.get("due_date", "")
        amount = inv.get("amount_total") or 0
        
        stats["total_invoiced"] += amount
        stats["count_total"] += 1
        
        if payment_state == "paid":
            stats["total_paid"] += amount
            stats["count_paid"] += 1
        elif due_date and due_date < today:
            stats["total_overdue"] += amount
            stats["count_overdue"] += 1
        else:
            stats["total_pending"] += amount
            stats["count_pending"] += 1
    
    # Get unique accounts for filter
    accounts = list(set(inv.get("account_name") for inv in invoices if inv.get("account_name")))
    
    return {
        "stats": stats,
        "filter_options": {
            "accounts": sorted(accounts),
            "years": sorted(list(set(str(inv.get("invoice_date", ""))[:4] for inv in invoices if inv.get("invoice_date"))), reverse=True)
        }
    }
