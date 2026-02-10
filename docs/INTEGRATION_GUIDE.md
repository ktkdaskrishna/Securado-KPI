# Securado CRM - Odoo Integration Configuration Guide

## Access: Settings → Integrations (`/admin/integrations`)
Admin only. Contains 11 tabs managing the complete Odoo ↔ CRM data pipeline.

---

## Tab 1: Sync Overview (Default View)

**Purpose**: At-a-glance status of all data entities synced from Odoo.

**What you see**:
- Connection status bar: "Securado-ERP · Connected · 6,781 records"
- Entity table showing 10 data types:

| Entity | Odoo Model | Records | Schedule | What it syncs |
|--------|-----------|---------|----------|--------------|
| Opportunities | crm.lead | 1,358 | Daily | Sales pipeline, deals, stages |
| Accounts | res.partner | 666 | Daily | Customer companies |
| Contacts | res.partner | 1,385 | Daily | People at companies |
| Activities | mail.activity | 737 | Hourly | Calls, meetings, demos, POCs |
| Invoices | account.move | 243 | Daily | Bills, payments, receivables |
| Employees | hr.employee | 78 | Weekly | Staff, org structure |
| Sales Users | res.users | 149 | Weekly | CRM user accounts |
| Sales Teams | crm.team | 6 | Weekly | Team structure |
| Tasks | project.task | 2,000 | Daily | Project delivery tasks |
| RBAC | res.groups | 159 | Daily | Permissions, access groups |

**Actions per entity**:
- **Schedule dropdown**: Set sync frequency (Manual / Hourly / Daily / Weekly)
- **Sync button**: Trigger immediate sync for that entity
- **Health indicator**: ✅ Healthy or ⚠️ Overdue (if last sync exceeds 2x schedule)

**When to use**: Quick check if data is fresh. Click "Sync" if you notice stale data.

---

## Tab 2: Connection

**Purpose**: Configure the Odoo ERP connection.

**What you see**:
- Securado-ERP connection: Type=odoo, URL=https://erp.securado.net, Status=active, Health=healthy
- "New Connection" button for adding future integrations

**Actions**:
- Edit connection (change URL, credentials)
- Test connection health
- Delete connection

**When to use**: Initial setup or when Odoo server URL changes.

---

## Tab 3: Data Mapping

**Purpose**: Define how Odoo fields map to CRM fields. Includes AI auto-mapping.

**What you see**:
- 3 active mappings:
  - `crm.activity.report → opportunity` (47 fields, v4)
  - `mail.activity → activity` (15 fields, v1)
  - `crm.activity.report → activity` (21 fields, v1)

**Actions**:
- **"+ New Mapping"**: Create a new field mapping between an Odoo model and CRM entity
- **Click mapping row**: Opens the visual drag-and-drop mapping editor with:
  - Source Panel (Odoo fields on left)
  - Target Panel (CRM fields on right)
  - Relationship Diagram (visual lines connecting mapped fields)
  - Transform Preview (see how data transforms)
  - Sync Controls (test the mapping with sample data)
  - **AI Auto-Mapping**: System suggests field mappings based on name similarity
- **Sync button** (per mapping): Run this specific mapping
- **Delete button**: Remove a mapping

**Flow**:
1. Click "New Mapping"
2. Select source (Odoo model, e.g., `crm.lead`)
3. Select target (CRM entity, e.g., `opportunity`)
4. AI suggests field mappings automatically
5. Review/adjust mappings in visual editor
6. Save → mapping is used in next sync

**When to use**: When adding new data types to sync, or when Odoo fields change.

---

## Tab 4: Model Browser

**Purpose**: Explore what Odoo models and fields are available for syncing.

**What you see**:
- Left panel: Searchable list of Odoo models organized by category (CRM & Sales: 16 models)
- Right panel: Field details when you click a model

**Models available** (examples):
- `crm.lead` (Lead/Opportunity)
- `crm.activity.report` (CRM Activity Analysis)
- `crm.budget` (Budget)
- `crm.check.list` (Check List)

**When to use**: Before creating a new mapping - browse to understand what data is available in Odoo.

---

## Tab 5: Pipelines

**Purpose**: Manage ETL pipeline configurations that orchestrate the sync.

**What it does**:
- A pipeline groups multiple mappings into a single sync operation
- Each pipeline can include multiple entity syncs (e.g., sync opportunities + activities together)
- Pipelines can be triggered manually or scheduled

**When to use**: Advanced configuration. Most users don't need this - the Sync Overview tab's "Sync" buttons are sufficient.

---

## Tab 6: Run History

**Purpose**: View past sync runs with success/failure status.

