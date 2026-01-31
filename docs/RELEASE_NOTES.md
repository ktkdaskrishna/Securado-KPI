# Securado CRM - Release Notes

---

## Version 2.0.0 (January 31, 2026)

### 🎉 Major Release - Security & Hierarchy

This release focuses on comprehensive security hardening and organizational hierarchy support.

---

### ✨ New Features

#### Employee Reporting Hierarchy
- **What:** Managers now automatically see their direct reports' data
- **How:** Synced from Odoo's `hr.employee` model (parent_id/child_ids)
- **Benefit:** No manual permission setup needed - hierarchy drives access

#### Permission Override System
- **What:** Admins can grant/restrict access locally
- **Features:**
  - Single user overrides
  - Bulk override operations
  - Expiration dates
  - Audit trail (reason field)
  - Activate/deactivate toggle

#### Microsoft SSO Integration
- **What:** Users can login with Microsoft accounts
- **Setup:** Configure Azure AD credentials in Settings
- **Auto-link:** Users matched to Odoo by email

#### Leads Management Module
- **What:** Dedicated section for lead tracking
- **Views:** List, Kanban, Stats
- **Feature:** Lead to Opportunity conversion

#### Light Theme UI
- **What:** Consistent design across all pages
- **Style:** White cards, gray text hierarchy, maroon accents

---

### 🔒 Security Fixes

#### Critical: Data Leak Prevention

**Before v2.0:**
- Users not in RBAC could see "own records" (matched by name)
- Several API endpoints missing RBAC filters

**After v2.0:**
- Users not in RBAC see **NO DATA** (deny by default)
- All 40+ data endpoints now enforce RBAC

**Endpoints Secured:**
| Category | Endpoints Fixed |
|----------|----------------|
| Dashboard | stats, leaderboards, category-stats |
| Opportunities | list, kanban, export, won-with-invoices |
| Leads | list, stats, kanban, get, convert |
| AI Analytics | All endpoints |
| Activities | list, stats |
| Accounts | list, overdue |
| Invoices | list |

---

### 🐛 Bug Fixes

| Issue | Fix |
|-------|-----|
| Sidebar not scrolling | Fixed height constraints |
| Null check error in RBAC page | Added safe string handling |
| ETL field mapping errors | Updated Odoo field names |
| opportunity_number not syncing | Fixed field mapping, ran backfill |

---

### 📊 Technical Improvements

#### RBAC Sync Enhancements
- Now syncs `employees_rbac` collection
- Captures `parent_id`, `child_ids`, `department_id`
- Stores `direct_report_names` for easy access

#### Access Rule Engine Updates
```python
# New: Managers with direct reports get MANAGER access
if is_manager and access_level < MANAGER:
    access_level = MANAGER

# New: Manager filter includes direct reports
filter = {
    "$or": [
        {"owner_name": user},
        {"owner_name": {"$in": direct_reports}},
        {"team_name": {"$in": teams}}
    ]
}
```

---

### 📁 Files Changed

**Backend:**
- `/app/backend/services/rbac_sync/user_sync.py` - Added employee sync
- `/app/backend/services/rbac_sync/access_rules.py` - Hierarchy support
- `/app/backend/services/rbac_sync/routes.py` - Override CRUD endpoints
- `/app/backend/services/crm_sales/routes.py` - Leads RBAC
- `/app/backend/services/ai_analytics/routes.py` - RBAC fixes
- `/app/backend/services/dashboard_agg/routes.py` - RBAC fixes

**Frontend:**
- `/app/frontend/src/components/admin/RBACManagementPage.js` - Complete rewrite
- `/app/frontend/src/components/admin/SettingsPage.js` - SSO tab
- `/app/frontend/src/components/auth/LoginPage.js` - Microsoft button
- `/app/frontend/src/lib/api.js` - Override API functions

---

### 🔄 Migration Notes

**Required Actions:**
1. Run RBAC sync after upgrade (`Admin → RBAC Sync → Sync from Odoo`)
2. Verify employee hierarchy synced (check users with direct_report_names)
3. Review existing users - they may get different access levels

**Breaking Changes:**
- Users not in Odoo RBAC now see NO data (previously saw own records)
- To grant access: Add user to Odoo OR create permission override

---

### 📈 Metrics

- Endpoints secured: 40+
- Lines of code changed: ~2,500
- New collections: 2 (employees_rbac, permission_overrides)
- Security vulnerabilities fixed: 12

---

## Version 1.5.0 (December 2025)

### Features
- Serving Cache Architecture
- Event Queue System
- AI Analytics Module (GPT-5.2 integration)
- Data Quality Dashboard

### Improvements
- Cache-based dashboard rendering
- 5-minute TTL with auto-refresh
- Event-driven data updates

---

## Version 1.0.0 (October 2025)

### Initial Release

**Core Features:**
- Odoo ETL Integration
- Opportunity Management
- Account Management
- Activity Tracking
- Basic Dashboard
- User Authentication (JWT)

**Technical Stack:**
- React 18 Frontend
- FastAPI Backend
- MongoDB Database
- Tailwind CSS + Shadcn UI

---

## Upgrade Path

| From | To | Notes |
|------|----|---------|
| 1.0 | 1.5 | Run full ETL sync |
| 1.5 | 2.0 | Run RBAC sync, review access |

---

**Document Version:** 2.0.0  
**Last Updated:** January 31, 2026
