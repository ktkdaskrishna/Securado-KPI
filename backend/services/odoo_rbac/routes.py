"""Odoo RBAC Sync Service

Syncs Odoo user groups to application roles and handles:
- User groups (res.groups) sync
- User-group membership sync
- Role mapping from Odoo to app permissions
- Real-time sync via webhooks
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from pydantic import BaseModel
import json

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user
from services.etl_runner.runner import ETLRunner

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/odoo-rbac", tags=["odoo-rbac"])

# Odoo group to app role mapping
# Maps Odoo group IDs to application roles with permissions
ODOO_GROUP_MAPPING = {
    # Sales / Administrator (ID 14)
    14: {
        "role": "sales_admin",
        "name": "Sales Administrator",
        "permissions": [
            "view_dashboard", "manage_dashboard",
            "view_opportunities", "manage_opportunities", "update_stage", "update_probability", "delete_opportunities",
            "view_accounts", "manage_accounts", "delete_accounts",
            "view_activities", "manage_activities", "delete_activities",
            "view_goals", "manage_goals", "delete_goals",
            "view_teams", "manage_teams", "delete_teams",
            "view_kpis", "manage_kpis",
            "view_users", "manage_users",
            "view_invoices", "manage_invoices",
            "view_analytics", "manage_analytics"
        ],
        "record_access": "all",
        "field_access": "all"
    },
    # CRM / Sales Director (ID 448)
    448: {
        "role": "sales_director",
        "name": "Sales Director",
        "permissions": [
            "view_dashboard", "manage_dashboard",
            "view_opportunities", "manage_opportunities", "update_stage", "update_probability",
            "view_accounts", "manage_accounts",
            "view_activities", "manage_activities",
            "view_goals", "manage_goals",
            "view_teams", "manage_teams",
            "view_kpis", "manage_kpis",
            "view_users",
            "view_invoices", "manage_invoices",
            "view_analytics", "manage_analytics"
        ],
        "record_access": "all",
        "field_access": "all"
    },
    # Sales / User: All Documents (ID 13)
    13: {
        "role": "sales_user_all",
        "name": "Sales User (All Documents)",
        "permissions": [
            "view_dashboard",
            "view_opportunities", "manage_opportunities", "update_stage",
            "view_accounts", "manage_accounts",
            "view_activities", "manage_activities",
            "view_goals",
            "view_invoices",
            "view_analytics"
        ],
        "record_access": "all",
        "field_access": "standard"
    },
    # Sales / User: All Documents Read only (ID 447)
    447: {
        "role": "sales_user_readonly",
        "name": "Sales User (All Documents Read Only)",
        "permissions": [
            "view_dashboard",
            "view_opportunities",
            "view_accounts",
            "view_activities",
            "view_goals",
            "view_invoices",
            "view_analytics"
        ],
        "record_access": "all",
        "field_access": "standard"
    },
    # Sales / User: department Documents (ID 74)
    74: {
        "role": "sales_user_department",
        "name": "Sales User (Department Documents)",
        "permissions": [
            "view_dashboard",
            "view_opportunities", "manage_opportunities", "update_stage",
            "view_accounts", "manage_accounts",
            "view_activities", "manage_activities",
            "view_goals",
            "view_invoices"
        ],
        "record_access": "department",  # Can see department records
        "field_access": "standard"
    },
    # Sales / User: Own Documents Only (ID 12)
    12: {
        "role": "sales_user_own",
        "name": "Sales User (Own Documents)",
        "permissions": [
            "view_dashboard",
            "view_opportunities", "manage_opportunities", "update_stage",
            "view_accounts",
            "view_activities", "manage_activities",
            "view_goals"
        ],
        "record_access": "own",
        "field_access": "standard"
    },
    # Sales / User: own leads (ID 370)
    370: {
        "role": "sales_user_own_leads",
        "name": "Sales User (Own Leads)",
        "permissions": [
            "view_dashboard",
            "view_opportunities", "manage_opportunities",
            "view_accounts",
            "view_activities"
        ],
        "record_access": "own",
        "field_access": "standard"
    },
    # Sales / Non sales / CRM Readonly (ID 449)
    449: {
        "role": "crm_readonly",
        "name": "CRM Readonly",
        "permissions": [
            "view_dashboard",
            "view_opportunities",
            "view_accounts",
            "view_activities",
            "view_goals"
        ],
        "record_access": "all",
        "field_access": "limited"
    },
    # Accounting / Accountant (ID 302)
    302: {
        "role": "accountant",
        "name": "Accountant",
        "permissions": [
            "view_dashboard",
            "view_invoices", "manage_invoices",
            "view_accounts",
            "view_analytics"
        ],
        "record_access": "all",
        "field_access": "all"  # Accountants need full financial visibility
    },
    # Accounting / Billing (ID 300)
    300: {
        "role": "billing",
        "name": "Billing User",
        "permissions": [
            "view_invoices", "manage_invoices",
            "view_accounts"
        ],
        "record_access": "all",
        "field_access": "standard"
    },
    # Accounting / Bookkeeper (ID 301)
    301: {
        "role": "bookkeeper",
        "name": "Bookkeeper",
        "permissions": [
            "view_invoices",
            "view_accounts"
        ],
        "record_access": "all",
        "field_access": "standard"
    },
    # Accounting / Read-only (ID 299)
    299: {
        "role": "accounting_readonly",
        "name": "Accounting Read-only",
        "permissions": [
            "view_invoices",
            "view_accounts"
        ],
        "record_access": "all",
        "field_access": "limited"
    },
    # CRM Checklists Super User (ID 394)
    394: {
        "role": "crm_checklist_admin",
        "name": "CRM Checklist Admin",
        "permissions": [
            "view_dashboard",
            "view_opportunities", "manage_opportunities",
            "view_activities", "manage_activities"
        ],
        "record_access": "all",
        "field_access": "standard"
    },
    # Administration / Access Rights (ID 2)
    2: {
        "role": "admin",
        "name": "Administrator",
        "permissions": ["admin:*"],
        "record_access": "all",
        "field_access": "all"
    }
}

# Fields hidden based on access level
FIELD_ACCESS_RULES = {
    "all": [],  # No fields hidden
    "standard": ["expected_revenue", "margin", "cost"],  # Some financial fields hidden
    "limited": ["sale_value", "expected_revenue", "margin", "cost", "commission", "probability"]  # Most sensitive fields hidden
}


class OdooWebhookPayload(BaseModel):
    """Payload received from Odoo webhook/automation"""
    model: str
    action: str  # create, write, unlink
    record_id: int
    record_data: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None


class SyncResult(BaseModel):
    synced_groups: int
    synced_users: int
    errors: List[str] = []


# ==================== RBAC SYNC ====================

@router.post("/sync-groups")
async def sync_odoo_groups(
    current_user: dict = Depends(get_current_user)
):
    """Sync Odoo user groups to application roles"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get Odoo connection
    conn = await app_db.connections.find_one({"org_id": org_id, "type": "odoo"})
    if not conn:
        raise HTTPException(status_code=404, detail="No Odoo connection found")
    
    try:
        from services.etl_control.routes import create_odoo_proxy
        import ssl
        
        # Create SSL context
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        # Connect to Odoo
        common = create_odoo_proxy(conn["url"], "common")
        uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
        
        if not uid:
            raise HTTPException(status_code=401, detail="Odoo authentication failed")
        
        models = create_odoo_proxy(conn["url"], "object")
        
        # Fetch groups
        groups = models.execute_kw(
            conn["database"], uid, conn["api_key"],
            'res.groups', 'search_read',
            [[]],
            {'fields': ['id', 'name', 'full_name', 'category_id', 'implied_ids', 'users']}
        )
        
        logger.info(f"Fetched {len(groups)} groups from Odoo")
        
        # Sync groups to MongoDB
        synced = 0
        for group in groups:
            odoo_id = group['id']
            
            # Get app role mapping if exists
            mapping = ODOO_GROUP_MAPPING.get(odoo_id, {})
            
            group_doc = {
                "odoo_id": odoo_id,
                "name": group.get('name'),
                "full_name": group.get('full_name'),
                "category": group.get('category_id')[1] if group.get('category_id') else None,
                "implied_ids": group.get('implied_ids', []),
                "user_ids": group.get('users', []),
                "app_role": mapping.get('role'),
                "app_permissions": mapping.get('permissions', []),
                "record_access": mapping.get('record_access', 'own'),
                "field_access": mapping.get('field_access', 'limited'),
                "org_id": org_id,
                "updated_at": now_utc()
            }
            
            await canonical_db.odoo_groups.update_one(
                {"odoo_id": odoo_id, "org_id": org_id},
                {"$set": group_doc},
                upsert=True
            )
            synced += 1
        
        return {
            "success": True,
            "synced_groups": synced,
            "message": f"Synced {synced} groups from Odoo"
        }
        
    except Exception as e:
        logger.error(f"Error syncing groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-users")
