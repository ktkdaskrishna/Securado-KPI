"""RBAC Service Models"""
from pydantic import BaseModel
from typing import Optional, List

# Comprehensive permission definitions
ALL_PERMISSIONS = [
    # Dashboard
    "view_dashboard",
    "manage_dashboard",
    
    # ETL - Connections
    "view_connections",
    "manage_connections",
    "test_connections",
    "delete_connections",
    
    # ETL - Mappings
    "view_mappings",
    "manage_mappings",
    "delete_mappings",
    
    # ETL - Pipelines
    "view_pipelines",
    "manage_pipelines",
    "run_pipelines",
    "delete_pipelines",
    
    # ETL - Runs
    "view_runs",
    "cancel_runs",
    
    # ETL - DLQ
    "view_dlq",
    "manage_dlq",
    "retry_dlq",
    
    # CRM - Opportunities
    "view_opportunities",
    "manage_opportunities",
    "update_stage",
    "update_probability",
    "delete_opportunities",
    
    # CRM - Accounts
    "view_accounts",
    "manage_accounts",
    "delete_accounts",
    
    # CRM - Activities
    "view_activities",
    "manage_activities",
    "delete_activities",
    
    # CRM - Goals
    "view_goals",
    "manage_goals",
    
    # CRM - Teams
    "view_teams",
    "manage_teams",
    
    # CRM - KPIs
    "view_kpis",
    "manage_kpis",
    
    # Admin - Users
    "view_users",
    "manage_users",
    "approve_users",
    "delete_users",
    
    # Admin - Roles
    "view_roles",
    "manage_roles",
    "delete_roles",
    
    # Admin - Departments
    "view_departments",
    "manage_departments",
    
    # Admin - Config
    "view_config",
    "manage_config",
    
    # Admin - Audit
    "view_audit_logs",
    
    # CRM - Leads
    "view_leads",
    "manage_leads",
    
    # CRM - Invoices
    "view_invoices",
    "manage_invoices",
    
    # AI Analytics
    "view_analytics",
    
    # Dashboard Builder
    "manage_dashboard_builder",
    "manage_templates",
    "manage_cards",
    
    # Performance Hub & Targets
    "view_performance",
    "manage_targets",
    "manage_incentives",
    
    # Organization
    "view_org_structure",
    
    # Integrations & Sync
    "view_integrations",
    "manage_sync",
    
    # Settings
    "view_settings",
    "manage_sso",
    
    # RBAC Management
    "view_rbac",
    "manage_rbac",
    
    # Super admin
    "admin:*"
]

