"""AI CRM Assistant — RAG-powered chat over CRM data + Feedback collection.

Uses emergentintegrations LLM to answer questions about:
- Dashboard KPIs, pipeline, win rate
- Opportunities, stages, owners
- Invoices, overdue, collections
- Activities, performance
- Targets and achievements

Also handles conversational feedback submission:
- Detects feedback intent from user messages
- Extracts structured feedback (title, description, module, priority)
- Saves via the feedback system
"""
import os
import re
import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form
from typing import List
from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
ai_assistant_router = APIRouter(prefix="/ai-assistant", tags=["ai-assistant"])

# Feedback intent detection keywords
FEEDBACK_KEYWORDS = [
    "feedback", "bug", "issue", "report", "suggestion", "feature request",
    "problem", "broken", "not working", "wrong", "error", "improve",
    "wish", "would be nice", "could you add", "please fix", "complain",
    "missing", "incorrect", "submit feedback", "give feedback", "send feedback",
]

MODULES = ["dashboard", "opportunities", "invoices", "activities", "performance",
           "accounts", "analytics", "settings", "general", "leads", "sync"]

PRIORITIES = {"critical": "critical", "high": "high", "medium": "medium", "low": "low",
              "urgent": "critical", "important": "high", "minor": "low", "small": "low"}


def detect_feedback_intent(question: str) -> bool:
    """Check if user wants to submit feedback."""
    q = question.lower()
    return any(kw in q for kw in FEEDBACK_KEYWORDS)


async def extract_feedback_with_llm(api_key: str, question: str, session_id: str) -> dict:
    """Use LLM to extract structured feedback from a natural language message."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    extraction_prompt = f"""Extract structured feedback from this user message. Return ONLY a JSON object with these fields:
- title: A short summary (max 80 chars)
- description: The full feedback description
- module: One of: {', '.join(MODULES)}
- priority: One of: critical, high, medium, low

User message: "{question}"

