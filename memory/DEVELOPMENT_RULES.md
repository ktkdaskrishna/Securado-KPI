# Securado CRM — Development Rules & Future Enhancement Guidelines

## CRITICAL: PRODUCTION APP — DO NOT BREAK

This application is LIVE at `bi.securado.net`. Any changes must follow strict modular update rules.

---

## RULE 1: MODULAR UPDATES ONLY

- **NEVER rewrite entire files.** Use `search_replace` for targeted edits only.
- **NEVER use `sed` for multi-line replacements.** It breaks indentation (caused the sort_by bug that emptied all charts).
- **Before editing ANY file**, read it first. Understand the full context.
- **One fix = one change.** Don't batch unrelated changes into the same file edit.
- **Test after EVERY change** with curl or screenshot before moving to the next fix.

## RULE 2: FILE OWNERSHIP — DON'T TOUCH UNLESS ASKED

### Core files (HIGH RISK — minimal edits only):
- `/app/backend/libs/database.py` — Database connections. DB_NAME drives both app + canonical.
- `/app/backend/libs/redis_pipeline.py` — Query engine. Handle None values for ALL optional params.
- `/app/backend/services/microsoft_auth/routes.py` — SSO. Env vars first, DB fallback with try/catch.
- `/app/backend/services/target_management/card_builder.py` — Dashboard cards. 923 lines. Edit specific functions only.
- `/app/backend/services/ai_analytics/routes.py` — Analytics. Uses date_last_stage_update for year filter.
- `/app/frontend/src/components/crm/HybridDashboard.js` — Read-only dashboard. Do NOT add edit controls here.
- `/app/frontend/src/components/crm/ConfigurableDashboard.js` — Builder only. All editing happens here.

### Safe to modify (LOW RISK):
- `/app/frontend/src/components/crm/EditChartDialog.js` — Card editor dialog
- `/app/frontend/src/components/crm/DomainBuilderDialog.js` — Filter builder
- `/app/frontend/src/components/layout/PageFilters.js` — Standard filter bar
- `/app/frontend/src/App.css` — CSS overrides
- Test files under `/app/backend/tests/`

## RULE 3: NEW FEATURES = NEW FILES

When adding new features:
- Create NEW component files, don't expand existing ones
- Import the new component where needed with a single-line import + usage
- Example: `EditChartDialog.js` was created as a new file, imported with one line in `ConfigurableDashboard.js`

## RULE 4: BACKEND SAFETY

- **Always handle None** in query_config values (sort_by, sort_order, date_filter_field can be None)
- **Never use bare `except:`** — always `except Exception as ex:` with `logger.error()`
- **Never use `sed` for Python file edits** — it breaks indentation
- **Test query engine changes** with direct curl to `/api/card-builder/execute-query` before testing full dashboard
- **MongoDB: Always exclude `_id`** in projections or use `serialize_doc()`
- **Date filtering: Use `date_last_stage_update`** for opportunities (matches Odoo)

## RULE 5: FRONTEND SAFETY

- **Dashboard (`/dashboard`) is READ-ONLY** — no edit buttons, no drag/drop, no template manager
- **Builder (`/dashboard-builder`) has ALL editing** — this is where card/template management lives
- **Standard `PageFilters` component** — use for ALL pages that need filtering (Dashboard, Opportunities, Analytics)
- **Chart click → navigate to Opportunities** with URL params (year, stage, salesRep, productDirector, solutionCategory)
- **shadcn/ui components** — use ChartContainer, ChartTooltip for all charts

## RULE 6: ENVIRONMENT & DEPLOYMENT

- `DB_NAME` in `.env` drives the database name. Emergent overrides it on production.
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID`, `MICROSOFT_REDIRECT_URI` in `.env` (not DB-dependent)
- `REACT_APP_BACKEND_URL` — frontend API base. Never hardcode URLs.
- Redis is optional — query engine falls back to MongoDB if Redis unavailable.
- After .env changes: `sudo supervisorctl restart backend`
- After dependency installs: restart supervisor

## RULE 7: TESTING CHECKLIST

Before finishing ANY change:
1. `tail /var/log/supervisor/backend.err.log` — check for errors
2. `tail /var/log/supervisor/frontend.out.log` — check compilation
3. Curl test the specific endpoint changed
4. For dashboard changes: verify ALL 9 cards render (not just KPIs)
5. For RBAC changes: test with admin AND sales_rep AND product_director
6. For filter changes: test year=2026 AND year=2025 (numbers must differ)

## ARCHITECTURE REFERENCE

```
/dashboard          → HybridDashboard.js     (READ-ONLY, PageFilters, drill-down)
/dashboard-builder  → ConfigurableDashboard.js (3 tabs: Layout/Templates/Cards)
/opportunities      → OpportunitiesPage.js    (reads URL params from dashboard navigation)
/analytics          → AnalyticsPage.js        (AI Analytics + Dashboard View toggle)
```

### Key Data Flow:
```
User → Dashboard → Click card → /opportunities?stage=Won&salesRep=Nabisaheb&year=2026
User → Builder → Edit Chart → EditChartDialog → DomainBuilderDialog → Save → Card in DB
Backend → my-dashboard → RBAC filter → Query engine (Redis→MongoDB) → Rendered blocks
Odoo → Incremental sync (5min) → MongoDB canonical → Redis cache invalidation
```

### 7 Templates: CEO, Sales Director, Product Director, Sales Rep, Finance, Marketing, Sales Team
### 9 Chart Types: KPI, Bar, Area, Pie, Radial, Leaderboard, Progress, Rate, Table
### RBAC: Admin=all, Manager=team (org tree walk), User=own data only

---

## KNOWN GOTCHAS (learned the hard way)

1. **sort_by=None breaks MongoDB** — Always check: `raw_sort if raw_sort else "total"`
2. **sed breaks Python indentation** — Never use sed for multi-line Python edits
3. **Account filter returns objects** — Always map: `.map(a => typeof a === 'object' ? a.name : a)`
4. **Azure AD: Web vs SPA platform types matter** — callback=Web, login=SPA
5. **Azure AD changes take 5-10 min to propagate**
6. **DB_NAME must be set correctly** — Emergent overrides it on production
7. **date_last_stage_update NOT create_date** — for ALL opportunity year filtering
8. **Leaderboard sort by total (not count)** — for sum aggregation cards
9. **`load_config_from_db()` must have try/catch** — DB may be unreachable on production
10. **Emergent badge** — Hidden via CSS `#emergent-badge { display: none !important; }`
