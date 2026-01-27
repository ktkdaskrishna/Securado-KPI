# Event Mesh CRM — Unified Microservices Platform - Development Plan

## Project Overview
Unified microservices platform combining ETL, CRM backend, and CRM frontend with event-driven architecture.

---

## Phase 1: Core Infrastructure (COMPLETED ✅)
- ✅ Backend microservices setup (11 services)
- ✅ MongoDB connection and data models
- ✅ Event bus implementation
- ✅ Authentication and JWT token system
- ✅ Basic RBAC foundation

---

## Phase 2: Frontend Assembly (COMPLETED ✅)
- ✅ React app with routing
- ✅ Shadcn UI components integration
- ✅ Login/Registration pages
- ✅ Dashboard layout
- ✅ CRM pages (Opportunities, Accounts, Activities)
- ✅ ETL pages (Connections, Mappings, Pipelines)
- ✅ Admin pages (Users, Roles)

---

## Phase 3: Advanced Features (COMPLETED ✅)
### ETL Enhancements
- ✅ Integration Templates with pre-built connectors (Odoo, Salesforce, HubSpot, etc.)
- ✅ Template-based connection creation
- ✅ Auto-suggest field mappings API
- ✅ Schema verification endpoint
- ✅ Frontend UI for templates (tested & working)
- ✅ Frontend UI for auto-mapping (tested & working)
- ✅ Frontend UI for schema verification

### CRM Enhancements
- ✅ Bluesheet probability calculation API (Miller Heiman methodology)
- ✅ Bluesheet form with buying influences, competition/budget status
- ✅ Notes CRUD under Opportunities
- ✅ Activities stream under Opportunities
- ✅ Opportunity detail sheet with tabs (Overview, Bluesheet, Activities, Notes)
- ✅ Frontend UI for Bluesheet assessment (tested & working)
- ✅ Frontend UI for Notes/Messages (tested & working)

### RBAC Enhancements
- ✅ Granular permissions (55 permissions across resources)
- ✅ User role assignment UI
- ✅ Update user roles API endpoint
- ✅ Roles management with permission assignment

---

## Phase 4: Testing & Validation (COMPLETED ✅)
- ✅ Backend API testing (90% success rate)
- ✅ Frontend UI testing (100% success rate)
- ✅ Overall system testing (95% success rate)
- ✅ No critical bugs found

---

## Phase 5: Securado Branding & Navigation (COMPLETED ✅)
- ✅ Securado brand guidelines integrated (colors, fonts, logo)
- ✅ Login/Register pages re-branded
- ✅ Sidebar with Securado logo and brand colors
- ✅ CSS variables updated for consistent theming
- ✅ Navigation customization panel (show/hide sidebar items)

---

## Phase 6: Bug Fixes (COMPLETED ✅)
- ✅ Fixed org_id KeyError in identity/auth routes
- ✅ Fixed org_id KeyError across all backend services (crm_sales, etl_control, rbac, etc.)
- ✅ Verified Kanban view is NOT a regression (code is intact, both tabs visible)

---

## Phase 7: Feature Gap Analysis (COMPLETED ✅)
- ✅ Extracted and analyzed salescommand-v4-production.zip
- ✅ Created comprehensive feature documentation at /app/docs/features.md
- ✅ Documented all missing features vs old codebase
- ✅ Created priority backlog (P0, P1, P2, P3)
- ✅ Mapped features to user personas (Account Manager, Sales Director, Finance Manager, CEO)

---

## Phase 8: Feature Parity (IN PROGRESS)
### P1 - High Priority Missing Features (COMPLETED ✅)
- ✅ Profile Page - User profile management with tabs (Profile, Notifications, Security)
- ✅ Invoices/Receivables Page - Invoice tracking with stats, filters, and detail view
- ✅ Activity Timeline Page - Visual timeline of activities with grouping by date
- [ ] Account 360° View Panel - Enhanced version with invoices and more details
- [ ] Target Progress Report Page  
- [ ] CQRS v2 Dashboard endpoints

### P2 - Medium Priority Features
- [ ] Incentives/Commission Page
- [ ] Integration Hub Components (Odoo, MS365, Salesforce, HubSpot)
- [ ] System Configuration Page
- [ ] System Logs Page
- [ ] Global Search

### P3 - Nice to Have
- [ ] Visual Data Flow Hub
- [ ] AI-powered field mapping suggestions
- [ ] Advanced role configuration
- [ ] KPI Cards/Dashboard widgets

