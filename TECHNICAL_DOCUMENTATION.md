# Event Mesh CRM - Complete Technical Documentation

## 🎯 Application Overview

**Event Mesh CRM** is a unified microservices platform that combines:
- **ETL Platform** (Extract-Transform-Load) for data integration from external systems (Odoo, Salesforce, etc.)
- **CRM Backend** for admin, RBAC, configurations, dashboards, and goals
- **CRM Frontend** for managing opportunities, accounts, activities, and KPIs

### Live Preview URL
```
https://ai-assistant-test-2.preview.emergentagent.com
```

### Test Credentials
- **Email**: test@securado.com
- **Password**: test123456

---

## 🏗️ Technical Architecture

### System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React)                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Auth Pages │ CRM Pages │ ETL Pages │ Admin Pages │ Data Modeling    │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │  Login      │ Dashboard  │ Connections │ Users     │ Mapping Editor  │   │
│  │  Register   │ Opportunities│ Mappings   │ Roles     │ Data Model View │   │
│  │             │ Accounts   │ Pipelines   │ Departments│                │   │
│  │             │ Activities │ Runs        │ Settings   │                │   │
│  │             │ Goals      │ Data Lake   │            │                │   │
│  │             │ Teams      │ DLQ         │            │                │   │
│  │             │ Portfolios │             │            │                │   │
│  │             │ Initiatives│             │            │                │   │
│  │             │ KPIs       │             │            │                │   │
│  │             │ Invoices   │             │            │                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTP/REST (axios)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI - 11 Microservices)                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Identity │ RBAC │ Config │ ETL Control │ ETL Runner │ Dashboard   │   │
│  │  ──────────────────────────────────────────────────────────────────│   │
│  │  CRM Sales │ CRM Goals │ Canonical Query │ Event Gateway │ Data    │   │
│  │                                                           Modeling │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                       ┌─────────────┴─────────────┐                        │
│                       ▼                           ▼                        │
│              ┌─────────────────┐        ┌─────────────────┐                │
│              │   Event Bus    │        │    DB Manager   │                │
│              │  (In-memory)   │        │    (Motor)      │                │
│              └─────────────────┘        └─────────────────┘                │
└────────────────────────────────────────────────┬────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MONGODB DATABASE                                   │
│  ┌───────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │      App DB (event_mesh_app)  │  │  Canonical DB (event_mesh_canonical)│  │
│  │  ───────────────────────────  │  │  ──────────────────────────────── │  │
│  │  users, roles, permissions    │  │  canonical_opportunity            │  │
│  │  departments, connections     │  │  canonical_account                │  │
│  │  mappings, pipelines          │  │  canonical_contact                │  │
│  │  pipeline_runs, overrides     │  │  canonical_invoice                │  │
│  │  activities, goals, teams     │  │  canonical_activity               │  │
│  │  portfolios, initiatives      │  │  canonical_task                   │  │
│  │  kpis, events, dlq            │  │  canonical_sales_user             │  │
│  │  mapping_configs              │  │  canonical_sales_team             │  │
│  └───────────────────────────────┘  └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                                 │
                          External Data Sources  │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL INTEGRATIONS                               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐ │
│  │   Odoo    │ │ Salesforce│ │  HubSpot  │ │ Pipedrive │ │ PostgreSQL/   │ │
│  │   ERP/CRM │ │    CRM    │ │    CRM    │ │    CRM    │ │ MySQL/CSV     │ │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.11+ | Core language |
| **FastAPI** | 0.110.1 | Web framework |
| **Motor** | 3.3.1 | Async MongoDB driver |
| **Pydantic** | 2.12.5 | Data validation |
| **PyJWT** | 2.10.1 | JWT authentication |
| **bcrypt** | 4.1.3 | Password hashing |
| **PyYAML** | 6.0.3 | YAML parsing |
| **uvicorn** | 0.25.0 | ASGI server |
| **python-jose** | 3.5.0 | JWT utilities |
| **xmlrpc.client** | built-in | Odoo XML-RPC integration |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.0.0 | UI framework |
| **React Router** | 7.13.0 | Routing |
| **Tailwind CSS** | 3.x | Styling |
| **Shadcn/UI** | Latest | Component library |
| **Radix UI** | Various | Primitives |
| **React Flow** | 11.11.4 | Node-based diagrams |
| **Recharts** | 3.7.0 | Charts |
| **Axios** | 1.13.3 | HTTP client |
| **Lucide React** | 0.507.0 | Icons |
| **Framer Motion** | 12.29.0 | Animations |
| **Sonner** | 2.0.3 | Toast notifications |
| **date-fns** | 4.1.0 | Date utilities |

