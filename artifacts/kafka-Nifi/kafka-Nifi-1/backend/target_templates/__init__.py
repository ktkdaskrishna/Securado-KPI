"""Target Templates Package - DDL Generation for Multiple Databases"""
from .models import TargetTemplate, TargetType, DDLGeneratorBase
from .generators import (
    PostgreSQLGenerator, MySQLGenerator, MongoDBGenerator,
    SQLServerGenerator, ClickHouseGenerator, SnowflakeGenerator,
    generate_ddl, get_generator
)
from .routes import router as target_templates_router

__all__ = [
    'TargetTemplate', 'TargetType', 'DDLGeneratorBase',
    'PostgreSQLGenerator', 'MySQLGenerator', 'MongoDBGenerator',
    'SQLServerGenerator', 'ClickHouseGenerator', 'SnowflakeGenerator',
    'generate_ddl', 'get_generator', 'target_templates_router'
]
