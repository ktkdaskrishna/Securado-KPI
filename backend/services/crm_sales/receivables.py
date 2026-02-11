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
from services.crm_sales.helpers import STAGE_ALIASES, apply_date_filters

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
    
    # Build query with RBAC
    query = {"org_id": org_id}
    query.update(rbac_filter)
    
    # Filter by account if provided
    if account:
        query["account_name"] = account
    
    # Fetch all invoices first (we'll filter by status and date in Python for more flexibility)
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
    
    # Format for frontend and apply status filter
    result = []
    stats = {"total": 0, "pending": 0, "overdue": 0, "paid": 0}
    
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
        
        # Apply status filter
        if status and status != "all" and computed_status != status:
            continue
        
        result.append({
            "id": inv.get("canonical_id") or str(inv.get("_id")),
            "invoice_number": inv.get("invoice_number"),
            "account": inv.get("account_name") or "Unknown",
            "account_id": inv.get("account_id"),
            "amount": amount,
            "currency": inv.get("currency", "OMR"),
            "due_date": due_date,
            "invoice_date": inv.get("invoice_date"),
            "status": computed_status,
            "payment_state": payment_state,
            "source_system": inv.get("source_system", "odoo")
        })
    
    # Limit results
    result = result[:limit]
    
    logger.info(f"Receivables: returning {len(result)} invoices. Stats: {stats}")
    
    return {
        "invoices": serialize_doc(result),
        "stats": stats,
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
            "years": sorted(list(set(str(inv.get("invoice_date", ""))[:4] for inv in invoices if inv.get("invoice_date"))), reverse=True)
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
