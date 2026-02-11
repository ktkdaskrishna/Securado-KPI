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
