# Securado CRM - Software Architecture Document
## Version: Feb 2026 | Total: 21,364 backend + 24,774 frontend lines

---

## 1. SYSTEM OVERVIEW

```
┌──────────────────────────────────────────────────────┐
│                    FRONTEND (React)                   │
│  24,774 lines | Tailwind + Shadcn/UI + Recharts      │
│  Port 3000 | Hot reload                              │
├──────────────────────────────────────────────────────┤
│                    BACKEND (FastAPI)                   │
│  21,364 lines | 16 services | 30+ API routers        │
│  Port 8001 | Async (Motor for MongoDB)               │
├──────────────────────────────────────────────────────┤
│                    DATABASE (MongoDB)                  │
│  2 databases: event_mesh_app + event_mesh_canonical   │
│  6,695 total synced records                          │
├──────────────────────────────────────────────────────┤
│                    EXTERNAL: Odoo v17                  │
│  https://erp.securado.net | XML-RPC API              │
│  Microsoft Azure AD (SSO)                            │
└──────────────────────────────────────────────────────┘
```

---

## 2. BACKEND SERVICE INVENTORY

### 2.1 Authentication & Identity (700 lines)
**File**: `services/identity/routes.py`
**Routes**: `/api/auth/*`, `/api/admin/*`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | JWT login with email/password |
| `/auth/register` | POST | New user registration |
| `/auth/me` | GET | Current user profile |
| `/admin/users` | GET | List all users |
| `/admin/users/{id}` | PUT | Update user |
| `/admin/users/{id}/roles` | PUT | Assign roles |

**Dependencies**: bcrypt, JWT (jose), MongoDB `users` collection

