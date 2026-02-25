# Securado CRM Platform — Comprehensive Architecture Document

**Version:** 2.0 | **Last Updated:** February 2026 | **Status:** Production

---

## 1. SYSTEM OVERVIEW

Securado CRM is a full-stack sales management platform that integrates with Odoo ERP (v17 Enterprise) for real-time CRM data, providing configurable dashboards, RBAC-scoped analytics, KPI tracking, and sales performance management.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                       │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │Dashboard │ │Dashboard  │ │Opportun- │ │AI Analytics /     │  │
│  │(Read-only│ │Builder    │ │ities/    │ │Performance Hub /  │  │
│  │View)     │ │(Odoo-style│ │Leads/    │ │Targets / Invoices │  │
│  │          │ │Editor)    │ │Accounts  │ │/ Activities       │  │
│  └────┬─────┘ └─────┬─────┘ └────┬─────┘ └────────┬──────────┘  │
│       └──────────────┴───────────┴─────────────────┘             │
│                           │ HTTPS (axios)                        │
├───────────────────────────┼──────────────────────────────────────┤
│                    BACKEND (FastAPI)                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │
│  │Identity &  │ │Card Builder│ │CRM Sales   │ │ETL Runner    │  │
│  │Auth Service│ │& Query     │ │(Opps,Accts,│ │& Incremental │  │
│  │(JWT+SSO)  │ │Engine      │ │Leads,Inv)  │ │Sync Worker   │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬───────┘  │
│        └──────────────┴──────────────┴────────────────┘          │
│                           │                                      │
├───────────┬───────────────┼───────────────────┬──────────────────┤
│  Redis    │               │                   │   Odoo v17       │
│  (Cache)  │          MongoDB                  │   (XML-RPC)      │
│  29 keys  │   ┌───────────┴──────────┐        │   5-min polling  │
│  TTL 60s  │   │event_mesh_app (53)   │        │                  │
│           │   │event_mesh_canonical  │        │                  │
│           │   │(12 collections)      │        │                  │
└───────────┘   └──────────────────────┘        └──────────────────┘
```

---

## 2. TECHNOLOGY STACK

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 19 | SPA framework |
| UI Components | shadcn/ui | latest | Card, Dialog, Sheet, Chart, Tabs, Select, Badge |
| Charts | Recharts | 3.7 | Bar, Pie, Area, Radial via shadcn ChartContainer |
| Grid Layout | react-grid-layout | 2.2.2 | Drag/drop/resize dashboard cards |
| CSS | TailwindCSS | 3 | Utility-first styling |
| Backend | FastAPI | 0.104 | Async Python API framework |
| Database | MongoDB | 7.0 | Document store (2 databases) |
| Cache | Redis | 7.0 | Query result caching (TTL-based) |
| ERP | Odoo | 17 Enterprise | Source of truth for CRM data |
| Auth | JWT + Azure AD | - | Dual auth (email/password + Microsoft SSO) |
| PDF | html2canvas + jsPDF | - | Dashboard PDF export |

---

## 3. BACKEND MICROSERVICES

### 3.1 Identity & Auth Service
**Files:** `services/identity/routes.py`, `services/microsoft_auth/routes.py`
- JWT authentication (HS256, 30min expiry)
- Microsoft Azure AD SSO (OAuth 2.0 + PKCE for SPA)
- User registration, login, profile management
- Token refresh and session management

### 3.2 Card Builder & Query Engine
**Files:** `services/target_management/card_builder.py`, `libs/redis_pipeline.py`
- **923 lines** — Core dashboard configuration service
- Card CRUD (22 cards across 9 chart types)
- Template CRUD (7 role-specific templates)
- Dynamic query execution with Redis caching
- RBAC hierarchy filter (org tree walk)
- Drill-down endpoint (returns underlying records)
- Previous period comparison calculations
- Seed endpoints for default cards and role templates

### 3.3 CRM Sales Service
**Files:** `services/crm_sales/opportunities.py`, `accounts.py`, `activities.py`, `leads.py`, `receivables.py`
- Opportunities: List + Kanban + Detail (1120 lines)
- Accounts, Leads, Activities, Invoices CRUD
- RBAC-scoped queries via access_rules
- Pagination, sorting, filtering

### 3.4 AI Analytics Service
**Files:** `services/ai_analytics/routes.py` (987 lines)
- Sales overview with pipeline metrics
- Sales funnel analysis
- Rep performance rankings (year-filtered)
- Team performance comparison
- Account health scoring

### 3.5 ETL & Sync Service
**Files:** `services/etl_runner/incremental_sync.py`, `runner.py`
- **Incremental polling worker** — 5-minute cycle syncing from Odoo
- 5 entities: opportunities, accounts, invoices, contacts, activities
- Change detection via `write_date` comparison
- UPSERT into MongoDB canonical collections
- Cache invalidation on sync

### 3.6 RBAC & Access Control
**Files:** `services/rbac_sync/access_rules.py`, `libs/rbac_guards.py`
- Centralized user identity map (email → Odoo name variants)
- Org hierarchy walk for subordinate discovery
- Role priority matching for template assignment
- Per-request RBAC middleware

---

## 4. FRONTEND UI ARCHITECTURE

### 4.1 Page Routing
```
/dashboard              → HybridDashboard.js     (READ-ONLY view)
/dashboard-builder      → ConfigurableDashboard.js (BUILDER with editor)
/opportunities          → OpportunitiesPage.js    (List + Kanban)
/leads                  → LeadsPage.js
/accounts               → AccountsPage.js
/analytics              → AnalyticsPage.js        (AI + Dashboard View toggle)
/invoices               → InvoicesPage.js
/activities             → ActivitiesPage.js
/performance-hub        → PerformanceHubPage.js
/targets                → TargetManagementPage.js
/settings               → SettingsPage.js
/users                  → UsersPage.js
/help                   → HelpPage.js
```

### 4.2 Shared Components
- **PageFilters** — Standard inline filter bar shared across Dashboard, Opportunities, Analytics
- **EditChartDialog** — Odoo-style card editor (9 chart types, Data/Display/Target tabs, live preview)
- **DomainBuilderDialog** — Visual filter rule builder (multi-select tags for in/not_in)
- **shadcn/ui** — 40+ components (Chart, Card, Dialog, Sheet, Tabs, Select, Badge, etc.)

### 4.3 State Management
- React useState + useCallback for local state
- Context providers: RBACContext, CurrencyContext, GlobalFilterContext, MicrosoftAuthContext
- URL search params for cross-page filter passing (dashboard → opportunities)

---

## 5. DATA FLOW WORKFLOWS

### 5.1 Dashboard Load
```
1. User opens /dashboard
2. Frontend calls GET /api/card-builder/my-dashboard?year=2026
3. Backend resolves template by role priority
4. Backend resolves RBAC hierarchy filter (org tree walk)
5. For each card in template:
   a. Check Redis cache
   b. Build MongoDB aggregation pipeline
   c. Merge: card filters + global filters + RBAC filter + year filter
   d. Execute query, sort results
   e. Cache result (60s TTL)
   f. For KPI cards: also compute previous year comparison
