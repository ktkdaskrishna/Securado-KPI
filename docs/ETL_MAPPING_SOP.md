# ETL Visual Mapping Editor - Standard Operating Procedure (SOP)

## Overview
The Visual Mapping Editor allows you to visually map data from external source systems (like Odoo ERP) to your local canonical data model. This enables you to:
- Discover and browse available models from your connected systems
- Map source fields to target canonical entities
- Preview transformations before syncing
- Run manual or scheduled data synchronization

---

## Prerequisites

Before using the ETL Mapping Editor, ensure:
1. ✅ You have a valid connection to Odoo (or other source system) configured in **ETL Platform > Connections**
2. ✅ The connection status shows "Active"
3. ✅ You have appropriate permissions (ETL Administrator or Admin role)

---

## Accessing the Mapping Editor

1. Log in to the application at `https://odoo-sync-builder.preview.emergentagent.com`
2. Navigate to **ETL Platform > Mappings** in the sidebar
3. The Visual Mapping Editor will load with three tabs:
   - **Field Mappings** - Map source fields to target fields
   - **Relationships** - View entity relationship diagram
   - **Sync Status** - Monitor sync progress and history

---

## Step-by-Step Guide

### Step 1: Select Your Data Source Connection

1. In the top-right corner, locate the **Connection Selector** dropdown
2. Select your active Odoo connection (e.g., "Securado-ERP")
3. The connection status badge should show "Active"

### Step 2: Discover Source Models

1. Click the **Refresh** button to discover/reload models from Odoo
2. Wait for the discovery process to complete (a toast notification will confirm)
3. The **Source Models** panel on the left will populate with available models grouped by category:
   - 🎯 **CRM** - Leads, Opportunities, Teams, Stages
   - 💰 **Accounting** - Invoices, Payments, Journals
   - 👥 **HR** - Employees, Departments, Jobs
   - ⚙️ **Core** - Partners, Users, Companies
   - 📅 **Calendar** - Events, Attendees
   - ✉️ **Mail** - Activities, Messages

### Step 3: Explore Source Model Fields

1. **Search**: Use the search box to filter models (e.g., type "crm.lead")
2. **Expand Category**: Click on a category header to expand/collapse
3. **View Fields**: Click on a model name (e.g., `crm.lead`) to see its fields
4. Each field shows:
   - **Name**: The field identifier (e.g., `expected_revenue`)
   - **Type Badge**: Data type (char, integer, many2one, etc.)
   - **REQ Badge**: If the field is required

### Step 4: Understand Target Canonical Entities

The **Target Models** panel shows 9 pre-defined canonical entities:

| Entity | Description | Odoo Source Model | Filter |
|--------|-------------|-------------------|--------|
| **Sales User** | Salespeople/Users | `res.users` | - |
| **Sales Team** | Sales teams | `crm.team` | - |
| **Account** | Customer companies | `res.partner` | `is_company = True` |
| **Contact** | Contact persons | `res.partner` | `is_company = False` |
| **Opportunity** | Sales opportunities | `crm.lead` | `type = 'opportunity'` |
| **Activity** | Activities/Tasks | `mail.activity` | - |
| **Invoice** | Customer invoices | `account.move` | `move_type = 'out_invoice'` |
| **Task** | Project tasks | `project.task` | - |
| **Employee** | HR employees | `hr.employee` | - |

> ⚠️ **Important**: Odoo's `account.*` models (Accounting category) are for **Finance/Invoices**, NOT customer accounts! Customer "Accounts" come from `res.partner` (companies).

### Step 5: Create Field Mappings

**Option A: Drag and Drop**
1. Expand a source model to see its fields
2. Drag a source field from the left panel
3. Drop it onto the corresponding target field in the right panel
4. The mapping connection will be created

**Option B: Auto-Suggest**
1. Select a source model
2. Click the target entity you want to map to
3. Click "Auto-Suggest Mappings" to get AI-recommended field mappings
4. Review and confirm the suggestions

### Step 6: Preview Transformations

