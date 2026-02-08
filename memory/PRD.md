# Securado CRM - Product Requirements Document

## Original Problem Statement
Enterprise CRM analytics platform for Securado (cybersecurity company). Sales analytics tool pulling all data from Odoo via ETL. Only Target Plans created in-app.

## Target Planning Flow
```
CEO → Revenue target to Product Manager (e.g., "Vimod, I need 3M")
  → PM creates activity plan by product/solution (10 Demos NDR, 5 POCs Splunk, 20 Calls PAM)
    → Plan goes to Sales Director as "bucket"
      → SD redistributes to Account Managers (match tracking: 5/20 assigned)
        → Actuals from Odoo (activities done, invoices collected, revenue won)
          → Multi-vector incentive: Revenue + Activity + Collection composite score
```

## What's Implemented

### Target Planning System (COMPLETE)
- **Lookups**: 6 PMs, 20+ Solution Categories, 44 Salespersons, 14 Activity Types from Odoo
- **Revenue Plans**: CEO → PM assignment with real pipeline/won data enrichment
- **Activity Plan Items**: PM creates per product with Odoo actuals auto-populated
- **Redistribution**: SD → AM with match indicator (e.g., 5/20 assigned)
- **Multi-Vector Incentive**: Revenue(50%) + Activity(30%) + Collection(20%) weighted composite score with tier classification

### Performance Hub UI (5 tabs)
- CEO View | PM Plan Builder | Sales Director Bucket | Collection | Incentive Score

### RBAC (Frontend + Backend)
- Route-level `RBACGuard` blocking unauthorized page access
- Backend ETL API protection via `require_system_admin` dependency (HTTP 403)
- Sales Director tested: blocked from ETL/Admin, can access CRM

### Opportunities Pagination (FIXED)
- Response: `{ items: [...], total: 1039, limit: 100, skip: 0, has_more: true }`
- UI: "Showing 1-100 of 1,039 opportunities" with Previous/Next/Page controls

### Login Error Message (FIXED)
- Inline red banner + toast notification on invalid credentials
- Fixed axios interceptor to not redirect on login page 401

## Test Results
- 22/22 planning API tests (curl)
- 12/12 feature tests (pagination + multi-vector + backend RBAC)
- Testing Agent iteration_16: 96% backend, 100% frontend

## Backlog
### P1
- [ ] Marketing team targets integration
- [ ] Roles page "0 users" bug

### P2
- [ ] Modular dashboard (custom card builder)
- [ ] User-specific dashboard overrides

## Key Files
- `/app/backend/services/target_management/planning.py` - Planning + Multi-vector APIs
- `/app/backend/libs/rbac_guards.py` - Backend RBAC dependencies
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Main UI
- `/app/frontend/src/App.js` - Route guards
- `/app/frontend/src/lib/api.js` - API methods + fixed interceptor
