"""Incremental Sync Worker - Polls Odoo every 5 minutes for changed records.

Architecture:
- Uses write_date > last_sync_timestamp to fetch ONLY changed records
- UPSERTS into canonical DB (update if exists, insert if new)
- Auto-validates fields against Odoo before querying (handles deleted x_studio_* fields)
- Runs as background asyncio task inside the FastAPI process
- Zero Odoo configuration needed - uses existing XML-RPC connection

Synced entities (5-min polling):
- crm.lead → opportunities (Opportunities + Leads)
- res.partner → accounts + contacts
- account.move → invoices
"""
import asyncio
import logging
import ssl
import xmlrpc.client
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List

from libs.database import get_app_db, get_canonical_db
from libs.utils import now_utc

logger = logging.getLogger(__name__)

# Entities for incremental sync
INCREMENTAL_ENTITIES = {
    "opportunities": {
        "odoo_model": "crm.lead",
        "canonical_collection": "opportunities",
        "id_field": "id",
        "canonical_id_prefix": "odoo_lead",
        "default_fields": ["id", "name", "partner_id", "user_id", "team_id", "stage_id",
            "probability", "expected_revenue", "sale_amount_total", "type", "active",
            "create_date", "write_date", "date_closed", "date_deadline", "date_last_stage_update",
            "email_from", "phone", "lost_reason_id",
            "productmanager_id", "productcategory_id", "solserv_id",
            "x_studio_sale_value", "x_studio_opportunity_stages_1", "x_studio_opportunity_number",
            "x_studio_budget_status", "x_studio_pledge", "x_studio_poc_demo_done",
            "x_studio_is_tender", "x_studio_rfp_invited",
        ],
    },
    "accounts": {
        "odoo_model": "res.partner",
        "canonical_collection": "accounts",
        "id_field": "id",
        "canonical_id_prefix": "odoo_partner",
        "domain": [["is_company", "=", True]],
        "default_fields": ["id", "name", "email", "phone", "mobile", "street", "city",
            "country_id", "user_id", "create_date", "write_date", "active",
            "credit", "debit", "total_invoiced"],
    },
    "invoices": {
        "odoo_model": "account.move",
        "canonical_collection": "invoices",
        "id_field": "id",
        "canonical_id_prefix": "odoo_invoice",
        "domain": [["move_type", "in", ["out_invoice", "out_refund"]]],
        "default_fields": ["id", "name", "partner_id", "invoice_date", "invoice_date_due",
            "amount_total", "amount_residual", "amount_tax", "amount_untaxed",
            "payment_state", "state", "invoice_user_id", "create_date", "write_date"],
    },
    "contacts": {
        "odoo_model": "res.partner",
        "canonical_collection": "contacts",
        "id_field": "id",
        "canonical_id_prefix": "odoo_contact",
        "domain": [["is_company", "=", False], ["parent_id", "!=", False]],
        "default_fields": ["id", "name", "email", "phone", "mobile", "parent_id",
            "function", "title", "create_date", "write_date", "active"],
    },
    "activities": {
        "odoo_model": "mail.activity",
        "canonical_collection": "activities",
        "id_field": "id",
        "canonical_id_prefix": "odoo_activity",
        "default_fields": ["id", "res_id", "res_model_id", "activity_type_id", "summary",
            "date_deadline", "user_id", "state", "create_date", "write_date"],
    },
    "employees": {
        "odoo_model": "hr.employee",
        "canonical_collection": "employees",
        "id_field": "id",
        "canonical_id_prefix": "odoo_employee",
        "default_fields": ["id", "name", "job_title", "department_id", "parent_id",
            "coach_id", "work_email", "work_phone", "active", "create_date", "write_date"],
    },
}

# Field cache per model (refreshed every hour)
_field_cache: Dict[str, Dict] = {}
_field_cache_time: Dict[str, datetime] = {}


