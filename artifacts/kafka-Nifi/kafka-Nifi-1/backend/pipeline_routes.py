"""Pipeline Routes - Manage and run data pipelines"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime, timezone
import xmlrpc.client
import jwt
import asyncio
import json

router = APIRouter(prefix="/api", tags=["pipelines"])
security = HTTPBearer(auto_error=False)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'esip_db')]

JWT_SECRET = os.environ.get('JWT_SECRET', 'esip-pipeline-secret-key')
JWT_ALGORITHM = 'HS256'

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_doc(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if k == '_id':
                result['id'] = str(v)
            elif isinstance(v, datetime):
                result[k] = v.isoformat()
            elif isinstance(v, dict):
                result[k] = serialize_doc(v)
            elif isinstance(v, list):
                result[k] = serialize_doc(v)
            else:
                result[k] = v
        return result
    return doc

# ==================== MAPPING ROUTES ====================

class MappingCreate(BaseModel):
    name: str
    connection_id: str
    source_model: str
    target_entity: str = "opportunity"
    mappings: List[Dict[str, Any]]  # [{source_field, target_field, transform}]

@router.post("/mappings")
async def create_mapping(mapping: MappingCreate, user: dict = Depends(get_current_user)):
    mapping_doc = {
        "id": str(uuid.uuid4()),
        "name": mapping.name,
        "connection_id": mapping.connection_id,
        "source_model": mapping.source_model,
        "target_entity": mapping.target_entity,
        "mappings": mapping.mappings,
        "version": 1,
        "status": "active",
        "created_by": user["sub"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    await db.mappings.insert_one(mapping_doc)
    return serialize_doc(mapping_doc)

@router.get("/mappings")
async def list_mappings(connection_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if connection_id:
        query["connection_id"] = connection_id
    mappings = await db.mappings.find(query).to_list(100)
    return serialize_doc(mappings)

@router.get("/mappings/{mapping_id}")
async def get_mapping(mapping_id: str, user: dict = Depends(get_current_user)):
    mapping = await db.mappings.find_one({"id": mapping_id})
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return serialize_doc(mapping)

@router.put("/mappings/{mapping_id}")
async def update_mapping(mapping_id: str, mapping: MappingCreate, user: dict = Depends(get_current_user)):
    existing = await db.mappings.find_one({"id": mapping_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    await db.mappings.update_one(
        {"id": mapping_id},
        {"$set": {
            "name": mapping.name,
            "source_model": mapping.source_model,
            "target_entity": mapping.target_entity,
            "mappings": mapping.mappings,
            "version": existing.get("version", 1) + 1,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    updated = await db.mappings.find_one({"id": mapping_id})
    return serialize_doc(updated)

@router.delete("/mappings/{mapping_id}")
async def delete_mapping(mapping_id: str, user: dict = Depends(get_current_user)):
    result = await db.mappings.delete_one({"id": mapping_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"status": "deleted"}

# ==================== PIPELINE ROUTES ====================

class PipelineCreate(BaseModel):
    name: str
    connection_id: str
    mapping_id: str
    extract_limit: int = 500
    # Target configuration
    target_id: Optional[str] = None  # Target connection ID
    target_table: Optional[str] = None  # Target table name
    # Scheduling
    schedule_enabled: bool = False
    schedule_type: Optional[str] = None  # manual, interval, cron
    interval_minutes: Optional[int] = 60
    cron_expression: Optional[str] = None
    # Webhook
    webhook_enabled: bool = False
    # Sync settings
    sync_mode: str = "full"  # full, incremental
    incremental_field: Optional[str] = "write_date"
    delete_mode: str = "soft"  # soft, hard, ignore

class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    extract_limit: Optional[int] = None
    target_id: Optional[str] = None
    target_table: Optional[str] = None
    schedule_enabled: Optional[bool] = None
    schedule_type: Optional[str] = None
    interval_minutes: Optional[int] = None
    cron_expression: Optional[str] = None
    webhook_enabled: Optional[bool] = None
    sync_mode: Optional[str] = None
    delete_mode: Optional[str] = None

@router.post("/pipelines")
async def create_pipeline(pipeline: PipelineCreate, user: dict = Depends(get_current_user)):
    pipeline_doc = {
        "id": str(uuid.uuid4()),
        "name": pipeline.name,
        "connection_id": pipeline.connection_id,
        "mapping_id": pipeline.mapping_id,
        "extract_limit": pipeline.extract_limit,
        # Target
        "target_id": pipeline.target_id,
        "target_table": pipeline.target_table or "silver_opportunities",
        # Schedule
        "schedule_enabled": pipeline.schedule_enabled,
        "schedule_type": pipeline.schedule_type or "manual",
        "interval_minutes": pipeline.interval_minutes,
        "cron_expression": pipeline.cron_expression,
        # Webhook
        "webhook_enabled": pipeline.webhook_enabled,
        # Sync
        "sync_mode": pipeline.sync_mode,
        "incremental_field": pipeline.incremental_field,
        "high_watermark": None,
        "delete_mode": pipeline.delete_mode,
        # Status
        "status": "idle",
        "last_run": None,
        "next_run": None,
        "run_count": 0,
        "created_by": user["sub"],
        "created_at": datetime.now(timezone.utc)
    }
    await db.pipelines.insert_one(pipeline_doc)
    
    # If scheduling enabled, add to scheduler
    if pipeline.schedule_enabled and pipeline.schedule_type in ["interval", "cron"]:
        from scheduler import scheduler
        schedule_config = {}
        if pipeline.schedule_type == "cron":
            schedule_config["expression"] = pipeline.cron_expression or "0 * * * *"
        else:
            schedule_config["minutes"] = pipeline.interval_minutes or 60
        
        result = await scheduler.add_pipeline_job(
            pipeline_doc["id"],
            pipeline.schedule_type,
            schedule_config
        )
        if result.get("next_run"):
            await db.pipelines.update_one(
                {"id": pipeline_doc["id"]},
                {"$set": {"next_run": result["next_run"]}}
            )
            pipeline_doc["next_run"] = result["next_run"]
    
    return serialize_doc(pipeline_doc)

@router.get("/pipelines")
async def list_pipelines(user: dict = Depends(get_current_user)):
    pipelines = await db.pipelines.find().to_list(100)
    return serialize_doc(pipelines)

@router.get("/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str, user: dict = Depends(get_current_user)):
    pipeline = await db.pipelines.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return serialize_doc(pipeline)

@router.put("/pipelines/{pipeline_id}")
async def update_pipeline(pipeline_id: str, update: PipelineUpdate, user: dict = Depends(get_current_user)):
    pipeline = await db.pipelines.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.pipelines.update_one({"id": pipeline_id}, {"$set": update_data})
    
    # Update scheduler if schedule changed
    if "schedule_enabled" in update_data or "schedule_type" in update_data:
        from scheduler import scheduler
        
        updated = await db.pipelines.find_one({"id": pipeline_id})
        if updated.get("schedule_enabled") and updated.get("schedule_type") in ["interval", "cron"]:
            schedule_config = {}
            if updated["schedule_type"] == "cron":
                schedule_config["expression"] = updated.get("cron_expression", "0 * * * *")
            else:
                schedule_config["minutes"] = updated.get("interval_minutes", 60)
            
            result = await scheduler.add_pipeline_job(
                pipeline_id,
                updated["schedule_type"],
                schedule_config
            )
            if result.get("next_run"):
                await db.pipelines.update_one(
                    {"id": pipeline_id},
                    {"$set": {"next_run": result["next_run"]}}
                )
        else:
            scheduler.remove_pipeline_job(pipeline_id)
            await db.pipelines.update_one(
                {"id": pipeline_id},
                {"$set": {"next_run": None}}
            )
    
    updated = await db.pipelines.find_one({"id": pipeline_id})
    return serialize_doc(updated)

@router.delete("/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str, user: dict = Depends(get_current_user)):
    # Remove from scheduler
    from scheduler import scheduler
    scheduler.remove_pipeline_job(pipeline_id)
    
    result = await db.pipelines.delete_one({"id": pipeline_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return {"status": "deleted"}

# ==================== SCHEDULE MANAGEMENT ====================

@router.post("/pipelines/{pipeline_id}/schedule")
async def update_pipeline_schedule(
    pipeline_id: str,
    schedule_type: str,
    interval_minutes: Optional[int] = None,
    cron_expression: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Update pipeline schedule"""
    from scheduler import scheduler
    
    pipeline = await db.pipelines.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    schedule_config = {}
    if schedule_type == "cron":
        schedule_config["expression"] = cron_expression or "0 * * * *"
    elif schedule_type == "interval":
        schedule_config["minutes"] = interval_minutes or 60
    else:
        # Disable scheduling
        scheduler.remove_pipeline_job(pipeline_id)
        await db.pipelines.update_one(
            {"id": pipeline_id},
            {"$set": {
                "schedule_enabled": False,
                "schedule_type": "manual",
                "next_run": None
            }}
        )
        return {"status": "disabled"}
    
    result = await scheduler.add_pipeline_job(pipeline_id, schedule_type, schedule_config)
    
    await db.pipelines.update_one(
        {"id": pipeline_id},
        {"$set": {
            "schedule_enabled": True,
            "schedule_type": schedule_type,
            "interval_minutes": interval_minutes,
            "cron_expression": cron_expression,
            "next_run": result.get("next_run")
        }}
    )
    
    return result

