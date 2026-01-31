"""Local Access Rules Engine

Defines how Odoo groups map to data filters in Event Mesh CRM.
This is the "local rules" part of the Hybrid RBAC approach.

Rule Hierarchy:
1. Admin groups → No filter (sees all)
2. Manager (with direct reports) → Direct reports' records + own records
3. Manager groups → Team-based filter
4. User groups → Own records only

Supported Odoo Groups (customize as needed):
- "Administration / Settings" → Admin (all access)
- "Sales / Administrator" → Admin (all access)
- "Sales / All Documents" → Admin (all access)
- "Sales / Manager" → Manager (team + direct reports access)
- "Sales / User: Own Documents Only" → User (own records)
- "Sales / User: All Documents" → User with expanded access

Reporting Hierarchy:
- Managers (users with direct reports in hr.employee) see their team's records
- The hierarchy is synced from Odoo's parent_id field on hr.employee
"""
import logging
from typing import Dict, List, Optional, Any
from enum import Enum

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class AccessLevel(Enum):
    """Access level hierarchy"""
    ADMIN = 100      # Full access to all records
    MANAGER = 50     # Access to team + direct reports records
    USER = 10        # Access to own records only
    RESTRICTED = 0   # No access


# Group patterns to access level mapping
# Order matters - first match wins
GROUP_ACCESS_RULES = [
    # Admin level - full access
    {"pattern": "Administration / Settings", "level": AccessLevel.ADMIN},
    {"pattern": "Administration / Access Rights", "level": AccessLevel.ADMIN},
    {"pattern": "Sales / Administrator", "level": AccessLevel.ADMIN},
    {"pattern": "Sales / All Documents", "level": AccessLevel.ADMIN},
    {"pattern": "CRM / Administrator", "level": AccessLevel.ADMIN},
    
    # Manager level - team + direct reports access
    {"pattern": "Sales / Manager", "level": AccessLevel.MANAGER},
    {"pattern": "CRM / Manager", "level": AccessLevel.MANAGER},
    
    # User level - own records
    {"pattern": "Sales / User", "level": AccessLevel.USER},
    {"pattern": "CRM / User", "level": AccessLevel.USER},
    {"pattern": "Sales / Own Documents Only", "level": AccessLevel.USER},
]


