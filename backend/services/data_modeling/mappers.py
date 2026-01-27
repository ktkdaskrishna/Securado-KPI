"""Entity Mappers - Transform raw Odoo records to canonical entities

Each mapper:
1. Takes raw JSON from Odoo
2. Normalizes values (false -> None, relational fields -> IDs/names)
3. Returns canonical entity record + relationship edges

Null Handling Rules:
- Odoo `false` -> None for scalars
- Empty list [] stays []
- Numeric 0 stays 0
"""
import logging
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date

from .schemas import (
    SalesUser, SalesTeam, Account, Contact, Opportunity,
    Activity, Invoice, Task, Employee, SOURCE_MODEL_TO_ENTITY
)

logger = logging.getLogger(__name__)


def normalize_value(value: Any) -> Any:
    """Normalize Odoo values to Python types
    
    - false -> None
    - [] stays []
    - 0 stays 0
    - [id, 'name'] tuples -> handled by extract_id/extract_name
    """
    if value is False:
        return None
    return value


def extract_id(value: Any) -> Optional[str]:
    """Extract ID from Odoo relational field [id, 'name'] or return None"""
    if value is False or value is None:
        return None
    if isinstance(value, (list, tuple)) and len(value) >= 1:
        return str(value[0])
    if isinstance(value, (int, str)):
        return str(value)
    return None


def extract_name(value: Any) -> Optional[str]:
    """Extract name from Odoo relational field [id, 'name'] or return None"""
    if value is False or value is None:
        return None
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return str(value[1]) if value[1] else None
    if isinstance(value, str):
        return value
    return None


def extract_ids(value: Any) -> List[str]:
    """Extract list of IDs from Odoo x2many field"""
    if value is False or value is None:
        return []
    if isinstance(value, list):
        return [str(v) for v in value]
    return []


def to_float(value: Any) -> float:
    """Convert to float, default 0"""
    if value is False or value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def to_int(value: Any) -> int:
    """Convert to int, default 0"""
    if value is False or value is None:
        return 0
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return 0


def to_bool(value: Any) -> bool:
    """Convert to bool, default False"""
    if value is False or value is None:
        return False
    return bool(value)


class RelationshipEdge:
    """Represents a relationship edge between two entities"""
    def __init__(
        self,
        relationship_id: str,
        from_entity: str,
        from_id: str,
        to_entity: str,
        to_id: str,
        label: str = ""
    ):
        self.relationship_id = relationship_id
        self.from_entity = from_entity
        self.from_id = from_id
        self.to_entity = to_entity
        self.to_id = to_id
        self.label = label
    
    def to_dict(self) -> Dict:
        return {
            "relationship_id": self.relationship_id,
            "from_entity": self.from_entity,
            "from_id": self.from_id,
            "to_entity": self.to_entity,
            "to_id": self.to_id,
            "label": self.label
        }


class EntityMapper:
    """Base mapper class"""
    entity_type: str = "unknown"
    
    def __init__(self, source_system: str, org_id: str):
        self.source_system = source_system
        self.org_id = org_id
    
    def make_canonical_id(self, source_record_id: str) -> str:
        """Generate canonical_id from source record ID"""
        return f"{self.source_system}_{self.entity_type}_{source_record_id}"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        """Map raw record to canonical entity + relationships
        
        Returns:
            Tuple of (canonical_record_dict, list_of_relationship_edges)
        """
        raise NotImplementedError


class SalesUserMapper(EntityMapper):
    """Map res.users to SalesUser"""
    entity_type = "sales_user"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        source_id = str(record.get('id'))
        canonical_id = self.make_canonical_id(source_id)
        
        result = {
            "canonical_id": canonical_id,
            "org_id": self.org_id,
            "source_system": self.source_system,
            "source_record_id": source_id,
            "name": normalize_value(record.get('name')) or normalize_value(record.get('display_name')) or 'Unknown',
            "email": normalize_value(record.get('email')) or normalize_value(record.get('login')),
            "login": normalize_value(record.get('login')),
            "active": to_bool(record.get('active', True)),
            "team_id": extract_id(record.get('sale_team_id')),
            "team_name": extract_name(record.get('sale_team_id')),
            "created_at": normalize_value(record.get('create_date')),
            "updated_at": normalize_value(record.get('write_date')),
        }
        
        edges = []
        if result["team_id"]:
            edges.append(RelationshipEdge(
                relationship_id="sales_team__sales_user",
                from_entity="sales_team",
                from_id=result["team_id"],
                to_entity="sales_user",
                to_id=source_id,
                label="has member"
            ))
        
        return result, edges


