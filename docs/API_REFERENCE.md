# Securado CRM - API Reference

**Version:** 2.0.0  
**Base URL:** `/api`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Dashboard](#2-dashboard)
3. [Opportunities](#3-opportunities)
4. [Leads](#4-leads)
5. [Accounts](#5-accounts)
6. [Activities](#6-activities)
7. [Invoices](#7-invoices)
8. [RBAC](#8-rbac)
9. [ETL](#9-etl)
10. [Cache](#10-cache)

---

## 1. Authentication

### POST /api/auth/login

**Purpose:** Authenticate user with email and password

**Request:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response:**
```json
{
  "access_token": "string (JWT)",
  "token_type": "bearer",
  "user": {
    "id": "string (UUID)",
    "email": "string",
    "name": "string",
    "roles": ["string"]
  }
}
```

**Error Codes:**
- `401`: Invalid credentials
- `422`: Validation error

---

### POST /api/auth/microsoft/callback

**Purpose:** Handle Microsoft SSO callback and create/login user

**Request:**
```json
{
  "code": "string (OAuth authorization code)"
}
```

**Response:**
```json
{
  "access_token": "string (JWT)",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "created_via": "microsoft_sso"
  }
}
```

**Notes:**
- Auto-creates user if not exists
- Auto-links to RBAC profile by email
- SSO must be configured in Settings first

---

### GET /api/auth/me

**Purpose:** Get current authenticated user info

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "string",
  "email": "string",
  "name": "string",
  "roles": ["string"],
  "org_id": "string"
}
```

---

## 2. Dashboard

### GET /api/dashboard/stats

**Purpose:** Get dashboard KPI metrics (RBAC filtered)

**Why it exists:** Central endpoint for dashboard KPI cards. Pre-applies RBAC filters to ensure users only see metrics for their permitted records.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| year | string | Filter by year (e.g., "2026") |
| quarter | string | Filter by quarter (e.g., "Q1") |
| sales_rep | string | Filter by sales rep name |

**Response:**
```json
{
  "total_pipeline": 1500000,
  "won_revenue": 750000,
  "win_rate": 45.5,
  "open_opportunities": 120,
  "activities_count": 450,
  "avg_deal_size": 62500
}
```

**RBAC Behavior:**
- ADMIN: All records
- MANAGER: Team + direct reports records
- USER: Own records only
- RESTRICTED: Returns zeros

---

### GET /api/dashboard/product-manager-leaderboard

**Purpose:** Get product manager performance rankings

**Why it exists:** Shows PM contribution to pipeline and won deals. RBAC filtered so managers see only their team's PMs.

**Response:**
```json
{
  "leaderboard": [
    {
      "pm_name": "string",
      "opportunities": 45,
      "won_amount": 500000,
      "pipeline_value": 1200000
    }
  ]
}
```

---

### GET /api/dashboard/category-stats

**Purpose:** Get opportunities breakdown by category

**Why it exists:** Provides category-wise analysis for dashboard charts.

**Response:**
```json
{
  "categories": [
    {
      "name": "Enterprise",
      "count": 50,
      "value": 800000
    }
  ]
}
```

---

## 3. Opportunities

### GET /api/opportunities

**Purpose:** List opportunities with RBAC filtering

**Why it exists:** Main endpoint for opportunity list view. Applies row-level security based on user's access level.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| year | string | Filter by year |
| quarter | string | Filter by quarter |
| stage | string | Filter by stage |
| owner | string | Filter by owner name |
| account | string | Filter by account name |
| limit | int | Max records (default: 100) |
| skip | int | Pagination offset |
| sort_by | string | Sort field |
| sort_order | string | "asc" or "desc" |

**Response:**
```json
[
  {
    "canonical_id": "string",
    "name": "string",
    "amount": 50000,
    "stage": "Negotiation",
    "probability": 75,
    "owner_name": "John Smith",
    "account_name": "Acme Corp",
    "expected_close_date": "2026-03-15",
    "opportunity_number": "SEC/OPP/2026/01/12345"
  }
]
```

**RBAC Filter Applied:**
- USER: `{"owner_name": {"$regex": "^user_name$"}}`
- MANAGER: `{"$or": [{"owner_name": "manager"}, {"owner_name": {"$in": [direct_reports]}}]}`
- ADMIN: `{}` (no filter)

---

### GET /api/opportunities/{id}

**Purpose:** Get single opportunity with full details

**Why it exists:** Detail view endpoint. Includes linked activities, bluesheets, and change logs.

**Response:**
```json
{
  "canonical_id": "string",
  "name": "string",
  "amount": 50000,
  "stage": "string",
  "activities": [],
  "bluesheets": [],
  "logs": []
}
```

---

### GET /api/opportunities/kanban

**Purpose:** Get opportunities grouped by stage for Kanban view

**Why it exists:** Provides data structure optimized for Kanban board rendering.

**Response:**
```json
{
  "stages": [
    {
      "name": "Qualification",
      "opportunities": [...],
      "total_value": 500000
    }
  ],
  "total_count": 150
}
```

---

## 4. Leads

### GET /api/leads

**Purpose:** List leads (pre-qualified opportunities)

**Why it exists:** Separate view for leads with type="lead". RBAC filtered.

**Response:** Similar to opportunities

---

### GET /api/leads/stats

**Purpose:** Get lead statistics

**Why it exists:** KPI metrics specific to leads funnel.

**Response:**
```json
{
  "total_leads": 345,
  "new_leads": 147,
  "qualified": 198,
  "conversion_rate": 57.4
}
```

---

### GET /api/leads/kanban

**Purpose:** Kanban view for leads

**RBAC:** Fully enforced

---

### POST /api/leads/{id}/convert

**Purpose:** Convert lead to opportunity

**Why it exists:** Workflow action to change lead type to opportunity.

---

## 5. Accounts

### GET /api/accounts

**Purpose:** List customer accounts

**RBAC Filter Field:** `salesperson`

**Response:**
```json
[
  {
    "canonical_id": "string",
    "name": "Acme Corporation",
    "country": "Oman",
    "salesperson": "John Smith",
    "total_revenue": 500000,
    "open_opportunities": 5
  }
]
```

---

### GET /api/accounts/overdue

**Purpose:** Get accounts with overdue payments

**Why it exists:** Helps sales track payment follow-ups.

---

## 6. Activities

### GET /api/activities

**Purpose:** List sales activities

**RBAC Filter Field:** `assigned_to`

**Activity Types:** Call, Email, Meeting, Task, Follow-up

**Response:**
```json
[
  {
    "id": "string",
    "activity_type": "call",
    "summary": "Follow-up call",
    "assigned_to": "John Smith",
    "due_date": "2026-02-01",
    "status": "pending",
    "opportunity_id": "string"
  }
]
```

---

### GET /api/activities/stats

**Purpose:** Activity statistics for dashboard

**Response:**
```json
{
  "total": 450,
  "calls": 120,
  "emails": 200,
  "meetings": 80,
  "overdue": 15
}
```

---

## 7. Invoices

### GET /api/invoices

**Purpose:** List invoices linked to opportunities

**RBAC Filter Field:** `salesperson`

**Response:**
```json
[
  {
    "id": "string",
    "invoice_number": "INV-2026-001",
    "amount": 25000,
    "status": "paid",
    "account_name": "Acme Corp",
    "salesperson": "John Smith"
  }
]
```

---

## 8. RBAC

### POST /api/rbac/sync

**Purpose:** Sync users, groups, teams, and employee hierarchy from Odoo

**Why it exists:** Brings Odoo permission structure into local system for RBAC filtering.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| connection_id | string | Odoo connection ID |

**Response:**
```json
{
  "status": "success",
  "users_synced": 70,
  "groups_synced": 14,
  "teams_synced": 6,
  "employees_synced": 75
}
```

---

### GET /api/rbac/my-access

**Purpose:** Get current user's access level and permissions

**Response:**
```json
{
  "user_name": "John Smith",
  "access_level": "MANAGER",
  "groups": ["Sales / Manager"],
  "teams": ["Enterprise Sales"],
  "direct_reports": ["Jane Doe", "Bob Wilson"],
  "is_manager": true
}
```

---

### GET /api/rbac/test-filter/{user_name}

**Purpose:** Debug endpoint to see what MongoDB filter would be applied

**Why it exists:** Helps admins troubleshoot access issues.

**Response:**
```json
{
  "user_name": "John Smith",
  "access_level": "MANAGER",
  "mongodb_filter": {
    "$or": [
      {"owner_name": {"$regex": "^John Smith$"}},
      {"owner_name": {"$regex": "^Jane Doe$|^Bob Wilson$"}}
    ]
  }
}
```

---

### GET /api/rbac/overrides

**Purpose:** List all permission overrides

**Response:**
```json
{
  "count": 5,
  "overrides": [
    {
      "id": "string",
      "user_email": "user@example.com",
      "access_level": "MANAGER",
      "reason": "Temporary access",
      "expires_at": "2026-03-01",
      "is_active": true
    }
  ]
}
```

---

### POST /api/rbac/overrides

**Purpose:** Create a local permission override

**Why it exists:** Allows admins to grant temporary access or restrict users regardless of Odoo permissions.

**Request:**
```json
{
  "user_email": "user@example.com",
  "access_level": "ADMIN|MANAGER|USER|RESTRICTED",
  "reason": "string (optional)",
  "expires_at": "2026-03-01 (optional)"
}
```

---

### PUT /api/rbac/overrides/{id}

**Purpose:** Update an override

---

### DELETE /api/rbac/overrides/{id}

**Purpose:** Delete an override

---

## 9. ETL

### GET /api/connections

**Purpose:** List configured data connections (Odoo instances)

---

### GET /api/pipelines

**Purpose:** List ETL pipelines

---

### POST /api/pipelines/{id}/run

**Purpose:** Trigger ETL pipeline execution

**Why it exists:** Manually run data sync from Odoo.

---

### GET /api/runs/{id}

**Purpose:** Get ETL run status and logs

---

## 10. Cache

### GET /api/cache/dashboard-kpis

**Purpose:** Get pre-computed dashboard metrics

**Why it exists:** Faster reads from pre-aggregated cache instead of real-time calculation.

---

### POST /api/cache/refresh

**Purpose:** Force rebuild of serving cache

---

### POST /api/cache/invalidate

**Purpose:** Clear cache (will be rebuilt on next request)

---

### GET /api/cache/stats

**Purpose:** Get cache statistics (hit rate, last refresh, etc.)

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 422 | Validation Error - Invalid data format |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently no rate limiting is implemented. Future versions may add:
- 100 requests/minute for standard users
- 1000 requests/minute for admins

---

**Document Version:** 2.0.0  
**Last Updated:** January 31, 2026
