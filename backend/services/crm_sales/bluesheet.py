"""Bluesheet Probability Calculator

Implements Miller Heiman Bluesheet methodology for opportunity probability calculation.
Factors considered:
- Stage progression
- Buying influences identified
- Competition analysis
- Timeline alignment
- Budget confirmation
- Activity engagement
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

# Stage probabilities (default)
STAGE_PROBABILITIES = {
    "qualified": 20,
    "proposal": 40,
    "negotiation": 60,
    "closed_won": 100,
    "closed_lost": 0
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
    {"value": "unknown", "label": "Unknown", "score": 40}
]

# Budget status options
BUDGET_STATUS = [
    {"value": "confirmed", "label": "Budget Confirmed", "score": 100},
    {"value": "identified", "label": "Budget Identified", "score": 75},
    {"value": "in_process", "label": "Budget In Process", "score": 50},
    {"value": "not_identified", "label": "Not Identified", "score": 25},
    {"value": "unknown", "label": "Unknown", "score": 30}
]


def calculate_stage_score(stage: str) -> float:
    """Calculate probability based on pipeline stage"""
    return STAGE_PROBABILITIES.get(stage, 30)


def calculate_buying_influences_score(influences: List[Dict]) -> float:
    """Calculate score based on identified buying influences"""
    if not influences:
        return 20  # Low score if no influences identified
    
    total_weight = sum(bi["weight"] for bi in BUYING_INFLUENCES)
    identified_weight = 0
    
    for influence in influences:
        for bi in BUYING_INFLUENCES:
            if influence.get("role") == bi["role"]:
                # Add weight based on how well defined the influence is
                coverage = influence.get("coverage", 0.5)  # 0-1 scale
                identified_weight += bi["weight"] * coverage
    
    return (identified_weight / total_weight) * 100


def calculate_competition_score(status: str) -> float:
    """Calculate score based on competitive position"""
    for option in COMPETITION_STATUS:
        if option["value"] == status:
            return option["score"]
    return 40  # Default to unknown


def calculate_timeline_score(close_date: Optional[str], activities: List[Dict]) -> float:
    """Calculate score based on timeline alignment"""
    if not close_date:
        return 30  # Low score if no close date
    
    try:
        close_dt = datetime.fromisoformat(close_date.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        days_until_close = (close_dt - now).days
        
        if days_until_close < 0:
            return 20  # Past due
        elif days_until_close < 7:
            # Check for recent activity
            recent_activities = [a for a in activities if a.get("type") in ["meeting", "call"]]
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


def calculate_budget_score(status: str) -> float:
    """Calculate score based on budget status"""
    for option in BUDGET_STATUS:
        if option["value"] == status:
            return option["score"]
    return 30  # Default to unknown


def calculate_activity_score(activities: List[Dict], days: int = 30) -> float:
    """Calculate score based on recent activity engagement"""
    if not activities:
        return 20
    
    now = datetime.now(timezone.utc)
    recent_count = 0
    
    for activity in activities:
        created_at = activity.get("created_at")
        if created_at:
            try:
                if isinstance(created_at, str):
                    act_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    act_dt = created_at
                
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
    
    Args:
        opportunity: The opportunity record
        bluesheet_data: Optional bluesheet assessment data
        activities: Optional list of related activities
    
    Returns:
        Dictionary with probability score and breakdown
    """
    bluesheet = bluesheet_data or {}
    activities = activities or []
    
    # Calculate individual scores
    stage = opportunity.get("stage", "qualified")
    stage_score = calculate_stage_score(stage)
    
    buying_influences = bluesheet.get("buying_influences", [])
    influences_score = calculate_buying_influences_score(buying_influences)
    
    competition_status = bluesheet.get("competition_status", "unknown")
    competition_score = calculate_competition_score(competition_status)
    
    close_date = opportunity.get("close_date")
    timeline_score = calculate_timeline_score(close_date, activities)
    
    budget_status = bluesheet.get("budget_status", "unknown")
    budget_score = calculate_budget_score(budget_status)
    
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
    
    # Generate recommendations
    recommendations = []
    if influences_score < 50:
        recommendations.append("Identify and engage more buying influences")
    if competition_score < 50:
        recommendations.append("Improve competitive positioning")
    if budget_score < 50:
        recommendations.append("Confirm budget allocation")
    if activity_score < 50:
        recommendations.append("Increase engagement activity")
    if timeline_score < 50:
        recommendations.append("Verify close date is realistic")
    
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
        "stage": stage,
        "buying_influences_count": len(buying_influences),
        "competition_status": competition_status,
        "budget_status": budget_status
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
