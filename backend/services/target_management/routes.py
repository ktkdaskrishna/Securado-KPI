"""Target Management Service - Sales Targets, Activity Targets, Incentive Calculation

Handles:
- Hierarchical sales target assignment (Company → Product → Team → Individual)
- Product-specific targets for Product Directors
- Activity-based targets (calls, meetings, demos, POCs)
- Incentive plan configuration with tiered commissions
- Incentive calculation engine with accelerators, SPIFFs, product multipliers
- Target sheets for Product Directors
- Leaderboard and progress tracking
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
import logging

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.routes import get_current_user
from services.target_management.models import (
    SalesTargetCreate, SalesTargetUpdate, ActivityTargetCreate,
    IncentivePlanCreate, TargetSheetCreate, TargetProgressUpdate,
    IncentiveCalcRequest
)

logger = logging.getLogger(__name__)

sales_targets_router = APIRouter(prefix="/sales-targets", tags=["sales-targets"])
activity_targets_router = APIRouter(prefix="/activity-targets", tags=["activity-targets"])
incentive_plans_router = APIRouter(prefix="/incentive-plans", tags=["incentive-plans"])
target_sheets_router = APIRouter(prefix="/target-sheets", tags=["target-sheets"])
incentive_calc_router = APIRouter(prefix="/incentive-calc", tags=["incentive-calc"])


# ==================== SALES TARGETS ====================

@sales_targets_router.get("")
async def list_sales_targets(
    department: Optional[str] = None,
    assigned_to: Optional[str] = None,
    period_type: Optional[str] = None,
    target_type: Optional[str] = None,
    status: Optional[str] = None,
    parent_target_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List sales targets with optional filters"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    query = {"org_id": org_id}

    if department:
        query["department"] = department
    if assigned_to:
        query["assigned_to"] = assigned_to
    if period_type:
        query["period_type"] = period_type
    if target_type:
        query["target_type"] = target_type
    if status:
        query["status"] = status
    if parent_target_id:
        query["parent_target_id"] = parent_target_id

    targets = await app_db.sales_targets.find(query).sort("created_at", -1).to_list(1000)
    return serialize_doc(targets)


@sales_targets_router.get("/hierarchy")
async def get_target_hierarchy(
    period_type: Optional[str] = "quarterly",
    current_user: dict = Depends(get_current_user)
):
    """Get hierarchical target tree (Company → Product → Team → Individual)"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    all_targets = await app_db.sales_targets.find({
        "org_id": org_id,
        "period_type": period_type
    }).to_list(1000)

    serialized = serialize_doc(all_targets)

    # Build tree: root targets (no parent) with children nested
    target_map = {t["id"]: {**t, "children": []} for t in serialized}
    roots = []
    for t in serialized:
        parent_id = t.get("parent_target_id")
        if parent_id and parent_id in target_map:
            target_map[parent_id]["children"].append(target_map[t["id"]])
        else:
            roots.append(target_map[t["id"]])

    return roots