### Database
| Technology | Purpose |
|------------|---------|
| **MongoDB** | Primary database |
| **Motor (AsyncIOMotorClient)** | Async MongoDB operations |

---

## 📁 Project Structure

```
/app/
├── backend/
│   ├── server.py                    # Main FastAPI application entry point
│   ├── requirements.txt             # Python dependencies (120+ packages)
│   ├── .env                         # Environment variables (MONGO_URL)
│   │
│   ├── libs/                        # Shared utilities
│   │   ├── database.py              # MongoDB connection manager (2 DBs)
│   │   ├── event_bus.py             # In-memory event bus (Kafka-like patterns)
│   │   ├── schemas.py               # Shared Pydantic models
│   │   └── utils.py                 # Helper functions
│   │
│   └── services/                    # 11 Microservices
│       ├── identity/                # Authentication & user management
│       │   └── routes.py            # /api/auth/*, /api/admin/*
│       │
│       ├── rbac/                    # Role-based access control
│       │   └── routes.py            # /api/admin/roles, permissions, departments
│       │
│       ├── config/                  # System & user configuration
│       │   └── routes.py            # /api/config/*
│       │
│       ├── etl_control/             # ETL management (connections, mappings, pipelines)
│       │   ├── routes.py            # /api/integrations/*, /api/mappings/*, /api/pipelines/*
│       │   ├── models.py            # ETL data models
│       │   └── mapping_utils.py     # Auto-mapping logic
│       │
│       ├── etl_runner/              # ETL execution engine
│       │   └── runner.py            # Background ETL job processor
│       │
│       ├── data_modeling/           # Canonical data model (YAML-based)
│       │   ├── sales_model.yml      # Source of truth for entities
│       │   ├── sales_model.graph.json # React Flow graph data
│       │   ├── sales_model.mmd      # Mermaid ER diagram
│       │   ├── model_generator.py   # Generates graph.json and .mmd from YAML
│       │   ├── mappers.py           # Data transformation logic
│       │   └── schemas.py           # Entity schemas
│       │
│       ├── canonical_query/         # Data lake queries
│       │   └── routes.py            # /api/data-lake/*, /api/search
│       │
│       ├── crm_sales/               # CRM sales features
│       │   └── routes.py            # /api/opportunities/*, /api/accounts/*, /api/activities/*
│       │
│       ├── crm_goals/               # Goals & team management
│       │   └── routes.py            # /api/goals/*, /api/teams/*, /api/portfolios/*
│       │
│       ├── dashboard_agg/           # Dashboard aggregation
│       │   └── routes.py            # /api/dashboard/*
│       │
│       └── event_gateway/           # SSE events & DLQ
│           └── routes.py            # /api/events/*, /api/dlq/*
│
├── frontend/
│   ├── package.json                 # 60+ npm dependencies
│   ├── .env                         # REACT_APP_BACKEND_URL
│   │
│   └── src/
│       ├── App.js                   # Main React app with routing
│       ├── App.css                  # Global styles
│       ├── index.js                 # Entry point
│       ├── index.css                # Tailwind directives
│       │
│       ├── lib/                     # Utilities
│       │   ├── api.js               # API client (230+ lines, all endpoints)
│       │   ├── auth.js              # Auth context & hooks
│       │   ├── CurrencyContext.js   # Global currency management
│       │   ├── currency.js          # Currency formatting
│       │   └── utils.js             # Helper functions
│       │
│       ├── hooks/
│       │   └── use-toast.js         # Toast hook
│       │
│       └── components/
│           ├── ui/                  # 47 Shadcn components
│           │   ├── button.jsx
│           │   ├── card.jsx
│           │   ├── dialog.jsx
│           │   ├── table.jsx
│           │   ├── tabs.jsx
│           │   ├── form.jsx
│           │   ├── select.jsx
│           │   ├── input.jsx
│           │   └── ... (40 more)
│           │
│           ├── layout/              # App layout
│           │   ├── Layout.js        # Main layout wrapper
│           │   ├── Sidebar.js       # Navigation sidebar
│           │   └── Header.js        # Top header
│           │
│           ├── auth/                # Auth pages
│           │   ├── LoginPage.js
│           │   └── RegisterPage.js
│           │
│           ├── crm/                 # CRM pages (12 pages)
│           │   ├── DashboardPage.js
│           │   ├── OpportunitiesPage.js
│           │   ├── AccountsPage.js
│           │   ├── ActivitiesPage.js
│           │   ├── ActivityTimelinePage.js
│           │   ├── GoalsPage.js
│           │   ├── TeamsPage.js
│           │   ├── PortfoliosPage.js
│           │   ├── InitiativesPage.js
│           │   ├── KPIsPage.js
│           │   ├── InvoicesPage.js
│           │   └── ProfilePage.js
│           │
│           ├── etl/                 # ETL pages (6 pages)
│           │   ├── ConnectionsPage.js
│           │   ├── MappingsPage.js (legacy, replaced)
│           │   ├── PipelinesPage.js
│           │   ├── RunsPage.js
│           │   ├── DataLakePage.js
│           │   └── DLQPage.js
│           │
│           ├── mapping-editor/      # Visual ETL Editor (7 components)
│           │   ├── MappingEditor.js     # Main 3-panel editor
│           │   ├── SourcePanel.js       # Odoo models display
│           │   ├── TargetPanel.js       # Canonical entities
│           │   ├── RelationshipDiagram.js # React Flow diagram
│           │   ├── SyncControls.js      # Sync status & history
│           │   ├── TransformPreview.js  # Preview dialog
│           │   └── index.js             # Exports
│           │
│           ├── data-modeling/       # Data model viewer
│           │   └── DataModelEditor.js
│           │
│           └── admin/               # Admin pages (4 pages)
│               ├── UsersPage.js
│               ├── RolesPage.js
│               ├── DepartmentsPage.js
│               └── SettingsPage.js
│
├── docs/
│   ├── features.md                  # Feature gap analysis
│   └── odoo_integration.md          # Odoo integration guide
│
└── plan.md                          # Development plan & progress
```

