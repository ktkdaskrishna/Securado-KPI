"""RBAC Service Routes - Roles, Permissions, Departments

Handles:
- Roles CRUD with permissions
- Permissions management
- Departments CRUD
- RBAC enforcement helpers
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime
import logging

from libs.database import get_app_db
from libs.utils import serialize_doc, generate_id, now_utc
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.routes import get_current_user
from services.rbac.models import (
    PermissionCreate, RoleCreate, RoleUpdate, DepartmentCreate,
    DEFAULT_PERMISSIONS, ALL_PERMISSIONS
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["rbac"])


# ==================== PERMISSIONS ====================

@router.get("/permissions")
async def list_permissions(current_user: dict = Depends(get_current_user)):
    """List all permissions"""
    db = get_app_db()
    permissions = await db.permissions.find({"org_id": current_user.get("org_id", "default")}).to_list(1000)
    
    # If no custom permissions, return defaults
    if not permissions:
        return DEFAULT_PERMISSIONS
    
    return [serialize_doc(p) for p in permissions]


@router.post("/permissions")
async def create_permission(
    perm_data: PermissionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a custom permission"""
    db = get_app_db()
    
    perm_doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "created_at": now_utc(),
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
        "org_id": current_user.get("org_id", "default")
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    return {"success": True, "message": "Permission deleted"}


# ==================== ROLES ====================

@router.get("/roles")
async def list_roles(current_user: dict = Depends(get_current_user)):
    """List all roles with actual user counts from users collection"""
    db = get_app_db()
    roles = await db.roles.find({"org_id": current_user.get("org_id", "default")}).to_list(1000)
    
    # Compute actual user counts from users collection
    user_role_counts = {}
    pipeline = [
        {"$unwind": "$roles"},
        {"$group": {"_id": "$roles", "count": {"$sum": 1}}}
    ]
    async for doc in db.users.aggregate(pipeline):
        user_role_counts[doc["_id"]] = doc["count"]
    
    # Also count RBAC users
    rbac_count = await db.users_rbac.count_documents({})
    
    # Always return all roles (merge defaults + stored)
    default_roles = [
        {"id": "admin", "name": "Administrator", "description": "Full system access", "permissions": ALL_PERMISSIONS},
        {"id": "etl_admin", "name": "ETL Administrator", "description": "Manage ETL pipelines and connections", "permissions": ["view_dashboard", "manage_pipelines", "run_pipelines", "manage_connections", "manage_mappings", "view_dlq", "manage_dlq"]},
        {"id": "sales_manager", "name": "Sales Manager", "description": "Sales team management", "permissions": ["view_dashboard", "manage_opportunities", "view_opportunities", "manage_accounts", "view_accounts", "manage_activities", "view_activities", "manage_goals", "view_goals", "manage_teams", "view_teams"]},
        {"id": "sales_rep", "name": "Sales Representative", "description": "View and manage own opportunities", "permissions": ["view_dashboard", "view_opportunities", "view_accounts", "view_activities", "view_goals", "view_profile"]},
        {"id": "sales_director", "name": "Sales Director", "description": "Full sales department access", "permissions": ["view_dashboard", "manage_dashboard", "view_opportunities", "manage_opportunities", "view_accounts", "manage_accounts", "view_activities", "manage_activities", "view_invoices", "view_analytics", "view_goals", "manage_goals", "view_teams", "view_kpis"]},
        {"id": "product_director", "name": "Product Director", "description": "Product management, target planning, activity assignment", "permissions": ["view_dashboard", "manage_dashboard", "view_opportunities", "manage_opportunities", "view_accounts", "view_activities", "manage_activities", "view_goals", "manage_goals", "view_kpis", "manage_kpis", "view_invoices", "view_analytics", "view_teams"]},
        {"id": "system_admin", "name": "System Admin", "description": "ETL and system settings access", "permissions": ALL_PERMISSIONS},
        {"id": "finance", "name": "Finance Manager", "description": "Invoicing, collections, costing", "permissions": ["view_dashboard", "view_accounts", "view_invoices", "manage_invoices", "view_analytics", "view_profile"]},
        {"id": "marketing", "name": "Marketing", "description": "Lead generation, campaigns, content", "permissions": ["view_dashboard", "view_opportunities", "view_accounts", "view_activities", "view_analytics", "view_profile"]},
        {"id": "strategy", "name": "Strategy / New Logos", "description": "New market development, executive engagements", "permissions": ["view_dashboard", "view_opportunities", "manage_opportunities", "view_accounts", "view_activities", "view_analytics", "view_goals", "view_profile"]},
        {"id": "operations", "name": "Operations & Delivery", "description": "Service delivery, utilization, project management", "permissions": ["view_dashboard", "view_accounts", "view_activities", "view_goals", "view_profile"]},
        {"id": "support", "name": "Support", "description": "Customer support, SLA, incident management", "permissions": ["view_dashboard", "view_accounts", "view_activities", "view_profile"]},
    ]
    
    # Merge: stored roles override defaults
    stored_map = {serialize_doc(r).get("id"): serialize_doc(r) for r in roles}
    result = []
    seen_ids = set()
    
    for dr in default_roles:
        rid = dr["id"]
        if rid in stored_map:
            role = stored_map[rid]
        else:
            role = dr
        role["users_count"] = user_role_counts.get(rid, 0)
        result.append(role)
        seen_ids.add(rid)
    
    # Add any stored roles not in defaults
    for rid, role in stored_map.items():
        if rid not in seen_ids:
            role["users_count"] = user_role_counts.get(rid, 0)
            result.append(role)
    
    return result


