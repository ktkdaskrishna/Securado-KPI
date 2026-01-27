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
- Visual Mapping Editor APIs
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional, List
import logging
import xmlrpc.client
import yaml
import re
import ssl

from libs.database import get_app_db, get_canonical_db
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


# ==================== SSL-SAFE XML-RPC TRANSPORT ====================

class SSLTransport(xmlrpc.client.SafeTransport):
    """Custom transport that handles SSL certificate verification issues"""
    
    def __init__(self, use_datetime=False, use_builtin_types=False, ssl_context=None):
        super().__init__(use_datetime=use_datetime, use_builtin_types=use_builtin_types)
        self._ssl_context = ssl_context
    
    def make_connection(self, host):
        if self._ssl_context is None:
            # Create an unverified SSL context for connections with certificate issues
            self._ssl_context = ssl.create_default_context()
            self._ssl_context.check_hostname = False
            self._ssl_context.verify_mode = ssl.CERT_NONE
        
        return super().make_connection(host)


def create_odoo_proxy(url: str, endpoint: str = "common") -> xmlrpc.client.ServerProxy:
    """Create an XML-RPC proxy with SSL handling for Odoo connections.
    
    Args:
        url: The base Odoo URL (e.g., https://mycompany.odoo.com)
        endpoint: The XML-RPC endpoint (common, object, etc.)
    
    Returns:
        ServerProxy configured for the Odoo endpoint
    """
    full_url = f'{url}/xmlrpc/2/{endpoint}'
    
    # Create SSL context that doesn't verify certificates
    # This is needed for some Odoo instances with self-signed or chain issues
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    transport = SSLTransport(ssl_context=ssl_context)
    
    return xmlrpc.client.ServerProxy(full_url, transport=transport, allow_none=True)


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
        "org_id": current_user.get("org_id", "default"),
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
    connections = await db.connections.find({"org_id": current_user.get("org_id", "default")}).to_list(100)
    
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
        "org_id": current_user.get("org_id", "default")
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
        {"id": conn_id, "org_id": current_user.get("org_id", "default")},
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default")
    })
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        if conn["type"] == "odoo":
            try:
                # Use SSL-safe proxy for Odoo connections
                common = create_odoo_proxy(conn["url"], "common")
                version = common.version()
                uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            except xmlrpc.client.ProtocolError as pe:
                # Handle 303 redirect - Odoo might be upgrading or moved
                error_msg = str(pe)
                if '303' in error_msg:
                    await db.connections.update_one(
                        {"id": conn_id},
                        {"$set": {"status": "error", "health": "unhealthy", "last_test": now_utc(), "error": "Odoo instance unavailable (303 redirect)"}}
                    )
                    return {
                        "status": "error", 
                        "health": "unhealthy", 
                        "message": f"Odoo server unavailable (303 redirect). The instance at {conn['url']} may be upgrading or under maintenance."
                    }
                await db.connections.update_one(
                    {"id": conn_id},
                    {"$set": {"status": "error", "health": "unhealthy", "last_test": now_utc(), "error": error_msg}}
                )
                return {"status": "error", "health": "unhealthy", "message": f"Odoo connection error: {error_msg}"}
            except ssl.SSLError as ssl_err:
                # Handle SSL certificate errors
                error_msg = str(ssl_err)
                await db.connections.update_one(
                    {"id": conn_id},
                    {"$set": {"status": "error", "health": "unhealthy", "last_test": now_utc(), "error": f"SSL Error: {error_msg}"}}
                )
                return {"status": "error", "health": "unhealthy", "message": f"SSL certificate error: {error_msg}"}
            
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
    """Discover ALL available models from connection"""
    db = get_app_db()
    
    conn = await db.connections.find_one({
        "id": conn_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        if conn["type"] == "odoo":
            try:
                common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common', allow_none=True)
                uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            except xmlrpc.client.ProtocolError as pe:
                # Handle 303 redirect - Odoo might be upgrading or moved
                if '303' in str(pe):
                    raise HTTPException(
                        status_code=503, 
                        detail=f"Odoo server is unavailable (303 redirect). The instance at {conn['url']} may be upgrading or under maintenance. Please try again later or check the Odoo instance status."
                    )
                raise HTTPException(status_code=502, detail=f"Odoo connection error: {str(pe)}")
            except Exception as conn_error:
                raise HTTPException(status_code=502, detail=f"Failed to connect to Odoo: {str(conn_error)}")
            
            if not uid:
                raise HTTPException(status_code=401, detail="Odoo authentication failed")
            
            models_proxy = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object', allow_none=True)
            
            # Define model categories to discover
            model_categories = {
                'crm': {'pattern': 'crm.%', 'label': 'CRM', 'icon': '🎯'},
                'account': {'pattern': 'account.%', 'label': 'Accounting/Invoices', 'icon': '💰'},
                'sale': {'pattern': 'sale.%', 'label': 'Sales', 'icon': '📈'},
                'purchase': {'pattern': 'purchase.%', 'label': 'Purchase', 'icon': '🛒'},
                'stock': {'pattern': 'stock.%', 'label': 'Inventory', 'icon': '🏭'},
                'product': {'pattern': 'product.%', 'label': 'Products', 'icon': '📦'},
                'hr': {'pattern': 'hr.%', 'label': 'HR/Employees', 'icon': '👥'},
                'project': {'pattern': 'project.%', 'label': 'Projects', 'icon': '📋'},
                'mrp': {'pattern': 'mrp.%', 'label': 'Manufacturing', 'icon': '🔧'},
                'fleet': {'pattern': 'fleet.%', 'label': 'Fleet', 'icon': '🚗'},
                'maintenance': {'pattern': 'maintenance.%', 'label': 'Maintenance', 'icon': '🔨'},
                'helpdesk': {'pattern': 'helpdesk.%', 'label': 'Helpdesk', 'icon': '🎧'},
                'calendar': {'pattern': 'calendar.%', 'label': 'Calendar', 'icon': '📅'},
                'mail': {'pattern': 'mail.%', 'label': 'Mail/Messages', 'icon': '✉️'},
                'survey': {'pattern': 'survey.%', 'label': 'Surveys', 'icon': '📊'},
                'event': {'pattern': 'event.%', 'label': 'Events', 'icon': '🎪'},
                'website': {'pattern': 'website.%', 'label': 'Website', 'icon': '🌐'},
                'pos': {'pattern': 'pos.%', 'label': 'Point of Sale', 'icon': '🏪'},
                'quality': {'pattern': 'quality.%', 'label': 'Quality', 'icon': '✅'},
                'timesheet': {'pattern': 'account.analytic.line', 'label': 'Timesheets', 'icon': '⏱️'},
            }
            
            all_models = []
            category_counts = {}
            
            # Discover models for each category
            for cat_key, cat_info in model_categories.items():
                try:
                    if cat_info['pattern'].endswith('%'):
                        # Pattern search
                        models = models_proxy.execute_kw(
                            conn["database"], uid, conn["api_key"],
                            'ir.model', 'search_read',
                            [[['model', 'like', cat_info['pattern']]]],
                            {'fields': ['model', 'name', 'state', 'transient'], 'limit': 200}
                        )
                    else:
                        # Exact match
                        models = models_proxy.execute_kw(
                            conn["database"], uid, conn["api_key"],
                            'ir.model', 'search_read',
                            [[['model', '=', cat_info['pattern']]]],
                            {'fields': ['model', 'name', 'state', 'transient']}
                        )
                    
                    for m in models:
                        # Skip transient models (wizards)
                        if m.get('transient'):
                            continue
                        m['category'] = cat_key
                        m['category_label'] = cat_info['label']
                        m['category_icon'] = cat_info['icon']
                        all_models.append(m)
                    
                    category_counts[cat_key] = len([m for m in models if not m.get('transient')])
                except Exception as e:
                    logger.warning(f"Error discovering {cat_key} models: {e}")
            
            # Also get core/res models
            try:
                core_models = models_proxy.execute_kw(
                    conn["database"], uid, conn["api_key"],
                    'ir.model', 'search_read',
                    [[['model', 'like', 'res.%']]],
                    {'fields': ['model', 'name', 'state', 'transient'], 'limit': 100}
                )
                for m in core_models:
                    if m.get('transient'):
                        continue
                    m['category'] = 'core'
                    m['category_label'] = 'Core/Settings'
                    m['category_icon'] = '⚙️'
                    all_models.append(m)
                category_counts['core'] = len([m for m in core_models if not m.get('transient')])
            except Exception as e:
                logger.warning(f"Error discovering core models: {e}")
            
            # Remove duplicates based on model name
            seen_models = set()
            unique_models = []
            for m in all_models:
                if m['model'] not in seen_models:
                    seen_models.add(m['model'])
                    unique_models.append(m)
            
            # Sort by category then model name
            unique_models.sort(key=lambda x: (x.get('category', 'z'), x['model']))
            
            schema_doc = {
                "id": generate_id(),
                "connection_id": conn_id,
                "org_id": current_user.get("org_id", "default"),
                "discovered_at": now_utc(),
                "models": [{"model": m['model'], "name": m['name'], "category": m.get('category'), "category_label": m.get('category_label'), "category_icon": m.get('category_icon')} for m in unique_models],
                "model_count": len(unique_models),
                "category_counts": category_counts
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
                "org_id": current_user.get("org_id", "default"),
                "discovered_at": now_utc(),
                "models": [
                    {"model": "opportunities", "name": "Opportunities", "category": "crm", "category_label": "CRM", "category_icon": "🎯"},
                    {"model": "accounts", "name": "Accounts", "category": "core", "category_label": "Core", "category_icon": "⚙️"},
                    {"model": "contacts", "name": "Contacts", "category": "core", "category_label": "Core", "category_icon": "⚙️"},
                    {"model": "users", "name": "Users", "category": "core", "category_label": "Core", "category_icon": "⚙️"},
                    {"model": "invoices", "name": "Invoices", "category": "account", "category_label": "Accounting", "category_icon": "💰"}
                ],
                "model_count": 5
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default")
    })
    if not conn:
        raise HTTPException(status_code=400, detail="Connection not found")
    
    mapping_doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
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
    
    query = {"org_id": current_user.get("org_id", "default")}
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default")
    })
    if not conn:
        raise HTTPException(status_code=400, detail="Connection not found")
    
    mapping = await db.mappings.find_one({
        "id": pipeline_data.mapping_id,
        "org_id": current_user.get("org_id", "default")
    })
    if not mapping:
        raise HTTPException(status_code=400, detail="Mapping not found")
    
    pipeline_doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
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
    pipelines = await db.pipelines.find({"org_id": current_user.get("org_id", "default")}).to_list(100)
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
        "org_id": current_user.get("org_id", "default")
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
        {"id": pipeline_id, "org_id": current_user.get("org_id", "default")},
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default"),
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
        org_id=current_user.get("org_id", "default"),
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
        {"pipeline_id": pipeline_id, "org_id": current_user.get("org_id", "default")}
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
        {"org_id": current_user.get("org_id", "default")}
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
        "org_id": current_user.get("org_id", "default")
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
        "org_id": current_user.get("org_id", "default")
    })
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return {"run_id": run_id, "logs": run.get("logs", [])}