# Default permissions grouped by resource
DEFAULT_PERMISSIONS = [
    # Dashboard
    {"name": "view_dashboard", "resource": "dashboard", "action": "view", "description": "View dashboard"},
    {"name": "manage_dashboard", "resource": "dashboard", "action": "manage", "description": "Customize dashboard"},
    
    # Connections
    {"name": "view_connections", "resource": "connections", "action": "view", "description": "View data connections"},
    {"name": "manage_connections", "resource": "connections", "action": "manage", "description": "Create/edit connections"},
    {"name": "test_connections", "resource": "connections", "action": "test", "description": "Test connections"},
    {"name": "delete_connections", "resource": "connections", "action": "delete", "description": "Delete connections"},
    
    # Mappings
    {"name": "view_mappings", "resource": "mappings", "action": "view", "description": "View field mappings"},
    {"name": "manage_mappings", "resource": "mappings", "action": "manage", "description": "Create/edit mappings"},
    {"name": "delete_mappings", "resource": "mappings", "action": "delete", "description": "Delete mappings"},
    
    # Pipelines
    {"name": "view_pipelines", "resource": "pipelines", "action": "view", "description": "View pipelines"},
    {"name": "manage_pipelines", "resource": "pipelines", "action": "manage", "description": "Create/edit pipelines"},
    {"name": "run_pipelines", "resource": "pipelines", "action": "run", "description": "Execute pipelines"},
    {"name": "delete_pipelines", "resource": "pipelines", "action": "delete", "description": "Delete pipelines"},
    
    # Runs
    {"name": "view_runs", "resource": "runs", "action": "view", "description": "View run history"},
    {"name": "cancel_runs", "resource": "runs", "action": "cancel", "description": "Cancel running pipelines"},
    
    # DLQ
    {"name": "view_dlq", "resource": "dlq", "action": "view", "description": "View dead letter queue"},
    {"name": "manage_dlq", "resource": "dlq", "action": "manage", "description": "Manage DLQ items"},
    {"name": "retry_dlq", "resource": "dlq", "action": "retry", "description": "Retry DLQ items"},
    
    # Opportunities
    {"name": "view_opportunities", "resource": "opportunities", "action": "view", "description": "View opportunities"},
    {"name": "manage_opportunities", "resource": "opportunities", "action": "manage", "description": "Edit opportunities"},
    {"name": "update_stage", "resource": "opportunities", "action": "update_stage", "description": "Update opportunity stage"},
    {"name": "update_probability", "resource": "opportunities", "action": "update_probability", "description": "Update probability"},
    {"name": "delete_opportunities", "resource": "opportunities", "action": "delete", "description": "Delete opportunities"},
    
    # Accounts
    {"name": "view_accounts", "resource": "accounts", "action": "view", "description": "View accounts"},
    {"name": "manage_accounts", "resource": "accounts", "action": "manage", "description": "Create/edit accounts"},
    {"name": "delete_accounts", "resource": "accounts", "action": "delete", "description": "Delete accounts"},
    
    # Activities
    {"name": "view_activities", "resource": "activities", "action": "view", "description": "View activities"},
    {"name": "manage_activities", "resource": "activities", "action": "manage", "description": "Create/edit activities"},
    {"name": "delete_activities", "resource": "activities", "action": "delete", "description": "Delete activities"},
    
    # Goals
    {"name": "view_goals", "resource": "goals", "action": "view", "description": "View goals"},
    {"name": "manage_goals", "resource": "goals", "action": "manage", "description": "Create/edit goals"},
    
    # Teams
    {"name": "view_teams", "resource": "teams", "action": "view", "description": "View teams"},
    {"name": "manage_teams", "resource": "teams", "action": "manage", "description": "Create/edit teams"},
    
    # KPIs
    {"name": "view_kpis", "resource": "kpis", "action": "view", "description": "View KPIs"},
    {"name": "manage_kpis", "resource": "kpis", "action": "manage", "description": "Create/edit KPIs"},
    
    # Users
    {"name": "view_users", "resource": "users", "action": "view", "description": "View users"},
    {"name": "manage_users", "resource": "users", "action": "manage", "description": "Manage users"},
    {"name": "approve_users", "resource": "users", "action": "approve", "description": "Approve user registrations"},
    {"name": "delete_users", "resource": "users", "action": "delete", "description": "Delete users"},
    
    # Roles
    {"name": "view_roles", "resource": "roles", "action": "view", "description": "View roles"},
    {"name": "manage_roles", "resource": "roles", "action": "manage", "description": "Create/edit roles"},
    {"name": "delete_roles", "resource": "roles", "action": "delete", "description": "Delete roles"},
    
    # Departments
    {"name": "view_departments", "resource": "departments", "action": "view", "description": "View departments"},
    {"name": "manage_departments", "resource": "departments", "action": "manage", "description": "Create/edit departments"},
    {"name": "delete_departments", "resource": "departments", "action": "delete", "description": "Delete departments"},
    
    # Config
    {"name": "view_config", "resource": "config", "action": "view", "description": "View system config"},
    {"name": "manage_config", "resource": "config", "action": "manage", "description": "Edit system config"},
    
    # Audit
    {"name": "view_audit_logs", "resource": "audit", "action": "view", "description": "View audit logs"},
    
    # Leads
    {"name": "view_leads", "resource": "leads", "action": "view", "description": "View leads"},
    {"name": "manage_leads", "resource": "leads", "action": "manage", "description": "Create/edit leads"},
    
    # Invoices
    {"name": "view_invoices", "resource": "invoices", "action": "view", "description": "View invoices"},
    {"name": "manage_invoices", "resource": "invoices", "action": "manage", "description": "Manage invoices"},
    
    # AI Analytics
    {"name": "view_analytics", "resource": "analytics", "action": "view", "description": "View AI analytics"},
    
    # Dashboard Builder
    {"name": "manage_dashboard_builder", "resource": "dashboard_builder", "action": "manage", "description": "Access dashboard builder"},
    {"name": "manage_templates", "resource": "dashboard_builder", "action": "manage_templates", "description": "Create/edit dashboard templates"},
    {"name": "manage_cards", "resource": "dashboard_builder", "action": "manage_cards", "description": "Create/edit dashboard cards"},
    
    # Performance Hub & Targets
    {"name": "view_performance", "resource": "performance", "action": "view", "description": "View Performance Hub"},
    {"name": "manage_targets", "resource": "performance", "action": "manage_targets", "description": "Create/edit sales targets"},
    {"name": "manage_incentives", "resource": "performance", "action": "manage_incentives", "description": "Manage incentive plans"},
    
    # Organization
    {"name": "view_org_structure", "resource": "organization", "action": "view", "description": "View org structure"},
    
    # Integrations & Sync
    {"name": "view_integrations", "resource": "integrations", "action": "view", "description": "View integrations/sync status"},
    {"name": "manage_sync", "resource": "integrations", "action": "manage", "description": "Control data sync"},
    
    # Settings
    {"name": "view_settings", "resource": "settings", "action": "view", "description": "View system settings"},
    {"name": "manage_sso", "resource": "settings", "action": "manage_sso", "description": "Configure Microsoft SSO"},
    
    # RBAC Management
    {"name": "view_rbac", "resource": "rbac", "action": "view", "description": "View RBAC configuration"},
    {"name": "manage_rbac", "resource": "rbac", "action": "manage", "description": "Manage RBAC rules/overrides"},
]


class PermissionCreate(BaseModel):
    name: str
    resource: str
    action: str
    description: Optional[str] = None


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
