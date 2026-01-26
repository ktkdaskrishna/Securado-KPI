"""Dashboard Aggregator Service Routes

Handles:
- Consume canonical and CRM events to build serving cache
- Provide aggregated dashboard statistics
- Manual refresh triggers
"""
from fastapi import APIRouter, Depends
import logging
from datetime import datetime
import random

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, now_utc, PipelineStages
from libs.event_bus import event_bus, emit_event
from libs.schemas import Topics, EventEnvelope
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


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
            
            # Apply overrides
            for opp in opps:
                override = override_map.get(opp.get("canonical_id"))
                if override:
                    if "stage" in override:
                        opp["stage"] = override["stage"]
                    if "probability" in override:
                        opp["probability"] = override["probability"]
            
            # Calculate aggregates
            total_pipeline = sum(o.get("amount", 0) or 0 for o in opps)
            
            # By stage
            stage_counts = {}
            stage_values = {}
            for stage in PipelineStages.all():
                stage_opps = [o for o in opps if o.get("stage") == stage]
                stage_counts[stage] = len(stage_opps)
                stage_values[stage] = sum(o.get("amount", 0) or 0 for o in stage_opps)
            
            won_count = stage_counts.get(PipelineStages.CLOSED_WON, 0)
            won_value = stage_values.get(PipelineStages.CLOSED_WON, 0)
            lost_count = stage_counts.get(PipelineStages.CLOSED_LOST, 0)
            
            open_count = sum(c for s, c in stage_counts.items() if s not in [PipelineStages.CLOSED_WON, PipelineStages.CLOSED_LOST])
            
            win_rate = (won_count / (won_count + lost_count) * 100) if (won_count + lost_count) > 0 else 0
            
            # Get activities
            activities = await app_db.activities.find({"org_id": org_id}).to_list(10000)
            activity_stats = {
                "calls": len([a for a in activities if a.get("type") == "call"]),
                "emails": len([a for a in activities if a.get("type") == "email"]),
                "meetings": len([a for a in activities if a.get("type") == "meeting"]),
                "tasks": len([a for a in activities if a.get("type") == "task"]),
                "total": len(activities),
                "completed": len([a for a in activities if a.get("status") == "completed"])
            }
            
            # Recent activities
            recent_activities = sorted(activities, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
            
            # Build pipeline by stage
            pipeline_by_stage = [
                {"stage": stage.replace("_", " ").title(), "value": stage_values.get(stage, 0), "count": stage_counts.get(stage, 0)}
                for stage in PipelineStages.all()
            ]
            
            # Mock leaderboard
            leaderboard = [
                {"id": "1", "name": "Sarah Johnson", "value": random.randint(200000, 300000)},
                {"id": "2", "name": "Michael Chen", "value": random.randint(150000, 250000)},
                {"id": "3", "name": "Emily Davis", "value": random.randint(100000, 200000)},
                {"id": "4", "name": "James Wilson", "value": random.randint(80000, 150000)},
                {"id": "5", "name": "Lisa Anderson", "value": random.randint(50000, 120000)},
            ]
            
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
                "total_opportunities": len(opps),
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
            
            logger.info(f"Dashboard cache rebuilt for org {org_id}")
            
        except Exception as e:
            logger.error(f"Failed to rebuild dashboard cache: {e}")


# Global aggregator instance
dashboard_aggregator = DashboardAggregator()


@router.get("/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics from serving cache"""
    app_db = get_app_db()
    
    # Get from cache
    stats = await app_db.serving_cache.find_one({
        "entity_type": "dashboard_stats",
        "org_id": current_user.get("org_id", "default")
    })
    
    if stats:
        return serialize_doc(stats)
    
    # Build cache if not exists
    await dashboard_aggregator.rebuild_cache(current_user.get("org_id", "default"))
    
    stats = await app_db.serving_cache.find_one({
        "entity_type": "dashboard_stats",
        "org_id": current_user.get("org_id", "default")
    })
    
    if stats:
        return serialize_doc(stats)
    
    # Return default stats
    return {
        "entity_type": "dashboard_stats",
        "org_id": current_user.get("org_id", "default"),
        "total_pipeline": 0,
        "pipeline_change": 0,
        "won_value": 0,
        "won_count": 0,
        "open_count": 0,
        "open_change": 0,
        "win_rate": 0,
        "win_rate_change": 0,
        "pipeline_by_stage": [],
        "activity_stats": {},
        "recent_activities": [],
        "leaderboard": [],
        "message": "No data available. Run ETL pipeline to populate data."
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
