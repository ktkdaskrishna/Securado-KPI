from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from core.config import settings
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.canonical_client: AsyncIOMotorClient = None
        self.canonical_db: AsyncIOMotorDatabase = None
        self.app_client: AsyncIOMotorClient = None
        self.app_db: AsyncIOMotorDatabase = None
    
    async def connect(self):
        """Connect to both MongoDB instances"""
        try:
            # Canonical DB (READ ONLY)
            self.canonical_client = AsyncIOMotorClient(settings.CANONICAL_MONGO_URL)
            self.canonical_db = self.canonical_client[settings.CANONICAL_DB_NAME]
            logger.info(f"Connected to Canonical MongoDB: {settings.CANONICAL_DB_NAME}")
            
            # App DB (READ/WRITE)
            self.app_client = AsyncIOMotorClient(settings.APP_MONGO_URL)
            self.app_db = self.app_client[settings.APP_DB_NAME]
            logger.info(f"Connected to App MongoDB: {settings.APP_DB_NAME}")
            
            # Create indexes for app collections
            await self._create_indexes()
            
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            raise
    
    async def _create_indexes(self):
        """Create indexes for app collections"""
        try:
            # Users
            await self.app_db.users.create_index("email", unique=True)
            await self.app_db.users.create_index("org_id")
            
            # Overrides
            await self.app_db.overrides_opportunities.create_index([("canonical_id", 1), ("org_id", 1)])
            await self.app_db.overrides_accounts.create_index([("canonical_id", 1), ("org_id", 1)])
            
            # Serving cache
            await self.app_db.serving_cache.create_index([("entity_type", 1), ("org_id", 1)])
            
            logger.info("Database indexes created")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")
    
    async def disconnect(self):
        """Disconnect from both MongoDB instances"""
        if self.canonical_client:
            self.canonical_client.close()
        if self.app_client:
            self.app_client.close()
        logger.info("Disconnected from databases")

# Global database manager instance
db_manager = DatabaseManager()

def get_canonical_db() -> AsyncIOMotorDatabase:
    return db_manager.canonical_db

def get_app_db() -> AsyncIOMotorDatabase:
    return db_manager.app_db
