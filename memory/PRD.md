# Securado CRM — PRD

## Original Problem Statement
Build a sales target, incentive, and KPI management system integrated with Odoo. Evolved into a fully configurable Odoo-style dashboard platform with dynamic query engine, RBAC hierarchy scoping, and real-time data sync. Extended with cascading target management, AI-powered CRM assistant with integrated feedback, and multi-level performance tracking.

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
15. **Merged Feedback System into AI Assistant** (Feb 2026) — Conversational feedback submission via AI chat, separate FAB removed
16. **Performance Hub v2 — Cascading Targets** (Feb 2026) — CEO → PD → Solution Category segmentation, triple targets (Booking/Invoiced/Margin), validation engine, category breakdown with pie chart

## Key Design Decisions
- date_last_stage_update for ALL year filtering (matches Odoo)
- DB_NAME env var drives database name (Emergent overrides on production)
- SSO credentials in env vars (not DB-dependent)
- Separate Dashboard (read-only) vs Builder (full editor)
- Standard PageFilters shared across all pages
- Modular updates only — see DEVELOPMENT_RULES.md
- AI Assistant is the single entry point for both CRM queries AND feedback
- Category segmentation validates sum = total target (hard rule)

## Key DB Collections (new)
- `target_plan_segments`: `{ id, org_id, revenue_plan_id, solution_category, booking_target, invoiced_target, margin_target, notes }`
- `feedback_items.source`: Now includes `"ai_assistant"` for feedback submitted via chat

## Test Credentials
- Admin: krishna@securado.net / test123456
- Product Director: vimod.c@securado.net / test123456
- Product Director: taj@securado.net / test123456
- Sales Rep: nabisaheb@securado.net / test123456

## Prioritized Backlog

### P0 (Next)
- **Complete Performance Hub Phase 2**: Activity Recommendation Engine per solution category
  - After segmentation, auto-generate value-selling activities per category (Demos, POCs, Site Visits)
  - Activity-to-revenue mapping and KPI alignment
  - Strategy activities: Awareness camps, assessment services, CEO presentations
  - Marketing activities: Digital campaigns, events per category

### P1
- **Performance Hub Phase 3**: Cascade Assignment (PD → Sales Director → Sales Rep per category)
- **Performance Hub Phase 4**: Dashboard Views per role (CEO side-by-side, PD category drill-down)
- **Full KPI Framework** (Phases 2-4): Role-specific incentive weight presets, gate logic (collection/GP floors)
- **Dashboard cards showing '0' for Director role**: Investigate misconfigured invoice-related cards
- **Fix 2026 Invoice data showing zero**: Reported user issue
- **Fix Account Alert on paid invoices showing as overdue**: Reported user issue

### P2
- Refactor to Services/Repositories architecture
- Replace In-Memory Event Bus with Redis Streams
- GP and attribution models for pre-sales and marketing influence