@sales_targets_router.get("/summary")
async def get_targets_summary(
    period_type: Optional[str] = "quarterly",
    current_user: dict = Depends(get_current_user)
):
    """Get summary statistics for sales targets"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    targets = await app_db.sales_targets.find({
        "org_id": org_id,
        "period_type": period_type
    }).to_list(1000)

    total = len(targets)
    total_target_value = sum(t.get("target_value", 0) for t in targets)
    total_achieved = sum(t.get("current_value", 0) for t in targets)
    active = len([t for t in targets if t.get("status") == "active"])
    achieved = len([t for t in targets if t.get("status") == "achieved"])
    at_risk = len([t for t in targets if t.get("current_value", 0) < t.get("target_value", 0) * 0.5 and t.get("status") == "active"])

    overall_pct = round((total_achieved / total_target_value * 100), 1) if total_target_value > 0 else 0

    # By department
    dept_summary = {}
    for t in targets:
        dept = t.get("department", "other")
        if dept not in dept_summary:
            dept_summary[dept] = {"target": 0, "achieved": 0, "count": 0}
        dept_summary[dept]["target"] += t.get("target_value", 0)
        dept_summary[dept]["achieved"] += t.get("current_value", 0)
        dept_summary[dept]["count"] += 1

    return {
        "total_targets": total,
        "total_target_value": total_target_value,
        "total_achieved_value": total_achieved,
        "overall_achievement_pct": overall_pct,
        "active": active,
        "achieved": achieved,
        "at_risk": at_risk,
        "by_department": dept_summary
    }


@sales_targets_router.get("/leaderboard")
async def get_target_leaderboard(
    period_type: Optional[str] = "quarterly",
    department: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get leaderboard of individual target achievement"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    query = {
        "org_id": org_id,
        "period_type": period_type,
        "assigned_to": {"$ne": None}
    }
    if department:
        query["department"] = department

    targets = await app_db.sales_targets.find(query).to_list(1000)

    # Aggregate by assigned_to
    user_scores = {}
    for t in targets:
        uid = t.get("assigned_to", "unknown")
        name = t.get("assigned_to_name", "Unknown")
        if uid not in user_scores:
            user_scores[uid] = {
                "user_id": uid,
                "user_name": name,
                "total_target": 0,
                "total_achieved": 0,
                "targets_count": 0,
                "targets_achieved": 0
            }
        user_scores[uid]["total_target"] += t.get("target_value", 0)
        user_scores[uid]["total_achieved"] += t.get("current_value", 0)
        user_scores[uid]["targets_count"] += 1
        if t.get("status") == "achieved":
            user_scores[uid]["targets_achieved"] += 1

    for u in user_scores.values():
        u["achievement_pct"] = round(
            (u["total_achieved"] / u["total_target"] * 100) if u["total_target"] > 0 else 0, 1
        )

    leaderboard = sorted(user_scores.values(), key=lambda x: x["achievement_pct"], reverse=True)
    return leaderboard[:limit]


@sales_targets_router.get("/{target_id}")
async def get_sales_target(target_id: str, current_user: dict = Depends(get_current_user)):
    """Get single sales target with children"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    target = await app_db.sales_targets.find_one({"id": target_id, "org_id": org_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    result = serialize_doc(target)

    # Fetch children
    children = await app_db.sales_targets.find({
        "parent_target_id": target_id, "org_id": org_id
    }).to_list(100)
    result["children"] = serialize_doc(children)

    # Fetch related activity targets
    activity_targets = await app_db.activity_targets.find({
        "parent_target_id": target_id, "org_id": org_id
    }).to_list(100)
    result["activity_targets"] = serialize_doc(activity_targets)

    return result


@sales_targets_router.post("")
async def create_sales_target(
    data: SalesTargetCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a sales target"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    doc = {
        "id": generate_id(),
        "org_id": org_id,
        "current_value": 0,
        "progress_pct": 0,
        "status": "active",
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "Unknown"),
        "created_at": now_utc(),
        "updated_at": now_utc(),
        **data.model_dump()
    }

    await app_db.sales_targets.insert_one(doc)
    return serialize_doc(doc)


