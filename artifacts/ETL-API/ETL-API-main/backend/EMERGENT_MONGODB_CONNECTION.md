# Platform 2 - Emergent MongoDB Public Connection Details

## 🔌 MongoDB Connection Information

### Environment Details
- **Preview URL:** https://data-sync-fix-7.preview.emergentagent.com
- **Backend API:** https://data-sync-fix-7.preview.emergentagent.com/api
- **Public IP:** 104.198.214.223
- **Internal IP:** 10.232.132.6

---

## 📊 MongoDB Databases

### Database 1: Canonical Database (Platform 1 ETL Output)
**Purpose:** Platform 1 writes transformed data here (READ-ONLY for Platform 2)

```
Database Name: platform1_canonical
Port: 27017
```

**Collections:**
- Option A (Single Collection): `data_lake_canonical`
- Option B (Per-Entity): `silver_opportunities`, `silver_accounts`, `silver_contacts`, etc.

---

### Database 2: Application Database (Platform 2 Data)
**Purpose:** Platform 2's operational data (users, roles, overrides, configs)

```
Database Name: platform2_app
Port: 27017
```

**Collections:**
- `users`, `roles`, `permissions`, `departments`
- `overrides_opportunities`, `overrides_accounts`
- `goals`, `teams`, `portfolios`, `initiatives`
- `activities`, `kpis`, `serving_cache`
- `admin_logs_errors`, `admin_logs_sessions`, `admin_logs_api_calls`

---

## 🔐 Connection Strings

### Important Note About Emergent Platform
The MongoDB instance is currently running **inside the Kubernetes cluster** and is **NOT directly accessible from outside** without additional configuration.

### Option 1: Use MongoDB through Platform 2 API (Recommended)
Since you're on Emergent platform, the recommended approach is to use Platform 2's API endpoints to interact with the data:

**For Platform 1 (ETL) to write data:**
```
Method: Use Platform 2 API endpoints as a proxy
Endpoint: POST /api/data-lake/write (needs to be implemented)
OR
Use Emergent's internal service mesh to connect directly
```

**Platform 2 API Access:**
```
Base URL: https://data-sync-fix-7.preview.emergentagent.com/api
Auth: JWT Bearer Token
```

---

### Option 2: Internal Kubernetes Service (For Platform 1 if running in same cluster)
If Platform 1 is also running in the same Kubernetes cluster:

```
Connection String: mongodb://localhost:27017
Database: platform1_canonical
Layout: single_collection or per_entity
```

**Note:** This works only if Platform 1 is deployed in the same K8s namespace.

---

### Option 3: Expose MongoDB Publicly (Requires Emergent Support)

To make MongoDB accessible from external Platform 1:

**What's Needed:**
1. Kubernetes Service with type LoadBalancer
2. MongoDB authentication enabled
3. Firewall rules configured
4. SSL/TLS certificates

**Typical Public Connection String Would Be:**
```
mongodb://platform1_writer:PASSWORD@<LOADBALANCER_IP>:27017/platform1_canonical?authSource=platform1_canonical
```

**To Request This:**
Contact Emergent support to:
- Expose MongoDB on a public IP
- Set up authentication
- Configure SSL/TLS
- Provide LoadBalancer endpoint

---

## 🚀 Recommended Approach for Emergent Platform

### Scenario A: Platform 1 Running Externally (Outside Emergent)

**Best Solution: Use MongoDB Atlas**

1. **Create MongoDB Atlas Cluster**
   - Go to https://www.mongodb.com/cloud/atlas
   - Create free/paid cluster
   - Add IP whitelist (0.0.0.0/0 for development, specific IPs for production)

