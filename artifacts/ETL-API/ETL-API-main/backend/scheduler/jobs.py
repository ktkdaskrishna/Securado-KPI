from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from core.config import settings
from core.database import get_app_db
from core.canonical_adapter import CanonicalAdapter
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def rebuild_serving_cache(org_id: Optional[str] = None):
    """Rebuild serving cache by aggregating canonical + overrides"""
    try:
        logger.info(f"Starting serving cache rebuild for org_id: {org_id or 'all'}")
        
        app_db = get_app_db()
        
        # Get all orgs if not specified
        orgs = [org_id] if org_id else ["default_org"]  # In production, fetch from users
        
        for org in orgs:
            # Fetch opportunities
            opportunities = await CanonicalAdapter.get_canonical_records(
                entity_type="opportunities",
                org_id=org,
                limit=10000
            )
            
            # Calculate stats
            stage_counts = {}
            total_value = 0
            
            for opp in opportunities:
                # Get stage from data
                stage = opp.data.get("stage", "Unknown")
                
                # Check for overrides
                override = await app_db.overrides_opportunities.find_one({
                    "canonical_id": opp.canonical_id,
                    "org_id": org
                })
                
                if override and "stage" in override:
                    stage = override["stage"]
                
                # Count by stage
                stage_counts[stage] = stage_counts.get(stage, 0) + 1
                
                # Sum value
                value = opp.data.get("value", 0) or opp.data.get("amount", 0)
                if isinstance(value, (int, float)):
                    total_value += value
            
            # Store in serving cache
            stats_doc = {
                "entity_type": "dashboard_stats",
                "org_id": org,
                "total_opportunities": len(opportunities),
                "stage_counts": stage_counts,
                "total_value": total_value,
                "updated_at": datetime.utcnow()
            }
            
            await app_db.serving_cache.update_one(
                {"entity_type": "dashboard_stats", "org_id": org},
                {"$set": stats_doc},
                upsert=True
            )
            
            logger.info(f"Serving cache rebuilt for org {org}: {len(opportunities)} opportunities")
        
        return True
    except Exception as e:
        logger.error(f"Error rebuilding serving cache: {e}")
        return False

def start_scheduler():
    """Start the APScheduler"""
    if not settings.SCHEDULER_ENABLED:
        logger.info("Scheduler is disabled")
        return
    
    try:
        # Parse cron expression
        cron_parts = settings.SCHEDULER_CRON.split()
        if len(cron_parts) == 5:
            minute, hour, day, month, day_of_week = cron_parts
            
            scheduler.add_job(
                rebuild_serving_cache,
                CronTrigger(
                    minute=minute,
                    hour=hour,
                    day=day,
                    month=month,
                    day_of_week=day_of_week
                ),
                id="rebuild_serving_cache",
                replace_existing=True
            )
            
            scheduler.start()
            logger.info(f"Scheduler started with cron: {settings.SCHEDULER_CRON}")
        else:
            logger.error(f"Invalid cron expression: {settings.SCHEDULER_CRON}")
    except Exception as e:
        logger.error(f"Error starting scheduler: {e}")

def stop_scheduler():
    """Stop the APScheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
