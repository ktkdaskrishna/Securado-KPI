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
- Microsoft SSO (Azure AD) with multi-source role derivation
- AI Assistant with voice, file attachments, charts, persistent history, Excel/PDF export
- Performance Hub v2 with cascading targets + AI activity recommendations
- Activity creation/management in Opportunities
- Accounts, Contacts, Opportunities, Invoices/Receivables pages
- Pure Tailwind CSS (legacy CSS removed)

## Critical Fixes (2026-03-08)
### P0: Production SSO Authentication - Complete Overhaul
- **Root cause**: SSO login flow only checked `users_rbac` for role derivation. In production, this collection may be empty/stale, leaving SSO users with zero permissions.
- **Fix**: Implemented 3-source role derivation cascade:
  1. `users_rbac` (Odoo RBAC groups)
  2. `canonical.sales_users` (Odoo sales data)
  3. Default basic user access (SSO-authenticated = legitimate employee)
- **RBAC endpoint safety net**: SSO-authenticated users (`auth_provider: "microsoft"`) now always get at least basic user access instead of RESTRICTED
- **Role persistence**: Both SSO flows (MSAL popup + server redirect) now ALWAYS persist derived roles to the `users` collection in MongoDB

### P1: Dashboard Cards Showing 0 for Director
- **Root cause**: `resolve_hierarchy_filter` didn't grant broad access to `product_director`/`sales_director` roles
- **Fix**: Added these roles to `broad_access_roles` and fixed admin pattern matching

## Features Added (2026-03-08)
1. **Activity Management in Opportunities**: Create, toggle complete, view activities per opportunity
2. **AI Activity Recommendations**: AI-powered activity suggestions in Performance Hub
3. **Report Export**: Excel/PDF export for Pipeline, Invoices, Performance, Activities via AI Assistant
4. **Account Alert Fix**: Summary counter now correctly counts only companies (not contacts) with overdue

## Open Bugs
1. Activity Logs from Odoo missing (data sync gap - no mail.activity data from Odoo)
2. Account Alert on paid accounts showing overdue (needs specific reproduction steps)

## Backlog
- P1: Complete KPI Framework (incentive weights, collection/GP floor)
- P1: Refactor to Services/Repositories pattern
- P2: Replace in-memory Event Bus with Redis Streams
- P2: Component modularization (AiAssistantBubble.js, PerformanceHubPage.js)
