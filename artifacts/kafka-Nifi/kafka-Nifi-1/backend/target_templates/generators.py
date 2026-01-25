"""DDL Generators for Different Target Databases"""
from typing import Dict, Optional, List, Any
from .models import (
    DDLGeneratorBase, TargetType, TableTemplate,
    ColumnDefinition, IndexDefinition
)


class PostgreSQLGenerator(DDLGeneratorBase):
    """PostgreSQL DDL Generator"""
    
    target_type = TargetType.POSTGRESQL
    
    type_mapping = {
        "string": "VARCHAR(255)",
        "number": "DECIMAL(18,4)",
        "integer": "INTEGER",
        "boolean": "BOOLEAN",
        "datetime": "TIMESTAMP WITH TIME ZONE",
        "date": "DATE",
        "time": "TIME",
        "email": "VARCHAR(255)",
        "url": "VARCHAR(2048)",
        "phone": "VARCHAR(50)",
        "uuid": "UUID",
        "json": "JSONB",
        "array": "JSONB",
        "binary": "BYTEA",
        "currency": "DECIMAL(18,4)"
    }
    
    def generate_create_table(self, template: TableTemplate) -> str:
        lines = []
        table_name = f"{template.schema_name}.{template.table_name}" if template.schema_name else template.table_name
        
        lines.append(f"CREATE TABLE IF NOT EXISTS {table_name} (")
        
        column_defs = []
        for col in template.columns:
            col_def = f"    {col.name} {col.native_type}"
            
            if not col.nullable:
                col_def += " NOT NULL"
            if col.unique and not col.primary_key:
                col_def += " UNIQUE"
            if col.default_value:
                col_def += f" DEFAULT {col.default_value}"
            if col.check_constraint:
                col_def += f" CHECK ({col.check_constraint})"
            
            column_defs.append(col_def)
        
        # Primary key
        pk_cols = [col.name for col in template.columns if col.primary_key]
        if pk_cols:
            column_defs.append(f"    PRIMARY KEY ({', '.join(pk_cols)})")
        elif template.primary_key:
            column_defs.append(f"    PRIMARY KEY ({', '.join(template.primary_key)})")
        
        # Foreign keys
        for col in template.columns:
            if col.foreign_key:
                fk_name = f"fk_{template.table_name}_{col.name}"
                fk_def = f"    CONSTRAINT {fk_name} FOREIGN KEY ({col.name}) REFERENCES {col.foreign_key['table']}({col.foreign_key['column']})"
                column_defs.append(fk_def)
        
        lines.append(",\n".join(column_defs))
        lines.append(");")
        
        # Table comment
        if template.comment:
            lines.append(f"\nCOMMENT ON TABLE {table_name} IS '{template.comment}';")
        
        # Column comments
        for col in template.columns:
            if col.comment:
                lines.append(f"COMMENT ON COLUMN {table_name}.{col.name} IS '{col.comment}';")
        
        return "\n".join(lines)
    
    def generate_create_index(self, table_name: str, index: IndexDefinition) -> str:
        unique = "UNIQUE " if index.unique else ""
        idx_type = f" USING {index.type}" if index.type else ""
        columns = ", ".join(index.columns)
        return f"CREATE {unique}INDEX IF NOT EXISTS {index.name} ON {table_name}{idx_type} ({columns});"