### 2.2 Microsoft SSO (699 lines)
**File**: `services/microsoft_auth/routes.py`
**Routes**: `/api/auth/microsoft/*`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/microsoft/login` | GET | Initiate MS OAuth |
| `/auth/microsoft/callback` | GET | Handle OAuth callback |

**Dependencies**: MSAL library, Azure AD tenant config

### 2.3 RBAC System (4 files, 2,410 total lines)

#### 2.3.1 Odoo RBAC (`services/odoo_rbac/routes.py` - 749 lines)
**Routes**: `/api/odoo-rbac/*`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/odoo-rbac/current-user-rbac` | GET | **CRITICAL** - Resolves user permissions |
| `/odoo-rbac/groups` | GET | List Odoo groups |
| `/odoo-rbac/sync-all` | POST | Sync all RBAC from Odoo |

**Key Logic**: `APP_ROLE_PERMS` constant (line ~462) maps 13 app roles to permissions.
Resolution chain: JWT user → `users_rbac` (Odoo groups) → `users` (app roles) → permission set.
Canonical name resolution by email for multi-name matching.

#### 2.3.2 RBAC Rules (`services/rbac/routes.py` - 359 lines)
**Routes**: `/api/admin/roles`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/roles` | GET | List 12 roles (defaults + stored, merged) |
| `/admin/roles/{id}` | PUT | Update role (upserts if default) |

#### 2.3.3 Access Rules (`services/rbac_sync/access_rules.py` - 442 lines)
**No routes** - Library used by middleware.
**Key Function**: `get_filter_for_user()` - builds MongoDB query filters per user:
- Admin → `{}` (no filter)
- Product Director → `{product_manager: pattern}` (by canonical name via email)
- Sales Rep → `{owner_name: pattern}` (multi-name OR pattern)
- Invoices for reps → resolved via account_name from their opportunities

#### 2.3.4 RBAC Middleware (`services/rbac_sync/middleware.py` - 90 lines)
**No routes** - Provides `get_rbac_filter()` dependency.
Normalizes user name whitespace. Passes `user_email` for canonical name resolution.

### 2.4 CRM Sales (2,619 lines - LARGEST)
**File**: `services/crm_sales/routes.py`
**Routes**: 6 routers

| Router | Prefix | Key Endpoints |
|--------|--------|--------------|
| opportunities | `/opportunities` | LIST (paginated, filtered), GET, kanban, export |
| leads | `/leads` | LIST, GET, convert, stats |
| accounts | `/accounts` | LIST, GET, contacts |
| activities | `/activities` | LIST, GET, stats, complete |
| kpis | `/kpis` | CRUD |
| receivables | `/receivables` | LIST, stats, by-salesperson |

**Stage Aliases** (line ~271): Maps `closed_won` → `["Won", "Closed Won", "closed_won"]`
**Global Filters**: `product_manager` and `solution_category` params on opportunities + dashboard

### 2.5 Bluesheet (459 lines)
**File**: `services/crm_sales/bluesheet.py`
**No routes** - Called by opportunities endpoint.
**Key**: Won stage auto-returns 100% probability (line ~304).

### 2.6 Dashboard Aggregation (1,067 lines)
**File**: `services/dashboard_agg/routes.py`
**Routes**: `/api/dashboard/*`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard/stats` | GET | Pipeline, win rate, leaderboard (with PD/category filters) |
| `/dashboard/sync-status` | GET | Data freshness |

### 2.7 AI Analytics (1,003 lines)
**File**: `services/ai_analytics/routes.py`
**Routes**: `/api/analytics/*`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/analytics/overview` | GET | Pipeline summary |
| `/analytics/conversion-funnel` | GET | Win Rate = Won/(Won+Lost) |
| `/analytics/filters` | GET | Filter options |

### 2.8 Target Management (5 files, 3,280 total lines)

#### Planning (`planning.py` - 1,290 lines)
**Routes**: `/api/target-lookups/*`, `/api/target-plans/*`, `/api/target-actuals/*`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/target-lookups/product-managers` | GET | 6 PMs from Odoo |
| `/target-lookups/solution-categories` | GET | 20+ categories from Odoo |
| `/target-lookups/salespersons` | GET | 44 salespersons from Odoo |
| `/target-lookups/teams-with-members` | GET | Manager → employee hierarchy |
| `/target-plans/revenue` | POST | CEO assigns target to PD (auto-generates suggestions) |
| `/target-plans/revenue/{id}/items` | POST | PD adds activity plan items |
| `/target-plans/items/{id}/redistribute` | POST | Assign to person or team |
| `/target-actuals/my-data` | GET | **Role-specific** data for current user |
| `/target-actuals/ceo-summary` | GET | 5 RAG signals + auto-insight |
| `/target-actuals/revenue-cap/{id}` | GET | Activity < 80% → revenue capped |
| `/target-actuals/multi-vector-incentive` | POST | Revenue + Activity + Collection score |
| `/target-actuals/team-comparison` | GET | Side-by-side PM comparison |
| `/target-actuals/marketing-metrics` | GET | Leads funnel |
| `/target-plans/revenue/{id}/suggestions` | GET | Auto-generated activity suggestions |

#### Legacy Targets (`routes.py` - 981 lines)
Older CRUD for sales_targets, activity_targets, incentive_plans, target_sheets.
**Status**: Still functional but being superseded by planning.py for new features.

#### Alerts (`alerts.py` - 165 lines)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/alerts` | GET | 6 alert types scanned from real data |

#### Org Structure (`org_structure.py` - 134 lines)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/org-structure/tree` | GET | Employee hierarchy from Odoo |
| `/org-structure/departments` | GET | 6 departments with members |
| `/org-structure/employees` | GET | 75 employees with active/inactive |

#### Filter Presets (`filter_presets.py` - 62 lines)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/filter-presets` | GET/POST/DELETE | Saved Notion-style filter combinations |

#### Integration Hub (`integration_hub.py` - 112 lines)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/integration-hub/overview` | GET | 10 entities sync status |
| `/integration-hub/schedule/{id}` | PUT | Set sync schedule |
| `/integration-hub/sync/{id}` | POST | Manual sync trigger |

### 2.9 ETL Control (2,555 lines)
**File**: `services/etl_control/routes.py`
**Routes**: connections, mappings, pipelines, runs, templates
**Protected**: All routes require `system_admin` via `require_system_admin` dependency.

### 2.10 ETL Runner (828 lines)
**File**: `services/etl_runner/runner.py`
**No routes** - Event-driven. Listens for `ETL_PIPELINE_RUN_COMMAND`.
**Uses**: XML-RPC to connect to Odoo, extract data, transform via mappings, load to canonical DB.

### 2.11 Other Services

| Service | Lines | Purpose |
|---------|-------|---------|
| CRM Goals | 621 | Goals, initiatives, portfolios |
| Config | ~200 | App settings |
| Data Integrity | 530 | Audit logs, reconciliation |
| Event Gateway | ~150 | Event bus REST interface |
| Event Queue | ~500 | Background task processing |
| Serving Cache | ~700 | Materialized views |
| Canonical Query | ~200 | Direct canonical DB access |

---

## 3. DATABASE SCHEMA

### 3.1 App Database (`event_mesh_app`)

| Collection | Records | Purpose |
|-----------|---------|---------|
| users | 4 | App user accounts |
| users_rbac | 73 | Synced Odoo user permissions |
| roles | 1 | Stored role configs (merged with defaults for 12 total) |
| connections | 1 | Odoo ERP connection |
| mappings | 3 | Field transformation configs |
| pipelines | 3 | ETL pipeline configs |
| pipeline_runs | 22 | Run history |
| target_plans | 3 | Revenue plans (CEO → PD) |
| target_plan_items | 2 | Activity targets |
| target_redistributions | 3 | Assignments to teams/people |
| activity_suggestions | 1 | Auto-generated plan suggestions |
| sync_configs | 1 | Per-entity schedule settings |
| sync_history | 1 | Manual sync trigger log |
| filter_presets | 1 | Saved filter combinations |

### 3.2 Canonical Database (`event_mesh_canonical`)

| Collection | Records | Odoo Model | Purpose |
|-----------|---------|-----------|---------|
| opportunities | 1,358 | crm.lead | Sales pipeline |
| accounts | 666 | res.partner | Companies |
| contacts | 1,385 | res.partner | People |
| activities | 737 | mail.activity | Calls, meetings, demos |
| invoices | 243 | account.move | Billing |
| employees | 78 | hr.employee | Org structure |
| sales_users | 149 | res.users | CRM users |
| sales_teams | 6 | crm.team | Team structure |
| tasks | 2,000 | project.task | Delivery tasks |

---

## 4. FRONTEND ARCHITECTURE

### 4.1 Page Components (by size)

| Page | Lines | Route | Purpose |
|------|-------|-------|---------|
| OpportunitiesPage | 1,633 | /opportunities | Full CRM with kanban, pagination, 7 filters |
| AnalyticsPage | 726 | /analytics | AI funnel, leaderboard |
| InvoicesPage | 698 | /invoices | Receivables with collection tracking |
| DashboardPage | 683 | /dashboard | Pipeline, win rate, leaderboards |
| PerformanceHubPage | 548 | /performance | Role-based tabs (CEO/PD/Rep) |
| AccountsPage | 515 | /accounts | Company cards |
| IntegrationsPage | ~200 | /admin/integrations | 10 tabs embedding original ETL components |

### 4.2 Shared Libraries

| File | Purpose |
|------|---------|
| `lib/api.js` | All API methods (crmAPI, etlAPI, targetAPI, analyticsAPI) |
| `lib/auth.js` | JWT auth context |
| `lib/RBACContext.js` | Permission checking |
| `lib/GlobalFilterContext.js` | PD + Category + Year filters |
| `lib/CurrencyContext.js` | OMR formatting |

### 4.3 UI Components

| Component | Purpose |
|-----------|---------|
| `layout/Sidebar.js` | Role-based navigation (CRM + Admin) |
| `layout/PageFilters.js` | 7 filter dropdowns (Year, Quarter, Sales Rep, Account, Stage, PD, Category) |
| `layout/AdvancedFilterBuilder.js` | Notion-style AND/OR filter builder with saved presets |

---

## 5. IDENTIFIED ISSUES & DEAD CODE

### 5.1 Unused Frontend Pages (still in codebase but not in sidebar)
- `TargetManagementPage.js` (479 lines) - superseded by PerformanceHubPage
- `ActivityTrackerPage.js` (317 lines) - merged into Performance Hub
- `KPIsPage.js` (299 lines) - merged into Performance Hub
- `GoalsPage.js` (290 lines) - merged into Performance Hub
- `TeamsPage.js` - merged into Organization page

### 5.2 Backend Dead Code
- `services/crm_goals/routes.py` (621 lines) - Goals, Portfolios, Initiatives endpoints still registered but UI removed from sidebar
- `services/target_management/routes.py` (981 lines) - Legacy target CRUD, partially superseded by planning.py

### 5.3 Potential Issues Found
1. **`crm_sales/routes.py` is 2,619 lines** - Should be split into separate files per entity
2. **Duplicate RBAC logic** - Permission resolution exists in 3 places: odoo_rbac/routes.py, rbac_sync/access_rules.py, rbac_sync/middleware.py
3. **Stage handling inconsistent** - Some code checks `custom_stage`, others check `stage`. Stage aliases only in opportunities endpoint, not in dashboard or analytics
4. **MongoD ObjectId risk** - `serialize_doc()` used but not consistently across all endpoints
5. **No API versioning** - All routes under `/api/` without version prefix

---

## 6. SECURITY REVIEW

| Area | Status | Notes |
|------|--------|-------|
| Authentication | ✅ | JWT + Microsoft SSO |
| Route Protection | ✅ | Frontend RBACGuard + Backend `require_system_admin` on ETL |
| Data Scoping | ✅ | Multi-name canonical resolution for PD/Rep filtering |
| ETL Protection | ✅ | `require_system_admin` dependency on all ETL routers |
| CORS | ⚠️ | Not explicitly configured in server.py |
| Rate Limiting | ❌ | No rate limiting |
| Input Validation | ✅ | Pydantic models on POST/PUT endpoints |
| Password Security | ✅ | bcrypt hashing |

---

## 7. DATA FLOW DIAGRAMS

### 7.1 Authentication Flow
```
User → /auth/login → verify password → generate JWT → return token
User → /auth/microsoft/login → Azure AD → callback → find/create user → JWT
```

### 7.2 Data Access Flow (per request)
```
Request → JWT verify → get_current_user → get_rbac_filter(entity_type)
  → resolve canonical name (email → employees → all name variants)
  → check app roles (users.roles)
  → check Odoo groups (users_rbac.odoo_group_names)
  → determine access level (admin/director/manager/user)
  → build MongoDB filter
  → query canonical DB with filter
  → return scoped data
```

### 7.3 ETL Sync Flow
```
Sync Button → /integration-hub/sync/{entity}
  → find matching pipeline
  → emit ETL_PIPELINE_RUN_COMMAND event
  → ETL Runner receives event
  → connect to Odoo via XML-RPC
  → read mapping config (field transformations)
  → extract records from Odoo model
  → transform fields per mapping
  → load into canonical DB collection
  → log run result
```

### 7.4 Target Planning Flow
```
CEO: POST /target-plans/revenue → creates plan + auto-generates suggestions
PD: GET /target-plans/revenue/{id}/suggestions → reviews suggestions
PD: POST /target-plans/revenue/{id}/suggestions/accept → creates plan items
PD/SD: POST /target-plans/items/{id}/redistribute → assigns to team/person
Rep: GET /target-actuals/my-data → sees assigned tasks
CEO: GET /target-actuals/ceo-summary → sees 5 RAG signals
```
