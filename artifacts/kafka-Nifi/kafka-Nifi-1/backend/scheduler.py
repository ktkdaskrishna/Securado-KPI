"""Scheduler Engine for Pipeline Automation"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from datetime import datetime, timezone
import logging
import asyncio
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)


class PipelineScheduler:
    """Manages scheduled pipeline executions"""
    
    _instance = None
    _scheduler: AsyncIOScheduler = None
    _pipeline_executor: Optional[Callable] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._scheduler is None:
            self._scheduler = AsyncIOScheduler(
                jobstores={'default': MemoryJobStore()},
                timezone='UTC'
            )
    
    def set_executor(self, executor: Callable):
        """Set the pipeline executor function"""
        self._pipeline_executor = executor
    
    def start(self):
        """Start the scheduler"""
        if not self._scheduler.running:
            self._scheduler.start()
            logger.info("Pipeline scheduler started")
    
    def shutdown(self):
        """Shutdown the scheduler"""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("Pipeline scheduler shutdown")
    
    async def add_pipeline_job(
        self,
        pipeline_id: str,
        schedule_type: str,
        schedule_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Add or update a scheduled job for a pipeline.
        
        Args:
            pipeline_id: Unique pipeline identifier
            schedule_type: 'interval' or 'cron'
            schedule_config: Configuration for the schedule
                - For interval: {'minutes': 30} or {'hours': 1}
                - For cron: {'expression': '0 * * * *'}
        """
        job_id = f"pipeline_{pipeline_id}"
        
        # Remove existing job if any
        self.remove_pipeline_job(pipeline_id)
        
        if schedule_type == 'interval':
            minutes = schedule_config.get('minutes', 60)
            hours = schedule_config.get('hours', 0)
            
            trigger = IntervalTrigger(
                minutes=minutes if not hours else 0,
                hours=hours,
                timezone='UTC'
            )
            
        elif schedule_type == 'cron':
            expression = schedule_config.get('expression', '0 * * * *')
            try:
                trigger = CronTrigger.from_crontab(expression, timezone='UTC')
            except ValueError as e:
                return {"error": f"Invalid cron expression: {e}"}
        else:
            return {"error": f"Unknown schedule type: {schedule_type}"}
        
        # Add the job
        job = self._scheduler.add_job(
            self._execute_pipeline,
            trigger,
            args=[pipeline_id],
            id=job_id,
            name=f"Pipeline {pipeline_id}",
            replace_existing=True,
            misfire_grace_time=300  # 5 minutes grace period
        )
        
        next_run = job.next_run_time.isoformat() if job.next_run_time else None
        
        logger.info(f"Scheduled pipeline {pipeline_id} with {schedule_type}: next run at {next_run}")
        
        return {
            "job_id": job_id,
            "pipeline_id": pipeline_id,
            "schedule_type": schedule_type,
            "next_run": next_run,
            "status": "scheduled"
        }
    
    def remove_pipeline_job(self, pipeline_id: str) -> bool:
        """Remove a scheduled job for a pipeline"""
        job_id = f"pipeline_{pipeline_id}"
        try:
            self._scheduler.remove_job(job_id)
            logger.info(f"Removed scheduled job for pipeline {pipeline_id}")
            return True
        except Exception:
            return False
    
    def get_job_info(self, pipeline_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a scheduled job"""
        job_id = f"pipeline_{pipeline_id}"
        job = self._scheduler.get_job(job_id)
        
        if not job:
            return None
        
        return {
            "job_id": job_id,
            "pipeline_id": pipeline_id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        }
    
    def get_all_jobs(self) -> list:
        """Get all scheduled jobs"""
        jobs = []
        for job in self._scheduler.get_jobs():
            jobs.append({
                "job_id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })
        return jobs
    
    async def _execute_pipeline(self, pipeline_id: str):
        """Internal method to execute a pipeline"""
        logger.info(f"Scheduler triggering pipeline {pipeline_id}")
        
        if self._pipeline_executor:
            try:
                await self._pipeline_executor(pipeline_id, trigger_type="scheduled")
            except Exception as e:
                logger.error(f"Scheduled pipeline execution failed: {e}")
        else:
            logger.warning("No pipeline executor configured")
    
    def pause_job(self, pipeline_id: str) -> bool:
        """Pause a scheduled job"""
        job_id = f"pipeline_{pipeline_id}"
        try:
            self._scheduler.pause_job(job_id)
            return True
        except Exception:
            return False
    
    def resume_job(self, pipeline_id: str) -> bool:
        """Resume a paused job"""
        job_id = f"pipeline_{pipeline_id}"
        try:
            self._scheduler.resume_job(job_id)
            return True
        except Exception:
            return False


# Global scheduler instance
scheduler = PipelineScheduler()