2. **Get Connection String**
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/platform1_canonical?retryWrites=true&w=majority
   ```

3. **Update Platform 2 Configuration**
   Edit `/app/backend/.env`:
   ```env
   CANONICAL_MONGO_URL="mongodb+srv://username:password@cluster.mongodb.net"
   CANONICAL_DB_NAME="platform1_canonical"
   ```

4. **Platform 1 Uses Same Connection**
   Platform 1 connects to same Atlas cluster to write data

5. **Restart Platform 2**
   ```bash
   supervisorctl restart backend
   ```

**Advantages:**
- ✅ Fully managed (backups, scaling, monitoring)
- ✅ Accessible from anywhere
- ✅ SSL/TLS enabled by default
- ✅ Free tier available (512MB)
- ✅ No infrastructure management needed

---

### Scenario B: Platform 1 Running in Same Kubernetes Cluster

**Solution: Internal Service Discovery**

Platform 1 can connect directly using:
```
Connection String: mongodb://localhost:27017
Database: platform1_canonical
```

**Important:** Ensure Platform 1 and Platform 2 are in the same pod/namespace.

---

## 📝 Current Configuration

### Platform 2 Backend Configuration
Location: `/app/backend/.env`

```env
# Canonical MongoDB (Platform 1 output - READ ONLY)
CANONICAL_MONGO_URL="mongodb://localhost:27017"
CANONICAL_DB_NAME="platform1_canonical"
CANONICAL_LAYOUT="single_collection"
CANONICAL_COLLECTION="data_lake_canonical"
CANONICAL_ENTITY_COLLECTION_PREFIX="silver_"

# App MongoDB (Platform 2 data - READ/WRITE)
APP_MONGO_URL="mongodb://localhost:27017"
APP_DB_NAME="platform2_app"

# JWT Configuration
JWT_SECRET="your-secret-key-change-in-production-min-32-chars"
JWT_ALGORITHM="HS256"
JWT_ACCESS_TTL=3600
JWT_REFRESH_TTL=604800

# Scheduler Configuration
SCHEDULER_ENABLED=true
SCHEDULER_CRON="0 */6 * * *"
```

---

## 🔧 Step-by-Step Setup Guide

### Using MongoDB Atlas (Recommended)

**Step 1: Create Atlas Account**
1. Visit https://www.mongodb.com/cloud/atlas/register
2. Create account (free tier available)
3. Create a new cluster (M0 Free tier is sufficient for testing)

**Step 2: Set Up Database Access**
1. Go to "Database Access" in Atlas
2. Click "Add New Database User"
3. Create two users:
   - `platform1_writer` (readWrite permission on `platform1_canonical`)
   - `platform2_reader` (read permission on `platform1_canonical`)

**Step 3: Configure Network Access**
1. Go to "Network Access" in Atlas
2. Click "Add IP Address"
3. For development: Add `0.0.0.0/0` (allow from anywhere)
4. For production: Add specific IPs of Platform 1 and Platform 2

**Step 4: Get Connection String**
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy the connection string:
   ```
   mongodb+srv://platform1_writer:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

**Step 5: Update Platform 2**
```bash
# SSH or exec into Platform 2 container
cd /app/backend

# Edit .env file
nano .env

# Update these lines:
CANONICAL_MONGO_URL="mongodb+srv://platform2_reader:PASSWORD@cluster0.xxxxx.mongodb.net"
CANONICAL_DB_NAME="platform1_canonical"

# Save and restart
supervisorctl restart backend
```

**Step 6: Verify Connection**
```bash
curl https://data-sync-fix-7.preview.emergentagent.com/api/data-lake/health
```

Expected response:
```json
{
  "status": "healthy",
  "canonical_db": "connected",
  "message": "Data lake is accessible"
}
```

**Step 7: Configure Platform 1**
Platform 1 uses the writer connection string:
```
mongodb+srv://platform1_writer:PASSWORD@cluster0.xxxxx.mongodb.net/platform1_canonical
```

---

## 🧪 Testing the Setup

### Test 1: Platform 1 Writes Data
From Platform 1, insert a test document:

```javascript
// Using mongosh or MongoDB driver
use platform1_canonical

// For single_collection layout
db.data_lake_canonical.insertOne({
  entity_type: "opportunities",
  canonical_id: "test_opp_001",
  data: {
    name: "Test Opportunity",
    stage: "Qualified",
    value: 50000
  },
  updated_at: new Date(),
  org_id: "default_org",
  source_refs: []
})

// For per_entity layout
db.silver_opportunities.insertOne({
  canonical_id: "test_opp_001",
  name: "Test Opportunity",
  stage: "Qualified",
  value: 50000,
  updated_at: new Date(),
  org_id: "default_org"
})
```

