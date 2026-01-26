"""CRM Sales Service Models"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OpportunityResponse(BaseModel):
    canonical_id: str
    name: Optional[str] = None
    amount: Optional[float] = None
    stage: Optional[str] = None
    probability: Optional[int] = None
    owner_name: Optional[str] = None
    account_name: Optional[str] = None
    contact_email: Optional[str] = None
    close_date: Optional[str] = None
    has_overrides: bool = False


class StageUpdate(BaseModel):
    stage: str


class ProbabilityUpdate(BaseModel):
    probability: int


class ActivityCreate(BaseModel):
    subject: str
    type: str = "task"  # call, email, meeting, task
    description: Optional[str] = None
    due_date: Optional[str] = None
    opportunity_id: Optional[str] = None
    account_id: Optional[str] = None


class ActivityUpdate(BaseModel):
    status: Optional[str] = None
    completed: Optional[bool] = None
    notes: Optional[str] = None


class AccountCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    type: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


class KPICreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_value: float = 0
    current_value: float = 0
    unit: str = "number"  # number, currency, percent
