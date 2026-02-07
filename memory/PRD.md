# Securado CRM - Product Requirements Document

## Original Problem Statement
Enterprise CRM analytics platform for Securado (cybersecurity company) with ETL integration from Odoo, RBAC, dashboards, sales pipeline management, and target planning.

**Key Principle: This is a SALES ANALYTICS tool. All data comes from Odoo. Only Target Plans are created here.**

## Target Planning Flow
```
CEO → assigns revenue target to Product Manager
  → PM creates activity plan by product/solution (Demos, POCs, Calls)
    → Plan goes to Sales Director as "bucket"
      → SD redistributes to Account Managers (with match tracking)
        → Salesperson actuals tracked from Odoo (activities, invoices)
```

## What's Implemented (Feb 7-8, 2026)

### 1. Analytics-Driven Target Planning (COMPLETE - Backend + Frontend)
- **Lookups from Odoo**: 6 PMs, 20+ Solution Categories, 44 Salespersons, 14 Activity Types, 661 Accounts
- **Revenue Plans**: CEO assigns to PM with target amount
- **Activity Plan Items**: PM adds per product (e.g., 10 Demos for NDR, 5 POCs for Splunk)
- **Redistribution**: SD assigns items to AMs with match indicator (5/20 assigned, warning if unmatched)
- **Actuals**: All from Odoo - activities done, invoice collection, PM pipeline, salesperson performance
- **Collection Tracking**: 64 overdue invoices (OMR 998K) from Odoo

### 2. Performance Hub UI (4 tabs)
- **CEO View**: Revenue plans table + PM Performance sidebar (from Odoo)
- **PM Plan Builder**: Activity items with Target/Actual(Odoo)/Assigned match + redistribution table
- **Sales Director Bucket**: All PM plans + salesperson performance leaderboard
- **Collection**: Invoice states (paid/partial/not_paid/in_payment) + overdue alert

### 3. RBAC Route Protection (CRITICAL FIX)
- Route-level `RBACGuard` component blocking direct URL access
- Tested: Sales Director blocked from /etl/connections, /admin/settings

### 4. Sidebar Consolidation
- Removed 7 scattered tabs → Performance Hub + Incentives
- Theme consistency with Dashboard (light theme)

### 5. Login Error Message
- Inline red error banner on invalid credentials

## Test Results
- Backend: 22/22 planning API tests passed (curl)
- Testing Agent iteration_16: 96% backend, 100% frontend
- RBAC: Verified for System Admin + Sales Director roles

## Prioritized Backlog

### P0
- [ ] Multi-vector incentive (revenue + activity achievement combined)
- [ ] Marketing team targets integration

### P1
- [ ] Opportunities pagination (capped at 100)
- [ ] Roles page "0 users" bug
- [ ] Backend-level RBAC on ETL API endpoints

### P2
- [ ] Modular dashboard (custom card builder)
- [ ] Invoice RBAC salesperson field refactor

## Key Files
- `/app/backend/services/target_management/planning.py` - Planning APIs (lookups, plans, actuals)
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Main UI
- `/app/frontend/src/App.js` - Route guards
- `/app/frontend/src/lib/api.js` - targetAPI methods

## Test Users
| Role | Email | Password |
|------|-------|----------|
| System Admin | krishna@securado.net | test123456 |
| Sales Director | sales.director@test.securado.com | test123456 |
