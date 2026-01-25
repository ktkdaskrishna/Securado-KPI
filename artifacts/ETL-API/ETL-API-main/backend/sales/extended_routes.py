from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from sales.extended_models import AccountCreate, KPICreate
from core.canonical_adapter import CanonicalAdapter
from core.database import get_app_db
from core.utils import serialize_doc
from auth.routes import get_current_user
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

# Accounts router
accounts_router = APIRouter(prefix="/accounts", tags=["accounts"])

@accounts_router.get("")
async def list_accounts(
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List accounts from canonical data"""
    try:
        canonical_records = await CanonicalAdapter.get_canonical_records(
            entity_type="accounts",
            org_id=current_user.get("org_id"),
            limit=limit,
            skip=skip
        )
        
        accounts = []
        for record in canonical_records:
            accounts.append({
                "canonical_id": record.canonical_id,
                "data": record.data,
                "updated_at": record.updated_at
            })
        
        return accounts
    except Exception as e:
        logger.error(f"Error listing accounts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@accounts_router.get("/{account_id}/360")
async def get_account_360_view(
    account_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get 360-degree view of account"""
    try:
        app_db = get_app_db()
        
        # Get account from canonical
        account = await CanonicalAdapter.get_canonical_by_id(
            canonical_id=account_id,
            entity_type="accounts",
            org_id=current_user.get("org_id")
        )
        
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Get related opportunities
        opportunities = await CanonicalAdapter.get_canonical_records(
            entity_type="opportunities",
            org_id=current_user.get("org_id"),
            filters={"data.account_id": account_id},
            limit=100
        )
        
        # Get related activities
        activities = await app_db.activities.find({
            "account_id": account_id,
            "org_id": current_user.get("org_id")
        }).to_list(100)
        
        return {
            "account": {
                "canonical_id": account.canonical_id,
                "data": account.data,
                "updated_at": account.updated_at
            },
            "opportunities": [{
                "canonical_id": opp.canonical_id,
                "data": opp.data
            } for opp in opportunities],
            "activities": [serialize_doc(a) for a in activities],
            "summary": {
                "total_opportunities": len(opportunities),
                "total_activities": len(activities)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting account 360 view: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@accounts_router.post("")
async def create_account(
    account_data: AccountCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create local account (not in canonical)"""
    try:
        app_db = get_app_db()
        
        account_doc = {
            "id": str(uuid.uuid4()),
            "org_id": current_user.get("org_id"),
            "created_by": current_user.get("id"),
            "created_at": datetime.utcnow(),
            "type": "local",
            **account_data.model_dump()
        }
        
        await app_db.accounts_local.insert_one(account_doc)
        
        return serialize_doc(account_doc)
    except Exception as e:
        logger.error(f"Error creating account: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# KPIs router
kpis_router = APIRouter(prefix="/kpis", tags=["kpis"])

@kpis_router.get("")
async def list_kpis(current_user: dict = Depends(get_current_user)):
    """List KPIs"""
    try:
        app_db = get_app_db()
        kpis = await app_db.kpis.find({"org_id": current_user.get("org_id")}).to_list(1000)
        return [serialize_doc(kpi) for kpi in kpis]
    except Exception as e:
        logger.error(f"Error listing KPIs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@kpis_router.post("")
async def create_kpi(
    kpi_data: KPICreate,
    current_user: dict = Depends(get_current_user)
):
    """Create KPI"""
    try:
        app_db = get_app_db()
        
        kpi_doc = {
            "id": str(uuid.uuid4()),
            "org_id": current_user.get("org_id"),
            "created_by": current_user.get("id"),
            "created_at": datetime.utcnow(),
            **kpi_data.model_dump()
        }
        
        await app_db.kpis.insert_one(kpi_doc)
        
        return serialize_doc(kpi_doc)
    except Exception as e:
        logger.error(f"Error creating KPI: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@kpis_router.put("/{kpi_id}")
async def update_kpi(
    kpi_id: str,
    kpi_data: KPICreate,
    current_user: dict = Depends(get_current_user)
):
    """Update KPI"""
    try:
        app_db = get_app_db()
        
        result = await app_db.kpis.update_one(
            {"id": kpi_id, "org_id": current_user.get("org_id")},
            {"$set": {**kpi_data.model_dump(), "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="KPI not found")
        
        return {"success": True, "message": "KPI updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating KPI: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@kpis_router.delete("/{kpi_id}")
async def delete_kpi(
    kpi_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete KPI"""
    try:
        app_db = get_app_db()
        
        result = await app_db.kpis.delete_one({
            "id": kpi_id,
            "org_id": current_user.get("org_id")
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="KPI not found")
        
        return {"success": True, "message": "KPI deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting KPI: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Receivables & Invoices (stubs)
receivables_router = APIRouter(prefix="/receivables", tags=["receivables"])

@receivables_router.get("")
async def list_receivables(current_user: dict = Depends(get_current_user)):
    """List receivables (stub - derive from canonical if available)"""
    return {
        "message": "Receivables endpoint (stub). Implement based on canonical financial data.",
        "receivables": []
    }

invoices_router = APIRouter(prefix="/invoices", tags=["invoices"])

@invoices_router.get("")
async def list_invoices(current_user: dict = Depends(get_current_user)):
    """List invoices (stub)"""
    return {
        "message": "Invoices endpoint (stub). Implement based on canonical financial data.",
        "invoices": []
    }

# Dashboard extension
sales_metrics_router = APIRouter(prefix="/sales-metrics", tags=["sales-metrics"])

@sales_metrics_router.get("/{user_id}")
async def get_user_sales_metrics(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get sales metrics for specific user"""
    try:
        # Get opportunities owned by user
        opportunities = await CanonicalAdapter.get_canonical_records(
            entity_type="opportunities",
            org_id=current_user.get("org_id"),
            filters={"data.owner": user_id},
            limit=1000
        )
        
        total_value = sum(
            opp.data.get("value", 0) or opp.data.get("amount", 0) or 0
            for opp in opportunities
        )
        
        return {
            "user_id": user_id,
            "total_opportunities": len(opportunities),
            "total_pipeline_value": total_value,
            "metrics": {
                "open_opps": len([o for o in opportunities if o.data.get("stage") not in ["Closed Won", "Closed Lost"]]),
                "won_opps": len([o for o in opportunities if o.data.get("stage") == "Closed Won"]),
                "lost_opps": len([o for o in opportunities if o.data.get("stage") == "Closed Lost"])
            }
        }
    except Exception as e:
        logger.error(f"Error getting user sales metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Search endpoint
search_router = APIRouter(prefix="/search", tags=["search"])

@search_router.get("")
async def search(
    q: str = Query(..., description="Search query"),
    current_user: dict = Depends(get_current_user)
):
    """Search across all entities"""
    try:
        results = {
            "opportunities": [],
            "accounts": [],
            "activities": []
        }
        
        # Search opportunities
        opps = await CanonicalAdapter.get_canonical_records(
            entity_type="opportunities",
            org_id=current_user.get("org_id"),
            search=q,
            limit=50
        )
        results["opportunities"] = [{"canonical_id": o.canonical_id, "data": o.data} for o in opps]
        
        # Search accounts
        accounts = await CanonicalAdapter.get_canonical_records(
            entity_type="accounts",
            org_id=current_user.get("org_id"),
            search=q,
            limit=50
        )
        results["accounts"] = [{"canonical_id": a.canonical_id, "data": a.data} for a in accounts]
        
        # Search activities (local)
        app_db = get_app_db()
        activities = await app_db.activities.find({
            "org_id": current_user.get("org_id"),
            "$text": {"$search": q}
        }).limit(50).to_list(50)
        results["activities"] = [serialize_doc(a) for a in activities]
        
        return results
    except Exception as e:
        logger.error(f"Search error: {e}")
        return {
            "opportunities": [],
            "accounts": [],
            "activities": []
        }
