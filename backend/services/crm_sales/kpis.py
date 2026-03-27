"""CRM Sales - Split module. See helpers.py for shared imports."""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc, PipelineStages
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.routes import get_current_user
from services.crm_sales.models import *
from services.crm_sales.bluesheet import calculate_bluesheet_probability, get_bluesheet_form_options, BUYING_INFLUENCES, COMPETITION_STATUS, BUDGET_STATUS
from services.rbac_sync.middleware import get_rbac_filter
from services.crm_sales.helpers import STAGE_ALIASES, apply_date_filters, merge_with_overrides, normalize_stage, STAGE_MAPPING

logger = logging.getLogger(__name__)

kpis_router = APIRouter(prefix="/kpis", tags=["kpis"])


# ==================== KPIS ====================

@kpis_router.get("")
async def list_kpis(current_user: dict = Depends(get_current_user)):
    """List KPIs"""
    app_db = get_app_db()
    
    kpis = await app_db.kpis.find({"org_id": current_user.get("org_id", "default")}).to_list(100)
    
    if not kpis:
        # Return default KPIs
        return [
            {"id": "1", "name": "Win Rate", "target_value": 35, "current_value": 28, "unit": "percent", "change": 5.2},
            {"id": "2", "name": "Average Deal Size", "target_value": 100000, "current_value": 85000, "unit": "currency", "change": 12.5},
            {"id": "3", "name": "Sales Cycle", "target_value": 45, "current_value": 52, "unit": "days", "change": -8.3},
            {"id": "4", "name": "Monthly Calls", "target_value": 500, "current_value": 423, "unit": "number", "change": 15.0}
        ]
    
    return serialize_doc(kpis)


@kpis_router.post("")
async def create_kpi(
    kpi_data: KPICreate,
    current_user: dict = Depends(get_current_user)
):
    """Create KPI"""
    app_db = get_app_db()
    
    kpi_doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "change": 0,
        "created_at": now_utc(),
        **kpi_data.model_dump()
    }
    
    await app_db.kpis.insert_one(kpi_doc)
    return serialize_doc(kpi_doc)


@kpis_router.put("/{kpi_id}")
async def update_kpi(
    kpi_id: str,
    kpi_data: KPICreate,
    current_user: dict = Depends(get_current_user)
):
    """Update KPI"""
    app_db = get_app_db()
    
    result = await app_db.kpis.update_one(
        {"id": kpi_id, "org_id": current_user.get("org_id", "default")},
        {"$set": {**kpi_data.model_dump(), "updated_at": now_utc()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    return {"success": True, "message": "KPI updated"}


@kpis_router.delete("/{kpi_id}")
async def delete_kpi(
    kpi_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete KPI"""
    app_db = get_app_db()
    
    result = await app_db.kpis.delete_one({
        "id": kpi_id,
        "org_id": current_user.get("org_id", "default")
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    return {"success": True, "message": "KPI deleted"}


