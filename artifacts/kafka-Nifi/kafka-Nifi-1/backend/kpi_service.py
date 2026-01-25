"""KPI Service - Simulates Cube semantic layer for metrics computation"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import random

class KPIService:
    """Computes sales KPIs from MongoDB data (dev-mode Cube substitute)"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_pipeline_amount(self, tenant_id: str, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Get total pipeline amount (sum of all open deals)"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id, "is_closed": False}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]
        result = await self.db.opportunities.aggregate(pipeline).to_list(1)
        if result:
            return {"value": result[0]["total"], "count": result[0]["count"]}
        return {"value": 0, "count": 0}
    
    async def get_win_rate(self, tenant_id: str, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Calculate win rate (closed won / total closed)"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id, "is_closed": True}},
            {"$group": {
                "_id": None,
                "total_closed": {"$sum": 1},
                "total_won": {"$sum": {"$cond": ["$is_won", 1, 0]}}
            }}
        ]
        result = await self.db.opportunities.aggregate(pipeline).to_list(1)
        if result and result[0]["total_closed"] > 0:
            rate = (result[0]["total_won"] / result[0]["total_closed"]) * 100
            return {"value": round(rate, 2), "won": result[0]["total_won"], "total": result[0]["total_closed"]}
        return {"value": 0, "won": 0, "total": 0}
    
    async def get_avg_deal_size(self, tenant_id: str, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Calculate average deal size"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id, "is_won": True}},
            {"$group": {"_id": None, "avg": {"$avg": "$amount"}, "count": {"$sum": 1}}}
        ]
        result = await self.db.opportunities.aggregate(pipeline).to_list(1)
        if result:
            return {"value": round(result[0]["avg"], 2), "count": result[0]["count"]}
        return {"value": 0, "count": 0}
    
    async def get_revenue_by_month(self, tenant_id: str, months: int = 12) -> List[Dict[str, Any]]:
        """Get monthly revenue from closed won deals"""
        start_date = datetime.now(timezone.utc) - timedelta(days=months * 30)
        pipeline = [
            {"$match": {"tenant_id": tenant_id, "is_won": True, "closed_at": {"$gte": start_date}}},
            {"$group": {
                "_id": {"year": {"$year": "$closed_at"}, "month": {"$month": "$closed_at"}},
                "revenue": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1}}
        ]
        results = await self.db.opportunities.aggregate(pipeline).to_list(months)
        return [{"month": f"{r['_id']['year']}-{r['_id']['month']:02d}", "revenue": r["revenue"], "deals": r["count"]} for r in results]
    
    async def get_pipeline_by_stage(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Get pipeline breakdown by stage"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id, "is_closed": False}},
            {"$group": {
                "_id": "$stage",
                "amount": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        results = await self.db.opportunities.aggregate(pipeline).to_list(20)
        return [{"stage": r["_id"], "amount": r["amount"], "count": r["count"]} for r in results]
    
    async def get_rep_performance(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Get sales rep performance metrics"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {
                "_id": "$owner_user_id",
                "pipeline_amount": {"$sum": {"$cond": [{"$eq": ["$is_closed", False]}, "$amount", 0]}},
                "won_amount": {"$sum": {"$cond": ["$is_won", "$amount", 0]}},
                "total_deals": {"$sum": 1},
                "won_deals": {"$sum": {"$cond": ["$is_won", 1, 0]}}
            }},
            {"$sort": {"won_amount": -1}}
        ]
        results = await self.db.opportunities.aggregate(pipeline).to_list(50)
        
        # Enrich with user names
        enriched = []
        for r in results:
            user = await self.db.sales_users.find_one({"id": r["_id"]})
            enriched.append({
                "user_id": r["_id"],
                "name": user["name"] if user else "Unknown",
                "pipeline_amount": r["pipeline_amount"],
                "won_amount": r["won_amount"],
                "total_deals": r["total_deals"],
                "won_deals": r["won_deals"],
                "win_rate": round((r["won_deals"] / r["total_deals"] * 100) if r["total_deals"] > 0 else 0, 2)
            })
        return enriched
    
    async def get_activity_insights(self, tenant_id: str, days: int = 30) -> Dict[str, Any]:
        """Get activity metrics"""
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        pipeline = [
            {"$match": {"tenant_id": tenant_id, "occurred_at": {"$gte": start_date}}},
            {"$group": {
                "_id": "$type",
                "count": {"$sum": 1}
            }}
        ]
        results = await self.db.activities.aggregate(pipeline).to_list(10)
        
        activity_counts = {"emails": 0, "calls": 0, "meetings": 0, "tasks": 0}
        for r in results:
            if r["_id"] in activity_counts:
                activity_counts[r["_id"]] = r["count"]
        
        # Get activity trend by day
        trend_pipeline = [
            {"$match": {"tenant_id": tenant_id, "occurred_at": {"$gte": start_date}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$occurred_at"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        trend = await self.db.activities.aggregate(trend_pipeline).to_list(days)
        
        return {
            "totals": activity_counts,
            "total": sum(activity_counts.values()),
            "trend": [{"date": t["_id"], "count": t["count"]} for t in trend]
        }
    
    async def get_stalled_deals(self, tenant_id: str, days_threshold: int = 14) -> List[Dict[str, Any]]:
        """Get deals that haven't been updated in X days"""
        threshold_date = datetime.now(timezone.utc) - timedelta(days=days_threshold)
        pipeline = [
            {"$match": {
                "tenant_id": tenant_id,
                "is_closed": False,
                "updated_at": {"$exists": True, "$lt": threshold_date}
            }},
            {"$sort": {"updated_at": 1}},
            {"$limit": 50}
        ]
        results = await self.db.opportunities.aggregate(pipeline).to_list(50)
        stalled = []
        for r in results:
            updated_at = r.get("updated_at", r.get("created_at"))
            if updated_at:
                # Ensure timezone-aware datetime
                if updated_at.tzinfo is None:
                    updated_at = updated_at.replace(tzinfo=timezone.utc)
                days_stalled = (datetime.now(timezone.utc) - updated_at).days
                stalled.append({
                    "id": str(r.get("_id", r.get("id"))),
                    "name": r["name"],
                    "stage": r["stage"],
                    "amount": r["amount"],
                    "days_stalled": days_stalled
                })
        return stalled
    
    async def get_velocity_metrics(self, tenant_id: str) -> Dict[str, Any]:
        """Calculate sales velocity metrics"""
        try:
            pipeline = [
                {"$match": {
                    "tenant_id": tenant_id, 
                    "is_won": True, 
                    "closed_at": {"$ne": None, "$exists": True},
                    "created_at": {"$ne": None, "$exists": True}
                }},
                {"$project": {
                    "cycle_days": {
                        "$divide": [
                            {"$subtract": ["$closed_at", "$created_at"]},
                            1000 * 60 * 60 * 24
                        ]
                    }
                }},
                {"$group": {
                    "_id": None,
                    "avg_cycle": {"$avg": "$cycle_days"},
                    "min_cycle": {"$min": "$cycle_days"},
                    "max_cycle": {"$max": "$cycle_days"}
                }}
            ]
            result = await self.db.opportunities.aggregate(pipeline).to_list(1)
            if result and result[0].get("avg_cycle") is not None:
                return {
                    "avg_cycle_days": round(result[0]["avg_cycle"], 1),
                    "min_cycle_days": round(result[0]["min_cycle"], 1),
                    "max_cycle_days": round(result[0]["max_cycle"], 1)
                }
        except Exception as e:
            print(f"Error calculating velocity metrics: {e}")
        return {"avg_cycle_days": 0, "min_cycle_days": 0, "max_cycle_days": 0}


async def seed_sample_data(db: AsyncIOMotorDatabase, tenant_id: str):
    """Seed sample data for a tenant"""
    # Check if data already exists
    existing = await db.opportunities.find_one({"tenant_id": tenant_id})
    if existing:
        return {"status": "exists", "message": "Data already seeded"}
    
    # Create sales users
    users = [
        {"id": f"user_{i}", "tenant_id": tenant_id, "name": name, "email": f"{name.lower().replace(' ', '.')}@company.com", "team": team, "role": "sales_rep"}
        for i, (name, team) in enumerate([
            ("Alice Johnson", "Enterprise"), ("Bob Smith", "SMB"), ("Carol White", "Enterprise"),
            ("David Brown", "Mid-Market"), ("Eva Martinez", "SMB"), ("Frank Wilson", "Enterprise"),
            ("Grace Lee", "Mid-Market"), ("Henry Taylor", "SMB"), ("Ivy Chen", "Enterprise"),
            ("Jack Davis", "Mid-Market")
        ])
    ]
    await db.sales_users.insert_many(users)
    
    # Create pipeline stages
    stages = [
        {"id": f"stage_{i}", "tenant_id": tenant_id, "name": name, "sequence": i, "probability": prob, "is_won": is_won, "is_closed": is_closed}
        for i, (name, prob, is_won, is_closed) in enumerate([
            ("Prospecting", 10, False, False), ("Qualification", 25, False, False),
            ("Proposal", 50, False, False), ("Negotiation", 75, False, False),
            ("Closed Won", 100, True, True), ("Closed Lost", 0, False, True)
        ])
    ]
    await db.pipeline_stages.insert_many(stages)
    
    # Create opportunities
    industries = ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail"]
    regions = ["North America", "Europe", "APAC", "LATAM"]
    opportunities = []
    activities = []
    
    for i in range(200):
        is_closed = random.random() < 0.4
        is_won = is_closed and random.random() < 0.6
        stage_idx = 4 if is_won else (5 if is_closed and not is_won else random.randint(0, 3))
        created_at = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 180))
        closed_at = created_at + timedelta(days=random.randint(14, 90)) if is_closed else None
        
        opp = {
            "id": f"opp_{i}",
            "tenant_id": tenant_id,
            "name": f"Deal {i+1} - {random.choice(['Enterprise License', 'Platform Expansion', 'New Implementation', 'Renewal', 'Upsell'])}",
            "amount": random.randint(5, 500) * 1000,
            "stage": stages[stage_idx]["name"],
            "probability": stages[stage_idx]["probability"],
            "owner_user_id": random.choice(users)["id"],
            "account_name": f"{random.choice(['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Cyberdyne', 'Oscorp', 'Weyland'])} {random.choice(['Inc', 'Corp', 'LLC', 'Ltd'])}",
            "industry": random.choice(industries),
            "region": random.choice(regions),
            "is_closed": is_closed,
            "is_won": is_won,
            "created_at": created_at,
            "updated_at": created_at + timedelta(days=random.randint(0, 30)),
            "closed_at": closed_at,
            "source_system": "odoo",
            "source_record_id": f"odoo_lead_{i}"
        }
        opportunities.append(opp)
        
        # Create activities for this opportunity
        for j in range(random.randint(2, 10)):
            activity = {
                "id": f"act_{i}_{j}",
                "tenant_id": tenant_id,
                "type": random.choice(["emails", "calls", "meetings", "tasks"]),
                "occurred_at": created_at + timedelta(days=random.randint(0, 30)),
                "owner_user_id": opp["owner_user_id"],
                "related_opportunity_id": opp["id"],
                "summary": f"Activity {j+1} for {opp['name']}"
            }
            activities.append(activity)
    
    await db.opportunities.insert_many(opportunities)
    await db.activities.insert_many(activities)
    
    # Create some DLQ items for testing
    dlq_items = [
        {
            "id": f"dlq_{i}",
            "tenant_id": tenant_id,
            "topic": "raw.odoo.opportunity",
            "key": f"opp_{i}",
            "payload": {"id": f"opp_{i}", "error_test": True},
            "error_message": random.choice(["Schema validation failed", "Connection timeout", "Invalid field type", "Missing required field"]),
            "retry_count": random.randint(1, 3),
            "status": "failed",
            "created_at": datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48))
        }
        for i in range(15)
    ]
    await db.dlq.insert_many(dlq_items)
    
    return {"status": "success", "opportunities": len(opportunities), "activities": len(activities), "users": len(users)}
