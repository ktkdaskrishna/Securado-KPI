"""RBAC Data Models"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class PermissionCategory(str, Enum):
    USER_MANAGEMENT = "user_management"
    ROLE_MANAGEMENT = "role_management"
    CONNECTION_MANAGEMENT = "connection_management"
    PIPELINE_MANAGEMENT = "pipeline_management"
    SCHEMA_MANAGEMENT = "schema_management"
    SYSTEM_SETTINGS = "system_settings"
    REPORTS = "reports"


class Permission(BaseModel):
    """Individual permission definition"""
    id: str
    name: str
    description: str
    category: PermissionCategory
    
    def to_dict(self) -> Dict:
        return self.model_dump()


class RoleCreate(BaseModel):
    """Model for creating a new role"""
    name: str
    display_name: str
    description: Optional[str] = None
    permissions: List[str] = []  # List of permission IDs
    is_system: bool = False


class RoleUpdate(BaseModel):
    """Model for updating a role"""
    display_name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class Role(BaseModel):
    """Role template definition"""
    id: Optional[str] = None
    name: str  # Unique identifier like 'super_admin', 'admin', 'editor'
    display_name: str  # Human readable name
    description: Optional[str] = None
    permissions: List[str] = []  # List of permission IDs
    is_system: bool = False  # System roles can't be deleted
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    
    def to_dict(self) -> Dict:
        data = self.model_dump(exclude_none=True)
        if self.created_at:
            data['created_at'] = self.created_at.isoformat()
        if self.updated_at:
            data['updated_at'] = self.updated_at.isoformat()
        return data


class UserRole(BaseModel):
    """Association between user and role"""
    user_id: str
    role_id: str
    assigned_at: Optional[datetime] = None
    assigned_by: Optional[str] = None


class UserCreate(BaseModel):
    """Model for creating a new user (admin creation)"""
    email: EmailStr
    password: str
    name: str
    role_ids: List[str] = []  # Roles to assign
    is_active: bool = True


class UserUpdate(BaseModel):
    """Model for updating a user"""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """User response model (without password)"""
    id: str
    email: str
    name: str
    roles: List[Dict[str, Any]] = []
    permissions: List[str] = []
    is_active: bool = True
    is_super_admin: bool = False
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
