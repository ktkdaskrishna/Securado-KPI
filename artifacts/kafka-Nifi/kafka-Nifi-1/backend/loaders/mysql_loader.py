"""MySQL Loader Implementation"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import aiomysql
from .base import BaseLoader
import logging
import json

logger = logging.getLogger(__name__)


class MySQLLoader(BaseLoader):
    """MySQL target loader using aiomysql"""
    
    def __init__(self):
        super().__init__()
        self.pool = None
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        try:
            self.pool = await aiomysql.create_pool(
                host=config.get('host', 'localhost'),
                port=config.get('port', 3306),
                db=config.get('database', 'mysql'),
                user=config.get('username', 'root'),
                password=config.get('password', ''),
                minsize=1,
                maxsize=10,
                autocommit=True
            )
            self.connected = True
            self.connection_info = config
            return True
        except Exception as e:
            logger.error(f"MySQL connection failed: {e}")
            self.connected = False
            return False
    
    async def disconnect(self) -> None:
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            self.connected = False
    
    async def test_connection(self) -> Dict[str, Any]:
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute('SELECT VERSION()')
                    result = await cur.fetchone()
                    return {
                        "status": "healthy",
                        "version": result[0] if result else "unknown",
                        "message": f"Connected to MySQL {result[0] if result else ''}"
                    }
        except Exception as e:
            return {"status": "unhealthy", "message": str(e)}
    
    async def discover_schema(self, table_name: Optional[str] = None) -> Dict[str, Any]:
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cur:
                    if table_name:
                        await cur.execute(f"DESCRIBE `{table_name}`")
                        rows = await cur.fetchall()
                        return {
                            "table": table_name,
                            "columns": [
                                {
                                    "name": row['Field'],
                                    "type": row['Type'],
                                    "nullable": row['Null'] == 'YES',
                                    "default": row['Default']
                                }
                                for row in rows
                            ]
                        }
                    else:
                        await cur.execute("SHOW TABLES")
                        rows = await cur.fetchall()
                        tables = [list(row.values())[0] for row in rows]
                        return {"tables": tables}
        except Exception as e:
            logger.error(f"Schema discovery failed: {e}")
            return {"error": str(e)}
    
    async def upsert(self, table: str, records: List[Dict], key_field: str) -> Tuple[int, int]:
        if not records:
            return 0, 0
        
        inserted = 0
        updated = 0
        
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                for record in records:
                    record['_updated_at'] = datetime.now(timezone.utc)
                    
                    columns = list(record.keys())
                    values = []
                    for v in record.values():
                        if isinstance(v, (dict, list)):
                            values.append(json.dumps(v))
                        elif isinstance(v, bool):
                            values.append(1 if v else 0)
                        else:
                            values.append(v)
                    
                    placeholders = ', '.join(['%s'] * len(columns))
                    update_set = ', '.join([f'`{col}` = VALUES(`{col}`)' for col in columns if col != key_field])
                    
                    query = f"""
                        INSERT INTO `{table}` (`{"`, `".join(columns)}`)
                        VALUES ({placeholders})
                        ON DUPLICATE KEY UPDATE {update_set}
                    """
                    
                    try:
                        await cur.execute(query, values)
                        if cur.rowcount == 1:
                            inserted += 1
                        elif cur.rowcount == 2:  # MySQL returns 2 for updates
                            updated += 1
                    except Exception as e:
                        logger.error(f"Upsert failed: {e}")
        
        return inserted, updated
    
    async def soft_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                placeholders = ', '.join(['%s'] * len(record_ids))
                await cur.execute(f"""
                    UPDATE `{table}` 
                    SET _is_deleted = 1, _deleted_at = %s
                    WHERE `{key_field}` IN ({placeholders})
                """, [datetime.now(timezone.utc)] + record_ids)
                return cur.rowcount
    
    async def hard_delete(self, table: str, record_ids: List[str], key_field: str) -> int:
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                placeholders = ', '.join(['%s'] * len(record_ids))
                await cur.execute(f"""
                    DELETE FROM `{table}` WHERE `{key_field}` IN ({placeholders})
                """, record_ids)
                return cur.rowcount
    
    async def create_table(self, table: str, schema: Dict[str, Any]) -> bool:
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cur:
                    columns = schema.get('columns', [])
                    if not columns:
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
                            {"name": "is_won", "type": "TINYINT(1)"},
                            {"name": "is_closed", "type": "TINYINT(1)"},
                            {"name": "created_at", "type": "DATETIME"},
                            {"name": "updated_at", "type": "DATETIME"},
                            {"name": "closed_at", "type": "DATETIME"},
                            {"name": "_updated_at", "type": "DATETIME"},
                            {"name": "_is_deleted", "type": "TINYINT(1) DEFAULT 0"},
                            {"name": "_deleted_at", "type": "DATETIME"},
                        ]
                    
                    col_defs = []
                    primary_key = None
                    for col in columns:
                        col_def = f'`{col["name"]}` {col["type"]}'
                        if col.get('primary'):
                            primary_key = col['name']
                        col_defs.append(col_def)
                    
                    if primary_key:
                        col_defs.append(f'PRIMARY KEY (`{primary_key}`)')
                    
                    cols_sql = ', '.join(col_defs)
                    query = f'CREATE TABLE IF NOT EXISTS `{table}` ({cols_sql}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
                    await cur.execute(query)
                    return True
        except Exception as e:
            logger.error(f"Create table failed: {e}")
            return False
    
    async def get_record_count(self, table: str) -> int:
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(f'SELECT COUNT(*) FROM `{table}`')
                result = await cur.fetchone()
                return result[0] if result else 0
