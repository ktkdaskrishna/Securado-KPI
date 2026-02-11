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

accounts_router = APIRouter(prefix="/accounts", tags=["accounts"])


# ==================== ACCOUNTS ====================

@accounts_router.get("")
async def list_accounts(
    request: Request,
    entity_type: Optional[str] = Query(None, description="Filter by entity type: company, contact, or all"),
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """List accounts (companies) and contacts with optional filters and RBAC"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Accounts list request - entity_type: {entity_type}, year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Get RBAC filter for accounts
    rbac_filter = await get_rbac_filter(request, current_user, "account")
    
    # Get accounts (companies)
    accounts_query = {"org_id": org_id}
    accounts_query.update(rbac_filter)
    accounts = await canonical_db.accounts.find(accounts_query).to_list(2000)
    
    # Get contacts with RBAC
    contacts_query = {"org_id": org_id}
    contacts_query.update(rbac_filter)
    contacts = await canonical_db.contacts.find(contacts_query).to_list(5000)
    
    # Get all invoices to check for overdue
    invoices = await canonical_db.invoices.find({"org_id": org_id}).to_list(5000)
    
    # Build overdue map by account_id and account_name
    overdue_by_account_id = {}
    overdue_by_account_name = {}
    from datetime import datetime
    today = datetime.now(timezone.utc).date()
    
    for inv in invoices:
        if inv.get("payment_state") not in ["paid", "reversed"]:
            due_date = inv.get("due_date")
            if due_date:
                if isinstance(due_date, str):
                    try:
                        due_date = datetime.strptime(due_date[:10], "%Y-%m-%d").date()
                    except:
                        continue
                elif hasattr(due_date, 'date'):
                    due_date = due_date.date()
                
                if due_date < today:
                    acc_id = str(inv.get("account_id", ""))
                    acc_name = inv.get("account_name", "")
                    overdue_amount = inv.get("amount_total", 0) or 0
                    
                    if acc_id:
                        overdue_by_account_id[acc_id] = overdue_by_account_id.get(acc_id, 0) + overdue_amount
                    if acc_name:
                        overdue_by_account_name[acc_name] = overdue_by_account_name.get(acc_name, 0) + overdue_amount
    
    # Mark accounts with overdue invoices
    # NOTE: Use account_id as primary lookup, fall back to account_name only if no ID match
    for account in accounts:
        account["is_company"] = True
        acc_id = str(account.get("source_record_id", ""))
        acc_name = account.get("name", "")
        # Prefer account_id lookup, fall back to account_name
        overdue = overdue_by_account_id.get(acc_id, 0)
        if overdue == 0 and acc_name:
            overdue = overdue_by_account_name.get(acc_name, 0)
        account["has_overdue"] = overdue > 0
        account["overdue_amount"] = overdue
    
    # Mark contacts
    for contact in contacts:
        contact["is_company"] = False
        acc_id = str(contact.get("account_id", ""))
        acc_name = contact.get("account_name", "")
        # Prefer account_id lookup, fall back to account_name
        overdue = overdue_by_account_id.get(acc_id, 0)
        if overdue == 0 and acc_name:
            overdue = overdue_by_account_name.get(acc_name, 0)
        contact["has_overdue"] = overdue > 0
        contact["overdue_amount"] = overdue
    
    # If we need to filter by sales_rep or year, we need to check related opportunities
    if sales_rep or year or quarter:
        opp_query = {"org_id": org_id}
        if sales_rep:
            opp_query["owner_name"] = sales_rep
        
        opps = await canonical_db.opportunities.find(opp_query).to_list(10000)
        opps = apply_date_filters(opps, year=year, quarter=quarter, date_field=date_field or 'create_date')
        
        valid_accounts = set(o.get("account_name") for o in opps if o.get("account_name"))
        accounts = [a for a in accounts if a.get("name") in valid_accounts]
        contacts = [c for c in contacts if c.get("account_name") in valid_accounts]
    
    # Filter by entity type
    if entity_type == "company":
        result = accounts
    elif entity_type == "contact":
        result = contacts
    else:
        result = accounts + contacts
    
    # Sort: overdue accounts first, then by name
    result.sort(key=lambda x: (not x.get("has_overdue", False), x.get("name", "").lower()))
    
    logger.info(f"Accounts/Contacts after filtering: {len(result)} (companies: {len(accounts)}, contacts: {len(contacts)})")
    
    return {
        "data": serialize_doc(result),
        "summary": {
            "total": len(result),
            "companies": len(accounts),
            "contacts": len(contacts),
            "with_overdue": len([r for r in result if r.get("has_overdue")])
        }
    }


@accounts_router.post("")
async def create_account(
    account_data: AccountCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create account (stored in app DB, not canonical)"""
    app_db = get_app_db()
    
    account_doc = {
        "id": generate_id(),
        "canonical_id": f"local_account_{generate_id()[:8]}",
        "org_id": current_user.get("org_id", "default"),
        "source_system": "local",
        "created_by": current_user["id"],
        "created_at": now_utc(),
        **account_data.model_dump()
    }
    
    await app_db.local_accounts.insert_one(account_doc)
    return serialize_doc(account_doc)


@accounts_router.get("/{account_id}/360")
async def get_account_360(
    account_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get 360 view of account"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Try canonical first
    account = await canonical_db.accounts.find_one({
        "canonical_id": account_id,
        "org_id": org_id
    })
    
    # Try local accounts
    if not account:
        account = await app_db.local_accounts.find_one({
            "id": account_id,
            "org_id": org_id
        })
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Get related opportunities by account_id or account_name
    account_name = account.get("name")
    source_record_id = account.get("source_record_id")
    
    opp_query = {"org_id": org_id, "$or": [{"account_name": account_name}]}
    if source_record_id:
        opp_query["$or"].append({"account_id": str(source_record_id)})
    
    opps = await canonical_db.opportunities.find(opp_query).to_list(100)
    
    # Get related contacts by account_id
    contact_query = {"org_id": org_id}
    if source_record_id:
        contact_query["$or"] = [
            {"account_id": str(source_record_id)},
            {"account_name": account_name}
        ]
    else:
        contact_query["account_name"] = account_name
    
    contacts = await canonical_db.contacts.find(contact_query).to_list(50)
    
    # Get related invoices by account_id or account_name
    invoice_query = {"org_id": org_id}
    if source_record_id:
        invoice_query["$or"] = [
            {"account_id": str(source_record_id)},
            {"account_name": account_name}
        ]
    else:
        invoice_query["account_name"] = account_name
    
    invoices = await canonical_db.invoices.find(invoice_query).sort("invoice_date", -1).to_list(20)
    
    # Get related activities
    activities = await app_db.activities.find({
        "account_id": account_id,
        "org_id": org_id
    }).to_list(100)
    
    result = serialize_doc(account)
    result["opportunities"] = serialize_doc(opps)
    # Use sale_value (custom field) if available, otherwise fall back to amount
    result["total_value"] = sum(
        float(o.get("sale_value", 0) or 0) or float(o.get("amount", 0) or 0) 
        for o in opps
    )
    result["opportunities_count"] = len(opps)
    
    # Calculate Won Deals for this account
    won_opps = [o for o in opps if (o.get("stage") or "").lower() == "won"]
    result["won_count"] = len(won_opps)
    result["won_value"] = sum(
        float(o.get("sale_value", 0) or 0) or float(o.get("amount", 0) or 0) 
        for o in won_opps
    )
    
    # Format contacts for display (sanitize Odoo relational fields)
    result["contacts"] = []
    for contact in contacts:
        # Extract string value from Odoo relational fields like [id, "name"]
        title = contact.get("title") or contact.get("function") or ""
        if isinstance(title, (list, tuple)) and len(title) >= 2:
            title = str(title[1]) if title[1] else ""
        elif isinstance(title, dict):
            title = title.get("name", "")
        
        result["contacts"].append({
            "id": contact.get("canonical_id") or str(contact.get("_id")),
            "name": contact.get("name", "Unknown"),
            "title": str(title) if title else "",
            "email": contact.get("email") or "",
            "phone": contact.get("phone") or ""
        })
    
    # Format invoices for display
    result["invoices"] = []
    total_invoiced = 0
    total_outstanding = 0
    for inv in invoices:
        amount = inv.get("amount_total", 0) or 0
        result["invoices"].append({
            "id": inv.get("canonical_id") or str(inv.get("_id")),
            "invoice_number": inv.get("invoice_number"),
            "amount": amount,
            "currency": inv.get("currency", "OMR"),
            "invoice_date": inv.get("invoice_date"),
            "due_date": inv.get("due_date"),
            "status": inv.get("payment_state", "pending")
        })
        total_invoiced += amount
        if inv.get("payment_state") != "paid":
            total_outstanding += amount
    
    result["total_invoiced"] = total_invoiced
    result["total_outstanding"] = total_outstanding
    result["invoices_count"] = len(invoices)
    
    # Calculate overdue invoices
    today = datetime.now(timezone.utc).date()
    total_overdue = 0
    for inv in invoices:
        if inv.get("payment_state") not in ["paid", "reversed"]:
            due_date = inv.get("due_date")
            if due_date:
                if isinstance(due_date, str):
                    try:
                        due_date = datetime.strptime(due_date[:10], "%Y-%m-%d").date()
                    except:
                        continue
                elif hasattr(due_date, 'date'):
                    due_date = due_date.date()
                if due_date < today:
                    total_overdue += inv.get("amount_total", 0) or 0
    
    result["total_overdue"] = total_overdue
    result["has_overdue"] = total_overdue > 0
    
    # Group opportunities by year (using won_at for Won, create_date for others)
    opps_by_year = {}
    for opp in opps:
        # Get year from appropriate date field
        date_str = None
        if (opp.get("stage") or "").lower() == "won":
            date_str = opp.get("won_at") or opp.get("create_date")
        else:
            date_str = opp.get("create_date")
        
        year_key = "Unknown"
        if date_str:
            if isinstance(date_str, str) and len(date_str) >= 4:
                year_key = date_str[:4]
            elif hasattr(date_str, 'year'):
                year_key = str(date_str.year)
        
        if year_key not in opps_by_year:
            opps_by_year[year_key] = []
        opps_by_year[year_key].append(serialize_doc(opp))
    
    result["opportunities_by_year"] = opps_by_year
    
    # Group invoices by year
    invoices_by_year = {}
    for inv in invoices:
        inv_date = inv.get("invoice_date")
        year_key = "Unknown"
        if inv_date:
            if isinstance(inv_date, str) and len(inv_date) >= 4:
                year_key = inv_date[:4]
            elif hasattr(inv_date, 'year'):
                year_key = str(inv_date.year)
        
        if year_key not in invoices_by_year:
            invoices_by_year[year_key] = []
        
        amount = inv.get("amount_total", 0) or 0
        invoices_by_year[year_key].append({
            "id": inv.get("canonical_id") or str(inv.get("_id")),
            "invoice_number": inv.get("invoice_number"),
            "amount": amount,
            "currency": inv.get("currency", "OMR"),
            "invoice_date": inv.get("invoice_date"),
            "due_date": inv.get("due_date"),
            "status": inv.get("payment_state", "pending")
        })
    
    result["invoices_by_year"] = invoices_by_year
    
    result["activities"] = serialize_doc(activities)
    result["activities_count"] = len(activities)
    
    return result


