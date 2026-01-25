from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    org_id: Optional[str] = "default_org"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    status: UserStatus
    org_id: str
    roles: List[str] = []
    created_at: datetime
    
    class Config:
        from_attributes = True
