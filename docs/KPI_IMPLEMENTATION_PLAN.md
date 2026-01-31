# KPI & Goal Management System - Implementation Plan

**Version:** 1.0  
**Created:** January 31, 2026  
**Status:** APPROVED FOR IMPLEMENTATION

---

## 📊 System Overview

### Organizational Hierarchy (Corrected)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      COMPANY-WIDE KPIs                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   SALES DEPT     │  │  MARKETING DEPT  │  │ PRODUCT DIRECTORS │  │
│  │                  │  │                  │  │                   │  │
│  │  Sales Director  │  │  Marketing Head  │  │  Product Director │  │
│  │       ↓          │  │       ↓          │  │        ↓          │  │
│  │  Sales Managers  │  │  Marketing Team  │  │  PRE-SALES TEAM   │  │
│  │       ↓          │  │    Members       │  │    (Owned by PD)  │  │
│  │  Salespersons    │  │                  │  │                   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
│  Target Rollup: Individual → Manager → Director → Company            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 KPI Categories by Department

### 1. Sales Department KPIs

| KPI Type | Source | Tracked By | Rollup |
|----------|--------|------------|--------|
| **Booking Target** | Odoo `employee.sales.kpi` | Salesperson | → Manager → Director |
| **Billing Target** | Odoo `employee.sales.kpi` | Salesperson | → Manager → Director |
| **Collection Target** | Odoo `employee.sales.kpi` | Salesperson | → Manager → Director |
| **Activities Count** | Odoo `mail.activity` | Salesperson | → Manager → Director |
| **Meetings Conducted** | Odoo `calendar.event` | Salesperson | Count per period |
| **Tasks Completed** | Odoo `project.task` | Salesperson | Count per period |
| **Win Rate** | Calculated | Salesperson | Weighted average |

**KPI Assignment Flow:**
```
Head of Sales → Sets targets for Sales Managers
Sales Manager → Sets targets for Salespersons
Salesperson → Executes and tracks progress
```

### 2. Product Director KPIs (Owns Pre-Sales Team)

| KPI Type | Source | Tracked By | Rollup |
|----------|--------|------------|--------|
| **POCs Delivered** | Activities (type=POC) | Pre-Sales | → Product Director |
| **Demos Conducted** | Activities (type=Demo) | Pre-Sales | → Product Director |
| **Technical Workshops** | Activities (type=Workshop) | Pre-Sales | → Product Director |
| **Marketing Events** | Odoo `event.event` | Product Director | Count per period |
| **Brand Visibility Score** | Calculated | Product Director | Composite score |
| **Pipeline Contribution** | Opportunities | Pre-Sales | → Product Director |
| **Account Coverage** | Accounts touched | Pre-Sales | → Product Director |

**KPI Assignment Flow:**
```
Product Director → Creates Target Sheet
Product Director → Defines activities needed (POCs, Demos, etc.)
Product Director → Assigns to Pre-Sales Team members
Pre-Sales Team → Executes activities
Activities → Sync back to Odoo CRM
```

### 3. Marketing Department KPIs

| KPI Type | Source | Tracked By | Rollup |
|----------|--------|------------|--------|
| **Campaigns Delivered** | Odoo `mailing.mailing` | Marketing Member | → Marketing Head |
| **Events Organized** | Odoo `event.event` | Marketing Member | → Marketing Head |
| **Lead Generation** | Opportunities (source) | Campaign | Count per campaign |
| **Email Open Rate** | Odoo `mailing.trace` | Campaign | Average |
| **Engagement Score** | Calculated | Campaign | Composite |

**KPI Assignment Flow:**
```
Marketing Head → Sets campaign goals
Product Directors → Request marketing support (mutual goals)
Marketing Team → Executes campaigns
Results → Tracked and attributed
```

---

## 📐 Data Architecture

### New Database Collections

