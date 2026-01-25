"""Target Templates Data Models"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from abc import ABC, abstractmethod


class TargetType(str, Enum):
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    MONGODB = "mongodb"
    SQLSERVER = "sqlserver"
    CLICKHOUSE = "clickhouse"
    SNOWFLAKE = "snowflake"


class ColumnConstraint(str, Enum):
    PRIMARY_KEY = "primary_key"
    NOT_NULL = "not_null"
    UNIQUE = "unique"
    FOREIGN_KEY = "foreign_key"
    DEFAULT = "default"
    CHECK = "check"
    AUTO_INCREMENT = "auto_increment"


class ColumnDefinition(BaseModel):
    """Column definition for target table"""
    name: str
    native_type: str  # Target-specific type (VARCHAR, TEXT, INT, etc.)
    nullable: bool = True
    primary_key: bool = False
    unique: bool = False
    auto_increment: bool = False
    default_value: Optional[str] = None
    check_constraint: Optional[str] = None
    foreign_key: Optional[Dict[str, str]] = None  # {"table": "x", "column": "y"}
    comment: Optional[str] = None


class IndexDefinition(BaseModel):
    """Index definition for target table"""
    name: str
    columns: List[str]
    unique: bool = False
    type: Optional[str] = None  # btree, hash, gin, etc.


class TableTemplate(BaseModel):
    """Template for generating a target table"""
    table_name: str
    schema_name: Optional[str] = None  # Database schema (not the data schema)
    columns: List[ColumnDefinition] = []
    indexes: List[IndexDefinition] = []
    primary_key: Optional[List[str]] = None  # Composite primary key
    engine: Optional[str] = None  # MySQL engine, ClickHouse engine
    partition_by: Optional[str] = None
    cluster_by: Optional[List[str]] = None
    comment: Optional[str] = None


class TargetTemplate(BaseModel):
    """Complete target template definition"""
    id: Optional[str] = None
    name: str
    display_name: Optional[str] = None
    target_type: TargetType
    schema_id: str  # Reference to the source schema
    description: Optional[str] = None
    
    # Table definition
    table: TableTemplate
    
    # Validation rules
    validation_rules: Optional[List[Dict[str, Any]]] = None
    
    # Type mappings override (schema type -> native type)
    type_overrides: Optional[Dict[str, str]] = None
    
    # Metadata
    is_system: bool = False
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict:
        return self.model_dump(exclude_none=True)


class DDLGeneratorBase(ABC):
    """Abstract base class for DDL generators"""
    
    target_type: TargetType
    
    # Default type mappings from schema types to native types
    type_mapping: Dict[str, str] = {}
    
    @abstractmethod
    def generate_create_table(self, template: TableTemplate) -> str:
        """Generate CREATE TABLE statement"""
        pass
    
    @abstractmethod
    def generate_create_index(self, table_name: str, index: IndexDefinition) -> str:
        """Generate CREATE INDEX statement"""
        pass
    
    def generate_drop_table(self, table_name: str, if_exists: bool = True) -> str:
        """Generate DROP TABLE statement"""
        if_exists_clause = "IF EXISTS " if if_exists else ""
        return f"DROP TABLE {if_exists_clause}{table_name};"
    
    def generate_full_ddl(self, template: TableTemplate) -> str:
        """Generate complete DDL (drop + create + indexes)"""
        ddl_parts = []
        
        # Drop statement (commented out by default)
        ddl_parts.append(f"-- Drop table if exists")
        ddl_parts.append(f"-- {self.generate_drop_table(template.table_name)}")
        ddl_parts.append("")
        
        # Create table
        ddl_parts.append(self.generate_create_table(template))
        ddl_parts.append("")
        
        # Indexes
        if template.indexes:
            ddl_parts.append("-- Indexes")
            for idx in template.indexes:
                ddl_parts.append(self.generate_create_index(template.table_name, idx))
        
        return "\n".join(ddl_parts)
    
    def map_type(self, schema_type: str, overrides: Optional[Dict[str, str]] = None) -> str:
        """Map schema type to native type"""
        if overrides and schema_type in overrides:
            return overrides[schema_type]
        return self.type_mapping.get(schema_type, "TEXT")
