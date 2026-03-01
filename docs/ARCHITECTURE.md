# Securado CRM Platform — Product Architecture

**Version:** 3.0 | **Last Updated:** March 2026 | **Production:** https://bi.securado.net

---

## 1. SYSTEM OVERVIEW

```
                              ┌──────────────────┐
                              │   Azure AD (SSO)  │
                              │   MSAL.js + PKCE  │
                              └────────┬─────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                          FRONTEND (React 19 + shadcn/ui)                    │
│                                                                             │
│  ┌────────────┐  ┌────────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ Dashboard   │  │ Dashboard      │  │ CRM Pages  │  │ Admin & Tools    │  │
│  │ (Read-only) │  │ Builder        │  │            │  │                  │  │
│  │             │  │ (Odoo-style)   │  │ Opportuni- │  │ Performance Hub  │  │
│  │ KPI Cards   │  │ 9 Chart Types  │  │ ties/Leads │  │ Target Plans     │  │
│  │ Charts      │  │ Domain Builder │  │ Accounts   │  │ Incentive Calc   │  │
│  │ Drill-down  │  │ Template Mgr   │  │ Activities │  │ AI Analytics     │  │
│  │ Filters     │  │ Import/Export  │  │ Invoices   │  │ Feedback System  │  │
│  │ Slideshow   │  │ Clone Cards    │  │ Kanban     │  │ RBAC/Settings    │  │
│  │ PDF Export  │  │ Multi-select   │  │            │  │ Help/KB          │  │
│  └──────┬──────┘  └───────┬────────┘  └─────┬──────┘  └────────┬─────────┘  │
│         └─────────────────┴─────────────────┴──────────────────┘            │
│                                    │ HTTPS (axios)                          │
│                           REACT_APP_BACKEND_URL                             │
├────────────────────────────────────┼────────────────────────────────────────┤
│                           BACKEND (FastAPI)                                 │
│                                                                             │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│  │ Identity &   │ │ Card Builder │ │ CRM Sales    │ │ Background Workers  │ │
│  │ Auth Service │ │ & Query      │ │ Service      │ │                     │ │
│  │              │ │ Engine       │ │              │ │ Incremental Sync    │ │
│  │ JWT (HS256)  │ │              │ │ Opportunities│ │ (5-min Odoo poll)   │ │
│  │ Azure AD SSO │ │ RBAC Hier-   │ │ Accounts     │ │                     │ │
│  │ Session Mgmt │ │ archy Filter │ │ Activities   │ │ Redis Auto-start    │ │
│  │              │ │ Redis Cache  │ │ Invoices     │ │ Cache Invalidation  │ │
│  │              │ │ MongoDB Fall │ │ Leads        │ │                     │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────────┬──────────┘ │
│         └────────────────┴────────────────┴─────────────────────┘           │
│                                    │                                        │
├────────────┬───────────────────────┼──────────────────────┬─────────────────┤
│            │                       │                      │                 │
│   Redis    │                  MongoDB                     │   Odoo v17      │
│  (Bundled) │            (Atlas in prod)                   │   Enterprise    │
│            │                       │                      │   (XML-RPC)     │
│  Optional  │   ┌───────────────────┴───────────────┐      │                 │
│  TTL Cache │   │  DB_NAME (Emergent-managed)       │      │  5 Entities:    │
│  128MB LRU │   │                                   │      │  crm.lead       │
│  Auto-start│   │  Collections:                     │      │  res.partner    │
│  Silent    │   │  dashboard_cards (22)             │      │  account.move   │
│  Fallback  │   │  dashboard_templates_v2 (8)       │      │  mail.activity  │
│            │   │  users, user_identity_map          │      │  hr.employee    │
│            │   │  feedback_items, feedback_attach   │      │                 │
│            │   │  target_plans, target_plan_items   │      │                 │
│            │   │  opportunities (1378)              │      │                 │
│            │   │  accounts (705), invoices (264)    │      │                 │
│            │   │  employees (78), activities (737)  │      │                 │
│            │   └───────────────────────────────────┘      │                 │
└────────────┘                                              └─────────────────┘
```

---

