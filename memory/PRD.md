# Securado CRM — Product Requirements Document

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
- Pure Tailwind CSS (legacy CSS removed)

## Critical Production Fix (2026-03-08) — Canonical DB Authorization
### Root Cause (discovered via production site analysis)
The original `database.py` defaulted `CANONICAL_DB_NAME` to `'event_mesh_canonical'` — a SEPARATE database from `event_mesh_app`. The production MongoDB user only has authorization for `event_mesh_app`, NOT `event_mesh_canonical`. This caused:
1. ALL canonical_db queries (RBAC, dashboard, opportunities) to fail with authorization errors
2. The incremental sync to fail on every poll
3. SSO users to get RESTRICTED access (blank sidebar)

### Fix Applied
1. **database.py**: Changed canonical DB default to use SAME database as app_db (`DB_NAME`). Added startup access test — if canonical DB is unauthorized, automatically falls back to app_db for ALL queries.
2. **SSO flow** (both MSAL + callback): 3-source role derivation cascade with try/except protection on canonical_db access. Default to basic user access for SSO-authenticated users.
3. **RBAC endpoint**: Protected canonical_db.sales_users query. SSO users always get at least basic user access.

## Open Bugs
1. Activity Logs from Odoo missing (data sync gap - no mail.activity data from Odoo)
2. Account Alert on paid accounts showing overdue (needs specific reproduction steps)

## Backlog
- P1: Complete KPI Framework (incentive weights, collection/GP floor)
- P1: Refactor to Services/Repositories pattern
- P2: Replace in-memory Event Bus with Redis Streams
- P2: Component modularization (AiAssistantBubble.js, PerformanceHubPage.js)
