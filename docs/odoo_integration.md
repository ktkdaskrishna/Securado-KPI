# Odoo Integration Guide

## Overview

This document explains how the ETL system integrates with Odoo CRM via XML-RPC API, based on Odoo 19.0 documentation.

## Odoo Data Model Fundamentals

### Automatic Fields

Every Odoo model has these automatic fields:
- `id` (Integer): Unique identifier - **THIS SHOULD MAP TO `canonical_id`**
- `create_date` (Datetime): Record creation timestamp
- `create_uid` (Many2one → res.users): User who created the record
- `write_date` (Datetime): Last modification timestamp - Used for incremental sync
- `write_uid` (Many2one → res.users): User who last modified

### Field Types

#### Simple Fields
| Type | Python | SQL | Example |
|------|--------|-----|---------|
| Char | str | VARCHAR | `name = fields.Char()` |
| Text | str | TEXT | `description = fields.Text()` |
| Integer | int | INTEGER | `bedrooms = fields.Integer()` |
| Float | float | DOUBLE | `amount = fields.Float()` |
| Boolean | bool | BOOLEAN | `active = fields.Boolean()` |
| Date | date | DATE | `date_deadline = fields.Date()` |
| Datetime | datetime | TIMESTAMP | `create_date = fields.Datetime()` |
| Selection | str | VARCHAR | `state = fields.Selection([('new', 'New'), ('done', 'Done')])` |

#### Relational Fields

**Many2one** (FK to another model):
- Returns: `[id, 'display_name']` tuple via XML-RPC or `False` if empty
- Example: `partner_id = fields.Many2one('res.partner')`
- Convention: `_id` suffix

**One2many** (Inverse of Many2one):
- Returns: List of IDs `[1, 2, 3]`
- Example: `offer_ids = fields.One2many('estate.property.offer', 'property_id')`
- Convention: `_ids` suffix

**Many2many** (Bidirectional multiple relationship):
- Returns: List of IDs `[1, 2, 3]`
- Example: `tag_ids = fields.Many2many('estate.property.tag')`
- Convention: `_ids` suffix

## Key Odoo CRM Models

### crm.lead (Opportunities/Leads)
Primary CRM model for sales pipeline.

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | **Unique ID → Map to canonical_id** |
| name | Char | Opportunity name → Map to name |
| partner_id | Many2one(res.partner) | Customer → Extract ID/Name |
| user_id | Many2one(res.users) | Salesperson → Extract ID/Name |
| stage_id | Many2one(crm.stage) | Pipeline stage → Extract name |
| expected_revenue | Float | Opportunity value → Map to amount |
| probability | Float | Win probability (0-100) |
| email_from | Char | Contact email |
| phone | Char | Contact phone |
| date_deadline | Date | Expected close date |
| create_date | Datetime | Created timestamp |
| write_date | Datetime | Modified timestamp |

### res.partner (Customers/Accounts)
Unified model for customers, contacts, and companies.

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | **Unique ID → Map to canonical_id** |
| name | Char | Partner name |
| is_company | Boolean | True = Company, False = Individual |
| email | Char | Email address |
| phone | Char | Phone number |
| website | Char | Website URL |
| street | Char | Address line 1 |
| city | Char | City |
| country_id | Many2one(res.country) | Country |
| industry_id | Many2one(res.partner.industry) | Industry |
| user_id | Many2one(res.users) | Salesperson |
| customer_rank | Integer | Customer ranking (0 = not customer) |

### account.move (Invoices)
Accounting entries including invoices.

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | **Unique ID → Map to canonical_id** |
| name | Char | Invoice number (e.g., INV/2026/0001) |
| partner_id | Many2one(res.partner) | Customer |
| invoice_date | Date | Invoice date |
| invoice_date_due | Date | Due date |
| amount_untaxed | Float | Amount before tax |
| amount_tax | Float | Tax amount |
| amount_total | Float | Total amount |
| currency_id | Many2one(res.currency) | Currency |
| state | Selection | draft/posted/cancel |
| move_type | Selection | out_invoice = Customer Invoice |
| payment_state | Selection | not_paid/in_payment/paid |

**Filter for customer invoices:** `[['move_type', '=', 'out_invoice']]`

### res.currency (Currencies)
Currency definitions.

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | ID |
| name | Char | Currency code (USD, OMR, etc.) |
| symbol | Char | Symbol ($, ر.ع., etc.) |
| rate | Float | Exchange rate |

## XML-RPC API Usage

### Authentication
```python
import xmlrpc.client

url = "https://odoo.example.com"
db = "database_name"
username = "user@example.com"
password = "api_key"

common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
uid = common.authenticate(db, username, password, {})
```

### Reading Records
```python
models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

# Search and read CRM leads
leads = models.execute_kw(db, uid, password,
    'crm.lead', 'search_read',
    [[['stage_id', '!=', False]]],  # Domain filter
    {
        'fields': ['id', 'name', 'partner_id', 'expected_revenue', 'stage_id'],
        'limit': 500,
        'order': 'write_date desc'
    }
)
```

