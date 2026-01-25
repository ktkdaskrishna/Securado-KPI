from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from admin.models import (
    PermissionCreate, RoleCreate, RoleUpdate, DepartmentCreate,
    UserUpdate, BulkAssignRole, BulkAssignDepartment, LLMConfig
)
from auth.routes import get_current_user
from auth.models import UserStatus
from core.database import get_app_db
from core.utils import serialize_doc
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

# ===== PERMISSIONS =====

@router.get("/permissions")
async def list_permissions(current_user: dict = Depends(get_current_user)):
    """List all permissions"""
    db = get_app_db()
    permissions = await db.permissions.find({"org_id": current_user["org_id"]}).to_list(1000)
    return [serialize_doc(p) for p in permissions]

@router.get("/permissions/{module}")
async def list_permissions_by_module(
    module: str,
    current_user: dict = Depends(get_current_user)
):
    """List permissions by module"""
    db = get_app_db()
    permissions = await db.permissions.find({
        "org_id": current_user["org_id"],
        "module": module
    }).to_list(1000)
    return [serialize_doc(p) for p in permissions]

@router.post("/permissions")
async def create_permission(
    perm_data: PermissionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new permission"""
    db = get_app_db()
    
    perm_doc = {
        "id": str(uuid.uuid4()),
        "org_id": current_user["org_id"],
        "created_at": datetime.utcnow(),
        **perm_data.model_dump()
    }
    
    await db.permissions.insert_one(perm_doc)
    return serialize_doc(perm_doc)

@router.delete("/permissions/{perm_id}")
async def delete_permission(
    perm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a permission"""
    db = get_app_db()
    
    result = await db.permissions.delete_one({
        "id": perm_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    return {"success": True, "message": "Permission deleted"}

# ===== ROLES =====

@router.get("/roles")
async def list_roles(current_user: dict = Depends(get_current_user)):
    """List all roles"""
    db = get_app_db()
    roles = await db.roles.find({"org_id": current_user["org_id"]}).to_list(1000)
    return [serialize_doc(r) for r in roles]

@router.get("/roles/{role_id}")
async def get_role(
    role_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single role"""
    db = get_app_db()
    
    role = await db.roles.find_one({
        "id": role_id,
        "org_id": current_user["org_id"]
    })
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return serialize_doc(role)

@router.post("/roles")
async def create_role(
    role_data: RoleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new role"""
    db = get_app_db()
    
    role_doc = {
        "id": str(uuid.uuid4()),
        "org_id": current_user["org_id"],
        "created_at": datetime.utcnow(),
        **role_data.model_dump()
    }
    
    await db.roles.insert_one(role_doc)
    return serialize_doc(role_doc)

@router.put("/roles/{role_id}")
async def update_role(
    role_id: str,
    role_data: RoleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a role"""
    db = get_app_db()
    
    update_data = {k: v for k, v in role_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.roles.update_one(
        {"id": role_id, "org_id": current_user["org_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {"success": True, "message": "Role updated"}

@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a role"""
    db = get_app_db()
    
    result = await db.roles.delete_one({
        "id": role_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {"success": True, "message": "Role deleted"}

# ===== DEPARTMENTS =====

@router.get("/departments")
async def list_departments(current_user: dict = Depends(get_current_user)):
    """List all departments"""
    db = get_app_db()
    departments = await db.departments.find({"org_id": current_user["org_id"]}).to_list(1000)
    return [serialize_doc(d) for d in departments]

@router.post("/departments")
async def create_department(
    dept_data: DepartmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new department"""
    db = get_app_db()
    
    dept_doc = {
        "id": str(uuid.uuid4()),
        "org_id": current_user["org_id"],
        "created_at": datetime.utcnow(),
        **dept_data.model_dump()
    }
    
    await db.departments.insert_one(dept_doc)
    return serialize_doc(dept_doc)

@router.put("/departments/{dept_id}")
async def update_department(
    dept_id: str,
    dept_data: DepartmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a department"""
    db = get_app_db()
    
    update_data = dept_data.model_dump()
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.departments.update_one(
        {"id": dept_id, "org_id": current_user["org_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    
    return {"success": True, "message": "Department updated"}

# ===== USERS =====

@router.get("/users")
async def list_users(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List all users"""
    db = get_app_db()
    
    query = {"org_id": current_user["org_id"]}
    if status:
        query["status"] = status
    
    users = await db.users.find(query, {"password_hash": 0}).to_list(1000)
    return [serialize_doc(u) for u in users]

@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single user"""
    db = get_app_db()
    
    user = await db.users.find_one(
        {"id": user_id, "org_id": current_user["org_id"]},
        {"password_hash": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return serialize_doc(user)

@router.post("/users")
async def create_user_admin(
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Create a user (admin endpoint)"""
    from auth.jwt import hash_password
    db = get_app_db()
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "org_id": current_user["org_id"],
        "password_hash": hash_password("changeme123"),
        "status": UserStatus.APPROVED,
        "created_at": datetime.utcnow(),
        "roles": [],
        **user_data.model_dump(exclude_none=True)
    }
    
    await db.users.insert_one(user_doc)
    
    user_doc.pop("password_hash", None)
    return serialize_doc(user_doc)

@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a user"""
    db = get_app_db()
    
    update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.users.update_one(
        {"id": user_id, "org_id": current_user["org_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User updated"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a user"""
    db = get_app_db()
    
    result = await db.users.delete_one({
        "id": user_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User deleted"}

@router.patch("/users/{user_id}/assign-role")
async def assign_role_to_user(
    user_id: str,
    role: str,
    current_user: dict = Depends(get_current_user)
):
    """Assign a role to user"""
    db = get_app_db()
    
    result = await db.users.update_one(
        {"id": user_id, "org_id": current_user["org_id"]},
        {"$addToSet": {"roles": role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "Role assigned"}

@router.post("/users/bulk-assign-role")
async def bulk_assign_role(
    data: BulkAssignRole,
    current_user: dict = Depends(get_current_user)
):
    """Bulk assign role to multiple users"""
    db = get_app_db()
    
    result = await db.users.update_many(
        {"id": {"$in": data.user_ids}, "org_id": current_user["org_id"]},
        {"$addToSet": {"roles": data.role}}
    )
    
    return {
        "success": True,
        "message": f"Role assigned to {result.modified_count} users"
    }

@router.post("/users/bulk-assign-department")
async def bulk_assign_department(
    data: BulkAssignDepartment,
    current_user: dict = Depends(get_current_user)
):
    """Bulk assign department to multiple users"""
    db = get_app_db()
    
    result = await db.users.update_many(
        {"id": {"$in": data.user_ids}, "org_id": current_user["org_id"]},
        {"$set": {"department_id": data.department_id}}
    )
    
    return {
        "success": True,
        "message": f"Department assigned to {result.modified_count} users"
    }

@router.post("/users/{user_id}/approve")
async def approve_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Approve a pending user"""
    db = get_app_db()
    
    result = await db.users.update_one(
        {"id": user_id, "org_id": current_user["org_id"], "status": UserStatus.PENDING},
        {"$set": {"status": UserStatus.APPROVED, "approved_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    return {"success": True, "message": "User approved"}

@router.post("/users/{user_id}/reject")
async def reject_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reject a pending user"""
    db = get_app_db()
    
    result = await db.users.update_one(
        {"id": user_id, "org_id": current_user["org_id"], "status": UserStatus.PENDING},
        {"$set": {"status": UserStatus.REJECTED, "rejected_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    return {"success": True, "message": "User rejected"}

@router.get("/me/permissions")
async def get_my_permissions(current_user: dict = Depends(get_current_user)):
    """Get current user's permissions"""
    db = get_app_db()
    
    user_roles = current_user.get("roles", [])
    
    # Get all permissions for user's roles
    roles = await db.roles.find(
        {"name": {"$in": user_roles}, "org_id": current_user["org_id"]}
    ).to_list(100)
    
    all_permissions = set()
    for role in roles:
        all_permissions.update(role.get("permissions", []))
    
    return {
        "user_id": current_user["id"],
        "roles": user_roles,
        "permissions": list(all_permissions)
    }

# ===== ADMIN LOGS =====

@router.get("/logs/errors")
async def get_error_logs(
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """Get error logs"""
    db = get_app_db()
    
    logs = await db.admin_logs_errors.find(
        {"org_id": current_user["org_id"]}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return [serialize_doc(log) for log in logs]

@router.post("/logs/errors/{error_id}/resolve")
async def resolve_error(
    error_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark error as resolved"""
    db = get_app_db()
    
    result = await db.admin_logs_errors.update_one(
        {"id": error_id, "org_id": current_user["org_id"]},
        {"$set": {"resolved": True, "resolved_at": datetime.utcnow(), "resolved_by": current_user["id"]}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Error log not found")
    
    return {"success": True, "message": "Error marked as resolved"}

@router.get("/logs/sessions")
async def get_session_logs(
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """Get session logs"""
    db = get_app_db()
    
    logs = await db.admin_logs_sessions.find(
        {"org_id": current_user["org_id"]}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return [serialize_doc(log) for log in logs]

@router.get("/logs/session/{session_id}")
async def get_session_detail(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get session detail"""
    db = get_app_db()
    
    session = await db.admin_logs_sessions.find_one({
        "session_id": session_id,
        "org_id": current_user["org_id"]
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return serialize_doc(session)

@router.get("/logs/api-calls")
async def get_api_call_logs(
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """Get API call logs"""
    db = get_app_db()
    
    logs = await db.admin_logs_api_calls.find(
        {"org_id": current_user["org_id"]}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return [serialize_doc(log) for log in logs]

@router.get("/logs/stats")
async def get_log_stats(current_user: dict = Depends(get_current_user)):
    """Get aggregate log statistics"""
    db = get_app_db()
    
    error_count = await db.admin_logs_errors.count_documents(
        {"org_id": current_user["org_id"], "resolved": {"$ne": True}}
    )
    
    session_count = await db.admin_logs_sessions.count_documents(
        {"org_id": current_user["org_id"]}
    )
    
    api_call_count = await db.admin_logs_api_calls.count_documents(
        {"org_id": current_user["org_id"]}
    )
    
    return {
        "unresolved_errors": error_count,
        "total_sessions": session_count,
        "total_api_calls": api_call_count
    }

# ===== LLM CONFIG =====

@router.get("/llm/config")
async def get_llm_config(current_user: dict = Depends(get_current_user)):
    """Get LLM configuration"""
    db = get_app_db()
    
    config = await db.llm_config.find_one({"org_id": current_user["org_id"]})
    
    if config:
        # Don't expose API key
        config.pop("api_key", None)
        return serialize_doc(config)
    
    return {"message": "No LLM configuration found"}

@router.post("/llm/config")
async def save_llm_config(
    config_data: LLMConfig,
    current_user: dict = Depends(get_current_user)
):
    """Save LLM configuration"""
    db = get_app_db()
    
    config_doc = {
        "org_id": current_user["org_id"],
        "updated_at": datetime.utcnow(),
        **config_data.model_dump()
    }
    
    await db.llm_config.update_one(
        {"org_id": current_user["org_id"]},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"success": True, "message": "LLM configuration saved"}

@router.post("/llm/test")
async def test_llm(current_user: dict = Depends(get_current_user)):
    """Test LLM connection (stub)"""
    return {
        "success": True,
        "message": "LLM test endpoint (stub). Implement actual LLM call if needed."
    }
