# Securado CRM (ERP AI) — Product Requirements Document

## Original Problem Statement
Build a comprehensive sales target, incentive, and KPI management system with Odoo integration. Evolved to include configurable dashboards, RBAC, Microsoft SSO, AI assistant, and Performance Hub.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB (Motor async) + Redis caching
- **Auth**: JWT + Microsoft SSO (MSAL popup + server redirect)
- **Data**: Odoo v17 incremental sync -> canonical DB -> app DB
- **AI**: Emergent LLM key (GPT for chat, Whisper for voice)

## What's Been Implemented
- Configurable dashboard system with dashboard builder
- Resilient incremental Odoo data sync worker
- Hierarchy-aware RBAC system
- Microsoft SSO (Azure AD) with multi-source role derivation + canonical DB fallback
- AI Assistant with voice, file attachments, charts, persistent history, Excel/PDF export
- Performance Hub v2 with cascading targets + AI activity recommendations
- Activity creation/management in Opportunities
- Accounts, Contacts, Opportunities, Invoices/Receivables pages
- Data Health Monitor (System Alerts section on dashboard)
- Pure Tailwind CSS (legacy CSS removed)

## Fixes Applied (2026-03-08)

### P0: Invoice KPI Cards Showing "0" (FIXED)
- **Root Cause**: `execute_query()` applied blanket `active: True` filter to ALL collections. Invoices don't use `active` field.
- **Fix**: Collection-aware base filters in `redis_pipeline.py` and `card_builder.py`

### Win Rate Formula Standardization (FIXED)
- **Root Cause**: Inconsistent formulas — some used Won/TotalOpps, others Won/(Won+Lost)
- **Fix**: All 6 locations now use standard `Won / (Won + Lost) × 100`
- Locations fixed: `planning.py`, `ai_assistant/routes.py`, card builder seed defaults
- Win Rate card updated from `display_type: "number"` to `"win_rate"` with backend percentage calculation

### Excel Export Not Matching Dashboard Filters (FIXED)
- **Root Cause**: Export used `create_date` for year filtering, dashboard used `date_last_stage_update`
- **Fix**: Changed export date field to `date_last_stage_update`, added `product_director` and `solution_category` filter params
- Both HybridDashboard and DashboardPage now pass all active filters to export

### Tab Title (FIXED)
- Changed from "Emergent | Fullstack App" to "ERP AI"

### Data Health Monitor (NEW FEATURE)
- Backend endpoint `GET /api/card-builder/data-health` checks all collections for missing fields, stale data, duplicates
- Frontend component displays score/100, collection breakdown, expandable issues list
- Placed in "System Alerts" section at bottom of dashboard

### Activities Sync Duplicate Key Error (FIXED)
- Set `id = canonical_id` in `_transform_record` to prevent `id: null` duplicates

## Open Bugs
1. Activity Logs from Odoo — sync now working, but historical data may need full re-sync
2. Account Alert on paid accounts showing overdue (needs specific reproduction steps)

## Backlog
- P1: Complete KPI Framework (incentive weights, collection/GP floor)
- P1: Verify new features (Add Activity, AI Report Export, AI Recommendations)
- P1: Refactor to Services/Repositories pattern
- P2: Replace in-memory Event Bus with Redis Streams
- P2: Component modularization (AiAssistantBubble.js, PerformanceHubPage.js)