class IncrementalSyncWorker:
    def __init__(self):
        self.running = False
        self.poll_interval = 300  # 5 minutes
        self._task = None
        self.last_poll: Optional[datetime] = None
        self.stats: Dict[str, Dict] = {}

    async def start(self):
        """Start the background polling loop"""
        if self.running:
            logger.info("Incremental sync already running")
            return
        self.running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info(f"Incremental sync worker started (interval: {self.poll_interval}s)")

    async def stop(self):
        """Stop the polling loop"""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Incremental sync worker stopped")

    async def _poll_loop(self):
        """Main polling loop"""
        await asyncio.sleep(30)  # Wait for app startup
        
        while self.running:
            try:
                # Read interval from DB config (user-configurable)
                app_db = get_app_db()
                config = await app_db.sync_configs.find_one({"entity": "_incremental_settings"})
                if config:
                    self.poll_interval = config.get("interval_seconds", 300)
                
                await self._do_incremental_sync()
                self.last_poll = datetime.now(timezone.utc)
            except Exception as e:
                logger.error(f"Incremental sync error: {e}")
                await asyncio.sleep(30)
            
            await asyncio.sleep(self.poll_interval)

    async def _do_incremental_sync(self):
        """Perform one incremental sync cycle for all entities"""
        app_db = get_app_db()
        
        # Get Odoo connection
        conn = await app_db.connections.find_one({"type": "odoo", "status": "active"}, {"_id": 0})
        if not conn:
            return
        
        # Check if incremental sync is enabled
        config = await app_db.sync_configs.find_one({"entity": "_incremental_enabled"})
        if config and not config.get("enabled", True):
            return
        
        url = conn.get("url", "")
        db_name = conn.get("database", "")
        username = conn.get("username", "")
        api_key = conn.get("api_key", "")
        
        if not all([url, db_name, username, api_key]):
            return
        
        # Connect to Odoo
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        try:
            common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common', context=context)
            uid = common.authenticate(db_name, username, api_key, {})
            if not uid:
                logger.error("Incremental sync: Odoo authentication failed")
                return
            models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object', context=context)
        except Exception as e:
            logger.error(f"Incremental sync: Odoo connection failed: {e}")
            return
        
        canonical_db = get_canonical_db()
        
        for entity_id, entity_def in INCREMENTAL_ENTITIES.items():
            try:
                updated = await self._sync_entity(
                    app_db, canonical_db, models, db_name, uid, api_key,
                    entity_id, entity_def
                )
                self.stats[entity_id] = {
                    "last_sync": datetime.now(timezone.utc).isoformat(),
                    "records_updated": updated,
                }
            except Exception as e:
                logger.error(f"Incremental sync {entity_id} failed: {e}")
                self.stats[entity_id] = {
                    "last_sync": datetime.now(timezone.utc).isoformat(),
                    "error": str(e),
                }

    async def _sync_entity(self, app_db, canonical_db, models, db_name, uid, api_key,
                           entity_id, entity_def) -> int:
        """Sync a single entity incrementally"""
        odoo_model = entity_def["odoo_model"]
        collection = entity_def["canonical_collection"]
        
        # Get last sync timestamp
        sync_state = await app_db.sync_state.find_one({"entity": entity_id})
        last_sync_ts = None
        if sync_state:
            last_sync_ts = sync_state.get("last_write_date")
        
        # If never synced, use 30 days ago (don't pull everything)
        if not last_sync_ts:
            last_sync_ts = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
        
        # Validate fields against Odoo (cached for 1 hour)
        valid_fields = await self._get_valid_fields(models, db_name, uid, api_key, odoo_model)
        requested_fields = [f for f in entity_def["default_fields"] if f in valid_fields]
        
        # Ensure write_date is always included
        if "write_date" not in requested_fields:
            requested_fields.append("write_date")
        if "id" not in requested_fields:
            requested_fields.append("id")
        
        # Build domain: write_date > last_sync
        domain = [["write_date", ">", last_sync_ts]]
        if entity_def.get("domain"):
            domain.extend(entity_def["domain"])
        
        # Fetch changed records from Odoo
        try:
            records = models.execute_kw(
                db_name, uid, api_key, odoo_model, 'search_read',
                [domain, requested_fields],
                {'limit': 1000, 'order': 'write_date asc'}
            )
        except xmlrpc.client.Fault as e:
            error_msg = str(e)
            # Handle invalid field errors by retrying with basic fields only
            if "Invalid field" in error_msg:
                import re
                bad_field = re.search(r"Invalid field '(\w+)'", error_msg)
                if bad_field:
                    field_name = bad_field.group(1)
                    logger.warning(f"Removing invalid field '{field_name}' from {odoo_model}")
                    requested_fields = [f for f in requested_fields if f != field_name]
                    records = models.execute_kw(
                        db_name, uid, api_key, odoo_model, 'search_read',
                        [domain, requested_fields],
                        {'limit': 1000, 'order': 'write_date asc'}
                    )
            else:
                raise
        
        if not records:
            return 0
        
        # UPSERT into canonical DB
        updated_count = 0
        max_write_date = last_sync_ts
        
        for record in records:
            odoo_id = record.get("id")
            canonical_id = f"{entity_def['canonical_id_prefix']}_{odoo_id}"
            
            # Transform record
            doc = self._transform_record(record, entity_id, canonical_id)
            doc["synced_at"] = datetime.now(timezone.utc)
            doc["source_system"] = "odoo"
            doc["org_id"] = "default"
            
            # UPSERT: update if exists, insert if new
            # Use source_record_id + org_id as unique key (matches existing index)
            result = await canonical_db[collection].update_one(
                {"source_record_id": str(odoo_id), "org_id": "default"},
                {"$set": doc},
                upsert=True
            )
            
            if result.modified_count > 0 or result.upserted_id:
                updated_count += 1
                # Publish to Redis Stream
                try:
                    from libs.redis_pipeline import publish_sync_event, invalidate_dashboard_cache
                    await publish_sync_event(entity_id, "upsert", str(odoo_id), {"name": doc.get("name", "")})
                except:
                    pass  # Redis publish is best-effort
            
            # Track max write_date
            wd = record.get("write_date", "")
            if wd > max_write_date:
                max_write_date = wd
        
        # Update sync state
        await app_db.sync_state.update_one(
            {"entity": entity_id},
            {"$set": {
                "entity": entity_id,
                "last_write_date": max_write_date,
                "last_sync": datetime.now(timezone.utc).isoformat(),
                "records_synced": updated_count,
            }},
            upsert=True
        )
        
        if updated_count > 0:
            # Invalidate dashboard cache after sync
            try:
                from libs.redis_pipeline import invalidate_dashboard_cache
                await invalidate_dashboard_cache()
            except:
                pass
            logger.info(f"Incremental sync {entity_id}: {updated_count} records updated (write_date > {last_sync_ts})")
        
        # === DELETE DETECTION ===
        # Fetch ALL Odoo IDs including archived (active_test=False)
        # Only truly deleted records get soft-deleted here
        deleted_count = 0
        try:
            base_domain = entity_def.get("domain", [])
            odoo_ids = models.execute_kw(
                db_name, uid, api_key, odoo_model, 'search',
                [base_domain], {'limit': 0, 'context': {'active_test': False}}
            )
            odoo_id_set = set(str(oid) for oid in odoo_ids)
            
            # Get our canonical IDs
            our_ids = set()
            async for doc in canonical_db[collection].find(
                {"source_record_id": {"$exists": True}, "deleted": {"$ne": True}},
                {"_id": 0, "source_record_id": 1}
            ):
                our_ids.add(str(doc.get("source_record_id", "")))
            
            # Find records in our DB but not in Odoo = deleted
            deleted_ids = our_ids - odoo_id_set
            if deleted_ids:
                result = await canonical_db[collection].update_many(
                    {"source_record_id": {"$in": list(deleted_ids)}, "deleted": {"$ne": True}},
                    {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}}
                )
                deleted_count = result.modified_count
                if deleted_count > 0:
                    logger.info(f"Incremental sync {entity_id}: {deleted_count} records soft-deleted (removed from Odoo)")
        except Exception as e:
            logger.error(f"Delete detection failed for {entity_id}: {e}")
        
        return updated_count

    def _transform_record(self, record: dict, entity_id: str, canonical_id: str) -> dict:
        """Transform Odoo record to canonical format"""
        doc = {"canonical_id": canonical_id, "source_record_id": str(record.get("id", ""))}
        
        # Resolve Many2one fields (they come as [id, name] arrays)
        for key, value in record.items():
            if key == "id":
                continue
            if isinstance(value, (list, tuple)) and len(value) == 2 and isinstance(value[0], int):
                doc[key] = value[1]  # Use the name
                doc[f"{key}_id"] = value[0]  # Keep the ID too
            elif value is False:
                doc[key] = None
            else:
                doc[key] = value
        
        # Entity-specific transformations
        if entity_id == "opportunities":
            doc["name"] = record.get("name", "")
            doc["amount"] = record.get("x_studio_sale_value") or record.get("sale_amount_total") or record.get("expected_revenue") or 0
            doc["sale_value"] = record.get("x_studio_sale_value") or doc["amount"]
            doc["owner_name"] = doc.get("user_id", "")
            doc["owner_id"] = doc.get("user_id_id")
            doc["account_name"] = doc.get("partner_id", "")
            doc["account_id"] = doc.get("partner_id_id")
            doc["team_name"] = doc.get("team_id", "")
            doc["product_manager"] = doc.get("productmanager_id", "")
            doc["product_manager_id"] = doc.get("productmanager_id_id")
            doc["solution_category"] = doc.get("productcategory_id", "")
            # Stage: custom_stage (x_studio) is authoritative, stage_id is the pipeline stage
            raw_custom = record.get("x_studio_opportunity_stages_1")
            raw_stage = doc.get("stage_id", "")
            # Resolve Many2one arrays to strings
            if isinstance(raw_custom, (list, tuple)) and len(raw_custom) == 2:
                raw_custom = raw_custom[1]
            if isinstance(raw_stage, (list, tuple)) and len(raw_stage) == 2:
                raw_stage = raw_stage[1]
            doc["custom_stage"] = raw_custom or raw_stage or ""
            doc["lead_stage"] = raw_stage or ""
            doc["stage"] = doc["custom_stage"] or doc["lead_stage"]
        
        elif entity_id == "accounts":
            doc["name"] = record.get("name", "")
            doc["owner_name"] = doc.get("user_id", "")
        
        elif entity_id == "invoices":
            doc["invoice_number"] = record.get("name", "")
            doc["account_name"] = doc.get("partner_id", "")
            doc["amount_total"] = record.get("amount_total", 0)
            doc["payment_state"] = record.get("payment_state", "")
            doc["invoice_date"] = record.get("invoice_date")
            doc["due_date"] = record.get("invoice_date_due")
        
        return doc

    async def _get_valid_fields(self, models, db_name, uid, api_key, odoo_model) -> set:
        """Get valid fields for a model from Odoo (cached 1 hour)"""
        global _field_cache, _field_cache_time
        
        now = datetime.now(timezone.utc)
        if odoo_model in _field_cache and odoo_model in _field_cache_time:
            if (now - _field_cache_time[odoo_model]).total_seconds() < 3600:
                return _field_cache[odoo_model]
        
        try:
            fields = models.execute_kw(db_name, uid, api_key, odoo_model, 'fields_get', [],
                                       {'attributes': ['string', 'type']})
            valid = set(fields.keys())
            _field_cache[odoo_model] = valid
            _field_cache_time[odoo_model] = now
            logger.info(f"Field cache refreshed for {odoo_model}: {len(valid)} fields")
            return valid
        except Exception as e:
            logger.error(f"Failed to get fields for {odoo_model}: {e}")
            # Return a basic set so sync can continue
            return {"id", "name", "write_date", "create_date"}

    def get_status(self) -> dict:
        """Get current status of the incremental sync worker"""
        return {
            "running": self.running,
            "poll_interval": self.poll_interval,
            "last_poll": self.last_poll.isoformat() if self.last_poll else None,
            "entities": self.stats,
        }


# Singleton instance
incremental_worker = IncrementalSyncWorker()
