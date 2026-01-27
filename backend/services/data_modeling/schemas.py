"""Canonical Entity Schemas (Pydantic Models)

These schemas define the canonical data model for the Sales KPI system.
All incoming data from Odoo and other sources is transformed into these
canonical entities before loading.

Identity Rules:
- Every record has: org_id, source_system, source_record_id, canonical_id
- canonical_id = {source_system}_{entity}_{source_record_id}

Null Handling:
- Odoo `false` -> Python `None`
- Empty arrays remain []
- Numeric 0 stays 0 (not nulled)
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, date
from enum import Enum


class BaseCanonicalEntity(BaseModel):
    """Base class for all canonical entities"""
    canonical_id: str = Field(..., description="Unique ID: {source_system}_{entity}_{source_record_id}")
    org_id: str = Field(..., description="Organization/tenant ID")
    source_system: str = Field(..., description="Source system (e.g., odoo, salesforce)")
    source_record_id: str = Field(..., description="Original record ID in source system")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        extra = "allow"  # Allow additional fields for flexibility


class SalesUser(BaseCanonicalEntity):
    """Salesperson/User who manages accounts and opportunities"""
    name: str
    email: Optional[str] = None
    login: Optional[str] = None
    active: bool = True
    team_id: Optional[str] = None  # FK to SalesTeam
    team_name: Optional[str] = None


class SalesTeam(BaseCanonicalEntity):
    """Team of salespeople managing opportunities"""
    name: str
    use_opportunities: bool = True
    use_leads: bool = True
    alias_name: Optional[str] = None
    alias_domain: Optional[str] = None
    invoiced: float = 0.0
    invoiced_target: float = 0.0
    member_ids: List[str] = Field(default_factory=list)
    active: bool = True


class Account(BaseCanonicalEntity):
    """Company or organization (customer/prospect)"""
    name: str
    industry: Optional[str] = None
    type: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    owner_id: Optional[str] = None  # FK to SalesUser
    owner_name: Optional[str] = None
    currency: str = "USD"
    customer_rank: int = 0
    active: bool = True


class Contact(BaseCanonicalEntity):
    """Individual person/contact at an account"""
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    title: Optional[str] = None
    function: Optional[str] = None
    account_id: Optional[str] = None  # FK to Account
    account_name: Optional[str] = None
    active: bool = True


class Opportunity(BaseCanonicalEntity):
    """Sales opportunity/deal in the pipeline"""
    name: str
    account_id: Optional[str] = None  # FK to Account
    account_name: Optional[str] = None
    contact_id: Optional[str] = None  # FK to Contact
    owner_id: Optional[str] = None  # FK to SalesUser
    owner_name: Optional[str] = None
    team_id: Optional[str] = None  # FK to SalesTeam
    team_name: Optional[str] = None
    stage: Optional[str] = None
    stage_id: Optional[str] = None
    probability: float = 0.0
    amount: float = 0.0
    currency: str = "USD"
    is_closed: bool = False
    is_won: bool = False
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    date_open: Optional[datetime] = None
    close_date: Optional[date] = None
    lost_reason: Optional[str] = None
    activity_ids: List[str] = Field(default_factory=list)
    invoice_ids: List[str] = Field(default_factory=list)
    task_ids: List[str] = Field(default_factory=list)


class ActivityType(str, Enum):
    CALL = "call"
    MEETING = "meeting"
    EMAIL = "email"
    TODO = "todo"
    OTHER = "other"


class Activity(BaseCanonicalEntity):
    """Activity/task linked to an opportunity or account"""
    summary: Optional[str] = None
    activity_type: Optional[str] = None
    note: Optional[str] = None
    date_deadline: Optional[date] = None
    opportunity_id: Optional[str] = None  # FK to Opportunity
    account_id: Optional[str] = None  # FK to Account
    user_id: Optional[str] = None  # FK to SalesUser
    state: Optional[str] = None


class InvoiceState(str, Enum):
    DRAFT = "draft"
    POSTED = "posted"
    CANCEL = "cancel"


class PaymentState(str, Enum):
    NOT_PAID = "not_paid"
    IN_PAYMENT = "in_payment"
    PAID = "paid"
    PARTIAL = "partial"
    REVERSED = "reversed"


class Invoice(BaseCanonicalEntity):
    """Customer invoice"""
    invoice_number: Optional[str] = None
    account_id: Optional[str] = None  # FK to Account
    account_name: Optional[str] = None
    opportunity_id: Optional[str] = None  # FK to Opportunity
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    amount_untaxed: float = 0.0
    amount_tax: float = 0.0
    amount_total: float = 0.0
    currency: str = "USD"
    state: Optional[str] = None
    payment_state: Optional[str] = None


class Task(BaseCanonicalEntity):
    """Project task/to-do item"""
    name: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    opportunity_id: Optional[str] = None  # FK to Opportunity
    assignee_id: Optional[str] = None  # FK to Employee
    assignee_name: Optional[str] = None
    stage: Optional[str] = None
    priority: Optional[str] = None
    date_deadline: Optional[date] = None
    planned_hours: float = 0.0
    effective_hours: float = 0.0
    state: Optional[str] = None


class Employee(BaseCanonicalEntity):
    """HR Employee record"""
    name: str
    email: Optional[str] = None
    work_phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    manager_id: Optional[str] = None  # FK to Employee
    user_id: Optional[str] = None  # FK to SalesUser
    active: bool = True


# Entity type to Pydantic model mapping
ENTITY_MODELS = {
    "sales_user": SalesUser,
    "sales_team": SalesTeam,
    "account": Account,
    "contact": Contact,
    "opportunity": Opportunity,
    "activity": Activity,
    "invoice": Invoice,
    "task": Task,
    "employee": Employee,
}

# Source model to entity mapping
SOURCE_MODEL_TO_ENTITY = {
    "res.users": "sales_user",
    "crm.team": "sales_team",
    "res.partner": "account",  # or contact based on is_company
    "crm.lead": "opportunity",
    "mail.activity": "activity",
    "account.move": "invoice",
    "project.task": "task",
    "hr.employee": "employee",
}
