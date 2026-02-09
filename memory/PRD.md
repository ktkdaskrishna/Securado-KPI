# Securado CRM - Product Requirements Document

## What's Implemented (Complete)

### Performance Hub (7 tabs + Alert Center)
- CEO View, PM Plan Builder, Sales Director, Team Compare, Marketing, Collection, Incentive Score
- Alert Center: 6 alert types (REVENUE_AT_RISK, ACTIVITY_DROP, OVERDUE_SPIKE, PLAN_UNMATCHED, STALE_LEADS, TOP_PERFORMER)

### Bug Fixes Applied
- P0: Admin RBAC permissions resolved from app roles (fallback when Odoo groups empty)
- P0: All test personas work (admin, SD, finance, CEO, sales user)
- P1: Activities/Invoices endpoints verified for all roles
- "OMR OMR" currency duplicate fixed (Invoices page dropdown)
- Dashboard Y-axis truncation fixed (now shows OMR 3.6M format)
- Opportunities pagination (1039 total, 11 pages)
- Roles page user counts (actual counts from users collection)
- Login error message (inline + toast)
- RBAC route protection (frontend + backend ETL 403)
- Test accounts and test data cleaned (only krishna@securado.net remains)

### Architecture
- All data from Odoo canonical DB (186 invoices, 1333 opportunities, 717 activities, 661 accounts)
- Only Target Plans created in-app
- Backend: FastAPI + MongoDB | Frontend: React + Tailwind + Shadcn/UI

## Backlog
- P2: Modular dashboard custom card builder
- P2: 313.2% conversion rate bug in AI Analytics funnel

## Key Files
- `/app/backend/services/odoo_rbac/routes.py` - RBAC with app roles fallback
- `/app/backend/services/target_management/alerts.py` - Alert Center
- `/app/backend/services/target_management/planning.py` - Planning APIs
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Performance Hub
- `/app/frontend/src/lib/currency.js` - Currency formatting (OMR fix)
