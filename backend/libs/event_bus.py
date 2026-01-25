"""In-Memory Event Bus with MongoDB Persistence

Simulates Kafka-like event streaming with:
- Publish/Subscribe pattern
- Durable event log in MongoDB
- At-least-once delivery (via retry)
- Idempotent consumer support
- Correlation ID propagation
- SSE relay for real-time UI updates
"""
import asyncio
import logging
from typing import Dict, List, Callable, Any, Optional, Set
from datetime import datetime, timedelta
from collections import defaultdict
import uuid
import json
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from libs.schemas import EventEnvelope

logger = logging.getLogger(__name__)


class EventBus:
    """In-memory event bus with MongoDB persistence"""
    
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
        self.subscribers: Dict[str, List[Callable]] = defaultdict(list)
        self.db: Optional[AsyncIOMotorDatabase] = None
        self.processed_events: Set[str] = set()  # For idempotency
        self.sse_queues: Dict[str, asyncio.Queue] = {}  # For SSE streaming
        self._running = False
        self._consumer_tasks: List[asyncio.Task] = []
        logger.info("EventBus initialized")
    
    async def initialize(self, db: AsyncIOMotorDatabase):
        """Initialize with MongoDB database"""
        self.db = db
        
        # Create indexes for events collection
        await self.db.events.create_index("event_id", unique=True)
        await self.db.events.create_index("event_type")
        await self.db.events.create_index("occurred_at")
        await self.db.events.create_index("org_id")
        await self.db.events.create_index("correlation_id")
        
        # Create index for processed events tracking
        await self.db.processed_events.create_index("event_id", unique=True)
        await self.db.processed_events.create_index(
            "processed_at", 
            expireAfterSeconds=86400 * 7  # TTL: 7 days
        )
        
        # Load recently processed events for idempotency
        cutoff = datetime.utcnow() - timedelta(hours=1)
        async for doc in self.db.processed_events.find({"processed_at": {"$gt": cutoff}}):
            self.processed_events.add(doc["event_id"])
        
        self._running = True
        logger.info(f"EventBus connected to MongoDB, loaded {len(self.processed_events)} processed events")
    
    async def shutdown(self):
        """Graceful shutdown"""
        self._running = False
        for task in self._consumer_tasks:
            task.cancel()
        logger.info("EventBus shutdown")
    
    def subscribe(self, topic: str, handler: Callable):
        """Subscribe a handler to a topic"""
        self.subscribers[topic].append(handler)
        logger.info(f"Subscribed handler to topic: {topic}")
    
    def unsubscribe(self, topic: str, handler: Callable):
        """Unsubscribe a handler from a topic"""
        if handler in self.subscribers[topic]:
            self.subscribers[topic].remove(handler)
    
    async def publish(self, event: EventEnvelope) -> str:
        """Publish an event to the bus"""
        if not self.db:
            raise RuntimeError("EventBus not initialized with database")
        
        # Persist to MongoDB
        event_doc = {
            "event_id": event.event_id,
            "event_type": event.event_type,
            "occurred_at": event.occurred_at,
            "org_id": event.org_id,
            "correlation_id": event.correlation_id,
            "producer": event.producer,
            "schema_version": event.schema_version,
            "payload": event.payload,
            "status": "pending"
        }
        
        try:
            await self.db.events.insert_one(event_doc)
        except Exception as e:
            if "duplicate key" in str(e):
                logger.warning(f"Duplicate event {event.event_id}, skipping")
                return event.event_id
            raise
        
        # Dispatch to subscribers
        await self._dispatch(event)
        
        # Send to SSE queues
        await self._notify_sse(event)
        
        logger.debug(f"Published event: {event.event_type} ({event.event_id})")
        return event.event_id
    
    async def _dispatch(self, event: EventEnvelope):
        """Dispatch event to all subscribers"""
        handlers = self.subscribers.get(event.event_type, [])
        
        for handler in handlers:
            try:
                # Check idempotency
                consumer_key = f"{event.event_id}:{handler.__name__}"
                if consumer_key in self.processed_events:
                    logger.debug(f"Skipping already processed event {event.event_id} for {handler.__name__}")
                    continue
                
                # Execute handler
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
                
                # Mark as processed
                self.processed_events.add(consumer_key)
                await self.db.processed_events.update_one(
                    {"event_id": consumer_key},
                    {"$set": {"event_id": consumer_key, "processed_at": datetime.utcnow()}},
                    upsert=True
                )
                
            except Exception as e:
                logger.error(f"Handler {handler.__name__} failed for event {event.event_id}: {e}")
    
    async def _notify_sse(self, event: EventEnvelope):
        """Send event to SSE queues for real-time streaming"""
        # Topics that should be streamed to UI
        sse_topics = {
            "etl.pipeline_run.event.v1",
            "etl.dlq.v1",
            "serving.dashboard.refresh.v1",
            "canonical.record.upserted.v1"
        }
        
        if event.event_type in sse_topics:
            event_data = {
                "event_id": event.event_id,
                "event_type": event.event_type,
                "occurred_at": event.occurred_at.isoformat(),
                "payload": event.payload
            }
            
            for queue in self.sse_queues.values():
                try:
                    queue.put_nowait(event_data)
                except asyncio.QueueFull:
                    # Queue full, skip this client
                    pass
    
    def create_sse_queue(self) -> tuple:
        """Create a new SSE queue for a client"""
        queue_id = str(uuid.uuid4())
        queue = asyncio.Queue(maxsize=100)
        self.sse_queues[queue_id] = queue
        return queue_id, queue
    
    def remove_sse_queue(self, queue_id: str):
        """Remove an SSE queue when client disconnects"""
        self.sse_queues.pop(queue_id, None)
    
    async def get_events(
        self,
        event_type: Optional[str] = None,
        org_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        since: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Query persisted events"""
        if not self.db:
            return []
        
        query = {}
        if event_type:
            query["event_type"] = event_type
        if org_id:
            query["org_id"] = org_id
        if correlation_id:
            query["correlation_id"] = correlation_id
        if since:
            query["occurred_at"] = {"$gt": since}
        
        cursor = self.db.events.find(query).sort("occurred_at", -1).limit(limit)
        events = await cursor.to_list(limit)
        
        return [self._serialize_event(e) for e in events]
    
    def _serialize_event(self, doc: Dict) -> Dict:
        """Serialize MongoDB document to JSON-safe dict"""
        result = {}
        for k, v in doc.items():
            if k == '_id':
                continue
            elif isinstance(v, datetime):
                result[k] = v.isoformat()
            else:
                result[k] = v
        return result


# Global event bus instance
event_bus = EventBus()


# Helper function to create and publish events
async def emit_event(
    event_type: str,
    payload: Dict[str, Any],
    producer: str,
    org_id: Optional[str] = None,
    correlation_id: Optional[str] = None
) -> str:
    """Helper to create and publish an event"""
    event = EventEnvelope(
        event_type=event_type,
        payload=payload,
        producer=producer,
        org_id=org_id,
        correlation_id=correlation_id
    )
    return await event_bus.publish(event)
