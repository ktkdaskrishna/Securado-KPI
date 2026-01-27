# Odoo to Canonical Data Model Mapping Guide

## Overview

This document explains the correct mapping between **Odoo ERP models** and **Canonical CRM entities**. Understanding these mappings is critical for proper ETL configuration.

---

## ⚠️ Important Distinction

### Odoo "Account" Models ≠ CRM "Account" Entity

| Term | In Odoo | In CRM/Sales |
|------|---------|--------------|
| **Account** | `account.*` models = **Finance/Accounting** (invoices, journal entries, payments) | **Customer Organization/Company** |
| **Partner** | `res.partner` = **Contacts & Organizations** | Split into Account (companies) + Contact (people) |

---

## Canonical Entities and Their Odoo Sources

### 1. Sales User (Salesperson)
| Canonical Entity | Odoo Model |
|------------------|------------|
| **sales_user** | `res.users` |

**Key Odoo Fields:**
```
res.users:
├── id (integer) → source_record_id
├── name (char) → name
├── login (char) → login  
├── email (char) → email
├── active (boolean) → active
├── sale_team_id (many2one: crm.team) → team_id
└── partner_id (many2one: res.partner) → links to contact
```

---

### 2. Sales Team
| Canonical Entity | Odoo Model |
|------------------|------------|
| **sales_team** | `crm.team` |

**Key Odoo Fields:**
```
crm.team:
├── id (integer) → source_record_id
├── name (char) → name
├── use_opportunities (boolean) → use_opportunities
├── use_leads (boolean) → use_leads
├── alias_name (char) → email alias
├── invoiced (monetary) → total invoiced
├── invoiced_target (monetary) → target
└── member_ids (one2many: crm.team.member) → team members
```

---

### 3. Account (Customer Organization) ⭐
| Canonical Entity | Odoo Model | Filter |
|------------------|------------|--------|
| **account** | `res.partner` | `is_company = True` |

**This is the most important mapping!** In Odoo, `res.partner` is a unified model for:
- Companies (accounts) - when `is_company = True`
- Individual contacts - when `is_company = False`

**Key Odoo Fields:**
```
res.partner (where is_company=True):
├── id (integer) → source_record_id
├── name (char) → name
├── is_company (boolean) → FILTER: must be True for accounts
├── company_type (selection) → 'company' or 'person'
├── industry_id (many2one: res.partner.industry) → industry
├── phone (char) → phone
├── email (char) → email
├── website (char) → website
├── street (char) → address line 1
├── street2 (char) → address line 2
├── city (char) → city
├── state_id (many2one: res.country.state) → state/province
├── zip (char) → postal code
├── country_id (many2one: res.country) → country
├── vat (char) → tax ID
├── user_id (many2one: res.users) → account owner (salesperson)
├── child_ids (one2many: res.partner) → contacts under this company
└── opportunity_ids (one2many: crm.lead) → related opportunities
```

---

### 4. Contact (Contact Person)
| Canonical Entity | Odoo Model | Filter |
|------------------|------------|--------|
| **contact** | `res.partner` | `is_company = False` |

**Key Odoo Fields:**
```
res.partner (where is_company=False):
├── id (integer) → source_record_id
├── name (char) → name
├── is_company (boolean) → FILTER: must be False for contacts
├── parent_id (many2one: res.partner) → parent company (account_id)
├── function (char) → job title
├── email (char) → email
├── phone (char) → phone
├── mobile (char) → mobile phone
└── type (selection) → 'contact', 'invoice', 'delivery', 'other'
```

**Relationship:** 
```
Contact.parent_id → Account (res.partner where is_company=True)
```

---

### 5. Opportunity (Sales Deal)
| Canonical Entity | Odoo Model |
|------------------|------------|
| **opportunity** | `crm.lead` |

**Note:** In Odoo, `crm.lead` handles BOTH leads and opportunities:
- Lead: `type = 'lead'` (unqualified)
- Opportunity: `type = 'opportunity'` (qualified, in sales pipeline)