@sales_targets_router.put("/{target_id}")
async def update_sales_target(
    target_id: str,
    data: SalesTargetUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a sales target"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    update_fields["updated_at"] = now_utc()

    # Recalculate progress if values changed
    if "current_value" in update_fields or "target_value" in update_fields:
        target = await app_db.sales_targets.find_one({"id": target_id, "org_id": org_id})
        if target:
            cv = update_fields.get("current_value", target.get("current_value", 0))
            tv = update_fields.get("target_value", target.get("target_value", 0))
            update_fields["progress_pct"] = round((cv / tv * 100) if tv > 0 else 0, 1)
            if cv >= tv and tv > 0:
                update_fields["status"] = "achieved"

    result = await app_db.sales_targets.update_one(
        {"id": target_id, "org_id": org_id},
        {"$set": update_fields}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Target not found")

    return {"success": True, "message": "Target updated"}


@sales_targets_router.patch("/{target_id}/progress")
async def update_target_progress(
    target_id: str,
    data: TargetProgressUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update target progress value"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    target = await app_db.sales_targets.find_one({"id": target_id, "org_id": org_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    tv = target.get("target_value", 0)
    progress_pct = round((data.current_value / tv * 100) if tv > 0 else 0, 1)
    status = "achieved" if data.current_value >= tv and tv > 0 else target.get("status", "active")

    await app_db.sales_targets.update_one(
        {"id": target_id, "org_id": org_id},
        {"$set": {
            "current_value": data.current_value,
            "progress_pct": progress_pct,
            "status": status,
            "updated_at": now_utc()
        }}
    )

    return {
        "success": True,
        "current_value": data.current_value,
        "progress_pct": progress_pct,
        "status": status
    }


@sales_targets_router.delete("/{target_id}")
async def delete_sales_target(target_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a sales target and its children"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    result = await app_db.sales_targets.delete_one({"id": target_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Target not found")

    # Delete children
    await app_db.sales_targets.delete_many({"parent_target_id": target_id, "org_id": org_id})
    await app_db.activity_targets.delete_many({"parent_target_id": target_id, "org_id": org_id})

    return {"success": True, "message": "Target and children deleted"}


@sales_targets_router.post("/{target_id}/cascade")
async def cascade_target(
    target_id: str,
    team_members: List[dict] = [],
    current_user: dict = Depends(get_current_user)
):
    """Cascade a target to team members with equal/weighted distribution"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    parent = await app_db.sales_targets.find_one({"id": target_id, "org_id": org_id})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent target not found")

    if not team_members:
        raise HTTPException(status_code=400, detail="No team members specified")

    total_weight = sum(m.get("weight", 1) for m in team_members)
    child_targets = []

    for member in team_members:
        weight = member.get("weight", 1)
        share = weight / total_weight
        child_value = round(parent.get("target_value", 0) * share, 2)

        child = {
            "id": generate_id(),
            "org_id": org_id,
            "name": f"{parent.get('name', 'Target')} - {member.get('name', 'Member')}",
            "description": f"Cascaded from: {parent.get('name', '')}",
            "target_type": parent.get("target_type", "revenue"),
            "target_value": child_value,
            "target_unit": parent.get("target_unit", "OMR"),
            "current_value": 0,
            "progress_pct": 0,
            "status": "active",
            "period_type": parent.get("period_type", "quarterly"),
            "start_date": parent.get("start_date"),
            "end_date": parent.get("end_date"),
            "assigned_to": member.get("user_id"),
            "assigned_to_name": member.get("name"),
            "parent_target_id": target_id,
            "department": parent.get("department", "sales"),
            "product_id": parent.get("product_id"),
            "product_name": parent.get("product_name"),
            "created_by": current_user["id"],
            "created_by_name": current_user.get("name", "Unknown"),
            "created_at": now_utc(),
            "updated_at": now_utc()
        }
        child_targets.append(child)

    if child_targets:
        await app_db.sales_targets.insert_many(child_targets)

    return {
        "success": True,
        "message": f"Target cascaded to {len(child_targets)} members",
        "children": serialize_doc(child_targets)
    }


# ==================== ACTIVITY TARGETS ====================

@activity_targets_router.get("")
async def list_activity_targets(
    assigned_to: Optional[str] = None,
    activity_type: Optional[str] = None,
    period_type: Optional[str] = None,
    parent_target_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List activity targets"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    query = {"org_id": org_id}

    if assigned_to:
        query["assigned_to"] = assigned_to
    if activity_type:
        query["activity_type"] = activity_type
    if period_type:
        query["period_type"] = period_type
    if parent_target_id:
        query["parent_target_id"] = parent_target_id

    targets = await app_db.activity_targets.find(query).sort("created_at", -1).to_list(1000)
    return serialize_doc(targets)


@activity_targets_router.get("/summary")
async def get_activity_targets_summary(
    period_type: Optional[str] = "monthly",
    current_user: dict = Depends(get_current_user)
):
    """Get activity targets summary with actual counts from activities collection"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    targets = await app_db.activity_targets.find({
        "org_id": org_id,
        "period_type": period_type
    }).to_list(1000)

    # Aggregate by activity type
    by_type = {}
    for t in targets:
        atype = t.get("activity_type", "other")
        if atype not in by_type:
            by_type[atype] = {"target_count": 0, "actual_count": 0, "targets": 0}
        by_type[atype]["target_count"] += t.get("target_count", 0)
        by_type[atype]["actual_count"] += t.get("current_count", 0)
        by_type[atype]["targets"] += 1

    for atype in by_type:
        tc = by_type[atype]["target_count"]
        ac = by_type[atype]["actual_count"]
        by_type[atype]["achievement_pct"] = round((ac / tc * 100) if tc > 0 else 0, 1)

    total_target = sum(t.get("target_count", 0) for t in targets)
    total_actual = sum(t.get("current_count", 0) for t in targets)

    return {
        "total_targets": len(targets),
        "total_target_count": total_target,
        "total_actual_count": total_actual,
        "overall_achievement_pct": round((total_actual / total_target * 100) if total_target > 0 else 0, 1),
        "by_type": by_type
    }


@activity_targets_router.get("/scoreboard")
async def get_activity_scoreboard(
    period_type: Optional[str] = "monthly",
    current_user: dict = Depends(get_current_user)
):
    """Get activity scoreboard per user"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    targets = await app_db.activity_targets.find({
        "org_id": org_id,
        "period_type": period_type,
        "assigned_to": {"$ne": None}
    }).to_list(1000)

    user_scores = {}
    for t in targets:
        uid = t.get("assigned_to", "unknown")
        name = t.get("assigned_to_name", "Unknown")
        if uid not in user_scores:
            user_scores[uid] = {
                "user_id": uid,
                "user_name": name,
                "activities": {},
                "total_target": 0,
                "total_actual": 0
            }
        atype = t.get("activity_type", "other")
        user_scores[uid]["activities"][atype] = {
            "target": t.get("target_count", 0),
            "actual": t.get("current_count", 0)
        }
        user_scores[uid]["total_target"] += t.get("target_count", 0)
        user_scores[uid]["total_actual"] += t.get("current_count", 0)

    for u in user_scores.values():
        u["achievement_pct"] = round(
            (u["total_actual"] / u["total_target"] * 100) if u["total_target"] > 0 else 0, 1
        )

    scoreboard = sorted(user_scores.values(), key=lambda x: x["achievement_pct"], reverse=True)
    return scoreboard


@activity_targets_router.get("/{target_id}")
async def get_activity_target(target_id: str, current_user: dict = Depends(get_current_user)):
    """Get single activity target"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    target = await app_db.activity_targets.find_one({"id": target_id, "org_id": org_id})
    if not target:
        raise HTTPException(status_code=404, detail="Activity target not found")

    return serialize_doc(target)


@activity_targets_router.post("")
async def create_activity_target(
    data: ActivityTargetCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create an activity target"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    doc = {
        "id": generate_id(),
        "org_id": org_id,
        "current_count": 0,
        "progress_pct": 0,
        "status": "active",
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "Unknown"),
        "created_at": now_utc(),
        "updated_at": now_utc(),
        **data.model_dump()
    }

    await app_db.activity_targets.insert_one(doc)
    return serialize_doc(doc)


