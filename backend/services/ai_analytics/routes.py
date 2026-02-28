"""AI Sales Analytics Service Routes

Provides AI-powered sales analytics including:
- Sales cycle analysis by account/product/rep
- Conversion funnel analysis
- Rep performance metrics
- Deal velocity insights
- AI-generated insights and recommendations

RBAC enforced - users only see data they have permission to view
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import logging
import os
import json

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, now_utc
from services.identity.routes import get_current_user
from services.rbac_sync.middleware import get_rbac_filter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["ai-analytics"])


# Helper function to check if user has no access
def has_no_rbac_access(rbac_filter: dict) -> bool:
    """Check if RBAC filter indicates no access"""
    return rbac_filter and "_id" in rbac_filter and rbac_filter.get("_id", {}).get("$eq") == "NO_ACCESS_USER_NOT_IN_RBAC"


# Helper function to get opportunity value (sale_value first, then amount)
def get_opp_value(opp: dict) -> float:
    """Get the opportunity value, preferring sale_value (custom field) over amount"""
    sale_value = opp.get("sale_value")
    if sale_value and float(sale_value) > 0:
        return float(sale_value)
    return float(opp.get("amount", 0) or 0)


# Helper functions for proper classification
def is_won(o: dict) -> bool:
    """Check if opportunity is won"""
    stage = (o.get("stage") or "").lower().strip()
    return stage == "won" or "closed won" in stage


def is_lost(o: dict) -> bool:
    """Check if opportunity is lost"""
    stage = (o.get("stage") or "").lower().strip()
    # Check stage first (most reliable)
    if stage == "lost" or "closed lost" in stage:
        return True
    # Also check active flag with lost reason (archived deals in Odoo)
    active = o.get("active", True)
    if active == 'False' or active is False:
        return bool(o.get("lost_reason_id") or o.get("lost_reason"))
    return False


def normalize_stage(stage: str, active: bool = True, lost_reason_id = None) -> str:
    """Normalize Odoo stages to funnel stages
    
    Odoo Stages mapping:
    - Prospect, Enquiry → lead
    - Qualified Opportunity → qualified
    - Proposal → proposal  
    - Review&Negotiation → negotiation
    - Won → won
    - Lost, Hold, Junk Lead → lost (or excluded)
    
    In Odoo, lost deals are archived (active=False) with a lost_reason_id.
    They keep their original stage but are marked as lost.
    """
    # Check if it's a lost deal (archived with lost reason)
    if not active and lost_reason_id:
        return "lost"
    
    if not stage:
        return "unknown"
    stage_lower = stage.lower().strip()
    
    # Won stages
    if stage_lower in ["won", "closed won", "closed_won"]:
        return "won"
    
    # Lost/Inactive stages
    if stage_lower in ["lost", "closed lost", "closed_lost", "junk lead", "hold"]:
        return "lost"
    
    # Negotiation stages
    if "negot" in stage_lower or "review" in stage_lower:
        return "negotiation"
    
    # Proposal stages
    if "prop" in stage_lower:
        return "proposal"
    
    # Qualified stages
    if "quali" in stage_lower:
        return "qualified"
    
    # Lead/Prospect stages
    if "enquiry" in stage_lower or "new" in stage_lower or "prospect" in stage_lower:
        return "lead"
    
    return "lead"


def get_opp_value(opp):
    """Get the value of an opportunity using sale_value (RFP quoted) if available, else amount"""
    sale_val = opp.get("sale_value", 0)
    if sale_val and sale_val != 'False':
        try:
            return float(sale_val)
        except:
            pass
    amount = opp.get("amount", 0)
    if amount and amount != 'False':
        try:
            return float(amount)
        except:
            pass
    return 0


@router.get("/overview")
async def get_analytics_overview(
    request: Request,
    time_period: Optional[str] = "all",  # year, quarter, month, week
    year: Optional[str] = None,
    quarter: Optional[str] = None,
    sales_rep: Optional[str] = None,
    team_id: Optional[str] = None,
    account: Optional[str] = None,
    stage: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get overview of all analytics metrics with optional filters - OPPORTUNITIES ONLY (RBAC enforced)"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Check if user has NO_ACCESS
    if has_no_rbac_access(rbac_filter):
        # Return empty analytics for non-RBAC users
        return {
            "total_pipeline": 0, "won_value": 0, "lost_value": 0,
            "win_rate": 0, "avg_deal_size": 0, "total_opportunities": 0,
            "stage_distribution": [], "filters_applied": {}
        }
    
    # Build query with RBAC + year filter at DB level
    query = {"org_id": org_id, "type": "opportunity", "deleted": {"$ne": True}, "active": True}
    query.update(rbac_filter)
    
    # Convert time_period to year/quarter
    if time_period != "all" and not year and not quarter:
        from datetime import datetime
        now = datetime.now()
        current_year = str(now.year)
        current_month = now.month
        
        if time_period == "year":
            year = current_year
        elif time_period == "quarter":
            q = (current_month - 1) // 3 + 1
            quarter = f"Q{q}"
            year = current_year
    
    # ODOO-MATCHING: Don't filter year at DB level for Won/Lost
    # Fetch all, then split by stage and apply date filter per category
    all_opps = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Apply remaining filters (sales_rep, account, stage)
    filters = {
        "sales_rep": sales_rep,
        "team_id": team_id,
        "account": account,
        "stage": stage,
    }
    all_opps = apply_filters(all_opps, filters)
    
    # Apply Odoo-style year filtering
    if year:
        def is_won_or_lost(o):
            s = str(o.get("stage", "")).lower()
            return s == "won" or s == "lost" or "closed" in s
        
        open_filtered = [o for o in all_opps if not is_won_or_lost(o) and str(o.get("date_last_stage_update", "")).startswith(year)]
        closed_filtered = [o for o in all_opps if is_won_or_lost(o) and str(o.get("date_last_stage_update") or "").startswith(year)]
        all_opps = open_filtered + closed_filtered
    
    logger.info(f"AI Analytics overview: year={year}, found {len(all_opps)} opps (Odoo-style filter)")
    opps = apply_filters(all_opps, filters)
    
    # Get all accounts
    accounts = await canonical_db.accounts.find({"org_id": org_id}).to_list(10000)
    
    # Get all sales users
    sales_users = await canonical_db.sales_users.find({"org_id": org_id}).to_list(1000)
    
    # Calculate metrics using correct sale_value and Lost detection
    total_pipeline = sum(get_opp_value(o) for o in opps)
    won_opps = [o for o in opps if is_won(o)]
    lost_opps = [o for o in opps if is_lost(o)]
    
    won_value = sum(get_opp_value(o) for o in won_opps)
    lost_value = sum(get_opp_value(o) for o in lost_opps)
    
    win_rate = (len(won_opps) / (len(won_opps) + len(lost_opps)) * 100) if (len(won_opps) + len(lost_opps)) > 0 else 0
    
    avg_deal_size = won_value / len(won_opps) if won_opps else 0
    
    # Stage distribution - with proper lost detection
    stage_counts = defaultdict(int)
    stage_values = defaultdict(float)
    for opp in opps:
        active = opp.get("active", True)
        if active == 'False' or active is False:
            active = False
        else:
            active = True
        lost_reason = opp.get("lost_reason_id") or opp.get("lost_reason")
        stage = normalize_stage(opp.get("stage", ""), active=active, lost_reason_id=lost_reason)
        stage_counts[stage] += 1
        stage_values[stage] += get_opp_value(opp)
    
    # Get unique sales reps in filtered data
    unique_reps = len(set(o.get("owner_name") for o in opps if o.get("owner_name")))
    
    return {
        "summary": {
            "total_pipeline": total_pipeline,
            "total_opportunities": len(opps),
            "won_count": len(won_opps),
            "won_value": won_value,
            "lost_count": len(lost_opps),
            "lost_value": lost_value,
            "win_rate": round(win_rate, 1),
            "avg_deal_size": round(avg_deal_size, 2),
            "total_accounts": len(accounts),
            "total_sales_reps": unique_reps,
            "filtered": any(v for v in filters.values())
        },
        "funnel": {
            "lead": {"count": stage_counts["lead"], "value": stage_values["lead"]},
            "qualified": {"count": stage_counts["qualified"], "value": stage_values["qualified"]},
            "proposal": {"count": stage_counts["proposal"], "value": stage_values["proposal"]},
            "negotiation": {"count": stage_counts["negotiation"], "value": stage_values["negotiation"]},
            "won": {"count": stage_counts["won"], "value": stage_values["won"]},
            "lost": {"count": stage_counts["lost"], "value": stage_values["lost"]}
        },
        "applied_filters": {k: v for k, v in filters.items() if v}
    }


@router.get("/conversion-funnel")
async def get_conversion_funnel(
    request: Request,
    year: Optional[str] = None,
    quarter: Optional[str] = None,
    sales_rep: Optional[str] = None,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed conversion funnel analysis - OPPORTUNITIES ONLY (RBAC enforced)"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Check if user has NO_ACCESS
    if has_no_rbac_access(rbac_filter):
        return {
            "stages": [], "funnel": [], "overall_conversion_rate": 0,
            "overall_conversion": 0, "lost_count": 0, "lost_value": 0, "applied_filters": {}
        }
    
    # Build query with RBAC - include ALL records, filter by year at DB level
    query = {"org_id": org_id, "deleted": {"$ne": True}, "active": True}
    query.update(rbac_filter)
    
    # Add year filter to DB query
    if year:
        query["date_last_stage_update"] = {"$regex": f"^{year}"}
    
    # Get all opportunities (include leads for proper funnel analysis)
    all_opps = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Apply filters
    filters = {"year": year, "quarter": quarter, "sales_rep": sales_rep, "team_id": team_id}
    opps = apply_filters(all_opps, filters)
    
    # Stage mapping for funnel
    funnel_stages = ["lead", "qualified", "proposal", "negotiation", "won"]
    
    stage_data = defaultdict(lambda: {"count": 0, "value": 0})
    
    for opp in opps:
        stage = normalize_stage(opp.get("stage", ""))
        stage_data[stage]["count"] += 1
        stage_data[stage]["value"] += get_opp_value(opp)
    
    # Calculate conversion rates - each stage as % of total opportunities
    funnel = []
    total_opps = sum(stage_data[s]["count"] for s in funnel_stages)
    prev_count = None
    for i, stage in enumerate(funnel_stages):
        data = stage_data[stage]
        
        # Funnel rate = this stage / total (what % of all opps reach this stage)
        funnel_rate = round(data["count"] / total_opps * 100, 1) if total_opps > 0 else 0
        
        # Stage-to-stage rate
        stage_rate = 0
        if prev_count and prev_count > 0 and i > 0:
            stage_rate = round(data["count"] / prev_count * 100, 1)
        
        funnel.append({
            "stage": stage.title(),
            "count": data["count"],
            "value": data["value"],
            "conversion_rate": funnel_rate,
            "stage_conversion_rate": stage_rate
        })
        if data["count"] > 0:
            prev_count = data["count"]
    
    # Overall conversion: Win Rate = Won / (Won + Lost) - standard B2B metric
    won_count = stage_data["won"]["count"]
    lost_count = stage_data["lost"]["count"]
    closed_total = won_count + lost_count
    overall_conversion = round(won_count / closed_total * 100, 1) if closed_total > 0 else 0
    
    return {
        "stages": funnel,  # Renamed from 'funnel' to 'stages' for frontend compatibility
        "funnel": funnel,  # Keep both for backward compatibility
        "overall_conversion_rate": overall_conversion,
        "overall_conversion": overall_conversion,  # Keep both naming conventions
        "lost_count": stage_data.get("lost", {}).get("count", 0),
        "lost_value": stage_data.get("lost", {}).get("value", 0),
        "applied_filters": {k: v for k, v in filters.items() if v}
    }


@router.get("/rep-performance")
async def get_rep_performance(
    request: Request,
    year: Optional[str] = None,
    quarter: Optional[str] = None,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get sales rep performance metrics - OPPORTUNITIES ONLY (RBAC enforced)"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Check if user has NO_ACCESS
    if has_no_rbac_access(rbac_filter):
        return {"reps": [], "top_performer": None, "avg_win_rate": 0, "applied_filters": {}}
    
    # Build query with RBAC
    query = {"org_id": org_id, "type": "opportunity", "deleted": {"$ne": True}, "active": True}
    query.update(rbac_filter)
    
    # Apply year filter at DB level (using date_last_stage_update like Odoo)
    if year:
        query["date_last_stage_update"] = {"$regex": f"^{year}"}
    
    # Get opportunities only (not leads)
    all_opps = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Apply filters
    filters = {"year": year, "quarter": quarter, "team_id": team_id}
    opps = apply_filters(all_opps, filters)
    
    # Group by owner
    rep_data = defaultdict(lambda: {
        "total_opps": 0,
        "total_value": 0,
        "won_count": 0,
        "won_value": 0,
        "lost_count": 0,
        "pipeline_value": 0
    })
    
    for opp in opps:
        owner = opp.get("owner_name") or "Unassigned"
        stage = normalize_stage(opp.get("stage", ""))
        value = get_opp_value(opp)  # Use sale_value
        
        rep_data[owner]["total_opps"] += 1
        rep_data[owner]["total_value"] += value
        
        if stage == "won":
            rep_data[owner]["won_count"] += 1
            rep_data[owner]["won_value"] += value
        elif stage == "lost":
            rep_data[owner]["lost_count"] += 1
        else:
            rep_data[owner]["pipeline_value"] += value
    
    # Calculate metrics and rank
    performance = []
    for rep_name, data in rep_data.items():
        closed = data["won_count"] + data["lost_count"]
        win_rate = round(data["won_count"] / closed * 100, 1) if closed > 0 else 0
        avg_deal = round(data["won_value"] / data["won_count"], 2) if data["won_count"] > 0 else 0
        
        performance.append({
            "name": rep_name,
            "total_opportunities": data["total_opps"],
            "total_value": data["total_value"],
            "won_count": data["won_count"],
            "won_value": data["won_value"],
            "lost_count": data["lost_count"],
            "pipeline_value": data["pipeline_value"],
            "win_rate": win_rate,
            "avg_deal_size": avg_deal
        })
    
    # Sort by won value
    performance.sort(key=lambda x: x["won_value"], reverse=True)
    
    return {
        "reps": performance,
        "total_reps": len(performance),
        "top_performer": performance[0]["name"] if performance else None,
        "avg_win_rate": round(sum(p["win_rate"] for p in performance) / len(performance), 1) if performance else 0,
        "applied_filters": {k: v for k, v in filters.items() if v}
    }


@router.get("/team-performance")
async def get_team_performance(
    request: Request,
    year: Optional[str] = None,
    quarter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get Product Manager and Category performance metrics - OPPORTUNITIES ONLY (RBAC enforced)
    
    This shows performance by Product Manager and Solution Category rather than
    sales teams, as it provides more value for the business.
    """
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Check if user has NO_ACCESS
    if has_no_rbac_access(rbac_filter):
        return {
            "product_managers": [], "categories": [],
            "top_pm": None, "top_category": None, "applied_filters": {}
        }
    
    # Build query with RBAC + year filter at DB level
    query = {"org_id": org_id, "type": "opportunity", "deleted": {"$ne": True}, "active": True}
    query.update(rbac_filter)
    if year:
        query["date_last_stage_update"] = {"$regex": f"^{year}"}
    elif not quarter:
        # Default to current year
        from datetime import datetime
        query["date_last_stage_update"] = {"$regex": f"^{datetime.now().year}"}
    
    all_opps = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Apply filters
    filters = {"year": year, "quarter": quarter}
    opps = apply_filters(all_opps, filters)
    
    # Group by Product Manager
    pm_data = defaultdict(lambda: {
        "total_opps": 0,
        "total_value": 0,
        "won_count": 0,
        "won_value": 0,
        "categories": set()
    })
    
    # Group by Solution Category
    cat_data = defaultdict(lambda: {
        "total_opps": 0,
        "total_value": 0,
        "won_count": 0,
        "won_value": 0,
        "product_managers": set()
    })
    
    for opp in opps:
        pm_name = opp.get("product_manager") or "Unassigned"
        cat_name = opp.get("solution_category") or "Uncategorized"
        stage = normalize_stage(opp.get("stage", ""))
        value = get_opp_value(opp)
        
        # Product Manager metrics
        pm_data[pm_name]["total_opps"] += 1
        pm_data[pm_name]["total_value"] += value
        pm_data[pm_name]["categories"].add(cat_name)
        
        if stage == "won":
            pm_data[pm_name]["won_count"] += 1
            pm_data[pm_name]["won_value"] += value
        
        # Category metrics
        cat_data[cat_name]["total_opps"] += 1
        cat_data[cat_name]["total_value"] += value
        cat_data[cat_name]["product_managers"].add(pm_name)
        
        if stage == "won":
            cat_data[cat_name]["won_count"] += 1
            cat_data[cat_name]["won_value"] += value
    
    # Build Product Manager performance
    pm_performance = []
    for pm_name, data in pm_data.items():
        closed = data["won_count"] + sum(1 for o in opps if normalize_stage(o.get("stage", "")) == "lost" and o.get("product_manager") == pm_name)
        win_rate = round(data["won_count"] / closed * 100, 1) if closed > 0 else 0
        
        pm_performance.append({
            "name": pm_name,
            "type": "product_manager",
            "total_opportunities": data["total_opps"],
            "total_value": data["total_value"],
            "won_count": data["won_count"],
            "won_value": data["won_value"],
            "categories_count": len(data["categories"]),
            "win_rate": win_rate
        })
    
    pm_performance.sort(key=lambda x: x["won_value"], reverse=True)
    
    # Build Category performance
    cat_performance = []
    for cat_name, data in cat_data.items():
        closed = data["won_count"] + sum(1 for o in opps if normalize_stage(o.get("stage", "")) == "lost" and o.get("solution_category") == cat_name)
        win_rate = round(data["won_count"] / closed * 100, 1) if closed > 0 else 0
        
        cat_performance.append({
            "name": cat_name,
            "type": "category",
            "total_opportunities": data["total_opps"],
            "total_value": data["total_value"],
            "won_count": data["won_count"],
            "won_value": data["won_value"],
            "product_managers_count": len(data["product_managers"]),
            "win_rate": win_rate
        })
    
    cat_performance.sort(key=lambda x: x["won_value"], reverse=True)
    
    return {
        "product_managers": pm_performance,
        "categories": cat_performance,
        "total_product_managers": len(pm_performance),
        "total_categories": len(cat_performance),
        "applied_filters": {k: v for k, v in filters.items() if v}
    }


