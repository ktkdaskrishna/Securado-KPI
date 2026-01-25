"""Role-Based Access Control Module"""
from .models import Role, Permission, UserRole
from .routes import router as rbac_router
from .permissions import (
    PERMISSIONS, get_all_permissions, check_permission,
    require_permission, require_any_permission, require_super_admin
)

__all__ = [
    'Role', 'Permission', 'UserRole',
    'rbac_router', 'PERMISSIONS', 'get_all_permissions',
    'check_permission', 'require_permission', 'require_any_permission',
    'require_super_admin'
]
