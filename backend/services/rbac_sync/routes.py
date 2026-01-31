"""RBAC Sync API Routes

Provides endpoints for:
- Triggering RBAC metadata sync from Odoo
- Viewing user permissions
- Testing access rules
- Admin management of access mappings
- Local permission overrides
"""
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from typing import Optional, List
from pydantic import BaseModel
import logging
from datetime import datetime, timezone

from libs.database import get_app_db
from libs.utils import generate_id
from services.identity.routes import get_current_user
from .user_sync import odoo_user_sync
from .access_rules import access_rule_engine, AccessLevel


class PermissionOverrideCreate(BaseModel):
    """Model for creating a local permission override"""
    user_email: str
    access_level: str  # ADMIN, MANAGER, USER, RESTRICTED
    reason: str = ""
    expires_at: Optional[str] = None  # ISO date string


class PermissionOverrideUpdate(BaseModel):
    """Model for updating a permission override"""
    access_level: Optional[str] = None
    reason: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: Optional[bool] = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rbac", tags=["rbac-sync"])


@router.post("/sync")
async def trigger_rbac_sync(
    connection_id: Optional[str] = Query(None, description="Odoo connection ID to use"),
    current_user: dict = Depends(get_current_user)
):
    """Trigger sync of user/group/team metadata from Odoo
    
    This syncs:
    - res.users (with group memberships)
    - res.groups (role definitions)
    - crm.team (sales teams)
    """
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Get Odoo connection - check both 'id' and 'connection_id' fields
    connection = None
    if connection_id:
        # Try by 'id' field first (current schema)
        connection = await app_db.connections.find_one({"id": connection_id, "org_id": org_id})
        # Fallback to 'connection_id' field (legacy schema)
        if not connection:
            connection = await app_db.connections.find_one({"connection_id": connection_id, "org_id": org_id})
    
    if not connection:
        # Use first active Odoo connection
        connection = await app_db.connections.find_one({
            "type": "odoo",
            "status": "active",
            "org_id": org_id
        })
    
    if not connection:
        raise HTTPException(status_code=404, detail="No Odoo connection found")
    
    # Get connection config - fields are at root level, not in 'config' sub-object
    odoo_url = connection.get("url") or connection.get("config", {}).get("url")
    odoo_db = connection.get("database") or connection.get("config", {}).get("database")
    odoo_username = connection.get("username") or connection.get("config", {}).get("username")
    odoo_password = connection.get("api_key") or connection.get("config", {}).get("password")
    
    if not all([odoo_url, odoo_db, odoo_username, odoo_password]):
        raise HTTPException(status_code=400, detail="Odoo connection missing required fields (url, database, username, api_key)")
    
    result = await odoo_user_sync.sync_from_odoo(
        odoo_url=odoo_url,
        odoo_db=odoo_db,
        odoo_username=odoo_username,
        odoo_password=odoo_password,
        org_id=org_id
    )
    
    return result


@router.get("/users")
async def list_synced_users(
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user)
):
    """List all synced users with their RBAC metadata"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    users = await app_db.users_rbac.find(
        {"org_id": org_id}
    ).sort("name", 1).limit(limit).to_list(limit)
    
    # Serialize
    result = []
    for user in users:
        result.append({
            "odoo_user_id": user.get("odoo_user_id"),
            "name": user.get("name"),
            "login": user.get("login"),
            "email": user.get("email"),
            "groups": user.get("odoo_group_names", []),
            "teams": user.get("odoo_team_names", []),
            "access_level": access_rule_engine.determine_access_level(
                user.get("odoo_group_names", [])
            ).name,
            "synced_at": user.get("synced_at").isoformat() if user.get("synced_at") else None
        })
    
    return {
        "count": len(result),
        "users": result
    }


@router.get("/groups")
async def list_synced_groups(
    current_user: dict = Depends(get_current_user)
):
    """List all synced Odoo groups"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    groups = await app_db.groups_rbac.find(
        {"org_id": org_id}
    ).sort("full_name", 1).to_list(500)
    
    result = []
    for group in groups:
        result.append({
            "odoo_group_id": group.get("odoo_group_id"),
            "name": group.get("name"),
            "full_name": group.get("full_name"),
            "category": group.get("category"),
            "user_count": group.get("user_count", 0)
        })
    
    return {
        "count": len(result),
        "groups": result
    }


@router.get("/teams")
async def list_synced_teams(
    current_user: dict = Depends(get_current_user)
):
    """List all synced sales teams"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    teams = await app_db.teams_rbac.find(
        {"org_id": org_id}
    ).sort("name", 1).to_list(100)
    
    result = []
    for team in teams:
        result.append({
            "odoo_team_id": team.get("odoo_team_id"),
            "name": team.get("name"),
            "leader_name": team.get("leader_name"),
            "member_count": len(team.get("member_ids", [])),
            "active": team.get("active", True)
        })
    
    return {
        "count": len(result),
        "teams": result
    }


@router.get("/my-access")
async def get_my_access(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's access permissions"""
    user_name = current_user.get("name") or current_user.get("email", "").split("@")[0]
    org_id = current_user.get("org_id", "default")
    
    return await access_rule_engine.get_user_access_summary(user_name, org_id)