@router.get("/account-health")
async def get_account_health(
    request: Request,
    year: Optional[str] = None,
    quarter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get account health metrics and engagement scores - OPPORTUNITIES ONLY (RBAC enforced)"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Check if user has NO_ACCESS
    if has_no_rbac_access(rbac_filter):
        return {
            "accounts": [], "summary": {"healthy": 0, "at_risk": 0, "dormant": 0},
            "applied_filters": {}
        }
    
    # Build query with RBAC + year filter
    query = {"org_id": org_id, "type": "opportunity", "deleted": {"$ne": True}, "active": True}
    query.update(rbac_filter)
    if year:
        query["date_last_stage_update"] = {"$regex": f"^{year}"}
    elif not quarter:
        from datetime import datetime
        query["date_last_stage_update"] = {"$regex": f"^{datetime.now().year}"}
    
    account_query = {"org_id": org_id, "deleted": {"$ne": True}}
    account_query.update(rbac_filter)
    
    accounts = await canonical_db.accounts.find(account_query).to_list(10000)
    all_opps = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Activities also need RBAC
    activity_query = {
        "org_id": org_id,
        "$or": [
            {"res_model": "crm.lead"},
            {"opportunity_id": {"$exists": True, "$ne": None}}
        ]
    }
    if "owner_name" in rbac_filter:
        activity_query["assigned_user"] = rbac_filter["owner_name"]
    activities = await canonical_db.activities.find(activity_query).to_list(10000)
    
    # Apply filters
    filters = {"year": year, "quarter": quarter}
    opps = apply_filters(all_opps, filters)
    
    # Group opportunities by account
    account_opps = defaultdict(list)
    for opp in opps:
        account_name = opp.get("account_name")
        if account_name:
            account_opps[account_name].append(opp)
    
    # Calculate health scores
    account_health = []
    for account in accounts:
        name = account.get("name")
        opps_list = account_opps.get(name, [])
        
        # Calculate metrics
        total_value = sum(o.get("amount", 0) or 0 for o in opps_list)
        won_value = sum(o.get("amount", 0) or 0 for o in opps_list if normalize_stage(o.get("stage", "")) == "won")
        active_opps = len([o for o in opps_list if normalize_stage(o.get("stage", "")) not in ["won", "lost"]])
        
        # Simple engagement score (0-100)
        engagement = min(100, len(opps_list) * 10 + (won_value / 10000))
        
        account_health.append({
            "id": account.get("canonical_id"),
            "name": name,
            "total_opportunities": len(opps_list),
            "active_opportunities": active_opps,
            "total_value": total_value,
            "won_value": won_value,
            "engagement_score": round(engagement, 0),
            "status": "healthy" if engagement >= 50 else "at_risk" if engagement >= 20 else "dormant"
        })
    
    # Sort by engagement
    account_health.sort(key=lambda x: x["engagement_score"], reverse=True)
    
    # Summary stats
    healthy = len([a for a in account_health if a["status"] == "healthy"])
    at_risk = len([a for a in account_health if a["status"] == "at_risk"])
    dormant = len([a for a in account_health if a["status"] == "dormant"])
    
    return {
        "accounts": account_health[:50],  # Top 50
        "summary": {
            "total_accounts": len(account_health),
            "healthy": healthy,
            "at_risk": at_risk,
            "dormant": dormant
        }
    }


@router.post("/ai-insights")
async def get_ai_insights(
    current_user: dict = Depends(get_current_user)
):
    """Get AI-generated insights based on sales data"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Gather data for analysis
    opps = await canonical_db.opportunities.find({"org_id": org_id}).to_list(10000)
    
    # Prepare summary data for AI - use sale_value and proper lost detection
    total_pipeline = sum(get_opp_value(o) for o in opps)
    
    # Proper Won/Lost classification
    def is_won(o):
        stage = o.get("stage", "").lower()
        return stage == "won" or "closed won" in stage
    
    def is_lost(o):
        active = o.get("active", True)
        if active == 'False' or active is False:
            return bool(o.get("lost_reason_id") or o.get("lost_reason"))
        return False
    
    won_opps = [o for o in opps if is_won(o)]
    lost_opps = [o for o in opps if is_lost(o)]
    
    # Stage distribution - with proper lost detection
    stage_counts = defaultdict(int)
    for opp in opps:
        active = opp.get("active", True)
        if active == 'False' or active is False:
            active = False
        else:
            active = True
        lost_reason = opp.get("lost_reason_id") or opp.get("lost_reason")
        stage = normalize_stage(opp.get("stage", ""), active=active, lost_reason_id=lost_reason)
        stage_counts[stage] += 1
    
    # Rep performance - by won deals
    rep_won = defaultdict(lambda: {"count": 0, "value": 0})
    for opp in won_opps:
        owner = opp.get("owner_name", "Unknown")
        rep_won[owner]["count"] += 1
        rep_won[owner]["value"] += get_opp_value(opp)
    
    top_reps = sorted(rep_won.items(), key=lambda x: x[1]["value"], reverse=True)[:5]
    
    # Calculate win rate correctly
    closed_total = len(won_opps) + len(lost_opps)
    win_rate = round(len(won_opps) / closed_total * 100, 1) if closed_total > 0 else 0
    
    # Prepare data summary for AI
    won_value = sum(get_opp_value(o) for o in won_opps)
    data_summary = {
        "total_opportunities": len(opps),
        "total_pipeline_value": total_pipeline,
        "won_deals": len(won_opps),
        "won_value": won_value,
        "lost_deals": len(lost_opps),
        "win_rate": win_rate,
        "stage_distribution": dict(stage_counts),
        "top_performers": [{"name": name, "won_count": data["count"], "won_value": data["value"]} for name, data in top_reps],
        "avg_deal_size": round(won_value / len(won_opps), 2) if won_opps else 0
    }
    
    # Try to get AI insights
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        load_dotenv()
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"sales-insights-{org_id}-{datetime.now().strftime('%Y%m%d')}",
            system_message="""You are an expert sales analyst AI. Analyze the provided sales data and generate actionable insights.
            
Focus on:
1. Key performance highlights (what's working well)
2. Areas of concern or risk (what needs attention)
3. Specific recommendations for improvement
4. Trends or patterns in the data

Keep insights concise, data-driven, and actionable. Use bullet points. Do not include generic advice - be specific to the data provided."""
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Analyze this CRM sales data for a software/IT services company in Oman and provide specific business insights:

SALES DATA SUMMARY:
- Total Opportunities: {data_summary['total_opportunities']}
- Total Pipeline Value: OMR {data_summary['total_pipeline_value']:,.2f}
- Won Deals: {data_summary['won_deals']} (Value: OMR {data_summary['won_value']:,.2f})
- Lost Deals: {data_summary['lost_deals']}
- Win Rate: {data_summary['win_rate']}%
- Average Deal Size: OMR {data_summary['avg_deal_size']:,.2f}

PIPELINE STAGE DISTRIBUTION:
{json.dumps(data_summary['stage_distribution'], indent=2)}

TOP PERFORMERS (by Won Revenue):
{json.dumps(data_summary['top_performers'], indent=2)}

Based on this data, provide:
1. **Performance Analysis**: Key metrics analysis (is this win rate good? Is pipeline healthy?)
2. **Risk Areas**: Identify bottlenecks or concerns (e.g., stage with too many deals stuck)
3. **Sales Team Insights**: Analysis of top performers and recommendations for others
4. **Revenue Optimization**: Specific recommendations to improve conversion and revenue
5. **Action Items**: 3 concrete next steps the sales team should take

Be specific to the numbers provided. Include specific OMR values and percentages where relevant."""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {
            "insights": response,
            "data_summary": data_summary,
            "generated_at": now_utc().isoformat(),
            "ai_model": "gpt-5.2"
        }
        
    except ImportError:
        logger.warning("emergentintegrations not available, returning static insights")
        return {
            "insights": generate_static_insights(data_summary),
            "data_summary": data_summary,
            "generated_at": now_utc().isoformat(),
            "ai_model": "static"
        }
    except Exception as e:
        logger.error(f"AI insights generation failed: {e}")
        return {
            "insights": generate_static_insights(data_summary),
            "data_summary": data_summary,
            "generated_at": now_utc().isoformat(),
            "ai_model": "static",
            "error": str(e)
        }


def generate_static_insights(data: dict) -> str:
    """Generate static insights when AI is not available"""
    insights = []
    
    # Win rate insight
    win_rate = data.get("win_rate", 0)
    if win_rate > 60:
        insights.append(f"• **Strong Win Rate**: Your {win_rate}% win rate is above industry average. Continue leveraging current strategies.")
    elif win_rate > 40:
        insights.append(f"• **Moderate Win Rate**: {win_rate}% win rate indicates room for improvement. Focus on qualification criteria.")
    else:
        insights.append(f"• **Win Rate Concern**: {win_rate}% win rate needs attention. Review lost deal patterns for improvement areas.")
    
    # Pipeline insight
    pipeline = data.get("total_pipeline_value", 0)
    won_value = data.get("won_value", 0)
    if pipeline > won_value * 3:
        insights.append(f"• **Healthy Pipeline**: Pipeline of OMR {pipeline:,.0f} provides good coverage for future quarters.")
    
    # Stage distribution insight
    stages = data.get("stage_distribution", {})
    lead_count = stages.get("lead", 0)
    qualified_count = stages.get("qualified", 0)
    if lead_count > qualified_count * 3:
        insights.append(f"• **Qualification Bottleneck**: {lead_count} leads vs {qualified_count} qualified suggests qualification process needs attention.")
    
    # Top performers
    top = data.get("top_performers", [])
    if top:
        insights.append(f"• **Top Performer**: {top[0]['name']} leads with {top[0]['won_count']} closed deals. Consider peer mentoring programs.")
    
    return "\n\n".join(insights)


@router.get("/filters")
async def get_available_filters(
    current_user: dict = Depends(get_current_user)
):
    """Get available filter options for analytics"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get unique values for filters
    opps = await canonical_db.opportunities.find({"org_id": org_id}).to_list(10000)
    accounts = await canonical_db.accounts.find({"org_id": org_id}).to_list(10000)
    sales_users = await canonical_db.sales_users.find({"org_id": org_id}).to_list(1000)
    teams = await canonical_db.sales_teams.find({"org_id": org_id}).to_list(100)
    
    # Get unique stages
    stages = list(set(o.get("stage") for o in opps if o.get("stage") and isinstance(o.get("stage"), str)))
    
    # Get unique owners from opportunities (not from sales_users)
    owners = list(set(o.get("owner_name") for o in opps if o.get("owner_name")))
    
    # Get unique account names from opportunities (not from accounts collection)
    # Build a dict to preserve account_id -> account_name mapping
    account_map = {}
    for o in opps:
        acc_name = o.get("account_name")
        acc_id = o.get("account_id")
        if acc_name and acc_name != 'None' and acc_id:
            account_map[str(acc_id)] = acc_name
    
    # Convert to list of objects for the frontend
    opp_accounts = [{"id": aid, "name": aname} for aid, aname in account_map.items()]
    
    # Get years from date_last_stage_update (standard across system)
    # Cap at current year - no future years
    from datetime import datetime
    current_year = int(datetime.now().strftime("%Y"))
    years = set()
    for opp in opps:
        for date_field in ["date_last_stage_update", "create_date"]:
            date_val = opp.get(date_field)
            if date_val and date_val != 'False' and isinstance(date_val, str) and len(date_val) >= 4:
                try:
                    year = date_val[:4]
                    if year.isdigit() and 2018 <= int(year) <= current_year:
                        years.add(year)
                except:
                    pass
    
    # Filter sales_reps to active employees/sales_users
    active_names = set()
    # From employees (active only)
    async for emp in canonical_db.employees.find({"active": True}, {"_id": 0, "name": 1}):
        if emp.get("name"):
            active_names.add(emp["name"])
    # From sales_users (active only, exclude system accounts)
    system_names = {"securado erp", "administrator", "admin", "odoobot"}
    async for su in canonical_db.sales_users.find({"active": True}, {"_id": 0, "name": 1}):
        name = su.get("name", "")
        if name and name.lower() not in system_names and not name.endswith("_odoo"):
            active_names.add(name)
    
    # Match owners against active names using word matching
    active_owners = []
    for owner in owners:
        if owner.lower() in system_names or owner.endswith("_odoo"):
            continue
        # Direct match
        if owner in active_names:
            active_owners.append(owner)
            continue
        # Fuzzy: at least 2 name words match any active name
        owner_words = set(owner.lower().replace("-", " ").replace(".", " ").split())
        for active_name in active_names:
            active_words = set(active_name.lower().replace("-", " ").replace(".", " ").split())
            if len(owner_words & active_words) >= 2:
                active_owners.append(owner)
                break
    
    return {
        "time_periods": [
            {"value": "week", "label": "This Week"},
            {"value": "month", "label": "This Month"},
            {"value": "quarter", "label": "This Quarter"},
            {"value": "year", "label": "This Year"},
            {"value": "all", "label": "All Time"}
        ],
        "years": sorted(list(years), reverse=True),
        "quarters": ["Q1", "Q2", "Q3", "Q4"],
        "stages": sorted(stages),
        "sales_reps": sorted(active_owners) if active_owners else sorted(owners),
        "teams": [{"id": str(t.get("source_record_id")), "name": t.get("name")} for t in teams if t.get("name")],
        "accounts": sorted(opp_accounts, key=lambda x: x["name"])
    }


def apply_filters(opps: list, filters: dict) -> list:
    """Apply filter parameters to opportunity list.
    NOTE: Year/quarter filtering is now done at DB query level (create_date).
    This function only handles remaining filters (sales_rep, account, stage).
    """
    filtered = opps
    
    # Year and quarter are now filtered at MongoDB query level
    # No post-filtering needed for dates
    
    # Filter by sales rep
    if filters.get("sales_rep"):
        rep = filters["sales_rep"]
        filtered = [o for o in filtered if o.get("owner_name") == rep]
    
    # Filter by team
    if filters.get("team_id"):
        team_id = filters["team_id"]
        filtered = [o for o in filtered if str(o.get("team_id")) == str(team_id)]
    
    # Filter by account
    if filters.get("account"):
        account = filters["account"]
        filtered = [o for o in filtered if o.get("account_name") == account]
    
    # Filter by stage
    if filters.get("stage"):
        stage = filters["stage"]
        filtered = [o for o in filtered if o.get("stage") == stage]
    
    return filtered