### Handling Relational Fields

When you read a Many2one field via XML-RPC:
```python
# Example lead record
lead = {
    'id': 123,
    'name': 'Big Sale Opportunity',
    'partner_id': [45, 'Acme Corporation'],  # [id, 'display_name']
    'stage_id': [3, 'Negotiation'],
    'user_id': False  # Empty many2one = False
}

# To extract:
partner_id = lead['partner_id'][0] if lead['partner_id'] else None  # 45
partner_name = lead['partner_id'][1] if lead['partner_id'] else None  # 'Acme Corporation'
```

## ETL Mapping Rules

### Transform Types

| Transform | Input | Output | Use Case |
|-----------|-------|--------|----------|
| direct | Any | Same | Simple field copy |
| extract_id | [id, 'name'] | id | Get ID from Many2one |
| extract_name | [id, 'name'] | 'name' | Get name from Many2one |
| to_float | Any | float | Convert to number |
| to_int | Any | int | Convert to integer |
| to_bool | Any | bool | Convert to boolean |

### Required Mapping: canonical_id

**CRITICAL**: Every mapping MUST include:
```
source_field: id
target_field: canonical_id
transform: direct
```

This maps Odoo's internal ID to our canonical identifier.

### Example: CRM Lead → Opportunity Mapping

```json
{
  "source_model": "crm.lead",
  "target_entity": "opportunity",
  "mappings": [
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
    {"source_field": "date_deadline", "target_field": "close_date", "transform": "direct"}
  ]
}
```

### Example: res.partner → Account Mapping

```json
{
  "source_model": "res.partner",
  "target_entity": "account",
  "mappings": [
    {"source_field": "id", "target_field": "canonical_id", "transform": "direct"},
    {"source_field": "name", "target_field": "name", "transform": "direct"},
    {"source_field": "industry_id", "target_field": "industry", "transform": "extract_name"},
    {"source_field": "phone", "target_field": "phone", "transform": "direct"},
    {"source_field": "website", "target_field": "website", "transform": "direct"},
    {"source_field": "email", "target_field": "email", "transform": "direct"},
    {"source_field": "street", "target_field": "address", "transform": "direct"},
    {"source_field": "user_id", "target_field": "owner_id", "transform": "extract_id"},
    {"source_field": "user_id", "target_field": "owner_name", "transform": "extract_name"}
  ]
}
```

### Example: account.move → Invoice Mapping

```json
{
  "source_model": "account.move",
  "target_entity": "invoice",
  "domain": [["move_type", "=", "out_invoice"]],
  "mappings": [
    {"source_field": "id", "target_field": "canonical_id", "transform": "direct"},
    {"source_field": "name", "target_field": "invoice_number", "transform": "direct"},
    {"source_field": "partner_id", "target_field": "account_id", "transform": "extract_id"},
    {"source_field": "partner_id", "target_field": "account_name", "transform": "extract_name"},
    {"source_field": "invoice_date", "target_field": "date", "transform": "direct"},
    {"source_field": "invoice_date_due", "target_field": "due_date", "transform": "direct"},
    {"source_field": "amount_total", "target_field": "amount", "transform": "to_float"},
    {"source_field": "currency_id", "target_field": "currency", "transform": "extract_name"},
    {"source_field": "state", "target_field": "status", "transform": "direct"},
    {"source_field": "payment_state", "target_field": "payment_status", "transform": "direct"}
  ]
}
```

## Recommended ETL Workflow

1. **Create Connection** - Configure Odoo URL, database, credentials
2. **Test Connection** - Verify XML-RPC connectivity
3. **Discover Schema** - Scan available Odoo models
4. **Create Mapping** - Map source fields to canonical fields
   - **Always map `id` → `canonical_id`**
   - Use `extract_id` for Many2one ID extraction
   - Use `extract_name` for Many2one name extraction
5. **Verify Mapping** - Check all required fields are mapped
6. **Create Pipeline** - Link mapping to pipeline
7. **Run Pipeline** - Execute ETL process

## Troubleshooting

### Common Issues

1. **"canonical_id not mapped"** - Add mapping: `id → canonical_id`
2. **Empty owner_name** - Check if `user_id` field is included in source_fields
3. **Wrong data types** - Use appropriate transform (to_float, extract_name)
4. **Missing relationships** - Verify foreign key fields are extracted

### Debug Logging

Check pipeline run logs for:
- Extracted record count
- Sample record structure
- Transform errors
- Load results

## References

- [Odoo 19.0 ORM Documentation](https://www.odoo.com/documentation/19.0/developer/reference/backend/orm.html)
- [Odoo Models & Fields Tutorial](https://www.odoo.com/documentation/19.0/developer/tutorials/server_framework_101/03_basicmodel.html)
- [Odoo Relations Tutorial](https://www.odoo.com/documentation/19.0/developer/tutorials/server_framework_101/07_relations.html)
