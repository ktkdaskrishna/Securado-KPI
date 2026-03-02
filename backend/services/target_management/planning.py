"""Target Planning Service - Analytics-driven target assignment

This is an ANALYTICS tool. All data comes from Odoo (canonical DB).
The ONLY thing created here is the Target Plan.

Flow:
1. CEO assigns revenue target to Product Manager
2. PM creates activity plan by product/solution category using real account data
3. Plan goes to Sales Director as a "bucket"
4. Sales Director redistributes plan items to Account Managers
5. Salesperson actuals tracked from Odoo data (activities, invoices, revenue)

Data Sources (READ ONLY from canonical):
- opportunities: revenue, product_manager, solution_category, owner_name, amount
- accounts: customer list, owner assignments
- activities: actual activities done (calls, demos, meetings, POCs)
- invoices: collection tracking, overdue
- employees: org hierarchy, job titles
- sales_users: login users
- sales_teams: team structure
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from pydantic import BaseModel
import logging
from datetime import datetime

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)

# Value-selling activity types ONLY (used across all activity queries)
VALUE_SELLING_TYPES = ["Demo", "Proof of concept", "Site Visit", "Work Shop", "Product Presentation", "Vendor Meeting", "POC"]

# Routers
lookups_router = APIRouter(prefix="/target-lookups", tags=["target-lookups"])
plans_router = APIRouter(prefix="/target-plans", tags=["target-plans"])
actuals_router = APIRouter(prefix="/target-actuals", tags=["target-actuals"])


# ==================== MODELS ====================

class RevenuePlanCreate(BaseModel):
    """CEO/Director creates target for a Product Manager — single plan with dual targets"""
    name: str
    product_manager_id: Optional[str] = None
    product_manager_name: Optional[str] = None
    booking_target: float = 0  # Order booking target (Won CRM deals)
    invoiced_target: float = 0  # Invoiced revenue target (paid invoices)
    margin_target: float = 0  # Gross profit / margin target
    target_amount: float = 0  # Legacy field
    period: str = "2026-Q1"
    plan_type: str = "revenue"  # Keep as "revenue" — the dual targets handle the split
    notes: Optional[str] = None


class ActivityPlanItemCreate(BaseModel):
    """PM creates activity plan item (e.g. 10 demos for NDR)"""
    activity_type: str  # Demo, Proof of concept, Site Visit, Work Shop, Product Presentation, Vendor Meeting, POC
    solution_category: Optional[str] = None
    target_count: int = 0
    notes: Optional[str] = None


class PlanRedistributionCreate(BaseModel):
    """Assign plan items to a team, team manager, or individual salesperson"""
    plan_item_id: str
    assign_type: str = "person"  # "person", "team"
    assigned_to_name: str  # Person name or Team name
    assigned_to_id: Optional[str] = None
    assigned_count: int = 0
    team_name: Optional[str] = None
    notes: Optional[str] = None


# ==================== LOOKUPS (from Odoo data) ====================

@lookups_router.get("/product-managers")
async def get_product_managers(current_user: dict = Depends(get_current_user)):
    """Get list of product managers from Odoo - current year only"""
    canonical_db = get_canonical_db()
    current_year = datetime.now().strftime("%Y")
    pipeline = [
        {"$match": {"product_manager": {"$ne": None}, "deleted": {"$ne": True}, "create_date": {"$regex": f"^{current_year}"}}},
        {"$group": {
            "_id": {"name": "$product_manager", "id": "$product_manager_id"},
            "opp_count": {"$sum": 1},
            "total_pipeline": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}}
        }},
        {"$sort": {"opp_count": -1}}
    ]
    results = await canonical_db.opportunities.aggregate(pipeline).to_list(50)
    return [{"id": r["_id"]["id"], "name": r["_id"]["name"], "opp_count": r["opp_count"],
             "total_pipeline": r["total_pipeline"]} for r in results]


@lookups_router.get("/solution-categories")
async def get_solution_categories(current_user: dict = Depends(get_current_user)):
    """Get solution categories from Odoo opportunities"""
    canonical_db = get_canonical_db()
    pipeline = [
        {"$match": {"solution_category": {"$ne": None}}},
        {"$group": {
            "_id": "$solution_category",
            "opp_count": {"$sum": 1},
            "total_pipeline": {"$sum": "$amount"}
        }},
        {"$sort": {"opp_count": -1}}
    ]
    results = await canonical_db.opportunities.aggregate(pipeline).to_list(50)
    return [{"name": r["_id"], "opp_count": r["opp_count"], "total_pipeline": r["total_pipeline"]} for r in results]


@lookups_router.get("/salespersons")
async def get_salespersons(current_user: dict = Depends(get_current_user)):
    """Get salespersons (opportunity owners) from Odoo - current year"""
    canonical_db = get_canonical_db()
    current_year = datetime.now().strftime("%Y")
    pipeline = [
        {"$match": {"owner_name": {"$ne": None}, "deleted": {"$ne": True}, "create_date": {"$regex": f"^{current_year}"}}},
        {"$group": {
            "_id": "$owner_name",
            "owner_id": {"$first": "$owner_id"},
            "opp_count": {"$sum": 1},
            "total_pipeline": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}},
            "teams": {"$addToSet": "$team_name"}
        }},
        {"$sort": {"total_pipeline": -1}}
    ]
    results = await canonical_db.opportunities.aggregate(pipeline).to_list(100)
    return [{"id": str(r.get("owner_id", "")), "name": r["_id"], "opp_count": r["opp_count"],
             "total_pipeline": r["total_pipeline"], "teams": [t for t in r["teams"] if t]} for r in results]


@lookups_router.get("/accounts")
async def get_accounts(
    owner_name: Optional[str] = None,
    limit: int = 200,
    current_user: dict = Depends(get_current_user)
):
    """Get accounts from Odoo canonical data"""
    canonical_db = get_canonical_db()
    query = {}
    if owner_name:
        query["owner_name"] = owner_name
    accounts = await canonical_db.accounts.find(query, {"_id": 0}).sort("name", 1).to_list(limit)
    return accounts


@lookups_router.get("/teams-with-members")
async def get_teams_with_members(current_user: dict = Depends(get_current_user)):
    """Get sales teams with their members from Odoo employees hierarchy"""
    canonical_db = get_canonical_db()

    # Get all employees
    employees = await canonical_db.employees.find(
        {"department_name": {"$regex": "Sales|Business|Management", "$options": "i"}},
        {"_id": 0, "canonical_id": 1, "source_record_id": 1, "name": 1, "job_title": 1, "manager_id": 1, "department_name": 1}
    ).to_list(200)

    # Build manager → reports mapping using source_record_id
    mgr_teams = {}
    for emp in employees:
        mgr_id = str(emp.get("manager_id", ""))
        if mgr_id:
            if mgr_id not in mgr_teams:
                mgr_teams[mgr_id] = []
            mgr_teams[mgr_id].append({
                "id": emp.get("source_record_id"),
                "name": emp.get("name"),
                "job_title": emp.get("job_title")
            })

    result = []
    # Build teams from manager hierarchy
    for mgr_id, members in mgr_teams.items():
        # Find manager by source_record_id
        mgr = await canonical_db.employees.find_one(
            {"source_record_id": mgr_id},
            {"_id": 0, "name": 1, "job_title": 1}
        )
        mgr_name = mgr.get("name", f"Manager #{mgr_id}") if mgr else f"Manager #{mgr_id}"
        mgr_title = mgr.get("job_title", "") if mgr else ""

        if len(members) > 0:
            result.append({
                "name": f"{mgr_name}'s Team",
                "manager_name": mgr_name,
                "manager_title": mgr_title,
                "manager_id": mgr_id,
                "members": members,
                "member_count": len(members)
            })

    # Also add Odoo sales teams
    odoo_teams = await canonical_db.sales_teams.find({}, {"_id": 0}).to_list(20)
    for t in odoo_teams:
        if t.get("name"):
            result.append({
                "name": t.get("name"),
                "manager_name": None,
                "members": [],
                "member_count": len(t.get("member_ids", [])),
                "target": t.get("invoiced_target", 0)
            })

    # Sort: manager-based teams first (they have members)
    result.sort(key=lambda x: x.get("member_count", 0), reverse=True)
    return result


@lookups_router.get("/activity-types")
async def get_activity_types(current_user: dict = Depends(get_current_user)):
    """Get value-selling activity types from Odoo"""
    canonical_db = get_canonical_db()
    pipeline = [
        {"$match": {"activity_type": {"$in": VALUE_SELLING_TYPES}}},
        {"$group": {"_id": "$activity_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    results = await canonical_db.activities.aggregate(pipeline).to_list(30)
    return [{"type": r["_id"], "count": r["count"]} for r in results]


@lookups_router.get("/sales-teams")
async def get_sales_teams(current_user: dict = Depends(get_current_user)):
    """Get sales teams from Odoo"""
    canonical_db = get_canonical_db()
    teams = await canonical_db.sales_teams.find({}, {"_id": 0}).to_list(20)
    return teams


# ==================== REVENUE PLANS (CEO → PM) ====================

@plans_router.get("/revenue")
async def list_revenue_plans(
    period: Optional[str] = None,
    product_manager: Optional[str] = None,
    year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all revenue plans (CEO-level view)"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")

    query = {"org_id": org_id, "plan_type": {"$in": ["revenue", "booking", "invoiced_revenue"]}}
    if period:
        query["period"] = period
    if product_manager:
        query["product_manager_name"] = {"$regex": f"^{product_manager}$", "$options": "i"}
    # Filter plans by year if specified
    if year:
        query["$or"] = [
            {"name": {"$regex": year}},
            {"period": {"$regex": year}},
            {"year": year},
            {"year": int(year) if year.isdigit() else 0},
        ]

    plans = await app_db.target_plans.find(query).sort("created_at", -1).to_list(100)
    serialized = serialize_doc(plans)

    # Enrich with actual data from canonical
    filter_year = year or datetime.now().strftime("%Y")
    for plan in serialized:
        pm_name = plan.get("product_manager_name")
        if pm_name:
            year_filter = {"date_last_stage_update": {"$regex": f"^{filter_year}"}}
            
            # Booking actual: Won opportunities (CRM)
            booking_pipeline = [
                {"$match": {"product_manager": pm_name, "stage": "Won", "deleted": {"$ne": True}, **year_filter}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}}, "count": {"$sum": 1}}}
            ]
            booking_result = await canonical_db.opportunities.aggregate(booking_pipeline).to_list(1)
            plan["actual_booking"] = booking_result[0].get("total", 0) if booking_result else 0
            plan["won_deals"] = booking_result[0].get("count", 0) if booking_result else 0
            
            # Invoiced actual: Paid invoices
            inv_pipeline = [
                {"$match": {"salesperson_name": {"$regex": pm_name, "$options": "i"}, "payment_state": "paid", "invoice_date": {"$regex": f"^{filter_year}"}}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$amount_total", 0]}}, "count": {"$sum": 1}}}
            ]
            inv_result = await canonical_db.invoices.aggregate(inv_pipeline).to_list(1)
            plan["actual_invoiced"] = inv_result[0].get("total", 0) if inv_result else 0
            plan["invoiced_count"] = inv_result[0].get("count", 0) if inv_result else 0
            
            # Margin actual: from sales_orders margin field
            margin_pipeline = [
                {"$match": {"salesperson": {"$regex": pm_name, "$options": "i"}, "order_date": {"$regex": f"^{filter_year}"}}},
                {"$group": {"_id": None, "total_margin": {"$sum": {"$ifNull": ["$margin", 0]}}, "total_revenue": {"$sum": {"$ifNull": ["$amount", 0]}}}}
            ]
            margin_result = await canonical_db.sales_orders.aggregate(margin_pipeline).to_list(1)
            plan["actual_margin"] = margin_result[0].get("total_margin", 0) if margin_result else 0
            plan["so_revenue"] = margin_result[0].get("total_revenue", 0) if margin_result else 0
            plan["margin_pct_actual"] = round(plan["actual_margin"] / plan["so_revenue"] * 100, 1) if plan["so_revenue"] > 0 else 0
            
            # Legacy field
            plan["actual_revenue"] = plan["actual_booking"]
            
            # Compute achievement percentages
            bt = plan.get("booking_target", plan.get("target_amount", 0))
            it = plan.get("invoiced_target", 0)
            plan["booking_pct"] = round(plan["actual_booking"] / bt * 100, 1) if bt > 0 else 0
            plan["invoiced_pct"] = round(plan["actual_invoiced"] / it * 100, 1) if it > 0 else 0
            mt = plan.get("margin_target", 0)
            plan["margin_pct"] = round(plan["actual_margin"] / mt * 100, 1) if mt > 0 else 0

            # Get total pipeline (current year, open opportunities only, exclude Won/Lost/Hold)
            pipeline2 = [
                {"$match": {"product_manager": pm_name, "deleted": {"$ne": True}, "active": True, "stage": {"$nin": ["Won", "Lost", "Hold"]}, **year_filter}},
                {"$group": {"_id": None, "pipeline": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}}, "total_opps": {"$sum": 1}}}
            ]
            result2 = await canonical_db.opportunities.aggregate(pipeline2).to_list(1)
            plan["total_pipeline"] = result2[0].get("pipeline", 0) if result2 else 0
            plan["total_opps"] = result2[0].get("total_opps", 0) if result2 else 0

            # Count activity plan items
            items_count = await app_db.target_plan_items.count_documents({
                "revenue_plan_id": plan["id"], "org_id": org_id
            })
            plan["activity_items_count"] = items_count

            # Count redistributions
            redistributed = await app_db.target_redistributions.count_documents({
                "revenue_plan_id": plan["id"], "org_id": org_id
            })
            plan["redistributed_count"] = redistributed

    return serialized


@plans_router.post("/revenue")
async def create_revenue_plan(
    data: RevenuePlanCreate,
    current_user: dict = Depends(get_current_user)
):
    """CEO creates revenue target for a Product Manager"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")

    doc = {
        "id": generate_id(),
        "org_id": org_id,
        "plan_type": "revenue",
        "status": "active",
        "booking_target": data.booking_target or data.target_amount,  # Backward compatible
        "invoiced_target": data.invoiced_target,
        "margin_target": data.margin_target,
        "target_amount": data.booking_target or data.target_amount,
        "actual_booking": 0,
        "actual_invoiced": 0,
        "actual_revenue": 0,
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "Unknown"),
        "created_at": now_utc(),
        "updated_at": now_utc(),
        **{k: v for k, v in data.model_dump().items() if k not in ["booking_target", "invoiced_target", "target_amount"]}
    }

    await app_db.target_plans.insert_one(doc)
    
    # Auto-generate activity suggestions based on PD's historical data + solution categories
    pm_name = data.product_manager_name
    if pm_name and data.target_amount > 0:
        try:
            # Get PD's historical metrics
            hist = await canonical_db.opportunities.aggregate([
                {"$match": {"product_manager": {"$regex": f"^{pm_name}$", "$options": "i"}, "deleted": {"$ne": True}}},
                {"$group": {
                    "_id": None,
                    "total_opps": {"$sum": 1},
                    "won_count": {"$sum": {"$cond": [{"$eq": ["$stage", "Won"]}, 1, 0]}},
                    "won_value": {"$sum": {"$cond": [{"$eq": ["$stage", "Won"]}, {"$ifNull": ["$sale_value", 0]}, 0]}}
                }}
            ]).to_list(1)
            
            h = hist[0] if hist else {"total_opps": 0, "won_count": 0, "won_value": 0}
            avg_deal = h["won_value"] / h["won_count"] if h["won_count"] > 0 else data.target_amount / 10
            win_rate = h["won_count"] / h["total_opps"] if h["total_opps"] > 0 else 0.25
            required_deals = max(1, round(data.target_amount / avg_deal)) if avg_deal > 0 else 10
            
            # Get PM's solution categories with revenue weight
            current_year = datetime.now().strftime("%Y")
            cat_pipeline = [
                {"$match": {"product_manager": {"$regex": f"^{pm_name}$", "$options": "i"}, "deleted": {"$ne": True}, "create_date": {"$regex": f"^{current_year}"}, "solution_category": {"$ne": None}}},
                {"$group": {"_id": "$solution_category", "count": {"$sum": 1}, "value": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}}}},
                {"$sort": {"value": -1}}
            ]
            categories = await canonical_db.opportunities.aggregate(cat_pipeline).to_list(20)
            total_cat_value = sum(c["value"] for c in categories) or 1
            
            suggestions = []
            activity_types = [
                ("Demo", 0.5, "product demos"),
                ("Proof of concept", 0.15, "POC/pilot"),
                ("Call", 2.5, "outbound calls"),
                ("Meeting", 1.0, "client meetings"),
            ]
            
            if categories:
                # Generate suggestions PER solution category, weighted by revenue
                for cat in categories:
                    cat_name = cat["_id"]
                    weight = cat["value"] / total_cat_value
                    cat_deals = max(1, round(required_deals * weight))
                    
                    for act_type, multiplier, desc in activity_types:
                        count = max(1, round(cat_deals / max(win_rate, 0.1) * multiplier))
                        suggestions.append({
                            "activity_type": act_type,
                            "solution_category": cat_name,
                            "count": count,
                            "formula": f"{cat_deals} deals × {multiplier} ({desc}) [{cat_name}]",
                            "accepted": False
                        })
            else:
                # No categories found - generate generic suggestions
                demos = max(5, round(required_deals / max(win_rate, 0.1) * 0.5))
                for act_type, multiplier, desc in activity_types:
                    count = max(2, round(demos * multiplier / 0.5))
                    suggestions.append({
                        "activity_type": act_type,
                        "solution_category": "",
                        "count": count,
                        "formula": f"({required_deals} deals / {win_rate:.0%} win rate) × {multiplier}",
                        "accepted": False
                    })
            
            suggestion_doc = {
                "id": generate_id(),
                "org_id": org_id,
                "revenue_plan_id": doc["id"],
                "product_director_name": pm_name,
                "revenue_target": data.target_amount,
                "avg_deal_size": round(avg_deal, 2),
                "win_rate": round(win_rate * 100, 1),
                "required_deals": required_deals,
                "pipeline_coverage": round(data.target_amount * 3, 2),
                "categories": [c["_id"] for c in categories],
                "suggestions": suggestions,
                "status": "pending_review",
                "created_at": now_utc()
            }
            await app_db.activity_suggestions.insert_one(suggestion_doc)
        except Exception as e:
            logger.error(f"Failed to generate activity suggestions: {e}")
    
    return serialize_doc(doc)


