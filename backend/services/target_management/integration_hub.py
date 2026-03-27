"""Integration Hub - Sync overview, schedule config, and manual trigger.

This file provides:
1. Entity sync overview (record counts, last sync, schedules)
2. Schedule configuration per entity
3. Manual sync trigger via API (XML-RPC to Odoo)
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
hub_router = APIRouter(prefix="/integration-hub", tags=["integration-hub"])

from pydantic import BaseModel

class SyncScheduleUpdate(BaseModel):
    schedule: str  # manual, hourly, daily, weekly

SYNC_ENTITIES = {
    "opportunities": {"label": "Opportunities", "canonical_collection": "opportunities", "odoo_model": "crm.lead", "default_schedule": "daily"},
    "accounts": {"label": "Accounts", "canonical_collection": "accounts", "odoo_model": "res.partner", "default_schedule": "daily"},
    "contacts": {"label": "Contacts", "canonical_collection": "contacts", "odoo_model": "res.partner", "default_schedule": "daily"},
    "activities": {"label": "Activities", "canonical_collection": "activities", "odoo_model": "mail.activity", "default_schedule": "daily"},
    "invoices": {"label": "Invoices", "canonical_collection": "invoices", "odoo_model": "account.move", "default_schedule": "daily"},
    "employees": {"label": "Employees", "canonical_collection": "employees", "odoo_model": "hr.employee", "default_schedule": "daily"},
    "sales_users": {"label": "Sales Users", "canonical_collection": "sales_users", "odoo_model": "res.users", "default_schedule": "manual"},
    "sales_teams": {"label": "Sales Teams", "canonical_collection": "sales_teams", "odoo_model": "crm.team", "default_schedule": "manual"},
    "tasks": {"label": "Tasks", "canonical_collection": "tasks", "odoo_model": "project.task", "default_schedule": "manual"},
    "rbac": {"label": "RBAC / Permissions", "canonical_collection": "users_rbac", "odoo_model": "res.groups", "default_schedule": "manual", "use_app_db": True},
}


@hub_router.get("/overview")
async def get_overview(current_user: dict = Depends(get_current_user)):
    """Sync status for all entities"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()

    connection = await app_db.connections.find_one({"type": "odoo"}, {"_id": 0})
    connected = bool(connection and connection.get("status") == "active")

    configs = {}
    async for cfg in app_db.sync_configs.find({}, {"_id": 0}):
        configs[cfg.get("entity")] = cfg

    entities = []
    for entity_id, entity_def in SYNC_ENTITIES.items():
        db = app_db if entity_def.get("use_app_db") else canonical_db
        coll_name = entity_def["canonical_collection"]
        count = await db[coll_name].count_documents({"deleted": {"$ne": True}})
        
        # Get last sync time - synced_at first (when WE pulled), then Odoo timestamps
        last_sync = None
        for date_field in ["synced_at", "updated_at", "write_date", "create_date"]:
            last_record = await db[coll_name].find_one(
                {date_field: {"$exists": True, "$ne": None}},
                {"_id": 0, date_field: 1},
                sort=[(date_field, -1)]
            )
            if last_record and last_record.get(date_field):
                last_sync = last_record[date_field]
                break
        cfg = configs.get(entity_id, {})
        schedule = cfg.get("schedule", entity_def["default_schedule"])

        is_overdue = False
        if last_sync and schedule != "manual":
            try:
                last_dt = datetime.fromisoformat(str(last_sync).replace("Z", "+00:00")) if isinstance(last_sync, str) else last_sync
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                intervals = {"hourly": timedelta(hours=2), "daily": timedelta(days=2), "weekly": timedelta(weeks=2)}
                if schedule in intervals and (datetime.now(timezone.utc) - last_dt) > intervals[schedule]:
                    is_overdue = True
            except:
                pass

        entities.append({
            "id": entity_id, "label": entity_def["label"], "odoo_model": entity_def["odoo_model"],
            "record_count": count, "last_sync": str(last_sync) if last_sync else None,
            "schedule": schedule, "is_overdue": is_overdue,
        })

    return {
        "connected": connected,
        "connection_name": connection.get("name") if connection else None,
        "entities": entities,
        "total_records": sum(e["record_count"] for e in entities),
    }