# ==================== TEMPLATES ====================

@templates_router.get("")
async def list_templates():
    """List all available integration templates"""
    templates_list = []
    for key, template in INTEGRATION_TEMPLATES.items():
        templates_list.append({
            "id": template["id"],
            "name": template["name"],
            "description": template["description"],
            "type": template["type"],
            "icon": template.get("icon", "database"),
            "category": template.get("category", "Other"),
            "models": template.get("models", [])
        })
    return templates_list


@templates_router.get("/{template_id}")
async def get_template(template_id: str):
    """Get a specific template with all details"""
    if template_id not in INTEGRATION_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return INTEGRATION_TEMPLATES[template_id]


@templates_router.post("/{template_id}/create-connection")
async def create_connection_from_template(
    template_id: str,
    conn_data: ConnectionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a connection using a template's defaults"""
    if template_id not in INTEGRATION_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = INTEGRATION_TEMPLATES[template_id]
    db = get_app_db()
    
    # Merge template defaults with user provided data
    conn_defaults = template.get("connection_defaults", {})
    
    conn_doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "name": conn_data.name,
        "type": conn_data.type or conn_defaults.get("type", template["type"]),
        "url": conn_data.url or conn_defaults.get("url", ""),
        "database": conn_data.database or conn_defaults.get("database", ""),
        "username": conn_data.username,
        "api_key": conn_data.api_key,
        "description": conn_data.description or f"Created from {template['name']} template",
        "template_id": template_id,
        "status": "pending",
        "health": "unknown",
        "last_test": None,
        "created_by": current_user["id"],
        "created_at": now_utc()
    }
    
    await db.connections.insert_one(conn_doc)
    
    safe_doc = {k: v for k, v in conn_doc.items() if k != 'api_key'}
    logger.info(f"Connection created from template {template_id}: {conn_data.name}")
    return serialize_doc(safe_doc)


