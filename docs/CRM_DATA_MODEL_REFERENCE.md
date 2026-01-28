# CRM Data Model & Field Mapping Documentation

## CRITICAL: Read Before Making Changes

This document is the authoritative reference for all CRM data field mappings between Odoo and our application.
**ALL AGENTS MUST REVIEW THIS DOCUMENT BEFORE MAKING CHANGES TO:**
- ETL mappings
- Opportunity endpoints
- Activity endpoints
- Any CRM data sync logic

---

## 1. Known Data Issues (Current Status)

### Issue #1: Activities Not Linked to Opportunities
**Status:** REGRESSION - Previously fixed but broken again
**Impact:** Opportunity detail view shows "0 activities" even when activities exist

**Root Cause:**
- Activities have `opportunity_id` as integer (Odoo ID, e.g., `3028`)
- Opportunities use `source_record_id` as string (e.g., `"2158"`)
- The linking query doesn't account for type mismatch
- Most activities have `res_model: None` instead of `crm.lead`

**Current Data State:**
```
Total activities in canonical DB: 702
- res_model=None: 681
- res_model=crm.lead: 2
- res_model=hr.leave: 10
- res_model=hr.appraisal: 4
- res_model=hr.expense.sheet: 3
- res_model=sale.order: 2
```

**Fix Required:**
1. Update activity ETL sync to properly set `res_model='crm.lead'` for CRM activities
2. Ensure `opportunity_id` matches the opportunity's `source_record_id`
3. Update the API query to handle both string and integer matching

### Issue #2: AI Confidence Shows 0%
**Status:** Data dependency issue
**Impact:** Bluesheet AI confidence calculation fails

**Root Cause:**
- AI confidence depends on activity data
- No activities linked → no activity score → 0% AI confidence

---

## 2. Odoo Field Mappings

### 2.1 Opportunity Model (crm.lead)

| Odoo Field | Technical Name | Data Type | Our Field | Notes |
|------------|---------------|-----------|-----------|-------|
| Lead/Opportunity | `name` | Char | `name` | |
| Expected Revenue | `expected_revenue` | Monetary | `expected_revenue` | |
| Probability | `probability` | Float | `probability` | 0-100 |
| Stage | `stage_id` | Many2one | `stage_name` | Extract name |
| Salesperson | `user_id` | Many2one | `owner_name`, `owner_id` | |
| Customer | `partner_id` | Many2one | `account_name`, `account_id` | |
| Expected Closing | `date_deadline` | Date | `expected_closing` | |
| Sale Value | `x_studio_sale_value` | Float | `sale_value` | Custom field |
| Date Won | `date_closed` | Datetime | `date_closed` | When moved to Won |
| Last Stage Update | `date_last_stage_update` | Datetime | `won_at` | USE THIS for Won date |
| Solution Category | `x_studio_solution_category` | Selection | `solution_category` | Custom field |
| Product Manager | `x_studio_product_manager` | Many2one | `product_manager` | Custom field |
| Budget Status | `x_studio_budget_status` | Selection | `budget_status` | Custom field |

### 2.2 Activity Model (mail.activity)

| Odoo Field | Technical Name | Data Type | Our Field | Notes |
|------------|---------------|-----------|-----------|-------|
| Summary | `summary` | Char | `summary` | Activity title |
| Activity Type | `activity_type_id` | Many2one | `activity_type` | Call, Meeting, etc. |
| Due Date | `date_deadline` | Date | `date_deadline` | |
| Note | `note` | Html | `note` | HTML content |
| Assigned To | `user_id` | Many2one | `assigned_user`, `user_id` | |
| Related Model | `res_model` | Char | `res_model` | 'crm.lead' for CRM |
| Related Record | `res_id` | Integer | `opportunity_id` | **CRITICAL: Must match** |
| State | `state` | Selection | `state` | done/pending/overdue |

### 2.3 CRM Activity Report (crm.activity.report)

This is a reporting model that provides better CRM activity data:

| Odoo Field | Technical Name | Data Type | Our Field | Notes |
|------------|---------------|-----------|-----------|-------|
| Lead/Opportunity | `lead_id` | Many2one | `opportunity_id` | Direct link! |
| Activity Type | `activity_type_id` | Many2one | `activity_type` | |
| Due Date | `date_deadline` | Date | `date_deadline` | |
| Author | `author_id` | Many2one | `author` | Who created |
| User | `user_id` | Many2one | `assigned_user` | Who assigned to |

