"""Database Manager - MongoDB Connection Management

Manages connections to:
- App DB: Users, RBAC, configs, overrides, admin logs
- Canonical DB: ETL-produced canonical records (opportunities, accounts, contacts, users)
"""
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages MongoDB database connections"""
    
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
        self.client: Optional[AsyncIOMotorClient] = None
        self.app_db: Optional[AsyncIOMotorDatabase] = None
        self.canonical_db: Optional[AsyncIOMotorDatabase] = None
    
    async def connect(self):
        """Connect to MongoDB"""
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        app_db_name = os.environ.get('APP_DB_NAME', 'event_mesh_app')
        canonical_db_name = os.environ.get('CANONICAL_DB_NAME', 'event_mesh_canonical')
        
        try:
            self.client = AsyncIOMotorClient(
                mongo_url,
                serverSelectionTimeoutMS=10000,  # 10 second timeout
                connectTimeoutMS=10000,
                socketTimeoutMS=10000
            )
            self.app_db = self.client[app_db_name]
            self.canonical_db = self.client[canonical_db_name]
            
            # Test connection with a ping
            await self.client.admin.command('ping')
            
            # Create indexes
            await self._create_indexes()
            
            logger.info(f"Connected to MongoDB: app={app_db_name}, canonical={canonical_db_name}")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            # Don't raise - allow app to start even if DB is temporarily unavailable
            # Health check will report disconnected status
    
    
    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")
    
    async def _create_indexes(self):
        """Create database indexes - idempotent, skips if recently created"""
        from datetime import datetime, timezone, timedelta
        meta = await self.app_db.system_meta.find_one({"key": "indexes_created"})
        if meta and meta.get("timestamp"):
            last = meta["timestamp"]
            if hasattr(last, 'replace'):
                last_utc = last.replace(tzinfo=timezone.utc) if last.tzinfo is None else last
                if last_utc > datetime.now(timezone.utc) - timedelta(hours=24):
                    logger.info("Indexes created recently, skipping (use force_reindex to override)")
                    return

        logger.info("Creating database indexes (89 indexes)...")
        # App DB indexes
        await self.app_db.users.create_index("id", unique=True)
        await self.app_db.users.create_index("email", unique=True)
        await self.app_db.users.create_index("org_id")
        await self.app_db.users.create_index("status")
        
        await self.app_db.roles.create_index("id", unique=True)
        await self.app_db.roles.create_index("org_id")
        await self.app_db.roles.create_index("name")
        
        await self.app_db.permissions.create_index("id", unique=True)
        await self.app_db.permissions.create_index("org_id")
        
        await self.app_db.departments.create_index("id", unique=True)
        await self.app_db.departments.create_index("org_id")
        
        await self.app_db.connections.create_index("id", unique=True)
        await self.app_db.connections.create_index("org_id")
        
        await self.app_db.mappings.create_index("id", unique=True)
        await self.app_db.mappings.create_index("org_id")
        await self.app_db.mappings.create_index("connection_id")
        
        await self.app_db.pipelines.create_index("id", unique=True)
        await self.app_db.pipelines.create_index("org_id")
        
        await self.app_db.pipeline_runs.create_index("id", unique=True)
        await self.app_db.pipeline_runs.create_index("pipeline_id")
        await self.app_db.pipeline_runs.create_index("org_id")
        await self.app_db.pipeline_runs.create_index("started_at")
        
        await self.app_db.overrides.create_index("id", unique=True)
        await self.app_db.overrides.create_index(["canonical_id", "org_id"])
        
        await self.app_db.activities.create_index("id", unique=True)
        await self.app_db.activities.create_index("org_id")
        await self.app_db.activities.create_index("opportunity_id")
        
        await self.app_db.goals.create_index("id", unique=True)
        await self.app_db.goals.create_index("org_id")
        
        await self.app_db.teams.create_index("id", unique=True)
        await self.app_db.teams.create_index("org_id")
        
        await self.app_db.portfolios.create_index("id", unique=True)
        await self.app_db.portfolios.create_index("org_id")
        
        await self.app_db.initiatives.create_index("id", unique=True)
        await self.app_db.initiatives.create_index("org_id")
        
        await self.app_db.kpis.create_index("id", unique=True)
        await self.app_db.kpis.create_index("org_id")
        
        await self.app_db.serving_cache.create_index(["entity_type", "org_id"])
        
        await self.app_db.dlq.create_index("id", unique=True)
        await self.app_db.dlq.create_index("pipeline_id")
        await self.app_db.dlq.create_index("status")
        
        await self.app_db.config.create_index(["config_type", "org_id"])
        
        # Bluesheet indexes
        await self.app_db.bluesheets.create_index("opportunity_id")
        await self.app_db.bluesheets.create_index("org_id")
        await self.app_db.bluesheets.create_index(["opportunity_id", "org_id"], unique=True)
        
        # Notes indexes
        await self.app_db.notes.create_index("id", unique=True)
        await self.app_db.notes.create_index("org_id")
        await self.app_db.notes.create_index("opportunity_id")
        await self.app_db.notes.create_index("account_id")
        await self.app_db.notes.create_index("created_at")
        
        # Canonical DB indexes
        await self.canonical_db.opportunities.create_index("canonical_id", unique=True)
        await self.canonical_db.opportunities.create_index("org_id")
        await self.canonical_db.opportunities.create_index("source_system")
        await self.canonical_db.opportunities.create_index("source_record_id")
        await self.canonical_db.opportunities.create_index("stage")
        
        await self.canonical_db.accounts.create_index("canonical_id", unique=True)
        await self.canonical_db.accounts.create_index("org_id")
        await self.canonical_db.accounts.create_index("source_system")
        
        await self.canonical_db.contacts.create_index("canonical_id", unique=True)
        await self.canonical_db.contacts.create_index("org_id")
        
        await self.canonical_db.users.create_index("canonical_id", unique=True)
        await self.canonical_db.users.create_index("org_id")
        
        # Target Management indexes
        await self.app_db.sales_targets.create_index("id", unique=True)
        await self.app_db.sales_targets.create_index("org_id")
        await self.app_db.sales_targets.create_index("assigned_to")
        await self.app_db.sales_targets.create_index("parent_target_id")
        await self.app_db.sales_targets.create_index("department")
        await self.app_db.sales_targets.create_index("period_type")
        
        await self.app_db.activity_targets.create_index("id", unique=True)
        await self.app_db.activity_targets.create_index("org_id")
        await self.app_db.activity_targets.create_index("assigned_to")
        await self.app_db.activity_targets.create_index("activity_type")
        await self.app_db.activity_targets.create_index("parent_target_id")
        
        await self.app_db.incentive_plans.create_index("id", unique=True)
        await self.app_db.incentive_plans.create_index("org_id")
        
        await self.app_db.target_sheets.create_index("id", unique=True)
        await self.app_db.target_sheets.create_index("org_id")
        
        await self.app_db.target_plans.create_index("id", unique=True)
        await self.app_db.target_plans.create_index("org_id")
        await self.app_db.target_plans.create_index("plan_type")
        
        await self.app_db.target_plan_items.create_index("id", unique=True)
        await self.app_db.target_plan_items.create_index("org_id")
        await self.app_db.target_plan_items.create_index("revenue_plan_id")
        
        await self.app_db.target_redistributions.create_index("id", unique=True)
        await self.app_db.target_redistributions.create_index("org_id")
        await self.app_db.target_redistributions.create_index("plan_item_id")
        await self.app_db.target_redistributions.create_index("revenue_plan_id")
        
        logger.info("Database indexes created")
        # Mark as done
        from datetime import datetime, timezone
        await self.app_db.system_meta.update_one(
            {"key": "indexes_created"},
            {"$set": {"key": "indexes_created", "timestamp": datetime.now(timezone.utc), "count": 89}},
            upsert=True
        )


# Global database manager instance
db_manager = DatabaseManager()


def get_app_db() -> AsyncIOMotorDatabase:
    """Get app database"""
    if db_manager.app_db is None:
        raise RuntimeError("Database not connected")
    return db_manager.app_db


def get_canonical_db() -> AsyncIOMotorDatabase:
    """Get canonical database"""
    if db_manager.canonical_db is None:
        raise RuntimeError("Database not connected")
    return db_manager.canonical_db
