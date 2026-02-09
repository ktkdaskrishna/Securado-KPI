"""Alert Center - Proactive performance monitoring

Automatically scans all revenue plans, activity targets, invoices, and leads
to generate actionable alerts. All data from Odoo canonical DB.

Alert Types:
1. REVENUE_AT_RISK - PM revenue achievement below threshold
2. ACTIVITY_DROP - Activity completion below 50%
3. OVERDUE_SPIKE - Overdue invoices exceed threshold
4. PLAN_UNMATCHED - Redistribution plan items not fully assigned
5. STALE_LEADS - Leads stuck in early stages too long
6. TOP_PERFORMER - PM exceeding targets (positive alert)
"""
from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime
import logging

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)

alerts_router = APIRouter(prefix="/alerts", tags=["alerts"])


@alerts_router.get("")
async def get_alerts(current_user: dict = Depends(get_current_user)):
    """Generate real-time alerts by scanning all performance data"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")

    alerts = []
    now = datetime.now()

    # ===== 1. REVENUE AT RISK =====
    plans = await app_db.target_plans.find({"org_id": org_id, "plan_type": "revenue"}).to_list(100)
    for plan in plans:
        pm_name = plan.get("product_manager_name")
        target = plan.get("target_amount", 0)
        if not pm_name or target <= 0:
            continue

        won_r = await canonical_db.opportunities.aggregate([
            {"$match": {"product_manager": pm_name, "stage": {"$in": ["Won", "Closed Won", "closed_won"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        won = won_r[0]["total"] if won_r else 0
        pct = round((won / target * 100) if target > 0 else 0, 1)

        if pct < 10:
            alerts.append({
                "type": "REVENUE_AT_RISK",
                "severity": "critical",
                "title": f"{pm_name}: Revenue critically low",
                "message": f"Only {pct}% of OMR {target:,.0f} target achieved (OMR {won:,.0f} won). Immediate attention needed.",
                "entity": pm_name,
                "metric": pct,
                "target": target,
                "actual": won,
            })
        elif pct < 50:
            alerts.append({
                "type": "REVENUE_AT_RISK",
                "severity": "high",
                "title": f"{pm_name}: Revenue behind target",
                "message": f"{pct}% of OMR {target:,.0f} target achieved. Pipeline acceleration needed.",
                "entity": pm_name,
                "metric": pct,
                "target": target,
                "actual": won,
            })

    # ===== 2. ACTIVITY DROP =====
    for plan in plans:
        pm_name = plan.get("product_manager_name")
        if not pm_name:
            continue

        items = await app_db.target_plan_items.find({
            "revenue_plan_id": plan["id"], "org_id": org_id
        }).to_list(100)

        for item in items:
            atype = item.get("activity_type")
            target_count = item.get("target_count", 0)
            if not atype or target_count <= 0:
                continue

            actual = await canonical_db.activities.count_documents({
                "activity_type": atype, "org_id": org_id
            })
            pct = round((actual / target_count * 100) if target_count > 0 else 0, 1)

            if pct < 30:
                alerts.append({
                    "type": "ACTIVITY_DROP",
                    "severity": "high",
                    "title": f"{atype} severely behind for {pm_name}",
                    "message": f"Only {actual}/{target_count} ({pct}%) {atype} activities completed. Category: {item.get('solution_category', 'General')}.",
                    "entity": pm_name,
                    "metric": pct,
                    "target": target_count,
                    "actual": actual,
                })
            elif pct >= 100:
                alerts.append({
                    "type": "TOP_PERFORMER",
                    "severity": "positive",
                    "title": f"{atype} target exceeded",
                    "message": f"{actual}/{target_count} ({pct}%) {atype} activities done by {pm_name}. Great execution!",
                    "entity": pm_name,
                    "metric": pct,
                    "target": target_count,
                    "actual": actual,
                })

    # ===== 3. PLAN UNMATCHED =====
    for plan in plans:
        pm_name = plan.get("product_manager_name")
        items = await app_db.target_plan_items.find({
            "revenue_plan_id": plan["id"], "org_id": org_id
        }).to_list(100)

        for item in items:
            target_count = item.get("target_count", 0)
            if target_count <= 0:
                continue

            redist_total = 0
            async for r in app_db.target_redistributions.find({"plan_item_id": item["id"], "org_id": org_id}):
                redist_total += r.get("assigned_count", 0)

            if redist_total < target_count:
                remaining = target_count - redist_total
                alerts.append({
                    "type": "PLAN_UNMATCHED",
                    "severity": "medium",
                    "title": f"{item.get('activity_type')} not fully assigned",
                    "message": f"{remaining} of {target_count} {item.get('activity_type')} still unassigned for {pm_name} ({item.get('solution_category', 'General')}). Sales Director needs to redistribute.",
                    "entity": pm_name,
                    "metric": round(redist_total / target_count * 100, 0),
                    "target": target_count,
                    "actual": redist_total,
                })

    # ===== 4. OVERDUE INVOICES =====
    overdue_count = await canonical_db.invoices.count_documents({
        "payment_state": {"$in": ["not_paid", "partial"]},
        "due_date": {"$lt": now.strftime("%Y-%m-%d")}
    })
    overdue_amt_r = await canonical_db.invoices.aggregate([
        {"$match": {"payment_state": {"$in": ["not_paid", "partial"]}, "due_date": {"$lt": now.strftime("%Y-%m-%d")}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_total"}}}
    ]).to_list(1)
    overdue_amt = overdue_amt_r[0]["total"] if overdue_amt_r else 0

    total_invoices = await canonical_db.invoices.count_documents({})
    overdue_pct = round((overdue_count / total_invoices * 100) if total_invoices > 0 else 0, 1)

    if overdue_pct > 25:
        alerts.append({
            "type": "OVERDUE_SPIKE",
            "severity": "critical",
            "title": f"Invoice overdue rate critical: {overdue_pct}%",
            "message": f"{overdue_count} of {total_invoices} invoices overdue (OMR {overdue_amt:,.0f}). Collection effort urgently needed.",
            "entity": "Finance",
            "metric": overdue_pct,
            "target": total_invoices,
            "actual": overdue_count,
        })
    elif overdue_pct > 15:
        alerts.append({
            "type": "OVERDUE_SPIKE",
            "severity": "high",
            "title": f"Invoice overdue rate elevated: {overdue_pct}%",
            "message": f"{overdue_count} invoices overdue totaling OMR {overdue_amt:,.0f}.",
            "entity": "Finance",
            "metric": overdue_pct,
            "target": total_invoices,
            "actual": overdue_count,
        })

    # ===== 5. STALE LEADS =====
    stale_leads = await canonical_db.opportunities.count_documents({
        "type": "lead",
        "lead_stage": {"$in": ["Enquiry", "Assigned"]},
    })
    total_leads = await canonical_db.opportunities.count_documents({"type": "lead"})
    stale_pct = round((stale_leads / total_leads * 100) if total_leads > 0 else 0, 1)

    if stale_pct > 40:
        alerts.append({
            "type": "STALE_LEADS",
            "severity": "medium",
            "title": f"{stale_pct}% of leads stuck in early stages",
            "message": f"{stale_leads} of {total_leads} leads still in Enquiry/Assigned stage. Review lead qualification process.",
            "entity": "Marketing/Sales",
            "metric": stale_pct,
            "target": total_leads,
            "actual": stale_leads,
        })

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "positive": 4}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 5))

    # Summary counts
    summary = {
        "total": len(alerts),
        "critical": len([a for a in alerts if a["severity"] == "critical"]),
        "high": len([a for a in alerts if a["severity"] == "high"]),
        "medium": len([a for a in alerts if a["severity"] == "medium"]),
        "positive": len([a for a in alerts if a["severity"] == "positive"]),
    }

    return {"alerts": alerts, "summary": summary, "generated_at": now.isoformat()}
