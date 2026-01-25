from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict, Any
from config.models import (
    WidgetConfig, NavigationItem, ServiceLineCreate, PipelineStageCreate,
    BluesheetWeights, TargetCreate, RoleTargetCreate
)
from auth.routes import get_current_user
from core.database import get_app_db
from core.utils import serialize_doc
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/config", tags=["config"])

# ===== SYSTEM WIDGETS & NAVIGATION =====

@router.get("/widgets")
async def get_system_widgets():
    """Get available system widgets"""
    # Return predefined widgets
    return [
        {"id": "opportunities_pipeline", "name": "Opportunities Pipeline", "type": "chart", "config": {"chart_type": "funnel"}},
        {"id": "revenue_forecast", "name": "Revenue Forecast", "type": "chart", "config": {"chart_type": "line"}},
        {"id": "activities_summary", "name": "Activities Summary", "type": "stats", "config": {}},
        {"id": "top_deals", "name": "Top Deals", "type": "list", "config": {"limit": 10}},
        {"id": "team_leaderboard", "name": "Team Leaderboard", "type": "table", "config": {}}
    ]

@router.get("/navigation-items")
async def get_navigation_items():
    """Get system navigation items"""
    return [
        {"id": "dashboard", "label": "Dashboard", "path": "/dashboard", "icon": "dashboard", "order": 1},
        {"id": "opportunities", "label": "Opportunities", "path": "/opportunities", "icon": "business", "order": 2},
        {"id": "accounts", "label": "Accounts", "path": "/accounts", "icon": "account_circle", "order": 3},
        {"id": "activities", "label": "Activities", "path": "/activities", "icon": "event", "order": 4},
        {"id": "goals", "label": "Goals", "path": "/goals", "icon": "flag", "order": 5},
        {"id": "teams", "label": "Teams", "path": "/teams", "icon": "group", "order": 6},
        {"id": "reports", "label": "Reports", "path": "/reports", "icon": "assessment", "order": 7},
        {"id": "admin", "label": "Admin", "path": "/admin", "icon": "settings", "order": 8}
    ]

# ===== USER DASHBOARD CONFIG =====

@router.get("/user/dashboard")
async def get_user_dashboard_config(current_user: dict = Depends(get_current_user)):
    """Get user's dashboard configuration"""
    db = get_app_db()
    
    config = await db.user_dashboard_config.find_one({
        "user_id": current_user["id"],
        "org_id": current_user["org_id"]
    })
    
    if config:
        return serialize_doc(config)
    
    # Return default config
    return {
        "user_id": current_user["id"],
        "widgets": ["opportunities_pipeline", "revenue_forecast", "activities_summary"],
        "layout": "grid"
    }

