"""ETL Control Service Models"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ConnectionCreate(BaseModel):
    name: str
    type: str = "odoo"  # odoo, postgres, mysql, mongodb, api
    url: str
    database: str
    username: str
    api_key: str
    description: Optional[str] = None


class ConnectionUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    database: Optional[str] = None
    username: Optional[str] = None
    api_key: Optional[str] = None
    description: Optional[str] = None


class MappingRule(BaseModel):
    source_field: str
    target_field: str
    transform: str = "direct"  # direct, to_float, to_int, to_bool, extract_id, extract_name


class MappingCreate(BaseModel):
    name: str
    connection_id: str
    source_model: str
    target_entity: str = "opportunity"  # opportunity, account, contact, user
    mappings: List[MappingRule]
    description: Optional[str] = None


class MappingUpdate(BaseModel):
    name: Optional[str] = None
    source_model: Optional[str] = None
    target_entity: Optional[str] = None
    mappings: Optional[List[MappingRule]] = None
    description: Optional[str] = None


class PipelineCreate(BaseModel):
    name: str
    connection_id: str
    mapping_id: str
    extract_limit: int = 500
    # Scheduling
    schedule_enabled: bool = False
    schedule_type: str = "manual"  # manual, interval, cron
    interval_minutes: Optional[int] = 60
    cron_expression: Optional[str] = None
    # Sync mode
    sync_mode: str = "full"  # full, incremental
    incremental_field: Optional[str] = "write_date"
    delete_mode: str = "soft"  # soft, hard, ignore
    description: Optional[str] = None


class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    extract_limit: Optional[int] = None
    schedule_enabled: Optional[bool] = None
    schedule_type: Optional[str] = None
    interval_minutes: Optional[int] = None
    cron_expression: Optional[str] = None
    sync_mode: Optional[str] = None
    incremental_field: Optional[str] = None
    delete_mode: Optional[str] = None
    description: Optional[str] = None


# Canonical entity definitions
CANONICAL_ENTITIES = {
    "opportunity": {
        "fields": [
            {"name": "canonical_id", "type": "string", "required": True},
            {"name": "name", "type": "string", "required": True},
            {"name": "amount", "type": "number", "required": False},
            {"name": "stage", "type": "string", "required": False},
            {"name": "probability", "type": "number", "required": False},
            {"name": "is_closed", "type": "boolean", "required": False},
            {"name": "is_won", "type": "boolean", "required": False},
            {"name": "owner_id", "type": "string", "required": False},
            {"name": "owner_name", "type": "string", "required": False},
            {"name": "account_id", "type": "string", "required": False},
            {"name": "account_name", "type": "string", "required": False},
            {"name": "contact_email", "type": "string", "required": False},
            {"name": "contact_phone", "type": "string", "required": False},
            {"name": "close_date", "type": "datetime", "required": False},
            {"name": "created_at", "type": "datetime", "required": False},
            {"name": "updated_at", "type": "datetime", "required": False}
        ]
    },
    "account": {
        "fields": [
            {"name": "canonical_id", "type": "string", "required": True},
            {"name": "name", "type": "string", "required": True},
            {"name": "industry", "type": "string", "required": False},
            {"name": "type", "type": "string", "required": False},
            {"name": "phone", "type": "string", "required": False},
            {"name": "website", "type": "string", "required": False},
            {"name": "email", "type": "string", "required": False},
            {"name": "address", "type": "string", "required": False},
            {"name": "owner_name", "type": "string", "required": False}
        ]
    },
    "contact": {
        "fields": [
            {"name": "canonical_id", "type": "string", "required": True},
            {"name": "name", "type": "string", "required": True},
            {"name": "email", "type": "string", "required": False},
            {"name": "phone", "type": "string", "required": False},
            {"name": "company", "type": "string", "required": False},
            {"name": "title", "type": "string", "required": False}
        ]
    },
    "user": {
        "fields": [
            {"name": "canonical_id", "type": "string", "required": True},
            {"name": "name", "type": "string", "required": True},
            {"name": "email", "type": "string", "required": False},
            {"name": "team", "type": "string", "required": False}
        ]
    }
}
