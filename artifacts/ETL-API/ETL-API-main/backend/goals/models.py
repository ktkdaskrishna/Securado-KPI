from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_value: float
    current_value: float = 0
    start_date: datetime
    end_date: datetime
    assigned_to: Optional[str] = None
    team_id: Optional[str] = None

class GoalProgressUpdate(BaseModel):
    current_value: float

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None

class TeamMemberAdd(BaseModel):
    user_id: str

class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner_id: str

class InitiativeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    portfolio_id: Optional[str] = None
    start_date: datetime
    target_date: datetime
    status: str = "planning"

class InitiativeStatusUpdate(BaseModel):
    status: str
