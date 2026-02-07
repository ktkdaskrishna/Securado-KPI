# Securado CRM - Product Requirements Document

## Original Problem Statement
Enterprise CRM platform for Securado (cybersecurity company) with ETL integration from Odoo, RBAC, dashboards, and sales pipeline management.

## Core Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + MongoDB (Motor async)
- **Auth**: JWT + Microsoft SSO
- **Data**: Odoo ETL → Canonical DB → App DB
- **RBAC**: Odoo groups → synced permissions → UI + route guards

## What's Been Implemented

### Session: Feb 7-8, 2026

#### 1. Sales Target Management System (NEW)
- **Revenue Targets**: Hierarchical assignment (Company → Product → Team → Individual)
- **Activity Targets**: Call, email, meeting, demo, POC, workshop tracking with scoreboard
- **Incentive Engine**: Tiered commission plans with SPIFFs, product multipliers, simulation
- **Target Sheets**: For Product Directors to distribute targets to pre-sales
- **Backend**: `/app/backend/services/target_management/` (routes.py, models.py)
- **API Endpoints**: `/api/sales-targets`, `/api/activity-targets`, `/api/incentive-plans`, `/api/incentive-calc`, `/api/target-sheets`

#### 2. Performance Hub (Consolidated UI)
- Merged 7 scattered tabs (Goals, Teams, Portfolios, Initiatives, KPIs, Targets, Activity Tracker) into single "Performance Hub" at `/performance`
- 4 tabs: Revenue Targets, Activity Tracker, Leaderboard, Incentives
- Light theme matching Dashboard styling
- **File**: `/app/frontend/src/components/crm/PerformanceHubPage.js`

#### 3. RBAC Route Protection (CRITICAL BUG FIX)
- **Bug**: All restricted pages accessible via direct URL by any authenticated user
- **Fix**: Added `RBACGuard` component in App.js wrapping all protected routes
- ETL pages require `system_admin` permission
- Admin pages require `manage_users` or `system_admin`
- CRM pages require respective permissions (view_opportunities, view_invoices, etc.)
- Shows "Access Denied" page for unauthorized access

#### 4. Login Error Message Fix
- Added inline error message display on invalid credentials
- Error shown with red background below password field

#### 5. Sidebar Consolidation
- **Removed**: Goals, Teams, Portfolios, Initiatives, KPIs, Targets, Activity Tracker
- **Added**: Performance Hub, Incentives
- Clean sidebar with ~11 CRM items instead of ~17

### Previous Sessions (Summary)
- RBAC system overhaul with System Admin role
- SSO Microsoft integration
- ETL pipeline from Odoo
- AI Analytics with GPT
- Bluesheet probability assessment
- Activity timeline
- Invoice management
- Data quality tools

## Prioritized Backlog

### P0 - Critical
- [ ] Multi-vector incentive calculation (revenue + activities + marketing combined)
- [ ] CEO → PM → Sales Manager → Sales Team target cascade chain
- [ ] Marketing team target integration

### P1 - High
- [ ] Opportunities pagination (currently capped at 100)
- [ ] Roles page "0 users" bug
- [ ] Modular dashboard system (from other fork - custom card builder, responsive grid)
- [ ] react-grid-layout responsive fix

### P2 - Medium
- [ ] Invoice RBAC salesperson field refactor
- [ ] RBAC code comments
- [ ] Data sync verification
- [ ] Role-based template switching for dashboard

### P3 - Low
- [ ] Achievement badges/gamification
- [ ] Export/reporting for targets
- [ ] Goal templates
- [ ] Notification system for KPI alerts

## Test Users
| Role | Email | Password |
|------|-------|----------|
| System Admin | krishna@securado.net | test123456 |
| CEO | ceo@test.securado.com | test123456 |
| Sales Director | sales.director@test.securado.com | test123456 |
| Finance Manager | finance.manager@test.securado.com | test123456 |

## Key Files
- `/app/backend/services/target_management/routes.py` - Target & incentive APIs
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Unified performance page
- `/app/frontend/src/components/crm/IncentiveCalcPage.js` - Detailed incentive management
- `/app/frontend/src/App.js` - Route guards (RBACGuard)
- `/app/frontend/src/components/layout/Sidebar.js` - Navigation
