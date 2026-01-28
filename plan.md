# CRM KPI Management Platform - Development Plan

## Current Session - Bug Fixes & System Improvements (COMPLETED)

### Issues Fixed

#### 1. Sidebar Navigation Not Showing Items ✅ (CRITICAL FIX)
**Problem:** Sidebar only showed "My Profile" instead of full navigation menu.

**Root Causes Found:**
1. RBACContext fetched permissions on mount (before user logged in), got empty array
2. After login, RBACContext never re-fetched permissions
3. Sidebar's `getVisibleItems` was filtering out items due to empty permissions

**Solution:**
- Added event listener in RBACContext to refresh permissions on `userLoggedIn` custom event
- Modified auth.js to dispatch `userLoggedIn` event after successful login
- Used `useCallback` in Sidebar to properly depend on permissions changes

**Result:** All sidebar items now visible (Dashboard, AI Analytics, Opportunities, Leads, Accounts, Activities, Timeline, Invoices, etc.)

#### 2. Odoo Webhook Auto-Setup ✅ (Previously Fixed)
- Used Odoo 17's built-in `state='webhook'` for server actions
- 12 automated actions successfully created in Odoo

### New Features Added

#### 3. System Logs & Alerts Page ✅ (NEW)
**Location:** `/admin/logs`

**Features:**
- System status monitoring (Backend, Database health)
- Active alerts panel with severity levels
- Activity logs with filtering and search
- Real-time status polling (30 second intervals)
- Clear all alerts functionality

**Components:**
- Status cards for Backend/Database/LastSync/ActiveAlerts
- Tabs for Alerts and Logs
- Search and filter controls

---

## Previous Session - RBAC & Webhook Implementation (COMPLETED)
**Changes:**
- ETL Runner now filters `res.users` to `active=True` only
- ETL Runner now filters `res.partner` (accounts) to `active=True` only
- `crm.lead` (opportunities) still syncs archived records for Lost deals

**Result:** 70 active users synced (down from 140 total)

#### 2. Odoo RBAC Sync ✅
**New Endpoints:**
- `POST /api/odoo-rbac/sync-groups` - Syncs all 159 Odoo user groups
- `POST /api/odoo-rbac/sync-users` - Syncs active users with their group memberships
- `GET /api/odoo-rbac/current-user-rbac` - Get current user's permissions
- `GET /api/odoo-rbac/user-permissions/{user_id}` - Get specific user's permissions

**Permission Levels:**
| Level | Access |
|-------|--------|
| Page/Menu | Based on role (sales_admin, sales_director, sales_user_all, sales_user_own, crm_readonly) |
| Record | "all" - see all records, "own" - only own records |
| Field | "all" - all fields, "standard" - basic fields, "limited" - minimal fields |

**Odoo Group Mapping:**
- Sales / Administrator (ID 14) → `sales_admin` (all access)
- CRM / Sales Director (ID 448) → `sales_director` (all access)
- Sales / User: All Documents (ID 13) → `sales_user_all` (all records, standard fields)
- Sales / User: Own Documents (ID 12) → `sales_user_own` (own records only)
- Sales / Non sales / CRM Readonly (ID 449) → `crm_readonly` (view only, limited fields)
- Administration / Access Rights (ID 2) → `admin` (full access)

**Hidden Fields by Access Level:**
- `all`: None
- `standard`: `expected_revenue`, `margin`, `cost`
- `limited`: `sale_value`, `expected_revenue`, `margin`, `cost`, `commission`, `probability`

#### 3. Webhook Integration for Real-time Sync ✅
**New Endpoint:**
- `POST /api/webhooks/odoo` - Receives webhook notifications from Odoo
- `GET /api/webhooks/setup-instructions` - Returns setup guide for Odoo

**Supported Events:**
- `create` - New record created in Odoo
- `write` - Record updated in Odoo
- `unlink` - Record deleted/archived in Odoo

**Supported Models:**
- `crm.lead` → `opportunities` collection
- `res.partner` → `accounts` collection
- `res.users` → `sales_users` collection
- `account.move` → `invoices` collection
- `mail.activity` → `activities` collection

**Deletion Handling:** Soft delete (marks `deleted=True` and `active=False`)

#### 4. Frontend RBAC Context ✅
**New File:** `/app/frontend/src/lib/RBACContext.js`

**Features:**
- `useRBAC()` hook for accessing permissions
- `hasPermission(permission)` - Check single permission
- `hasAnyPermission([permissions])` - Check multiple permissions
- `hasRole(role)` - Check role
- `canSeeField(fieldName)` - Check field visibility
- `canAccessAllRecords()` - Check record access level
- `filterHiddenFields(record)` - Remove hidden fields from record
- `<RequirePermission permission="...">` - Component wrapper
- `<RequireRole role="...">` - Component wrapper

---

## Files Created/Modified

### Backend:
- **NEW** `/app/backend/services/odoo_rbac/routes.py` - RBAC sync and webhook endpoints
- **NEW** `/app/backend/services/odoo_rbac/__init__.py`
- **NEW** `/app/backend/libs/rbac_middleware.py` - RBAC enforcement middleware
- `/app/backend/services/etl_runner/runner.py` - Updated to filter active users/accounts
- `/app/backend/server.py` - Added RBAC and webhook routers

### Frontend:
- **NEW** `/app/frontend/src/lib/RBACContext.js` - RBAC context and hooks
- `/app/frontend/src/lib/api.js` - Added RBAC API calls
- `/app/frontend/src/App.js` - Added RBACProvider

---

## How to Use

### 1. Initial Sync
```bash
# Sync groups first
curl -X POST /api/odoo-rbac/sync-groups

# Then sync users with their permissions
curl -X POST /api/odoo-rbac/sync-users
```

### 2. Get User Permissions
```javascript
// In React component
import { useRBAC } from '../lib/RBACContext';

function MyComponent() {
  const { hasPermission, canSeeField } = useRBAC();
  
  if (!hasPermission('view_opportunities')) {
    return <AccessDenied />;
  }
  
  return (
    <div>
      {canSeeField('sale_value') && <span>{opportunity.sale_value}</span>}
    </div>
  );
}
```

### 3. Setup Odoo Webhooks
1. Enable Developer Mode in Odoo
2. Go to Settings > Technical > Automation > Automated Actions
3. Create actions for each model (crm.lead, res.partner, etc.)
4. Configure to POST to `https://your-app/api/webhooks/odoo`

---

## Test Credentials
- Email: test@securado.com
- Password: test123456

## Preview URL
https://odoo-connect.preview.emergentagent.com
