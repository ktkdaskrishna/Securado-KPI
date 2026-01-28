# CRM KPI Management Platform - Active Sprint

## ⚠️ CRITICAL: Before Making Changes

**READ THESE DOCUMENTS FIRST:**
1. `/app/docs/CRM_MASTER_PLAN.md` - Complete roadmap & UI field requirements
2. `/app/docs/CRM_DATA_MODEL_REFERENCE.md` - Data mappings & ETL rules
3. `/app/docs/MODULAR_DASHBOARD_ARCHITECTURE.md` - Dashboard architecture

---

## Current Sprint: Bug Fixes + Phase 1

### 🟢 P0 - Critical Bugs (COMPLETED!)

| Task | Status | Notes |
|------|--------|-------|
| Configure ETL mapping for `mail.activity` | ✅ DONE | Added opportunity_id mapping |
| Normalize activity opportunity_id types | ✅ DONE | Converted 681 string→int |
| Set res_model='crm.lead' on activities | ✅ DONE | Updated 681 activities |
| Fix opportunity lookup by all ID types | ✅ DONE | Added `find_opportunity_by_id()` helper |
| Fix activities API endpoint | ✅ DONE | Now uses helper function |
| Fix bluesheet API endpoint | ✅ DONE | Now uses helper function |
| Fix logs API endpoint | ✅ DONE | Now uses helper function |

**Result:** Activities now showing on opportunity detail! AI Confidence improved from 0% to 33.5%

### 🟡 P1 - Modular Dashboard Foundations (NEXT)

| Task | Status | Notes |
|------|--------|-------|
| Add `export_data` permission | ⬜ TODO | Add to RBAC model |
| Block export for restricted roles | ⬜ TODO | Update `/api/opportunities/export` |
| Create card registry | ⬜ TODO | `frontend/src/components/dashboard/registry/` |
| Extract dashboard card components | ⬜ TODO | KPI, Pipeline, Leaderboard cards |
| Create `DashboardTemplateContext` | ⬜ TODO | Template resolution |
| Create `DashboardDataContext` | ⬜ TODO | Batch data fetching |

### 🟢 P2 - Template System

| Task | Status | Notes |
|------|--------|-------|
| Create `dashboard_templates` collection | ⬜ TODO | MongoDB schema |
| Template CRUD APIs | ⬜ TODO | `/api/dashboard/templates` |
| Role-template assignment | ⬜ TODO | Role → Template mapping |
| Batch data endpoint | ⬜ TODO | `/api/dashboard/data/batch` |

---

## Recent Completions (2026-01-29)

- ✅ ETL mapping configured for mail.activity
- ✅ Activity data normalized (opportunity_id as int)
- ✅ All 683 activities now have res_model='crm.lead'
- ✅ find_opportunity_by_id() helper function created
- ✅ Activities, Bluesheet, Logs endpoints fixed
- ✅ **Activities now visible in UI!**
- ✅ **AI Confidence improved from 0% to 33.5%**

---

## Preview URL
https://datahub-crm-1.preview.emergentagent.com

## Test Credentials
- Email: `test@securado.com`
- Password: `test123456`