@router.get("/scheduler/jobs")
async def get_scheduled_jobs(user: dict = Depends(get_current_user)):
    """Get all scheduled jobs"""
    from scheduler import scheduler
    return scheduler.get_all_jobs()

# ==================== PIPELINE RUNS ====================

# Global dict to track running pipelines
running_pipelines = {}

async def execute_pipeline(run_id: str, pipeline_id: str, trigger_type: str = "manual"):
    """Execute a pipeline run with multi-target support"""
    run_start = datetime.now(timezone.utc)
    logs = []
    
    def log(message: str, level: str = "info"):
        logs.append({"timestamp": datetime.now(timezone.utc).isoformat(), "level": level, "message": message})
    
    try:
        # Get pipeline
        pipeline = await db.pipelines.find_one({"id": pipeline_id})
        if not pipeline:
            raise Exception("Pipeline not found")
        
        log(f"Starting pipeline: {pipeline['name']} (trigger: {trigger_type})")
        
        # Get connection
        conn = await db.connections.find_one({"id": pipeline["connection_id"]})
        if not conn:
            raise Exception("Connection not found")
        log(f"Using connection: {conn['name']}")
        
        # Get mapping
        mapping = await db.mappings.find_one({"id": pipeline["mapping_id"]})
        if not mapping:
            raise Exception("Mapping not found")
        log(f"Using mapping: {mapping['name']}")
        
        # Get target if configured
        target = None
        target_loader = None
        if pipeline.get("target_id"):
            target = await db.targets.find_one({"id": pipeline["target_id"]})
            if target:
                from loaders import LoaderFactory
                target_loader = LoaderFactory.get_loader(target["type"])
                await target_loader.connect({
                    "host": target["host"],
                    "port": target["port"],
                    "database": target["database"],
                    "username": target.get("username"),
                    "password": target.get("password"),
                })
                log(f"Connected to target: {target['name']} ({target['type']})")
        
        # Update run status
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "extracting", "trigger_type": trigger_type, "logs": logs}}
        )
        
        # EXTRACT from Odoo
        log(f"Extracting from {conn['type']}: {mapping['source_model']}")
        
        if conn["type"] == "odoo":
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common')
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if not uid:
                raise Exception("Odoo authentication failed")
            
            models = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object')
            
            # Get source fields from mapping
            source_fields = [m["source_field"] for m in mapping["mappings"] if m.get("source_field")]
            if not source_fields:
                source_fields = ['id', 'name', 'email_from', 'phone', 'stage_id', 'user_id', 'expected_revenue', 'probability', 'create_date', 'write_date', 'date_closed']
            
            # Also get stages for enrichment
            stages = models.execute_kw(
                conn["database"], uid, conn["api_key"],
                'crm.stage', 'search_read',
                [[]],
                {'fields': ['id', 'name', 'sequence', 'is_won']}
            )
            stage_map = {s['id']: s for s in stages}
            
            # Build extraction filter
            domain = []
            sync_mode = pipeline.get("sync_mode", "full")
            
            if sync_mode == "incremental" and pipeline.get("high_watermark"):
                incremental_field = pipeline.get("incremental_field", "write_date")
                domain = [[incremental_field, '>', pipeline["high_watermark"]]]
                log(f"Incremental sync: {incremental_field} > {pipeline['high_watermark']}")
            
            # Extract data
            records = models.execute_kw(
                conn["database"], uid, conn["api_key"],
                mapping['source_model'], 'search_read',
                domain,
                {'fields': source_fields, 'limit': pipeline.get('extract_limit', 500), 'order': 'write_date desc'}
            )
            
            log(f"Extracted {len(records)} records from Odoo", "success")
            extracted_count = len(records)
        else:
            raise Exception(f"Unsupported connection type: {conn['type']}")
        
        # Update status to transforming
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "transforming", "extracted_count": extracted_count, "logs": logs}}
        )
        
        # TRANSFORM using mapping
        log(f"Transforming {len(records)} records using mapping rules")
        
        transformed = []
        errors = []
        max_write_date = None
        
        for record in records:
            try:
                transformed_record = {
                    "source_system": "odoo",
                    "source_record_id": str(record.get('id')),
                    "transformed_at": datetime.now(timezone.utc)
                }
                
                # Track watermark
                write_date = record.get('write_date')
                if write_date:
                    if max_write_date is None or write_date > max_write_date:
                        max_write_date = write_date
                
                for rule in mapping["mappings"]:
                    source_field = rule.get("source_field")
                    target_field = rule.get("target_field")
                    transform = rule.get("transform", "direct")
                    
                    if not source_field or not target_field:
                        continue
                    
                    value = record.get(source_field)
                    
                    # Handle Odoo relational fields (many2one returns [id, name])
                    if isinstance(value, (list, tuple)) and len(value) >= 2:
                        if transform == "id" or transform == "extract_id":
                            value = str(value[0])
                        elif transform == "name" or transform == "extract_name":
                            value = value[1]
                        else:
                            value = value[1]  # Default to name
                    
                    # Apply transforms
                    if transform == "to_float" and value is not None:
                        value = float(value or 0)
                    elif transform == "to_int" and value is not None:
                        value = int(value or 0)
                    elif transform == "to_bool":
                        value = bool(value)
                    elif transform == "to_datetime" and value:
                        if isinstance(value, str):
                            value = value  # Keep as string for DB compatibility
                    
                    transformed_record[target_field] = value
                
                # Enrich with stage info
                stage_id = record.get('stage_id')
                if stage_id and isinstance(stage_id, (list, tuple)):
                    stage_info = stage_map.get(stage_id[0], {})
                    transformed_record['is_won'] = stage_info.get('is_won', False)
                    transformed_record['is_closed'] = bool(record.get('date_closed')) or stage_info.get('is_won', False)
                
                # Generate unique ID
                transformed_record['opportunity_id'] = f"odoo_lead_{record.get('id')}"
                
                transformed.append(transformed_record)
            except Exception as e:
                errors.append({"record_id": record.get('id'), "error": str(e)})
        
        log(f"Transformed {len(transformed)} records ({len(errors)} errors)", "success" if not errors else "warning")
        
        # Update status to loading
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "loading", "transformed_count": len(transformed), "error_count": len(errors), "logs": logs}}
        )
        
        # LOAD to MongoDB (silver layer)
        target_table = pipeline.get("target_table", "silver_opportunities")
        log(f"Loading {len(transformed)} records to {target_table}")
        
        inserted = 0
        updated = 0
        
        for record in transformed:
            result = await db.silver_opportunities.update_one(
                {"source_record_id": record["source_record_id"], "source_system": record["source_system"]},
                {"$set": record},
                upsert=True
            )
            if result.upserted_id:
                inserted += 1
            elif result.modified_count > 0:
                updated += 1
        
        log(f"Loaded to MongoDB: {inserted} inserted, {updated} updated", "success")
        
        # LOAD to external target if configured
        target_inserted = 0
        target_updated = 0
        
        if target_loader and target:
            try:
                log(f"Loading to external target: {target['name']}")
                
                # Ensure table exists (for SQL databases)
                await target_loader.create_table(target_table, {})
                
                target_inserted, target_updated = await target_loader.upsert(
                    target_table,
                    transformed,
                    "source_record_id"
                )
                
                log(f"Loaded to {target['type']}: {target_inserted} inserted, {target_updated} updated", "success")
                
                await target_loader.disconnect()
            except Exception as e:
                log(f"Failed to load to external target: {e}", "error")
        
        # Save errors to DLQ
        if errors:
            for err in errors:
                await db.dlq.insert_one({
                    "id": str(uuid.uuid4()),
                    "run_id": run_id,
                    "pipeline_id": pipeline_id,
                    "record_id": err["record_id"],
                    "error": err["error"],
                    "status": "failed",
                    "created_at": datetime.now(timezone.utc)
                })
        
        # Update watermark for incremental sync
        if max_write_date and pipeline.get("sync_mode") == "incremental":
            await db.pipelines.update_one(
                {"id": pipeline_id},
                {"$set": {"high_watermark": max_write_date}}
            )
            log(f"Updated watermark to {max_write_date}")
        
        # Complete
        run_end = datetime.now(timezone.utc)
        duration = (run_end - run_start).total_seconds()
        
        log(f"Pipeline completed in {duration:.2f}s", "success")
        
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "loaded_count": inserted + updated,
                "inserted_count": inserted,
                "updated_count": updated,
                "target_inserted": target_inserted,
                "target_updated": target_updated,
                "duration_seconds": duration,
                "completed_at": run_end,
                "logs": logs
            }}
        )
        
        # Update pipeline stats
        await db.pipelines.update_one(
            {"id": pipeline_id},
            {"$set": {"status": "idle", "last_run": run_end}, "$inc": {"run_count": 1}}
        )
        
    except Exception as e:
        log(f"Pipeline failed: {str(e)}", "error")
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e), "completed_at": datetime.now(timezone.utc), "logs": logs}}
        )
        await db.pipelines.update_one(
            {"id": pipeline_id},
            {"$set": {"status": "idle"}}
        )
    finally:
        if run_id in running_pipelines:
            del running_pipelines[run_id]
        if target_loader:
            try:
                await target_loader.disconnect()
            except:
                pass

