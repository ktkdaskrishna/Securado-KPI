"""Backend RBAC Permission Check Dependencies

Reusable FastAPI dependencies that enforce permission checks at the API level.
These supplement the frontend RBACGuard component for defense-in-depth.
"""
import logging
from fastapi import Depends, HTTPException, Request

from libs.database import get_app_db
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)


async def _check_user_permission(current_user: dict, required_permission: str) -> bool:
    """Check if user has a specific permission via RBAC"""
    app_db = get_app_db()
    user_email = current_user.get("email", "")

    # Fetch user's RBAC record
    rbac_record = await app_db.users_rbac.find_one({"email": user_email})
    if not rbac_record:
        # Try matching by name
        user_name = current_user.get("name", "")
        rbac_record = await app_db.users_rbac.find_one({"user_name": user_name})

    if not rbac_record:
        return False

    groups = rbac_record.get("odoo_groups", [])

    # Check for admin groups (Administration / Settings = system_admin)
    admin_group_names = ["Administration / Settings", "Administration / Access Rights"]
    for g in groups:
        if g.get("name") in admin_group_names or g.get("full_name", "").startswith("Administration"):
            return True  # Admin has all permissions

    # Map Odoo groups to permissions
    from services.odoo_rbac.routes import ODOO_GROUP_MAPPING
    user_permissions = set()
    for g in groups:
        gid = g.get("id")
        if gid and gid in ODOO_GROUP_MAPPING:
            user_permissions.update(ODOO_GROUP_MAPPING[gid].get("permissions", []))

    return required_permission in user_permissions


async def require_system_admin(current_user: dict = Depends(get_current_user)):
    """Dependency that requires system_admin permission. Returns user if authorized."""
    has_perm = await _check_user_permission(current_user, "system_admin")
    if not has_perm:
        # Also check if user is the known system admin
        if current_user.get("role") == "admin" or current_user.get("email") == "krishna@securado.net":
            return current_user
        raise HTTPException(status_code=403, detail="System admin access required")
    return current_user


async def require_manage_users(current_user: dict = Depends(get_current_user)):
    """Dependency that requires manage_users permission."""
    has_perm = await _check_user_permission(current_user, "manage_users")
    if not has_perm:
        if current_user.get("role") == "admin" or current_user.get("email") == "krishna@securado.net":
            return current_user
        raise HTTPException(status_code=403, detail="User management access required")
    return current_user