```javascript
// 1. Goal Definitions
db.goals = {
  id: "uuid",
  org_id: "string",
  name: "string",
  description: "string",
  type: "sales_target|activity_target|task_target|campaign_target",
  department: "sales|marketing|product|presales",
  
  // Target configuration
  target_type: "monetary|count|percentage|score",
  target_value: Number,
  target_unit: "OMR|count|%|score",
  
  // Time period
  period_type: "monthly|quarterly|yearly",
  start_date: Date,
  end_date: Date,
  
  // Assignment
  assigned_to: "user_id",
  assigned_by: "user_id",
  assigned_to_name: "string",
  assigned_by_name: "string",
  
  // Hierarchy
  parent_goal_id: "uuid",  // For rollup
  child_goal_ids: ["uuid"],
  rollup_method: "sum|average|weighted",
  
  // Progress tracking
  current_value: Number,
  progress_percentage: Number,
  status: "not_started|in_progress|at_risk|achieved|exceeded",
  
  // Activity generation
  generates_activities: Boolean,
  activity_template: {
    type: "meeting|call|demo|poc|workshop",
    count: Number,
    per_period: "week|month|quarter"
  },
  
  // Odoo sync
  odoo_goal_id: Number,
  sync_to_odoo: Boolean,
  last_synced: Date,
  
  created_at: Date,
  updated_at: Date
}

// 2. KPI Snapshots (Cached metrics)
db.kpi_snapshots = {
  id: "uuid",
  org_id: "string",
  user_id: "string",
  user_name: "string",
  department: "string",
  
  period: "2026-Q1",
  snapshot_date: Date,
  
  // Sales KPIs (from Odoo)
  booking_target: Number,
  booking_actual: Number,
  billing_target: Number,
  billing_actual: Number,
  collection_target: Number,
  collection_actual: Number,
  
  // Activity KPIs
  meetings_target: Number,
  meetings_actual: Number,
  demos_target: Number,
  demos_actual: Number,
  pocs_target: Number,
  pocs_actual: Number,
  
  // Derived metrics
  achievement_percentage: Number,
  trend: "improving|stable|declining",
  
  created_at: Date
}

// 3. Goal Activities (Link goals to CRM activities)
db.goal_activities = {
  id: "uuid",
  goal_id: "uuid",
  activity_type: "meeting|call|demo|poc|workshop|task",
  
  // Activity details
  title: "string",
  description: "string",
  assigned_to: "user_id",
  due_date: Date,
  status: "pending|completed|cancelled",
  completed_at: Date,
  
  // Linked entities
  opportunity_id: "string",
  account_id: "string",
  
  // Odoo sync
  odoo_activity_id: Number,
  synced_to_odoo: Boolean,
  sync_error: "string",
  
  created_at: Date,
  updated_at: Date
}

// 4. Target Sheets (Product Director Planning)
db.target_sheets = {
  id: "uuid",
  org_id: "string",
  owner_id: "user_id",  // Product Director
  owner_name: "string",
  
  name: "string",
  period: "2026-Q1",
  status: "draft|active|completed",
  
  // Targets breakdown
  targets: [{
    category: "poc|demo|workshop|event|meeting",
    target_count: Number,
    assigned_to: ["user_ids"],  // Pre-sales team
    distribution: "equal|weighted|manual"
  }],
  
  // AI Planning data
  ai_suggestions: {
    generated_at: Date,
    recommendations: [String],
    risk_factors: [String]
  },
  
  // Approval workflow
  approved_by: "user_id",
  approved_at: Date,
  
  created_at: Date,
  updated_at: Date
}
```

### API Endpoints

```
# Goal Management
POST   /api/goals                    - Create goal
GET    /api/goals                    - List goals (RBAC filtered)
GET    /api/goals/{id}               - Get goal details
PUT    /api/goals/{id}               - Update goal
DELETE /api/goals/{id}               - Delete goal
POST   /api/goals/{id}/assign        - Assign goal to user
POST   /api/goals/{id}/cascade       - Cascade to team (rollup)

# KPI Dashboard
GET    /api/kpis/my-kpis             - Current user's KPIs
GET    /api/kpis/team-kpis           - Team KPIs (for managers)
GET    /api/kpis/department/{dept}   - Department KPIs
GET    /api/kpis/leaderboard         - KPI leaderboard
GET    /api/kpis/trends              - KPI trends over time

# Goal Activities
POST   /api/goals/{id}/activities    - Generate activities from goal
GET    /api/goals/{id}/activities    - List goal activities
PUT    /api/goal-activities/{id}     - Update activity status
POST   /api/goal-activities/{id}/sync - Sync to Odoo

# Target Sheets (Product Directors)
POST   /api/target-sheets            - Create target sheet
GET    /api/target-sheets            - List target sheets
PUT    /api/target-sheets/{id}       - Update target sheet
POST   /api/target-sheets/{id}/ai-plan - Generate AI planning suggestions
POST   /api/target-sheets/{id}/distribute - Distribute to pre-sales

# Sync
POST   /api/kpis/sync                - Sync KPIs from Odoo
GET    /api/kpis/sync/status         - Get sync status
```

