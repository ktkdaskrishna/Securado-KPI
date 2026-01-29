"""MongoDB-based Event Queue Service

Provides a reliable message queue using MongoDB for:
- Decoupled ETL processing
- Retry logic for failed operations
- Event audit trail
- Real-time queue monitoring

Queue Lifecycle:
1. ETL publishes events -> status: 'pending'
2. Worker picks up event -> status: 'processing'
3. Worker completes -> status: 'completed' (auto-deleted after TTL)
4. Worker fails -> status: 'failed', retry_count++
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
import uuid

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class EventQueueService:
    """MongoDB-based event queue for reliable message processing"""
    
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
        self.db: Optional[AsyncIOMotorDatabase] = None
        self._running = False
        self.max_retries = 3
        self.retry_delay_seconds = 60
        self.ttl_hours = 24  # Auto-delete completed events after 24 hours
        logger.info("EventQueueService initialized")
    
    async def initialize(self, db: AsyncIOMotorDatabase):
        """Initialize queue with database connection and create indexes"""
        self.db = db
        
        # Create indexes for event_queue collection
        await self.db.event_queue.create_index("event_id", unique=True)
        await self.db.event_queue.create_index("status")
        await self.db.event_queue.create_index("event_type")
        await self.db.event_queue.create_index("created_at")
        await self.db.event_queue.create_index("org_id")
        await self.db.event_queue.create_index("correlation_id")
        
        # TTL index to auto-delete completed events after 24 hours
        await self.db.event_queue.create_index(
            "completed_at",
            expireAfterSeconds=self.ttl_hours * 3600
        )
        
        # Compound index for efficient worker queries
        await self.db.event_queue.create_index(
            [("status", 1), ("created_at", 1)]
        )
        
        self._running = True
        logger.info("EventQueueService connected to MongoDB with indexes")
    
    async def shutdown(self):
        """Graceful shutdown"""
        self._running = False
        logger.info("EventQueueService shutdown")
    
    async def publish(
        self,
        event_type: str,
        payload: Dict[str, Any],
        org_id: str,
        correlation_id: Optional[str] = None,
        producer: str = "unknown"
    ) -> str:
        """Publish an event to the queue
        
        Args:
            event_type: Type of event (e.g., 'etl.record.upsert')
            payload: Event data
            org_id: Organization ID
            correlation_id: Optional correlation ID for tracing
            producer: Name of the producing service
            
        Returns:
            event_id: Unique ID of the published event
        """
        if self.db is None:
            raise RuntimeError("EventQueueService not initialized")
        
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        event_doc = {
            "event_id": event_id,
            "event_type": event_type,
            "payload": payload,
            "org_id": org_id,
            "correlation_id": correlation_id or str(uuid.uuid4()),
            "producer": producer,
            "status": "pending",
            "retry_count": 0,
            "created_at": now,
            "updated_at": now,
            "processed_at": None,
            "completed_at": None,
            "error": None
        }
        
        await self.db.event_queue.insert_one(event_doc)
        logger.debug(f"Published event {event_id}: {event_type}")
        
        return event_id
    
    async def publish_batch(
        self,
        events: List[Dict[str, Any]],
        org_id: str,
        correlation_id: Optional[str] = None
    ) -> List[str]:
        """Publish multiple events atomically
        
        Args:
            events: List of {event_type, payload, producer} dicts
            org_id: Organization ID
            correlation_id: Optional shared correlation ID
            
        Returns:
            List of event_ids
        """
        if self.db is None:
            raise RuntimeError("EventQueueService not initialized")
        
        if not events:
            return []
        
        correlation = correlation_id or str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        event_ids = []
        docs = []
        
        for event in events:
            event_id = str(uuid.uuid4())
            event_ids.append(event_id)
            
            docs.append({
                "event_id": event_id,
                "event_type": event.get("event_type"),
                "payload": event.get("payload", {}),
                "org_id": org_id,
                "correlation_id": correlation,
                "producer": event.get("producer", "unknown"),
                "status": "pending",
                "retry_count": 0,
                "created_at": now,
                "updated_at": now,
                "processed_at": None,
                "completed_at": None,
                "error": None
            })
        
        await self.db.event_queue.insert_many(docs)
        logger.info(f"Published batch of {len(docs)} events")
        
        return event_ids
    
    async def fetch_pending(
        self,
        batch_size: int = 10,
        event_types: Optional[List[str]] = None
    ) -> List[Dict]:
        """Fetch pending events for processing
        
        Uses findAndModify to atomically claim events (prevents duplicate processing).
        
        Args:
            batch_size: Maximum number of events to fetch
            event_types: Optional filter for specific event types
            
        Returns:
            List of event documents
        """
        if self.db is None:
            return []
        
        now = datetime.now(timezone.utc)
        events = []
        
        query = {"status": "pending"}
        if event_types:
            query["event_type"] = {"$in": event_types}
        
        # Also pick up failed events that are ready for retry
        retry_cutoff = now - timedelta(seconds=self.retry_delay_seconds)
        retry_query = {
            "status": "failed",
            "retry_count": {"$lt": self.max_retries},
            "updated_at": {"$lt": retry_cutoff}
        }
        if event_types:
            retry_query["event_type"] = {"$in": event_types}
        
        # Combine queries
        combined_query = {"$or": [query, retry_query]}
        
        for _ in range(batch_size):
            # Atomically claim one event
            result = await self.db.event_queue.find_one_and_update(
                combined_query,
                {
                    "$set": {
                        "status": "processing",
                        "processed_at": now,
                        "updated_at": now
                    }
                },
                sort=[("created_at", 1)],  # FIFO
                return_document=True
            )
            
            if result:
                events.append(self._serialize_event(result))
            else:
                break  # No more pending events
        
        return events
    
    async def mark_completed(self, event_id: str) -> bool:
        """Mark an event as successfully processed"""
        if self.db is None:
            return False
        
        now = datetime.now(timezone.utc)
        result = await self.db.event_queue.update_one(
            {"event_id": event_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": now,
                    "updated_at": now
                }
            }
        )
        
        return result.modified_count > 0
    
    async def mark_failed(self, event_id: str, error: str) -> bool:
        """Mark an event as failed with error message"""
        if self.db is None:
            return False
        
        now = datetime.now(timezone.utc)
        result = await self.db.event_queue.update_one(
            {"event_id": event_id},
            {
                "$set": {
                    "status": "failed",
                    "error": error,
                    "updated_at": now
                },
                "$inc": {"retry_count": 1}
            }
        )
        
        return result.modified_count > 0
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        if self.db is None:
            return {}
        
        now = datetime.now(timezone.utc)
        
        # Count by status
        pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        status_counts = {}
        async for doc in self.db.event_queue.aggregate(pipeline):
            status_counts[doc["_id"]] = doc["count"]
        
        # Count by event type (for pending only)
        type_pipeline = [
            {"$match": {"status": "pending"}},
            {"$group": {
                "_id": "$event_type",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        pending_by_type = []
        async for doc in self.db.event_queue.aggregate(type_pipeline):
            pending_by_type.append({"event_type": doc["_id"], "count": doc["count"]})
        
        # Get oldest pending event
        oldest_pending = await self.db.event_queue.find_one(
            {"status": "pending"},
            sort=[("created_at", 1)]
        )
        
        # Calculate processing rate (events completed in last hour)
        hour_ago = now - timedelta(hours=1)
        completed_last_hour = await self.db.event_queue.count_documents({
            "status": "completed",
            "completed_at": {"$gte": hour_ago}
        })
        
        # Count dead letter (max retries exceeded)
        dead_letter_count = await self.db.event_queue.count_documents({
            "status": "failed",
            "retry_count": {"$gte": self.max_retries}
        })
        
        return {
            "timestamp": now.isoformat(),
            "status_counts": {
                "pending": status_counts.get("pending", 0),
                "processing": status_counts.get("processing", 0),
                "completed": status_counts.get("completed", 0),
                "failed": status_counts.get("failed", 0)
            },
            "total_events": sum(status_counts.values()),
            "pending_by_type": pending_by_type,
            "oldest_pending_age_seconds": (
                (now - oldest_pending["created_at"].replace(tzinfo=timezone.utc)).total_seconds()
                if oldest_pending and oldest_pending.get("created_at")
                else 0
            ),
            "events_per_hour": completed_last_hour,
            "dead_letter_count": dead_letter_count,
            "max_retries": self.max_retries,
            "health": self._calculate_health(status_counts, dead_letter_count)
        }
    
    def _calculate_health(self, status_counts: Dict, dead_letter: int) -> str:
        """Calculate queue health status"""
        pending = status_counts.get("pending", 0)
        failed = status_counts.get("failed", 0)
        
        if dead_letter > 10:
            return "critical"
        if failed > 50 or pending > 1000:
            return "warning"
        return "healthy"
    
    async def get_failed_events(
        self,
        limit: int = 50,
        include_dead_letter: bool = True
    ) -> List[Dict]:
        """Get failed events for debugging"""
        if self.db is None:
            return []
        
        query = {"status": "failed"}
        if not include_dead_letter:
            query["retry_count"] = {"$lt": self.max_retries}
        
        cursor = self.db.event_queue.find(query).sort("updated_at", -1).limit(limit)
        events = []
        async for doc in cursor:
            events.append(self._serialize_event(doc))
        
        return events
    
    async def retry_event(self, event_id: str) -> bool:
        """Manually retry a failed event"""
        if self.db is None:
            return False
        
        result = await self.db.event_queue.update_one(
            {"event_id": event_id, "status": "failed"},
            {
                "$set": {
                    "status": "pending",
                    "error": None,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return result.modified_count > 0
    
    async def purge_completed(self, older_than_hours: int = 24) -> int:
        """Manually purge completed events (TTL index handles this automatically)"""
        if self.db is None:
            return 0
        
        cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
        result = await self.db.event_queue.delete_many({
            "status": "completed",
            "completed_at": {"$lt": cutoff}
        })
        
        return result.deleted_count
    
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


# Global singleton instance
event_queue_service = EventQueueService()
