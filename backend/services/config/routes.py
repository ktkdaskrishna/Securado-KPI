"""Config Service Routes - System and User Configuration

Handles:
- System configuration
- User dashboard preferences
- Widget settings
- Navigation config
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any
from pydantic import BaseModel
import logging

from libs.database import get_app_db
from libs.utils import serialize_doc, generate_id, now_utc
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/config", tags=["config"])


class DashboardConfig(BaseModel):
    show_pipeline_chart: bool = True
    show_activity_stats: bool = True
    show_leaderboard: bool = True
    compact_view: bool = False
    default_page_size: int = 10
    theme: str = "light"


class WidgetConfig(BaseModel):
    name: str
    type: str
    enabled: bool = True
    position: int = 0
    settings: Dict[str, Any] = {}


@router.get("")
async def get_system_config(current_user: dict = Depends(get_current_user)):
    """Get system configuration"""
    app_db = get_app_db()
    
    config = await app_db.config.find_one({
        "config_type": "system",
        "org_id": current_user.get("org_id", "default")
    })
    
    if config:
        return serialize_doc(config)
    
    # Return defaults
    return {
        "app_name": "Event Mesh CRM",
        "version": "1.0.0",
        "features_enabled": True,
        "max_records_per_page": 50,
        "default_currency": "USD",
        "pipeline_stages": ["qualified", "proposal", "negotiation", "closed_won", "closed_lost"],
        "activity_types": ["call", "email", "meeting", "task"],
        "etl_enabled": True,
        "crm_enabled": True
    }


@router.put("")
async def update_system_config(
    config_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update system configuration"""
    app_db = get_app_db()
    
    config_data["config_type"] = "system"
    config_data["org_id"] = current_user.get("org_id", "default")
    config_data["updated_at"] = now_utc()
    config_data["updated_by"] = current_user["id"]
    
    await app_db.config.update_one(
        {"config_type": "system", "org_id": current_user.get("org_id", "default")},
        {"$set": config_data},
        upsert=True
    )
    
    # Emit config updated event
    await emit_event(
        event_type=Topics.CONFIG_UPDATED,
        payload={"config_type": "system"},
        producer="config-service",
        org_id=current_user.get("org_id", "default")
    )
    
    return {"success": True, "message": "Configuration updated"}


@router.get("/user/dashboard")
async def get_user_dashboard_config(current_user: dict = Depends(get_current_user)):
    """Get user dashboard configuration"""
    app_db = get_app_db()
    
    config = await app_db.config.find_one({
        "config_type": "user_dashboard",
        "user_id": current_user["id"]
    })
    
    if config:
        return serialize_doc(config)
    
    # Return defaults
    return {
        "show_pipeline_chart": True,
        "show_activity_stats": True,
        "show_leaderboard": True,
        "compact_view": False,
        "default_page_size": 10,
        "theme": "light"
    }


@router.put("/user/dashboard")
async def update_user_dashboard_config(
    config_data: DashboardConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update user dashboard configuration"""
    app_db = get_app_db()
    
    config_doc = {
        "config_type": "user_dashboard",
        "user_id": current_user["id"],
        "org_id": current_user.get("org_id", "default"),
        "updated_at": now_utc(),
        **config_data.model_dump()
    }
    
    await app_db.config.update_one(
        {"config_type": "user_dashboard", "user_id": current_user["id"]},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"success": True, "message": "Dashboard configuration updated"}


@router.get("/widgets")
async def get_widgets(current_user: dict = Depends(get_current_user)):
    """Get dashboard widgets"""
    app_db = get_app_db()
    
    widgets = await app_db.config.find({
        "config_type": "widget",
        "org_id": current_user.get("org_id", "default")
    }).to_list(100)
    
    if not widgets:
        # Return default widgets
        return [
            {"id": "1", "name": "Pipeline Overview", "type": "chart", "enabled": True, "position": 0},
            {"id": "2", "name": "Recent Activities", "type": "list", "enabled": True, "position": 1},
            {"id": "3", "name": "Leaderboard", "type": "table", "enabled": True, "position": 2},
            {"id": "4", "name": "KPIs", "type": "metrics", "enabled": True, "position": 3}
        ]
    
    return serialize_doc(widgets)


@router.post("/widgets")
async def create_widget(
    widget_data: WidgetConfig,
    current_user: dict = Depends(get_current_user)
):
    """Create a dashboard widget"""
    app_db = get_app_db()
    
    widget_doc = {
        "id": generate_id(),
        "config_type": "widget",
        "org_id": current_user.get("org_id", "default"),
        "created_at": now_utc(),
        **widget_data.model_dump()
    }
    
    await app_db.config.insert_one(widget_doc)
    return serialize_doc(widget_doc)


@router.get("/navigation")
async def get_navigation(current_user: dict = Depends(get_current_user)):
    """Get navigation configuration"""
    # Return default navigation structure
    return {
        "main": [
            {"id": "dashboard", "label": "Dashboard", "path": "/dashboard", "icon": "LayoutDashboard"},
            {"id": "opportunities", "label": "Opportunities", "path": "/opportunities", "icon": "TrendingUp"},
            {"id": "accounts", "label": "Accounts", "path": "/accounts", "icon": "Building2"},
            {"id": "activities", "label": "Activities", "path": "/activities", "icon": "CheckSquare"},
            {"id": "goals", "label": "Goals", "path": "/goals", "icon": "Target"},
            {"id": "teams", "label": "Teams", "path": "/teams", "icon": "Users"},
            {"id": "portfolios", "label": "Portfolios", "path": "/portfolios", "icon": "Briefcase"},
            {"id": "initiatives", "label": "Initiatives", "path": "/initiatives", "icon": "Rocket"},
            {"id": "kpis", "label": "KPIs", "path": "/kpis", "icon": "BarChart2"}
        ],
        "etl": [
            {"id": "connections", "label": "Connections", "path": "/etl/connections", "icon": "Link"},
            {"id": "mappings", "label": "Mappings", "path": "/etl/mappings", "icon": "GitMerge"},
            {"id": "pipelines", "label": "Pipelines", "path": "/etl/pipelines", "icon": "Workflow"},
            {"id": "runs", "label": "Run History", "path": "/etl/runs", "icon": "History"},
            {"id": "data-lake", "label": "Data Lake", "path": "/etl/data-lake", "icon": "Database"},
            {"id": "dlq", "label": "DLQ", "path": "/etl/dlq", "icon": "AlertTriangle"}
        ],
        "admin": [
            {"id": "users", "label": "Users", "path": "/admin/users", "icon": "Users"},
            {"id": "roles", "label": "Roles", "path": "/admin/roles", "icon": "Shield"},
            {"id": "departments", "label": "Departments", "path": "/admin/departments", "icon": "Building"}
        ]
    }
