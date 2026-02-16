"""Dashboard Card Builder - Configurable dashboard cards with query engine.

Each card is a saved query configuration:
- collection: which data source
- aggregation: count, sum, avg
- field: which field to aggregate
- filters: MongoDB-style filters
- display: card type (number, chart, table, progress)
- group_by: optional grouping

Templates group cards into layouts assignable to roles.
RBAC: Queries are scoped by org hierarchy - users see only their data,
managers see their team's data, directors see entire reporting chain.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
import logging
import re

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from libs.redis_pipeline import execute_query, invalidate_dashboard_cache
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
card_builder_router = APIRouter(prefix="/card-builder", tags=["card-builder"])


async def resolve_hierarchy_filter(current_user: dict, collection: str) -> Optional[dict]:
    """Resolve RBAC filter based on org hierarchy.
    
    - Admin/CEO: no filter (sees all)
    - Manager/Director: sees own + entire subordinate chain's data
    - User: sees only own data
    
    Uses the employee hierarchy (manager_id) from Odoo to walk the tree.
    """
    app_db = get_app_db()
    canonical_db = get_canonical_db()
    user_email = current_user.get("email", "")
    
    if not user_email:
        return None
    
    # Check if user is admin
    user = await app_db.users.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}})
    user_roles = user.get("roles", []) if user else []
    if any(r in user_roles for r in ["admin", "system_admin", "sales_admin"]):
        return None  # Admin sees all
    
    # Check RBAC groups for admin-level access
    rbac_user = await app_db.users_rbac.find_one({
        "$or": [
            {"email": {"$regex": f"^{user_email}$", "$options": "i"}},
            {"login": {"$regex": f"^{user_email}$", "$options": "i"}}
        ]
    })
    if rbac_user:
        group_names = rbac_user.get("odoo_group_names", [])
        admin_patterns = ["administration / settings", "sales / administrator", "sales / all documents"]
        if any(p in g.lower() for g in group_names for p in admin_patterns):
            return None  # Admin sees all
    
    # Find employee by email
    employee = await canonical_db.employees.find_one(
        {"email": {"$regex": f"^{user_email}$", "$options": "i"}},
        {"_id": 0, "source_record_id": 1, "name": 1}
    )
    if not employee:
        # Try identity map
        identity = await app_db.user_identity_map.find_one({"email": user_email.lower().strip()})
        if identity:
            emp_name = identity.get("canonical_name", "")
            if emp_name:
                employee = await canonical_db.employees.find_one(
                    {"name": {"$regex": f"^{re.escape(emp_name)}$", "$options": "i"}},
                    {"_id": 0, "source_record_id": 1, "name": 1}
                )
    
    if not employee:
        return None  # Can't determine hierarchy, allow access
    
    emp_id = str(employee.get("source_record_id", ""))
    emp_name = employee.get("name", "")
    
    # Walk the tree: find ALL subordinates recursively
    all_employees = await canonical_db.employees.find(
        {"active": True},
        {"_id": 0, "source_record_id": 1, "name": 1, "manager_id": 1, "email": 1}
    ).to_list(500)
    
    # Build parent→children map
    children_map = {}
    for e in all_employees:
        mgr = str(e.get("manager_id", ""))
        if mgr:
            children_map.setdefault(mgr, []).append(e)
    
    # Check if this user has any subordinates
    def collect_subordinate_names(manager_id):
        names = []
        for child in children_map.get(manager_id, []):
            child_name = child.get("name", "")
            if child_name:
                names.append(child_name)
            child_id = str(child.get("source_record_id", ""))
            if child_id:
                names.extend(collect_subordinate_names(child_id))
        return names
    
    subordinate_names = collect_subordinate_names(emp_id)
    
    # Also get identity map name variants for the user
    all_user_names = [emp_name]
    identity = await app_db.user_identity_map.find_one({"email": user_email.lower().strip()})
    if identity:
        all_user_names = list(set([emp_name] + identity.get("all_names", [])))
    
    # Combine: user's names + all subordinate names
    all_visible_names = list(set(all_user_names + subordinate_names))
    
    if not subordinate_names:
        # Pure user - sees only own data
        name_pattern = "|".join([f"^{re.escape(n)}$" for n in all_user_names])
        logger.info(f"RBAC scope: {emp_name} is USER - sees own data only ({len(all_user_names)} name variants)")
    else:
        name_pattern = "|".join([f"^{re.escape(n)}$" for n in all_visible_names])
        logger.info(f"RBAC scope: {emp_name} is MANAGER - sees {len(subordinate_names)} subordinates + own data")
    
    # Apply filter based on collection type
    if collection in ["opportunities", "leads"]:
        return {"$or": [
            {"owner_name": {"$regex": name_pattern, "$options": "i"}},
            {"product_manager": {"$regex": name_pattern, "$options": "i"}}
        ]}
    elif collection == "activities":
        return {"$or": [
            {"assigned_user": {"$regex": name_pattern, "$options": "i"}},
            {"owner_name": {"$regex": name_pattern, "$options": "i"}}
        ]}
    elif collection == "invoices":
        # For invoices, filter by accounts owned by visible users
        acct_names = await canonical_db.opportunities.distinct(
            "account_name",
            {"owner_name": {"$regex": name_pattern, "$options": "i"}, "active": True}
        )
        acct_names = [a for a in acct_names if a]
        if acct_names:
            return {"account_name": {"$in": acct_names}}
        return {"owner_name": {"$regex": name_pattern, "$options": "i"}}
    elif collection == "accounts":
        return None  # Accounts are shared, no ownership filter
    elif collection == "employees":
        return None  # Employees visible to all
    else:
        return {"owner_name": {"$regex": name_pattern, "$options": "i"}}


class CardConfig(BaseModel):
    name: str
    description: Optional[str] = ""
    collection: str = "opportunities"
    aggregation: str = "count"  # count, sum, avg, list
    field: Optional[str] = None  # field to aggregate
    filters: Optional[dict] = {}
    group_by: Optional[str] = None
    display_type: str = "number"  # number, chart, table, progress, pie
    color: Optional[str] = "#800000"
    icon: Optional[str] = "Target"
    size: str = "small"  # small (1x1), medium (2x1), large (2x2)
    year_filter: bool = True  # apply year filter
    cache_ttl: int = 60


class TemplateConfig(BaseModel):
    name: str
    description: Optional[str] = ""
    cards: List[str] = []  # card IDs in order
    layout: Optional[str] = "grid"  # grid, list
    assigned_roles: List[str] = []  # role IDs
    is_default: bool = False


# ==================== CARDS ====================

@card_builder_router.get("/cards")
async def list_cards(current_user: dict = Depends(get_current_user)):
    """List all dashboard cards"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    cards = await app_db.dashboard_cards.find({"org_id": org_id}).sort("created_at", -1).to_list(200)
    return serialize_doc(cards)


