# Modular Dashboard Architecture - Technical Assessment

## Executive Summary

After reviewing your current codebase, I've identified **strong existing foundations** that significantly accelerate the implementation of a modular, role-based dashboard system. Here's my comprehensive assessment.

---

## 1. Current State Analysis

### ✅ What Already Exists (Strong Foundations)

#### A. RBAC Infrastructure - 80% Ready
**Frontend (`/app/frontend/src/lib/RBACContext.js`):**
```javascript
// Already implemented:
- hasPermission(permission)
- hasRole(role)
- canAccessAllRecords()
- filterHiddenFields(record)
- RequirePermission component wrapper
- RequireRole component wrapper
- record_access: 'own' | 'department' | 'all'
- field_access: 'limited' | 'standard' | 'all'
```

#### B. Odoo RBAC Mapping - 90% Ready
**Backend (`/app/backend/services/odoo_rbac/routes.py`):**
```python
# Already mapped Odoo groups to app roles:
- sales_admin (Group 14): full access, record_access='all'
- sales_director (Group 448): full CRM access, record_access='all'  
- sales_user_all (Group 13): read-write all documents
- sales_user_readonly (Group 447): read-only all documents
- sales_user_department (Group 74): department-scoped access
- sales_user_own (Group 12): own documents only
- crm_readonly (Group 449): read-only CRM
```

#### C. Global Filter System (Slicer) - 95% Ready
**Frontend (`/app/frontend/src/lib/GlobalFilterContext.js`):**
```javascript
// Already implemented:
- Centralized filter state
- URL sync for shareable filtered views
- getQueryParams() for API calls
- Supports: year, quarter, month, salesRep, team, account, stage
- hasActiveFilters() check
- resetFilters() function
```

#### D. Permission Model - 70% Ready
**Backend (`/app/backend/services/rbac/models.py`):**
```python
# Already defined permissions:
- view_dashboard, manage_dashboard
- view_opportunities, manage_opportunities, delete_opportunities
- view_accounts, view_activities, view_goals, view_teams
- view_analytics, manage_analytics
# Missing: export_data permission
```

---

### ❌ What's Missing (Needs Building)

| Component | Current State | Effort Required |
|-----------|--------------|-----------------|
| Card Registry | None | Medium (1 week) |
| Layout Template System | None | Medium (1-2 weeks) |
| Layout Builder UI | None | High (2-3 weeks) |
| Row-Level Security (API) | Partial | Medium (1-2 weeks) |
| Export Permission | Missing | Low (1 day) |
| Batch Data Endpoint | None | Medium (3-5 days) |

---

## 2. Feasibility Assessment

### ✅ Easy to Implement (1-2 days each)

1. **Export Permission Blocking**
   - Add `export_data` permission to RBAC model
   - Check permission in `/api/opportunities/export` endpoint
   - Hide Export button in UI for restricted roles
   
2. **Card Registry Metadata**
   - Create MongoDB collection for card definitions
   - Store: id, title, type, dataSource, requiredPermissions

3. **Role-Template Assignment (Backend)**
   - Map role → dashboard template ID
   - Return template on user login

### ⚠️ Medium Complexity (3-5 days each)

1. **Layout Template Storage**
   - JSON schema for grid layout
   - CRUD APIs for templates
   - Template versioning

2. **Card Component Refactoring**
   - Extract current dashboard sections as reusable card components
   - Standardize props: `filters`, `onNavigate`, `permissions`

3. **Filter-to-Card Integration**
   - Each card declares `supportedFilters[]`
   - Auto-apply global filters to matching cards

### 🔴 Difficult/Complex (1-2 weeks each)

1. **Drag-Drop Layout Builder**
   - Need `react-grid-layout` integration
   - Complex UX for resize/reorder
   - Preview vs edit modes
   - Undo/redo support

2. **Row-Level Security Enforcement**
   - Every CRM API endpoint must filter by `owner_id` or `team_id`
   - Cannot rely on frontend—backend is source of truth
   - Need to update 15+ endpoints

3. **Real-time Filter Updates**
   - Debounce filter changes
   - Cache recent queries
   - Handle concurrent updates

---

## 3. Recommended Architecture

### A. Card Registry Schema

