# Securado CRM - Product Requirements Document

## What's Implemented

### Performance Hub + Role Fixes (Latest)
- **Product Director role** added to system (Tajuddin: taj@securado.net)
- **view_goals permission** added to ALL Odoo group levels (user/manager/director/admin)
- Both Tajuddin (PD) and Nabisaheb (Sales) now see Performance Hub
- RBAC merges Odoo groups + app roles for comprehensive permission resolution
- Roles page shows Product Director with correct user count

### All Previous Features
- Performance Hub (7 tabs + Alert Center)
- Analytics-driven target planning (CEO → PM → SD → Salesperson)
- Multi-vector incentive calculation
- RBAC route protection (frontend + backend)
- Opportunities pagination, Login error, OMR currency fix, Theme consistency

## User Credentials
| Name | Email | Password | Role |
|------|-------|----------|------|
| Krishnadas KT | krishna@securado.net | test123456 | Admin |
| Mohammed Tajuddin | taj@securado.net | test123456 | Product Director |
| Nabisaheb | nabisaheb@securado.net | test123456 | Sales Rep |

## Key RBAC Note
- "Product Manager" in Odoo = "Product Director" in our system
- Odoo groups + app-level roles are merged for permission resolution
- APP_ROLE_PERMS constant in odoo_rbac/routes.py defines all role→permission mappings