Before running a full sync:
1. Configure at least one field mapping
2. Click the **Preview** button in the header
3. A dialog will show sample source data and how it transforms to target format
4. Review the transformation to ensure correctness

### Step 7: Save Your Mappings

1. Click the **Save** button to persist your mapping configuration
2. Mappings are saved per organization and can be reloaded later
3. A confirmation toast will appear on successful save

### Step 8: Run Data Synchronization

**Manual Sync**:
1. Click the **Sync Now** button
2. Confirm the sync action
3. Monitor progress in the **Sync Status** tab
4. View results in the **Recent Sync Runs** section

**Scheduled Sync**:
1. Click the **Schedule** button
2. Configure the sync schedule (hourly, daily, weekly)
3. Enable the schedule
4. The system will automatically run syncs at configured intervals

---

## Viewing Relationships

The **Relationships** tab shows an interactive entity relationship diagram:

1. Click the **Relationships** tab
2. View all 9 canonical entities as nodes
3. Relationship lines show connections:
   - Solid lines = One-to-Many (1:N)
   - Dashed lines = One-to-One (1:1)
   - Arrows point to the "many" side
4. **Drag** nodes to rearrange the diagram
5. Use **Zoom** controls to adjust view

**Key Relationships**:
- Sales User → Account (owns)
- Sales User → Opportunity (owns)
- Account → Contact (has contacts)
- Account → Opportunity (has opportunities)
- Opportunity → Activity (has activities)
- Opportunity → Invoice (generates)

---

## Monitoring Sync Status

The **Sync Status** tab provides:

### Status Cards
- **Configured Mappings**: Number of active field mappings
- **Target Entities**: Entities with configured mappings
- **Last Sync**: Timestamp of most recent sync

### Recent Sync Runs
- Shows history of sync executions
- Status indicators: ✅ Completed, ⚠️ Completed with Errors, ❌ Failed
- Click on a run to view detailed logs

### Quick Actions
- **Refresh Status**: Update status information
- **View Logs**: See detailed execution logs
- **View Errors**: Review any failed records

---

## Common Field Transformations

When mapping fields, the system supports these transformations:

| Transform | Description | Example |
|-----------|-------------|---------|
| `direct` | Copy value as-is | name → name |
| `extract_id` | Get ID from many2one | partner_id[0] → account_id |
| `extract_name` | Get name from many2one | partner_id[1] → account_name |
| `to_float` | Convert to decimal | "100" → 100.0 |
| `to_int` | Convert to integer | "50" → 50 |
| `to_bool` | Convert to boolean | "true" → true |

---

## Best Practices

### ✅ DO:
1. Always **Preview** before running full sync
2. Map **required fields** first (marked with REQ badge)
3. Include `canonical_id` mapping for every entity
4. Save mappings frequently
5. Monitor sync runs for errors

### ❌ DON'T:
1. Don't run sync without any configured mappings
2. Don't ignore mapping verification warnings
3. Don't delete active connections while sync is running

---

## Troubleshooting

### Issue: "No models discovered"
**Solution**: 
1. Verify connection is active in Connections page
2. Click Refresh button to re-discover schema
3. Check connection credentials are valid

### Issue: Fields not loading for a model
**Solution**:
1. Click on the model name to expand it
2. Wait for the loading spinner to complete
3. If still empty, the model may have restricted access

### Issue: Sync fails with errors
**Solution**:
1. Go to Sync Status tab
2. Click "View Errors" to see details
3. Common issues:
   - Missing required field mappings
   - Invalid data type conversions
   - Connection timeout (retry the sync)

### Issue: Data not appearing after sync
**Solution**:
1. Check sync status shows "Completed"
2. Verify mappings target the correct entities
3. Go to ETL Platform > Data Lake to browse canonical data
4. Check Data Model page for entity statistics

---

## Support

For additional help:
- Check the **Data Model** page for entity documentation
- View the **Odoo Integration Guide** at `/app/docs/odoo_integration.md`
- Contact your system administrator

---

*Document Version: 1.0*
*Last Updated: January 2025*
