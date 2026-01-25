# ESIP Rebuild – Plan (Odoo → NiFi-like Pipeline → FastAPI/MongoDB → Dashboard)

## 1) Objectives
- Build a Docker-less, NiFi-equivalent data pipeline platform inside the current environment
- Use Odoo CRM (https://securadotest.odoo.com) as live source via XML-RPC
- Provide UI to configure Odoo connection, discover schema, map fields, design/run pipelines
- Extract → Transform (canonical mapping) → Load to MongoDB → Serve KPIs to dashboards in near real-time
- **Multi-Target Support**: Push data to external databases (PostgreSQL, MySQL, REST APIs)
- **Webhooks**: Receive real-time CDC events from Odoo
- **Scheduling**: Automated pipeline runs with cron/interval triggers
- Ship a working MVP with tested core flow, then complete app with great UX

## 2) Architecture & Data Flow
- Data Flow: Odoo CRM → Pipeline Engine (extract/transform/load) → MongoDB (silver) + External Targets → FastAPI → React Dashboards
- Backend (FastAPI): Connections, Targets, Schema Discovery, Schema Matching, Mappings, Pipeline Designer/Executor with Scheduling, Runs/Logs, Webhooks, KPI APIs
- Frontend (React + shadcn/ui): Source/Target Connection Managers, Schema Discovery & Matching, Field Mapping, Pipeline Designer with Scheduling, Runs Monitor, Event Stream, Data Preview, KPI Dashboards
- DB (MongoDB): metadata (connections, targets, mappings, pipelines, runs, webhook_events) + data (silver: canonical)
- Scheduler: APScheduler for automated pipeline runs

---

## Phase 1: Core POC ✅ COMPLETED
Goal: Prove end-to-end core flow with real Odoo → MongoDB ingest + canonical transform + KPI compute.

**Status:** Successfully completed - POC script ran and proved connectivity, data extraction, transformation, and KPI computation.

Core to Prove
- Odoo XML-RPC auth works (already tested)
- Extract crm.lead (and crm.stage), map to canonical cdm.opportunity, upsert into MongoDB
- Compute basic KPIs (pipeline amount, win rate, avg deal size)

Scope (Single Python Test Script: tests/test_core_pipeline.py)
1) Read Odoo creds from env (DO NOT commit secrets)
2) Authenticate via XML-RPC; fetch N leads + stages
3) Transform → canonical fields (id, name, amount, stage, probability, owner_user_id, timestamps, is_closed/is_won)
4) Upsert to MongoDB (idempotent on source_record_id)
5) Compute KPIs via Mongo aggregation and print summary JSON
6) Handle edge-cases: empty result, auth error, network retry (simple backoff)

Acceptance (must pass before Phase 2)
- Auth succeeds; fetched_count > 0
- Inserted_or_updated > 0, no exceptions
- KPI summary returns valid numbers without errors

POC User Stories (min 5)
1. As a platform operator, I can verify Odoo connectivity and fetch sample records.
2. As a data engineer, I can run a one-shot pipeline to load Odoo leads into MongoDB.
3. As a data engineer, I can see a canonicalized record stored with stable IDs.
4. As a stakeholder, I can see a printed KPI summary from the loaded data.
5. As a developer, I can re-run the script idempotently without duplicates.

Exit Criteria
- Test script runs end-to-end successfully twice (idempotent) and KPIs remain consistent.

---

## Phase 2: Full App Development ✅ COMPLETED
Delivered a complete platform implementing all features with great UX.

**Status:** Successfully completed - Full-stack application deployed and tested:
- ✅ Odoo Connection Manager (create, test, verify health)
- ✅ Schema Discovery (24 CRM models discovered, 118+ fields per model)
- ✅ Field Mappings (source→canonical mapping creation)
- ✅ Pipeline Designer (create, configure, run pipelines)
- ✅ Pipeline Runs Monitor (real-time status, logs, counts)
- ✅ Data Preview (source and transformed data inspection)
- ✅ KPI Dashboards (pipeline amount, win rate, stage breakdown, rep performance)
- ✅ End-to-end tested with LIVE Odoo data (10 records extracted, transformed, loaded)

