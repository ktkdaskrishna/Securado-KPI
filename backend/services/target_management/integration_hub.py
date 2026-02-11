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
    webhook_enabled: bool = False

SYNC_ENTITIES = {
    "opportunities": {"label": "Opportunities", "canonical_collection": "opportunities", "odoo_model": "crm.lead", "default_schedule": "daily"},
    "accounts": {"label": "Accounts", "canonical_collection": "accounts", "odoo_model": "res.partner", "default_schedule": "daily"},
    "contacts": {"label": "Contacts", "canonical_collection": "contacts", "odoo_model": "res.partner", "default_schedule": "daily"},
    "activities": {"label": "Activities", "canonical_collection": "activities", "odoo_model": "mail.activity", "default_schedule": "hourly"},
    "invoices": {"label": "Invoices", "canonical_collection": "invoices", "odoo_model": "account.move", "default_schedule": "daily"},
    "employees": {"label": "Employees", "canonical_collection": "employees", "odoo_model": "hr.employee", "default_schedule": "weekly"},
    "sales_users": {"label": "Sales Users", "canonical_collection": "sales_users", "odoo_model": "res.users", "default_schedule": "weekly"},
    "sales_teams": {"label": "Sales Teams", "canonical_collection": "sales_teams", "odoo_model": "crm.team", "default_schedule": "weekly"},
    "tasks": {"label": "Tasks", "canonical_collection": "tasks", "odoo_model": "project.task", "default_schedule": "daily"},
    "rbac": {"label": "RBAC / Permissions", "canonical_collection": "odoo_groups", "odoo_model": "res.groups", "default_schedule": "daily"},
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
        count = await canonical_db[entity_def["canonical_collection"]].count_documents({})
        last_record = await canonical_db[entity_def["canonical_collection"]].find_one(
            {"synced_at": {"$exists": True}}, {"_id": 0, "synced_at": 1}, sort=[("synced_at", -1)]
        )
        last_sync = last_record.get("synced_at") if last_record else None
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
        ]}, {"_id": 0, "id": 1}
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
            payload={"pipeline_id": pipeline["id"], "run_id": generate_id(), "trigger_type": "manual_hub"},
            producer="integration-hub", org_id=current_user.get("org_id", "default")
        )
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
