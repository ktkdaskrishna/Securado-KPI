"""AI CRM Assistant — RAG-powered chat over CRM data.

Uses emergentintegrations LLM to answer questions about:
- Dashboard KPIs, pipeline, win rate
- Opportunities, stages, owners
- Invoices, overdue, collections
- Activities, performance
- Targets and achievements
"""
import os
import logging
from fastapi import APIRouter, Depends
from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
ai_assistant_router = APIRouter(prefix="/ai-assistant", tags=["ai-assistant"])


async def gather_crm_context(user_email: str, question: str) -> str:
    """Gather relevant CRM data as context for the AI based on the question."""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    context_parts = []
    q = question.lower()
    
    # Always include high-level KPIs
    pipeline = [
        {"$match": {"active": True, "stage": {"$nin": ["Won", "Lost", "Hold"]}, "date_last_stage_update": {"$regex": "^2026"}}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$sale_value", 0]}}, "count": {"$sum": 1}}}
    ]
    result = await canonical_db.opportunities.aggregate(pipeline).to_list(1)
    if result:
        context_parts.append(f"Current Open Pipeline (2026): OMR {result[0]['total']:,.0f} ({result[0]['count']} opportunities)")
    
    won = await canonical_db.opportunities.aggregate([
        {"$match": {"active": True, "stage": "Won", "date_last_stage_update": {"$regex": "^2026"}}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$sale_value", 0]}}, "count": {"$sum": 1}}}
    ]).to_list(1)
    if won:
        context_parts.append(f"Won Deals (2026): OMR {won[0]['total']:,.0f} ({won[0]['count']} deals)")
    
    # Invoice data (always useful)
    if any(w in q for w in ['invoice', 'overdue', 'collection', 'payment', 'paid', 'pending', 'aging', 'receivable']):
        inv_stats = await canonical_db.invoices.aggregate([
            {"$match": {"state": "posted"}},
            {"$group": {
                "_id": "$payment_state",
                "total": {"$sum": {"$ifNull": ["$amount_total", 0]}},
                "count": {"$sum": 1}
            }}
        ]).to_list(10)
        for s in inv_stats:
            context_parts.append(f"Invoices ({s['_id']}): OMR {s['total']:,.0f} ({s['count']} invoices)")
        
        # Overdue invoices detail
        if any(w in q for w in ['overdue', 'aging', '60', '90', 'late']):
            from datetime import datetime
            overdue = await canonical_db.invoices.find(
                {"state": "posted", "payment_state": {"$in": ["not_paid", "partial"]}},
                {"_id": 0, "invoice_number": 1, "account_name": 1, "amount_total": 1, "due_date": 1, "invoice_user_id": 1}
            ).sort("due_date", 1).limit(20).to_list(20)
            
            overdue_list = []
            for inv in overdue:
                due = inv.get("due_date", "")
                if due:
                    try:
                        days = (datetime.now() - datetime.strptime(str(due)[:10], "%Y-%m-%d")).days
                        if days > 0:
                            overdue_list.append(f"  - {inv.get('invoice_number','?')}: {inv.get('account_name','?')} — OMR {inv.get('amount_total',0):,.0f} — {days} days overdue — Salesperson: {inv.get('invoice_user_id','?')}")
                    except: pass
            if overdue_list:
                context_parts.append("Overdue Invoices (sorted by oldest):\n" + "\n".join(overdue_list[:15]))
    
    # Opportunity details
    if any(w in q for w in ['opportunity', 'deal', 'pipeline', 'stage', 'won', 'lost', 'proposal', 'qualified']):
        stages = await canonical_db.opportunities.aggregate([
            {"$match": {"active": True, "date_last_stage_update": {"$regex": "^2026"}}},
            {"$group": {"_id": "$stage", "total": {"$sum": {"$ifNull": ["$sale_value", 0]}}, "count": {"$sum": 1}}},
            {"$sort": {"total": -1}}
        ]).to_list(10)
        stage_text = "\n".join([f"  - {s['_id']}: OMR {s['total']:,.0f} ({s['count']} deals)" for s in stages])
        context_parts.append(f"Pipeline by Stage (2026):\n{stage_text}")
    
    # Person-specific queries
    if any(w in q for w in ['vimod', 'shri', 'taj', 'nabi', 'team', 'performance', 'salesperson', 'who']):
        reps = await canonical_db.opportunities.aggregate([
            {"$match": {"active": True, "stage": "Won", "date_last_stage_update": {"$regex": "^2026"}}},
            {"$group": {"_id": "$owner_name", "total": {"$sum": {"$ifNull": ["$sale_value", 0]}}, "count": {"$sum": 1}}},
            {"$sort": {"total": -1}}, {"$limit": 10}
        ]).to_list(10)
        rep_text = "\n".join([f"  - {r['_id']}: OMR {r['total']:,.0f} ({r['count']} won)" for r in reps])
        context_parts.append(f"Top Won by Salesperson (2026):\n{rep_text}")
        
        pm_pipeline = await canonical_db.opportunities.aggregate([
            {"$match": {"active": True, "stage": {"$nin": ["Won","Lost","Hold"]}, "date_last_stage_update": {"$regex": "^2026"}}},
            {"$group": {"_id": "$product_manager", "total": {"$sum": {"$ifNull": ["$sale_value", 0]}}, "count": {"$sum": 1}}},
            {"$sort": {"total": -1}}
        ]).to_list(10)
        pm_text = "\n".join([f"  - {p['_id']}: OMR {p['total']:,.0f} ({p['count']} opps)" for p in pm_pipeline])
        context_parts.append(f"Pipeline by Product Director (2026):\n{pm_text}")
    
    # Activities
    if any(w in q for w in ['activity', 'demo', 'poc', 'visit', 'meeting', 'workshop']):
        acts = await canonical_db.activities.aggregate([
            {"$match": {"activity_type": {"$in": ["Demo", "Proof of concept", "Site Visit", "Work Shop", "Product Presentation", "Vendor Meeting", "POC"]}}},
            {"$group": {"_id": "$activity_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(10)
        act_text = "\n".join([f"  - {a['_id']}: {a['count']}" for a in acts])
        context_parts.append(f"Value-Selling Activities:\n{act_text}")
    
    # Targets
    if any(w in q for w in ['target', 'plan', 'achievement', 'booking', 'margin']):
        plans = await app_db.target_plans.find({}, {"_id": 0, "name": 1, "booking_target": 1, "invoiced_target": 1, "margin_target": 1}).to_list(20)
        if plans:
            plan_text = "\n".join([f"  - {p.get('name','?')}: Booking={p.get('booking_target',0):,.0f} Invoiced={p.get('invoiced_target',0):,.0f} Margin={p.get('margin_target',0):,.0f}" for p in plans])
            context_parts.append(f"Revenue Plans:\n{plan_text}")
    
    return "\n\n".join(context_parts)


@ai_assistant_router.post("/chat")
async def chat_with_assistant(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Chat with AI CRM Assistant — RAG over CRM data"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    question = data.get("question", "")
    session_id = data.get("session_id", f"crm-{current_user.get('email', 'anon')}")
    
    if not question:
        return {"answer": "Please ask a question about your CRM data."}
    
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return {"answer": "AI assistant not configured. Please set EMERGENT_LLM_KEY."}
    
    # Gather CRM context
    context = await gather_crm_context(current_user.get("email", ""), question)
    
    system_message = f"""You are the Securado CRM AI Assistant. You help users understand their sales data, pipeline, invoices, activities, and performance.

You have access to the following LIVE CRM data:

{context}

Rules:
- Answer based ONLY on the data provided above
- Use OMR (Omani Riyal) as currency
- Be concise and specific with numbers
- If data is not available, say so
- Format numbers with commas
- Use bullet points for lists
- Be professional but friendly"""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_message
        ).with_model("openai", "gpt-4.1-mini")
        
        user_msg = UserMessage(text=question)
        response = await chat.send_message(user_msg)
        
        # Save chat history
        app_db = get_app_db()
        await app_db.ai_chat_history.insert_one({
            "id": generate_id(),
            "session_id": session_id,
            "user_email": current_user.get("email"),
            "question": question,
            "answer": response,
            "context_length": len(context),
            "created_at": now_utc(),
        })
        
        return {"answer": response, "session_id": session_id}
    except Exception as e:
        logger.error(f"AI Assistant error: {e}")
        return {"answer": f"Sorry, I encountered an error: {str(e)[:100]}. Please try again."}


@ai_assistant_router.get("/history")
async def get_chat_history(
    session_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get chat history for current user"""
    app_db = get_app_db()
    query = {"user_email": current_user.get("email")}
    if session_id:
        query["session_id"] = session_id
    history = await app_db.ai_chat_history.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return serialize_doc(history)