@router.post("/pipelines/{pipeline_id}/run")
async def run_pipeline(pipeline_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    pipeline = await db.pipelines.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    if pipeline.get("status") == "running":
        raise HTTPException(status_code=400, detail="Pipeline is already running")
    
    # Create run record
    run_doc = {
        "id": str(uuid.uuid4()),
        "pipeline_id": pipeline_id,
        "status": "pending",
        "started_at": datetime.now(timezone.utc),
        "started_by": user["sub"],
        "extracted_count": 0,
        "transformed_count": 0,
        "loaded_count": 0,
        "error_count": 0,
        "logs": []
    }
    await db.pipeline_runs.insert_one(run_doc)
    
    # Update pipeline status
    await db.pipelines.update_one(
        {"id": pipeline_id},
        {"$set": {"status": "running"}}
    )
    
    # Start pipeline execution in background
    background_tasks.add_task(execute_pipeline, run_doc["id"], pipeline_id)
    
    return serialize_doc(run_doc)

@router.get("/pipelines/{pipeline_id}/runs")
async def list_pipeline_runs(pipeline_id: str, limit: int = 20, user: dict = Depends(get_current_user)):
    runs = await db.pipeline_runs.find({"pipeline_id": pipeline_id}).sort("started_at", -1).limit(limit).to_list(limit)
    return serialize_doc(runs)

@router.get("/pipeline-runs")
async def list_all_runs(limit: int = 50, user: dict = Depends(get_current_user)):
    runs = await db.pipeline_runs.find().sort("started_at", -1).limit(limit).to_list(limit)
    return serialize_doc(runs)

@router.get("/pipeline-runs/{run_id}")
async def get_run(run_id: str, user: dict = Depends(get_current_user)):
    run = await db.pipeline_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return serialize_doc(run)

@router.get("/pipeline-runs/{run_id}/logs")
async def get_run_logs(run_id: str, user: dict = Depends(get_current_user)):
    run = await db.pipeline_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"logs": run.get("logs", [])}

