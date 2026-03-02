"""CRM Sales - Split module. See helpers.py for shared imports."""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc, PipelineStages
from libs.event_bus import emit_event
from libs.schemas import Topics
from services.identity.routes import get_current_user
from services.crm_sales.models import *
from services.crm_sales.bluesheet import calculate_bluesheet_probability, get_bluesheet_form_options, BUYING_INFLUENCES, COMPETITION_STATUS, BUDGET_STATUS
from services.rbac_sync.middleware import get_rbac_filter
from services.crm_sales.helpers import STAGE_ALIASES, apply_date_filters, merge_with_overrides, normalize_stage, STAGE_MAPPING

logger = logging.getLogger(__name__)

receivables_router = APIRouter(prefix="/receivables", tags=["receivables"])


# ==================== RECEIVABLES ====================

@receivables_router.get("")
async def list_receivables(
    request: Request,
    current_user: dict = Depends(get_current_user),
    status: str = Query(None, description="Filter by payment status: pending, paid, overdue, all"),
    account: str = Query(None, description="Filter by account name"),
    year: str = Query(None, description="Filter by year (based on invoice_date)"),
    quarter: str = Query(None, description="Filter by quarter (Q1, Q2, Q3, Q4)"),
    limit: int = Query(200, description="Maximum number of records")
):
    """List receivables/invoices from synced Odoo data with contextual filters (RBAC enforced)"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Receivables request - status: {status}, account: {account}, year: {year}, quarter: {quarter}")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "invoice")
    
    # Check if user has NO_ACCESS
    has_no_access = rbac_filter and "_id" in rbac_filter and rbac_filter.get("_id", {}).get("$eq") == "NO_ACCESS_USER_NOT_IN_RBAC"
    if has_no_access:
        return {"invoices": [], "summary": {"total": 0, "paid": 0, "pending": 0, "overdue": 0}}
    
    # Build query — use hierarchy RBAC for proper org tree filtering
    from services.target_management.card_builder import resolve_hierarchy_filter
    query = {"org_id": org_id}
    hierarchy_filter = await resolve_hierarchy_filter(current_user, "invoices")
    if hierarchy_filter:
        for k, v in hierarchy_filter.items():
            if k == "$or":
                query.setdefault("$and", []).append({"$or": v})
            else:
                query[k] = v
    
    # Filter by account if provided
    if account:
        query["account_name"] = account
    
    # Only show posted/confirmed invoices (exclude draft and cancelled)
    query["state"] = {"$in": ["posted"]}
    query["invoice_number"] = {"$ne": "/"}
    
    # Fetch invoices
    invoices = await canonical_db.invoices.find(query).sort("due_date", -1).limit(500).to_list(500)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Apply date filters
    if year or quarter:
        quarter_months = {
            "Q1": ["01", "02", "03"], 
            "Q2": ["04", "05", "06"], 
            "Q3": ["07", "08", "09"], 
            "Q4": ["10", "11", "12"]
        }
        filtered = []
        for inv in invoices:
            inv_date = inv.get("invoice_date")
            if not inv_date:
                continue
            
            if year and not str(inv_date).startswith(str(year)):
                continue
            
            if quarter:
                months = quarter_months.get(quarter, [])
                inv_month = str(inv_date)[5:7] if len(str(inv_date)) >= 7 else ""
                if inv_month not in months:
                    continue
            
            filtered.append(inv)
        invoices = filtered
    
    # Build SO lookup for margin data (from Odoo-synced sales_orders)
    so_by_customer = {}
    so_cursor = canonical_db.sales_orders.find(
        {"active": True, "customer": {"$ne": None, "$ne": ""}},
        {"_id": 0, "so_number": 1, "customer": 1, "salesperson": 1, "margin": 1, "margin_percent": 1, "amount": 1}
    )
    async for so in so_cursor:
        cust = so.get("customer", "")
        if cust:
            # Keep the SO with highest margin for each customer
            existing = so_by_customer.get(cust)
            if not existing or (so.get("margin", 0) or 0) > (existing.get("margin", 0) or 0):
                so_by_customer[cust] = so
    
    # Also build SO lookup by SO number for direct matching
    so_by_number = {}
    so_num_cursor = canonical_db.sales_orders.find(
        {"so_number": {"$ne": "", "$exists": True}},
        {"_id": 0, "so_number": 1, "customer": 1, "salesperson": 1, "margin": 1, "margin_percent": 1, "amount": 1}
    )
    async for so in so_num_cursor:
        so_by_number[so.get("so_number", "")] = so
    
    # Build PM lookup from SO LINES (product_director_id from Odoo — most accurate)
    pm_by_so = {}
    sol_cursor = canonical_db.so_lines.find(
        {"product_manager": {"$ne": "", "$exists": True}},
        {"_id": 0, "so_name": 1, "product_manager": 1, "product_category": 1, "subtotal": 1, "line_margin": 1}
    )
    async for sol in sol_cursor:
        so_name = sol.get("so_name", "")
        if so_name and sol.get("product_manager"):
            existing = pm_by_so.get(so_name)
            if not existing or (sol.get("subtotal", 0) or 0) > (existing.get("subtotal", 0) or 0):
                pm_by_so[so_name] = sol
    

    # Build SO → opportunity link for solution category (SO.opportunity_id → crm.lead)
    so_opp_map = {}
    so_with_opp = canonical_db.sales_orders.find(
        {"opportunity_id_num": {"$ne": None, "$exists": True}},
        {"_id": 0, "so_number": 1, "opportunity_name": 1, "opportunity_id_num": 1}
    )
    async for so in so_with_opp:
        so_num = so.get("so_number", "")
        opp_id = so.get("opportunity_id_num")
        if so_num and opp_id:
            opp = await canonical_db.opportunities.find_one(
                {"source_record_id": str(opp_id)},
                {"_id": 0, "solution_category": 1, "name": 1}
            )
            if opp:
                so_opp_map[so_num] = {"opportunity_name": opp.get("name", ""), "solution_category": opp.get("solution_category", "")}
    

    # Build a product manager lookup from opportunities (by account name)
    acct_pm_map = {}
    opp_cursor = canonical_db.opportunities.find(
        {"active": True, "account_name": {"$ne": None}},
        {"_id": 0, "account_name": 1, "product_manager": 1, "solution_category": 1, "name": 1, "owner_name": 1}
    )
    async for opp in opp_cursor:
        acct = opp.get("account_name", "")
        if acct and acct not in acct_pm_map:
            acct_pm_map[acct] = {"product_manager": opp.get("product_manager", ""), "solution_category": opp.get("solution_category", ""), "opportunity_name": opp.get("name", "")}
    
    # Format for frontend and apply status filter
    result = []
    stats = {"total": 0, "pending": 0, "overdue": 0, "paid": 0, "total_count": 0, "paid_count": 0, "overdue_count": 0, "pending_count": 0}
    
    for inv in invoices:
        payment_state = inv.get("payment_state", "not_paid")
        due_date = inv.get("due_date", "")
        amount = inv.get("amount_total") or 0
        
        # Determine status
        if payment_state == "paid":
            computed_status = "paid"
        elif due_date and due_date < today:
            computed_status = "overdue"
        else:
            computed_status = "pending"
        
        # Update stats
        stats["total"] += amount
        stats[computed_status] += amount
        stats[f"{computed_status}_count"] = stats.get(f"{computed_status}_count", 0) + 1
        stats["total_count"] = stats.get("total_count", 0) + 1
        
        # Compute aging days for overdue
        aging_days = 0
        if computed_status == "overdue" and due_date:
            try:
                from datetime import datetime as dt
                aging_days = (dt.now() - dt.strptime(str(due_date)[:10], "%Y-%m-%d")).days
            except: pass
        
        # Apply status filter
        if status and status != "all" and computed_status != status:
            continue
        
        # Enrich with linked opportunity data + SO margin
        acct_name = inv.get("account_name") or ""
        linked = acct_pm_map.get(acct_name, {})
        inv_so_num = inv.get("so_number") or inv.get("invoice_origin") or ""
        so_data = so_by_number.get(inv_so_num, {}) or so_by_customer.get(acct_name, {})
        # PM priority: SO line (most accurate) → opportunity (fallback)
        so_line_data = pm_by_so.get(inv_so_num, {}) or pm_by_so.get(so_data.get("so_number", ""), {})
        so_opp_data = so_opp_map.get(inv_so_num, {}) or so_opp_map.get(so_data.get("so_number", ""), {})
        best_pm = so_line_data.get("product_manager") or linked.get("product_manager", "")
        best_category = so_opp_data.get("solution_category") or so_line_data.get("product_category") or linked.get("solution_category", "")
        best_opp = so_opp_data.get("opportunity_name") or linked.get("opportunity_name", "")
        
        result.append({
            "id": inv.get("canonical_id") or str(inv.get("_id")),
            "invoice_number": inv.get("invoice_number"),
            "so_number": inv.get("so_number") or inv.get("invoice_origin") or so_data.get("so_number") or "",
            "account": acct_name or "Unknown",
            "account_id": inv.get("account_id"),
            "amount": amount,
            "amount_residual": inv.get("amount_residual", 0),
            "currency": inv.get("currency", "OMR"),
            "due_date": due_date,
            "invoice_date": inv.get("invoice_date"),
            "status": computed_status,
            "payment_state": payment_state,
            "salesperson": inv.get("invoice_user_id") or inv.get("salesperson_name") or so_data.get("salesperson") or "",
            "product_manager": best_pm,
            "solution_category": best_category,
            "opportunity_name": best_opp,
            "margin": so_data.get("margin", 0),
            "margin_percent": so_data.get("margin_percent", 0),
            "aging_days": aging_days,
            "source_system": inv.get("source_system", "odoo")
        })
    
    # Limit results
    result = result[:limit]
    
    # Compute aging breakdown and collection rate
    collection_rate = round(stats["paid"] / stats["total"] * 100, 1) if stats["total"] > 0 else 0
    aging_breakdown = {"0_30": 0, "30_60": 0, "60_90": 0, "90_plus": 0}
    for inv in result:
        if inv["status"] == "overdue":
            d = inv["aging_days"]
            if d <= 30: aging_breakdown["0_30"] += inv["amount"]
            elif d <= 60: aging_breakdown["30_60"] += inv["amount"]
            elif d <= 90: aging_breakdown["60_90"] += inv["amount"]
            else: aging_breakdown["90_plus"] += inv["amount"]
    
    logger.info(f"Receivables: returning {len(result)} invoices. Stats: {stats}")
    
    return {
        "invoices": serialize_doc(result),
        "stats": stats,
        "collection_rate": collection_rate,
        "aging_breakdown": aging_breakdown,
        "filters_applied": {
            "status": status,
            "account": account,
            "year": year,
            "quarter": quarter
        }
    }


@receivables_router.get("/stats")
async def get_receivables_stats(
    request: Request,
    current_user: dict = Depends(get_current_user),
    year: str = Query(None, description="Filter by year"),
    quarter: str = Query(None, description="Filter by quarter")
):
    """Get receivables statistics with optional date filters (RBAC enforced)"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "invoice")
    
    # Check if user has NO_ACCESS
    has_no_access = rbac_filter and "_id" in rbac_filter and rbac_filter.get("_id", {}).get("$eq") == "NO_ACCESS_USER_NOT_IN_RBAC"
    if has_no_access:
        return {
            "stats": {
                "total_invoiced": 0, "total_pending": 0, "total_overdue": 0, "total_paid": 0,
                "count_total": 0, "count_pending": 0, "count_overdue": 0, "count_paid": 0
            },
            "filter_options": {"accounts": [], "years": []}
        }
    
    # Build query with RBAC
    query = {"org_id": org_id}
    query.update(rbac_filter)
    
    # Fetch invoices with RBAC filter
    invoices = await canonical_db.invoices.find(query).to_list(1000)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Apply date filters
    if year or quarter:
        quarter_months = {
            "Q1": ["01", "02", "03"], 
            "Q2": ["04", "05", "06"], 
            "Q3": ["07", "08", "09"], 
            "Q4": ["10", "11", "12"]
        }
        filtered = []
        for inv in invoices:
            inv_date = inv.get("invoice_date")
            if not inv_date:
                continue
            
            if year and not str(inv_date).startswith(str(year)):
                continue
            
            if quarter:
                months = quarter_months.get(quarter, [])
                inv_month = str(inv_date)[5:7] if len(str(inv_date)) >= 7 else ""
                if inv_month not in months:
                    continue
            
            filtered.append(inv)
        invoices = filtered
    
    # Calculate stats
    stats = {
        "total_invoiced": 0,
        "total_pending": 0,
        "total_overdue": 0,
        "total_paid": 0,
        "count_total": 0,
        "count_pending": 0,
        "count_overdue": 0,
        "count_paid": 0
    }
    
    for inv in invoices:
        payment_state = inv.get("payment_state", "not_paid")
        due_date = inv.get("due_date", "")
        amount = inv.get("amount_total") or 0
        
        stats["total_invoiced"] += amount
        stats["count_total"] += 1
        
        if payment_state == "paid":
            stats["total_paid"] += amount
            stats["count_paid"] += 1
        elif due_date and due_date < today:
            stats["total_overdue"] += amount
            stats["count_overdue"] += 1
        else:
            stats["total_pending"] += amount
            stats["count_pending"] += 1
    
    # Get unique accounts for filter
    accounts = list(set(inv.get("account_name") for inv in invoices if inv.get("account_name")))
    
    return {
        "stats": stats,
        "filter_options": {
            "accounts": sorted(accounts),
            "years": sorted(list(set(
                y for inv in invoices 
                for f in ["invoice_date", "due_date"]
                for y in [str(inv.get(f, ""))[:4]]
                if y.isdigit() and int(y) <= datetime.now().year
            )), reverse=True)
        }
    }


