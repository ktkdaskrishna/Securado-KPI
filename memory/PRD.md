# Securado CRM — PRD

## Original Problem Statement
Build a sales target, incentive, and KPI management system integrated with Odoo. Evolved into a fully configurable Odoo-style dashboard platform with dynamic query engine, RBAC hierarchy scoping, and real-time data sync. Extended with cascading target management, AI-powered CRM assistant with integrated feedback, and multi-level performance tracking for PD, Strategy GM, and Marketing teams.

## Production URL: https://bi.securado.net

## Architecture
- Frontend: React 19 + shadcn/ui + TailwindCSS + react-grid-layout v2 + Recharts 3
- Backend: FastAPI + MongoDB + Redis
- Data Sync: Incremental polling from Odoo v17 (5-min cycle)
- Auth: JWT + Microsoft Azure AD SSO (MSAL.js 2.0 redirect flow)
- Dashboard: Configurable grid with 9 chart types, 7 role templates
- AI Assistant: RAG pipeline over CRM data + conversational feedback (Emergent LLM Key)

## Completed Phases
1. Core CRM (Auth, Opportunities, Accounts, Activities, Invoices)
2. Target Management (Sales targets, incentive plans, Performance Hub)
3. Data Architecture (Redis query engine, incremental sync, user identity map)
4. Configurable Dashboard (react-grid-layout, template manager, role assignment)
5. Help & Documentation (SSO setup KB, troubleshooting)
6. RBAC Hierarchy (org tree walk, admin/manager/user scoping)
7. Premium Dashboard (Odoo-style flat KPI cards, drill-down, hover controls)
8. Architecture Split (Dashboard read-only, Builder with Odoo editor)
9. Chart Types + Domain Builder (9 types, multi-select tags, Won/Lost lists)
10. Role Templates + Global Filters (7 templates, PageFilters, card navigation)
11. AI Analytics + Slideshow (Dashboard View toggle, auto-rotate templates)
12. Enhancements (Previous period comparison, PDF export)
13. Production Deployment (bi.securado.net, Azure AD SSO, MongoDB fix)
14. AI RAG Assistant (Floating chat bubble, CRM data Q&A, Emergent LLM Key)
15. Merged Feedback System into AI Assistant (Feb 2026)
16. Performance Hub v2 — Cascading Targets (Feb 2026)
17. **Performance Hub v2.1 — Strategy & Marketing Teams** (Mar 2026):
    - AI Assistant moved to right side
    - Plan types: `revenue` (PD), `strategy` (GM Strategy), `marketing` (Marketing Team)
    - CEO assigns parallel revenue targets to Strategy GM
    - AI-recommended activities: strategy (Assessment, Workshops, CEO Presentations, Awareness Camps) + marketing (Digital Campaigns, Events, Webinars)
    - PD sponsors activities; marketing/strategy teams execute
    - Team badges (Sales/Marketing/Strategy) on all activity plan items
    - Cascade View groups plans by type with section headers

## Key Design Decisions
- date_last_stage_update for ALL year filtering (matches Odoo)
- DB_NAME env var drives database name
- AI Assistant is the single entry point for CRM queries AND feedback (right side)
- Category segmentation validates sum = total target (hard rule)
- PD sponsors marketing/strategy activities — execution by respective teams
- GM Strategy gets parallel revenue target from CEO (same as PD)
- plan_type field: `revenue` | `strategy` | `marketing`

## Key DB Collections
- `target_plans.plan_type`: "revenue" | "strategy" | "marketing"
- `target_plan_items.assign_team`: "marketing" | "strategy" | null (sales)
- `target_plan_items.sponsor_pd`: PD name who sponsors the activity
- `target_plan_segments`: Category breakdown with validation
- `feedback_items.source`: "ai_assistant" for chat-submitted feedback

## Test Credentials
- Admin: krishna@securado.net / test123456
- Product Director: vimod.c@securado.net / test123456
- Product Director: taj@securado.net / test123456
- Sales Rep: nabisaheb@securado.net / test123456

## Prioritized Backlog

### P0 (Next)
- **MS SSO Fix**: User reported AADSTS900023 error — needs real Azure AD Tenant ID and Client ID from user

### P1
- **Performance Hub Phase 3**: Cascade assignment flow (PD → Sales Director → Rep per category)
- **Performance Hub Phase 4**: Role-specific dashboard views (CEO side-by-side, PD category drill-down)
- **Dashboard cards showing '0' for Director role**: Investigate misconfigured templates
- **Full KPI Framework**: Incentive weight presets, gate logic (collection/GP floors)

### P2
- Refactor to Services/Repositories architecture
- Replace In-Memory Event Bus with Redis Streams
- GP and attribution models for pre-sales and marketing influence
