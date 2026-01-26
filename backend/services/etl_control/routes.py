"""ETL Control Service Routes - Connections, Schemas, Mappings, Pipelines

Handles:
- Connection CRUD and testing
- Schema discovery
- Mapping CRUD with versioning
- Pipeline CRUD with scheduling
- Run command publishing
- Integration templates
- Auto-mapping suggestions
- Schema verification
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional, List
import logging
import xmlrpc.client

from libs.database import get_app_db
from libs.utils import serialize_doc, generate_id, generate_correlation_id, now_utc, RunStatus
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.routes import get_current_user
from services.etl_control.models import (
    ConnectionCreate, ConnectionUpdate, MappingCreate, MappingUpdate,
    PipelineCreate, PipelineUpdate, CANONICAL_ENTITIES
)
from services.etl_control.templates import (
    INTEGRATION_TEMPLATES, auto_suggest_mappings, suggest_mapping
)

logger = logging.getLogger(__name__)

# Separate routers for different resource types
connections_router = APIRouter(prefix="/integrations", tags=["connections"])
mappings_router = APIRouter(prefix="/mappings", tags=["mappings"])
pipelines_router = APIRouter(prefix="/pipelines", tags=["pipelines"])
runs_router = APIRouter(prefix="/runs", tags=["runs"])
templates_router = APIRouter(prefix="/templates", tags=["templates"])


# ==================== CONNECTIONS ====================

@connections_router.post("")
async def create_connection(
    conn_data: ConnectionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new data source connection"""
    db = get_app_db()
    
    conn_doc = {
        "id": generate_id(),
        "org_id": current_user["org_id"],
        "name": conn_data.name,
        "type": conn_data.type,
        "url": conn_data.url,
        "database": conn_data.database,
        "username": conn_data.username,
        "api_key": conn_data.api_key,  # Should encrypt in production
        "description": conn_data.description,
        "status": "pending",
        "health": "unknown",
        "last_test": None,
        "created_by": current_user["id"],
        "created_at": now_utc()
    }
    
    await db.connections.insert_one(conn_doc)
    
    # Return without api_key
    safe_doc = {k: v for k, v in conn_doc.items() if k != 'api_key'}
    logger.info(f"Connection created: {conn_data.name}")
    return serialize_doc(safe_doc)


@connections_router.get("")
async def list_connections(current_user: dict = Depends(get_current_user)):
    """List all connections"""
    db = get_app_db()
    connections = await db.connections.find({"org_id": current_user["org_id"]}).to_list(100)
    
    # Remove api_key from response
    return serialize_doc([{k: v for k, v in c.items() if k != 'api_key'} for c in connections])


