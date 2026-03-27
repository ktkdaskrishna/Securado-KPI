# Securado CRM - Performance Hub & System Configuration Summary

## 1. Performance Hub Overview

The Performance Hub is the central analytics and target management module of the Securado CRM. It provides role-based views for CEO, Product Directors, Sales Directors, and Sales Representatives, pulling all data from Odoo via ETL sync.

**Key Principle**: This is an ANALYTICS tool. All operational data (opportunities, activities, invoices, employees) comes from Odoo. Only Target Plans and assignments are created within the system.

---

## 2. Target Planning Workflow

```
CEO/Sales Director
  └── Assigns Revenue Target to Product Director
        (e.g., "Vimod, deliver OMR 3M from Managed Security Services")
        └── Product Director creates Activity Plan
              (e.g., 10 Demos for Network Security, 5 POCs for Endpoint, 20 Calls for IAM)
              └── Assigns to Team / Department or Individual Salesperson
                    (e.g., "Tomy Paul's Team" or "Nabisaheb")
                    └── Team HOD can reassign to individual members
                          └── Salesperson sees assigned targets in "My Targets" tab
```

---

## 3. Role-Based Tab Visibility

| Tab | CEO/Admin | Sales Director | Product Director | Sales Rep |
|-----|-----------|---------------|-----------------|-----------|
| CEO View | ✅ | ✅ | ❌ | ❌ |
| PM Plan Builder | ✅ | ✅ | ❌ | ❌ |
| Sales Director | ✅ | ✅ | ❌ | ❌ |
| My Plan | ❌ | ❌ | ✅ | ❌ |
| My Team | ❌ | ❌ | ✅ | ❌ |
| My Targets | ❌ | ❌ | ❌ | ✅ |
| Activities | ✅ | ✅ | ✅ | ✅ |
| Collection | ✅ | ✅ | ✅ | ✅ |
| Incentive | ✅ | ✅ | ✅ | ❌ |

---

## 4. Data Scoping (RBAC)

Data is automatically filtered based on the user's role. No manual configuration needed per user - the system resolves their Odoo identity by email.

### How Name Resolution Works
The system maintains a multi-name lookup:
1. Looks up user's email in Odoo `employees` collection → gets canonical name
2. Looks up in `sales_users` collection → gets sales name
3. Checks `opportunities.owner_name` → gets the name used in deals
4. Builds an OR regex pattern from ALL name variants

Example: User "Vimod Chandran" (app) → "Manickath Vimod Chandran" (Odoo employee) → both names are used in filters.

### Data Scope Per Role

| Role | Opportunities | Invoices | Activities |
|------|--------------|----------|-----------|
| **Admin** | All (988) | All (186) | All (717) |
| **Product Director** | Where `product_manager` = their name | From accounts in their product scope | Linked to their opportunities |
| **Sales Rep** | Where `owner_name` = their name | From accounts they own opportunities for | Where `assigned_user` = their name |

### Actual Data (verified):
- **Vimod (PD)**: 197 opps, 129 invoices, 275 activities
- **Tajuddin (PD)**: 95 opps, 78 invoices, 149 activities
- **Nabisaheb (Sales Rep)**: 177 opps, 39 invoices, 40 activities
- **Krishna (Admin)**: 988 opps, 186 invoices, 717 activities

---

## 5. Tab Details

### CEO View (Admin/SD only)
- Revenue Plans table: Plan name, Product Director, Target amount, Pipeline, Won, Activity items count
- PD Performance sidebar: All Product Directors with opp count, categories
- Click plan row → navigates to PM Plan Builder

### PM Plan Builder (Admin/SD only)
- Shows selected plan details (PD name, target amount)
- Activity Plan Items table: Activity type, Solution Category, Target count, Actual from Odoo, Assigned count, Match indicator (✅/⚠️)
- "Add Activity Plan" button → dialog with activity types and categories from Odoo
- "Assign" button on each item → assign to individual or team/department
- Redistribution details showing who has been assigned what

### My Plan (Product Director only)
- My Opportunities count, Pipeline, Won Deals, Categories (all from Odoo)
- My Solution Categories (e.g., Network Security, Data Security, Cloud Services)
- Revenue plans assigned to this PD with activity items
- "Add Activity Plan" button to create activity targets
- "Assign" button to redistribute to salespersons

### My Team (Product Director only)
- Salespersons working on PD's opportunities
- Ranked by opportunity count and pipeline value

### My Targets (Sales Rep only)
- My Opportunities, Pipeline, Won Deals, Accounts (from Odoo)
- My Activities breakdown by type (calls, demos, meetings from Odoo)
- Assigned Targets from Product Director/Sales Director redistributions

### Activities (All roles)
- Pending / Overdue / Completed cards (clickable → drill popup)
- "View All Activities" button

### Collection (All roles, RBAC-scoped)
- Invoice status cards: Paid, Not Paid, Pending (clickable → drill popup showing actual invoices)
- Overdue Invoices alert with amount

### Incentive (Managers only)
- Multi-Vector Incentive Calculator
- Revenue Plan selector → Calculate → Score, Revenue %, Activity %, Collection %, Payout

---

## 6. Alert Center

Proactive monitoring system that scans all data and generates alerts:

| Alert Type | Severity | Trigger |
|-----------|----------|---------|
| REVENUE_AT_RISK | Critical | PM revenue < 10% of target |
| OVERDUE_SPIKE | Critical | Invoice overdue rate > 25% |
| ACTIVITY_DROP | High | Activity completion < 30% |
| PLAN_UNMATCHED | Medium | Plan items not fully redistributed |
| STALE_LEADS | Medium | >40% leads stuck in early stages |
| TOP_PERFORMER | Positive | Activity target exceeded 100% |