**RECOMMENDATION:** Prefer `crm.activity.report` over `mail.activity` for CRM activities because it has direct `lead_id` linking.

---

## 3. Data Linking Rules

### Opportunity → Activities Linking

**Query Pattern (CORRECT):**
```python
# Activities can be linked by:
# 1. opportunity_id == opportunity.source_record_id (as int)
# 2. res_id == opportunity.source_record_id (as int)
# 3. res_model == 'crm.lead'

source_id = opportunity.get('source_record_id')
source_id_int = int(source_id) if str(source_id).isdigit() else None

query = {
    '$or': [
        {'opportunity_id': source_id_int, 'res_model': 'crm.lead'},
        {'opportunity_id': source_id, 'res_model': 'crm.lead'},
        {'res_id': source_id_int, 'res_model': 'crm.lead'},
    ],
    'org_id': org_id
}
```

### Log Messages Linking

Log messages (mail.message) are linked by:
- `res_model == 'crm.lead'`
- `res_id == opportunity.source_record_id`

---

## 4. ETL Sync Requirements

### Activity Sync Checklist

When syncing activities from Odoo:

1. **Filter for CRM activities only:**
   ```python
   # Use crm.activity.report or filter mail.activity by res_model='crm.lead'
   ```

2. **Map the opportunity link correctly:**
   ```python
   activity['opportunity_id'] = odoo_activity.get('lead_id') or odoo_activity.get('res_id')
   activity['res_model'] = 'crm.lead'
   ```

3. **Ensure consistent types:**
   ```python
   # opportunity_id should be stored as integer
   activity['opportunity_id'] = int(activity['opportunity_id'])
   ```

### Opportunity Sync Checklist

1. **Store both IDs:**
   ```python
   opportunity['canonical_id'] = str(odoo_id)  # For internal use
   opportunity['source_record_id'] = str(odoo_id)  # For linking
   ```

2. **Map "Won" date correctly:**
   ```python
   # Use date_last_stage_update for won_at, NOT date_closed
   if stage == 'Won':
       opportunity['won_at'] = odoo_opp.get('date_last_stage_update')
   ```

---

## 5. API Endpoint Requirements

### GET /api/opportunities/{opp_id}/activities

**Must handle:**
- `opportunity_id` as both string and integer
- `res_id` as fallback
- Only return `res_model='crm.lead'` activities

### GET /api/opportunities/{opp_id}/logs

**Must handle:**
- `res_id` matching `source_record_id`
- `res_model='crm.lead'` filtering

---

## 6. Known Odoo Custom Fields

These are Securado-specific custom fields in Odoo:

| Field | Technical Name | Location |
|-------|---------------|----------|
| Sale Value | `x_studio_sale_value` | crm.lead |
| Solution Category | `x_studio_solution_category` | crm.lead |
| Product Manager | `x_studio_product_manager` | crm.lead |
| Budget Status | `x_studio_budget_status` | crm.lead |
| Opportunity Number | `x_studio_opportunity_number` | crm.lead |

---

## 7. Testing Data Integrity

After any ETL or data-related change, run these checks:

```bash
# Check activity-opportunity linking
cd /app/backend && python3 -c "
import pymongo, os
from dotenv import load_dotenv
load_dotenv()
client = pymongo.MongoClient(os.environ.get('MONGO_URL'))
db = client['event_mesh_canonical']

# Count CRM activities
crm_acts = db.activities.count_documents({'res_model': 'crm.lead'})
print(f'CRM Activities: {crm_acts}')

# Check linking
for opp in db.opportunities.find().limit(5):
    src_id = int(opp.get('source_record_id')) if str(opp.get('source_record_id')).isdigit() else None
    if src_id:
        linked = db.activities.count_documents({'opportunity_id': src_id, 'res_model': 'crm.lead'})
        print(f'Opp {src_id}: {linked} activities')
"
```

---

## 8. Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-29 | Initial documentation created | Neo (AI) |
| 2026-01-29 | Added activity linking fix notes | Neo (AI) |

---

## 9. Related Files

- `/app/backend/services/crm_sales/routes.py` - Opportunity & activity endpoints
- `/app/backend/services/etl_control/routes.py` - ETL sync logic
- `/app/backend/services/etl_runner/runner.py` - ETL execution
- `/app/backend/services/data_modeling/odoo_field_mappings.json` - Field mapping config
- `/app/docs/MODULAR_DASHBOARD_ARCHITECTURE.md` - Dashboard architecture