@connections_router.get("/{conn_id}")
async def get_connection(
    conn_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single connection"""
    db = get_app_db()
    
    conn = await db.connections.find_one({
        "id": conn_id,
        "org_id": current_user["org_id"]
    })
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    safe_doc = {k: v for k, v in conn.items() if k != 'api_key'}
    return serialize_doc(safe_doc)


@connections_router.put("/{conn_id}")
async def update_connection(
    conn_id: str,
    conn_data: ConnectionUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a connection"""
    db = get_app_db()
    
    update_data = {k: v for k, v in conn_data.model_dump().items() if v is not None}
    update_data["updated_at"] = now_utc()
    update_data["status"] = "pending"  # Reset status on update
    
    result = await db.connections.update_one(
        {"id": conn_id, "org_id": current_user["org_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    return {"success": True, "message": "Connection updated"}


@connections_router.delete("/{conn_id}")
async def delete_connection(
    conn_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a connection"""
    db = get_app_db()
    
    result = await db.connections.delete_one({
        "id": conn_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    return {"success": True, "message": "Connection deleted"}


@connections_router.post("/{conn_id}/test")
async def test_connection(
    conn_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Test a connection"""
    db = get_app_db()
    
    conn = await db.connections.find_one({
        "id": conn_id,
        "org_id": current_user["org_id"]
    })
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        if conn["type"] == "odoo":
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common', allow_none=True)
            version = common.version()
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if uid:
                await db.connections.update_one(
                    {"id": conn_id},
                    {"$set": {
                        "status": "active",
                        "health": "healthy",
                        "last_test": now_utc(),
                        "odoo_version": version.get('server_version')
                    }}
                )
                return {
                    "status": "success",
                    "health": "healthy",
                    "message": f"Connected to Odoo {version.get('server_version')}",
                    "user_id": uid
                }
            else:
                await db.connections.update_one(
                    {"id": conn_id},
                    {"$set": {"status": "error", "health": "unhealthy", "last_test": now_utc()}}
                )
                return {"status": "error", "health": "unhealthy", "message": "Authentication failed"}
        else:
            # Mock test for other connection types
            await db.connections.update_one(
                {"id": conn_id},
                {"$set": {"status": "active", "health": "healthy", "last_test": now_utc()}}
            )
            return {"status": "success", "health": "healthy", "message": f"Connection type {conn['type']} test passed (mock)"}
            
    except Exception as e:
        await db.connections.update_one(
            {"id": conn_id},
            {"$set": {"status": "error", "health": "unhealthy", "last_test": now_utc(), "error": str(e)}}
        )
        return {"status": "error", "health": "unhealthy", "message": str(e)}


@connections_router.post("/{conn_id}/discover")
async def discover_schema(
    conn_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Discover schema from connection"""
    db = get_app_db()
    
    conn = await db.connections.find_one({
        "id": conn_id,
        "org_id": current_user["org_id"]
    })
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        if conn["type"] == "odoo":
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common', allow_none=True)
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if not uid:
                raise HTTPException(status_code=401, detail="Odoo authentication failed")
            
            models_proxy = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object', allow_none=True)
            
            # Discover CRM and related models
            crm_models = models_proxy.execute_kw(
                conn["database"], uid, conn["api_key"],
                'ir.model', 'search_read',
                [[['model', 'like', 'crm.%']]],
                {'fields': ['model', 'name'], 'limit': 50}
            )
            
            other_models = models_proxy.execute_kw(
                conn["database"], uid, conn["api_key"],
                'ir.model', 'search_read',
                [[['model', 'in', ['res.partner', 'res.users', 'res.company']]]],
                {'fields': ['model', 'name']}
            )
            
            all_models = crm_models + other_models
            
            schema_doc = {
                "id": generate_id(),
                "connection_id": conn_id,
                "org_id": current_user["org_id"],
                "discovered_at": now_utc(),
                "models": [{"model": m['model'], "name": m['name']} for m in all_models]
            }
            
            await db.schemas.update_one(
                {"connection_id": conn_id},
                {"$set": schema_doc},
                upsert=True
            )
            
            return serialize_doc(schema_doc)
        else:
            # Mock schema for other types
            schema_doc = {
                "id": generate_id(),
                "connection_id": conn_id,
                "org_id": current_user["org_id"],
                "discovered_at": now_utc(),
                "models": [
                    {"model": "opportunities", "name": "Opportunities"},
                    {"model": "accounts", "name": "Accounts"},
                    {"model": "contacts", "name": "Contacts"},
                    {"model": "users", "name": "Users"}
                ]
            }
            
            await db.schemas.update_one(
                {"connection_id": conn_id},
                {"$set": schema_doc},
                upsert=True
            )
            
            return serialize_doc(schema_doc)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@connections_router.get("/{conn_id}/schema")
async def get_schema(
    conn_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get discovered schema"""
    db = get_app_db()
    
    schema = await db.schemas.find_one({
        "connection_id": conn_id,
        "org_id": current_user["org_id"]
    })
    
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not discovered yet. Call POST /discover first.")
    
    return serialize_doc(schema)


@connections_router.get("/{conn_id}/schema/{model_name}/fields")
async def get_model_fields(
    conn_id: str,
    model_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get fields for a specific model"""
    db = get_app_db()
    
    conn = await db.connections.find_one({
        "id": conn_id,
        "org_id": current_user["org_id"]
    })
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        if conn["type"] == "odoo":
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common', allow_none=True)
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if not uid:
                raise HTTPException(status_code=401, detail="Odoo authentication failed")
            
            models_proxy = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object', allow_none=True)
            
            fields = models_proxy.execute_kw(
                conn["database"], uid, conn["api_key"],
                model_name, 'fields_get',
                [],
                {'attributes': ['string', 'type', 'required', 'relation', 'help']}
            )
            
            return {"model": model_name, "fields": fields}
        else:
            # Mock fields for other types
            return {
                "model": model_name,
                "fields": {
                    "id": {"string": "ID", "type": "integer", "required": True},
                    "name": {"string": "Name", "type": "char", "required": True},
                    "email": {"string": "Email", "type": "char", "required": False},
                    "created_at": {"string": "Created At", "type": "datetime", "required": False}
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CANONICAL MODEL ====================

@connections_router.get("/canonical-model")
async def get_canonical_model():
    """Get canonical model definitions"""
    return {
        "version": "1.0",
        "entities": CANONICAL_ENTITIES
    }


# ==================== MAPPINGS ====================

@mappings_router.post("")
async def create_mapping(
    mapping_data: MappingCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new field mapping"""
    db = get_app_db()
    
    # Verify connection exists
    conn = await db.connections.find_one({
        "id": mapping_data.connection_id,
        "org_id": current_user["org_id"]
    })
    if not conn:
        raise HTTPException(status_code=400, detail="Connection not found")
    
    mapping_doc = {
        "id": generate_id(),
        "org_id": current_user["org_id"],
        "name": mapping_data.name,
        "connection_id": mapping_data.connection_id,
        "source_model": mapping_data.source_model,
        "target_entity": mapping_data.target_entity,
        "mappings": [m.model_dump() for m in mapping_data.mappings],
        "description": mapping_data.description,
        "version": 1,
        "status": "active",
        "created_by": current_user["id"],
        "created_at": now_utc()
    }
    
    await db.mappings.insert_one(mapping_doc)
    logger.info(f"Mapping created: {mapping_data.name}")
    return serialize_doc(mapping_doc)


@mappings_router.get("")
async def list_mappings(
    connection_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all mappings"""
    db = get_app_db()
    
    query = {"org_id": current_user["org_id"]}
    if connection_id:
        query["connection_id"] = connection_id
    
    mappings = await db.mappings.find(query).to_list(100)
    return serialize_doc(mappings)


@mappings_router.get("/{mapping_id}")
async def get_mapping(
    mapping_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single mapping"""
    db = get_app_db()
    
    mapping = await db.mappings.find_one({
        "id": mapping_id,
        "org_id": current_user["org_id"]
    })
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    return serialize_doc(mapping)


@mappings_router.put("/{mapping_id}")
async def update_mapping(
    mapping_id: str,
    mapping_data: MappingUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a mapping (creates new version)"""
    db = get_app_db()
    
    existing = await db.mappings.find_one({
        "id": mapping_id,
        "org_id": current_user["org_id"]
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    update_data = {k: v for k, v in mapping_data.model_dump().items() if v is not None}
    if "mappings" in update_data:
        update_data["mappings"] = [m.model_dump() if hasattr(m, 'model_dump') else m for m in update_data["mappings"]]
    
    update_data["version"] = existing.get("version", 1) + 1
    update_data["updated_at"] = now_utc()
    
    await db.mappings.update_one(
        {"id": mapping_id},
        {"$set": update_data}
    )
    
    updated = await db.mappings.find_one({"id": mapping_id})
    return serialize_doc(updated)


@mappings_router.delete("/{mapping_id}")
async def delete_mapping(
    mapping_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a mapping"""
    db = get_app_db()
    
    result = await db.mappings.delete_one({
        "id": mapping_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    return {"success": True, "message": "Mapping deleted"}


@mappings_router.post("/{mapping_id}/preview")
async def preview_mapping(
    mapping_id: str,
    limit: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """Preview mapping transformation on sample data"""
    db = get_app_db()
    
    mapping = await db.mappings.find_one({
        "id": mapping_id,
        "org_id": current_user["org_id"]
    })
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    # Get connection
    conn = await db.connections.find_one({"id": mapping["connection_id"]})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Get sample source data and transform
    # For now, return mock preview
    return {
        "mapping_id": mapping_id,
        "source_model": mapping["source_model"],
        "target_entity": mapping["target_entity"],
        "sample_count": limit,
        "preview": [
            {
                "source": {"id": 1, "name": "Sample Record", "email": "sample@example.com"},
                "transformed": {
                    "canonical_id": "source_1",
                    "name": "Sample Record",
                    "contact_email": "sample@example.com"
                }
            }
        ]
    }


# ==================== PIPELINES ====================

@pipelines_router.post("")
async def create_pipeline(
    pipeline_data: PipelineCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new pipeline"""
    db = get_app_db()
    
    # Verify connection and mapping exist
    conn = await db.connections.find_one({
        "id": pipeline_data.connection_id,
        "org_id": current_user["org_id"]
    })
    if not conn:
        raise HTTPException(status_code=400, detail="Connection not found")
    
    mapping = await db.mappings.find_one({
        "id": pipeline_data.mapping_id,
        "org_id": current_user["org_id"]
    })
    if not mapping:
        raise HTTPException(status_code=400, detail="Mapping not found")
    
    pipeline_doc = {
        "id": generate_id(),
        "org_id": current_user["org_id"],
        "name": pipeline_data.name,
        "connection_id": pipeline_data.connection_id,
        "mapping_id": pipeline_data.mapping_id,
        "extract_limit": pipeline_data.extract_limit,
        "schedule_enabled": pipeline_data.schedule_enabled,
        "schedule_type": pipeline_data.schedule_type,
        "interval_minutes": pipeline_data.interval_minutes,
        "cron_expression": pipeline_data.cron_expression,
        "webhook_enabled": pipeline_data.webhook_enabled,
        "sync_mode": pipeline_data.sync_mode,
        "incremental_field": pipeline_data.incremental_field,
        "delete_mode": pipeline_data.delete_mode,
        "description": pipeline_data.description,
        "high_watermark": None,
        "status": "idle",
        "last_run": None,
        "next_run": None,
        "run_count": 0,
        "created_by": current_user["id"],
        "created_at": now_utc()
    }
    
    await db.pipelines.insert_one(pipeline_doc)
    logger.info(f"Pipeline created: {pipeline_data.name}")
    return serialize_doc(pipeline_doc)


@pipelines_router.get("")
async def list_pipelines(current_user: dict = Depends(get_current_user)):
    """List all pipelines"""
    db = get_app_db()
    pipelines = await db.pipelines.find({"org_id": current_user["org_id"]}).to_list(100)
    return serialize_doc(pipelines)


@pipelines_router.get("/{pipeline_id}")
async def get_pipeline(
    pipeline_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single pipeline"""
    db = get_app_db()
    
    pipeline = await db.pipelines.find_one({
        "id": pipeline_id,
        "org_id": current_user["org_id"]
    })
    
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    return serialize_doc(pipeline)


@pipelines_router.put("/{pipeline_id}")
async def update_pipeline(
    pipeline_id: str,
    pipeline_data: PipelineUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a pipeline"""
    db = get_app_db()
    
    update_data = {k: v for k, v in pipeline_data.model_dump().items() if v is not None}
    update_data["updated_at"] = now_utc()
    
    result = await db.pipelines.update_one(
        {"id": pipeline_id, "org_id": current_user["org_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    return {"success": True, "message": "Pipeline updated"}


@pipelines_router.delete("/{pipeline_id}")
async def delete_pipeline(
    pipeline_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a pipeline"""
    db = get_app_db()
    
    result = await db.pipelines.delete_one({
        "id": pipeline_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    return {"success": True, "message": "Pipeline deleted"}


@pipelines_router.post("/{pipeline_id}/run")
async def run_pipeline(
    pipeline_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Trigger a pipeline run"""
    db = get_app_db()
    
    pipeline = await db.pipelines.find_one({
        "id": pipeline_id,
        "org_id": current_user["org_id"]
    })
    
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    if pipeline.get("status") == "running":
        raise HTTPException(status_code=400, detail="Pipeline is already running")
    
    # Create run record
    run_id = generate_id()
    correlation_id = generate_correlation_id()
    
    run_doc = {
        "id": run_id,
        "pipeline_id": pipeline_id,
        "org_id": current_user["org_id"],
        "correlation_id": correlation_id,
        "status": RunStatus.PENDING,
        "trigger_type": "manual",
        "started_at": now_utc(),
        "started_by": current_user["id"],
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
    
    # Publish run command event
    await emit_event(
        event_type=Topics.ETL_PIPELINE_RUN_COMMAND,
        payload={
            "run_id": run_id,
            "pipeline_id": pipeline_id,
            "connection_id": pipeline["connection_id"],
            "mapping_id": pipeline["mapping_id"],
            "trigger_type": "manual",
            "config": {
                "extract_limit": pipeline.get("extract_limit", 500),
                "sync_mode": pipeline.get("sync_mode", "full"),
                "incremental_field": pipeline.get("incremental_field"),
                "high_watermark": pipeline.get("high_watermark")
            }
        },
        producer="etl-control-service",
        org_id=current_user["org_id"],
        correlation_id=correlation_id
    )
    
    logger.info(f"Pipeline run started: {pipeline_id} -> {run_id}")
    return serialize_doc(run_doc)


@pipelines_router.get("/{pipeline_id}/runs")
async def list_pipeline_runs(
    pipeline_id: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """List runs for a pipeline"""
    db = get_app_db()
    
    runs = await db.pipeline_runs.find(
        {"pipeline_id": pipeline_id, "org_id": current_user["org_id"]}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return serialize_doc(runs)


# ==================== RUNS ====================

@runs_router.get("")
async def list_all_runs(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List all pipeline runs"""
    db = get_app_db()
    
    runs = await db.pipeline_runs.find(
        {"org_id": current_user["org_id"]}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return serialize_doc(runs)


@runs_router.get("/{run_id}")
async def get_run(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single run"""
    db = get_app_db()
    
    run = await db.pipeline_runs.find_one({
        "id": run_id,
        "org_id": current_user["org_id"]
    })
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return serialize_doc(run)


@runs_router.get("/{run_id}/logs")
async def get_run_logs(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get logs for a run"""
    db = get_app_db()
    
    run = await db.pipeline_runs.find_one({
        "id": run_id,
        "org_id": current_user["org_id"]
    })
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return {"run_id": run_id, "logs": run.get("logs", [])}
