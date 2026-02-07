# Securado CRM - Product Requirements Document

## Original Problem Statement
Enterprise CRM analytics platform for Securado (cybersecurity company) with ETL integration from Odoo, RBAC, dashboards, sales pipeline management, and target planning.

**Key Principle: This is a SALES ANALYTICS tool. All data comes from Odoo. Only Target Plans are created here.**

## Core Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + MongoDB (Motor async)
- **Data Source**: Odoo v17 → ETL → Canonical DB (opportunities, accounts, activities, invoices, employees)
- **Auth**: JWT + Microsoft SSO
- **RBAC**: Odoo groups → synced permissions → UI + route-level guards

## What's Been Implemented

### Session: Feb 7-8, 2026

#### 1. RBAC Route Protection (CRITICAL BUG FIX)
- Added `RBACGuard` component in App.js for route-level permission checks
- Non-admin users see "Access Denied" on restricted pages via direct URL
- Tested: Sales Director blocked from /etl/connections, /admin/settings

#### 2. Sidebar Consolidation
- Removed 7 scattered tabs (Goals, Teams, Portfolios, Initiatives, KPIs, Targets, Activity Tracker)
- Replaced with: **Performance Hub** (/performance) + **Incentives** (/incentives)
- Theme consistency fixed (light theme matching Dashboard)

#### 3. Target Planning System (Analytics-Driven)
**Flow: CEO → Product Manager → Sales Director → Salesperson**

Backend APIs (`/app/backend/services/target_management/planning.py`):
- **Lookups** (from Odoo): `/api/target-lookups/product-managers`, `/solution-categories`, `/salespersons`, `/accounts`, `/activity-types`, `/sales-teams`
- **Revenue Plans**: `/api/target-plans/revenue` (CEO assigns to PM)
- **Activity Plan Items**: `/api/target-plans/revenue/{id}/items` (PM creates per product/category)
- **Redistributions**: `/api/target-plans/items/{id}/redistribute` (Sales Director → Account Managers)
- **Actuals**: `/api/target-actuals/by-product-manager`, `/by-salesperson`, `/activities`, `/collection`

Real Odoo Data Available:
- 6 Product Managers (Vimod Chandran, Shri Hari, Tajuddin, etc.)
- 20+ Solution Categories (Network Security, End Point Security, etc.)
- 14 Activity Types (Meeting, Call, Demo, POC, Workshop, etc.)
- 661 Accounts, 1384 Opportunities, 201 Invoices, 75 Employees
- 717 Activities from Odoo

#### 4. Legacy Target System (still available at /api/sales-targets etc.)
- Simpler target CRUD with incentive calculation engine
- Tiered commissions, SPIFFs, product multipliers
- Simulation engine

#### 5. Login Error Message Fix
- Inline red error banner on invalid credentials

## Prioritized Backlog

### P0 - Critical
- [ ] Build Performance Hub frontend for the new planning flow (CEO → PM → SD → SP)
- [ ] Plan bucket view for Sales Director (aggregated from all PMs)
- [ ] Visual match indicator (assigned vs total) for plan items
- [ ] Invoice collection target tracking linked to overdue data

### P1 - High
- [ ] Opportunities pagination (currently capped at 100)
- [ ] Roles page "0 users" bug
- [ ] Multi-vector incentive calculation (revenue + activities combined)
- [ ] Marketing team targets integration

### P2 - Medium
- [ ] Modular dashboard system (custom card builder from other fork)
- [ ] Invoice RBAC salesperson field refactor

### P3 - Low
- [ ] Achievement badges/gamification
- [ ] Export/reporting for targets

## Key Files
- `/app/backend/services/target_management/planning.py` - Analytics-driven planning APIs
- `/app/backend/services/target_management/routes.py` - Legacy target/incentive APIs
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Unified performance page
- `/app/frontend/src/App.js` - Route guards (RBACGuard)
- `/app/frontend/src/lib/api.js` - All API methods including targetAPI

## Test Users
| Role | Email | Password |
|------|-------|----------|
| System Admin | krishna@securado.net | test123456 |
| Sales Director | sales.director@test.securado.com | test123456 |

## DB Collections
- `event_mesh_canonical.opportunities` - 1384 docs (product_manager, solution_category, owner_name, amount)
- `event_mesh_canonical.accounts` - 661 docs
- `event_mesh_canonical.activities` - 717 docs (activity_type, assigned_user)
- `event_mesh_canonical.invoices` - 201 docs (payment_state, due_date, amount_total)
- `event_mesh_canonical.employees` - 75 docs (manager_id, department_name)
- `event_mesh_app.target_plans` - Revenue plans (CEO → PM)
- `event_mesh_app.target_plan_items` - Activity items (PM's plan)
- `event_mesh_app.target_redistributions` - Sales Director → Account Manager assignments
