"""RBAC Service Models"""
from pydantic import BaseModel
from typing import Optional, List


class PermissionCreate(BaseModel):
    name: str
    resource: str
    action: str
    description: Optional[str] = None


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None


# Default permissions
DEFAULT_PERMISSIONS = [
    {"name": "view_dashboard", "resource": "dashboard", "action": "read", "description": "View dashboard"},
    {"name": "manage_opportunities", "resource": "opportunities", "action": "write", "description": "Create/edit opportunities"},
    {"name": "view_opportunities", "resource": "opportunities", "action": "read", "description": "View opportunities"},
    {"name": "manage_accounts", "resource": "accounts", "action": "write", "description": "Create/edit accounts"},
    {"name": "view_accounts", "resource": "accounts", "action": "read", "description": "View accounts"},
    {"name": "manage_activities", "resource": "activities", "action": "write", "description": "Create/edit activities"},
    {"name": "view_activities", "resource": "activities", "action": "read", "description": "View activities"},
    {"name": "manage_goals", "resource": "goals", "action": "write", "description": "Create/edit goals"},
    {"name": "view_goals", "resource": "goals", "action": "read", "description": "View goals"},
    {"name": "manage_teams", "resource": "teams", "action": "write", "description": "Create/edit teams"},
    {"name": "view_teams", "resource": "teams", "action": "read", "description": "View teams"},
    {"name": "manage_pipelines", "resource": "pipelines", "action": "write", "description": "Create/edit pipelines"},
    {"name": "view_pipelines", "resource": "pipelines", "action": "read", "description": "View pipelines"},
    {"name": "run_pipelines", "resource": "pipelines", "action": "execute", "description": "Run pipelines"},
    {"name": "manage_connections", "resource": "connections", "action": "write", "description": "Create/edit connections"},
    {"name": "view_connections", "resource": "connections", "action": "read", "description": "View connections"},
    {"name": "manage_mappings", "resource": "mappings", "action": "write", "description": "Create/edit mappings"},
    {"name": "view_mappings", "resource": "mappings", "action": "read", "description": "View mappings"},
    {"name": "admin_users", "resource": "users", "action": "admin", "description": "Manage users"},
    {"name": "admin_roles", "resource": "roles", "action": "admin", "description": "Manage roles"},
    {"name": "admin_config", "resource": "config", "action": "admin", "description": "Manage configuration"},
    {"name": "view_dlq", "resource": "dlq", "action": "read", "description": "View DLQ items"},
    {"name": "manage_dlq", "resource": "dlq", "action": "write", "description": "Retry/dismiss DLQ items"},
]

# All permissions for super admin
ALL_PERMISSIONS = [p["name"] for p in DEFAULT_PERMISSIONS]