---

## 🔌 API Endpoints (100+ Endpoints)

### Authentication (`/api/auth/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user info |

### Admin (`/api/admin/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users (with status filter) |
| GET | `/api/admin/users/{id}` | Get user details |
| POST | `/api/admin/users/{id}/approve` | Approve pending user |
| POST | `/api/admin/users/{id}/reject` | Reject user with reason |
| PUT | `/api/admin/users/{id}` | Update user |
| DELETE | `/api/admin/users/{id}` | Delete user |
| PUT | `/api/admin/users/{id}/roles` | Update user roles |
| GET | `/api/admin/settings` | Get admin settings |
| PUT | `/api/admin/settings` | Update admin settings |

### RBAC (`/api/admin/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/roles` | List all roles |
| GET | `/api/admin/roles/{id}` | Get role details |
| POST | `/api/admin/roles` | Create role |
| PUT | `/api/admin/roles/{id}` | Update role |
| DELETE | `/api/admin/roles/{id}` | Delete role |
| GET | `/api/admin/permissions` | List all permissions |
| POST | `/api/admin/permissions` | Create permission |
| DELETE | `/api/admin/permissions/{id}` | Delete permission |
| GET | `/api/admin/departments` | List departments |
| POST | `/api/admin/departments` | Create department |
| PUT | `/api/admin/departments/{id}` | Update department |
| DELETE | `/api/admin/departments/{id}` | Delete department |

