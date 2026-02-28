"""Feedback Service - User feedback with screenshots and admin review.

Workflow:
1. User submits feedback (title, description, module, priority, optional screenshots)
2. Feedback stored with status 'pending'
3. Admin reviews and updates status (in_review, approved, rejected, planned)
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional, List
import logging
import base64
from datetime import datetime, timezone

from libs.database import get_app_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
feedback_router = APIRouter(prefix="/feedback", tags=["feedback"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]


@feedback_router.post("/submit")
async def submit_feedback(
    title: str = Form(...),
    description: str = Form(""),
    module: str = Form("general"),
    priority: str = Form("medium"),
    page_url: str = Form(""),
    screenshots: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user)
):
    """Submit feedback with optional screenshot attachments"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Process screenshots
    attachments = []
    for f in screenshots[:5]:  # Max 5 files
        if f.content_type not in ALLOWED_TYPES:
            continue
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            continue
        att_id = generate_id()
        attachments.append({
            "id": att_id,
            "filename": f.filename,
            "content_type": f.content_type,
            "size": len(content),
            "data": base64.b64encode(content).decode("utf-8"),
        })
    
    feedback = {
        "id": generate_id(),
        "org_id": org_id,
        "title": title,
        "description": description,
        "module": module,
        "priority": priority,
        "page_url": page_url,
        "status": "pending",
        "reporter": {
            "email": current_user.get("email"),
            "name": current_user.get("name", current_user.get("email", "")),
        },
        "attachments": [{k: v for k, v in a.items() if k != "data"} for a in attachments],
        "admin_note": "",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    
    # Store attachments separately (large binary)
    for att in attachments:
        await app_db.feedback_attachments.insert_one({
            "id": att["id"],
            "feedback_id": feedback["id"],
            "data": att["data"],
            "content_type": att["content_type"],
            "filename": att["filename"],
        })
    
    await app_db.feedback_items.insert_one(feedback)
    logger.info(f"Feedback submitted: {title} by {current_user.get('email')} ({len(attachments)} attachments)")
    
    return {"success": True, "feedback_id": feedback["id"], "attachments": len(attachments)}


@feedback_router.get("/my")
async def get_my_feedback(current_user: dict = Depends(get_current_user)):
    """Get current user's feedback submissions"""
    app_db = get_app_db()
    items = await app_db.feedback_items.find(
        {"reporter.email": current_user.get("email")},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return serialize_doc(items)


@feedback_router.get("/admin")
async def get_admin_feedback(
    status: Optional[str] = None,
    module: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Get all feedback for review"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    query = {"org_id": org_id}
    if status:
        query["status"] = status
    if module:
        query["module"] = module
    if priority:
        query["priority"] = priority
    
    items = await app_db.feedback_items.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return serialize_doc(items)


@feedback_router.post("/{feedback_id}/review")
async def review_feedback(
    feedback_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Update feedback status and add note"""
    app_db = get_app_db()
    status = data.get("status")
    admin_note = data.get("admin_note", "")
    
    if status not in ["pending", "in_review", "approved", "rejected", "planned", "completed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await app_db.feedback_items.update_one(
        {"id": feedback_id},
        {"$set": {
            "status": status,
            "admin_note": admin_note,
            "reviewed_by": current_user.get("email"),
            "reviewed_at": now_utc(),
            "updated_at": now_utc(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {"success": True}


@feedback_router.get("/{feedback_id}/attachments/{attachment_id}")
async def get_attachment(
    feedback_id: str,
    attachment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download a feedback screenshot (owner or admin only)"""
    app_db = get_app_db()
    
    # Verify access
    feedback = await app_db.feedback_items.find_one({"id": feedback_id})
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    is_owner = feedback.get("reporter", {}).get("email") == current_user.get("email")
    is_admin = "admin" in current_user.get("roles", []) or "system_admin" in current_user.get("roles", [])
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    att = await app_db.feedback_attachments.find_one({"id": attachment_id, "feedback_id": feedback_id})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    from fastapi.responses import Response
    return Response(
        content=base64.b64decode(att["data"]),
        media_type=att.get("content_type", "image/png"),
        headers={"Content-Disposition": f'inline; filename="{att.get("filename", "screenshot.png")}"'}
    )
