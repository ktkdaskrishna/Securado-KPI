"""CRM Goals Service Routes - Goals, Teams, Portfolios, Initiatives

Handles:
- Goals CRUD and progress tracking
- Teams management
- Portfolios and initiatives
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from pydantic import BaseModel
import logging

from libs.database import get_app_db
from libs.utils import serialize_doc, generate_id, now_utc
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)

goals_router = APIRouter(prefix="/goals", tags=["goals"])
teams_router = APIRouter(prefix="/teams", tags=["teams"])
portfolios_router = APIRouter(prefix="/portfolios", tags=["portfolios"])
initiatives_router = APIRouter(prefix="/initiatives", tags=["initiatives"])


# ==================== MODELS ====================

class GoalCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_value: float = 0
    current_value: float = 0
    status: str = "in_progress"  # in_progress, on_track, at_risk, completed
    target_date: Optional[str] = None
    team_id: Optional[str] = None
    assigned_to: Optional[str] = None


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
    status: str = "active"


class InitiativeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    portfolio_id: Optional[str] = None
    status: str = "active"  # active, in_progress, completed, on_hold
    target_date: Optional[str] = None
    start_date: Optional[str] = None


class InitiativeStatusUpdate(BaseModel):
    status: str
    progress: Optional[int] = None


# ==================== GOALS ====================

@goals_router.get("")
async def list_goals(
    team_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List goals"""
    app_db = get_app_db()
    
    query = {"org_id": current_user["org_id"]}
    if team_id:
        query["team_id"] = team_id
    if assigned_to:
        query["assigned_to"] = assigned_to
    if status:
        query["status"] = status
    
    goals = await app_db.goals.find(query).to_list(1000)
    return serialize_doc(goals)


@goals_router.get("/summary/stats")
async def get_goals_stats(current_user: dict = Depends(get_current_user)):
    """Get goals summary statistics"""
    app_db = get_app_db()
    
    goals = await app_db.goals.find({"org_id": current_user["org_id"]}).to_list(1000)
    
    total = len(goals)
    completed = len([g for g in goals if g.get("status") == "completed" or 
                    (g.get("current_value", 0) >= g.get("target_value", 0) and g.get("target_value", 0) > 0)])
    on_track = len([g for g in goals if g.get("status") == "on_track"])
    at_risk = len([g for g in goals if g.get("status") == "at_risk"])
    in_progress = len([g for g in goals if g.get("status") == "in_progress"])
    
    return {
        "total": total,
        "completed": completed,
        "on_track": on_track,
        "at_risk": at_risk,
        "in_progress": in_progress,
        "completion_rate": round((completed / total * 100) if total > 0 else 0, 1)
    }


@goals_router.get("/{goal_id}")
async def get_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single goal"""
    app_db = get_app_db()
    
    goal = await app_db.goals.find_one({
        "id": goal_id,
        "org_id": current_user["org_id"]
    })
    
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    return serialize_doc(goal)


@goals_router.post("")
async def create_goal(
    goal_data: GoalCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create goal"""
    app_db = get_app_db()
    
    goal_doc = {
        "id": generate_id(),
        "org_id": current_user["org_id"],
        "created_by": current_user["id"],
        "owner_name": current_user.get("name", "Unknown"),
        "created_at": now_utc(),
        **goal_data.model_dump()
    }
    
    await app_db.goals.insert_one(goal_doc)
    
    # Emit event
    await emit_event(
        event_type=Topics.CRM_GOAL_UPDATED,
        payload={
            "goal_id": goal_doc["id"],
            "action": "created",
            "goal_type": "goal",
            "target_value": goal_data.target_value,
            "current_value": goal_data.current_value
        },
        producer="crm-goals-service",
        org_id=current_user["org_id"]
    )
    
    return serialize_doc(goal_doc)


