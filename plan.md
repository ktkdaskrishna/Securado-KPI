# CRM KPI Management Platform - Active Sprint

## ⚠️ CRITICAL: Before Making Changes

**READ THESE DOCUMENTS FIRST:**
1. `/app/docs/CRM_MASTER_PLAN.md` - Complete roadmap & UI field requirements
2. `/app/docs/CRM_DATA_MODEL_REFERENCE.md` - Data mappings & ETL rules
3. `/app/docs/MODULAR_DASHBOARD_ARCHITECTURE.md` - Dashboard architecture

---

## Current Sprint: Serving Cache Architecture (Single Source of Truth)

### 🟢 Serving Cache Layer (COMPLETED!)

| Component | Status | Description |
|-----------|--------|-------------|
| Cache Builder | ✅ DONE | `/app/backend/services/serving_cache/cache_builder.py` |
| Cache Reader | ✅ DONE | `/app/backend/services/serving_cache/cache_reader.py` |
| Cache API Routes | ✅ DONE | `/api/cache/*` endpoints |
| Dashboard KPIs Cache | ✅ DONE | Pre-computed, excludes test records |
| Account Overdue Cache | ✅ DONE | Single calculation logic |
| Sales Leaderboard Cache | ✅ DONE | Pre-computed aggregates |
| PM Leaderboard Cache | ✅ DONE | Pre-computed aggregates |

**Architecture:**
```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────┐
│   Odoo ETL  │ ──▶ │ Event Queue  │ ──▶ │ Cache Builder  │ ──▶ │ UI APIs │
└─────────────┘     └──────────────┘     └────────────────┘     └─────────┘
                                                │
                                                ▼
                                         ┌────────────────┐
                                         │ serving_cache  │
                                         │ • dashboard_kpis│
                                         │ • account_overdue│
                                         │ • sales_leaderboard│
                                         │ • pm_leaderboard│
                                         └────────────────┘
```

**Cache API Endpoints:**
- `GET /api/cache/dashboard-kpis` - Dashboard metrics
- `GET /api/cache/account-overdue` - Account overdue data  
- `GET /api/cache/sales-leaderboard` - Sales rep rankings
- `GET /api/cache/pm-leaderboard` - Product manager rankings
- `POST /api/cache/refresh` - Force cache rebuild
- `POST /api/cache/invalidate` - Clear cache
- `GET /api/cache/stats` - Cache statistics

**Benefits:**
- ✅ Single source of truth for all UI components
- ✅ Consistent calculation logic (no more double-counting bugs)
- ✅ Fast reads (pre-computed data)
- ✅ 5-minute TTL with auto-refresh

---

## Previous Sprint: Dashboard Accuracy Improvements

### 🟢 Phase 2A - MongoDB Event Queue (COMPLETED!)

| Task | Status | Notes |
|------|--------|-------|
| Create event_queue service module | ✅ DONE | `/app/backend/services/event_queue/` |
| Add queue collection indexes | ✅ DONE | TTL, status, compound indexes |
| Create background worker | ✅ DONE | Polls and processes events with retry logic |
| Add queue stats endpoint | ✅ DONE | `/api/admin/data-quality/queue/stats` |
| Update Data Quality UI | ✅ DONE | Event Queue tab with real-time monitoring |
| Modify ETL runner to publish events | ✅ DONE | Added `use_event_queue` config option |

**What's Built:**
- MongoDB-based event queue service with publish/consume pattern
- Background worker that processes events with retry logic (max 3 retries)
- TTL auto-cleanup of completed events (24 hours)
- Real-time queue monitoring UI with health status
- Failed events viewer with manual retry capability
- ETL runner supports both direct writes (default) and queue-based writes

**How to Enable Queue Mode:**
Pipeline config can include `"use_event_queue": true` to enable queue-based data loading instead of direct database writes.

### 🟢 Phase 1 - Data Integrity (COMPLETED!)

| Task | Status | Notes |
|------|--------|-------|
| Identify duplicate records | ✅ DONE | Found 2,231 duplicates |
| Create Data Quality admin page | ✅ DONE | `/admin/data-quality` |
| Implement upsert logic in ETL | ✅ DONE | Prevents future duplicates |
| Create unique indexes | ✅ DONE | On source_record_id + org_id |
| Clean duplicate records | ✅ DONE | All duplicates removed |

### 🟢 Previous Sprint (COMPLETED)

| Task | Status | Notes |
|------|--------|-------|
| Configure ETL mapping for `mail.activity` | ✅ DONE | Added opportunity_id mapping |
| Normalize activity opportunity_id types | ✅ DONE | Converted 681 string→int |
| Fix opportunity lookup by all ID types | ✅ DONE | Added `find_opportunity_by_id()` helper |
| Activities, Bluesheet, Logs endpoints | ✅ DONE | Now uses helper function |
| Dashboard click-through navigation | ✅ DONE | KPI cards navigate to filtered lists |
| User invite system | ✅ DONE | `/admin/users` page |

---

## Future Tasks (Backlog)

### P1 - Modular Dashboard Foundations

| Task | Status | Notes |
|------|--------|-------|
| Add `export_data` permission | ⬜ TODO | Add to RBAC model |
| Create card registry | ⬜ TODO | `frontend/src/components/dashboard/registry/` |
| Create `DashboardTemplateContext` | ⬜ TODO | Template resolution |
| Batch data endpoint | ⬜ TODO | `/api/dashboard/data/batch` |

### P2 - Minor Improvements

| Task | Status | Notes |
|------|--------|-------|
| Add Win Rate tooltip | ⬜ TODO | Explain calculation method |
| Fix sidebar scrolling | ⬜ TODO | Recurring UX issue |

---

## Preview URL
https://trustedcrm.preview.emergentagent.com

## Test Credentials
- Email: `test@securado.com`
- Password: `test123456`