class SalesTeamMapper(EntityMapper):
    """Map crm.team to SalesTeam"""
    entity_type = "sales_team"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        source_id = str(record.get('id'))
        canonical_id = self.make_canonical_id(source_id)
        
        result = {
            "canonical_id": canonical_id,
            "org_id": self.org_id,
            "source_system": self.source_system,
            "source_record_id": source_id,
            "name": normalize_value(record.get('name')) or 'Unknown Team',
            "use_opportunities": to_bool(record.get('use_opportunities', True)),
            "use_leads": to_bool(record.get('use_leads', True)),
            "alias_name": normalize_value(record.get('alias_name')),
            "alias_domain": normalize_value(record.get('alias_domain')),
            "invoiced": to_float(record.get('invoiced')),
            "invoiced_target": to_float(record.get('invoiced_target')),
            "member_ids": extract_ids(record.get('member_ids') or record.get('crm_team_member_ids')),
            "active": to_bool(record.get('active', True)),
            "created_at": normalize_value(record.get('create_date')),
            "updated_at": normalize_value(record.get('write_date')),
        }
        
        return result, []


class AccountMapper(EntityMapper):
    """Map res.partner (is_company=True) to Account"""
    entity_type = "account"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        source_id = str(record.get('id'))
        canonical_id = self.make_canonical_id(source_id)
        
        result = {
            "canonical_id": canonical_id,
            "org_id": self.org_id,
            "source_system": self.source_system,
            "source_record_id": source_id,
            "name": normalize_value(record.get('name')) or 'Unknown Account',
            "industry": extract_name(record.get('industry_id')),
            "type": normalize_value(record.get('company_type')),
            "phone": normalize_value(record.get('phone')),
            "website": normalize_value(record.get('website')),
            "email": normalize_value(record.get('email')),
            "address": normalize_value(record.get('street')),
            "city": normalize_value(record.get('city')),
            "state": extract_name(record.get('state_id')),
            "zip": normalize_value(record.get('zip')),
            "country": extract_name(record.get('country_id')),
            "owner_id": extract_id(record.get('user_id')),
            "owner_name": extract_name(record.get('user_id')),
            "currency": extract_name(record.get('currency_id')) or 'USD',
            "customer_rank": to_int(record.get('customer_rank')),
            "active": to_bool(record.get('active', True)),
            "created_at": normalize_value(record.get('create_date')),
            "updated_at": normalize_value(record.get('write_date')),
        }
        
        edges = []
        if result["owner_id"]:
            edges.append(RelationshipEdge(
                relationship_id="sales_user__account",
                from_entity="sales_user",
                from_id=result["owner_id"],
                to_entity="account",
                to_id=source_id,
                label="owns"
            ))
        
        return result, edges


class ContactMapper(EntityMapper):
    """Map res.partner (is_company=False) to Contact"""
    entity_type = "contact"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        source_id = str(record.get('id'))
        canonical_id = self.make_canonical_id(source_id)
        
        result = {
            "canonical_id": canonical_id,
            "org_id": self.org_id,
            "source_system": self.source_system,
            "source_record_id": source_id,
            "name": normalize_value(record.get('name')) or 'Unknown Contact',
            "email": normalize_value(record.get('email')),
            "phone": normalize_value(record.get('phone')),
            "mobile": normalize_value(record.get('mobile')),
            "title": normalize_value(record.get('title')),
            "function": normalize_value(record.get('function')),
            "account_id": extract_id(record.get('parent_id')),
            "account_name": extract_name(record.get('parent_id')),
            "active": to_bool(record.get('active', True)),
            "created_at": normalize_value(record.get('create_date')),
            "updated_at": normalize_value(record.get('write_date')),
        }
        
        edges = []
        if result["account_id"]:
            edges.append(RelationshipEdge(
                relationship_id="account__contact",
                from_entity="account",
                from_id=result["account_id"],
                to_entity="contact",
                to_id=source_id,
                label="has contact"
            ))
        
        return result, edges


