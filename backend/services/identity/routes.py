"""Identity Service Routes - Authentication and User Management

Handles:
- User registration (pending approval)
- User login/logout
- Token refresh
- Current user info
- User approval workflow
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import logging

from libs.database import get_app_db
from libs.utils import (
    serialize_doc, generate_id, hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    UserStatus, now_utc
)
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.models import (
    UserCreate, UserLogin, RefreshTokenRequest,
    TokenResponse, UserResponse, UserUpdate,
    UserInvite, UserInviteResponse
)
import secrets
import string

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


async def get_current_user(authorization: Optional[str] = Header(None)):
    """Dependency to get current user from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    db = get_app_db()
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if user.get("status") == UserStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="Account suspended")
    
    return serialize_doc(user)


async def get_optional_user(authorization: Optional[str] = Header(None)):
    """Optional current user - returns None if not authenticated"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            return None
        
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        db = get_app_db()
        user = await db.users.find_one({"id": user_id})
        return serialize_doc(user) if user else None
    except:
        return None


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    """Register a new user (pending approval)"""
    db = get_app_db()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user with pending status
    user_id = generate_id()
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "status": UserStatus.PENDING,
        "org_id": user_data.org_id or "default",
        "roles": [],
        "permissions": [],
        "created_at": now_utc()
    }
    
    await db.users.insert_one(user_doc)
    
    # Emit user registered event
    await emit_event(
        event_type=Topics.USER_REGISTERED,
        payload={
            "user_id": user_id,
            "email": user_data.email,
            "name": user_data.name,
            "status": UserStatus.PENDING
        },
        producer="identity-service",
        org_id=user_doc["org_id"]
    )
    
    logger.info(f"User registered: {user_data.email} (pending approval)")
    
    return UserResponse(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        status=UserStatus.PENDING,
        org_id=user_doc["org_id"],
        roles=[],
        permissions=[],
        created_at=user_doc["created_at"]
    )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login and get JWT tokens"""
    db = get_app_db()
    
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check user status
    if user["status"] == UserStatus.PENDING:
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    if user["status"] == UserStatus.REJECTED:
        raise HTTPException(status_code=403, detail="Account has been rejected")
    
    if user["status"] == UserStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="Account has been suspended")
    
    # Get user permissions from roles
    permissions = user.get("permissions", [])
    role_ids = user.get("roles", [])
    
    if role_ids:
        roles = await db.roles.find({"id": {"$in": role_ids}}).to_list(100)
        for role in roles:
            permissions.extend(role.get("permissions", []))
        permissions = list(set(permissions))  # Remove duplicates
    
    # Create tokens
    token_data = {
        "sub": user["id"],
        "email": user["email"],
        "org_id": user.get("org_id", "default"),
        "roles": role_ids,
        "permissions": permissions
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    logger.info(f"User logged in: {credentials.email}")
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(refresh_data: RefreshTokenRequest):
    """Refresh access token using refresh token"""
    payload = decode_token(refresh_data.refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    # Verify user still exists and is active
    db = get_app_db()
    user = await db.users.find_one({"id": payload["sub"]})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if user["status"] != UserStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Account not active")
    
    # Create new tokens
    token_data = {
        "sub": payload["sub"],
        "email": payload["email"],
        "org_id": payload["org_id"],
        "roles": payload.get("roles", []),
        "permissions": payload.get("permissions", [])
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        status=current_user["status"],
        org_id=current_user.get("org_id", "default"),
        roles=current_user.get("roles", []),
        permissions=current_user.get("permissions", []),
        created_at=current_user.get("created_at")
    )


# Admin routes for user management
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@admin_router.get("/users")
async def list_users(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all users in org"""
    db = get_app_db()
    
    # For now, list all users (can add org_id filter later when multi-tenancy is properly implemented)
    query = {}
    if status:
        query["status"] = status
    
    users = await db.users.find(query, {"password_hash": 0}).to_list(1000)
    return [serialize_doc(u) for u in users]


@admin_router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single user"""
    db = get_app_db()
    
    user = await db.users.find_one(
        {"id": user_id, "org_id": current_user.get("org_id", "default")},
        {"password_hash": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return serialize_doc(user)


@admin_router.post("/users/{user_id}/approve")
async def approve_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Approve a pending user"""
    db = get_app_db()
    
    result = await db.users.update_one(
        {
            "id": user_id,
            "org_id": current_user.get("org_id", "default"),
            "status": UserStatus.PENDING
        },
        {
            "$set": {
                "status": UserStatus.APPROVED,
                "approved_at": now_utc(),
                "approved_by": current_user["id"]
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    # Emit user approved event
    await emit_event(
        event_type=Topics.USER_APPROVED,
        payload={
            "user_id": user_id,
            "approved_by": current_user["id"]
        },
        producer="identity-service",
        org_id=current_user.get("org_id", "default")
    )
    
    logger.info(f"User approved: {user_id} by {current_user['id']}")
    
    return {"success": True, "message": "User approved"}


@admin_router.post("/users/{user_id}/reject")
async def reject_user(
    user_id: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Reject a pending user"""
    db = get_app_db()
    
    result = await db.users.update_one(
        {
            "id": user_id,
            "org_id": current_user.get("org_id", "default"),
            "status": UserStatus.PENDING
        },
        {
            "$set": {
                "status": UserStatus.REJECTED,
                "rejected_at": now_utc(),
                "rejected_by": current_user["id"],
                "rejection_reason": reason
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    # Emit user rejected event
    await emit_event(
        event_type=Topics.USER_REJECTED,
        payload={
            "user_id": user_id,
            "rejected_by": current_user["id"],
            "reason": reason
        },
        producer="identity-service",
        org_id=current_user.get("org_id", "default")
    )
    
    logger.info(f"User rejected: {user_id} by {current_user['id']}")
    
    return {"success": True, "message": "User rejected"}


@admin_router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user details — ADMIN ONLY"""
    db = get_app_db()
    
    # Security: Only admins can update users
    user_roles = current_user.get("roles", [])
    if not any(r in user_roles for r in ["admin", "system_admin", "sales_admin"]):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Only administrators can modify user accounts")
    
    update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
    update_data["updated_at"] = now_utc()
    
    result = await db.users.update_one(
        {"id": user_id, "org_id": current_user.get("org_id", "default")},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User updated"}


@admin_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a user"""
    db = get_app_db()
    
    # Prevent self-deletion
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one(
        {"id": user_id, "org_id": current_user.get("org_id", "default")}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User deleted"}


@admin_router.patch("/users/{user_id}/assign-role")
async def assign_role_to_user(
    user_id: str,
    role_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Assign a role to user — ADMIN ONLY"""
    user_roles = current_user.get("roles", [])
    if not any(r in user_roles for r in ["admin", "system_admin", "sales_admin"]):
        raise HTTPException(status_code=403, detail="Only administrators can assign roles")
    db = get_app_db()
    
    result = await db.users.update_one(
        {"id": user_id, "org_id": current_user.get("org_id", "default")},
        {"$addToSet": {"roles": role_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "Role assigned"}


@admin_router.patch("/users/{user_id}/remove-role")
async def remove_role_from_user(
    user_id: str,
    role_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a role from user"""
    db = get_app_db()
    
    result = await db.users.update_one(
        {"id": user_id, "org_id": current_user.get("org_id", "default")},
        {"$pull": {"roles": role_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "Role removed"}


class UserRolesUpdate(BaseModel):
    roles: List[str]


@admin_router.put("/users/{user_id}/roles")
async def update_user_roles(
    user_id: str,
    roles_data: UserRolesUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update all roles for a user (replaces existing roles)"""
    db = get_app_db()
    
    # First check if user exists (without org_id filter to handle users without org_id)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"roles": roles_data.roles, "updated_at": now_utc()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Emit user role updated event
    await emit_event(
        event_type=Topics.USER_UPDATED,
        payload={
            "user_id": user_id,
            "updated_by": current_user["id"],
            "roles": roles_data.roles
        },
        producer="identity-service",
        org_id=current_user.get("org_id", "default")
    )
    
    logger.info(f"User roles updated: {user_id} - {roles_data.roles}")
    
    return {"success": True, "message": "User roles updated"}


# ============== User Invite ==============

def generate_temp_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def generate_invite_token() -> str:
    """Generate a secure invite token"""
    return secrets.token_urlsafe(32)


@admin_router.post("/users/invite", response_model=UserInviteResponse)
async def invite_user(
    invite_data: UserInvite,
    current_user: dict = Depends(get_current_user)
):
    """
    Invite a new user to the system.
    
    Two modes:
    1. Email Invite (send_email=True): Creates user with 'invited' status and generates invite token.
       User will receive email with link to set password.
    2. Direct Creation (send_email=False): Creates user with temp password and 'approved' status.
       Admin provides or system generates temporary password.
    """
    db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": invite_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = generate_id()
    invite_token = None
    temp_password = None
    
    if invite_data.send_email:
        # Email invite mode
        invite_token = generate_invite_token()
        user_doc = {
            "id": user_id,
            "email": invite_data.email,
            "name": invite_data.name,
            "password_hash": None,  # No password yet
            "status": "invited",
            "org_id": org_id,
            "roles": invite_data.roles,
            "permissions": [],
            "invite_token": invite_token,
            "invite_expires_at": now_utc(),  # TODO: Add expiration
            "invited_by": current_user["id"],
            "created_at": now_utc()
        }
        logger.info(f"User invited via email: {invite_data.email} by {current_user['email']}")
    else:
        # Direct creation mode
        temp_password = invite_data.temp_password or generate_temp_password()
        user_doc = {
            "id": user_id,
            "email": invite_data.email,
            "name": invite_data.name,
            "password_hash": hash_password(temp_password),
            "status": UserStatus.APPROVED,
            "org_id": org_id,
            "roles": invite_data.roles,
            "permissions": [],
            "must_change_password": True,
            "created_by": current_user["id"],
            "created_at": now_utc(),
            "approved_at": now_utc(),
            "approved_by": current_user["id"]
        }
        logger.info(f"User created directly: {invite_data.email} by {current_user['email']}")
    
    await db.users.insert_one(user_doc)
    
    # Emit user invited event
    await emit_event(
        event_type=Topics.USER_REGISTERED,
        payload={
            "user_id": user_id,
            "email": invite_data.email,
            "name": invite_data.name,
            "status": user_doc["status"],
            "invited_by": current_user["id"],
            "method": "email" if invite_data.send_email else "direct"
        },
        producer="identity-service",
        org_id=org_id
    )
    
    return UserInviteResponse(
        id=user_id,
        email=invite_data.email,
        name=invite_data.name,
        status=user_doc["status"],
        roles=invite_data.roles,
        invite_token=invite_token,
        temp_password=temp_password
    )


@router.post("/accept-invite")
async def accept_invite(
    token: str,
    password: str
):
    """Accept an invitation and set password"""
    db = get_app_db()
    
    user = await db.users.find_one({"invite_token": token, "status": "invited"})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired invite token")
    
    # Set password and activate user
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "password_hash": hash_password(password),
                "status": UserStatus.APPROVED,
                "invite_token": None,
                "activated_at": now_utc()
            }
        }
    )
    
    logger.info(f"User accepted invite: {user['email']}")
    
    return {"success": True, "message": "Account activated. You can now login."}


# ============== Settings ==============

class OrgSettings(BaseModel):
    company_name: Optional[str] = None
    default_currency: Optional[str] = "USD"
    timezone: Optional[str] = "UTC"
    date_format: Optional[str] = "MM/DD/YYYY"
    email_notifications: Optional[bool] = True
    deal_alerts: Optional[bool] = True
    activity_reminders: Optional[bool] = True
    weekly_reports: Optional[bool] = False
    default_sync_interval: Optional[str] = "15"
    auto_map_fields: Optional[bool] = True
    enable_data_validation: Optional[bool] = True
    session_timeout: Optional[str] = "60"
    require_2fa: Optional[bool] = False
    password_expiry_days: Optional[str] = "90"


@admin_router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    """Get organization settings"""
    db = get_app_db()
    
    settings = await db.settings.find_one({"org_id": current_user.get("org_id", "default")})
    
    if not settings:
        # Return defaults
        return {
            "company_name": "Securado",
            "default_currency": "USD",
            "timezone": "UTC",
            "date_format": "MM/DD/YYYY",
            "email_notifications": True,
            "deal_alerts": True,
            "activity_reminders": True,
            "weekly_reports": False,
            "default_sync_interval": "15",
            "auto_map_fields": True,
            "enable_data_validation": True,
            "session_timeout": "60",
            "require_2fa": False,
            "password_expiry_days": "90"
        }
    
    return serialize_doc(settings)


@admin_router.put("/settings")
async def update_settings(
    settings_data: OrgSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update organization settings"""
    db = get_app_db()
    
    update_data = {k: v for k, v in settings_data.dict().items() if v is not None}
    update_data["updated_at"] = now_utc()
    update_data["updated_by"] = current_user["id"]
    
    result = await db.settings.update_one(
        {"org_id": current_user.get("org_id", "default")},
        {"$set": update_data},
        upsert=True
    )
    
    logger.info(f"Settings updated for org: {current_user.get('org_id', 'default')}")
    
    return {"success": True, "message": "Settings updated"}

