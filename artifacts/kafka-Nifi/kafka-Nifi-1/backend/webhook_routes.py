"""Webhook and Event Routes"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Header, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime, timezone
import jwt
import hashlib
import hmac
import logging

router = APIRouter(prefix="/api", tags=["webhooks"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'esip_db')]

logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get('JWT_SECRET', 'esip-pipeline-secret-key')
JWT_ALGORITHM = 'HS256'

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_doc(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if k == '_id':
                result['id'] = str(v)
            elif isinstance(v, datetime):
                result[k] = v.isoformat()
            elif isinstance(v, dict):
                result[k] = serialize_doc(v)
            elif isinstance(v, list):
                result[k] = serialize_doc(v)
            else:
                result[k] = v
        return result
    return doc

# ==================== WEBHOOK MODELS ====================

class WebhookEvent(BaseModel):
    model: str  # e.g., "crm.lead"
    record_id: int
    event_type: str  # CREATE, UPDATE, DELETE
    fields: Optional[Dict[str, Any]] = None
    changed_fields: Optional[List[str]] = None
    timestamp: Optional[str] = None

class WebhookConfig(BaseModel):
    name: str
    connection_id: str
    models: List[str]  # Models to listen for
    events: List[str] = ["CREATE", "UPDATE", "DELETE"]
    enabled: bool = True
    secret: Optional[str] = None

# ==================== WEBHOOK RECEIVER ====================

@router.post("/webhooks/receive/{connection_id}")
async def receive_webhook(
    connection_id: str,
    event: WebhookEvent,
    background_tasks: BackgroundTasks,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None)
):
    """
    Receive webhook events from Odoo or other sources.
    This endpoint should be called when records are created, updated, or deleted.
    """
    # Verify connection exists
    connection = await db.connections.find_one({"id": connection_id})
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Optional: Verify webhook secret
    webhook_config = await db.webhook_configs.find_one({"connection_id": connection_id})
    if webhook_config and webhook_config.get("secret"):
        if x_webhook_secret != webhook_config["secret"]:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")
    
    # Create event record
    event_doc = {
        "id": str(uuid.uuid4()),
        "connection_id": connection_id,
        "model": event.model,
        "record_id": str(event.record_id),
        "event_type": event.event_type.upper(),
        "fields": event.fields,
        "changed_fields": event.changed_fields,
        "source_timestamp": event.timestamp,
        "received_at": datetime.now(timezone.utc),
        "status": "pending",
        "processed": False
    }
    
    await db.webhook_events.insert_one(event_doc)
    
    # Trigger processing in background
    background_tasks.add_task(process_webhook_event, event_doc["id"])
    
    logger.info(f"Webhook received: {event.event_type} on {event.model}#{event.record_id}")
    
    return {
        "status": "received",
        "event_id": event_doc["id"],
        "message": f"Event {event.event_type} for {event.model} received"
    }

async def process_webhook_event(event_id: str):
    """Process a webhook event - trigger relevant pipelines"""
    try:
        event = await db.webhook_events.find_one({"id": event_id})
        if not event:
            return
        
        # Find pipelines that should be triggered by this event
        pipelines = await db.pipelines.find({
            "connection_id": event["connection_id"],
            "webhook_enabled": True,
            "status": {"$ne": "running"}
        }).to_list(100)
        
        for pipeline in pipelines:
            # Check if pipeline handles this model
            mapping = await db.mappings.find_one({"id": pipeline.get("mapping_id")})
            if mapping and mapping.get("source_model") == event["model"]:
                # Create a pending run for this pipeline
                run_doc = {
                    "id": str(uuid.uuid4()),
                    "pipeline_id": pipeline["id"],
                    "trigger_type": "webhook",
                    "webhook_event_id": event_id,
                    "status": "pending",
                    "started_at": datetime.now(timezone.utc),
                    "event_records": [event["record_id"]],
                    "event_type": event["event_type"]
                }
                await db.pipeline_runs.insert_one(run_doc)
                
                logger.info(f"Triggered pipeline {pipeline['id']} from webhook event")
        
        # Mark event as processed
        await db.webhook_events.update_one(
            {"id": event_id},
            {"$set": {"status": "processed", "processed": True, "processed_at": datetime.now(timezone.utc)}}
        )
        
    except Exception as e:
        logger.error(f"Error processing webhook event {event_id}: {e}")
        await db.webhook_events.update_one(
            {"id": event_id},
            {"$set": {"status": "error", "error": str(e)}}
        )

# ==================== WEBHOOK CONFIG ====================

@router.post("/webhook-configs")
async def create_webhook_config(config: WebhookConfig, user: dict = Depends(get_current_user)):
    """Create a webhook configuration for a connection"""
    # Generate secret if not provided
    secret = config.secret or str(uuid.uuid4()).replace('-', '')[:32]
    
    config_doc = {
        "id": str(uuid.uuid4()),
        "name": config.name,
        "connection_id": config.connection_id,
        "models": config.models,
        "events": config.events,
        "enabled": config.enabled,
        "secret": secret,
        "webhook_url": f"/api/webhooks/receive/{config.connection_id}",
        "created_by": user["sub"],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.webhook_configs.insert_one(config_doc)
    return serialize_doc(config_doc)

@router.get("/webhook-configs")
async def list_webhook_configs(connection_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    """List webhook configurations"""
    query = {}
    if connection_id:
        query["connection_id"] = connection_id
    configs = await db.webhook_configs.find(query).to_list(100)
    return serialize_doc(configs)

@router.get("/webhook-configs/{config_id}")
async def get_webhook_config(config_id: str, user: dict = Depends(get_current_user)):
    config = await db.webhook_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return serialize_doc(config)

@router.delete("/webhook-configs/{config_id}")
async def delete_webhook_config(config_id: str, user: dict = Depends(get_current_user)):
    result = await db.webhook_configs.delete_one({"id": config_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"status": "deleted"}

# ==================== WEBHOOK EVENTS ====================

@router.get("/webhook-events")
async def list_webhook_events(
    connection_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(get_current_user)
):
    """List webhook events"""
    query = {}
    if connection_id:
        query["connection_id"] = connection_id
    if status:
        query["status"] = status
    
    events = await db.webhook_events.find(query).sort("received_at", -1).limit(limit).to_list(limit)
    return serialize_doc(events)

@router.get("/webhook-events/stats")
async def get_webhook_stats(user: dict = Depends(get_current_user)):
    """Get webhook event statistics"""
    pipeline = [
        {
            "$group": {
                "_id": {
                    "event_type": "$event_type",
                    "status": "$status"
                },
                "count": {"$sum": 1}
            }
        }
    ]
    
    results = await db.webhook_events.aggregate(pipeline).to_list(100)
    
    stats = {
        "by_event_type": {},
        "by_status": {},
        "total": 0
    }
    
    for r in results:
        event_type = r["_id"]["event_type"]
        status = r["_id"]["status"]
        count = r["count"]
        
        stats["total"] += count
        stats["by_event_type"][event_type] = stats["by_event_type"].get(event_type, 0) + count
        stats["by_status"][status] = stats["by_status"].get(status, 0) + count
    
    return stats

@router.post("/webhook-events/{event_id}/retry")
async def retry_webhook_event(event_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Retry processing a failed webhook event"""
    event = await db.webhook_events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await db.webhook_events.update_one(
        {"id": event_id},
        {"$set": {"status": "pending", "processed": False, "retry_at": datetime.now(timezone.utc)}}
    )
    
    background_tasks.add_task(process_webhook_event, event_id)
    
    return {"status": "retrying", "event_id": event_id}
