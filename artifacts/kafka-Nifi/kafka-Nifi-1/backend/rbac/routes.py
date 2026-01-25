"""RBAC API Routes"""
from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional
import uuid
import bcrypt
from datetime import datetime, timezone
import os

from .models import (
    Role, RoleCreate, RoleUpdate, 
    UserCreate, UserUpdate, UserResponse
)
from .permissions import (
    PERMISSIONS, get_all_permissions, get_permissions_by_category,
    DEFAULT_ROLES, check_permission, get_user_permissions, ALL_PERMISSIONS
)

router = APIRouter(prefix="/api/admin", tags=["Admin & RBAC"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'esip_db')]


def serialize_doc(doc):
    """Serialize MongoDB document"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if k == '_id':
                continue
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


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ==================== AUTH DEPENDENCY ====================

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

JWT_SECRET = os.environ.get('JWT_SECRET', 'esip-pipeline-secret-key')
JWT_ALGORITHM = 'HS256'
security = HTTPBearer(auto_error=False)


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


async def require_admin_access(user: dict = Depends(get_current_user)):
    """Require user management permission or super admin"""
    user_doc = await db.users.find_one({"id": user["sub"]})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Super admin always has access
    if user_doc.get("is_super_admin"):
        return user
    
    # Check for user management permission
    has_permission = await check_permission(db, user["sub"], "users.view")
    if not has_permission:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user


# ==================== INITIALIZATION ====================

@router.post("/init")
async def initialize_rbac(user: dict = Depends(get_current_user)):
    """
    Initialize RBAC system with default roles.
    Creates default roles if they don't exist.
    First user to call this becomes super admin.
    """
    # Check if roles already exist
    existing_roles = await db.roles.count_documents({})
    
    if existing_roles == 0:
        # Create default roles
        for role_data in DEFAULT_ROLES:
            role_doc = {
                "id": str(uuid.uuid4()),
                **role_data,
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            await db.roles.insert_one(role_doc)
    
    # Check if there's a super admin
    super_admin = await db.users.find_one({"is_super_admin": True})
    
    if not super_admin:
        # Make current user super admin
        await db.users.update_one(
            {"id": user["sub"]},
            {"$set": {"is_super_admin": True}}
        )
        return {
            "status": "initialized",
            "message": "RBAC initialized. You are now Super Admin.",
            "roles_created": len(DEFAULT_ROLES) if existing_roles == 0 else 0
        }
    
    return {
        "status": "already_initialized",
        "message": "RBAC already initialized",
        "roles_count": await db.roles.count_documents({})
    }


# ==================== PERMISSION ROUTES ====================

@router.get("/permissions")
async def list_permissions(user: dict = Depends(get_current_user)):
    """List all available permissions"""
    return {
        "permissions": [p.to_dict() for p in get_all_permissions()],
        "by_category": get_permissions_by_category()
    }


@router.get("/permissions/my")
async def get_my_permissions(user: dict = Depends(get_current_user)):
    """Get current user's permissions"""
    permissions = await get_user_permissions(db, user["sub"])
    user_doc = await db.users.find_one({"id": user["sub"]})
    
    return {
        "user_id": user["sub"],
        "is_super_admin": user_doc.get("is_super_admin", False) if user_doc else False,
        "permissions": permissions,
        "count": len(permissions)
    }


# ==================== ROLE ROUTES ====================

@router.get("/roles")
async def list_roles(user: dict = Depends(require_admin_access)):
    """List all roles"""
    roles = await db.roles.find({"is_active": True}).to_list(100)
    return {
        "roles": serialize_doc(roles),
        "count": len(roles)
    }


@router.get("/roles/{role_id}")
async def get_role(role_id: str, user: dict = Depends(require_admin_access)):
    """Get a specific role"""
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return serialize_doc(role)