6. Return template + rendered blocks
7. Frontend renders KPI cards + charts
```

### 5.2 Card Click → Navigation
```
1. User clicks KPI card on dashboard
2. handleCardNavigate builds URL params:
   - year, stage, salesRep, productDirector, solutionCategory
3. navigate('/opportunities?stage=Won&year=2026')
4. Opportunities page reads searchParams
5. Applies as initial filter state
```

### 5.3 Odoo Sync Cycle
```
Every 5 minutes:
1. For each entity (opportunities, accounts, invoices, contacts, activities):
   a. Query Odoo: records with write_date > last_sync_timestamp
   b. Transform fields to canonical schema
   c. UPSERT into MongoDB canonical collection
   d. Update sync_state with new timestamp
2. Invalidate Redis cache keys matching updated entities
3. Log sync results (record counts)
```

---

## 6. DATABASE SCHEMA

### 6.1 Key Collections (event_mesh_app)
- **dashboard_cards** (22) — Card configs with query, display, sort, color
- **dashboard_templates_v2** (7) — Templates with block layouts + role assignments
- **user_identity_map** (83) — Email → canonical name + variants
- **users** (6) — App users with roles
- **system_config** (1) — Microsoft SSO settings

### 6.2 Canonical Data (event_mesh_canonical)
- **opportunities** (1378) — All Odoo CRM leads/opportunities
- **accounts** (705) — res.partner (companies)
- **contacts** (1394) — res.partner (persons)
- **invoices** (264) — account.move
- **activities** (737) — mail.activity
- **employees** (78) — hr.employee (org hierarchy)

---

## 7. SECURITY

- **JWT** (HS256) for API authentication
- **Azure AD SSO** (OAuth 2.0 + PKCE) for Microsoft login
- **RBAC**: 4-layer (app role → Odoo group → org hierarchy → identity map)
- **Data scoping**: Admin=all, Manager=team, User=own
- **CORS**: Configured for preview domain only

---

## 8. KEY DESIGN DECISIONS

1. **date_last_stage_update** for ALL year filtering (matches Odoo)
2. **Separate Dashboard vs Builder** pages (clean separation)
3. **Standard PageFilters** shared across all pages (consistency)
4. **Redis + MongoDB fallback** (resilient caching)
5. **Incremental polling** over webhooks (reliable sync)
6. **Role priority sorting** for template matching (specific > generic)
7. **Error logging** on all query failures (observability)

---

*~25K lines backend, ~22K lines frontend, 53 collections, 100+ endpoints, 7 templates, 22 cards*
