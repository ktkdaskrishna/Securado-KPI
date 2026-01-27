# Complete ETL Integration Setup Guide
## From Odoo Connection to Live Data Sync

This guide walks you through configuring your ETL integration from scratch, assuming you have already set up your Odoo connection.

---

## 📋 Pre-Setup Checklist

Before starting, verify:
- [x] Odoo connection is configured and shows "Active" status
- [x] You have admin access to the application
- [ ] You understand the Odoo → Canonical mappings (see `/app/docs/ODOO_CANONICAL_MAPPING_GUIDE.md`)

---

## Step 1: Verify Admin Settings

### Navigate to Admin > Settings

1. Click **Admin** in the sidebar
2. Click **Settings**
3. Review and configure these ETL-related settings:

| Setting | Recommended Value | Purpose |
|---------|-------------------|---------|
| **Default Sync Interval** | 5 minutes | How often scheduled syncs run |
| **Auto Map Fields** | ✅ Enabled | Automatically suggest field mappings |
| **Enable Data Validation** | ✅ Enabled | Validate data before loading |
| **Default Currency** | Your currency (e.g., OMR) | For monetary fields |
| **Timezone** | Your timezone | For date/time conversions |

### Save Settings
Click **Save Changes** after updating.

---

## Step 2: Verify Odoo Connection

### Navigate to ETL Platform > Connections

1. Click **ETL Platform** in the sidebar
2. Click **Connections**
3. Verify your Odoo connection shows:
   - **Status**: Active (green badge)
   - **Type**: Odoo
   - **URL**: Your Odoo instance URL

### Test Connection
1. Click the **⋮** menu on your connection
2. Select **Test Connection**
3. Verify you see "Connection successful" message

### Discover Schema (if not done)
1. Click the **⋮** menu on your connection
2. Select **Discover Schema**
3. Wait for discovery to complete (may take 1-2 minutes)
4. You should see "Discovered X models" message

---

## Step 3: Configure Field Mappings

### Navigate to ETL Platform > Mappings

This is the **Visual Mapping Editor** where you configure how Odoo data maps to your canonical entities.

### 3.1 Understanding the Interface

```
┌─────────────────────────────────────────────────────────────────┐
│  Visual Mapping Editor                    [Connection Dropdown] │
├─────────────────────────────────────────────────────────────────┤
│  [Field Mappings] [Relationships] [Sync Status]                 │
├────────────────────────┬────────────────────────────────────────┤
│   SOURCE MODELS        │        TARGET MODELS                   │
│   From Odoo            │        Canonical (Local)               │
│   ─────────────────    │        ─────────────────               │
│   📁 CRM (15)          │        👤 Sales User ← res.users       │
│   📁 Accounting (96)   │        👥 Sales Team ← crm.team        │
│   📁 HR (12)           │        🏢 Account ← res.partner        │
│   📁 Core (45)         │        👤 Contact ← res.partner        │
│   ...                  │        🎯 Opportunity ← crm.lead       │
│                        │        📅 Activity ← mail.activity     │
│                        │        📄 Invoice ← account.move       │
│                        │        ✅ Task ← project.task          │
│                        │        💼 Employee ← hr.employee       │
└────────────────────────┴────────────────────────────────────────┘
```

### 3.2 Create Mappings for Each Entity

#### Mapping 1: Account (Companies)

**Source**: `res.partner` (filter: is_company = True)
**Target**: `Account`

| Source Field (Odoo) | Target Field (Canonical) | Transform |
|---------------------|--------------------------|-----------|
| `id` | `source_record_id` | to_string |
| `name` | `name` | direct |
| `phone` | `phone` | direct |
| `email` | `email` | direct |
| `website` | `website` | direct |
| `street` | `address` | direct |
| `city` | `city` | direct |
| `zip` | `zip` | direct |
| `user_id` | `owner_id` | extract_id |
| `industry_id` | `industry` | extract_name |

**Steps**:
1. Search for `res.partner` in Source Models
2. Click to expand and see fields
3. Expand **Account** in Target Models
4. Drag each source field to its target field
5. Or click **Auto-Suggest** for recommendations

