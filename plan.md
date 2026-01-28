# CRM KPI Management Platform - Development Plan

## Current Session - Feature Enhancements (IN PROGRESS)

### Task List

#### 1. Opportunities Page - Excel Export ⬜
- Add "Export to Excel" button on Opportunities page
- Export all visible opportunities with filters applied
- Include: Name, Account, Stage, Value, Product Category, Product Manager, Sales Rep, Won Date

#### 2. Dashboard Enhancements ⬜
- **Product Category Stats Cards**: Show deal counts & values by category
- **Product Manager Stats Cards**: Show deal counts & values by PM
- **Product Manager Leaderboard**: New section for PM performance (Won value)

#### 3. Invoice Analytics Improvements ⬜
For each Sales Person, show:
- Total Won value (for their deals)
- Billed during period
- Pending to be collected
- Overdue amounts

#### 4. Won Opportunities - Invoice Status ⬜
- Add invoice status indicator on Won opportunities
- Show: Paid/Pending/Overdue status
- Only visible for "Won" stage deals

#### 5. Account Cards Redesign ⬜
- Segregate Companies vs Contacts (two tabs/views)
- Group deals/invoices by year within account 360 view
- Show overdue invoice indicator on account cards
- **Red highlight border** on accounts with overdue invoices

#### 6. Fix Won Count Display ⬜
- Dashboard currently shows total opportunities (358) not Won count (170)
- Need to clearly separate these metrics

---

## Files to Modify

### Backend
- `/app/backend/services/dashboard_agg/routes.py` - Add PM leaderboard, category stats
- `/app/backend/services/crm_sales/routes.py` - Add export endpoint, account segregation
- `/app/backend/services/ai_analytics/routes.py` - Invoice analytics by salesperson

### Frontend
- `/app/frontend/src/components/crm/OpportunitiesPage.js` - Excel export, invoice status
- `/app/frontend/src/components/crm/DashboardPage.js` - PM leaderboard, category cards
- `/app/frontend/src/components/crm/AccountsPage.js` - Company/Contact tabs, overdue highlight
- `/app/frontend/src/components/crm/InvoicesPage.js` - Sales person analytics
- `/app/frontend/src/lib/api.js` - New API endpoints

---

## Previous Session - Won Date Filtering Fix (COMPLETED) ✅

### Issue Fixed: Won Deal Year Filtering Using Correct Date Field

**Problem:** The application was using `date_closed` for filtering Won deals by year, but in Odoo this field is often `None` for Won deals.

**Solution:**
1. Added `won_at` field mapping from Odoo's `date_last_stage_update`
2. Updated backend filtering logic to use `won_at` for Won deals
3. Added new custom fields: solution_category, product_manager, budget_status

**Results:**
| Period | Won Count | Won Value |
|--------|-----------|-----------|
| 2025 | 170 deals | OMR 8,695,988.55 |
| All Time | 395 deals | OMR 14,759,891.93 |

---

## Preview URL
https://fixmycrm.preview.emergentagent.com
