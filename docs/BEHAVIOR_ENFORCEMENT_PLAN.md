# Behavior Enforcement System - Low Level Execution Plan

## Context
Transform the Securado CRM from a **reporting tool** into a **behavior enforcement system**. The system currently tracks results but doesn't drive daily execution. This plan adds 5 enforcement mechanisms on top of the existing Performance Hub.

---

## FEATURE 1: Auto-Generated Activity Targets with PD Override

### What It Does
When CEO assigns a revenue target to a Product Director, the system auto-generates suggested activity targets using industry conversion formulas. PD can then modify, accept, or add more.

### Data Model
```
revenue_plan (existing) → auto_activity_suggestions (new)
```

New collection: `activity_suggestions`
```json
{
  "id": "uuid",
  "revenue_plan_id": "plan_123",
  "product_director_name": "Mohammed Tajuddin",
  "revenue_target": 600000,
  "suggestions": [
    {"activity_type": "Demo", "count": 20, "formula": "revenue / avg_deal_size * 3", "accepted": false},
    {"activity_type": "Proof of concept", "count": 6, "formula": "demos * 0.3", "accepted": false},
    {"activity_type": "Call", "count": 100, "formula": "demos * 5", "accepted": false},
    {"activity_type": "Meeting", "count": 40, "formula": "demos * 2", "accepted": false}
  ],
  "status": "pending_review",  // pending_review, accepted, modified
  "pipeline_coverage": 1800000  // revenue * 3
}
```

### Auto-Generation Formula
From Odoo historical data for this PD:
```
avg_deal_size = PD's won_amount / won_count  (from opportunities)
required_deals = revenue_target / avg_deal_size
demos_needed = required_deals / win_rate * 3  (funnel multiplier)
pocs_needed = demos_needed * 0.3
calls_needed = demos_needed * 5
meetings_needed = demos_needed * 2
pipeline_coverage = revenue_target * 3
```

### Backend Changes
- `POST /api/target-plans/revenue` → after creating plan, auto-generate suggestions
- `GET /api/target-plans/revenue/{id}/suggestions` → return auto-generated suggestions
- `POST /api/target-plans/revenue/{id}/suggestions/accept` → PD accepts/modifies and creates plan items
- Calculation uses PD's actual historical data from Odoo

### Frontend Changes
- After CEO assigns target, system shows "Suggested Activity Plan" card to PD
- PD sees each suggestion with the formula explanation
- PD can adjust counts, add/remove types, then click "Accept Plan"
- Accepted suggestions become `target_plan_items` (existing flow)

### Files to Modify
- `/app/backend/services/target_management/planning.py` - Add suggestion generation + endpoints
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Add suggestions UI in My Plan tab

---

## FEATURE 2: Revenue Cap Rule (Activity Enforcement)

### What It Does
If a PD's activity completion drops below 80%, their revenue achievement score is **capped at 70%**. Dashboard shows a lock indicator.

### Business Logic
```
activity_completion = sum(actual_activities) / sum(target_activities) * 100

if activity_completion < 80%:
    revenue_achievement = min(actual_revenue_pct, 70%)  // CAPPED
    show_lock_badge = true
    lock_reason = "Revenue capped due to low activity ({activity_completion}%)"
elif activity_completion < 50%:
    revenue_achievement = min(actual_revenue_pct, 40%)  // SEVERELY CAPPED
```

### Backend Changes
- `GET /api/target-actuals/my-data` → add `revenue_cap` object:
  ```json
  {
    "revenue_cap": {
      "is_capped": true,
      "cap_percentage": 70,
      "activity_completion": 65.3,
      "reason": "Activity completion 65.3% < 80% threshold",
      "uncapped_revenue_pct": 95.0,
      "effective_revenue_pct": 70.0
    }
  }
  ```
- `/api/target-actuals/multi-vector-incentive` → apply cap in calculation

### Frontend Changes
- PD "My Plan" tab: If capped, show red banner: "Revenue Locked Due to Low Activity (65%)"
- CEO View: Show lock icon on capped PDs
- Incentive tab: Show capped vs uncapped comparison

### Files to Modify
- `/app/backend/services/target_management/planning.py` - Add cap logic to my-data
- `/app/backend/services/target_management/planning.py` - Apply cap in incentive calc
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Lock badge UI

---

## FEATURE 3: Collection Escalation Workflow

### What It Does
Overdue invoices are automatically assigned to responsible parties based on aging buckets. System tracks ownership and escalates if unresolved.

### Escalation Rules
```
Day 0-30:   Finance team auto-reminder (system generates)
Day 31-45:  Assigned to Salesperson who owns the account
Day 46-60:  Escalated to Sales Director
Day 60+:    Flagged to CEO
```

### Data Model
New collection: `collection_escalations`
```json
{
  "id": "uuid",
  "invoice_id": "INV/2025/196",
  "account_name": "Omantel",
  "amount": 18900,
  "due_date": "2025-12-31",
  "days_overdue": 42,
  "current_bucket": "31-45",
  "assigned_to": "Nabisaheb",
  "assigned_role": "salesperson",
  "escalation_history": [
    {"bucket": "0-30", "assigned_to": "Finance", "date": "2026-01-01"},
    {"bucket": "31-45", "assigned_to": "Nabisaheb", "date": "2026-01-31"}
  ],
  "status": "open",  // open, contacted, promised, resolved, written_off
  "last_action_date": null,
  "notes": []
}
```

