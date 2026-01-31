# Platform 2 - User Management & Database Configuration Guide

## 📋 Table of Contents
1. [User Management](#user-management)
2. [Platform 1 Database Connection](#platform-1-database-connection)
3. [Public MongoDB Access](#public-mongodb-access)
4. [Security Best Practices](#security-best-practices)

---

## 👥 User Management

### Overview
Platform 2 implements a comprehensive user management system with approval workflow, role-based access control (RBAC), and department organization.

### User Lifecycle

#### 1. User Registration (Self-Service)
Users can register themselves, but they start in **PENDING** status:

**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "email": "john.doe@company.com",
  "name": "John Doe",
  "password": "SecurePassword123!",
  "org_id": "your_org_id"
}
```

**Response:**
```json
{
  "id": "user_uuid",
  "email": "john.doe@company.com",
  "name": "John Doe",
  "status": "pending",
  "org_id": "your_org_id",
  "roles": [],
  "created_at": "2024-01-26T00:00:00Z"
}
```

**Status:** User **CANNOT** login until approved by admin.

---

#### 2. Admin Approval Workflow

**Step 1: List Pending Users**
```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users?status=pending
```

**Step 2: Approve User**
```bash
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users/{user_id}/approve
```

**Step 3: Assign Roles**
```bash
curl -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"role": "sales_rep"}' \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users/{user_id}/assign-role
```

**Step 4: Assign Department**
```bash
curl -X PUT -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"department_id": "dept_uuid"}' \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users/{user_id}
```

---

#### 3. Bulk User Management

**Bulk Role Assignment:**
```bash
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_ids": ["user1_id", "user2_id", "user3_id"],
    "role": "sales_rep"
  }' \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users/bulk-assign-role
```

**Bulk Department Assignment:**
```bash
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_ids": ["user1_id", "user2_id"],
    "department_id": "sales_dept_id"
  }' \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users/bulk-assign-department
```

---

### Role-Based Access Control (RBAC)

#### Pre-Configured Roles

**1. Superadmin**
- Full system access
- Permissions: `["*"]`
- Default account: `admin@platform2.com`

**2. Admin**
- Full access to all modules
- Permissions: `["*"]`

**3. Sales Manager**
- Permissions: `["opportunities:*", "activities:*", "dashboard:read"]`
- Can manage opportunities and activities
- Can view dashboards

**4. Sales Rep**
- Permissions: `["opportunities:read", "opportunities:update", "activities:*"]`
- Can view and update opportunities
- Can manage activities

#### Create Custom Roles

**Endpoint:** `POST /api/admin/roles`

```json
{
  "name": "customer_success_manager",
  "description": "Customer Success Manager",
  "permissions": [
    "accounts:read",
    "accounts:update",
    "activities:*",
    "opportunities:read"
  ]
}
```

#### List All Roles
```bash
curl -H "Authorization: Bearer <TOKEN>" \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/roles
```

---

### Department Management

#### Create Department
```bash
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Sales - North America",
    "description": "North American sales team",
    "parent_id": null
  }' \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/departments
```

#### List Departments
```bash
curl -H "Authorization: Bearer <TOKEN>" \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/departments
```

---

### User Management Workflow Example

**Complete workflow for onboarding a new sales representative:**

```bash
# 1. User self-registers
curl -X POST -H "Content-Type: application/json" \\
  -d '{
    "email": "jane@company.com",
    "name": "Jane Smith",
    "password": "Secure123!"
  }' \\
  https://secure-analytics-3.preview.emergentagent.com/api/auth/register

# 2. Admin logs in
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \\
  -d '{"email":"admin@platform2.com","password":"admin123"}' \\
  https://secure-analytics-3.preview.emergentagent.com/api/auth/login | jq -r '.access_token')

# 3. Admin lists pending users
curl -H "Authorization: Bearer $TOKEN" \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users?status=pending

# 4. Admin approves user (get USER_ID from step 3)
curl -X POST -H "Authorization: Bearer $TOKEN" \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users/{USER_ID}/approve

# 5. Admin assigns sales_rep role
curl -X PATCH -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users/{USER_ID}/assign-role?role=sales_rep

# 6. User can now login
curl -X POST -H "Content-Type: application/json" \\
  -d '{"email":"jane@company.com","password":"Secure123!"}' \\
  https://secure-analytics-3.preview.emergentagent.com/api/auth/login
```

---

## 🔌 Platform 1 Database Connection

### Overview
Platform 1 (ETL) writes transformed data to a **Canonical MongoDB** that Platform 2 reads from (READ-ONLY).

### Connection Details for Platform 1

#### Development/Testing Environment
```
MongoDB Connection String: mongodb://localhost:27017
Database Name: platform1_canonical
```

#### For Public Access (Production)
You need to expose MongoDB publicly and secure it properly.

---

## 🌍 Public MongoDB Access Configuration

### Option 1: MongoDB Atlas (Recommended for Production)

**Steps:**
1. Create MongoDB Atlas cluster: https://www.mongodb.com/cloud/atlas
2. Configure IP Whitelist (add Platform 1's IP)
3. Create database user with appropriate permissions
4. Get connection string

**Connection String Format:**
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/platform1_canonical?retryWrites=true&w=majority
```

