"""Integration Templates - Pre-built connection and mapping templates

Provides:
- Pre-configured connection templates for common systems
- Default field mappings for each template
- Schema definitions for source systems
"""
from typing import Dict, List, Any

# Integration Templates with pre-configured settings
INTEGRATION_TEMPLATES = {
    "odoo_crm": {
        "id": "odoo_crm",
        "name": "Odoo CRM",
        "description": "Full Odoo CRM integration with opportunities, accounts, contacts",
        "type": "odoo",
        "icon": "database",
        "category": "CRM",
        "connection_defaults": {
            "type": "odoo",
            "database": "odoo_db"
        },
        "models": [
            {"model": "crm.lead", "target": "opportunity", "label": "Opportunities/Leads"},
            {"model": "res.partner", "target": "account", "label": "Partners/Accounts"},
            {"model": "res.users", "target": "user", "label": "Users"}
        ],
        "default_mappings": {
            "crm.lead": {
                "target_entity": "opportunity",
                "fields": [
                    {"source_field": "id", "target_field": "canonical_id", "transform": "direct"},
                    {"source_field": "name", "target_field": "name", "transform": "direct"},
                    {"source_field": "expected_revenue", "target_field": "amount", "transform": "to_float"},
                    {"source_field": "probability", "target_field": "probability", "transform": "to_float"},
                    {"source_field": "stage_id", "target_field": "stage", "transform": "extract_name"},
                    {"source_field": "user_id", "target_field": "owner_id", "transform": "extract_id"},
                    {"source_field": "user_id", "target_field": "owner_name", "transform": "extract_name"},
                    {"source_field": "partner_id", "target_field": "account_id", "transform": "extract_id"},
                    {"source_field": "partner_id", "target_field": "account_name", "transform": "extract_name"},
                    {"source_field": "email_from", "target_field": "contact_email", "transform": "direct"},
                    {"source_field": "phone", "target_field": "contact_phone", "transform": "direct"},
                    {"source_field": "date_deadline", "target_field": "close_date", "transform": "direct"},
                    {"source_field": "create_date", "target_field": "created_at", "transform": "direct"},
                    {"source_field": "write_date", "target_field": "updated_at", "transform": "direct"}
                ]
            },
            "res.partner": {
                "target_entity": "account",
                "fields": [
                    {"source_field": "id", "target_field": "canonical_id", "transform": "direct"},
                    {"source_field": "name", "target_field": "name", "transform": "direct"},
                    {"source_field": "industry_id", "target_field": "industry", "transform": "extract_name"},
                    {"source_field": "phone", "target_field": "phone", "transform": "direct"},
                    {"source_field": "website", "target_field": "website", "transform": "direct"},
                    {"source_field": "email", "target_field": "email", "transform": "direct"},
                    {"source_field": "street", "target_field": "address", "transform": "direct"}
                ]
            }
        }
    },
    "salesforce": {
        "id": "salesforce",
        "name": "Salesforce",
        "description": "Salesforce CRM integration",
        "type": "api",
        "icon": "cloud",
        "category": "CRM",
        "connection_defaults": {
            "type": "api",
            "url": "https://login.salesforce.com"
        },
        "models": [
            {"model": "Opportunity", "target": "opportunity", "label": "Opportunities"},
            {"model": "Account", "target": "account", "label": "Accounts"},
            {"model": "Contact", "target": "contact", "label": "Contacts"},
            {"model": "User", "target": "user", "label": "Users"}
        ],
        "default_mappings": {
            "Opportunity": {
                "target_entity": "opportunity",
                "fields": [
                    {"source_field": "Id", "target_field": "source_id", "transform": "direct"},
                    {"source_field": "Name", "target_field": "name", "transform": "direct"},
                    {"source_field": "Amount", "target_field": "amount", "transform": "to_float"},
                    {"source_field": "Probability", "target_field": "probability", "transform": "to_float"},
                    {"source_field": "StageName", "target_field": "stage", "transform": "direct"},
                    {"source_field": "OwnerId", "target_field": "owner_id", "transform": "direct"},
                    {"source_field": "AccountId", "target_field": "account_id", "transform": "direct"},
                    {"source_field": "CloseDate", "target_field": "close_date", "transform": "direct"},
                    {"source_field": "IsClosed", "target_field": "is_closed", "transform": "to_bool"},
                    {"source_field": "IsWon", "target_field": "is_won", "transform": "to_bool"}
                ]
            },
            "Account": {
                "target_entity": "account",
                "fields": [
                    {"source_field": "Id", "target_field": "source_id", "transform": "direct"},
                    {"source_field": "Name", "target_field": "name", "transform": "direct"},
                    {"source_field": "Industry", "target_field": "industry", "transform": "direct"},
                    {"source_field": "Phone", "target_field": "phone", "transform": "direct"},
                    {"source_field": "Website", "target_field": "website", "transform": "direct"},
                    {"source_field": "BillingStreet", "target_field": "address", "transform": "direct"}
                ]
            }
        }
    },
    "hubspot": {
        "id": "hubspot",
        "name": "HubSpot CRM",
        "description": "HubSpot CRM integration",
        "type": "api",
        "icon": "target",
        "category": "CRM",
        "connection_defaults": {
            "type": "api",
            "url": "https://api.hubapi.com"
        },
        "models": [
            {"model": "deals", "target": "opportunity", "label": "Deals"},
            {"model": "companies", "target": "account", "label": "Companies"},
            {"model": "contacts", "target": "contact", "label": "Contacts"}
        ],
        "default_mappings": {
            "deals": {
                "target_entity": "opportunity",
                "fields": [
                    {"source_field": "hs_object_id", "target_field": "source_id", "transform": "direct"},
                    {"source_field": "dealname", "target_field": "name", "transform": "direct"},
                    {"source_field": "amount", "target_field": "amount", "transform": "to_float"},
                    {"source_field": "dealstage", "target_field": "stage", "transform": "direct"},
                    {"source_field": "hubspot_owner_id", "target_field": "owner_id", "transform": "direct"},
                    {"source_field": "closedate", "target_field": "close_date", "transform": "direct"}
                ]
            }
        }
    },
    "pipedrive": {
        "id": "pipedrive",
        "name": "Pipedrive",
        "description": "Pipedrive CRM integration",
        "type": "api",
        "icon": "trending-up",
        "category": "CRM",
        "connection_defaults": {
            "type": "api",
            "url": "https://api.pipedrive.com"
        },
        "models": [
            {"model": "deals", "target": "opportunity", "label": "Deals"},
            {"model": "organizations", "target": "account", "label": "Organizations"},
            {"model": "persons", "target": "contact", "label": "Persons"}
        ],
        "default_mappings": {}
    },
    "postgres": {
        "id": "postgres",
        "name": "PostgreSQL",
        "description": "Direct PostgreSQL database connection",
        "type": "postgres",
        "icon": "database",
        "category": "Database",
        "connection_defaults": {
            "type": "postgres"
        },
        "models": [],
        "default_mappings": {}
    },
    "mysql": {
        "id": "mysql",
        "name": "MySQL",
        "description": "Direct MySQL database connection",
        "type": "mysql",
        "icon": "database",
        "category": "Database",
        "connection_defaults": {
            "type": "mysql"
        },
        "models": [],
        "default_mappings": {}
    },
    "csv_import": {
        "id": "csv_import",
        "name": "CSV Import",
        "description": "Import data from CSV files",
        "type": "csv",
        "icon": "file-text",
        "category": "File",
        "connection_defaults": {
            "type": "csv"
        },
        "models": [],
        "default_mappings": {}
    },
    "mock_demo": {
        "id": "mock_demo",
        "name": "Demo/Mock Data",
        "description": "Generate sample data for testing",
        "type": "mock",
        "icon": "flask",
        "category": "Testing",
        "connection_defaults": {
            "type": "mock",
            "url": "mock://demo",
            "database": "demo"
        },
        "models": [
            {"model": "opportunities", "target": "opportunity", "label": "Sample Opportunities"},
            {"model": "accounts", "target": "account", "label": "Sample Accounts"},
            {"model": "contacts", "target": "contact", "label": "Sample Contacts"}
        ],
        "default_mappings": {
            "opportunities": {
                "target_entity": "opportunity",
                "fields": [
                    {"source_field": "id", "target_field": "source_id", "transform": "direct"},
                    {"source_field": "name", "target_field": "name", "transform": "direct"},
                    {"source_field": "amount", "target_field": "amount", "transform": "to_float"},
                    {"source_field": "stage", "target_field": "stage", "transform": "direct"},
                    {"source_field": "probability", "target_field": "probability", "transform": "to_float"},
                    {"source_field": "owner", "target_field": "owner_name", "transform": "direct"},
                    {"source_field": "account", "target_field": "account_name", "transform": "direct"}
                ]
            }
        }
    }
}