@activity_targets_router.patch("/{target_id}/log")
async def log_activity_count(
    target_id: str,
    increment: int = 1,
    current_user: dict = Depends(get_current_user)
):
    """Increment activity count for a target"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    target = await app_db.activity_targets.find_one({"id": target_id, "org_id": org_id})
    if not target:
        raise HTTPException(status_code=404, detail="Activity target not found")

    new_count = target.get("current_count", 0) + increment
    tc = target.get("target_count", 0)
    progress_pct = round((new_count / tc * 100) if tc > 0 else 0, 1)
    status = "achieved" if new_count >= tc and tc > 0 else "active"

    await app_db.activity_targets.update_one(
        {"id": target_id, "org_id": org_id},
        {"$set": {
            "current_count": new_count,
            "progress_pct": progress_pct,
            "status": status,
            "updated_at": now_utc()
        }}
    )

    return {"success": True, "current_count": new_count, "progress_pct": progress_pct, "status": status}


@activity_targets_router.delete("/{target_id}")
async def delete_activity_target(target_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an activity target"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    result = await app_db.activity_targets.delete_one({"id": target_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Activity target not found")

    return {"success": True, "message": "Activity target deleted"}


# ==================== INCENTIVE PLANS ====================

@incentive_plans_router.get("")
async def list_incentive_plans(current_user: dict = Depends(get_current_user)):
    """List all incentive plans"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    plans = await app_db.incentive_plans.find({"org_id": org_id}).sort("created_at", -1).to_list(100)
    return serialize_doc(plans)


