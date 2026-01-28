"""RBAC Middleware for enforcing permissions and data access"""
from functools import wraps
from typing import List, Optional, Callable
from fastapi import HTTPException, Depends
import logging

from libs.database import get_canonical_db
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)

# Field access rules - which fields to hide based on access level
FIELD_ACCESS_RULES = {
    "all": [],  # No fields hidden
    "standard": ["expected_revenue", "margin", "cost", "commission"],  # Some financial fields hidden
    "limited": ["sale_value", "expected_revenue", "margin", "cost", "commission", "probability"]  # Most sensitive hidden
}


async def get_user_rbac(current_user: dict) -> dict:
    """Get the user's RBAC settings from synced Odoo data"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Try to find user by email
    email = current_user.get("email")
    if email:
        user = await canonical_db.sales_users.find_one({"email": email, "org_id": org_id, "active": True})
        if user:
            return {
                "permissions": user.get("effective_permissions", []),
                "record_access": user.get("record_access", "own"),
                "field_access": user.get("field_access", "limited"),
                "odoo_id": user.get("odoo_id"),
                "roles": user.get("app_roles", [])
            }
    
    # Default for non-synced users
    return {
        "permissions": ["view_dashboard", "view_opportunities", "view_accounts"],
        "record_access": "own",
        "field_access": "standard",
        "odoo_id": None,
        "roles": current_user.get("roles", [])
    }


def require_permission(permission: str):
    """Decorator to require a specific permission"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, current_user: dict = Depends(get_current_user), **kwargs):
            rbac = await get_user_rbac(current_user)
            
            # Admin has all permissions
            if "admin:*" in rbac["permissions"]:
                kwargs["_rbac"] = rbac
                return await func(*args, current_user=current_user, **kwargs)
            
            if permission not in rbac["permissions"]:
                raise HTTPException(
                    status_code=403,
                    detail=f"Permission denied. Required: {permission}"
                )
            
            kwargs["_rbac"] = rbac
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator


def filter_records_by_access(records: list, user_odoo_id: int, record_access: str) -> list:
    """Filter records based on user's record access level"""
    if record_access == "all":
        return records
    
    # "own" - only records owned by this user
    return [
        r for r in records 
        if r.get("owner_id") == user_odoo_id or 
           r.get("user_id") == user_odoo_id or
           r.get("assigned_to_id") == user_odoo_id
    ]


def filter_fields_by_access(record: dict, field_access: str) -> dict:
    """Remove hidden fields based on user's field access level"""
    hidden_fields = FIELD_ACCESS_RULES.get(field_access, FIELD_ACCESS_RULES["limited"])
    
    if not hidden_fields:
        return record
    
    return {k: v for k, v in record.items() if k not in hidden_fields}


def apply_rbac_filters(records: list, rbac: dict) -> list:
    """Apply both record and field filtering based on RBAC"""
    # First filter records
    filtered_records = filter_records_by_access(
        records, 
        rbac.get("odoo_id"), 
        rbac.get("record_access", "own")
    )
    
    # Then filter fields from each record
    return [filter_fields_by_access(r, rbac.get("field_access", "limited")) for r in filtered_records]


class RBACContext:
    """Context manager for RBAC-aware data access"""
    
    def __init__(self, current_user: dict):
        self.current_user = current_user
        self.rbac = None
    
    async def __aenter__(self):
        self.rbac = await get_user_rbac(self.current_user)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    
    def has_permission(self, permission: str) -> bool:
        if not self.rbac:
            return False
        if "admin:*" in self.rbac["permissions"]:
            return True
        return permission in self.rbac["permissions"]
    
    def filter_records(self, records: list) -> list:
        return apply_rbac_filters(records, self.rbac or {})
    
    def can_access_record(self, record: dict) -> bool:
        if self.rbac.get("record_access") == "all":
            return True
        
        user_id = self.rbac.get("odoo_id")
        return (
            record.get("owner_id") == user_id or
            record.get("user_id") == user_id or
            record.get("assigned_to_id") == user_id
        )