## 2. TECHNOLOGY STACK

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 19 | SPA framework |
| UI Components | shadcn/ui | latest | 40+ components (Chart, Card, Dialog, Sheet, Tabs) |
| Charts | Recharts | 3.7 | Bar, Pie, Area, Radial via shadcn ChartContainer |
| Grid Layout | react-grid-layout | 2.2.2 | Drag/drop/resize dashboard cards |
| CSS | TailwindCSS | 3 | Utility-first styling |
| Backend | FastAPI | 0.104 | Async Python API framework |
| Database | MongoDB | 7.0 (Atlas in prod) | Document store, single DB via DB_NAME |
| Cache | Redis | 7.0 (bundled) | Optional query cache, auto-started by backend |
| ERP Integration | Odoo | 17 Enterprise | Source of truth, 5-min incremental polling |
| Auth | JWT + Azure AD | MSAL.js 2.0 | Dual auth with stable JWT_SECRET |
| PDF | html2canvas + jsPDF | - | Dashboard PDF export |
| Env | python-dotenv | 1.2 | .env loading at startup |

---

## 3. FEATURE MAP

### Dashboard System
```
/dashboard (Read-only)              /dashboard-builder (Admin Editor)
├── KPI Cards (flat solid color)    ├── Layout Editor (drag/drop/resize)
├── Charts (Bar/Pie/Area/Radial)    ├── Templates Tab (CRUD + Clone + Import/Export)
├── Leaderboard (sorted high→low)   ├── All Cards Tab (visual previews)
├── Table View (structured columns) ├── Edit Chart Dialog (9 types)
├── Drill-down → Opportunities      │   ├── Data Tab (collection, aggregation, group_by)
├── Previous Period Comparison       │   ├── Display Tab (color picker, icon selector)
├── Global Filters (inline bar)      │   ├── Target Tab
│   ├── Year / Quarter              │   ├── Description Tab
│   ├── Salesperson                 │   └── Domain Builder (visual rules, multi-select)
│   ├── Stage                       └── Sort By / Sort Order
│   ├── Product Director
│   └── Solution Category
├── Slideshow Mode (10s auto-rotate)
├── PDF Export
└── Click-to-Navigate (charts → Opportunities)
```

### 9 Chart Types
KPI | Bar | Area | Pie | Radial | Leaderboard | Progress | Win Rate | Table

### 8 Dashboard Templates
CEO | Sales Director | Product Director | Sales Rep | Finance | Marketing | Sales Team | Custom

### CRM Pages
```
/opportunities — List + Kanban + Days Since Update + stage exclude filter
/leads         — Lead management
/accounts      — Account management
/activities    — Value-selling only (Demo, POC, Site Visit, Workshop)
/invoices      — Invoice tracking with payment status
```

### Performance Hub
```
/performance-hub
├── CEO Summary (5 signals: Revenue, Activity, Collection, Pipeline, Team)
├── Revenue Plans (Dual targets: Booking + Invoiced)
├── Activity Plans (Value-selling types only)
├── Collection Health
├── Incentive Calculator (Multi-vector: Revenue/Activity/Collection)
└── Year-filtered across all tabs
```

### Admin & Tools
```
/settings          — SSO config, system settings
/users             — User management
/rbac              — 62 permissions, 25 groups
/feedback          — Submit + Admin Queue + Export API
/help              — Integration Guides, SSO KB
/dashboard-builder — Template management
```

---

## 4. DATA FLOW

### 4.1 Odoo → MongoDB (Incremental Sync)
```
Every 5 minutes:
  Odoo (XML-RPC) → write_date > last_sync → UPSERT → MongoDB
  
  Entities: opportunities, accounts, invoices, contacts, activities
  Handles: Changes + Deletions + Field validation
  Cache: Redis invalidated on sync
```

### 4.2 Dashboard Rendering
```
User opens /dashboard
  → GET /api/card-builder/my-dashboard?year=2026
  → Resolve template by role priority (admin > sales_director > product_director > user)
  → Resolve RBAC hierarchy filter (org tree walk)
  → For each card:
      Check Redis cache → Cache miss → MongoDB aggregation
      → Sort by total/count/avg (handle None!)
      → Compare with year-1 for KPI cards
  → Return template + rendered blocks + prev_period
```

### 4.3 RBAC Hierarchy
```
Admin (krishna)         → No filter (sees ALL)
Product Dir (vimod)     → $or: [owner_name, product_manager] regex for 28 subordinates
Product Dir (taj)       → No filter (has Sales/Administrator Odoo group)
Sales Rep (nabisaheb)   → Own name regex only (0 subordinates)

Role priority: admin(0) > sales_admin(1) > sales_director(2) > product_director(3) > finance(4) > marketing(5) > sales_rep(6) > user(99)
```

### 4.4 Click Navigation (Dashboard → CRM Pages)
```
Click KPI card → /opportunities?year=2026&stage_exclude=Won,Lost,Hold
Click leaderboard "Nabisaheb" → /opportunities?year=2026&salesRep=Nabisaheb&stage=Won
Click bar chart "Proposal" → /opportunities?year=2026&stage=Proposal
```

---

## 5. API ENDPOINTS (100+)

