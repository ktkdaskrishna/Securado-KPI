# RBAC Access Control Configuration
# This document describes the access control model for the CRM platform

## Access Levels

| Level | Description | Record Access | Example Roles |
|-------|-------------|---------------|---------------|
| SYSTEM_ADMIN | Full system + ETL access | All records + ETL Platform | System Administrator |
| ADMIN (100) | Full CRM access | All records | Sales Administrator |
| DIRECTOR (75) | Department-wide access | All in department | Sales Director, Finance Director |
| MANAGER (50) | Team + direct reports | Team members' records | Sales Manager, Team Lead |
| USER (10) | Own records only | Only own records | Salesperson, Account Executive |
| RESTRICTED (0) | No data access | None | New users, Pending approval |

## System Admin vs Regular Admin

| Feature | System Admin | Regular Admin |
|---------|-------------|---------------|
| CRM Platform | ✅ Full access | ✅ Full access |
| ETL Platform (Connections, Mappings, Pipelines, Data Model) | ✅ Full access | ❌ No access |
| Admin Settings (Users, Roles, RBAC Sync) | ✅ Full access | ✅ Full access |
| System Settings (Settings, Logs, Webhooks) | ✅ Full access | ❌ No access |

**Important**: Only users with `system_admin` permission can access the ETL Platform section.

## Role-Based Permissions

### 1. Salesperson / Sales User
**Odoo Groups**: `Sales / User`, `Sales / Own Documents Only`
**Can See**:
- Own opportunities only (where they are the owner/salesperson)
- Own activities and tasks
- Dashboard with own metrics only
- Accounts they manage
**Cannot See**:
- Other salespeople's opportunities
- Company-wide metrics
- Admin settings

### 2. Sales Manager / Team Lead
**Odoo Groups**: `Sales / Manager`, `CRM / Manager`
**Can See**:
- Own records
- Direct reports' records
- Team members' records
- Team-level dashboard metrics
**Cannot See**:
- Other teams' records
- Admin settings
- Finance data

### 3. Sales Director
**Odoo Groups**: `CRM / Sales Director`, `Sales / All Documents`
**Can See**:
- All sales team records
- Company-wide sales metrics
- All opportunities
- All salespeople's performance
**Cannot See**:
- Admin settings (unless also admin)
- Finance-only data

### 4. Product Director / Pre-sales
**Odoo Groups**: `group_434` (Pre-sales)
**Can See**:
- Pre-sales activities
- Product demos and POCs
- Marketing events
- Own KPIs
**Cannot See**:
- Sales commission details
- Finance data
- Individual salesperson targets

### 5. Finance Manager
**Odoo Groups**: `Accounting / Accountant`, `Accounting / Administrator`
**Can See**:
- Invoices and receivables
- Collection data
- Financial KPIs
- Commission calculations (view only)
**Cannot See**:
- Sales pipeline details
- Sales strategies
- Individual performance (unless authorized)

### 6. Administrator
**Odoo Groups**: `Administration / Settings`, `Administration / Access Rights`
**Can See**:
- Everything
- System settings
- User management
- RBAC configuration

## Default Access (No RBAC Record)

If a user logs in but has NO record in the RBAC system:
- **Access Level**: RESTRICTED
- **Can See**: Basic profile page only
- **Cannot See**: Any business data

This prevents unauthorized data access for new or unsynced users.

## Implementation Notes

1. Access is determined by matching Odoo group names to patterns
2. The HIGHEST matching access level is applied
3. Managers automatically see their direct reports' data (via hr.employee hierarchy)
4. Team membership expands visibility within the team
5. Users without RBAC sync get RESTRICTED access by default
