from fastapi import APIRouter, HTTPException, Depends, Header
from auth.models import UserCreate, UserLogin, TokenResponse, RefreshTokenRequest, UserResponse, UserStatus
from auth.jwt import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from core.database import get_app_db
from core.utils import serialize_doc
from datetime import datetime
import logging
from typing import Optional

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
    
    return serialize_doc(user)

@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    """Register a new user (pending approval)"""
    db = get_app_db()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user with pending status
    import uuid
    user_id = str(uuid.uuid4())
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "status": UserStatus.PENDING,
        "org_id": user_data.org_id,
        "roles": [],
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    
    return UserResponse(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        status=UserStatus.PENDING,
        org_id=user_data.org_id,
        roles=[],
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
    
    # Check if user is approved
    if user["status"] == UserStatus.PENDING:
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    if user["status"] == UserStatus.REJECTED:
        raise HTTPException(status_code=403, detail="Account has been rejected")
    
    # Create tokens
    token_data = {
        "sub": user["id"],
        "email": user["email"],
        "org_id": user["org_id"],
        "roles": user.get("roles", [])
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
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
    
    # Create new tokens
    token_data = {
        "sub": payload["sub"],
        "email": payload["email"],
        "org_id": payload["org_id"],
        "roles": payload.get("roles", [])
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
        created_at=current_user["created_at"]
    )

@router.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    """List all users (for admin)"""
    db = get_app_db()
    users = await db.users.find({"org_id": current_user["org_id"]}, {"password_hash": 0}).to_list(1000)
    return [serialize_doc(u) for u in users]