**Key Odoo Fields:**
```
crm.lead:
├── id (integer) → source_record_id
├── name (char) → name/title
├── type (selection) → 'lead' or 'opportunity'
├── partner_id (many2one: res.partner) → account_id (linked customer)
├── partner_name (char) → account_name (company name if no partner)
├── contact_name (char) → contact name
├── email_from (char) → email
├── phone (char) → phone
├── user_id (many2one: res.users) → owner_id (salesperson)
├── team_id (many2one: crm.team) → sales team
├── stage_id (many2one: crm.stage) → stage
├── probability (float) → probability (0-100)
├── expected_revenue (monetary) → amount
├── date_deadline (date) → expected close date
├── date_closed (datetime) → actual close date
├── won_status (selection) → 'won', 'lost', or false
├── lost_reason_id (many2one: crm.lost.reason) → lost reason
├── priority (selection) → priority level
├── tag_ids (many2many: crm.tag) → tags
└── activity_ids (one2many: mail.activity) → related activities
```

---

### 6. Invoice
| Canonical Entity | Odoo Model | Filter |
|------------------|------------|--------|
| **invoice** | `account.move` | `move_type IN ('out_invoice', 'out_refund')` |

**Key Odoo Fields:**
```
account.move (customer invoices):
├── id (integer) → source_record_id
├── name (char) → invoice_number
├── move_type (selection) → 'out_invoice' (invoice), 'out_refund' (credit note)
├── partner_id (many2one: res.partner) → account_id (customer)
├── invoice_date (date) → invoice_date
├── invoice_date_due (date) → due_date
├── amount_untaxed (monetary) → subtotal
├── amount_tax (monetary) → tax_amount
├── amount_total (monetary) → total_amount
├── amount_residual (monetary) → balance_due
├── currency_id (many2one: res.currency) → currency
├── state (selection) → 'draft', 'posted', 'cancel'
├── payment_state (selection) → 'not_paid', 'partial', 'paid'
├── invoice_user_id (many2one: res.users) → salesperson
└── invoice_line_ids (one2many: account.move.line) → line items
```

---

### 7. Activity
| Canonical Entity | Odoo Model |
|------------------|------------|
| **activity** | `mail.activity` |

**Key Odoo Fields:**
```
mail.activity:
├── id (integer) → source_record_id
├── summary (char) → summary/title
├── note (html) → description/notes
├── activity_type_id (many2one: mail.activity.type) → activity_type
├── date_deadline (date) → due_date
├── user_id (many2one: res.users) → assigned_to
├── res_model (char) → related model (e.g., 'crm.lead')
├── res_id (integer) → related record ID
└── state (selection) → 'overdue', 'today', 'planned'
```

**Relationship to Opportunity:**
```
Activity.res_model = 'crm.lead' AND Activity.res_id = Opportunity.id
```

---

### 8. Task
| Canonical Entity | Odoo Model |
|------------------|------------|
| **task** | `project.task` |

**Key Odoo Fields:**
```
project.task:
├── id (integer) → source_record_id
├── name (char) → name
├── description (html) → description
├── project_id (many2one: project.project) → project
├── stage_id (many2one: project.task.type) → stage
├── user_ids (many2many: res.users) → assignees
├── date_deadline (datetime) → deadline
├── priority (selection) → priority
├── partner_id (many2one: res.partner) → customer
└── sale_line_id (many2one: sale.order.line) → linked to sales
```

---

### 9. Employee
| Canonical Entity | Odoo Model |
|------------------|------------|
| **employee** | `hr.employee` |

**Key Odoo Fields:**
```
hr.employee:
├── id (integer) → source_record_id
├── name (char) → name
├── job_id (many2one: hr.job) → job_title
├── department_id (many2one: hr.department) → department
├── work_email (char) → email
├── work_phone (char) → phone
├── mobile_phone (char) → mobile
├── user_id (many2one: res.users) → linked user account
├── parent_id (many2one: hr.employee) → manager
└── active (boolean) → is_active
```

---

## Field Mapping Examples

