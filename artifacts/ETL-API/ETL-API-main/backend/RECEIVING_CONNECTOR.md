# Platform 2 - Receiving Connector Details

## Overview
Platform 2 is ready to receive canonical data from Platform 1 (ETL). This document provides the connection details and specifications for Platform 1 to write transformed data.

## Connection Details

### Canonical MongoDB Connection

**Connection String:**
```
mongodb://localhost:27017
```

**Database Name:**
```
platform1_canonical
```

**Authentication:**
- For production deployment, create a dedicated MongoDB user with `readWrite` role on the canonical database
- Platform 2 will only READ from this database
- Platform 1 will WRITE to this database

### Supported Layouts

Platform 2 supports two canonical data layouts:

#### Option 1: Single Collection (Envelope Style)

**Collection:** `data_lake_canonical`

**Document Structure:**
```json
{
  "entity_type": "opportunities",
  "canonical_id": "opp_12345",
  "data": {
    "name": "Acme Corp Deal",
    "stage": "Proposal",
    "value": 50000,
    "probability": 75,
    "owner": "john@company.com",
    "close_date": "2024-12-31"
  },
  "updated_at": "2024-01-15T10:30:00Z",
  "org_id": "default_org",
  "source_refs": [
    {
      "system": "salesforce",
      "id": "006..."
    }
  ]
}
```

**Supported Entity Types:**
- `opportunities`
- `accounts`
- `contacts`
- `activities`
- `leads`
- Custom entity types (any string)

#### Option 2: Per-Entity Collections

**Collection Prefix:** `silver_`

**Collection Names:**
- `silver_opportunities`
- `silver_accounts`
- `silver_contacts`
- `silver_activities`
- `silver_leads`
- etc.

**Document Structure (Flat):**
```json
{
  "canonical_id": "opp_12345",
  "name": "Acme Corp Deal",
  "stage": "Proposal",
  "value": 50000,
  "probability": 75,
  "owner": "john@company.com",
  "close_date": "2024-12-31",
  "updated_at": "2024-01-15T10:30:00Z",
  "org_id": "default_org",
  "source_refs": [
    {
      "system": "salesforce",
      "id": "006..."
    }
  ]
}
```

## Required Fields

### For Single Collection (Envelope):
- `entity_type` (string) - Type of entity
- `canonical_id` (string) - Unique identifier for the record
- `data` (object) - The actual entity data
- `updated_at` (datetime/string) - Last update timestamp
- `org_id` (string) - Organization identifier

### For Per-Entity Collections:
- `canonical_id` (string) - Unique identifier for the record
- `updated_at` (datetime/string) - Last update timestamp
- `org_id` (string) - Organization identifier
- All other fields at top level

## Recommended Indexes

Platform 1 should create these indexes for optimal performance:

### Single Collection:
```javascript
db.data_lake_canonical.createIndex({ "entity_type": 1, "org_id": 1 })
db.data_lake_canonical.createIndex({ "canonical_id": 1, "org_id": 1 })
db.data_lake_canonical.createIndex({ "updated_at": -1 })
db.data_lake_canonical.createIndex({ "org_id": 1, "entity_type": 1, "updated_at": -1 })
```

### Per-Entity Collections:
```javascript
// For each entity collection
db.silver_opportunities.createIndex({ "canonical_id": 1, "org_id": 1 })
db.silver_opportunities.createIndex({ "org_id": 1, "updated_at": -1 })
db.silver_accounts.createIndex({ "canonical_id": 1, "org_id": 1 })
db.silver_accounts.createIndex({ "org_id": 1, "updated_at": -1 })
// ... etc
```

## Health Check Endpoint

Platform 1 can verify Platform 2 connectivity:

**Endpoint:**
```
GET https://layout-manager-1.preview.emergentagent.com/api/data-lake/health
```

**Response:**
```json
{
  "status": "healthy",
  "canonical_db": "connected",
  "message": "Data lake is accessible"
}
```

## Configuration in Platform 2

Platform 2 uses these environment variables (already configured):

```env
CANONICAL_MONGO_URL="mongodb://localhost:27017"
CANONICAL_DB_NAME="platform1_canonical"
CANONICAL_LAYOUT="single_collection"  # or "per_entity"
CANONICAL_COLLECTION="data_lake_canonical"  # if single_collection
CANONICAL_ENTITY_COLLECTION_PREFIX="silver_"  # if per_entity
```

## Data Flow

1. **Platform 1 (ETL)** → Writes canonical data to MongoDB
2. **Platform 2 (API)** → Reads canonical data (READ-ONLY)
3. **Platform 2 (API)** → Stores user overrides in separate collections
4. **Platform 2 (API)** → Merges canonical + overrides at read time
5. **Platform 2 (Scheduler)** → Rebuilds serving cache periodically

## Important Notes

1. **Read-Only Rule**: Platform 2 will NEVER modify canonical data. All user edits are stored as overrides.

2. **Org Scoping**: All queries are scoped by `org_id`. Ensure all canonical records have this field.

3. **Timestamps**: Use ISO 8601 format or MongoDB ISODate for `updated_at` fields.

4. **Canonical ID**: Must be unique per entity type and org. Platform 2 uses this to match overrides.

5. **Serving Cache**: Platform 2 builds aggregated views automatically. Platform 1 does not need to create serving layer.

## Testing the Integration

### Step 1: Write Test Data
Using MongoDB shell or driver, insert a test opportunity:

```javascript
// For single_collection layout
db.data_lake_canonical.insertOne({
  entity_type: "opportunities",
  canonical_id: "test_opp_001",
  data: {
    name: "Test Deal",
    stage: "Proposal",
    value: 25000
  },
  updated_at: new Date(),
  org_id: "default_org"
})
```

### Step 2: Verify in Platform 2
Call the API:

```bash
curl -H "Authorization: Bearer <token>" \
  https://layout-manager-1.preview.emergentagent.com/api/data-lake/canonical?entity_type=opportunities
```

### Step 3: Check Dashboard
```bash
curl -H "Authorization: Bearer <token>" \
  https://layout-manager-1.preview.emergentagent.com/api/dashboard/stats
```

## Support

For questions or issues with the integration, contact the Platform 2 team.

## API Documentation

Full API documentation is available at:
```
https://layout-manager-1.preview.emergentagent.com/docs
```