```javascript
// MongoDB: dashboard_cards collection
{
  "id": "sales-pipeline-chart",
  "title": "Pipeline by Stage",
  "description": "Shows opportunities grouped by stage",
  "type": "chart",
  "chartType": "bar",
  "dataSource": "/api/dashboard/pipeline-by-stage",
  "component": "PipelineChart",
  "requiredPermissions": ["view_opportunities"],
  "supportedFilters": ["year", "quarter", "salesRep", "stage"],
  "defaultSize": { "w": 6, "h": 4 },
  "minSize": { "w": 3, "h": 2 },
  "refreshInterval": 300, // seconds, 0 = manual only
  "roleVisibility": ["sales_admin", "sales_director", "sales_user_all"],
  "category": "pipeline"
}
```

### B. Layout Template Schema

```javascript
// MongoDB: dashboard_templates collection
{
  "id": "sales-manager-dashboard",
  "name": "Sales Manager Dashboard",
  "description": "Default dashboard for sales managers",
  "assignedRoles": ["sales_director", "sales_user_all"],
  "isDefault": true,
  "layout": [
    { "cardId": "total-pipeline-kpi", "x": 0, "y": 0, "w": 3, "h": 2 },
    { "cardId": "win-rate-kpi", "x": 3, "y": 0, "w": 3, "h": 2 },
    { "cardId": "open-opportunities-kpi", "x": 6, "y": 0, "w": 3, "h": 2 },
    { "cardId": "won-this-period-kpi", "x": 9, "y": 0, "w": 3, "h": 2 },
    { "cardId": "sales-pipeline-chart", "x": 0, "y": 2, "w": 6, "h": 4 },
    { "cardId": "sales-leaderboard", "x": 6, "y": 2, "w": 6, "h": 4 },
    { "cardId": "pm-leaderboard", "x": 0, "y": 6, "w": 6, "h": 4 },
    { "cardId": "category-performance", "x": 6, "y": 6, "w": 6, "h": 4 }
  ],
  "createdBy": "admin",
  "createdAt": "2026-01-28T...",
  "updatedAt": "2026-01-28T..."
}
```

### C. Role-Based Layout Assignment

```javascript
// MongoDB: role_dashboard_assignments
{
  "role": "sales_user_own",
  "templateId": "salesperson-dashboard",
  "overrides": {
    "hiddenCards": ["pm-leaderboard"], // Can't see PM data
    "readOnlyCards": ["*"],            // Can't customize
    "exportEnabled": false              // No export
  }
}
```

### D. API Security Pattern

```python
# Backend middleware pattern for row-level security
@router.get("/api/opportunities")
async def list_opportunities(
    current_user = Depends(get_current_user),
    rbac = Depends(get_user_rbac)
):
    query = {}
    
    # Enforce row-level security
    if rbac.record_access == "own":
        query["owner_id"] = current_user.id
    elif rbac.record_access == "department":
        query["team_id"] = {"$in": current_user.team_ids}
    # else: record_access == "all", no filter
    
    # Never trust client-provided user_id
    # Always derive scope from auth token
```

---

## 4. Key Design Decisions Required

### Decision 1: Per-Card Endpoints vs Batch Endpoint

| Approach | Pros | Cons |
|----------|------|------|
| **Per-Card** (current) | Simple, independent | N API calls per dashboard |
| **Batch Endpoint** | Single request | Complex response handling |
| **Hybrid** (recommended) | Best of both | Some complexity |

**Recommendation:** Add a `/api/dashboard/batch` endpoint that accepts card IDs and returns all data in one response, while keeping per-card endpoints for drill-down.

### Decision 2: Filter Contract

```typescript
// Canonical filter schema (already mostly exists)
interface GlobalFilters {
  year?: string;        // "2025"
  quarter?: string;     // "Q1"
  month?: number;       // 1-12
  salesRep?: string;    // owner_name
  team?: string;        // team_id
  account?: string;     // account_id
  stage?: string;       // stage name
  dateField?: string;   // 'create_date' | 'close_date' | 'won_at'
}
```

### Decision 3: Card-Filter Mapping

Each card must declare which filters it responds to:

```javascript
{
  "cardId": "activity-overview",
  "supportedFilters": ["year", "quarter", "salesRep"],
  "filterMapping": {
    "salesRep": "activity_owner"  // Maps global filter to card's field
  }
}
```

---

## 5. The Activity Card Issue

Based on the screenshot, the **Activity Overview** card shows all zeros. This is likely due to:

