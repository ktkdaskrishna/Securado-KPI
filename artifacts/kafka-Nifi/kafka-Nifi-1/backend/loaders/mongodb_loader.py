"""MongoDB Loader Implementation"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from .base import BaseLoader
import logging

logger = logging.getLogger(__name__)


class MongoDBLoader(BaseLoader):
    """MongoDB target loader"""
    
    def __init__(self):
        super().__init__()
        self.client = None
        self.db = None
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        try:
            connection_string = config.get('connection_string')
            if not connection_string:
                host = config.get('host', 'localhost')
                port = config.get('port', 27017)
                username = config.get('username', '')
                password = config.get('password', '')
                database = config.get('database', 'test')
                
                if username and password:
                    connection_string = f"mongodb://{username}:{password}@{host}:{port}/{database}"
                else:
                    connection_string = f"mongodb://{host}:{port}/{database}"
            
            self.client = AsyncIOMotorClient(connection_string)
            self.db = self.client[config.get('database', 'test')]
            self.connected = True
            self.connection_info = config
            return True
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            self.connected = False
            return False
    
    async def disconnect(self) -> None:
        if self.client:
            self.client.close()
            self.connected = False
    
    async def test_connection(self) -> Dict[str, Any]:
        try:
            info = await self.client.server_info()
            return {
                "status": "healthy",
                "version": info.get('version'),
                "message": f"Connected to MongoDB {info.get('version')}"
            }
        except Exception as e:
            return {"status": "unhealthy", "message": str(e)}
    
    async def discover_schema(self, table_name: Optional[str] = None) -> Dict[str, Any]:
        try:
            if table_name:
                # Sample documents to infer schema
                sample = await self.db[table_name].find_one()
                if sample:
                    fields = []
                    for key, value in sample.items():
                        field_type = type(value).__name__
                        if key == '_id':
                            field_type = 'ObjectId'
                        fields.append({
                            "name": key,
                            "type": field_type,
                            "nullable": True
                        })
                    return {"table": table_name, "columns": fields}
                return {"table": table_name, "columns": []}
            else:
                # List all collections
                collections = await self.db.list_collection_names()
                return {"tables": collections}
        except Exception as e:
            logger.error(f"Schema discovery failed: {e}")
            return {"error": str(e)}
    
    async def upsert(self, table: str, records: List[Dict], key_field: str) -> Tuple[int, int]:
        inserted = 0
        updated = 0
        collection = self.db[table]
        
        for record in records:
            record['_updated_at'] = datetime.now(timezone.utc)
            result = await collection.update_one(
                {key_field: record.get(key_field)},
                {"$set": record},
                upsert=True
            )
            if result.upserted_id:
                inserted += 1
            elif result.modified_count > 0:
                updated += 1
        
        return inserted, updated
    
    async def soft_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        collection = self.db[table]
        result = await collection.update_many(
            {key_field: {"$in": record_ids}},
            {"$set": {
                "_is_deleted": True,
                "_deleted_at": datetime.now(timezone.utc)
            }}
        )
        return result.modified_count
    
    async def hard_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        collection = self.db[table]
        result = await collection.delete_many({key_field: {"$in": record_ids}})
        return result.deleted_count
    
    async def create_table(self, table: str, schema: Dict[str, Any]) -> bool:
        # MongoDB creates collections automatically
        try:
            await self.db.create_collection(table)
            return True
        except Exception:
            return True  # Collection might already exist
    
    async def get_record_count(self, table: str) -> int:
        return await self.db[table].count_documents({})
