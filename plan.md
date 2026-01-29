# CRM KPI Management Platform - Active Sprint

## ⚠️ CRITICAL: Before Making Changes

**READ THESE DOCUMENTS FIRST:**
1. `/app/docs/CRM_MASTER_PLAN.md` - Complete roadmap & UI field requirements
2. `/app/docs/CRM_DATA_MODEL_REFERENCE.md` - Data mappings & ETL rules
3. `/app/docs/MODULAR_DASHBOARD_ARCHITECTURE.md` - Dashboard architecture

---

## Current Sprint: Dashboard Filter & Data Quality Fixes

### 🟢 Dashboard Accuracy Improvements (COMPLETED!)

| Issue | Status | Fix Applied |
|-------|--------|-------------|
| Dashboard defaulted to "All Years" | ✅ FIXED | Now defaults to current year (2026) |
| Test records inflating totals | ✅ FIXED | Excluded "Test 1", "test Service and product" from analytics |
| Product Manager ignores sales_rep filter | ✅ FIXED | Added sales_rep parameter to endpoint |
| Category Stats ignores sales_rep filter | ✅ FIXED | Added sales_rep parameter to endpoint |
| Click-through navigation loses filters | ✅ FIXED | All filters now passed via URL params |

**Impact:**
- Nabisaheb 2025 Won: 42 → **40 deals** (2 test records removed)
- Nabisaheb 2025 Value: 6,612,139 → **6,202,017 OMR** (410K test value removed)
- Now matches Odoo's 41 Won / ~6.2M OMR (within 1 record)

**Test Record Exclusion Patterns:**
- Names starting with "test", "demo", "sample"
- Names containing "(test)" or "[test]"
- Names like "test 1", "test 2", etc.

---

## Previous Sprint: Dashboard Filter Fixes

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
https://crm-fixer-3.preview.emergentagent.com

## Test Credentials
- Email: `test@securado.com`
- Password: `test123456`
