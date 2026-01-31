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
