"""Saved Filter Presets API"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
import logging

from libs.database import get_app_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
filter_presets_router = APIRouter(prefix="/filter-presets", tags=["filter-presets"])


class FilterCondition(BaseModel):
    field: str
    operator: str  # equals, not_equals, contains, gt, lt, between, in
    value: str
    value2: Optional[str] = None  # for 'between' operator


class FilterPresetCreate(BaseModel):
    name: str
    conditions: List[FilterCondition]
    logic: str = "AND"  # AND or OR
    scope: str = "personal"  # personal or shared


@filter_presets_router.get("")
async def list_presets(current_user: dict = Depends(get_current_user)):
    """List filter presets (personal + shared)"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    user_id = current_user.get("id")

    presets = await app_db.filter_presets.find({
        "org_id": org_id,
        "$or": [{"user_id": user_id}, {"scope": "shared"}]
    }).sort("created_at", -1).to_list(100)

    return serialize_doc(presets)


@filter_presets_router.post("")
async def create_preset(data: FilterPresetCreate, current_user: dict = Depends(get_current_user)):
    """Save a filter preset"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    doc = {
        "id": generate_id(),
        "org_id": org_id,
        "user_id": current_user.get("id"),
        "user_name": current_user.get("name", ""),
        "created_at": now_utc(),
        **data.model_dump()
    }
    await app_db.filter_presets.insert_one(doc)
    return serialize_doc(doc)


@filter_presets_router.delete("/{preset_id}")
async def delete_preset(preset_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a filter preset"""
    app_db = get_app_db()
    result = await app_db.filter_presets.delete_one({
        "id": preset_id,
        "$or": [{"user_id": current_user.get("id")}, {"scope": "shared"}]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"success": True}
