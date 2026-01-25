"""Schema Library API Routes"""
from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional, Dict, Any
import uuid
import json
import yaml
from datetime import datetime, timezone
import os

from .models import (
    SchemaDefinition, FieldDefinition, SchemaCategory, IndustryType, DataType,
    SchemaImportRequest, SchemaExportRequest, SchemaImportFormat, SchemaExportFormat
)
from .builtin_schemas import BUILTIN_SCHEMAS, get_builtin_schema, get_schemas_by_category, get_schemas_by_industry
from .validators import SchemaValidator

router = APIRouter(prefix="/api/schemas", tags=["Schema Library"])

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
                continue  # Skip _id, use 'id' field
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


# ==================== SCHEMA CRUD ====================

@router.get("/builtin")
async def list_builtin_schemas(
    category: Optional[SchemaCategory] = None,
    industry: Optional[IndustryType] = None
):
    """List all built-in schemas with optional filtering"""
    schemas = []
    
    if category:
        schemas = get_schemas_by_category(category)
    elif industry:
        schemas = get_schemas_by_industry(industry)
    else:
        schemas = list(BUILTIN_SCHEMAS.values())
    
    return {
        "schemas": [s.to_dict() for s in schemas],
        "count": len(schemas)
    }


@router.get("/builtin/{schema_id}")
async def get_builtin_schema_detail(schema_id: str):
    """Get a specific built-in schema by ID"""
    schema = get_builtin_schema(schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail=f"Built-in schema '{schema_id}' not found")
    return schema.to_dict()


@router.get("")
async def list_schemas(
    category: Optional[str] = None,
    industry: Optional[str] = None,
    search: Optional[str] = None,
    include_builtin: bool = True
):
    """List all schemas (custom + optionally builtin)"""
    schemas = []
    
    # Add built-in schemas if requested
    if include_builtin:
        for s in BUILTIN_SCHEMAS.values():
            schema_dict = s.to_dict()
            schema_dict["source"] = "builtin"
            if category and s.category.value != category:
                continue
            if industry and (not s.industry or s.industry.value != industry):
                continue
            if search and search.lower() not in s.name.lower():
                continue
            schemas.append(schema_dict)
    
    # Add custom schemas from database
    query = {}
    if category:
        query["category"] = category
    if industry:
        query["industry"] = industry
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    custom_schemas = await db.schema_library.find(query).to_list(100)
    for s in custom_schemas:
        schema_dict = serialize_doc(s)
        schema_dict["source"] = "custom"
        schemas.append(schema_dict)
    
    return {
        "schemas": schemas,
        "count": len(schemas)
    }


@router.get("/{schema_id}")
async def get_schema(schema_id: str):
    """Get a specific schema by ID (checks builtin first, then custom)"""
    # Check built-in
    builtin = get_builtin_schema(schema_id)
    if builtin:
        result = builtin.to_dict()
        result["source"] = "builtin"
        return result
    
    # Check custom
    schema = await db.schema_library.find_one({"id": schema_id})
    if not schema:
        raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found")
    
    result = serialize_doc(schema)
    result["source"] = "custom"
    return result