class MySQLGenerator(DDLGeneratorBase):
    """MySQL DDL Generator"""
    
    target_type = TargetType.MYSQL
    
    type_mapping = {
        "string": "VARCHAR(255)",
        "number": "DECIMAL(18,4)",
        "integer": "INT",
        "boolean": "TINYINT(1)",
        "datetime": "DATETIME",
        "date": "DATE",
        "time": "TIME",
        "email": "VARCHAR(255)",
        "url": "VARCHAR(2048)",
        "phone": "VARCHAR(50)",
        "uuid": "CHAR(36)",
        "json": "JSON",
        "array": "JSON",
        "binary": "LONGBLOB",
        "currency": "DECIMAL(18,4)"
    }
    
    def generate_create_table(self, template: TableTemplate) -> str:
        lines = []
        table_name = f"`{template.schema_name}`.`{template.table_name}`" if template.schema_name else f"`{template.table_name}`"
        
        lines.append(f"CREATE TABLE IF NOT EXISTS {table_name} (")
        
        column_defs = []
        for col in template.columns:
            col_def = f"    `{col.name}` {col.native_type}"
            
            if not col.nullable:
                col_def += " NOT NULL"
            if col.auto_increment:
                col_def += " AUTO_INCREMENT"
            if col.unique and not col.primary_key:
                col_def += " UNIQUE"
            if col.default_value:
                col_def += f" DEFAULT {col.default_value}"
            if col.comment:
                col_def += f" COMMENT '{col.comment}'"
            
            column_defs.append(col_def)
        
        # Primary key
        pk_cols = [f"`{col.name}`" for col in template.columns if col.primary_key]
        if pk_cols:
            column_defs.append(f"    PRIMARY KEY ({', '.join(pk_cols)})")
        elif template.primary_key:
            column_defs.append(f"    PRIMARY KEY ({', '.join(f'`{c}`' for c in template.primary_key)})")
        
        # Foreign keys
        for col in template.columns:
            if col.foreign_key:
                fk_name = f"fk_{template.table_name}_{col.name}"
                fk_def = f"    CONSTRAINT `{fk_name}` FOREIGN KEY (`{col.name}`) REFERENCES `{col.foreign_key['table']}`(`{col.foreign_key['column']}`)"
                column_defs.append(fk_def)
        
        lines.append(",\n".join(column_defs))
        
        engine = template.engine or "InnoDB"
        lines.append(f") ENGINE={engine}")
        
        if template.comment:
            lines[-1] += f" COMMENT='{template.comment}'"
        
        lines[-1] += ";"
        
        return "\n".join(lines)
    
    def generate_create_index(self, table_name: str, index: IndexDefinition) -> str:
        unique = "UNIQUE " if index.unique else ""
        idx_type = f" USING {index.type}" if index.type else ""
        columns = ", ".join(f"`{c}`" for c in index.columns)
        return f"CREATE {unique}INDEX `{index.name}` ON `{table_name}`{idx_type} ({columns});"


class SQLServerGenerator(DDLGeneratorBase):
    """SQL Server DDL Generator"""
    
    target_type = TargetType.SQLSERVER
    
    type_mapping = {
        "string": "NVARCHAR(255)",
        "number": "DECIMAL(18,4)",
        "integer": "INT",
        "boolean": "BIT",
        "datetime": "DATETIME2",
        "date": "DATE",
        "time": "TIME",
        "email": "NVARCHAR(255)",
        "url": "NVARCHAR(2048)",
        "phone": "NVARCHAR(50)",
        "uuid": "UNIQUEIDENTIFIER",
        "json": "NVARCHAR(MAX)",
        "array": "NVARCHAR(MAX)",
        "binary": "VARBINARY(MAX)",
        "currency": "MONEY"
    }
    
    def generate_create_table(self, template: TableTemplate) -> str:
        lines = []
        schema = template.schema_name or "dbo"
        table_name = f"[{schema}].[{template.table_name}]"
        
        # Check if table exists
        lines.append(f"IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'{table_name}') AND type in (N'U'))")
        lines.append("BEGIN")
        lines.append(f"CREATE TABLE {table_name} (")
        
        column_defs = []
        for col in template.columns:
            col_def = f"    [{col.name}] {col.native_type}"
            
            if col.auto_increment:
                col_def += " IDENTITY(1,1)"
            if not col.nullable:
                col_def += " NOT NULL"
            if col.unique and not col.primary_key:
                col_def += " UNIQUE"
            if col.default_value:
                col_def += f" DEFAULT {col.default_value}"
            
            column_defs.append(col_def)
        
        # Primary key
        pk_cols = [f"[{col.name}]" for col in template.columns if col.primary_key]
        if pk_cols:
            pk_name = f"PK_{template.table_name}"
            column_defs.append(f"    CONSTRAINT [{pk_name}] PRIMARY KEY ({', '.join(pk_cols)})")
        elif template.primary_key:
            pk_name = f"PK_{template.table_name}"
            column_defs.append(f"    CONSTRAINT [{pk_name}] PRIMARY KEY ({', '.join(f'[{c}]' for c in template.primary_key)})")
        
        lines.append(",\n".join(column_defs))
        lines.append(");")
        lines.append("END;")
        
        return "\n".join(lines)
    
    def generate_create_index(self, table_name: str, index: IndexDefinition) -> str:
        unique = "UNIQUE " if index.unique else ""
        columns = ", ".join(f"[{c}]" for c in index.columns)
        return f"CREATE {unique}INDEX [{index.name}] ON [{table_name}] ({columns});"


