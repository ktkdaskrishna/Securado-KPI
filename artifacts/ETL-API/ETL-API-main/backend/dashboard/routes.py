from fastapi import APIRouter, Depends
from auth.routes import get_current_user
from core.database import get_app_db
from core.canonical_adapter import CanonicalAdapter
from core.utils import serialize_doc
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get dashboard statistics from serving cache"""
    try:
        app_db = get_app_db()
        
        # Get serving cache stats
        stats = await app_db.serving_cache.find_one({
            "entity_type": "dashboard_stats",
            "org_id": current_user.get("org_id")
        })
        
        if stats:
            return serialize_doc(stats)
        
        # Return empty stats if not cached yet
        return {
            "entity_type": "dashboard_stats",
            "org_id": current_user.get("org_id"),
            "total_opportunities": 0,
            "stage_counts": {},
            "total_value": 0,
            "message": "No cached stats available. Trigger refresh to build cache."
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        return {
            "error": str(e),
            "total_opportunities": 0,
            "stage_counts": {},
            "total_value": 0
        }

@router.post("/refresh")
async def refresh_dashboard(
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger serving cache rebuild"""
    try:
        from scheduler.jobs import rebuild_serving_cache
        
        # Run rebuild for this org
        await rebuild_serving_cache(org_id=current_user.get("org_id"))
        
        return {
            "success": True,
            "message": "Serving cache refresh triggered",
            "org_id": current_user.get("org_id")
        }
    except Exception as e:
        logger.error(f"Error refreshing dashboard: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@router.get("/sync-status")
async def get_sync_status(
    current_user: dict = Depends(get_current_user)
):
    """Get sync status based on canonical data freshness"""
    try:
        # Get latest update from canonical
        canonical_records = await CanonicalAdapter.get_canonical_records(
            entity_type="opportunities",
            org_id=current_user.get("org_id"),
            limit=1
        )
        
        last_canonical_update = None
        if canonical_records:
            last_canonical_update = canonical_records[0].updated_at
        
        # Get last serving cache update
        app_db = get_app_db()
        cache_stats = await app_db.serving_cache.find_one(
            {"entity_type": "dashboard_stats", "org_id": current_user.get("org_id")},
            sort=[("updated_at", -1)]
        )
        
        last_cache_update = cache_stats.get("updated_at") if cache_stats else None
        
        return {
            "last_canonical_update": last_canonical_update.isoformat() if last_canonical_update else None,
            "last_cache_update": last_cache_update.isoformat() if last_cache_update else None,
            "sync_needed": last_canonical_update > last_cache_update if (last_canonical_update and last_cache_update) else False
        }
    except Exception as e:
        logger.error(f"Error checking sync status: {e}")
        return {
            "error": str(e),
            "last_canonical_update": None,
            "last_cache_update": None,
            "sync_needed": False
        }