@router.post("")
async def create_schema(schema: SchemaDefinition):
    """Create a new custom schema"""
    # Generate ID if not provided
    if not schema.id:
        schema.id = f"custom_{schema.name.lower().replace(' ', '_')}_{str(uuid.uuid4())[:8]}"
    
    # Check if ID already exists
    existing = await db.schema_library.find_one({"id": schema.id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Schema with ID '{schema.id}' already exists")
    
    # Also check builtin
    if schema.id in BUILTIN_SCHEMAS:
        raise HTTPException(status_code=400, detail=f"Cannot create schema with builtin ID '{schema.id}'")
    
    schema.is_system = False
    schema.created_at = datetime.now(timezone.utc)
    schema.updated_at = datetime.now(timezone.utc)
    
    schema_dict = schema.to_dict()
    await db.schema_library.insert_one(schema_dict)
    
    return serialize_doc(schema_dict)


@router.put("/{schema_id}")
async def update_schema(schema_id: str, schema: SchemaDefinition):
    """Update an existing custom schema"""
    # Cannot update built-in schemas
    if schema_id in BUILTIN_SCHEMAS:
        raise HTTPException(status_code=400, detail="Cannot modify built-in schemas")
    
    existing = await db.schema_library.find_one({"id": schema_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found")
    
    schema.id = schema_id
    schema.updated_at = datetime.now(timezone.utc)
    schema.created_at = existing.get("created_at")
    
    schema_dict = schema.to_dict()
    await db.schema_library.update_one(
        {"id": schema_id},
        {"$set": schema_dict}
    )
    
    return serialize_doc(schema_dict)


@router.delete("/{schema_id}")
async def delete_schema(schema_id: str):
    """Delete a custom schema"""
    # Cannot delete built-in schemas
    if schema_id in BUILTIN_SCHEMAS:
        raise HTTPException(status_code=400, detail="Cannot delete built-in schemas")
    
    result = await db.schema_library.delete_one({"id": schema_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found")
    
    return {"status": "deleted", "schema_id": schema_id}


# ==================== SCHEMA VERSIONING ====================

@router.get("/{schema_id}/versions")
async def list_schema_versions(schema_id: str):
    """List all versions of a schema"""
    versions = await db.schema_versions.find({"schema_id": schema_id}).sort("version", -1).to_list(50)
    return {
        "schema_id": schema_id,
        "versions": serialize_doc(versions),
        "count": len(versions)
    }


@router.post("/{schema_id}/versions")
async def create_schema_version(schema_id: str, comment: Optional[str] = None):
    """Create a new version snapshot of a schema"""
    # Get current schema
    schema = await db.schema_library.find_one({"id": schema_id})
    if not schema:
        # Check builtin
        builtin = get_builtin_schema(schema_id)
        if builtin:
            schema = builtin.to_dict()
        else:
            raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found")
    
    # Get latest version number
    latest = await db.schema_versions.find_one(
        {"schema_id": schema_id},
        sort=[("version_number", -1)]
    )
    new_version_num = (latest["version_number"] + 1) if latest else 1
    
    version_doc = {
        "id": str(uuid.uuid4()),
        "schema_id": schema_id,
        "version_number": new_version_num,
        "version": schema.get("version", "1.0"),
        "schema_snapshot": serialize_doc(schema),
        "comment": comment,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.schema_versions.insert_one(version_doc)
    
    return serialize_doc(version_doc)


@router.get("/{schema_id}/versions/{version_number}")
async def get_schema_version(schema_id: str, version_number: int):
    """Get a specific version of a schema"""
    version = await db.schema_versions.find_one({
        "schema_id": schema_id,
        "version_number": version_number
    })
    if not version:
        raise HTTPException(status_code=404, detail=f"Version {version_number} of schema '{schema_id}' not found")
    return serialize_doc(version)


# ==================== SCHEMA INHERITANCE ====================

@router.post("/{schema_id}/extend")
async def extend_schema(
    schema_id: str,
    new_name: str,
    additional_fields: Optional[List[Dict]] = None
):
    """Create a new schema by extending an existing one"""
    # Get parent schema
    parent = await db.schema_library.find_one({"id": schema_id})
    if not parent:
        builtin = get_builtin_schema(schema_id)
        if builtin:
            parent = builtin.to_dict()
        else:
            raise HTTPException(status_code=404, detail=f"Parent schema '{schema_id}' not found")
    
    # Create child schema
    child_id = f"custom_{new_name.lower().replace(' ', '_')}_{str(uuid.uuid4())[:8]}"
    
    child_fields = parent.get("fields", [])
    if additional_fields:
        child_fields = child_fields + additional_fields
    
    child_schema = {
        "id": child_id,
        "name": new_name,
        "display_name": new_name,
        "version": "1.0",
        "category": "custom",
        "extends": schema_id,
        "description": f"Extended from {parent.get('name')}",
        "fields": child_fields,
        "relationships": parent.get("relationships", []),
        "indexes": parent.get("indexes", []),
        "is_system": False,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.schema_library.insert_one(child_schema)
    
    return serialize_doc(child_schema)


# ==================== IMPORT/EXPORT ====================

@router.post("/import")
async def import_schema(request: SchemaImportRequest):
    """Import a schema from JSON/YAML"""
    try:
        if request.format == SchemaImportFormat.JSON:
            if not request.content:
                raise HTTPException(status_code=400, detail="Content is required for JSON import")
            schema_data = json.loads(request.content)
        
        elif request.format == SchemaImportFormat.YAML:
            if not request.content:
                raise HTTPException(status_code=400, detail="Content is required for YAML import")
            schema_data = yaml.safe_load(request.content)
        
        elif request.format == SchemaImportFormat.DATABASE:
            # Import from existing database table
            raise HTTPException(status_code=501, detail="Database import not yet implemented")
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown import format: {request.format}")
        
        # Override name if provided
        if request.name:
            schema_data["name"] = request.name
        
        # Set category
        schema_data["category"] = request.category.value
        
        # Generate new ID
        name = schema_data.get("name", "imported_schema")
        schema_data["id"] = f"custom_{name.lower().replace(' ', '_')}_{str(uuid.uuid4())[:8]}"
        schema_data["is_system"] = False
        schema_data["created_at"] = datetime.now(timezone.utc)
        schema_data["updated_at"] = datetime.now(timezone.utc)
        
        # Validate the schema structure
        try:
            validated = SchemaDefinition(**schema_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid schema structure: {str(e)}")
        
        # Save to database
        await db.schema_library.insert_one(schema_data)
        
        return {
            "status": "imported",
            "schema": serialize_doc(schema_data)
        }
    
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {str(e)}")


@router.post("/{schema_id}/export")
async def export_schema(schema_id: str, request: SchemaExportRequest):
    """Export a schema to various formats"""
    # Get schema
    schema = await db.schema_library.find_one({"id": schema_id})
    if not schema:
        builtin = get_builtin_schema(schema_id)
        if builtin:
            schema = builtin.to_dict()
        else:
            raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found")
    
    schema = serialize_doc(schema)
    
    if request.format == SchemaExportFormat.JSON:
        return {
            "format": "json",
            "content": json.dumps(schema, indent=2, default=str),
            "filename": f"{schema['name'].lower().replace(' ', '_')}_schema.json"
        }
    
    elif request.format == SchemaExportFormat.YAML:
        return {
            "format": "yaml",
            "content": yaml.dump(schema, default_flow_style=False, sort_keys=False),
            "filename": f"{schema['name'].lower().replace(' ', '_')}_schema.yaml"
        }
    
    elif request.format == SchemaExportFormat.DDL:
        # Generate DDL - delegate to target templates
        from target_templates import generate_ddl
        target_type = request.target_type or "postgresql"
        ddl = generate_ddl(schema, target_type)
        return {
            "format": "ddl",
            "target_type": target_type,
            "content": ddl,
            "filename": f"{schema['name'].lower().replace(' ', '_')}_{target_type}.sql"
        }
    
    elif request.format == SchemaExportFormat.OPENAPI:
        # Generate OpenAPI schema
        openapi_schema = _schema_to_openapi(schema)
        return {
            "format": "openapi",
            "content": json.dumps(openapi_schema, indent=2),
            "filename": f"{schema['name'].lower().replace(' ', '_')}_openapi.json"
        }
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown export format: {request.format}")


def _schema_to_openapi(schema: Dict) -> Dict:
    """Convert schema to OpenAPI format"""
    type_mapping = {
        "string": {"type": "string"},
        "number": {"type": "number"},
        "integer": {"type": "integer"},
        "boolean": {"type": "boolean"},
        "datetime": {"type": "string", "format": "date-time"},
        "date": {"type": "string", "format": "date"},
        "time": {"type": "string", "format": "time"},
        "email": {"type": "string", "format": "email"},
        "url": {"type": "string", "format": "uri"},
        "uuid": {"type": "string", "format": "uuid"},
        "json": {"type": "object"},
        "array": {"type": "array"},
        "currency": {"type": "number"},
        "phone": {"type": "string"},
        "binary": {"type": "string", "format": "binary"}
    }
    
    properties = {}
    required = []
    
    for field in schema.get("fields", []):
        field_name = field.get("name")
        field_type = field.get("data_type", "string")
        
        prop = type_mapping.get(field_type, {"type": "string"}).copy()
        
        if field.get("description"):
            prop["description"] = field["description"]
        if field.get("enum_values"):
            prop["enum"] = field["enum_values"]
        if field.get("min_value") is not None:
            prop["minimum"] = field["min_value"]
        if field.get("max_value") is not None:
            prop["maximum"] = field["max_value"]
        if field.get("min_length") is not None:
            prop["minLength"] = field["min_length"]
        if field.get("max_length") is not None:
            prop["maxLength"] = field["max_length"]
        if field.get("pattern"):
            prop["pattern"] = field["pattern"]
        
        properties[field_name] = prop
        
        if field.get("required"):
            required.append(field_name)
    
    return {
        "type": "object",
        "title": schema.get("name"),
        "description": schema.get("description"),
        "properties": properties,
        "required": required if required else None
    }


# ==================== VALIDATION ====================

@router.post("/{schema_id}/validate")
async def validate_data(schema_id: str, data: Dict[str, Any]):
    """Validate data against a schema"""
    # Get schema
    schema = await db.schema_library.find_one({"id": schema_id})
    if not schema:
        builtin = get_builtin_schema(schema_id)
        if builtin:
            schema_def = builtin
        else:
            raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found")
    else:
        schema_def = SchemaDefinition(**serialize_doc(schema))
    
    validator = SchemaValidator(schema_def, strict=False)
    result = validator.validate(data)
    
    return result.to_dict()


@router.post("/{schema_id}/validate-batch")
async def validate_batch(schema_id: str, records: List[Dict[str, Any]]):
    """Validate multiple records against a schema"""
    # Get schema
    schema = await db.schema_library.find_one({"id": schema_id})
    if not schema:
        builtin = get_builtin_schema(schema_id)
        if builtin:
            schema_def = builtin
        else:
            raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found")
    else:
        schema_def = SchemaDefinition(**serialize_doc(schema))
    
    validator = SchemaValidator(schema_def, strict=False)
    valid, invalid = validator.validate_batch(records)
    
    return {
        "total": len(records),
        "valid_count": len(valid),
        "invalid_count": len(invalid),
        "valid_records": valid,
        "invalid_records": invalid
    }


# ==================== CATEGORIES & INDUSTRIES ====================

@router.get("/meta/categories")
async def list_categories():
    """List all schema categories"""
    return {
        "categories": [
            {"value": c.value, "label": c.name.replace("_", " ").title()}
            for c in SchemaCategory
        ]
    }


@router.get("/meta/industries")
async def list_industries():
    """List all industry types"""
    return {
        "industries": [
            {"value": i.value, "label": i.name.replace("_", " ").title()}
            for i in IndustryType
        ]
    }


@router.get("/meta/data-types")
async def list_data_types():
    """List all available data types"""
    return {
        "data_types": [
            {"value": d.value, "label": d.name.replace("_", " ").title()}
            for d in DataType
        ]
    }
