"""KPI Routes - Compute KPIs from silver data"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import os
from datetime import datetime, timezone, timedelta
import jwt

router = APIRouter(prefix="/api/kpi", tags=["kpi"])
security = HTTPBearer(auto_error=False)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'esip_db')]

JWT_SECRET = os.environ.get('JWT_SECRET', 'esip-pipeline-secret-key')

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return None  # KPIs are public for now

def serialize_doc(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if k == '_id':
                result['id'] = str(v)
            elif isinstance(v, datetime):
                result[k] = v.isoformat()
            elif isinstance(v, dict):
                result[k] = serialize_doc(v)
            elif isinstance(v, list):
                result[k] = serialize_doc(v)
            else:
                result[k] = v
        return result
    return doc

@router.get("/summary")
async def get_kpi_summary():
    """Get all KPIs in one call"""
    
    # Pipeline Amount (open deals)
    pipeline_result = await db.silver_opportunities.aggregate([
        {"$match": {"is_closed": {"$ne": True}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    pipeline = pipeline_result[0] if pipeline_result else {"total": 0, "count": 0}
    
    # Win Rate
    closed_result = await db.silver_opportunities.aggregate([
        {"$match": {"is_closed": True}},
        {"$group": {
            "_id": None,
            "total_closed": {"$sum": 1},
            "total_won": {"$sum": {"$cond": ["$is_won", 1, 0]}},
            "won_amount": {"$sum": {"$cond": ["$is_won", "$amount", 0]}}
        }}
    ]).to_list(1)
    closed = closed_result[0] if closed_result else {"total_closed": 0, "total_won": 0, "won_amount": 0}
    win_rate = (closed["total_won"] / closed["total_closed"] * 100) if closed["total_closed"] > 0 else 0
    
    # Average Deal Size
    avg_result = await db.silver_opportunities.aggregate([
        {"$match": {"is_won": True, "amount": {"$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    avg_deal = avg_result[0] if avg_result else {"avg": 0, "count": 0}
    
    # Total records
    total = await db.silver_opportunities.count_documents({})
    
    # By stage
    by_stage = await db.silver_opportunities.aggregate([
        {"$match": {"is_closed": {"$ne": True}}},
        {"$group": {"_id": "$stage", "count": {"$sum": 1}, "amount": {"$sum": "$amount"}}},
        {"$sort": {"amount": -1}}
    ]).to_list(20)
    
    # By owner
    by_owner = await db.silver_opportunities.aggregate([
        {"$group": {
            "_id": "$owner_name",
            "pipeline_amount": {"$sum": {"$cond": [{"$ne": ["$is_closed", True]}, "$amount", 0]}},
            "won_amount": {"$sum": {"$cond": ["$is_won", "$amount", 0]}},
            "total_deals": {"$sum": 1},
            "won_deals": {"$sum": {"$cond": ["$is_won", 1, 0]}}
        }},
        {"$sort": {"pipeline_amount": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    return {
        "kpis": {
            "pipeline_amount": {"value": pipeline.get("total", 0), "count": pipeline.get("count", 0)},
            "win_rate": {"value": round(win_rate, 2), "won": closed.get("total_won", 0), "total": closed.get("total_closed", 0)},
            "avg_deal_size": {"value": round(avg_deal.get("avg", 0), 2), "count": avg_deal.get("count", 0)},
            "won_revenue": {"value": closed.get("won_amount", 0)},
            "total_opportunities": {"value": total}
        },
        "by_stage": [{"stage": s["_id"] or "Unknown", "count": s["count"], "amount": s["amount"]} for s in by_stage],
        "by_owner": [{
            "name": o["_id"] or "Unassigned",
            "pipeline_amount": o["pipeline_amount"],
            "won_amount": o["won_amount"],
            "total_deals": o["total_deals"],
            "won_deals": o["won_deals"],
            "win_rate": round((o["won_deals"] / o["total_deals"] * 100) if o["total_deals"] > 0 else 0, 2)
        } for o in by_owner],
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

@router.get("/opportunities")
async def get_opportunities(stage: Optional[str] = None, owner: Optional[str] = None, limit: int = 50):
    """Get opportunities with filters"""
    query = {}
    if stage:
        query["stage"] = stage
    if owner:
        query["owner_name"] = owner
    
    opps = await db.silver_opportunities.find(query).sort("amount", -1).limit(limit).to_list(limit)
    return serialize_doc(opps)

@router.get("/health")
async def health():
    count = await db.silver_opportunities.count_documents({})
    return {
        "status": "healthy",
        "opportunities_count": count,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