### ETL Connections (`/api/integrations/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations` | List connections |
| GET | `/api/integrations/{id}` | Get connection |
| POST | `/api/integrations` | Create connection |
| PUT | `/api/integrations/{id}` | Update connection |
| DELETE | `/api/integrations/{id}` | Delete connection |
| POST | `/api/integrations/{id}/test` | Test connection |
| POST | `/api/integrations/{id}/discover` | Discover schema |
| GET | `/api/integrations/{id}/schema` | Get discovered schema |
| GET | `/api/integrations/{id}/schema/{model}/fields` | Get model fields |

### ETL Templates (`/api/templates/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List available templates |
| GET | `/api/templates/{id}` | Get template details |
| POST | `/api/templates/{id}/create-connection` | Create connection from template |
| GET | `/api/templates/{id}/default-mappings/{model}` | Get default field mappings |

### ETL Mappings (`/api/mappings/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mappings` | List mappings |
| GET | `/api/mappings/{id}` | Get mapping |
| POST | `/api/mappings` | Create mapping |
| PUT | `/api/mappings/{id}` | Update mapping |
| DELETE | `/api/mappings/{id}` | Delete mapping |
| POST | `/api/mappings/{id}/preview` | Preview transformation |
| POST | `/api/mappings/{id}/verify` | Verify schema |
| POST | `/api/mappings/auto-suggest` | Auto-suggest field mappings |

### ETL Pipelines (`/api/pipelines/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pipelines` | List pipelines |
| GET | `/api/pipelines/{id}` | Get pipeline |
| POST | `/api/pipelines` | Create pipeline |
| PUT | `/api/pipelines/{id}` | Update pipeline |
| DELETE | `/api/pipelines/{id}` | Delete pipeline |
| POST | `/api/pipelines/{id}/run` | Trigger pipeline run |
| GET | `/api/pipelines/{id}/runs` | Get pipeline run history |

### ETL Runs (`/api/runs/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/runs` | List all runs |
| GET | `/api/runs/{id}` | Get run details |
| GET | `/api/runs/{id}/logs` | Get run logs |

### Visual Mapping Editor (`/api/mapping-editor/*`) - NEW
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mapping-editor/config` | Get saved mapping config |
| PUT | `/api/mapping-editor/config` | Save mapping config |
| POST | `/api/mapping-editor/preview` | Preview transformation |
| POST | `/api/mapping-editor/sync` | Run ETL sync |
| GET | `/api/mapping-editor/sync/status/{connection_id}` | Get sync status |
| GET | `/api/mapping-editor/entities` | Get canonical entities from YAML |

### Data Model (`/api/data-model/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data-model` | Get data model (graph JSON) |
| PUT | `/api/data-model` | Update data model |
| POST | `/api/data-model/regenerate` | Regenerate from YAML |
| GET | `/api/data-model/yaml` | Get raw YAML spec |
| GET | `/api/data-model/mermaid` | Get Mermaid ER diagram |

### Data Lake (`/api/data-lake/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data-lake/canonical` | List canonical records |
| GET | `/api/data-lake/canonical/{entity}/{id}` | Get single record |
| GET | `/api/data-lake/stats` | Get data lake statistics |
| GET | `/api/search` | Cross-entity search |

### CRM Dashboard (`/api/dashboard/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard stats |
| POST | `/api/dashboard/refresh` | Refresh aggregations |
| GET | `/api/dashboard/sync-status` | Get ETL sync status |

