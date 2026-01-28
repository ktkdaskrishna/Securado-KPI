"""Identity Service Models"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    org_id: Optional[str] = "default"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    status: str
    org_id: str
    roles: List[str] = []
    permissions: List[str] = []
    created_at: Optional[datetime] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    roles: Optional[List[str]] = None
    department_id: Optional[str] = None


class UserInvite(BaseModel):
    """Model for inviting a new user"""
    email: EmailStr
    name: str
    roles: List[str] = []
    send_email: bool = True  # If True, send invite email; if False, create with temp password
    temp_password: Optional[str] = None  # Required if send_email is False


class UserInviteResponse(BaseModel):
    id: str
    email: str
    name: str
    status: str
    roles: List[str]
    invite_token: Optional[str] = None  # Token for email invite flow
    temp_password: Optional[str] = None  # Temp password for direct creation