@plans_router.delete("/revenue/{plan_id}")
async def delete_revenue_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a revenue plan and its items"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    result = await app_db.target_plans.delete_one({"id": plan_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")

    await app_db.target_plan_items.delete_many({"revenue_plan_id": plan_id, "org_id": org_id})
    await app_db.target_redistributions.delete_many({"revenue_plan_id": plan_id, "org_id": org_id})

    return {"success": True}


# ==================== ACTIVITY PLAN ITEMS (PM creates) ====================

@plans_router.get("/revenue/{plan_id}/items")
async def list_plan_items(plan_id: str, current_user: dict = Depends(get_current_user)):
    """List activity plan items for a revenue plan (PM's view)"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")

    items = await app_db.target_plan_items.find({
        "revenue_plan_id": plan_id, "org_id": org_id
    }).sort("created_at", -1).to_list(200)

    serialized = serialize_doc(items)

    # Enrich with actual activity counts from Odoo
    for item in serialized:
        atype = item.get("activity_type")
        if atype:
            actual = await canonical_db.activities.count_documents({
                "activity_type": atype,
                "org_id": org_id
            })
            item["actual_count"] = actual

        # Count redistributions for this item
        redistrib_count = await app_db.target_redistributions.count_documents({
            "plan_item_id": item["id"], "org_id": org_id
        })
        redistrib_assigned = 0
        async for r in app_db.target_redistributions.find({"plan_item_id": item["id"], "org_id": org_id}):
            redistrib_assigned += r.get("assigned_count", 0)

        item["redistributed_to_count"] = redistrib_count
        item["redistributed_total"] = redistrib_assigned

    return serialized


@plans_router.post("/revenue/{plan_id}/items")
async def create_plan_item(
    plan_id: str,
    data: ActivityPlanItemCreate,
    current_user: dict = Depends(get_current_user)
):
    """PM creates activity plan item (e.g. 10 demos for NDR)"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    plan = await app_db.target_plans.find_one({"id": plan_id, "org_id": org_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Revenue plan not found")

    doc = {
        "id": generate_id(),
        "org_id": org_id,
        "revenue_plan_id": plan_id,
        "product_manager_name": plan.get("product_manager_name"),
        "status": "pending",
        "created_by": current_user["id"],
        "created_at": now_utc(),
        **data.model_dump()
    }

    await app_db.target_plan_items.insert_one(doc)
    return serialize_doc(doc)


