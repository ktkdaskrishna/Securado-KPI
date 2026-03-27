"""Organization Structure - Department hierarchy synced from Odoo employees"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import logging

from libs.database import get_canonical_db, get_app_db
from libs.utils import serialize_doc, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
org_router = APIRouter(prefix="/org-structure", tags=["org-structure"])


@org_router.get("/tree")
async def get_org_tree(current_user: dict = Depends(get_current_user)):
    """Get organization tree from Odoo employees with manager hierarchy"""
    canonical_db = get_canonical_db()

    employees = await canonical_db.employees.find(
        {}, {"_id": 0, "canonical_id": 1, "source_record_id": 1, "name": 1,
             "job_title": 1, "department_name": 1, "manager_id": 1,
             "email": 1, "active": 1, "mobile_phone": 1}
    ).to_list(500)

    # Build lookup by source_record_id
    emp_map = {}
    for e in employees:
        sid = str(e.get("source_record_id", ""))
        emp_map[sid] = {
            "id": sid,
            "name": e.get("name", ""),
            "job_title": e.get("job_title", ""),
            "department": e.get("department_name", ""),
            "email": e.get("email", ""),
            "active": e.get("active", True),
            "manager_id": str(e.get("manager_id", "")),
            "children": []
        }

    # Build tree
    roots = []
    for sid, emp in emp_map.items():
        mgr_id = emp.get("manager_id", "")
        if mgr_id and mgr_id in emp_map:
            emp_map[mgr_id]["children"].append(emp)
        else:
            roots.append(emp)

    # Sort children by name
    def sort_tree(nodes):
        nodes.sort(key=lambda x: x["name"])
        for n in nodes:
            sort_tree(n["children"])
    sort_tree(roots)

    return roots


@org_router.get("/departments")
async def get_departments(current_user: dict = Depends(get_current_user)):
    """Get department list with employee counts"""
    canonical_db = get_canonical_db()

    pipeline = [
        {"$match": {"department_name": {"$ne": None}}},
        {"$group": {
            "_id": "$department_name",
            "count": {"$sum": 1},
            "active_count": {"$sum": {"$cond": [{"$eq": ["$active", True]}, 1, 0]}},
            "members": {"$push": {"name": "$name", "job_title": "$job_title", "active": "$active", "email": "$email"}}
        }},
        {"$sort": {"count": -1}}
    ]
    results = await canonical_db.employees.aggregate(pipeline).to_list(50)

    return [{
        "name": r["_id"],
        "total": r["count"],
        "active": r["active_count"],
        "inactive": r["count"] - r["active_count"],
        "members": r["members"]
    } for r in results]


@org_router.get("/employees")
async def get_employees(
    active_only: bool = False,
    department: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get employee list with active/inactive status"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()

    query = {}
    if active_only:
        query["active"] = True
    if department:
        query["department_name"] = {"$regex": department, "$options": "i"}

    employees = await canonical_db.employees.find(query, {"_id": 0}).sort("name", 1).to_list(500)

    # Cross-reference with app users to show login status
    app_users = {}
    async for u in app_db.users.find({}, {"_id": 0, "email": 1, "status": 1, "last_login": 1}):
        app_users[u.get("email", "").lower()] = u

    result = []
    for e in employees:
        emp = serialize_doc(e)
        email = (emp.get("email") or "").lower()
        app_user = app_users.get(email)
        emp["has_app_account"] = bool(app_user)
        emp["app_status"] = app_user.get("status") if app_user else None
        emp["last_login"] = app_user.get("last_login") if app_user else None
        result.append(emp)

    return result


@org_router.patch("/employees/{employee_id}/archive")
async def toggle_archive_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archive/unarchive an employee in the app (doesn't affect Odoo)"""
    app_db = get_app_db()
    canonical_db = get_canonical_db()

    emp = await canonical_db.employees.find_one({"source_record_id": employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    current_active = emp.get("active", True)
    new_active = not current_active

    await canonical_db.employees.update_one(
        {"source_record_id": employee_id},
        {"$set": {"active": new_active, "archived_at": now_utc() if not new_active else None}}
    )

    return {"success": True, "active": new_active, "name": emp.get("name")}
