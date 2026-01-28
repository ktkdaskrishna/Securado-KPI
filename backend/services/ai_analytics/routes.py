"""AI Sales Analytics Service Routes

Provides AI-powered sales analytics including:
- Sales cycle analysis by account/product/rep
- Conversion funnel analysis
- Rep performance metrics
- Deal velocity insights
- AI-generated insights and recommendations
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import logging
import os
import json

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["ai-analytics"])


def normalize_stage(stage: str, active: bool = True, lost_reason_id = None) -> str:
    """Normalize Odoo stages to funnel stages
    
    In Odoo, lost deals are archived (active=False) with a lost_reason_id.
    They keep their original stage but are marked as lost.
    """
    # Check if it's a lost deal (archived with lost reason)
    if not active and lost_reason_id:
        return "lost"
    
    if not stage:
        return "unknown"
    stage_lower = stage.lower().strip()
    if stage_lower in ["won", "closed won", "closed_won"]:
        return "won"
    if stage_lower in ["lost", "closed lost", "closed_lost"]:
        return "lost"
    if "negot" in stage_lower:
        return "negotiation"
    if "prop" in stage_lower:
        return "proposal"
    if "quali" in stage_lower:
        return "qualified"
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
    time_period: Optional[str] = "all",  # year, quarter, month
    year: Optional[str] = None,
    quarter: Optional[str] = None,
    sales_rep: Optional[str] = None,
    team_id: Optional[str] = None,
    account: Optional[str] = None,
    stage: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get overview of all analytics metrics with optional filters"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get all opportunities
    all_opps = await canonical_db.opportunities.find({"org_id": org_id}).to_list(10000)
    
    # Helper functions for proper classification
    def is_won(o):
        stage = (o.get("stage") or "").lower().strip()
        return stage == "won" or "closed won" in stage
    
    def is_lost(o):
        stage = (o.get("stage") or "").lower().strip()
        # Check stage first (most reliable)
        if stage == "lost" or "closed lost" in stage:
            return True
        # Also check active flag with lost reason (archived deals in Odoo)
        active = o.get("active", True)
        if active == 'False' or active is False:
            return bool(o.get("lost_reason_id") or o.get("lost_reason"))
        return False
    
    # Apply filters
    filters = {
        "year": year,
        "quarter": quarter,
        "sales_rep": sales_rep,
        "team_id": team_id,
        "account": account,
        "stage": stage
    }
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
    year: Optional[str] = None,
    quarter: Optional[str] = None,
    sales_rep: Optional[str] = None,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed conversion funnel analysis - OPPORTUNITIES ONLY"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get all opportunities (type='opportunity' - exclude leads)
    all_opps = await canonical_db.opportunities.find({
        "org_id": org_id,
        "type": "opportunity"
    }).to_list(10000)
    
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
    
    # Calculate conversion rates between stages
    funnel = []
    prev_count = None
    for i, stage in enumerate(funnel_stages):
        data = stage_data[stage]
        conversion_rate = 0
        if prev_count and prev_count > 0:
            conversion_rate = round(data["count"] / prev_count * 100, 1)
        
        funnel.append({
            "stage": stage.title(),
            "count": data["count"],
            "value": data["value"],
            "conversion_rate": conversion_rate if i > 0 else 100
        })
        prev_count = data["count"] if data["count"] > 0 else prev_count
    
    # Overall conversion (Lead to Won)
    lead_count = stage_data["lead"]["count"] + stage_data["qualified"]["count"]
    won_count = stage_data["won"]["count"]
    overall_conversion = round(won_count / lead_count * 100, 1) if lead_count > 0 else 0
    
    return {
        "funnel": funnel,
        "overall_conversion": overall_conversion,
        "lost_count": stage_data.get("lost", {}).get("count", 0),
        "lost_value": stage_data.get("lost", {}).get("value", 0),
        "applied_filters": {k: v for k, v in filters.items() if v}
    }


@router.get("/rep-performance")
async def get_rep_performance(
    year: Optional[str] = None,
    quarter: Optional[str] = None,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get sales rep performance metrics - OPPORTUNITIES ONLY"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get opportunities only (not leads)
    all_opps = await canonical_db.opportunities.find({
        "org_id": org_id,
        "type": "opportunity"
    }).to_list(10000)
    
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
    current_user: dict = Depends(get_current_user)
):
    """Get sales team performance metrics"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    opps = await canonical_db.opportunities.find({"org_id": org_id}).to_list(10000)
    teams = await canonical_db.sales_teams.find({"org_id": org_id}).to_list(100)
    
    # Create team lookup
    team_lookup = {str(t.get("source_record_id")): t.get("name", "Unknown") for t in teams}
    
    # Group by team
    team_data = defaultdict(lambda: {
        "total_opps": 0,
        "total_value": 0,
        "won_count": 0,
        "won_value": 0,
        "reps": set()
    })
    
    for opp in opps:
        team_id = opp.get("team_id")
        team_name = team_lookup.get(str(team_id), "Unassigned") if team_id else "Unassigned"
        stage = normalize_stage(opp.get("stage", ""))
        amount = opp.get("amount", 0) or 0
        
        team_data[team_name]["total_opps"] += 1
        team_data[team_name]["total_value"] += amount
        team_data[team_name]["reps"].add(opp.get("owner_name", "Unknown"))
        
        if stage == "won":
            team_data[team_name]["won_count"] += 1
            team_data[team_name]["won_value"] += amount
    
    # Build response
    performance = []
    for team_name, data in team_data.items():
        performance.append({
            "name": team_name,
            "total_opportunities": data["total_opps"],
            "total_value": data["total_value"],
            "won_count": data["won_count"],
            "won_value": data["won_value"],
            "rep_count": len(data["reps"]),
            "avg_per_rep": round(data["won_value"] / len(data["reps"]), 2) if data["reps"] else 0
        })
    
    performance.sort(key=lambda x: x["won_value"], reverse=True)
    
    return {
        "teams": performance,
        "total_teams": len(performance)
    }