@goals_router.put("/{goal_id}")
async def update_goal(
    goal_id: str,
    goal_data: GoalCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update goal"""
    app_db = get_app_db()
    
    result = await app_db.goals.update_one(
        {"id": goal_id, "org_id": current_user["org_id"]},
        {"$set": {**goal_data.model_dump(), "updated_at": now_utc()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    return {"success": True, "message": "Goal updated"}


@goals_router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete goal"""
    app_db = get_app_db()
    
    result = await app_db.goals.delete_one({
        "id": goal_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    return {"success": True, "message": "Goal deleted"}


@goals_router.patch("/{goal_id}/progress")
async def update_goal_progress(
    goal_id: str,
    progress_data: GoalProgressUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update goal progress"""
    app_db = get_app_db()
    
    result = await app_db.goals.update_one(
        {"id": goal_id, "org_id": current_user["org_id"]},
        {"$set": {"current_value": progress_data.current_value, "updated_at": now_utc()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Emit event
    await emit_event(
        event_type=Topics.CRM_GOAL_UPDATED,
        payload={
            "goal_id": goal_id,
            "action": "progress_updated",
            "goal_type": "goal",
            "current_value": progress_data.current_value
        },
        producer="crm-goals-service",
        org_id=current_user["org_id"]
    )
    
    return {"success": True, "message": "Goal progress updated", "current_value": progress_data.current_value}


# ==================== TEAMS ====================

@teams_router.get("")
async def list_teams(current_user: dict = Depends(get_current_user)):
    """List teams"""
    app_db = get_app_db()
    
    teams = await app_db.teams.find({"org_id": current_user["org_id"]}).to_list(1000)
    return serialize_doc(teams)


@teams_router.get("/{team_id}")
async def get_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single team"""
    app_db = get_app_db()
    
    team = await app_db.teams.find_one({
        "id": team_id,
        "org_id": current_user["org_id"]
    })
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return serialize_doc(team)


@teams_router.post("")
async def create_team(
    team_data: TeamCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create team"""
    app_db = get_app_db()
    
    team_doc = {
        "id": generate_id(),
        "org_id": current_user["org_id"],
        "members": [],
        "members_count": 0,
        "created_by": current_user["id"],
        "created_at": now_utc(),
        **team_data.model_dump()
    }
    
    await app_db.teams.insert_one(team_doc)
    return serialize_doc(team_doc)


@teams_router.put("/{team_id}")
async def update_team(
    team_id: str,
    team_data: TeamCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update team"""
    app_db = get_app_db()
    
    result = await app_db.teams.update_one(
        {"id": team_id, "org_id": current_user["org_id"]},
        {"$set": {**team_data.model_dump(), "updated_at": now_utc()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {"success": True, "message": "Team updated"}


@teams_router.delete("/{team_id}")
async def delete_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete team"""
    app_db = get_app_db()
    
    result = await app_db.teams.delete_one({
        "id": team_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {"success": True, "message": "Team deleted"}


@teams_router.post("/{team_id}/members")
async def add_team_member(
    team_id: str,
    member_data: TeamMemberAdd,
    current_user: dict = Depends(get_current_user)
):
    """Add member to team"""
    app_db = get_app_db()
    
    result = await app_db.teams.update_one(
        {"id": team_id, "org_id": current_user["org_id"]},
        {
            "$addToSet": {"members": member_data.user_id},
            "$inc": {"members_count": 1}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {"success": True, "message": "Member added"}


@teams_router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove member from team"""
    app_db = get_app_db()
    
    result = await app_db.teams.update_one(
        {"id": team_id, "org_id": current_user["org_id"]},
        {
            "$pull": {"members": user_id},
            "$inc": {"members_count": -1}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {"success": True, "message": "Member removed"}


# ==================== PORTFOLIOS ====================

@portfolios_router.get("")
async def list_portfolios(current_user: dict = Depends(get_current_user)):
    """List portfolios"""
    app_db = get_app_db()
    
    portfolios = await app_db.portfolios.find({"org_id": current_user["org_id"]}).to_list(1000)
    return serialize_doc(portfolios)


@portfolios_router.get("/{portfolio_id}")
async def get_portfolio(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single portfolio"""
    app_db = get_app_db()
    
    portfolio = await app_db.portfolios.find_one({
        "id": portfolio_id,
        "org_id": current_user["org_id"]
    })
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    return serialize_doc(portfolio)


@portfolios_router.post("")
async def create_portfolio(
    portfolio_data: PortfolioCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create portfolio"""
    app_db = get_app_db()
    
    portfolio_doc = {
        "id": generate_id(),
        "org_id": current_user["org_id"],
        "owner_name": current_user.get("name", "Unknown"),
        "total_value": 0,
        "accounts_count": 0,
        "created_by": current_user["id"],
        "created_at": now_utc(),
        **portfolio_data.model_dump()
    }
    
    await app_db.portfolios.insert_one(portfolio_doc)
    return serialize_doc(portfolio_doc)


@portfolios_router.delete("/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete portfolio"""
    app_db = get_app_db()
    
    result = await app_db.portfolios.delete_one({
        "id": portfolio_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    return {"success": True, "message": "Portfolio deleted"}


@portfolios_router.get("/{portfolio_id}/dashboard")
async def get_portfolio_dashboard(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get portfolio dashboard with initiatives"""
    app_db = get_app_db()
    
    portfolio = await app_db.portfolios.find_one({
        "id": portfolio_id,
        "org_id": current_user["org_id"]
    })
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    initiatives = await app_db.initiatives.find({
        "portfolio_id": portfolio_id,
        "org_id": current_user["org_id"]
    }).to_list(1000)
    
    total = len(initiatives)
    completed = len([i for i in initiatives if i.get("status") == "completed"])
    in_progress = len([i for i in initiatives if i.get("status") == "in_progress"])
    
    return {
        "portfolio": serialize_doc(portfolio),
        "initiatives": serialize_doc(initiatives),
        "stats": {
            "total_initiatives": total,
            "completed": completed,
            "in_progress": in_progress
        }
    }


# ==================== INITIATIVES ====================

@initiatives_router.get("")
async def list_initiatives(
    portfolio_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List initiatives"""
    app_db = get_app_db()
    
    query = {"org_id": current_user["org_id"]}
    if portfolio_id:
        query["portfolio_id"] = portfolio_id
    if status:
        query["status"] = status
    
    initiatives = await app_db.initiatives.find(query).to_list(1000)
    return serialize_doc(initiatives)


@initiatives_router.get("/{initiative_id}")
async def get_initiative(
    initiative_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single initiative"""
    app_db = get_app_db()
    
    initiative = await app_db.initiatives.find_one({
        "id": initiative_id,
        "org_id": current_user["org_id"]
    })
    
    if not initiative:
        raise HTTPException(status_code=404, detail="Initiative not found")
    
    return serialize_doc(initiative)


@initiatives_router.post("")
async def create_initiative(
    initiative_data: InitiativeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create initiative"""
    app_db = get_app_db()
    
    initiative_doc = {
        "id": generate_id(),
        "org_id": current_user["org_id"],
        "progress": 0,
        "owner_name": current_user.get("name", "Unknown"),
        "created_by": current_user["id"],
        "created_at": now_utc(),
        **initiative_data.model_dump()
    }
    
    await app_db.initiatives.insert_one(initiative_doc)
    return serialize_doc(initiative_doc)


@initiatives_router.delete("/{initiative_id}")
async def delete_initiative(
    initiative_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete initiative"""
    app_db = get_app_db()
    
    result = await app_db.initiatives.delete_one({
        "id": initiative_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Initiative not found")
    
    return {"success": True, "message": "Initiative deleted"}


@initiatives_router.get("/{initiative_id}/progress")
async def get_initiative_progress(
    initiative_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get initiative progress"""
    app_db = get_app_db()
    
    initiative = await app_db.initiatives.find_one({
        "id": initiative_id,
        "org_id": current_user["org_id"]
    })
    
    if not initiative:
        raise HTTPException(status_code=404, detail="Initiative not found")
    
    return {
        "initiative_id": initiative_id,
        "progress": initiative.get("progress", 0),
        "status": initiative.get("status", "unknown"),
        "start_date": initiative.get("start_date"),
        "target_date": initiative.get("target_date")
    }


@initiatives_router.patch("/{initiative_id}/status")
async def update_initiative_status(
    initiative_id: str,
    status_data: InitiativeStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update initiative status"""
    app_db = get_app_db()
    
    update_fields = {"status": status_data.status, "updated_at": now_utc()}
    if status_data.progress is not None:
        update_fields["progress"] = status_data.progress
    
    result = await app_db.initiatives.update_one(
        {"id": initiative_id, "org_id": current_user["org_id"]},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Initiative not found")
    
    return {"success": True, "message": "Initiative status updated"}
