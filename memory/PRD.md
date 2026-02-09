# Securado CRM - Product Requirements Document

## Original Problem Statement
Enterprise CRM analytics platform for Securado. Sales analytics tool - all data from Odoo via ETL. Only Target Plans created in-app.

## Performance Hub (8 features)
1. **CEO View** - Revenue plans → PMs with pipeline/won from Odoo
2. **PM Plan Builder** - Activity items with Odoo actuals + match indicator
3. **Sales Director** - PM plan buckets + salesperson leaderboard
4. **Team Compare** - Side-by-side PM comparison (Revenue/Activity/Leads)
5. **Marketing** - 345 leads, 75.1% conversion, funnel by stage, by PM/category
6. **Collection** - Invoice states + 64 overdue (OMR 998K)
7. **Incentive Score** - Multi-vector (Revenue 50% + Activity 30% + Collection 20%)
8. **Alert Center** - Proactive monitoring with 6 alert types

## Alert Center (NEW)
Auto-generated alerts scanning all data:
- REVENUE_AT_RISK: PM below target threshold (critical/high)
- ACTIVITY_DROP: Activity completion below 30% (high)
- OVERDUE_SPIKE: Invoice overdue rate >25% (critical) or >15% (high)
- PLAN_UNMATCHED: Redistribution items not fully assigned (medium)
- STALE_LEADS: Leads stuck in early stages >40% (medium)
- TOP_PERFORMER: Activity targets exceeded (positive)

## Bug Fixes Completed
- RBAC route protection (frontend + backend ETL 403)
- Opportunities pagination (1039 total, 11 pages)
- Roles page user counts (was 0, now actual)
- Login error message (inline + toast)

## Backlog
### P2
- [ ] Modular dashboard custom card builder
- [ ] User-specific dashboard overrides

## Key Files
- `/app/backend/services/target_management/alerts.py` - Alert Center API
- `/app/backend/services/target_management/planning.py` - Planning APIs
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Main UI

## Test Results: 9/9 final suite + 17/17 comprehensive + 22/22 planning APIs