@router.post("/roles")
async def create_role(role: RoleCreate, user: dict = Depends(require_admin_access)):
    """Create a new role"""
    # Check permission
    if not await check_permission(db, user["sub"], "roles.create"):
        user_doc = await db.users.find_one({"id": user["sub"]})
        if not user_doc.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Permission denied: roles.create required")
    
    # Check if role name exists
    existing = await db.roles.find_one({"name": role.name})
    if existing:
        raise HTTPException(status_code=400, detail=f"Role '{role.name}' already exists")
    
    # Validate permissions
    invalid_perms = [p for p in role.permissions if p not in PERMISSIONS]
    if invalid_perms:
        raise HTTPException(status_code=400, detail=f"Invalid permissions: {invalid_perms}")
    
    role_doc = {
        "id": str(uuid.uuid4()),
        "name": role.name,
        "display_name": role.display_name,
        "description": role.description,
        "permissions": role.permissions,
        "is_system": False,  # Custom roles are never system roles
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": user["sub"]
    }
    
    await db.roles.insert_one(role_doc)
    return serialize_doc(role_doc)


@router.put("/roles/{role_id}")
async def update_role(role_id: str, role: RoleUpdate, user: dict = Depends(require_admin_access)):
    """Update a role"""
    # Check permission
    if not await check_permission(db, user["sub"], "roles.edit"):
        user_doc = await db.users.find_one({"id": user["sub"]})
        if not user_doc.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Permission denied: roles.edit required")
    
    existing = await db.roles.find_one({"id": role_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Cannot modify system roles' core properties
    if existing.get("is_system") and role.permissions is not None:
        # Only super admin can modify system role permissions
        user_doc = await db.users.find_one({"id": user["sub"]})
        if not user_doc.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Only Super Admin can modify system roles")
    
    # Validate permissions if provided
    if role.permissions:
        invalid_perms = [p for p in role.permissions if p not in PERMISSIONS]
        if invalid_perms:
            raise HTTPException(status_code=400, detail=f"Invalid permissions: {invalid_perms}")
    
    update_data = {k: v for k, v in role.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.roles.update_one({"id": role_id}, {"$set": update_data})
    
    updated = await db.roles.find_one({"id": role_id})
    return serialize_doc(updated)


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, user: dict = Depends(require_admin_access)):
    """Delete a role (only custom roles)"""
    # Check permission
    if not await check_permission(db, user["sub"], "roles.delete"):
        user_doc = await db.users.find_one({"id": user["sub"]})
        if not user_doc.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Permission denied: roles.delete required")
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Remove role from all users
    await db.users.update_many(
        {"role_ids": role_id},
        {"$pull": {"role_ids": role_id}}
    )
    
    await db.roles.delete_one({"id": role_id})
    return {"status": "deleted", "role_id": role_id}


# ==================== USER MANAGEMENT ROUTES ====================

@router.get("/users")
async def list_users(user: dict = Depends(require_admin_access)):
    """List all users with their roles"""
    users = await db.users.find().to_list(500)
    
    # Get all roles for lookup
    roles = await db.roles.find().to_list(100)
    role_map = {r["id"]: r for r in roles}
    
    result = []
    for u in users:
        user_roles = []
        for rid in u.get("role_ids", []):
            if rid in role_map:
                user_roles.append({
                    "id": role_map[rid]["id"],
                    "name": role_map[rid]["name"],
                    "display_name": role_map[rid]["display_name"]
                })
        
        result.append({
            "id": u["id"],
            "email": u["email"],
            "name": u["name"],
            "roles": user_roles,
            "is_active": u.get("is_active", True),
            "is_super_admin": u.get("is_super_admin", False),
            "created_at": u.get("created_at"),
            "last_login": u.get("last_login")
        })
    
    return {
        "users": serialize_doc(result),
        "count": len(result)
    }


@router.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(require_admin_access)):
    """Get a specific user with roles and permissions"""
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's roles
    role_ids = target_user.get("role_ids", [])
    roles = await db.roles.find({"id": {"$in": role_ids}}).to_list(100)
    
    # Get permissions
    permissions = await get_user_permissions(db, user_id)
    
    return serialize_doc({
        "id": target_user["id"],
        "email": target_user["email"],
        "name": target_user["name"],
        "roles": [{"id": r["id"], "name": r["name"], "display_name": r["display_name"]} for r in roles],
        "permissions": permissions,
        "is_active": target_user.get("is_active", True),
        "is_super_admin": target_user.get("is_super_admin", False),
        "created_at": target_user.get("created_at"),
        "last_login": target_user.get("last_login")
    })


@router.post("/users")
async def create_user(user_data: UserCreate, user: dict = Depends(require_admin_access)):
    """Create a new user (admin only)"""
    # Check permission
    if not await check_permission(db, user["sub"], "users.create"):
        user_doc = await db.users.find_one({"id": user["sub"]})
        if not user_doc.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Permission denied: users.create required")
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role IDs
    if user_data.role_ids:
        valid_roles = await db.roles.find({"id": {"$in": user_data.role_ids}}).to_list(100)
        if len(valid_roles) != len(user_data.role_ids):
            raise HTTPException(status_code=400, detail="One or more invalid role IDs")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role_ids": user_data.role_ids,
        "is_active": user_data.is_active,
        "is_super_admin": False,
        "created_at": datetime.now(timezone.utc),
        "created_by": user["sub"]
    }
    
    await db.users.insert_one(user_doc)
    
    # Return without password
    return serialize_doc({k: v for k, v in user_doc.items() if k != "password"})


