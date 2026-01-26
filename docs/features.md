# Securado CRM - Feature Gap Analysis

## Document Purpose
This document tracks the feature parity between the current Securado implementation and the reference codebase (`salescommand-v4-production.zip`). It serves as the backlog for achieving full feature parity.

## Feature Status Legend
- ✅ **IMPLEMENTED** - Feature exists and is working
- ⚠️ **PARTIAL** - Feature exists but is incomplete or needs enhancement
- ❌ **MISSING** - Feature does not exist yet
- 🔧 **IN PROGRESS** - Currently being worked on

---

## 1. Pages & Views

### 1.1 Dashboards
| Feature | Status | Notes |
|---------|--------|-------|
| Main Dashboard | ✅ | DashboardPage.js with stats cards |
| Sales Dashboard (CQRS v2) | ⚠️ | Needs team hierarchy, manager visibility |
| Account Manager Dashboard | ❌ | Role-specific dashboard for account managers |
| Admin Dashboard | ⚠️ | Basic admin present, needs Data Lake health |

### 1.2 CRM Core
| Feature | Status | Notes |
|---------|--------|-------|
| Opportunities List View | ✅ | Table view with filtering |
| Opportunities Kanban Board | ✅ | Drag-drop Kanban with @dnd-kit |
| Opportunity Detail Sheet | ✅ | Side panel with Overview, Bluesheet, Activities, Notes |
| Bluesheet Analysis | ✅ | Miller Heiman probability calculator |
| Accounts List/Card View | ✅ | Card and table views |
| Account 360° View Panel | ❌ | Full customer view with opportunities, activities, contacts |
| Activities Page | ✅ | Activity list and management |
| Activity Timeline | ❌ | Visual timeline of activities across entities |

### 1.3 Planning & Goals
| Feature | Status | Notes |
|---------|--------|-------|
| Goals Page | ✅ | Goal CRUD and tracking |
| Teams Page | ✅ | Team management |
| Portfolios Page | ✅ | Portfolio management |
| Initiatives Page | ✅ | Initiative tracking |
| KPIs Page | ✅ | KPI definition and tracking |
| Target Progress Report | ❌ | Progress visualization against targets |

### 1.4 Finance
| Feature | Status | Notes |
|---------|--------|-------|
| Invoices/Receivables | ❌ | Invoice tracking, aging reports |
| Incentives/Commission | ❌ | Bonus/commission tracking with charts |

### 1.5 Personal Tools
| Feature | Status | Notes |
|---------|--------|-------|
| My Outlook (Email/Calendar) | ❌ | MS365 integration for emails and calendar |
| Profile Page | ❌ | User profile management |

### 1.6 Administration
| Feature | Status | Notes |
|---------|--------|-------|
| User Management | ✅ | UsersPage with role assignment |
| Role Management | ✅ | RolesPage with permissions |
| Department Management | ✅ | DepartmentsPage |
| System Configuration | ❌ | Service lines, pipeline stages, bluesheet weights |
| System Logs | ❌ | Error logs, session logs, API call logs |

### 1.7 ETL/Integrations
| Feature | Status | Notes |
|---------|--------|-------|
| Connections Page | ✅ | Data source connections |
| Mappings Page | ✅ | Field mapping with auto-suggest |
| Pipelines Page | ✅ | ETL pipeline management |
| Runs Page | ✅ | Pipeline run history |
| Data Lake Browser | ✅ | Raw/Canonical/Serving data browsing |
| DLQ Page | ✅ | Dead letter queue management |

---

## 2. Components

### 2.1 Account Components
| Component | Status | Notes |
|-----------|--------|-------|
| Account360Panel | ❌ | 360° view with opportunities, activities, contacts |
| AccountFormBuilder | ❌ | Dynamic form builder for accounts |

### 2.2 Opportunity Components  
| Component | Status | Notes |
|-----------|--------|-------|
| OpportunityDetailPanel | ✅ | Sheet with tabs (Overview, Bluesheet, Activities, Notes) |
| BlueSheet Modal | ✅ | Deal confidence assessment modal |
| BlueSheetConfiguration | ❌ | Admin config for bluesheet weights |

### 2.3 Activity Components
| Component | Status | Notes |
|-----------|--------|-------|
| ActivityDashboard | ❌ | Dashboard widget for activities |
| ActivityDetailCard | ❌ | Detailed activity card view |

### 2.4 Integration Components
| Component | Status | Notes |
|-----------|--------|-------|
| IntegrationHub | ❌ | Main integration management hub |
| OdooIntegrationHub | ❌ | Odoo ERP configuration |
| MS365IntegrationHub | ❌ | Microsoft 365 configuration |
| SalesforceIntegrationHub | ❌ | Salesforce configuration |
| HubSpotIntegrationHub | ❌ | HubSpot configuration |
| VisualDataFlowHub | ❌ | Visual data flow diagram |

### 2.5 Configuration Components
| Component | Status | Notes |
|-----------|--------|-------|
| RoleConfigurationPanel | ❌ | Advanced role configuration |
| SalesTargetsConfiguration | ❌ | Sales target setup |
| IncentiveConfiguration | ❌ | Commission/bonus configuration |