Return ONLY valid JSON, no markdown, no explanation."""
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"feedback-extract-{session_id}",
            system_message="You extract structured feedback from user messages. Return only valid JSON."
        ).with_model("openai", "gpt-4.1-mini")
        
        response = await chat.send_message(UserMessage(text=extraction_prompt))
        
        # Parse JSON from response
        import json
        # Clean up response - remove markdown code blocks if present
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
            cleaned = re.sub(r'\s*```$', '', cleaned)
        
        return json.loads(cleaned)
    except Exception as e:
        logger.error(f"Feedback extraction failed: {e}")
        # Fallback: simple extraction
        q = question.lower()
        module = "general"
        for m in MODULES:
            if m in q:
                module = m
                break
        priority = "medium"
        for kw, p in PRIORITIES.items():
            if kw in q:
                priority = p
                break
        return {
            "title": question[:80],
            "description": question,
            "module": module,
            "priority": priority,
        }


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
                    except Exception:
                        pass
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
    """Chat with AI CRM Assistant — RAG over CRM data + conversational feedback"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    question = data.get("question", "")
    # Stable session per user email — preserves conversation history
    session_id = data.get("session_id", f"crm-{current_user.get('email', 'anon')}")
    mode = data.get("mode", "auto")  # "auto", "feedback", "crm"
    
    if not question:
        return {"answer": "Please ask a question about your CRM data, or share feedback."}
    
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return {"answer": "AI assistant not configured. Please set EMERGENT_LLM_KEY."}
    
    # Detect if this is a feedback submission
    is_feedback = mode == "feedback" or (mode == "auto" and detect_feedback_intent(question))
    
    if is_feedback:
        return await _handle_feedback(api_key, question, session_id, current_user)
    
    # Check if user is asking for charts/visual data — generate server-side
    q = question.lower()
    chart_data = None
    wants_chart = any(w in q for w in ['chart', 'graph', 'visual', 'pie', 'bar chart', 'show me', 'plot'])
    if wants_chart:
        chart_data = await _generate_chart_data(question, current_user)
    
    # Normal CRM RAG flow
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
- Be professional but friendly
- When showing tabular data, format as a markdown table
- Remember our conversation context — the user may ask follow-up questions"""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_message
        ).with_model("openai", "gpt-4.1-mini")
        
        user_msg = UserMessage(text=question)
        response = await chat.send_message(user_msg)
        
        # If chart data was generated, append it to the response
        if chart_data:
            import json
            chart_json = json.dumps(chart_data)
            response += f"\n\n```chart\n{chart_json}\n```"
        
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


async def _generate_chart_data(question: str, current_user: dict) -> dict:
    """Generate chart data server-side from CRM queries"""
    canonical_db = get_canonical_db()
    q = question.lower()
    
    try:
        if any(w in q for w in ['pipeline', 'stage']):
            # Pipeline by stage
            stages = await canonical_db.opportunities.aggregate([
                {"$match": {"active": True, "date_last_stage_update": {"$regex": "^2026"}, "stage": {"$nin": ["Won", "Lost", "Hold"]}}},
                {"$group": {"_id": "$stage", "value": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}}}},
                {"$sort": {"value": -1}}
            ]).to_list(10)
            return {"type": "bar", "title": "Pipeline by Stage (2026)", "data": [{"name": s["_id"] or "Unknown", "value": round(s["value"])} for s in stages]}
        
        elif any(w in q for w in ['invoice', 'payment', 'collection']):
            # Invoices by payment state
            inv = await canonical_db.invoices.aggregate([
                {"$match": {"state": "posted"}},
                {"$group": {"_id": "$payment_state", "value": {"$sum": {"$ifNull": ["$amount_total", 0]}}}},
                {"$sort": {"value": -1}}
            ]).to_list(10)
            return {"type": "pie", "title": "Invoices by Payment Status", "data": [{"name": s["_id"] or "Unknown", "value": round(s["value"])} for s in inv]}
        
        elif any(w in q for w in ['team', 'salesperson', 'rep', 'performance', 'leaderboard']):
            # Top salespersons
            reps = await canonical_db.opportunities.aggregate([
                {"$match": {"active": True, "stage": "Won", "date_last_stage_update": {"$regex": "^2026"}}},
                {"$group": {"_id": "$owner_name", "value": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}}}},
                {"$sort": {"value": -1}}, {"$limit": 8}
            ]).to_list(8)
            return {"type": "bar", "title": "Top Sales Won (2026)", "data": [{"name": (r["_id"] or "Unknown").split()[-1], "value": round(r["value"])} for r in reps]}
        
        elif any(w in q for w in ['category', 'solution', 'product']):
            # By solution category
            cats = await canonical_db.opportunities.aggregate([
                {"$match": {"active": True, "date_last_stage_update": {"$regex": "^2026"}, "solution_category": {"$ne": None}}},
                {"$group": {"_id": "$solution_category", "value": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}}}},
                {"$sort": {"value": -1}}, {"$limit": 8}
            ]).to_list(8)
            return {"type": "pie", "title": "Pipeline by Solution Category", "data": [{"name": (c["_id"] or "Other")[:15], "value": round(c["value"])} for c in cats]}
        
        elif any(w in q for w in ['activity', 'demo', 'poc']):
            # Activities by type
            acts = await canonical_db.activities.aggregate([
                {"$group": {"_id": "$activity_type", "value": {"$sum": 1}}},
                {"$sort": {"value": -1}}, {"$limit": 8}
            ]).to_list(8)
            return {"type": "bar", "title": "Activities by Type", "data": [{"name": a["_id"] or "Other", "value": a["value"]} for a in acts]}
        
        else:
            # Default: pipeline by stage
            stages = await canonical_db.opportunities.aggregate([
                {"$match": {"active": True, "date_last_stage_update": {"$regex": "^2026"}}},
                {"$group": {"_id": "$stage", "value": {"$sum": {"$ifNull": ["$sale_value", "$amount"]}}}},
                {"$sort": {"value": -1}}
            ]).to_list(10)
            return {"type": "bar", "title": "Opportunities by Stage (2026)", "data": [{"name": s["_id"] or "Unknown", "value": round(s["value"])} for s in stages]}
    except Exception as e:
        logger.error(f"Chart generation error: {e}")
        return None


async def _handle_feedback(api_key: str, question: str, session_id: str, current_user: dict):
    """Handle feedback submission through the AI assistant."""
    app_db = get_app_db()
    
    # Extract structured feedback using LLM
    feedback_data = await extract_feedback_with_llm(api_key, question, session_id)
    
    org_id = current_user.get("org_id", "default")
    feedback_id = generate_id()
    
    feedback = {
        "id": feedback_id,
        "org_id": org_id,
        "title": feedback_data.get("title", question[:80]),
        "description": feedback_data.get("description", question),
        "module": feedback_data.get("module", "general"),
        "priority": feedback_data.get("priority", "medium"),
        "page_url": "",
        "status": "pending",
        "source": "ai_assistant",
        "reporter": {
            "email": current_user.get("email"),
            "name": current_user.get("name", current_user.get("email", "")),
        },
        "attachments": [],
        "admin_note": "",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    
    await app_db.feedback_items.insert_one(feedback)
    logger.info(f"Feedback via AI assistant: '{feedback['title']}' by {current_user.get('email')}")
    
    # Save to chat history
    answer = f"Thanks for your feedback! I've submitted it:\n\n" \
             f"**{feedback['title']}**\n" \
             f"Module: {feedback['module']} | Priority: {feedback['priority']}\n\n" \
             f"Your feedback ID is `{feedback_id[:8]}`. The team will review it shortly."
    
    await app_db.ai_chat_history.insert_one({
        "id": generate_id(),
        "session_id": session_id,
        "user_email": current_user.get("email"),
        "question": question,
        "answer": answer,
        "feedback_id": feedback_id,
        "created_at": now_utc(),
    })
    
    return {
        "answer": answer,
        "session_id": session_id,
        "feedback_submitted": True,
        "feedback_id": feedback_id,
    }


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



@ai_assistant_router.post("/voice")
async def transcribe_voice(
    audio: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Transcribe voice input using OpenAI Whisper via Emergent LLM Key"""
    from fastapi import UploadFile, File
    
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return {"text": "", "error": "Voice input not configured"}
    
    allowed_types = ["audio/webm", "audio/wav", "audio/mp3", "audio/mpeg", "audio/mp4", "audio/m4a", "audio/ogg"]
    if audio.content_type and audio.content_type not in allowed_types:
        return {"text": "", "error": f"Unsupported audio format: {audio.content_type}"}
    
    content = await audio.read()
    if len(content) > 25 * 1024 * 1024:
        return {"text": "", "error": "Audio file too large (max 25MB)"}
    
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        import tempfile
        
        # Write to temp file (Whisper needs a file)
        ext = "webm"
        if audio.filename:
            ext = audio.filename.split(".")[-1] if "." in audio.filename else "webm"
        
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        stt = OpenAISpeechToText(api_key=api_key)
        with open(tmp_path, "rb") as audio_file:
            response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="json",
                language="en"
            )
        
        # Cleanup
        os.unlink(tmp_path)
        
        text = response.text if hasattr(response, 'text') else str(response)
        logger.info(f"Voice transcribed: {len(text)} chars for {current_user.get('email')}")
        return {"text": text}
    except Exception as e:
        logger.error(f"Voice transcription error: {e}")
        return {"text": "", "error": str(e)[:200]}