# Field similarity mappings for auto-suggestion
FIELD_SIMILARITY_MAP = {
    # Source field patterns -> Target canonical field
    "name": ["name", "title", "display_name", "dealname", "opportunity_name", "lead_name"],
    "amount": ["amount", "expected_revenue", "value", "total", "deal_value", "revenue"],
    "probability": ["probability", "probability_pct", "win_probability", "confidence"],
    "stage": ["stage", "stage_id", "stage_name", "pipeline_stage", "dealstage", "status"],
    "owner_id": ["owner_id", "user_id", "assigned_to", "salesperson_id", "hubspot_owner_id"],
    "owner_name": ["owner_name", "user_name", "salesperson", "assigned_name"],
    "account_id": ["account_id", "company_id", "partner_id", "organization_id"],
    "account_name": ["account_name", "company_name", "partner_name", "organization_name"],
    "contact_email": ["email", "email_from", "contact_email", "email_address"],
    "contact_phone": ["phone", "phone_number", "contact_phone", "mobile"],
    "close_date": ["close_date", "closedate", "date_deadline", "expected_close"],
    "created_at": ["created_at", "create_date", "created", "createdate"],
    "updated_at": ["updated_at", "write_date", "modified", "lastmodifieddate"],
    "is_closed": ["is_closed", "closed", "isclosed"],
    "is_won": ["is_won", "won", "iswon"],
    "industry": ["industry", "industry_id", "sector"],
    "website": ["website", "web", "url"],
    "address": ["address", "street", "billing_street", "billingstreet"]
}

