"""Event Queue Worker - Background processor for queue events

Processes events from the MongoDB queue:
- ETL record upserts
- Dashboard refresh triggers
- Future: Email notifications, webhooks, etc.

Runs as a background task during application lifecycle.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Callable, List

from motor.motor_asyncio import AsyncIOMotorDatabase

from .queue_service import event_queue_service

logger = logging.getLogger(__name__)


class EventWorker:
    """Background worker that processes events from the queue"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._handlers: Dict[str, Callable] = {}
        self._poll_interval = 2  # seconds
        self._batch_size = 10
        self.app_db: Optional[AsyncIOMotorDatabase] = None
        self.canonical_db: Optional[AsyncIOMotorDatabase] = None
        logger.info("EventWorker initialized")
    
    def register_handler(self, event_type: str, handler: Callable):
        """Register a handler for a specific event type"""
        self._handlers[event_type] = handler
        logger.info(f"Registered handler for event type: {event_type}")
    
    async def initialize(
        self, 
        app_db: AsyncIOMotorDatabase, 
        canonical_db: AsyncIOMotorDatabase
    ):
        """Initialize worker with database connections"""
        self.app_db = app_db
        self.canonical_db = canonical_db
        
        # Register default handlers
        self._register_default_handlers()
        
        logger.info("EventWorker databases configured")
    
    def _register_default_handlers(self):
        """Register built-in event handlers"""
        # ETL record upsert handler
        self.register_handler("etl.record.upsert", self._handle_record_upsert)
        self.register_handler("etl.record.batch_upsert", self._handle_batch_upsert)
    
    async def start(self):
        """Start the background worker"""
        if self._running:
            logger.warning("EventWorker already running")
            return
        
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("EventWorker started")
    
    async def stop(self):
        """Stop the background worker gracefully"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("EventWorker stopped")
    
    async def _run_loop(self):
        """Main processing loop"""
        while self._running:
            try:
                # Fetch pending events
                events = await event_queue_service.fetch_pending(
                    batch_size=self._batch_size,
                    event_types=list(self._handlers.keys())
                )
                
                if events:
                    logger.debug(f"Processing {len(events)} events")
                    
                    for event in events:
                        await self._process_event(event)
                else:
                    # No events, wait before polling again
                    await asyncio.sleep(self._poll_interval)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                await asyncio.sleep(self._poll_interval)
    
    async def _process_event(self, event: Dict):
        """Process a single event"""
        event_id = event.get("event_id")
        event_type = event.get("event_type")
        
        try:
            handler = self._handlers.get(event_type)
            
            if not handler:
                logger.warning(f"No handler for event type: {event_type}")
                await event_queue_service.mark_failed(
                    event_id, f"No handler registered for {event_type}"
                )
                return
            
            # Execute handler
            await handler(event)
            
            # Mark as completed
            await event_queue_service.mark_completed(event_id)
            logger.debug(f"Event {event_id} completed")
            
        except Exception as e:
            logger.error(f"Event {event_id} failed: {e}")
            await event_queue_service.mark_failed(event_id, str(e))
    
    # ==================== DEFAULT HANDLERS ====================
    
    async def _handle_record_upsert(self, event: Dict):
        """Handle ETL record upsert event
        
        Payload:
            - target_entity: str (e.g., 'opportunity', 'account')
            - record: dict (the transformed record data)
            - org_id: str
        """
        payload = event.get("payload", {})
        target_entity = payload.get("target_entity")
        record = payload.get("record")
        org_id = event.get("org_id")
        
        if not target_entity or not record:
            raise ValueError("Missing target_entity or record in payload")
        
        # Map entity to collection
        entity_to_collection = {
            "opportunity": "opportunities",
            "account": "accounts",
            "contact": "contacts",
            "user": "users",
            "activity": "activities"
        }
        collection_name = entity_to_collection.get(target_entity, f"{target_entity}s")
        collection = self.canonical_db[collection_name]
        
        # Ensure org_id is set
        record["org_id"] = org_id
        
        # Build filter for upsert
        source_record_id = record.get("source_record_id")
        if source_record_id:
            filter_query = {
                "source_record_id": source_record_id,
                "org_id": org_id
            }
        else:
            filter_query = {
                "canonical_id": record.get("canonical_id"),
                "org_id": org_id
            }
        
        # Perform upsert
        result = await collection.update_one(
            filter_query,
            {"$set": record},
            upsert=True
        )
        
        action = "inserted" if result.upserted_id else ("updated" if result.modified_count > 0 else "unchanged")
        logger.debug(f"Record {action} in {collection_name}: {record.get('canonical_id')}")
    
    async def _handle_batch_upsert(self, event: Dict):
        """Handle batch upsert event (multiple records)
        
        Payload:
            - target_entity: str
            - records: List[dict]
            - org_id: str
        """
        payload = event.get("payload", {})
        target_entity = payload.get("target_entity")
        records = payload.get("records", [])
        org_id = event.get("org_id")
        
        if not target_entity or not records:
            raise ValueError("Missing target_entity or records in payload")
        
        # Map entity to collection
        entity_to_collection = {
            "opportunity": "opportunities",
            "account": "accounts",
            "contact": "contacts",
            "user": "users",
            "activity": "activities"
        }
        collection_name = entity_to_collection.get(target_entity, f"{target_entity}s")
        collection = self.canonical_db[collection_name]
        
        inserted = 0
        updated = 0
        
        for record in records:
            record["org_id"] = org_id
            
            source_record_id = record.get("source_record_id")
            if source_record_id:
                filter_query = {
                    "source_record_id": source_record_id,
                    "org_id": org_id
                }
            else:
                filter_query = {
                    "canonical_id": record.get("canonical_id"),
                    "org_id": org_id
                }
            
            result = await collection.update_one(
                filter_query,
                {"$set": record},
                upsert=True
            )
            
            if result.upserted_id:
                inserted += 1
            elif result.modified_count > 0:
                updated += 1
        
        logger.info(f"Batch upsert to {collection_name}: {inserted} inserted, {updated} updated")


# Global singleton instance
event_worker = EventWorker()
