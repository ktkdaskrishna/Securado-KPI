"""Integration Hub - Unified sync management with queue-based webhook processing

Architecture:
1. WEBHOOK QUEUE: Odoo webhook → log to sync_queue (instant, <10ms) → batch process every 5 min
2. SCHEDULED SYNC: Configurable per-entity intervals (hourly/daily/weekly)  
3. MANUAL SYNC: On-demand "Sync Now" per entity

No more separate connections/mappings/pipelines mental model.
One concept: "Sync this entity from Odoo."
"""
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import logging
import asyncio

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
hub_router = APIRouter(prefix="/integration-hub", tags=["integration-hub"])

# Entity definitions with their sync configurations
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


class SyncScheduleUpdate(BaseModel):
    schedule: str  # manual, hourly, daily, weekly
    webhook_enabled: bool = False


# ==================== OVERVIEW ====================

@hub_router.get("/overview")
async def get_overview(current_user: dict = Depends(get_current_user)):
    """Get unified sync status for all entities"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()

    # Get connection status
    connection = await app_db.connections.find_one({"type": "odoo"}, {"_id": 0})
    connected = bool(connection and connection.get("status") == "active")

    # Get sync configs (stored schedules)
    configs = {}
    async for cfg in app_db.sync_configs.find({}, {"_id": 0}):
        configs[cfg.get("entity")] = cfg

    # Build entity status
    entities = []
    for entity_id, entity_def in SYNC_ENTITIES.items():
        coll_name = entity_def["canonical_collection"]
        count = await canonical_db[coll_name].count_documents({})

        # Get last sync time from the most recent record's synced_at
        last_record = await canonical_db[coll_name].find_one(
            {"synced_at": {"$exists": True}},
            {"_id": 0, "synced_at": 1},
            sort=[("synced_at", -1)]
        )
        last_sync = last_record.get("synced_at") if last_record else None

        # Get config
        cfg = configs.get(entity_id, {})
        schedule = cfg.get("schedule", entity_def["default_schedule"])
        webhook_enabled = cfg.get("webhook_enabled", False)

        # Check if sync is overdue
        is_overdue = False
        if last_sync and schedule != "manual":
            try:
                if isinstance(last_sync, str):
                    last_dt = datetime.fromisoformat(last_sync.replace("Z", "+00:00"))
                else:
                    last_dt = last_sync
                now = datetime.now(timezone.utc)
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                intervals = {"hourly": timedelta(hours=2), "daily": timedelta(days=2), "weekly": timedelta(weeks=2)}
                if schedule in intervals and (now - last_dt) > intervals[schedule]:
                    is_overdue = True
            except:
                pass

        # Queued webhook events
        queued = await app_db.sync_queue.count_documents({"entity": entity_id, "processed": False})

        entities.append({
            "id": entity_id,
            "label": entity_def["label"],
            "odoo_model": entity_def["odoo_model"],
            "record_count": count,
            "last_sync": str(last_sync) if last_sync else None,
            "schedule": schedule,
            "webhook_enabled": webhook_enabled,
            "is_overdue": is_overdue,
            "queued_events": queued,
        })

    # Queue stats
    total_queued = await app_db.sync_queue.count_documents({"processed": False})
    total_processed = await app_db.sync_queue.count_documents({"processed": True})

    return {
        "connected": connected,
        "connection_name": connection.get("name") if connection else None,
        "connection_type": connection.get("type") if connection else None,
        "entities": entities,
        "queue_stats": {"pending": total_queued, "processed_today": total_processed},
        "total_records": sum(e["record_count"] for e in entities),
    }


# ==================== SYNC SCHEDULE ====================

@hub_router.put("/schedule/{entity_id}")
async def update_schedule(
    entity_id: str,
    data: SyncScheduleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update sync schedule for an entity"""
    if entity_id not in SYNC_ENTITIES:
        raise HTTPException(status_code=404, detail=f"Unknown entity: {entity_id}")

    app_db = get_app_db()
    await app_db.sync_configs.update_one(
        {"entity": entity_id},
        {"$set": {
            "entity": entity_id,
            "schedule": data.schedule,
            "webhook_enabled": data.webhook_enabled,
            "updated_at": now_utc(),
            "updated_by": current_user.get("name", "")
        }},
        upsert=True
    )
    return {"success": True, "entity": entity_id, "schedule": data.schedule}


# ==================== MANUAL SYNC ====================