@incentive_plans_router.get("/{plan_id}")
async def get_incentive_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    """Get single incentive plan"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    plan = await app_db.incentive_plans.find_one({"id": plan_id, "org_id": org_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Incentive plan not found")

    return serialize_doc(plan)


@incentive_plans_router.post("")
async def create_incentive_plan(
    data: IncentivePlanCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create an incentive plan with commission slabs"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    doc = {
        "id": generate_id(),
        "org_id": org_id,
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "Unknown"),
        "created_at": now_utc(),
        "updated_at": now_utc(),
        **data.model_dump()
    }

    await app_db.incentive_plans.insert_one(doc)
    return serialize_doc(doc)


@incentive_plans_router.put("/{plan_id}")
async def update_incentive_plan(
    plan_id: str,
    data: IncentivePlanCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update an incentive plan"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    result = await app_db.incentive_plans.update_one(
        {"id": plan_id, "org_id": org_id},
        {"$set": {**data.model_dump(), "updated_at": now_utc()}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Incentive plan not found")

    return {"success": True, "message": "Incentive plan updated"}


@incentive_plans_router.delete("/{plan_id}")
async def delete_incentive_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an incentive plan"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    result = await app_db.incentive_plans.delete_one({"id": plan_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Incentive plan not found")

    return {"success": True, "message": "Incentive plan deleted"}


# ==================== INCENTIVE CALCULATION ====================

@incentive_calc_router.post("/calculate")
async def calculate_incentive(
    data: IncentiveCalcRequest,
    current_user: dict = Depends(get_current_user)
):
    """Calculate incentive payout for a sales target"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    target = await app_db.sales_targets.find_one({"id": data.target_id, "org_id": org_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    actual = data.actual_value if data.actual_value is not None else target.get("current_value", 0)
    target_value = target.get("target_value", 0)

    if target_value == 0:
        return {"error": "Target value is zero", "payout": 0}

    attainment_pct = round((actual / target_value * 100), 2)

    # Find incentive plan
    plan_id = target.get("incentive_plan_id")
    plan = None
    if plan_id:
        plan = await app_db.incentive_plans.find_one({"id": plan_id, "org_id": org_id})

    if not plan:
        # Use default calculation
        plans = await app_db.incentive_plans.find({"org_id": org_id}).to_list(1)
        plan = plans[0] if plans else None

    if not plan:
        # Fallback: simple percentage
        base_commission = actual * 0.05  # 5% default
        return {
            "target_id": data.target_id,
            "target_value": target_value,
            "actual_value": actual,
            "attainment_pct": attainment_pct,
            "plan_name": "Default (5%)",
            "base_commission": round(base_commission, 2),
            "spiff_bonus": 0,
            "product_multiplier_bonus": 0,
            "total_payout": round(base_commission, 2),
            "breakdown": [{"label": "Base Commission (5%)", "amount": round(base_commission, 2)}]
        }

    # Calculate tiered commission
    slabs = plan.get("slabs", [])
    base_commission = 0
    breakdown = []
    variable_pay = plan.get("ote", 0) * (plan.get("pay_mix_variable", 40) / 100)

    for slab in sorted(slabs, key=lambda s: s.get("min_percent", 0)):
        slab_min = slab.get("min_percent", 0)
        slab_max = slab.get("max_percent", 100)
        rate = slab.get("commission_rate", 0) / 100

        if attainment_pct >= slab_min:
            effective_pct = min(attainment_pct, slab_max) - slab_min
            slab_amount = (effective_pct / 100) * target_value * rate
            base_commission += slab_amount
            breakdown.append({
                "label": slab.get("label", f"{slab_min}%-{slab_max}% @ {slab.get('commission_rate')}%"),
                "attainment_range": f"{slab_min}%-{min(attainment_pct, slab_max):.0f}%",
                "rate": slab.get("commission_rate"),
                "amount": round(slab_amount, 2)
            })

    # SPIFF bonuses
    spiff_bonus = 0
    spiffs = plan.get("spiffs", [])
    for spiff in spiffs:
        if attainment_pct >= spiff.get("min_attainment", 0):
            spiff_amount = spiff.get("amount", 0)
            spiff_bonus += spiff_amount
            breakdown.append({
                "label": f"SPIFF: {spiff.get('name', 'Bonus')}",
                "amount": round(spiff_amount, 2)
            })

    # Product multiplier bonus
    product_bonus = 0
    product_multipliers = plan.get("product_multipliers", [])
    product_id = target.get("product_id")
    if product_id:
        for pm in product_multipliers:
            if pm.get("product_id") == product_id:
                multiplier = pm.get("multiplier", 1.0)
                product_bonus = base_commission * (multiplier - 1)
                breakdown.append({
                    "label": f"Product Multiplier: {pm.get('product_name', '')} x{multiplier}",
                    "amount": round(product_bonus, 2)
                })
                break

    total_payout = round(base_commission + spiff_bonus + product_bonus, 2)

    return {
        "target_id": data.target_id,
        "target_value": target_value,
        "actual_value": actual,
        "attainment_pct": attainment_pct,
        "plan_name": plan.get("name", "Unknown"),
        "plan_id": plan.get("id"),
        "base_commission": round(base_commission, 2),
        "spiff_bonus": round(spiff_bonus, 2),
        "product_multiplier_bonus": round(product_bonus, 2),
        "total_payout": total_payout,
        "variable_pay_target": round(variable_pay, 2),
        "breakdown": breakdown
    }


