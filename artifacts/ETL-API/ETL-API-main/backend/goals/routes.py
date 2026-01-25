from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from goals.models import (
    GoalCreate, GoalProgressUpdate, TeamCreate, TeamMemberAdd,
    PortfolioCreate, InitiativeCreate, InitiativeStatusUpdate
)
from auth.routes import get_current_user
from core.database import get_app_db
from core.utils import serialize_doc
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)

# ===== GOALS =====

goals_router = APIRouter(prefix="/goals", tags=["goals"])

@goals_router.get("")
async def list_goals(
    team_id: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List goals"""
    try:
        db = get_app_db()
        
        query = {"org_id": current_user["org_id"]}
        if team_id:
            query["team_id"] = team_id
        if assigned_to:
            query["assigned_to"] = assigned_to
        
        goals = await db.goals.find(query).to_list(1000)
        return [serialize_doc(g) for g in goals]
    except Exception as e:
        logger.error(f"Error listing goals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@goals_router.get("/{goal_id}")
async def get_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single goal"""
    try:
        db = get_app_db()
        
        goal = await db.goals.find_one({
            "id": goal_id,
            "org_id": current_user["org_id"]
        })
        
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        return serialize_doc(goal)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@goals_router.post("")
async def create_goal(
    goal_data: GoalCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create goal"""
    try:
        db = get_app_db()
        
        goal_doc = {
            "id": str(uuid.uuid4()),
            "org_id": current_user["org_id"],
            "created_by": current_user["id"],
            "created_at": datetime.utcnow(),
            **goal_data.model_dump()
        }
        
        await db.goals.insert_one(goal_doc)
        
        return serialize_doc(goal_doc)
    except Exception as e:
        logger.error(f"Error creating goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@goals_router.put("/{goal_id}")
async def update_goal(
    goal_id: str,
    goal_data: GoalCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update goal"""
    try:
        db = get_app_db()
        
        result = await db.goals.update_one(
            {"id": goal_id, "org_id": current_user["org_id"]},
            {"$set": {**goal_data.model_dump(), "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        return {"success": True, "message": "Goal updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@goals_router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete goal"""
    try:
        db = get_app_db()
        
        result = await db.goals.delete_one({
            "id": goal_id,
            "org_id": current_user["org_id"]
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        return {"success": True, "message": "Goal deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@goals_router.patch("/{goal_id}/progress")
async def update_goal_progress(
    goal_id: str,
    progress_data: GoalProgressUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update goal progress"""
    try:
        db = get_app_db()
        
        result = await db.goals.update_one(
            {"id": goal_id, "org_id": current_user["org_id"]},
            {"$set": {"current_value": progress_data.current_value, "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        return {"success": True, "message": "Goal progress updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating goal progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@goals_router.get("/team/subordinates")
async def get_team_subordinate_goals(current_user: dict = Depends(get_current_user)):
    """Get goals for team subordinates"""
    try:
        db = get_app_db()
        
        # Find teams where current user is manager
        teams = await db.teams.find({
            "manager_id": current_user["id"],
            "org_id": current_user["org_id"]
        }).to_list(100)
        
        team_ids = [t["id"] for t in teams]
        
        # Get goals for these teams
        goals = await db.goals.find({
            "team_id": {"$in": team_ids},
            "org_id": current_user["org_id"]
        }).to_list(1000)
        
        return [serialize_doc(g) for g in goals]
    except Exception as e:
        logger.error(f"Error getting subordinate goals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@goals_router.post("/assign-to-team")
async def assign_goal_to_team(
    goal_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Assign goal to team"""
    try:
        db = get_app_db()
        
        result = await db.goals.update_one(
            {"id": goal_id, "org_id": current_user["org_id"]},
            {"$set": {"team_id": team_id, "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        return {"success": True, "message": "Goal assigned to team"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@goals_router.get("/summary/stats")
async def get_goal_summary_stats(current_user: dict = Depends(get_current_user)):
    """Get goal summary statistics"""
    try:
        db = get_app_db()
        
        goals = await db.goals.find({"org_id": current_user["org_id"]}).to_list(1000)
        
        total_goals = len(goals)
        completed_goals = len([g for g in goals if g.get("current_value", 0) >= g.get("target_value", 0)])
        in_progress = len([g for g in goals if 0 < g.get("current_value", 0) < g.get("target_value", 0)])
        not_started = len([g for g in goals if g.get("current_value", 0) == 0])
        
        return {
            "total_goals": total_goals,
            "completed": completed_goals,
            "in_progress": in_progress,
            "not_started": not_started,
            "completion_rate": (completed_goals / total_goals * 100) if total_goals > 0 else 0
        }
    except Exception as e:
        logger.error(f"Error getting goal stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== TEAMS =====

teams_router = APIRouter(prefix="/teams", tags=["teams"])

@teams_router.post("")
async def create_team(
    team_data: TeamCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create team"""
    try:
        db = get_app_db()
        
        team_doc = {
            "id": str(uuid.uuid4()),
            "org_id": current_user["org_id"],
            "created_by": current_user["id"],
            "created_at": datetime.utcnow(),
            "members": [],
            **team_data.model_dump()
        }
        
        await db.teams.insert_one(team_doc)
        
        return serialize_doc(team_doc)
    except Exception as e:
        logger.error(f"Error creating team: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@teams_router.get("")
async def list_teams(current_user: dict = Depends(get_current_user)):
    """List teams"""
    try:
        db = get_app_db()
        
        teams = await db.teams.find({"org_id": current_user["org_id"]}).to_list(1000)
        return [serialize_doc(t) for t in teams]
    except Exception as e:
        logger.error(f"Error listing teams: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@teams_router.get("/{team_id}")
async def get_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single team"""
    try:
        db = get_app_db()
        
        team = await db.teams.find_one({
            "id": team_id,
            "org_id": current_user["org_id"]
        })
        
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        
        return serialize_doc(team)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting team: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@teams_router.put("/{team_id}")
async def update_team(
    team_id: str,
    team_data: TeamCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update team"""
    try:
        db = get_app_db()
        
        result = await db.teams.update_one(
            {"id": team_id, "org_id": current_user["org_id"]},
            {"$set": {**team_data.model_dump(), "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Team not found")
        
        return {"success": True, "message": "Team updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating team: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@teams_router.post("/{team_id}/members")
async def add_team_member(
    team_id: str,
    member_data: TeamMemberAdd,
    current_user: dict = Depends(get_current_user)
):
    """Add member to team"""
    try:
        db = get_app_db()
        
        result = await db.teams.update_one(
            {"id": team_id, "org_id": current_user["org_id"]},
            {"$addToSet": {"members": member_data.user_id}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Team not found")
        
        return {"success": True, "message": "Member added to team"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding team member: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@teams_router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove member from team"""
    try:
        db = get_app_db()
        
        result = await db.teams.update_one(
            {"id": team_id, "org_id": current_user["org_id"]},
            {"$pull": {"members": user_id}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Team not found")
        
        return {"success": True, "message": "Member removed from team"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing team member: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@teams_router.get("/my-teams")
async def get_my_teams(current_user: dict = Depends(get_current_user)):
    """Get teams current user belongs to"""
    try:
        db = get_app_db()
        
        teams = await db.teams.find({
            "members": current_user["id"],
            "org_id": current_user["org_id"]
        }).to_list(1000)
        
        return [serialize_doc(t) for t in teams]
    except Exception as e:
        logger.error(f"Error getting my teams: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== PORTFOLIOS =====

portfolios_router = APIRouter(prefix="/portfolios", tags=["portfolios"])

@portfolios_router.post("")
async def create_portfolio(
    portfolio_data: PortfolioCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create portfolio"""
    try:
        db = get_app_db()
        
        portfolio_doc = {
            "id": str(uuid.uuid4()),
            "org_id": current_user["org_id"],
            "created_by": current_user["id"],
            "created_at": datetime.utcnow(),
            **portfolio_data.model_dump()
        }
        
        await db.portfolios.insert_one(portfolio_doc)
        
        return serialize_doc(portfolio_doc)
    except Exception as e:
        logger.error(f"Error creating portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@portfolios_router.get("")
async def list_portfolios(current_user: dict = Depends(get_current_user)):
    """List portfolios"""
    try:
        db = get_app_db()
        
        portfolios = await db.portfolios.find({"org_id": current_user["org_id"]}).to_list(1000)
        return [serialize_doc(p) for p in portfolios]
    except Exception as e:
        logger.error(f"Error listing portfolios: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@portfolios_router.get("/{portfolio_id}/dashboard")
async def get_portfolio_dashboard(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get portfolio dashboard"""
    try:
        db = get_app_db()
        
        # Get portfolio
        portfolio = await db.portfolios.find_one({
            "id": portfolio_id,
            "org_id": current_user["org_id"]
        })
        
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        
        # Get initiatives in portfolio
        initiatives = await db.initiatives.find({
            "portfolio_id": portfolio_id,
            "org_id": current_user["org_id"]
        }).to_list(1000)
        
        # Calculate stats
        total_initiatives = len(initiatives)
        completed = len([i for i in initiatives if i.get("status") == "completed"])
        in_progress = len([i for i in initiatives if i.get("status") == "in_progress"])
        
        return {
            "portfolio": serialize_doc(portfolio),
            "initiatives": [serialize_doc(i) for i in initiatives],
            "stats": {
                "total_initiatives": total_initiatives,
                "completed": completed,
                "in_progress": in_progress
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting portfolio dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== INITIATIVES =====

initiatives_router = APIRouter(prefix="/initiatives", tags=["initiatives"])

@initiatives_router.post("")
async def create_initiative(
    initiative_data: InitiativeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create initiative"""
    try:
        db = get_app_db()
        
        initiative_doc = {
            "id": str(uuid.uuid4()),
            "org_id": current_user["org_id"],
            "created_by": current_user["id"],
            "created_at": datetime.utcnow(),
            "progress": 0,
            **initiative_data.model_dump()
        }
        
        await db.initiatives.insert_one(initiative_doc)
        
        return serialize_doc(initiative_doc)
    except Exception as e:
        logger.error(f"Error creating initiative: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@initiatives_router.get("")
async def list_initiatives(
    portfolio_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List initiatives"""
    try:
        db = get_app_db()
        
        query = {"org_id": current_user["org_id"]}
        if portfolio_id:
            query["portfolio_id"] = portfolio_id
        
        initiatives = await db.initiatives.find(query).to_list(1000)
        return [serialize_doc(i) for i in initiatives]
    except Exception as e:
        logger.error(f"Error listing initiatives: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@initiatives_router.get("/{initiative_id}/progress")
async def get_initiative_progress(
    initiative_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get initiative progress"""
    try:
        db = get_app_db()
        
        initiative = await db.initiatives.find_one({
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting initiative progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@initiatives_router.patch("/{initiative_id}/status")
async def update_initiative_status(
    initiative_id: str,
    status_data: InitiativeStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update initiative status"""
    try:
        db = get_app_db()
        
        result = await db.initiatives.update_one(
            {"id": initiative_id, "org_id": current_user["org_id"]},
            {"$set": {"status": status_data.status, "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Initiative not found")
        
        return {"success": True, "message": "Initiative status updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating initiative status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