class AccessRuleEngine:
    """Compiles user permissions into MongoDB query filters"""
    
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
        logger.info("AccessRuleEngine initialized")
    
    async def initialize(self, app_db: AsyncIOMotorDatabase):
        """Initialize with database connection"""
        self.app_db = app_db
        logger.info("AccessRuleEngine connected to database")
    
    def determine_access_level(self, group_names: List[str]) -> AccessLevel:
        """Determine highest access level from user's group memberships
        
        Args:
            group_names: List of Odoo group full names
            
        Returns:
            Highest AccessLevel the user has
        """
        highest_level = AccessLevel.RESTRICTED
        
        for group_name in group_names:
            group_lower = group_name.lower()
            
            for rule in GROUP_ACCESS_RULES:
                if rule["pattern"].lower() in group_lower:
                    if rule["level"].value > highest_level.value:
                        highest_level = rule["level"]
                        # Continue checking for potentially higher level
        
        return highest_level
    
    async def get_filter_for_user(
        self,
        user_name: str,
        org_id: str = "default",
        entity_type: str = "opportunity"
    ) -> Dict[str, Any]:
        """Generate MongoDB filter based on user's permissions
        
        Args:
            user_name: User's name (as shown in owner_name field)
            org_id: Organization ID
            entity_type: Type of entity (opportunity, account, activity, etc.)
            
        Returns:
            MongoDB query filter dict
        """
        # First check for local permission override
        override = await self.app_db.permission_overrides.find_one({
            "org_id": org_id,
            "is_active": True,
            "$or": [
                {"user_email": {"$regex": f"^{user_name}@", "$options": "i"}},
                {"user_name": {"$regex": f"^{user_name}$", "$options": "i"}}
            ]
        })
        
        if override:
            # Check if not expired
            from datetime import datetime, timezone
            if not override.get("expires_at") or override["expires_at"] > datetime.now(timezone.utc):
                override_level = AccessLevel[override["access_level"]]
                logger.info(f"Using local override for {user_name}: {override_level.name}")
                
                if override_level == AccessLevel.ADMIN:
                    return {}
                elif override_level == AccessLevel.MANAGER:
                    # Get user's teams from RBAC or empty list
                    user_rbac = await self.app_db.users_rbac.find_one({
                        "org_id": org_id,
                        "$or": [
                            {"name": {"$regex": f"^{user_name}$", "$options": "i"}},
                            {"login": {"$regex": f"^{user_name}$", "$options": "i"}}
                        ]
                    })
                    team_names = user_rbac.get("odoo_team_names", []) if user_rbac else []
                    return self._build_team_filter(user_name, team_names, entity_type)
                elif override_level == AccessLevel.USER:
                    return self._build_owner_filter(user_name, entity_type)
                else:
                    return {"_id": {"$eq": "NO_ACCESS_RESTRICTED_BY_OVERRIDE"}}
        
        # Get user's RBAC metadata
        user_rbac = await self.app_db.users_rbac.find_one({
            "org_id": org_id,
            "$or": [
                {"name": {"$regex": f"^{user_name}$", "$options": "i"}},
                {"login": {"$regex": f"^{user_name}$", "$options": "i"}}
            ]
        })
        
        if not user_rbac:
            # Check if RBAC sync has been done at all for this org
            any_rbac_users = await self.app_db.users_rbac.count_documents({"org_id": org_id})
            
            if any_rbac_users == 0:
                # No RBAC sync has been performed yet - allow full access (grace period)
                logger.info(f"RBAC not synced yet for org {org_id} - allowing full access for {user_name}")
                return {}
            else:
                # RBAC is synced but this user is not in the list - NO ACCESS
                # This is a security control: users without Odoo RBAC profiles cannot see any data
                logger.warning(f"SECURITY: User '{user_name}' has no RBAC profile - denying data access")
                return {"_id": {"$eq": "NO_ACCESS_USER_NOT_IN_RBAC"}}  # Will match nothing
        
        group_names = user_rbac.get("odoo_group_names", [])
        team_ids = user_rbac.get("odoo_team_ids", [])
        team_names = user_rbac.get("odoo_team_names", [])
        
        access_level = self.determine_access_level(group_names)
        
        logger.debug(f"User {user_name} has access level: {access_level.name}")
        
        if access_level == AccessLevel.ADMIN:
            # Admin sees all records
            return {}
        
        elif access_level == AccessLevel.MANAGER:
            # Manager sees their team's records + their own
            return self._build_team_filter(user_name, team_names, entity_type)
        
        elif access_level == AccessLevel.USER:
            # User sees only their own records
            return self._build_owner_filter(user_name, entity_type)
        
        else:
            # Restricted - no access (empty result)
            return {"_id": None}  # Will match nothing
    
    def _build_owner_filter(self, user_name: str, entity_type: str) -> Dict:
        """Build filter for own records only"""
        if entity_type in ["opportunity", "lead"]:
            return {"owner_name": {"$regex": f"^{user_name}$", "$options": "i"}}
        elif entity_type == "activity":
            return {"assigned_to": {"$regex": f"^{user_name}$", "$options": "i"}}
        elif entity_type in ["account", "contact"]:
            # Accounts/contacts are typically shared, but can filter by salesperson
            return {"salesperson": {"$regex": f"^{user_name}$", "$options": "i"}}
        elif entity_type == "invoice":
            return {"salesperson": {"$regex": f"^{user_name}$", "$options": "i"}}
        else:
            return {"owner_name": {"$regex": f"^{user_name}$", "$options": "i"}}
    
    def _build_team_filter(self, user_name: str, team_names: List[str], entity_type: str) -> Dict:
        """Build filter for team records"""
        if entity_type in ["opportunity", "lead"]:
            if team_names:
                return {
                    "$or": [
                        {"owner_name": {"$regex": f"^{user_name}$", "$options": "i"}},
                        {"team_name": {"$in": team_names}}
                    ]
                }
            else:
                return {"owner_name": {"$regex": f"^{user_name}$", "$options": "i"}}
        else:
            # For other entities, fall back to owner filter
            return self._build_owner_filter(user_name, entity_type)
    
    async def get_user_access_summary(self, user_name: str, org_id: str = "default") -> Dict:
        """Get a summary of user's access permissions
        
        Useful for debugging and UI display
        """
        user_rbac = await self.app_db.users_rbac.find_one({
            "org_id": org_id,
            "$or": [
                {"name": {"$regex": f"^{user_name}$", "$options": "i"}},
                {"login": {"$regex": f"^{user_name}$", "$options": "i"}}
            ]
        })
        
        if not user_rbac:
            return {
                "user_name": user_name,
                "rbac_synced": False,
                "access_level": "RESTRICTED",
                "groups": [],
                "teams": [],
                "filter_type": "own_records_only"
            }
        
        group_names = user_rbac.get("odoo_group_names", [])
        team_names = user_rbac.get("odoo_team_names", [])
        access_level = self.determine_access_level(group_names)
        
        filter_type = {
            AccessLevel.ADMIN: "all_records",
            AccessLevel.MANAGER: "team_records",
            AccessLevel.USER: "own_records_only",
            AccessLevel.RESTRICTED: "no_access"
        }.get(access_level, "own_records_only")
        
        return {
            "user_name": user_name,
            "rbac_synced": True,
            "odoo_user_id": user_rbac.get("odoo_user_id"),
            "access_level": access_level.name,
            "groups": group_names,
            "teams": team_names,
            "filter_type": filter_type,
            "synced_at": user_rbac.get("synced_at").isoformat() if user_rbac.get("synced_at") else None
        }


# Global singleton
access_rule_engine = AccessRuleEngine()
