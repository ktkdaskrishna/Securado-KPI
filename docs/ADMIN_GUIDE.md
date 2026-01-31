# Securado CRM - Administrator Guide

**Version:** 2.0.0  
**Audience:** System Administrators

---

## Table of Contents

1. [Initial Setup](#1-initial-setup)
2. [User Management](#2-user-management)
3. [RBAC Configuration](#3-rbac-configuration)
4. [ETL Pipeline Management](#4-etl-pipeline-management)
5. [SSO Configuration](#5-sso-configuration)
6. [Data Quality Monitoring](#6-data-quality-monitoring)
7. [Troubleshooting](#7-troubleshooting)
8. [Maintenance Tasks](#8-maintenance-tasks)

---

## 1. Initial Setup

### Prerequisites

- Odoo instance with API access enabled
- MongoDB database access
- Admin credentials for Securado CRM

### Step 1: Configure Odoo Connection

1. Navigate to **ETL Platform → Connections**
2. Click **"Add Connection"**
3. Fill in:
   - **Name:** Descriptive name (e.g., "Production Odoo")
   - **URL:** Your Odoo URL (https://your-odoo.com)
   - **Database:** Odoo database name
   - **Username:** Odoo user with API access
   - **API Key:** Odoo API key (not password)
4. Click **"Test Connection"**
5. If successful, click **"Save"**

### Step 2: Initial RBAC Sync

1. Navigate to **Admin → RBAC Sync**
2. Select your Odoo connection from dropdown
3. Click **"Sync from Odoo"**
4. Wait for sync to complete
5. Verify:
   - Users synced count
   - Groups synced count
   - Teams synced count
   - Employees synced count

### Step 3: Configure ETL Pipelines

1. Navigate to **ETL Platform → Pipelines**
2. Create pipelines for:
   - CRM Leads/Opportunities
   - Accounts/Partners
   - Activities
   - Invoices
3. Run initial full sync for each pipeline

---

## 2. User Management

### Inviting Users

1. Go to **Admin → Users**
2. Click **"Invite User"**
3. Enter:
   - Email address
   - Name
   - Role(s)
4. User receives invitation email
5. User sets password on first login

### User Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full system access, user management |
| **Manager** | View team data, reports |
| **User** | View own data only |
| **Viewer** | Read-only access |

### Deactivating Users

1. Go to **Admin → Users**
2. Find user
3. Click **"Deactivate"**
4. User can no longer login
5. Historical data preserved

### Password Reset

1. Go to **Admin → Users**
2. Find user
3. Click **"Reset Password"**
4. User receives reset email

---

## 3. RBAC Configuration

### Understanding Access Levels

```
ADMIN (100)     → See ALL data
    ↓
MANAGER (50)    → See OWN + TEAM + DIRECT REPORTS data
    ↓
USER (10)       → See OWN data only
    ↓
RESTRICTED (0)  → See NOTHING
```

### How Access is Determined

1. **Check Local Override** (permission_overrides table)
   - If active, non-expired override exists, use that level
   
2. **Check Odoo RBAC** (users_rbac table)
   - Look up user's Odoo groups
   - Match groups to access levels
   - Check if user is a manager (has direct reports)
   
3. **Apply Highest Level**
   - If user has "Sales / Administrator" → ADMIN
   - If user has "Sales / Manager" OR has direct reports → MANAGER
   - If user has "Sales / User" → USER
   - Otherwise → RESTRICTED

### Creating Permission Overrides

**Use Cases:**
- Grant temporary elevated access
- Restrict a user regardless of Odoo permissions
- Testing/debugging access issues

**Steps:**
1. Go to **Admin → RBAC Sync**
2. Click **"Overrides"** tab
3. Click **"Add Override"**
4. Enter:
   - User email
   - Access level (ADMIN/MANAGER/USER/RESTRICTED)
   - Reason (for audit trail)
   - Expiration date (optional)
5. Click **"Create Override"**

### Bulk Overrides

1. Go to **"Users"** tab
2. Check boxes for multiple users
3. Click **"Bulk Override (X)"** button
4. Set access level for all selected
5. Click **"Create X Overrides"**

### Testing User Access

1. Go to **"Test Filter"** tab
2. Enter user name (e.g., "John Smith")
3. Click **"Test Filter"**
4. View:
   - Access level
   - Groups
   - Teams
   - Direct reports
   - MongoDB filter that will be applied

---

## 4. ETL Pipeline Management

### Pipeline Types

| Pipeline | Odoo Model | Canonical Entity |
|----------|------------|------------------|
| CRM | crm.lead | opportunities |
| Partners | res.partner | accounts |
| Activities | mail.activity | activities |
| Activity Reports | crm.activity.report | activities |
| Invoices | account.move | invoices |

### Running Pipelines

**Manual Run:**
1. Go to **ETL Platform → Pipelines**
2. Find pipeline
3. Click **"Run"**
4. Monitor status in **Run History**

**Scheduled Runs:**
- Configure in pipeline settings
- Recommended: Every 15-30 minutes

### Monitoring ETL Health

1. Go to **Admin → Data Quality**
2. Check **"Event Queue"** tab:
   - Queue depth
   - Processing rate
   - Failed events
3. Check **"Duplicates"** tab:
   - Duplicate record count
   - Cleanup status

### Handling Failed ETL

1. Check run logs for error details
2. Common issues:
   - Invalid field mappings
   - Connection timeout
   - API rate limiting
3. Fix issue and re-run pipeline

---

## 5. SSO Configuration

### Microsoft Azure AD Setup

**Prerequisites:**
- Azure AD tenant
- App registration with proper permissions

**Step 1: Azure AD Configuration**

1. Go to Azure Portal → Azure Active Directory
2. App registrations → New registration
3. Name: "Securado CRM"
4. Redirect URI: `https://your-domain.com/api/auth/microsoft/callback`
5. Note down:
   - Application (client) ID
   - Directory (tenant) ID
6. Create client secret

**Step 2: Securado Configuration**

1. Go to **Admin → Settings**
2. Click **"SSO"** tab
3. Enter:
   - Client ID
   - Tenant ID
   - Client Secret
   - Redirect URI
4. Click **"Save"**
5. Test login with Microsoft button

### SSO User Auto-Linking

- Users logging in via SSO are auto-created
- Email is matched to Odoo login for RBAC linking
- If no match, user gets RESTRICTED access until:
  - Admin creates permission override, OR
  - User's email is added to Odoo

---

## 6. Data Quality Monitoring

### Duplicate Detection

1. Go to **Admin → Data Quality**
2. **"Duplicates"** tab shows:
   - Duplicate count by entity type
   - Sample duplicates
3. Click **"Clean Duplicates"** to remove

### Event Queue Monitoring

1. **"Event Queue"** tab shows:
   - Pending events
   - Processing rate
   - Failed events
2. Click **"Retry Failed"** for failed events

### Cache Management

1. **"Cache"** tab shows:
   - Cache hit rate
   - Last refresh time
   - Cache size
2. Click **"Refresh Cache"** to rebuild

---

## 7. Troubleshooting

### User Can't See Any Data

**Diagnosis:**
1. Go to **Admin → RBAC Sync**
2. Click **"Test Filter"** tab
3. Enter user's name
4. Check access level

**Solutions:**
- If RESTRICTED: User not in Odoo or no Sales groups
  - Option A: Add user to Odoo Sales team
  - Option B: Create permission override
  
- If USER but should be MANAGER:
  - Check if user has direct reports in Odoo
  - Check Odoo group assignments

### ETL Sync Failing

**Check List:**
1. Connection status (ETL → Connections)
2. API credentials valid?
3. Odoo server accessible?
4. Field mappings correct?

**Common Errors:**
- "Field not found": Update mapping to correct field name
- "Connection timeout": Check network/firewall
- "Authentication failed": Regenerate API key

### SSO Not Working

**Check List:**
1. Azure AD credentials correct?
2. Redirect URI matches exactly?
3. User exists in Azure AD?
4. Permissions granted in Azure?

### Data Discrepancies

**Steps:**
1. Run full ETL sync
2. Check for duplicates
3. Verify field mappings
4. Compare source (Odoo) vs destination (CRM)

---

## 8. Maintenance Tasks

### Daily

- [ ] Check ETL run status
- [ ] Review failed events
- [ ] Monitor queue depth

### Weekly

- [ ] Review system logs for errors
- [ ] Check disk space usage
- [ ] Review access override expirations

### Monthly

- [ ] Full RBAC re-sync
- [ ] Audit permission overrides
- [ ] Review user accounts (deactivate unused)
- [ ] Performance review (slow queries)

### Quarterly

- [ ] Security audit
- [ ] API key rotation
- [ ] Backup verification
- [ ] Documentation update

---

## Quick Reference Commands

### Backend Service
```bash
# Check service status
supervisorctl status backend

# Restart backend
supervisorctl restart backend

# View logs
tail -f /var/log/supervisor/backend.err.log
```

### Database Queries
```javascript
// Check RBAC users
db.users_rbac.find({is_manager: true})

// Check overrides
db.permission_overrides.find({is_active: true})

// Count opportunities
db.opportunities.countDocuments({type: "opportunity"})
```

---

**Document Version:** 2.0.0  
**Last Updated:** January 31, 2026