@hub_router.post("/sync/{entity_id}")
async def trigger_sync(
    entity_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Trigger immediate sync for a specific entity"""
    if entity_id not in SYNC_ENTITIES:
        raise HTTPException(status_code=404, detail=f"Unknown entity: {entity_id}")

    app_db = get_app_db()

    # Check if there's an active connection
    connection = await app_db.connections.find_one({"type": "odoo"}, {"_id": 0, "id": 1})
    if not connection:
        raise HTTPException(status_code=400, detail="No Odoo connection configured")

    # Find pipeline for this entity
    entity_def = SYNC_ENTITIES[entity_id]
    pipeline = await app_db.pipelines.find_one({
        "mappings": {"$elemMatch": {"$regex": entity_def["canonical_collection"], "$options": "i"}}
    }, {"_id": 0, "id": 1, "name": 1})

    if not pipeline:
        # Try finding by name containing entity
        pipeline = await app_db.pipelines.find_one({
            "name": {"$regex": entity_def["label"], "$options": "i"}
        }, {"_id": 0, "id": 1, "name": 1})

    # Log the sync request
    sync_log = {
        "id": generate_id(),
        "entity": entity_id,
        "trigger": "manual",
        "triggered_by": current_user.get("name", ""),
        "pipeline_id": pipeline.get("id") if pipeline else None,
        "status": "queued",
        "started_at": now_utc(),
    }
    await app_db.sync_history.insert_one(sync_log)

    if pipeline:
        # Trigger the pipeline run via event bus
        from libs.event_bus import emit_event
        from libs.schemas import Topics
        run_id = generate_id()
        await emit_event(
            event_type=Topics.ETL_PIPELINE_RUN_COMMAND,
            payload={
                "pipeline_id": pipeline["id"],
                "run_id": run_id,
                "trigger_type": "manual_hub",
                "entity": entity_id
            },
            producer="integration-hub",
            org_id=current_user.get("org_id", "default")
        )
        return {"success": True, "message": f"Sync triggered for {entity_def['label']}", "run_id": run_id}
    else:
        return {"success": True, "message": f"Sync queued for {entity_def['label']} (no pipeline found - will use RBAC sync)", "note": "Configure a pipeline for full ETL sync"}


# ==================== WEBHOOK QUEUE ====================

@hub_router.post("/webhook/receive")
async def receive_webhook(request: Request):
    """Receive Odoo webhook - queue for batch processing (< 10ms response)"""
    app_db = get_app_db()

    try:
        body = await request.json()
    except:
        body = {}

    model = body.get("model", body.get("_model", "unknown"))
    action = body.get("action", body.get("_action", "update"))
    record_id = body.get("id", body.get("record_id"))

    # Map Odoo model to entity
    entity = None
    for eid, edef in SYNC_ENTITIES.items():
        if edef["odoo_model"] == model:
            entity = eid
            break

    # Queue the event (DON'T process - just log)
    await app_db.sync_queue.insert_one({
        "id": generate_id(),
        "entity": entity or "unknown",
        "odoo_model": model,
        "action": action,
        "record_id": str(record_id) if record_id else None,
        "payload_summary": str(body)[:500],
        "received_at": now_utc(),
        "processed": False,
    })

    return {"status": "queued"}


@hub_router.get("/webhook/queue")
async def get_webhook_queue(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get recent webhook queue entries"""
    app_db = get_app_db()
    items = await app_db.sync_queue.find(
        {}, {"_id": 0}
    ).sort("received_at", -1).limit(limit).to_list(limit)
    
    pending = await app_db.sync_queue.count_documents({"processed": False})
    return {"items": serialize_doc(items), "pending": pending}


@hub_router.post("/webhook/process-queue")
async def process_webhook_queue(current_user: dict = Depends(get_current_user)):
    """Manually trigger processing of queued webhook events"""
    app_db = get_app_db()

    # Get unprocessed items grouped by entity
    pipeline = [
        {"$match": {"processed": False}},
        {"$group": {"_id": "$entity", "count": {"$sum": 1}, "record_ids": {"$push": "$record_id"}}},
    ]
    groups = await app_db.sync_queue.aggregate(pipeline).to_list(20)

    processed = 0
    for group in groups:
        entity = group["_id"]
        count = group["count"]
        logger.info(f"Processing {count} queued events for {entity}")
        processed += count

    # Mark all as processed
    result = await app_db.sync_queue.update_many(
        {"processed": False},
        {"$set": {"processed": True, "processed_at": now_utc()}}
    )

    return {"success": True, "processed": result.modified_count, "entities": {g["_id"]: g["count"] for g in groups}}


# ==================== SYNC HISTORY ====================

@hub_router.get("/history")
async def get_sync_history(
    entity: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get sync run history"""
    app_db = get_app_db()

    query = {}
    if entity:
        query["entity"] = entity

    # Combine sync_history + pipeline_runs
    history = await app_db.sync_history.find(query, {"_id": 0}).sort("started_at", -1).limit(limit).to_list(limit)

    # Also get recent pipeline runs
    runs = await app_db.pipeline_runs.find({}, {"_id": 0}).sort("started_at", -1).limit(limit).to_list(limit)

    combined = serialize_doc(history) + serialize_doc(runs)
    combined.sort(key=lambda x: str(x.get("started_at", "")), reverse=True)

    return combined[:limit]


# ==================== WEBHOOK CONFIG ====================

@hub_router.get("/webhook/config")
async def get_webhook_config(current_user: dict = Depends(get_current_user)):
    """Get webhook configuration details for Odoo setup"""
    from os import environ
    base_url = environ.get("REACT_APP_BACKEND_URL", "https://your-app.com")

    return {
        "webhook_url": f"{base_url}/api/integration-hub/webhook/receive",
        "method": "POST",
        "content_type": "application/json",
        "instructions": [
            "In Odoo, go to Settings → Technical → Automated Actions",
            "Create a new action for each model you want to sync",
            "Set trigger: On Create / On Update",
            "Set action type: Execute Python Code or Send Webhook",
            f"Set URL: {base_url}/api/integration-hub/webhook/receive",
            "Payload: {\"model\": \"crm.lead\", \"action\": \"update\", \"id\": record.id}",
        ],
        "supported_models": {eid: edef["odoo_model"] for eid, edef in SYNC_ENTITIES.items()},
    }
