# Securado CRM — Product Requirements Document

## Original Problem Statement
Build a comprehensive sales target, incentive, and KPI management system with Odoo integration. Evolved to include configurable dashboards, RBAC, Microsoft SSO, AI assistant, and Performance Hub.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB (Motor async) + Redis caching
- **Auth**: JWT + Microsoft SSO (MSAL popup + server redirect)
- **Data**: Odoo v17 incremental sync → canonical DB → app DB
- **AI**: Emergent LLM key (GPT for chat, Whisper for voice)

## What's Been Implemented
- Configurable dashboard system with dashboard builder
- Resilient incremental Odoo data sync worker
- Hierarchy-aware RBAC system
- Microsoft SSO (Azure AD) with role persistence
- AI Assistant with voice input, file attachments, charts, persistent history
- Performance Hub v2 with cascading target assignment
- Advanced autocomplete with HOD detection
- Accounts, Contacts, Opportunities, Invoices/Receivables pages
- Pure Tailwind CSS (legacy CSS removed)

## Recent Fixes (2026-03-07)
- **P0 FIXED**: Dashboard cards showing 0 for director role — RBAC filter updated
- **P0 FIXED**: SSO MSAL flow now persists roles/permissions to DB
- **P1 FIXED**: Invoice dashboard data zero — same RBAC fix

## Open Bugs
1. Activity Logs missing in Opportunities (data sync gap — no activity data from Odoo)
2. Account Alert on paid accounts showing overdue (needs reproduction steps)

## Backlog
- P0: Performance Hub Phase 2 — AI Activity Recommendation Engine
- P1: AI Assistant report generation (Excel/PDF export)
- P1: Complete KPI Framework (incentive weights, collection/GP floor)
- P1: Refactor to Services/Repositories pattern
- P2: Replace in-memory Event Bus with Redis Streams
- P2: Break down AiAssistantBubble.js and PerformanceHubPage.js into smaller components
