# Securado CRM Analytics Platform - Product Documentation

**Version:** 2.0.0  
**Release Date:** January 2026  
**Document Type:** Comprehensive Product Guide

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [User Guide](#user-guide)
5. [Admin Guide](#admin-guide)
6. [Technical Reference](#technical-reference)
7. [API Documentation](#api-documentation)
8. [Release Notes](#release-notes)
9. [Future Roadmap](#future-roadmap)
10. [Troubleshooting](#troubleshooting)

---

## 1. Product Overview

### What is Securado CRM Analytics?

Securado CRM Analytics is an enterprise-grade Customer Relationship Management analytics platform that integrates with Odoo ERP to provide:

- **Real-time Sales Analytics** - Track pipeline, win rates, and revenue
- **AI-Powered Insights** - GPT-powered analysis of sales trends
- **Role-Based Access Control (RBAC)** - Granular data permissions synced from Odoo
- **ETL Pipeline Management** - Seamless data synchronization from Odoo
- **Activity Tracking** - Complete visibility into sales activities

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Single Source of Truth** | All CRM data centralized with consistent calculations |
| **Security First** | Row-level security ensures users only see permitted data |
| **Odoo Integration** | Seamless sync of opportunities, accounts, activities, invoices |
| **Reporting Hierarchy** | Managers see their direct reports' data automatically |
| **Real-time Updates** | Event-driven architecture ensures data freshness |

### Target Users

- **Sales Representatives** - Track own opportunities and activities
- **Sales Managers** - Monitor team performance and pipeline
- **Executives** - Company-wide analytics and forecasting
- **System Administrators** - Manage integrations, users, and permissions

---

## 2. Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Dashboard │ │Analytics │ │  RBAC    │ │  Admin   │            │
│  │  Pages   │ │  Charts  │ │ Context  │ │  Pages   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │ API
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (FastAPI)                          │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │   CRM Sales   │ │  AI Analytics │ │  RBAC Sync    │          │
│  │   Service     │ │    Service    │ │   Service     │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │  ETL Runner   │ │ Event Queue   │ │Serving Cache  │          │
│  │   Service     │ │   Worker      │ │   Builder     │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASES                                 │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │  event_mesh   │ │ event_mesh    │ │  serving      │          │
│  │     _app      │ │  _canonical   │ │   _cache      │          │
│  │  (Config)     │ │   (Data)      │ │  (Pre-agg)    │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SYSTEMS                             │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │    Odoo       │ │   OpenAI      │ │   Microsoft   │          │
│  │    (ERP)      │ │   (GPT-5.2)   │ │   (SSO)       │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Database Collections

| Database | Collection | Purpose |
|----------|------------|----------|
| `event_mesh_app` | `users` | Application users |
| `event_mesh_app` | `users_rbac` | Synced Odoo user permissions |
| `event_mesh_app` | `employees_rbac` | Employee hierarchy |
| `event_mesh_app` | `permission_overrides` | Local permission overrides |
| `event_mesh_app` | `connections` | Odoo connection configs |
| `event_mesh_app` | `pipelines` | ETL pipeline definitions |
| `event_mesh_canonical` | `opportunities` | Opportunities & Leads |
| `event_mesh_canonical` | `accounts` | Customer accounts |
| `event_mesh_canonical` | `activities` | Sales activities |
| `event_mesh_canonical` | `invoices` | Invoice records |
| `serving_cache` | `dashboard_kpis` | Pre-computed metrics |

### Security Architecture

```
┌────────────────────────────────────────────────────────┐
│                    REQUEST FLOW                         │
├────────────────────────────────────────────────────────┤
│  1. User Request → JWT Token Validation                 │
│  2. Extract user_name from token                        │
│  3. Check permission_overrides (local overrides first)  │
│  4. Lookup users_rbac (synced Odoo permissions)         │
│  5. Check is_manager + direct_report_names              │
│  6. Generate MongoDB filter based on access level       │
│  7. Apply filter to all data queries                    │
└────────────────────────────────────────────────────────┘
```

---

## 3. Features

### 3.1 Dashboard

**Purpose:** Real-time overview of sales performance

**KPI Cards:**
- Total Pipeline Value (OMR)
- Won Revenue (OMR)
- Win Rate (%)
- Open Opportunities Count
- Activities This Period

**Charts:**
- Pipeline by Stage (Funnel)
- Revenue Trend (Line)
- Win/Loss Analysis (Bar)
- Sales Rep Leaderboard

### 3.2 AI Analytics

**Purpose:** GPT-powered insights and analysis

**Features:**
- Pipeline health analysis
- Sales trend predictions
- Win probability scoring
- Activity recommendations
- Natural language querying

### 3.3 Opportunities

**Purpose:** Manage sales pipeline

**Views:**
- List View (sortable, filterable)
- Kanban View (drag-drop stages)
- Detail View (full opportunity info)

**Fields:**
- Name, Amount, Stage, Probability
- Owner, Account, Expected Close Date
- Activities, Bluesheets, History

### 3.4 Leads

**Purpose:** Track pre-qualified prospects

**Features:**
- Lead capture and qualification
- Lead scoring
- Conversion to Opportunity
- Lead source tracking

### 3.5 Accounts

**Purpose:** Customer account management

**Features:**
- Account hierarchy
- Contact management
- Opportunity history
- Invoice history
- Overdue payment tracking

### 3.6 Activities

**Purpose:** Sales activity tracking

**Activity Types:**
- Calls, Emails, Meetings
- Tasks, Follow-ups
- Custom activities

**Features:**
- Activity timeline
- Linked to opportunities
- Reminder notifications

### 3.7 RBAC Management

**Purpose:** Role-based access control

**Features:**
- Sync users from Odoo
- Sync groups and teams
- Employee hierarchy sync
- Local permission overrides
- Bulk override operations
- Access level testing

---

## 4. User Guide

### 4.1 Getting Started

1. **Login:** Enter your email and password
2. **Dashboard:** View your sales overview
3. **Navigation:** Use left sidebar to access different modules
4. **Filters:** Apply date, owner, team filters to refine data
5. **Export:** Download data as CSV/Excel

### 4.2 Understanding Your Access Level

| Level | What You Can See |
|-------|------------------|
| **ADMIN** | All records across the organization |
| **MANAGER** | Your records + your team + your direct reports |
| **USER** | Only your own records |
| **RESTRICTED** | No data access |

### 4.3 Common Tasks

**View My Opportunities:**
1. Click "Opportunities" in sidebar
2. Filter by "My Opportunities" if needed
3. Click any opportunity to view details

**Track Activities:**
1. Click "Activities" in sidebar
2. View upcoming and overdue tasks
3. Mark activities as complete

**Check My Performance:**
1. Go to Dashboard
2. View your KPIs in the leaderboard
3. Compare against team averages

---

## 5. Admin Guide

### 5.1 Initial Setup

**Step 1: Configure Odoo Connection**
1. Go to ETL Platform → Connections
2. Click "Add Connection"
3. Enter Odoo URL, database, credentials
4. Test connection

**Step 2: Sync RBAC Permissions**
1. Go to Admin → RBAC Sync
2. Select your Odoo connection
3. Click "Sync from Odoo"
4. Verify synced users, groups, teams

**Step 3: Configure ETL Pipelines**
1. Go to ETL Platform → Pipelines
2. Create pipelines for each data type
3. Map Odoo fields to canonical fields
4. Run initial sync

### 5.2 Managing Users

**Invite New User:**
1. Go to Admin → Users
2. Click "Invite User"
3. Enter email and select roles
4. User receives invite email

**Reset Password:**
1. Go to Admin → Users
2. Find user and click "Reset Password"
3. User receives reset email

### 5.3 Permission Overrides

**Grant Temporary Access:**
1. Go to Admin → RBAC Sync
2. Click "Overrides" tab
3. Click "Add Override"
4. Enter user email, access level, expiration
5. Optionally add reason for audit trail

**Bulk Override:**
1. Go to "Users" tab
2. Select multiple users via checkboxes
3. Click "Bulk Override"
4. Set access level for all selected

### 5.4 Microsoft SSO Configuration

1. Go to Admin → Settings
2. Click "SSO" tab
3. Enter Azure AD credentials:
   - Client ID
   - Tenant ID
   - Client Secret
4. Save and test login

### 5.5 Data Quality Monitoring

1. Go to Admin → Data Quality
2. View duplicate records
3. Monitor event queue health
4. Check failed ETL events

---

## 6. Technical Reference

### 6.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Tailwind CSS, Shadcn UI |
| Backend | FastAPI (Python 3.11) |
| Database | MongoDB 6.0 |
| Authentication | JWT, Microsoft MSAL |
| AI | OpenAI GPT-5.2 |
| ETL | Custom XML-RPC integration with Odoo |

### 6.2 Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGO_URL` | MongoDB connection string |
| `JWT_SECRET` | Secret for JWT token signing |
| `EMERGENT_LLM_KEY` | API key for AI features |
| `REACT_APP_BACKEND_URL` | Backend API URL |

### 6.3 Key Files Reference

| File | Purpose |
|------|----------|
| `/app/backend/server.py` | Main FastAPI application |
| `/app/backend/services/crm_sales/routes.py` | CRM API endpoints |
| `/app/backend/services/rbac_sync/access_rules.py` | RBAC filter generation |
| `/app/backend/services/rbac_sync/user_sync.py` | Odoo RBAC sync logic |
| `/app/backend/services/etl_runner/runner.py` | ETL pipeline execution |
| `/app/frontend/src/App.js` | React app routes |
| `/app/frontend/src/lib/RBACContext.js` | Frontend RBAC context |

---

## 7. API Documentation

### 7.1 Authentication

**POST /api/auth/login**
```json
// Request
{"email": "user@example.com", "password": "xxx"}

// Response
{"access_token": "eyJ...", "user": {...}}
```

**POST /api/auth/microsoft/callback**
- Handles Microsoft SSO callback
- Auto-creates user and links to RBAC

### 7.2 Dashboard

**GET /api/dashboard/stats**
- Returns KPI metrics
- RBAC filtered
- Query params: year, quarter, sales_rep

**GET /api/dashboard/product-manager-leaderboard**
- Returns PM performance rankings
- RBAC filtered

### 7.3 Opportunities

**GET /api/opportunities**
- List opportunities (RBAC filtered)
- Query params: year, quarter, stage, owner, limit, skip

**GET /api/opportunities/{id}**
- Get single opportunity
- Includes activities, bluesheets, logs

**GET /api/opportunities/kanban**
- Returns opportunities grouped by stage

### 7.4 RBAC

**GET /api/rbac/my-access**
- Returns current user's access level

**GET /api/rbac/test-filter/{user_name}**
- Test what filter would be applied
- Useful for debugging access

**POST /api/rbac/sync**
- Triggers Odoo RBAC sync
- Syncs users, groups, teams, employees

**GET /api/rbac/overrides**
- List all permission overrides

**POST /api/rbac/overrides**
- Create new permission override

### 7.5 Serving Cache

**GET /api/cache/dashboard-kpis**
- Pre-computed dashboard metrics

**POST /api/cache/refresh**
- Force cache rebuild

---

## 8. Release Notes

### Version 2.0.0 (January 2026)

**Major Features:**
- ✅ Employee Reporting Hierarchy (managers see direct reports)
- ✅ Comprehensive RBAC Enforcement (all endpoints secured)
- ✅ Permission Override System (bulk operations)
- ✅ Microsoft SSO Integration
- ✅ Light Theme UI (consistent design)
- ✅ Leads Management Module
- ✅ Data Quality Monitoring

**Security Fixes:**
- Removed grace period for non-RBAC users
- Added RBAC to all data endpoints
- Fixed data leaks in Leads, Dashboard, AI Analytics

**Bug Fixes:**
- Fixed sidebar scrolling issue
- Fixed null check in user filtering
- Fixed ETL field mapping errors

### Version 1.5.0 (December 2025)

- Serving Cache Architecture
- Event Queue System
- AI Analytics Module

### Version 1.0.0 (October 2025)

- Initial Release
- Basic CRM functionality
- Odoo ETL integration

---

## 9. Future Roadmap

### Q1 2026

| Feature | Priority | Status |
|---------|----------|--------|
| Modular Dashboard Builder | P1 | Planned |
| Custom KPI Cards | P1 | Planned |
| Advanced Forecasting | P2 | Backlog |
| Mobile App | P2 | Backlog |

### Q2 2026

| Feature | Priority | Status |
|---------|----------|--------|
| Email Integration | P1 | Planned |
| Calendar Sync | P1 | Planned |
| Document Management | P2 | Backlog |
| Workflow Automation | P2 | Backlog |

### Q3 2026

| Feature | Priority | Status |
|---------|----------|--------|
| Territory Management | P2 | Backlog |
| Quota Management | P2 | Backlog |
| Advanced Reporting | P1 | Planned |
| API Webhooks | P2 | Backlog |

---

## 10. Troubleshooting

### Common Issues

**Q: User sees no data after login**
- Check RBAC sync status (Admin → RBAC)
- Verify user exists in synced users list
- Test filter using "Test Filter" tab
- Consider adding permission override

**Q: ETL sync fails**
- Check Odoo connection status
- Verify API credentials are valid
- Check field mappings for invalid fields
- Review run logs for specific errors

**Q: SSO login not working**
- Verify Azure AD credentials in Settings
- Check redirect URI matches Azure config
- Ensure user email matches Odoo login

**Q: Data not refreshing**
- Check serving cache status
- Force cache refresh via Admin
- Verify event queue is processing

### Getting Help

1. Check this documentation first
2. Review Admin → System Logs for errors
3. Contact system administrator
4. Submit support ticket if needed

---

**Document Maintained By:** System Team  
**Last Updated:** January 31, 2026  
**Next Review:** March 2026