### Test 2: Platform 2 Reads Data
```bash
# Login to get token
TOKEN=$(curl -s -X POST https://data-sync-fix-7.preview.emergentagent.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@platform2.com","password":"admin123"}' | jq -r '.access_token')

# Browse canonical data
curl -H "Authorization: Bearer $TOKEN" \
  "https://data-sync-fix-7.preview.emergentagent.com/api/data-lake/canonical?entity_type=opportunities"
```

Expected: Should see the test opportunity inserted by Platform 1

---

## 📊 Data Flow Architecture

```
┌─────────────────────────────────────┐
│       Platform 1 (ETL)              │
│    (External or Same Cluster)       │
└─────────────────┬───────────────────┘
                  │ writes
                  ↓
┌─────────────────────────────────────┐
│      MongoDB Atlas / Shared DB      │
│      Database: platform1_canonical  │
│      - data_lake_canonical          │
│      - silver_opportunities         │
│      - silver_accounts              │
└─────────────────┬───────────────────┘
                  │ reads (READ-ONLY)
                  ↓
┌─────────────────────────────────────┐
│      Platform 2 Backend             │
│   (Emergent Kubernetes Cluster)     │
│   - Canonical Adapter               │
│   - Override Merge Logic            │
│   - 71 REST APIs                    │
└─────────────────┬───────────────────┘
                  │ serves
                  ↓
┌─────────────────────────────────────┐
│   Platform 3 UI / API Consumers     │
│   URL: crm-api-gateway.preview...   │
└─────────────────────────────────────┘
```

---

## 🔒 Security Recommendations

### For MongoDB Atlas
- ✅ Use strong passwords (20+ characters)
- ✅ Enable IP whitelisting (specific IPs only in production)
- ✅ Create separate users for Platform 1 (write) and Platform 2 (read)
- ✅ Enable audit logs
- ✅ Set up automated backups
- ✅ Use VPC peering if available

### For Platform 2
- ✅ Change default JWT secret in `.env`
- ✅ Change default admin password
- ✅ Use HTTPS for all API access
- ✅ Implement rate limiting
- ✅ Monitor admin logs regularly

---

## 🆘 Troubleshooting

**Problem:** Platform 2 can't connect to MongoDB Atlas
- **Check:** Network access allows Platform 2's IP
- **Check:** Connection string includes correct username/password
- **Check:** Database name matches in both connection string and `.env`
- **Fix:** Test connection using mongosh: `mongosh "CONNECTION_STRING"`

**Problem:** Platform 1 can't write data
- **Check:** User has `readWrite` permissions
- **Check:** Database and collection names are correct
- **Check:** Network access allows Platform 1's IP
- **Fix:** Verify permissions in Atlas → Database Access

**Problem:** No data visible in Platform 2
- **Check:** Platform 1 has actually written data
- **Check:** `CANONICAL_LAYOUT` setting matches actual data structure
- **Check:** Org ID in data matches expected org_id
- **Fix:** Verify directly in MongoDB: `db.data_lake_canonical.find().limit(1)`

---

## 📞 Next Steps

1. **Choose Your Setup:**
   - MongoDB Atlas (Recommended) ✅
   - Internal Kubernetes (if Platform 1 is in same cluster)
   - Contact Emergent support for public MongoDB exposure

2. **Follow Setup Guide:**
   - See "Step-by-Step Setup Guide" above

3. **Test Connection:**
   - Use health check endpoint
   - Write test data from Platform 1
   - Verify in Platform 2 API

4. **Configure Platform 1:**
   - Update Platform 1 with connection details
   - Choose layout type (single_collection vs per_entity)
   - Start writing production data

---

## 📚 Additional Resources

- **MongoDB Atlas Getting Started:** https://www.mongodb.com/docs/atlas/getting-started/
- **Platform 2 API Docs:** https://data-sync-fix-7.preview.emergentagent.com
- **User Management Guide:** `/app/backend/USER_MANAGEMENT_AND_DB_SETUP.md`
- **Quick Start:** `/app/backend/QUICK_START.md`

---

**Need More Help?**

If you need Emergent platform to expose MongoDB publicly or have specific networking requirements, please contact Emergent support with this document.

For MongoDB Atlas setup assistance, their support and documentation are excellent and available 24/7.
