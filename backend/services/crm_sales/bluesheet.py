"""Bluesheet Probability Calculator

Implements Miller Heiman Bluesheet methodology for opportunity probability calculation.
Now enhanced to use synced Odoo data automatically:
- Budget status from x_studio_budget_status
- Buying influences from technical_buyer_name, commercial_buyer_name, is_tech_buyer_coach, etc.
- Competition from competitor_solution
- Timeline from close_date
- Activity engagement from synced activities
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from libs.utils import PipelineStages

# Bluesheet criteria weights
BLUESHEET_WEIGHTS = {
    "stage_score": 0.25,           # Pipeline stage position
    "buying_influences": 0.20,     # Key stakeholders identified
    "competition_status": 0.15,    # Competitive position
    "timeline_alignment": 0.15,    # Close date realistic
    "budget_status": 0.15,         # Budget confirmed/identified
    "activity_engagement": 0.10    # Recent activity level
}

# Stage probabilities (default) - now includes custom stages
STAGE_PROBABILITIES = {
    "qualified": 20,
    "proposal": 40,
    "negotiation": 60,
    "review&negotiation": 70,  # Custom stage from Odoo
    "review_negotiation": 70,
    "closed_won": 100,
    "won": 100,
    "closed_lost": 0,
    "lost": 0,
    "hold": 10,
    "enquiry": 10,
}

# Buying influence roles
BUYING_INFLUENCES = [
    {"role": "economic_buyer", "label": "Economic Buyer", "weight": 0.35, "description": "Final budget authority"},
    {"role": "user_buyer", "label": "User Buyer", "weight": 0.25, "description": "End user/department head"},
    {"role": "technical_buyer", "label": "Technical Buyer", "weight": 0.20, "description": "Evaluates technical fit"},
    {"role": "coach", "label": "Coach/Champion", "weight": 0.20, "description": "Internal advocate"}
]

# Competition status options
COMPETITION_STATUS = [
    {"value": "sole_source", "label": "Sole Source", "score": 100},
    {"value": "favored", "label": "Favored Position", "score": 75},
    {"value": "even", "label": "Even Competition", "score": 50},
    {"value": "behind", "label": "Behind Competitor", "score": 25},
    {"value": "unknown", "label": "Unknown", "score": 40},
    {"value": "has_competitor", "label": "Has Competitor", "score": 35},  # When competitor_solution exists
]

# Budget status options - mapped to Odoo's x_studio_budget_status values
BUDGET_STATUS = [
    {"value": "confirmed", "label": "Budget Confirmed", "score": 100},
    {"value": "approved", "label": "Approved", "score": 100},  # Odoo value
    {"value": "identified", "label": "Budget Identified", "score": 75},
    {"value": "approval_under_review", "label": "Approval Under Review", "score": 65},  # Odoo value
    {"value": "in_process", "label": "Budget In Process", "score": 50},
    {"value": "development_and_approval", "label": "Development and Approval", "score": 45},  # Odoo value
    {"value": "not_identified", "label": "Not Identified", "score": 25},
    {"value": "unknown", "label": "Unknown", "score": 30}
]

# Pledge/Commitment mapping to score
PLEDGE_SCORES = {
    "commitment": 100,
    "strong_commitment": 100,
    "verbal_commitment": 80,
    "positive_interest": 60,
    "no_commitment": 30,
    "unknown": 40,
}


def calculate_stage_score(opportunity: Dict) -> float:
    """Calculate probability based on pipeline stage - uses custom_stage first, then stage"""
    # Prefer custom stage from Odoo (x_studio_opportunity_stages_1)
    stage = opportunity.get("custom_stage") or opportunity.get("stage") or "qualified"
    stage_lower = stage.lower().replace(" ", "_").replace("&", "_")
    
    return STAGE_PROBABILITIES.get(stage_lower, 30)


def calculate_buying_influences_score_from_odoo(opportunity: Dict, manual_influences: List[Dict] = None) -> tuple:
    """Calculate score based on Odoo's synced buying influence data
    
    Uses:
    - commercial_buyer_name / is_comm_buyer_coach
    - technical_buyer_name / is_tech_buyer_coach
    - Plus any manually entered influences
    
    Returns:
        Tuple of (score, identified_influences list)
    """
    identified = []
    
    # Check Commercial Buyer from Odoo
    if opportunity.get("commercial_buyer_name"):
        influence = {
            "role": "economic_buyer",
            "name": opportunity.get("commercial_buyer_name"),
            "is_coach": opportunity.get("is_comm_buyer_coach", False),
            "coverage": 0.8 if opportunity.get("is_comm_buyer_coach") else 0.6,
            "source": "odoo"
        }
        identified.append(influence)
    
    # Check Technical Buyer from Odoo
    if opportunity.get("technical_buyer_name"):
        influence = {
            "role": "technical_buyer",
            "name": opportunity.get("technical_buyer_name"),
            "is_coach": opportunity.get("is_tech_buyer_coach", False),
            "coverage": 0.8 if opportunity.get("is_tech_buyer_coach") else 0.6,
            "source": "odoo"
        }
        identified.append(influence)
    
    # Add manual influences (from local bluesheet)
    if manual_influences:
        for inf in manual_influences:
            # Don't duplicate if already from Odoo
            if not any(i["role"] == inf.get("role") for i in identified):
                identified.append({
                    **inf,
                    "source": "manual"
                })
    
    # Calculate score
    if not identified:
        return 20, []
    
    total_weight = sum(bi["weight"] for bi in BUYING_INFLUENCES)
    identified_weight = 0
    
    for influence in identified:
        for bi in BUYING_INFLUENCES:
            if influence.get("role") == bi["role"]:
                coverage = influence.get("coverage", 0.5)
                # Bonus if they're a coach
                if influence.get("is_coach"):
                    coverage = min(1.0, coverage + 0.2)
                identified_weight += bi["weight"] * coverage
    
    score = (identified_weight / total_weight) * 100
    return score, identified


def calculate_competition_score_from_odoo(opportunity: Dict, manual_status: str = None) -> tuple:
    """Calculate score based on Odoo's competitor data
    
    Uses:
    - competitor_solution
    - competitor_price
    - Or manual override from bluesheet
    
    Returns:
        Tuple of (score, status_used)
    """
    # If manual override provided, use it
    if manual_status and manual_status != "unknown":
        for option in COMPETITION_STATUS:
            if option["value"] == manual_status:
                return option["score"], manual_status
    
    # Auto-detect from Odoo fields
    competitor = opportunity.get("competitor_solution")
    competitor_price = opportunity.get("competitor_price")
    
    if not competitor:
        return 75, "favored"  # No competitor = good position
    
    # Has competitor - check if we have price info
    if competitor_price:
        # We know their pricing - slightly better position
        return 45, "has_competitor"
    
    return 35, "has_competitor"


def calculate_budget_score_from_odoo(opportunity: Dict, manual_status: str = None) -> tuple:
    """Calculate score based on Odoo's budget status
    
    Uses:
    - budget_status (from x_studio_budget_status)
    - pledge (commitment level)
    - Or manual override from bluesheet
    
    Returns:
        Tuple of (score, status_used)
    """
    # If manual override provided, use it
    if manual_status and manual_status != "unknown":
        for option in BUDGET_STATUS:
            if option["value"] == manual_status:
                return option["score"], manual_status
    
    # Get Odoo budget status
    odoo_budget = opportunity.get("budget_status", "").lower().replace(" ", "_")
    
    # Map Odoo values to our status
    for option in BUDGET_STATUS:
        if option["value"] == odoo_budget:
            return option["score"], odoo_budget
    
    # Check pledge/commitment as fallback
    pledge = opportunity.get("pledge", "").lower().replace(" ", "_")
    if pledge in PLEDGE_SCORES:
        # Combine pledge with a base budget score
        pledge_score = PLEDGE_SCORES[pledge]
        return int(pledge_score * 0.6 + 30), f"pledge:{pledge}"
    
    return 30, "unknown"


def calculate_timeline_score(close_date: Optional[str], activities: List[Dict]) -> float:
    """Calculate score based on timeline alignment"""
    if not close_date:
        return 30  # Low score if no close date
    
    try:
        if isinstance(close_date, str):
            close_dt = datetime.fromisoformat(close_date.replace('Z', '+00:00'))
        else:
            close_dt = close_date
            
        now = datetime.now(timezone.utc)
        days_until_close = (close_dt - now).days
        
        if days_until_close < 0:
            return 20  # Past due
        elif days_until_close < 7:
            # Check for recent activity
            recent_activities = [a for a in activities if a.get("type") in ["meeting", "call", "to_do"]]
            if recent_activities:
                return 80
            return 50
        elif days_until_close < 30:
            return 70
        elif days_until_close < 90:
            return 60
        else:
            return 50
    except:
        return 40


def calculate_activity_score(activities: List[Dict], days: int = 30) -> float:
    """Calculate score based on recent activity engagement"""
    if not activities:
        return 20
    
    now = datetime.now(timezone.utc)
    recent_count = 0
    
    for activity in activities:
        created_at = activity.get("created_at") or activity.get("date")
        if created_at:
            try:
                if isinstance(created_at, str):
                    act_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    act_dt = created_at
                
                if hasattr(act_dt, 'tzinfo') and act_dt.tzinfo is None:
                    act_dt = act_dt.replace(tzinfo=timezone.utc)
                
                if (now - act_dt).days <= days:
                    recent_count += 1
            except:
                pass
    
    if recent_count >= 5:
        return 100
    elif recent_count >= 3:
        return 80
    elif recent_count >= 1:
        return 60
    else:
        return 30


def calculate_bluesheet_probability(
    opportunity: Dict,
    bluesheet_data: Optional[Dict] = None,
    activities: Optional[List[Dict]] = None
) -> Dict[str, Any]:
    """Calculate comprehensive Bluesheet probability
    
    NOW ENHANCED: Automatically uses synced Odoo data:
    - Budget status from opportunity.budget_status (x_studio_budget_status)
    - Buying influences from commercial_buyer_name, technical_buyer_name, etc.
    - Competition from competitor_solution
    - Timeline from close_date
    
    Manual overrides from bluesheet_data take precedence if provided.
    
    Args:
        opportunity: The opportunity record (with synced Odoo fields)
        bluesheet_data: Optional manual bluesheet assessment data (overrides)
        activities: Optional list of related activities
    
    Returns:
        Dictionary with probability score and breakdown
    """
    bluesheet = bluesheet_data or {}
    activities = activities or []
    
    # 1. Stage Score - uses custom_stage from Odoo
    stage_score = calculate_stage_score(opportunity)
    stage_used = opportunity.get("custom_stage") or opportunity.get("stage", "qualified")
    
    # 2. Buying Influences - combines Odoo data + manual
    manual_influences = bluesheet.get("buying_influences", [])
    influences_score, identified_influences = calculate_buying_influences_score_from_odoo(
        opportunity, manual_influences
    )
    
    # 3. Competition - uses Odoo competitor data or manual override
    manual_competition = bluesheet.get("competition_status", "unknown")
    competition_score, competition_status = calculate_competition_score_from_odoo(
        opportunity, manual_competition
    )
    
    # 4. Timeline Score
    close_date = opportunity.get("close_date")
    timeline_score = calculate_timeline_score(close_date, activities)
    
    # 5. Budget Score - uses Odoo budget_status or manual override
    manual_budget = bluesheet.get("budget_status", "unknown")
    budget_score, budget_status = calculate_budget_score_from_odoo(
        opportunity, manual_budget
    )
    
    # 6. Activity Score
    activity_score = calculate_activity_score(activities)
    
    # Calculate weighted probability
    weighted_probability = (
        stage_score * BLUESHEET_WEIGHTS["stage_score"] +
        influences_score * BLUESHEET_WEIGHTS["buying_influences"] +
        competition_score * BLUESHEET_WEIGHTS["competition_status"] +
        timeline_score * BLUESHEET_WEIGHTS["timeline_alignment"] +
        budget_score * BLUESHEET_WEIGHTS["budget_status"] +
        activity_score * BLUESHEET_WEIGHTS["activity_engagement"]
    )
    
    # Determine risk level
    if weighted_probability >= 70:
        risk_level = "low"
    elif weighted_probability >= 50:
        risk_level = "medium"
    else:
        risk_level = "high"
    
    # Generate recommendations based on actual data
    recommendations = []
    if influences_score < 50:
        if not opportunity.get("commercial_buyer_name"):
            recommendations.append("Identify the Commercial/Economic Buyer in Odoo")
        if not opportunity.get("technical_buyer_name"):
            recommendations.append("Identify the Technical Buyer in Odoo")
        if not any(i.get("is_coach") for i in identified_influences):
            recommendations.append("Identify a Coach/Champion among the buying influences")
    
    if competition_score < 50:
        if opportunity.get("competitor_solution"):
            recommendations.append(f"Develop strategy to counter competitor: {opportunity.get('competitor_solution')}")
        else:
            recommendations.append("Document competitive landscape")
    
    if budget_score < 50:
        if opportunity.get("pledge") == "No Commitment":
            recommendations.append("Work to get customer commitment on budget")
        recommendations.append("Confirm budget allocation status with customer")
    
    if activity_score < 50:
        recommendations.append("Increase engagement - schedule more meetings/calls")
    
    if timeline_score < 50:
        recommendations.append("Verify close date is realistic based on deal progress")
    
    # Build data sources info showing what came from Odoo vs manual
    data_sources = {
        "stage": {"value": stage_used, "source": "odoo" if opportunity.get("custom_stage") else "system"},
        "budget_status": {"value": budget_status, "source": "odoo" if opportunity.get("budget_status") else "manual"},
        "competition_status": {"value": competition_status, "source": "odoo" if opportunity.get("competitor_solution") and competition_status == "has_competitor" else "manual"},
        "buying_influences": [
            {"name": i.get("name"), "role": i.get("role"), "source": i.get("source", "unknown")}
            for i in identified_influences
        ]
    }
    
    return {
        "probability": round(weighted_probability, 1),
        "risk_level": risk_level,
        "breakdown": {
            "stage_score": round(stage_score, 1),
            "buying_influences_score": round(influences_score, 1),
            "competition_score": round(competition_score, 1),
            "timeline_score": round(timeline_score, 1),
            "budget_score": round(budget_score, 1),
            "activity_score": round(activity_score, 1)
        },
        "weights": BLUESHEET_WEIGHTS,
        "recommendations": recommendations,
        "stage": stage_used,
        "buying_influences_count": len(identified_influences),
        "buying_influences": identified_influences,
        "competition_status": competition_status,
        "budget_status": budget_status,
        "data_sources": data_sources,  # Shows what came from Odoo vs manual
        
        # Odoo sync info
        "odoo_data_used": {
            "commercial_buyer": opportunity.get("commercial_buyer_name"),
            "technical_buyer": opportunity.get("technical_buyer_name"),
            "competitor": opportunity.get("competitor_solution"),
            "budget_status": opportunity.get("budget_status"),
            "pledge": opportunity.get("pledge"),
            "custom_stage": opportunity.get("custom_stage"),
        }
    }


def get_bluesheet_form_options() -> Dict[str, Any]:
    """Get form options for Bluesheet assessment"""
    return {
        "buying_influences": BUYING_INFLUENCES,
        "competition_status": COMPETITION_STATUS,
        "budget_status": BUDGET_STATUS,
        "stage_probabilities": STAGE_PROBABILITIES,
        "weights": BLUESHEET_WEIGHTS
    }
