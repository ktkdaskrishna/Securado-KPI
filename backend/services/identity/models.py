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
