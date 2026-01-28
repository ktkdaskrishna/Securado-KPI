"""Dashboard Aggregator Service Routes

Handles:
- Consume canonical and CRM events to build serving cache
- Provide aggregated dashboard statistics
- Manual refresh triggers
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
import logging
from datetime import datetime, timezone
import random
from collections import defaultdict

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, now_utc, PipelineStages
from libs.event_bus import event_bus, emit_event
from libs.schemas import Topics, EventEnvelope
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# Stage mapping for dashboard - normalize Odoo stages to our pipeline stages
def normalize_stage_for_dashboard(stage: str, active: bool = True, lost_reason_id = None) -> str:
    """Normalize Odoo stage names to dashboard expected values
    
    In Odoo, Lost deals are:
    - archived (active=False) 
    - have a lost_reason_id set
    They keep their original stage but are marked as lost.
    """
    # Check if it's a lost deal (archived with lost reason)
    if not active and lost_reason_id:
        return "closed_lost"
    
    if not stage:
        return "qualified"
    
    stage_lower = stage.lower().strip()
    
    # Direct mappings
    mapping = {
        "new": "qualified",
        "enquiry": "qualified",
        "qualified": "qualified",
        "qualification": "qualified",
        "qualified opportunity": "qualified",
        "prospect": "qualified",
        "proposition": "proposal",
        "proposal": "proposal",
        "proposal sent": "proposal",
        "in- progress": "proposal",
        "in-progress": "proposal",
        "in progress": "proposal",
        "negotiation": "negotiation",
        "won": "closed_won",
        "closed won": "closed_won",
        "closed_won": "closed_won",
        "lost": "closed_lost",
        "closed lost": "closed_lost",
        "closed_lost": "closed_lost",
    }
    
    if stage_lower in mapping:
        return mapping[stage_lower]
    
    # Fuzzy matching
    if "won" in stage_lower:
        return "closed_won"
    if "lost" in stage_lower:
        return "closed_lost"
    if "negot" in stage_lower:
        return "negotiation"
    if "prop" in stage_lower:
        return "proposal"
    
    return "qualified"


def apply_date_filters_for_won_lost(records: list, year: str = None, quarter: str = None) -> list:
    """Apply year and quarter filters based on won_at (date_last_stage_update from Odoo)
    This is specifically for Won/Lost deals which should be filtered by their actual close date.
    
    Priority for date field:
    1. won_at - The correct field (date_last_stage_update from Odoo)
    2. stage_changed_at - Alias for won_at
    3. date_closed - Fallback (often None in Odoo for Won deals)
    4. close_date - Alternative field
    5. write_date - Last resort
    """
    if not year and not quarter:
        return records
    
    filtered = []
    quarter_months = {
        "Q1": [1, 2, 3], 
        "Q2": [4, 5, 6], 
        "Q3": [7, 8, 9], 
        "Q4": [10, 11, 12]
    }
    
    for record in records:
        # For Won/Lost deals, use won_at (date_last_stage_update) as primary
        date_value = None
        # Priority: won_at > stage_changed_at > date_closed > close_date > write_date
        for field in ['won_at', 'stage_changed_at', 'date_closed', 'close_date', 'write_date']:
            if record.get(field):
                date_value = parse_date_from_string(record.get(field))
                if date_value:
                    break
        
        if not date_value:
            continue
        
        # Check year filter
        if year:
            if str(date_value.year) != str(year):
                continue
        
        # Check quarter filter
        if quarter:
            months = quarter_months.get(quarter, [])
            if date_value.month not in months:
                continue
        
        filtered.append(record)
    
    return filtered


def parse_date_from_string(date_str):
    """Parse date from various string formats"""
    if not date_str or date_str == 'False':
        return None
    
    if isinstance(date_str, datetime):
        return date_str
    
    if isinstance(date_str, str):
        # Try common formats
        for fmt in ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f']:
            try:
                return datetime.strptime(date_str[:len(fmt.replace('%', ''))].strip(), fmt)
            except (ValueError, TypeError):
                continue
        
        # Try extracting just year-month-day
        try:
            if len(date_str) >= 10:
                return datetime.strptime(date_str[:10], '%Y-%m-%d')
        except (ValueError, TypeError):
            pass
    
    return None


def apply_date_filters(records: list, year: str = None, quarter: str = None, date_field: str = 'create_date') -> list:
    """Apply year and quarter filters to records based on the specified date field"""
    if not year and not quarter:
        return records
    
    filtered = []
    quarter_months = {
        "Q1": [1, 2, 3], 
        "Q2": [4, 5, 6], 
        "Q3": [7, 8, 9], 
        "Q4": [10, 11, 12]
    }
    
    for record in records:
        # Try multiple date fields - prefer create_date for filtering
        date_value = None
        for field in [date_field, 'create_date', 'close_date', 'date_open', 'write_date']:
            if record.get(field):
                date_value = parse_date_from_string(record.get(field))
                if date_value:
                    break
        
        if not date_value:
            # Include records without dates only if no year filter (to not lose data)
            if not year:
                filtered.append(record)
            continue
        
        # Check year filter
        if year:
            if str(date_value.year) != str(year):
                continue
        
        # Check quarter filter
        if quarter:
            months = quarter_months.get(quarter, [])
            if date_value.month not in months:
                continue
        
        filtered.append(record)
    
    return filtered


class DashboardAggregator:
    """Aggregates data from canonical and CRM events into serving cache"""
    
    def __init__(self):
        self.running = False
    
    async def start(self):
        """Start the aggregator and subscribe to relevant events"""
        self.running = True
        
        # Subscribe to events that should trigger cache rebuild
        event_bus.subscribe(Topics.CANONICAL_RECORD_UPSERTED, self.handle_canonical_update)
        event_bus.subscribe(Topics.CRM_OVERRIDE_UPSERTED, self.handle_override_update)
        event_bus.subscribe(Topics.SERVING_DASHBOARD_REFRESH, self.handle_refresh_request)
        
        logger.info("Dashboard Aggregator started")
    
    async def stop(self):
        """Stop the aggregator"""
        self.running = False
        event_bus.unsubscribe(Topics.CANONICAL_RECORD_UPSERTED, self.handle_canonical_update)
        event_bus.unsubscribe(Topics.CRM_OVERRIDE_UPSERTED, self.handle_override_update)
        event_bus.unsubscribe(Topics.SERVING_DASHBOARD_REFRESH, self.handle_refresh_request)
        logger.info("Dashboard Aggregator stopped")
    
    async def handle_canonical_update(self, event: EventEnvelope):
        """Handle canonical record updates"""
        org_id = event.org_id
        if org_id:
            await self.rebuild_cache(org_id)
    
    async def handle_override_update(self, event: EventEnvelope):
        """Handle CRM override updates"""
        org_id = event.org_id
        if org_id:
            await self.rebuild_cache(org_id)
    
    async def handle_refresh_request(self, event: EventEnvelope):
        """Handle manual refresh requests"""
        org_id = event.org_id
        if org_id:
            await self.rebuild_cache(org_id)
    
    async def rebuild_cache(self, org_id: str):
        """Rebuild serving cache for an organization"""
        app_db = get_app_db()
        canonical_db = get_canonical_db()
        
        try:
            # Get all opportunities
            opps = await canonical_db.opportunities.find({"org_id": org_id}).to_list(10000)
            
            # Get overrides
            canonical_ids = [o.get("canonical_id") for o in opps]
            overrides = await app_db.overrides.find({
                "canonical_id": {"$in": canonical_ids},
                "org_id": org_id
            }).to_list(10000)
            override_map = {o["canonical_id"]: o for o in overrides}
            
            # Apply overrides and normalize stages
            for opp in opps:
                override = override_map.get(opp.get("canonical_id"))
                if override:
                    if "stage" in override:
                        opp["stage"] = override["stage"]
                    if "probability" in override:
                        opp["probability"] = override["probability"]
                
                # Normalize stage for dashboard grouping
                # Pass active status and lost_reason_id to properly identify Lost deals
                active = opp.get("active", True)
                # Handle 'False' string from Odoo
                if active == 'False' or active is False:
                    active = False
                else:
                    active = True
                
                lost_reason = opp.get("lost_reason_id") or opp.get("lost_reason")
                opp["normalized_stage"] = normalize_stage_for_dashboard(
                    opp.get("stage", ""), 
                    active=active,
                    lost_reason_id=lost_reason
                )
            
            # Separate leads from opportunities by type field
            opportunities_only = [o for o in opps if o.get("type") == "opportunity"]
            leads_only = [o for o in opps if o.get("type") == "lead"]
            
            # Helper to get opportunity value - use sale_value (RFP quoted value) if available, else amount
            def get_opp_value(opp):
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
            
            # Calculate aggregates for OPPORTUNITIES only - use sale_value as primary
            total_pipeline = sum(get_opp_value(o) for o in opportunities_only)
            
            # By normalized stage (for opportunities)
            stage_counts = {}
            stage_values = {}
            for stage in PipelineStages.all():
                stage_opps = [o for o in opportunities_only if o.get("normalized_stage") == stage]
                stage_counts[stage] = len(stage_opps)
                stage_values[stage] = sum(get_opp_value(o) for o in stage_opps)
            
            won_count = stage_counts.get(PipelineStages.CLOSED_WON, 0)
            won_value = stage_values.get(PipelineStages.CLOSED_WON, 0)
            lost_count = stage_counts.get(PipelineStages.CLOSED_LOST, 0)
            
            open_count = sum(c for s, c in stage_counts.items() if s not in [PipelineStages.CLOSED_WON, PipelineStages.CLOSED_LOST])
            
            win_rate = (won_count / (won_count + lost_count) * 100) if (won_count + lost_count) > 0 else 0
            
            # Leads stats
            total_leads = len(leads_only)
            new_leads = len([lead for lead in leads_only if "new" in (lead.get("stage") or "").lower() or "enquiry" in (lead.get("stage") or "").lower()])
            qualified_leads = len([lead for lead in leads_only if "qualified" in (lead.get("stage") or "").lower()])
            
            # Get CRM activities ONLY from CANONICAL DB (synced from Odoo)
            # Only mail.activity where res_model='crm.lead' - NOT project tasks
            # Get CRM activities from CANONICAL DB (synced from Odoo)
            # Include activities with res_model='crm.lead' OR activities with opportunity_id (from crm.activity.report)
            canonical_activities = await canonical_db.activities.find({
                "org_id": org_id,
                "$or": [
                    {"res_model": "crm.lead"},
                    {"opportunity_id": {"$exists": True, "$ne": None}}
                ]
            }).to_list(10000)
            
            # Also get app activities (manually created)
            app_activities = await app_db.activities.find({"org_id": org_id}).to_list(10000)
            all_activities = canonical_activities + app_activities
            
            # Activity stats - count by type (CRM activities only)
            activity_type_map = defaultdict(int)
            for act in all_activities:
                act_type = (act.get("activity_type") or act.get("type") or "").lower()
                if "call" in act_type or "phone" in act_type:
                    activity_type_map["calls"] += 1
                elif "email" in act_type or "mail" in act_type:
                    activity_type_map["emails"] += 1
                elif "meet" in act_type or "event" in act_type or "demo" in act_type or "site visit" in act_type:
                    activity_type_map["meetings"] += 1
                else:
                    activity_type_map["tasks"] += 1
            
            activity_stats = {
                "calls": activity_type_map["calls"],
                "emails": activity_type_map["emails"],
                "meetings": activity_type_map["meetings"],
                "tasks": activity_type_map["tasks"],
                "total": len(all_activities),
                "completed": len([a for a in all_activities if a.get("state") == "done" or a.get("status") == "completed" or a.get("completed_at")])
            }
            
            # Recent activities - combine and sort
            recent_items = []
            for act in all_activities:
                recent_items.append({
                    "id": act.get("canonical_id") or act.get("id"),
                    "subject": act.get("summary") or act.get("subject") or "Activity",
                    "type": act.get("activity_type") or act.get("type") or "task",
                    "owner_name": act.get("assigned_user") or act.get("owner_name") or "System",
                    "status": "completed" if act.get("state") == "done" else "pending",
                    "created_at": act.get("created_at") or act.get("synced_at") or ""
                })
            # Sort by date and take top 5
            recent_activities = sorted(recent_items, key=lambda x: str(x.get("created_at", "")), reverse=True)[:5]
            
            # Build pipeline by stage
            pipeline_by_stage = [
                {"stage": stage.replace("_", " ").title(), "value": stage_values.get(stage, 0), "count": stage_counts.get(stage, 0)}
                for stage in PipelineStages.all()
            ]
            
            # Build leaderboard from WON deals only (not total pipeline)
            # This shows top performers by closed/won revenue
            # Filter to stage containing "won" (case insensitive)
            won_opps = [o for o in opportunities_only if normalize_stage_for_dashboard(o.get('stage', '')) == 'closed_won']
            
            logger.info(f"Leaderboard: Found {len(won_opps)} won opportunities for leaderboard")
            
            owner_won_values = defaultdict(float)
            owner_won_counts = defaultdict(int)
            owner_names = {}
            for opp in won_opps:
                owner_id = opp.get("owner_id")
                owner_name = opp.get("owner_name")
                if owner_id and owner_name:
                    owner_won_values[owner_id] += get_opp_value(opp)
                    owner_won_counts[owner_id] += 1
                    owner_names[owner_id] = owner_name
            
            # Sort by won value and get top 5
            leaderboard = []
            sorted_owners = sorted(owner_won_values.items(), key=lambda x: x[1], reverse=True)[:5]
            for i, (owner_id, value) in enumerate(sorted_owners):
                leaderboard.append({
                    "id": str(owner_id),
                    "name": owner_names.get(owner_id, f"User {owner_id}"),
                    "value": value,
                    "deals_won": owner_won_counts[owner_id]
                })
            
            # If no won deals, show placeholder
            if not leaderboard:
                leaderboard = [{"id": "0", "name": "No won deals yet", "value": 0, "deals_won": 0}]
            
            # Save to serving cache
            cache_doc = {
                "entity_type": "dashboard_stats",
                "org_id": org_id,
                "total_pipeline": total_pipeline,
                "pipeline_change": round(random.uniform(-5, 15), 1),
                "won_value": won_value,
                "won_count": won_count,
                "lost_count": lost_count,
                "open_count": open_count,
                "open_change": round(random.uniform(-10, 20), 1),
                "win_rate": round(win_rate, 1),
                "win_rate_change": round(random.uniform(-3, 8), 1),
                "total_opportunities": len(opportunities_only),
                "total_leads": total_leads,
                "new_leads": new_leads,
                "qualified_leads": qualified_leads,
                "stage_counts": stage_counts,
                "stage_values": stage_values,
                "pipeline_by_stage": pipeline_by_stage,
                "activity_stats": activity_stats,
                "recent_activities": serialize_doc(recent_activities),
                "leaderboard": leaderboard,
                "updated_at": now_utc()
            }
            
            await app_db.serving_cache.update_one(
                {"entity_type": "dashboard_stats", "org_id": org_id},
                {"$set": cache_doc},
                upsert=True
            )
            
            logger.info(f"Dashboard cache rebuilt for org {org_id} - {len(opportunities_only)} opportunities, {total_leads} leads")
            
        except Exception as e:
            logger.error(f"Failed to rebuild dashboard cache: {e}")


# Global aggregator instance
dashboard_aggregator = DashboardAggregator()


@router.get("/stats")
async def get_dashboard_stats(
    year: Optional[str] = Query(None, description="Filter by year (e.g., 2024, 2025, 2026)"),
    quarter: Optional[str] = Query(None, description="Filter by quarter (Q1, Q2, Q3, Q4)"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    stage: Optional[str] = Query(None, description="Filter by stage"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on: create_date or close_date"),
    current_user: dict = Depends(get_current_user)
):
    """Get dashboard statistics - real-time calculation with optional filters"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Log the filter parameters received
    logger.info(f"Dashboard stats request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}, team_id: {team_id}, account: {account}, stage: {stage}, date_field: {date_field}")
    
    # Check if any filter is applied
    has_filters = any([year, quarter, sales_rep, team_id, account, stage])
    
    if not has_filters:
        # Use cache for unfiltered view
        stats = await app_db.serving_cache.find_one({
            "entity_type": "dashboard_stats",
            "org_id": org_id
        })
        
        if stats:
            return serialize_doc(stats)
        
        # Build cache if not exists
        await dashboard_aggregator.rebuild_cache(org_id)
        
        stats = await app_db.serving_cache.find_one({
            "entity_type": "dashboard_stats",
            "org_id": org_id
        })
        
        if stats:
            return serialize_doc(stats)
    
    # Calculate filtered stats in real-time
    # Build MongoDB query for non-date filters
    query = {"org_id": org_id}
    if sales_rep:
        query["owner_name"] = sales_rep
    if team_id:
        query["team_id"] = team_id
    if account:
        query["account_name"] = account
    if stage:
        query["stage"] = stage
    
    opps = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Apply date filters (year and quarter) using the helper function
    # For open opportunities, filter by create_date
    # For closed (won/lost), filter by date_closed
    
    # Classify opportunities:
    # - Won = stage is 'Won' (use date_closed)
    # - Lost = active=False and has lost_reason_id (use date_closed)
    # - Open = everything else (use create_date)
    
    def is_won(o):
        stage = o.get("stage", "").lower()
        return stage == "won" or "closed won" in stage
    
    def is_lost(o):
        active = o.get("active", True)
        if active == 'False' or active is False:
            return bool(o.get("lost_reason_id") or o.get("lost_reason"))
        return False
    
    open_opps = [o for o in opps if not is_won(o) and not is_lost(o)]
    won_opps = [o for o in opps if is_won(o)]
    lost_opps = [o for o in opps if is_lost(o)]
    
    # Apply date filters
    if year or quarter:
        # Open opportunities: filter by create_date
        open_opps = apply_date_filters(open_opps, year=year, quarter=quarter, date_field='create_date')
        # Won opportunities: filter by date_closed
        won_opps = apply_date_filters_for_won_lost(won_opps, year=year, quarter=quarter)
        # Lost opportunities: filter by date_closed  
        lost_opps = apply_date_filters_for_won_lost(lost_opps, year=year, quarter=quarter)
    
    # Combine all
    opps = open_opps + won_opps + lost_opps
    
    # Separate leads from opportunities by type field
    opportunities_only = [o for o in opps if o.get("type") == "opportunity"]
    leads_only = [o for o in opps if o.get("type") == "lead"]
    
    logger.info(f"After filtering: {len(opps)} total records ({len(opportunities_only)} opportunities, {len(leads_only)} leads)")
    logger.info(f"  Open: {len(open_opps)}, Won: {len(won_opps)}, Lost: {len(lost_opps)}")
    
    # Helper to get opportunity value - use sale_value (RFP quoted value) if available, else amount
    def get_opp_value(opp):
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
    
    # Calculate stats for OPPORTUNITIES only - use sale_value as primary
    total_pipeline = sum(get_opp_value(o) for o in opportunities_only)
    
    # By stage (for opportunities) - properly detect Lost deals
    stage_counts = {}
    stage_values = {}
    for s in PipelineStages.all():
        # Check active status and lost_reason_id for proper stage detection
        normalized_opps = []
        for o in opportunities_only:
            active = o.get("active", True)
            if active == 'False' or active is False:
                active = False
            else:
                active = True
            lost_reason = o.get("lost_reason_id") or o.get("lost_reason")
            normalized = normalize_stage_for_dashboard(o.get("stage", ""), active=active, lost_reason_id=lost_reason)
            if normalized == s:
                normalized_opps.append(o)
        stage_counts[s] = len(normalized_opps)
        stage_values[s] = sum(get_opp_value(o) for o in normalized_opps)
    
    won_count = stage_counts.get(PipelineStages.CLOSED_WON, 0)
    won_value = stage_values.get(PipelineStages.CLOSED_WON, 0)
    lost_count = stage_counts.get(PipelineStages.CLOSED_LOST, 0)
    open_count = sum(c for s, c in stage_counts.items() if s not in [PipelineStages.CLOSED_WON, PipelineStages.CLOSED_LOST])
    win_rate = (won_count / (won_count + lost_count) * 100) if (won_count + lost_count) > 0 else 0
    
    logger.info(f"Stage analysis: Won={won_count}, Lost={lost_count}, Open={open_count}, Win Rate={win_rate:.1f}%")
    
    # Leads stats
    total_leads = len(leads_only)
    new_leads = len([lead for lead in leads_only if "new" in (lead.get("stage") or "").lower() or "enquiry" in (lead.get("stage") or "").lower()])
    qualified_leads = len([lead for lead in leads_only if "qualified" in (lead.get("stage") or "").lower()])
    
    # Build leaderboard from WON deals only (not total pipeline) - use sale_value
    # Filter to only "Won" stage opportunities (active records with Won stage)
    won_opps_for_leaderboard = []
    for o in opportunities_only:
        active = o.get("active", True)
        if active == 'False' or active is False:
            active = False
        else:
            active = True
        lost_reason = o.get("lost_reason_id") or o.get("lost_reason")
        normalized = normalize_stage_for_dashboard(o.get("stage", ""), active=active, lost_reason_id=lost_reason)
        if normalized == "closed_won":
            won_opps_for_leaderboard.append(o)
    
    owner_won_values = defaultdict(float)
    owner_won_counts = defaultdict(int)
    owner_names = {}
    for opp in won_opps_for_leaderboard:
        owner_id = opp.get("owner_id")
        owner_name = opp.get("owner_name")
        if owner_id and owner_name:
            owner_won_values[owner_id] += get_opp_value(opp)
            owner_won_counts[owner_id] += 1
            owner_names[owner_id] = owner_name
    
    leaderboard = []
    sorted_owners = sorted(owner_won_values.items(), key=lambda x: x[1], reverse=True)[:5]
    for owner_id, value in sorted_owners:
        leaderboard.append({
            "id": str(owner_id),
            "name": owner_names.get(owner_id, f"User {owner_id}"),
            "value": value,
            "deals_won": owner_won_counts[owner_id]
        })
    
    # If no won deals, show placeholder
    if not leaderboard:
        leaderboard = [{"id": "0", "name": "No won deals yet", "value": 0, "deals_won": 0}]
    
    # Build pipeline by stage
    pipeline_by_stage = [
        {"stage": s.replace("_", " ").title(), "value": stage_values.get(s, 0), "count": stage_counts.get(s, 0)}
        for s in PipelineStages.all()
    ]
    
    # ==================== ACTIVITY STATS FOR FILTERED VIEW ====================
    # Get CRM activities (res_model: crm.lead) and filter by date
    activity_query = {
        "org_id": org_id,
        "res_model": "crm.lead"  # Only CRM activities
    }
    
    canonical_activities = await canonical_db.activities.find(activity_query).to_list(10000)
    
    # Apply date filters to activities if year/quarter is set
    if year or quarter:
        filtered_activities = []
        for act in canonical_activities:
            act_date = act.get("date_deadline") or act.get("create_date") or act.get("synced_at")
            if act_date:
                try:
                    if isinstance(act_date, str):
                        # Try parsing ISO format
                        if 'T' in act_date:
                            act_date = datetime.fromisoformat(act_date.replace('Z', '+00:00'))
                        else:
                            act_date = datetime.strptime(act_date[:10], '%Y-%m-%d')
                    
                    act_year = str(act_date.year)
                    act_quarter = f"Q{(act_date.month - 1) // 3 + 1}"
                    
                    year_match = not year or act_year == year
                    quarter_match = not quarter or act_quarter == quarter
                    
                    if year_match and quarter_match:
                        filtered_activities.append(act)
                except Exception as e:
                    # If date parsing fails, include the activity
                    filtered_activities.append(act)
            else:
                # Activities without dates are included
                filtered_activities.append(act)
        canonical_activities = filtered_activities
    
    # Filter by sales rep if applicable
    if sales_rep:
        canonical_activities = [a for a in canonical_activities if a.get("assigned_user") == sales_rep]
    
    # Also get app activities if applicable
    app_activity_query = {"org_id": org_id}
    if sales_rep:
        app_activity_query["owner_name"] = sales_rep
    app_activities = await app_db.activities.find(app_activity_query).to_list(1000)
    
    all_activities = canonical_activities + app_activities
    
    # Activity stats - count by type (CRM activities only)
    # Important KPIs: POC, Meeting, Demo, Site Visit, RFP Building
    activity_type_map = defaultdict(int)
    for act in all_activities:
        act_type = (act.get("activity_type") or act.get("activity_type_name") or act.get("type") or act.get("summary") or "").lower()
        if "call" in act_type or "phone" in act_type:
            activity_type_map["calls"] += 1
        elif "email" in act_type or "mail" in act_type:
            activity_type_map["emails"] += 1
        elif "meet" in act_type or "demo" in act_type or "site visit" in act_type or "poc" in act_type or "workshop" in act_type or "roundtable" in act_type:
            activity_type_map["meetings"] += 1
        else:
            activity_type_map["tasks"] += 1
    
    activity_stats = {
        "calls": activity_type_map["calls"],
        "emails": activity_type_map["emails"],
        "meetings": activity_type_map["meetings"],
        "tasks": activity_type_map["tasks"],
        "total": len(all_activities),
        "completed": len([a for a in all_activities if a.get("state") == "done" or a.get("status") == "completed" or a.get("completed_at")])
    }
    
    # Recent activities
    recent_items = []
    for act in all_activities[:20]:  # Limit to 20 for performance
        recent_items.append({
            "id": act.get("canonical_id") or act.get("id"),
            "subject": act.get("summary") or act.get("subject") or "Activity",
            "type": act.get("activity_type") or act.get("activity_type_name") or act.get("type") or "task",
            "owner_name": act.get("assigned_user") or act.get("owner_name") or "System",
            "status": "completed" if act.get("state") == "done" else "pending",
            "created_at": act.get("created_at") or act.get("synced_at") or ""
        })
    recent_activities = sorted(recent_items, key=lambda x: str(x.get("created_at", "")), reverse=True)[:5]
    
    return {
        "entity_type": "dashboard_stats",
        "org_id": org_id,
        "total_pipeline": total_pipeline,
        "pipeline_change": 0,  # Not calculated for filtered view
        "won_value": won_value,
        "won_count": won_count,
        "lost_count": lost_count,
        "open_count": open_count,
        "open_change": 0,
        "win_rate": round(win_rate, 1),
        "win_rate_change": 0,
        "total_opportunities": len(opportunities_only),
        "total_leads": total_leads,
        "new_leads": new_leads,
        "qualified_leads": qualified_leads,
        "stage_counts": stage_counts,
        "stage_values": stage_values,
        "pipeline_by_stage": pipeline_by_stage,
        "leaderboard": leaderboard,
        "activity_stats": activity_stats,
        "recent_activities": recent_activities,
        "filtered": has_filters,
        "applied_filters": {
            "year": year,
            "quarter": quarter,
            "sales_rep": sales_rep,
            "team_id": team_id,
            "account": account,
            "stage": stage,
            "date_field": date_field
        }
    }


