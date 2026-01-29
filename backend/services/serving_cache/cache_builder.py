"""Cache Builder - Computes and stores all UI aggregates

This is the SINGLE SOURCE OF TRUTH for all dashboard metrics.
All UI components should read from the serving_cache collection
rather than computing values independently.

Cache Types:
- dashboard_kpis: Main dashboard KPI cards
- account_overdue: Overdue amounts by account
- sales_leaderboard: Sales rep performance
- pm_leaderboard: Product manager performance  
- category_stats: Solution category breakdown
- activity_summary: Activity counts by type
- receivables_summary: Invoice/AR summary

Cache Key Structure:
{
    "cache_type": "dashboard_kpis",
    "org_id": "default",
    "filter_hash": "abc123",  # Hash of filter params for quick lookup
    "filters": {"year": "2025", "quarter": null, "sales_rep": null},
    "data": {...computed values...},
    "computed_at": datetime,
    "expires_at": datetime,
    "version": 1
}
"""
import asyncio
import hashlib
import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


# Test record patterns to exclude from analytics
TEST_RECORD_PATTERNS = [
    r'^test\s',
    r'^test$',
    r'\btest\s+\d+\b',
    r'^demo\s',
    r'^sample\s',
    r'\(test\)',
    r'\[test\]',
]

def is_test_record(name: str) -> bool:
    """Check if a record name indicates it's a test/demo record"""
    if not name:
        return False
    name_lower = name.lower().strip()
    for pattern in TEST_RECORD_PATTERNS:
        if re.search(pattern, name_lower, re.IGNORECASE):
            return True
    return False


