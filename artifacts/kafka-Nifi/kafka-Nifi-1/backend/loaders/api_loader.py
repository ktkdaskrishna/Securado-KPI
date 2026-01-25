"""REST API Loader Implementation"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import httpx
from .base import BaseLoader
import logging
import json

logger = logging.getLogger(__name__)


class APILoader(BaseLoader):
    """REST API target loader using httpx"""
    
    def __init__(self):
        super().__init__()
        self.client = None
        self.base_url = None
        self.headers = {}
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        try:
            self.base_url = config.get('url', '').rstrip('/')
            self.headers = config.get('headers', {})
            
            # Add auth if provided
            if config.get('api_key'):
                self.headers['Authorization'] = f"Bearer {config['api_key']}"
            elif config.get('username') and config.get('password'):
                import base64
                creds = base64.b64encode(f"{config['username']}:{config['password']}".encode()).decode()
                self.headers['Authorization'] = f"Basic {creds}"
            
            self.headers['Content-Type'] = 'application/json'
            
            self.client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self.headers,
                timeout=30.0
            )
            self.connected = True
            self.connection_info = config
            return True
        except Exception as e:
            logger.error(f"API connection failed: {e}")
            self.connected = False
            return False
    
    async def disconnect(self) -> None:
        if self.client:
            await self.client.aclose()
            self.connected = False
    
    async def test_connection(self) -> Dict[str, Any]:
        try:
            health_endpoint = self.connection_info.get('health_endpoint', '/health')
            response = await self.client.get(health_endpoint)
            if response.status_code < 400:
                return {
                    "status": "healthy",
                    "message": f"API responding at {self.base_url}"
                }
            else:
                return {
                    "status": "unhealthy",
                    "message": f"API returned status {response.status_code}"
                }
        except Exception as e:
            return {"status": "unhealthy", "message": str(e)}
    
    async def discover_schema(self, table_name: Optional[str] = None) -> Dict[str, Any]:
        # APIs don't have traditional schema discovery
        # Return endpoint configuration
        return {
            "endpoints": {
                "upsert": self.connection_info.get('upsert_endpoint', '/data'),
                "delete": self.connection_info.get('delete_endpoint', '/data'),
            },
            "method": self.connection_info.get('method', 'POST')
        }
    
    async def upsert(self, table: str, records: List[Dict], key_field: str) -> Tuple[int, int]:
        if not records:
            return 0, 0
        
        inserted = 0
        updated = 0
        
        endpoint = self.connection_info.get('upsert_endpoint', f'/{table}')
        batch_size = self.connection_info.get('batch_size', 100)
        
        # Send in batches
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            
            for record in batch:
                record['_updated_at'] = datetime.now(timezone.utc).isoformat()
            
            try:
                response = await self.client.post(endpoint, json={"records": batch})
                if response.status_code < 400:
                    result = response.json()
                    inserted += result.get('inserted', len(batch))
                    updated += result.get('updated', 0)
                else:
                    logger.error(f"API upsert failed: {response.text}")
            except Exception as e:
                logger.error(f"API upsert error: {e}")
        
        return inserted, updated
    
    async def soft_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        endpoint = self.connection_info.get('delete_endpoint', f'/{table}')
        try:
            response = await self.client.patch(endpoint, json={
                "ids": record_ids,
                "action": "soft_delete"
            })
            if response.status_code < 400:
                return response.json().get('deleted', len(record_ids))
        except Exception as e:
            logger.error(f"API soft delete error: {e}")
        return 0
    
    async def hard_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        endpoint = self.connection_info.get('delete_endpoint', f'/{table}')
        try:
            response = await self.client.delete(endpoint, json={"ids": record_ids})
            if response.status_code < 400:
                return response.json().get('deleted', len(record_ids))
        except Exception as e:
            logger.error(f"API hard delete error: {e}")
        return 0
    
    async def create_table(self, table: str, schema: Dict[str, Any]) -> bool:
        # APIs don't create tables
        return True
    
    async def get_record_count(self, table: str) -> int:
        endpoint = self.connection_info.get('count_endpoint', f'/{table}/count')
        try:
            response = await self.client.get(endpoint)
            if response.status_code < 400:
                return response.json().get('count', 0)
        except Exception:
            pass
        return 0