### CRM Opportunities (`/api/opportunities/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/opportunities` | List opportunities |
| GET | `/api/opportunities/kanban` | Get Kanban view data |
| GET | `/api/opportunities/{id}` | Get opportunity details |
| PATCH | `/api/opportunities/{id}/stage` | Update stage |
| POST | `/api/opportunities/{id}/calculate-probability` | Calculate probability |
| GET | `/api/opportunities/{id}/messages` | Get messages/notes |
| POST | `/api/opportunities/{id}/notes` | Create note |
| GET | `/api/opportunities/{id}/activities` | Get activities |
| GET | `/api/opportunities/{id}/bluesheet` | Get bluesheet assessment |
| PUT | `/api/opportunities/{id}/bluesheet` | Update bluesheet |
| POST | `/api/opportunities/{id}/bluesheet/calculate` | Calculate bluesheet score |

### CRM Accounts (`/api/accounts/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List accounts |
| POST | `/api/accounts` | Create account |
| GET | `/api/accounts/{id}/360` | Get 360° view |

### CRM Activities (`/api/activities/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activities` | List activities |
| GET | `/api/activities/stats` | Get activity statistics |
| POST | `/api/activities` | Create activity |
| PATCH | `/api/activities/{id}/status` | Update status |
| PATCH | `/api/activities/{id}/complete` | Mark complete |

### CRM Goals (`/api/goals/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goals` | List goals |
| GET | `/api/goals/summary/stats` | Get goals summary |
| GET | `/api/goals/{id}` | Get goal |
| POST | `/api/goals` | Create goal |
| PUT | `/api/goals/{id}` | Update goal |
| DELETE | `/api/goals/{id}` | Delete goal |
| PATCH | `/api/goals/{id}/progress` | Update progress |

### CRM Teams (`/api/teams/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | List teams |
| GET | `/api/teams/{id}` | Get team |
| POST | `/api/teams` | Create team |
| PUT | `/api/teams/{id}` | Update team |
| DELETE | `/api/teams/{id}` | Delete team |
| POST | `/api/teams/{id}/members` | Add member |
| DELETE | `/api/teams/{id}/members/{user_id}` | Remove member |

### CRM Portfolios (`/api/portfolios/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portfolios` | List portfolios |
| GET | `/api/portfolios/{id}` | Get portfolio |
| POST | `/api/portfolios` | Create portfolio |
| DELETE | `/api/portfolios/{id}` | Delete portfolio |
| GET | `/api/portfolios/{id}/dashboard` | Get portfolio dashboard |

### CRM Initiatives (`/api/initiatives/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/initiatives` | List initiatives |
| GET | `/api/initiatives/{id}` | Get initiative |
| POST | `/api/initiatives` | Create initiative |
| DELETE | `/api/initiatives/{id}` | Delete initiative |
| GET | `/api/initiatives/{id}/progress` | Get progress |
| PATCH | `/api/initiatives/{id}/status` | Update status |

### CRM KPIs (`/api/kpis/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kpis` | List KPIs |
| POST | `/api/kpis` | Create KPI |
| PUT | `/api/kpis/{id}` | Update KPI |
| DELETE | `/api/kpis/{id}` | Delete KPI |

### CRM Receivables (`/api/receivables/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/receivables` | List receivables/invoices |

### Events & DLQ (`/api/events/*`, `/api/dlq/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/stream` | SSE event stream |
| GET | `/api/events/history` | Get event history |
| GET | `/api/events/runs/{run_id}` | Get run events |
| GET | `/api/dlq` | List DLQ items |
| GET | `/api/dlq/stats` | Get DLQ statistics |
| POST | `/api/dlq/{id}/retry` | Retry DLQ item |
| POST | `/api/dlq/{id}/dismiss` | Dismiss DLQ item |

### Config (`/api/config/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get system config |
| PUT | `/api/config` | Update system config |
| GET | `/api/config/user/dashboard` | Get user dashboard config |
| PUT | `/api/config/user/dashboard` | Update user dashboard config |
| GET | `/api/config/widgets` | Get available widgets |
| GET | `/api/config/navigation` | Get navigation config |

---

## 🗄️ Database Schema

### App Database (`event_mesh_app`)