**Platform 2 Configuration:**
Update `/app/backend/.env`:
```env
CANONICAL_MONGO_URL="mongodb+srv://username:password@cluster.mongodb.net"
CANONICAL_DB_NAME="platform1_canonical"
```

**Platform 1 Configuration:**
Platform 1 uses the same connection string to write data.

---

### Option 2: Self-Hosted MongoDB with Public Access

#### Step 1: Install MongoDB on Public Server
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Step 2: Configure for Remote Access

Edit MongoDB config: `/etc/mongod.conf`
```yaml
net:
  port: 27017
  bindIp: 0.0.0.0  # Allow connections from any IP

security:
  authorization: enabled
```

#### Step 3: Create Database Users

**Connect to MongoDB:**
```bash
mongosh
```

**Create Admin User:**
```javascript
use admin
db.createUser({
  user: "admin",
  pwd: "secure_admin_password",
  roles: ["root"]
})
```

**Create Platform 1 User (Write Access):**
```javascript
use platform1_canonical
db.createUser({
  user: "platform1_writer",
  pwd: "secure_platform1_password",
  roles: [
    { role: "readWrite", db: "platform1_canonical" }
  ]
})
```

**Create Platform 2 User (Read-Only):**
```javascript
use platform1_canonical
db.createUser({
  user: "platform2_reader",
  pwd: "secure_platform2_password",
  roles: [
    { role: "read", db: "platform1_canonical" }
  ]
})
```

#### Step 4: Configure Firewall
```bash
# Allow MongoDB port
sudo ufw allow 27017/tcp

# Or restrict to specific IPs
sudo ufw allow from <PLATFORM1_IP> to any port 27017
sudo ufw allow from <PLATFORM2_IP> to any port 27017
```

#### Step 5: Restart MongoDB
```bash
sudo systemctl restart mongod
```

---

### Connection Strings for Each System

**Platform 1 (ETL - Write Access):**
```
mongodb://platform1_writer:secure_platform1_password@<PUBLIC_IP>:27017/platform1_canonical?authSource=platform1_canonical
```

**Platform 2 (API - Read-Only):**
```
mongodb://platform2_reader:secure_platform2_password@<PUBLIC_IP>:27017/platform1_canonical?authSource=platform1_canonical
```

---

### Canonical Data Schema

Platform 1 can write data in two supported layouts:

#### Layout 1: Single Collection (Envelope Style)

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
    "account_id": "acc_789",
    "close_date": "2024-12-31"
  },
  "updated_at": "2024-01-26T10:30:00Z",
  "org_id": "default_org",
  "source_refs": [
    {
      "system": "salesforce",
      "id": "006ABC123"
    }
  ]
}
```

**Configuration in Platform 2:**
```env
CANONICAL_LAYOUT="single_collection"
CANONICAL_COLLECTION="data_lake_canonical"
```

---

#### Layout 2: Per-Entity Collections

**Collections:**
- `silver_opportunities`
- `silver_accounts`
- `silver_contacts`
- `silver_activities`

**Document Structure (Flat):**
```json
{
  "canonical_id": "opp_12345",
  "name": "Acme Corp Deal",
  "stage": "Proposal",
  "value": 50000,
  "probability": 75,
  "owner": "john@company.com",
  "account_id": "acc_789",
  "close_date": "2024-12-31",
  "updated_at": "2024-01-26T10:30:00Z",
  "org_id": "default_org",
  "source_refs": [
    {
      "system": "salesforce",
      "id": "006ABC123"
    }
  ]
}
```

**Configuration in Platform 2:**
```env
CANONICAL_LAYOUT="per_entity"
CANONICAL_ENTITY_COLLECTION_PREFIX="silver_"
```

---

### Platform 1 Integration Checklist

**✅ Before Platform 1 Writes Data:**

1. **MongoDB Setup:**
   - [ ] MongoDB accessible from Platform 1
   - [ ] Database `platform1_canonical` created
   - [ ] User with write permissions created
   - [ ] Connection tested from Platform 1

2. **Choose Layout:**
   - [ ] Decide: single collection OR per-entity
   - [ ] Update Platform 2 `.env` with correct layout

3. **Create Indexes (Recommended):**
   ```javascript
   // For single_collection layout
   db.data_lake_canonical.createIndex({ "entity_type": 1, "org_id": 1 })
   db.data_lake_canonical.createIndex({ "canonical_id": 1, "org_id": 1 })
   db.data_lake_canonical.createIndex({ "updated_at": -1 })
   
   // For per_entity layout
   db.silver_opportunities.createIndex({ "canonical_id": 1, "org_id": 1 })
   db.silver_opportunities.createIndex({ "org_id": 1, "updated_at": -1 })
   ```

4. **Test Connection:**
   ```bash
   curl https://secure-analytics-3.preview.emergentagent.com/api/data-lake/health
   ```

5. **Write Test Data:**
   Platform 1 writes a test record to verify connectivity

6. **Verify in Platform 2:**
   ```bash
   curl -H "Authorization: Bearer <TOKEN>" \\
     "https://secure-analytics-3.preview.emergentagent.com/api/data-lake/canonical?entity_type=opportunities"
   ```

---

## 🔒 Security Best Practices

### 1. MongoDB Security

**✅ Always Enable Authentication:**
```yaml
security:
  authorization: enabled
