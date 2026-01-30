# Platform 2 — Sales Dashboard Backend (CRM-like)

Objectives
- Expose robust REST APIs (FastAPI) to power Platform 3 UI
- Read-only access to Platform 1 canonical Mongo; all edits stored as overrides in Platform 2 App DB
- JWT auth with pending approval, RBAC (roles/permissions/departments)
- Canonical adapter that normalizes both layout styles (single collection vs per-entity)
- Background serving cache rebuild via APScheduler
- Org scoping throughout; admin logs for errors/sessions/api-calls
- Deliver receiving connector details for Platform 1 (publicly accessible connection info)

Architecture & Environment
- Dual MongoDB connections (Motor async):
  - Canonical (READ-ONLY): CANONICAL_MONGO_URL, CANONICAL_DB_NAME, CANONICAL_LAYOUT = single_collection|per_entity, CANONICAL_COLLECTION, CANONICAL_ENTITY_COLLECTION_PREFIX
  - App (READ/WRITE): APP_MONGO_URL, APP_DB_NAME
- FastAPI bound to 0.0.0.0:8001; all endpoints prefixed with /api
- JWT: JWT_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_TTL
- APScheduler: SCHEDULER_ENABLED=true, SCHEDULER_CRON (optional), in-process job store
- Collections (App DB minimum): users, roles, permissions, departments, user_dashboard_config, user_navigation_config, goals, teams, portfolios, initiatives, activities, messages, kpis, admin_logs_sessions, admin_logs_errors, admin_logs_api_calls, overrides_opportunities, overrides_accounts, serving_cache
- Read-only rule: Canonical DB never modified. Overrides merged at read time

Phase 1 — Core POC (Required)
Rationale: Multi-DB adapter + override merge + CRON (APScheduler) → high complexity; validate core first.

Core to Prove in Isolation
1) DB connectivity (canonical + app) via Motor
2) Canonical adapter: normalize A) envelope docs and B) per-entity flat docs → NormalizedCanonical(entity_type, canonical_id, data, updated_at, source_refs, org_id)
3) Override merge: read canonical opportunity → apply overrides_opportunities (stage, probability, owner, etc.)
4) JWT minimal: register (pending) → login → refresh → me (status-aware)
5) APScheduler: scheduled job that aggregates canonical + overrides → writes serving_cache (counts, totals, stage buckets)
6) Health + Browsing: /api/health, /api/data-lake/health, /api/data-lake/canonical?entity_type=&limit=&search=&filters=

Deliverables (Phase 1)
- Minimal FastAPI app with:
  - Auth endpoints: POST /api/auth/register, POST /api/auth/login, POST /api/auth/refresh, GET /api/auth/me
  - Data Lake endpoints: GET /api/data-lake/health, GET /api/data-lake/canonical
  - Sales minimal: GET /api/opportunities (list), PATCH /api/opportunities/{id}/stage (store override)
  - Dashboard: POST /api/dashboard/refresh (manual trigger), GET /api/sync-status
- Canonical adapter module supporting both layouts (via CANONICAL_LAYOUT)
- Scheduler job: aggregates stage counts and totals into serving_cache
- Receiving connector details document (connection string, DB/collections, index guidance)
- .env.example and Docker compose (backend + mongo + optional redis not required; APScheduler is in-process)

Scope Constraints (Phase 1)
- No sample data will be created; endpoints must handle empty canonical gracefully until Platform 1 pushes data
- Overrides stored and retrievable even if canonical not yet present (merged only when canonical exists)

Web Search (Phase 1)
- Validate Motor best practices for high-throughput reads + APScheduler coexistence
- Confirm APScheduler recommended settings inside FastAPI app (startup/shutdown events)

User Stories (Phase 1)
1) As a Platform 1 engineer, I can connect to the canonical Mongo using a provided connection string and write canonical docs
2) As an approver, I can approve a pending user so they can log in and access endpoints
3) As a user, I can log in and fetch canonical opportunities list (empty until data arrives)
4) As a seller, I can change an opportunity stage; that change is stored as an override without touching canonical
5) As a user, I can call /api/dashboard/refresh to rebuild serving cache and then see stage counts in GET /api/dashboard/stats (if data exists)
6) As an admin/dev, I can check /api/data-lake/health to verify canonical connectivity

Testing & Exit Criteria (Phase 1)
- Use testing_agent_v3 to run:
  - Auth flow: register → login → refresh → me (pending/approved)
  - Data lake health, canonical browsing (returns empty array if no data)
  - Override: PATCH stage → verify GET reflects merged value when canonical exists; otherwise override stored
  - APScheduler: manual /api/dashboard/refresh should create/update serving_cache
- Exit when all tests pass and logs show no 5xx errors

Phase 2 — Full App Development
Modules & Endpoints (all prefixed with /api)
1) Auth + Approval
- POST /auth/register, /auth/login, /auth/refresh, GET /auth/me, GET /auth/users

2) RBAC + Admin
- Permissions: GET/POST/DELETE /admin/permissions, GET /admin/permissions/{module}
- Roles: GET/GET/{id}/POST/PUT/{id}/DELETE/{id}
- Departments: GET/POST/PUT/{id}
- Users: GET/GET/{id}/POST/PUT/{id}/DELETE/{id}/PATCH {id}/assign-role, POST /admin/users/bulk-assign-role, POST /admin/users/bulk-assign-department, POST /admin/users/{id}/approve, POST /admin/users/{id}/reject, GET /admin/me/permissions
- Admin logs: GET /admin/logs/errors, POST /admin/logs/errors/{error_id}/resolve, GET /admin/logs/sessions, GET /admin/logs/session/{session_id}, GET /admin/logs/api-calls, GET /admin/logs/stats
- LLM config (stub ok): GET/POST /admin/llm/config, POST /admin/llm/test

