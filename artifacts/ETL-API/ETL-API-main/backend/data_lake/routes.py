from fastapi import APIRouter, Query, Depends
from typing import Optional, List, Dict, Any
from core.canonical_adapter import CanonicalAdapter, NormalizedCanonical
from core.database import get_canonical_db, get_app_db
from auth.routes import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data-lake", tags=["data-lake"])

@router.get("/health")
async def health_check():
    """Check data lake connectivity"""
    try:
        canonical_db = get_canonical_db()
        # Ping the database
        await canonical_db.command("ping")
        
        return {
            "status": "healthy",
            "canonical_db": "connected",
            "message": "Data lake is accessible"
        }
    except Exception as e:
        logger.error(f"Data lake health check failed: {e}")
        return {
            "status": "unhealthy",
            "canonical_db": "disconnected",
            "error": str(e)
        }

@router.get("/canonical")
async def browse_canonical(
    entity_type: Optional[str] = Query(None, description="Entity type to filter"),
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Text search"),
    current_user: dict = Depends(get_current_user)
):
    """Browse canonical data from Platform 1"""
    try:
        records = await CanonicalAdapter.get_canonical_records(
            entity_type=entity_type,
            org_id=current_user.get("org_id"),
            limit=limit,
            skip=skip,
            search=search
        )
        
        return {
            "success": True,
            "count": len(records),
            "records": [r.model_dump() for r in records]
        }
    except Exception as e:
        logger.error(f"Error browsing canonical data: {e}")
        return {
            "success": False,
            "error": str(e),
            "records": []
        }

@router.get("/serving/{entity_type}")
async def get_serving_data(
    entity_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Get serving cache data for entity type"""
    try:
        app_db = get_app_db()
        
        serving_data = await app_db.serving_cache.find({
            "entity_type": entity_type,
            "org_id": current_user.get("org_id")
        }).to_list(100)
        
        from core.utils import serialize_doc
        return {
            "success": True,
            "entity_type": entity_type,
            "data": [serialize_doc(d) for d in serving_data]
        }
    except Exception as e:
        logger.error(f"Error fetching serving data: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": []
        }

@router.get("/serving")
async def list_serving_entities(
    current_user: dict = Depends(get_current_user)
):
    """List all entity types in serving cache"""
    try:
        app_db = get_app_db()
        
        entity_types = await app_db.serving_cache.distinct(
            "entity_type",
            {"org_id": current_user.get("org_id")}
        )
        
        return {
            "success": True,
            "entity_types": entity_types
        }
    except Exception as e:
        logger.error(f"Error listing serving entities: {e}")
        return {
            "success": False,
            "error": str(e),
            "entity_types": []
        }