---

## Phase 9: UI/UX Improvements (PENDING)
- [ ] "GenZ App" aesthetic improvements
- [ ] Better color combinations  
- [ ] Dark mode implementation
- [ ] Modern animations and transitions

---

## Phase 10: Polish & Hardening (PENDING)
- [ ] Dashboard connected to real aggregation service
- [ ] DLQ handling improvements
- [ ] Error handling refinements
- [ ] Performance optimization
- [ ] Documentation updates

---

## Key Implementation Details

### ETL Templates Implemented
1. **Odoo CRM** - ERP/CRM with opportunities, accounts, leads
2. **Salesforce** - Enterprise CRM with opportunities, accounts, contacts
3. **HubSpot** - Marketing + Sales CRM
4. **Pipedrive** - Sales-focused CRM
5. **Zoho CRM** - SMB CRM solution
6. **PostgreSQL/MySQL** - Direct database connections
7. **CSV Import** - File-based import
8. **Demo/Mock Data** - Testing templates

### Bluesheet Probability Factors
- **Stage Progress** (25% weight): 25-100% based on stage
- **Buying Influences** (25% weight): Economic, User, Technical buyers + Coach coverage
- **Competition Status** (25% weight): Sole source to behind competitor
- **Budget Status** (15% weight): Confirmed to unknown
- **Timeline/Activity** (10% weight): Based on activity recency

### RBAC Permissions Structure
- **Administrator**: 55 permissions (full system access)
- **ETL Administrator**: 7 permissions (manage pipelines/connections)
- **Sales Manager**: 11 permissions (sales team management)
- **Sales Representative**: 7 permissions (view/manage own opportunities)

---

## Test Credentials
- Email: test@securado.com
- Password: test123456
- Status: Approved
- Roles: admin

---

## Phase 11: Visual ETL Mapping Editor (COMPLETED ✅)

### Overview
Implemented a comprehensive visual data modeling pipeline that replaces the legacy MappingsPage with an interactive, visual editor for configuring ETL field mappings.

### Backend API Endpoints (COMPLETED)
- ✅ `GET /api/mapping-editor/config` - Get saved mapping configuration
- ✅ `PUT /api/mapping-editor/config` - Save mapping configuration  
- ✅ `POST /api/mapping-editor/preview` - Preview transformation with sample data
- ✅ `POST /api/mapping-editor/sync` - Run ETL sync using visual mappings
- ✅ `GET /api/mapping-editor/sync/status/{connection_id}` - Get sync status
- ✅ `GET /api/mapping-editor/entities` - Get canonical entities from YAML spec

### Frontend Components (COMPLETED)
- ✅ **MappingEditor.js** - Main 3-panel layout editor
- ✅ **SourcePanel.js** - Odoo models with collapsible field lists
- ✅ **TargetPanel.js** - Canonical entities with field details and mapping indicators
- ✅ **RelationshipDiagram.js** - React Flow visualization of entity relationships (10 relationships)
- ✅ **SyncControls.js** - Sync status, run controls, and run history
- ✅ **TransformPreview.js** - Preview dialog showing source → transformed data

### Features
- ✅ Visual source-to-target field mapping interface
- ✅ 9 canonical entities loaded from YAML spec
- ✅ Interactive entity relationship diagram (draggable nodes)
- ✅ Auto-suggest field mappings
- ✅ Preview transformation before sync
- ✅ Sync status dashboard with run history
- ✅ Schedule sync configuration dialog

### Integration
- ✅ Updated App.js to use MappingEditor at `/etl/mappings` route
- ✅ Added 6 new API methods to frontend api.js
- ✅ Registered mapping_editor_router in server.py

---

## Known Issues / Pending Fixes

### P1 - RBAC Role Saving Bug
- **Issue**: User role saving fails on Admin > Users page
- **Status**: Not addressed in this session
- **Debug Plan**: Check updateUserRoles API endpoint and frontend payload

### P2 - Sidebar Scroll Issue
- **Issue**: Settings section may not be scrollable
- **Status**: Verification needed

---

## Technical Notes
- Backend: FastAPI with 11 microservices
- Frontend: React + Shadcn/UI + Tailwind CSS
- Database: MongoDB (app + canonical)
- Event Bus: Redpanda-compatible MongoDB implementation
- Authentication: JWT with refresh tokens
