"""Identity Service Routes - Authentication and User Management

Handles:
- User registration (pending approval)
- User login/logout
- Token refresh
- Current user info
- User approval workflow
"""
from fastapi import APIRouter, HTTPException, Depends, Header
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
    TokenResponse, UserResponse, UserUpdate
)

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
        "org_id": user["org_id"],
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
        org_id=current_user["org_id"],
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
    
    query = {"org_id": current_user["org_id"]}
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
        {"id": user_id, "org_id": current_user["org_id"]},
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
            "org_id": current_user["org_id"],
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
        org_id=current_user["org_id"]
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
            "org_id": current_user["org_id"],
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
        org_id=current_user["org_id"]
    )
    
    logger.info(f"User rejected: {user_id} by {current_user['id']}")
    
    return {"success": True, "message": "User rejected"}


@admin_router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user details"""
    db = get_app_db()
    
    update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
    update_data["updated_at"] = now_utc()
    
    result = await db.users.update_one(
        {"id": user_id, "org_id": current_user["org_id"]},
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
        {"id": user_id, "org_id": current_user["org_id"]}
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
    """Assign a role to user"""
    db = get_app_db()
    
    result = await db.users.update_one(
        {"id": user_id, "org_id": current_user["org_id"]},
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
        {"id": user_id, "org_id": current_user["org_id"]},
        {"$pull": {"roles": role_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "Role removed"}
