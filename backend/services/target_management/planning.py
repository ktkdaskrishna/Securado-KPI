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

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)

# Routers
lookups_router = APIRouter(prefix="/target-lookups", tags=["target-lookups"])
plans_router = APIRouter(prefix="/target-plans", tags=["target-plans"])
actuals_router = APIRouter(prefix="/target-actuals", tags=["target-actuals"])


# ==================== MODELS ====================

class RevenuePlanCreate(BaseModel):
    """CEO/Director creates revenue target for a Product Manager"""
    name: str
    product_manager_id: Optional[str] = None
    product_manager_name: Optional[str] = None
    target_amount: float = 0
    period: str = "2026-Q1"
    notes: Optional[str] = None


class ActivityPlanItemCreate(BaseModel):
    """PM creates activity plan item (e.g. 10 demos for NDR)"""
    activity_type: str  # Call, Demo, Meeting, Proof of concept, Site Visit, Work Shop
    solution_category: Optional[str] = None
    target_count: int = 0
    notes: Optional[str] = None


class PlanRedistributionCreate(BaseModel):
    """Sales Director assigns plan items to account managers"""
    plan_item_id: str
    assigned_to_name: str
    assigned_to_id: Optional[str] = None
    assigned_count: int = 0
    account_ids: Optional[List[str]] = []


# ==================== LOOKUPS (from Odoo data) ====================

@lookups_router.get("/product-managers")
async def get_product_managers(current_user: dict = Depends(get_current_user)):
    """Get list of product managers from Odoo opportunities data"""
    canonical_db = get_canonical_db()
    pipeline = [
        {"$match": {"product_manager": {"$ne": None}}},
        {"$group": {
            "_id": {"name": "$product_manager", "id": "$product_manager_id"},
            "opp_count": {"$sum": 1},
            "total_pipeline": {"$sum": "$amount"}
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
    """Get salespersons (opportunity owners) from Odoo"""
    canonical_db = get_canonical_db()
    pipeline = [
        {"$match": {"owner_name": {"$ne": None}}},
        {"$group": {
            "_id": "$owner_name",
            "owner_id": {"$first": "$owner_id"},
            "opp_count": {"$sum": 1},
            "total_pipeline": {"$sum": "$amount"},
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


@lookups_router.get("/activity-types")
async def get_activity_types(current_user: dict = Depends(get_current_user)):
    """Get activity types from Odoo"""
    canonical_db = get_canonical_db()
    pipeline = [
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
    current_user: dict = Depends(get_current_user)
):
    """List all revenue plans (CEO-level view)"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")

    query = {"org_id": org_id, "plan_type": "revenue"}
    if period:
        query["period"] = period

    plans = await app_db.target_plans.find(query).sort("created_at", -1).to_list(100)
    serialized = serialize_doc(plans)

    # Enrich with actual data from canonical
    for plan in serialized:
        pm_name = plan.get("product_manager_name")
        if pm_name:
            # Get actual revenue from opportunities for this PM
            pipeline = [
                {"$match": {"product_manager": pm_name, "stage": {"$in": ["Won", "Closed Won", "closed_won"]}}},
                {"$group": {"_id": None, "actual_revenue": {"$sum": "$amount"}, "won_count": {"$sum": 1}}}
            ]
            result = await canonical_db.opportunities.aggregate(pipeline).to_list(1)
            if result:
                plan["actual_revenue"] = result[0].get("actual_revenue", 0)
                plan["won_deals"] = result[0].get("won_count", 0)
            else:
                plan["actual_revenue"] = 0
                plan["won_deals"] = 0

            # Get total pipeline
            pipeline2 = [
                {"$match": {"product_manager": pm_name}},
                {"$group": {"_id": None, "pipeline": {"$sum": "$amount"}, "total_opps": {"$sum": 1}}}
            ]
            result2 = await canonical_db.opportunities.aggregate(pipeline2).to_list(1)
            if result2:
                plan["total_pipeline"] = result2[0].get("pipeline", 0)
                plan["total_opps"] = result2[0].get("total_opps", 0)

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
    org_id = current_user.get("org_id", "default")

    doc = {
        "id": generate_id(),
        "org_id": org_id,
        "plan_type": "revenue",
        "status": "active",
        "actual_revenue": 0,
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "Unknown"),
        "created_at": now_utc(),
        "updated_at": now_utc(),
        **data.model_dump()
    }

    await app_db.target_plans.insert_one(doc)
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


# ==================== ACTUALS (from Odoo data) ====================

@actuals_router.get("/by-product-manager")
async def get_actuals_by_pm(
    product_manager: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get actual performance data per product manager from Odoo"""
    canonical_db = get_canonical_db()

    match = {"product_manager": {"$ne": None}}
    if product_manager:
        match["product_manager"] = product_manager

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$product_manager",
            "total_pipeline": {"$sum": "$amount"},
            "opp_count": {"$sum": 1},
            "won_count": {"$sum": {"$cond": [{"$in": ["$stage", ["Won", "Closed Won", "closed_won"]]}, 1, 0]}},
            "won_amount": {"$sum": {"$cond": [{"$in": ["$stage", ["Won", "Closed Won", "closed_won"]]}, "$amount", 0]}},
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

    match = {}
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