@ai_assistant_router.post("/feedback-with-attachment")
async def submit_feedback_with_attachment(
    question: str = Form(...),
    session_id: str = Form(""),
    screenshots: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user)
):
    """Submit feedback via AI assistant with optional screenshot attachments"""
    import base64
    from fastapi import Form, UploadFile, File
    from typing import List
    
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Extract structured feedback using LLM
    feedback_data = await extract_feedback_with_llm(api_key, question, session_id) if api_key else {
        "title": question[:80], "description": question, "module": "general", "priority": "medium"
    }
    
    feedback_id = generate_id()
    
    # Process attachments
    attachments_meta = []
    for f in screenshots[:5]:
        if f.content_type and f.content_type not in ["image/png", "image/jpeg", "image/webp"]:
            continue
        content = await f.read()
        if len(content) > 5 * 1024 * 1024:
            continue
        att_id = generate_id()
        attachments_meta.append({"id": att_id, "filename": f.filename, "content_type": f.content_type, "size": len(content)})
        await app_db.feedback_attachments.insert_one({
            "id": att_id, "feedback_id": feedback_id,
            "data": base64.b64encode(content).decode("utf-8"),
            "content_type": f.content_type, "filename": f.filename,
        })
    
    feedback = {
        "id": feedback_id, "org_id": org_id,
        "title": feedback_data.get("title", question[:80]),
        "description": feedback_data.get("description", question),
        "module": feedback_data.get("module", "general"),
        "priority": feedback_data.get("priority", "medium"),
        "page_url": "", "status": "pending", "source": "ai_assistant",
        "reporter": {"email": current_user.get("email"), "name": current_user.get("name", "")},
        "attachments": attachments_meta,
        "admin_note": "", "reviewed_by": None, "reviewed_at": None,
        "created_at": now_utc(), "updated_at": now_utc(),
    }
    
    await app_db.feedback_items.insert_one(feedback)
    
    att_count = len(attachments_meta)
    answer = f"Thanks for your feedback! I've submitted it:\n\n" \
             f"**{feedback['title']}**\n" \
             f"Module: {feedback['module']} | Priority: {feedback['priority']}\n" \
             f"{f'{att_count} screenshot(s) attached' if att_count else ''}\n\n" \
             f"Your feedback ID is `{feedback_id[:8]}`. The team will review it shortly."
    
    return {"answer": answer, "session_id": session_id, "feedback_submitted": True, "feedback_id": feedback_id, "attachments": att_count}