#### Collections & Indexes
| Collection | Key Fields | Indexes |
|------------|------------|---------|
| `users` | id, email, org_id, status, roles | id (unique), email (unique), org_id, status |
| `roles` | id, name, org_id, permissions | id (unique), org_id, name |
| `permissions` | id, resource, action, org_id | id (unique), org_id |
| `departments` | id, name, org_id | id (unique), org_id |
| `connections` | id, type, url, org_id, status | id (unique), org_id |
| `mappings` | id, connection_id, source_model, target_entity, org_id | id (unique), org_id, connection_id |
| `pipelines` | id, name, mapping_ids, schedule, org_id | id (unique), org_id |
| `pipeline_runs` | id, pipeline_id, status, org_id, started_at | id (unique), pipeline_id, org_id, started_at |
| `mapping_configs` | org_id, connectionId, fieldMappings, relationships | org_id |
| `overrides` | id, canonical_id, org_id, fields | id (unique), [canonical_id, org_id] |
| `activities` | id, type, opportunity_id, org_id, status | id (unique), org_id, opportunity_id |
| `goals` | id, name, type, org_id | id (unique), org_id |
| `teams` | id, name, members, org_id | id (unique), org_id |
| `portfolios` | id, name, org_id | id (unique), org_id |
| `initiatives` | id, name, portfolio_id, org_id | id (unique), org_id |
| `kpis` | id, name, formula, org_id | id (unique), org_id |
| `events` | id, type, data, timestamp | id, type, timestamp |
| `dlq` | id, event_type, error, status | id, status |

### Canonical Database (`event_mesh_canonical`)

#### Collections (ETL Output)
| Collection | Source | Key Fields |
|------------|--------|------------|
| `canonical_opportunity` | crm.lead | canonical_id, name, amount, stage, probability, account_id, owner_id |
| `canonical_account` | res.partner | canonical_id, name, industry, phone, email, website |
| `canonical_contact` | res.partner | canonical_id, name, email, phone, account_id |
| `canonical_invoice` | account.move | canonical_id, invoice_number, amount_total, currency, state |
| `canonical_activity` | mail.activity | canonical_id, summary, activity_type, date_deadline |
| `canonical_task` | project.task | canonical_id, name, stage, assignee_id |
| `canonical_sales_user` | res.users | canonical_id, name, email, login, team_id |
| `canonical_sales_team` | crm.team | canonical_id, name, use_opportunities |
| `canonical_employee` | hr.employee | canonical_id, name, department, job_title |

---

## 🧩 Canonical Data Model (9 Entities)

The canonical data model is defined in `/app/backend/services/data_modeling/sales_model.yml`:

```yaml
entities:
  sales_user:      # Salespeople from res.users
  sales_team:      # Teams from crm.team  
  account:         # Customers from res.partner (is_company=true)
  contact:         # Contacts from res.partner (is_company=false)
  opportunity:     # Deals from crm.lead
  activity:        # Activities from mail.activity
  invoice:         # Invoices from account.move
  task:            # Tasks from project.task
  employee:        # Employees from hr.employee

relationships:
  - sales_user → account (1:N, owns)
  - sales_user → opportunity (1:N, owns)
  - sales_team → sales_user (1:N, has members)
  - sales_team → opportunity (1:N, manages)
  - account → contact (1:N, has contacts)
  - account → opportunity (1:N, has opportunities)
  - account → invoice (1:N, has invoices)
  - opportunity → activity (1:N, has activities)
  - opportunity → task (1:N, has tasks)
  - opportunity → invoice (1:N, generates)
```

---