@router.get("/user-access/{user_name}")
async def get_user_access(
    user_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get access permissions for a specific user (admin only)"""
    org_id = current_user.get("org_id", "default")
    
    return await access_rule_engine.get_user_access_summary(user_name, org_id)


@router.get("/test-filter/{user_name}")
async def test_rbac_filter(
    user_name: str,
    entity_type: str = Query("opportunity", description="Entity type to test"),
    current_user: dict = Depends(get_current_user)
):
    """Test what RBAC filter would be applied for a user
    
    Useful for debugging and verifying access rules.
    """
    org_id = current_user.get("org_id", "default")
    
    rbac_filter = await access_rule_engine.get_filter_for_user(
        user_name=user_name,
        org_id=org_id,
        entity_type=entity_type
    )
    
    access_summary = await access_rule_engine.get_user_access_summary(user_name, org_id)
    
    return {
        "user_name": user_name,
        "entity_type": entity_type,
        "access_level": access_summary.get("access_level"),
        "filter_type": access_summary.get("filter_type"),
        "mongodb_filter": rbac_filter,
        "groups": access_summary.get("groups", []),
        "teams": access_summary.get("teams", [])
    }


@router.get("/stats")
async def get_rbac_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get RBAC sync statistics"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    users_count = await app_db.users_rbac.count_documents({"org_id": org_id})
    groups_count = await app_db.groups_rbac.count_documents({"org_id": org_id})
    teams_count = await app_db.teams_rbac.count_documents({"org_id": org_id})
    
    # Get latest sync time
    latest_user = await app_db.users_rbac.find_one(
        {"org_id": org_id},
        sort=[("synced_at", -1)]
    )
    
    # Count by access level
    access_level_counts = {
        "ADMIN": 0,
        "MANAGER": 0,
        "USER": 0,
        "RESTRICTED": 0
    }
    
    async for user in app_db.users_rbac.find({"org_id": org_id}):
        level = access_rule_engine.determine_access_level(
            user.get("odoo_group_names", [])
        )
        access_level_counts[level.name] += 1
    
    return {
        "org_id": org_id,
        "users_synced": users_count,
        "groups_synced": groups_count,
        "teams_synced": teams_count,
        "access_level_distribution": access_level_counts,
        "last_sync": latest_user.get("synced_at").isoformat() if latest_user and latest_user.get("synced_at") else None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ==================== PERMISSION OVERRIDES ====================

@router.get("/overrides")
async def list_permission_overrides(
    current_user: dict = Depends(get_current_user)
):
    """List all local permission overrides"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    overrides = await app_db.permission_overrides.find(
        {"org_id": org_id}
    ).sort("created_at", -1).to_list(500)
    
    result = []
    for override in overrides:
        result.append({
            "id": override.get("id"),
            "user_email": override.get("user_email"),
            "user_name": override.get("user_name"),
            "access_level": override.get("access_level"),
            "reason": override.get("reason", ""),
            "expires_at": override.get("expires_at").isoformat() if override.get("expires_at") else None,
            "is_active": override.get("is_active", True),
            "created_by": override.get("created_by"),
            "created_at": override.get("created_at").isoformat() if override.get("created_at") else None,
            "updated_at": override.get("updated_at").isoformat() if override.get("updated_at") else None
        })
    
    return {
        "count": len(result),
        "overrides": result
    }