def suggest_mapping(source_field: str, target_entity: str) -> dict:
    """Suggest target field and transform based on source field name"""
    source_lower = source_field.lower().replace("_", "").replace("-", "")
    
    for target_field, patterns in FIELD_SIMILARITY_MAP.items():
        for pattern in patterns:
            pattern_clean = pattern.lower().replace("_", "").replace("-", "")
            if source_lower == pattern_clean or pattern_clean in source_lower:
                transform = "direct"
                if "id" in source_lower and "name" in target_field:
                    transform = "extract_name"
                elif "id" in source_lower and "id" in target_field:
                    transform = "extract_id"
                elif target_field in ["amount", "probability"]:
                    transform = "to_float"
                elif target_field in ["is_closed", "is_won"]:
                    transform = "to_bool"
                
                return {
                    "source_field": source_field,
                    "target_field": target_field,
                    "transform": transform,
                    "confidence": 0.9 if source_lower == pattern_clean else 0.7
                }
    
    # No match found - suggest direct mapping with low confidence
    return {
        "source_field": source_field,
        "target_field": source_field.lower(),
        "transform": "direct",
        "confidence": 0.3
    }


def auto_suggest_mappings(source_fields: List[str], target_entity: str) -> List[dict]:
    """Generate mapping suggestions for a list of source fields"""
    suggestions = []
    used_targets = set()
    
    # ALWAYS add canonical_id mapping first (required field)
    # Map 'id' from source to 'canonical_id' in target
    id_field_candidates = ['id', 'Id', 'ID', '_id', 'hs_object_id', 'record_id']
    canonical_id_mapped = False
    
    for field in source_fields:
        if field.lower() in [c.lower() for c in id_field_candidates]:
            suggestions.append({
                "source_field": field,
                "target_field": "canonical_id",
                "transform": "direct",
                "confidence": 1.0  # Highest confidence - required field
            })
            used_targets.add("canonical_id")
            canonical_id_mapped = True
            break
    
    # If no ID field found, add a warning suggestion
    if not canonical_id_mapped:
        suggestions.append({
            "source_field": "id",  # Placeholder
            "target_field": "canonical_id",
            "transform": "direct",
            "confidence": 0.1,  # Low confidence - needs user attention
            "warning": "No ID field found - please map a unique identifier to canonical_id"
        })
    
    for field in source_fields:
        # Skip if already mapped to canonical_id
        if field.lower() in [c.lower() for c in id_field_candidates] and canonical_id_mapped:
            continue
            
        suggestion = suggest_mapping(field, target_entity)
        # Avoid duplicate target mappings
        if suggestion["target_field"] not in used_targets or suggestion["confidence"] > 0.5:
            suggestions.append(suggestion)
            if suggestion["confidence"] > 0.5:
                used_targets.add(suggestion["target_field"])
    
    return sorted(suggestions, key=lambda x: -x["confidence"])
