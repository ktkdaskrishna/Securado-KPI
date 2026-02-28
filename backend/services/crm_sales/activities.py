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
from services.crm_sales.helpers import STAGE_ALIASES, apply_date_filters, merge_with_overrides, normalize_stage, STAGE_MAPPING

logger = logging.getLogger(__name__)

activities_router = APIRouter(prefix="/activities", tags=["activities"])


# ==================== ACTIVITIES ====================

@activities_router.get("")
async def list_activities(
    request: Request,
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
    RBAC enforced - users only see activities they have permission to view.
    """
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Activities list request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "activity")
    
    # Check if user has NO_ACCESS
    has_no_access = rbac_filter and "_id" in rbac_filter and rbac_filter.get("_id", {}).get("$eq") == "NO_ACCESS_USER_NOT_IN_RBAC"
    if has_no_access:
        return []
    
    # Value-selling activity types ONLY (exclude internal/admin activities)
    VALUE_SELLING_TYPES = ["Demo", "Proof of concept", "Site Visit", "Work Shop", "RFP Submission", "Product Presentation", "Vendor Meeting", "POC"]
    
    # Build query for canonical CRM activities ONLY with RBAC
    canonical_query = {
        "org_id": org_id,
        "activity_type": {"$in": VALUE_SELLING_TYPES},
        "$or": [
            {"res_model": "crm.lead"},
            {"opportunity_id": {"$exists": True, "$ne": None}}
        ]
    }
    app_query = {"org_id": org_id}
    
    # Apply RBAC filter to activities
    if rbac_filter:
        if "$or" in rbac_filter:
            # Complex filter (e.g., assigned_user OR owner_name)
            canonical_query.update(rbac_filter)
            app_query.update(rbac_filter)
        elif "owner_name" in rbac_filter:
            canonical_query["assigned_user"] = rbac_filter["owner_name"]
            app_query["owner_name"] = rbac_filter["owner_name"]
        elif "assigned_user" in rbac_filter:
            canonical_query["assigned_user"] = rbac_filter["assigned_user"]
            app_query.update(rbac_filter)
        elif "opportunity_id" in rbac_filter:
            # Product Director: filter by their opportunity IDs
            canonical_query["opportunity_id"] = rbac_filter["opportunity_id"]
        else:
            # Generic filter (e.g., account_name for invoices)
            canonical_query.update(rbac_filter)
    
    if opportunity_id:
        canonical_query = {
            "org_id": org_id,
            "opportunity_id": opportunity_id
        }
        if rbac_filter:
            if "$or" in rbac_filter:
                canonical_query.update(rbac_filter)
            elif "owner_name" in rbac_filter:
                canonical_query["assigned_user"] = rbac_filter["owner_name"]
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
    
    # Apply date filters (use date_deadline for activities, not create_date)
    all_activities = apply_date_filters(all_activities, year=year, quarter=quarter, date_field=date_field or 'due_date')
    
    logger.info(f"Activities after filtering: {len(all_activities)}")
    
    # Sort by due_date or created_at
    all_activities.sort(key=lambda x: str(x.get("due_date") or x.get("created_at") or ""), reverse=True)
    
    return serialize_doc(all_activities)


@activities_router.get("/stats")
async def get_activity_stats(
    request: Request,
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    current_user: dict = Depends(get_current_user)
):
    """Get CRM activity statistics. Only counts CRM-related activities, not project tasks. RBAC enforced."""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "activity")
    
    # Check if user has NO_ACCESS
    has_no_access = rbac_filter and "_id" in rbac_filter and rbac_filter.get("_id", {}).get("$eq") == "NO_ACCESS_USER_NOT_IN_RBAC"
    if has_no_access:
        # Return empty stats for non-RBAC users
        return {
            "calls": 0, "emails": 0, "meetings": 0, "tasks": 0,
            "completed": 0, "pending": 0, "total": 0,
            "type_breakdown": {}
        }
    
    # Build query with RBAC
    canonical_query = {
        "org_id": org_id,
        "$or": [
            {"res_model": "crm.lead"},
            {"opportunity_id": {"$exists": True, "$ne": None}}
        ]
    }
    app_query = {"org_id": org_id}
    
    # Apply RBAC filter to activities
    if rbac_filter:
        if "$or" in rbac_filter:
            canonical_query.update(rbac_filter)
            app_query.update(rbac_filter)
        elif "owner_name" in rbac_filter:
            canonical_query["assigned_user"] = rbac_filter["owner_name"]
            app_query["owner_name"] = rbac_filter["owner_name"]
        elif "assigned_user" in rbac_filter:
            canonical_query["assigned_user"] = rbac_filter["assigned_user"]
        elif "opportunity_id" in rbac_filter:
            canonical_query["opportunity_id"] = rbac_filter["opportunity_id"]
        else:
            canonical_query.update(rbac_filter)
    
    # Get CRM activities from canonical DB 
    canonical_activities = await canonical_db.activities.find(canonical_query).to_list(10000)
    
    # Get activities from app DB
    app_activities = await app_db.activities.find(app_query).to_list(1000)
    
    # Apply year/quarter filters
    def filter_by_date(activities, year_filter, quarter_filter):
        if not year_filter and not quarter_filter:
            return activities
        
        quarter_months = {
            "Q1": ["01", "02", "03"], "Q2": ["04", "05", "06"],
            "Q3": ["07", "08", "09"], "Q4": ["10", "11", "12"]
        }
        
        filtered = []
        for act in activities:
            date_str = act.get("date") or act.get("date_deadline") or act.get("created_at") or ""
            if isinstance(date_str, str) and len(date_str) >= 10:
                act_year = date_str[:4]
                act_month = date_str[5:7]
                
                if year_filter and act_year != str(year_filter):
                    continue
                if quarter_filter:
                    months = quarter_months.get(quarter_filter, [])
                    if act_month not in months:
                        continue
                filtered.append(act)
            elif not year_filter and not quarter_filter:
                filtered.append(act)
        return filtered
    
    canonical_activities = filter_by_date(canonical_activities, year, quarter)
    app_activities = filter_by_date(app_activities, year, quarter)
    
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


