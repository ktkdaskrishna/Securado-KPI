from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class WidgetConfig(BaseModel):
    id: str
    name: str
    type: str
    config: Dict[str, Any]

class NavigationItem(BaseModel):
    id: str
    label: str
    path: str
    icon: Optional[str] = None
    order: int

class ServiceLineCreate(BaseModel):
    name: str
    description: Optional[str] = None

class PipelineStageCreate(BaseModel):
    name: str
    order: int
    color: Optional[str] = None

class BluesheetWeights(BaseModel):
    weights: Dict[str, float]

class TargetCreate(BaseModel):
    name: str
    target_type: str
    value: float
    period: str
    start_date: datetime
    end_date: datetime

class RoleTargetCreate(BaseModel):
    role: str
    target_type: str
    value: float
    period: str