Backend (FastAPI, all routes under /api)
- /api/connections (CRUD, test) – store Odoo URL/DB/username/key (secure, not logged)
- /api/schema (discover Odoo models/fields: crm.lead, crm.stage, res.partner...)
- /api/mappings (CRUD) – source→canonical mapping versions; validation
- /api/pipelines (CRUD) – flow definition: steps [extract_odoo, transform_map, load_mongo]
- /api/pipeline-runs (list/trigger/status/logs) – manual run + APScheduler cron support
- /api/preview (sample preview after each step)
- /api/kpi/* – executive overview, pipeline health, rep performance, activity insights (computed from silver)
- Error handling: DLQ collection for transform/validation failures

Pipeline Engine (in-process)
- Extractors: Odoo extractor (model, fields, filters, incremental window on write_date)
- Transformers: FieldMapper (apply mapping rules, type casts, default values), Enrichment (stage→is_won)
- Loaders: Mongo upsert (bronze raw events, silver canonical state)
- Scheduler: APScheduler (cron/interval); manual trigger endpoint
- Logging: per-run logs + metrics (counts, duration, errors)

Frontend (React + shadcn/ui)
- Odoo Connection Manager: form + “Test Connection” + save
- Schema Discovery: list models/fields; per-model inspection; discover button
- Field Mapping UI: two-column map (source fields → canonical fields), save versioned mapping
- Pipeline Designer: minimal step composer (extract → transform → load), config editor, validate
- Pipeline Runs Monitor: table with status, counts, duration; trigger run button
- Data Preview: inspect sample at each step; JSON/table toggle
- Dashboards: Executive Overview (pipeline amount, win rate, avg deal size, revenue trend), plus Pipeline Health, Rep Performance, Activity Insights

Data Model (Mongo)
- connections, schemas, mappings(versioned), pipelines, pipeline_runs, dlq
- data: bronze_odoo_leads (raw), silver_opportunities (canonical)

Testing (end-to-end)
- Use testing agent to: create connection → test → discover schema → create mapping → build pipeline → run → preview → see KPIs
- Skip drag/drop/voice/camera; focus on clicks/forms/APIs

Phase 2 User Stories (min 5)
1. As an admin, I can configure and test the Odoo connection from the UI.
2. As a data engineer, I can discover crm.lead fields and map them to the canonical model.
3. As a data engineer, I can design a pipeline and run it manually, seeing run status and errors.
4. As a data engineer, I can preview transformed data before loading it.
5. As a business user, I can open the dashboard and see KPIs populated from real Odoo data.
6. As an operator, I can schedule the pipeline to run hourly and see last-run metrics.
7. As an operator, I can view DLQ items and retry after fixing mappings.

Deliverables
- Backend: fully implemented endpoints + pipeline engine + scheduler
- Frontend: complete UI (connections, schema, mapping, designer, runs, preview, dashboards)
- One-click seed/run for verification; comprehensive test run via testing agent; plan.md updated

---

## Phase 3: Enhanced Platform ✅ COMPLETED
Goal: Transform the platform into a full enterprise ETL solution with multi-target support, webhooks, scheduling, and schema matching.

**Status:** Successfully completed - All enhanced features implemented:

### Multi-Target Database Support
- ✅ Target Connection Manager UI (PostgreSQL, MySQL, MongoDB, REST API)
- ✅ Database loaders with connection pooling (asyncpg, aiomysql)
- ✅ Schema discovery for target databases
- ✅ Upsert/delete operations with configurable modes

### Webhook/CDC Support
- ✅ Webhook receiver endpoint (`/api/webhooks/receive/{connection_id}`)
- ✅ Event queue with pending/processed/error status
- ✅ Event Stream UI with real-time stats
- ✅ Webhook configuration guide for Odoo

### Scheduling Engine
- ✅ APScheduler integration with FastAPI lifespan
- ✅ Interval-based scheduling (every N minutes)
- ✅ Cron expression scheduling (e.g., "0 * * * *")
- ✅ Pipeline-level schedule configuration in UI
- ✅ Scheduler jobs management API

### Schema Matching
- ✅ Schema similarity algorithm (name + type compatibility)
- ✅ Automated field mapping suggestions with confidence scores
- ✅ Schema Match UI for source-to-target mapping
- ✅ One-click mapping creation from suggestions

### Enhanced Pipeline Engine
- ✅ Multi-target output (MongoDB + external target)
- ✅ Incremental sync with watermark tracking
- ✅ Delete mode configuration (soft/hard/ignore)
- ✅ Webhook-triggered pipeline runs
- ✅ Trigger type tracking (manual/scheduled/webhook)

### New UI Pages
- ✅ Target Connections page with test functionality
- ✅ Event Stream page with real-time event log
- ✅ Schema Matching page with confidence visualization
- ✅ Enhanced Pipelines page with Schedule and Target tabs

---

## Phase 4: Schema Library & Target Templates ✅ COMPLETED
Goal: Build a comprehensive data schema library and target template system for managing canonical data models and generating DDL for multiple database targets.

**Status:** Successfully completed - Full Schema Library and Target Templates system implemented:

### Schema Library
- ✅ **Built-in Canonical Schemas**: 8 pre-defined schemas (Opportunity, Contact, Account, Activity, User, Product, SaaS Subscription, E-commerce Order)
- ✅ **Schema Categories**: Canonical, Industry-specific (SaaS, E-commerce), Custom
- ✅ **Schema Versioning**: Create and track schema versions with snapshots
- ✅ **Schema Inheritance**: Extend existing schemas with additional fields
- ✅ **Import/Export**: JSON and YAML format support
- ✅ **Schema Validation**: Validate data records against schema definitions
- ✅ **Rich Field Types**: 15 data types (string, number, integer, boolean, datetime, date, time, email, url, phone, uuid, json, array, binary, currency)

### Target Templates
- ✅ **Multi-Database DDL Generation**: PostgreSQL, MySQL, MongoDB, SQL Server, ClickHouse, Snowflake
- ✅ **Type Mapping Engine**: Automatic schema-to-native type conversion for each target
- ✅ **Auto-Generate Templates**: Create templates from schemas with one click
- ✅ **DDL Preview**: View, copy, and download generated DDL statements
- ✅ **Template Management**: CRUD operations for custom templates
- ✅ **Index Support**: Primary keys, unique indexes, composite indexes

### Canonical Record Envelope
- ✅ **Envelope Model**: org_id, pipeline_id, schema_id, record_id, external_id, data, metadata
- ✅ **Change Detection**: SHA-256 hash for detecting data changes
- ✅ **Record Versioning**: Track record versions and previous hashes
- ✅ **Metadata Tracking**: Source system, timestamps, run info, processing duration

### New API Endpoints
- `/api/schemas` - Schema CRUD, versioning, import/export
- `/api/schemas/builtin` - List built-in schemas
- `/api/schemas/{id}/versions` - Schema version management
- `/api/schemas/{id}/extend` - Schema inheritance
- `/api/schemas/{id}/validate` - Data validation
- `/api/templates` - Template CRUD
- `/api/templates/auto-generate` - Auto-generate from schema
- `/api/templates/generate-ddl` - Generate DDL for any schema/target
- `/api/templates/{id}/ddl` - Get DDL for template
- `/api/templates/type-mappings/{target}` - View type mappings

### New UI Pages
- ✅ **Schema Library Page** (`/schema-library`) - Full CRUD functionality:
  - Browse schemas with search and category filtering
  - **Create Schema**: Dialog with form fields for name, version, industry, description + dynamic field builder
  - **Import Schema**: Upload JSON/YAML files or paste content directly
  - **Export Schema**: Download schema as JSON file
  - **Delete Schema**: Remove custom schemas (with confirmation dialog)
  - View fields, relationships, indexes for any schema
  - Generate DDL for any target database
- ✅ **Target Templates Page** (`/target-templates`) - Auto-generate templates, preview/copy/download DDL

---

## Phase 5: Role-Based Access Control (RBAC) ✅ COMPLETED
Goal: Build a comprehensive user and role management system with configurable role templates and permission assignment.

**Status:** Successfully completed - Full RBAC system implemented:

### Permission System
- ✅ **27 Permissions** across 7 categories:
  - User Management: view, create, edit, delete, assign_roles
  - Role Management: view, create, edit, delete
  - Connection Management: view, create, edit, delete
  - Pipeline Management: view, create, edit, delete, run, schedule
  - Schema Management: view, create, edit, delete
  - System Settings: view, edit
  - Reports: view, export

### Role Templates
- ✅ **4 System Roles** (pre-configured, protected):
  - Super Administrator: All 27 permissions
  - Administrator: 19 permissions (no user management)
  - Editor: 10 permissions (create/edit pipelines)
  - Viewer: 4 permissions (read-only)
- ✅ **Custom Role Creation**: Create roles with any permission combination
- ✅ **Role Editing**: Update permissions on any role
- ✅ **Role Deletion**: Delete custom roles (system roles protected)

### User Management
- ✅ **User CRUD**: Create, read, update, delete users
- ✅ **Role Assignment**: Assign one or more roles to users
- ✅ **Super Admin Toggle**: Promote/demote users to Super Admin
- ✅ **Active/Inactive Status**: Enable/disable user accounts

### API Endpoints
- `/api/admin/init` - Initialize RBAC with default roles
- `/api/admin/permissions` - List all permissions
- `/api/admin/permissions/my` - Get current user's permissions
- `/api/admin/roles` - Role CRUD
- `/api/admin/users` - User CRUD
- `/api/admin/users/{id}/roles` - Assign roles
- `/api/admin/users/{id}/toggle-super-admin` - Toggle super admin

### Frontend Pages
- ✅ **User Management Page** (`/users`): User table with roles, status, actions menu
- ✅ **Role Management Page** (`/roles`): Role cards with permission counts, create/edit dialogs
- ✅ **Navigation**: Administration section in sidebar

### Test Results
- Backend: 100% (12/12 endpoints passed)
- Frontend: 100% (All UI components working)

---

## 3) Next Actions (Post-MVP)
- Add auth (JWT/OIDC later), RBAC for roles (admin/engineer/viewer)
- Add observability (metrics/traces), richer run analytics, alerts on failures
- Add incremental sync by write_date/ID with high-watermark persistence
- Add additional Odoo objects (activities, users) and enrich KPIs
- Optional: When Docker available, swap to real Apache NiFi and/or add Kafka/ClickHouse

## 4) Success Criteria
- POC script proves real Odoo → Mongo ingest + KPI compute (no errors, idempotent)
- UI allows: test connection, discover schema, create mapping, design pipeline, run manually
- Data preview shows correct mapping; silver_opportunities populated
- Dashboards load with live KPI numbers from Odoo-derived data
- End-to-end tests (testing agent) pass for all Phase 2 user stories
