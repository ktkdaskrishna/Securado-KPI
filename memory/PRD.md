# Securado CRM — PRD

## Original Problem Statement
Build a sales target, incentive, and KPI management system integrated with Odoo. Evolved into a fully configurable Odoo-style dashboard platform with dynamic query engine, RBAC hierarchy scoping, and real-time data sync.

## Production URL: https://bi.securado.net

## Architecture
- Frontend: React 19 + shadcn/ui + TailwindCSS + react-grid-layout v2 + Recharts 3
- Backend: FastAPI + MongoDB + Redis
- Data Sync: Incremental polling from Odoo v17 (5-min cycle)
- Auth: JWT + Microsoft Azure AD SSO (MSAL.js 2.0 redirect flow)
- Dashboard: Configurable grid with 9 chart types, 7 role templates

## Completed Phases
1. Core CRM (Auth, Opportunities, Accounts, Activities, Invoices)
2. Target Management (Sales targets, incentive plans, Performance Hub)
3. Data Architecture (Redis query engine, incremental sync, user identity map)
4. Configurable Dashboard (react-grid-layout, template manager, role assignment)
5. Help & Documentation (SSO setup KB, troubleshooting)
6. RBAC Hierarchy (org tree walk, admin/manager/user scoping)
7. Premium Dashboard (Odoo-style flat KPI cards, drill-down, hover controls)
8. Architecture Split (Dashboard read-only, Builder with Odoo editor)
9. Chart Types + Domain Builder (9 types, multi-select tags, Won/Lost lists)
10. Role Templates + Global Filters (7 templates, PageFilters, card navigation)
11. AI Analytics + Slideshow (Dashboard View toggle, auto-rotate templates)
12. Enhancements (Previous period comparison, PDF export)
13. Production Deployment (bi.securado.net, Azure AD SSO, MongoDB fix)

## Key Design Decisions
- date_last_stage_update for ALL year filtering (matches Odoo)
- DB_NAME env var drives database name (Emergent overrides on production)
- SSO credentials in env vars (not DB-dependent)
- Separate Dashboard (read-only) vs Builder (full editor)
- Standard PageFilters shared across all pages
- Modular updates only — see DEVELOPMENT_RULES.md

## Test Credentials
- Admin: krishna@securado.net / test123456
- Product Director: vimod.c@securado.net / test123456
- Product Director: taj@securado.net / test123456
- Sales Rep: nabisaheb@securado.net / test123456
