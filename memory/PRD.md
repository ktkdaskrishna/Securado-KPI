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

### Phase 6: Hierarchy-Based RBAC & Bug Fixes (Complete - Feb 2026)
- **Org hierarchy RBAC scoping** — Dashboard queries filtered by employee reporting chain
  - Admin: sees all data | Manager/Director: own + subordinate chain | User: own only
  - Uses recursive tree walk on `employees.manager_id` from Odoo
  - Applied to: my-dashboard, execute-card, execute-adhoc-query endpoints
- **Fixed delete card from layout** — onMouseDown stopPropagation prevents drag capture
- **7 default roles** in template assignment (Admin, Sales Admin, Sales Director, Product Director, Sales Rep, Marketing, User)
- **Fixed template update** — editing name/roles no longer overwrites cards/blocks

### Phase 7: Premium Dashboard & Drill-Down (Complete - Feb 2026)
- **Colorful gradient KPI cards** — Odoo-style fully colored cards with large background icons
- **Drill-down panel** — Click any KPI card to see underlying records in a slide-out panel
- **Drill-down API** — `POST /api/card-builder/cards/{id}/drill-down` returns RBAC-scoped records
- **Chart bar click** — Click chart bars to drill into specific segments
- **Animated progress bars** with framer-motion
- **Date presets** — This Year / Last Year selector
- Premium hover effects, scale transitions, backdrop blur

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


### Phase 8: Dashboard Architecture Split (Complete - Feb 2026)
- Split into `/dashboard` (read-only) and `/dashboard-builder` (full Odoo-style editor)
- Dashboard: Clean view showing assigned template, drill-down on click, no edit controls
- Builder: 3 tabs (Layout Editor, Templates, All Cards), drag/drop/resize, Edit Chart dialog
- Edit Chart Dialog: Chart type grid, Data/Display/Target tabs, live preview, color swatches


### Phase 9: Chart Types + Won/Lost Lists + Domain Builder (Complete - Feb 2026)
- **9 chart types**: KPI, Bar, Area (new), Pie, Radial (new), List, Progress, Rate, Table
- **Won Top 10 / Lost Top 10** table cards added to seed defaults
- **Pipeline Trend** (Area chart) and **Solution Mix** (Radial chart) seed cards
- **Visual Domain Builder** — Odoo-style rule editor: Field→Operator→Value dropdowns, Match all/any, Add/Delete rules
- **Date Filter Field** selector matching Odoo (Last Stage Update, Created Date, etc.)
- Seed defaults now creates 13 cards (was 9)

### Phase 10: Role Templates + Global Filters (Complete - Feb 2026)
- **7 role-specific dashboard templates**: CEO, Sales Director, Product Director, Sales Rep, Finance, Marketing, Sales Team
- **22 total cards** across all templates covering all CRM data models
- **Seed endpoint** `POST /api/card-builder/seed-role-templates` auto-creates all templates with role assignments
- **Smart role priority matching** — specific roles (product_director) take precedence over generic (user)
- **Global Filter Panel** on dashboard — filter ALL cards by Salesperson, Product Director, Solution Category
- **Card click → navigate** to filtered Opportunities/Invoices/Accounts pages
- **"View All in Page"** button in drill-down panel footer


### Phase 11: AI Analytics Dashboard + Slideshow + All Remaining (Complete - Feb 2026)
- **AI Analytics Dashboard View** — Toggle between AI Analytics and configurable Dashboard View on Analytics page
- **Dashboard Slideshow Mode** — Auto-rotates between all templates every 10 seconds for office wall displays

### Phase 12: Future Enhancements (Complete - Feb 2026)
- **Previous Period Comparison** — KPI cards show % change arrows vs last year (green up/red down)
- **PDF Export** — "PDF" button generates downloadable PDF snapshot of dashboard using html2canvas + jsPDF
- Backend computes previous year values and change_pct for all KPI cards

- **All P2/P3 items completed** in this phase


## Test Credentials
- Admin: krishna@securado.net / test123456
- Product Director 1: vimod.chandran@securado.net / test123456
- Product Director 2: tajuddin.mohammed@securado.net / test123456
- Sales Rep: nabisaheb.m@securado.net / test123456