@plans_router.delete("/items/{item_id}")
async def delete_plan_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a plan item"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    result = await app_db.target_plan_items.delete_one({"id": item_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")

    await app_db.target_redistributions.delete_many({"plan_item_id": item_id, "org_id": org_id})
    return {"success": True}


# ==================== REDISTRIBUTIONS (Sales Director → Account Managers) ====================

@plans_router.get("/revenue/{plan_id}/redistributions")
async def list_redistributions(plan_id: str, current_user: dict = Depends(get_current_user)):
    """List all redistributions for a revenue plan"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    redistributions = await app_db.target_redistributions.find({
        "revenue_plan_id": plan_id, "org_id": org_id
    }).sort("created_at", -1).to_list(500)

    return serialize_doc(redistributions)


@plans_router.post("/items/{item_id}/redistribute")
async def redistribute_plan_item(
    item_id: str,
    data: PlanRedistributionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Sales Director assigns plan item to an account manager"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    item = await app_db.target_plan_items.find_one({"id": item_id, "org_id": org_id})
    if not item:
        raise HTTPException(status_code=404, detail="Plan item not found")

    doc = {
        "id": generate_id(),
        "org_id": org_id,
        "plan_item_id": item_id,
        "revenue_plan_id": item.get("revenue_plan_id"),
        "activity_type": item.get("activity_type"),
        "solution_category": item.get("solution_category"),
        "product_manager_name": item.get("product_manager_name"),
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "Unknown"),
        "created_at": now_utc(),
        **data.model_dump()
    }

    await app_db.target_redistributions.insert_one(doc)

    # Update item status
    await app_db.target_plan_items.update_one(
        {"id": item_id, "org_id": org_id},
        {"$set": {"status": "redistributing", "updated_at": now_utc()}}
    )

    return serialize_doc(doc)


@plans_router.delete("/redistributions/{redist_id}")
async def delete_redistribution(redist_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a redistribution"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    result = await app_db.target_redistributions.delete_one({"id": redist_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"success": True}



# ==================== MY DATA (role-specific) ====================

@actuals_router.get("/my-data")
async def get_my_data(current_user: dict = Depends(get_current_user)):
    """Get role-specific data for the current user from Odoo"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    user_email = current_user.get("email", "")

    # Get fresh user record from DB (JWT name may be stale)
    user_record = await app_db.users.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}})
    roles = user_record.get("roles", []) if user_record else []
    
    # Use DB name, normalize whitespace
    import re
    user_name = re.sub(r'\s+', ' ', (user_record.get("name") if user_record else current_user.get("name", ""))).strip()
    
    # Resolve canonical Odoo name via identity map (single lookup)
    identity = await app_db.user_identity_map.find_one({"email": user_email.lower().strip()}, {"_id": 0}) if user_email else None
    if identity:
        user_name = identity.get("canonical_name", user_name)
    else:
        emp = await canonical_db.employees.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}}, {"_id": 0, "name": 1})
        if emp and emp.get("name"):
            user_name = emp["name"]

    is_admin = "admin" in roles or "sales_admin" in roles
    is_pd = "product_director" in roles or "product_manager" in roles
    is_sd = "sales_director" in roles
    is_rep = not is_admin and not is_pd and not is_sd

    result = {
        "user_name": user_name,
        "user_email": user_email,
        "roles": roles,
        "is_admin": is_admin,
        "is_product_director": is_pd,
        "is_sales_director": is_sd,
        "is_sales_rep": is_rep,
    }

    if is_pd:
        # Product Director: show opportunities under my management
        pm_opps = await canonical_db.opportunities.aggregate([
            {"$match": {"product_manager": {"$regex": user_name, "$options": "i"}}},
            {"$group": {
                "_id": None,
                "total_pipeline": {"$sum": "$amount"},
                "opp_count": {"$sum": 1},
                "won_count": {"$sum": {"$cond": [{"$in": ["$stage", ["Won", "Closed Won", "closed_won"]]}, 1, 0]}},
                "won_amount": {"$sum": {"$cond": [{"$in": ["$stage", ["Won", "Closed Won", "closed_won"]]}, "$amount", 0]}},
            }}
        ]).to_list(1)

        result["pm_summary"] = pm_opps[0] if pm_opps else {"total_pipeline": 0, "opp_count": 0, "won_count": 0, "won_amount": 0}
        if result["pm_summary"].get("_id"):
            del result["pm_summary"]["_id"]

        # My categories
        cats = await canonical_db.opportunities.distinct("solution_category", {"product_manager": {"$regex": user_name, "$options": "i"}})
        result["my_categories"] = [c for c in cats if c]

        # My salespersons
        sp_pipeline = [
            {"$match": {"product_manager": {"$regex": user_name, "$options": "i"}, "owner_name": {"$ne": None}}},
            {"$group": {"_id": "$owner_name", "count": {"$sum": 1}, "pipeline": {"$sum": "$amount"}}},
            {"$sort": {"count": -1}},
            {"$limit": 20}
        ]
        result["my_salespersons"] = [{"name": s["_id"], "opp_count": s["count"], "pipeline": s["pipeline"]} for s in await canonical_db.opportunities.aggregate(sp_pipeline).to_list(20)]

        # My plans
        plans = await app_db.target_plans.find({"product_manager_name": {"$regex": user_name, "$options": "i"}, "org_id": org_id}).to_list(10)
        result["my_plans"] = serialize_doc(plans)

        # My plan items
        for plan in result["my_plans"]:
            items = await app_db.target_plan_items.find({"revenue_plan_id": plan["id"], "org_id": org_id}).to_list(100)
            plan["items"] = serialize_doc(items)

    if is_rep or (not is_admin and not is_sd and not is_pd):
        # Sales Rep: show my assigned targets, activities, accounts
        # My opportunities
        my_opps = await canonical_db.opportunities.aggregate([
            {"$match": {"owner_name": {"$regex": user_name, "$options": "i"}}},
            {"$group": {
                "_id": None,
                "total_pipeline": {"$sum": "$amount"},
                "opp_count": {"$sum": 1},
                "won_count": {"$sum": {"$cond": [{"$in": ["$stage", ["Won", "Closed Won", "closed_won"]]}, 1, 0]}},
                "won_amount": {"$sum": {"$cond": [{"$in": ["$stage", ["Won", "Closed Won", "closed_won"]]}, "$amount", 0]}},
            }}
        ]).to_list(1)
        result["my_opp_summary"] = my_opps[0] if my_opps else {"total_pipeline": 0, "opp_count": 0, "won_count": 0, "won_amount": 0}
        if result["my_opp_summary"].get("_id"):
            del result["my_opp_summary"]["_id"]

        # My value-selling activities from Odoo
        my_acts = await canonical_db.activities.aggregate([
            {"$match": {"assigned_user": {"$regex": user_name, "$options": "i"}, "activity_type": {"$in": VALUE_SELLING_TYPES}}},
            {"$group": {"_id": "$activity_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(20)
        result["my_activities"] = [{"type": a["_id"], "count": a["count"]} for a in my_acts]

        # My accounts
        my_accts = await canonical_db.accounts.count_documents({"owner_name": {"$regex": user_name, "$options": "i"}})
        result["my_accounts_count"] = my_accts

        # Redistributed tasks assigned to me (search by canonical name AND app name)
        app_name = (user_record.get("name", "") if user_record else "").strip()
        name_patterns = list(set([user_name, app_name]))
        or_conditions = [{"assigned_to_name": {"$regex": f"^{n}$", "$options": "i"}} for n in name_patterns if n]
        
        # Also check team assignments where user is a member
        my_tasks = await app_db.target_redistributions.find({
            "org_id": org_id,
            "$or": or_conditions if or_conditions else [{"assigned_to_name": ""}]
        }).to_list(100)
        result["my_assigned_tasks"] = serialize_doc(my_tasks)

    return result


# ==================== ACTUALS (from Odoo data) ====================

@actuals_router.get("/by-product-manager")
async def get_actuals_by_pm(
    product_manager: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get actual performance data per product manager - current year"""
    canonical_db = get_canonical_db()
    current_year = datetime.now().strftime("%Y")

    match = {"product_manager": {"$ne": None}, "deleted": {"$ne": True}, "create_date": {"$regex": f"^{current_year}"}}
    if product_manager:
        match["product_manager"] = product_manager

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$product_manager",
            "total_pipeline": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}},
            "opp_count": {"$sum": 1},
            "won_count": {"$sum": {"$cond": [{"$eq": ["$stage", "Won"]}, 1, 0]}},
            "won_amount": {"$sum": {"$cond": [{"$eq": ["$stage", "Won"]}, {"$ifNull": ["$sale_value", "$amount"]}, 0]}},
            "categories": {"$addToSet": "$solution_category"}
        }},
        {"$sort": {"total_pipeline": -1}}
    ]

    results = await canonical_db.opportunities.aggregate(pipeline).to_list(50)
    return [{"product_manager": r["_id"], "total_pipeline": r["total_pipeline"],
             "opp_count": r["opp_count"], "won_count": r["won_count"],
             "won_amount": r["won_amount"], "categories": [c for c in r["categories"] if c]} for r in results]


@actuals_router.get("/by-salesperson")
async def get_actuals_by_salesperson(
    salesperson: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get actual performance data per salesperson from Odoo"""
    canonical_db = get_canonical_db()

    match = {"owner_name": {"$ne": None}}
    if salesperson:
        match["owner_name"] = salesperson

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$owner_name",
            "total_pipeline": {"$sum": "$amount"},
            "opp_count": {"$sum": 1},
            "won_count": {"$sum": {"$cond": [{"$in": ["$stage", ["Won", "Closed Won", "closed_won"]]}, 1, 0]}},
            "won_amount": {"$sum": {"$cond": [{"$in": ["$stage", ["Won", "Closed Won", "closed_won"]]}, "$amount", 0]}}
        }},
        {"$sort": {"total_pipeline": -1}},
        {"$limit": 30}
    ]

    results = await canonical_db.opportunities.aggregate(pipeline).to_list(30)
    return [{"salesperson": r["_id"], "total_pipeline": r["total_pipeline"],
             "opp_count": r["opp_count"], "won_count": r["won_count"],
             "won_amount": r["won_amount"]} for r in results]


@actuals_router.get("/activities")
async def get_actual_activities(
    assigned_user: Optional[str] = None,
    activity_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get actual activity counts from Odoo"""
    canonical_db = get_canonical_db()

    match = {"activity_type": {"$in": VALUE_SELLING_TYPES}}
    if assigned_user:
        match["assigned_user"] = assigned_user
    if activity_type:
        match["activity_type"] = activity_type

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"user": "$assigned_user", "type": "$activity_type"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]

    results = await canonical_db.activities.aggregate(pipeline).to_list(500)
    return [{"assigned_user": r["_id"]["user"], "activity_type": r["_id"]["type"],
             "count": r["count"]} for r in results]


@actuals_router.get("/collection")
async def get_collection_actuals(
    current_user: dict = Depends(get_current_user)
):
    """Get invoice collection data - paid vs overdue"""
    canonical_db = get_canonical_db()

    pipeline = [
        {"$group": {
            "_id": "$payment_state",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount_total"}
        }}
    ]
    results = await canonical_db.invoices.aggregate(pipeline).to_list(10)

    # Also get overdue count
    from datetime import datetime
    overdue = await canonical_db.invoices.count_documents({
        "payment_state": {"$in": ["not_paid", "partial"]},
        "due_date": {"$lt": datetime.now().strftime("%Y-%m-%d")}
    })

    overdue_amount_result = await canonical_db.invoices.aggregate([
        {"$match": {"payment_state": {"$in": ["not_paid", "partial"]}, "due_date": {"$lt": datetime.now().strftime("%Y-%m-%d")}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_total"}}}
    ]).to_list(1)

    return {
        "by_state": {r["_id"]: {"count": r["count"], "amount": r["total_amount"]} for r in results},
        "overdue_count": overdue,
        "overdue_amount": overdue_amount_result[0]["total"] if overdue_amount_result else 0,
        "total_invoices": sum(r["count"] for r in results)
    }


# ==================== TEAM COMPARISON & MARKETING ====================

@actuals_router.get("/team-comparison")
async def get_team_comparison(current_user: dict = Depends(get_current_user)):
    """Compare all PMs side-by-side on revenue, activity, and collection vectors"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")

    plans = await app_db.target_plans.find({"org_id": org_id, "plan_type": "revenue"}).to_list(100)
    from datetime import datetime

    comparisons = []
    for plan in plans:
        pm_name = plan.get("product_manager_name")
        if not pm_name:
            continue

        target_amount = plan.get("target_amount", 0)

        # Revenue
        won_r = await canonical_db.opportunities.aggregate([
            {"$match": {"product_manager": pm_name, "stage": {"$in": ["Won", "Closed Won", "closed_won"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        pipeline_r = await canonical_db.opportunities.aggregate([
            {"$match": {"product_manager": pm_name}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)

        won_amt = won_r[0]["total"] if won_r else 0
        pipeline_amt = pipeline_r[0]["total"] if pipeline_r else 0
        opp_count = pipeline_r[0]["count"] if pipeline_r else 0
        rev_pct = min(round((won_amt / target_amount * 100) if target_amount > 0 else 0, 1), 200)

        # Activities
        items = await app_db.target_plan_items.find({"revenue_plan_id": plan["id"], "org_id": org_id}).to_list(100)
        total_target_act = sum(i.get("target_count", 0) for i in items)
        total_actual_act = 0
        for item in items:
            atype = item.get("activity_type")
            actual = await canonical_db.activities.count_documents({"activity_type": atype, "org_id": org_id, "activity_type": {"$in": VALUE_SELLING_TYPES}}) if atype else 0
            total_actual_act += min(actual, item.get("target_count", 0))
        act_pct = min(round((total_actual_act / total_target_act * 100) if total_target_act > 0 else 0, 1), 100)

        # Leads generated (marketing proxy)
        leads_count = await canonical_db.opportunities.count_documents({"product_manager": pm_name, "type": "lead"})

        comparisons.append({
            "plan_id": plan["id"],
            "plan_name": plan.get("name", ""),
            "product_manager": pm_name,
            "target_amount": target_amount,
            "revenue": {"won": won_amt, "pipeline": pipeline_amt, "pct": rev_pct, "opp_count": opp_count},
            "activity": {"target": total_target_act, "actual": total_actual_act, "pct": act_pct, "items": len(items)},
            "leads_generated": leads_count,
            "composite": round(rev_pct * 0.5 + act_pct * 0.3 + min(leads_count / 10 * 100, 100) * 0.2, 1)
        })

    comparisons.sort(key=lambda x: x["composite"], reverse=True)
    return comparisons


@actuals_router.get("/marketing-metrics")
async def get_marketing_metrics(current_user: dict = Depends(get_current_user)):
    """Get marketing performance metrics from Odoo leads and opportunities"""
    canonical_db = get_canonical_db()

    # Leads vs Opportunities conversion
    total_leads = await canonical_db.opportunities.count_documents({"type": "lead"})
    total_opps = await canonical_db.opportunities.count_documents({"type": "opportunity"})

    # Leads by solution category
    lead_by_cat = await canonical_db.opportunities.aggregate([
        {"$match": {"type": "lead", "solution_category": {"$ne": None}}},
        {"$group": {"_id": "$solution_category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)

    # Leads by product manager
    lead_by_pm = await canonical_db.opportunities.aggregate([
        {"$match": {"type": "lead", "product_manager": {"$ne": None}}},
        {"$group": {"_id": "$product_manager", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(20)

    # Leads by stage (funnel)
    lead_funnel = await canonical_db.opportunities.aggregate([
        {"$match": {"type": "lead"}},
        {"$group": {"_id": "$lead_stage", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(20)

    # Lead to opportunity conversion rate
    converted = await canonical_db.opportunities.count_documents({
        "type": "opportunity",
        "lead_stage": {"$ne": None}
    })

    return {
        "total_leads": total_leads,
        "total_opportunities": total_opps,
        "conversion_rate": round((total_opps / (total_leads + total_opps) * 100) if (total_leads + total_opps) > 0 else 0, 1),
        "leads_by_category": [{"category": r["_id"], "count": r["count"]} for r in lead_by_cat],
        "leads_by_pm": [{"pm": r["_id"], "count": r["count"]} for r in lead_by_pm],
        "lead_funnel": [{"stage": r["_id"], "count": r["count"]} for r in lead_funnel],
        "converted_count": converted
    }


# ==================== MULTI-VECTOR INCENTIVE ====================

class MultiVectorIncentiveRequest(BaseModel):
    """Calculate incentive based on multiple vectors"""
    plan_id: str
    revenue_weight: float = 50  # % weight for revenue achievement
    activity_weight: float = 30  # % weight for activity completion
    collection_weight: float = 20  # % weight for collection rate


@actuals_router.post("/multi-vector-incentive")
async def calculate_multi_vector_incentive(
    data: MultiVectorIncentiveRequest,
    current_user: dict = Depends(get_current_user)
):
    """Calculate incentive based on revenue + activity + collection vectors"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")

    plan = await app_db.target_plans.find_one({"id": data.plan_id, "org_id": org_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    pm_name = plan.get("product_manager_name")
    target_amount = plan.get("target_amount", 0)

    # --- Vector 1: Revenue Achievement ---
    won_pipeline = [
        {"$match": {"product_manager": pm_name, "stage": {"$in": ["Won", "Closed Won", "closed_won"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    won_result = await canonical_db.opportunities.aggregate(won_pipeline).to_list(1)
    actual_revenue = won_result[0]["total"] if won_result else 0
    won_deals = won_result[0]["count"] if won_result else 0
    revenue_pct = min(round((actual_revenue / target_amount * 100) if target_amount > 0 else 0, 1), 200)

    # --- Vector 2: Activity Achievement ---
    plan_items = await app_db.target_plan_items.find({"revenue_plan_id": data.plan_id, "org_id": org_id}).to_list(100)
    total_target_activities = sum(i.get("target_count", 0) for i in plan_items)
    total_actual_activities = 0
    activity_details = []

    for item in plan_items:
        atype = item.get("activity_type")
        actual = await canonical_db.activities.count_documents({"activity_type": atype, "org_id": org_id}) if atype else 0
        target_c = item.get("target_count", 0)
        total_actual_activities += min(actual, target_c)  # Cap at target per item
        activity_details.append({
            "type": atype,
            "category": item.get("solution_category"),
            "target": target_c,
            "actual": actual,
            "achievement_pct": min(round((actual / target_c * 100) if target_c > 0 else 0, 1), 100)
        })

    activity_pct = min(round((total_actual_activities / total_target_activities * 100) if total_target_activities > 0 else 0, 1), 100)

    # --- Vector 3: Collection Rate ---
    from datetime import datetime
    total_invoices = await canonical_db.invoices.count_documents({})
    paid_invoices = await canonical_db.invoices.count_documents({"payment_state": {"$in": ["paid", "in_payment"]}})
    overdue_count = await canonical_db.invoices.count_documents({
        "payment_state": {"$in": ["not_paid", "partial"]},
        "due_date": {"$lt": datetime.now().strftime("%Y-%m-%d")}
    })

    collection_pct = round((paid_invoices / total_invoices * 100) if total_invoices > 0 else 0, 1)
    on_time_pct = round(((total_invoices - overdue_count) / total_invoices * 100) if total_invoices > 0 else 0, 1)

    # --- Weighted Composite Score ---
    weights_total = data.revenue_weight + data.activity_weight + data.collection_weight
    revenue_w = data.revenue_weight / weights_total
    activity_w = data.activity_weight / weights_total
    collection_w = data.collection_weight / weights_total

    composite_score = round(
        (revenue_pct * revenue_w) + (activity_pct * activity_w) + (on_time_pct * collection_w), 1
    )

    # --- Incentive Tiers ---
    if composite_score >= 120:
        tier = "Super Achiever"
        multiplier = 1.5
    elif composite_score >= 100:
        tier = "Achiever"
        multiplier = 1.2
    elif composite_score >= 80:
        tier = "On Track"
        multiplier = 1.0
    elif composite_score >= 50:
        tier = "Developing"
        multiplier = 0.5
    else:
        tier = "Below Threshold"
        multiplier = 0

    # Get incentive plan if linked
    incentive_plan = None
    plan_id = plan.get("incentive_plan_id")
    if plan_id:
        incentive_plan = await app_db.incentive_plans.find_one({"id": plan_id, "org_id": org_id})

    base_variable = 0
    if incentive_plan:
        base_variable = incentive_plan.get("ote", 0) * (incentive_plan.get("pay_mix_variable", 40) / 100)
    else:
        base_variable = target_amount * 0.04  # Default 4% of target as variable

    payout = round(base_variable * multiplier, 2)

    return {
        "plan_id": data.plan_id,
        "plan_name": plan.get("name"),
        "product_manager": pm_name,
        "target_amount": target_amount,
        "vectors": {
            "revenue": {
                "weight": data.revenue_weight,
                "target": target_amount,
                "actual": actual_revenue,
                "won_deals": won_deals,
                "achievement_pct": revenue_pct,
                "weighted_score": round(revenue_pct * revenue_w, 1)
            },
            "activity": {
                "weight": data.activity_weight,
                "total_target": total_target_activities,
                "total_actual": total_actual_activities,
                "achievement_pct": activity_pct,
                "weighted_score": round(activity_pct * activity_w, 1),
                "details": activity_details
            },
            "collection": {
                "weight": data.collection_weight,
                "total_invoices": total_invoices,
                "paid_invoices": paid_invoices,
                "overdue_count": overdue_count,
                "collection_rate": collection_pct,
                "on_time_pct": on_time_pct,
                "weighted_score": round(on_time_pct * collection_w, 1)
            }
        },
        "composite_score": composite_score,
        "tier": tier,
        "multiplier": multiplier,
        "base_variable_pay": base_variable,
        "calculated_payout": payout,
        "breakdown": [
            {"label": f"Revenue ({data.revenue_weight}%)", "score": revenue_pct, "weighted": round(revenue_pct * revenue_w, 1)},
            {"label": f"Activities ({data.activity_weight}%)", "score": activity_pct, "weighted": round(activity_pct * activity_w, 1)},
            {"label": f"Collection ({data.collection_weight}%)", "score": on_time_pct, "weighted": round(on_time_pct * collection_w, 1)},
        ]
    }



# ==================== SUGGESTIONS ====================

@plans_router.get("/revenue/{plan_id}/suggestions")
async def get_activity_suggestions(plan_id: str, current_user: dict = Depends(get_current_user)):
    """Get auto-generated activity suggestions for a revenue plan"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    suggestion = await app_db.activity_suggestions.find_one(
        {"revenue_plan_id": plan_id, "org_id": org_id}
    )
    if not suggestion:
        return None
    return serialize_doc(suggestion)


@plans_router.post("/revenue/{plan_id}/suggestions/accept")
async def accept_suggestions(
    plan_id: str,
    modifications: Optional[List[dict]] = None,
    current_user: dict = Depends(get_current_user)
):
    """PD accepts suggestions (optionally modified) and creates plan items"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    suggestion = await app_db.activity_suggestions.find_one(
        {"revenue_plan_id": plan_id, "org_id": org_id}
    )
    if not suggestion:
        raise HTTPException(status_code=404, detail="No suggestions found")
    
    plan = await app_db.target_plans.find_one({"id": plan_id, "org_id": org_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Use modifications if provided, otherwise use original suggestions
    items_to_create = modifications if modifications else suggestion.get("suggestions", [])
    
    created = []
    for item in items_to_create:
        if item.get("count", 0) <= 0:
            continue
        doc = {
            "id": generate_id(),
            "org_id": org_id,
            "revenue_plan_id": plan_id,
            "product_manager_name": plan.get("product_manager_name"),
            "activity_type": item.get("activity_type"),
            "solution_category": item.get("solution_category", ""),
            "target_count": item.get("count", 0),
            "notes": item.get("formula", "Auto-generated from revenue target"),
            "status": "active",
            "created_by": current_user["id"],
            "created_at": now_utc()
        }
        await app_db.target_plan_items.insert_one(doc)
        created.append(doc)
    
    # Mark suggestions as accepted
    await app_db.activity_suggestions.update_one(
        {"revenue_plan_id": plan_id, "org_id": org_id},
        {"$set": {"status": "accepted", "accepted_at": now_utc()}}
    )
    
    return {"success": True, "items_created": len(created)}


# ==================== REVENUE CAP ====================

@actuals_router.get("/revenue-cap/{plan_id}")
async def get_revenue_cap(plan_id: str, current_user: dict = Depends(get_current_user)):
    """Check if revenue is capped due to low activity for a plan"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    plan = await app_db.target_plans.find_one({"id": plan_id, "org_id": org_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Calculate activity completion
    items = await app_db.target_plan_items.find(
        {"revenue_plan_id": plan_id, "org_id": org_id}
    ).to_list(100)
    
    total_target = sum(i.get("target_count", 0) for i in items)
    total_actual = 0
    for item in items:
        atype = item.get("activity_type")
        if atype:
            actual = await canonical_db.activities.count_documents({"activity_type": atype, "org_id": org_id})
            total_actual += min(actual, item.get("target_count", 0))
    
    activity_pct = round(total_actual / total_target * 100, 1) if total_target > 0 else 0
    
    # Revenue calculation
    pm_name = plan.get("product_manager_name", "")
    target_amount = plan.get("target_amount", 0)
    won_r = await canonical_db.opportunities.aggregate([
        {"$match": {"product_manager": {"$regex": f"{pm_name}", "$options": "i"}, "stage": "Won"}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$sale_value", 0]}}}}
    ]).to_list(1)
    actual_revenue = won_r[0]["total"] if won_r else 0
    raw_revenue_pct = round(actual_revenue / target_amount * 100, 1) if target_amount > 0 else 0
    
    # Apply cap
    is_capped = False
    cap_pct = 100
    effective_revenue_pct = raw_revenue_pct
    
    if total_target > 0:  # Only cap if activity targets exist
        if activity_pct < 50:
            is_capped = True
            cap_pct = 40
            effective_revenue_pct = min(raw_revenue_pct, 40)
        elif activity_pct < 80:
            is_capped = True
            cap_pct = 70
            effective_revenue_pct = min(raw_revenue_pct, 70)
    
    return {
        "plan_id": plan_id,
        "product_director": pm_name,
        "is_capped": is_capped,
        "cap_percentage": cap_pct,
        "activity_completion": activity_pct,
        "activity_target": total_target,
        "activity_actual": total_actual,
        "raw_revenue_pct": raw_revenue_pct,
        "effective_revenue_pct": effective_revenue_pct,
        "actual_revenue": actual_revenue,
        "target_revenue": target_amount,
        "reason": f"Activity completion {activity_pct}% {'< 80% threshold' if is_capped else '>= 80%'}" if total_target > 0 else "No activity targets set"
    }


# ==================== CEO SUMMARY ====================

@actuals_router.get("/ceo-summary")
async def get_ceo_summary(
    year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """CEO single-screen RAG summary with 5 signals + auto-insight"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    from datetime import datetime
    
    # Default to current year
    if not year:
        year = str(datetime.now().year)
    
    # Year filter for opportunities (using date_last_stage_update like Odoo)
    opp_year_filter = {"date_last_stage_update": {"$regex": f"^{year}"}}
    
    # 1. Revenue vs Plan — dual target (Booking + Invoiced)
    plan_query = {"org_id": org_id, "plan_type": {"$in": ["revenue", "booking", "invoiced_revenue"]}}
    plan_query["$or"] = [
        {"name": {"$regex": year}},
        {"period": {"$regex": year}},
        {"year": year},
        {"year": int(year) if year.isdigit() else 0},
    ]
    plans = await app_db.target_plans.find(plan_query).to_list(100)
    if not plans:
        plans = await app_db.target_plans.find({"org_id": org_id, "plan_type": {"$in": ["revenue", "booking", "invoiced_revenue"]}}).to_list(100)
    
    # Booking actuals (Won opportunities)
    total_booking_target = sum(p.get("booking_target", p.get("target_amount", 0)) for p in plans)
    total_invoiced_target = sum(p.get("invoiced_target", 0) for p in plans)
    total_won = 0
    total_invoiced = 0
    for plan in plans:
        pm = plan.get("product_manager_name", "")
        if pm:
            r = await canonical_db.opportunities.aggregate([
                {"$match": {"product_manager": {"$regex": f"{pm}", "$options": "i"}, "stage": "Won", **opp_year_filter}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$sale_value", 0]}}}}
            ]).to_list(1)
            total_won += r[0]["total"] if r else 0
    
    # Invoiced actuals (paid invoices) — only if invoiced targets set
    if total_invoiced_target > 0:
        inv_r = await canonical_db.invoices.aggregate([
            {"$match": {"payment_state": "paid", "invoice_date": {"$regex": f"^{year}"}}},
            {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$amount_total", 0]}}}}
        ]).to_list(1)
        total_invoiced = inv_r[0]["total"] if inv_r else 0
    
    # Combined view
    rev_pct = round(total_won / total_booking_target * 100, 1) if total_booking_target > 0 else 0
    rev_signal = "green" if rev_pct >= 80 else "amber" if rev_pct >= 50 else "red"
    rev_detail = f"Booked: OMR {total_won:,.0f} / {total_booking_target:,.0f}"
    if total_invoiced_target > 0:
        inv_pct = round(total_invoiced / total_invoiced_target * 100, 1)
        rev_detail += f" | Invoiced: OMR {total_invoiced:,.0f} / {total_invoiced_target:,.0f} ({inv_pct}%)"
    
    # 2. Activity Coverage
    all_items = await app_db.target_plan_items.find({"org_id": org_id}).to_list(500)
    act_target = sum(i.get("target_count", 0) for i in all_items)
    act_actual = 0
    for item in all_items:
        atype = item.get("activity_type")
        if atype:
            c = await canonical_db.activities.count_documents({"activity_type": atype, "org_id": org_id, "date_deadline": {"$regex": f"^{year}"}})
            act_actual += min(c, item.get("target_count", 0))
    act_pct = round(act_actual / act_target * 100, 1) if act_target > 0 else 0
    act_signal = "green" if act_pct >= 80 else "amber" if act_pct >= 50 else "red"
    
    # 3. Collections Health
    total_inv = await canonical_db.invoices.count_documents({})
    overdue = await canonical_db.invoices.count_documents({
        "payment_state": {"$in": ["not_paid", "partial"]},
        "due_date": {"$lt": datetime.now().strftime("%Y-%m-%d")}
    })
    overdue_pct = round(overdue / total_inv * 100, 1) if total_inv > 0 else 0
    coll_signal = "green" if overdue_pct < 10 else "amber" if overdue_pct < 25 else "red"
    
    overdue_amt_r = await canonical_db.invoices.aggregate([
        {"$match": {"payment_state": {"$in": ["not_paid", "partial"]}, "due_date": {"$lt": datetime.now().strftime("%Y-%m-%d")}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_total"}}}
    ]).to_list(1)
    overdue_amt = overdue_amt_r[0]["total"] if overdue_amt_r else 0
    
    # 4. Pipeline Coverage
    pipeline_r = await canonical_db.opportunities.aggregate([
        {"$match": {"stage": {"$nin": ["Won", "Lost", "Hold"]}, **opp_year_filter}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$sale_value", 0]}}}}
    ]).to_list(1)
    pipeline = pipeline_r[0]["total"] if pipeline_r else 0
    coverage = round(pipeline / total_booking_target, 1) if total_booking_target > 0 else 0
    pipe_signal = "green" if coverage >= 3 else "amber" if coverage >= 2 else "red"
    
    # 5. Team Execution (based on plan items redistribution)
    total_items = len(all_items)
    items_with_assignment = 0
    for item in all_items:
        redist = await app_db.target_redistributions.count_documents({"plan_item_id": item.get("id"), "org_id": org_id})
        if redist > 0:
            items_with_assignment += 1
    exec_pct = round(items_with_assignment / total_items * 100, 1) if total_items > 0 else 0
    exec_signal = "green" if exec_pct >= 80 else "amber" if exec_pct >= 50 else "red"
    
    # Auto-generate insight
    issues = []
    if rev_signal == "red":
        issues.append(f"revenue at {rev_pct}% of target")
    if act_signal == "red":
        # Find worst activity
        worst_items = sorted(all_items, key=lambda x: x.get("target_count", 0), reverse=True)
        if worst_items:
            issues.append(f"low activity in {worst_items[0].get('solution_category', worst_items[0].get('activity_type', 'unknown'))}")
    if coll_signal == "red":
        issues.append(f"{overdue} overdue invoices (OMR {overdue_amt:,.0f})")
    if pipe_signal == "red":
        issues.append(f"pipeline coverage only {coverage}x (need 3x)")
    
    insight = f"Risk driven by {' and '.join(issues)}." if issues else "All signals healthy."
    
    signals = [
        {"name": "Revenue vs Plan", "value": f"{rev_pct}%", "detail": rev_detail, "signal": rev_signal},
        {"name": "Activity Coverage", "value": f"{act_pct}%", "detail": f"{act_actual} / {act_target} activities", "signal": act_signal},
        {"name": "Collections Health", "value": f"{100 - overdue_pct:.0f}%", "detail": f"{overdue} overdue (OMR {overdue_amt:,.0f})", "signal": coll_signal},
        {"name": "Pipeline Coverage", "value": f"{coverage}x", "detail": f"OMR {pipeline:,.0f} pipeline", "signal": pipe_signal},
        {"name": "Team Execution", "value": f"{exec_pct}%", "detail": f"{items_with_assignment}/{total_items} items assigned", "signal": exec_signal},
    ]
    
    red_count = len([s for s in signals if s["signal"] == "red"])
    amber_count = len([s for s in signals if s["signal"] == "amber"])
    
    return {
        "signals": signals,
        "insight": insight,
        "overall": "red" if red_count >= 2 else "amber" if red_count >= 1 or amber_count >= 2 else "green",
        "red_count": red_count,
        "amber_count": amber_count
    }