## 🎨 Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | LoginPage | User login |
| `/register` | RegisterPage | User registration |
| `/` | DashboardPage | Main dashboard |
| `/opportunities` | OpportunitiesPage | Opportunities list & Kanban |
| `/accounts` | AccountsPage | Accounts list |
| `/activities` | ActivitiesPage | Activities management |
| `/activities/timeline` | ActivityTimelinePage | Visual timeline |
| `/goals` | GoalsPage | Goals tracking |
| `/teams` | TeamsPage | Team management |
| `/portfolios` | PortfoliosPage | Portfolio management |
| `/initiatives` | InitiativesPage | Initiative tracking |
| `/kpis` | KPIsPage | KPI monitoring |
| `/invoices` | InvoicesPage | Invoices/Receivables |
| `/profile` | ProfilePage | User profile |
| `/etl/connections` | ConnectionsPage | Data connections |
| `/etl/mappings` | **MappingEditor** | Visual ETL Editor (NEW) |
| `/etl/pipelines` | PipelinesPage | Pipeline management |
| `/etl/runs` | RunsPage | Run history |
| `/etl/data-lake` | DataLakePage | Canonical data browser |
| `/etl/dlq` | DLQPage | Dead Letter Queue |
| `/etl/data-model` | DataModelEditor | Data model viewer |
| `/admin/users` | UsersPage | User management |
| `/admin/roles` | RolesPage | Role management |
| `/admin/departments` | DepartmentsPage | Departments |
| `/admin/settings` | SettingsPage | System settings |

---

## 🔐 Authentication & Authorization

### JWT Authentication Flow
```
1. User registers → status: "pending"
2. Admin approves → status: "approved"
3. User logs in → receives access_token + refresh_token
4. Access token expires (30 min) → use refresh_token to get new access_token
5. Refresh token expires (7 days) → user must re-login
```

### RBAC Structure
- **55 Permissions** across 11 resources
- **4 Default Roles**: Administrator, ETL Administrator, Sales Manager, Sales Representative
- **Resources**: users, roles, permissions, departments, connections, mappings, pipelines, runs, opportunities, accounts, activities

---

## 🚀 Key Features

### ETL Platform
- ✅ Multi-source connectors (Odoo, Salesforce, HubSpot, Pipedrive, Zoho, PostgreSQL, MySQL, CSV)
- ✅ Visual schema discovery
- ✅ Auto-suggest field mappings
- ✅ Schema verification
- ✅ Visual Mapping Editor with React Flow
- ✅ Pipeline scheduling (cron support)
- ✅ Run history & logs
- ✅ Dead Letter Queue (DLQ)
- ✅ SSE real-time updates

### CRM Platform
- ✅ Dashboard with KPIs
- ✅ Opportunities (list + Kanban views)
- ✅ Bluesheet assessment (Miller Heiman methodology)
- ✅ Account 360° view
- ✅ Activity tracking & timeline
- ✅ Goals management
- ✅ Team management
- ✅ Portfolio & Initiative tracking
- ✅ KPI monitoring
- ✅ Invoice/Receivables tracking

### Admin Platform
- ✅ User management (approve/reject workflow)
- ✅ Role-based access control (55 permissions)
- ✅ Department management
- ✅ System settings
- ✅ Navigation customization

---

## 🔧 Running the Application

### Backend
```bash
cd /app/backend
supervisorctl restart backend
# Runs on http://localhost:8001
```

### Frontend
```bash
cd /app/frontend
supervisorctl restart frontend
# Runs on http://localhost:3000
```

### View Logs
```bash
# Backend logs
tail -f /var/log/supervisor/backend.*.log

# Frontend logs
tail -f /var/log/supervisor/frontend.*.log
```

---

## 📊 Statistics

| Metric | Count |
|--------|-------|
| Backend Services | 11 |
| API Endpoints | 100+ |
| Frontend Pages | 24 |
| Frontend Components | 34 (custom) + 47 (Shadcn) |
| Database Collections | 20+ |
| Canonical Entities | 9 |
| Entity Relationships | 10 |
| RBAC Permissions | 55 |
| Python Dependencies | 120+ |
| NPM Dependencies | 60+ |

---

## 📝 Known Issues

1. **P1 - RBAC Role Saving Bug**: User role saving fails on Admin > Users page
2. **P2 - Sidebar Scroll Issue**: Settings section may not be scrollable

---

*Last Updated: January 2025*
