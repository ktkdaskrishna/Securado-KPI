# Securado CRM — PRD

## Original Problem Statement
Build a sales target, incentive, and KPI management system integrated with Odoo. Evolved into a configurable dashboard platform with RBAC, AI-powered CRM assistant with voice/charts/attachments, and cascading target management for PD/Strategy/Marketing teams.

## Production URL: https://bi.securado.net

## Architecture
- Frontend: React 19 + shadcn/ui + TailwindCSS + Recharts 3
- Backend: FastAPI + MongoDB + Redis
- Data Sync: Incremental polling from Odoo v17 (5-min cycle)
- Auth: JWT + Microsoft Azure AD SSO (MSAL.js 2.0)
- AI: RAG pipeline + Whisper STT + inline charts + feedback (Emergent LLM Key)

## Completed Phases (Latest: Mar 2026)
1-16. (See previous PRD versions for full history)
17. Performance Hub v2.1 — Strategy GM & Marketing Team targets
18. **AI Assistant v3** (Mar 2026):
    - Voice input via OpenAI Whisper transcription
    - File attachments in feedback mode (screenshots)
    - Inline charts/graphs (bar, pie, line) rendered in chat from AI responses
    - Chat export to text file
    - Pipeline chart quick action
19. **MS SSO Fix** — Updated Azure AD credentials (Client ID, Tenant ID, Client Secret)
20. **Production Feedback Review** — Triaged 10 items: 6 resolved, 4 real bugs tracked

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
- Full KPI Framework: incentive weight presets, gate logic

### P2
- Performance Hub Phase 4: Role-specific dashboards
- Refactor to Services/Repositories
- Replace In-Memory Event Bus with Redis Streams
- PDF/Excel report generation from AI Assistant data
