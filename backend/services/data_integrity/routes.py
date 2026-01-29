"""Data Integrity Service - Deduplication, Reconciliation, Data Quality & Event Queue"""

import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from collections import defaultdict
import hashlib
import json

from libs.database import get_app_db, get_canonical_db
from services.identity.routes import get_current_user
from services.event_queue.queue_service import event_queue_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data-quality", tags=["data-quality"])


def compute_record_hash(record: dict, fields: List[str] = None) -> str:
    """Compute a hash of record fields for change detection"""
    if fields is None:
        # Default fields to hash for opportunities
        fields = ['name', 'stage', 'amount', 'sale_value', 'probability', 
                  'account_name', 'owner_name', 'close_date', 'updated_at']
    
    hash_data = {}
    for field in fields:
        value = record.get(field)
        if value is not None:
            hash_data[field] = str(value)
    
    hash_str = json.dumps(hash_data, sort_keys=True)
    return hashlib.md5(hash_str.encode()).hexdigest()


# ==================== DUPLICATE DETECTION ====================

@router.get("/duplicates/{collection}")
async def get_duplicates(
    collection: str,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Find duplicate records in a collection based on source_record_id
    """
    canonical_db = get_canonical_db()
    
    valid_collections = ['opportunities', 'activities', 'accounts', 'contacts']
    if collection not in valid_collections:
        raise HTTPException(status_code=400, detail=f"Invalid collection. Must be one of: {valid_collections}")
    
    coll = canonical_db[collection]
    
    # Find duplicates
    pipeline = [
        {"$match": {"source_record_id": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$source_record_id",
            "count": {"$sum": 1},
            "records": {"$push": {
                "id": "$_id",
                "canonical_id": "$canonical_id",
                "name": "$name",
                "updated_at": "$updated_at",
                "synced_at": "$synced_at"
            }}
        }},
        {"$match": {"count": {"$gt": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    duplicates = await coll.aggregate(pipeline).to_list(limit)
    
    # Calculate stats
    total_records = await coll.count_documents({})
    unique_records = len(await coll.distinct('source_record_id'))
    duplicate_count = total_records - unique_records
    
    return {
        "collection": collection,
        "total_records": total_records,
        "unique_source_ids": unique_records,
        "duplicate_count": duplicate_count,
        "duplicate_percentage": round((duplicate_count / total_records * 100) if total_records > 0 else 0, 2),
        "duplicate_groups": len(duplicates),
        "duplicates": duplicates
    }


@router.post("/duplicates/{collection}/cleanup")
async def cleanup_duplicates(
    collection: str,
    dry_run: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Remove duplicate records, keeping the most recently updated one.
    
    Args:
        collection: The collection to clean
        dry_run: If True, only report what would be deleted without actually deleting
    """
    canonical_db = get_canonical_db()
    
    valid_collections = ['opportunities', 'activities', 'accounts', 'contacts']
    if collection not in valid_collections:
        raise HTTPException(status_code=400, detail=f"Invalid collection. Must be one of: {valid_collections}")
    
    coll = canonical_db[collection]
    
    # Find all duplicates
    pipeline = [
        {"$match": {"source_record_id": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$source_record_id",
            "count": {"$sum": 1},
            "records": {"$push": {
                "id": "$_id",
                "canonical_id": "$canonical_id",
                "updated_at": {"$ifNull": ["$updated_at", "$synced_at"]},
            }}
        }},
        {"$match": {"count": {"$gt": 1}}}
    ]
    
    duplicates = await coll.aggregate(pipeline).to_list(None)
    
    ids_to_delete = []
    kept_records = []
    
    for dup_group in duplicates:
        records = dup_group['records']
        
        # Sort by updated_at descending, keep the most recent
        sorted_records = sorted(
            records, 
            key=lambda x: x.get('updated_at') or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True
        )
        
        # Keep the first (most recent), delete the rest
        kept_records.append({
            "source_record_id": dup_group['_id'],
            "kept_id": str(sorted_records[0]['id']),
            "deleted_count": len(sorted_records) - 1
        })
        
        for record in sorted_records[1:]:
            ids_to_delete.append(record['id'])
    
    deleted_count = 0
    if not dry_run and ids_to_delete:
        result = await coll.delete_many({"_id": {"$in": ids_to_delete}})
        deleted_count = result.deleted_count
        logger.info(f"Cleaned up {deleted_count} duplicate records from {collection}")
    
    return {
        "collection": collection,
        "dry_run": dry_run,
        "duplicates_found": len(duplicates),
        "records_to_delete": len(ids_to_delete),
        "records_deleted": deleted_count,
        "cleanup_details": kept_records[:50]  # Limit response size
    }


# ==================== DATA RECONCILIATION ====================

@router.get("/reconciliation/summary")
async def get_reconciliation_summary(
    current_user: dict = Depends(get_current_user)
):
    """
    Get a summary of data quality across all collections
    """
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    collections = ['opportunities', 'activities', 'accounts', 'contacts']
    summary = []
    
    for coll_name in collections:
        coll = canonical_db[coll_name]
        
        total = await coll.count_documents({})
        unique = len(await coll.distinct('source_record_id'))
        duplicates = total - unique
        
        # Get last sync time
        last_synced = await coll.find_one(
            {"synced_at": {"$exists": True}},
            sort=[("synced_at", -1)]
        )
        last_sync_time = last_synced.get('synced_at') if last_synced else None
        
        summary.append({
            "collection": coll_name,
            "total_records": total,
            "unique_records": unique,
            "duplicate_count": duplicates,
            "duplicate_percentage": round((duplicates / total * 100) if total > 0 else 0, 2),
            "last_synced": str(last_sync_time) if last_sync_time else None,
            "health": "healthy" if duplicates == 0 else ("warning" if duplicates < total * 0.1 else "critical")
        })
    
    # Overall health
    total_duplicates = sum(s['duplicate_count'] for s in summary)
    total_records = sum(s['total_records'] for s in summary)
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_health": "healthy" if total_duplicates == 0 else ("warning" if total_duplicates < total_records * 0.1 else "critical"),
        "total_records": total_records,
        "total_duplicates": total_duplicates,
        "collections": summary
    }


