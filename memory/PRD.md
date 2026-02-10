# Securado CRM - PRD (Updated Feb 10, 2026)

## Framework: Securado Enterprise KPI Framework
Strategy → Activity → Revenue → Delivery → Cash → Capability

## Current Implementation Status

### Fully Implemented (✅)
- Performance Hub with 7 role-based tabs + CEO RAG Summary
- Auto-generated activity suggestions from PD historical data
- Revenue cap rule (activity < 80% → revenue capped at 70%)
- CEO Executive Summary (5 RAG signals + auto-insight)
- RBAC with canonical name resolution (multi-name pattern matching)
- 12 roles defined (Admin, ETL Admin, Sales Manager, Sales Rep, Sales Director, Product Director, System Admin, Finance, Marketing, Strategy, Operations, Support)
- Advanced Filter Builder (Notion-style) with saved presets
- Alert Center (6 alert types)
- Organization Structure (Org Tree, Departments, Employees)
- Global PD + Category filters across all pages
- AI Analytics conversion rate fixed (65.6% Win Rate)
- Bluesheet Won = 100%
- Opportunities pagination (1039 total)
- Backend ETL RBAC protection (403 for non-admins)

### Phase 2 (Ready to Build)
- Collection Escalation Workflow (Day 0→30→45→60 ladder)
- SD Scorecard (3 KPIs: Team Revenue 40% + Activity 30% + Collections 30%)
- DSO Calculation
- Finance KPIs (invoicing timeliness, costing approval)

### Phase 3 (Needs Additional Odoo Data)
- Gross Margin % (needs cost/COGS data)
- Billable Utilization % (needs timesheet/man-days)
- Delivery cost vs planned (needs project costing)
- Costing sheet validation workflow

### Roles Coverage
| Role | Performance Hub Tabs | Data Scope |
|------|---------------------|-----------|
| CEO/Admin | CEO View, PM Builder, SD, Activities, Collection, Incentive | All data |
| Sales Director | CEO View, PM Builder, SD, Activities, Collection, Incentive | All CRM data |
| Product Director | My Plan, My Team, Activities, Collection, Incentive | PM-scoped |
| Sales Rep | My Targets, Activities, Collection | Own data only |
| Finance | Collection | Invoice-scoped |
| Marketing | (to be built) | Leads/campaigns |
| Strategy | (to be built) | New logos |
| Operations | (to be built) | Delivery tasks |

## Key Files
- `/app/backend/services/target_management/planning.py` - Planning APIs + CEO Summary + Revenue Cap
- `/app/backend/services/rbac_sync/access_rules.py` - RBAC with canonical name resolution
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Main UI
- `/app/docs/BEHAVIOR_ENFORCEMENT_PLAN.md` - Full enforcement system design
- `/app/docs/PERFORMANCE_HUB_SUMMARY.md` - Complete configuration doc
