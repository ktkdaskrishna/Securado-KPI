"""Canonical Query Service Routes - Browse and Search Canonical Data

Handles:
- List/filter canonical records by entity type
- Search across entities
- Pagination and sorting
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
import logging
import re

from libs.database import get_canonical_db, get_app_db
from libs.utils import serialize_doc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data-lake", tags=["data-lake"])
search_router = APIRouter(tags=["search"])


@router.get("/canonical")
async def list_canonical_records(
    entity: str = Query("opportunities", description="Entity type: opportunities, accounts, contacts, users"),
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    stage: Optional[str] = None,
    source_system: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List canonical records with optional filtering"""
    canonical_db = get_canonical_db()
    
    # Build query
    query = {"org_id": current_user["org_id"]}
    if stage:
        query["stage"] = stage
    if source_system:
        query["source_system"] = source_system
    
    # Get collection
    collection = canonical_db[entity]
    
    # Execute query
    records = await collection.find(query).skip(skip).limit(limit).to_list(limit)
    total = await collection.count_documents(query)
    
    return {
        "entity_type": entity,
        "total": total,
        "skip": skip,
        "limit": limit,
        "records": serialize_doc(records)
    }


@router.get("/canonical/{entity}/{canonical_id}")
async def get_canonical_record(
    entity: str,
    canonical_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single canonical record"""
    canonical_db = get_canonical_db()
    
    collection = canonical_db[entity]
    record = await collection.find_one({
        "canonical_id": canonical_id,
        "org_id": current_user["org_id"]
    })
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return serialize_doc(record)


@router.get("/serving")
async def get_serving_data(
    entity: str = Query("opportunities"),
    current_user: dict = Depends(get_current_user)
):
    """Get serving layer data (canonical + overrides merged)"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    # Get canonical records
    collection = canonical_db[f"{entity}s" if not entity.endswith('s') else entity]
    records = await collection.find({"org_id": current_user["org_id"]}).to_list(1000)
    
    # Get overrides
    canonical_ids = [r.get("canonical_id") for r in records]
    overrides = await app_db.overrides.find({
        "canonical_id": {"$in": canonical_ids},
        "org_id": current_user["org_id"]
    }).to_list(1000)
    
    # Create override map
    override_map = {o["canonical_id"]: o for o in overrides}
    
    # Merge
    merged = []
    for record in records:
        merged_record = serialize_doc(record)
        override = override_map.get(record.get("canonical_id"))
        if override:
            # Apply overrides
            for key in ["stage", "probability", "owner"]:
                if key in override:
                    merged_record[key] = override[key]
            merged_record["has_overrides"] = True
        else:
            merged_record["has_overrides"] = False
        merged.append(merged_record)
    
    return {"records": merged}


@search_router.get("/search")
async def search(
    q: str = Query("", min_length=0),
    entity_types: Optional[str] = None,  # comma-separated
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Search across canonical entities"""
    if len(q) < 2:
        return []
    
    canonical_db = get_canonical_db()
    results = []
    
    # Determine which entities to search
    if entity_types:
        entities = [e.strip() for e in entity_types.split(",")]
    else:
        entities = ["opportunities", "accounts", "contacts"]
    
    # Search each entity
    for entity in entities:
        collection = canonical_db[entity]
        
        # Build regex search
        regex = {"$regex": re.escape(q), "$options": "i"}
        
        # Search on common fields
        query = {
            "org_id": current_user["org_id"],
            "$or": [
                {"name": regex},
                {"contact_email": regex},
                {"account_name": regex},
                {"owner_name": regex}
            ]
        }
        
        records = await collection.find(query).limit(limit // len(entities)).to_list(limit)
        
        for r in records:
            doc = serialize_doc(r)
            doc["_type"] = entity
            doc["entity_type"] = entity
            results.append(doc)
    
    return results[:limit]


@router.get("/stats")
async def get_data_lake_stats(current_user: dict = Depends(get_current_user)):
    """Get statistics about canonical data"""
    canonical_db = get_canonical_db()
    
    stats = {}
    for entity in ["opportunities", "accounts", "contacts", "users"]:
        collection = canonical_db[entity]
        count = await collection.count_documents({"org_id": current_user["org_id"]})
        stats[entity] = count
    
    return {
        "org_id": current_user["org_id"],
        "entity_counts": stats,
        "total_records": sum(stats.values())
    }
