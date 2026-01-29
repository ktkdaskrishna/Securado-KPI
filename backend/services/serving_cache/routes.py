"""Serving Cache API Routes

Provides endpoints for:
- Reading cached data (single source of truth)
- Manually triggering cache refresh
- Cache statistics and health
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
import logging
from datetime import datetime, timezone

from libs.database import get_app_db
from services.identity.routes import get_current_user
from .cache_builder import cache_builder
from .cache_reader import cache_reader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cache", tags=["cache"])


@router.get("/dashboard-kpis")
async def get_cached_dashboard_kpis(
    year: Optional[str] = Query(None),
    quarter: Optional[str] = Query(None),
    sales_rep: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get dashboard KPIs from cache (single source of truth)"""
    org_id = current_user.get("org_id", "default")
    return await cache_reader.get_dashboard_kpis(org_id, year, quarter, sales_rep)


@router.get("/account-overdue")
async def get_cached_account_overdue(
    account_id: Optional[str] = Query(None),
    account_name: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get account overdue data from cache"""
    org_id = current_user.get("org_id", "default")
    return await cache_reader.get_account_overdue(org_id, account_id, account_name)


@router.get("/sales-leaderboard")
async def get_cached_sales_leaderboard(
    year: Optional[str] = Query(None),
    quarter: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get sales leaderboard from cache"""
    org_id = current_user.get("org_id", "default")
    return await cache_reader.get_sales_leaderboard(org_id, year, quarter)


@router.get("/pm-leaderboard")
async def get_cached_pm_leaderboard(
    year: Optional[str] = Query(None),
    quarter: Optional[str] = Query(None),
    sales_rep: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get product manager leaderboard from cache"""
    org_id = current_user.get("org_id", "default")
    return await cache_reader.get_pm_leaderboard(org_id, year, quarter, sales_rep)


@router.post("/refresh")
async def refresh_cache(
    cache_type: Optional[str] = Query(None, description="Specific cache type to refresh, or all if not specified"),
    year: Optional[str] = Query(None),
    quarter: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger cache refresh"""
    org_id = current_user.get("org_id", "default")
    
    if cache_type:
        # Refresh specific cache
        if cache_type == "dashboard_kpis":
            await cache_builder.build_dashboard_kpis(org_id, year, quarter, force=True)
        elif cache_type == "account_overdue":
            await cache_builder.build_account_overdue(org_id, force=True)
        elif cache_type == "sales_leaderboard":
            await cache_builder.build_sales_leaderboard(org_id, year, quarter, force=True)
        elif cache_type == "pm_leaderboard":
            await cache_builder.build_pm_leaderboard(org_id, year, quarter, force=True)
        else:
            return {"status": "error", "message": f"Unknown cache type: {cache_type}"}
    else:
        # Refresh all caches
        await cache_builder.build_all_caches(org_id, year, quarter, force=True)
    
    return {
        "status": "success",
        "message": f"Cache refreshed for {cache_type or 'all'}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/invalidate")
async def invalidate_cache(
    cache_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Invalidate cache entries"""
    org_id = current_user.get("org_id", "default")
    await cache_builder.invalidate_cache(cache_type, org_id)
    return {
        "status": "success",
        "message": f"Cache invalidated for {cache_type or 'all'}"
    }


@router.get("/stats")
async def get_cache_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get cache statistics"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Count cache entries by type
    pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {
            "_id": "$cache_type",
            "count": {"$sum": 1},
            "latest": {"$max": "$computed_at"}
        }}
    ]
    
    stats_by_type = {}
    async for doc in app_db.serving_cache.aggregate(pipeline):
        stats_by_type[doc["_id"]] = {
            "entries": doc["count"],
            "latest_update": doc["latest"].isoformat() if doc["latest"] else None
        }
    
    total_entries = sum(s["entries"] for s in stats_by_type.values())
    
    return {
        "org_id": org_id,
        "total_entries": total_entries,
        "by_type": stats_by_type,
        "cache_ttl_seconds": cache_builder.cache_ttl_seconds,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
