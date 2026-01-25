"""Target Templates API Routes"""
from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional, Dict, Any
import uuid
import json
from datetime import datetime, timezone
import os

from .models import TargetTemplate, TargetType, TableTemplate, ColumnDefinition, IndexDefinition
from .generators import generate_ddl, get_generator, GENERATORS

router = APIRouter(prefix="/api/templates", tags=["Target Templates"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'esip_db')]


def serialize_doc(doc):
    """Serialize MongoDB document"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if k == '_id':
                continue
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


# ==================== TEMPLATE CRUD ====================

@router.get("/target-types")
async def list_target_types():
    """List all supported target database types"""
    return {
        "target_types": [
            {
                "value": t.value,
                "label": t.name.replace("_", " ").title(),
                "description": _get_target_description(t)
            }
            for t in TargetType
        ]
    }


def _get_target_description(target: TargetType) -> str:
    descriptions = {
        TargetType.POSTGRESQL: "Open-source relational database with advanced features",
        TargetType.MYSQL: "Popular open-source relational database",
        TargetType.MONGODB: "Document-oriented NoSQL database",
        TargetType.SQLSERVER: "Microsoft SQL Server enterprise database",
        TargetType.CLICKHOUSE: "Column-oriented OLAP database for analytics",
        TargetType.SNOWFLAKE: "Cloud data warehouse platform"
    }
    return descriptions.get(target, "")


@router.get("")
async def list_templates(
    target_type: Optional[str] = None,
    schema_id: Optional[str] = None
):
    """List all target templates"""
    query = {}
    if target_type:
        query["target_type"] = target_type
    if schema_id:
        query["schema_id"] = schema_id
    
    templates = await db.target_templates.find(query).to_list(100)
    
    return {
        "templates": serialize_doc(templates),
        "count": len(templates)
    }


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Get a specific template by ID"""
    template = await db.target_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return serialize_doc(template)


