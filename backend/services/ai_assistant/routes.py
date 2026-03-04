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
    """Chat with AI CRM Assistant — RAG over CRM data + conversational feedback"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    question = data.get("question", "")
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
    
    # Normal CRM RAG flow
    context = await gather_crm_context(current_user.get("email", ""), question)
    
    system_message = f"""You are the Securado CRM AI Assistant. You help users understand their sales data, pipeline, invoices, activities, and performance. You can also collect feedback — if a user wants to report a bug or suggest a feature, ask them to describe it and you'll submit it.

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
- When showing tabular data or comparisons, format as a markdown table
- When the user asks for charts, graphs, or visual data, include a JSON block with chart data in this format:
  ```chart
  {{"type":"bar|pie|line","title":"Chart Title","data":[{{"name":"Label","value":123}}]}}
  ```"""

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