1. **Filter mismatch**: The activity data isn't being filtered by the same criteria as other cards
2. **Data field mismatch**: Activities may use `activity_owner` vs `owner_name`
3. **Date field issue**: Activities might use a different date field than opportunities

**Fix Required:**
- Standardize activity data sync to include `owner_id` matching opportunities
- Ensure activity counts respond to global filters

---

## 6. Implementation Phases

### Phase 0: Planning & Discovery (1 week)
- [ ] Define card registry schema (finalize above)
- [ ] Audit all current dashboard data sources
- [ ] Map each Odoo role to dashboard requirements
- [ ] Document filter-to-card mappings

### Phase 1: Foundations (2 weeks)
- [ ] Add `export_data` permission to RBAC model
- [ ] Block export endpoints for restricted roles
- [ ] Create `dashboard_cards` collection with seed data
- [ ] Create `dashboard_templates` collection
- [ ] Refactor DashboardPage.js into card components

### Phase 2: Template System (2 weeks)
- [ ] Implement template CRUD APIs
- [ ] Add role-to-template assignment
- [ ] Load user's template on login
- [ ] Apply template layout on frontend

### Phase 3: Row-Level Security (2 weeks)
- [ ] Add owner_id filter to opportunity endpoints
- [ ] Add owner_id filter to account endpoints  
- [ ] Add owner_id filter to activity endpoints
- [ ] Add team_id filter for department-level access
- [ ] Audit logs for access attempts

### Phase 4: Layout Builder (2-3 weeks)
- [ ] Add react-grid-layout dependency
- [ ] Create admin layout builder UI
- [ ] Implement drag/drop cards
- [ ] Save/load template changes
- [ ] Preview mode

### Phase 5: Optimization (1 week)
- [ ] Implement batch data endpoint
- [ ] Add response caching
- [ ] Debounce filter updates
- [ ] Performance monitoring

**Total Estimated Effort: 8-10 weeks**

---

## 7. What Must Change in Current Design

### Frontend Changes

| File | Change Required |
|------|-----------------|
| `DashboardPage.js` | Refactor to template-driven, extract card components |
| `RBACContext.js` | Add `canExport()` method |
| `api.js` | Add batch dashboard endpoint |
| New: `CardRegistry.js` | Card metadata and component mapping |
| New: `LayoutRenderer.js` | Render grid from template JSON |
| New: `LayoutBuilder.js` | Admin drag/drop UI |

### Backend Changes

| File | Change Required |
|------|-----------------|
| `rbac/models.py` | Add `export_data` permission |
| `crm_sales/routes.py` | Add owner_id filtering to all endpoints |
| New: `dashboard_cards/routes.py` | Card CRUD APIs |
| New: `dashboard_templates/routes.py` | Template CRUD + assignment APIs |

### Database Changes

| Collection | Purpose |
|------------|---------|
| `dashboard_cards` | Card registry with metadata |
| `dashboard_templates` | Layout templates |
| `role_dashboard_assignments` | Role → Template mapping |
| `user_dashboard_overrides` | Per-user customizations (optional) |

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance degradation with many cards | High | Implement batch endpoint, caching |
| Complex RBAC edge cases | Medium | Extensive testing, fallback to restrictive |
| Layout builder UX complexity | Medium | Start with preset templates, add builder later |
| Data inconsistency across cards | High | Standardize filter contract, use shared context |

---

## 9. Next Steps (Immediate Actions)

1. **Approve this architecture** - Confirm the card registry and template schemas work for your use case

2. **Prioritize Phase 1** - Export blocking and card refactoring can start immediately

3. **Define role-template mapping** - You need to specify:
   - What cards should `sales_user_own` see?
   - What cards should `sales_director` see?
   - Which cards are admin-only?

4. **Fix Activity Card** - Independent of modular dashboard, this needs:
   - Data audit to find why counts are zero
   - Filter integration with GlobalFilterContext

---

## 10. Files of Reference

- `/app/frontend/src/lib/RBACContext.js` - Existing RBAC frontend
- `/app/frontend/src/lib/GlobalFilterContext.js` - Existing global filters
- `/app/backend/services/rbac/models.py` - Permission definitions
- `/app/backend/services/odoo_rbac/routes.py` - Odoo role mapping
- `/app/frontend/src/components/crm/DashboardPage.js` - Current dashboard (to refactor)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-28
**Author:** Neo (AI Assistant)