### Example 1: Mapping res.partner to Account
```yaml
source_model: res.partner
target_entity: account
filter: "is_company = True"
field_mappings:
  - source: id          → target: source_record_id   (transform: to_string)
  - source: name        → target: name               (transform: direct)
  - source: phone       → target: phone              (transform: direct)
  - source: email       → target: email              (transform: direct)
  - source: website     → target: website            (transform: direct)
  - source: street      → target: address            (transform: direct)
  - source: city        → target: city               (transform: direct)
  - source: zip         → target: zip                (transform: direct)
  - source: user_id     → target: owner_id           (transform: extract_id)
  - source: industry_id → target: industry           (transform: extract_name)
```

### Example 2: Mapping crm.lead to Opportunity
```yaml
source_model: crm.lead
target_entity: opportunity
filter: "type = 'opportunity'"
field_mappings:
  - source: id               → target: source_record_id (transform: to_string)
  - source: name             → target: name             (transform: direct)
  - source: expected_revenue → target: amount           (transform: to_float)
  - source: probability      → target: probability      (transform: to_float)
  - source: partner_id       → target: account_id       (transform: extract_id)
  - source: partner_name     → target: account_name     (transform: direct)
  - source: user_id          → target: owner_id         (transform: extract_id)
  - source: team_id          → target: team_id          (transform: extract_id)
  - source: stage_id         → target: stage            (transform: extract_name)
  - source: date_deadline    → target: close_date       (transform: direct)
  - source: won_status       → target: is_won           (transform: to_bool)
```

### Example 3: Mapping account.move to Invoice
```yaml
source_model: account.move
target_entity: invoice
filter: "move_type = 'out_invoice'"
field_mappings:
  - source: id           → target: source_record_id (transform: to_string)
  - source: name         → target: invoice_number   (transform: direct)
  - source: partner_id   → target: account_id       (transform: extract_id)
  - source: amount_total → target: amount_total     (transform: to_float)
  - source: currency_id  → target: currency         (transform: extract_name)
  - source: state        → target: state            (transform: direct)
  - source: invoice_date → target: invoice_date     (transform: direct)
```

---

## Transformation Types

| Transform | Description | Example |
|-----------|-------------|---------|
| `direct` | Copy value as-is | `name` → `name` |
| `extract_id` | Get ID from Many2one tuple `[id, name]` | `[5, "John"]` → `5` |
| `extract_name` | Get name from Many2one tuple | `[5, "John"]` → `"John"` |
| `to_string` | Convert to string | `123` → `"123"` |
| `to_float` | Convert to decimal | `"100"` → `100.0` |
| `to_int` | Convert to integer | `"50"` → `50` |
| `to_bool` | Convert to boolean | `"won"` → `true` |

---

## Relationships Summary

```
┌─────────────┐          ┌─────────────┐
│  Sales User │─────────▶│   Account   │  (owns)
└─────────────┘          └─────────────┘
       │                        │
       │                        │
       ▼                        ▼
┌─────────────┐          ┌─────────────┐
│ Sales Team  │          │   Contact   │  (has contacts)
└─────────────┘          └─────────────┘
       │                        
       │                        
       ▼                        
┌─────────────┐          ┌─────────────┐
│ Opportunity │─────────▶│   Invoice   │  (generates)
└─────────────┘          └─────────────┘
       │
       │
       ▼
┌─────────────┐
│  Activity   │
└─────────────┘
```

---

## Quick Reference: Odoo Model Categories

| Category | Models | Use For |
|----------|--------|---------|
| **CRM** | `crm.lead`, `crm.team`, `crm.stage` | Sales pipeline |
| **Contacts** | `res.partner`, `res.users` | Customers, vendors, contacts |
| **Accounting** | `account.move`, `account.payment` | Invoices, payments (FINANCE, not CRM accounts!) |
| **HR** | `hr.employee`, `hr.department` | Employee data |
| **Project** | `project.task`, `project.project` | Tasks and projects |
| **Mail** | `mail.activity`, `mail.message` | Activities and communications |

---

*Document Version: 1.0*
*Last Updated: January 2025*