### 2.6 Utility Components
| Component | Status | Notes |
|-----------|--------|-------|
| DataTable | ⚠️ | Has Table component, needs enhanced features |
| KPICard | ❌ | Reusable KPI display card |
| Badge | ✅ | Various badge variants |
| ExpandableContainer | ❌ | Collapsible container component |

---

## 3. API Endpoints

### 3.1 CQRS v2 Dashboard
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /v2/dashboard/ | ❌ | Optimized dashboard data |
| GET /v2/dashboard/opportunities | ❌ | Dashboard opportunities |
| GET /v2/dashboard/users/profile | ❌ | User profile with hierarchy |
| GET /v2/dashboard/users/hierarchy | ❌ | Manager-subordinate hierarchy |

### 3.2 Incentives
| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /incentive-calculator | ❌ | Calculate incentives |
| GET /commission-templates | ❌ | List commission templates |
| POST /commission-templates | ❌ | Create commission template |

### 3.3 Configuration
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /config/service-lines | ❌ | Service line config |
| GET /config/pipeline-stages | ❌ | Pipeline stage config |
| GET /config/bluesheet-weights | ❌ | Bluesheet weight config |
| GET /config/targets | ❌ | Sales targets |
| GET /config/role-targets | ❌ | Role-specific targets |
| GET /config/target-progress-report | ❌ | Progress report data |

### 3.4 Personal
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /my/emails | ❌ | User's emails from MS365 |
| POST /my/emails/sync | ❌ | Sync emails |
| GET /my/calendar | ❌ | User's calendar |
| POST /my/calendar/sync | ❌ | Sync calendar |

### 3.5 AI/ML
| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /ai-mapping/suggest | ❌ | AI-powered field mapping |
| GET /ai-mapping/canonical-schema/{type} | ❌ | Get canonical schema |

### 3.6 Search
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /search | ❌ | Global search across entities |

---

## 4. User Personas

### 4.1 Account Manager
**Key Questions to Answer:**
1. ❌ What opportunities do I need to focus on today?
2. ⚠️ What's the health of my accounts? (Partial - missing 360° view)
3. ❌ Am I on track to hit my targets?
4. ❌ What activities are overdue?

**Missing Features:**
- Target progress dashboard
- Activity prioritization
- Account health scoring with recommendations

### 4.2 Sales Director
**Key Questions to Answer:**
1. ⚠️ How is my team performing? (Needs CQRS v2 dashboard)
2. ❌ Which deals are at risk?
3. ❌ What's our forecast accuracy?
4. ❌ Who needs coaching?

**Missing Features:**
- Team rollup dashboard
- Deal risk analysis
- Forecast vs actual reporting

### 4.3 Finance Manager
**Key Questions to Answer:**
1. ❌ What's our receivables aging?
2. ❌ What commissions are due?
3. ❌ What's the revenue forecast?

**Missing Features:**
- Invoices/Receivables page
- Commission calculation
- Revenue reporting

### 4.4 CEO/Executive
**Key Questions to Answer:**
1. ⚠️ What's our pipeline health? (Basic stats present)
2. ❌ How are departments performing?
3. ❌ What are the key risks?
4. ❌ What's our win rate trend?

**Missing Features:**
- Executive dashboard
- Department rollup
- Trend analysis

---

## 5. Priority Backlog

### P0 - Critical (Blocking Users)
1. ✅ Fix Kanban View (Verified - code exists, was never broken)
2. ✅ Fix org_id KeyError on login

### P1 - High Priority (Core Feature Parity)
1. ❌ Account 360° View Panel
2. ❌ Target Progress Report Page
3. ❌ CQRS v2 Dashboard endpoints
4. ❌ Invoices/Receivables Page
5. ❌ Profile Page
6. ❌ Activity Timeline Page

### P2 - Medium Priority (Enhanced Features)
1. ❌ Incentives/Commission Page
2. ❌ Integration Hub Components (Odoo, MS365, Salesforce, HubSpot)
3. ❌ System Configuration Page
4. ❌ System Logs Page
5. ❌ Global Search

### P3 - Nice to Have (Polish)
1. ❌ Visual Data Flow Hub
2. ❌ AI-powered field mapping suggestions
3. ❌ Advanced role configuration
4. ❌ KPI Cards/Dashboard widgets

---

## 6. Third-Party Integrations

| Integration | Status | Priority |
|-------------|--------|----------|
| MongoDB | ✅ | - |
| Redpanda/Kafka | ✅ | - |
| Odoo ERP | ❌ | P2 |
| Microsoft 365 | ❌ | P2 |
| Salesforce | ❌ | P3 |
| HubSpot | ❌ | P3 |

---

## 7. Change Log

| Date | Changes |
|------|---------|
| 2026-01-26 | Initial feature gap analysis completed |
| 2026-01-26 | Fixed org_id KeyError in identity routes |
| 2026-01-26 | Verified Kanban view code exists (was not a regression) |

---

## Notes

1. The "Kanban view regression" reported by user was investigated - the code is intact in OpportunitiesPage.js with @dnd-kit implementation. The feature exists.

2. The old codebase uses many more API endpoints for advanced features like CQRS v2, incentive calculation, and target tracking that don't exist in the current implementation.

3. User personas highlight key gaps: Account Managers and Sales Directors need better dashboards, Finance needs invoicing, and CEOs need executive views.
