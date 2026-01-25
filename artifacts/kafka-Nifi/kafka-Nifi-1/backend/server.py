from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import json
import xmlrpc.client
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'esip_db')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'esip-pipeline-secret-key')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

app = FastAPI(title="ESIP - Data Pipeline Platform", version="2.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class ConnectionCreate(BaseModel):
    name: str
    type: str = "odoo"  # odoo, postgres, mysql, etc.
    url: str
    database: str
    username: str
    api_key: str

class MappingCreate(BaseModel):
    name: str
    connection_id: str
    source_model: str
    mappings: List[Dict[str, str]]  # [{source_field, target_field, transform}]

class PipelineCreate(BaseModel):
    name: str
    connection_id: str
    mapping_id: str
    schedule: Optional[str] = None  # cron expression
    config: Dict[str, Any] = {}

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except:
        return None

# ==================== UTILITY FUNCTIONS ====================

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

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": user.email,
        "password": hash_password(user.password),
        "name": user.name,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_doc["id"], user_doc["email"])
    return TokenResponse(
        access_token=token,
        user={"id": user_doc["id"], "email": user_doc["email"], "name": user_doc["name"]}
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"])
    return TokenResponse(
        access_token=token,
        user={"id": user["id"], "email": user["email"], "name": user["name"]}
    )

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": user["sub"]})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user roles
    role_ids = user_doc.get("role_ids", [])
    roles = []
    permissions = []
    
    if role_ids:
        role_docs = await db.roles.find({"id": {"$in": role_ids}, "is_active": True}).to_list(100)
        for r in role_docs:
            roles.append({
                "id": r["id"],
                "name": r["name"],
                "display_name": r["display_name"]
            })
            permissions.extend(r.get("permissions", []))
    
    # Super admin has all permissions
    if user_doc.get("is_super_admin"):
        from rbac.permissions import ALL_PERMISSIONS
        permissions = ALL_PERMISSIONS
    else:
        permissions = list(set(permissions))  # Remove duplicates
    
    result = {
        "id": user_doc["id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "roles": roles,
        "permissions": permissions,
        "is_super_admin": user_doc.get("is_super_admin", False),
        "is_active": user_doc.get("is_active", True),
        "created_at": user_doc.get("created_at")
    }
    return serialize_doc(result)

# ==================== CONNECTION ROUTES ====================

@api_router.post("/connections")
async def create_connection(conn: ConnectionCreate, user: dict = Depends(get_current_user)):
    conn_doc = {
        "id": str(uuid.uuid4()),
        "name": conn.name,
        "type": conn.type,
        "url": conn.url,
        "database": conn.database,
        "username": conn.username,
        "api_key": conn.api_key,  # In production, encrypt this!
        "status": "pending",
        "health": "unknown",
        "last_test": None,
        "created_by": user["sub"],
        "created_at": datetime.now(timezone.utc)
    }
    await db.connections.insert_one(conn_doc)
    # Return without api_key for security
    safe_doc = {k: v for k, v in conn_doc.items() if k != 'api_key'}
    return serialize_doc(safe_doc)

@api_router.get("/connections")
async def list_connections(user: dict = Depends(get_current_user)):
    connections = await db.connections.find().to_list(100)
    # Remove api_key from response
    return serialize_doc([{k: v for k, v in c.items() if k != 'api_key'} for c in connections])

@api_router.get("/connections/{conn_id}")
async def get_connection(conn_id: str, user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": conn_id})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    safe_doc = {k: v for k, v in conn.items() if k != 'api_key'}
    return serialize_doc(safe_doc)

@api_router.post("/connections/{conn_id}/test")
async def test_connection(conn_id: str, user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": conn_id})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        if conn["type"] == "odoo":
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common')
            version = common.version()
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if uid:
                await db.connections.update_one(
                    {"id": conn_id},
                    {"$set": {"status": "active", "health": "healthy", "last_test": datetime.now(timezone.utc), "odoo_version": version.get('server_version')}}
                )
                return {"status": "success", "health": "healthy", "message": f"Connected to Odoo {version.get('server_version')}", "user_id": uid}
            else:
                await db.connections.update_one(
                    {"id": conn_id},
                    {"$set": {"status": "error", "health": "unhealthy", "last_test": datetime.now(timezone.utc)}}
                )
                return {"status": "error", "health": "unhealthy", "message": "Authentication failed"}
        else:
            return {"status": "error", "message": f"Connection type {conn['type']} not supported"}
    except Exception as e:
        await db.connections.update_one(
            {"id": conn_id},
            {"$set": {"status": "error", "health": "unhealthy", "last_test": datetime.now(timezone.utc), "error": str(e)}}
        )
        return {"status": "error", "health": "unhealthy", "message": str(e)}

@api_router.delete("/connections/{conn_id}")
async def delete_connection(conn_id: str, user: dict = Depends(get_current_user)):
    result = await db.connections.delete_one({"id": conn_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"status": "deleted"}

# ==================== SCHEMA DISCOVERY ROUTES ====================

@api_router.post("/connections/{conn_id}/discover")
async def discover_schema(conn_id: str, user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": conn_id})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        if conn["type"] == "odoo":
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common')
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if not uid:
                raise HTTPException(status_code=401, detail="Odoo authentication failed")
            
            models_proxy = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object')
            
            # Discover CRM models
            crm_models = models_proxy.execute_kw(
                conn["database"], uid, conn["api_key"],
                'ir.model', 'search_read',
                [[['model', 'like', 'crm.%']]],
                {'fields': ['model', 'name'], 'limit': 50}
            )
            
            # Also get res.partner and res.users
            other_models = models_proxy.execute_kw(
                conn["database"], uid, conn["api_key"],
                'ir.model', 'search_read',
                [[['model', 'in', ['res.partner', 'res.users', 'res.company']]]],
                {'fields': ['model', 'name']}
            )
            
            all_models = crm_models + other_models
            
            # Save schema discovery
            schema_doc = {
                "id": str(uuid.uuid4()),
                "connection_id": conn_id,
                "discovered_at": datetime.now(timezone.utc),
                "models": [{"model": m['model'], "name": m['name']} for m in all_models]
            }
            
            # Upsert schema
            await db.schemas.update_one(
                {"connection_id": conn_id},
                {"$set": schema_doc},
                upsert=True
            )
            
            return serialize_doc(schema_doc)
        else:
            raise HTTPException(status_code=400, detail=f"Schema discovery not supported for {conn['type']}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/connections/{conn_id}/schema")
async def get_schema(conn_id: str, user: dict = Depends(get_current_user)):
    schema = await db.schemas.find_one({"connection_id": conn_id})
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not discovered yet")
    return serialize_doc(schema)

@api_router.get("/connections/{conn_id}/schema/{model_name}/fields")
async def get_model_fields(conn_id: str, model_name: str, user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": conn_id})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        if conn["type"] == "odoo":
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common')
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if not uid:
                raise HTTPException(status_code=401, detail="Odoo authentication failed")
            
            models_proxy = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object')
            
            fields = models_proxy.execute_kw(
                conn["database"], uid, conn["api_key"],
                model_name, 'fields_get',
                [],
                {'attributes': ['string', 'type', 'required', 'relation', 'help']}
            )
            
            return {"model": model_name, "fields": fields}
        else:
            raise HTTPException(status_code=400, detail=f"Field discovery not supported for {conn['type']}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== CANONICAL MODEL ====================

@api_router.get("/canonical-model")
async def get_canonical_model():
    return {
        "version": "1.0",
        "entities": [
            {
                "name": "opportunity",
                "fields": [
                    {"name": "opportunity_id", "type": "string", "required": True},
                    {"name": "name", "type": "string", "required": True},
                    {"name": "amount", "type": "number", "required": False},
                    {"name": "stage", "type": "string", "required": False},
                    {"name": "probability", "type": "number", "required": False},
                    {"name": "is_closed", "type": "boolean", "required": False},
                    {"name": "is_won", "type": "boolean", "required": False},
                    {"name": "owner_user_id", "type": "string", "required": False},
                    {"name": "owner_name", "type": "string", "required": False},
                    {"name": "contact_email", "type": "string", "required": False},
                    {"name": "contact_phone", "type": "string", "required": False},
                    {"name": "created_at", "type": "datetime", "required": False},
                    {"name": "updated_at", "type": "datetime", "required": False},
                    {"name": "closed_at", "type": "datetime", "required": False}
                ]
            },
            {
                "name": "contact",
                "fields": [
                    {"name": "contact_id", "type": "string", "required": True},
                    {"name": "name", "type": "string", "required": True},
                    {"name": "email", "type": "string", "required": False},
                    {"name": "phone", "type": "string", "required": False},
                    {"name": "company", "type": "string", "required": False}
                ]
            },
            {
                "name": "user",
                "fields": [
                    {"name": "user_id", "type": "string", "required": True},
                    {"name": "name", "type": "string", "required": True},
                    {"name": "email", "type": "string", "required": False},
                    {"name": "team", "type": "string", "required": False}
                ]
            }
        ]
    }

# Include router
app.include_router(api_router)

# Import and include pipeline routes
from pipeline_routes import router as pipeline_router
app.include_router(pipeline_router)

# Import and include KPI routes
from kpi_routes import router as kpi_router
app.include_router(kpi_router)

# Import and include webhook routes
from webhook_routes import router as webhook_router
app.include_router(webhook_router)

# Import and include target routes
from target_routes import router as target_router
app.include_router(target_router)

# Import and include schema library routes
from schema_library.routes import router as schema_library_router
app.include_router(schema_library_router)

# Import and include target templates routes
from target_templates.routes import router as target_templates_router
app.include_router(target_templates_router)

# Import and include RBAC routes
from rbac.routes import router as rbac_router
app.include_router(rbac_router)

# Import scheduler
from scheduler import scheduler as pipeline_scheduler

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize scheduler and load scheduled pipelines"""
    logger.info("Starting ESIP Data Pipeline Platform v2.0")
    
    # Start the scheduler
    pipeline_scheduler.start()
    
    # Load existing scheduled pipelines
    pipelines = await db.pipelines.find({
        "schedule_enabled": True,
        "schedule_type": {"$in": ["interval", "cron"]}
    }).to_list(100)
    
    for pipeline in pipelines:
        try:
            schedule_config = {}
            if pipeline.get("schedule_type") == "cron":
                schedule_config["expression"] = pipeline.get("cron_expression", "0 * * * *")
            else:
                schedule_config["minutes"] = pipeline.get("interval_minutes", 60)
            
            await pipeline_scheduler.add_pipeline_job(
                pipeline["id"],
                pipeline["schedule_type"],
                schedule_config
            )
            logger.info(f"Loaded scheduled pipeline: {pipeline['name']}")
        except Exception as e:
            logger.error(f"Failed to load scheduled pipeline {pipeline['id']}: {e}")
    
    logger.info(f"Loaded {len(pipelines)} scheduled pipelines")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    pipeline_scheduler.shutdown()
    client.close()
    logger.info("ESIP Platform shutdown complete")