---

## 🖥️ UI Components

### 1. KPI Dashboard Page (`/kpis`)

```
┌─────────────────────────────────────────────────────────────────┐
│  KPI Dashboard                              [Period: Q1 2026 ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Booking  │ │Billing  │ │Collection│ │Activities│ │Win Rate │   │
│  │ 85%     │ │ 72%     │ │ 68%      │ │ 120/150  │ │ 42%     │   │
│  │▲ +12%   │ │▼ -5%    │ │▲ +8%    │ │▲ +15    │ │→ 0%     │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                                  │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │ Target Achievement          │ │ Team Performance            ││
│  │ [Progress Chart]            │ │ [Leaderboard]               ││
│  │                             │ │ 1. Nabisaheb - 95%          ││
│  │                             │ │ 2. Vyshnav - 88%            ││
│  └─────────────────────────────┘ └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2. Goal Management Page (`/goals`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Goals & Targets                    [+ Create Goal] [Sync Odoo] │
├─────────────────────────────────────────────────────────────────┤
│  Tabs: [My Goals] [Team Goals] [Assigned by Me] [All Goals]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Q1 2026 Booking Target                         [In Progress]││
│  │ Target: OMR 200,000  |  Current: OMR 170,000  |  Progress: 85%│
│  │ Assigned by: Ravi Chandran  |  Due: Mar 31, 2026            ││
│  │ Activities: 5/8 completed                                    ││
│  │ [View Details] [Update Progress] [Generate Activities]       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Monthly Demo Target                            [At Risk]     ││
│  │ Target: 10 demos  |  Current: 4 demos  |  Progress: 40%     ││
│  │ Assigned by: Product Director  |  Due: Jan 31, 2026         ││
│  │ [View Details] [Log Activity]                                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3. Target Sheet Builder (Product Directors) (`/target-sheets`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Target Sheet: Q1 2026 Pre-Sales Plan             [Draft ▼]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Activity Targets                              [+ Add Target]│ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ POCs          │ Target: 15  │ Assigned: 3 team members     │ │
│  │ Demos         │ Target: 25  │ Assigned: 4 team members     │ │
│  │ Workshops     │ Target: 5   │ Assigned: 2 team members     │ │
│  │ Site Visits   │ Target: 10  │ Assigned: All                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ AI Planning Assistant                    [💬 Open Chat]    │ │
│  │ "Based on last quarter, I recommend increasing demos by    │ │
│  │  20%. Account XYZ needs 3 POCs to close the deal."         │ │
│  │ [Accept Suggestion] [Modify] [Dismiss]                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Save Draft] [Distribute to Team] [Submit for Approval]        │
└─────────────────────────────────────────────────────────────────┘
```

