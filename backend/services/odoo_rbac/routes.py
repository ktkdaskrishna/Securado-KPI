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
webhook_router = APIRouter(prefix="/webhooks", tags=["webhooks"])

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


@router.get("/current-user-rbac")
async def get_current_user_rbac(
    current_user: dict = Depends(get_current_user)
):
    """Get RBAC info for the currently logged-in user"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Try to find user by email
    email = current_user.get("email")
    user = await canonical_db.sales_users.find_one({"email": email, "org_id": org_id})
    
    if not user:
        # Return default permissions for non-synced users
        return {
            "user_id": current_user.get("id"),
            "name": current_user.get("name"),
            "app_roles": current_user.get("roles", ["sales_user_own"]),
            "effective_permissions": ["view_dashboard", "view_opportunities", "view_accounts"],
            "record_access": "own",
            "field_access": "standard",
            "hidden_fields": FIELD_ACCESS_RULES.get("standard", [])
        }
    
    hidden_fields = FIELD_ACCESS_RULES.get(user.get("field_access", "limited"), [])
    
    return {
        "user_id": user.get("odoo_id"),
        "name": user.get("name"),
        "app_roles": user.get("app_roles", []),
        "effective_permissions": user.get("effective_permissions", []),
        "record_access": user.get("record_access", "own"),
        "field_access": user.get("field_access", "limited"),
        "hidden_fields": hidden_fields
    }


# ==================== WEBHOOKS ====================

@webhook_router.post("/odoo")
async def odoo_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Receive webhook notifications from Odoo for real-time sync.
    
    This endpoint should be registered in Odoo's Automated Actions (ir.actions.server).
    
    Expected payload:
    {
        "model": "crm.lead",
        "action": "create" | "write" | "unlink",
        "record_id": 123,
        "record_data": {...}  // Optional - full record data
    }
    """
    try:
        payload = await request.json()
        logger.info(f"Received Odoo webhook: {payload}")
        
        model = payload.get("model")
        action = payload.get("action")
        record_id = payload.get("record_id")
        record_data = payload.get("record_data", {})
        
        if not all([model, action, record_id]):
            raise HTTPException(status_code=400, detail="Missing required fields: model, action, record_id")
        
        # Process in background
        background_tasks.add_task(
            process_webhook_event,
            model=model,
            action=action,
            record_id=record_id,
            record_data=record_data
        )
        
        return {"success": True, "message": "Webhook received and queued for processing"}
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_webhook_event(model: str, action: str, record_id: int, record_data: dict):
    """Process a webhook event from Odoo"""
    canonical_db = get_canonical_db()
    org_id = "default"  # TODO: Support multi-org
    
    logger.info(f"Processing webhook: {model}.{action} for record {record_id}")
    
    # Model to collection mapping
    model_collection_map = {
        "crm.lead": "opportunities",
        "res.partner": "accounts",
        "res.users": "sales_users",
        "account.move": "invoices",
        "mail.activity": "activities"
    }
    
    collection_name = model_collection_map.get(model)
    if not collection_name:
        logger.warning(f"Unknown model: {model}")
        return
    
    collection = canonical_db[collection_name]
    
    if action == "unlink":
        # Soft delete - mark as deleted instead of removing
        await collection.update_one(
            {"odoo_id": record_id, "org_id": org_id},
            {"$set": {
                "deleted": True,
                "deleted_at": now_utc(),
                "active": False
            }}
        )
        logger.info(f"Soft deleted {model} record {record_id}")
        
    elif action in ["create", "write"]:
        # For create/write, we need to fetch the full record from Odoo
        # if record_data is not provided
        if not record_data:
            # Trigger a sync for this specific record
            logger.info("Record data not provided, will sync on next ETL run")
            return
        
        # Update/insert the record
        record_data["odoo_id"] = record_id
        record_data["org_id"] = org_id
        record_data["updated_at"] = now_utc()
        record_data["deleted"] = False
        
        await collection.update_one(
            {"odoo_id": record_id, "org_id": org_id},
            {"$set": record_data},
            upsert=True
        )
        logger.info(f"Upserted {model} record {record_id}")


@webhook_router.get("/setup-instructions")
async def get_webhook_setup_instructions():
    """Get instructions for setting up Odoo webhooks"""
    return {
        "title": "Odoo Webhook Setup Instructions",
        "steps": [
            {
                "step": 1,
                "title": "Enable Developer Mode in Odoo",
                "instruction": "Go to Settings > General Settings > Developer Tools > Activate Developer Mode"
            },
            {
                "step": 2,
                "title": "Create Automated Actions",
                "instruction": "Go to Settings > Technical > Automation > Automated Actions"
            },
            {
                "step": 3,
                "title": "Create Action for each model",
                "models": [
                    {
                        "model": "crm.lead",
                        "name": "CRM Lead Sync Webhook",
                        "triggers": ["On Creation", "On Update", "On Deletion"]
                    },
                    {
                        "model": "res.partner",
                        "name": "Partner/Account Sync Webhook",
                        "triggers": ["On Creation", "On Update", "On Deletion"]
                    },
                    {
                        "model": "res.users",
                        "name": "User Sync Webhook",
                        "triggers": ["On Update"]
                    },
                    {
                        "model": "account.move",
                        "name": "Invoice Sync Webhook",
                        "triggers": ["On Creation", "On Update"]
                    },
                    {
                        "model": "mail.activity",
                        "name": "Activity Sync Webhook",
                        "triggers": ["On Creation", "On Update", "On Deletion"]
                    }
                ]
            },
            {
                "step": 4,
                "title": "Configure Action",
                "fields": {
                    "action_type": "Execute Python Code",
                    "python_code": """
import requests
import json

webhook_url = "https://your-app-domain/api/webhooks/odoo"

payload = {
    "model": record._name,
    "action": "write",  # or "create" / "unlink" based on trigger
    "record_id": record.id,
    "record_data": {
        "name": record.name,
        # Add other fields as needed
    }
}

try:
    requests.post(webhook_url, json=payload, timeout=5)
except Exception as e:
    pass  # Log error if needed
"""
                }
            }
        ],
        "webhook_url": "/api/webhooks/odoo",
        "expected_payload": {
            "model": "crm.lead",
            "action": "create | write | unlink",
            "record_id": 123,
            "record_data": {"name": "...", "stage_id": [1, "Won"], "...": "..."}
        }
    }


