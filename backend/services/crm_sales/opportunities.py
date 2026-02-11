"""CRM Sales - Split module. See helpers.py for shared imports."""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc, PipelineStages
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.routes import get_current_user
from services.crm_sales.models import *
from services.crm_sales.bluesheet import calculate_bluesheet_probability, get_bluesheet_form_options, BUYING_INFLUENCES, COMPETITION_STATUS, BUDGET_STATUS
from services.rbac_sync.middleware import get_rbac_filter
from services.crm_sales.helpers import STAGE_ALIASES, apply_date_filters

logger = logging.getLogger(__name__)

opportunities_router = APIRouter(prefix="/opportunities", tags=["opportunities"])


# ==================== HELPER FUNCTIONS ====================

async def find_opportunity_by_id(opp_id: str, org_id: str, canonical_db):
    """
    Find an opportunity by any ID type: _id (ObjectId), canonical_id, or source_record_id.
    See /app/docs/CRM_DATA_MODEL_REFERENCE.md for data linking rules.
    """
    opp = None
    
    # 1. Try by _id (MongoDB ObjectId)
    try:
        opp = await canonical_db.opportunities.find_one({
            "_id": ObjectId(opp_id),
            "org_id": org_id
        })
    except:
        pass
    
    # 2. Try by canonical_id
    if not opp:
        opp = await canonical_db.opportunities.find_one({
            "canonical_id": opp_id,
            "org_id": org_id
        })
    
    # 3. Try by source_record_id
    if not opp:
        opp = await canonical_db.opportunities.find_one({
            "source_record_id": opp_id,
            "org_id": org_id
        })
    
    return opp


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
    request: Request,
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    stage: Optional[str] = None,
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    account: Optional[str] = Query(None, description="Filter by account"),
    product_manager: Optional[str] = Query(None, description="Filter by product director"),
    solution_category: Optional[str] = Query(None, description="Filter by solution category"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """List opportunities (type=opportunity) with overrides applied, optional filters, and RBAC"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    logger.info(f"Opportunities list request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Get RBAC filter for current user
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Build query - ONLY type=opportunity (exclude leads)
    query = {
        "org_id": current_user.get("org_id", "default"),
        "type": "opportunity"  # Filter to only opportunities
    }
    
    # Apply RBAC filter (merged with base query)
    query.update(rbac_filter)
    
    # Stage aliases (Odoo uses various formats)
    STAGE_ALIASES = {
        "closed_won": ["Won", "Closed Won", "closed_won"],
        "closed_lost": ["Lost", "Closed Lost", "closed_lost"],
        "qualified": ["Qualified Opportunity", "Qualified", "qualified"],
        "proposal": ["Proposal", "proposal"],
        "negotiation": ["Review&Negotiation", "Negotiation", "negotiation"],
    }
    
    # Apply non-date filters
    if stage:
        aliases = STAGE_ALIASES.get(stage.lower())
        if aliases:
            query["stage"] = {"$in": aliases}
        else:
            query["stage"] = stage
    if sales_rep:
        query["owner_name"] = sales_rep
    if team_id:
        query["team_id"] = team_id
    if account:
        query["account_name"] = account
    if product_manager:
        query["product_manager"] = {"$regex": f"^{product_manager}$", "$options": "i"}
    if solution_category:
        query["solution_category"] = solution_category
    
    # Get from canonical - get more records if filtering to ensure we have enough after date filter
    fetch_limit = limit * 10 if (year or quarter) else limit
    records = await canonical_db.opportunities.find(query).skip(skip).limit(fetch_limit).to_list(fetch_limit)
    
    # Get total count for pagination (without skip/limit)
    total_count = await canonical_db.opportunities.count_documents(query)
    
    # Apply date-based filters using the improved helper function
    records = apply_date_filters(records, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    # Trim to requested limit
    records = records[:limit]
    
    logger.info(f"After filtering: {len(records)} opportunities (RBAC applied), total: {total_count}")
    
    # Merge with overrides
    merged = await merge_with_overrides(records, current_user.get("org_id", "default"), app_db)
    
    return {
        "items": merged,
        "total": total_count,
        "limit": limit,
        "skip": skip,
        "has_more": (skip + limit) < total_count
    }


@opportunities_router.get("/export")
async def export_opportunities_excel(
    request: Request,
    stage: Optional[str] = None,
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    current_user: dict = Depends(get_current_user)
):
    """Export opportunities to Excel format (RBAC enforced)"""
    from fastapi.responses import StreamingResponse
    import pandas as pd
    import io
    
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter - CRITICAL for security
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Build query with RBAC
    query = {"org_id": org_id, "type": "opportunity"}
    query.update(rbac_filter)  # Apply RBAC filter
    
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


@opportunities_router.get("/won-with-invoices")
async def get_won_opportunities_with_invoices(
    request: Request,
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    current_user: dict = Depends(get_current_user)
):
    """Get Won opportunities with their invoice status (RBAC enforced)"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter - CRITICAL for security
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Build query with RBAC
    query = {"org_id": org_id}
    query.update(rbac_filter)  # Apply RBAC filter
    
    # Build query for Won opportunities
    query = {
        "org_id": org_id,
        "type": "opportunity"
    }
    if sales_rep:
        query["owner_name"] = sales_rep
    
    # Get all opportunities
    all_opps = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Filter to Won only
    won_opps = [o for o in all_opps if (o.get("stage") or "").lower() == "won"]
    
    # Apply date filters using won_at
    if year or quarter:
        quarter_months = {
            "Q1": [1, 2, 3], "Q2": [4, 5, 6], "Q3": [7, 8, 9], "Q4": [10, 11, 12]
        }
        filtered = []
        for opp in won_opps:
            won_date = opp.get("won_at") or opp.get("date_closed") or opp.get("create_date")
            if not won_date:
                continue
            
            won_date_parsed = parse_date_from_string(won_date)
            if not won_date_parsed:
                continue
            
            if year and str(won_date_parsed.year) != str(year):
                continue
            
            if quarter:
                months = quarter_months.get(quarter, [])
                if won_date_parsed.month not in months:
                    continue
            
            filtered.append(opp)
        won_opps = filtered
    
    # Get all invoices
    invoices = await canonical_db.invoices.find({"org_id": org_id}).to_list(5000)
    
    # Build invoice lookup by account_name
    invoices_by_account = {}
    for inv in invoices:
        acc = inv.get("account_name")
        if acc:
            if acc not in invoices_by_account:
                invoices_by_account[acc] = []
            invoices_by_account[acc].append(inv)
    
    # Merge with overrides
    merged = await merge_with_overrides(won_opps, org_id, app_db)
    
    # Calculate invoice status for each Won opportunity
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    result = []
    for opp in merged:
        acc_name = opp.get("account_name")
        acc_invoices = invoices_by_account.get(acc_name, [])
        
        # Calculate invoice totals for this account
        total_invoiced = 0
        total_paid = 0
        total_pending = 0
        total_overdue = 0
        
        for inv in acc_invoices:
            amount = inv.get("amount_total", 0) or 0
            payment_state = inv.get("payment_state", "not_paid")
            due_date = inv.get("due_date", "")
            
            total_invoiced += amount
            
            if payment_state == "paid":
                total_paid += amount
            elif due_date and due_date < today:
                total_overdue += amount
            else:
                total_pending += amount
        
        # Determine overall invoice status
        sale_value = opp.get("sale_value", 0) or 0
        if total_paid >= sale_value:
            invoice_status = "fully_paid"
        elif total_overdue > 0:
            invoice_status = "overdue"
        elif total_invoiced > 0:
            invoice_status = "partially_paid"
        else:
            invoice_status = "not_invoiced"
        
        result.append({
            **serialize_doc(opp),
            "invoice_status": invoice_status,
            "total_invoiced": total_invoiced,
            "total_paid": total_paid,
            "total_pending": total_pending,
            "total_overdue": total_overdue,
            "invoices_count": len(acc_invoices)
        })
    
    # Sort by overdue first, then by value
    result.sort(key=lambda x: (x["invoice_status"] != "overdue", -x.get("sale_value", 0)))
    
    return {
        "data": result,
        "summary": {
            "total_won": len(result),
            "fully_paid": len([r for r in result if r["invoice_status"] == "fully_paid"]),
            "partially_paid": len([r for r in result if r["invoice_status"] == "partially_paid"]),
            "overdue": len([r for r in result if r["invoice_status"] == "overdue"]),
            "not_invoiced": len([r for r in result if r["invoice_status"] == "not_invoiced"])
        }
    }


@opportunities_router.get("/kanban")
async def opportunities_kanban(
    request: Request,
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """Get opportunities (type=opportunity) organized by stage for kanban view (RBAC enforced)"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Kanban request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Get RBAC filter - CRITICAL for security
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Build query with RBAC - ONLY type=opportunity
    query = {
        "org_id": org_id,
        "type": "opportunity"  # Filter to only opportunities
    }
    query.update(rbac_filter)  # Apply RBAC filter
    
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
    """
    Get all activities for an opportunity (from both canonical and app DB)
    
    See /app/docs/CRM_DATA_MODEL_REFERENCE.md for data linking rules.
    """
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get the opportunity using helper function
    opp = await find_opportunity_by_id(opp_id, org_id, canonical_db)
    
    if not opp:
        return []  # No opportunity found
    
    # Get the source_record_id for activity linking
    source_id = opp.get("source_record_id") or opp.get("canonical_id")
    source_id_int = int(source_id) if source_id and str(source_id).isdigit() else None
    
    # Build query conditions for activities
    # Activities are linked by opportunity_id (integer) matching source_record_id
    query_conditions = []
    
    if source_id_int:
        query_conditions.append({"opportunity_id": source_id_int})
        query_conditions.append({"res_id": source_id_int})
    
    if source_id:
        query_conditions.append({"opportunity_id": source_id})
    
    query_conditions.append({"opportunity_id": opp_id})
    
    if not query_conditions:
        return []
    
    # Fetch from canonical DB (synced from Odoo)
    canonical_query = {
        "$and": [
            {"$or": query_conditions},
            {"$or": [
                {"org_id": org_id},
                {"org_id": {"$exists": False}}
            ]},
            {"$or": [
                {"res_model": "crm.lead"},
                {"res_model": {"$exists": False}},
                {"res_model": None}
            ]}
        ]
    }
    
    canonical_activities = await canonical_db.activities.find(
        canonical_query
    ).sort("date_deadline", -1).to_list(100)
    
    # Fetch from app DB (manually created)
    app_activities = await app_db.activities.find({
        "opportunity_id": opp_id,
        "org_id": org_id
    }).sort("created_at", -1).to_list(100)
    
    # Combine and deduplicate by canonical_id
    seen_ids = set()
    all_activities = []
    for act in canonical_activities + app_activities:
        act_id = act.get("canonical_id") or act.get("id") or str(act.get("_id"))
        if act_id not in seen_ids:
            seen_ids.add(act_id)
            all_activities.append(act)
    
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
            "assigned_user": act.get("assigned_user"),
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
    
    # Get the opportunity using helper function
    opp = await find_opportunity_by_id(opp_id, org_id, canonical_db)
    
    # Build query - look for logs by source_record_id (as both string and int)
    query_conditions = [
        {"opportunity_id": opp_id},
    ]
    
    if opp:
        source_id = opp.get("source_record_id") or opp.get("canonical_id")
        if source_id:
            source_id_int = int(source_id) if str(source_id).isdigit() else None
            query_conditions.append({"opportunity_id": str(source_id)})
            if source_id_int:
                query_conditions.append({"opportunity_id": source_id_int})
                query_conditions.append({"res_id": source_id_int, "res_model": "crm.lead"})
    
    # Fetch log messages
    logs = await canonical_db.log_messages.find({
        "$and": [
            {"$or": query_conditions},
            {"$or": [{"org_id": org_id}, {"org_id": {"$exists": False}}]}
        ]
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
    org_id = current_user.get("org_id", "default")
    
    # Get opportunity using helper function
    opp = await find_opportunity_by_id(opp_id, org_id, canonical_db)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Use canonical_id for bluesheet lookup
    canonical_id = opp.get("canonical_id") or str(opp.get("_id"))
    
    # Get bluesheet data
    bluesheet = await app_db.bluesheets.find_one({
        "opportunity_id": canonical_id,
        "org_id": org_id
    })
    
    # Get activities for this opportunity (from canonical DB)
    source_id = opp.get("source_record_id") or canonical_id
    source_id_int = int(source_id) if source_id and str(source_id).isdigit() else None
    
    activity_query = {"org_id": org_id}
    if source_id_int:
        activity_query["opportunity_id"] = source_id_int
    else:
        activity_query["opportunity_id"] = canonical_id
    
    activities = await canonical_db.activities.find(activity_query).to_list(100)
    
    # Calculate probability
    bluesheet_data = bluesheet or {}
    probability_result = calculate_bluesheet_probability(
        serialize_doc(opp),
        bluesheet_data,
        serialize_doc(activities)
    )
    
    return {
        "opportunity_id": canonical_id,
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
    org_id = current_user.get("org_id", "default")
    
    # Verify opportunity exists using helper
    opp = await find_opportunity_by_id(opp_id, org_id, canonical_db)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    canonical_id = opp.get("canonical_id") or str(opp.get("_id"))
    
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


