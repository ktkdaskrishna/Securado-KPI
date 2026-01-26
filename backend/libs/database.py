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
        
        self.client = AsyncIOMotorClient(mongo_url)
        self.app_db = self.client[app_db_name]
        self.canonical_db = self.client[canonical_db_name]
        
        # Create indexes
        await self._create_indexes()
        
        logger.info(f"Connected to MongoDB: app={app_db_name}, canonical={canonical_db_name}")
    
    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")
    
    async def _create_indexes(self):
        """Create database indexes"""
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
        
        logger.info("Database indexes created")


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
