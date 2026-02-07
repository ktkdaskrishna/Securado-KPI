from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class TargetType(str, Enum):
    REVENUE = "revenue"
    ACTIVITY = "activity"
    PRODUCT = "product"
    COMPOSITE = "composite"


class PeriodType(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class TargetStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ACHIEVED = "achieved"
    MISSED = "missed"
    CANCELLED = "cancelled"


class IncentiveSlabCreate(BaseModel):
    min_percent: float
    max_percent: float
    commission_rate: float
    label: Optional[str] = None


class IncentivePlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    base_salary: float = 0
    ote: float = 0
    pay_mix_base: float = 60
    pay_mix_variable: float = 40
    slabs: List[IncentiveSlabCreate] = []
    spiffs: Optional[List[dict]] = []
    product_multipliers: Optional[List[dict]] = []
    period_type: str = "quarterly"


class SalesTargetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_type: str = "revenue"
    target_value: float = 0
    target_unit: str = "OMR"
    period_type: str = "quarterly"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    parent_target_id: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    department: Optional[str] = "sales"
    team_id: Optional[str] = None
    incentive_plan_id: Optional[str] = None


class SalesTargetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None


class ActivityTargetCreate(BaseModel):
    name: str
    activity_type: str  # call, email, meeting, demo, poc, workshop
    target_count: int = 0
    period_type: str = "monthly"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    parent_target_id: Optional[str] = None
    product_id: Optional[str] = None


class TargetSheetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    period: str  # e.g. "2026-Q1"
    targets: Optional[List[dict]] = []


class TargetProgressUpdate(BaseModel):
    current_value: float


class IncentiveCalcRequest(BaseModel):
    target_id: str
    actual_value: Optional[float] = None
