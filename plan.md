# CRM KPI Management Platform - Development Plan

## Current Session Focus
Fixing critical filter issues and implementing missing features as identified by user testing.

---

## Phase 1: Fix Critical Filter Issues (Status: IN PROGRESS)

### 🔴 P0 - CRITICAL: Year Filter Not Working
**Problem:** When selecting "2026" in the year filter, the API calls don't include year/date parameters. UI shows filter selection but backend receives no filter, returning ALL data.

**Root Cause:** The filter context stores the year but API calls may not be properly passing it, OR the backend date filtering logic is flawed.

**Fix Tasks:**
- [ ] Update GlobalFilterContext to sync filters with URL parameters
- [ ] Update all API calls to pass filter parameters correctly
- [ ] Fix backend date filtering to use `create_date` field properly
- [ ] Apply filter logic to ALL endpoints: dashboard, opportunities, accounts, activities, analytics, kanban

### 🔴 P0 - CRITICAL: Filter State Not Persisted Across Pages
**Problem:** Filter resets when navigating between pages.

**Fix Tasks:**
- [ ] Store filter state in URL query parameters
- [ ] Read URL params on page load and initialize filter state
- [ ] Update URL when filters change (without page reload)

---

## Phase 2: Complete Global Filter Integration (Status: NOT STARTED)

### Tasks:
- [ ] Connect filters to Accounts page
- [ ] Connect filters to Activities page
- [ ] Connect filters to AI Analytics page
- [ ] Connect filters to Invoices page
- [ ] Update Kanban view to respect filters

---

## Phase 3: Missing Page Routes (Status: NOT STARTED)

### 🟡 Timeline Page
- Route `/activity-timeline` exists and is functional ✓

### 🟡 Invoices Page
- Route `/invoices` exists and is functional ✓

### 🟡 AI Analytics Routing Fix
- Route `/analytics` - verify it doesn't redirect incorrectly

---

## Phase 4: Data Discrepancy Investigation (Status: NOT STARTED)

**Issue:** User reported "only one in proposal stage and 143 wins" - verify stage aggregation is correct.

### Debug Checklist:
- [ ] Apply specific filters and inspect API response
- [ ] Query MongoDB directly with same criteria
- [ ] Verify normalize_stage function in all endpoints

---

## Completed Work This Session
- [x] Reviewed codebase structure
- [x] Identified all critical issues
- [x] Created implementation plan

---

## Files to Modify

### Backend:
- `/app/backend/services/dashboard_agg/routes.py` - Fix date filtering
- `/app/backend/services/crm_sales/routes.py` - Fix date filtering for all endpoints
- `/app/backend/services/ai_analytics/routes.py` - Fix date filtering

### Frontend:
- `/app/frontend/src/lib/GlobalFilterContext.js` - Add URL sync
- `/app/frontend/src/components/layout/GlobalFilterBar.js` - Minor updates
- `/app/frontend/src/components/crm/AccountsPage.js` - Add filter integration
- `/app/frontend/src/components/crm/ActivitiesPage.js` - Add filter integration
- `/app/frontend/src/components/crm/AnalyticsPage.js` - Add filter integration
- `/app/frontend/src/components/crm/InvoicesPage.js` - Add filter integration

---

## Test Credentials
- Email: test@securado.com
- Password: test123456
