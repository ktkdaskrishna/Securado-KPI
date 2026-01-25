"""Event Schemas and Topic Constants

Standard event envelope and topic definitions for the Event Mesh CRM system.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from datetime import datetime
import uuid


# ==================== TOPIC CONSTANTS ====================

class Topics:
    """Kafka/Event bus topic names"""
    # User lifecycle
    USER_REGISTERED = "user.registered.v1"
    USER_APPROVED = "user.approved.v1"
    USER_REJECTED = "user.rejected.v1"
    
    # RBAC
    RBAC_ROLE_UPDATED = "rbac.role.updated.v1"
    RBAC_PERMISSION_UPDATED = "rbac.permission.updated.v1"
    
    # Config
    CONFIG_UPDATED = "config.updated.v1"
    
    # ETL
    ETL_PIPELINE_RUN_COMMAND = "etl.pipeline_run.command.v1"
    ETL_PIPELINE_RUN_EVENT = "etl.pipeline_run.event.v1"  # started/progress/completed/failed
    ETL_DLQ = "etl.dlq.v1"
    
    # Canonical
    CANONICAL_RECORD_UPSERTED = "canonical.record.upserted.v1"
    CANONICAL_RECORD_DELETED = "canonical.record.deleted.v1"
    
    # CRM
    CRM_OVERRIDE_UPSERTED = "crm.override.upserted.v1"
    CRM_ACTIVITY_UPDATED = "crm.activity.updated.v1"
    CRM_GOAL_UPDATED = "crm.goal.updated.v1"
    
    # Serving/Dashboard
    SERVING_DASHBOARD_REFRESH = "serving.dashboard.refresh.v1"


# ==================== EVENT ENVELOPE ====================

class EventEnvelope(BaseModel):
    """Standard event envelope for all events"""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    org_id: Optional[str] = None
    correlation_id: Optional[str] = None
    producer: str  # Service name that produced this event
    schema_version: str = "1.0"
    payload: Dict[str, Any]
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# ==================== USER EVENTS ====================

class UserRegisteredPayload(BaseModel):
    user_id: str
    email: str
    name: str
    status: str = "pending"


class UserApprovedPayload(BaseModel):
    user_id: str
    approved_by: str


class UserRejectedPayload(BaseModel):
    user_id: str
    rejected_by: str
    reason: Optional[str] = None


# ==================== RBAC EVENTS ====================

class RoleUpdatedPayload(BaseModel):
    role_id: str
    role_name: str
    action: str  # created, updated, deleted
    permissions: list = []


# ==================== ETL EVENTS ====================

class PipelineRunCommandPayload(BaseModel):
    """Command to start a pipeline run"""
    run_id: str
    pipeline_id: str
    connection_id: str
    mapping_id: str
    trigger_type: str = "manual"  # manual, scheduled, webhook
    config: Dict[str, Any] = {}


class PipelineRunEventPayload(BaseModel):
    """Pipeline run lifecycle event"""
    run_id: str
    pipeline_id: str
    status: str  # pending, extracting, transforming, loading, completed, failed
    message: Optional[str] = None
    extracted_count: int = 0
    transformed_count: int = 0
    loaded_count: int = 0
    error_count: int = 0
    duration_seconds: Optional[float] = None


class DLQPayload(BaseModel):
    """Dead Letter Queue event"""
    dlq_id: str
    run_id: str
    pipeline_id: str
    record_id: str
    error: str
    raw_data: Optional[Dict[str, Any]] = None


# ==================== CANONICAL EVENTS ====================

class CanonicalRecordPayload(BaseModel):
    """Canonical record upsert/delete event"""
    canonical_id: str
    entity_type: str  # opportunity, account, contact, user
    action: str  # upserted, deleted
    source_system: str
    source_record_id: str
    data: Optional[Dict[str, Any]] = None


# ==================== CRM EVENTS ====================

class OverrideUpsertedPayload(BaseModel):
    """CRM override event"""
    override_id: str
    canonical_id: str
    entity_type: str
    field: str
    old_value: Optional[Any] = None
    new_value: Any
    updated_by: str


class ActivityUpdatedPayload(BaseModel):
    """Activity update event"""
    activity_id: str
    action: str  # created, updated, completed, deleted
    activity_type: str  # call, email, meeting, task
    opportunity_id: Optional[str] = None


class GoalUpdatedPayload(BaseModel):
    """Goal update event"""
    goal_id: str
    action: str
    goal_type: str  # goal, team, portfolio, initiative
    current_value: Optional[float] = None
    target_value: Optional[float] = None


# ==================== DASHBOARD EVENTS ====================

class DashboardRefreshPayload(BaseModel):
    """Dashboard refresh trigger event"""
    refresh_type: str  # full, incremental
    entity_types: list = []