**What you see**:
- Table of past pipeline runs with: Pipeline name, Trigger type, Status (completed/failed), Start time, Records processed

**When to use**: Debugging sync failures. Check if a specific run completed or had errors.

---

## Tab 7: Webhooks

**Purpose**: Configure real-time data sync from Odoo via webhooks.

**Current state**: 
- Webhook Processing: OFF (disabled)
- Odoo Automations: Not Setup

**Important warning displayed**: 
> "Webhooks enable real-time sync but can cause performance issues if Odoo has high activity. Only enable if your system can handle the load."

**Actions**:
- **Setup Webhooks**: Creates automated actions in Odoo to send POST requests when data changes
- **Remove Webhooks**: Deletes all webhook automations from Odoo
- Toggle webhook processing on/off

**Performance-safe design**:
- When enabled, Odoo sends webhook to `/api/webhooks/odoo` endpoint
- Events are queued (not processed immediately)
- Queue processed in batches every 5 minutes
- Zero impact on main API performance

**When to use**: Only when you need near-real-time sync (< 5 min delay). For most use cases, the scheduled daily/hourly sync is sufficient.

---

## Tab 8: RBAC Sync

**Purpose**: Sync user permissions and access levels from Odoo.

**What you see**:
- Summary cards: 73 Users Synced, 14 Groups, 6 Teams, 1 Local Override
- Access Distribution: ADMIN 20, USER 5, RESTRICTED 48
- Sub-tabs: Users (73), Overrides (1), Groups (14), Teams (6), Test Filter

**What it does**:
- Pulls Odoo user groups (Sales/User, Sales/Administrator, CRM/Sales Director, etc.)
- Maps Odoo groups to CRM access levels (admin/user/restricted)
- Determines who can see what data based on their Odoo roles

**Actions**:
- **"Sync from Odoo"**: Pull latest user/group data from Odoo
- **Override**: Set local access override for specific users (e.g., give someone admin even if Odoo says user)
- **Test Filter**: Test what data a specific user would see

**When to use**: After adding new users in Odoo, or when someone's role changes.

---

## Tab 9: Data Quality

**Purpose**: Monitor data integrity across synced collections.

**What you see**:
- Summary: 4,146 Total Records, 0 Duplicates, Overall Health = HEALTHY, 4 Collections
- Per-collection health: opportunities (1,358, 0% duplicates), activities (737), accounts (666), contacts (1,385)

**Actions**:
- **Refresh**: Re-run data quality checks
- **Clean Duplicates**: Remove duplicate records if found
- **Event Queue**: View pending data events

**When to use**: Periodic health check. Run after large sync operations.

---

## Tab 10: Data Lake

**Purpose**: Browse the raw synced data in the canonical database.

**When to use**: Advanced debugging - verify that synced data looks correct.

---

## Tab 11: DLQ (Dead Letter Queue)

**Purpose**: View records that failed to sync.

**When to use**: When sync shows errors - DLQ shows which specific records failed and why.

---

## Complete Sync Flow

```
1. SETUP (one-time)
   Connection tab → Configure Odoo URL + credentials → Test connection

2. MAPPING (one-time per entity)
   Model Browser → Find the Odoo model → 
   Data Mapping → New Mapping → AI auto-maps fields → Adjust → Save

3. SYNC (ongoing)
   Option A: Sync Overview → Set schedule (Daily/Hourly) → Runs automatically
   Option B: Sync Overview → Click "Sync" → Immediate pull from Odoo
   Option C: Webhooks → Enable → Odoo pushes changes in real-time (queued)

4. RBAC (after user changes)
   RBAC Sync → "Sync from Odoo" → Updates user permissions

5. MONITORING
   Data Quality → Check health scores
   Run History → Verify runs completed
   DLQ → Check for failed records
```

---

## Data Flow Diagram

```
Odoo ERP (erp.securado.net)
    │
    ├── [Scheduled Sync] ──→ ETL Pipeline ──→ Canonical DB (MongoDB)
    │   (Daily/Hourly/Weekly)                  ├── opportunities (1,358)
    │                                          ├── accounts (666)
    ├── [Webhook] ──→ Queue ──→ Batch Process  ├── activities (737)
    │   (Real-time, if enabled)                ├── invoices (243)
    │                                          ├── employees (78)
    └── [Manual Sync] ──→ Pipeline trigger     ├── sales_users (149)
                                               ├── tasks (2,000)
                                               └── RBAC groups (159)
                                                    │
                                               CRM Application
                                               ├── Dashboard
                                               ├── Opportunities
                                               ├── Performance Hub
                                               └── (all pages read from canonical DB)
```
