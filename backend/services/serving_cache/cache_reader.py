"""Cache Reader - Reads pre-computed data from serving cache

All UI components should use this to read data, ensuring consistency.
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from .cache_builder import cache_builder

logger = logging.getLogger(__name__)


class CacheReader:
    """Reads from serving cache, rebuilds if expired"""
    
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
        self.app_db: Optional[AsyncIOMotorDatabase] = None
        logger.info("CacheReader initialized")
    
    async def initialize(self, app_db: AsyncIOMotorDatabase):
        """Initialize with database connection"""
        self.app_db = app_db
        logger.info("CacheReader connected to database")
    
    async def get_dashboard_kpis(
        self,
        org_id: str,
        year: Optional[str] = None,
        quarter: Optional[str] = None,
        sales_rep: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get dashboard KPIs from cache, rebuild if needed"""
        return await cache_builder.build_dashboard_kpis(
            org_id, year, quarter, sales_rep, force=False
        )
    
    async def get_account_overdue(
        self,
        org_id: str,
        account_id: Optional[str] = None,
        account_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get account overdue data from cache
        
        If account_id or account_name provided, returns just that account's data.
        Otherwise returns full summary.
        """
        data = await cache_builder.build_account_overdue(org_id, force=False)
        
        if account_id or account_name:
            # Look up specific account - try by key first, then search by name
            if account_id:
                account_data = data["by_account"].get(account_id, {})
                if account_data:
                    return {
                        "overdue_amount": account_data.get("overdue_amount", 0),
                        "invoice_count": account_data.get("invoice_count", 0),
                        "has_overdue": account_data.get("overdue_amount", 0) > 0
                    }
            
            # Search by account_name (case-insensitive partial match)
            if account_name:
                search_name = account_name.lower()
                for key, acc_data in data["by_account"].items():
                    if search_name in (acc_data.get("account_name", "") or "").lower():
                        return {
                            "overdue_amount": acc_data.get("overdue_amount", 0),
                            "invoice_count": acc_data.get("invoice_count", 0),
                            "has_overdue": acc_data.get("overdue_amount", 0) > 0
                        }
            
            # Not found
            return {
                "overdue_amount": 0,
                "invoice_count": 0,
                "has_overdue": False
            }
        
        return data
    
    async def get_sales_leaderboard(
        self,
        org_id: str,
        year: Optional[str] = None,
        quarter: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get sales rep leaderboard from cache"""
        return await cache_builder.build_sales_leaderboard(
            org_id, year, quarter, force=False
        )
    
    async def get_pm_leaderboard(
        self,
        org_id: str,
        year: Optional[str] = None,
        quarter: Optional[str] = None,
        sales_rep: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get product manager leaderboard from cache"""
        return await cache_builder.build_pm_leaderboard(
            org_id, year, quarter, sales_rep, force=False
        )
    
    async def refresh_all(
        self,
        org_id: str,
        year: Optional[str] = None,
        quarter: Optional[str] = None
    ):
        """Force refresh all caches"""
        await cache_builder.build_all_caches(org_id, year, quarter, force=True)


# Global singleton
cache_reader = CacheReader()
