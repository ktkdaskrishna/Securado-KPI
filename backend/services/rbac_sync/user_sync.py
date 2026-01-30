"""Odoo User & RBAC Metadata Sync

Syncs user metadata from Odoo including:
- User identity (id, name, login)
- Group memberships (Sales/User, Sales/Manager, etc.)
- Team memberships (sale_team_ids)
- Active status

This metadata is used by the local access rule engine to determine
what data each user can see in Event Mesh CRM.
"""
import logging
import xmlrpc.client
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class OdooUserSync:
    """Syncs user and permission metadata from Odoo"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.app_db: Optional[AsyncIOMotorDatabase] = None
        logger.info("OdooUserSync initialized")
    
    async def initialize(self, app_db: AsyncIOMotorDatabase):
        """Initialize with database connection"""
        self.app_db = app_db
        
        # Create indexes
        await app_db.users_rbac.create_index("odoo_user_id", unique=True)
        await app_db.users_rbac.create_index("login")
        await app_db.users_rbac.create_index("name")
        await app_db.groups_rbac.create_index("odoo_group_id", unique=True)
        await app_db.teams_rbac.create_index("odoo_team_id", unique=True)
        
        logger.info("OdooUserSync indexes created")
    
    async def sync_from_odoo(
        self,
        odoo_url: str,
        odoo_db: str,
        odoo_username: str,
        odoo_password: str,
        org_id: str = "default"
    ) -> Dict[str, Any]:
        """Sync user, group, and team metadata from Odoo
        
        Returns:
            Summary of synced records
        """
        logger.info(f"Starting RBAC sync from Odoo: {odoo_url}")
        
        try:
            # Connect to Odoo
            common = xmlrpc.client.ServerProxy(f"{odoo_url}/xmlrpc/2/common")
            uid = common.authenticate(odoo_db, odoo_username, odoo_password, {})
            
            if not uid:
                raise Exception("Odoo authentication failed")
            
            models = xmlrpc.client.ServerProxy(f"{odoo_url}/xmlrpc/2/object")
            
            # Sync Groups first
            groups_synced = await self._sync_groups(models, odoo_db, uid, odoo_password, org_id)
            
            # Sync Teams
            teams_synced = await self._sync_teams(models, odoo_db, uid, odoo_password, org_id)
            
            # Sync Users (with group and team memberships)
            users_synced = await self._sync_users(models, odoo_db, uid, odoo_password, org_id)
            
            return {
                "status": "success",
                "groups_synced": groups_synced,
                "teams_synced": teams_synced,
                "users_synced": users_synced,
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"RBAC sync failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _sync_groups(self, models, db, uid, password, org_id) -> int:
        """Sync res.groups from Odoo"""
        # Fetch groups related to Sales/CRM
        group_ids = models.execute_kw(
            db, uid, password,
            'res.groups', 'search',
            [[['category_id.name', 'in', ['Sales', 'CRM', 'Accounting', 'Administration']]]]
        )
        
        if not group_ids:
            # Get all groups if category filter returns nothing
            group_ids = models.execute_kw(
                db, uid, password,
                'res.groups', 'search',
                [[]],
                {'limit': 500}
            )
        
        groups = models.execute_kw(
            db, uid, password,
            'res.groups', 'read',
            [group_ids],
            {'fields': ['id', 'name', 'full_name', 'category_id', 'implied_ids', 'users']}
        )
        
        synced = 0
        for group in groups:
            doc = {
                "odoo_group_id": group['id'],
                "name": group.get('name', ''),
                "full_name": group.get('full_name', ''),
                "category": group.get('category_id', [None, ''])[1] if group.get('category_id') else '',
                "implied_group_ids": group.get('implied_ids', []),
                "user_count": len(group.get('users', [])),
                "org_id": org_id,
                "synced_at": datetime.now(timezone.utc)
            }
            
            await self.app_db.groups_rbac.update_one(
                {"odoo_group_id": group['id']},
                {"$set": doc},
                upsert=True
            )
            synced += 1
        
        logger.info(f"Synced {synced} groups from Odoo")
        return synced
    
    async def _sync_teams(self, models, db, uid, password, org_id) -> int:
        """Sync crm.team from Odoo"""
        try:
            team_ids = models.execute_kw(
                db, uid, password,
                'crm.team', 'search',
                [[]]
            )
            
            teams = models.execute_kw(
                db, uid, password,
                'crm.team', 'read',
                [team_ids],
                {'fields': ['id', 'name', 'user_id', 'member_ids', 'active']}
            )
            
            synced = 0
            for team in teams:
                doc = {
                    "odoo_team_id": team['id'],
                    "name": team.get('name', ''),
                    "leader_user_id": team.get('user_id', [None])[0] if team.get('user_id') else None,
                    "leader_name": team.get('user_id', [None, ''])[1] if team.get('user_id') else '',
                    "member_ids": team.get('member_ids', []),
                    "active": team.get('active', True),
                    "org_id": org_id,
                    "synced_at": datetime.now(timezone.utc)
                }
                
                await self.app_db.teams_rbac.update_one(
                    {"odoo_team_id": team['id']},
                    {"$set": doc},
                    upsert=True
                )
                synced += 1
            
            logger.info(f"Synced {synced} teams from Odoo")
            return synced
            
        except Exception as e:
            logger.warning(f"Team sync failed (may not have crm.team): {e}")
            return 0
    
    async def _sync_users(self, models, db, uid, password, org_id) -> int:
        """Sync res.users with group and team memberships"""
        # Get active users
        user_ids = models.execute_kw(
            db, uid, password,
            'res.users', 'search',
            [[['active', '=', True], ['share', '=', False]]]  # Internal users only
        )
        
        users = models.execute_kw(
            db, uid, password,
            'res.users', 'read',
            [user_ids],
            {'fields': ['id', 'name', 'login', 'email', 'groups_id', 'sale_team_ids', 'active', 'partner_id']}
        )
        
        # Build group name lookup
        group_lookup = {}
        async for g in self.app_db.groups_rbac.find({"org_id": org_id}):
            group_lookup[g['odoo_group_id']] = g.get('full_name') or g.get('name', '')
        
        # Build team name lookup
        team_lookup = {}
        async for t in self.app_db.teams_rbac.find({"org_id": org_id}):
            team_lookup[t['odoo_team_id']] = t.get('name', '')
        
        synced = 0
        for user in users:
            # Resolve group names
            group_ids = user.get('groups_id', [])
            group_names = [group_lookup.get(gid, f"group_{gid}") for gid in group_ids]
            
            # Resolve team names
            team_ids = user.get('sale_team_ids', [])
            team_names = [team_lookup.get(tid, f"team_{tid}") for tid in team_ids]
            
            doc = {
                "odoo_user_id": user['id'],
                "name": user.get('name', ''),
                "login": user.get('login', ''),
                "email": user.get('email', ''),
                "active": user.get('active', True),
                "odoo_group_ids": group_ids,
                "odoo_group_names": group_names,
                "odoo_team_ids": team_ids,
                "odoo_team_names": team_names,
                "partner_id": user.get('partner_id', [None])[0] if user.get('partner_id') else None,
                "org_id": org_id,
                "synced_at": datetime.now(timezone.utc)
            }
            
            await self.app_db.users_rbac.update_one(
                {"odoo_user_id": user['id']},
                {"$set": doc},
                upsert=True
            )
            synced += 1
        
        logger.info(f"Synced {synced} users from Odoo")
        return synced
    
    async def get_user_rbac(self, user_identifier: str, org_id: str = "default") -> Optional[Dict]:
        """Get RBAC metadata for a user
        
        Args:
            user_identifier: Can be name, login, or email
            org_id: Organization ID
            
        Returns:
            User RBAC document or None
        """
        return await self.app_db.users_rbac.find_one({
            "org_id": org_id,
            "$or": [
                {"name": {"$regex": f"^{user_identifier}$", "$options": "i"}},
                {"login": {"$regex": f"^{user_identifier}$", "$options": "i"}},
                {"email": {"$regex": f"^{user_identifier}$", "$options": "i"}}
            ]
        })
    
    async def link_app_user_to_odoo(
        self,
        app_user_id: str,
        odoo_user_id: int,
        org_id: str = "default"
    ) -> bool:
        """Link an Event Mesh user to their Odoo user account"""
        result = await self.app_db.users_rbac.update_one(
            {"odoo_user_id": odoo_user_id, "org_id": org_id},
            {"$set": {"app_user_id": app_user_id}}
        )
        return result.modified_count > 0


# Global singleton
odoo_user_sync = OdooUserSync()
