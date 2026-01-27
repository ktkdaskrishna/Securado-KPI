# Odoo Schema Reference Guide

> **Generated from 15 official Odoo model documentation PDFs**
> Last Updated: Auto-generated during ETL analysis

This document provides the comprehensive reference for all Odoo models relevant to the CRM ETL pipeline.

---

## Table of Contents

1. [Core CRM Models](#core-crm-models)
2. [Partner & Contact Models](#partner--contact-models)
3. [Sales & Team Models](#sales--team-models)
4. [Accounting Models](#accounting-models)
5. [HR Models](#hr-models)
6. [Activity & Task Models](#activity--task-models)
7. [Supporting Models](#supporting-models)
8. [Field Type Reference](#field-type-reference)
9. [Canonical Mapping Summary](#canonical-mapping-summary)

---

## Core CRM Models

### `crm.lead` - Lead/Opportunity

**Model Name:** `crm.lead`  
**Label:** Lead  
**Apps:** crm, crm_enterprise, sale_crm

#### Key Fields for ETL

| Odoo Field | Type | Description | Maps To |
|------------|------|-------------|----------|
| `id` | integer | Primary key | `source_record_id` |
| `name` | char | Opportunity name | `name` |
| `expected_revenue` | monetary | Deal value | `amount` |
| `probability` | float | Win probability (0-100) | `probability` |
| `stage_id` | many2one → crm.stage | Pipeline stage | `stage_id` |
| `partner_id` | many2one → res.partner | Customer/Account | `account_id` |
| `user_id` | many2one → res.users | Salesperson | `owner_id` |
| `team_id` | many2one → crm.team | Sales team | `team_id` |
| `date_deadline` | date | Expected closing | `close_date` |
| `date_closed` | datetime | Actual close date | (when closed) |
| `date_open` | datetime | Assignment date | `date_open` |
| `won_status` | selection | won/lost/pending | `is_won`, `is_closed` |
| `email_from` | char | Contact email | `contact_email` |
| `phone` | char | Contact phone | `contact_phone` |
| `contact_name` | char | Contact name | (use for contact creation) |
| `description` | html | Notes | (optional) |
| `lost_reason` | many2one → crm.lost.reason | Why lost | `lost_reason` |
| `create_date` | datetime | Created timestamp | `created_at` |
| `write_date` | datetime | Updated timestamp | `updated_at` |
| `company_id` | many2one → res.company | Company | `org_id` context |

#### Selection Values
- **won_status:** `won`, `lost`, `pending`
- **type:** `lead`, `opportunity`

---

### `crm.team` - Sales Team

**Model Name:** `crm.team`  
**Label:** Sales Team  
**Apps:** crm, sale, sales_team

#### Key Fields for ETL

| Odoo Field | Type | Description | Maps To |
|------------|------|-------------|----------|
| `id` | integer | Primary key | `source_record_id` |
| `name` | char | Team name | `name` |
| `use_opportunities` | boolean | Uses pipeline | `use_opportunities` |
| `use_leads` | boolean | Uses leads | `use_leads` |
| `alias_name` | char | Email alias | `alias_name` |
| `invoiced` | monetary | Total invoiced | `invoiced` |
| `invoiced_target` | monetary | Target amount | `invoiced_target` |
| `member_ids` | many2many → res.users | Team members | `member_ids` |
| `crm_team_member_ids` | one2many → crm.team.member | Detailed members | (join table) |
| `user_id` | many2one → res.users | Team leader | (leader ref) |
| `active` | boolean | Is active | `active` |
| `company_id` | many2one → res.company | Company | `org_id` context |

---

### `crm.team.member` - Sales Team Member

**Model Name:** `crm.team.member`  
**Label:** Sales Team Member  
**Apps:** crm, sales_team

#### Key Fields

| Odoo Field | Type | Description |
|------------|------|-------------|
| `crm_team_id` | many2one → crm.team | Team reference |
| `user_id` | many2one → res.users | User reference |
| `assignment_enabled` | boolean | Lead assignment enabled |
| `assignment_max` | integer | Max leads (30 days) |
| `lead_month_count` | integer | Leads this month |

---

## Partner & Contact Models

### `res.partner` - Partner (Account & Contact)

**Model Name:** `res.partner`  
**Label:** Contact  
**Apps:** base, contacts, account, sale, crm

> **CRITICAL:** This single model stores BOTH companies and individuals!
> - `is_company = True` → Maps to **Account** entity
> - `is_company = False` → Maps to **Contact** entity
> - `parent_id` links contacts to their parent company

#### Key Fields for ETL

| Odoo Field | Type | Description | Maps To (Account) | Maps To (Contact) |
|------------|------|-------------|-------------------|-------------------|
| `id` | integer | Primary key | `source_record_id` | `source_record_id` |
| `name` | char | Name | `name` | `name` |
| `display_name` | char | Computed display name | (use `name`) | (use `name`) |
| `is_company` | boolean | Company flag | **Filter: True** | **Filter: False** |
| `parent_id` | many2one → res.partner | Parent company | N/A | `account_id` |
| `email` | char | Email | `email` | `email` |
| `phone` | char | Phone | `phone` | `phone` |
| `mobile` | char | Mobile | (optional) | `mobile` |
| `website` | char | Website URL | `website` | N/A |
| `street` | char | Street address | `address` | N/A |
| `street2` | char | Street line 2 | (append to address) | N/A |
| `city` | char | City | `city` | N/A |
| `state_id` | many2one → res.country.state | State/Province | `state` (extract name) | N/A |
| `zip` | char | ZIP/Postal code | `zip` | N/A |
| `country_id` | many2one → res.country | Country | `country` (extract name) | N/A |
| `industry_id` | many2one → res.partner.industry | Industry | `industry` (extract name) | N/A |
| `user_id` | many2one → res.users | Salesperson | `owner_id` | N/A |
| `function` | char | Job position | N/A | `title` / `function` |
| `title` | many2one → res.partner.title | Title (Mr/Mrs) | N/A | (optional) |
| `customer_rank` | integer | Customer ranking | `customer_rank` | N/A |
| `active` | boolean | Is active | `active` | `active` |
| `company_id` | many2one → res.company | Company | `org_id` context | `org_id` context |
| `type` | selection | Address type | `type` | N/A |

#### Selection Values
- **type:** `contact`, `invoice`, `delivery`, `private`, `other`

---

### `res.users` - System Users

**Model Name:** `res.users`  
**Label:** Users  
**Apps:** base

#### Key Fields for ETL

| Odoo Field | Type | Description | Maps To |
|------------|------|-------------|----------|
| `id` | integer | Primary key | `source_record_id` |
| `name` | char | Display name | `name` |
| `login` | char | Username | `login` |
| `email` | char | Email | `email` |
| `active` | boolean | Is active | `active` |
| `partner_id` | many2one → res.partner | Related partner | (for contact info) |
| `company_id` | many2one → res.company | Company | `org_id` context |
| `sale_team_id` | many2one → crm.team | Default sales team | `team_id` |

---

## Accounting Models

### `account.move` - Journal Entry (Invoice)

**Model Name:** `account.move`  
**Label:** Journal Entry  
**Apps:** account

> **CRITICAL:** This is the unified model for ALL accounting entries!
> - `move_type = 'out_invoice'` → Customer Invoice (maps to **Invoice** entity)
> - `move_type = 'out_refund'` → Customer Credit Note
> - `move_type = 'in_invoice'` → Vendor Bill
> - `move_type = 'in_refund'` → Vendor Credit Note
> - `move_type = 'entry'` → Journal Entry

#### Key Fields for ETL

| Odoo Field | Type | Description | Maps To |
|------------|------|-------------|----------|
| `id` | integer | Primary key | `source_record_id` |
| `name` | char | Invoice number (e.g., INV/2024/0001) | `invoice_number` |
| `move_type` | selection | Entry type | **Filter** |
| `partner_id` | many2one → res.partner | Customer | `account_id` |
| `invoice_date` | date | Invoice date | `invoice_date` |
| `invoice_date_due` | date | Due date | `due_date` |
| `amount_untaxed` | monetary | Subtotal | `amount_untaxed` |
| `amount_tax` | monetary | Tax amount | `amount_tax` |
| `amount_total` | monetary | Total | `amount_total` |
| `currency_id` | many2one → res.currency | Currency | `currency` (extract code) |
| `state` | selection | Status | `state` |
| `payment_state` | selection | Payment status | `payment_state` |
| `invoice_origin` | char | Source document | (link to sale.order) |
| `company_id` | many2one → res.company | Company | `org_id` context |

#### Selection Values
- **move_type:** `entry`, `out_invoice`, `out_refund`, `in_invoice`, `in_refund`, `out_receipt`, `in_receipt`
- **state:** `draft`, `posted`, `cancel`
- **payment_state:** `not_paid`, `in_payment`, `paid`, `partial`, `reversed`

---

### `account.payment` - Payment

**Model Name:** `account.payment`  
**Label:** Payments  
**Apps:** account, account_payment

#### Key Fields

| Odoo Field | Type | Description |
|------------|------|-------------|
| `amount` | monetary | Payment amount |
| `date` | date | Payment date |
| `partner_id` | many2one → res.partner | Payer/Payee |
| `payment_type` | selection | inbound/outbound |
| `state` | selection | draft/in_process/paid/canceled |
| `move_id` | many2one → account.move | Related journal entry |

---

## HR Models

### `hr.employee` - Employee

**Model Name:** `hr.employee`  
**Label:** Employee  
**Apps:** hr, hr_org_chart, hr_skills

#### Key Fields for ETL

| Odoo Field | Type | Description | Maps To |
|------------|------|-------------|----------|
| `id` | integer | Primary key | `source_record_id` |
| `name` | char | Employee name | `name` |
| `work_email` | char | Work email | `email` |
| `work_phone` | char | Work phone | `work_phone` |
| `mobile_phone` | char | Mobile | `mobile_phone` |
| `job_id` | many2one → hr.job | Job position | `job_title` (extract name) |
| `job_title` | char | Job title (computed) | `job_title` |
| `department_id` | many2one → hr.department | Department | `department_id`, `department_name` |
| `parent_id` | many2one → hr.employee | Manager | `manager_id` |
| `user_id` | many2one → res.users | Linked user | `user_id` |
| `active` | boolean | Is active | `active` |
| `company_id` | many2one → res.company | Company | `org_id` context |

---

## Activity & Task Models

### `mail.activity` - Activity

**Model Name:** `mail.activity`  
**Label:** Activity  
**Apps:** mail

#### Key Fields for ETL

| Odoo Field | Type | Description | Maps To |
|------------|------|-------------|----------|
| `id` | integer | Primary key | `source_record_id` |
| `summary` | char | Activity summary | `summary` |
| `activity_type_id` | many2one → mail.activity.type | Activity type | `activity_type` (extract name) |
| `note` | html | Notes | `note` |
| `date_deadline` | date | Due date | `date_deadline` |
| `res_model` | char | Related model name | (for filtering) |
| `res_id` | integer | Related record ID | `opportunity_id` / `account_id` |
| `user_id` | many2one → res.users | Assigned to | `user_id` |
| `state` | selection | Status | `state` |

#### Activity Types (mail.activity.type)
- `email` - Email
- `call` - Call
- `meeting` - Meeting
- `todo` - To-Do

---

### `project.task` - Task

**Model Name:** `project.task`  
**Label:** Task  
**Apps:** project

#### Key Fields for ETL

| Odoo Field | Type | Description | Maps To |
|------------|------|-------------|----------|
| `id` | integer | Primary key | `source_record_id` |
| `name` | char | Task name | `name` |
| `description` | html | Description | `description` |
| `project_id` | many2one → project.project | Project | `project_id`, `project_name` |
| `user_ids` | many2many → res.users | Assignees | `assignee_id` (first) |
| `stage_id` | many2one → project.task.type | Stage | `stage` (extract name) |
| `priority` | selection | Priority | `priority` |
| `date_deadline` | date | Deadline | `date_deadline` |
| `planned_hours` | float | Planned hours | `planned_hours` |
| `effective_hours` | float | Actual hours | `effective_hours` |
| `state` | selection | State | `state` |

---

## Supporting Models

### `sale.order` - Sales Order

**Model Name:** `sale.order`  
**Label:** Sales Order  
**Apps:** sale, sale_crm

> Sales orders link opportunities to invoices

#### Key Fields

| Odoo Field | Type | Description |
|------------|------|-------------|
| `name` | char | Order reference (S00001) |
| `partner_id` | many2one → res.partner | Customer |
| `user_id` | many2one → res.users | Salesperson |
| `team_id` | many2one → crm.team | Sales team |
| `opportunity_id` | many2one → crm.lead | Source opportunity |
| `amount_total` | monetary | Total amount |
| `state` | selection | Status |
| `invoice_ids` | many2many → account.move | Generated invoices |

#### Selection Values
- **state:** `draft`, `sent`, `sale`, `cancel`

---

### `product.template` - Product

**Model Name:** `product.template`  
**Label:** Product  
**Apps:** product, sale, account

#### Key Fields

| Odoo Field | Type | Description |
|------------|------|-------------|
| `name` | char | Product name |
| `default_code` | char | Internal reference/SKU |
| `list_price` | float | Sales price |
| `standard_price` | float | Cost price |
| `categ_id` | many2one → product.category | Category |
| `type` | selection | consu/service/product |

---

## Field Type Reference

### Odoo Field Types → Canonical Types

| Odoo Type | Canonical Type | Transform Notes |
|-----------|----------------|------------------|
| `char` | `string` | Direct copy |
| `text` | `string` | Direct copy |
| `html` | `string` | Strip HTML tags or keep raw |
| `integer` | `integer` | Direct copy |
| `float` | `number` | Direct copy |
| `monetary` | `number` | Direct copy (currency separate) |
| `boolean` | `boolean` | Direct copy |
| `date` | `date` | Format: YYYY-MM-DD |
| `datetime` | `datetime` | Format: ISO 8601 |
| `selection` | `string` | Extract selection value |
| `many2one` | `string` (ID) | Extract `[0]` for ID |
| `many2one` | `string` (Name) | Extract `[1]` for display name |
| `one2many` | `array` | List of IDs |
| `many2many` | `array` | List of IDs |
| `binary` | `string` | Base64 encoded (usually skip) |

### Many2one Field Handling

Odoo returns many2one fields as `[id, name]` tuples:
```python
# Example Odoo response
{
  "partner_id": [42, "Acme Corp"],
  "user_id": [5, "John Doe"]
}

# Transform for canonical:
{
  "account_id": "42",           # Extract [0] as string
  "account_name": "Acme Corp",  # Extract [1]
  "owner_id": "5",
  "owner_name": "John Doe"
}
```

---

## Canonical Mapping Summary

| Canonical Entity | Odoo Source Model | Filter Condition |
|------------------|-------------------|------------------|
| `opportunity` | `crm.lead` | `type = 'opportunity'` (optional) |
| `account` | `res.partner` | `is_company = True` |
| `contact` | `res.partner` | `is_company = False` |
| `sales_team` | `crm.team` | None |
| `sales_user` | `res.users` | `active = True` |
| `employee` | `hr.employee` | `active = True` |
| `invoice` | `account.move` | `move_type IN ('out_invoice', 'out_refund')` |
| `activity` | `mail.activity` | `res_model = 'crm.lead'` (or relevant) |
| `task` | `project.task` | None |

---

## Relationship Chains

```
res.users (sales_user)
    │
    ├─── crm.team (sales_team) via sale_team_id
    │       │
    │       └─── crm.lead (opportunity) via team_id
    │
    └─── crm.lead (opportunity) via user_id
            │
            ├─── res.partner (account) via partner_id
            │       │
            │       └─── res.partner (contact) via parent_id
            │
            ├─── sale.order via opportunity_id
            │       │
            │       └─── account.move (invoice) via invoice_ids
            │
            └─── mail.activity (activity) via res_id
```

---

## Notes for Implementation

1. **Always check `is_company`** when fetching `res.partner` - this determines Account vs Contact
2. **Filter `account.move` by `move_type`** - otherwise you get all accounting entries
3. **Many2one fields return tuples** - need to extract ID and name separately
4. **Handle currency separately** - Odoo stores currency_id as reference, extract code
5. **Watch for HTML fields** - `description` and `note` fields often contain HTML
6. **Date formats differ** - Odoo uses YYYY-MM-DD for dates, ISO for datetimes
