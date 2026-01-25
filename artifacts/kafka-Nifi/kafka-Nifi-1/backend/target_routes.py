"""Target Connection Routes"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime, timezone
import jwt
import logging

from loaders import LoaderFactory

router = APIRouter(prefix="/api", tags=["targets"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'esip_db')]

logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get('JWT_SECRET', 'esip-pipeline-secret-key')
JWT_ALGORITHM = 'HS256'

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security = HTTPBearer(auto_error=False)

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
                # Only use _id as 'id' if there's no explicit 'id' field
                if 'id' not in doc:
                    result['id'] = str(v)
                # Skip _id otherwise
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

# ==================== MODELS ====================

class TargetConnectionCreate(BaseModel):
    name: str
    type: str  # mongodb, postgresql, mysql, api
    host: str
    port: int
    database: str
    username: Optional[str] = None
    password: Optional[str] = None
    # For API type
    url: Optional[str] = None
    api_key: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    # Additional options
    schema_name: Optional[str] = "public"  # For PostgreSQL
    table_prefix: Optional[str] = ""
    ssl_enabled: bool = False
    extra_options: Optional[Dict[str, Any]] = None

class TargetConnectionUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    url: Optional[str] = None
    api_key: Optional[str] = None
    schema_name: Optional[str] = None
    table_prefix: Optional[str] = None
    ssl_enabled: Optional[bool] = None

# ==================== TARGET CRUD ====================

@router.get("/targets/types")
async def get_supported_target_types():
    """Get list of supported target database types"""
    return {
        "types": [
            {
                "id": "mongodb",
                "name": "MongoDB",
                "icon": "database",
                "description": "NoSQL document database",
                "default_port": 27017
            },
            {
                "id": "postgresql",
                "name": "PostgreSQL",
                "icon": "database",
                "description": "Advanced open-source relational database",
                "default_port": 5432
            },
            {
                "id": "mysql",
                "name": "MySQL",
                "icon": "database",
                "description": "Popular open-source relational database",
                "default_port": 3306
            },
            {
                "id": "api",
                "name": "REST API",
                "icon": "globe",
                "description": "Push data to external REST API endpoint",
                "default_port": 443
            }
        ]
    }

@router.post("/targets")
async def create_target(target: TargetConnectionCreate, user: dict = Depends(get_current_user)):
    """Create a new target connection"""
    target_doc = {
        "id": str(uuid.uuid4()),
        "name": target.name,
        "type": target.type,
        "host": target.host,
        "port": target.port,
        "database": target.database,
        "username": target.username,
        "password": target.password,  # TODO: Encrypt in production
        "url": target.url,
        "api_key": target.api_key,
        "headers": target.headers or {},
        "schema_name": target.schema_name,
        "table_prefix": target.table_prefix,
        "ssl_enabled": target.ssl_enabled,
        "extra_options": target.extra_options or {},
        "status": "pending",
        "health": "unknown",
        "last_test": None,
        "created_by": user["sub"],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.targets.insert_one(target_doc)
    
    # Return without sensitive data
    safe_doc = {k: v for k, v in target_doc.items() if k not in ['password', 'api_key']}
    return serialize_doc(safe_doc)

@router.get("/targets")
async def list_targets(user: dict = Depends(get_current_user)):
    """List all target connections"""
    targets = await db.targets.find().to_list(100)
    # Remove sensitive data
    safe_targets = [
        {k: v for k, v in t.items() if k not in ['password', 'api_key']}
        for t in targets
    ]
    return serialize_doc(safe_targets)

@router.get("/targets/{target_id}")
async def get_target(target_id: str, user: dict = Depends(get_current_user)):
    """Get a specific target connection"""
    target = await db.targets.find_one({"id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    safe_doc = {k: v for k, v in target.items() if k not in ['password', 'api_key']}
    return serialize_doc(safe_doc)

@router.put("/targets/{target_id}")
async def update_target(target_id: str, update: TargetConnectionUpdate, user: dict = Depends(get_current_user)):
    """Update a target connection"""
    target = await db.targets.find_one({"id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.targets.update_one({"id": target_id}, {"$set": update_data})
    
    updated = await db.targets.find_one({"id": target_id})
    safe_doc = {k: v for k, v in updated.items() if k not in ['password', 'api_key']}
    return serialize_doc(safe_doc)

@router.delete("/targets/{target_id}")
async def delete_target(target_id: str, user: dict = Depends(get_current_user)):
    """Delete a target connection"""
    result = await db.targets.delete_one({"id": target_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Target not found")
    return {"status": "deleted"}

# ==================== TARGET TESTING ====================

@router.post("/targets/{target_id}/test")
async def test_target(target_id: str, user: dict = Depends(get_current_user)):
    """Test a target connection"""
    target = await db.targets.find_one({"id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    try:
        loader = LoaderFactory.get_loader(target["type"])
        
        # Build config for the loader
        config = {
            "host": target["host"],
            "port": target["port"],
            "database": target["database"],
            "username": target.get("username"),
            "password": target.get("password"),
            "url": target.get("url"),
            "api_key": target.get("api_key"),
            "headers": target.get("headers", {}),
        }
        
        connected = await loader.connect(config)
        if not connected:
            raise Exception("Connection failed")
        
        test_result = await loader.test_connection()
        await loader.disconnect()
        
        # Update target status
        status = "active" if test_result["status"] == "healthy" else "error"
        await db.targets.update_one(
            {"id": target_id},
            {"$set": {
                "status": status,
                "health": test_result["status"],
                "last_test": datetime.now(timezone.utc),
                "version": test_result.get("version")
            }}
        )
        
        return test_result
        
    except Exception as e:
        await db.targets.update_one(
            {"id": target_id},
            {"$set": {
                "status": "error",
                "health": "unhealthy",
                "last_test": datetime.now(timezone.utc),
                "error": str(e)
            }}
        )
        return {"status": "unhealthy", "message": str(e)}

# ==================== TARGET SCHEMA DISCOVERY ====================

@router.post("/targets/{target_id}/discover")
async def discover_target_schema(target_id: str, user: dict = Depends(get_current_user)):
    """Discover schema from target database"""
    target = await db.targets.find_one({"id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    try:
        loader = LoaderFactory.get_loader(target["type"])
        config = {
            "host": target["host"],
            "port": target["port"],
            "database": target["database"],
            "username": target.get("username"),
            "password": target.get("password"),
        }
        
        await loader.connect(config)
        schema = await loader.discover_schema()
        await loader.disconnect()
        
        # Save discovered schema
        schema_doc = {
            "id": str(uuid.uuid4()),
            "target_id": target_id,
            "discovered_at": datetime.now(timezone.utc),
            "tables": schema.get("tables", []),
            "type": "target"
        }
        
        await db.target_schemas.update_one(
            {"target_id": target_id},
            {"$set": schema_doc},
            upsert=True
        )
        
        return serialize_doc(schema_doc)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/targets/{target_id}/schema")
async def get_target_schema(target_id: str, user: dict = Depends(get_current_user)):
    """Get discovered schema for a target"""
    schema = await db.target_schemas.find_one({"target_id": target_id})
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not discovered yet")
    return serialize_doc(schema)

@router.get("/targets/{target_id}/schema/{table_name}/fields")
async def get_target_table_fields(target_id: str, table_name: str, user: dict = Depends(get_current_user)):
    """Get fields for a specific table in target database"""
    target = await db.targets.find_one({"id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    try:
        loader = LoaderFactory.get_loader(target["type"])
        config = {
            "host": target["host"],
            "port": target["port"],
            "database": target["database"],
            "username": target.get("username"),
            "password": target.get("password"),
        }
        
        await loader.connect(config)
        schema = await loader.discover_schema(table_name)
        await loader.disconnect()
        
        return schema
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SCHEMA MATCHING ====================

@router.post("/schema/match")
async def match_schemas(
    source_connection_id: str,
    source_model: str,
    target_id: str,
    target_table: str,
    user: dict = Depends(get_current_user)
):
    """Match schemas between source and target and generate mapping suggestions"""
    from matching import MappingSuggester
    
    # Get source schema (from Odoo connection)
    source_schema = await db.schemas.find_one({"connection_id": source_connection_id})
    if not source_schema:
        raise HTTPException(status_code=404, detail="Source schema not found. Run discovery first.")
    
    # Get source model fields from Odoo
    connection = await db.connections.find_one({"id": source_connection_id})
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Fetch source fields
    import xmlrpc.client
    common = xmlrpc.client.ServerProxy(f'{connection["url"]}/xmlrpc/2/common')
    uid = common.authenticate(connection["database"], connection["username"], connection["api_key"], {})
    
    if not uid:
        raise HTTPException(status_code=401, detail="Odoo authentication failed")
    
    models_proxy = xmlrpc.client.ServerProxy(f'{connection["url"]}/xmlrpc/2/object')
    source_fields_raw = models_proxy.execute_kw(
        connection["database"], uid, connection["api_key"],
        source_model, 'fields_get',
        [],
        {'attributes': ['string', 'type', 'required', 'relation']}
    )
    
    source_fields = [
        {"name": name, "type": info.get("type", "char"), "label": info.get("string", name)}
        for name, info in source_fields_raw.items()
    ]
    
    # Get target schema
    target = await db.targets.find_one({"id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    try:
        loader = LoaderFactory.get_loader(target["type"])
        config = {
            "host": target["host"],
            "port": target["port"],
            "database": target["database"],
            "username": target.get("username"),
            "password": target.get("password"),
        }
        
        await loader.connect(config)
        target_schema = await loader.discover_schema(target_table)
        await loader.disconnect()
        
        target_fields = target_schema.get("columns", [])
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get target schema: {e}")
    
    # Run schema matching
    suggester = MappingSuggester(confidence_threshold=0.4)
    suggestions = suggester.suggest_mappings(source_fields, target_fields)
    
    return {
        "source": {
            "connection_id": source_connection_id,
            "model": source_model,
            "field_count": len(source_fields)
        },
        "target": {
            "target_id": target_id,
            "table": target_table,
            "field_count": len(target_fields)
        },
        "suggestions": suggestions
    }
