# CRM KPI Management Platform - Master Development Plan

## ⚠️ CRITICAL: READ BEFORE MAKING ANY CHANGES

**All agents MUST review these documents before making major changes:**
- `/app/docs/CRM_MASTER_PLAN.md` (THIS FILE) - Complete roadmap
- `/app/docs/CRM_DATA_MODEL_REFERENCE.md` - Data field mappings and ETL rules
- `/app/docs/MODULAR_DASHBOARD_ARCHITECTURE.md` - Dashboard architecture details

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Known Bugs & Fixes Required](#3-known-bugs--fixes-required)
4. [UI Field Requirements](#4-ui-field-requirements)
5. [Modular Dashboard Architecture](#5-modular-dashboard-architecture)
6. [RBAC & Security Requirements](#6-rbac--security-requirements)
7. [Implementation Phases](#7-implementation-phases)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [Completed Work](#9-completed-work)

---

## 1. Executive Summary

### Project Vision
Transform the CRM dashboard into a **modular, role-based system** with:
- Pivot-table style data cards
- Slicer-like global filters
- Role-based layout templates
- Row-level security (RBAC)

### Current Status
- **Frontend:** React + Tailwind + Shadcn UI + Recharts
- **Backend:** FastAPI + MongoDB
- **Data Source:** Odoo v17.0 via XML-RPC
- **Auth:** JWT + Odoo RBAC integration

### Key Dependencies
- RBAC Infrastructure: 80% ready
- Global Filter System: 95% ready
- ETL Sync: Needs field mapping fixes

---

## 2. Current State Analysis

### ✅ What Already Works

| Component | Status | Location |
|-----------|--------|----------|
| RBAC Context | 80% Ready | `/app/frontend/src/lib/RBACContext.js` |
| Global Filters | 95% Ready | `/app/frontend/src/lib/GlobalFilterContext.js` |
| Odoo RBAC Mapping | 90% Ready | `/app/backend/services/odoo_rbac/routes.py` |
| RBAC Middleware | Ready | `/app/backend/libs/rbac_middleware.py` |
| Dashboard Stats API | Working | `/api/dashboard/stats` |
| PM Leaderboard API | Working | `/api/dashboard/product-manager-leaderboard` |
| Category Stats API | Working | `/api/dashboard/category-stats` |
| Excel Export API | Working | `/api/opportunities/export` |

### ❌ What Needs Fixing/Building

| Component | Issue | Priority |
|-----------|-------|----------|
| Activity ETL Mapping | Empty field_mappings | P0 |
| Log Messages | Not linked to opportunities | P0 |
| AI Confidence | 0% due to missing activity data | P1 |
| Modular Dashboard | Not yet implemented | P1 |
| Row-Level Security | Not enforced on all APIs | P1 |
| Layout Builder | Not yet implemented | P2 |

---

## 3. Known Bugs & Fixes Required

### Bug #1: Activities Not Showing on Opportunity Detail
**Status:** ROOT CAUSE IDENTIFIED
**Impact:** "0 activities" displayed, AI Confidence 0%

**Root Cause:**
```
ETL Mappings Status:
- mail.activity: target_collection=None, field_mappings=[]  ❌ EMPTY
- crm.activity.report: target_collection=None, field_mappings=[]  ❌ EMPTY

Activities in DB: 702 total
- res_model=None: 681 (NOT CATEGORIZED)
- res_model=crm.lead: 2 (ONLY 2 PROPERLY LINKED)
```

**Fix Required:**
1. Update ETL mapping in database for `mail.activity`:
```json
{
  "source_model": "mail.activity",
  "target_collection": "activities",
  "target_entity": "activity",
  "field_mappings": [
    {"source_field": "id", "target_field": "canonical_id", "transform": "direct"},
    {"source_field": "summary", "target_field": "summary", "transform": "direct"},
    {"source_field": "activity_type_id", "target_field": "activity_type", "transform": "extract_name"},
    {"source_field": "user_id", "target_field": "assigned_user", "transform": "extract_name"},
    {"source_field": "user_id", "target_field": "user_id", "transform": "extract_id"},
    {"source_field": "res_id", "target_field": "opportunity_id", "transform": "to_int"},
    {"source_field": "res_model", "target_field": "res_model", "transform": "direct"},
    {"source_field": "date_deadline", "target_field": "date_deadline", "transform": "direct"},
    {"source_field": "note", "target_field": "note", "transform": "direct"},
    {"source_field": "state", "target_field": "state", "transform": "direct"}
  ]
}
```
2. Re-run ETL sync for activities
3. Verify with data integrity test

### Bug #2: Log Messages Not Showing
**Status:** Not yet investigated
**Impact:** "0 messages" displayed on opportunity detail

**Likely Fix:**
- Sync `mail.message` model with proper `res_id` → `opportunity_id` mapping
- Filter by `res_model='crm.lead'`

### Bug #3: AI Confidence 0%
**Status:** Dependent on Bug #1
**Impact:** Bluesheet shows 0% confidence

**Fix:** Will auto-resolve when activity sync is fixed

---

## 4. UI Field Requirements

### 4.1 Opportunity Detail View - Required Fields

| Section | Field | Odoo Source | Status |
|---------|-------|-------------|--------|
| **Header** | Opportunity Name | `name` | ✅ Working |
| | Stage | `stage_id` | ✅ Working |
| | Probability | `probability` | ✅ Working |
| | Expected Revenue | `expected_revenue` | ✅ Working |
| | Sale Value | `x_studio_sale_value` | ✅ Working |
| **Details** | Customer/Account | `partner_id` | ✅ Working |
| | Salesperson | `user_id` | ✅ Working |
| | Expected Closing | `date_deadline` | ✅ Working |
| | Solution Category | `x_studio_solution_category` | ✅ Working |
| | Product Manager | `x_studio_product_manager` | ✅ Working |
| | Budget Status | `x_studio_budget_status` | ✅ Working |
| | Opportunity Number | `x_studio_opportunity_number` | ⬜ TODO |
| | Date Created | `create_date` | ✅ Working |
| | Won Date | `date_last_stage_update` | ✅ Working |
| **Activities Tab** | Activity List | `mail.activity` | ❌ BROKEN |
| | Activity Type | `activity_type_id` | ❌ BROKEN |
| | Due Date | `date_deadline` | ❌ BROKEN |
| | Assigned To | `user_id` | ❌ BROKEN |
| | Summary | `summary` | ❌ BROKEN |
| | State | `state` | ❌ BROKEN |
| **Logs Tab** | Log Messages | `mail.message` | ❌ BROKEN |
| | Author | `author_id` | ❌ BROKEN |
| | Date | `date` | ❌ BROKEN |
| | Body | `body` | ❌ BROKEN |
| **AI/Bluesheet** | AI Confidence | Calculated | ❌ 0% (dependent) |
| | Activity Score | Calculated | ❌ 0% (dependent) |
| | Engagement Score | Calculated | ❌ 0% (dependent) |

### 4.2 Dashboard Cards - Required Fields

| Card | Fields Required | Data Source |
|------|-----------------|-------------|
| **Total Pipeline KPI** | Sum of expected_revenue | `/api/dashboard/stats` |
| **Win Rate KPI** | Won / Total deals | `/api/dashboard/stats` |
| **Open Opportunities KPI** | Count where stage != Won/Lost | `/api/dashboard/stats` |
| **Won This Period KPI** | Count + Value where stage = Won | `/api/dashboard/stats` |
| **Pipeline by Stage** | Stage name, Value sum | `/api/dashboard/stats` |
| **Sales Leaderboard** | Salesperson name, Won value | `/api/dashboard/stats` |
| **PM Leaderboard** | PM name, Won value, Deal count | `/api/dashboard/product-manager-leaderboard` |
| **Category Performance** | Category name, Won value, Count | `/api/dashboard/category-stats` |
| **Activity Overview** | Calls, Emails, Meetings, Tasks | `/api/dashboard/stats` → ❌ BROKEN |

### 4.3 Account Detail View - Required Fields

| Field | Odoo Source | Status |
|-------|-------------|--------|
| Account Name | `name` | ✅ Working |
| Is Company | `is_company` | ✅ Working |
| Phone | `phone` | ✅ Working |
| Email | `email` | ✅ Working |
| Website | `website` | ✅ Working |
| Industry | `industry_id` | ✅ Working |
| Overdue Amount | From invoices | ✅ Working |
| Total Opportunities | Count | ✅ Working |

### 4.4 Invoice/Receivables View - Required Fields

| Field | Odoo Source | Status |
|-------|-------------|--------|
| Invoice Number | `name` | ✅ Working |
| Amount | `amount_total` | ✅ Working |
| Invoice Date | `invoice_date` | ✅ Working |
| Due Date | `invoice_date_due` | ✅ Working |
| Status | `payment_state` | ✅ Working |
| Account | `partner_id` | ✅ Working |
| Salesperson Won Value | Calculated | ✅ Working |
| Collection Rate | Calculated | ✅ Working |

---

## 5. Modular Dashboard Architecture

### 5.1 Card Registry Schema

```javascript
// frontend/src/components/dashboard/registry/cardRegistry.js
export const CARD_REGISTRY = {
  "kpi.totalPipeline": {
    title: "Total Pipeline",
    component: "KPICard",
    requiredPermissions: ["view_dashboard"],
    dataSources: ["dashboard.stats"],
    supportedFilters: ["year", "quarter", "sales_rep", "team_id", "account", "stage"],
    defaultSize: { w: 3, h: 2 },
    roleVisibility: ["all"]
  },
  
  "kpi.winRate": {
    title: "Win Rate",
    component: "KPICard",
    requiredPermissions: ["view_dashboard"],
    dataSources: ["dashboard.stats"],
    supportedFilters: ["year", "quarter", "sales_rep", "team_id"],
    defaultSize: { w: 3, h: 2 },
    roleVisibility: ["all"]
  },
  
  "pipeline.overview": {
    title: "Pipeline by Stage",
    component: "PipelineOverviewCard",
    requiredPermissions: ["view_opportunities"],
    dataSources: ["dashboard.stats"],
    supportedFilters: ["year", "quarter", "sales_rep", "team_id", "account"],
    defaultSize: { w: 6, h: 4 },
    roleVisibility: ["all"]
  },
  
  "activity.overview": {
    title: "Activity Overview",
    component: "ActivityOverviewCard",
    requiredPermissions: ["view_activities"],
    dataSources: ["dashboard.stats"],
    supportedFilters: ["year", "quarter", "sales_rep", "team_id"],
    defaultSize: { w: 6, h: 4 },
    roleVisibility: ["all"]
  },
  
  "sales.leaderboard": {
    title: "Sales Leaderboard",
    component: "LeaderboardCard",
    requiredPermissions: ["view_dashboard"],
    dataSources: ["dashboard.stats"],
    supportedFilters: ["year", "quarter", "team_id"],
    defaultSize: { w: 6, h: 5 },
    roleVisibility: ["sales_admin", "sales_director", "sales_user_all"]  // NOT sales_user_own
  },
  
  "pm.leaderboard": {
    title: "Product Manager Leaderboard",
    component: "PMLeaderboardCard",
    requiredPermissions: ["view_dashboard"],
    dataSources: ["dashboard.pmLeaderboard"],
    supportedFilters: ["year", "quarter"],
    defaultSize: { w: 6, h: 5 },
    roleVisibility: ["sales_admin", "sales_director"]  // Admin/Director only
  },
  
  "category.performance": {
    title: "Category Performance",
    component: "CategoryPerformanceCard",
    requiredPermissions: ["view_dashboard"],
    dataSources: ["dashboard.categoryStats"],
    supportedFilters: ["year", "quarter", "sales_rep"],
    defaultSize: { w: 6, h: 5 },
    roleVisibility: ["all"]
  }
};
```

### 5.2 Layout Template Schema

```json
{
  "id": "tpl_sales_rep_v1",
  "name": "Sales Rep Dashboard",
  "assignment": {
    "roles": ["sales_user_own"],
    "priority": 50
  },
  "layout": {
    "schemaVersion": 1,
    "breakpoints": { "lg": 1200, "md": 996, "sm": 768, "xs": 480 },
    "cols": { "lg": 12, "md": 10, "sm": 6, "xs": 2 },
    "items": [
      { "i": "kpi_1", "cardId": "kpi.totalPipeline", "x": 0, "y": 0, "w": 3, "h": 2 },
      { "i": "kpi_2", "cardId": "kpi.winRate", "x": 3, "y": 0, "w": 3, "h": 2 },
      { "i": "kpi_3", "cardId": "kpi.openOpportunities", "x": 6, "y": 0, "w": 3, "h": 2 },
      { "i": "kpi_4", "cardId": "kpi.wonThisPeriod", "x": 9, "y": 0, "w": 3, "h": 2 },
      { "i": "pipeline_1", "cardId": "pipeline.overview", "x": 0, "y": 2, "w": 6, "h": 4 },
      { "i": "activity_1", "cardId": "activity.overview", "x": 6, "y": 2, "w": 6, "h": 4 }
    ]
  }
}
```

### 5.3 New Frontend Structure

```
frontend/src/components/dashboard/
├── ModularDashboardPage.js          # Main page (replaces DashboardPage.js)
├── DashboardRenderer.js             # Renders template layout
├── DashboardTemplateContext.js      # Which template to show
├── DashboardDataContext.js          # Batch data fetching
├── registry/
│   ├── cardRegistry.js              # Card metadata + component mapping
│   └── dataSourceRegistry.js        # Endpoint definitions
└── cards/
    ├── KPICard.js
    ├── PipelineOverviewCard.js
    ├── ActivityOverviewCard.js
    ├── LeaderboardCard.js
    ├── PMLeaderboardCard.js
    └── CategoryPerformanceCard.js
```

---

## 6. RBAC & Security Requirements

### 6.1 Role Definitions (From Odoo)

| Role | Odoo Group | Record Access | Export Allowed |
|------|------------|---------------|----------------|
| sales_admin | 14 | all | ✅ Yes |
| sales_director | 448 | all | ✅ Yes |
| sales_user_all | 13 | all | ⬜ Configurable |
| sales_user_readonly | 447 | all | ❌ No |
| sales_user_department | 74 | department | ❌ No |
| sales_user_own | 12 | own | ❌ No |
| crm_readonly | 449 | all | ❌ No |

### 6.2 Row-Level Security Rules

```python
# Backend enforcement (source of truth)
if rbac.record_access == "own":
    query["owner_id"] = current_user.odoo_id
elif rbac.record_access == "department":
    query["team_id"] = {"$in": current_user.team_ids}
# else: record_access == "all", no filter
```

### 6.3 Export Permission (TO BE ADDED)

```python
# New permission to add
permissions.append("export_data")

# Endpoint protection
@router.get("/api/opportunities/export")
@require_permission("export_data")
async def export_opportunities(...):
    ...
```

---

## 7. Implementation Phases

### Phase 0: Critical Bug Fixes (THIS WEEK)
| Task | Status | Priority | Owner |
|------|--------|----------|-------|
| Configure ETL mapping for `mail.activity` | ⬜ TODO | P0 | Backend |
| Re-run ETL sync for activities | ⬜ TODO | P0 | Backend |
| Fix log messages linking | ⬜ TODO | P0 | Backend |
| Verify AI confidence calculation | ⬜ TODO | P1 | Backend |
| Sync `opportunity_number` field | ⬜ TODO | P2 | Backend |

### Phase 1: Modular Dashboard Foundations (Week 2-3)
| Task | Status | Priority |
|------|--------|----------|
| Add `export_data` permission | ⬜ TODO | P1 |
| Block export for restricted roles | ⬜ TODO | P1 |
| Create `cardRegistry.js` | ⬜ TODO | P1 |
| Extract card components from DashboardPage | ⬜ TODO | P1 |
| Create `DashboardTemplateContext` | ⬜ TODO | P1 |
| Create `DashboardDataContext` | ⬜ TODO | P1 |
| Add batch data endpoint | ⬜ TODO | P2 |

### Phase 2: Template System (Week 4-5)
| Task | Status | Priority |
|------|--------|----------|
| Create `dashboard_templates` collection | ⬜ TODO | P2 |
| Add template CRUD APIs | ⬜ TODO | P2 |
| Implement role-template assignment | ⬜ TODO | P2 |
| Load user template on login | ⬜ TODO | P2 |
| Add `DashboardRenderer.js` | ⬜ TODO | P2 |

### Phase 3: Row-Level Security (Week 5-6)
| Task | Status | Priority |
|------|--------|----------|
| Add owner_id filter to opportunity APIs | ⬜ TODO | P1 |
| Add owner_id filter to account APIs | ⬜ TODO | P1 |
| Add owner_id filter to activity APIs | ⬜ TODO | P1 |
| Add team_id filter for department access | ⬜ TODO | P1 |
| Audit logging for data access | ⬜ TODO | P2 |

### Phase 4: Layout Builder (Week 7-9)
| Task | Status | Priority |
|------|--------|----------|
| Add `react-grid-layout` dependency | ⬜ TODO | P2 |
| Create admin layout builder UI | ⬜ TODO | P2 |
| Implement drag/drop cards | ⬜ TODO | P2 |
| Save/load template changes | ⬜ TODO | P2 |
| Add preview mode | ⬜ TODO | P2 |

### Phase 5: Optimization (Week 10)
| Task | Status | Priority |
|------|--------|----------|
| Implement batch data endpoint | ⬜ TODO | P2 |
| Add response caching | ⬜ TODO | P3 |
| Debounce filter updates | ⬜ TODO | P3 |
| Performance monitoring | ⬜ TODO | P3 |

---

## 8. API Endpoints Reference

### Existing Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/dashboard/stats` | GET | Main dashboard stats | ✅ Working |
| `/api/dashboard/product-manager-leaderboard` | GET | PM leaderboard | ✅ Working |
| `/api/dashboard/category-stats` | GET | Category performance | ✅ Working |
| `/api/opportunities` | GET | List opportunities | ✅ Working |
| `/api/opportunities/{id}` | GET | Opportunity detail | ✅ Working |
| `/api/opportunities/{id}/activities` | GET | Opportunity activities | ⚠️ Fixed but needs data |
| `/api/opportunities/{id}/logs` | GET | Opportunity logs | ❌ Broken |
| `/api/opportunities/export` | GET | Excel export | ✅ Working |
| `/api/accounts` | GET | List accounts | ✅ Working |
| `/api/activities` | GET | List activities | ✅ Working |
| `/api/receivables` | GET | List invoices | ✅ Working |
| `/api/receivables/by-salesperson` | GET | Salesperson receivables | ✅ Working |

### New Endpoints (To Build)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dashboard/templates/active` | GET | Get user's active template |
| `/api/dashboard/templates` | GET/POST | Template CRUD |
| `/api/dashboard/templates/{id}` | PUT/DELETE | Template management |
| `/api/dashboard/templates/{id}/assign` | POST | Assign template to roles |
| `/api/dashboard/data/batch` | POST | Batch data for multiple cards |

---

## 9. Completed Work

### Recent Session Completions

| Feature | Status | Date |
|---------|--------|------|
| Dashboard Sales Rep filter fixed | ✅ | 2026-01-28 |
| Dashboard items made clickable | ✅ | 2026-01-28 |
| Export Excel button added | ✅ | 2026-01-28 |
| Securado logo enlarged | ✅ | 2026-01-28 |
| PM Leaderboard UI added | ✅ | 2026-01-28 |
| Category Performance UI added | ✅ | 2026-01-28 |
| Invoices "By Salesperson" tab added | ✅ | 2026-01-28 |
| Select.Item runtime error fixed | ✅ | 2026-01-28 |
| Activity API endpoint updated | ✅ | 2026-01-29 |
| Documentation created | ✅ | 2026-01-29 |

### Previously Completed

| Feature | Status |
|---------|--------|
| Won date fix (use date_last_stage_update) | ✅ |
| Solution Category sync | ✅ |
| Product Manager sync | ✅ |
| Budget Status sync | ✅ |
| Accounts page redesign (Company/Contact tabs) | ✅ |
| Overdue invoice highlighting | ✅ |
| Activities page year filter | ✅ |

---

## 10. Files Reference

| File | Purpose |
|------|---------|
| `/app/docs/CRM_MASTER_PLAN.md` | This master plan |
| `/app/docs/CRM_DATA_MODEL_REFERENCE.md` | Data model & ETL rules |
| `/app/docs/MODULAR_DASHBOARD_ARCHITECTURE.md` | Dashboard architecture details |
| `/app/plan.md` | Active sprint tasks |
| `/app/backend/libs/rbac_middleware.py` | RBAC enforcement |
| `/app/frontend/src/lib/RBACContext.js` | Frontend RBAC |
| `/app/frontend/src/lib/GlobalFilterContext.js` | Global filters |
| `/app/backend/services/crm_sales/routes.py` | CRM API endpoints |
| `/app/backend/services/etl_runner/runner.py` | ETL execution |

---

## Preview URL
https://sso-fix-checker.preview.emergentagent.com

---

**Document Version:** 1.0
**Last Updated:** 2026-01-29
**Maintainer:** Development Team