@ai_assistant_router.post("/recommend-activities")
async def recommend_activities(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """AI-powered activity recommendations for a revenue plan/target segment"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return {"recommendations": [], "error": "AI not configured"}
    
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    plan_id = data.get("plan_id")
    segment_name = data.get("segment_name", "")
    target_amount = data.get("target_amount", 0)
    product_manager = data.get("product_manager", "")
    
    # Gather context about existing activities and performance
    context_parts = []
    
    # Get existing activity stats
    acts = await canonical_db.activities.aggregate([
        {"$group": {"_id": "$activity_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(10)
    if acts:
        act_text = ", ".join([f"{a['_id']}: {a['count']}" for a in acts])
        context_parts.append(f"Current activity distribution: {act_text}")
    
    # Get pipeline data for the PM
    if product_manager:
        pm_pipeline = await canonical_db.opportunities.aggregate([
            {"$match": {"active": True, "product_manager": {"$regex": product_manager, "$options": "i"}}},
            {"$group": {"_id": "$stage", "total": {"$sum": {"$ifNull": ["$sale_value", 0]}}, "count": {"$sum": 1}}},
            {"$sort": {"total": -1}}
        ]).to_list(10)
        if pm_pipeline:
            stage_text = ", ".join([f"{s['_id']}: OMR {s['total']:,.0f} ({s['count']})" for s in pm_pipeline])
            context_parts.append(f"Pipeline for {product_manager}: {stage_text}")
    
    # Get plan details if available
    if plan_id:
        plan = await app_db.target_plans.find_one({"id": plan_id}, {"_id": 0})
        if plan:
            context_parts.append(f"Plan: {plan.get('name', '')}, Booking Target: OMR {plan.get('booking_target', 0):,.0f}, Invoiced Target: OMR {plan.get('invoiced_target', 0):,.0f}")
    
    context = "\n".join(context_parts)
    
    prompt = f"""You are a sales strategy advisor for Securado, a B2B IT solutions company in Oman.

Context:
{context}

The Product Director needs activity recommendations for:
- Segment: {segment_name or 'General'}
- Target Amount: OMR {target_amount:,.0f}
- Product Manager: {product_manager or 'Not specified'}

Generate 5-7 specific, actionable activity recommendations. For each, provide:
1. Activity type (Demo, Proof of concept, Site Visit, Work Shop, Product Presentation, Vendor Meeting, Call, Email, Meeting)
2. Title (specific and actionable)
3. Description (2-3 sentences explaining what to do)
4. Priority (high/medium/low)
5. Estimated impact on revenue (high/medium/low)

Return ONLY a JSON array of objects with fields: type, title, description, priority, impact
No markdown, no explanation, just the JSON array."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"activity-rec-{generate_id()[:8]}",
            system_message="You are a sales strategy advisor. Return only valid JSON arrays."
        ).with_model("openai", "gpt-4.1-mini")
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        import json
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
            cleaned = re.sub(r'\s*```$', '', cleaned)
        
        recommendations = json.loads(cleaned)
        return {"recommendations": recommendations}
    except Exception as e:
        logger.error(f"Activity recommendation error: {e}")
        # Fallback static recommendations
        return {"recommendations": [
            {"type": "Demo", "title": "Product Demo for Key Accounts", "description": "Schedule product demonstrations for top 5 accounts in the segment to showcase value proposition.", "priority": "high", "impact": "high"},
            {"type": "Site Visit", "title": "Customer Site Assessment", "description": "Visit top prospect sites to understand their current infrastructure and identify upgrade opportunities.", "priority": "high", "impact": "high"},
            {"type": "Work Shop", "title": "Solution Workshop", "description": "Organize a half-day workshop showcasing solutions relevant to the target segment.", "priority": "medium", "impact": "medium"},
            {"type": "Proof of concept", "title": "POC for High-Value Prospects", "description": "Set up proof-of-concept deployments for prospects with deal value above OMR 50,000.", "priority": "high", "impact": "high"},
            {"type": "Call", "title": "Follow-up Calls on Dormant Leads", "description": "Re-engage dormant leads from previous quarters with updated value propositions.", "priority": "medium", "impact": "medium"},
        ]}