@router.put("/user/dashboard")
async def update_user_dashboard_config(
    config_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update user's dashboard configuration"""
    db = get_app_db()
    
    config_doc = {
        "user_id": current_user["id"],
        "org_id": current_user["org_id"],
        "updated_at": datetime.utcnow(),
        **config_data
    }
    
    await db.user_dashboard_config.update_one(
        {"user_id": current_user["id"], "org_id": current_user["org_id"]},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"success": True, "message": "Dashboard configuration updated"}

@router.delete("/user/dashboard")
async def reset_user_dashboard_config(current_user: dict = Depends(get_current_user)):
    """Reset user's dashboard configuration to default"""
    db = get_app_db()
    
    await db.user_dashboard_config.delete_one({
        "user_id": current_user["id"],
        "org_id": current_user["org_id"]
    })
    
    return {"success": True, "message": "Dashboard configuration reset to default"}

@router.get("/user/navigation")
async def get_user_navigation_config(current_user: dict = Depends(get_current_user)):
    """Get user's navigation configuration"""
    db = get_app_db()
    
    config = await db.user_navigation_config.find_one({
        "user_id": current_user["id"],
        "org_id": current_user["org_id"]
    })
    
    if config:
        return serialize_doc(config)
    
    # Return default
    return {
        "user_id": current_user["id"],
        "pinned_items": ["dashboard", "opportunities"],
        "hidden_items": []
    }

# ===== SERVICE LINES =====

@router.get("/service-lines")
async def list_service_lines(current_user: dict = Depends(get_current_user)):
    """List service lines"""
    db = get_app_db()
    lines = await db.service_lines.find({"org_id": current_user["org_id"]}).to_list(1000)
    return [serialize_doc(line) for line in lines]

@router.post("/service-lines")
async def create_service_line(
    line_data: ServiceLineCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create service line"""
    db = get_app_db()
    
    line_doc = {
        "id": str(uuid.uuid4()),
        "org_id": current_user["org_id"],
        "created_at": datetime.utcnow(),
        **line_data.model_dump()
    }
    
    await db.service_lines.insert_one(line_doc)
    return serialize_doc(line_doc)

@router.put("/service-lines/{line_id}")
async def update_service_line(
    line_id: str,
    line_data: ServiceLineCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update service line"""
    db = get_app_db()
    
    result = await db.service_lines.update_one(
        {"id": line_id, "org_id": current_user["org_id"]},
        {"$set": {**line_data.model_dump(), "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service line not found")
    
    return {"success": True, "message": "Service line updated"}

# ===== PIPELINE STAGES =====

@router.get("/pipeline-stages")
async def list_pipeline_stages(current_user: dict = Depends(get_current_user)):
    """List pipeline stages"""
    db = get_app_db()
    stages = await db.pipeline_stages.find(
        {"org_id": current_user["org_id"]}
    ).sort("order", 1).to_list(1000)
    return [serialize_doc(stage) for stage in stages]

@router.post("/pipeline-stages")
async def create_pipeline_stage(
    stage_data: PipelineStageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create pipeline stage"""
    db = get_app_db()
    
    stage_doc = {
        "id": str(uuid.uuid4()),
        "org_id": current_user["org_id"],
        "created_at": datetime.utcnow(),
        **stage_data.model_dump()
    }
    
    await db.pipeline_stages.insert_one(stage_doc)
    return serialize_doc(stage_doc)

@router.put("/pipeline-stages/{stage_id}")
async def update_pipeline_stage(
    stage_id: str,
    stage_data: PipelineStageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update pipeline stage"""
    db = get_app_db()
    
    result = await db.pipeline_stages.update_one(
        {"id": stage_id, "org_id": current_user["org_id"]},
        {"$set": {**stage_data.model_dump(), "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pipeline stage not found")
    
    return {"success": True, "message": "Pipeline stage updated"}

# ===== BLUESHEET WEIGHTS =====

@router.get("/bluesheet-weights")
async def get_bluesheet_weights(current_user: dict = Depends(get_current_user)):
    """Get bluesheet weights"""
    db = get_app_db()
    
    weights = await db.bluesheet_weights.find_one({"org_id": current_user["org_id"]})
    
    if weights:
        return serialize_doc(weights)
    
    # Return default weights
    return {
        "org_id": current_user["org_id"],
        "weights": {
            "need": 0.2,
            "budget": 0.2,
            "timeline": 0.15,
            "authority": 0.2,
            "competition": 0.15,
            "fit": 0.1
        }
    }

@router.put("/bluesheet-weights")
async def update_bluesheet_weights(
    weights_data: BluesheetWeights,
    current_user: dict = Depends(get_current_user)
):
    """Update bluesheet weights"""
    db = get_app_db()
    
    weights_doc = {
        "org_id": current_user["org_id"],
        "updated_at": datetime.utcnow(),
        **weights_data.model_dump()
    }
    
    await db.bluesheet_weights.update_one(
        {"org_id": current_user["org_id"]},
        {"$set": weights_doc},
        upsert=True
    )
    
    return {"success": True, "message": "Bluesheet weights updated"}

# ===== TARGETS =====

@router.get("/targets")
async def list_targets(current_user: dict = Depends(get_current_user)):
    """List targets"""
    db = get_app_db()
    targets = await db.targets.find({"org_id": current_user["org_id"]}).to_list(1000)
    return [serialize_doc(t) for t in targets]

@router.post("/targets")
async def create_target(
    target_data: TargetCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create target"""
    db = get_app_db()
    
    target_doc = {
        "id": str(uuid.uuid4()),
        "org_id": current_user["org_id"],
        "created_at": datetime.utcnow(),
        **target_data.model_dump()
    }
    
    await db.targets.insert_one(target_doc)
    return serialize_doc(target_doc)

@router.put("/targets/{target_id}")
async def update_target(
    target_id: str,
    target_data: TargetCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update target"""
    db = get_app_db()
    
    result = await db.targets.update_one(
        {"id": target_id, "org_id": current_user["org_id"]},
        {"$set": {**target_data.model_dump(), "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Target not found")
    
    return {"success": True, "message": "Target updated"}

@router.delete("/targets/{target_id}")
async def delete_target(
    target_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete target"""
    db = get_app_db()
    
    result = await db.targets.delete_one({
        "id": target_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Target not found")
    
    return {"success": True, "message": "Target deleted"}

# ===== ROLE TARGETS =====

@router.get("/role-targets")
async def list_role_targets(current_user: dict = Depends(get_current_user)):
    """List role targets"""
    db = get_app_db()
    targets = await db.role_targets.find({"org_id": current_user["org_id"]}).to_list(1000)
    return [serialize_doc(t) for t in targets]

@router.post("/role-targets")
async def create_role_target(
    target_data: RoleTargetCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create role target"""
    db = get_app_db()
    
    target_doc = {
        "id": str(uuid.uuid4()),
        "org_id": current_user["org_id"],
        "created_at": datetime.utcnow(),
        **target_data.model_dump()
    }
    
    await db.role_targets.insert_one(target_doc)
    return serialize_doc(target_doc)

@router.put("/role-targets/{target_id}")
async def update_role_target(
    target_id: str,
    target_data: RoleTargetCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update role target"""
    db = get_app_db()
    
    result = await db.role_targets.update_one(
        {"id": target_id, "org_id": current_user["org_id"]},
        {"$set": {**target_data.model_dump(), "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Role target not found")
    
    return {"success": True, "message": "Role target updated"}

@router.delete("/role-targets/{target_id}")
async def delete_role_target(
    target_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete role target"""
    db = get_app_db()
    
    result = await db.role_targets.delete_one({
        "id": target_id,
        "org_id": current_user["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role target not found")
    
    return {"success": True, "message": "Role target deleted"}

@router.get("/user-targets/{user_id}")
async def get_user_targets(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get targets for specific user"""
    db = get_app_db()
    
    # Get user's roles
    user = await db.users.find_one({"id": user_id, "org_id": current_user["org_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_roles = user.get("roles", [])
    
    # Get role targets
    role_targets = await db.role_targets.find({
        "role": {"$in": user_roles},
        "org_id": current_user["org_id"]
    }).to_list(1000)
    
    return [serialize_doc(t) for t in role_targets]

@router.get("/target-progress-report")
async def get_target_progress_report(current_user: dict = Depends(get_current_user)):
    """Get target progress report"""
    # Stub - would calculate actual progress from opportunities/sales
    return {
        "org_id": current_user["org_id"],
        "message": "Target progress report (stub). Implement with actual sales data calculation."
    }
