"""Event Gateway Service Routes - SSE Streaming

Handles:
- SSE stream for pipeline run lifecycle events
- SSE stream for DLQ updates
- SSE stream for dashboard refresh notifications
- Event history retrieval
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from libs.database import get_app_db
from libs.utils import serialize_doc
from libs.event_bus import event_bus
from services.identity.routes import get_current_user, get_optional_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/events", tags=["events"])
dlq_router = APIRouter(prefix="/dlq", tags=["dlq"])


@router.get("/stream")
async def event_stream(current_user: dict = Depends(get_optional_user)):
    """SSE endpoint for real-time event streaming"""
    
    async def generate():
        queue_id, queue = event_bus.create_sse_queue()
        
        try:
            # Send initial connection message
            yield f"data: {json.dumps({'type': 'connected', 'queue_id': queue_id})}\n\n"
            
            while True:
                try:
                    # Wait for event with timeout (for keepalive)
                    event_data = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(event_data)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f"data: {json.dumps({'type': 'keepalive', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        except asyncio.CancelledError:
            logger.info(f"SSE client disconnected: {queue_id}")
        finally:
            event_bus.remove_sse_queue(queue_id)
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/history")
async def get_event_history(
    event_type: Optional[str] = None,
    correlation_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    current_user: dict = Depends(get_current_user)
):
    """Get event history"""
    events = await event_bus.get_events(
        event_type=event_type,
        org_id=current_user.get("org_id", "default"),
        correlation_id=correlation_id,
        limit=limit
    )
    return events


@router.get("/runs/{run_id}")
async def get_run_events(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get events for a specific run"""
    events = await event_bus.get_events(
        event_type="etl.pipeline_run.event.v1",
        org_id=current_user.get("org_id", "default"),
        limit=100
    )
    
    # Filter by run_id in payload
    run_events = [e for e in events if e.get("payload", {}).get("run_id") == run_id]
    return run_events


# ==================== DLQ ROUTES ====================

@dlq_router.get("")
async def list_dlq(
    status: str = Query("failed", enum=["failed", "retried", "dismissed"]),
    pipeline_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """List DLQ items"""
    app_db = get_app_db()
    
    query = {"org_id": current_user.get("org_id", "default"), "status": status}
    if pipeline_id:
        query["pipeline_id"] = pipeline_id
    
    items = await app_db.dlq.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return serialize_doc(items)


@dlq_router.get("/stats")
async def get_dlq_stats(current_user: dict = Depends(get_current_user)):
    """Get DLQ statistics"""
    app_db = get_app_db()
    
    failed = await app_db.dlq.count_documents({"org_id": current_user.get("org_id", "default"), "status": "failed"})
    retried = await app_db.dlq.count_documents({"org_id": current_user.get("org_id", "default"), "status": "retried"})
    dismissed = await app_db.dlq.count_documents({"org_id": current_user.get("org_id", "default"), "status": "dismissed"})
    
    return {
        "failed": failed,
        "retried": retried,
        "dismissed": dismissed,
        "total": failed + retried + dismissed
    }


@dlq_router.post("/{item_id}/retry")
async def retry_dlq_item(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark DLQ item for retry"""
    app_db = get_app_db()
    
    result = await app_db.dlq.update_one(
        {"id": item_id, "org_id": current_user.get("org_id", "default")},
        {"$set": {"status": "retried", "retried_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="DLQ item not found")
    
    return {"success": True, "message": "Item marked for retry"}


@dlq_router.post("/{item_id}/dismiss")
async def dismiss_dlq_item(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Dismiss DLQ item"""
    app_db = get_app_db()
    
    result = await app_db.dlq.update_one(
        {"id": item_id, "org_id": current_user.get("org_id", "default")},
        {"$set": {"status": "dismissed", "dismissed_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="DLQ item not found")
    
    return {"success": True, "message": "Item dismissed"}
