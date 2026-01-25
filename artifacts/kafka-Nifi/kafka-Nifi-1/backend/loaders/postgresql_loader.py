"""PostgreSQL Loader Implementation"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import asyncpg
from .base import BaseLoader
import logging
import json

logger = logging.getLogger(__name__)


class PostgreSQLLoader(BaseLoader):
    """PostgreSQL target loader using asyncpg"""
    
    def __init__(self):
        super().__init__()
        self.pool = None
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        try:
            self.pool = await asyncpg.create_pool(
                host=config.get('host', 'localhost'),
                port=config.get('port', 5432),
                database=config.get('database', 'postgres'),
                user=config.get('username', 'postgres'),
                password=config.get('password', ''),
                min_size=1,
                max_size=10
            )
            self.connected = True
            self.connection_info = config
            return True
        except Exception as e:
            logger.error(f"PostgreSQL connection failed: {e}")
            self.connected = False
            return False
    
    async def disconnect(self) -> None:
        if self.pool:
            await self.pool.close()
            self.connected = False
    
    async def test_connection(self) -> Dict[str, Any]:
        try:
            async with self.pool.acquire() as conn:
                version = await conn.fetchval('SELECT version()')
                return {
                    "status": "healthy",
                    "version": version.split()[1] if version else "unknown",
                    "message": f"Connected to PostgreSQL"
                }
        except Exception as e:
            return {"status": "unhealthy", "message": str(e)}
    
    async def discover_schema(self, table_name: Optional[str] = None) -> Dict[str, Any]:
        try:
            async with self.pool.acquire() as conn:
                if table_name:
                    rows = await conn.fetch("""
                        SELECT column_name, data_type, is_nullable, column_default
                        FROM information_schema.columns
                        WHERE table_name = $1
                        ORDER BY ordinal_position
                    """, table_name)
                    
                    return {
                        "table": table_name,
                        "columns": [
                            {
                                "name": row['column_name'],
                                "type": row['data_type'],
                                "nullable": row['is_nullable'] == 'YES',
                                "default": row['column_default']
                            }
                            for row in rows
                        ]
                    }
                else:
                    rows = await conn.fetch("""
                        SELECT table_name FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                    """)
                    return {"tables": [row['table_name'] for row in rows]}
        except Exception as e:
            logger.error(f"Schema discovery failed: {e}")
            return {"error": str(e)}
    
    async def upsert(self, table: str, records: List[Dict], key_field: str) -> Tuple[int, int]:
        if not records:
            return 0, 0
        
        inserted = 0
        updated = 0
        
        async with self.pool.acquire() as conn:
            for record in records:
                # Add updated timestamp
                record['_updated_at'] = datetime.now(timezone.utc)
                
                # Build column names and values
                columns = list(record.keys())
                values = list(record.values())
                
                # Convert complex types to JSON strings
                for i, v in enumerate(values):
                    if isinstance(v, (dict, list)):
                        values[i] = json.dumps(v)
                
                placeholders = [f'${i+1}' for i in range(len(columns))]
                update_set = ', '.join([f'"{col}" = EXCLUDED."{col}"' for col in columns if col != key_field])
                
                query = f"""
                    INSERT INTO "{table}" ({", ".join([f'"{c}"' for c in columns])})
                    VALUES ({', '.join(placeholders)})
                    ON CONFLICT ("{key_field}") DO UPDATE SET {update_set}
                    RETURNING (xmax = 0) AS inserted
                """
                
                try:
                    result = await conn.fetchrow(query, *values)
                    if result and result['inserted']:
                        inserted += 1
                    else:
                        updated += 1
                except Exception as e:
                    logger.error(f"Upsert failed for record: {e}")
        
        return inserted, updated
    
    async def soft_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        async with self.pool.acquire() as conn:
            result = await conn.execute(f"""
                UPDATE "{table}" 
                SET _is_deleted = TRUE, _deleted_at = $1
                WHERE "{key_field}" = ANY($2)
            """, datetime.now(timezone.utc), record_ids)
            return int(result.split()[-1])
    
    async def hard_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        async with self.pool.acquire() as conn:
            result = await conn.execute(f"""
                DELETE FROM "{table}" WHERE "{key_field}" = ANY($1)
            """, record_ids)
            return int(result.split()[-1])
    
    async def create_table(self, table: str, schema: Dict[str, Any]) -> bool:
        try:
            async with self.pool.acquire() as conn:
                # Build CREATE TABLE statement from schema
                columns = schema.get('columns', [])
                if not columns:
                    # Default schema for opportunities
                    columns = [
                        {"name": "source_record_id", "type": "VARCHAR(255)", "primary": True},
                        {"name": "source_system", "type": "VARCHAR(100)"},
                        {"name": "name", "type": "TEXT"},
                        {"name": "amount", "type": "DECIMAL(15,2)"},
                        {"name": "stage", "type": "VARCHAR(100)"},
                        {"name": "probability", "type": "DECIMAL(5,2)"},
                        {"name": "owner_name", "type": "VARCHAR(255)"},
                        {"name": "contact_email", "type": "VARCHAR(255)"},
                        {"name": "contact_phone", "type": "VARCHAR(100)"},
                        {"name": "is_won", "type": "BOOLEAN"},
                        {"name": "is_closed", "type": "BOOLEAN"},
                        {"name": "created_at", "type": "TIMESTAMP"},
                        {"name": "updated_at", "type": "TIMESTAMP"},
                        {"name": "closed_at", "type": "TIMESTAMP"},
                        {"name": "_updated_at", "type": "TIMESTAMP"},
                        {"name": "_is_deleted", "type": "BOOLEAN DEFAULT FALSE"},
                        {"name": "_deleted_at", "type": "TIMESTAMP"},
                    ]
                
                col_defs = []
                for col in columns:
                    col_def = f'"{col["name"]}" {col["type"]}'
                    if col.get('primary'):
                        col_def += ' PRIMARY KEY'
                    col_defs.append(col_def)
                
                cols_sql = ', '.join(col_defs)
                query = f'CREATE TABLE IF NOT EXISTS "{table}" ({cols_sql})'
                await conn.execute(query)
                return True
        except Exception as e:
            logger.error(f"Create table failed: {e}")
            return False
    
    async def get_record_count(self, table: str) -> int:
        async with self.pool.acquire() as conn:
            return await conn.fetchval(f'SELECT COUNT(*) FROM "{table}"')