---

#### Mapping 2: Contact (People)

**Source**: `res.partner` (filter: is_company = False)
**Target**: `Contact`

| Source Field (Odoo) | Target Field (Canonical) | Transform |
|---------------------|--------------------------|-----------|
| `id` | `source_record_id` | to_string |
| `name` | `name` | direct |
| `email` | `email` | direct |
| `phone` | `phone` | direct |
| `mobile` | `mobile` | direct |
| `function` | `title` | direct |
| `parent_id` | `account_id` | extract_id |

---

#### Mapping 3: Opportunity (Deals)

**Source**: `crm.lead` (filter: type = 'opportunity')
**Target**: `Opportunity`

| Source Field (Odoo) | Target Field (Canonical) | Transform |
|---------------------|--------------------------|-----------|
| `id` | `source_record_id` | to_string |
| `name` | `name` | direct |
| `expected_revenue` | `amount` | to_float |
| `probability` | `probability` | to_float |
| `partner_id` | `account_id` | extract_id |
| `partner_name` | `account_name` | direct |
| `user_id` | `owner_id` | extract_id |
| `team_id` | `team_id` | extract_id |
| `stage_id` | `stage` | extract_name |
| `date_deadline` | `close_date` | direct |

---

#### Mapping 4: Invoice

**Source**: `account.move` (filter: move_type = 'out_invoice')
**Target**: `Invoice`

| Source Field (Odoo) | Target Field (Canonical) | Transform |
|---------------------|--------------------------|-----------|
| `id` | `source_record_id` | to_string |
| `name` | `invoice_number` | direct |
| `partner_id` | `account_id` | extract_id |
| `amount_total` | `amount_total` | to_float |
| `currency_id` | `currency` | extract_name |
| `state` | `state` | direct |
| `invoice_date` | `invoice_date` | direct |
| `amount_residual` | `balance_due` | to_float |

---

#### Mapping 5: Sales User

**Source**: `res.users`
**Target**: `Sales User`

| Source Field (Odoo) | Target Field (Canonical) | Transform |
|---------------------|--------------------------|-----------|
| `id` | `source_record_id` | to_string |
| `name` | `name` | direct |
| `login` | `login` | direct |
| `email` | `email` | direct |
| `sale_team_id` | `team_id` | extract_id |

---

#### Mapping 6: Sales Team

**Source**: `crm.team`
**Target**: `Sales Team`

| Source Field (Odoo) | Target Field (Canonical) | Transform |
|---------------------|--------------------------|-----------|
| `id` | `source_record_id` | to_string |
| `name` | `name` | direct |
| `use_opportunities` | `use_opportunities` | to_bool |
| `use_leads` | `use_leads` | to_bool |

---

### 3.3 Save Your Mappings

After configuring all field mappings:
1. Click **Save** button in the header
2. Verify "Mapping configuration saved" toast appears

---

## Step 4: Preview & Validate

### Preview Transformation

1. Click **Preview** button
2. Review the sample data transformation
3. Check that:
   - Source fields are correctly extracted
   - Target fields have expected values
   - No errors in transformation

### Verify on Relationships Tab

1. Click **Relationships** tab
2. Confirm all 9 entities are connected
3. Verify relationship lines show correct cardinality

---

## Step 5: Run Initial Sync

### Manual Sync

1. Click **Sync Now** button
2. Confirm the sync action
3. Monitor progress in **Sync Status** tab
4. Wait for completion

### Check Results

After sync completes:
1. Go to **Sync Status** tab
2. Verify:
   - Status shows "Completed"
   - Record counts are populated
   - No critical errors

---

## Step 6: Verify Data in CRM

### Check Dashboard
1. Go to **CRM Platform > Dashboard**
2. Verify:
   - Opportunity count matches Odoo
   - Revenue totals are correct
   - Charts show data

### Check Opportunities
1. Go to **CRM Platform > Opportunities**
2. Verify:
   - Opportunities list is populated
   - Stage names are correct
   - Amounts display correctly

