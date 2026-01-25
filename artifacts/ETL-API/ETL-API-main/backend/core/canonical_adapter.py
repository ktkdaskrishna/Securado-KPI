from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from core.config import settings
from core.database import get_canonical_db
import logging

logger = logging.getLogger(__name__)

class NormalizedCanonical(BaseModel):
    """Normalized canonical record structure"""
    entity_type: str
    canonical_id: str
    data: Dict[str, Any]
    updated_at: Optional[datetime] = None
    source_refs: Optional[List[Dict[str, Any]]] = None
    org_id: Optional[str] = None

class CanonicalAdapter:
    """Adapter to normalize both canonical layouts"""
    
    @staticmethod
    def normalize_envelope(doc: Dict[str, Any]) -> NormalizedCanonical:
        """Normalize envelope-style document"""
        return NormalizedCanonical(
            entity_type=doc.get("entity_name") or doc.get("entity_type", "unknown"),
            canonical_id=doc.get("record_id") or doc.get("canonical_id", ""),
            data=doc.get("data", {}),
            updated_at=doc.get("updated_at"),
            source_refs=doc.get("source_refs", []),
            org_id=doc.get("org_id")
        )
    
    @staticmethod
    def normalize_flat(doc: Dict[str, Any], entity_type: str) -> NormalizedCanonical:
        """Normalize flat document from per-entity collection"""
        # Extract metadata fields
        canonical_id = doc.get("canonical_id") or doc.get("id") or doc.get("_id", "")
        updated_at = doc.get("updated_at")
        org_id = doc.get("org_id")
        source_refs = doc.get("source_refs", [])
        
        # Create data dict excluding metadata
        data = {k: v for k, v in doc.items() if k not in ["canonical_id", "id", "_id", "updated_at", "org_id", "source_refs"]}
        
        return NormalizedCanonical(
            entity_type=entity_type,
            canonical_id=str(canonical_id),
            data=data,
            updated_at=updated_at,
            source_refs=source_refs,
            org_id=org_id
        )
    
    @staticmethod
    async def get_canonical_records(
        entity_type: Optional[str] = None,
        org_id: Optional[str] = None,
        limit: int = 100,
        skip: int = 0,
        search: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[NormalizedCanonical]:
        """Fetch and normalize canonical records"""
        canonical_db = get_canonical_db()
        results = []
        
        try:
            if settings.CANONICAL_LAYOUT == "single_collection":
                # Single collection layout
                query = {}
                if entity_type:
                    query["$or"] = [{"entity_type": entity_type}, {"entity_name": entity_type}]
                if org_id:
                    query["org_id"] = org_id
                if search:
                    query["$text"] = {"$search": search}
                if filters:
                    query.update(filters)
                
                collection = canonical_db[settings.CANONICAL_COLLECTION]
                cursor = collection.find(query).skip(skip).limit(limit)
                
                async for doc in cursor:
                    try:
                        normalized = CanonicalAdapter.normalize_envelope(doc)
                        results.append(normalized)
                    except Exception as e:
                        logger.warning(f"Failed to normalize envelope doc: {e}")
            
            else:
                # Per-entity collection layout
                if entity_type:
                    collection_name = f"{settings.CANONICAL_ENTITY_COLLECTION_PREFIX}{entity_type}"
                    collection = canonical_db[collection_name]
                    
                    query = {}
                    if org_id:
                        query["org_id"] = org_id
                    if filters:
                        query.update(filters)
                    
                    cursor = collection.find(query).skip(skip).limit(limit)
                    
                    async for doc in cursor:
                        try:
                            normalized = CanonicalAdapter.normalize_flat(doc, entity_type)
                            results.append(normalized)
                        except Exception as e:
                            logger.warning(f"Failed to normalize flat doc: {e}")
        
        except Exception as e:
            logger.error(f"Error fetching canonical records: {e}")
        
        return results
    
    @staticmethod
    async def get_canonical_by_id(canonical_id: str, entity_type: str, org_id: Optional[str] = None) -> Optional[NormalizedCanonical]:
        """Get single canonical record by ID"""
        canonical_db = get_canonical_db()
        
        try:
            if settings.CANONICAL_LAYOUT == "single_collection":
                query = {
                    "$or": [
                        {"canonical_id": canonical_id},
                        {"record_id": canonical_id}
                    ]
                }
                if org_id:
                    query["org_id"] = org_id
                
                collection = canonical_db[settings.CANONICAL_COLLECTION]
                doc = await collection.find_one(query)
                
                if doc:
                    return CanonicalAdapter.normalize_envelope(doc)
            
            else:
                collection_name = f"{settings.CANONICAL_ENTITY_COLLECTION_PREFIX}{entity_type}"
                collection = canonical_db[collection_name]
                
                query = {
                    "$or": [
                        {"canonical_id": canonical_id},
                        {"id": canonical_id}
                    ]
                }
                if org_id:
                    query["org_id"] = org_id
                
                doc = await collection.find_one(query)
                
                if doc:
                    return CanonicalAdapter.normalize_flat(doc, entity_type)
        
        except Exception as e:
            logger.error(f"Error fetching canonical by ID: {e}")
        
        return None