@router.get("/reconciliation/compare/{collection}")
async def compare_with_source(
    collection: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Compare record counts between canonical DB and what we expect from source
    Note: This requires source connection to be available
    """
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    coll = canonical_db[collection]
    
    # Get counts by stage/type
    if collection == 'opportunities':
        pipeline = [
            {"$group": {
                "_id": "$stage",
                "count": {"$sum": 1},
                "total_value": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}}
            }},
            {"$sort": {"count": -1}}
        ]
    elif collection == 'activities':
        pipeline = [
            {"$group": {
                "_id": "$activity_type",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}}
        ]
    else:
        pipeline = [
            {"$group": {
                "_id": None,
                "count": {"$sum": 1}
            }}
        ]
    
    breakdown = await coll.aggregate(pipeline).to_list(None)
    
    # Get unique vs total
    total = await coll.count_documents({})
    unique = len(await coll.distinct('source_record_id'))
    
    return {
        "collection": collection,
        "total_records": total,
        "unique_source_ids": unique,
        "duplicates": total - unique,
        "breakdown": breakdown
    }


# ==================== INDEX MANAGEMENT ====================

@router.post("/indexes/enforce-unique")
async def enforce_unique_indexes(
    dry_run: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Create unique compound indexes to prevent future duplicates.
    Must clean duplicates first!
    """
    canonical_db = get_canonical_db()
    
    collections = ['opportunities', 'activities', 'accounts', 'contacts']
    results = []
    
    for coll_name in collections:
        coll = canonical_db[coll_name]
        
        # Check for existing duplicates
        total = await coll.count_documents({})
        unique = len(await coll.distinct('source_record_id'))
        has_duplicates = total > unique
        
        if has_duplicates and not dry_run:
            results.append({
                "collection": coll_name,
                "status": "skipped",
                "reason": f"Has {total - unique} duplicates. Clean them first.",
                "index_created": False
            })
            continue
        
        if dry_run:
            results.append({
                "collection": coll_name,
                "status": "would_create" if not has_duplicates else "blocked",
                "has_duplicates": has_duplicates,
                "duplicate_count": total - unique,
                "index_created": False
            })
        else:
            try:
                # Drop existing non-unique index if exists
                try:
                    await coll.drop_index("source_record_id_1")
                except:
                    pass
                
                # Create unique compound index
                await coll.create_index(
                    [("source_record_id", 1), ("org_id", 1)],
                    unique=True,
                    sparse=True,  # Allow null values
                    name="source_record_id_org_unique"
                )
                
                results.append({
                    "collection": coll_name,
                    "status": "success",
                    "index_created": True
                })
                logger.info(f"Created unique index on {coll_name}")
            except Exception as e:
                results.append({
                    "collection": coll_name,
                    "status": "error",
                    "error": str(e),
                    "index_created": False
                })
    
    return {
        "dry_run": dry_run,
        "results": results
    }


# ==================== FULL CLEANUP WORKFLOW ====================

@router.post("/cleanup/full")
async def full_data_cleanup(
    background_tasks: BackgroundTasks,
    dry_run: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Run full data cleanup workflow:
    1. Identify all duplicates
    2. Remove duplicates (keep most recent)
    3. Create unique indexes
    """
    canonical_db = get_canonical_db()
    
    collections = ['opportunities', 'activities', 'accounts', 'contacts']
    results = {
        "dry_run": dry_run,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "collections": {}
    }
    
    for coll_name in collections:
        coll = canonical_db[coll_name]
        
        # Step 1: Find duplicates
        pipeline = [
            {"$match": {"source_record_id": {"$exists": True, "$ne": None}}},
            {"$group": {
                "_id": "$source_record_id",
                "count": {"$sum": 1},
                "records": {"$push": {
                    "id": "$_id",
                    "updated_at": {"$ifNull": ["$updated_at", "$synced_at"]}
                }}
            }},
            {"$match": {"count": {"$gt": 1}}}
        ]
        
        duplicates = await coll.aggregate(pipeline).to_list(None)
        
        # Step 2: Identify records to delete
        ids_to_delete = []
        for dup_group in duplicates:
            records = dup_group['records']
            sorted_records = sorted(
                records,
                key=lambda x: x.get('updated_at') or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True
            )
            for record in sorted_records[1:]:
                ids_to_delete.append(record['id'])
        
        # Step 3: Delete if not dry run
        deleted_count = 0
        if not dry_run and ids_to_delete:
            result = await coll.delete_many({"_id": {"$in": ids_to_delete}})
            deleted_count = result.deleted_count
        
        # Step 4: Create unique index if no more duplicates
        index_created = False
        if not dry_run and deleted_count == len(ids_to_delete):
            try:
                try:
                    await coll.drop_index("source_record_id_1")
                except:
                    pass
                
                await coll.create_index(
                    [("source_record_id", 1), ("org_id", 1)],
                    unique=True,
                    sparse=True,
                    name="source_record_id_org_unique"
                )
                index_created = True
            except Exception as e:
                logger.error(f"Failed to create unique index on {coll_name}: {e}")
        
        before_count = await coll.count_documents({}) + (deleted_count if not dry_run else 0)
        after_count = await coll.count_documents({})
        
        results["collections"][coll_name] = {
            "duplicates_found": len(duplicates),
            "records_to_delete": len(ids_to_delete),
            "records_deleted": deleted_count,
            "before_count": before_count if dry_run else before_count,
            "after_count": after_count if not dry_run else before_count - len(ids_to_delete),
            "unique_index_created": index_created
        }
    
    # Calculate totals
    total_duplicates = sum(c['records_to_delete'] for c in results["collections"].values())
    total_deleted = sum(c['records_deleted'] for c in results["collections"].values())
    
    results["summary"] = {
        "total_duplicates_found": total_duplicates,
        "total_records_deleted": total_deleted,
        "status": "completed" if not dry_run else "dry_run_complete"
    }
    
    if not dry_run:
        logger.info(f"Full data cleanup completed: {total_deleted} duplicates removed")
    
    return results