### Check Accounts
1. Go to **CRM Platform > Accounts**
2. Verify:
   - Customer companies are listed
   - Contact information is correct

---

## Step 7: Configure Scheduled Sync (Optional)

### Set Up Auto-Sync

1. Go to **ETL Platform > Mappings**
2. Click **Schedule** button
3. Configure:
   - **Frequency**: Every 5 minutes / Hourly / Daily
   - **Time**: Preferred sync time (for daily)
   - **Enable**: Toggle ON
4. Click **Save Schedule**

### Or via Pipelines (Advanced)

1. Go to **ETL Platform > Pipelines**
2. Click **Create Pipeline**
3. Configure:
   - **Name**: "Daily Odoo Sync"
   - **Mappings**: Select all your mappings
   - **Schedule**: Cron expression (e.g., `0 0 * * *` for daily at midnight)
4. Click **Create**

---

## Step 8: Monitor & Maintain

### Daily Checks
- Review **ETL Platform > Runs** for any failed syncs
- Check **Data Lake** for record counts
- Monitor **DLQ (Dead Letter Queue)** for failed records

### Weekly Checks
- Review sync statistics
- Check for any schema changes in Odoo
- Verify data quality in CRM pages

---

## 🔧 Troubleshooting

### Issue: No data after sync
1. Check Sync Status for errors
2. Verify mappings are saved
3. Confirm Odoo has data in source models
4. Check filters are correct (is_company, move_type, etc.)

### Issue: Wrong data in fields
1. Review field mappings
2. Check transformation type (extract_id vs extract_name)
3. Re-run sync after fixing mappings

### Issue: Sync fails
1. Check connection status
2. Verify Odoo credentials
3. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
4. Review DLQ for specific errors

---

## 📊 Mapping Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    ODOO → CANONICAL MAPPING                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   res.partner ──┬── (is_company=True) ──► Account              │
│                 └── (is_company=False) ─► Contact              │
│                                                                 │
│   crm.lead ─────────────────────────────► Opportunity          │
│                                                                 │
│   account.move ─ (move_type=out_invoice)► Invoice              │
│                                                                 │
│   res.users ────────────────────────────► Sales User           │
│                                                                 │
│   crm.team ─────────────────────────────► Sales Team           │
│                                                                 │
│   mail.activity ────────────────────────► Activity             │
│                                                                 │
│   project.task ─────────────────────────► Task                 │
│                                                                 │
│   hr.employee ──────────────────────────► Employee             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Completion Checklist

- [ ] Admin settings configured
- [ ] Odoo connection verified and active
- [ ] Schema discovered (244 models)
- [ ] Field mappings created for:
  - [ ] Account (res.partner → Account)
  - [ ] Contact (res.partner → Contact)
  - [ ] Opportunity (crm.lead → Opportunity)
  - [ ] Invoice (account.move → Invoice)
  - [ ] Sales User (res.users → Sales User)
  - [ ] Sales Team (crm.team → Sales Team)
- [ ] Mappings saved
- [ ] Preview validated
- [ ] Initial sync completed
- [ ] Data verified in CRM
- [ ] Scheduled sync configured (optional)

---

## ✅ Working Features (Verified After Fixes)

| Feature | Status | Notes |
|---------|--------|-------|
| Source model search | ✅ Working | Auto-expands matching categories |
| Source field drag | ✅ Working | Shows "drag →" hint on hover |
| Target field drop | ✅ Working | Blue highlight on valid drop zone |
| Mapping toast notification | ✅ Working | "Mapped X → Y" with transform info |
| Mapped field indicator | ✅ Working | Green background + "← source" text |
| Entity mapped count | ✅ Working | "X mapped" badge on entity header |
| Remove mapping | ✅ Working | Trash icon on mapped fields |
| Preview transformation | ✅ Working | Shows source vs transformed data |
| Save mappings | ✅ Working | Persists to backend |
| Relationships diagram | ✅ Working | Interactive React Flow with 10 edges |
| Sync execution | ✅ Working | Creates records in canonical collections |

---

*Document Version: 2.0 (Updated after bug fixes)*
*Last Updated: January 2025*
