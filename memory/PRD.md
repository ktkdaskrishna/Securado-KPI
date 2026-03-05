# Securado CRM — PRD

## Original Problem Statement
Build a sales target, incentive, and KPI management system integrated with Odoo CRM. Evolved into a configurable dashboard platform with RBAC, AI assistant, and cascading target management.

## Production URL: https://bi.securado.net

## Architecture
- Frontend: React 19 + shadcn/ui + TailwindCSS + Recharts 3
- Backend: FastAPI + MongoDB + Redis
- Data Sync: Incremental polling from Odoo v17 (5-min cycle)
- Auth: JWT + Microsoft Azure AD SSO (MSAL.js 2.0)
- AI: RAG pipeline + Whisper STT + inline charts + feedback (Emergent LLM Key)

## Completed (Latest: Mar 2026)
1-18. (See previous PRD for full history)
19. MS SSO credentials updated + **JWT fix: roles/permissions now included in SSO token** (was missing, caused empty UI for SSO users)
20. AI Assistant: CSS-styled tables (not raw markdown), hidden on login page, attachments in all modes
21. Performance Hub: AssigneeInput with autocomplete from active user list, "Strategy Team" naming

## Critical Fix: MS SSO Roles
- **Root cause**: Microsoft SSO JWT did NOT include `roles` or `permissions` arrays
- **Effect**: SSO users saw no tabs/data because RBAC guards denied everything
- **Fix**: Both callback flow and MSAL token-login now include `roles` and `permissions` from user DB record, or derive from RBAC access_level

## Test Credentials
- Admin: krishna@securado.net / test123456
- Product Director: vimod.c@securado.net / test123456
- Sales Rep: nabisaheb@securado.net / test123456

## Open Bugs from Production Feedback (4)
1. Dashboard cards show 0 for director role (P1)
2. Activity Logs missing in Opportunities (P1)
3. 2026 Invoice data zero (P1)
4. Account Alert on paid account overdue (P2)

## Prioritized Backlog
### P1
- Fix 4 production bugs above
- Performance Hub Phase 3: Cascade assignment (PD → Sales Director → Rep)
- Full KPI Framework

### P2
- PDF/Excel report generation from AI Assistant
- Performance Hub Phase 4: Role-specific dashboards
- Refactor to Services/Repositories
