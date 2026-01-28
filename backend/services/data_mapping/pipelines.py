"""
Data Mapping Pipeline Configuration
====================================
This module defines all ETL field mappings for syncing data from Odoo to our canonical database.

IMPORTANT: All agents must read /app/docs/CRM_DATA_MODEL_REFERENCE.md before modifying this file.

Usage:
    from services.data_mapping.pipelines import PIPELINE_CONFIGS
    
    # Get all pipeline configs
    configs = PIPELINE_CONFIGS
    
    # Get specific mapping
    activity_mapping = PIPELINE_CONFIGS['mail.activity']
"""

from typing import Dict, List, Any
from datetime import datetime

# ==================== PIPELINE CONFIGURATIONS ====================

PIPELINE_CONFIGS: Dict[str, Dict[str, Any]] = {
    
    # ==================== CRM LEAD (Opportunities) ====================
    "crm.lead": {
        "source_model": "crm.lead",
        "target_collection": "opportunities",
        "target_entity": "opportunity",
        "description": "CRM Opportunities/Leads from Odoo",
        "sync_mode": "incremental",  # full, incremental, delta
        "primary_key": "id",
        "mappings": [
            # Core identifiers
            {"source_field": "id", "target_field": "canonical_id", "transform": "to_string"},
            {"source_field": "id", "target_field": "source_record_id", "transform": "to_string"},
            
            # Basic info
            {"source_field": "name", "target_field": "name", "transform": "direct"},
            {"source_field": "type", "target_field": "lead_type", "transform": "direct"},
            {"source_field": "active", "target_field": "active", "transform": "direct"},
            
            # Financial
            {"source_field": "expected_revenue", "target_field": "expected_revenue", "transform": "to_float"},
            {"source_field": "x_studio_sale_value", "target_field": "sale_value", "transform": "to_float"},
            {"source_field": "probability", "target_field": "probability", "transform": "to_float"},
            
            # Stage
            {"source_field": "stage_id", "target_field": "stage_name", "transform": "extract_name"},
            {"source_field": "stage_id", "target_field": "stage_id", "transform": "extract_id"},
            
            # Owner/Salesperson
            {"source_field": "user_id", "target_field": "owner_name", "transform": "extract_name"},
            {"source_field": "user_id", "target_field": "owner_id", "transform": "extract_id"},
            
            # Team
            {"source_field": "team_id", "target_field": "team_name", "transform": "extract_name"},
            {"source_field": "team_id", "target_field": "team_id", "transform": "extract_id"},
            
            # Account/Partner
            {"source_field": "partner_id", "target_field": "account_name", "transform": "extract_name"},
            {"source_field": "partner_id", "target_field": "account_id", "transform": "extract_id"},
            
            # Dates
            {"source_field": "date_deadline", "target_field": "expected_closing", "transform": "direct"},
            {"source_field": "create_date", "target_field": "created_at", "transform": "direct"},
            {"source_field": "write_date", "target_field": "updated_at", "transform": "direct"},
            {"source_field": "date_closed", "target_field": "date_closed", "transform": "direct"},
            {"source_field": "date_last_stage_update", "target_field": "won_at", "transform": "direct"},
            {"source_field": "date_open", "target_field": "date_open", "transform": "direct"},
            
            # Custom fields (Securado-specific)
            {"source_field": "x_studio_solution_category", "target_field": "solution_category", "transform": "extract_name"},
            {"source_field": "x_studio_product_manager", "target_field": "product_manager", "transform": "extract_name"},
            {"source_field": "x_studio_product_manager", "target_field": "product_manager_id", "transform": "extract_id"},
            {"source_field": "x_studio_budget_status", "target_field": "budget_status", "transform": "direct"},
            {"source_field": "x_studio_opportunity_number", "target_field": "opportunity_number", "transform": "direct"},
            
            # Contact info
            {"source_field": "email_from", "target_field": "contact_email", "transform": "direct"},
            {"source_field": "phone", "target_field": "contact_phone", "transform": "direct"},
            {"source_field": "contact_name", "target_field": "contact_name", "transform": "direct"},
            
            # Additional
            {"source_field": "description", "target_field": "description", "transform": "direct"},
            {"source_field": "priority", "target_field": "priority", "transform": "direct"},
            {"source_field": "lost_reason_id", "target_field": "lost_reason", "transform": "extract_name"},
        ],
        "filters": {
            "type": ["opportunity", "lead"],  # Sync both types
        },
        "post_process": [
            {"action": "set_source_system", "value": "odoo"},
        ]
    },
    
    # ==================== MAIL ACTIVITY ====================
    "mail.activity": {
        "source_model": "mail.activity",
        "target_collection": "activities",
        "target_entity": "activity",
        "description": "Activities (Calls, Meetings, Tasks, etc.) from Odoo",
        "sync_mode": "incremental",
        "primary_key": "id",
        "mappings": [
            # Core identifiers
            {"source_field": "id", "target_field": "canonical_id", "transform": "to_string"},
            {"source_field": "id", "target_field": "source_record_id", "transform": "to_string"},
            
            # Link to opportunity - CRITICAL
            {"source_field": "res_id", "target_field": "opportunity_id", "transform": "to_int"},
            {"source_field": "res_id", "target_field": "res_id", "transform": "to_int"},
            {"source_field": "res_model", "target_field": "res_model", "transform": "direct"},
            {"source_field": "res_name", "target_field": "res_name", "transform": "direct"},
            
            # Activity details
            {"source_field": "summary", "target_field": "summary", "transform": "direct"},
            {"source_field": "note", "target_field": "note", "transform": "direct"},
            {"source_field": "activity_type_id", "target_field": "activity_type", "transform": "extract_name"},
            {"source_field": "activity_type_id", "target_field": "activity_type_id", "transform": "extract_id"},
            
            # Assigned user
            {"source_field": "user_id", "target_field": "assigned_user", "transform": "extract_name"},
            {"source_field": "user_id", "target_field": "assigned_user_id", "transform": "extract_id"},
            
            # Dates
            {"source_field": "date_deadline", "target_field": "date_deadline", "transform": "direct"},
            {"source_field": "create_date", "target_field": "created_at", "transform": "direct"},
            {"source_field": "write_date", "target_field": "updated_at", "transform": "direct"},
            
            # Status
            {"source_field": "state", "target_field": "state", "transform": "direct"},
        ],
        "filters": {
            "res_model": ["crm.lead"],  # Only sync CRM activities
        },
        "post_process": [
            {"action": "set_source_system", "value": "odoo"},
            {"action": "set_field", "field": "res_model", "value": "crm.lead"},
        ]
    },
    
    # ==================== CRM ACTIVITY REPORT (Alternative activity source) ====================
    "crm.activity.report": {
        "source_model": "crm.activity.report",
        "target_collection": "activities",
        "target_entity": "activity",
        "description": "CRM Activity Report - provides better linking to opportunities",
        "sync_mode": "incremental",
        "primary_key": "id",
        "mappings": [
            # Core identifiers
            {"source_field": "id", "target_field": "canonical_id", "transform": "to_string"},
            {"source_field": "id", "target_field": "source_record_id", "transform": "to_string"},
            
            # Link to opportunity - DIRECT link via lead_id
            {"source_field": "lead_id", "target_field": "opportunity_id", "transform": "extract_id"},
            {"source_field": "lead_id", "target_field": "opportunity_name", "transform": "extract_name"},
            
            # Activity details
            {"source_field": "activity_type_id", "target_field": "activity_type", "transform": "extract_name"},
            {"source_field": "activity_type_id", "target_field": "activity_type_id", "transform": "extract_id"},
            
            # Users
            {"source_field": "user_id", "target_field": "assigned_user", "transform": "extract_name"},
            {"source_field": "user_id", "target_field": "assigned_user_id", "transform": "extract_id"},
            {"source_field": "author_id", "target_field": "author", "transform": "extract_name"},
            {"source_field": "author_id", "target_field": "author_id", "transform": "extract_id"},
            
            # Dates
            {"source_field": "date_deadline", "target_field": "date_deadline", "transform": "direct"},
            {"source_field": "create_date", "target_field": "created_at", "transform": "direct"},
        ],
        "post_process": [
            {"action": "set_source_system", "value": "odoo"},
            {"action": "set_field", "field": "res_model", "value": "crm.lead"},
        ]
    },
    
    # ==================== MAIL MESSAGE (Log messages/Chatter) ====================
    "mail.message": {
        "source_model": "mail.message",
        "target_collection": "log_messages",
        "target_entity": "log_message",
        "description": "Log messages (Chatter history) from Odoo",
        "sync_mode": "incremental",
        "primary_key": "id",
        "mappings": [
            # Core identifiers
            {"source_field": "id", "target_field": "canonical_id", "transform": "to_string"},
            {"source_field": "id", "target_field": "source_record_id", "transform": "to_string"},
            
            # Link to opportunity
            {"source_field": "res_id", "target_field": "opportunity_id", "transform": "to_int"},
            {"source_field": "res_id", "target_field": "res_id", "transform": "to_int"},
            {"source_field": "model", "target_field": "res_model", "transform": "direct"},
            
            # Message content
            {"source_field": "subject", "target_field": "subject", "transform": "direct"},
            {"source_field": "body", "target_field": "body", "transform": "direct"},
            {"source_field": "preview", "target_field": "preview", "transform": "direct"},
            
            # Author
            {"source_field": "author_id", "target_field": "author_name", "transform": "extract_name"},
            {"source_field": "author_id", "target_field": "author_id", "transform": "extract_id"},
            
            # Dates
            {"source_field": "date", "target_field": "date", "transform": "direct"},
            {"source_field": "create_date", "target_field": "created_at", "transform": "direct"},
            
            # Type
            {"source_field": "message_type", "target_field": "message_type", "transform": "direct"},
            {"source_field": "subtype_id", "target_field": "subtype", "transform": "extract_name"},
        ],
        "filters": {
            "model": ["crm.lead"],  # Only sync CRM messages
            "message_type": ["comment", "notification", "email"],
        },
        "post_process": [
            {"action": "set_source_system", "value": "odoo"},
            {"action": "clean_html", "field": "body", "target": "body_clean"},
        ]
    },
    
    # ==================== RES PARTNER (Accounts/Contacts) ====================
    "res.partner": {
        "source_model": "res.partner",
        "target_collection": "accounts",
        "target_entity": "account",
        "description": "Partners (Companies and Contacts) from Odoo",
        "sync_mode": "incremental",
        "primary_key": "id",
        "mappings": [
            # Core identifiers
            {"source_field": "id", "target_field": "canonical_id", "transform": "to_string"},
            {"source_field": "id", "target_field": "source_record_id", "transform": "to_string"},
            
            # Basic info
            {"source_field": "name", "target_field": "name", "transform": "direct"},
            {"source_field": "display_name", "target_field": "display_name", "transform": "direct"},
            {"source_field": "is_company", "target_field": "is_company", "transform": "direct"},
            {"source_field": "active", "target_field": "active", "transform": "direct"},
            
            # Contact info
            {"source_field": "email", "target_field": "email", "transform": "direct"},
            {"source_field": "phone", "target_field": "phone", "transform": "direct"},
            {"source_field": "mobile", "target_field": "mobile", "transform": "direct"},
            {"source_field": "website", "target_field": "website", "transform": "direct"},
            
            # Address
            {"source_field": "street", "target_field": "street", "transform": "direct"},
            {"source_field": "street2", "target_field": "street2", "transform": "direct"},
            {"source_field": "city", "target_field": "city", "transform": "direct"},
            {"source_field": "state_id", "target_field": "state", "transform": "extract_name"},
            {"source_field": "country_id", "target_field": "country", "transform": "extract_name"},
            {"source_field": "zip", "target_field": "zip", "transform": "direct"},
            
            # Business info
            {"source_field": "industry_id", "target_field": "industry", "transform": "extract_name"},
            {"source_field": "company_type", "target_field": "company_type", "transform": "direct"},
            {"source_field": "vat", "target_field": "vat", "transform": "direct"},
            
            # Parent company
            {"source_field": "parent_id", "target_field": "parent_company", "transform": "extract_name"},
            {"source_field": "parent_id", "target_field": "parent_company_id", "transform": "extract_id"},
            
            # Salesperson
            {"source_field": "user_id", "target_field": "salesperson", "transform": "extract_name"},
            {"source_field": "user_id", "target_field": "salesperson_id", "transform": "extract_id"},
            
            # Dates
            {"source_field": "create_date", "target_field": "created_at", "transform": "direct"},
            {"source_field": "write_date", "target_field": "updated_at", "transform": "direct"},
        ],
        "post_process": [
            {"action": "set_source_system", "value": "odoo"},
        ]
    },
    
    # ==================== ACCOUNT MOVE (Invoices) ====================
    "account.move": {
        "source_model": "account.move",
        "target_collection": "invoices",
        "target_entity": "invoice",
        "description": "Invoices from Odoo",
        "sync_mode": "incremental",
        "primary_key": "id",
        "mappings": [
            # Core identifiers
            {"source_field": "id", "target_field": "canonical_id", "transform": "to_string"},
            {"source_field": "id", "target_field": "source_record_id", "transform": "to_string"},
            {"source_field": "name", "target_field": "invoice_number", "transform": "direct"},
            
            # Partner/Account
            {"source_field": "partner_id", "target_field": "account", "transform": "extract_name"},
            {"source_field": "partner_id", "target_field": "account_id", "transform": "extract_id"},
            
            # Amounts
            {"source_field": "amount_total", "target_field": "amount", "transform": "to_float"},
            {"source_field": "amount_residual", "target_field": "amount_due", "transform": "to_float"},
            {"source_field": "amount_untaxed", "target_field": "amount_untaxed", "transform": "to_float"},
            {"source_field": "amount_tax", "target_field": "amount_tax", "transform": "to_float"},
            
            # Dates
            {"source_field": "invoice_date", "target_field": "invoice_date", "transform": "direct"},
            {"source_field": "invoice_date_due", "target_field": "due_date", "transform": "direct"},
            {"source_field": "date", "target_field": "date", "transform": "direct"},
            {"source_field": "create_date", "target_field": "created_at", "transform": "direct"},
            
            # Status
            {"source_field": "state", "target_field": "state", "transform": "direct"},
            {"source_field": "payment_state", "target_field": "payment_state", "transform": "direct"},
            
            # Type
            {"source_field": "move_type", "target_field": "move_type", "transform": "direct"},
            
            # Salesperson
            {"source_field": "invoice_user_id", "target_field": "salesperson", "transform": "extract_name"},
            {"source_field": "invoice_user_id", "target_field": "salesperson_id", "transform": "extract_id"},
            
            # Currency
            {"source_field": "currency_id", "target_field": "currency", "transform": "extract_name"},
        ],
        "filters": {
            "move_type": ["out_invoice", "out_refund"],  # Customer invoices only
            "state": ["posted"],  # Only posted invoices
        },
        "post_process": [
            {"action": "set_source_system", "value": "odoo"},
            {"action": "calculate_status"},
        ]
    },
    
    # ==================== RES USERS (Users/Salespeople) ====================
    "res.users": {
        "source_model": "res.users",
        "target_collection": "users",
        "target_entity": "user",
        "description": "Users from Odoo",
        "sync_mode": "full",
        "primary_key": "id",
        "mappings": [
            # Core identifiers
            {"source_field": "id", "target_field": "odoo_id", "transform": "to_int"},
            {"source_field": "login", "target_field": "email", "transform": "direct"},
            
            # Name
            {"source_field": "name", "target_field": "name", "transform": "direct"},
            {"source_field": "display_name", "target_field": "display_name", "transform": "direct"},
            
            # Partner link
            {"source_field": "partner_id", "target_field": "partner_id", "transform": "extract_id"},
            
            # Active
            {"source_field": "active", "target_field": "active", "transform": "direct"},
            
            # Groups (for RBAC)
            {"source_field": "groups_id", "target_field": "odoo_groups", "transform": "direct"},
            
            # Sales team
            {"source_field": "sale_team_id", "target_field": "team_name", "transform": "extract_name"},
            {"source_field": "sale_team_id", "target_field": "team_id", "transform": "extract_id"},
        ],
        "post_process": [
            {"action": "set_source_system", "value": "odoo"},
        ]
    },
    
    # ==================== CRM TEAM (Sales Teams) ====================
    "crm.team": {
        "source_model": "crm.team",
        "target_collection": "teams",
        "target_entity": "team",
        "description": "Sales Teams from Odoo",
        "sync_mode": "full",
        "primary_key": "id",
        "mappings": [
            # Core identifiers
            {"source_field": "id", "target_field": "canonical_id", "transform": "to_string"},
            {"source_field": "id", "target_field": "source_record_id", "transform": "to_string"},
            
            # Team info
            {"source_field": "name", "target_field": "name", "transform": "direct"},
            {"source_field": "active", "target_field": "active", "transform": "direct"},
            
            # Leader
            {"source_field": "user_id", "target_field": "leader_name", "transform": "extract_name"},
            {"source_field": "user_id", "target_field": "leader_id", "transform": "extract_id"},
            
            # Members
            {"source_field": "member_ids", "target_field": "member_ids", "transform": "direct"},
        ],
        "post_process": [
            {"action": "set_source_system", "value": "odoo"},
        ]
    },
    
    # ==================== CRM STAGE (Pipeline Stages) ====================
    "crm.stage": {
        "source_model": "crm.stage",
        "target_collection": "stages",
        "target_entity": "stage",
        "description": "CRM Pipeline Stages from Odoo",
        "sync_mode": "full",
        "primary_key": "id",
        "mappings": [
            # Core identifiers
            {"source_field": "id", "target_field": "canonical_id", "transform": "to_string"},
            {"source_field": "id", "target_field": "source_record_id", "transform": "to_string"},
            
            # Stage info
            {"source_field": "name", "target_field": "name", "transform": "direct"},
            {"source_field": "sequence", "target_field": "sequence", "transform": "to_int"},
            {"source_field": "is_won", "target_field": "is_won", "transform": "direct"},
            {"source_field": "fold", "target_field": "fold", "transform": "direct"},
            
            # Team
            {"source_field": "team_id", "target_field": "team_name", "transform": "extract_name"},
            {"source_field": "team_id", "target_field": "team_id", "transform": "extract_id"},
            
            # Requirements
            {"source_field": "requirements", "target_field": "requirements", "transform": "direct"},
        ],
        "post_process": [
            {"action": "set_source_system", "value": "odoo"},
        ]
    },
}