@incentive_calc_router.post("/simulate")
async def simulate_incentive(
    plan_id: str,
    target_value: float = 100000,
    scenarios: List[float] = [50, 80, 100, 120, 150],
    current_user: dict = Depends(get_current_user)
):
    """Simulate incentive payouts at different attainment levels"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    plan = await app_db.incentive_plans.find_one({"id": plan_id, "org_id": org_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Incentive plan not found")

    slabs = plan.get("slabs", [])
    results = []

    for scenario_pct in scenarios:
        actual = target_value * (scenario_pct / 100)
        commission = 0

        for slab in sorted(slabs, key=lambda s: s.get("min_percent", 0)):
            slab_min = slab.get("min_percent", 0)
            slab_max = slab.get("max_percent", 100)
            rate = slab.get("commission_rate", 0) / 100

            if scenario_pct >= slab_min:
                effective_pct = min(scenario_pct, slab_max) - slab_min
                slab_amount = (effective_pct / 100) * target_value * rate
                commission += slab_amount

        results.append({
            "attainment_pct": scenario_pct,
            "actual_value": round(actual, 2),
            "commission": round(commission, 2),
            "effective_rate": round((commission / actual * 100) if actual > 0 else 0, 2)
        })

    return {
        "plan_name": plan.get("name"),
        "target_value": target_value,
        "simulations": results
    }


# ==================== TARGET SHEETS ====================

@target_sheets_router.get("")
async def list_target_sheets(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List target sheets"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    query = {"org_id": org_id}
    if status:
        query["status"] = status

    sheets = await app_db.target_sheets.find(query).sort("created_at", -1).to_list(100)
    return serialize_doc(sheets)


@target_sheets_router.get("/{sheet_id}")
async def get_target_sheet(sheet_id: str, current_user: dict = Depends(get_current_user)):
    """Get single target sheet"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    sheet = await app_db.target_sheets.find_one({"id": sheet_id, "org_id": org_id})
    if not sheet:
        raise HTTPException(status_code=404, detail="Target sheet not found")

    return serialize_doc(sheet)


