# Securado CRM - Product Requirements Document

## What's Implemented (Complete)

### Performance Hub (7 tabs + Alert Center)
- CEO View, PM Plan Builder, Sales Director, Team Compare, Marketing, Collection, Incentive Score
- Alert Center with 6 alert types (REVENUE_AT_RISK, ACTIVITY_DROP, OVERDUE_SPIKE, PLAN_UNMATCHED, STALE_LEADS, TOP_PERFORMER)

### UAT Bug Fixes (Feb 9, 2026)
- **P0 FIXED**: Admin role permissions resolved from app roles when Odoo groups empty (test@securado.com now has admin:* + 25 permissions)
- **P0 FIXED**: All test users (admin, SD, finance, CEO) now get correct permissions via fallback role resolution
- **P1 VERIFIED**: Activities endpoint returns 717 records for Sales Director
- **P1 VERIFIED**: Invoices work for both Sales Director and Finance Manager
- **Roles page**: Shows actual user counts (Admin: 4, SD: 3, etc.)
- **Pagination**: Opportunities show 1,039 total with Previous/Next
- **Login error**: Inline + toast on invalid credentials
- **RBAC**: Frontend route guards + Backend ETL 403

### Data Notes
- Dashboard defaults to year 2026 filter - most Odoo data is from prior years, so some views show 0s when filtered
- Finance Manager correctly restricted: view_invoices YES, view_opportunities NO
- test@securado.com dashboard shows 0 because of year filter, not a bug

## Backlog
- P2: Modular dashboard custom card builder
- P2: "OMR OMR" duplicate currency fix on Invoices page
- P2: 313.2% conversion rate calculation bug in AI Analytics funnel

## Key Files
- `/app/backend/services/odoo_rbac/routes.py` - RBAC with app roles fallback (line ~492)
- `/app/backend/services/target_management/alerts.py` - Alert Center
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Performance Hub

## Test Results: 12/12 UAT fixes verified