@receivables_router.get("/by-salesperson")
async def get_receivables_by_salesperson(
    request: Request,
    current_user: dict = Depends(get_current_user),
    year: str = Query(None, description="Filter by year"),
    quarter: str = Query(None, description="Filter by quarter")
):
    """Get invoice analytics per sales person - won value, billed, pending, overdue (RBAC enforced)"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter
    rbac_filter = await get_rbac_filter(request, current_user, "invoice")
    
    # Check if user has NO_ACCESS
    has_no_access = rbac_filter and "_id" in rbac_filter and rbac_filter.get("_id", {}).get("$eq") == "NO_ACCESS_USER_NOT_IN_RBAC"
    if has_no_access:
        return {"salesperson_stats": []}
    
    # Build query with RBAC
    query = {"org_id": org_id}
    query.update(rbac_filter)
    
    opp_query = {"org_id": org_id}
    opp_query.update(rbac_filter)
    
    # Fetch invoices with RBAC filter
    invoices = await canonical_db.invoices.find(query).to_list(5000)
    
    # Fetch opportunities with RBAC filter
    opportunities = await canonical_db.opportunities.find(opp_query).to_list(10000)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Apply date filters
    quarter_months = {
        "Q1": ["01", "02", "03"], 
        "Q2": ["04", "05", "06"], 
        "Q3": ["07", "08", "09"], 
        "Q4": ["10", "11", "12"]
    }
    
    if year or quarter:
        filtered_invoices = []
        for inv in invoices:
            inv_date = inv.get("invoice_date")
            if not inv_date:
                continue
            if year and not str(inv_date).startswith(str(year)):
                continue
            if quarter:
                months = quarter_months.get(quarter, [])
                inv_month = str(inv_date)[5:7] if len(str(inv_date)) >= 7 else ""
                if inv_month not in months:
                    continue
            filtered_invoices.append(inv)
        invoices = filtered_invoices
    
    # Filter Won opportunities by won_at date
    won_opps = []
    for opp in opportunities:
        if (opp.get("stage") or "").lower() != "won":
            continue
        
        won_date = opp.get("won_at") or opp.get("date_closed") or opp.get("create_date")
        if not won_date:
            won_opps.append(opp)
            continue
        
        won_date_str = str(won_date)
        if year and not won_date_str.startswith(str(year)):
            continue
        if quarter:
            months = quarter_months.get(quarter, [])
            won_month = won_date_str[5:7] if len(won_date_str) >= 7 else ""
            if won_month not in months:
                continue
        won_opps.append(opp)
    
    # Build invoice map by account to link with salesperson
    # Invoice typically has account_id/account_name, opportunity has owner_name
    # We need to link invoice -> account -> opportunities -> salesperson
    
    # First, build salesperson Won values
    salesperson_won = {}
    for opp in won_opps:
        sp = opp.get("owner_name")
        if not sp:
            continue
        if sp not in salesperson_won:
            salesperson_won[sp] = {"won_value": 0, "won_count": 0, "accounts": set()}
        salesperson_won[sp]["won_value"] += opp.get("sale_value", 0) or 0
        salesperson_won[sp]["won_count"] += 1
        if opp.get("account_name"):
            salesperson_won[sp]["accounts"].add(opp.get("account_name"))
    
    # Build account -> salesperson map from Won opportunities
    account_to_sp = {}
    for opp in won_opps:
        acc = opp.get("account_name")
        sp = opp.get("owner_name")
        if acc and sp:
            # Use the most recent salesperson for this account
            account_to_sp[acc] = sp
    
    # Calculate invoice stats per salesperson
    salesperson_invoices = {}
    for inv in invoices:
        acc = inv.get("account_name")
        sp = account_to_sp.get(acc)
        if not sp:
            sp = "Unassigned"
        
        if sp not in salesperson_invoices:
            salesperson_invoices[sp] = {
                "billed": 0, "paid": 0, "pending": 0, "overdue": 0,
                "count_billed": 0, "count_paid": 0, "count_pending": 0, "count_overdue": 0
            }
        
        amount = inv.get("amount_total", 0) or 0
        payment_state = inv.get("payment_state", "not_paid")
        due_date = inv.get("due_date", "")
        
        salesperson_invoices[sp]["billed"] += amount
        salesperson_invoices[sp]["count_billed"] += 1
        
        if payment_state == "paid":
            salesperson_invoices[sp]["paid"] += amount
            salesperson_invoices[sp]["count_paid"] += 1
        elif due_date and due_date < today:
            salesperson_invoices[sp]["overdue"] += amount
            salesperson_invoices[sp]["count_overdue"] += 1
        else:
            salesperson_invoices[sp]["pending"] += amount
            salesperson_invoices[sp]["count_pending"] += 1
    
    # Combine results
    result = []
    all_salespeople = set(salesperson_won.keys()) | set(salesperson_invoices.keys())
    
    for sp in all_salespeople:
        won_data = salesperson_won.get(sp, {"won_value": 0, "won_count": 0})
        inv_data = salesperson_invoices.get(sp, {"billed": 0, "paid": 0, "pending": 0, "overdue": 0})
        
        result.append({
            "salesperson": sp,
            "won_value": won_data.get("won_value", 0),
            "won_count": won_data.get("won_count", 0),
            "billed": inv_data.get("billed", 0),
            "collected": inv_data.get("paid", 0),
            "pending": inv_data.get("pending", 0),
            "overdue": inv_data.get("overdue", 0),
            "count_invoices": inv_data.get("count_billed", 0)
        })
    
    # Sort by won_value descending
    result.sort(key=lambda x: x["won_value"], reverse=True)
    
    return {
        "data": result,
        "filters": {"year": year, "quarter": quarter}
    }



@receivables_router.post("/export-excel")
async def export_invoices_excel(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Export filtered invoices to Excel"""
    import io
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    invoices = data.get("invoices", [])
    if not invoices:
        raise HTTPException(status_code=400, detail="No invoices to export")
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Invoices"
    
    # Headers
    headers = ["Invoice #", "SO #", "Account", "Amount", "Salesperson", "Product Manager", "Solution Category", "Invoice Date", "Due Date", "Status", "Aging Days"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = openpyxl.styles.Font(bold=True)
    
    # Data rows
    for row, inv in enumerate(invoices, 2):
        ws.cell(row=row, column=1, value=inv.get("invoice_number", ""))
        ws.cell(row=row, column=2, value=inv.get("so_number", ""))
        ws.cell(row=row, column=3, value=inv.get("account", ""))
        ws.cell(row=row, column=4, value=inv.get("amount", 0))
        ws.cell(row=row, column=5, value=inv.get("salesperson", ""))
        ws.cell(row=row, column=6, value=inv.get("product_manager", ""))
        ws.cell(row=row, column=7, value=inv.get("solution_category", ""))
        ws.cell(row=row, column=8, value=inv.get("invoice_date", ""))
        ws.cell(row=row, column=9, value=inv.get("due_date", ""))
        ws.cell(row=row, column=10, value=inv.get("status", ""))
        ws.cell(row=row, column=11, value=inv.get("aging_days", 0))
    
    # Auto-width
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)
    
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=invoices_export.xlsx"}
    )