### Backend Changes
- `POST /api/collection/process-escalations` → scans all overdue invoices, creates/updates escalation records
- `GET /api/collection/my-escalations` → returns escalations assigned to current user
- `PATCH /api/collection/escalations/{id}/update-status` → salesperson updates status
- Auto-run on each API call or via scheduled trigger

### Frontend Changes
- Salesperson "My Targets" tab: New "My Collections" section showing assigned overdue invoices
- Each invoice shows days overdue, amount, account, and status update buttons
- Sales Director sees all escalations in their scope
- CEO sees Day 60+ flagged invoices prominently
- Collection tab: Add escalation status column to invoice drill popup

### Salesperson Dashboard Impact
```
🔴 "You have 3 overdue invoices (OMR 45,000) requiring action"
   - Omantel: OMR 18,900 (42 days overdue) → [Contact] [Promise] [Resolve]
   - Al Anwar: OMR 15,000 (35 days overdue) → [Contact] [Promise] [Resolve]
```

### Files to Create
- `/app/backend/services/target_management/collections.py` - Escalation engine
- Frontend: Add to PerformanceHubPage.js My Targets tab

---

## FEATURE 4: Sales Director KPI Targets

### What It Does
Sales Director gets 3 mandatory KPIs that auto-calculate from their team's performance.

### KPI Structure
```
SD Score = (Team Revenue Achievement × 40%) 
         + (Team Activity Adherence × 30%) 
         + (Collection Enablement × 30%)
```

### Calculations
```
Team Revenue Achievement:
  = sum(all PD revenue actuals) / sum(all PD revenue targets) × 100

Team Activity Adherence:
  = sum(all plan item actuals) / sum(all plan item targets) × 100

Collection Enablement:
  = 100 - (overdue_invoices_over_45_days / total_invoices × 100)
  If overdue > 15%, auto-penalty applied
```

### Backend Changes
- `GET /api/target-actuals/sd-scorecard` → returns SD's 3 KPIs with breakdown
- Uses existing revenue plans, plan items, and invoice data
- No new collections needed - pure computation from existing data

### Frontend Changes
- CEO View: Add SD scorecard card showing 3 KPIs with RAG status
- SD-specific tab (if SD logs in): Shows their own scorecard

### Files to Modify
- `/app/backend/services/target_management/planning.py` - Add sd-scorecard endpoint
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Add scorecard to CEO View

---

## FEATURE 5: CEO Single-Screen Summary (RAG Signals)

### What It Does
One screen showing 5 RAG (Red/Amber/Green) signals with auto-generated root cause text.

### Signals
```
1. Revenue vs Plan    → Green if >80%, Amber if 50-80%, Red if <50%
2. Activity Coverage  → Green if >80%, Amber if 50-80%, Red if <50%
3. Collections Health → Green if overdue <10%, Amber 10-25%, Red >25%
4. Pipeline Coverage  → Green if >3x, Amber 2-3x, Red <2x
5. Team Execution     → Green if SD score >80%, Amber 50-80%, Red <50%
```

### Auto-Generated Insight
```
"Revenue risk is driven by low activity in Network Security (45%) 
and overdue invoices from Omantel (OMR 18,900, 42 days)"
```

### Backend Changes
- `GET /api/target-actuals/ceo-summary` → returns 5 signals + insight text
- Aggregates from existing data, no new collections

### Frontend Changes
- New "Executive Summary" card at top of CEO View
- 5 colored dots with labels
- One-line auto-insight below
- Click any signal → drills into detail

### Files to Modify
- `/app/backend/services/target_management/planning.py` - Add ceo-summary endpoint
- `/app/frontend/src/components/crm/PerformanceHubPage.js` - Add summary card

---

## IMPLEMENTATION ORDER

### Phase 1 (Highest Impact)
1. **Auto-generate activity suggestions** when revenue plan created
2. **Revenue cap rule** (activity < 80% → revenue capped at 70%)
3. **CEO RAG summary** (5 signals + auto-insight)

### Phase 2
4. **Collection escalation workflow** (aging buckets + auto-assignment)
5. **Sales Director scorecard** (3 KPIs)

### Phase 3 (Future)
6. Service Delivery utilization KPI (needs man-days data from Odoo)
7. PD execution widgets (Revenue Planned vs Delivered vs Invoiced)

---

## ESTIMATED CHANGES

| Feature | Backend Lines | Frontend Lines | New Collections |
|---------|-------------|---------------|----------------|
| Auto Activity Suggestions | ~100 | ~80 | activity_suggestions |
| Revenue Cap Rule | ~50 | ~30 | None |
| Collection Escalation | ~150 | ~100 | collection_escalations |
| SD Scorecard | ~80 | ~50 | None |
| CEO RAG Summary | ~100 | ~60 | None |
| **Total** | **~480** | **~320** | **2 new** |
