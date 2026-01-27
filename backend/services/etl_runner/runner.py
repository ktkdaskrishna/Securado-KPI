"""ETL Runner Service - Executes Pipeline Runs

Consumes pipeline run commands and executes:
- Extract data from source
- Transform using mapping rules
- Load to canonical MongoDB
- Emit lifecycle events + canonical upsert events
- Handle errors with DLQ
"""
import asyncio
import logging
import traceback
from datetime import datetime
from typing import Dict, List, Any, Optional
import xmlrpc.client
import random

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc, RunStatus
from libs.event_bus import event_bus, emit_event
from libs.schemas import Topics, EventEnvelope, PipelineRunCommandPayload

logger = logging.getLogger(__name__)


class ETLRunner:
    """ETL Runner service that processes pipeline run commands"""
    
    def __init__(self):
        self.running = False
    
    async def start(self):
        """Start the runner and subscribe to run commands"""
        self.running = True
        event_bus.subscribe(Topics.ETL_PIPELINE_RUN_COMMAND, self.handle_run_command)
        logger.info("ETL Runner started, subscribed to run commands")
    
    async def stop(self):
        """Stop the runner"""
        self.running = False
        event_bus.unsubscribe(Topics.ETL_PIPELINE_RUN_COMMAND, self.handle_run_command)
        logger.info("ETL Runner stopped")
    
    async def handle_run_command(self, event: EventEnvelope):
        """Handle incoming run command event"""
        payload = event.payload
        run_id = payload.get("run_id")
        pipeline_id = payload.get("pipeline_id")
        correlation_id = event.correlation_id
        org_id = event.org_id
        
        logger.info(f"Received run command: {run_id} for pipeline {pipeline_id}")
        
        # Execute the pipeline
        asyncio.create_task(self.execute_pipeline(
            run_id=run_id,
            pipeline_id=pipeline_id,
            connection_id=payload.get("connection_id"),
            mapping_id=payload.get("mapping_id"),
            config=payload.get("config", {}),
            trigger_type=payload.get("trigger_type", "manual"),
            correlation_id=correlation_id,
            org_id=org_id
        ))
    
    async def execute_pipeline(
        self,
        run_id: str,
        pipeline_id: str,
        connection_id: str,
        mapping_id: str,
        config: Dict[str, Any],
        trigger_type: str,
        correlation_id: str,
        org_id: str
    ):
        """Execute a pipeline run"""
        app_db = get_app_db()
        canonical_db = get_canonical_db()
        run_start = datetime.utcnow()
        logs = []
        
        def log(message: str, level: str = "info"):
            logs.append({
                "timestamp": datetime.utcnow().isoformat(),
                "level": level,
                "message": message
            })
            if level == "error":
                logger.error(f"[Run {run_id}] {message}")
            else:
                logger.info(f"[Run {run_id}] {message}")
        
        try:
            # Get pipeline, connection, mapping
            pipeline = await app_db.pipelines.find_one({"id": pipeline_id})
            if not pipeline:
                raise Exception("Pipeline not found")
            
            conn = await app_db.connections.find_one({"id": connection_id})
            if not conn:
                raise Exception("Connection not found")
            
            mapping = await app_db.mappings.find_one({"id": mapping_id})
            if not mapping:
                raise Exception("Mapping not found")
            
            log(f"Starting pipeline: {pipeline['name']} (trigger: {trigger_type})")
            log(f"Connection: {conn['name']} ({conn['type']})")
            log(f"Mapping: {mapping['name']} -> {mapping['target_entity']}")
            
            # Emit started event
            await self._emit_run_event(
                run_id, pipeline_id, RunStatus.EXTRACTING,
                "Extraction started", 0, 0, 0, 0, None,
                correlation_id, org_id
            )
            
            # Update run status
            await app_db.pipeline_runs.update_one(
                {"id": run_id},
                {"$set": {"status": RunStatus.EXTRACTING, "logs": logs}}
            )
            
            # EXTRACT
            records = await self._extract(
                conn, mapping, config, log
            )
            extracted_count = len(records)
            log(f"Extracted {extracted_count} records", "success")
            
            # Emit extracting complete
            await self._emit_run_event(
                run_id, pipeline_id, RunStatus.TRANSFORMING,
                "Transformation started", extracted_count, 0, 0, 0, None,
                correlation_id, org_id
            )
            
            await app_db.pipeline_runs.update_one(
                {"id": run_id},
                {"$set": {
                    "status": RunStatus.TRANSFORMING,
                    "extracted_count": extracted_count,
                    "logs": logs
                }}
            )
            
            # TRANSFORM
            transformed, errors, max_write_date = await self._transform(
                records, mapping, conn["type"], log
            )
            transformed_count = len(transformed)
            error_count = len(errors)
            log(f"Transformed {transformed_count} records ({error_count} errors)", "success" if not errors else "warning")
            
            # Emit transforming complete
            await self._emit_run_event(
                run_id, pipeline_id, RunStatus.LOADING,
                "Loading started", extracted_count, transformed_count, 0, error_count, None,
                correlation_id, org_id
            )
            
            await app_db.pipeline_runs.update_one(
                {"id": run_id},
                {"$set": {
                    "status": RunStatus.LOADING,
                    "transformed_count": transformed_count,
                    "error_count": error_count,
                    "logs": logs
                }}
            )
            
            # LOAD
            inserted, updated = await self._load(
                transformed, mapping["target_entity"], org_id,
                canonical_db, correlation_id, log
            )
            loaded_count = inserted + updated
            log(f"Loaded {loaded_count} records ({inserted} inserted, {updated} updated)", "success")
            
            # Save errors to DLQ
            if errors:
                for err in errors:
                    dlq_id = generate_id()
                    await app_db.dlq.insert_one({
                        "id": dlq_id,
                        "run_id": run_id,
                        "pipeline_id": pipeline_id,
                        "org_id": org_id,
                        "record_id": str(err.get("record_id")),
                        "error": err.get("error"),
                        "raw_data": err.get("raw_data"),
                        "status": "failed",
                        "created_at": now_utc()
                    })
                    
                    # Emit DLQ event
                    await emit_event(
                        event_type=Topics.ETL_DLQ,
                        payload={
                            "dlq_id": dlq_id,
                            "run_id": run_id,
                            "pipeline_id": pipeline_id,
                            "record_id": str(err.get("record_id")),
                            "error": err.get("error")
                        },
                        producer="etl-runner-service",
                        org_id=org_id,
                        correlation_id=correlation_id
                    )
            
            # Update watermark if incremental
            if max_write_date and config.get("sync_mode") == "incremental":
                await app_db.pipelines.update_one(
                    {"id": pipeline_id},
                    {"$set": {"high_watermark": max_write_date}}
                )
                log(f"Updated watermark to {max_write_date}")
            
            # Complete
            run_end = datetime.utcnow()
            duration = (run_end - run_start).total_seconds()
            log(f"Pipeline completed in {duration:.2f}s", "success")
            
            # Emit completed event
            await self._emit_run_event(
                run_id, pipeline_id, RunStatus.COMPLETED,
                f"Completed: {loaded_count} records",
                extracted_count, transformed_count, loaded_count, error_count,
                duration, correlation_id, org_id
            )
            
            await app_db.pipeline_runs.update_one(
                {"id": run_id},
                {"$set": {
                    "status": RunStatus.COMPLETED,
                    "loaded_count": loaded_count,
                    "inserted_count": inserted,
                    "updated_count": updated,
                    "duration_seconds": duration,
                    "completed_at": run_end,
                    "logs": logs
                }}
            )
            
            # Update pipeline stats
            await app_db.pipelines.update_one(
                {"id": pipeline_id},
                {
                    "$set": {"status": "idle", "last_run": run_end},
                    "$inc": {"run_count": 1}
                }
            )
            
            # Emit dashboard refresh event
            await emit_event(
                event_type=Topics.SERVING_DASHBOARD_REFRESH,
                payload={
                    "refresh_type": "incremental",
                    "entity_types": [mapping["target_entity"]]
                },
                producer="etl-runner-service",
                org_id=org_id,
                correlation_id=correlation_id
            )
            
        except Exception as e:
            log(f"Pipeline failed: {str(e)}", "error")
            
            # Emit failed event
            await self._emit_run_event(
                run_id, pipeline_id, RunStatus.FAILED,
                str(e), 0, 0, 0, 1, None,
                correlation_id, org_id
            )
            
            await app_db.pipeline_runs.update_one(
                {"id": run_id},
                {"$set": {
                    "status": RunStatus.FAILED,
                    "error": str(e),
                    "completed_at": datetime.utcnow(),
                    "logs": logs
                }}
            )
            
            await app_db.pipelines.update_one(
                {"id": pipeline_id},
                {"$set": {"status": "idle"}}
            )
    
    async def _extract(
        self,
        conn: Dict,
        mapping: Dict,
        config: Dict,
        log
    ) -> List[Dict]:
        """Extract records from source"""
        if conn["type"] == "odoo":
            return await self._extract_odoo(conn, mapping, config, log)
        else:
            # Mock extraction for other types
            return await self._extract_mock(mapping, config, log)
    
    async def _extract_odoo(
        self,
        conn: Dict,
        mapping: Dict,
        config: Dict,
        log
    ) -> List[Dict]:
        """Extract from Odoo via XML-RPC
        
        Odoo returns relational fields (Many2one) as [id, 'name'] tuples.
        We need to ensure we request all source fields defined in the mapping.
        """
        try:
            log(f"Connecting to Odoo: {conn['url']}")
            common = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/common', allow_none=True)
            uid = common.authenticate(conn["database"], conn["username"], conn["api_key"], {})
            
            if not uid:
                raise Exception("Odoo authentication failed - check credentials")
            
            log(f"Authenticated as uid={uid}")
            models = xmlrpc.client.ServerProxy(f'{conn["url"]}/xmlrpc/2/object', allow_none=True)
            
            # Get fields from mapping
            source_fields = list(set([
                m["source_field"] for m in mapping.get("mappings", []) 
                if m.get("source_field")
            ]))
            
            # Always include essential fields
            essential_fields = ['id', 'create_date', 'write_date']
            for ef in essential_fields:
                if ef not in source_fields:
                    source_fields.append(ef)
            
            log(f"Extracting from model: {mapping['source_model']}")
            log(f"Fields to extract: {source_fields}")
            
            # Build domain filter
            domain = []
            sync_mode = config.get("sync_mode", "full")
            high_watermark = config.get("high_watermark")
            
            if sync_mode == "incremental" and high_watermark:
                incremental_field = config.get("incremental_field", "write_date")
                domain = [[incremental_field, '>', high_watermark]]
                log(f"Incremental mode: {incremental_field} > {high_watermark}")
            else:
                log(f"Full sync mode")
            
            # Extract records
            extract_limit = config.get("extract_limit", 500)
            records = models.execute_kw(
                conn["database"], uid, conn["api_key"],
                mapping["source_model"], 'search_read',
                [domain],  # Domain must be in a list
                {
                    'fields': source_fields,
                    'limit': extract_limit,
                    'order': 'write_date desc'
                }
            )
            
            log(f"Extracted {len(records)} records from Odoo")
            
            # Log sample record structure for debugging
            if records:
                sample = records[0]
                log(f"Sample record keys: {list(sample.keys())}")
                # Log relational field examples
                for key, val in sample.items():
                    if isinstance(val, (list, tuple)):
                        log(f"  Relational field '{key}': {val}", "debug")
            
            return records
            
        except Exception as e:
            log(f"Odoo extraction failed: {e}", "error")
            import traceback
            log(f"Traceback: {traceback.format_exc()}", "error")
            raise
    
    async def _extract_mock(
        self,
        mapping: Dict,
        config: Dict,
        log
    ) -> List[Dict]:
        """Mock extraction for demo/testing"""
        log("Using mock data extraction")
        
        # Generate mock records
        target_entity = mapping.get("target_entity", "opportunity")
        limit = config.get("extract_limit", 10)
        
        if target_entity == "opportunity":
            return [
                {
                    "id": i + 1,
                    "name": f"Opportunity {i + 1}",
                    "expected_revenue": random.randint(10000, 500000),
                    "probability": random.randint(10, 90),
                    "stage_id": [random.choice([1, 2, 3, 4, 5]), random.choice(["Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"])],
                    "user_id": [1, "Sales Rep"],
                    "email_from": f"contact{i}@example.com",
                    "phone": f"+1-555-{1000 + i}",
                    "create_date": datetime.utcnow().isoformat(),
                    "write_date": datetime.utcnow().isoformat()
                }
                for i in range(min(limit, 20))
            ]
        elif target_entity == "account":
            return [
                {
                    "id": i + 1,
                    "name": f"Account {i + 1}",
                    "industry": random.choice(["Technology", "Healthcare", "Finance", "Retail"]),
                    "phone": f"+1-555-{2000 + i}",
                    "website": f"https://account{i}.com",
                    "email": f"info@account{i}.com"
                }
                for i in range(min(limit, 10))
            ]
        else:
            return []
    
    async def _transform(
        self,
        records: List[Dict],
        mapping: Dict,
        source_type: str,
        log
    ) -> tuple:
        """Transform records using mapping rules
        
        Handles Odoo relational fields which return as [id, 'name'] tuples.
        Transform types:
        - direct: Pass value as-is (or extract appropriately from tuple)
        - extract_id: Extract ID from [id, 'name'] tuple
        - extract_name: Extract name from [id, 'name'] tuple
        - to_float: Convert to float
        - to_int: Convert to integer
        - to_bool: Convert to boolean
        """
        transformed = []
        errors = []
        max_write_date = None
        target_entity = mapping.get("target_entity", "record")
        
        log(f"Transforming {len(records)} records to {target_entity}")
        
        for record in records:
            try:
                result = {
                    "source_system": source_type,
                    "source_record_id": str(record.get('id')),
                    "transformed_at": datetime.utcnow()
                }
                
                # Track watermark
                write_date = record.get('write_date')
                if write_date:
                    if max_write_date is None or write_date > max_write_date:
                        max_write_date = write_date
                
                # Track if canonical_id is mapped
                canonical_id_mapped = False
                
                # Apply mapping rules
                for rule in mapping.get("mappings", []):
                    source_field = rule.get("source_field")
                    target_field = rule.get("target_field")
                    transform = rule.get("transform", "direct")
                    
                    if not source_field or not target_field:
                        continue
                    
                    value = record.get(source_field)
                    
                    # Track canonical_id mapping
                    if target_field == "canonical_id":
                        canonical_id_mapped = True
                    
                    # Handle None/False values
                    if value is None or value is False:
                        # For numeric fields, use 0 or None based on transform
                        if transform in ["to_float", "to_int"]:
                            value = 0
                        else:
                            result[target_field] = None
                            continue
                    
                    # Handle Odoo relational fields which return as [id, 'name'] tuples
                    if isinstance(value, (list, tuple)) and len(value) >= 2:
                        if transform == "extract_id":
                            value = str(value[0])
                        elif transform == "extract_name":
                            value = str(value[1]) if value[1] else None
                        elif transform == "direct":
                            # For direct copy of relational field, default to name
                            # unless the target is an ID field (canonical_id, *_id)
                            if target_field == "canonical_id" or target_field.endswith("_id"):
                                value = str(value[0])
                            else:
                                value = str(value[1]) if value[1] else None
                        else:
                            # Default: extract name for display fields
                            value = str(value[1]) if value[1] else None
                    
                    # Apply type transforms
                    try:
                        if transform == "to_float":
                            value = float(value) if value else 0.0
                        elif transform == "to_int":
                            value = int(float(value)) if value else 0
                        elif transform == "to_bool":
                            value = bool(value)
                        elif transform == "direct":
                            # Keep as-is but ensure strings for IDs
                            if target_field == "canonical_id" or target_field.endswith("_id"):
                                value = str(value) if value else None
                    except (ValueError, TypeError) as e:
                        log(f"Transform error for {source_field}->{target_field}: {e}", "warning")
                        value = None
                    
                    result[target_field] = value
                
                # Generate canonical_id only if not mapped from source
                if not canonical_id_mapped or not result.get("canonical_id"):
                    result["canonical_id"] = f"{source_type}_{target_entity}_{record.get('id')}"
                    log(f"Auto-generated canonical_id: {result['canonical_id']}", "debug")
                
                # Ensure required fields have values
                if not result.get("canonical_id"):
                    raise ValueError("Missing canonical_id after transformation")
                
                transformed.append(result)
                
            except Exception as e:
                log(f"Transform error for record {record.get('id')}: {str(e)}", "error")
                errors.append({
                    "record_id": record.get('id'),
                    "error": str(e),
                    "raw_data": record
                })
        
        log(f"Transformation complete: {len(transformed)} success, {len(errors)} errors")
        return transformed, errors, max_write_date
    
    async def _load(
        self,
        records: List[Dict],
        target_entity: str,
        org_id: str,
        canonical_db,
        correlation_id: str,
        log
    ) -> tuple:
        """Load records to canonical database"""
        # Proper pluralization for collection names
        entity_to_collection = {
            "opportunity": "opportunities",
            "account": "accounts",
            "contact": "contacts",
            "user": "users"
        }
        collection_name = entity_to_collection.get(target_entity, f"{target_entity}s")
        collection = canonical_db[collection_name]
        
        inserted = 0
        updated = 0
        
        for record in records:
            record["org_id"] = org_id
            
            result = await collection.update_one(
                {
                    "canonical_id": record["canonical_id"],
                    "org_id": org_id
                },
                {"$set": record},
                upsert=True
            )
            
            if result.upserted_id:
                inserted += 1
                action = "upserted"
            elif result.modified_count > 0:
                updated += 1
                action = "upserted"
            else:
                action = "upserted"  # No change but still report
            
            # Emit canonical record event
            await emit_event(
                event_type=Topics.CANONICAL_RECORD_UPSERTED,
                payload={
                    "canonical_id": record["canonical_id"],
                    "entity_type": target_entity,
                    "action": action,
                    "source_system": record.get("source_system"),
                    "source_record_id": record.get("source_record_id"),
                    "data": {k: v for k, v in record.items() if k not in ['_id', 'transformed_at']}
                },
                producer="etl-runner-service",
                org_id=org_id,
                correlation_id=correlation_id
            )
        
        return inserted, updated
    
    async def _emit_run_event(
        self,
        run_id: str,
        pipeline_id: str,
        status: str,
        message: str,
        extracted: int,
        transformed: int,
        loaded: int,
        errors: int,
        duration: Optional[float],
        correlation_id: str,
        org_id: str
    ):
        """Emit pipeline run lifecycle event"""
        await emit_event(
            event_type=Topics.ETL_PIPELINE_RUN_EVENT,
            payload={
                "run_id": run_id,
                "pipeline_id": pipeline_id,
                "status": status,
                "message": message,
                "extracted_count": extracted,
                "transformed_count": transformed,
                "loaded_count": loaded,
                "error_count": errors,
                "duration_seconds": duration
            },
            producer="etl-runner-service",
            org_id=org_id,
            correlation_id=correlation_id
        )


# Global runner instance
etl_runner = ETLRunner()