@router.get("/account-health")
async def get_account_health(
    current_user: dict = Depends(get_current_user)
):
    """Get account health metrics and engagement scores"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    accounts = await canonical_db.accounts.find({"org_id": org_id}).to_list(10000)
    opps = await canonical_db.opportunities.find({"org_id": org_id}).to_list(10000)
    activities = await canonical_db.activities.find({
        "org_id": org_id,
        "res_model": "crm.lead"
    }).to_list(10000)
    
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
    stages = list(set(o.get("stage") for o in opps if o.get("stage")))
    
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
    
    # Get years from create_date (not close_date since many don't have close dates)
    years = set()
    for opp in opps:
        # Check create_date first
        create_date = opp.get("create_date")
        if create_date and create_date != 'False' and isinstance(create_date, str) and len(create_date) >= 4:
            try:
                year = create_date[:4]
                if year.isdigit() and 1900 < int(year) < 2100:
                    years.add(year)
            except:
                pass
        # Also check close_date
        close_date = opp.get("close_date")
        if close_date and close_date != 'False' and isinstance(close_date, str) and len(close_date) >= 4:
            try:
                year = close_date[:4]
                if year.isdigit() and 1900 < int(year) < 2100:
                    years.add(year)
            except:
                pass
    
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
        "sales_reps": sorted(owners),
        "teams": [{"id": str(t.get("source_record_id")), "name": t.get("name")} for t in teams if t.get("name")],
        "accounts": sorted(opp_accounts, key=lambda x: x["name"])  # Return as objects with id/name
    }


def apply_filters(opps: list, filters: dict) -> list:
    """Apply filter parameters to opportunity list"""
    filtered = opps
    
    # Filter by year (from close_date)
    if filters.get("year"):
        year = filters["year"]
        filtered = [o for o in filtered if o.get("close_date") and str(o.get("close_date", ""))[:4] == year]
    
    # Filter by quarter
    if filters.get("quarter"):
        q = filters["quarter"]
        quarter_months = {"Q1": ["01", "02", "03"], "Q2": ["04", "05", "06"], 
                         "Q3": ["07", "08", "09"], "Q4": ["10", "11", "12"]}
        months = quarter_months.get(q, [])
        filtered = [o for o in filtered if o.get("close_date") and str(o.get("close_date", ""))[5:7] in months]
    
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
