from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class AccountCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class KPICreate(BaseModel):
    name: str
    description: Optional[str] = None
    metric_type: str
    target_value: float
    current_value: float = 0
    period: str