@router.get("/roles/{role_id}")
async def get_role(
    role_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single role"""
    db = get_app_db()
    
    role = await db.roles.find_one({
        "id": role_id,
        "org_id": current_user.get("org_id", "default")
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
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "created_at": now_utc(),
        "users_count": 0,
        **role_data.model_dump()
    }
    
    await db.roles.insert_one(role_doc)
    
    # Emit role updated event
    await emit_event(
        event_type=Topics.RBAC_ROLE_UPDATED,
        payload={
            "role_id": role_doc["id"],
            "role_name": role_data.name,
            "action": "created",
            "permissions": role_data.permissions
        },
        producer="rbac-service",
        org_id=current_user.get("org_id", "default")
    )
    
    return serialize_doc(role_doc)


@router.put("/roles/{role_id}")
async def update_role(
    role_id: str,
    role_data: RoleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a role — ADMIN ONLY"""
    user_roles = current_user.get("roles", [])
    if not any(r in user_roles for r in ["admin", "system_admin", "sales_admin"]):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Only administrators can modify roles")
    db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    update_data = {k: v for k, v in role_data.model_dump().items() if v is not None}
    update_data["updated_at"] = now_utc()
    
    # Try update first
    result = await db.roles.update_one(
        {"id": role_id, "org_id": org_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        # Role doesn't exist in DB (it was a default) - insert it
        role_doc = {
            "id": role_id,
            "org_id": org_id,
            "name": role_data.name or role_id,
            "description": role_data.description or "",
            "permissions": role_data.permissions or [],
            "created_at": now_utc(),
            "updated_at": now_utc()
        }
        await db.roles.insert_one(role_doc)
    
    # Emit role updated event
    await emit_event(
        event_type=Topics.RBAC_ROLE_UPDATED,
        payload={
            "role_id": role_id,
            "role_name": role_data.name,
            "action": "updated",
            "permissions": role_data.permissions or []
        },
        producer="rbac-service",
        org_id=org_id
    )
    
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
        "org_id": current_user.get("org_id", "default")
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Remove role from all users
    await db.users.update_many(
        {"org_id": current_user.get("org_id", "default"), "roles": role_id},
        {"$pull": {"roles": role_id}}
    )
    
    # Emit role updated event
    await emit_event(
        event_type=Topics.RBAC_ROLE_UPDATED,
        payload={
            "role_id": role_id,
            "role_name": "",
            "action": "deleted",
            "permissions": []
        },
        producer="rbac-service",
        org_id=current_user.get("org_id", "default")
    )
    
    return {"success": True, "message": "Role deleted"}


# ==================== DEPARTMENTS ====================

@router.get("/departments")
async def list_departments(current_user: dict = Depends(get_current_user)):
    """List all departments"""
    db = get_app_db()
    departments = await db.departments.find({"org_id": current_user.get("org_id", "default")}).to_list(1000)
    
    if not departments:
        return [
            {"id": "sales", "name": "Sales", "description": "Sales department", "users_count": 0},
            {"id": "marketing", "name": "Marketing", "description": "Marketing department", "users_count": 0},
            {"id": "operations", "name": "Operations", "description": "Operations department", "users_count": 0},
            {"id": "engineering", "name": "Engineering", "description": "Engineering department", "users_count": 0}
        ]
    
    return [serialize_doc(d) for d in departments]


@router.post("/departments")
async def create_department(
    dept_data: DepartmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new department"""
    db = get_app_db()
    
    dept_doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "created_at": now_utc(),
        "users_count": 0,
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
    update_data["updated_at"] = now_utc()
    
    result = await db.departments.update_one(
        {"id": dept_id, "org_id": current_user.get("org_id", "default")},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    
    return {"success": True, "message": "Department updated"}


@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a department"""
    db = get_app_db()
    
    result = await db.departments.delete_one({
        "id": dept_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    
    return {"success": True, "message": "Department deleted"}


# ==================== USER PERMISSIONS ====================

@router.get("/me/permissions")
async def get_my_permissions(current_user: dict = Depends(get_current_user)):
    """Get current user's effective permissions"""
    db = get_app_db()
    
    user_roles = current_user.get("roles", [])
    
    # Get all permissions for user's roles
    roles = await db.roles.find(
        {"id": {"$in": user_roles}, "org_id": current_user.get("org_id", "default")}
    ).to_list(100)
    
    all_permissions = set(current_user.get("permissions", []))
    for role in roles:
        all_permissions.update(role.get("permissions", []))
    
    return {
        "user_id": current_user["id"],
        "roles": user_roles,
        "permissions": list(all_permissions)
    }
