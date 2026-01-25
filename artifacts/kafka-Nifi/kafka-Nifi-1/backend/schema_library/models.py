"""Schema Library Data Models"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum
import hashlib
import json


class SchemaCategory(str, Enum):
    CANONICAL = "canonical"
    INDUSTRY = "industry"
    CUSTOM = "custom"


class IndustryType(str, Enum):
    SAAS = "saas"
    ECOMMERCE = "ecommerce"
    HEALTHCARE = "healthcare"
    FINANCE = "finance"
    MANUFACTURING = "manufacturing"
    RETAIL = "retail"
    LOGISTICS = "logistics"
    GENERAL = "general"


class DataType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    DATE = "date"
    TIME = "time"
    JSON = "json"
    ARRAY = "array"
    BINARY = "binary"
    UUID = "uuid"
    EMAIL = "email"
    URL = "url"
    PHONE = "phone"
    CURRENCY = "currency"


class RelationshipType(str, Enum):
    ONE_TO_ONE = "one_to_one"
    ONE_TO_MANY = "one_to_many"
    MANY_TO_ONE = "many_to_one"
    MANY_TO_MANY = "many_to_many"


class ValidationRuleType(str, Enum):
    REQUIRED = "required"
    MIN_VALUE = "min_value"
    MAX_VALUE = "max_value"
    MIN_LENGTH = "min_length"
    MAX_LENGTH = "max_length"
    PATTERN = "pattern"
    ENUM = "enum"
    UNIQUE = "unique"
    CUSTOM = "custom"


class IndexType(str, Enum):
    PRIMARY = "primary"
    UNIQUE = "unique"
    INDEX = "index"
    FULLTEXT = "fulltext"
    SPATIAL = "spatial"


# ==================== FIELD DEFINITION ====================

class ValidationRule(BaseModel):
    """Validation rule for a field"""
    type: ValidationRuleType
    value: Optional[Any] = None
    message: Optional[str] = None


class FieldDefinition(BaseModel):
    """Definition of a field in a schema"""
    name: str
    display_name: Optional[str] = None
    data_type: DataType
    required: bool = False
    unique: bool = False
    primary_key: bool = False
    auto_generate: bool = False  # Auto-generate value (UUID, timestamp)
    default_value: Optional[Any] = None
    
    # Constraints
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None  # Regex pattern
    enum_values: Optional[List[str]] = None
    
    # Metadata
    description: Optional[str] = None
    examples: Optional[List[Any]] = None
    tags: Optional[List[str]] = None
    
    # For relationships
    is_foreign_key: bool = False
    references_schema: Optional[str] = None
    references_field: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return self.model_dump(exclude_none=True)


class RelationshipDefinition(BaseModel):
    """Definition of a relationship between schemas"""
    name: str
    target_schema: str
    type: RelationshipType
    local_field: str
    foreign_field: str
    cascade_delete: bool = False
    description: Optional[str] = None


class IndexDefinition(BaseModel):
    """Definition of an index"""
    name: str
    fields: List[str]
    type: IndexType = IndexType.INDEX
    unique: bool = False
    description: Optional[str] = None


# ==================== SCHEMA DEFINITION ====================

class SchemaDefinition(BaseModel):
    """Complete schema definition for a data entity"""
    id: Optional[str] = None
    name: str
    display_name: Optional[str] = None
    version: str = "1.0"
    category: SchemaCategory = SchemaCategory.CUSTOM
    industry: Optional[IndustryType] = None
    description: Optional[str] = None
    
    # Inheritance
    extends: Optional[str] = None  # Parent schema ID
    
    # Schema components
    fields: List[FieldDefinition] = []
    relationships: List[RelationshipDefinition] = []
    indexes: List[IndexDefinition] = []
    
    # Metadata
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_system: bool = False  # Built-in schema
    is_active: bool = True
    tags: Optional[List[str]] = None
    
    def get_primary_key_field(self) -> Optional[FieldDefinition]:
        """Get the primary key field"""
        for field in self.fields:
            if field.primary_key:
                return field
        return None
    
    def get_required_fields(self) -> List[FieldDefinition]:
        """Get all required fields"""
        return [f for f in self.fields if f.required]
    
    def to_dict(self) -> Dict:
        return self.model_dump(exclude_none=True)
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, default=str)
    
    def to_yaml(self) -> str:
        import yaml
        return yaml.dump(self.to_dict(), default_flow_style=False)


# ==================== CANONICAL RECORD ENVELOPE ====================

class RecordMetadata(BaseModel):
    """Metadata for a canonical record"""
    source_system: str
    source_model: str
    source_timestamp: Optional[datetime] = None
    extracted_at: datetime
    transformed_at: datetime
    loaded_at: Optional[datetime] = None
    run_id: str
    pipeline_name: Optional[str] = None
    mapping_version: Optional[str] = None
    processing_duration_ms: Optional[int] = None
    retry_count: int = 0
    

class CanonicalRecordEnvelope(BaseModel):
    """
    The Canonical Record Envelope - the contract between this platform
    and downstream integrations.
    
    This envelope wraps every piece of transformed data with:
    - Identity (org, pipeline, schema)
    - Record IDs (canonical and external)
    - The actual data payload
    - Full metadata and lineage
    - Hash for change detection
    """
    # Identity
    org_id: str
    pipeline_id: str
    schema_id: str
    schema_version: str
    
    # Entity
    entity_name: str  # "Opportunity", "Contact", "Invoice", etc.
    
    # Record identification
    record_id: str  # Canonical unique ID (UUID)
    external_id: str  # Source system ID (Odoo ID, Salesforce ID, etc.)
    external_ids: Optional[Dict[str, str]] = None  # Multiple source IDs if merged
    
    # The actual data
    data: Dict[str, Any]  # The transformed/mapped fields
    
    # Metadata
    metadata: RecordMetadata
    
    # Change detection
    data_hash: Optional[str] = None  # SHA-256 hash of data for change detection
    previous_hash: Optional[str] = None  # Previous hash for comparison
    
    # Versioning
    version: int = 1  # Record version (increments on updates)
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    @classmethod
    def compute_hash(cls, data: Dict[str, Any]) -> str:
        """Compute SHA-256 hash of data for change detection"""
        # Sort keys for consistent hashing
        sorted_data = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(sorted_data.encode()).hexdigest()
    
    @classmethod
    def create(
        cls,
        org_id: str,
        pipeline_id: str,
        schema_id: str,
        schema_version: str,
        entity_name: str,
        external_id: str,
        data: Dict[str, Any],
        metadata: RecordMetadata,
        previous_envelope: Optional['CanonicalRecordEnvelope'] = None
    ) -> 'CanonicalRecordEnvelope':
        """Create a new canonical record envelope"""
        import uuid
        from datetime import datetime, timezone
        
        now = datetime.now(timezone.utc)
        data_hash = cls.compute_hash(data)
        
        # Generate canonical ID or reuse existing
        if previous_envelope:
            record_id = previous_envelope.record_id
            version = previous_envelope.version + 1
            previous_hash = previous_envelope.data_hash
            created_at = previous_envelope.created_at
        else:
            record_id = str(uuid.uuid4())
            version = 1
            previous_hash = None
            created_at = now
        
        return cls(
            org_id=org_id,
            pipeline_id=pipeline_id,
            schema_id=schema_id,
            schema_version=schema_version,
            entity_name=entity_name,
            record_id=record_id,
            external_id=str(external_id),
            data=data,
            metadata=metadata,
            data_hash=data_hash,
            previous_hash=previous_hash,
            version=version,
            created_at=created_at,
            updated_at=now
        )
    
    def has_changed(self, new_data: Dict[str, Any]) -> bool:
        """Check if data has changed compared to current"""
        new_hash = self.compute_hash(new_data)
        return new_hash != self.data_hash
    
    def to_dict(self) -> Dict:
        return self.model_dump(exclude_none=True)
    
    def to_storage_format(self) -> Dict:
        """Convert to storage format (MongoDB/SQL compatible)"""
        return {
            "_id": self.record_id,  # Use canonical ID as primary key
            "org_id": self.org_id,
            "pipeline_id": self.pipeline_id,
            "schema_id": self.schema_id,
            "schema_version": self.schema_version,
            "entity_name": self.entity_name,
            "record_id": self.record_id,
            "external_id": self.external_id,
            "external_ids": self.external_ids,
            "data": self.data,
            "metadata": self.metadata.model_dump(),
            "data_hash": self.data_hash,
            "previous_hash": self.previous_hash,
            "version": self.version,
            "is_deleted": self.is_deleted,
            "deleted_at": self.deleted_at,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }


# ==================== SCHEMA IMPORT/EXPORT ====================

class SchemaImportFormat(str, Enum):
    JSON = "json"
    YAML = "yaml"
    DATABASE = "database"  # Import from existing DB table


class SchemaExportFormat(str, Enum):
    JSON = "json"
    YAML = "yaml"
    DDL = "ddl"  # Export as CREATE TABLE statement
    OPENAPI = "openapi"  # Export as OpenAPI schema


class SchemaImportRequest(BaseModel):
    """Request to import a schema"""
    format: SchemaImportFormat
    content: Optional[str] = None  # JSON/YAML content
    # For database import
    target_id: Optional[str] = None
    table_name: Optional[str] = None
    # Options
    name: Optional[str] = None  # Override schema name
    category: SchemaCategory = SchemaCategory.CUSTOM


class SchemaExportRequest(BaseModel):
    """Request to export a schema"""
    format: SchemaExportFormat
    target_type: Optional[str] = None  # For DDL export: postgresql, mysql, etc.
    template_id: Optional[str] = None  # Target template for DDL
