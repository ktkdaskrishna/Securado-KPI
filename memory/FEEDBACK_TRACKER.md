# Feedback Tracker — Living Document

This file is maintained by the development agent. It tracks ALL user-reported issues,
their root causes, fixes applied, files changed, and regression risks.

**BEFORE fixing any issue, check this file for:**
1. Has this file been changed before? What broke last time?
2. Is this issue related to a previous fix?
3. What are the regression risks?

---

## Active Issues (from production feedback)

_None currently — run `fetch_production_feedback()` to sync_

---

## Completed Fixes (history)

### FIX-001: Dashboard charts empty after sort_by addition
- **Date:** 2026-02-25
- **Feedback:** Dashboard showing empty charts
- **Root cause:** `sort_by=None` passed to MongoDB as `{"$sort": {None: -1}}` — invalid
- **Fix:** `raw_sort if raw_sort else "total"` in `redis_pipeline.py:196`
- **Files changed:** `libs/redis_pipeline.py`
- **Regression risk:** Any new optional field in query_config that can be None
- **Lesson:** ALWAYS check for None before passing to MongoDB aggregation

### FIX-002: Leaderboard sorted wrong (count instead of total)
- **Date:** 2026-02-25
- **Feedback:** Nabisaheb 248K at #4, Thejus 19K at #2
- **Root cause:** Sort used `count` for all queries. Sum aggregation should sort by `total`
- **Fix:** Smart sort: `total` for sum, `avg` for avg, `count` for count
- **Files changed:** `libs/redis_pipeline.py`
- **Regression risk:** None — backwards compatible

### FIX-003: Year filter showing 2027 (future year)
- **Date:** 2026-02-28
- **Feedback:** "2027 year filter showing, filter should be standard"
- **Root cause:** Years derived from `create_date` which includes future dates. No cap.
- **Fix:** Cap at `current_year`, derive from `date_last_stage_update`
- **Files changed:** `ai_analytics/routes.py`, `layout/PageFilters.js`
- **Regression risk:** None

### FIX-004: Performance Hub showing all-time data with year filter
- **Date:** 2026-02-26
- **Feedback:** Revenue shows OMR 8M with 2026 filter (all-time)
- **Root cause:** `get_ceo_summary` had NO year filter on any query
- **Fix:** Added `year` param, applied to Revenue, Activities, Pipeline, Plans
- **Files changed:** `target_management/planning.py`
- **Regression risk:** Plans with no year in name won't match

### FIX-005: Activities page showing non-value-selling activities
- **Date:** 2026-02-28
- **Feedback:** Calls, Emails, Tasks showing (not relevant to sales KPIs)
- **Root cause:** No activity type filter
- **Fix:** VALUE_SELLING_TYPES constant applied to all activity queries
- **Files changed:** `crm_sales/activities.py`, `target_management/planning.py`
- **Regression risk:** If new activity types added in Odoo, must update constant

### FIX-006: Activities year filter returning 0 for 2026
- **Date:** 2026-03-01
- **Feedback:** Activities tab empty when 2026 selected
- **Root cause:** Default `date_field` was `create_date` (empty for activities). Should be `due_date`
- **Fix:** Changed default from `Query('create_date')` to `Query('due_date')`
- **Files changed:** `crm_sales/activities.py`
- **Regression risk:** None — `due_date` maps from `date_deadline`

### FIX-007: Kanban vs List count mismatch
- **Date:** 2026-03-01
- **Feedback:** "Kanban view and filter not working, list view not having data"
- **Root cause:** Kanban used Python `apply_date_filters` with `create_date` fallback. List used MongoDB.
- **Fix:** Both now use MongoDB `date_last_stage_update` filter
- **Files changed:** `crm_sales/opportunities.py`
- **Regression risk:** Quarter filter still uses Python-level filtering for kanban

### FIX-008: Account filter crash (React error)
- **Date:** 2026-02-25
- **Feedback:** "Objects are not valid as React child"
- **Root cause:** Backend returns accounts as `{id, name}` objects, UI rendered objects directly
- **Fix:** `.map(a => typeof a === 'object' ? a.name : a)` in OpportunitiesPage
- **Files changed:** `crm/OpportunitiesPage.js`, `layout/PageFilters.js`
- **Regression risk:** If backend changes account format again

---

## Date Field Standard (NEVER deviate)

| Collection | Year Filter Field | Reason |
|-----------|------------------|--------|
| opportunities | `date_last_stage_update` | Matches Odoo dashboard |
| activities | `date_deadline` (via `due_date`) | `create_date` is empty |
| invoices | `invoice_date` | When invoice was issued |
| year list API | `date_last_stage_update` | Capped at current year |

## High-Risk Files (check tracker before editing)

| File | Risk Level | Common Issues |
|------|-----------|---------------|
| `libs/redis_pipeline.py` | HIGH | None values in query_config break MongoDB |
| `crm_sales/opportunities.py` | HIGH | Date filtering inconsistency between kanban/list |
| `target_management/planning.py` | MEDIUM | Year filter not applied to all sub-queries |
| `target_management/card_builder.py` | HIGH | sort_by/sort_order indentation (sed broke it before) |

---

_Last updated: 2026-03-01_