@hub_router.put("/schedule/{entity_id}")
async def update_schedule(entity_id: str, data: SyncScheduleUpdate, current_user: dict = Depends(get_current_user)):
    """Update sync schedule for an entity"""
    if entity_id not in SYNC_ENTITIES:
        raise HTTPException(status_code=404, detail=f"Unknown entity: {entity_id}")
    app_db = get_app_db()
    await app_db.sync_configs.update_one(
        {"entity": entity_id},
        {"$set": {"entity": entity_id, "schedule": data.schedule, "updated_at": now_utc()}},
        upsert=True
    )
    return {"success": True}


@hub_router.post("/sync/{entity_id}")
async def trigger_sync(entity_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Trigger immediate sync for a specific entity"""
    if entity_id not in SYNC_ENTITIES:
        raise HTTPException(status_code=404, detail=f"Unknown entity: {entity_id}")
    app_db = get_app_db()
    entity_def = SYNC_ENTITIES[entity_id]

    # Find pipeline for this entity
    pipeline = await app_db.pipelines.find_one(
        {"$or": [
            {"mappings": {"$elemMatch": {"$regex": entity_def["canonical_collection"], "$options": "i"}}},
            {"name": {"$regex": entity_def["label"], "$options": "i"}}
        ]}, {"_id": 0, "id": 1, "mapping_id": 1, "connection_id": 1}
    )

    sync_log = {
        "id": generate_id(), "entity": entity_id, "trigger": "manual",
        "triggered_by": current_user.get("name", ""), "status": "queued", "started_at": now_utc(),
    }
    await app_db.sync_history.insert_one(sync_log)

    if pipeline:
        from libs.event_bus import emit_event
        from libs.schemas import Topics
        await emit_event(
            event_type=Topics.ETL_PIPELINE_RUN_COMMAND,
            payload={
                "pipeline_id": pipeline["id"],
                "mapping_id": pipeline.get("mapping_id"),
                "connection_id": pipeline.get("connection_id"),
                "run_id": generate_id(),
                "trigger_type": "manual_hub"
            },
            producer="integration-hub", org_id=current_user.get("org_id", "default")
        )
        
        # Update synced_at timestamp on all records in this entity to mark sync attempt
        canonical_db = get_canonical_db()
        coll = entity_def["canonical_collection"]
        await canonical_db[coll].update_many({}, {"$set": {"synced_at": now_utc()}})
        
        return {"success": True, "message": f"Sync triggered for {entity_def['label']}"}
    return {"success": True, "message": f"Sync queued for {entity_def['label']}"}


@hub_router.get("/history")
async def get_sync_history(entity: Optional[str] = None, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get sync run history"""
    app_db = get_app_db()
    query = {"entity": entity} if entity else {}
    history = await app_db.sync_history.find(query, {"_id": 0}).sort("started_at", -1).limit(limit).to_list(limit)
    runs = await app_db.pipeline_runs.find({}, {"_id": 0}).sort("started_at", -1).limit(limit).to_list(limit)
    combined = serialize_doc(history) + serialize_doc(runs)
    combined.sort(key=lambda x: str(x.get("started_at", "")), reverse=True)
    return combined[:limit]



@hub_router.post("/rebuild-identity-map")
async def rebuild_identity_map(current_user: dict = Depends(get_current_user)):
    """Rebuild user identity map from employees + sales_users + app users"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    
    identity_map = {}
    
    # From employees
    async for emp in canonical_db.employees.find({"active": True}, {"_id": 0, "name": 1, "email": 1, "source_record_id": 1}):
        email = (emp.get("email") or "").lower().strip()
        if not email: continue
        if email not in identity_map:
            identity_map[email] = {"email": email, "all_names": set(), "active": True}
        identity_map[email]["canonical_name"] = emp["name"]
        identity_map[email]["employee_id"] = emp.get("source_record_id")
        identity_map[email]["all_names"].add(emp["name"])
    
    # From sales_users
    async for su in canonical_db.sales_users.find({}, {"_id": 0, "name": 1, "email": 1}):
        email = (su.get("email") or "").lower().strip()
        if not email: continue
        if email not in identity_map:
            identity_map[email] = {"email": email, "all_names": set(), "active": True}
        identity_map[email]["display_name"] = su["name"]
        identity_map[email]["all_names"].add(su["name"])
    
    # From app users
    async for u in app_db.users.find({}, {"_id": 0, "name": 1, "email": 1}):
        email = (u.get("email") or "").lower().strip()
        if not email: continue
        if email not in identity_map:
            identity_map[email] = {"email": email, "all_names": set(), "active": True}
        identity_map[email]["app_name"] = u["name"]
        identity_map[email]["all_names"].add(u["name"])
    
    # Finalize
    for data in identity_map.values():
        if "display_name" not in data:
            data["display_name"] = data.get("canonical_name") or data.get("app_name") or data["email"]
        if "canonical_name" not in data:
            data["canonical_name"] = data.get("display_name")
        data["all_names"] = list(data["all_names"])
    
    # Write
    await app_db.user_identity_map.drop()
    docs = list(identity_map.values())
    if docs:
        await app_db.user_identity_map.insert_many(docs)
        await app_db.user_identity_map.create_index("email", unique=True)
    
    return {"success": True, "users_mapped": len(docs)}


# ==================== INCREMENTAL SYNC CONTROL ====================

@hub_router.get("/incremental-status")
async def get_incremental_status(current_user: dict = Depends(get_current_user)):
    """Get incremental sync worker status"""
    from services.etl_runner.incremental_sync import incremental_worker
    app_db = get_app_db()
    
    status = incremental_worker.get_status()
    
    # Get sync state per entity
    states = {}
    async for s in app_db.sync_state.find({}, {"_id": 0}):
        states[s.get("entity")] = s
    
    status["sync_states"] = states
    return status


@hub_router.post("/incremental/start")
async def start_incremental(current_user: dict = Depends(get_current_user)):
    """Start incremental sync polling"""
    from services.etl_runner.incremental_sync import incremental_worker
    await incremental_worker.start()
    return {"success": True, "message": f"Incremental sync started (interval: {incremental_worker.poll_interval}s)"}


@hub_router.post("/incremental/stop")
async def stop_incremental(current_user: dict = Depends(get_current_user)):
    """Stop incremental sync polling"""
    from services.etl_runner.incremental_sync import incremental_worker
    await incremental_worker.stop()
    return {"success": True, "message": "Incremental sync stopped"}


@hub_router.put("/incremental/interval")
async def set_incremental_interval(
    interval_seconds: int = 300,
    current_user: dict = Depends(get_current_user)
):
    """Set the polling interval (in seconds). Min 60, max 3600."""
    if interval_seconds < 60:
        interval_seconds = 60
    if interval_seconds > 3600:
        interval_seconds = 3600
    
    app_db = get_app_db()
    await app_db.sync_configs.update_one(
        {"entity": "_incremental_settings"},
        {"$set": {"entity": "_incremental_settings", "interval_seconds": interval_seconds, "updated_at": now_utc()}},
        upsert=True
    )
    
    from services.etl_runner.incremental_sync import incremental_worker
    incremental_worker.poll_interval = interval_seconds
    
    return {"success": True, "interval_seconds": interval_seconds, "message": f"Sync interval set to {interval_seconds}s ({interval_seconds // 60} min)"}