class CacheBuilder:
    """Builds and maintains the serving cache for all UI components"""
    
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
        self.canonical_db: Optional[AsyncIOMotorDatabase] = None
        self._running = False
        self.cache_ttl_seconds = 300  # 5 minutes default
        self.version = 1
        logger.info("CacheBuilder initialized")
    
    async def initialize(self, app_db: AsyncIOMotorDatabase, canonical_db: AsyncIOMotorDatabase):
        """Initialize with database connections"""
        self.app_db = app_db
        self.canonical_db = canonical_db
        
        # Create indexes on serving_cache
        await app_db.serving_cache.create_index("cache_type")
        await app_db.serving_cache.create_index("org_id")
        await app_db.serving_cache.create_index("filter_hash")
        await app_db.serving_cache.create_index("expires_at")
        await app_db.serving_cache.create_index(
            [("cache_type", 1), ("org_id", 1), ("filter_hash", 1)],
            unique=True
        )
        
        # TTL index to auto-expire old cache entries
        await app_db.serving_cache.create_index(
            "expires_at",
            expireAfterSeconds=0
        )
        
        self._running = True
        logger.info("CacheBuilder connected to databases")
    
    def _make_filter_hash(self, filters: Dict) -> str:
        """Create a consistent hash from filter parameters"""
        # Sort keys for consistent hashing
        normalized = {k: v for k, v in sorted(filters.items()) if v is not None}
        return hashlib.md5(json.dumps(normalized).encode()).hexdigest()[:12]
    
    async def build_dashboard_kpis(
        self,
        org_id: str,
        year: Optional[str] = None,
        quarter: Optional[str] = None,
        sales_rep: Optional[str] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        """Build dashboard KPI cache
        
        This computes:
        - Total pipeline value
        - Open opportunities count
        - Won count and value
        - Lost count
        - Win rate
        - Stage breakdown
        """
        filters = {"year": year, "quarter": quarter, "sales_rep": sales_rep}
        filter_hash = self._make_filter_hash(filters)
        cache_type = "dashboard_kpis"
        
        # Check if valid cache exists
        if not force:
            existing = await self._get_cache(cache_type, org_id, filter_hash)
            if existing:
                return existing["data"]
        
        # Build fresh cache
        logger.info(f"Building {cache_type} cache for org={org_id}, filters={filters}")
        
        # Fetch opportunities
        query = {"org_id": org_id}
        if sales_rep:
            query["owner_name"] = sales_rep
        
        opps = await self.canonical_db.opportunities.find(query).to_list(10000)
        
        # Filter out test records
        opps = [o for o in opps if not is_test_record(o.get("name", ""))]
        
        # Apply date filters
        if year or quarter:
            opps = self._apply_date_filters(opps, year, quarter)
        
        # Compute KPIs
        kpis = self._compute_kpis(opps)
        
        # Store in cache
        await self._set_cache(cache_type, org_id, filter_hash, filters, kpis)
        
        return kpis
    
    async def build_account_overdue(
        self,
        org_id: str,
        force: bool = False
    ) -> Dict[str, Any]:
        """Build account overdue cache
        
        This computes overdue amounts for each account - SINGLE calculation logic.
        """
        filters = {}
        filter_hash = self._make_filter_hash(filters)
        cache_type = "account_overdue"
        
        if not force:
            existing = await self._get_cache(cache_type, org_id, filter_hash)
            if existing:
                return existing["data"]
        
        logger.info(f"Building {cache_type} cache for org={org_id}")
        
        # Fetch invoices
        invoices = await self.canonical_db.invoices.find({"org_id": org_id}).to_list(10000)
        
        today = datetime.now(timezone.utc).date()
        
        # Calculate overdue by account (using account_id as primary key)
        overdue_by_account = {}  # account_id -> {amount, account_name, invoice_count}
        
        for inv in invoices:
            if inv.get("payment_state") in ["paid", "reversed"]:
                continue
            
            due_date = inv.get("due_date")
            if not due_date:
                continue
            
            # Parse due date
            if isinstance(due_date, str):
                try:
                    due_date = datetime.strptime(due_date[:10], "%Y-%m-%d").date()
                except:
                    continue
            elif hasattr(due_date, 'date'):
                due_date = due_date.date()
            
            if due_date >= today:
                continue  # Not overdue
            
            # Use account_id as primary key, fall back to account_name
            acc_id = str(inv.get("account_id", ""))
            acc_name = inv.get("account_name", "Unknown")
            amount = inv.get("amount_total", 0) or 0
            
            key = acc_id if acc_id else acc_name
            
            if key not in overdue_by_account:
                overdue_by_account[key] = {
                    "account_id": acc_id,
                    "account_name": acc_name,
                    "overdue_amount": 0,
                    "invoice_count": 0
                }
            
            overdue_by_account[key]["overdue_amount"] += amount
            overdue_by_account[key]["invoice_count"] += 1
        
        # Summary stats
        total_overdue = sum(a["overdue_amount"] for a in overdue_by_account.values())
        accounts_with_overdue = len(overdue_by_account)
        
        data = {
            "by_account": overdue_by_account,
            "total_overdue": total_overdue,
            "accounts_with_overdue": accounts_with_overdue,
            "computed_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self._set_cache(cache_type, org_id, filter_hash, filters, data)
        
        return data
    
    async def build_sales_leaderboard(
        self,
        org_id: str,
        year: Optional[str] = None,
        quarter: Optional[str] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        """Build sales rep leaderboard cache"""
        filters = {"year": year, "quarter": quarter}
        filter_hash = self._make_filter_hash(filters)
        cache_type = "sales_leaderboard"
        
        if not force:
            existing = await self._get_cache(cache_type, org_id, filter_hash)
            if existing:
                return existing["data"]
        
        logger.info(f"Building {cache_type} cache for org={org_id}")
        
        opps = await self.canonical_db.opportunities.find({"org_id": org_id}).to_list(10000)
        opps = [o for o in opps if not is_test_record(o.get("name", ""))]
        
        if year or quarter:
            opps = self._apply_date_filters(opps, year, quarter)
        
        # Filter to Won only and aggregate by sales rep
        won_by_rep = defaultdict(lambda: {"value": 0, "count": 0})
        
        for opp in opps:
            if self._is_won(opp):
                rep = opp.get("owner_name", "Unknown")
                won_by_rep[rep]["value"] += opp.get("sale_value", 0) or 0
                won_by_rep[rep]["count"] += 1
        
        # Sort and build leaderboard
        leaderboard = [
            {"name": rep, "value": data["value"], "deals_won": data["count"]}
            for rep, data in sorted(won_by_rep.items(), key=lambda x: x[1]["value"], reverse=True)
        ][:15]
        
        data = {
            "leaderboard": leaderboard,
            "total_won_value": sum(d["value"] for d in leaderboard),
            "total_deals": sum(d["deals_won"] for d in leaderboard)
        }
        
        await self._set_cache(cache_type, org_id, filter_hash, filters, data)
        
        return data
    
    async def build_pm_leaderboard(
        self,
        org_id: str,
        year: Optional[str] = None,
        quarter: Optional[str] = None,
        sales_rep: Optional[str] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        """Build product manager leaderboard cache"""
        filters = {"year": year, "quarter": quarter, "sales_rep": sales_rep}
        filter_hash = self._make_filter_hash(filters)
        cache_type = "pm_leaderboard"
        
        if not force:
            existing = await self._get_cache(cache_type, org_id, filter_hash)
            if existing:
                return existing["data"]
        
        logger.info(f"Building {cache_type} cache for org={org_id}")
        
        query = {"org_id": org_id}
        if sales_rep:
            query["owner_name"] = sales_rep
        
        opps = await self.canonical_db.opportunities.find(query).to_list(10000)
        opps = [o for o in opps if not is_test_record(o.get("name", ""))]
        
        # Filter Won and apply date filters using won_at
        won_opps = [o for o in opps if self._is_won(o)]
        if year or quarter:
            won_opps = self._apply_date_filters_won(won_opps, year, quarter)
        
        # Aggregate by PM
        pm_values = defaultdict(lambda: {"value": 0, "count": 0})
        
        for opp in won_opps:
            pm = opp.get("product_manager")
            if pm:
                pm_values[pm]["value"] += opp.get("sale_value", 0) or 0
                pm_values[pm]["count"] += 1
        
        leaderboard = [
            {"name": pm, "value": data["value"], "deals_won": data["count"]}
            for pm, data in sorted(pm_values.items(), key=lambda x: x[1]["value"], reverse=True)
        ][:10]
        
        if not leaderboard:
            leaderboard = [{"name": "No Product Manager data", "value": 0, "deals_won": 0}]
        
        data = {
            "leaderboard": leaderboard,
            "total_won_value": sum(d["value"] for d in leaderboard),
            "total_deals": sum(d["deals_won"] for d in leaderboard),
            "filters": filters
        }
        
        await self._set_cache(cache_type, org_id, filter_hash, filters, data)
        
        return data
    
    async def build_all_caches(
        self,
        org_id: str,
        year: Optional[str] = None,
        quarter: Optional[str] = None,
        force: bool = False
    ):
        """Build all cache types for an organization"""
        logger.info(f"Building all caches for org={org_id}")
        
        await asyncio.gather(
            self.build_dashboard_kpis(org_id, year, quarter, force=force),
            self.build_account_overdue(org_id, force=force),
            self.build_sales_leaderboard(org_id, year, quarter, force=force),
            self.build_pm_leaderboard(org_id, year, quarter, force=force),
        )
        
        logger.info(f"All caches built for org={org_id}")
    
    async def invalidate_cache(
        self,
        cache_type: Optional[str] = None,
        org_id: Optional[str] = None
    ):
        """Invalidate cache entries"""
        query = {}
        if cache_type:
            query["cache_type"] = cache_type
        if org_id:
            query["org_id"] = org_id
        
        result = await self.app_db.serving_cache.delete_many(query)
        logger.info(f"Invalidated {result.deleted_count} cache entries")
    
    # ==================== HELPER METHODS ====================
    
    def _compute_kpis(self, opps: List[Dict]) -> Dict[str, Any]:
        """Compute dashboard KPIs from opportunities"""
        total_pipeline = 0
        open_count = 0
        won_count = 0
        won_value = 0
        lost_count = 0
        stages = defaultdict(lambda: {"count": 0, "value": 0})
        
        for opp in opps:
            stage = self._normalize_stage(opp)
            value = opp.get("sale_value", 0) or 0
            
            stages[stage]["count"] += 1
            stages[stage]["value"] += value
            
            if stage == "closed_won":
                won_count += 1
                won_value += value
            elif stage == "closed_lost":
                lost_count += 1
            else:
                open_count += 1
                total_pipeline += value
        
        # Calculate win rate
        closed_deals = won_count + lost_count
        win_rate = (won_count / closed_deals * 100) if closed_deals > 0 else 0
        
        return {
            "total_pipeline": total_pipeline,
            "open_count": open_count,
            "won_count": won_count,
            "won_value": won_value,
            "lost_count": lost_count,
            "win_rate": round(win_rate, 1),
            "stages": dict(stages),
            "total_opportunities": len(opps)
        }
    
    def _normalize_stage(self, opp: Dict) -> str:
        """Normalize opportunity stage"""
        stage = (opp.get("stage") or "").lower().strip()
        active = opp.get("active", True)
        if str(active).lower() == 'false':
            active = False
        lost_reason = opp.get("lost_reason_id") or opp.get("lost_reason")
        
        if stage in ["won", "closed_won"]:
            return "closed_won"
        if stage in ["lost", "closed_lost"] or lost_reason or not active:
            return "closed_lost"
        
        stage_map = {
            "new": "new",
            "qualification": "qualified",
            "qualified": "qualified",
            "proposition": "proposal",
            "proposal": "proposal",
            "negotiation": "negotiation",
        }
        return stage_map.get(stage, "qualified")
    
    def _is_won(self, opp: Dict) -> bool:
        """Check if opportunity is Won"""
        stage = (opp.get("stage") or "").lower()
        return stage in ["won", "closed_won"]
    
    def _apply_date_filters(self, opps: List[Dict], year: str = None, quarter: str = None) -> List[Dict]:
        """Apply date filters based on create_date"""
        if not year and not quarter:
            return opps
        
        quarter_months = {
            "Q1": [1, 2, 3], "Q2": [4, 5, 6],
            "Q3": [7, 8, 9], "Q4": [10, 11, 12]
        }
        
        filtered = []
        for opp in opps:
            date_str = opp.get("create_date") or opp.get("created_at")
            if not date_str:
                continue
            
            try:
                if isinstance(date_str, str):
                    dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                else:
                    dt = date_str
                
                if year and str(dt.year) != str(year):
                    continue
                if quarter and dt.month not in quarter_months.get(quarter, []):
                    continue
                
                filtered.append(opp)
            except (ValueError, AttributeError):
                continue
        
        return filtered
    
    def _apply_date_filters_won(self, opps: List[Dict], year: str = None, quarter: str = None) -> List[Dict]:
        """Apply date filters based on won_at date"""
        if not year and not quarter:
            return opps
        
        quarter_months = {
            "Q1": [1, 2, 3], "Q2": [4, 5, 6],
            "Q3": [7, 8, 9], "Q4": [10, 11, 12]
        }
        
        filtered = []
        for opp in opps:
            won_at = opp.get("won_at")
            if not won_at:
                continue
            
            try:
                if isinstance(won_at, str):
                    dt = datetime.fromisoformat(won_at.replace('Z', '+00:00'))
                else:
                    dt = won_at
                
                if year and str(dt.year) != str(year):
                    continue
                if quarter and dt.month not in quarter_months.get(quarter, []):
                    continue
                
                filtered.append(opp)
            except:
                continue
        
        return filtered
    
    async def _get_cache(self, cache_type: str, org_id: str, filter_hash: str) -> Optional[Dict]:
        """Get cache entry if not expired"""
        now = datetime.now(timezone.utc)
        entry = await self.app_db.serving_cache.find_one({
            "cache_type": cache_type,
            "org_id": org_id,
            "filter_hash": filter_hash,
            "expires_at": {"$gt": now}
        })
        return entry
    
    async def _set_cache(self, cache_type: str, org_id: str, filter_hash: str, filters: Dict, data: Dict):
        """Set cache entry"""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=self.cache_ttl_seconds)
        
        await self.app_db.serving_cache.update_one(
            {
                "cache_type": cache_type,
                "org_id": org_id,
                "filter_hash": filter_hash
            },
            {
                "$set": {
                    "cache_type": cache_type,
                    "org_id": org_id,
                    "filter_hash": filter_hash,
                    "filters": filters,
                    "data": data,
                    "computed_at": now,
                    "expires_at": expires_at,
                    "version": self.version
                }
            },
            upsert=True
        )


# Global singleton
cache_builder = CacheBuilder()
