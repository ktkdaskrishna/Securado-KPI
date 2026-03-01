"""Redis Data Pipeline - Central message bus and cache for all CRM data.

Redis is OPTIONAL. When unavailable, all operations are silently skipped
and the query engine falls back to direct MongoDB queries.
"""
import json
import logging
import os
from datetime import datetime
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Redis connection - completely optional
_redis = None
_redis_available = None  # None=untested, True=connected, False=unavailable
_redis_error_logged = False  # Log connection failure only once

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")


async def get_redis():
    """Get async Redis connection. Returns None if Redis unavailable."""
    global _redis, _redis_available, _redis_error_logged
    
    if _redis_available is False:
        return None  # Already know Redis is down — skip silently
    
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            _redis = aioredis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
            await _redis.ping()
            _redis_available = True
            logger.info("Redis connected successfully")
        except Exception:
            _redis_available = False
            _redis = None
            if not _redis_error_logged:
                logger.warning("Redis unavailable — running without cache (MongoDB fallback)")
                _redis_error_logged = True
            return None
    return _redis


async def close_redis():
    """Close Redis connection"""
    global _redis, _redis_available
    if _redis:
        try:
            await _redis.close()
        except Exception:
            pass
        _redis = None
    _redis_available = None


# ==================== STREAM PUBLISHING ====================

async def publish_event(stream: str, data: dict):
    """Publish an event to a Redis stream. Silently skips if Redis unavailable."""
    r = await get_redis()
    if not r:
        return
    flat = {}
    for k, v in data.items():
        if v is not None:
            flat[k] = json.dumps(v) if isinstance(v, (dict, list)) else str(v)
    try:
        await r.xadd(stream, flat, maxlen=10000)
    except Exception:
        pass


async def publish_sync_event(entity: str, action: str, record_id: str, data: dict = None):
    """Publish a sync event (record created/updated/deleted)"""
    await publish_event(f"stream:{entity}", {
        "action": action,
        "record_id": record_id,
        "timestamp": datetime.utcnow().isoformat(),
        **(data or {})
    })


# ==================== CACHE ====================

async def cache_set(key: str, data: dict, ttl: int = 300):
    """Set cache with TTL. Silently skips if Redis unavailable."""
    r = await get_redis()
    if not r:
        return
    try:
        await r.setex(key, ttl, json.dumps(data, default=str))
    except Exception:
        pass


async def cache_get(key: str) -> Optional[dict]:
    """Get from cache. Returns None if Redis unavailable."""
    r = await get_redis()
    if not r:
        return None
    try:
        val = await r.get(key)
        if val:
            return json.loads(val)
    except Exception:
        pass
    return None


async def cache_delete(pattern: str):
    """Delete cache keys matching pattern. Silently skips if Redis unavailable."""
    r = await get_redis()
    if not r:
        return
    try:
        keys = []
        async for key in r.scan_iter(pattern):
            keys.append(key)
        if keys:
            await r.delete(*keys)
    except Exception:
        pass


async def invalidate_dashboard_cache():
    """Invalidate all dashboard/analytics caches"""
    await cache_delete("cache:dashboard:*")
    await cache_delete("cache:analytics:*")
    await cache_delete("cache:query:*")


# ==================== QUERY ENGINE ====================