class ClickHouseGenerator(DDLGeneratorBase):
    """ClickHouse DDL Generator"""
    
    target_type = TargetType.CLICKHOUSE
    
    type_mapping = {
        "string": "String",
        "number": "Float64",
        "integer": "Int64",
        "boolean": "UInt8",
        "datetime": "DateTime64(3)",
        "date": "Date",
        "time": "String",
        "email": "String",
        "url": "String",
        "phone": "String",
        "uuid": "UUID",
        "json": "String",
        "array": "Array(String)",
        "binary": "String",
        "currency": "Decimal(18,4)"
    }
    
    def generate_create_table(self, template: TableTemplate) -> str:
        lines = []
        table_name = f"`{template.schema_name}`.`{template.table_name}`" if template.schema_name else f"`{template.table_name}`"
        
        lines.append(f"CREATE TABLE IF NOT EXISTS {table_name} (")
        
        column_defs = []
        for col in template.columns:
            col_type = col.native_type
            if col.nullable:
                col_type = f"Nullable({col_type})"
            
            col_def = f"    `{col.name}` {col_type}"
            
            if col.default_value:
                col_def += f" DEFAULT {col.default_value}"
            if col.comment:
                col_def += f" COMMENT '{col.comment}'"
            
            column_defs.append(col_def)
        
        lines.append(",\n".join(column_defs))
        lines.append(")")
        
        # Engine
        engine = template.engine or "MergeTree()"
        lines.append(f"ENGINE = {engine}")
        
        # Primary key / ORDER BY
        pk_cols = [col.name for col in template.columns if col.primary_key]
        if pk_cols:
            lines.append(f"ORDER BY ({', '.join(pk_cols)})")
        elif template.primary_key:
            lines.append(f"ORDER BY ({', '.join(template.primary_key)})")
        else:
            lines.append("ORDER BY tuple()")
        
        # Partition
        if template.partition_by:
            lines.append(f"PARTITION BY {template.partition_by}")
        
        lines[-1] += ";"
        
        # Table comment
        if template.comment:
            lines.append(f"\nALTER TABLE {table_name} MODIFY COMMENT '{template.comment}';")
        
        return "\n".join(lines)
    
    def generate_create_index(self, table_name: str, index: IndexDefinition) -> str:
        # ClickHouse uses different index syntax
        columns = ", ".join(index.columns)
        idx_type = index.type or "minmax"
        return f"ALTER TABLE `{table_name}` ADD INDEX {index.name} ({columns}) TYPE {idx_type} GRANULARITY 3;"


