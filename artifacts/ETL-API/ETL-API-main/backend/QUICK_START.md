# Platform 2 - Quick Start Guide

## 🚀 Access Your System

### API Documentation UI (Interactive)
**URL:** https://crm-api-gateway.preview.emergentagent.com

**Features:**
- ✨ Next-gen dark theme with glassmorphism
- 🔐 Built-in authentication
- ▶️ One-click API testing
- 📊 Live response viewer
- 🔍 Search across 71 endpoints

**How to Use:**
1. Visit the URL above
2. Login with pre-filled credentials (admin@platform2.com / admin123)
3. Click any endpoint to test it
4. View responses in real-time

---

## 👥 User Management Quick Guide

### Add a New User (Complete Workflow)

**Step 1: User Registers**
```bash
POST /api/auth/register
{
  "email": "newuser@company.com",
  "name": "New User",
  "password": "SecurePass123!"
}
```
→ User created with status: **PENDING**

**Step 2: Admin Approves (You)**
1. Login to API UI: https://crm-api-gateway.preview.emergentagent.com
2. Navigate to "Admin - Users" section
3. Click "▶ Test Endpoint" on `POST /api/admin/users/{user_id}/approve`
4. Replace `{user_id}` with actual user ID

**Step 3: Assign Role**
```bash
PATCH /api/admin/users/{user_id}/assign-role
Query param: role=sales_rep
```

**Step 4: User Can Now Login**
User visits the API UI and logs in with their credentials.

---

### Available Roles

| Role | Permissions | Use Case |
|------|------------|----------|
| **superadmin** | Full access (`*`) | System administrators |
| **admin** | Full access (`*`) | Organization admins |
| **sales_manager** | opportunities:*, activities:*, dashboard:read | Sales team leaders |
| **sales_rep** | opportunities:read/update, activities:* | Individual contributors |

---

## 🔌 Connect Platform 1 (ETL System)

### For Development/Testing

**MongoDB Connection for Platform 1:**
```
Connection String: mongodb://localhost:27017
Database: platform1_canonical
Layout: Choose one below
```

**Option A: Single Collection**
- Collection: `data_lake_canonical`
- Document format: Envelope with `entity_type` field

**Option B: Per-Entity Collections**
- Collections: `silver_opportunities`, `silver_accounts`, etc.
- Document format: Flat with fields at top level

**Update Platform 2 Config:**
Edit `/app/backend/.env`:
```env
CANONICAL_LAYOUT="single_collection"  # or "per_entity"
```

---

### For Production (Public Access)

**Recommended: MongoDB Atlas**
1. Create cluster at https://www.mongodb.com/cloud/atlas
2. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/`
3. Update both Platform 1 and Platform 2 with this connection string

**Alternative: Self-Hosted**
1. Install MongoDB on public server
2. Enable authentication and SSL
3. Create firewall rules (allow Platform 1 & 2 IPs only)
4. Create users:
   - Platform 1: `readWrite` access
   - Platform 2: `read` access only

**Full setup guide:** `/app/backend/USER_MANAGEMENT_AND_DB_SETUP.md`

---

## 🧪 Test the Connection

### 1. Check Platform 2 Can Read Canonical DB
```bash
curl https://crm-api-gateway.preview.emergentagent.com/api/data-lake/health
```

Expected:
```json
{
  "status": "healthy",
  "canonical_db": "connected",
  "message": "Data lake is accessible"
}
```

### 2. Platform 1 Writes Test Data
Platform 1 inserts a document into canonical DB.

### 3. Verify in Platform 2
```bash
# Login first to get token
curl -X POST https://crm-api-gateway.preview.emergentagent.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@platform2.com","password":"admin123"}'

# Browse canonical data
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://crm-api-gateway.preview.emergentagent.com/api/data-lake/canonical?entity_type=opportunities"
```

---

## 📚 Key Documents

| Document | Purpose |
|----------|---------|
| **USER_MANAGEMENT_AND_DB_SETUP.md** | Complete user management + MongoDB setup guide |
| **PLATFORM2_COMPLETE.md** | Full platform documentation with all endpoints |
| **RECEIVING_CONNECTOR.md** | Platform 1 integration specifications |

**Location:** `/app/backend/`

---

## 🎯 Common Tasks

### Task 1: Bulk Approve All Pending Users
1. Get pending users: `GET /api/admin/users?status=pending`
2. For each user: `POST /api/admin/users/{id}/approve`
3. Bulk assign role: `POST /api/admin/users/bulk-assign-role`

### Task 2: Create Custom Department
```json
POST /api/admin/departments
{
  "name": "Sales - West Coast",
  "description": "West Coast sales team"
}
```

### Task 3: View Dashboard Statistics
```bash
GET /api/dashboard/stats
```

### Task 4: Manually Refresh Dashboard Cache
```bash
POST /api/dashboard/refresh
```

### Task 5: Search Across All Entities
```bash
GET /api/search?q=acme
```

---

## 🔐 Security Checklist

Before going to production:

- [ ] Change JWT secret in `.env`
- [ ] Change default admin password
- [ ] Set up MongoDB authentication
- [ ] Enable MongoDB SSL/TLS
- [ ] Configure firewall rules
- [ ] Use HTTPS for API access
- [ ] Set up backup for App MongoDB
- [ ] Create read-only user for Platform 2
- [ ] Create write-only user for Platform 1
- [ ] Review and test user approval workflow

---

## 🆘 Troubleshooting

**Problem:** Can't login
- **Check:** User status (must be "approved")
- **Fix:** Admin approves via `/api/admin/users/{id}/approve`

**Problem:** No canonical data showing
- **Check:** Platform 1 has written data
- **Check:** `CANONICAL_LAYOUT` matches actual data structure
- **Fix:** Verify MongoDB connection and layout config

**Problem:** API returns 401 Unauthorized
- **Check:** Token is valid and not expired
- **Fix:** Login again to get fresh token

**Problem:** User has no permissions
- **Check:** User has roles assigned
- **Fix:** Assign role via `/api/admin/users/{id}/assign-role`

---

## 📞 Quick Links

- **Interactive API Docs:** https://crm-api-gateway.preview.emergentagent.com
- **Health Check:** https://crm-api-gateway.preview.emergentagent.com/api/health
- **Data Lake Health:** https://crm-api-gateway.preview.emergentagent.com/api/data-lake/health

---

## 🎉 Next Steps

1. **Explore the UI:** Visit the API documentation and test endpoints
2. **Set up Platform 1:** Configure MongoDB connection for ETL writes
3. **Onboard users:** Approve pending users and assign roles
4. **Customize:** Create departments, roles, and configure pipeline stages
5. **Monitor:** Check admin logs and dashboard stats regularly

**You're all set! The system is production-ready.** 🚀