@card_builder_router.get("/cards/{card_id}")
async def get_card(card_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single card config"""
    app_db = get_app_db()
    card = await app_db.dashboard_cards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return serialize_doc(card)


@card_builder_router.post("/cards")
async def create_card(data: CardConfig, current_user: dict = Depends(get_current_user)):
    """Create a new dashboard card"""
    app_db = get_app_db()
    doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "created_by": current_user.get("name", ""),
        "created_at": now_utc(),
        **data.model_dump()
    }
    await app_db.dashboard_cards.insert_one(doc)
    return serialize_doc(doc)


@card_builder_router.put("/cards/{card_id}")
async def update_card(card_id: str, data: CardConfig, current_user: dict = Depends(get_current_user)):
    """Update a dashboard card"""
    app_db = get_app_db()
    result = await app_db.dashboard_cards.update_one(
        {"id": card_id},
        {"$set": {**data.model_dump(), "updated_at": now_utc()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    await invalidate_dashboard_cache()
    return {"success": True}


@card_builder_router.delete("/cards/{card_id}")
async def delete_card(card_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a dashboard card"""
    app_db = get_app_db()
    result = await app_db.dashboard_cards.delete_one({"id": card_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"success": True}


@card_builder_router.post("/cards/{card_id}/execute")
async def execute_card(
    card_id: str,
    year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Execute a card's query and return data"""
    app_db = get_app_db()
    card = await app_db.dashboard_cards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    query_config = {
        "collection": card.get("collection", "opportunities"),
        "aggregation": card.get("aggregation", "count"),
        "field": card.get("field"),
        "filters": card.get("filters", {}),
        "group_by": card.get("group_by"),
        "year": year if card.get("year_filter") else None,
        "cache_ttl": card.get("cache_ttl", 60),
    }
    
    result = await execute_query(query_config)
    return {"card_id": card_id, "card_name": card.get("name"), "display_type": card.get("display_type"), **result}


@card_builder_router.post("/execute-query")
async def execute_adhoc_query(
    query_config: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute an ad-hoc query (for preview/testing)"""
    result = await execute_query(query_config)
    return result


@card_builder_router.get("/my-dashboard")
async def get_my_dashboard(
    year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get the dashboard template assigned to the current user's role, render all blocks"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    # Get user's roles
    user = await app_db.users.find_one({"email": {"$regex": f"^{current_user.get('email', '')}$", "$options": "i"}})
    user_roles = user.get("roles", []) if user else []
    
    # Find template assigned to user's role (or default)
    template = None
    for role in user_roles:
        t = await app_db.dashboard_templates_v2.find_one({"org_id": org_id, "assigned_roles": role})
        if t:
            template = t
            break
    
    if not template:
        template = await app_db.dashboard_templates_v2.find_one({"org_id": org_id, "is_default": True})
    
    if not template:
        return {"template": None, "blocks": []}
    
    # Get layout blocks - auto-generate from cards list if blocks are empty
    blocks = template.get("blocks", [])
    if not blocks and template.get("cards"):
        card_ids = template["cards"]
        col = 0
        row = 0
        for card_id in card_ids:
            card = await app_db.dashboard_cards.find_one({"id": card_id})
            if not card:
                continue
            is_chart = card.get("display_type") in ("chart", "pie", "leaderboard", "progress")
            w = 6 if is_chart else 3
            h = 3 if is_chart else 1
            if col + w > 12:
                col = 0
                row += max(1, h)
            blocks.append({
                "i": card_id, "x": col, "y": row, "w": w, "h": h,
                "type": "query_card", "card_id": card_id
            })
            col += w
            if col >= 12:
                col = 0
                row += h
        # Persist generated blocks
        await app_db.dashboard_templates_v2.update_one(
            {"id": template["id"]}, {"$set": {"blocks": blocks}}
        )
    
    # Resolve RBAC hierarchy filter for this user (once, shared across all cards)
    # This caches per-collection filters to avoid repeated hierarchy walks
    rbac_filters_cache = {}
    
    # Execute query cards
    rendered_blocks = []
    for block in blocks:
        rendered = {k: v for k, v in block.items() if k != "_id"}
        if block.get("type") == "query_card" and block.get("card_id"):
            card = await app_db.dashboard_cards.find_one({"id": block["card_id"]})
            if card:
                rendered["card"] = serialize_doc(card)
                try:
                    group_by = card.get("group_by")
                    if card.get("display_type") == "win_rate" and not group_by:
                        group_by = "stage"
                    
                    collection = card.get("collection", "opportunities")
                    
                    # Get RBAC filter for this collection (cached)
                    if collection not in rbac_filters_cache:
                        rbac_filters_cache[collection] = await resolve_hierarchy_filter(current_user, collection)
                    rbac_filter = rbac_filters_cache[collection]
                    
                    query_config = {
                        "collection": collection,
                        "aggregation": card.get("aggregation", "count"),
                        "field": card.get("field"),
                        "filters": card.get("filters", {}),
                        "group_by": group_by,
                        "year": year if card.get("year_filter") else None,
                        "cache_ttl": card.get("cache_ttl", 60),
                    }
                    if rbac_filter:
                        query_config["rbac_filter"] = rbac_filter
                    
                    rendered["data"] = await execute_query(query_config)
                except:
                    rendered["data"] = {"error": True}
        rendered_blocks.append(rendered)
    
    return {
        "template": serialize_doc(template),
        "blocks": rendered_blocks
    }


@card_builder_router.post("/templates/{template_id}/layout")
async def save_template_layout(
    template_id: str,
    layout: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save the layout (block positions + types) for a template"""
    app_db = get_app_db()
    blocks = layout.get("blocks", [])
    card_ids = [b["card_id"] for b in blocks if b.get("card_id")]
    result = await app_db.dashboard_templates_v2.update_one(
        {"id": template_id},
        {"$set": {"blocks": blocks, "cards": card_ids, "updated_at": now_utc()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"success": True}


@card_builder_router.get("/available-roles")
async def list_available_roles(current_user: dict = Depends(get_current_user)):
    """List all available roles for template assignment"""
    app_db = get_app_db()
    
    # Default CRM roles always available
    default_roles = [
        {"id": "admin", "name": "Admin"},
        {"id": "sales_admin", "name": "Sales Admin"},
        {"id": "sales_director", "name": "Sales Director"},
        {"id": "product_director", "name": "Product Director"},
        {"id": "sales_rep", "name": "Sales Representative"},
        {"id": "marketing", "name": "Marketing"},
        {"id": "user", "name": "User"},
    ]
    default_ids = {r["id"] for r in default_roles}
    
    # Add any custom roles from the database
    db_roles = await app_db.roles.find({}, {"_id": 0}).to_list(100)
    for r in db_roles:
        rid = r.get("id") or r.get("name", "").lower().replace(" ", "_")
        if rid not in default_ids:
            default_roles.append({"id": rid, "name": r.get("name", rid)})
    
    return default_roles




# ==================== TEMPLATES ====================

@card_builder_router.get("/templates")
async def list_templates(current_user: dict = Depends(get_current_user)):
    """List all dashboard templates"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    templates = await app_db.dashboard_templates_v2.find({"org_id": org_id}).sort("created_at", -1).to_list(50)
    return serialize_doc(templates)


@card_builder_router.post("/templates")
async def create_template(data: TemplateConfig, current_user: dict = Depends(get_current_user)):
    """Create a dashboard template"""
    app_db = get_app_db()
    doc = {
        "id": generate_id(),
        "org_id": current_user.get("org_id", "default"),
        "created_by": current_user.get("name", ""),
        "created_at": now_utc(),
        **data.model_dump()
    }
    await app_db.dashboard_templates_v2.insert_one(doc)
    return serialize_doc(doc)


@card_builder_router.put("/templates/{template_id}")
async def update_template(template_id: str, data: TemplateConfig, current_user: dict = Depends(get_current_user)):
    """Update a template metadata (name, description, roles). Does NOT overwrite cards/blocks."""
    app_db = get_app_db()
    # Only update metadata fields, never overwrite cards/blocks from this endpoint
    update_fields = {
        "name": data.name,
        "description": data.description,
        "assigned_roles": data.assigned_roles,
        "is_default": data.is_default,
        "updated_at": now_utc()
    }
    result = await app_db.dashboard_templates_v2.update_one(
        {"id": template_id},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"success": True}


@card_builder_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a template"""
    app_db = get_app_db()
    result = await app_db.dashboard_templates_v2.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"success": True}


@card_builder_router.get("/templates/{template_id}/render")
async def render_template(
    template_id: str,
    year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Render a template - execute all its cards and return results"""
    app_db = get_app_db()
    template = await app_db.dashboard_templates_v2.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    card_ids = template.get("cards", [])
    cards = await app_db.dashboard_cards.find({"id": {"$in": card_ids}}).to_list(50)
    card_map = {c["id"]: serialize_doc(c) for c in cards}
    
    results = []
    for card_id in card_ids:
        card = card_map.get(card_id)
        if not card:
            continue
        
        query_config = {
            "collection": card.get("collection", "opportunities"),
            "aggregation": card.get("aggregation", "count"),
            "field": card.get("field"),
            "filters": card.get("filters", {}),
            "group_by": card.get("group_by"),
            "year": year if card.get("year_filter") else None,
            "cache_ttl": card.get("cache_ttl", 60),
        }
        
        try:
            data = await execute_query(query_config)
        except Exception as e:
            data = {"error": str(e)}
        
        results.append({
            "card_id": card_id,
            "card": card,
            "data": data
        })
    
    return {
        "template": serialize_doc(template),
        "cards": results,
        "rendered_at": now_utc()
    }


# ==================== SEED DEFAULT CARDS ====================

@card_builder_router.post("/seed-defaults")
async def seed_default_cards(current_user: dict = Depends(get_current_user)):
    """Seed default dashboard cards matching Odoo's dashboard"""
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    default_cards = [
        {"name": "Total Pipeline", "collection": "opportunities", "aggregation": "sum", "field": "sale_value",
         "filters": {"type": "opportunity", "stage": {"$nin": ["Won", "Lost"]}}, "display_type": "number", "color": "#3b82f6", "icon": "DollarSign"},
        {"name": "Won Value", "collection": "opportunities", "aggregation": "sum", "field": "sale_value",
         "filters": {"type": "opportunity", "stage": "Won"}, "display_type": "number", "color": "#10b981", "icon": "Trophy"},
        {"name": "Win Rate", "collection": "opportunities", "aggregation": "count",
         "filters": {"type": "opportunity", "stage": {"$in": ["Won", "Lost"]}}, "display_type": "number", "color": "#f59e0b", "icon": "TrendingUp"},
        {"name": "Total Opportunities", "collection": "opportunities", "aggregation": "count",
         "filters": {"type": "opportunity"}, "display_type": "number", "color": "#6366f1", "icon": "Target"},
        {"name": "Pipeline by Stage", "collection": "opportunities", "aggregation": "sum", "field": "sale_value",
         "filters": {"type": "opportunity"}, "group_by": "stage", "display_type": "chart", "size": "large"},
        {"name": "Won by Salesperson", "collection": "opportunities", "aggregation": "sum", "field": "sale_value",
         "filters": {"type": "opportunity", "stage": "Won"}, "group_by": "owner_name", "display_type": "chart", "size": "large"},
        {"name": "Pipeline by PM", "collection": "opportunities", "aggregation": "sum", "field": "sale_value",
         "filters": {"type": "opportunity"}, "group_by": "product_manager", "display_type": "chart", "size": "medium"},
        {"name": "Overdue Invoices", "collection": "invoices", "aggregation": "count",
         "filters": {"payment_state": {"$in": ["not_paid", "partial"]}}, "display_type": "number", "color": "#ef4444", "icon": "AlertTriangle", "year_filter": False},
        {"name": "Total Accounts", "collection": "accounts", "aggregation": "count",
         "filters": {}, "display_type": "number", "color": "#06b6d4", "icon": "Building2", "year_filter": False},
    ]
    
    created = 0
    card_ids = []
    for card_def in default_cards:
        doc = {
            "id": generate_id(),
            "org_id": org_id,
            "created_by": "system",
            "created_at": now_utc(),
            "cache_ttl": 60,
            "year_filter": True,
            **card_def
        }
        await app_db.dashboard_cards.insert_one(doc)
        card_ids.append(doc["id"])
        created += 1
    
    # Build blocks with grid positions (12-column grid)
    blocks = []
    grid_positions = [
        {"x": 0, "y": 0, "w": 3, "h": 1},  # Total Pipeline
        {"x": 3, "y": 0, "w": 3, "h": 1},  # Won Value
        {"x": 6, "y": 0, "w": 3, "h": 1},  # Win Rate
        {"x": 9, "y": 0, "w": 3, "h": 1},  # Total Opportunities
        {"x": 0, "y": 1, "w": 6, "h": 3},  # Pipeline by Stage (chart)
        {"x": 6, "y": 1, "w": 6, "h": 3},  # Won by Salesperson (chart)
        {"x": 0, "y": 4, "w": 6, "h": 3},  # Pipeline by PM (chart)
        {"x": 6, "y": 4, "w": 3, "h": 1},  # Overdue Invoices
        {"x": 9, "y": 4, "w": 3, "h": 1},  # Total Accounts
    ]
    for idx, card_id in enumerate(card_ids):
        pos = grid_positions[idx] if idx < len(grid_positions) else {"x": (idx % 4) * 3, "y": 7 + idx // 4, "w": 3, "h": 1}
        blocks.append({
            "i": card_id, "type": "query_card", "card_id": card_id, **pos
        })

    # Create default template
    template = {
        "id": generate_id(),
        "org_id": org_id,
        "name": "CEO Dashboard",
        "description": "Default executive dashboard matching Odoo KPIs",
        "cards": card_ids,
        "blocks": blocks,
        "layout": "grid",
        "assigned_roles": ["admin", "sales_admin", "sales_director"],
        "is_default": True,
        "created_by": "system",
        "created_at": now_utc()
    }
    await app_db.dashboard_templates_v2.insert_one(template)
    
    return {"success": True, "cards_created": created, "template_id": template["id"]}
