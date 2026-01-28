# CRM KPI Management Platform - Active Sprint

## ⚠️ CRITICAL: Before Making Changes

**READ THESE DOCUMENTS FIRST:**
1. `/app/docs/CRM_MASTER_PLAN.md` - Complete roadmap & UI field requirements
2. `/app/docs/CRM_DATA_MODEL_REFERENCE.md` - Data mappings & ETL rules
3. `/app/docs/MODULAR_DASHBOARD_ARCHITECTURE.md` - Dashboard architecture

---

## Current Sprint: Bug Fixes + Phase 1

### 🔴 P0 - Critical Bugs (This Week)

| Task | Status | Notes |
|------|--------|-------|
| Configure ETL mapping for `mail.activity` | ⬜ TODO | See CRM_DATA_MODEL_REFERENCE.md |
| Re-run ETL sync for activities | ⬜ TODO | After mapping configured |
| Fix log messages linking | ⬜ TODO | Sync `mail.message` model |
| Verify activity linking works | ⬜ TODO | Test after ETL |

### 🟡 P1 - Modular Dashboard Foundations

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

## Quick Reference: Broken Features

| Feature | Issue | Fix Location |
|---------|-------|--------------|
| Opportunity Activities | Shows 0 | ETL mapping for `mail.activity` |
| Opportunity Logs | Shows 0 | ETL mapping for `mail.message` |
| AI Confidence | Shows 0% | Depends on activities |
| Activity Overview Card | Shows 0 | Depends on activities |

---

## Recent Completions (2026-01-28/29)

- ✅ Dashboard Sales Rep filter
- ✅ Dashboard clickable items
- ✅ Export Excel button
- ✅ PM Leaderboard UI
- ✅ Category Performance UI
- ✅ Invoices Salesperson tab
- ✅ Activity API endpoint updated
- ✅ Documentation created

---

## Preview URL
https://crmdatahub.preview.emergentagent.com

## Test Credentials
- Email: `test@securado.com`
- Password: `test123456`
