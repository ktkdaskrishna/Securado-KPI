"""Permission Definitions and Checking"""
from typing import List, Optional, Callable
from functools import wraps
from fastapi import HTTPException, Depends
from .models import Permission, PermissionCategory

# ==================== PERMISSION DEFINITIONS ====================

PERMISSIONS = {
    # User Management
    "users.view": Permission(
        id="users.view",
        name="View Users",
        description="Can view user list and details",
        category=PermissionCategory.USER_MANAGEMENT
    ),
    "users.create": Permission(
        id="users.create",
        name="Create Users",
        description="Can create new user accounts",
        category=PermissionCategory.USER_MANAGEMENT
    ),
    "users.edit": Permission(
        id="users.edit",
        name="Edit Users",
        description="Can edit existing user accounts",
        category=PermissionCategory.USER_MANAGEMENT
    ),
    "users.delete": Permission(
        id="users.delete",
        name="Delete Users",
        description="Can delete user accounts",
        category=PermissionCategory.USER_MANAGEMENT
    ),
    "users.assign_roles": Permission(
        id="users.assign_roles",
        name="Assign Roles",
        description="Can assign roles to users",
        category=PermissionCategory.USER_MANAGEMENT
    ),
    
    # Role Management
    "roles.view": Permission(
        id="roles.view",
        name="View Roles",
        description="Can view role list and details",
        category=PermissionCategory.ROLE_MANAGEMENT
    ),
    "roles.create": Permission(
        id="roles.create",
        name="Create Roles",
        description="Can create new role templates",
        category=PermissionCategory.ROLE_MANAGEMENT
    ),
    "roles.edit": Permission(
        id="roles.edit",
        name="Edit Roles",
        description="Can edit role permissions",
        category=PermissionCategory.ROLE_MANAGEMENT
    ),
    "roles.delete": Permission(
        id="roles.delete",
        name="Delete Roles",
        description="Can delete custom roles",
        category=PermissionCategory.ROLE_MANAGEMENT
    ),
    
    # Connection Management
    "connections.view": Permission(
        id="connections.view",
        name="View Connections",
        description="Can view data connections",
        category=PermissionCategory.CONNECTION_MANAGEMENT
    ),
    "connections.create": Permission(
        id="connections.create",
        name="Create Connections",
        description="Can create new data connections",
        category=PermissionCategory.CONNECTION_MANAGEMENT
    ),
    "connections.edit": Permission(
        id="connections.edit",
        name="Edit Connections",
        description="Can edit data connections",
        category=PermissionCategory.CONNECTION_MANAGEMENT
    ),
    "connections.delete": Permission(
        id="connections.delete",
        name="Delete Connections",
        description="Can delete data connections",
        category=PermissionCategory.CONNECTION_MANAGEMENT
    ),
    
    # Pipeline Management
    "pipelines.view": Permission(
        id="pipelines.view",
        name="View Pipelines",
        description="Can view pipelines and runs",
        category=PermissionCategory.PIPELINE_MANAGEMENT
    ),
    "pipelines.create": Permission(
        id="pipelines.create",
        name="Create Pipelines",
        description="Can create new pipelines",
        category=PermissionCategory.PIPELINE_MANAGEMENT
    ),
    "pipelines.edit": Permission(
        id="pipelines.edit",
        name="Edit Pipelines",
        description="Can edit pipeline configurations",
        category=PermissionCategory.PIPELINE_MANAGEMENT
    ),
    "pipelines.delete": Permission(
        id="pipelines.delete",
        name="Delete Pipelines",
        description="Can delete pipelines",
        category=PermissionCategory.PIPELINE_MANAGEMENT
    ),
    "pipelines.run": Permission(
        id="pipelines.run",
        name="Run Pipelines",
        description="Can execute pipelines manually",
        category=PermissionCategory.PIPELINE_MANAGEMENT
    ),
    "pipelines.schedule": Permission(
        id="pipelines.schedule",
        name="Schedule Pipelines",
        description="Can configure pipeline schedules",
        category=PermissionCategory.PIPELINE_MANAGEMENT
    ),
    
    # Schema Management
    "schemas.view": Permission(
        id="schemas.view",
        name="View Schemas",
        description="Can view schema library",
        category=PermissionCategory.SCHEMA_MANAGEMENT
    ),
    "schemas.create": Permission(
        id="schemas.create",
        name="Create Schemas",
        description="Can create custom schemas",
        category=PermissionCategory.SCHEMA_MANAGEMENT
    ),
    "schemas.edit": Permission(
        id="schemas.edit",
        name="Edit Schemas",
        description="Can edit custom schemas",
        category=PermissionCategory.SCHEMA_MANAGEMENT
    ),
    "schemas.delete": Permission(
        id="schemas.delete",
        name="Delete Schemas",
        description="Can delete custom schemas",
        category=PermissionCategory.SCHEMA_MANAGEMENT
    ),
    
    # System Settings
    "settings.view": Permission(
        id="settings.view",
        name="View Settings",
        description="Can view system settings",
        category=PermissionCategory.SYSTEM_SETTINGS
    ),
    "settings.edit": Permission(
        id="settings.edit",
        name="Edit Settings",
        description="Can modify system settings",
        category=PermissionCategory.SYSTEM_SETTINGS
    ),
    
    # Reports
    "reports.view": Permission(
        id="reports.view",
        name="View Reports",
        description="Can view dashboards and reports",
        category=PermissionCategory.REPORTS
    ),
    "reports.export": Permission(
        id="reports.export",
        name="Export Reports",
        description="Can export data and reports",
        category=PermissionCategory.REPORTS
    ),
}