```

**✅ Use Strong Passwords:**
- Minimum 20 characters
- Mix of uppercase, lowercase, numbers, symbols

**✅ Principle of Least Privilege:**
- Platform 1: Only `readWrite` on canonical DB
- Platform 2: Only `read` on canonical DB

**✅ Enable SSL/TLS:**
```yaml
net:
  ssl:
    mode: requireSSL
    PEMKeyFile: /path/to/mongodb.pem
```

**✅ IP Whitelisting:**
Only allow connections from known IPs:
```bash
# In firewall
sudo ufw allow from <PLATFORM1_IP> to any port 27017
sudo ufw allow from <PLATFORM2_IP> to any port 27017
sudo ufw deny 27017
```

---

### 2. Platform 2 API Security

**✅ Change Default JWT Secret:**
```env
JWT_SECRET="your-very-long-and-secure-secret-key-minimum-32-characters"
```

**✅ Change Default Admin Password:**
```bash
# After first login, change password via API
curl -X PUT -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"password": "NewSecurePassword123!"}' \\
  https://secure-analytics-3.preview.emergentagent.com/api/admin/users/{admin_user_id}
```

**✅ Use HTTPS:**
- Deploy behind SSL/TLS termination
- Enforce HTTPS redirects

**✅ Rate Limiting:**
Consider adding rate limiting middleware to prevent brute force attacks.

**✅ Regular Security Audits:**
- Review user permissions quarterly
- Check admin logs regularly
- Rotate JWT secrets periodically

---

### 3. Network Security

**✅ VPC/Private Network:**
If possible, keep MongoDB in private network and use VPN for access.

**✅ Bastion Host:**
Use bastion/jump host for MongoDB admin access.

**✅ Monitoring:**
- Enable MongoDB logging
- Monitor failed authentication attempts
- Set up alerts for suspicious activity

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue 1: Platform 2 Cannot Connect to Canonical MongoDB**
```bash
# Check connectivity
curl https://secure-analytics-3.preview.emergentagent.com/api/data-lake/health

# Expected response:
{
  "status": "healthy",
  "canonical_db": "connected",
  "message": "Data lake is accessible"
}
```

**Solution:**
- Verify MongoDB is running: `sudo systemctl status mongod`
- Check firewall rules
- Verify credentials in `.env`
- Test connection from server: `mongosh "mongodb://user:pass@host:27017/platform1_canonical"`

---

**Issue 2: Platform 1 Cannot Write Data**
**Solution:**
- Verify user has `readWrite` role
- Check if database exists
- Verify collection naming matches Platform 2 config
- Check Platform 1 logs for errors

---

**Issue 3: Users Cannot Login After Registration**
**Solution:**
- Check user status: `GET /api/admin/users`
- If status is "pending", approve user: `POST /api/admin/users/{user_id}/approve`
- Assign roles after approval

---

**Issue 4: No Canonical Data Visible**
**Solution:**
- Check if Platform 1 has written data
- Verify `CANONICAL_LAYOUT` setting matches data structure
- Test directly in MongoDB:
  ```javascript
  use platform1_canonical
  db.data_lake_canonical.find().limit(1)
  // or
  db.silver_opportunities.find().limit(1)
  ```

---

## 🎯 Quick Reference

### Essential Endpoints

**User Management:**
- List users: `GET /api/admin/users`
- Approve user: `POST /api/admin/users/{id}/approve`
- Assign role: `PATCH /api/admin/users/{id}/assign-role`

**Data Lake:**
- Health check: `GET /api/data-lake/health`
- Browse data: `GET /api/data-lake/canonical?entity_type=opportunities`

**Authentication:**
- Login: `POST /api/auth/login`
- Register: `POST /api/auth/register`
- Get current user: `GET /api/auth/me`

### Default Credentials

**Superadmin:**
- Email: `admin@platform2.com`
- Password: `admin123`
- **⚠️ Change this immediately in production!**

---

## 📚 Additional Resources

- **API Documentation UI:** https://secure-analytics-3.preview.emergentagent.com
- **Full Platform Documentation:** `/app/backend/PLATFORM2_COMPLETE.md`
- **Receiving Connector Details:** `/app/backend/RECEIVING_CONNECTOR.md`
- **MongoDB Documentation:** https://docs.mongodb.com/

---

**Need Help?**
Check the API documentation UI for interactive testing and examples of all endpoints.