class SnowflakeGenerator(DDLGeneratorBase):
    """Snowflake DDL Generator"""
    
    target_type = TargetType.SNOWFLAKE
    
    type_mapping = {
        "string": "VARCHAR(16777216)",
        "number": "NUMBER(38,4)",
        "integer": "INTEGER",
        "boolean": "BOOLEAN",
        "datetime": "TIMESTAMP_NTZ",
        "date": "DATE",
        "time": "TIME",
        "email": "VARCHAR(255)",
        "url": "VARCHAR(2048)",
        "phone": "VARCHAR(50)",
        "uuid": "VARCHAR(36)",
        "json": "VARIANT",
        "array": "ARRAY",
        "binary": "BINARY",
        "currency": "NUMBER(38,4)"
    }
    
    def generate_create_table(self, template: TableTemplate) -> str:
        lines = []
        if template.schema_name:
            table_name = f"\"{template.schema_name}\".\"{template.table_name}\""
        else:
            table_name = f"\"{template.table_name}\""
        
        lines.append(f"CREATE TABLE IF NOT EXISTS {table_name} (")
        
        column_defs = []
        for col in template.columns:
            col_def = f"    \"{col.name}\" {col.native_type}"
            
            if not col.nullable:
                col_def += " NOT NULL"
            if col.unique and not col.primary_key:
                col_def += " UNIQUE"
            if col.default_value:
                col_def += f" DEFAULT {col.default_value}"
            if col.comment:
                col_def += f" COMMENT '{col.comment}'"
            
            column_defs.append(col_def)
        
        # Primary key (Snowflake supports but doesn't enforce)
        pk_cols = ['"{}"'.format(col.name) for col in template.columns if col.primary_key]
        if pk_cols:
            column_defs.append(f"    PRIMARY KEY ({', '.join(pk_cols)})")
        elif template.primary_key:
            pk_formatted = ', '.join('"{}"'.format(c) for c in template.primary_key)
            column_defs.append(f"    PRIMARY KEY ({pk_formatted})")
        
        lines.append(",\n".join(column_defs))
        lines.append(")")
        
        # Clustering
        if template.cluster_by:
            cluster_cols = ", ".join('"{}"'.format(c) for c in template.cluster_by)
            lines[-1] += f"\nCLUSTER BY ({cluster_cols})"
        
        if template.comment:
            lines[-1] += f"\nCOMMENT = '{template.comment}'"
        
        lines[-1] += ";"
        
        return "\n".join(lines)
    
    def generate_create_index(self, table_name: str, index: IndexDefinition) -> str:
        # Snowflake doesn't support traditional indexes
        # Return a comment explaining this
        return f"-- Note: Snowflake does not support traditional indexes. Consider clustering on: {', '.join(index.columns)}"


class MongoDBGenerator(DDLGeneratorBase):
    """MongoDB DDL Generator (creates JSON schema and indexes)"""
    
    target_type = TargetType.MONGODB
    
    type_mapping = {
        "string": "string",
        "number": "double",
        "integer": "int",
        "boolean": "bool",
        "datetime": "date",
        "date": "date",
        "time": "string",
        "email": "string",
        "url": "string",
        "phone": "string",
        "uuid": "string",
        "json": "object",
        "array": "array",
        "binary": "binData",
        "currency": "decimal"
    }
    
    def generate_create_table(self, template: TableTemplate) -> str:
        """Generate MongoDB collection creation with JSON Schema validation"""
        import json
        
        collection_name = template.table_name
        
        # Build JSON Schema
        properties = {}
        required = []
        
        for col in template.columns:
            bson_type = col.native_type
            prop = {"bsonType": bson_type}
            
            if col.comment:
                prop["description"] = col.comment
            
            properties[col.name] = prop
            
            if not col.nullable:
                required.append(col.name)
        
        validator = {
            "$jsonSchema": {
                "bsonType": "object",
                "title": template.comment or collection_name,
                "required": required if required else None,
                "properties": properties
            }
        }
        
        # Remove None values
        if not validator["$jsonSchema"]["required"]:
            del validator["$jsonSchema"]["required"]
        
        lines = [
            f"// MongoDB Collection: {collection_name}",
            "",
            "// Create collection with validation",
            f"db.createCollection(\"{collection_name}\", {{",
            f"  validator: {json.dumps(validator, indent=4)}",
            "});"
        ]
        
        return "\n".join(lines)
    
    def generate_create_index(self, table_name: str, index: IndexDefinition) -> str:
        import json
        
        # Build index specification
        index_spec = {col: 1 for col in index.columns}
        options = {"name": index.name}
        
        if index.unique:
            options["unique"] = True
        
        return f"db.{table_name}.createIndex({json.dumps(index_spec)}, {json.dumps(options)});"


