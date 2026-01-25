from fastapi import APIRouter, HTTPException, Depends, Path, Query
from typing import Optional, List, Dict, Any
from sales.models import OpportunityResponse, StageUpdateRequest, ProbabilityCalculateRequest, ActivityCreate, ActivityUpdate
from core.canonical_adapter import CanonicalAdapter
from core.database import get_app_db
from core.utils import serialize_doc
from auth.routes import get_current_user
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/opportunities", tags=["opportunities"])

async def merge_opportunity_overrides(canonical_record, org_id: str) -> Dict[str, Any]:
    """Merge canonical opportunity with overrides"""
    app_db = get_app_db()
    
    # Get overrides for this opportunity
    override = await app_db.overrides_opportunities.find_one({
        "canonical_id": canonical_record.canonical_id,
        "org_id": org_id
    })
    
    result = {
        "canonical_id": canonical_record.canonical_id,
        "data": canonical_record.data,
        "stage": canonical_record.data.get("stage"),
        "probability": canonical_record.data.get("probability"),
        "owner": canonical_record.data.get("owner"),
        "updated_at": canonical_record.updated_at,
        "has_overrides": False
    }
    
    if override:
        # Apply overrides
        if "stage" in override:
            result["stage"] = override["stage"]
        if "probability" in override:
            result["probability"] = override["probability"]
        if "owner" in override:
            result["owner"] = override["owner"]
        result["has_overrides"] = True
    
    return result

@router.get("", response_model=List[OpportunityResponse])
async def list_opportunities(
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List all opportunities with overrides applied"""
    try:
        # Fetch canonical opportunities
        canonical_records = await CanonicalAdapter.get_canonical_records(
            entity_type="opportunities",
            org_id=current_user.get("org_id"),
            limit=limit,
            skip=skip
        )
        
        # Merge with overrides
        opportunities = []
        for record in canonical_records:
            merged = await merge_opportunity_overrides(record, current_user.get("org_id"))
            opportunities.append(OpportunityResponse(**merged))
        
        return opportunities
    except Exception as e:
        logger.error(f"Error listing opportunities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/kanban")
async def opportunities_kanban(
    current_user: dict = Depends(get_current_user)
):
    """Get opportunities organized by stage (kanban view)"""
    try:
        # Fetch all opportunities
        canonical_records = await CanonicalAdapter.get_canonical_records(
            entity_type="opportunities",
            org_id=current_user.get("org_id"),
            limit=1000
        )
        
        # Organize by stage
        kanban = {}
        for record in canonical_records:
            merged = await merge_opportunity_overrides(record, current_user.get("org_id"))
            stage = merged["stage"] or "Unknown"
            
            if stage not in kanban:
                kanban[stage] = []
            kanban[stage].append(merged)
        
        return {
            "success": True,
            "stages": kanban
        }
    except Exception as e:
        logger.error(f"Error getting kanban view: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{opp_id}")
async def get_opportunity(
    opp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single opportunity with overrides"""
    try:
        canonical_record = await CanonicalAdapter.get_canonical_by_id(
            canonical_id=opp_id,
            entity_type="opportunities",
            org_id=current_user.get("org_id")
        )
        
        if not canonical_record:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        merged = await merge_opportunity_overrides(canonical_record, current_user.get("org_id"))
        return merged
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting opportunity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{opp_id}/stage")
async def update_opportunity_stage(
    opp_id: str,
    stage_data: StageUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update opportunity stage (stored as override)"""
    try:
        app_db = get_app_db()
        
        # Upsert override
        await app_db.overrides_opportunities.update_one(
            {
                "canonical_id": opp_id,
                "org_id": current_user.get("org_id")
            },
            {
                "$set": {
                    "stage": stage_data.stage,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user.get("id")
                }
            },
            upsert=True
        )
        
        return {
            "success": True,
            "message": "Stage updated",
            "canonical_id": opp_id,
            "stage": stage_data.stage
        }
    except Exception as e:
        logger.error(f"Error updating stage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{opp_id}/calculate-probability")
async def calculate_probability(
    opp_id: str,
    prob_data: ProbabilityCalculateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Calculate and store opportunity probability (as override)"""
    try:
        app_db = get_app_db()
        
        # Upsert override
        await app_db.overrides_opportunities.update_one(
            {
                "canonical_id": opp_id,
                "org_id": current_user.get("org_id")
            },
            {
                "$set": {
                    "probability": prob_data.probability,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user.get("id")
                }
            },
            upsert=True
        )
        
        return {
            "success": True,
            "message": "Probability updated",
            "canonical_id": opp_id,
            "probability": prob_data.probability
        }
    except Exception as e:
        logger.error(f"Error updating probability: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Activities router
activities_router = APIRouter(prefix="/activities", tags=["activities"])

@activities_router.get("")
async def list_activities(
    opportunity_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List activities"""
    try:
        app_db = get_app_db()
        
        query = {"org_id": current_user.get("org_id")}
        if opportunity_id:
            query["opportunity_id"] = opportunity_id
        
        activities = await app_db.activities.find(query).to_list(1000)
        return [serialize_doc(a) for a in activities]
    except Exception as e:
        logger.error(f"Error listing activities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@activities_router.post("")
async def create_activity(
    activity_data: ActivityCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create new activity"""
    try:
        app_db = get_app_db()
        
        activity_doc = {
            "id": str(uuid.uuid4()),
            "org_id": current_user.get("org_id"),
            "created_by": current_user.get("id"),
            "status": "pending",
            "completed": False,
            "created_at": datetime.utcnow(),
            **activity_data.model_dump()
        }
        
        await app_db.activities.insert_one(activity_doc)
        
        return serialize_doc(activity_doc)
    except Exception as e:
        logger.error(f"Error creating activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@activities_router.patch("/{activity_id}/status")
async def update_activity_status(
    activity_id: str,
    update_data: ActivityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update activity status"""
    try:
        app_db = get_app_db()
        
        update_fields = {"updated_at": datetime.utcnow()}
        if update_data.status:
            update_fields["status"] = update_data.status
        if update_data.completed is not None:
            update_fields["completed"] = update_data.completed
        
        result = await app_db.activities.update_one(
            {"id": activity_id, "org_id": current_user.get("org_id")},
            {"$set": update_fields}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Activity not found")
        
        return {"success": True, "message": "Activity updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))