async def execute_query(query_config: dict) -> dict:
    """Execute a dashboard query - reads from Redis cache with MongoDB fallback.
    
    query_config:
        collection: str (opportunities, accounts, invoices, etc.)
        aggregation: str (count, sum, avg, min, max)
        field: str (field to aggregate)
        filters: dict (MongoDB-style filters)
        group_by: str (optional group by field)
        year: str (optional year filter)
        cache_ttl: int (cache TTL in seconds, default 60)
        rbac_filter: dict (optional RBAC scope filter from hierarchy)
    """
    from libs.database import get_canonical_db, get_app_db
    
    # Build cache key from query config
    cache_key = f"cache:query:{json.dumps(query_config, sort_keys=True, default=str)}"
    
    # Check cache first
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    # Execute against MongoDB
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    collection = query_config.get("collection", "opportunities")
    aggregation = query_config.get("aggregation", "count")
    field = query_config.get("field", "")
    filters = query_config.get("filters", {})
    group_by = query_config.get("group_by")
    year = query_config.get("year")
    rbac_filter = query_config.get("rbac_filter")
    
    # Build MongoDB query
    query = {"deleted": {"$ne": True}, "active": True}
    query.update(filters)
    
    # Apply RBAC scope filter (hierarchy-based)
    if rbac_filter:
        for k, v in rbac_filter.items():
            if k == "$or":
                query.setdefault("$and", []).append({"$or": v})
            else:
                query[k] = v
    
    # Year filter — Odoo uses date_last_stage_update for ALL dashboard filtering
    # This matches how Odoo's dashboard works: showing records active/updated in that year
    if year:
        if collection == "opportunities":
            query["date_last_stage_update"] = {"$regex": f"^{year}"}
        elif collection == "invoices":
            query["invoice_date"] = {"$regex": f"^{year}"}
        elif collection == "activities":
            query["date_deadline"] = {"$regex": f"^{year}"}
        else:
            query["create_date"] = {"$regex": f"^{year}"}
    
    # Determine which DB to use
    db = canonical_db
    if collection in ["target_plans", "target_plan_items", "users", "roles"]:
        db = app_db
    
    result = {}
    
    if group_by:
        # Grouped aggregation
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": f"${group_by}",
                "count": {"$sum": 1},
            }}
        ]
        if aggregation == "sum" and field:
            pipeline[1]["$group"]["total"] = {"$sum": {"$ifNull": [f"${field}", 0]}}
        elif aggregation == "avg" and field:
            pipeline[1]["$group"]["avg"] = {"$avg": {"$ifNull": [f"${field}", 0]}}
        
        # Sort by the relevant field (total for sum, avg for avg, count for count)
        raw_sort = query_config.get("sort_by")
        sort_field = raw_sort if raw_sort else ("total" if aggregation == "sum" and field else "avg" if aggregation == "avg" and field else "count")
        sort_order = -1 if query_config.get("sort_order", "desc") == "desc" else 1
        pipeline.append({"$sort": {sort_field: sort_order}})
        pipeline.append({"$limit": 50})
        
        groups = await db[collection].aggregate(pipeline).to_list(50)
        result = {
            "type": "grouped",
            "groups": [{"label": g["_id"], "count": g["count"], "total": g.get("total", 0), "avg": g.get("avg", 0)} for g in groups],
            "total_groups": len(groups)
        }
    else:
        # Simple aggregation
        if aggregation == "count":
            count = await db[collection].count_documents(query)
            result = {"type": "scalar", "value": count, "label": "Count"}
        elif aggregation == "sum" and field:
            pipeline = [
                {"$match": query},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": [f"${field}", 0]}}, "count": {"$sum": 1}}}
            ]
            agg = await db[collection].aggregate(pipeline).to_list(1)
            result = {"type": "scalar", "value": agg[0]["total"] if agg else 0, "count": agg[0]["count"] if agg else 0, "label": f"Sum of {field}"}
        elif aggregation == "avg" and field:
            pipeline = [
                {"$match": query},
                {"$group": {"_id": None, "avg": {"$avg": {"$ifNull": [f"${field}", 0]}}, "count": {"$sum": 1}}}
            ]
            agg = await db[collection].aggregate(pipeline).to_list(1)
            result = {"type": "scalar", "value": round(agg[0]["avg"], 2) if agg else 0, "count": agg[0]["count"] if agg else 0, "label": f"Avg of {field}"}
        elif aggregation == "list":
            records = await db[collection].find(query, {"_id": 0}).sort("create_date", -1).limit(100).to_list(100)
            from libs.utils import serialize_doc
            result = {"type": "list", "records": serialize_doc(records), "total": len(records)}
    
    # Cache result
    ttl = query_config.get("cache_ttl", 60)
    await cache_set(cache_key, result, ttl)
    
    return result


# ==================== HEALTH ====================

async def get_redis_health() -> dict:
    """Check Redis health and stats"""
    try:
        r = await get_redis()
        info = await r.info()
        return {
            "status": "connected",
            "version": info.get("redis_version"),
            "memory_used": info.get("used_memory_human"),
            "connected_clients": info.get("connected_clients"),
            "uptime_seconds": info.get("uptime_in_seconds"),
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