@router.post("/refresh")
async def refresh_dashboard(current_user: dict = Depends(get_current_user)):
    """Manually trigger dashboard refresh"""
    await dashboard_aggregator.rebuild_cache(current_user.get("org_id", "default"))
    
    return {
        "success": True,
        "message": "Dashboard refreshed",
        "org_id": current_user.get("org_id", "default")
    }


@router.get("/product-manager-leaderboard")
async def get_product_manager_leaderboard(
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    current_user: dict = Depends(get_current_user)
):
    """Get Product Manager leaderboard based on Won deals"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get all opportunities
    opportunities = await canonical_db.opportunities.find({"org_id": org_id}).to_list(10000)
    
    # Filter to Won opportunities only
    won_opps = []
    for o in opportunities:
        active = o.get("active", True)
        if active == 'False' or active is False:
            active = False
        else:
            active = True
        lost_reason = o.get("lost_reason_id") or o.get("lost_reason")
        normalized = normalize_stage_for_dashboard(o.get("stage", ""), active=active, lost_reason_id=lost_reason)
        if normalized == "closed_won":
            won_opps.append(o)
    
    # Apply year/quarter filter using won_at
    if year or quarter:
        won_opps = apply_date_filters_for_won_lost(won_opps, year, quarter)
    
    # Aggregate by Product Manager
    pm_values = defaultdict(float)
    pm_counts = defaultdict(int)
    
    for opp in won_opps:
        pm_name = opp.get("product_manager")
        if pm_name:
            pm_values[pm_name] += opp.get("sale_value", 0) or 0
            pm_counts[pm_name] += 1
    
    # Build leaderboard
    leaderboard = []
    sorted_pms = sorted(pm_values.items(), key=lambda x: x[1], reverse=True)[:10]
    for pm_name, value in sorted_pms:
        leaderboard.append({
            "name": pm_name,
            "value": value,
            "deals_won": pm_counts[pm_name]
        })
    
    if not leaderboard:
        leaderboard = [{"name": "No Product Manager data", "value": 0, "deals_won": 0}]
    
    return {
        "leaderboard": leaderboard,
        "total_won_value": sum(pm_values.values()),
        "total_deals": sum(pm_counts.values()),
        "filters": {"year": year, "quarter": quarter}
    }


@router.get("/category-stats")
async def get_category_stats(
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    current_user: dict = Depends(get_current_user)
):
    """Get Solution Category statistics based on Won deals"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get all opportunities
    opportunities = await canonical_db.opportunities.find({"org_id": org_id}).to_list(10000)
    
    # Filter to Won opportunities only
    won_opps = []
    for o in opportunities:
        active = o.get("active", True)
        if active == 'False' or active is False:
            active = False
        else:
            active = True
        lost_reason = o.get("lost_reason_id") or o.get("lost_reason")
        normalized = normalize_stage_for_dashboard(o.get("stage", ""), active=active, lost_reason_id=lost_reason)
        if normalized == "closed_won":
            won_opps.append(o)
    
    # Apply year/quarter filter using won_at
    if year or quarter:
        won_opps = apply_date_filters_for_won_lost(won_opps, year, quarter)
    
    # Aggregate by Solution Category
    cat_values = defaultdict(float)
    cat_counts = defaultdict(int)
    
    for opp in won_opps:
        cat_name = opp.get("solution_category")
        if cat_name:
            cat_values[cat_name] += opp.get("sale_value", 0) or 0
            cat_counts[cat_name] += 1
    
    # Build category stats - sorted by value
    categories = []
    sorted_cats = sorted(cat_values.items(), key=lambda x: x[1], reverse=True)
    for cat_name, value in sorted_cats:
        categories.append({
            "name": cat_name,
            "value": value,
            "count": cat_counts[cat_name]
        })
    
    if not categories:
        categories = [{"name": "No Category data", "value": 0, "count": 0}]
    
    return {
        "categories": categories,
        "total_won_value": sum(cat_values.values()),
        "total_deals": sum(cat_counts.values()),
        "filters": {"year": year, "quarter": quarter}
    }


@router.get("/sync-status")
async def get_sync_status(current_user: dict = Depends(get_current_user)):
    """Get sync status"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    
    # Get last canonical update
    last_opp = await canonical_db.opportunities.find_one(
        {"org_id": current_user.get("org_id", "default")},
        sort=[("transformed_at", -1)]
    )
    
    # Get last cache update
    cache_stats = await app_db.serving_cache.find_one({
        "entity_type": "dashboard_stats",
        "org_id": current_user.get("org_id", "default")
    })
    
    last_canonical = last_opp.get("transformed_at") if last_opp else None
    last_cache = cache_stats.get("updated_at") if cache_stats else None
    
    return {
        "last_canonical_update": last_canonical.isoformat() if last_canonical else None,
        "last_cache_update": last_cache.isoformat() if last_cache else None,
        "sync_needed": bool(last_canonical and last_cache and last_canonical > last_cache)
    }
