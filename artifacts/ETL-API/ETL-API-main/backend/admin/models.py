from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class PermissionCreate(BaseModel):
    name: str
    module: str
    description: Optional[str] = None

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    roles: Optional[List[str]] = None
    department_id: Optional[str] = None

class BulkAssignRole(BaseModel):
    user_ids: List[str]
    role: str

class BulkAssignDepartment(BaseModel):
    user_ids: List[str]
    department_id: str

class LLMConfig(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 1000
