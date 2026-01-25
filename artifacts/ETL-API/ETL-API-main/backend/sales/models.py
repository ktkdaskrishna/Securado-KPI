from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class OpportunityResponse(BaseModel):
    canonical_id: str
    data: Dict[str, Any]
    stage: Optional[str] = None
    probability: Optional[float] = None
    owner: Optional[str] = None
    updated_at: Optional[datetime] = None
    has_overrides: bool = False

class StageUpdateRequest(BaseModel):
    stage: str

class ProbabilityCalculateRequest(BaseModel):
    probability: float = Field(ge=0, le=100)

class ActivityCreate(BaseModel):
    opportunity_id: Optional[str] = None
    account_id: Optional[str] = None
    activity_type: str
    subject: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None

class ActivityUpdate(BaseModel):
    status: Optional[str] = None
    completed: Optional[bool] = None