# ==================== GENERATOR FACTORY ====================

GENERATORS: Dict[TargetType, type] = {
    TargetType.POSTGRESQL: PostgreSQLGenerator,
    TargetType.MYSQL: MySQLGenerator,
    TargetType.SQLSERVER: SQLServerGenerator,
    TargetType.CLICKHOUSE: ClickHouseGenerator,
    TargetType.SNOWFLAKE: SnowflakeGenerator,
    TargetType.MONGODB: MongoDBGenerator,
}


def get_generator(target_type: str) -> DDLGeneratorBase:
    """Get DDL generator for target type"""
    try:
        tt = TargetType(target_type.lower())
    except ValueError:
        raise ValueError(f"Unknown target type: {target_type}. Supported: {[t.value for t in TargetType]}")
    
    generator_class = GENERATORS.get(tt)
    if not generator_class:
        raise ValueError(f"No generator available for: {target_type}")
    
    return generator_class()


def generate_ddl(
    schema: Dict,
    target_type: str,
    table_name: Optional[str] = None,
    schema_name: Optional[str] = None,
    type_overrides: Optional[Dict[str, str]] = None
) -> str:
    """
    Generate DDL from a schema definition.
    
    Args:
        schema: Schema definition dict
        target_type: Target database type (postgresql, mysql, etc.)
        table_name: Override table name (defaults to schema name)
        schema_name: Database schema name
        type_overrides: Override type mappings
    """
    generator = get_generator(target_type)
    
    # Build columns from schema fields
    columns = []
    for field in schema.get("fields", []):
        field_type = field.get("data_type", "string")
        native_type = generator.map_type(field_type, type_overrides)
        
        col = ColumnDefinition(
            name=field.get("name"),
            native_type=native_type,
            nullable=not field.get("required", False),
            primary_key=field.get("primary_key", False),
            unique=field.get("unique", False),
            auto_increment=field.get("auto_generate", False) and field.get("primary_key", False),
            default_value=_format_default(field.get("default_value"), field_type, target_type),
            comment=field.get("description")
        )
        columns.append(col)
    
    # Build indexes from schema
    indexes = []
    for idx in schema.get("indexes", []):
        index = IndexDefinition(
            name=idx.get("name"),
            columns=idx.get("fields", []),
            unique=idx.get("unique", False),
            type=idx.get("type")
        )
        indexes.append(index)
    
    # Create table template
    tbl_name = table_name or schema.get("name", "unnamed_table").lower().replace(" ", "_")
    template = TableTemplate(
        table_name=tbl_name,
        schema_name=schema_name,
        columns=columns,
        indexes=indexes,
        comment=schema.get("description")
    )
    
    return generator.generate_full_ddl(template)


def _format_default(value: Any, field_type: str, target_type: str) -> Optional[str]:
    """Format default value for SQL"""
    if value is None:
        return None
    
    if field_type == "boolean":
        if target_type in ["mysql"]:
            return "1" if value else "0"
        return "TRUE" if value else "FALSE"
    
    if field_type in ["string", "email", "url", "phone", "uuid"]:
        return f"'{value}'"
    
    if field_type in ["number", "integer", "currency"]:
        return str(value)
    
    return None
