# Securado CRM Platform - PRD

## Original Problem Statement
Build a sales target, incentive, and KPI management system integrated with Odoo. Evolved into a full configurable dashboard system with dynamic query engine, RBAC, and data sync.

## Core Architecture
- **Frontend:** React 19 + Shadcn/UI + TailwindCSS + react-grid-layout v2
- **Backend:** FastAPI + MongoDB + Redis (cache/query engine)
- **Data Sync:** Incremental polling worker syncing from Odoo v17
- **Auth:** JWT + Microsoft Azure AD SSO
- **Dashboard:** Configurable react-grid-layout with 12-column responsive grid

## What's Been Implemented

### Phase 1: Core CRM Platform (Complete)
- Auth (register, login, SSO), RBAC with centralized user identity map
- Opportunities, Accounts, Activities, Invoices pages
- ETL pipeline management (connections, mappings, runs)
- AI Analytics with filter builder

### Phase 2: Target Management (Complete)
- Sales targets, activity targets, incentive plans
- Performance Hub with role-specific views
- Organization page with org chart from Odoo
- Data Tools (Excel export/import)

### Phase 3: Data Architecture (Complete)
- Redis-backed query engine for dashboard cards
- Incremental polling sync worker (replaced webhooks)
- Centralized email-based user identity map
- Serving cache layer for consistent analytics

### Phase 4: Configurable Dashboard (Complete - Feb 2026)
- **react-grid-layout v2.2.2 integration** with drag-drop-resize
- **12-column responsive grid** with proper breakpoints (lg:12, md:8, sm:4)
- **Edit Mode** toggle (admin only) with amber banner, save layout
- **Template Manager UI** - create, edit, delete dashboard templates
- **Role Assignment** - assign templates to user roles
- **Win Rate fix** - displays formatted percentage (85.7%) not raw number
- **Add/Remove cards** from dashboard layout
- **Save Layout** persists card positions to database
- **Dynamic card rendering** for all display types: number, win_rate, chart, pie, leaderboard, progress, table

### Phase 5: Help & Documentation (Complete - Feb 2026)
- **Integration Guides tab** in Help page with Microsoft Azure AD SSO Setup KB
- **Troubleshooting section** with expandable accordion for common SSO errors
- **Technical flow diagram** and Quick Reference table for Azure AD values
- Updated backend Microsoft SSO redirect URI config for current app URL

## Key Endpoints
- `GET /api/card-builder/my-dashboard` - User's dashboard with rendered blocks
- `GET/POST /api/card-builder/cards` - Cards CRUD
- `GET/POST /api/card-builder/templates` - Templates CRUD
- `POST /api/card-builder/templates/{id}/layout` - Save layout
- `GET /api/card-builder/available-roles` - Roles for assignment
- `POST /api/card-builder/seed-defaults` - Seed default CEO dashboard

## Key DB Collections
- `dashboard_cards` - Card configurations with queries
- `dashboard_templates_v2` - Templates with blocks layout + role assignments
- `user_identity_map` - Centralized user identity linking
- `sync_settings` - Incremental sync configuration

## Prioritized Backlog

### P1 - Next Up
- Implement Gross Profit & Costing KPIs (costing sheets, project man-days from Odoo)
- Replace In-Memory Event Bus with Redis Streams

### P2
- Build Strategy & Marketing Team KPIs
- Refactor crm_sales analytics to use dashboard_query_engine
- Refactor to Services/Repositories pattern

### P3
- Implement Refresh Token Storage
- Dashboard card templates gallery (pre-built card configs)

## Test Credentials
- Admin: krishna@securado.net / test123456
- Product Director 1: vimod.chandran@securado.net / test123456
- Product Director 2: tajuddin.mohammed@securado.net / test123456
- Sales Rep: nabisaheb.m@securado.net / test123456
