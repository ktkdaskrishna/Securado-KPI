# CRM KPI Management Platform - Development Plan

## ⚠️ CRITICAL: READ BEFORE MAKING CHANGES
All agents must review these documents before making major changes:
- `/app/docs/CRM_DATA_MODEL_REFERENCE.md` - Data field mappings and linking rules
- `/app/docs/MODULAR_DASHBOARD_ARCHITECTURE.md` - Dashboard architecture

---

## Current Session - Bug Fixes + Architecture Planning

### 🐛 Active Bug: Activities Not Linked to Opportunities

**Status:** FIX IN PROGRESS ✅
**Issue:** Opportunity detail view shows "0 activities" even when activities exist in database

**Root Cause Identified:**
- Activities have `opportunity_id` as integer (Odoo ID: `3028`)
- Opportunities use `source_record_id` as string (e.g., `"2158"`)
- Most activities have `res_model: None` instead of `crm.lead`
- ETL sync not properly linking activities to opportunities

**Current Data State:**
- Total activities: 702
- CRM activities (res_model='crm.lead'): Only 2
- Activities with valid opportunity linking: 0

**Fix Applied:**
- ✅ Updated `/api/opportunities/{opp_id}/activities` endpoint to handle multiple linking patterns
- ⬜ Need to fix ETL sync to properly populate `opportunity_id` and `res_model`

---

## 📋 UPDATED TASK LIST

### Phase 0: Immediate Bug Fixes (THIS WEEK)

| Task | Status | Priority |
|------|--------|----------|
| Fix activity-opportunity linking API | ✅ DONE | P0 |
| Fix ETL sync for activities (populate opportunity_id properly) | ⬜ TODO | P0 |
| Fix log messages linking | ⬜ TODO | P0 |
| Verify AI confidence calculation after activity fix | ⬜ TODO | P1 |

### Phase 1: Modular Dashboard - Foundations (Week 2-3)

| Task | Status | Priority |
|------|--------|----------|
| Add `export_data` permission to RBAC | ⬜ TODO | P1 |
| Block export endpoint for restricted roles | ⬜ TODO | P1 |
| Create card registry (cardRegistry.js) | ⬜ TODO | P1 |
| Refactor DashboardPage into card components | ⬜ TODO | P1 |
| Add batch data endpoint `/api/dashboard/data/batch` | ⬜ TODO | P2 |

### Phase 2: Template System (Week 4-5)

| Task | Status | Priority |
|------|--------|----------|
| Create `dashboard_templates` collection | ⬜ TODO | P2 |
| Add template CRUD APIs | ⬜ TODO | P2 |
| Implement role-template assignment | ⬜ TODO | P2 |
| Load user template on login | ⬜ TODO | P2 |

### Phase 3: Row-Level Security (Week 5-6)

| Task | Status | Priority |
|------|--------|----------|
| Add owner_id filter to opportunity endpoints | ⬜ TODO | P1 |
| Add owner_id filter to account endpoints | ⬜ TODO | P1 |
| Add team_id filter for department access | ⬜ TODO | P1 |
| Audit logging for access attempts | ⬜ TODO | P2 |

### Phase 4: Layout Builder (Week 7-9)

| Task | Status | Priority |
|------|--------|----------|
| Add react-grid-layout dependency | ⬜ TODO | P2 |
| Create admin layout builder UI | ⬜ TODO | P2 |
| Implement drag/drop cards | ⬜ TODO | P2 |
| Save/load template changes | ⬜ TODO | P2 |

---

## ✅ Previously Completed

### Session: Feature Enhancements (COMPLETED)

- ✅ Dashboard Sales Rep filter fixed
- ✅ Dashboard items made clickable (navigate to opportunities)
- ✅ Export Excel button added to Dashboard
- ✅ Securado logo made bigger
- ✅ Product Manager Leaderboard UI added
- ✅ Category Performance UI added
- ✅ Invoices "By Salesperson" tab added
- ✅ Select.Item runtime error fixed

---

## 📚 Documentation Created

| Document | Purpose |
|----------|---------|
| `/app/docs/CRM_DATA_MODEL_REFERENCE.md` | Odoo field mappings, data linking rules |
| `/app/docs/MODULAR_DASHBOARD_ARCHITECTURE.md` | Dashboard architecture, card registry schema |

---

## Preview URL
https://crmdatahub.preview.emergentagent.com