@router.post("")
async def create_template(template: TargetTemplate):
    """Create a new target template"""
    if not template.id:
        template.id = f"template_{template.target_type.value}_{str(uuid.uuid4())[:8]}"
    
    # Check if exists
    existing = await db.target_templates.find_one({"id": template.id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Template '{template.id}' already exists")
    
    template.created_at = datetime.now(timezone.utc)
    template.updated_at = datetime.now(timezone.utc)
    
    template_dict = template.to_dict()
    await db.target_templates.insert_one(template_dict)
    
    return serialize_doc(template_dict)


@router.put("/{template_id}")
async def update_template(template_id: str, template: TargetTemplate):
    """Update an existing template"""
    existing = await db.target_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    
    template.id = template_id
    template.updated_at = datetime.now(timezone.utc)
    template.created_at = existing.get("created_at")
    
    template_dict = template.to_dict()
    await db.target_templates.update_one(
        {"id": template_id},
        {"$set": template_dict}
    )
    
    return serialize_doc(template_dict)


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    """Delete a template"""
    result = await db.target_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return {"status": "deleted", "template_id": template_id}


# ==================== DDL GENERATION ====================

@router.post("/generate-ddl")
async def generate_ddl_from_schema(
    schema_id: str,
    target_type: str,
    table_name: Optional[str] = None,
    schema_name: Optional[str] = None,
    type_overrides: Optional[Dict[str, str]] = None
):
    """Generate DDL from a schema definition"""
    # Get schema
    from schema_library import BUILTIN_SCHEMAS
    from schema_library.builtin_schemas import get_builtin_schema
    
    schema = await db.schema_library.find_one({"id": schema_id})
    if not schema:
        builtin = get_builtin_schema(schema_id)
        if builtin:
            schema = builtin.to_dict()
        else:
            raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found")
    
    schema = serialize_doc(schema)
    
    try:
        ddl = generate_ddl(
            schema=schema,
            target_type=target_type,
            table_name=table_name,
            schema_name=schema_name,
            type_overrides=type_overrides
        )
        
        return {
            "schema_id": schema_id,
            "target_type": target_type,
            "table_name": table_name or schema.get("name", "").lower().replace(" ", "_"),
            "ddl": ddl
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{template_id}/ddl")
async def get_template_ddl(template_id: str):
    """Get DDL for an existing template"""
    template = await db.target_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    
    template = serialize_doc(template)
    
    try:
        # Reconstruct the table template
        table_data = template.get("table", {})
        table_template = TableTemplate(
            table_name=table_data.get("table_name", "unnamed"),
            schema_name=table_data.get("schema_name"),
            columns=[ColumnDefinition(**c) for c in table_data.get("columns", [])],
            indexes=[IndexDefinition(**i) for i in table_data.get("indexes", [])],
            primary_key=table_data.get("primary_key"),
            engine=table_data.get("engine"),
            partition_by=table_data.get("partition_by"),
            cluster_by=table_data.get("cluster_by"),
            comment=table_data.get("comment")
        )
        
        generator = get_generator(template.get("target_type", "postgresql"))
        ddl = generator.generate_full_ddl(table_template)
        
        return {
            "template_id": template_id,
            "target_type": template.get("target_type"),
            "ddl": ddl
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== AUTO-GENERATE FROM SCHEMA ====================

@router.post("/auto-generate")
async def auto_generate_template(
    schema_id: str,
    target_type: str,
    table_name: Optional[str] = None,
    schema_name: Optional[str] = None
):
    """
    Auto-generate a target template from a schema definition.
    This creates a template that can be customized before generating DDL.
    """
    # Get schema
    from schema_library.builtin_schemas import get_builtin_schema
    
    schema = await db.schema_library.find_one({"id": schema_id})
    if not schema:
        builtin = get_builtin_schema(schema_id)
        if builtin:
            schema = builtin.to_dict()
        else:
            raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found")
    
    schema = serialize_doc(schema)
    
    try:
        generator = get_generator(target_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Build columns
    columns = []
    for field in schema.get("fields", []):
        field_type = field.get("data_type", "string")
        native_type = generator.map_type(field_type)
        
        col = {
            "name": field.get("name"),
            "native_type": native_type,
            "nullable": not field.get("required", False),
            "primary_key": field.get("primary_key", False),
            "unique": field.get("unique", False),
            "auto_increment": field.get("auto_generate", False) and field.get("primary_key", False),
            "comment": field.get("description")
        }
        
        if field.get("default_value") is not None:
            col["default_value"] = str(field["default_value"])
        
        columns.append(col)
    
    # Build indexes
    indexes = []
    for idx in schema.get("indexes", []):
        indexes.append({
            "name": idx.get("name"),
            "columns": idx.get("fields", []),
            "unique": idx.get("unique", False),
            "type": idx.get("type")
        })
    
    # Create template
    tbl_name = table_name or schema.get("name", "unnamed").lower().replace(" ", "_")
    
    template = {
        "id": f"template_{target_type}_{schema_id}_{str(uuid.uuid4())[:8]}",
        "name": f"{schema.get('name')} - {target_type.upper()}",
        "display_name": f"{schema.get('display_name', schema.get('name'))} ({target_type.upper()})",
        "target_type": target_type,
        "schema_id": schema_id,
        "description": f"Auto-generated template for {schema.get('name')} targeting {target_type}",
        "table": {
            "table_name": tbl_name,
            "schema_name": schema_name,
            "columns": columns,
            "indexes": indexes,
            "comment": schema.get("description")
        },
        "is_system": False,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Save to database
    await db.target_templates.insert_one(template)
    
    # Also generate DDL preview
    ddl = generate_ddl(schema, target_type, tbl_name, schema_name)
    
    return {
        "template": serialize_doc(template),
        "ddl_preview": ddl
    }


# ==================== TYPE MAPPINGS ====================

@router.get("/type-mappings/{target_type}")
async def get_type_mappings(target_type: str):
    """Get default type mappings for a target database"""
    try:
        generator = get_generator(target_type)
        return {
            "target_type": target_type,
            "type_mappings": generator.type_mapping
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
