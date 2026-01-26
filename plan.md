# Event Mesh CRM — Unified Microservices Platform - Development Plan

## Project Overview
Unified microservices platform combining ETL, CRM backend, and CRM frontend with event-driven architecture.

---

## Phase 1: Core Infrastructure (COMPLETED)
- ✅ Backend microservices setup (11 services)
- ✅ MongoDB connection and data models
- ✅ Event bus implementation
- ✅ Authentication and JWT token system
- ✅ Basic RBAC foundation

---

## Phase 2: Frontend Assembly (COMPLETED)
- ✅ React app with routing
- ✅ Shadcn UI components integration
- ✅ Login/Registration pages
- ✅ Dashboard layout
- ✅ CRM pages (Opportunities, Accounts, Activities)
- ✅ ETL pages (Connections, Mappings, Pipelines)
- ✅ Admin pages (Users, Roles)

---

## Phase 3: Advanced Features (IN PROGRESS)
### ETL Enhancements
- ✅ Integration Templates with pre-built connectors (Odoo, Salesforce, HubSpot, etc.)
- ✅ Template-based connection creation
- ✅ Auto-suggest field mappings API
- ✅ Schema verification endpoint
- ✅ Frontend UI for templates
- ✅ Frontend UI for auto-mapping
- ✅ Frontend UI for schema verification

### CRM Enhancements
- ✅ Bluesheet probability calculation API
- ✅ Bluesheet form with buying influences, competition/budget status
- ✅ Notes CRUD under Opportunities
- ✅ Activities stream under Opportunities
- ✅ Opportunity detail sheet with tabs (Overview, Bluesheet, Activities, Notes)
- ✅ Frontend UI for Bluesheet assessment
- ✅ Frontend UI for Notes/Messages

### RBAC Enhancements
- ✅ Granular permissions already defined (33 permissions across 9 resources)
- ✅ User role assignment UI
- ✅ Update user roles API endpoint
- ✅ Roles management with permission assignment

---

## Phase 4: Testing & Validation (PENDING)
- [ ] End-to-end testing of ETL workflow
- [ ] End-to-end testing of CRM workflow
- [ ] End-to-end testing of RBAC workflow
- [ ] API endpoint validation
- [ ] Frontend UI validation

---

## Phase 5: Polish & Hardening (PENDING)
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
4. **Zoho CRM** - SMB CRM solution
5. **PostgreSQL/MySQL** - Direct database connections
6. **REST API** - Generic webhook/API integrations

### Bluesheet Probability Factors
- **Stage Progress** (25% weight): 25-100% based on stage
- **Buying Influences** (25% weight): Economic, User, Technical buyers + Coach coverage
- **Competition Status** (25% weight): Sole source to behind competitor
- **Budget Status** (15% weight): Confirmed to unknown
- **Timeline/Activity** (10% weight): Based on activity recency

### RBAC Permissions Structure
Resources: users, roles, pipelines, connections, mappings, opportunities, accounts, activities, dashboard
Actions: view, manage, run, approve

---

## Technical Notes
- Backend: FastAPI with 11 microservices
- Frontend: React + Shadcn/UI + Tailwind CSS
- Database: MongoDB (app + canonical)
- Event Bus: Redpanda-compatible MongoDB implementation
- Authentication: JWT with refresh tokens