@webhook_router.post("/setup-odoo-automations")
async def setup_odoo_automations(
    webhook_base_url: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Automatically create Odoo Automated Actions for webhook sync.
    
    This will create automated actions in Odoo that call our webhook endpoint
    when records are created, updated, or deleted.
    
    Args:
        webhook_base_url: The base URL of this application (e.g., https://crm-win-fix.preview.emergentagent.com)
    """
    app_db = get_app_db()
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
        
        webhook_url = f"{webhook_base_url.rstrip('/')}/api/webhooks/odoo"
        
        # Model configurations for webhook setup
        model_configs = [
            {
                "model": "crm.lead",
                "model_id": 362,
                "name": "CRM Webhook Sync",
                "triggers": [("on_create", "create"), ("on_write", "write"), ("on_unlink", "unlink")],
                "fields": ["name", "stage_id", "user_id", "partner_id", "expected_revenue", 
                          "sale_amount_total", "type", "active", "lost_reason_id", "date_closed", "probability"]
            },
            {
                "model": "res.partner",
                "model_id": 79,
                "name": "Partner Webhook Sync",
                "triggers": [("on_create", "create"), ("on_write", "write"), ("on_unlink", "unlink")],
                "fields": ["name", "email", "phone", "active", "company_type", "user_id"]
            },
            {
                "model": "res.users",
                "model_id": 91,
                "name": "User Webhook Sync",
                "triggers": [("on_write", "write")],
                "fields": ["name", "login", "email", "groups_id", "active"]
            },
            {
                "model": "account.move",
                "model_id": 2784,
                "name": "Invoice Webhook Sync",
                "triggers": [("on_create", "create"), ("on_write", "write")],
                "fields": ["name", "partner_id", "amount_total", "state", "payment_state", 
                          "invoice_date", "invoice_date_due"]
            },
            {
                "model": "mail.activity",
                "model_id": 158,
                "name": "Activity Webhook Sync",
                "triggers": [("on_create", "create"), ("on_write", "write"), ("on_unlink", "unlink")],
                "fields": ["activity_type_id", "summary", "date_deadline", "user_id", "res_id", "res_model"]
            }
        ]
        
        created_actions = []
        errors = []
        
        for config in model_configs:
            for trigger, action_type in config["triggers"]:
                action_name = f"{config['name']} - {action_type.upper()}"
                
                # Build Python code for webhook call
                fields_str = ", ".join([f'"{f}": record.{f}' for f in config["fields"][:5]])  # First 5 fields
                python_code = f'''
import requests
import json

webhook_url = "{webhook_url}"

# Build payload with key fields
record_data = {{}}
for field in {config["fields"]}:
    try:
        value = getattr(record, field, None)
        if hasattr(value, 'id'):
            record_data[field] = [value.id, value.name if hasattr(value, 'name') else str(value)]
        elif hasattr(value, 'ids'):
            record_data[field] = value.ids
        else:
            record_data[field] = value
    except:
        pass

payload = {{
    "model": "{config['model']}",
    "action": "{action_type}",
    "record_id": record.id,
    "record_data": record_data
}}

try:
    requests.post(webhook_url, json=payload, timeout=10)
except Exception as e:
    # Log to Odoo logs
    pass
'''
                
                try:
                    # Check if action already exists
                    existing = models.execute_kw(
                        conn["database"], uid, conn["api_key"],
                        'base.automation', 'search',
                        [[('name', '=', action_name)]]
                    )
                    
                    if existing:
                        logger.info(f"Automation '{action_name}' already exists, skipping")
                        continue
                    
                    # Create the automated action
                    action_id = models.execute_kw(
                        conn["database"], uid, conn["api_key"],
                        'base.automation', 'create',
                        [{
                            'name': action_name,
                            'model_id': config["model_id"],
                            'trigger': trigger,
                            'state': 'code',
                            'code': python_code,
                            'active': True
                        }]
                    )
                    
                    created_actions.append({
                        "name": action_name,
                        "id": action_id,
                        "model": config["model"],
                        "trigger": trigger
                    })
                    logger.info(f"Created automation: {action_name} (ID: {action_id})")
                    
                except Exception as e:
                    error_msg = f"Failed to create '{action_name}': {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
        
        return {
            "success": len(errors) == 0,
            "created_actions": created_actions,
            "errors": errors,
            "webhook_url": webhook_url,
            "message": f"Created {len(created_actions)} automated actions" + (f" with {len(errors)} errors" if errors else "")
        }
        
    except Exception as e:
        logger.error(f"Error setting up Odoo automations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/role-mappings")
async def get_role_mappings():
    """Get all configured role mappings"""
    return {
        "mappings": [
            {
                "odoo_group_id": gid,
                **mapping
            }
            for gid, mapping in ODOO_GROUP_MAPPING.items()
        ],
        "field_access_rules": FIELD_ACCESS_RULES
    }
