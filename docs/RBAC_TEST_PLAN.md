# CRM RBAC Test Plan
## For Claude Bot with Chrome Extension UI Access

**Application URL**: https://layout-manager-1.preview.emergentagent.com
**Test Date**: February 2026
**Version**: 1.0

---

## Table of Contents
1. [Test Users & Credentials](#test-users--credentials)
2. [Role Permission Matrix](#role-permission-matrix)
3. [Test Scenarios](#test-scenarios)
   - [Scenario 1: System Admin (Krishna)](#scenario-1-system-admin-krishna)
   - [Scenario 2: Sales User (Own Records)](#scenario-2-sales-user-own-records)
   - [Scenario 3: Sales Director (All Records)](#scenario-3-sales-director-all-records)
   - [Scenario 4: Finance Manager](#scenario-4-finance-manager)
   - [Scenario 5: Presales Engineer](#scenario-5-presales-engineer)
   - [Scenario 6: Product Director](#scenario-6-product-director)
4. [Negative Test Cases](#negative-test-cases)
5. [Data Validation Tests](#data-validation-tests)
6. [Expected Screenshots](#expected-screenshots)

---

## Test Users & Credentials

| Role | Email | Password | Record Access | ETL Access |
|------|-------|----------|---------------|------------|
| **System Admin** | `krishna@securado.net` | `test123456` | All | ✅ Yes |
| **CEO** | `ceo@test.securado.com` | `test123456` | All | ❌ No |
| **Sales User** | `sales@test.securado.com` | `test123456` | Own Only | ❌ No |
| **Sales Director** | `sales.director@test.securado.com` | `test123456` | All | ❌ No |
| **Product Director** | `product.director@test.securado.com` | `test123456` | All | ❌ No |
| **Presales Engineer** | `presales@test.securado.com` | `test123456` | All | ❌ No |
| **Finance Manager** | `finance@test.securado.com` | `test123456` | All (Invoices) | ❌ No |

---

## Role Permission Matrix

### Sidebar Menu Visibility

| Menu Item | System Admin | CEO | Sales Director | Sales User | Finance | Presales |
|-----------|--------------|-----|----------------|------------|---------|----------|
| **CRM PLATFORM** |
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Analytics | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Opportunities | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Leads | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Accounts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Activities | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Timeline | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Invoices | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Goals | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| My Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ETL PLATFORM** |
| Connections | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Model Browser | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mappings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Data Model | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pipelines | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **ADMIN** |
| Users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| RBAC Sync | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Help & Support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Test Scenarios

### Scenario 1: System Admin (Krishna)

**User**: `krishna@securado.net` / `test123456`
**Expected Access**: Full system access including ETL Platform

#### Test Steps:

```
STEP 1: Login
- Navigate to: https://layout-manager-1.preview.emergentagent.com
- Enter email: krishna@securado.net
- Enter password: test123456
- Click "Sign in" button
- EXPECTED: Redirect to Dashboard

STEP 2: Verify Sidebar - CRM Platform Section
- VERIFY: "CRM Platform" header visible
- VERIFY: Dashboard link visible and clickable
- VERIFY: AI Analytics link visible
- VERIFY: Opportunities link visible
- VERIFY: Leads link visible
- VERIFY: Accounts link visible
- VERIFY: Activities link visible
- VERIFY: Timeline link visible
- VERIFY: Invoices link visible
- VERIFY: Goals link visible (may be hidden by default, check nav settings)
- VERIFY: My Profile link visible

STEP 3: Verify Sidebar - ETL Platform Section (CRITICAL)
- VERIFY: "ETL Platform" header visible
- VERIFY: Connections link visible
- VERIFY: Model Browser link visible
- VERIFY: Mappings link visible
- VERIFY: Data Model link visible
- VERIFY: Pipelines link visible
- TAKE SCREENSHOT: Full sidebar showing ETL Platform

STEP 4: Verify Sidebar - Admin Section
- VERIFY: "Admin" header visible
- VERIFY: Users link visible
- VERIFY: Roles link visible
- VERIFY: RBAC Sync link visible
- VERIFY: Settings link visible
- VERIFY: Help & Support link visible

STEP 5: Test Dashboard Data
- Click Dashboard
- VERIFY: Opportunity count displayed (should show total count)
- VERIFY: Pipeline by Stage chart visible with data
- VERIFY: Sales Leaderboard visible with all salespeople
- VERIFY: No "Access Denied" messages
- TAKE SCREENSHOT: Dashboard with data

STEP 6: Test Invoices Access
- Click Invoices in sidebar
- VERIFY: Invoices page loads
- VERIFY: Total Invoiced amount displayed
- VERIFY: Invoice list table visible with data
- VERIFY: Can see invoices from ALL salespeople
- TAKE SCREENSHOT: Invoices page

STEP 7: Test ETL Platform Access
- Click Connections in sidebar
- VERIFY: Connections page loads (no 403 error)
- VERIFY: Odoo connection visible (if configured)
- Click Pipelines in sidebar
- VERIFY: Pipelines page loads
- TAKE SCREENSHOT: ETL Connections page

STEP 8: Test Admin Section
- Click Users in Admin section
- VERIFY: Users management page loads
- VERIFY: User list visible
- Click Settings
- VERIFY: Settings page loads
- TAKE SCREENSHOT: Admin Users page
```

#### Expected Results:
- ✅ Can see ALL sidebar sections (CRM, ETL, Admin)
- ✅ Dashboard shows ALL data (not filtered)
- ✅ Can access ETL Platform pages
- ✅ Can access Admin pages
- ✅ Invoice count: ~300+ invoices visible



---

### Scenario 1B: CEO (Executive - Full CRM, No ETL)

**User**: `ceo@test.securado.com` / `test123456`
**Expected Access**: Full CRM access (all data), NO ETL Platform access

#### Test Steps:

```
STEP 1: Login
- Navigate to: https://layout-manager-1.preview.emergentagent.com
- Enter email: ceo@test.securado.com
- Enter password: test123456
- Click "Sign in" button
- EXPECTED: Redirect to Dashboard

STEP 2: Verify Sidebar - FULL CRM Access
- VERIFY: "CRM Platform" header visible
- VERIFY: Dashboard link visible
- VERIFY: AI Analytics link visible
- VERIFY: Opportunities link visible
- VERIFY: Leads link visible
- VERIFY: Accounts link visible
- VERIFY: Activities link visible
- VERIFY: Timeline link visible
- VERIFY: Invoices link visible
- VERIFY: Goals link visible
- VERIFY: My Profile link visible
- TAKE SCREENSHOT: CEO sidebar

STEP 3: Verify NO ETL Platform Section (CRITICAL FOR CEO)
- VERIFY: "ETL Platform" header NOT visible
- VERIFY: Connections link NOT visible
- VERIFY: Model Browser link NOT visible
- VERIFY: Mappings link NOT visible
- VERIFY: Data Model link NOT visible
- VERIFY: Pipelines link NOT visible
- TAKE SCREENSHOT: CEO sidebar showing NO ETL section

STEP 4: Verify NO Admin Section
- VERIFY: Users link NOT visible
- VERIFY: Roles link NOT visible
- VERIFY: Settings link NOT visible
- VERIFY: Only "Help & Support" visible in Admin area

STEP 5: Test Dashboard - ALL Company Data
- Click Dashboard
- VERIFY: Dashboard loads with full company metrics
- VERIFY: Total opportunity count (all records ~1350+)
- VERIFY: Pipeline by Stage chart shows all data
- VERIFY: Sales Leaderboard shows ALL salespeople
- TAKE SCREENSHOT: CEO Dashboard with full data

STEP 6: Test Opportunities - ALL Records
- Click Opportunities in sidebar
- VERIFY: Shows ALL opportunities (~1350+ records)
- VERIFY: Can see opportunities from ALL salespeople
- VERIFY: Can view opportunity details
- TAKE SCREENSHOT: CEO Opportunities view

STEP 7: Test Invoices - ALL Records
- Click Invoices in sidebar
- VERIFY: Invoices page loads
- VERIFY: Total Invoiced amount (~3M+ OMR)
- VERIFY: All invoices visible
- VERIFY: Can filter by different salespeople
- TAKE SCREENSHOT: CEO Invoices view

STEP 8: Test AI Analytics
- Click AI Analytics
- VERIFY: Analytics page loads
- VERIFY: Company-wide analytics visible
- TAKE SCREENSHOT: CEO Analytics view

STEP 9: Negative Test - ETL Access Attempt
- Manually navigate to: /etl/connections
- VERIFY: Access denied OR empty page OR redirect
- Manually navigate to: /admin/settings
- VERIFY: Access denied OR empty page OR redirect
- TAKE SCREENSHOT: Access denied for CEO
```

#### Expected Results:
- ✅ Full CRM Platform access (all menu items)
- ✅ Dashboard shows ALL company data (not filtered)
- ✅ Can see ALL opportunities (~1350+)
- ✅ Can see ALL invoices (~300+)
- ✅ Can access AI Analytics
- ❌ Cannot see ETL Platform section
- ❌ Cannot access ETL pages via direct URL
- ❌ Cannot see Admin section (except Help)
---

### Scenario 2: Sales User (Own Records)

**User**: `sales@test.securado.com` / `test123456`
**Expected Access**: Own records only, NO ETL access

#### Test Steps:

```
STEP 1: Login
- Navigate to: https://layout-manager-1.preview.emergentagent.com
- Enter email: sales@test.securado.com
- Enter password: test123456
- Click "Sign in" button
- EXPECTED: Redirect to Dashboard

STEP 2: Verify Sidebar - LIMITED Menu
- VERIFY: "CRM Platform" header visible
- VERIFY: Dashboard link visible
- VERIFY: Opportunities link visible
- VERIFY: Leads link visible
- VERIFY: Accounts link visible
- VERIFY: Activities link visible
- VERIFY: Timeline link visible
- VERIFY: Goals link visible
- VERIFY: My Profile link visible
- VERIFY: AI Analytics NOT visible (no view_analytics permission)
- VERIFY: Invoices NOT visible (no view_invoices permission)
- TAKE SCREENSHOT: Sales User sidebar

STEP 3: Verify NO ETL Platform Section (CRITICAL)
- VERIFY: "ETL Platform" header NOT visible
- VERIFY: Connections link NOT visible
- VERIFY: Mappings link NOT visible
- VERIFY: Pipelines link NOT visible
- TAKE SCREENSHOT: Sidebar showing NO ETL section

STEP 4: Verify NO Admin Section (except Help)
- VERIFY: Users link NOT visible
- VERIFY: Roles link NOT visible
- VERIFY: Settings link NOT visible
- VERIFY: Only "Help & Support" may be visible

STEP 5: Test Opportunities - Own Records Only
- Click Opportunities in sidebar
- VERIFY: Opportunities page loads
- VERIFY: ONLY shows opportunities owned by "Test Sales User"
- VERIFY: Cannot see opportunities from other salespeople
- COUNT: Should see approximately 10 opportunities (test data)
- TAKE SCREENSHOT: Opportunities filtered to own

STEP 6: Test Dashboard Data
- Click Dashboard
- VERIFY: Dashboard loads
- VERIFY: Shows only OWN metrics
- VERIFY: Pipeline chart may show limited data
- TAKE SCREENSHOT: Dashboard for Sales User

STEP 7: Attempt Direct URL Access to ETL (Negative Test)
- Manually navigate to: /etl/connections
- VERIFY: Access denied OR redirected
- Manually navigate to: /etl/pipelines
- VERIFY: Access denied OR redirected
- TAKE SCREENSHOT: Access denied page (if shown)
```

#### Expected Results:
- ✅ Can see CRM Platform menu items (limited)
- ❌ Cannot see ETL Platform section
- ❌ Cannot see Admin section (except Help)
- ✅ Opportunities filtered to OWN records only (~10 test records)
- ❌ Cannot access ETL pages via direct URL

---

### Scenario 3: Sales Director (All Records)

**User**: `sales.director@test.securado.com` / `test123456`
**Expected Access**: All CRM records, NO ETL access

#### Test Steps:

```
STEP 1: Login
- Navigate to: https://layout-manager-1.preview.emergentagent.com
- Enter email: sales.director@test.securado.com
- Enter password: test123456
- Click "Sign in" button
- EXPECTED: Redirect to Dashboard

STEP 2: Verify Sidebar - FULL CRM Access
- VERIFY: "CRM Platform" header visible
- VERIFY: Dashboard link visible
- VERIFY: AI Analytics link visible
- VERIFY: Opportunities link visible
- VERIFY: Leads link visible
- VERIFY: Accounts link visible
- VERIFY: Activities link visible
- VERIFY: Timeline link visible
- VERIFY: Invoices link visible
- VERIFY: Goals link visible
- VERIFY: My Profile link visible
- TAKE SCREENSHOT: Sales Director sidebar

STEP 3: Verify NO ETL Platform Section (CRITICAL)
- VERIFY: "ETL Platform" header NOT visible
- VERIFY: No Connections, Mappings, Pipelines links
- TAKE SCREENSHOT: Sidebar showing NO ETL section

STEP 4: Test Opportunities - ALL Records
- Click Opportunities in sidebar
- VERIFY: Opportunities page loads
- VERIFY: Shows ALL opportunities (not filtered)
- VERIFY: Can see opportunities from ALL salespeople
- COUNT: Should see 50+ opportunities (all test + real data)
- VERIFY: Can see owner names from different users
- TAKE SCREENSHOT: Opportunities showing ALL records

STEP 5: Test Invoices - ALL Records
- Click Invoices in sidebar
- VERIFY: Invoices page loads
- VERIFY: Total Invoiced amount displayed (should be ~3M+ OMR)
- VERIFY: Invoice list shows ALL invoices
- VERIFY: Can filter by different salespeople
- TAKE SCREENSHOT: Invoices page with full data

STEP 6: Test AI Analytics
- Click AI Analytics in sidebar
- VERIFY: Analytics page loads
- VERIFY: Can see company-wide analytics
- TAKE SCREENSHOT: AI Analytics page

STEP 7: Test Dashboard - ALL Metrics
- Click Dashboard
- VERIFY: Shows total opportunity count (all records)
- VERIFY: Pipeline chart shows all stages
- VERIFY: Sales Leaderboard shows ALL salespeople
- TAKE SCREENSHOT: Full Dashboard

STEP 8: Negative Test - ETL Access
- Manually navigate to: /etl/connections
- VERIFY: Access denied OR empty page
- VERIFY: Cannot access ETL functionality
```

#### Expected Results:
- ✅ Full CRM Platform access
- ✅ Can see ALL opportunities (~1300+ total)
- ✅ Can see ALL invoices (~300+ total)
- ✅ Can see AI Analytics
- ❌ Cannot see or access ETL Platform
- ❌ Cannot see Admin section (except Help)

---

### Scenario 4: Finance Manager

**User**: `finance@test.securado.com` / `test123456`
**Expected Access**: Invoices & Accounts only, NO sales data

#### Test Steps:

```
STEP 1: Login
- Navigate to: https://layout-manager-1.preview.emergentagent.com
- Enter email: finance@test.securado.com
- Enter password: test123456
- Click "Sign in" button
- EXPECTED: Redirect to Dashboard

STEP 2: Verify Sidebar - FINANCE-SPECIFIC Menu
- VERIFY: "CRM Platform" header visible
- VERIFY: Dashboard link visible
- VERIFY: AI Analytics link visible
- VERIFY: Accounts link visible
- VERIFY: Invoices link visible
- VERIFY: My Profile link visible
- VERIFY: Opportunities NOT visible
- VERIFY: Leads NOT visible
- VERIFY: Activities NOT visible
- VERIFY: Timeline NOT visible
- VERIFY: Goals NOT visible
- TAKE SCREENSHOT: Finance Manager sidebar

STEP 3: Verify NO ETL Platform
- VERIFY: "ETL Platform" header NOT visible
- TAKE SCREENSHOT: Confirming no ETL access

STEP 4: Test Invoices - FULL ACCESS (Finance Primary Function)
- Click Invoices in sidebar
- VERIFY: Invoices page loads
- VERIFY: Total Invoiced amount displayed (~3M+ OMR)
- VERIFY: Pending amount displayed
- VERIFY: Overdue amount displayed
- VERIFY: Collection progress visible
- VERIFY: Full invoice list with all records
- VERIFY: Can search and filter invoices
- TAKE SCREENSHOT: Finance Invoices view

STEP 5: Test Accounts
- Click Accounts in sidebar
- VERIFY: Accounts page loads
- VERIFY: Account list visible
- VERIFY: Can see account financial details
- TAKE SCREENSHOT: Accounts page

STEP 6: Negative Test - Cannot Access Sales Data
- Manually navigate to: /opportunities
- VERIFY: Access denied OR redirect OR empty
- Manually navigate to: /activities
- VERIFY: Access denied OR redirect OR empty
- TAKE SCREENSHOT: Access denied for sales pages

STEP 7: Test Dashboard
- Click Dashboard
- VERIFY: Dashboard loads
- VERIFY: May show limited/financial metrics only
- TAKE SCREENSHOT: Finance Dashboard view
```

#### Expected Results:
- ✅ Can see Dashboard, AI Analytics, Accounts, Invoices, Profile
- ✅ Full access to Invoices (all records)
- ❌ Cannot see Opportunities, Leads, Activities, Timeline, Goals
- ❌ Cannot access ETL Platform
- ❌ Cannot access Admin section

---

### Scenario 5: Presales Engineer

**User**: `presales@test.securado.com` / `test123456`
**Expected Access**: All CRM read access, limited management

#### Test Steps:

```
STEP 1: Login
- Navigate to: https://layout-manager-1.preview.emergentagent.com
- Enter email: presales@test.securado.com
- Enter password: test123456
- Click "Sign in" button

STEP 2: Verify Sidebar
- VERIFY: Dashboard visible
- VERIFY: AI Analytics visible (view_analytics permission)
- VERIFY: Opportunities visible
- VERIFY: Leads visible
- VERIFY: Accounts visible
- VERIFY: Activities visible
- VERIFY: Timeline visible
- VERIFY: Invoices visible
- VERIFY: Goals visible
- VERIFY: My Profile visible
- VERIFY: NO ETL Platform section
- TAKE SCREENSHOT: Presales sidebar

STEP 3: Test Opportunities - ALL Records (Read)
- Click Opportunities
- VERIFY: Can see ALL opportunities
- VERIFY: Can view opportunity details
- TAKE SCREENSHOT: Presales Opportunities view

STEP 4: Test Invoices - View Only
- Click Invoices
- VERIFY: Can view invoices
- VERIFY: Can see invoice details
- TAKE SCREENSHOT: Presales Invoices view

STEP 5: Verify NO ETL Access
- VERIFY: No ETL Platform in sidebar
- Manually navigate to: /etl/connections
- VERIFY: Access denied
```

#### Expected Results:
- ✅ Full CRM read access
- ✅ Can view all opportunities, accounts, invoices
- ❌ Cannot access ETL Platform
- ❌ Cannot access Admin section

---

### Scenario 6: Product Director

**User**: `product.director@test.securado.com` / `test123456`
**Expected Access**: Same as Sales Director (All CRM, No ETL)

#### Test Steps:

```
STEP 1: Login
- Enter email: product.director@test.securado.com
- Enter password: test123456
- Click "Sign in"

STEP 2: Verify Full CRM Access
- VERIFY: All CRM Platform items visible
- VERIFY: No ETL Platform section
- TAKE SCREENSHOT: Product Director sidebar

STEP 3: Test Key Pages
- Dashboard: VERIFY full metrics
- Opportunities: VERIFY all records visible
- Invoices: VERIFY all invoices accessible
- TAKE SCREENSHOTS: Each page

STEP 4: Confirm NO ETL Access
- VERIFY: No ETL Platform in sidebar
- Manual URL test: /etl/pipelines should be denied
```

---

## Negative Test Cases

### Test Case N1: Direct URL Access to Restricted Pages

```
FOR EACH non-admin user (sales, finance, presales):
  1. Login with user credentials
  2. Manually enter URL: /etl/connections
  3. VERIFY: Page blocked or redirected
  4. Manually enter URL: /etl/pipelines
  5. VERIFY: Page blocked or redirected
  6. Manually enter URL: /admin/settings
  7. VERIFY: Page blocked or redirected
  8. Manually enter URL: /admin/users
  9. VERIFY: Page blocked or redirected
  TAKE SCREENSHOTS of each blocked access
```

### Test Case N2: API Access Restrictions

```
FOR EACH user role:
  1. Login and get JWT token from browser dev tools
  2. Test API call: GET /api/odoo-rbac/current-user-rbac
  3. VERIFY: Returns correct permissions for that role
  4. VERIFY: system_admin permission ONLY for System Admin
```

### Test Case N3: Invalid Credentials

```
1. Navigate to login page
2. Enter email: invalid@test.com
3. Enter password: wrongpassword
4. Click Sign in
5. VERIFY: Error message displayed
6. VERIFY: Not logged in
TAKE SCREENSHOT: Login error
```

---

## Data Validation Tests

### Test D1: Opportunity Count by Role

| Role | Expected Opportunity Count | Filter Applied |
|------|---------------------------|----------------|
| System Admin | ~1350+ | None (all records) |
| Sales Director | ~1350+ | None (all records) |
| Sales User | ~10 | Own records only (owner = "Test Sales User") |
| Finance | 0 (no access) | N/A |
| Presales | ~1350+ | None (all records) |

### Test D2: Invoice Count by Role

| Role | Expected Invoice Count | Notes |
|------|----------------------|-------|
| System Admin | ~300+ | All invoices |
| Sales Director | ~300+ | All invoices |
| Sales User | 0 (no access) | No view_invoices permission |
| Finance | ~300+ | All invoices (primary role) |
| Presales | ~300+ | All invoices |

---

## Expected Screenshots

Create screenshots for the following states:

1. **Login Page** - Clean login form
2. **System Admin Dashboard** - Full metrics visible
3. **System Admin Sidebar** - Showing ETL Platform section
4. **System Admin ETL Connections** - ETL page accessible
5. **Sales User Sidebar** - NO ETL section
6. **Sales User Opportunities** - Filtered to own records
7. **Sales Director Dashboard** - Full company metrics
8. **Finance Manager Sidebar** - Limited to finance items
9. **Finance Manager Invoices** - Full invoice access
10. **Access Denied Page** - When user tries restricted URL

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Application is running and accessible
- [ ] All test users created and verified
- [ ] Chrome extension ready for screen recording
- [ ] Test data populated (50 test opportunities, 15 test invoices)

### Test Execution Order
1. [ ] Scenario 1: System Admin (Krishna) - PASS/FAIL
2. [ ] Scenario 2: Sales User - PASS/FAIL
3. [ ] Scenario 3: Sales Director - PASS/FAIL
4. [ ] Scenario 4: Finance Manager - PASS/FAIL
5. [ ] Scenario 5: Presales Engineer - PASS/FAIL
6. [ ] Scenario 6: Product Director - PASS/FAIL
7. [ ] Negative Test Cases - PASS/FAIL
8. [ ] Data Validation Tests - PASS/FAIL

### Post-Test
- [ ] All screenshots saved
- [ ] Test results documented
- [ ] Bugs logged (if any)

---

## API Endpoints for Validation

```bash
# Login and get token
curl -X POST https://layout-manager-1.preview.emergentagent.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"USER_EMAIL","password":"test123456"}'

# Check RBAC permissions (use token from login)
curl -X GET https://layout-manager-1.preview.emergentagent.com/api/odoo-rbac/current-user-rbac \
  -H "Authorization: Bearer TOKEN"

# Expected response fields:
# - app_roles: array of roles
# - effective_permissions: array of permissions
# - record_access: "all" | "own" | "team" | "none"
# - system_admin should be in permissions ONLY for System Admin
```

---

## Bug Report Template

```
BUG ID: RBAC-XXX
SEVERITY: Critical/High/Medium/Low
USER ROLE: [Which test user]
EXPECTED: [What should happen]
ACTUAL: [What actually happened]
STEPS TO REPRODUCE:
1. 
2. 
3. 
SCREENSHOT: [Attached]
```

---

**Document Version**: 1.0
**Last Updated**: February 2, 2026
**Author**: Neo (AI Agent)