# ==================== DATA PREVIEW ====================

@router.get("/preview/{connection_id}/{model_name}")
async def preview_source_data(connection_id: str, model_name: str, limit: int = 10, user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": connection_id})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        if conn["type"] == "odoo":
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common')
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if not uid:
                raise HTTPException(status_code=401, detail="Odoo authentication failed")
            
            models = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object')
            
            records = models.execute_kw(
                conn["database"], uid, conn["api_key"],
                model_name, 'search_read',
                [[]],
                {'limit': limit}
            )
            
            return {"model": model_name, "count": len(records), "records": records}
        else:
            raise HTTPException(status_code=400, detail=f"Preview not supported for {conn['type']}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preview/silver")
async def preview_silver_data(limit: int = 20, user: dict = Depends(get_current_user)):
    records = await db.silver_opportunities.find().sort("transformed_at", -1).limit(limit).to_list(limit)
    return {"collection": "silver_opportunities", "count": len(records), "records": serialize_doc(records)}

# ==================== DLQ ====================

@router.get("/dlq")
async def list_dlq(limit: int = 100, user: dict = Depends(get_current_user)):
    items = await db.dlq.find({"status": "failed"}).sort("created_at", -1).limit(limit).to_list(limit)
    return serialize_doc(items)

@router.post("/dlq/{item_id}/retry")
async def retry_dlq(item_id: str, user: dict = Depends(get_current_user)):
    result = await db.dlq.update_one(
        {"id": item_id},
        {"$set": {"status": "retried", "retried_at": datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="DLQ item not found")
    return {"status": "retried"}
