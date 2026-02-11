# Securado CRM - Architecture Upgrade Roadmap

## Current State: Modular Monolith (Not Microservices)

The system is a **modular monolith** - all services run in a single FastAPI process.
This is appropriate for the current scale but has implications:
- No failure isolation between services
- Cannot scale ETL runner independently from API
- Busy ETL runs can affect API latency

## Security Fixes Applied (Feb 11, 2026)

### 1. JWT Secret - FIXED
**Before**: Hardcoded fallback `event-mesh-crm-secret-key-12345` if env var missing.
**After**: 
- Production/staging: **fails fast** with RuntimeError if JWT_SECRET not set
- Development: uses hostname-based dynamic fallback, warns loudly
**File**: `libs/utils.py`

### 2. CORS - FIXED
**Before**: `allow_origins=["*"]` with `allow_credentials=True` (unsafe combo)
**After**: 
- Auto-detects from `REACT_APP_BACKEND_URL` env var
- If wildcard detected, credentials disabled automatically
- Production uses explicit allowed origins only
**File**: `server.py`

### 3. Index Creation - FIXED
**Before**: 89 indexes created on EVERY server startup
**After**: 
- Checks `system_meta.indexes_created` timestamp
- Skips if created within 24 hours
- First startup still creates all indexes
**File**: `libs/database.py`

## Planned Upgrades (Priority Order)

### P0: Event Bus → Redis Streams
**Current**: In-memory EventBus with subscriber state in process memory
**Problem**: Multiple replicas = events only dispatched on receiving instance
**Plan**:
1. Add Redis as dependency
2. Replace `libs/event_bus.py` with Redis Streams-backed implementation
3. Keep Mongo for event history/log
4. This unblocks horizontal scaling

### P1: Refresh Token Revocation
**Current**: Refresh tokens are JWT-only, no server-side storage
**Problem**: Can't invalidate leaked tokens, can't "log out all sessions"
**Plan**:
1. Store refresh token hash in `user_sessions` collection
2. Add `token_version` field to users
3. Rotation on each refresh
4. "Revoke all sessions" admin action

### P2: Repository Pattern (Gradual)
**Current**: Routes contain business logic + DB queries + validation
**Plan**: Start with messiest domains:
1. `target_management/` → split into `repositories/` + `services/` + `routes/`
2. `etl_control/` → same pattern
3. Others can follow gradually

### P3: CRA → Vite Migration
**Current**: Create React App (CRA) with CRACO
**Problem**: CRA is unmaintained, slow builds, large bundles
**Plan**: 
1. Replace `react-scripts` with Vite
2. Update import paths if needed
3. Significant build speed improvement

### P4: Extract Runner as Separate Process
**Current**: ETL Runner runs in the same process as API
**Plan**:
1. Extract `etl_runner/` into standalone worker process
2. Communicates via Redis Streams (from P0)
3. Can be scaled independently
4. API process stays lightweight

## What's NOT Changing (Intentional Decisions)
- MongoDB as primary database (good fit for document-heavy CRM data)
- FastAPI framework (async, high performance, good DX)
- React + Tailwind frontend (mature, well-supported)
- JWT-based auth (stateless, simple)
- Single-repo monolith (easier to maintain at current team size)