Displayed as a collapsible banner above tabs with severity badges.

---

## 7. Filters

### Performance Hub Filters
- **Year**: 2024, 2025, 2026
- **Product Director**: Dropdown of 6 PDs from Odoo
- **Solution Category**: 20+ categories from Odoo
- Filter chips show active filters with × dismiss
- "Advanced" button opens Notion-style filter builder

### Advanced Filter Builder
- Add conditions: Field + Operator (is, is not, contains) + Value
- AND/OR logic toggle
- Saved Presets: Save and load named filter combinations
- Available on Performance Hub and Opportunities page

### Opportunities Page Filters (7 filters)
- Year, Quarter, Sales Rep, Account, Stage, Product Director, Solution Category

---

## 8. Drillable Widgets

All metric cards and data cards are clickable:
- Click → opens popup showing underlying records (opportunities, invoices, activities)
- Scrollable table with full details
- Inherits current filter context

---

## 9. Multi-Vector Incentive Calculation

Composite score from 3 weighted vectors:
- **Revenue Achievement** (50% weight): Won revenue / Target
- **Activity Completion** (30% weight): Activities done / Target activities
- **Collection Rate** (20% weight): On-time invoice payment rate

Tier classification:
| Composite Score | Tier | Multiplier |
|----------------|------|-----------|
| ≥ 120% | Super Achiever | 1.5x |
| ≥ 100% | Achiever | 1.2x |
| ≥ 80% | On Track | 1.0x |
| ≥ 50% | Developing | 0.5x |
| < 50% | Below Threshold | 0x |

---

## 10. Organization Structure Page

Separate page (`/org-structure`) with 3 tabs:
- **Org Tree**: Hierarchical view from Odoo employees (expandable tree)
- **Departments**: 6 departments with member lists and active/inactive counts
- **All Employees**: 75 employees with job title, department, email, active status, app account indicator, archive button

---

## 11. Technical Architecture

### Backend
- **Planning APIs**: `/app/backend/services/target_management/planning.py`
  - Lookups: `/api/target-lookups/product-managers`, `/solution-categories`, `/salespersons`, `/activity-types`, `/teams-with-members`
  - Revenue Plans: `/api/target-plans/revenue` (CRUD + redistribute)
  - Actuals: `/api/target-actuals/by-product-manager`, `/by-salesperson`, `/activities`, `/collection`, `/my-data`, `/multi-vector-incentive`, `/team-comparison`, `/marketing-metrics`
- **Alerts**: `/app/backend/services/target_management/alerts.py` → `/api/alerts`
- **Org Structure**: `/app/backend/services/target_management/org_structure.py` → `/api/org-structure/tree`, `/departments`, `/employees`
- **Filter Presets**: `/app/backend/services/target_management/filter_presets.py` → `/api/filter-presets`
- **RBAC**: `/app/backend/services/rbac_sync/access_rules.py` (canonical name resolution + multi-name pattern)

### Frontend
- **Performance Hub**: `/app/frontend/src/components/crm/PerformanceHubPage.js` (~700 lines)
- **Org Structure**: `/app/frontend/src/components/crm/OrgStructurePage.js`
- **Advanced Filter**: `/app/frontend/src/components/layout/AdvancedFilterBuilder.js`
- **Incentives**: `/app/frontend/src/components/crm/IncentiveCalcPage.js`

### Database Collections
- `event_mesh_app.target_plans` - Revenue plans (CEO → PD)
- `event_mesh_app.target_plan_items` - Activity plan items (PD creates)
- `event_mesh_app.target_redistributions` - Assignments (to person or team)
- `event_mesh_app.filter_presets` - Saved filter combinations
- `event_mesh_canonical.opportunities` - 1333 opportunities from Odoo
- `event_mesh_canonical.invoices` - 186 invoices from Odoo
- `event_mesh_canonical.activities` - 717 activities from Odoo
- `event_mesh_canonical.employees` - 75 employees from Odoo

---

## 12. Bug Fixes Applied

| Bug | Status | Description |
|-----|--------|-------------|
| RBAC route protection | ✅ Fixed | Frontend `RBACGuard` + Backend ETL 403 |
| Admin role broken | ✅ Fixed | App roles fallback when Odoo groups empty |
| Opportunities pagination | ✅ Fixed | 1039 total with Previous/Next |
| Login error message | ✅ Fixed | Inline + toast on invalid credentials |
| "OMR OMR" currency | ✅ Fixed | Currency symbol corrected |
| Dashboard Y-axis | ✅ Fixed | Shows OMR 3.6M format |
| Conversion rate 313% | ✅ Fixed | Win Rate = Won/(Won+Lost) = 65.6% |
| Bluesheet Won = 100% | ✅ Fixed | Auto-returns 100% for Won stage |
| Roles page "0 users" | ✅ Fixed | Counts from users collection |
| Role update "not found" | ✅ Fixed | Upsert on first edit |
| Name mismatch (Vimod) | ✅ Fixed | Multi-name resolution by email |
| Nabi invoices = 0 | ✅ Fixed | Account-based invoice scoping |
| PD sees all data | ✅ Fixed | Product manager filter applied |
| Theme inconsistency | ✅ Fixed | All pages use light theme |

---

## 13. User Credentials

| Name | Email | Password | Role |
|------|-------|----------|------|
| Krishnadas KT | krishna@securado.net | test123456 | Admin |
| Mohammed Tajuddin | taj@securado.net | test123456 | Product Director |
| Manickath Vimod Chandran | vimod.c@securado.net | test123456 | Product Director |
| Nabisaheb | nabisaheb@securado.net | test123456 | Sales Rep |
