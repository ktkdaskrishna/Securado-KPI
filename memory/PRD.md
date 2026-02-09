# Securado CRM - Product Requirements Document

## Original Problem Statement
Enterprise CRM analytics platform for Securado (cybersecurity company). Sales analytics tool pulling all data from Odoo via ETL. Only Target Plans created in-app.

## What's Implemented (Complete)

### Performance Hub (7 tabs)
1. **CEO View** - Revenue plans assigned to PMs with pipeline/won data from Odoo
2. **PM Plan Builder** - Activity plan items with Odoo actuals + match indicator
3. **Sales Director** - PM plans bucket + salesperson leaderboard
4. **Team Compare** - Side-by-side PM comparison (Revenue/Activity/Leads chart + table)
5. **Marketing** - 345 leads, 75.1% conversion, funnel by stage, leads by PM/category
6. **Collection** - Invoice states + 64 overdue (OMR 998K) from Odoo
7. **Incentive Score** - Multi-vector calculator (Revenue 50% + Activity 30% + Collection 20%)

### Bug Fixes
- RBAC route protection (frontend RBACGuard + backend ETL 403)
- Opportunities pagination (1039 total, 11 pages)
- Roles page user counts (was 0 for all, now shows actual: Admin 4, SD 3, etc.)
- Login error message (inline + toast)

### Architecture
- All data from Odoo canonical DB (no manual entry except Target Plans)
- Backend: FastAPI + MongoDB (Motor async)
- Frontend: React + Tailwind + Shadcn/UI

## Backlog
### P2
- [ ] Modular dashboard custom card builder
- [ ] User-specific dashboard overrides

## Key Files
- `/app/backend/services/target_management/planning.py` - All planning APIs
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Main UI (7 tabs)
- `/app/frontend/src/App.js` - Route guards
- `/app/backend/libs/rbac_guards.py` - Backend RBAC

## Test Results: 17/17 comprehensive tests passed
