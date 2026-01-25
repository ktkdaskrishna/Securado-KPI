from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'platform3')]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'platform3-secret-key-12345')
JWT_ALGORITHM = 'HS256'

# Create the main app
app = FastAPI(title="Platform 3 API")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ MODELS ============

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    status: str = "active"
    role: Optional[str] = None
    role_name: Optional[str] = None
    department: Optional[str] = None
    department_name: Optional[str] = None

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class DashboardStats(BaseModel):
    total_pipeline: float = 0
    pipeline_change: float = 0
    won_value: float = 0
    won_count: int = 0
    open_count: int = 0
    open_change: float = 0
    win_rate: float = 0
    win_rate_change: float = 0
    pipeline_by_stage: List[Dict] = []
    activity_stats: Dict = {}
    recent_activities: List[Dict] = []
    leaderboard: List[Dict] = []

class Opportunity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    value: float = 0
    amount: float = 0
    stage: str = "qualified"
    probability: int = 0
    account_name: Optional[str] = None
    account_id: Optional[str] = None
    owner_name: Optional[str] = None
    owner_id: Optional[str] = None
    close_date: Optional[str] = None
    description: Optional[str] = None
    company: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class StageUpdate(BaseModel):
    stage: str

class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subject: str
    type: str = "task"
    status: str = "pending"
    description: Optional[str] = None
    due_date: Optional[str] = None
    owner_name: Optional[str] = None
    opportunity_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Goal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    target_value: float = 0
    current_value: float = 0
    status: str = "in_progress"
    target_date: Optional[str] = None
    team_name: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    members_count: int = 0
    manager_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Portfolio(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    total_value: float = 0
    accounts_count: int = 0
    status: str = "active"
    owner_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Initiative(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    progress: int = 0
    status: str = "active"
    target_date: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class KPI(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    target_value: float = 0
    current_value: float = 0
    unit: str = "number"
    change: float = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    industry: Optional[str] = None
    type: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Role(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    users_count: int = 0
    permissions_count: int = 0

class Department(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    users_count: int = 0
    manager_name: Optional[str] = None

# ============ HELPERS ============

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    return payload

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id':
                result['id'] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
            else:
                result[key] = value
        return result
    return doc

def make_query(doc_id: str):
    """Create a query that works with both 'id' field and MongoDB '_id'"""
    from bson import ObjectId
    try:
        # Try to create ObjectId if valid
        oid = ObjectId(doc_id)
        return {"$or": [{"id": doc_id}, {"_id": oid}]}
    except:
        return {"id": doc_id}

# ============ AUTH ROUTES ============

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    # Check for existing user in database
    user = await db.users.find_one({"email": request.email})
    
    if not user:
        # Create new user for demo purposes
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": request.email,
            "name": request.email.split("@")[0].title(),
            "status": "active",
            "role": "admin",
            "role_name": "Administrator",
            "department": "sales",
            "department_name": "Sales",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
    
    user_data = serialize_doc(user)
    token = create_token(user_data.get("id", user_data.get("_id", "")), request.email)
    
    return TokenResponse(
        token=token,
        user=UserResponse(**user_data)
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"email": current_user["email"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**serialize_doc(user))

# ============ DASHBOARD ROUTES ============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Get opportunities for stats
    opps = await db.opportunities.find().to_list(1000)
    activities = await db.activities.find().to_list(1000)
    
    total_pipeline = sum(o.get("value", 0) or o.get("amount", 0) for o in opps)
    won_opps = [o for o in opps if o.get("stage") == "closed_won"]
    won_value = sum(o.get("value", 0) or o.get("amount", 0) for o in won_opps)
    open_opps = [o for o in opps if o.get("stage") not in ["closed_won", "closed_lost"]]
    
    # Pipeline by stage
    stages = ["qualified", "proposal", "negotiation", "closed_won", "closed_lost"]
    pipeline_by_stage = []
    for stage in stages:
        stage_opps = [o for o in opps if o.get("stage") == stage]
        pipeline_by_stage.append({
            "stage": stage.replace("_", " ").title(),
            "value": sum(o.get("value", 0) or o.get("amount", 0) for o in stage_opps),
            "count": len(stage_opps)
        })
    
    # Activity stats
    activity_stats = {
        "calls": len([a for a in activities if a.get("type") == "call"]),
        "emails": len([a for a in activities if a.get("type") == "email"]),
        "meetings": len([a for a in activities if a.get("type") == "meeting"]),
        "tasks": len([a for a in activities if a.get("type") == "task"]),
    }
    
    # Recent activities
    recent_activities = sorted(activities, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    recent_activities = [serialize_doc(a) for a in recent_activities]
    
    # Mock leaderboard
    leaderboard = [
        {"id": "1", "name": "Sarah Johnson", "value": 2500000},
        {"id": "2", "name": "Michael Chen", "value": 2100000},
        {"id": "3", "name": "Emily Davis", "value": 1800000},
        {"id": "4", "name": "James Wilson", "value": 1500000},
        {"id": "5", "name": "Lisa Anderson", "value": 1200000},
    ]
    
    return DashboardStats(
        total_pipeline=total_pipeline,
        pipeline_change=round(random.uniform(-5, 15), 1),
        won_value=won_value,
        won_count=len(won_opps),
        open_count=len(open_opps),
        open_change=round(random.uniform(-10, 20), 1),
        win_rate=round((len(won_opps) / len(opps) * 100) if opps else 0, 1),
        win_rate_change=round(random.uniform(-3, 8), 1),
        pipeline_by_stage=pipeline_by_stage,
        activity_stats=activity_stats,
        recent_activities=recent_activities,
        leaderboard=leaderboard
    )

@api_router.post("/dashboard/refresh")
async def refresh_dashboard(current_user: dict = Depends(get_current_user)):
    return {"status": "refreshed", "timestamp": datetime.now(timezone.utc).isoformat()}

# ============ OPPORTUNITIES ROUTES ============

@api_router.get("/opportunities")
async def get_opportunities(current_user: dict = Depends(get_current_user)):
    opps = await db.opportunities.find().to_list(1000)
    return [serialize_doc(o) for o in opps]

@api_router.get("/opportunities/kanban")
async def get_opportunities_kanban(current_user: dict = Depends(get_current_user)):
    opps = await db.opportunities.find().to_list(1000)
    return [serialize_doc(o) for o in opps]

@api_router.post("/opportunities")
async def create_opportunity(opp: Opportunity, current_user: dict = Depends(get_current_user)):
    opp_dict = opp.model_dump()
    opp_dict["amount"] = opp_dict["value"]
    await db.opportunities.insert_one(opp_dict)
    return serialize_doc(opp_dict)

@api_router.patch("/opportunities/{opp_id}/stage")
async def update_opportunity_stage(opp_id: str, update: StageUpdate, current_user: dict = Depends(get_current_user)):
    result = await db.opportunities.update_one(
        make_query(opp_id),
        {"$set": {"stage": update.stage}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return {"status": "updated", "stage": update.stage}

@api_router.post("/opportunities/{opp_id}/calculate-probability")
async def calculate_probability(opp_id: str, current_user: dict = Depends(get_current_user)):
    opp = await db.opportunities.find_one(make_query(opp_id))
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Calculate probability based on stage
    stage_probs = {
        "qualified": 20,
        "proposal": 40,
        "negotiation": 60,
        "closed_won": 100,
        "closed_lost": 0
    }
    probability = stage_probs.get(opp.get("stage", "qualified"), 20)
    probability += random.randint(-10, 10)
    probability = max(0, min(100, probability))
    
    await db.opportunities.update_one(
        make_query(opp_id),
        {"$set": {"probability": probability}}
    )
    return {"probability": probability, "opportunity_id": opp_id}

@api_router.get("/opportunities/{opp_id}/messages")
async def get_opportunity_messages(opp_id: str, current_user: dict = Depends(get_current_user)):
    # Return mock messages
    return [
        {"id": "1", "subject": "Initial Contact", "preview": "Thank you for your interest...", "date": "2024-01-15"},
        {"id": "2", "subject": "Follow-up", "preview": "Following up on our conversation...", "date": "2024-01-18"},
        {"id": "3", "subject": "Proposal Review", "preview": "Please find attached the proposal...", "date": "2024-01-22"},
    ]

# ============ ACCOUNTS ROUTES ============

@api_router.get("/accounts")
async def get_accounts(current_user: dict = Depends(get_current_user)):
    accounts = await db.accounts.find().to_list(1000)
    return [serialize_doc(a) for a in accounts]

@api_router.post("/accounts")
async def create_account(account: Account, current_user: dict = Depends(get_current_user)):
    account_dict = account.model_dump()
    await db.accounts.insert_one(account_dict)
    return serialize_doc(account_dict)

@api_router.get("/accounts/{account_id}/360")
async def get_account_360(account_id: str, current_user: dict = Depends(get_current_user)):
    account = await db.accounts.find_one(make_query(account_id))
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Get related opportunities
    opps = await db.opportunities.find({"account_id": account_id}).to_list(100)
    activities = await db.activities.find({"account_id": account_id}).to_list(100)
    
    account_data = serialize_doc(account)
    account_data["opportunities"] = [serialize_doc(o) for o in opps]
    account_data["activities"] = [serialize_doc(a) for a in activities]
    account_data["contacts"] = [
        {"id": "1", "name": "John Smith", "title": "CEO", "email": "john@example.com"},
        {"id": "2", "name": "Jane Doe", "title": "VP Sales", "email": "jane@example.com"},
    ]
    account_data["total_value"] = sum(o.get("value", 0) or o.get("amount", 0) for o in opps)
    account_data["opportunities_count"] = len(opps)
    account_data["activities_count"] = len(activities)
    
    return account_data

# ============ ACTIVITIES ROUTES ============

@api_router.get("/activities")
async def get_activities(current_user: dict = Depends(get_current_user)):
    activities = await db.activities.find().to_list(1000)
    return [serialize_doc(a) for a in activities]

@api_router.get("/activities/stats")
async def get_activities_stats(current_user: dict = Depends(get_current_user)):
    activities = await db.activities.find().to_list(1000)
    return {
        "total": len(activities),
        "completed": len([a for a in activities if a.get("status") == "completed"]),
        "pending": len([a for a in activities if a.get("status") == "pending"]),
        "overdue": len([a for a in activities if a.get("status") == "overdue"]),
    }

@api_router.post("/activities")
async def create_activity(activity: Activity, current_user: dict = Depends(get_current_user)):
    activity_dict = activity.model_dump()
    activity_dict["owner_name"] = current_user.get("email", "").split("@")[0].title()
    await db.activities.insert_one(activity_dict)
    return serialize_doc(activity_dict)

@api_router.patch("/activities/{activity_id}/complete")
async def complete_activity(activity_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.activities.update_one(
        make_query(activity_id),
        {"$set": {"status": "completed"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"status": "completed"}

@api_router.patch("/activities/{activity_id}/status")
async def update_activity_status(activity_id: str, status: dict, current_user: dict = Depends(get_current_user)):
    result = await db.activities.update_one(
        make_query(activity_id),
        {"$set": {"status": status.get("status", "pending")}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"status": status.get("status")}

# ============ GOALS ROUTES ============

@api_router.get("/goals")
async def get_goals(current_user: dict = Depends(get_current_user)):
    goals = await db.goals.find().to_list(1000)
    return [serialize_doc(g) for g in goals]

@api_router.get("/goals/summary/stats")
async def get_goals_stats(current_user: dict = Depends(get_current_user)):
    goals = await db.goals.find().to_list(1000)
    return {
        "total": len(goals),
        "on_track": len([g for g in goals if g.get("status") == "on_track"]),
        "completed": len([g for g in goals if g.get("status") == "completed"]),
        "at_risk": len([g for g in goals if g.get("status") == "at_risk"]),
    }

@api_router.post("/goals")
async def create_goal(goal: Goal, current_user: dict = Depends(get_current_user)):
    goal_dict = goal.model_dump()
    goal_dict["owner_name"] = current_user.get("email", "").split("@")[0].title()
    await db.goals.insert_one(goal_dict)
    return serialize_doc(goal_dict)

@api_router.put("/goals/{goal_id}")
async def update_goal(goal_id: str, goal: Goal, current_user: dict = Depends(get_current_user)):
    goal_dict = goal.model_dump()
    result = await db.goals.update_one(
        make_query(goal_id),
        {"$set": goal_dict}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return serialize_doc(goal_dict)

@api_router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.goals.delete_one(make_query(goal_id))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"status": "deleted"}

@api_router.patch("/goals/{goal_id}/progress")
async def update_goal_progress(goal_id: str, progress: dict, current_user: dict = Depends(get_current_user)):
    result = await db.goals.update_one(
        make_query(goal_id),
        {"$set": {"current_value": progress.get("current_value", 0)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"status": "updated", "current_value": progress.get("current_value")}

# ============ TEAMS ROUTES ============

@api_router.get("/teams")
async def get_teams(current_user: dict = Depends(get_current_user)):
    teams = await db.teams.find().to_list(1000)
    return [serialize_doc(t) for t in teams]

@api_router.post("/teams")
async def create_team(team: Team, current_user: dict = Depends(get_current_user)):
    team_dict = team.model_dump()
    await db.teams.insert_one(team_dict)
    return serialize_doc(team_dict)

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.teams.delete_one(make_query(team_id))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"status": "deleted"}

# ============ PORTFOLIOS ROUTES ============

@api_router.get("/portfolios")
async def get_portfolios(current_user: dict = Depends(get_current_user)):
    portfolios = await db.portfolios.find().to_list(1000)
    return [serialize_doc(p) for p in portfolios]

@api_router.post("/portfolios")
async def create_portfolio(portfolio: Portfolio, current_user: dict = Depends(get_current_user)):
    portfolio_dict = portfolio.model_dump()
    portfolio_dict["owner_name"] = current_user.get("email", "").split("@")[0].title()
    await db.portfolios.insert_one(portfolio_dict)
    return serialize_doc(portfolio_dict)

@api_router.delete("/portfolios/{portfolio_id}")
async def delete_portfolio(portfolio_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.portfolios.delete_one(make_query(portfolio_id))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"status": "deleted"}

# ============ INITIATIVES ROUTES ============

@api_router.get("/initiatives")
async def get_initiatives(current_user: dict = Depends(get_current_user)):
    initiatives = await db.initiatives.find().to_list(1000)
    return [serialize_doc(i) for i in initiatives]

@api_router.post("/initiatives")
async def create_initiative(initiative: Initiative, current_user: dict = Depends(get_current_user)):
    initiative_dict = initiative.model_dump()
    initiative_dict["owner_name"] = current_user.get("email", "").split("@")[0].title()
    await db.initiatives.insert_one(initiative_dict)
    return serialize_doc(initiative_dict)

@api_router.delete("/initiatives/{initiative_id}")
async def delete_initiative(initiative_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.initiatives.delete_one(make_query(initiative_id))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Initiative not found")
    return {"status": "deleted"}

# ============ KPIS ROUTES ============

@api_router.get("/kpis")
async def get_kpis(current_user: dict = Depends(get_current_user)):
    kpis = await db.kpis.find().to_list(1000)
    return [serialize_doc(k) for k in kpis]

@api_router.post("/kpis")
async def create_kpi(kpi: KPI, current_user: dict = Depends(get_current_user)):
    kpi_dict = kpi.model_dump()
    kpi_dict["current_value"] = random.randint(0, int(kpi_dict["target_value"]))
    kpi_dict["change"] = round(random.uniform(-15, 25), 1)
    await db.kpis.insert_one(kpi_dict)
    return serialize_doc(kpi_dict)

@api_router.put("/kpis/{kpi_id}")
async def update_kpi(kpi_id: str, kpi: KPI, current_user: dict = Depends(get_current_user)):
    kpi_dict = kpi.model_dump()
    result = await db.kpis.update_one(
        make_query(kpi_id),
        {"$set": kpi_dict}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="KPI not found")
    return serialize_doc(kpi_dict)

@api_router.delete("/kpis/{kpi_id}")
async def delete_kpi(kpi_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.kpis.delete_one(make_query(kpi_id))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="KPI not found")
    return {"status": "deleted"}

# ============ DATA LAKE ROUTES ============

@api_router.get("/data-lake/canonical")
async def get_canonical_data(entity: str = Query("accounts"), current_user: dict = Depends(get_current_user)):
    collection = db[entity]
    records = await collection.find().to_list(100)
    return {"records": [serialize_doc(r) for r in records]}

@api_router.get("/data-lake/serving")
async def get_serving_data(entity: str = Query("accounts"), current_user: dict = Depends(get_current_user)):
    collection = db[entity]
    records = await collection.find().to_list(100)
    return {"records": [serialize_doc(r) for r in records]}

@api_router.get("/search")
async def search_data(q: str = Query(""), current_user: dict = Depends(get_current_user)):
    if len(q) < 2:
        return []
    
    results = []
    collections = ["accounts", "opportunities", "activities", "goals", "teams"]
    
    for coll_name in collections:
        coll = db[coll_name]
        # Simple text search on name/subject fields
        records = await coll.find({
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"subject": {"$regex": q, "$options": "i"}},
            ]
        }).to_list(10)
        
        for r in records:
            doc = serialize_doc(r)
            doc["_type"] = coll_name
            doc["entity_type"] = coll_name
            results.append(doc)
    
    return results[:20]

# ============ ADMIN ROUTES ============

@api_router.get("/admin/users")
async def get_admin_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find().to_list(1000)
    return [serialize_doc(u) for u in users]

@api_router.post("/admin/users/{user_id}/approve")
async def approve_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.users.update_one(
        make_query(user_id),
        {"$set": {"status": "active"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "approved"}

@api_router.post("/admin/users/{user_id}/reject")
async def reject_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.users.update_one(
        make_query(user_id),
        {"$set": {"status": "rejected"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "rejected"}

@api_router.get("/admin/roles")
async def get_admin_roles(current_user: dict = Depends(get_current_user)):
    roles = await db.roles.find().to_list(100)
    if not roles:
        # Return default roles
        return [
            {"id": "1", "name": "Administrator", "description": "Full access", "users_count": 1, "permissions_count": 50},
            {"id": "2", "name": "Sales Manager", "description": "Sales team management", "users_count": 5, "permissions_count": 30},
            {"id": "3", "name": "Sales Rep", "description": "Sales representative", "users_count": 20, "permissions_count": 15},
        ]
    return [serialize_doc(r) for r in roles]

@api_router.post("/admin/roles")
async def create_role(role: Role, current_user: dict = Depends(get_current_user)):
    role_dict = role.model_dump()
    await db.roles.insert_one(role_dict)
    return serialize_doc(role_dict)

@api_router.get("/admin/permissions")
async def get_admin_permissions(current_user: dict = Depends(get_current_user)):
    return [
        {"id": "1", "name": "view_dashboard", "resource": "dashboard", "action": "read", "description": "View dashboard"},
        {"id": "2", "name": "manage_opportunities", "resource": "opportunities", "action": "write", "description": "Create/edit opportunities"},
        {"id": "3", "name": "view_reports", "resource": "reports", "action": "read", "description": "View reports"},
        {"id": "4", "name": "admin_users", "resource": "users", "action": "admin", "description": "Manage users"},
    ]

@api_router.get("/admin/departments")
async def get_admin_departments(current_user: dict = Depends(get_current_user)):
    departments = await db.departments.find().to_list(100)
    if not departments:
        return [
            {"id": "1", "name": "Sales", "description": "Sales department", "users_count": 15, "manager_name": "John Smith"},
            {"id": "2", "name": "Marketing", "description": "Marketing department", "users_count": 8, "manager_name": "Jane Doe"},
            {"id": "3", "name": "Operations", "description": "Operations department", "users_count": 12, "manager_name": "Bob Wilson"},
        ]
    return [serialize_doc(d) for d in departments]

@api_router.post("/admin/departments")
async def create_department(department: Department, current_user: dict = Depends(get_current_user)):
    dept_dict = department.model_dump()
    await db.departments.insert_one(dept_dict)
    return serialize_doc(dept_dict)

@api_router.get("/admin/logs")
async def get_admin_logs(current_user: dict = Depends(get_current_user)):
    logs = await db.admin_logs.find().sort("timestamp", -1).to_list(100)
    if not logs:
        return [
            {"id": "1", "timestamp": datetime.now(timezone.utc).isoformat(), "action": "login", "user_name": "Admin", "resource": "auth", "details": "Successful login"},
            {"id": "2", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(), "action": "create", "user_name": "Admin", "resource": "opportunity", "details": "Created new opportunity"},
        ]
    return [serialize_doc(l) for l in logs]

@api_router.get("/config")
async def get_system_config(current_user: dict = Depends(get_current_user)):
    return {
        "app_name": "Platform 3",
        "version": "1.0.0",
        "features_enabled": True,
        "max_records_per_page": 50,
        "default_currency": "USD",
    }

@api_router.get("/config/user/dashboard")
async def get_user_dashboard_config(current_user: dict = Depends(get_current_user)):
    config = await db.user_configs.find_one({"user_email": current_user["email"]})
    if config:
        return serialize_doc(config)
    return {
        "show_pipeline_chart": True,
        "show_activity_stats": True,
        "show_leaderboard": True,
        "compact_view": False,
        "default_page_size": 10,
    }

@api_router.put("/config/user/dashboard")
async def update_user_dashboard_config(config: dict, current_user: dict = Depends(get_current_user)):
    config["user_email"] = current_user["email"]
    await db.user_configs.update_one(
        {"user_email": current_user["email"]},
        {"$set": config},
        upsert=True
    )
    return config

# ============ ROOT ROUTE ============

@api_router.get("/")
async def root():
    return {"message": "Platform 3 API", "version": "1.0.0"}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Platform 3 API starting up...")
    # Seed some demo data
    await seed_demo_data()

async def seed_demo_data():
    """Seed demo data if collections are empty"""
    # Seed opportunities
    if await db.opportunities.count_documents({}) == 0:
        demo_opps = [
            {"id": str(uuid.uuid4()), "name": "Acme Corp Deal", "value": 150000, "amount": 150000, "stage": "qualified", "probability": 20, "account_name": "Acme Corporation", "owner_name": "Sarah Johnson", "close_date": "2024-03-15", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "TechStart Enterprise", "value": 85000, "amount": 85000, "stage": "proposal", "probability": 45, "account_name": "TechStart Inc", "owner_name": "Michael Chen", "close_date": "2024-02-28", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Global Services Expansion", "value": 320000, "amount": 320000, "stage": "negotiation", "probability": 70, "account_name": "Global Services Ltd", "owner_name": "Emily Davis", "close_date": "2024-02-10", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Retail Solutions Package", "value": 75000, "amount": 75000, "stage": "qualified", "probability": 25, "account_name": "Retail Solutions Co", "owner_name": "James Wilson", "close_date": "2024-04-20", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Healthcare Platform", "value": 250000, "amount": 250000, "stage": "closed_won", "probability": 100, "account_name": "HealthFirst Systems", "owner_name": "Sarah Johnson", "close_date": "2024-01-20", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Finance Integration", "value": 180000, "amount": 180000, "stage": "proposal", "probability": 50, "account_name": "FinanceFirst Bank", "owner_name": "Michael Chen", "close_date": "2024-03-01", "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.opportunities.insert_many(demo_opps)
        logger.info("Seeded demo opportunities")
    
    # Seed accounts
    if await db.accounts.count_documents({}) == 0:
        demo_accounts = [
            {"id": str(uuid.uuid4()), "name": "Acme Corporation", "industry": "Manufacturing", "type": "Enterprise", "phone": "+1-555-0100", "website": "https://acme.com", "owner_name": "Sarah Johnson", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "TechStart Inc", "industry": "Technology", "type": "Startup", "phone": "+1-555-0101", "website": "https://techstart.io", "owner_name": "Michael Chen", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Global Services Ltd", "industry": "Consulting", "type": "Enterprise", "phone": "+1-555-0102", "website": "https://globalservices.com", "owner_name": "Emily Davis", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Retail Solutions Co", "industry": "Retail", "type": "SMB", "phone": "+1-555-0103", "website": "https://retailsolutions.com", "owner_name": "James Wilson", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "HealthFirst Systems", "industry": "Healthcare", "type": "Enterprise", "phone": "+1-555-0104", "website": "https://healthfirst.com", "owner_name": "Sarah Johnson", "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.accounts.insert_many(demo_accounts)
        logger.info("Seeded demo accounts")
    
    # Seed activities
    if await db.activities.count_documents({}) == 0:
        demo_activities = [
            {"id": str(uuid.uuid4()), "subject": "Discovery Call with Acme", "type": "call", "status": "completed", "owner_name": "Sarah Johnson", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "subject": "Send proposal to TechStart", "type": "email", "status": "pending", "owner_name": "Michael Chen", "due_date": "2024-02-01", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "subject": "Demo meeting with Global Services", "type": "meeting", "status": "in_progress", "owner_name": "Emily Davis", "due_date": "2024-02-05", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "subject": "Follow-up task for Retail Solutions", "type": "task", "status": "pending", "owner_name": "James Wilson", "due_date": "2024-02-10", "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.activities.insert_many(demo_activities)
        logger.info("Seeded demo activities")
    
    # Seed goals
    if await db.goals.count_documents({}) == 0:
        demo_goals = [
            {"id": str(uuid.uuid4()), "name": "Q1 Revenue Target", "description": "Achieve $1M in Q1 revenue", "target_value": 1000000, "current_value": 650000, "status": "on_track", "target_date": "2024-03-31", "owner_name": "Sales Team", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "New Customer Acquisition", "description": "Sign 50 new customers", "target_value": 50, "current_value": 32, "status": "on_track", "target_date": "2024-06-30", "owner_name": "Sales Team", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Pipeline Growth", "description": "Grow pipeline to $5M", "target_value": 5000000, "current_value": 3200000, "status": "at_risk", "target_date": "2024-04-30", "owner_name": "Sales Team", "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.goals.insert_many(demo_goals)
        logger.info("Seeded demo goals")
    
    # Seed KPIs
    if await db.kpis.count_documents({}) == 0:
        demo_kpis = [
            {"id": str(uuid.uuid4()), "name": "Win Rate", "description": "Percentage of won opportunities", "target_value": 35, "current_value": 28, "unit": "percent", "change": 5.2, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Average Deal Size", "description": "Average value of closed deals", "target_value": 100000, "current_value": 85000, "unit": "currency", "change": 12.5, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Sales Cycle", "description": "Average days to close", "target_value": 45, "current_value": 52, "unit": "number", "change": -8.3, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Monthly Calls", "description": "Total sales calls per month", "target_value": 500, "current_value": 423, "unit": "number", "change": 15.0, "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.kpis.insert_many(demo_kpis)
        logger.info("Seeded demo KPIs")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
