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
        merged.append(merged_record)
    
    return merged


@opportunities_router.get("")
async def list_opportunities(
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    stage: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List opportunities with overrides applied"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    # Build query
    query = {"org_id": current_user["org_id"]}
    if stage:
        query["stage"] = stage
    
    # Get from canonical
    records = await canonical_db.opportunities.find(query).skip(skip).limit(limit).to_list(limit)
    
    # Merge with overrides
    merged = await merge_with_overrides(records, current_user["org_id"], app_db)
    
    return merged


@opportunities_router.get("/kanban")
async def opportunities_kanban(current_user: dict = Depends(get_current_user)):
    """Get opportunities organized by stage for kanban view"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    # Get all opportunities
    records = await canonical_db.opportunities.find(
        {"org_id": current_user["org_id"]}
    ).to_list(1000)
    
    # Merge with overrides
    merged = await merge_with_overrides(records, current_user["org_id"], app_db)
    
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
        "data": kanban
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
        "org_id": current_user["org_id"]
    })
    
    if not record:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    merged = await merge_with_overrides([record], current_user["org_id"], app_db)
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
        "org_id": current_user["org_id"]
    })
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Get old value for event
    old_override = await app_db.overrides.find_one({
        "canonical_id": opp_id,
        "org_id": current_user["org_id"]
    })
    old_stage = old_override.get("stage") if old_override else opp.get("stage")
    
    # Upsert override
    override_id = generate_id()
    await app_db.overrides.update_one(
        {
            "canonical_id": opp_id,
            "org_id": current_user["org_id"]
        },
        {
            "$set": {
                "id": override_id,
                "canonical_id": opp_id,
                "org_id": current_user["org_id"],
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
        org_id=current_user["org_id"]
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
        "org_id": current_user["org_id"]
    })
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Upsert override
    await app_db.overrides.update_one(
        {
            "canonical_id": opp_id,
            "org_id": current_user["org_id"]
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
    # Mock messages for now
    return [
        {"id": "1", "subject": "Initial Contact", "preview": "Thank you for your interest...", "date": "2024-01-15"},
        {"id": "2", "subject": "Follow-up", "preview": "Following up on our conversation...", "date": "2024-01-18"},
        {"id": "3", "subject": "Proposal Review", "preview": "Please find attached...", "date": "2024-01-22"}
    ]


# ==================== ACCOUNTS ====================

@accounts_router.get("")
async def list_accounts(current_user: dict = Depends(get_current_user)):
    """List accounts"""
    canonical_db = get_canonical_db()
    
    accounts = await canonical_db.accounts.find(
        {"org_id": current_user["org_id"]}
    ).to_list(1000)
    
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
        "org_id": current_user["org_id"],
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
    
    # Try canonical first
    account = await canonical_db.accounts.find_one({
        "canonical_id": account_id,
        "org_id": current_user["org_id"]
    })
    
    # Try local accounts
    if not account:
        account = await app_db.local_accounts.find_one({
            "id": account_id,
            "org_id": current_user["org_id"]
        })
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Get related opportunities
    account_name = account.get("name")
    opps = await canonical_db.opportunities.find({
        "account_name": account_name,
        "org_id": current_user["org_id"]
    }).to_list(100)
    
    # Get related activities
    activities = await app_db.activities.find({
        "account_id": account_id,
        "org_id": current_user["org_id"]
    }).to_list(100)
    
    result = serialize_doc(account)
    result["opportunities"] = serialize_doc(opps)
    result["activities"] = serialize_doc(activities)
    result["total_value"] = sum(o.get("amount", 0) or 0 for o in opps)
    result["opportunities_count"] = len(opps)
    result["activities_count"] = len(activities)
    result["contacts"] = [
        {"id": "1", "name": "John Smith", "title": "CEO", "email": "john@example.com"},
        {"id": "2", "name": "Jane Doe", "title": "VP Sales", "email": "jane@example.com"}
    ]
    
    return result


# ==================== ACTIVITIES ====================

@activities_router.get("")
async def list_activities(
    opportunity_id: Optional[str] = None,
    account_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List activities"""
    app_db = get_app_db()
    
    query = {"org_id": current_user["org_id"]}
    if opportunity_id:
        query["opportunity_id"] = opportunity_id
    if account_id:
        query["account_id"] = account_id
    if status:
        query["status"] = status
    
    activities = await app_db.activities.find(query).to_list(1000)
    return serialize_doc(activities)


@activities_router.get("/stats")
async def get_activity_stats(current_user: dict = Depends(get_current_user)):
    """Get activity statistics"""
    app_db = get_app_db()
    
    activities = await app_db.activities.find(
        {"org_id": current_user["org_id"]}
    ).to_list(1000)
    
    return {
        "total": len(activities),
        "completed": len([a for a in activities if a.get("status") == "completed"]),
        "pending": len([a for a in activities if a.get("status") == "pending"]),
        "overdue": len([a for a in activities if a.get("status") == "overdue"]),
        "by_type": {
            "calls": len([a for a in activities if a.get("type") == "call"]),
            "emails": len([a for a in activities if a.get("type") == "email"]),
            "meetings": len([a for a in activities if a.get("type") == "meeting"]),
            "tasks": len([a for a in activities if a.get("type") == "task"])
        }
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
        "org_id": current_user["org_id"],
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
        org_id=current_user["org_id"]
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
        {"id": activity_id, "org_id": current_user["org_id"]},
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
        org_id=current_user["org_id"]
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
        {"id": activity_id, "org_id": current_user["org_id"]},
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
    
    kpis = await app_db.kpis.find({"org_id": current_user["org_id"]}).to_list(100)
    
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
        "org_id": current_user["org_id"],
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
        {"id": kpi_id, "org_id": current_user["org_id"]},
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
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    return {"success": True, "message": "KPI deleted"}


# ==================== RECEIVABLES ====================

@receivables_router.get("")
async def list_receivables(current_user: dict = Depends(get_current_user)):
    """List receivables (mock data)"""
    return [
        {"id": "1", "account": "Acme Corp", "amount": 50000, "due_date": "2024-02-15", "status": "pending"},
        {"id": "2", "account": "TechStart", "amount": 25000, "due_date": "2024-02-28", "status": "overdue"},
        {"id": "3", "account": "Global Services", "amount": 100000, "due_date": "2024-03-15", "status": "pending"}
    ]
