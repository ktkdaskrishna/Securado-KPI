"""Shared helpers for CRM Sales services"""
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
from services.crm_sales.models import (
    StageUpdate, ProbabilityUpdate, ActivityCreate, ActivityUpdate,
    AccountCreate, KPICreate, BluesheetUpdate, NoteCreate
)
from services.crm_sales.bluesheet import (
    calculate_bluesheet_probability, get_bluesheet_form_options,
    BUYING_INFLUENCES, COMPETITION_STATUS, BUDGET_STATUS
)
from services.rbac_sync.middleware import get_rbac_filter

logger = logging.getLogger(__name__)

# Stage aliases for consistent filtering
STAGE_ALIASES = {
    "closed_won": ["Won", "Closed Won", "closed_won"],
    "closed_lost": ["Lost", "Closed Lost", "closed_lost"],
    "qualified": ["Qualified Opportunity", "Qualified", "qualified"],
    "proposal": ["Proposal", "proposal"],
    "negotiation": ["Review&Negotiation", "Negotiation", "negotiation"],
}

# Date filter helper
def apply_date_filters(records, year=None, quarter=None, date_field='create_date'):
    """Apply year/quarter filtering to records"""
    filtered = records
    if year:
        filtered = [r for r in filtered if str(r.get(date_field, '')).startswith(str(year))]
    if quarter:
        quarter_months = {"Q1": ["01","02","03"], "Q2": ["04","05","06"], "Q3": ["07","08","09"], "Q4": ["10","11","12"]}
        months = quarter_months.get(quarter, [])
        if months:
            filtered = [r for r in filtered if any(f"-{m}-" in str(r.get(date_field, '')) for m in months)]
    return filtered

# Stage normalization
STAGE_MAPPING = {
    "new": "qualified", "enquiry": "qualified", "qualified": "qualified",
    "qualified opportunity": "qualified", "proposal": "proposal",
    "review&negotiation": "negotiation", "negotiation": "negotiation",
    "won": "closed_won", "closed won": "closed_won",
    "lost": "closed_lost", "closed lost": "closed_lost",
    "hold": "qualified", "prospect": "qualified",
    "junk lead": "closed_lost",
}

def normalize_stage(stage: str) -> str:
    """Normalize Odoo stage names to frontend expected values"""
    if not stage:
        return "qualified"
    stage_lower = stage.lower().strip()
    if stage_lower in STAGE_MAPPING:
        return STAGE_MAPPING[stage_lower]
    valid_stages = ["qualified", "proposal", "negotiation", "closed_won", "closed_lost"]
    if stage_lower in valid_stages:
        return stage_lower
    if "new" in stage_lower or "enquir" in stage_lower or "qualif" in stage_lower:
        return "qualified"
    if "prop" in stage_lower:
        return "proposal"
    if "negot" in stage_lower:
        return "negotiation"
    if "won" in stage_lower:
        return "closed_won"
    if "lost" in stage_lower:
        return "closed_lost"
    return "qualified"


async def merge_with_overrides(records, org_id: str, app_db):
    """Merge canonical records with local overrides"""
    from libs.utils import serialize_doc
    canonical_ids = [r.get("canonical_id") for r in records]
    overrides = await app_db.overrides.find({"canonical_id": {"$in": canonical_ids}, "org_id": org_id}).to_list(1000)
    override_map = {o["canonical_id"]: o for o in overrides}
    merged = []
    for record in records:
        merged_record = serialize_doc(record)
        override = override_map.get(record.get("canonical_id"))
        if override:
            for key in ["stage", "probability", "owner"]:
                if key in override:
                    merged_record[key] = override[key]
            merged_record["has_overrides"] = True
        else:
            merged_record["has_overrides"] = False
        merged_record["stage"] = normalize_stage(merged_record.get("stage"))
        merged.append(merged_record)
    return merged