class OpportunityMapper(EntityMapper):
    """Map crm.lead to Opportunity"""
    entity_type = "opportunity"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        source_id = str(record.get('id'))
        canonical_id = self.make_canonical_id(source_id)
        
        result = {
            "canonical_id": canonical_id,
            "org_id": self.org_id,
            "source_system": self.source_system,
            "source_record_id": source_id,
            "name": normalize_value(record.get('name')) or 'Unknown Opportunity',
            "account_id": extract_id(record.get('partner_id')),
            "account_name": extract_name(record.get('partner_id')),
            "contact_id": extract_id(record.get('contact_name')),  # May need adjustment
            "owner_id": extract_id(record.get('user_id')),
            "owner_name": extract_name(record.get('user_id')),
            "team_id": extract_id(record.get('team_id')),
            "team_name": extract_name(record.get('team_id')),
            "stage": extract_name(record.get('stage_id')),
            "stage_id": extract_id(record.get('stage_id')),
            "probability": to_float(record.get('probability')),
            "amount": to_float(record.get('expected_revenue') or record.get('planned_revenue')),
            "currency": extract_name(record.get('currency_id')) or 'USD',
            "is_closed": to_bool(record.get('active') is False),  # Odoo uses active=False for closed
            "is_won": to_bool(record.get('probability') == 100),
            "contact_email": normalize_value(record.get('email_from')),
            "contact_phone": normalize_value(record.get('phone')),
            "date_open": normalize_value(record.get('date_open') or record.get('create_date')),
            "close_date": normalize_value(record.get('date_deadline') or record.get('date_closed')),
            "lost_reason": extract_name(record.get('lost_reason_id')),
            "activity_ids": extract_ids(record.get('activity_ids')),
            "created_at": normalize_value(record.get('create_date')),
            "updated_at": normalize_value(record.get('write_date')),
        }
        
        edges = []
        if result["account_id"]:
            edges.append(RelationshipEdge(
                relationship_id="account__opportunity",
                from_entity="account",
                from_id=result["account_id"],
                to_entity="opportunity",
                to_id=source_id,
                label="has opportunity"
            ))
        if result["owner_id"]:
            edges.append(RelationshipEdge(
                relationship_id="sales_user__opportunity",
                from_entity="sales_user",
                from_id=result["owner_id"],
                to_entity="opportunity",
                to_id=source_id,
                label="owns"
            ))
        if result["team_id"]:
            edges.append(RelationshipEdge(
                relationship_id="sales_team__opportunity",
                from_entity="sales_team",
                from_id=result["team_id"],
                to_entity="opportunity",
                to_id=source_id,
                label="manages"
            ))
        
        return result, edges


class ActivityMapper(EntityMapper):
    """Map mail.activity to Activity"""
    entity_type = "activity"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        source_id = str(record.get('id'))
        canonical_id = self.make_canonical_id(source_id)
        
        result = {
            "canonical_id": canonical_id,
            "org_id": self.org_id,
            "source_system": self.source_system,
            "source_record_id": source_id,
            "summary": normalize_value(record.get('summary') or record.get('display_name')),
            "activity_type": extract_name(record.get('activity_type_id')),
            "note": normalize_value(record.get('note')),
            "date_deadline": normalize_value(record.get('date_deadline')),
            "opportunity_id": None,  # Set based on res_model/res_id
            "account_id": None,
            "user_id": extract_id(record.get('user_id')),
            "state": normalize_value(record.get('state')),
            "created_at": normalize_value(record.get('create_date')),
            "updated_at": normalize_value(record.get('write_date')),
        }
        
        # Determine linked entity based on res_model/res_id
        res_model = record.get('res_model')
        res_id = record.get('res_id')
        if res_model == 'crm.lead' and res_id:
            result["opportunity_id"] = str(res_id)
        elif res_model == 'res.partner' and res_id:
            result["account_id"] = str(res_id)
        
        edges = []
        if result["opportunity_id"]:
            edges.append(RelationshipEdge(
                relationship_id="opportunity__activity",
                from_entity="opportunity",
                from_id=result["opportunity_id"],
                to_entity="activity",
                to_id=source_id,
                label="has activity"
            ))
        
        return result, edges