3) Config (System + User)
- System widgets/navigation: GET /config/widgets, GET /config/navigation-items
- User dashboard: GET/PUT/DELETE /config/user/dashboard; GET /config/user/navigation
- Service lines: GET/POST/PUT/{id}
- Pipeline stages: GET/POST/PUT/{id}
- Bluesheet weights: GET/PUT
- Targets: GET/POST/PUT/{id}/DELETE/{id}
- Role targets: GET/POST/PUT/{id}/DELETE/{id}
- User targets: GET /config/user-targets/{user_id}, GET /config/target-progress-report

4) Canonical Data Lake
- GET /data-lake/health
- GET /data-lake/canonical?entity_type=&limit=&search=&filters=
- GET /data-lake/serving?entity_type=&limit=
- GET /data-lake/serving/{entity_type}
- GET /search?q=

5) Sales Domain (read canonical + apply overrides)
- Opportunities: GET /opportunities, GET /opportunities/kanban, GET /opportunities/{id}, PATCH /opportunities/{id}/stage, POST /opportunities/{id}/calculate-probability, GET /opportunities/{id}/messages
- Accounts: GET /accounts, GET /accounts/{id}/360, POST /accounts (local-only)
- Activities: GET /activities, GET /activities/stats, GET /activities/opportunity/{opp_id}, POST /activities, PATCH /activities/{id}/complete, PATCH /activities/{id}/status
- Dashboard: GET /dashboard/stats, GET /dashboard/real, GET /sales-metrics/{user_id}, GET /sync-status
- Receivables/Invoices: GET /receivables, GET /invoices (stub if absent)
- KPIs: GET/POST/PUT/{id}/DELETE/{id}

6) Goals / Teams / Portfolios / Initiatives
- Goals: GET/GET/{id}/POST/PUT/{id}/DELETE/{id}/PATCH {id}/progress, GET /goals/team/subordinates, POST /goals/assign-to-team, GET /goals/summary/stats
- Teams: POST/GET/GET/{id}/PUT/{id}, POST /teams/{id}/members, DELETE /teams/{id}/members/{user_id}, GET /teams/my-teams
- Portfolios: POST/GET/GET/{id}/dashboard
- Initiatives: POST/GET/GET/{id}/progress, PATCH /initiatives/{id}/status

Implementation Notes (Phase 2)
- Canonical data is authoritative; overrides_* merged at read
- Org scoping: filter every query by org_id; include in JWT claims
- Serialization helpers to avoid datetime not JSON serializable
- Indexes: canonical_id, entity_type, org_id, updated_at; overrides keyed by canonical_id+org_id; serving_cache keyed by entity_type+org_id

User Stories (Phase 2)
1) As an admin, I can approve/reject users and assign roles/departments in bulk
2) As a user, I can customize my dashboard layout and widgets
3) As a seller, I can manage activities (create, mark complete, change status)
4) As a sales manager, I can view opportunities Kanban by pipeline stage with override-aware data
5) As an executive, I can view dashboard KPIs and serving-cache-based leaderboards quickly
6) As a user, I can browse canonical data and search across entities
7) As a finance analyst, I can view receivables/invoices if present in canonical (or see stubs)
8) As a portfolio owner, I can manage goals, teams, portfolios, initiatives and track progress

Testing & Exit Criteria (Phase 2)
- testing_agent_v3 end-to-end suite (backend only):
  - Auth + RBAC checks for protected endpoints
  - Canonical browsing with filters/search
  - Overrides reflected in GET/kanban/dashboard
  - Serving cache refresh by scheduler and manual trigger
  - CRUD for admin/config/goals/teams/initiatives
- All endpoints return 2xx with correct shapes; no 5xx; serialization stable

Receiving Connector Details (to share with Platform 1)
- Connection string (example): mongodb+srv://<user>:<password>@<host>/<CANONICAL_DB_NAME>?retryWrites=true&w=majority
- DB: <CANONICAL_DB_NAME>; Collections by layout:
  - single_collection: CANONICAL_COLLECTION = data_lake_canonical
  - per_entity: CANONICAL_ENTITY_COLLECTION_PREFIX = silver_ (e.g., silver_opportunities)
- Recommended indexes: {entity_type, canonical_id, org_id, updated_at}
- Record styles accepted:
  - Envelope: { entity_type, canonical_id, data: {...}, updated_at, org_id, source_refs }
  - Flat: top-level fields per entity collection
- Health: GET https://trustedcrm.preview.emergentagent.com/api/data-lake/health
- Access: We will provision a dedicated MongoDB user with readWrite on canonical DB; share credentials out-of-band

Next Actions
1) Provision canonical DB credentials (user/role) and share connection string with Platform 1
2) Confirm CANONICAL_LAYOUT and collection naming
3) Implement Phase 1 core; run testing_agent_v3; iterate until green
4) Proceed to Phase 2 full API build; run comprehensive tests

Success Criteria
- Platform 1 can connect and write to canonical DB; health green
- Canonical adapter normalizes both layouts; overrides merge correctly
- JWT + approval + RBAC restrict access appropriately
- Serving cache rebuilds on schedule and via manual trigger
- All required endpoints implemented, tested, and org-scoped
- Zero critical errors in logs under nominal load
