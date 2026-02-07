# RBAC Quick Test Reference Card
## For Claude Bot Chrome Extension Testing

**App URL**: https://permission-audit-2.preview.emergentagent.com

---

## 🔐 Test Credentials

```
SYSTEM ADMIN (Full Access + ETL):
  Email: krishna@securado.net
  Password: test123456

CEO (Full CRM, No ETL):
  Email: ceo@test.securado.com
  Password: test123456

SALES USER (Own Records Only):
  Email: sales@test.securado.com
  Password: test123456

SALES DIRECTOR (All CRM, No ETL):
  Email: sales.director@test.securado.com
  Password: test123456

FINANCE MANAGER (Invoices Only):
  Email: finance@test.securado.com
  Password: test123456

PRESALES (All CRM Read):
  Email: presales@test.securado.com
  Password: test123456

PRODUCT DIRECTOR (All CRM, No ETL):
  Email: product.director@test.securado.com
  Password: test123456
```

---

## ✅ Quick Validation Checklist

### System Admin (krishna@securado.net)
- [ ] Can see ETL Platform section in sidebar
- [ ] Can access /etl/connections
- [ ] Can see Admin section (Users, Roles, Settings)
- [ ] Dashboard shows ALL data

### CEO (ceo@test.securado.com)
- [ ] NO ETL Platform in sidebar
- [ ] NO Admin section (except Help)
- [ ] Full CRM access - ALL menu items visible
- [ ] Opportunities shows ALL ~1350+ records
- [ ] Invoices shows ALL ~300+ records

### Sales User (sales@test.securado.com)
- [ ] NO ETL Platform in sidebar
- [ ] NO Admin section (except Help)
- [ ] Opportunities shows ONLY ~10 own records
- [ ] NO Invoices menu item

### Sales Director (sales.director@test.securado.com)
- [ ] NO ETL Platform in sidebar
- [ ] Has full CRM access
- [ ] Opportunities shows ALL ~1350+ records
- [ ] Invoices shows ALL ~300+ records

### Finance Manager (finance@test.securado.com)
- [ ] NO ETL Platform in sidebar
- [ ] NO Opportunities, Leads, Activities
- [ ] HAS Invoices access (ALL records)
- [ ] HAS Accounts access

---

## 🎯 Key Test Points

### ETL Platform Access Test
```
ONLY krishna@securado.net should see:
├── ETL PLATFORM (section header)
│   ├── Connections
│   ├── Model Browser
│   ├── Mappings
│   ├── Data Model
│   └── Pipelines
```

### Data Filtering Test
```
Opportunities Count:
├── System Admin: ~1350+ (all)
├── Sales Director: ~1350+ (all)
├── Sales User: ~10 (own only)
├── Finance: 0 (no access)
└── Presales: ~1350+ (all)

Invoices Count:
├── System Admin: ~300+ (all)
├── Sales Director: ~300+ (all)
├── Sales User: 0 (no access)
├── Finance: ~300+ (all)
└── Presales: ~300+ (all)
```

---

## 🔴 Critical Failure Points

1. **FAIL if**: Non-admin user can see ETL Platform section
2. **FAIL if**: Sales User can see other users' opportunities
3. **FAIL if**: Finance can see Opportunities page
4. **FAIL if**: Any user can access /etl/* URLs without system_admin

---

## 📸 Required Screenshots

1. Login page
2. System Admin sidebar (showing ETL section)
3. Sales User sidebar (NO ETL section)
4. Sales Director opportunities (ALL records)
5. Sales User opportunities (OWN records only)
6. Finance sidebar (limited menu)
7. Finance invoices page (full access)

---

## 🔧 Troubleshooting

If login fails:
- Check if backend is running: `supervisorctl status`
- Verify user exists in database
- Clear browser cache/cookies

If permissions wrong:
- Check /api/odoo-rbac/current-user-rbac response
- Verify effective_permissions array
- Check for system_admin permission

---

**Version**: 1.0 | **Date**: Feb 2026
