# Event Mesh CRM - Architecture Documentation

## Overview

Event Mesh CRM is a unified CRM platform that integrates with Odoo ERP via ETL pipelines, providing real-time dashboards, analytics, and data management capabilities.

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.11+ | Runtime |
| **FastAPI** | 0.110.1 | Web framework (async REST API) |
| **Motor** | 3.3.1 | Async MongoDB driver |
| **Pydantic** | 2.12.5 | Data validation & serialization |
| **Uvicorn** | 0.25.0 | ASGI server |
| **python-jose** | 3.5.0 | JWT authentication |
| **bcrypt** | 4.1.3 | Password hashing |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.0.0 | UI framework |
| **Tailwind CSS** | 3.x | Styling |
| **Shadcn/UI** | Latest | Component library (Radix-based) |
| **React Router** | 6.x | Client-side routing |
| **Axios** | 1.13.3 | HTTP client |
| **Lucide React** | 0.507.0 | Icons |
| **Framer Motion** | 12.29.0 | Animations |
| **React Hook Form** | 7.56.2 | Form management |

### Database
| Technology | Purpose |
|------------|---------|
| **MongoDB** | Primary database (document store) |
| **Motor (async)** | Non-blocking database operations |

### External Integrations
| Service | Purpose |
|---------|---------|
| **Odoo v17** | Source ERP system (XML-RPC API) |
| **OpenAI GPT** | AI-powered sales analytics |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Dashboard  │  │ Opportunities│  │  Accounts   │  │   Admin     │        │
│  │    Page     │  │    Page     │  │    Page     │  │   Pages     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                         │
│                          Axios HTTP Client                                  │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   API Gateway     │
                          │  (FastAPI/CORS)   │
                          └─────────┬─────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                           BACKEND (FastAPI)                                  │