### Dashboard & Cards (15 endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/card-builder/my-dashboard` | User's role-based dashboard |
| GET/POST | `/api/card-builder/cards` | Card CRUD |
| POST | `/api/card-builder/cards/{id}/drill-down` | Underlying records |
| GET/POST/PUT/DELETE | `/api/card-builder/templates` | Template CRUD |
| POST | `/api/card-builder/templates/{id}/layout` | Save layout |
| GET | `/api/card-builder/templates/{id}/export` | Export bundle |
| POST | `/api/card-builder/templates/import` | Import bundle |
| POST | `/api/card-builder/seed-role-templates` | Create all role templates |
| GET | `/api/card-builder/filter-options` | Filter dropdowns |
| GET | `/api/card-builder/available-roles` | Role list |

### CRM Data (20+ endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/opportunities` | List (paginated, filtered, RBAC, days_since_update) |
| GET | `/api/opportunities/kanban` | Kanban (stage filter + exclude support) |
| GET | `/api/accounts`, `/api/leads`, `/api/activities`, `/api/invoices` | CRUD |

### Auth (8 endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Email/password |
| GET | `/api/auth/microsoft/config` | SSO config (env vars, DB fallback) |
| POST | `/api/auth/microsoft/complete` | Complete SSO flow |

### Feedback (6 endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/feedback/submit` | Submit with screenshots |
| GET | `/api/feedback/my` | User's feedback |
| GET | `/api/feedback/admin` | Admin queue |
| GET | `/api/feedback/export/all` | API-key export for dev agent |
| POST | `/api/feedback/export/mark-completed` | Mark fixed from dev |

### Performance (10+ endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/target-plans/revenue` | Dual-target plans (Booking + Invoiced) |
| GET | `/api/target-actuals/ceo-summary` | 5-signal CEO view |
| POST | `/api/target-actuals/incentive/multi-vector` | Incentive calculation |

---

## 6. SECURITY

| Layer | Implementation |
|-------|---------------|
| Auth | JWT (HS256, 24hr expiry) + Azure AD SSO (MSAL.js redirect + PKCE) |
| JWT Secret | Stable `JWT_SECRET` in .env (survives pod restarts) |
| RBAC | 4-layer: App role → Odoo group → Org hierarchy → User identity map |
| Data Scoping | Admin=all, Manager=team (recursive tree walk), User=own |
| SSO Config | Env vars first, DB fallback with try/catch |
| CORS | Wildcard for multi-environment |
| Feedback | API key for export endpoint, owner/admin for attachments |

---

## 7. DATE FIELD STANDARD (CRITICAL — NEVER DEVIATE)

| Collection | Year Filter Field | Why |
|-----------|------------------|-----|
| opportunities | `date_last_stage_update` | Matches Odoo dashboard |
| activities | `date_deadline` (via `due_date`) | `create_date` is empty |
| invoices | `invoice_date` | When invoice was issued |
| Year dropdown | `date_last_stage_update` | Capped at current year |

---

## 8. PRODUCTION DEPLOYMENT

| Aspect | Detail |
|--------|--------|
| Platform | Emergent (Kubernetes) |
| URL | https://bi.securado.net |
| Database | MongoDB Atlas (via DB_NAME env var) |
| Redis | Bundled, auto-started by backend subprocess |
| Frontend | React build served via nginx proxy |
| Backend | uvicorn on port 8001, supervisor-managed |
| SSO | Azure AD app `010dd3f4-509b-4706-a71a-79bc4030c337` |
| Env | All config via .env (dotenv loaded at startup) |

---

## 9. VALUE-SELLING ACTIVITIES (Business Rule)

Only these activity types are tracked for KPIs and shown in UI:
- Demo, Proof of Concept, Site Visit, Workshop, Product Presentation, Vendor Meeting, POC

Excluded: Call, Email, Meeting, Task, To Do, Follow-up, Time Off, Expense Approval, Upload Document, RFP Submission

---

## 10. KPI FRAMEWORK (Dual-Target Model)

Each revenue plan has TWO targets:
```
Plan: "Q1 2026 - Vimod Chandran"
├── booking_target: 800,000  → compared against Won CRM opportunities (BOOKED)
├── invoiced_target: 400,000 → compared against paid invoices (INVOICED)
└── period: "2026-Q1"
```

CEO Summary shows: "Booked: OMR 863K / 4M | Invoiced: OMR 0 / 200K (0%)"

---

*~27K lines backend Python, ~24K lines frontend JS, 53 MongoDB collections, 100+ API endpoints, 8 dashboard templates, 22 configurable cards, 62 permissions across 25 groups*