@router.post("/overrides")
async def create_permission_override(
    override_data: PermissionOverrideCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a local permission override for a user
    
    This allows admins to grant temporary elevated access or
    restrict access for specific users regardless of Odoo sync.
    """
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Validate access level
    valid_levels = ["ADMIN", "MANAGER", "USER", "RESTRICTED"]
    if override_data.access_level.upper() not in valid_levels:
        raise HTTPException(status_code=400, detail=f"Invalid access level. Must be one of: {valid_levels}")
    
    # Check if override already exists for this user
    existing = await app_db.permission_overrides.find_one({
        "user_email": override_data.user_email.lower(),
        "org_id": org_id,
        "is_active": True
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Active override already exists for {override_data.user_email}. Deactivate it first or update it."
        )
    
    # Look up user name from users table or RBAC table
    user_name = None
    app_user = await app_db.users.find_one({"email": override_data.user_email.lower()})
    if app_user:
        user_name = app_user.get("name")
    else:
        rbac_user = await app_db.users_rbac.find_one({
            "email": {"$regex": f"^{override_data.user_email}$", "$options": "i"},
            "org_id": org_id
        })
        if rbac_user:
            user_name = rbac_user.get("name")
    
    # Parse expires_at
    expires_at = None
    if override_data.expires_at:
        try:
            expires_at = datetime.fromisoformat(override_data.expires_at.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expires_at date format. Use ISO format.")
    
    override_doc = {
        "id": generate_id(),
        "org_id": org_id,
        "user_email": override_data.user_email.lower(),
        "user_name": user_name or override_data.user_email.split("@")[0],
        "access_level": override_data.access_level.upper(),
        "reason": override_data.reason,
        "expires_at": expires_at,
        "is_active": True,
        "created_by": current_user.get("email"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await app_db.permission_overrides.insert_one(override_doc)
    
    logger.info(f"Permission override created: {override_data.user_email} -> {override_data.access_level} by {current_user.get('email')}")
    
    return {
        "status": "success",
        "message": f"Permission override created for {override_data.user_email}",
        "override": {
            "id": override_doc["id"],
            "user_email": override_doc["user_email"],
            "access_level": override_doc["access_level"],
            "expires_at": expires_at.isoformat() if expires_at else None
        }
    }


@router.put("/overrides/{override_id}")
async def update_permission_override(
    override_id: str,
    update_data: PermissionOverrideUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing permission override"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Find the override
    existing = await app_db.permission_overrides.find_one({
        "id": override_id,
        "org_id": org_id
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Permission override not found")
    
    # Build update
    update_fields = {"updated_at": datetime.now(timezone.utc)}
    
    if update_data.access_level is not None:
        valid_levels = ["ADMIN", "MANAGER", "USER", "RESTRICTED"]
        if update_data.access_level.upper() not in valid_levels:
            raise HTTPException(status_code=400, detail=f"Invalid access level. Must be one of: {valid_levels}")
        update_fields["access_level"] = update_data.access_level.upper()
    
    if update_data.reason is not None:
        update_fields["reason"] = update_data.reason
    
    if update_data.is_active is not None:
        update_fields["is_active"] = update_data.is_active
    
    if update_data.expires_at is not None:
        if update_data.expires_at == "":
            update_fields["expires_at"] = None
        else:
            try:
                update_fields["expires_at"] = datetime.fromisoformat(update_data.expires_at.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid expires_at date format")
    
    await app_db.permission_overrides.update_one(
        {"id": override_id},
        {"$set": update_fields}
    )
    
    logger.info(f"Permission override updated: {override_id} by {current_user.get('email')}")
    
    return {
        "status": "success",
        "message": "Permission override updated"
    }


@router.delete("/overrides/{override_id}")
async def delete_permission_override(
    override_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a permission override"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    result = await app_db.permission_overrides.delete_one({
        "id": override_id,
        "org_id": org_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Permission override not found")
    
    logger.info(f"Permission override deleted: {override_id} by {current_user.get('email')}")
    
    return {
        "status": "success",
        "message": "Permission override deleted"
    }


@router.get("/user-effective-access/{user_email}")
async def get_effective_access(
    user_email: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the effective access level for a user (considering overrides)
    
    This shows:
    1. Base access from Odoo sync
    2. Any active local overrides
    3. The final effective access level
    """
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC data
    user_rbac = await app_db.users_rbac.find_one({
        "org_id": org_id,
        "$or": [
            {"email": {"$regex": f"^{user_email}$", "$options": "i"}},
            {"login": {"$regex": f"^{user_email}$", "$options": "i"}}
        ]
    })
    
    base_access = None
    if user_rbac:
        group_names = user_rbac.get("odoo_group_names", [])
        base_level = access_rule_engine.determine_access_level(group_names)
        base_access = {
            "level": base_level.name,
            "source": "odoo_sync",
            "groups": group_names[:10],  # Limit groups shown
            "teams": user_rbac.get("odoo_team_names", [])
        }
    
    # Get active override
    override = await app_db.permission_overrides.find_one({
        "user_email": user_email.lower(),
        "org_id": org_id,
        "is_active": True
    })
    
    override_info = None
    if override:
        # Check if expired
        is_expired = False
        if override.get("expires_at") and override["expires_at"] < datetime.now(timezone.utc):
            is_expired = True
        
        override_info = {
            "id": override.get("id"),
            "level": override.get("access_level"),
            "reason": override.get("reason"),
            "expires_at": override.get("expires_at").isoformat() if override.get("expires_at") else None,
            "is_expired": is_expired,
            "created_by": override.get("created_by")
        }
    
    # Determine effective access
    effective_level = "RESTRICTED"
    effective_source = "default"
    
    if override_info and not override_info.get("is_expired"):
        effective_level = override_info["level"]
        effective_source = "local_override"
    elif base_access:
        effective_level = base_access["level"]
        effective_source = "odoo_sync"
    
    return {
        "user_email": user_email,
        "base_access": base_access,
        "override": override_info,
        "effective": {
            "level": effective_level,
            "source": effective_source
        }
    }
