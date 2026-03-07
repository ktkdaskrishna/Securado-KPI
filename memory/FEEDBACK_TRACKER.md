# Feedback Tracker

## Last Reviewed: 2026-03-07

## Resolved Feedback (Completed)
| # | Title | Module | Priority | Resolution |
|---|-------|--------|----------|------------|
| 1 | Export feature is broken (TEST) | general | high | Test-generated feedback |
| 2 | Bug in dashboard chart loading (TEST) | dashboard | high | Test-generated feedback |
| 3 | Bug in export feature (TEST) | general | high | Test-generated feedback |
| 4 | Bug in dashboard chart not loading (TEST) | dashboard | high | Test-generated feedback |
| 5 | Performance Hub - Target Segmentation | Performance Hub | medium | Completed in Performance Hub v2.1 |
| 6 | Additional Feature - Enable Target Segmentation | Performance Hub | medium | Completed in Performance Hub v2.1 |
| 7 | Dashboard cards show 0 for director role | Dashboard | high | Fixed: RBAC resolve_hierarchy_filter now grants broad access to product_director/sales_director roles + fixed admin_patterns matching |
| 8 | 2026 Invoice dashboard and data zero | Invoices | high | Fixed: Same RBAC fix as #7. Invoice cards now show data. No 2026-dated invoices exist in DB (data gap, not code bug) |
| 9 | SSO MSAL flow not persisting roles | Auth | critical | Fixed: _handle_msal_complete now derives and persists roles/permissions for existing users |

## Open Real Bugs (2 remaining)
| # | Title | Module | Priority | Status | Notes |
|---|-------|--------|----------|--------|-------|
| 1 | Activity Logs are missing under opportunity | Opportunities | high | approved | No activity data exists in DB - Odoo sync needs to pull mail.activity data |
| 2 | Account Alert on paid account showing overdue | Accounts | medium | needs-verification | Code logic appears correct (excludes paid invoices). May need specific reproduction steps from user |