### 4. AI Planning Chat (`/target-sheets/{id}/ai-chat`)

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Planning Assistant                                    [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🤖 Based on your Q4 2025 performance:                          │
│     - POC-to-Win conversion: 35%                                │
│     - Average deal size: OMR 45,000                             │
│     - Target accounts with open opportunities: 12               │
│                                                                  │
│     To achieve Q1 target of OMR 500K, I suggest:                │
│     • 20 POCs (7 expected wins)                                 │
│     • 30 Demos                                                  │
│     • Focus on Enterprise accounts                              │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  You: "What if I want to focus on SMB instead?"                 │
│                                                                  │
│  🤖 For SMB focus with smaller deal sizes (~OMR 15K):           │
│     • You'd need ~33 wins                                       │
│     • Recommended: 50 POCs, 80 Demos                            │
│     • Pre-sales effort increases by 60%                         │
│     • Consider: hybrid approach (60% Enterprise, 40% SMB)       │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  [Type your question...]                            [Send 📤]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Priority: P0 - Critical**

| Task | Description | Days |
|------|-------------|------|
| 1.1 | Create database collections (goals, kpi_snapshots, goal_activities) | 1 |
| 1.2 | Build KPI sync service from Odoo (employee.sales.kpi) | 2 |
| 1.3 | Create Goal CRUD API endpoints | 2 |
| 1.4 | Build basic KPI Dashboard page | 2 |
| 1.5 | Add KPI navigation to sidebar | 0.5 |

**Deliverables:**
- Synced Sales KPIs from Odoo
- Basic goal creation/viewing
- KPI dashboard with progress cards

### Phase 2: Goal Management (Week 3-4)
**Priority: P0 - Critical**

| Task | Description | Days |
|------|-------------|------|
| 2.1 | Build Goal Management page UI | 2 |
| 2.2 | Implement goal assignment workflow | 2 |
| 2.3 | Build goal-to-activity generation | 2 |
| 2.4 | Create activity sync to Odoo (mail.activity) | 2 |
| 2.5 | Implement hierarchical rollup logic | 2 |

**Deliverables:**
- Full goal CRUD with assignment
- Activities generated from goals
- Two-way sync with Odoo

### Phase 3: Department-Specific Views (Week 5-6)
**Priority: P1 - High**

| Task | Description | Days |
|------|-------------|------|
| 3.1 | Sales KPI dashboard (booking/billing/collection) | 2 |
| 3.2 | Product Director dashboard + Target Sheets | 3 |
| 3.3 | Pre-Sales team view (assigned from PD) | 2 |
| 3.4 | Marketing dashboard (campaigns/events) | 2 |
| 3.5 | Team leaderboards | 1 |

**Deliverables:**
- Role-specific KPI views
- Target Sheet builder for Product Directors
- Marketing campaign tracking

### Phase 4: AI Planning Assistant (Week 7-8)
**Priority: P1 - High**

| Task | Description | Days |
|------|-------------|------|
| 4.1 | Build AI planning service (GPT integration) | 2 |
| 4.2 | Create chat interface component | 2 |
| 4.3 | Implement suggestion acceptance workflow | 1 |
| 4.4 | Historical analysis for recommendations | 2 |
| 4.5 | Risk factor identification | 1 |

**Deliverables:**
- AI chat for target planning
- Automated suggestions based on history
- Risk alerts

### Phase 5: Advanced Features (Week 9-10)
**Priority: P2 - Medium**

| Task | Description | Days |
|------|-------------|------|
| 5.1 | Notification system for KPI alerts | 2 |
| 5.2 | Export/reporting functionality | 2 |
| 5.3 | Goal templates | 1 |
| 5.4 | Bulk goal assignment | 1 |
| 5.5 | Achievement badges/gamification | 2 |

**Deliverables:**
- Proactive KPI alerts
- Exportable reports
- Gamification elements

---

## 🔄 Odoo Sync Strategy

### Read from Odoo (Every 15 minutes)

| Odoo Model | Our Collection | Fields |
|------------|----------------|--------|
| `employee.sales.kpi` | `kpi_snapshots` | booking/billing/collection targets & actuals |
| `employee.yearly.target` | `goals` | Annual targets |
| `mail.activity` | `goal_activities` | Activity completion |
| `project.task` | `goal_activities` | Task completion |
| `event.event` | `kpi_snapshots` | Marketing events |
| `mailing.trace` | `kpi_snapshots` | Campaign metrics |

### Write to Odoo (On action)

| Trigger | Odoo Model | Action |
|---------|------------|--------|
| Goal creates activity | `mail.activity` | Create activity linked to opportunity |
| Task assigned | `project.task` | Create task in project |
| Goal completed | `hr.appraisal.goal` | Update goal status |

---

## 🔐 RBAC for KPIs

| Role | Can See | Can Assign | Can Create |
|------|---------|------------|------------|
| **Salesperson** | Own KPIs | No | No |
| **Sales Manager** | Team KPIs | To team | For team |
| **Sales Director** | Department KPIs | To managers | For department |
| **Product Director** | Pre-Sales team KPIs | To pre-sales | Target sheets |
| **Pre-Sales** | Own KPIs (from PD) | No | No |
| **Marketing Member** | Own KPIs | No | No |
| **Marketing Head** | Department KPIs | To team | For department |
| **Admin** | All KPIs | Anyone | Any |

---

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| KPI sync accuracy | 99%+ match with Odoo |
| Goal completion tracking | Real-time updates |
| Activity sync to Odoo | < 5 min delay |
| User adoption | 80% of sales team using daily |
| AI suggestion acceptance | 40%+ accepted |

---

## 🚀 Quick Start (After Approval)

I will start with **Phase 1** immediately:
1. Create database schemas
2. Build Odoo KPI sync
3. Create KPI Dashboard
4. Add to navigation

**Estimated time to first working version:** 3-4 days

---

**Ready to proceed?**