class InvoiceMapper(EntityMapper):
    """Map account.move to Invoice"""
    entity_type = "invoice"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        source_id = str(record.get('id'))
        canonical_id = self.make_canonical_id(source_id)
        
        result = {
            "canonical_id": canonical_id,
            "org_id": self.org_id,
            "source_system": self.source_system,
            "source_record_id": source_id,
            "invoice_number": normalize_value(record.get('name')),
            "account_id": extract_id(record.get('partner_id')),
            "account_name": extract_name(record.get('partner_id')),
            "opportunity_id": None,  # May need to link via sale order or analytic
            "invoice_date": normalize_value(record.get('invoice_date')),
            "due_date": normalize_value(record.get('invoice_date_due')),
            "amount_untaxed": to_float(record.get('amount_untaxed')),
            "amount_tax": to_float(record.get('amount_tax')),
            "amount_total": to_float(record.get('amount_total')),
            "currency": extract_name(record.get('currency_id')) or 'USD',
            "state": normalize_value(record.get('state')),
            "payment_state": normalize_value(record.get('payment_state')),
            "created_at": normalize_value(record.get('create_date')),
            "updated_at": normalize_value(record.get('write_date')),
        }
        
        edges = []
        if result["account_id"]:
            edges.append(RelationshipEdge(
                relationship_id="account__invoice",
                from_entity="account",
                from_id=result["account_id"],
                to_entity="invoice",
                to_id=source_id,
                label="billed"
            ))
        
        return result, edges


class TaskMapper(EntityMapper):
    """Map project.task to Task"""
    entity_type = "task"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        source_id = str(record.get('id'))
        canonical_id = self.make_canonical_id(source_id)
        
        result = {
            "canonical_id": canonical_id,
            "org_id": self.org_id,
            "source_system": self.source_system,
            "source_record_id": source_id,
            "name": normalize_value(record.get('name')) or 'Unknown Task',
            "description": normalize_value(record.get('description')),
            "project_id": extract_id(record.get('project_id')),
            "project_name": extract_name(record.get('project_id')),
            "opportunity_id": extract_id(record.get('sale_line_id')),  # May link via sale order line
            "assignee_id": extract_id(record.get('user_ids') or record.get('user_id')),
            "assignee_name": extract_name(record.get('user_ids') or record.get('user_id')),
            "stage": extract_name(record.get('stage_id')),
            "priority": normalize_value(record.get('priority')),
            "date_deadline": normalize_value(record.get('date_deadline')),
            "planned_hours": to_float(record.get('planned_hours')),
            "effective_hours": to_float(record.get('effective_hours')),
            "state": normalize_value(record.get('state')),
            "created_at": normalize_value(record.get('create_date')),
            "updated_at": normalize_value(record.get('write_date')),
        }
        
        edges = []
        if result["assignee_id"]:
            edges.append(RelationshipEdge(
                relationship_id="employee__task",
                from_entity="employee",
                from_id=result["assignee_id"],
                to_entity="task",
                to_id=source_id,
                label="assigned"
            ))
        
        return result, edges