@ai_assistant_router.post("/export-report")
async def export_report(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Export AI-generated report as Excel or PDF"""
    from fastapi.responses import StreamingResponse
    import io
    
    report_format = data.get("format", "excel")  # "excel" or "pdf"
    report_type = data.get("type", "pipeline")  # "pipeline", "invoices", "activities", "performance"
    year = data.get("year", "2026")
    
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    # Gather report data based on type
    report_title = ""
    headers = []
    rows = []
    
    if report_type == "pipeline":
        report_title = f"Pipeline Report - {year}"
        headers = ["Opportunity", "Account", "Stage", "Value (OMR)", "Owner", "Product Manager", "Solution Category"]
        opps = await canonical_db.opportunities.find(
            {"active": True, "date_last_stage_update": {"$regex": f"^{year}"}},
            {"_id": 0, "name": 1, "account_name": 1, "stage": 1, "sale_value": 1, "owner_name": 1, "product_manager": 1, "solution_category": 1}
        ).sort("sale_value", -1).to_list(500)
        for o in opps:
            rows.append([
                o.get("name", ""), o.get("account_name", ""), o.get("stage", ""),
                round(o.get("sale_value", 0) or 0), o.get("owner_name", ""),
                o.get("product_manager", ""), o.get("solution_category", "")
            ])
    
    elif report_type == "invoices":
        report_title = f"Invoice Report - {year}"
        headers = ["Invoice #", "Account", "Amount (OMR)", "Status", "Due Date", "Salesperson"]
        invs = await canonical_db.invoices.find(
            {"active": True},
            {"_id": 0, "invoice_number": 1, "account_name": 1, "amount_total": 1, "payment_state": 1, "due_date": 1, "invoice_user_id": 1}
        ).sort("amount_total", -1).to_list(500)
        for inv in invs:
            rows.append([
                inv.get("invoice_number", ""), inv.get("account_name", ""),
                round(inv.get("amount_total", 0) or 0), inv.get("payment_state", ""),
                inv.get("due_date", ""), inv.get("invoice_user_id", "")
            ])
    
    elif report_type == "activities":
        report_title = "Activities Report"
        headers = ["Type", "Subject", "Status", "Assigned To", "Deadline", "Source"]
        activities = await canonical_db.activities.find(
            {}, {"_id": 0, "activity_type": 1, "summary": 1, "state": 1, "assigned_user": 1, "date_deadline": 1, "source_system": 1}
        ).to_list(500)
        app_acts = await app_db.activities.find(
            {}, {"_id": 0, "activity_type": 1, "summary": 1, "state": 1, "assigned_user": 1, "date_deadline": 1, "source_system": 1}
        ).to_list(500)
        for a in activities + app_acts:
            rows.append([
                a.get("activity_type", ""), a.get("summary", ""), a.get("state", ""),
                a.get("assigned_user", ""), a.get("date_deadline", ""), a.get("source_system", "local")
            ])
    
    elif report_type == "performance":
        report_title = f"Sales Performance Report - {year}"
        headers = ["Salesperson", "Won Deals", "Won Value (OMR)", "Open Pipeline (OMR)", "Win Rate %"]
        # Won by salesperson
        won = await canonical_db.opportunities.aggregate([
            {"$match": {"active": True, "stage": "Won", "date_last_stage_update": {"$regex": f"^{year}"}}},
            {"$group": {"_id": "$owner_name", "won_value": {"$sum": {"$ifNull": ["$sale_value", 0]}}, "won_count": {"$sum": 1}}}
        ]).to_list(50)
        # Open pipeline by salesperson
        open_p = await canonical_db.opportunities.aggregate([
            {"$match": {"active": True, "stage": {"$nin": ["Won", "Lost", "Hold"]}, "date_last_stage_update": {"$regex": f"^{year}"}}},
            {"$group": {"_id": "$owner_name", "open_value": {"$sum": {"$ifNull": ["$sale_value", 0]}}, "open_count": {"$sum": 1}}}
        ]).to_list(50)
        # Total by salesperson for win rate
        total_map = {}
        for w in won:
            name = w["_id"] or "Unknown"
            total_map.setdefault(name, {"won": 0, "won_count": 0, "open": 0})
            total_map[name]["won"] = w["won_value"]
            total_map[name]["won_count"] = w["won_count"]
        for o in open_p:
            name = o["_id"] or "Unknown"
            total_map.setdefault(name, {"won": 0, "won_count": 0, "open": 0})
            total_map[name]["open"] = o["open_value"]
        
        # Total closed (Won + Lost) by salesperson for win rate
        lost_deals = await canonical_db.opportunities.aggregate([
            {"$match": {"active": {"$ne": True}, "stage": "Lost", "date_last_stage_update": {"$regex": f"^{year}"}}},
            {"$group": {"_id": "$owner_name", "lost_count": {"$sum": 1}}}
        ]).to_list(50)
        # Also check active=True but stage=Lost
        lost_deals2 = await canonical_db.opportunities.aggregate([
            {"$match": {"active": True, "stage": "Lost", "date_last_stage_update": {"$regex": f"^{year}"}}},
            {"$group": {"_id": "$owner_name", "lost_count": {"$sum": 1}}}
        ]).to_list(50)
        lost_map = {}
        for d in lost_deals + lost_deals2:
            name = d["_id"] or "Unknown"
            lost_map[name] = lost_map.get(name, 0) + d["lost_count"]
        
        for name, vals in sorted(total_map.items(), key=lambda x: -x[1]["won"]):
            # Win Rate = Won / (Won + Lost) — standard B2B formula
            closed = vals["won_count"] + lost_map.get(name, 0)
            win_rate = round(vals["won_count"] / closed * 100) if closed > 0 else 0
            rows.append([name, vals["won_count"], round(vals["won"]), round(vals["open"]), win_rate])
    
    if not rows:
        return {"error": "No data available for this report"}
    
    if report_format == "excel":
        return _generate_excel(report_title, headers, rows)
    else:
        return _generate_pdf(report_title, headers, rows)


def _generate_excel(title, headers, rows):
    """Generate Excel file"""
    from fastapi.responses import StreamingResponse
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    
    wb = Workbook()
    ws = wb.active
    ws.title = title[:31]
    
    # Title row
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    title_cell = ws.cell(row=1, column=1, value=title)
    title_cell.font = Font(size=14, bold=True, color="800000")
    title_cell.alignment = Alignment(horizontal="center")
    
    # Generated date
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(headers))
    from datetime import datetime, timezone
    date_cell = ws.cell(row=2, column=1, value=f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    date_cell.font = Font(size=9, italic=True, color="666666")
    date_cell.alignment = Alignment(horizontal="center")
    
    # Header row
    header_fill = PatternFill(start_color="800000", end_color="800000", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=10)
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
        cell.border = thin_border
    
    # Data rows
    for row_idx, row in enumerate(rows, 5):
        for col_idx, val in enumerate(row, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.border = thin_border
            if isinstance(val, (int, float)):
                cell.number_format = '#,##0' if isinstance(val, int) else '#,##0.00'
                cell.alignment = Alignment(horizontal="right")
            # Alternate row colors
            if row_idx % 2 == 0:
                cell.fill = PatternFill(start_color="FFF5F5", end_color="FFF5F5", fill_type="solid")
    
    # Auto-fit column widths
    for col in range(1, len(headers) + 1):
        max_len = len(str(headers[col - 1]))
        for row in rows:
            val_len = len(str(row[col - 1])) if col - 1 < len(row) else 0
            max_len = max(max_len, val_len)
        ws.column_dimensions[ws.cell(row=4, column=col).column_letter].width = min(max_len + 4, 40)
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = title.replace(" ", "_").replace("-", "_") + ".xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


def _generate_pdf(title, headers, rows):
    """Generate PDF file"""
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Table as RLTable, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import inch
    
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), topMargin=30, bottomMargin=30)
    styles = getSampleStyleSheet()
    elements = []
    
    # Title
    title_style = styles["Title"]
    title_style.textColor = colors.HexColor("#800000")
    elements.append(Paragraph(title, title_style))
    
    from datetime import datetime, timezone
    elements.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))
    
    # Table
    table_data = [headers] + [[str(v) for v in row] for row in rows[:200]]  # Limit to 200 rows for PDF
    
    col_widths = []
    page_width = landscape(A4)[0] - 60
    for i in range(len(headers)):
        col_widths.append(page_width / len(headers))
    
    table = RLTable(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#800000")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFF5F5")]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 0.2 * inch))
    elements.append(Paragraph(f"Total Records: {len(rows)}", styles["Normal"]))
    
    doc.build(elements)
    output.seek(0)
    
    filename = title.replace(" ", "_").replace("-", "_") + ".pdf"
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