@router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate, user: dict = Depends(require_admin_access)):
    """Update a user"""
    # Check permission
    if not await check_permission(db, user["sub"], "users.edit"):
        user_doc = await db.users.find_one({"id": user["sub"]})
        if not user_doc.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Permission denied: users.edit required")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot deactivate super admin unless you're super admin
    if target_user.get("is_super_admin") and user_data.is_active == False:
        current_user = await db.users.find_one({"id": user["sub"]})
        if not current_user.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Cannot deactivate Super Admin")
    
    # Validate role IDs if provided
    if user_data.role_ids is not None:
        if not await check_permission(db, user["sub"], "users.assign_roles"):
            current_user = await db.users.find_one({"id": user["sub"]})
            if not current_user.get("is_super_admin"):
                raise HTTPException(status_code=403, detail="Permission denied: users.assign_roles required")
        
        if user_data.role_ids:
            valid_roles = await db.roles.find({"id": {"$in": user_data.role_ids}}).to_list(100)
            if len(valid_roles) != len(user_data.role_ids):
                raise HTTPException(status_code=400, detail="One or more invalid role IDs")
    
    update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
    
    # Hash password if provided
    if "password" in update_data:
        update_data["password"] = hash_password(update_data["password"])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id})
    return serialize_doc({k: v for k, v in updated.items() if k != "password"})


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_admin_access)):
    """Delete a user"""
    # Check permission
    if not await check_permission(db, user["sub"], "users.delete"):
        user_doc = await db.users.find_one({"id": user["sub"]})
        if not user_doc.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Permission denied: users.delete required")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot delete yourself
    if user_id == user["sub"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Cannot delete super admin
    if target_user.get("is_super_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete Super Admin")
    
    await db.users.delete_one({"id": user_id})
    return {"status": "deleted", "user_id": user_id}


@router.post("/users/{user_id}/roles")
async def assign_roles(user_id: str, role_ids: List[str], user: dict = Depends(require_admin_access)):
    """Assign roles to a user"""
    # Check permission
    if not await check_permission(db, user["sub"], "users.assign_roles"):
        user_doc = await db.users.find_one({"id": user["sub"]})
        if not user_doc.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Permission denied: users.assign_roles required")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate role IDs
    valid_roles = await db.roles.find({"id": {"$in": role_ids}}).to_list(100)
    if len(valid_roles) != len(role_ids):
        raise HTTPException(status_code=400, detail="One or more invalid role IDs")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"role_ids": role_ids, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "status": "roles_assigned",
        "user_id": user_id,
        "roles": [{"id": r["id"], "name": r["name"], "display_name": r["display_name"]} for r in valid_roles]
    }


@router.post("/users/{user_id}/toggle-super-admin")
async def toggle_super_admin(user_id: str, user: dict = Depends(require_admin_access)):
    """Toggle super admin status (only super admin can do this)"""
    current_user = await db.users.find_one({"id": user["sub"]})
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only Super Admin can perform this action")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot remove your own super admin status
    if user_id == user["sub"]:
        raise HTTPException(status_code=400, detail="Cannot modify your own Super Admin status")
    
    new_status = not target_user.get("is_super_admin", False)
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_super_admin": new_status}}
    )
    
    return {
        "status": "updated",
        "user_id": user_id,
        "is_super_admin": new_status
    }