│                                   │                                         │
│  ┌────────────────────────────────┼────────────────────────────────────┐   │
│  │                         API ROUTERS                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Identity │ │   CRM    │ │Dashboard │ │   ETL    │ │  Cache   │  │   │
│  │  │  /auth   │ │  /crm/*  │ │/dashboard│ │  /etl/*  │ │ /cache/* │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│  ┌────────────────────────────────┼────────────────────────────────────┐   │
│  │                      CORE SERVICES                                   │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │   │
│  │  │   ETL Runner    │    │  Event Queue    │    │ Serving Cache   │ │   │
│  │  │ (Odoo Sync)     │───▶│ (MongoDB Queue) │───▶│ (Pre-computed)  │ │   │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘ │   │
│  │          │                      │                      │            │   │
│  │          │              ┌───────▼───────┐              │            │   │
│  │          │              │ Event Worker  │              │            │   │
│  │          │              │ (Background)  │              │            │   │
│  │          │              └───────────────┘              │            │   │
│  └──────────┼──────────────────────────────────────────────────────────┘   │
│             │                                                               │
│  ┌──────────▼──────────────────────────────────────────────────────────┐   │
│  │                         SHARED LIBS                                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Database │  │Event Bus │  │  Schemas │  │  Utils   │            │   │
│  │  │ (Motor)  │  │(Pub/Sub) │  │(Pydantic)│  │ (Helpers)│            │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │     MongoDB       │
                          │                   │
                          │ ┌───────────────┐ │
                          │ │event_mesh_app │ │ (Users, Config, Cache)
                          │ └───────────────┘ │
                          │ ┌───────────────┐ │
                          │ │event_mesh_    │ │ (Opportunities, Accounts,
                          │ │  canonical    │ │  Contacts, Invoices, etc.)
                          │ └───────────────┘ │
                          └───────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │    Odoo v17       │
                          │   (XML-RPC)       │
                          │                   │
                          │ • crm.lead        │
                          │ • res.partner     │
                          │ • account.move    │
                          │ • mail.activity   │
                          └───────────────────┘
```

---

## Database Schema

### MongoDB Databases

#### `event_mesh_app` (Application Database)
| Collection | Purpose |
|------------|---------|
| `users` | User accounts & authentication |
| `roles` | RBAC role definitions |
| `organizations` | Multi-tenant org config |
| `etl_connections` | Odoo connection configs |
| `etl_pipelines` | ETL pipeline definitions |
| `etl_runs` | ETL execution history |
| `serving_cache` | Pre-computed UI data |
| `event_queue` | Message queue for async processing |
| `events` | Event bus audit log |

#### `event_mesh_canonical` (Canonical Data Model)
| Collection | Purpose |
|------------|---------|
| `opportunities` | CRM opportunities (from crm.lead) |
| `accounts` | Companies (from res.partner) |
| `contacts` | Individual contacts |
| `activities` | Tasks, meetings, calls |
| `invoices` | AR invoices (from account.move) |
| `users` | Synced Odoo users |

### Key Indexes
```javascript
// Deduplication - prevents duplicate records from ETL
opportunities: { source_record_id: 1, org_id: 1 } // unique
accounts: { source_record_id: 1, org_id: 1 } // unique
activities: { source_record_id: 1, org_id: 1 } // unique

// Cache lookup
serving_cache: { cache_type: 1, org_id: 1, filter_hash: 1 } // unique
```

---

## Service Architecture

### 1. Identity Service (`/api/auth/*`)
- JWT-based authentication
- User registration & login
- Password hashing (bcrypt)
- User invitation system

### 2. CRM Sales Service (`/api/opportunities/*`, `/api/accounts/*`, etc.)
- CRUD operations for CRM entities
- Filtering, pagination, search
- Export to Excel
- Bluesheet scoring

### 3. Dashboard Aggregator (`/api/dashboard/*`)
- Real-time KPI calculations
- Pipeline stage breakdown
- Leaderboards (Sales Rep, Product Manager)
- Activity summaries

### 4. ETL Control Service (`/api/etl/*`)
- Connection management (Odoo)
- Pipeline configuration
- Field mapping editor
- Run history & monitoring

### 5. ETL Runner Service (Background)
- Scheduled pipeline execution
- Extract → Transform → Load flow
- Upsert logic (prevents duplicates)
- Error handling & DLQ

### 6. Event Queue Service (`/api/admin/data-quality/queue/*`)
- MongoDB-based message queue
- Async event processing
- Retry logic (max 3 retries)
- Dead letter queue

### 7. Serving Cache Service (`/api/cache/*`)
- Pre-computed aggregates
- Single source of truth for UI
- 5-minute TTL with auto-refresh
- Test record exclusion

### 8. AI Analytics Service (`/api/analytics/*`)
- GPT-powered insights
- Sales funnel analysis
- Deal recommendations

### 9. RBAC Sync Service (`/api/rbac/*`)
- Hybrid RBAC implementation (Odoo metadata + local rules)
- Syncs users, groups, teams from Odoo
- Row-level security enforcement
- Grace period for non-synced orgs

#### RBAC Endpoints
| Endpoint | Purpose |
|----------|---------|
| `POST /api/rbac/sync` | Trigger user/group/team sync from Odoo |
| `GET /api/rbac/users` | List synced users with access levels |
| `GET /api/rbac/groups` | List synced Odoo groups |
| `GET /api/rbac/teams` | List synced sales teams |
| `GET /api/rbac/my-access` | Get current user's permissions |
| `GET /api/rbac/test-filter/{user}` | Test what filter applies to a user |
| `GET /api/rbac/stats` | RBAC sync statistics |

#### Access Levels
| Level | Description | Data Access |
|-------|-------------|-------------|
| `ADMIN` | Administration / Settings, Sales / Administrator | All records |
| `MANAGER` | Sales / Manager | Team records + own |
| `USER` | Sales / User | Own records only |
| `RESTRICTED` | Default (no RBAC sync yet) | Full access (grace period) or own records |

#### RBAC Collections (in `event_mesh_app`)
| Collection | Purpose |
|------------|---------|
| `users_rbac` | User metadata with groups/teams |
| `groups_rbac` | Odoo res.groups definitions |
| `teams_rbac` | Odoo crm.team definitions |

---

## Data Flow

### ETL Pipeline Flow
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Odoo      │     │   Extract    │     │  Transform   │     │    Load      │
│  (XML-RPC)   │────▶│  (Fetch)     │────▶│  (Map Fields)│────▶│  (Upsert)    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
                                                               ┌──────────────┐
                                                               │  MongoDB     │
                                                               │ (Canonical)  │
                                                               └──────────────┘
```

### Event-Driven Flow (New Architecture)
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ETL Runner  │────▶│ Event Queue  │────▶│Event Worker  │────▶│Serving Cache │
│              │     │  (MongoDB)   │     │ (Background) │     │(Pre-computed)│
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
                                                               ┌──────────────┐
                                                               │   All UI     │
                                                               │ Components   │
                                                               └──────────────┘
```

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/me` - Current user
- `POST /api/identity/invite` - Invite user

### CRM
- `GET /api/opportunities` - List opportunities
- `GET /api/accounts` - List accounts/contacts
- `GET /api/activities` - List activities
- `GET /api/receivables` - List invoices

### Dashboard
- `GET /api/dashboard/stats` - KPIs
- `GET /api/dashboard/leaderboard` - Sales leaderboard
- `GET /api/dashboard/product-manager-leaderboard` - PM leaderboard
- `GET /api/dashboard/category-stats` - Category breakdown

### ETL
- `GET /api/etl/connections` - List connections
- `GET /api/etl/pipelines` - List pipelines
- `POST /api/etl/pipelines/{id}/run` - Trigger run
- `GET /api/etl/runs` - Execution history

### Cache (Single Source of Truth)
- `GET /api/cache/dashboard-kpis` - Cached KPIs
- `GET /api/cache/account-overdue` - Cached overdue data
- `GET /api/cache/sales-leaderboard` - Cached leaderboard
- `POST /api/cache/refresh` - Force refresh
- `POST /api/cache/invalidate` - Clear cache

### Admin
- `GET /api/admin/data-quality/reconciliation/summary` - Data quality
- `GET /api/admin/data-quality/queue/stats` - Queue stats

---

## Security

### Authentication
- JWT tokens (HS256)
- Token expiry: 24 hours
- Refresh token support

### Authorization
- Role-based access control (RBAC)
- Roles: Admin, Manager, Sales Rep
- Row-level security (org_id filtering)

### Data Protection
- Password hashing (bcrypt, cost=12)
- CORS configured for frontend origin
- Input validation (Pydantic)

---

## Deployment

### Services
| Service | Port | Process Manager |
|---------|------|-----------------|
| Backend (FastAPI) | 8001 | Supervisor |
| Frontend (React) | 3000 | Supervisor |

### Environment Variables
```
MONGO_URL=mongodb://...
DB_NAME=event_mesh_app
CORS_ORIGINS=http://localhost:3000
EMERGENT_LLM_KEY=... (for AI features)
```

### Health Check
- `GET /health` - Basic health
- `GET /api/health` - Detailed component status

---

## File Structure

```
/app
├── backend/
│   ├── server.py              # FastAPI app & lifecycle
│   ├── requirements.txt       # Python dependencies
│   ├── libs/
│   │   ├── database.py        # MongoDB connection
│   │   ├── event_bus.py       # Pub/sub system
│   │   ├── schemas.py         # Shared Pydantic models
│   │   └── utils.py           # Helper functions
│   └── services/
│       ├── identity/          # Auth & users
│       ├── crm_sales/         # CRM entities
│       ├── dashboard_agg/     # Dashboard aggregations
│       ├── etl_control/       # ETL management
│       ├── etl_runner/        # ETL execution
│       ├── event_queue/       # Message queue
│       ├── serving_cache/     # Cache layer
│       ├── ai_analytics/      # AI insights
│       └── data_integrity/    # Data quality
├── frontend/
│   ├── src/
│   │   ├── App.js             # Root component
│   │   ├── lib/api.js         # API client
│   │   ├── components/
│   │   │   ├── ui/            # Shadcn components
│   │   │   ├── crm/           # CRM pages
│   │   │   ├── admin/         # Admin pages
│   │   │   └── layout/        # Layout components
│   │   └── hooks/             # Custom React hooks
│   ├── package.json
│   └── tailwind.config.js
├── docs/                       # Documentation
└── plan.md                     # Active development plan
```

---

## Recent Architectural Improvements

1. **MongoDB Event Queue** - Replaced direct DB writes with async event processing
2. **Serving Cache Layer** - Single source of truth for all UI components
3. **Test Record Exclusion** - Automatic filtering of test/demo data
4. **Deduplication** - Unique indexes + upsert logic prevents duplicates
5. **Default Year Filter** - Dashboard defaults to current year

---

## Future Roadmap

- [ ] Full migration to cache-based API reads
- [ ] Real-time WebSocket updates
- [ ] Modular dashboard with drag-and-drop widgets
- [ ] Multi-tenant improvements
- [ ] Audit logging enhancement