# ==================== TRANSFORM FUNCTIONS ====================

TRANSFORM_FUNCTIONS = {
    "direct": lambda v: v,
    "to_string": lambda v: str(v) if v is not None else None,
    "to_int": lambda v: int(v) if v is not None and str(v).isdigit() else (int(v) if isinstance(v, (int, float)) else None),
    "to_float": lambda v: float(v) if v is not None else 0.0,
    "extract_name": lambda v: v[1] if isinstance(v, (list, tuple)) and len(v) >= 2 else (v if isinstance(v, str) else None),
    "extract_id": lambda v: v[0] if isinstance(v, (list, tuple)) and len(v) >= 1 else (v if isinstance(v, (int, str)) else None),
    "to_bool": lambda v: bool(v) if v is not None else False,
    "clean_html": lambda v: __import__('re').sub('<[^>]+>', '', str(v)).strip() if v else None,
}


def apply_transform(value: Any, transform: str) -> Any:
    """Apply a transformation to a value."""
    if transform in TRANSFORM_FUNCTIONS:
        try:
            return TRANSFORM_FUNCTIONS[transform](value)
        except Exception as e:
            return None
    return value


def transform_record(record: Dict, mappings: List[Dict]) -> Dict:
    """Transform a source record using field mappings."""
    result = {}
    for mapping in mappings:
        source_field = mapping.get("source_field")
        target_field = mapping.get("target_field")
        transform = mapping.get("transform", "direct")
        
        if source_field in record:
            value = record[source_field]
            result[target_field] = apply_transform(value, transform)
    
    return result


# ==================== PIPELINE HELPERS ====================

def get_pipeline_config(source_model: str) -> Dict:
    """Get pipeline configuration for a source model."""
    return PIPELINE_CONFIGS.get(source_model)


def get_all_pipeline_configs() -> Dict:
    """Get all pipeline configurations."""
    return PIPELINE_CONFIGS


def list_available_pipelines() -> List[str]:
    """List all available pipeline source models."""
    return list(PIPELINE_CONFIGS.keys())


# ==================== VALIDATION ====================

def validate_mapping(mapping: Dict) -> bool:
    """Validate a field mapping configuration."""
    required_fields = ["source_field", "target_field"]
    return all(field in mapping for field in required_fields)


def validate_pipeline_config(config: Dict) -> bool:
    """Validate a pipeline configuration."""
    required_fields = ["source_model", "target_collection", "mappings"]
    if not all(field in config for field in required_fields):
        return False
    
    # Validate all mappings
    for mapping in config.get("mappings", []):
        if not validate_mapping(mapping):
            return False
    
    return True