async def sync_odoo_users(
    current_user: dict = Depends(get_current_user)
):
    """Sync ACTIVE Odoo users with their group memberships"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get Odoo connection
    conn = await app_db.connections.find_one({"org_id": org_id, "type": "odoo"})
    if not conn:
        raise HTTPException(status_code=404, detail="No Odoo connection found")
    
    try:
        from services.etl_control.routes import create_odoo_proxy
        
        common = create_odoo_proxy(conn["url"], "common")
        uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
        
        if not uid:
            raise HTTPException(status_code=401, detail="Odoo authentication failed")
        
        models = create_odoo_proxy(conn["url"], "object")
        
        # Fetch ONLY ACTIVE users
        users = models.execute_kw(
            conn["database"], uid, conn["api_key"],
            'res.users', 'search_read',
            [[('active', '=', True)]],  # Only active users
            {'fields': ['id', 'name', 'login', 'email', 'groups_id', 'company_id', 'partner_id']}
        )
        
        logger.info(f"Fetched {len(users)} active users from Odoo")
        
        # Get all synced groups for permission mapping
        groups = await canonical_db.odoo_groups.find({"org_id": org_id}).to_list(1000)
        group_map = {g["odoo_id"]: g for g in groups}
        
        synced = 0
        for user in users:
            # Calculate effective permissions from groups
            user_groups = user.get('groups_id', [])
            effective_permissions = set()
            record_access = "own"  # Default to most restrictive
            field_access = "limited"
            app_roles = []
            
            for gid in user_groups:
                group = group_map.get(gid)
                if group:
                    effective_permissions.update(group.get('app_permissions', []))
                    if group.get('app_role'):
                        app_roles.append(group['app_role'])
                    
                    # Escalate access levels
                    if group.get('record_access') == 'all':
                        record_access = 'all'
                    if group.get('field_access') == 'all':
                        field_access = 'all'
                    elif group.get('field_access') == 'standard' and field_access == 'limited':
                        field_access = 'standard'
            
            user_doc = {
                "odoo_id": user['id'],
                "name": user.get('name'),
                "login": user.get('login'),
                "email": user.get('email'),
                "odoo_groups": user_groups,
                "app_roles": list(set(app_roles)),
                "effective_permissions": list(effective_permissions),
                "record_access": record_access,
                "field_access": field_access,
                "company_id": user.get('company_id')[0] if user.get('company_id') else None,
                "active": True,
                "org_id": org_id,
                "updated_at": now_utc()
            }
            
            await canonical_db.sales_users.update_one(
                {"odoo_id": user['id'], "org_id": org_id},
                {"$set": user_doc},
                upsert=True
            )
            synced += 1
        
        # Mark inactive users that are no longer active in Odoo
        active_ids = [u['id'] for u in users]
        await canonical_db.sales_users.update_many(
            {"org_id": org_id, "odoo_id": {"$nin": active_ids}},
            {"$set": {"active": False, "updated_at": now_utc()}}
        )
        
        return {
            "success": True,
            "synced_users": synced,
            "message": f"Synced {synced} active users from Odoo"
        }
        
    except Exception as e:
        logger.error(f"Error syncing users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user-permissions/{user_id}")
async def get_user_permissions(
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get effective permissions for a specific user"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    user = await canonical_db.sales_users.find_one({"odoo_id": user_id, "org_id": org_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hidden_fields = FIELD_ACCESS_RULES.get(user.get("field_access", "limited"), [])
    
    return {
        "user_id": user_id,
        "name": user.get("name"),
        "app_roles": user.get("app_roles", []),
        "effective_permissions": user.get("effective_permissions", []),
        "record_access": user.get("record_access", "own"),
        "field_access": user.get("field_access", "limited"),
        "hidden_fields": hidden_fields
    }


# Shared role → permissions mapping for app-level role resolution
APP_ROLE_PERMS = {
    "admin": {"perms": ["admin:*", "view_dashboard", "manage_dashboard", "view_opportunities", "manage_opportunities", "update_stage", "update_probability",
        "view_accounts", "manage_accounts", "view_activities", "manage_activities", "view_goals", "manage_goals", "view_teams", "manage_teams",
        "view_kpis", "manage_kpis", "view_users", "manage_users", "view_invoices", "manage_invoices", "view_analytics", "manage_analytics",
        "view_profile", "system_admin"], "access": "all"},
    "sales_admin": {"perms": ["view_dashboard", "manage_dashboard", "view_opportunities", "manage_opportunities", "update_stage", "update_probability",
        "view_accounts", "manage_accounts", "view_activities", "manage_activities", "view_goals", "manage_goals", "view_teams", "manage_teams",
        "view_kpis", "manage_kpis", "view_users", "manage_users", "view_invoices", "manage_invoices", "view_analytics", "manage_analytics", "view_profile"], "access": "all"},
    "system_admin": {"perms": ["admin:*", "view_dashboard", "manage_dashboard", "system_admin", "manage_users", "view_users", "view_goals", "view_kpis", "view_profile"], "access": "all"},
    "sales_director": {"perms": ["view_dashboard", "manage_dashboard", "view_opportunities", "manage_opportunities", "update_stage", "update_probability",
        "view_accounts", "manage_accounts", "view_activities", "manage_activities", "view_goals", "manage_goals", "view_teams", "manage_teams",
        "view_kpis", "manage_kpis", "view_users", "view_invoices", "manage_invoices", "view_analytics", "manage_analytics", "view_profile"], "access": "all"},
    "product_director": {"perms": ["view_dashboard", "manage_dashboard", "view_opportunities", "manage_opportunities",
        "view_accounts", "manage_accounts", "view_activities", "manage_activities", "view_goals", "manage_goals",
        "view_kpis", "manage_kpis", "view_invoices", "view_analytics", "manage_analytics", "view_teams", "view_profile"], "access": "all"},
    "product_manager": {"perms": ["view_dashboard", "manage_dashboard", "view_opportunities", "manage_opportunities",
        "view_accounts", "manage_accounts", "view_activities", "manage_activities", "view_goals", "manage_goals",
        "view_kpis", "manage_kpis", "view_invoices", "view_analytics", "manage_analytics", "view_teams", "view_profile"], "access": "all"},
    "sales_manager": {"perms": ["view_dashboard", "view_opportunities", "manage_opportunities", "view_accounts", "manage_accounts",
        "view_activities", "manage_activities", "view_goals", "manage_goals", "view_teams", "view_kpis", "view_invoices", "view_analytics", "view_profile"], "access": "all"},
    "sales_rep": {"perms": ["view_dashboard", "view_opportunities", "view_accounts", "view_activities", "view_goals", "view_profile"], "access": "own"},
    "sales_user_own": {"perms": ["view_dashboard", "view_opportunities", "view_accounts", "view_activities", "view_goals", "view_profile"], "access": "own"},
    "sales_user_all": {"perms": ["view_dashboard", "view_opportunities", "view_accounts", "view_activities", "view_goals", "view_invoices", "view_analytics", "view_profile"], "access": "all"},
    "executive": {"perms": ["view_dashboard", "manage_dashboard", "view_opportunities", "view_accounts", "view_activities", "view_goals",
        "view_kpis", "view_invoices", "view_analytics", "manage_analytics", "view_profile"], "access": "all"},
    "accountant": {"perms": ["view_dashboard", "view_accounts", "view_invoices", "manage_invoices", "view_analytics", "view_profile"], "access": "all"},
    "billing": {"perms": ["view_dashboard", "view_invoices", "manage_invoices", "view_profile"], "access": "all"},
    "user": {"perms": ["view_dashboard", "view_opportunities", "view_accounts", "view_activities", "view_goals", "view_profile"], "access": "own"},
}

@router.get("/current-user-rbac")
async def get_current_user_rbac(
    current_user: dict = Depends(get_current_user)
):
    """Get RBAC info for the currently logged-in user
    
    SECURITY: Users without RBAC records get RESTRICTED access (not full access)
    """
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Try to find user by email
    email = current_user.get("email")
    logger.info(f"Looking up RBAC for user: {email}, org_id: {org_id}")
    
    # First check canonical sales_users
    user = await canonical_db.sales_users.find_one({"email": email, "org_id": org_id})
    
    # If not in canonical, check users_rbac for Odoo group info
    users_rbac_record = None
    if not user:
        users_rbac_record = await app_db.users_rbac.find_one({
            "$or": [
                {"email": {"$regex": f"^{email}$", "$options": "i"}},
                {"login": {"$regex": f"^{email.split('@')[0]}$", "$options": "i"}}
            ],
            "org_id": org_id
        })
    
    # Determine access based on what we found
    if not user and not users_rbac_record:
        # Check if user has roles in the app users collection as fallback
        app_user = await app_db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
        app_roles_list = app_user.get("roles", []) if app_user else []
        
        if app_roles_list:
            # Resolve permissions from app-level roles
            logger.info(f"User {email} not in RBAC but has app roles: {app_roles_list}")
            permissions = set(["view_dashboard", "view_profile"])
            resolved_roles = []
            record_access = "own"
            
            for role in app_roles_list:
                if role in APP_ROLE_PERMS:
                    permissions.update(APP_ROLE_PERMS[role]["perms"])
                    resolved_roles.append(role)
                    if APP_ROLE_PERMS[role]["access"] == "all":
                        record_access = "all"
            
            return {
                "user_id": current_user.get("id"),
                "name": current_user.get("name") or app_user.get("name"),
                "app_roles": resolved_roles or app_roles_list,
                "effective_permissions": list(permissions),
                "record_access": record_access,
                "field_access": "all" if "admin" in app_roles_list or "sales_admin" in app_roles_list else "standard",
                "hidden_fields": [],
                "rbac_synced": False,
                "source": "app_roles_fallback"
            }
        
        # SECURITY: User not in RBAC system - give RESTRICTED access only
        logger.warning(f"SECURITY: User {email} has no RBAC record and no app roles - applying RESTRICTED access")
        restricted_permissions = ["view_profile"]
        return {
            "user_id": current_user.get("id"),
            "name": current_user.get("name"),
            "app_roles": ["restricted"],
            "effective_permissions": restricted_permissions,
            "record_access": "none",
            "field_access": "limited",
            "hidden_fields": FIELD_ACCESS_RULES.get("limited", []),
            "rbac_synced": False,
            "warning": "User not synced with Odoo RBAC - contact administrator"
        }
    
    # If we have users_rbac but no sales_users, determine access from Odoo groups
    if users_rbac_record and not user:
        odoo_groups = users_rbac_record.get("odoo_group_names", [])
        logger.info(f"User {email} found in users_rbac with groups: {odoo_groups}")
        
        # If odoo_groups is empty, fall back to app-level roles
        if not odoo_groups:
            app_user = await app_db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
            app_roles_list = app_user.get("roles", []) if app_user else []
            if app_roles_list:
                logger.info(f"User {email} has empty odoo_groups, using app roles: {app_roles_list}")
                permissions = set(["view_dashboard", "view_profile"])
                resolved_roles = []
                record_access = "own"
                for role in app_roles_list:
                    if role in APP_ROLE_PERMS:
                        permissions.update(APP_ROLE_PERMS[role]["perms"])
                        resolved_roles.append(role)
                        if APP_ROLE_PERMS[role]["access"] == "all":
                            record_access = "all"
                return {
                    "user_id": users_rbac_record.get("odoo_user_id") or current_user.get("id"),
                    "name": current_user.get("name"),
                    "app_roles": resolved_roles or app_roles_list,
                    "effective_permissions": list(permissions),
                    "record_access": record_access,
                    "field_access": "all" if any(r in ["admin", "sales_admin", "sales_director"] for r in app_roles_list) else "standard",
                    "hidden_fields": [],
                    "rbac_synced": True,
                    "source": "app_roles_fallback_from_rbac"
                }
        
        # Determine access level from groups (highest wins)
        access_level = "user"  # Default
        record_access = "own"  # Default to own records only
        
        # Check for user-level groups (lowest priority)
        user_groups = ["Sales / User", "Sales / User: Own Documents Only"]
        if any(g in odoo_groups for g in user_groups):
            access_level = "user"
            record_access = "own"
        
        # Check for manager groups (higher priority)
        manager_groups = ["Sales / Manager", "CRM / Manager"]
        if any(g in odoo_groups for g in manager_groups):
            access_level = "manager"
            record_access = "team"  # Team + direct reports
        
        # Check for director groups (even higher priority)
        director_groups = ["CRM / Sales Director", "Sales Director"]
        if any(g in odoo_groups for g in director_groups):
            access_level = "director"
            record_access = "all"
        
        # Check for admin groups (HIGHEST priority - checked last so it wins)
        admin_groups = ["Administration / Settings", "Administration / Access Rights", 
                       "Sales / Administrator", "Sales / All Documents", "CRM / Administrator"]
        if any(g in odoo_groups for g in admin_groups):
            access_level = "admin"
            record_access = "all"
        
        # Build permissions based on access level
        permissions = ["view_dashboard", "view_profile"]
        if access_level in ["admin", "director", "manager", "user"]:
            permissions.extend(["view_opportunities", "view_accounts", "view_activities", "view_goals"])
        if access_level in ["admin", "director", "manager"]:
            permissions.extend(["manage_opportunities", "manage_accounts", "view_analytics", "view_teams", "manage_goals", "view_invoices"])
        if access_level in ["admin", "director"]:
            permissions.extend(["manage_dashboard", "manage_analytics", "view_kpis", "manage_kpis", "manage_invoices"])
        if access_level == "admin":
            permissions.extend(["manage_users", "view_users", "manage_teams", "system_admin"])
        
        # Also merge app-level roles
        app_user_record = await app_db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
        if app_user_record:
            for role in app_user_record.get("roles", []):
                if role in APP_ROLE_PERMS:
                    permissions.extend(APP_ROLE_PERMS[role]["perms"])
        
        merged_roles = [access_level]
        if app_user_record:
            merged_roles = list(set(merged_roles + app_user_record.get("roles", [])))
        
        return {
            "user_id": users_rbac_record.get("odoo_user_id"),
            "name": users_rbac_record.get("name") or current_user.get("name"),
            "app_roles": merged_roles,
            "effective_permissions": list(set(permissions)),
            "record_access": record_access,
            "field_access": "all" if access_level in ["admin", "director"] else "standard",
            "hidden_fields": [],
            "rbac_synced": True,
            "odoo_groups": odoo_groups
        }
    
    # User found in sales_users - check if permissions are set
    hidden_fields = FIELD_ACCESS_RULES.get(user.get("field_access", "limited"), [])
    app_roles = user.get("app_roles", [])
    effective_permissions = user.get("effective_permissions", [])
    
    # If permissions are empty in sales_users, compute from users_rbac
    if not effective_permissions:
        # Try to get from users_rbac
        users_rbac_record = await app_db.users_rbac.find_one({
            "$or": [
                {"email": {"$regex": f"^{email}$", "$options": "i"}},
                {"login": {"$regex": f"^{email.split('@')[0]}$", "$options": "i"}}
            ],
            "org_id": org_id
        })
        
        if users_rbac_record:
            odoo_groups = users_rbac_record.get("odoo_group_names", [])
            # Determine access from groups (same logic as above)
            access_level = "user"
            record_access = "own"
            
            admin_groups = ["Administration / Settings", "Administration / Access Rights", 
                           "Sales / Administrator", "Sales / All Documents", "CRM / Administrator"]
            if any(g in odoo_groups for g in admin_groups):
                access_level = "admin"
                record_access = "all"
            
            director_groups = ["CRM / Sales Director", "Sales Director"]
            if any(g in odoo_groups for g in director_groups):
                access_level = "director"
                record_access = "all"
            
            manager_groups = ["Sales / Manager", "CRM / Manager"]
            if any(g in odoo_groups for g in manager_groups):
                access_level = "manager"
                record_access = "team"
            
            permissions = ["view_dashboard", "view_profile"]
            if access_level in ["admin", "director", "manager", "user"]:
                permissions.extend(["view_opportunities", "view_accounts", "view_activities", "view_goals"])
            if access_level in ["admin", "director", "manager"]:
                permissions.extend(["manage_opportunities", "manage_accounts", "view_analytics", "view_teams", "manage_goals", "view_invoices"])
            if access_level in ["admin", "director"]:
                permissions.extend(["manage_dashboard", "manage_analytics", "view_kpis", "manage_kpis", "manage_invoices"])
            if access_level == "admin":
                permissions.extend(["manage_users", "view_users", "manage_teams", "system_admin"])
            
            # Also merge permissions from app-level roles
            app_user_record = await app_db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
            if app_user_record:
                for role in app_user_record.get("roles", []):
                    if role in APP_ROLE_PERMS:
                        permissions.extend(APP_ROLE_PERMS[role]["perms"])
                        if APP_ROLE_PERMS[role]["access"] == "all":
                            record_access = "all"
            
            effective_permissions = list(set(permissions))
            app_roles = [access_level]
            if app_user_record:
                app_roles = list(set(app_roles + app_user_record.get("roles", [])))
            
            return {
                "user_id": user.get("odoo_id") or user.get("source_record_id"),
                "name": user.get("name"),
                "app_roles": app_roles,
                "effective_permissions": effective_permissions,
                "record_access": record_access,
                "field_access": "all" if access_level in ["admin", "director"] else "standard",
                "hidden_fields": [],
                "rbac_synced": True
            }
        else:
            # No RBAC info at all - restricted
            logger.warning(f"User {email} in sales_users but no RBAC groups - restricted access")
            return {
                "user_id": user.get("odoo_id") or user.get("source_record_id"),
                "name": user.get("name"),
                "app_roles": ["restricted"],
                "effective_permissions": ["view_profile"],
                "record_access": "none",
                "field_access": "limited",
                "hidden_fields": hidden_fields,
                "rbac_synced": False
            }
    
    return {
        "user_id": user.get("odoo_id") or user.get("source_record_id"),
        "name": user.get("name"),
        "app_roles": app_roles,
        "effective_permissions": effective_permissions,
        "record_access": user.get("record_access", "own"),
        "field_access": user.get("field_access", "limited"),
        "hidden_fields": hidden_fields,
        "rbac_synced": True
    }