@templates_router.get("/{template_id}/default-mappings/{source_model}")
async def get_default_mappings_from_template(
    template_id: str,
    source_model: str
):
    """Get default field mappings from a template for a specific source model"""
    if template_id not in INTEGRATION_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = INTEGRATION_TEMPLATES[template_id]
    default_mappings = template.get("default_mappings", {})
    
    if source_model not in default_mappings:
        return {"source_model": source_model, "mappings": [], "message": "No default mappings for this model"}
    
    mapping_def = default_mappings[source_model]
    return {
        "source_model": source_model,
        "target_entity": mapping_def.get("target_entity"),
        "mappings": mapping_def.get("fields", [])
    }


# ==================== AUTO-MAPPING ====================

@mappings_router.post("/auto-suggest")
async def auto_suggest_field_mappings(
    connection_id: str,
    source_model: str,
    target_entity: str = "opportunity",
    current_user: dict = Depends(get_current_user)
):
    """Auto-suggest field mappings based on source schema analysis"""
    db = get_app_db()
    
    # Get connection
    conn = await db.connections.find_one({
        "id": connection_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Get discovered schema (if available, can be used for caching)
    _schema = await db.schemas.find_one({
        "connection_id": connection_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    # Try to get source fields
    source_fields = []
    
    if conn["type"] == "odoo":
        try:
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common', allow_none=True)
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if uid:
                models_proxy = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object', allow_none=True)
                fields = models_proxy.execute_kw(
                    conn["database"], uid, conn["api_key"],
                    source_model, 'fields_get',
                    [],
                    {'attributes': ['string', 'type', 'required']}
                )
                source_fields = list(fields.keys())
        except Exception as e:
            logger.warning(f"Could not fetch fields from Odoo: {e}")
    
    # If we couldn't get fields from source, check if we have template
    template_id = conn.get("template_id")
    if not source_fields and template_id and template_id in INTEGRATION_TEMPLATES:
        template = INTEGRATION_TEMPLATES[template_id]
        default_mappings = template.get("default_mappings", {})
        if source_model in default_mappings:
            # Return template defaults
            mapping_def = default_mappings[source_model]
            return {
                "source_model": source_model,
                "target_entity": mapping_def.get("target_entity", target_entity),
                "suggestions": mapping_def.get("fields", []),
                "source": "template",
                "confidence": "high"
            }
    
    # If we have fields, use auto-suggest
    if source_fields:
        suggestions = auto_suggest_mappings(source_fields, target_entity)
        return {
            "source_model": source_model,
            "target_entity": target_entity,
            "suggestions": suggestions,
            "source": "schema_analysis",
            "confidence": "medium"
        }
    
    # Fallback: return canonical model fields for manual mapping
    if target_entity in CANONICAL_ENTITIES:
        canonical_fields = CANONICAL_ENTITIES[target_entity]["fields"]
        return {
            "source_model": source_model,
            "target_entity": target_entity,
            "suggestions": [],
            "canonical_fields": canonical_fields,
            "source": "manual",
            "confidence": "low",
            "message": "Could not auto-detect source fields. Please map manually."
        }
    
    return {"suggestions": [], "source": "none", "message": "No suggestions available"}


# ==================== SCHEMA VERIFICATION ====================

@mappings_router.post("/{mapping_id}/verify")
async def verify_mapping_schema(
    mapping_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Verify mapping schema against source and target definitions"""
    db = get_app_db()
    
    mapping = await db.mappings.find_one({
        "id": mapping_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    # Get connection
    conn = await db.connections.find_one({"id": mapping["connection_id"]})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    target_entity = mapping.get("target_entity", "opportunity")
    verification_results = {
        "mapping_id": mapping_id,
        "status": "valid",
        "errors": [],
        "warnings": [],
        "field_checks": [],
        "suggestions": []
    }
    
    # Get canonical fields for target entity
    canonical_fields = []
    required_fields = []
    if target_entity in CANONICAL_ENTITIES:
        canonical_fields = [f["name"] for f in CANONICAL_ENTITIES[target_entity]["fields"]]
        required_fields = [f["name"] for f in CANONICAL_ENTITIES[target_entity]["fields"] if f.get("required")]
    
    # Track which target fields are mapped
    mapped_targets = set()
    
    # Check each mapping rule
    for rule in mapping.get("mappings", []):
        field_check = {
            "source_field": rule.get("source_field"),
            "target_field": rule.get("target_field"),
            "transform": rule.get("transform", "direct"),
            "status": "valid"
        }
        
        target_field = rule.get("target_field")
        mapped_targets.add(target_field)
        
        # Check if target field exists in canonical model
        if canonical_fields and target_field not in canonical_fields:
            field_check["status"] = "warning"
            field_check["message"] = f"Target field '{target_field}' not in canonical model - will be stored as custom field"
            verification_results["warnings"].append(field_check["message"])
        
        verification_results["field_checks"].append(field_check)
    
    # Check required fields (only once per missing field)
    for req_field in required_fields:
        if req_field not in mapped_targets:
            msg = f"Required field '{req_field}' is not mapped"
            verification_results["errors"].append(msg)
            verification_results["status"] = "invalid"
            
            # Add suggestion for fixing
            if req_field == "canonical_id":
                verification_results["suggestions"].append({
                    "field": req_field,
                    "message": "Map your source ID field (e.g., 'id', 'Id', '_id') to 'canonical_id'",
                    "recommended_source": "id"
                })
            elif req_field == "name":
                verification_results["suggestions"].append({
                    "field": req_field,
                    "message": "Map your source name field (e.g., 'name', 'title', 'display_name') to 'name'",
                    "recommended_source": "name"
                })
    
    # Add summary
    verification_results["summary"] = {
        "total_fields": len(mapping.get("mappings", [])),
        "valid": len([f for f in verification_results["field_checks"] if f["status"] == "valid"]),
        "warnings": len(verification_results["warnings"]),
        "errors": len(verification_results["errors"])
    }
    
    logger.info(f"Mapping {mapping_id} verification: {verification_results['status']} - {len(verification_results['errors'])} errors, {len(verification_results['warnings'])} warnings")
    
    return verification_results


# ==================== DATA MODEL ====================

data_model_router = APIRouter(prefix="/data-model", tags=["data-model"])

@data_model_router.get("")
async def get_data_model(current_user: dict = Depends(get_current_user)):
    """Get the current data model graph JSON"""
    import os
    import json
    
    model_path = os.path.join(
        os.path.dirname(__file__), 
        "..", 
        "data_modeling", 
        "sales_model.graph.json"
    )
    
    try:
        with open(model_path, 'r') as f:
            model_data = json.load(f)
        return model_data
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Data model not found")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid data model JSON")


@data_model_router.put("")
async def save_data_model(
    model_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save updated data model graph JSON"""
    import os
    import json
    
    model_path = os.path.join(
        os.path.dirname(__file__), 
        "..", 
        "data_modeling", 
        "sales_model.graph.json"
    )
    
    try:
        with open(model_path, 'w') as f:
            json.dump(model_data, f, indent=2)
        return {"status": "success", "message": "Data model saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save data model: {str(e)}")


@data_model_router.post("/regenerate")
async def regenerate_data_model(current_user: dict = Depends(get_current_user)):
    """Regenerate graph.json and .mmd from YAML spec"""
    from services.data_modeling.model_generator import ModelGenerator
    
    try:
        generator = ModelGenerator()
        outputs = generator.save_outputs()
        return {
            "status": "success",
            "message": "Data model regenerated from YAML",
            "files": outputs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to regenerate model: {str(e)}")


@data_model_router.get("/yaml")
async def get_data_model_yaml(current_user: dict = Depends(get_current_user)):
    """Get the YAML spec (source of truth)"""
    import os
    
    yaml_path = os.path.join(
        os.path.dirname(__file__), 
        "..", 
        "data_modeling", 
        "sales_model.yml"
    )
    
    try:
        with open(yaml_path, 'r') as f:
            return {"yaml": f.read()}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="YAML spec not found")


@data_model_router.get("/mermaid")
async def get_data_model_mermaid(current_user: dict = Depends(get_current_user)):
    """Get the Mermaid ER diagram"""
    import os
    
    mmd_path = os.path.join(
        os.path.dirname(__file__), 
        "..", 
        "data_modeling", 
        "sales_model.mmd"
    )
    
    try:
        with open(mmd_path, 'r') as f:
            return {"mermaid": f.read()}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Mermaid diagram not found")


# ==================== VISUAL MAPPING EDITOR ENDPOINTS ====================

mapping_editor_router = APIRouter(prefix="/mapping-editor", tags=["mapping-editor"])

@mapping_editor_router.get("/config")
async def get_mapping_config(current_user: dict = Depends(get_current_user)):
    """Get saved visual mapping configuration"""
    db = get_app_db()
    
    config = await db.mapping_configs.find_one({
        "org_id": current_user.get("org_id", "default")
    })
    
    if not config:
        # Return default empty config
        return {
            "connectionId": None,
            "fieldMappings": {},
            "relationships": [],
            "scheduleConfig": None,
            "updatedAt": None
        }
    
    return serialize_doc(config)


@mapping_editor_router.put("/config")
async def save_mapping_config(
    config_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save visual mapping configuration"""
    db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    config_doc = {
        "org_id": org_id,
        "connectionId": config_data.get("connectionId"),
        "fieldMappings": config_data.get("fieldMappings", {}),
        "relationships": config_data.get("relationships", []),
        "scheduleConfig": config_data.get("scheduleConfig"),
        "updated_by": current_user["id"],
        "updated_at": now_utc()
    }
    
    await db.mapping_configs.update_one(
        {"org_id": org_id},
        {"$set": config_doc},
        upsert=True
    )
    
    logger.info(f"Mapping config saved for org {org_id}")
    return {"success": True, "message": "Mapping configuration saved"}


@mapping_editor_router.post("/preview")
async def preview_transformation(
    preview_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Preview transformation results with sample data"""
    db = get_app_db()
    
    connection_id = preview_data.get("connectionId")
    field_mappings = preview_data.get("fieldMappings", {})
    limit = preview_data.get("limit", 5)
    
    if not connection_id:
        raise HTTPException(status_code=400, detail="Connection ID required")
    
    # Get connection
    conn = await db.connections.find_one({
        "id": connection_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    preview_results = []
    
    # For each mapping pair, fetch sample data and transform
    for mapping_key, mappings in field_mappings.items():
        if not mappings:
            continue
            
        parts = mapping_key.split("__")
        if len(parts) != 2:
            continue
            
        source_model, target_entity = parts
        
        try:
            if conn["type"] == "odoo":
                common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common', allow_none=True)
                uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
                
                if not uid:
                    continue
                
                models_proxy = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object', allow_none=True)
                
                # Get source fields from mappings
                source_fields = list(set([m.get("sourceField") for m in mappings if m.get("sourceField")]))
                if not source_fields:
                    source_fields = ['id', 'name']
                
                # Fetch sample records
                records = models_proxy.execute_kw(
                    conn["database"], uid, conn["api_key"],
                    source_model, 'search_read',
                    [[]],
                    {'fields': source_fields, 'limit': limit}
                )
                
                # Transform records
                for record in records:
                    source_data = {}
                    transformed_data = {}
                    
                    for field in source_fields:
                        value = record.get(field)
                        # Handle Odoo relational fields
                        if isinstance(value, list) and len(value) == 2:
                            source_data[field] = f"{value[0]} ({value[1]})"
                        elif isinstance(value, list) and len(value) > 2:
                            source_data[field] = f"[{len(value)} items]"
                        else:
                            source_data[field] = value
                    
                    # Apply mappings
                    for mapping in mappings:
                        source_field = mapping.get("sourceField")
                        target_field = mapping.get("targetField")
                        transform = mapping.get("transform", "direct")
                        
                        if source_field and target_field:
                            value = record.get(source_field)
                            
                            # Apply transformation
                            if transform == "extract_id" and isinstance(value, list) and len(value) >= 1:
                                value = str(value[0])
                            elif transform == "extract_name" and isinstance(value, list) and len(value) >= 2:
                                value = value[1]
                            elif transform == "to_float":
                                try:
                                    value = float(value) if value else 0.0
                                except (ValueError, TypeError):
                                    value = 0.0
                            elif transform == "to_int":
                                try:
                                    value = int(value) if value else 0
                                except (ValueError, TypeError):
                                    value = 0
                            elif transform == "to_bool":
                                value = bool(value)
                            
                            transformed_data[target_field] = value
                    
                    preview_results.append({
                        "sourceModel": source_model,
                        "targetEntity": target_entity,
                        "source": source_data,
                        "transformed": transformed_data
                    })
                    
        except Exception as e:
            logger.error(f"Preview failed for {source_model}: {e}")
            preview_results.append({
                "sourceModel": source_model,
                "targetEntity": target_entity,
                "error": str(e)
            })
    
    return {
        "connectionId": connection_id,
        "previewCount": len(preview_results),
        "results": preview_results
    }


def apply_transform(value, transform, target_field):
    """Apply a transformation to a value based on the transform type.
    
    Based on Odoo schema analysis from 15 PDF documents:
    - Many2one fields return [id, name] tuples
    - Many2many/One2many return list of IDs
    - HTML fields may need stripping
    """
    if value is None:
        return None
    
    if transform == "direct":
        return value
    
    if transform == "to_string":
        return str(value) if value is not None else None
    
    if transform == "to_string_array":
        if isinstance(value, list):
            return [str(v) for v in value]
        return []
    
    if transform == "extract_id":
        # Many2one fields return [id, name]
        if isinstance(value, list) and len(value) >= 1:
            return str(value[0])
        elif isinstance(value, (int, str)):
            return str(value)
        return None
    
    if transform == "extract_name":
        # Many2one fields return [id, name]
        if isinstance(value, list) and len(value) >= 2:
            return value[1]
        elif isinstance(value, str):
            return value
        return None
    
    if transform == "first_id":
        # Get first ID from many2many array
        if isinstance(value, list) and len(value) > 0:
            first = value[0]
            if isinstance(first, list) and len(first) >= 1:
                return str(first[0])
            return str(first)
        return None
    
    if transform == "first_name":
        # Get first name from many2many array
        if isinstance(value, list) and len(value) > 0:
            first = value[0]
            if isinstance(first, list) and len(first) >= 2:
                return first[1]
            return str(first) if first else None
        return None
    
    if transform == "strip_html":
        # Remove HTML tags from text
        if isinstance(value, str):
            clean = re.sub(r'<[^>]+>', '', value)
            return clean.strip()
        return value
    
    if transform == "to_float":
        try:
            return float(value) if value else 0.0
        except (ValueError, TypeError):
            return 0.0
    
    if transform == "to_int":
        try:
            return int(value) if value else 0
        except (ValueError, TypeError):
            return 0
    
    if transform == "to_bool":
        return bool(value)
    
    if transform.startswith("equals:"):
        # Return true if value equals the specified value
        expected = transform.split(":", 1)[1]
        return str(value) == expected if value else False
    
    if transform.startswith("not_equals:"):
        # Return true if value does not equal the specified value
        expected = transform.split(":", 1)[1]
        return str(value) != expected if value is not None else True
    
    # Default: handle many2one tuples
    if isinstance(value, list) and len(value) == 2:
        return value[1] if target_field.endswith("_name") else str(value[0])
    
    return value


# Entity-specific source filters based on Odoo schema analysis
ENTITY_SOURCE_FILTERS = {
    "account": [("is_company", "=", True)],  # res.partner where is_company=True
    "contact": [("is_company", "=", False)],  # res.partner where is_company=False
    "invoice": [("move_type", "in", ["out_invoice", "out_refund"])],  # account.move customer invoices
    "opportunity": [],  # crm.lead (can optionally filter by type='opportunity')
}


@mapping_editor_router.post("/sync")
async def run_mapping_sync(
    sync_data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Run ETL sync using the visual mapping configuration.
    
    Enhanced with:
    - Entity-specific source filters (e.g., is_company=True for accounts)
    - Full transform support from Odoo schema analysis
    - Better error handling and logging
    """
    db = get_app_db()
    
    connection_id = sync_data.get("connectionId")
    field_mappings = sync_data.get("fieldMappings", {})
    
    if not connection_id:
        raise HTTPException(status_code=400, detail="Connection ID required")
    
    if not field_mappings:
        raise HTTPException(status_code=400, detail="No field mappings configured")
    
    # Get both databases
    canonical_db = get_canonical_db()
    
    # Get connection
    conn = await db.connections.find_one({
        "id": connection_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Create run record
    run_id = generate_id()
    correlation_id = generate_correlation_id()
    org_id = current_user.get("org_id", "default")
    
    # Entity to collection name mapping for canonical database
    ENTITY_COLLECTION_MAP = {
        "opportunity": "opportunities",
        "account": "accounts",
        "contact": "contacts",
        "activity": "activities",
        "invoice": "invoices",
        "task": "tasks",
        "employee": "employees",
        "sales_team": "sales_teams",
        "sales_user": "sales_users",
    }
    
    run_doc = {
        "id": run_id,
        "org_id": org_id,
        "correlation_id": correlation_id,
        "connection_id": connection_id,
        "status": RunStatus.RUNNING,
        "trigger_type": "visual_mapping_editor",
        "started_at": now_utc(),
        "started_by": current_user["id"],
        "extracted_count": 0,
        "transformed_count": 0,
        "loaded_count": 0,
        "error_count": 0,
        "logs": [],
        "entity_stats": {}
    }
    
    await db.pipeline_runs.insert_one(run_doc)
    
    # Process each mapping pair synchronously (for MVP - background task for production)
    total_processed = 0
    entity_stats = {}
    errors = []
    
    try:
        if conn["type"] == "odoo":
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common', allow_none=True)
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if not uid:
                raise Exception("Odoo authentication failed")
            
            models_proxy = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object', allow_none=True)
            
            for mapping_key, mappings in field_mappings.items():
                if not mappings:
                    continue
                
                parts = mapping_key.split("__")
                if len(parts) != 2:
                    continue
                
                source_model, target_entity = parts
                
                try:
                    # Get source fields
                    source_fields = list(set(["id"] + [m.get("sourceField") for m in mappings if m.get("sourceField")]))
                    
                    # Apply entity-specific filters
                    domain_filter = ENTITY_SOURCE_FILTERS.get(target_entity, [])
                    
                    # Fetch all records (with limit for safety)
                    records = models_proxy.execute_kw(
                        conn["database"], uid, conn["api_key"],
                        source_model, 'search_read',
                        [domain_filter],
                        {'fields': source_fields, 'limit': 1000}
                    )
                    
                    logger.info(f"Fetched {len(records)} records from {source_model} (filter: {domain_filter})")
                    
                    entity_count = 0
                    
                    for record in records:
                        transformed = {
                            "org_id": org_id,
                            "source_system": "odoo",
                            "source_model": source_model,
                            "source_record_id": str(record.get("id")),
                            "canonical_id": f"odoo_{target_entity}_{record.get('id')}",
                            "synced_at": now_utc()
                        }
                        
                        # Apply field mappings with enhanced transforms
                        for mapping in mappings:
                            source_field = mapping.get("sourceField")
                            target_field = mapping.get("targetField")
                            transform = mapping.get("transform", "direct")
                            
                            if source_field and target_field:
                                value = record.get(source_field)
                                transformed[target_field] = apply_transform(value, transform, target_field)
                        
                        # Upsert to canonical database (not app_db)
                        collection_name = ENTITY_COLLECTION_MAP.get(target_entity, f"{target_entity}s")
                        await canonical_db[collection_name].update_one(
                            {"canonical_id": transformed["canonical_id"]},
                            {"$set": transformed},
                            upsert=True
                        )
                        entity_count += 1
                    
                    entity_stats[target_entity] = entity_stats.get(target_entity, 0) + entity_count
                    total_processed += entity_count
                    
                except Exception as e:
                    logger.error(f"Sync failed for {source_model} -> {target_entity}: {e}")
                    errors.append(f"{source_model}: {str(e)}")
        
        # Update run status
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": RunStatus.COMPLETED if not errors else RunStatus.COMPLETED_WITH_ERRORS,
                "completed_at": now_utc(),
                "loaded_count": total_processed,
                "entity_stats": entity_stats,
                "errors": errors
            }}
        )
        
        return {
            "runId": run_id,
            "status": "completed" if not errors else "completed_with_errors",
            "recordsProcessed": total_processed,
            "entityStats": entity_stats,
            "errors": errors if errors else None
        }
        
    except Exception as e:
        # Update run as failed
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": RunStatus.FAILED,
                "completed_at": now_utc(),
                "error": str(e)
            }}
        )
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@mapping_editor_router.get("/sync/status/{connection_id}")
async def get_sync_status(
    connection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get sync status for a connection"""
    db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get last run for this connection
    last_run = await db.pipeline_runs.find_one(
        {
            "connection_id": connection_id,
            "org_id": org_id
        },
        sort=[("started_at", -1)]
    )
    
    # Entity to collection name mapping
    entity_collections = {
        "opportunity": "opportunities",
        "account": "accounts", 
        "contact": "contacts",
        "invoice": "invoices",
        "activity": "activities",
        "task": "tasks"
    }
    
    # Get canonical collection stats from the correct database
    entity_counts = {}
    for entity, collection_name in entity_collections.items():
        try:
            count = await canonical_db[collection_name].count_documents({"org_id": org_id})
            entity_counts[entity] = count
        except Exception:
            entity_counts[entity] = 0
    
    return {
        "connectionId": connection_id,
        "lastSync": last_run.get("completed_at") if last_run else None,
        "lastRunStatus": last_run.get("status") if last_run else None,
        "lastRunId": last_run.get("id") if last_run else None,
        "entityCounts": entity_counts,
        "totalRecords": sum(entity_counts.values())
    }


@mapping_editor_router.get("/entities")
async def get_canonical_entities(current_user: dict = Depends(get_current_user)):
    """Get canonical entity definitions from YAML spec"""
    import os
    
    yaml_path = os.path.join(
        os.path.dirname(__file__), 
        "..", 
        "data_modeling", 
        "sales_model.yml"
    )
    
    try:
        with open(yaml_path, 'r') as f:
            spec = yaml.safe_load(f)
        
        entities = []
        for entity_id, entity_def in spec.get("entities", {}).items():
            fields = []
            for field_name, field_def in entity_def.get("fields", {}).items():
                fields.append({
                    "name": field_name,
                    "type": field_def.get("type", "string"),
                    "required": field_def.get("required", False),
                    "description": field_def.get("description", ""),
                    "pk": field_name == "canonical_id",
                    "fk": field_def.get("description", "").startswith("FK to ") and field_def.get("description", "").replace("FK to ", "").split()[0] or None
                })
            
            entities.append({
                "id": entity_id,
                "label": entity_def.get("label", entity_id.title()),
                "description": entity_def.get("description", ""),
                "sourceModels": entity_def.get("source_models", []),
                "fields": fields
            })
        
        return {"entities": entities}
        
    except FileNotFoundError:
        # Return default entities
        return {"entities": list(CANONICAL_ENTITIES.keys())}

