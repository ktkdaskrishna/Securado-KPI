"""Base Loader Interface"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime


class BaseLoader(ABC):
    """Abstract base class for all database loaders"""
    
    def __init__(self):
        self.connected = False
        self.connection_info = None
    
    @abstractmethod
    async def connect(self, config: Dict[str, Any]) -> bool:
        """Establish connection to the target database"""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Close the connection"""
        pass
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """Test the connection and return status info"""
        pass
    
    @abstractmethod
    async def discover_schema(self, table_name: Optional[str] = None) -> Dict[str, Any]:
        """Discover the schema of the target database/table"""
        pass
    
    @abstractmethod
    async def upsert(self, table: str, records: List[Dict], key_field: str) -> Tuple[int, int]:
        """Insert or update records. Returns (inserted_count, updated_count)"""
        pass
    
    @abstractmethod
    async def soft_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        """Mark records as deleted. Returns deleted count"""
        pass
    
    @abstractmethod
    async def hard_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        """Permanently delete records. Returns deleted count"""
        pass
    
    @abstractmethod
    async def create_table(self, table: str, schema: Dict[str, Any]) -> bool:
        """Create table if it doesn't exist"""
        pass
    
    @abstractmethod
    async def get_record_count(self, table: str) -> int:
        """Get total record count in table"""
        pass