@target_sheets_router.post("")
async def create_target_sheet(
    data: TargetSheetCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a target sheet (for Product Directors)"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    doc = {
        "id": generate_id(),
        "org_id": org_id,
        "owner_id": current_user["id"],
        "owner_name": current_user.get("name", "Unknown"),
        "status": "draft",
        "created_at": now_utc(),
        "updated_at": now_utc(),
        **data.model_dump()
    }

    await app_db.target_sheets.insert_one(doc)
    return serialize_doc(doc)


@target_sheets_router.put("/{sheet_id}")
async def update_target_sheet(
    sheet_id: str,
    data: TargetSheetCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a target sheet"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    result = await app_db.target_sheets.update_one(
        {"id": sheet_id, "org_id": org_id},
        {"$set": {**data.model_dump(), "updated_at": now_utc()}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Target sheet not found")

    return {"success": True, "message": "Target sheet updated"}


@target_sheets_router.patch("/{sheet_id}/activate")
async def activate_target_sheet(
    sheet_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Activate a target sheet and create activity targets from it"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    sheet = await app_db.target_sheets.find_one({"id": sheet_id, "org_id": org_id})
    if not sheet:
        raise HTTPException(status_code=404, detail="Target sheet not found")

    # Create activity targets from sheet targets
    created = []
    for t in sheet.get("targets", []):
        assigned_users = t.get("assigned_to", [])
        per_user_count = t.get("target_count", 0)

        if isinstance(assigned_users, list):
            for user in assigned_users:
                uid = user if isinstance(user, str) else user.get("user_id", "")
                uname = user if isinstance(user, str) else user.get("name", "Unknown")
                doc = {
                    "id": generate_id(),
                    "org_id": org_id,
                    "name": f"{t.get('category', 'Activity')} Target - {uname}",
                    "activity_type": t.get("category", "other"),
                    "target_count": per_user_count,
                    "current_count": 0,
                    "progress_pct": 0,
                    "status": "active",
                    "period_type": "quarterly",
                    "assigned_to": uid,
                    "assigned_to_name": uname,
                    "parent_target_id": sheet_id,
                    "created_by": current_user["id"],
                    "created_at": now_utc(),
                    "updated_at": now_utc()
                }
                created.append(doc)

    if created:
        await app_db.activity_targets.insert_many(created)

    await app_db.target_sheets.update_one(
        {"id": sheet_id, "org_id": org_id},
        {"$set": {"status": "active", "updated_at": now_utc()}}
    )

    return {
        "success": True,
        "message": f"Target sheet activated, {len(created)} activity targets created",
        "activity_targets_created": len(created)
    }


@target_sheets_router.delete("/{sheet_id}")
async def delete_target_sheet(sheet_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a target sheet"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")

    result = await app_db.target_sheets.delete_one({"id": sheet_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Target sheet not found")

    return {"success": True, "message": "Target sheet deleted"}