# All permission IDs
ALL_PERMISSIONS = list(PERMISSIONS.keys())


def get_all_permissions() -> List[Permission]:
    """Get all available permissions"""
    return list(PERMISSIONS.values())


def get_permissions_by_category() -> dict:
    """Get permissions grouped by category"""
    result = {}
    for perm in PERMISSIONS.values():
        cat = perm.category.value
        if cat not in result:
            result[cat] = []
        result[cat].append(perm.to_dict())
    return result


# ==================== DEFAULT ROLE TEMPLATES ====================

DEFAULT_ROLES = [
    {
        "name": "super_admin",
        "display_name": "Super Administrator",
        "description": "Full system access with all permissions",
        "permissions": ALL_PERMISSIONS,
        "is_system": True
    },
    {
        "name": "admin",
        "display_name": "Administrator",
        "description": "Administrative access without user management",
        "permissions": [
            "users.view",
            "roles.view",
            "connections.view", "connections.create", "connections.edit", "connections.delete",
            "pipelines.view", "pipelines.create", "pipelines.edit", "pipelines.delete", "pipelines.run", "pipelines.schedule",
            "schemas.view", "schemas.create", "schemas.edit", "schemas.delete",
            "settings.view",
            "reports.view", "reports.export"
        ],
        "is_system": True
    },
    {
        "name": "editor",
        "display_name": "Editor",
        "description": "Can create and edit pipelines and connections",
        "permissions": [
            "connections.view", "connections.create", "connections.edit",
            "pipelines.view", "pipelines.create", "pipelines.edit", "pipelines.run",
            "schemas.view", "schemas.create",
            "reports.view"
        ],
        "is_system": True
    },
    {
        "name": "viewer",
        "display_name": "Viewer",
        "description": "Read-only access to view data and reports",
        "permissions": [
            "connections.view",
            "pipelines.view",
            "schemas.view",
            "reports.view"
        ],
        "is_system": True
    }
]


# ==================== PERMISSION CHECKING ====================

async def check_permission(db, user_id: str, permission: str) -> bool:
    """Check if a user has a specific permission"""
    # Get user with roles
    user = await db.users.find_one({"id": user_id})
    if not user:
        return False
    
    # Super admin bypass
    if user.get("is_super_admin"):
        return True
    
    # Get user's role IDs
    role_ids = user.get("role_ids", [])
    if not role_ids:
        return False
    
    # Get roles and their permissions
    roles = await db.roles.find({"id": {"$in": role_ids}, "is_active": True}).to_list(100)
    
    # Collect all permissions
    user_permissions = set()
    for role in roles:
        user_permissions.update(role.get("permissions", []))
    
    return permission in user_permissions


async def get_user_permissions(db, user_id: str) -> List[str]:
    """Get all permissions for a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return []
    
    # Super admin has all permissions
    if user.get("is_super_admin"):
        return ALL_PERMISSIONS
    
    # Get user's role IDs
    role_ids = user.get("role_ids", [])
    if not role_ids:
        return []
    
    # Get roles and their permissions
    roles = await db.roles.find({"id": {"$in": role_ids}, "is_active": True}).to_list(100)
    
    # Collect all permissions
    permissions = set()
    for role in roles:
        permissions.update(role.get("permissions", []))
    
    return list(permissions)


def require_permission(permission: str):
    """Decorator/dependency to require a specific permission"""
    async def permission_checker(user: dict, db):
        if not await check_permission(db, user["sub"], permission):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: {permission} required"
            )
        return True
    return permission_checker


def require_any_permission(permissions: List[str]):
    """Decorator/dependency to require any of the specified permissions"""
    async def permission_checker(user: dict, db):
        user_perms = await get_user_permissions(db, user["sub"])
        if not any(p in user_perms for p in permissions):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: one of {permissions} required"
            )
        return True
    return permission_checker


async def require_super_admin(db, user_id: str) -> bool:
    """Check if user is super admin"""
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("is_super_admin"):
        raise HTTPException(
            status_code=403,
            detail="Super Admin access required"
        )
    return True