class EmployeeMapper(EntityMapper):
    """Map hr.employee to Employee"""
    entity_type = "employee"
    
    def map(self, record: Dict) -> Tuple[Dict, List[RelationshipEdge]]:
        source_id = str(record.get('id'))
        canonical_id = self.make_canonical_id(source_id)
        
        result = {
            "canonical_id": canonical_id,
            "org_id": self.org_id,
            "source_system": self.source_system,
            "source_record_id": source_id,
            "name": normalize_value(record.get('name')) or 'Unknown Employee',
            "email": normalize_value(record.get('work_email')),
            "work_phone": normalize_value(record.get('work_phone')),
            "mobile_phone": normalize_value(record.get('mobile_phone')),
            "job_title": extract_name(record.get('job_id')),
            "department_id": extract_id(record.get('department_id')),
            "department_name": extract_name(record.get('department_id')),
            "manager_id": extract_id(record.get('parent_id')),
            "user_id": extract_id(record.get('user_id')),
            "active": to_bool(record.get('active', True)),
            "created_at": normalize_value(record.get('create_date')),
            "updated_at": normalize_value(record.get('write_date')),
        }
        
        edges = []
        if result["user_id"]:
            edges.append(RelationshipEdge(
                relationship_id="employee__sales_user",
                from_entity="employee",
                from_id=source_id,
                to_entity="sales_user",
                to_id=result["user_id"],
                label="linked to"
            ))
        
        return result, edges


# Mapper registry
MAPPERS = {
    "sales_user": SalesUserMapper,
    "sales_team": SalesTeamMapper,
    "account": AccountMapper,
    "contact": ContactMapper,
    "opportunity": OpportunityMapper,
    "activity": ActivityMapper,
    "invoice": InvoiceMapper,
    "task": TaskMapper,
    "employee": EmployeeMapper,
}


class RecordRouter:
    """Routes incoming records to the correct entity mapper
    
    Determines entity type based on:
    1. source_model field (preferred)
    2. Field presence heuristics (fallback)
    """
    
    def __init__(self, source_system: str, org_id: str):
        self.source_system = source_system
        self.org_id = org_id
        self._mappers: Dict[str, EntityMapper] = {}
    
    def _get_mapper(self, entity_type: str) -> EntityMapper:
        """Get or create mapper for entity type"""
        if entity_type not in self._mappers:
            mapper_class = MAPPERS.get(entity_type)
            if mapper_class:
                self._mappers[entity_type] = mapper_class(self.source_system, self.org_id)
            else:
                raise ValueError(f"Unknown entity type: {entity_type}")
        return self._mappers[entity_type]
    
    def determine_entity_type(self, record: Dict, source_model: str = None) -> str:
        """Determine canonical entity type from record
        
        Args:
            record: Raw record from source
            source_model: Odoo model name (e.g., 'crm.lead')
            
        Returns:
            Entity type string (e.g., 'opportunity')
        """
        # Prefer explicit source_model
        if source_model:
            # Handle res.partner special case (company vs contact)
            if source_model == 'res.partner':
                is_company = record.get('is_company', False)
                return 'account' if is_company else 'contact'
            
            # Handle account.move (filter for invoices)
            if source_model == 'account.move':
                move_type = record.get('move_type')
                if move_type in ('out_invoice', 'out_refund'):
                    return 'invoice'
                return None  # Skip non-customer invoices
            
            return SOURCE_MODEL_TO_ENTITY.get(source_model)
        
        # Fallback: Field-based heuristics
        if 'use_opportunities' in record or 'alias_domain' in record:
            return 'sales_team'
        if 'expected_revenue' in record or 'probability' in record or 'stage_id' in record:
            return 'opportunity'
        if 'invoice_date' in record or 'payment_state' in record:
            return 'invoice'
        if 'activity_type_id' in record:
            return 'activity'
        if 'project_id' in record and 'planned_hours' in record:
            return 'task'
        if 'department_id' in record and 'job_id' in record:
            return 'employee'
        if 'is_company' in record:
            return 'account' if record.get('is_company') else 'contact'
        
        logger.warning(f"Could not determine entity type for record: {record.get('id')}")
        return None
    
    def route(self, record: Dict, source_model: str = None) -> Tuple[Optional[Dict], List[RelationshipEdge]]:
        """Route record to appropriate mapper
        
        Returns:
            Tuple of (canonical_record, relationship_edges) or (None, []) if skipped
        """
        entity_type = self.determine_entity_type(record, source_model)
        
        if not entity_type:
            logger.debug(f"Skipping record {record.get('id')} - unknown entity type")
            return None, []
        
        try:
            mapper = self._get_mapper(entity_type)
            return mapper.map(record)
        except Exception as e:
            logger.error(f"Error mapping record {record.get('id')} to {entity_type}: {e}")
            return None, []
