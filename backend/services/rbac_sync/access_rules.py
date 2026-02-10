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
    {"pattern": "CRM / Sales Director", "level": AccessLevel.ADMIN},  # Directors have full access
    {"pattern": "Sales / User: All Documents", "level": AccessLevel.ADMIN},  # All Documents = full access
    {"pattern": "Accounting / Accountant", "level": AccessLevel.ADMIN},  # Accountants have full access to invoices
    
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
        entity_type: str = "opportunity",
        user_email: str = None
    ) -> Dict[str, Any]:
        """Generate MongoDB filter based on user's permissions"""
        import re as _re
        # Normalize whitespace in user_name (JWT may have stale data)
        user_name = _re.sub(r'\s+', ' ', user_name).strip()
        
        # CRITICAL: Resolve canonical Odoo name from employees by email
        # Keep both names (app name + Odoo name) for flexible matching
        canonical_name = user_name
        all_names = [user_name]
        if user_email:
            from libs.database import get_canonical_db
            c_db = get_canonical_db()
            emp = await c_db.employees.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}}, {"_id": 0, "name": 1})
            if emp and emp.get("name") and emp["name"] != user_name:
                canonical_name = emp["name"]
                all_names.append(canonical_name)
            su = await c_db.sales_users.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}}, {"_id": 0, "name": 1})
            if su and su.get("name") and su["name"] not in all_names:
                all_names.append(su["name"])
            # Also check opportunity owner_name for this user
            opp_name = await c_db.opportunities.find_one({"$or": [{"owner_name": {"$regex": f"^{n}$", "$options": "i"}} for n in all_names]}, {"_id": 0, "owner_name": 1})
            if opp_name and opp_name.get("owner_name") and opp_name["owner_name"] not in all_names:
                all_names.append(opp_name["owner_name"])
        
        # Build a regex that matches ANY of the user's known names
        name_pattern = "|".join([f"^{_re.escape(n)}$" for n in all_names])
        logger.info(f"RBAC names for {user_email}: {all_names}")
        
        # Use canonical name for product_manager lookups, pattern for owner_name lookups
        user_name = canonical_name
        
        # First check for local permission override
        override_query = {
            "org_id": org_id,
            "is_active": True,
            "$or": [
                {"user_name": {"$regex": f"^{user_name}$", "$options": "i"}}
            ]
        }
        # Add email-based override check if email provided
        if user_email:
            override_query["$or"].append({"user_email": {"$regex": f"^{user_email}$", "$options": "i"}})
        else:
            override_query["$or"].append({"user_email": {"$regex": f"^{user_name}@", "$options": "i"}})
        
        override = await self.app_db.permission_overrides.find_one(override_query)
        
        if override:
            # Check if not expired
            from datetime import datetime, timezone
            if not override.get("expires_at") or override["expires_at"] > datetime.now(timezone.utc):
                override_level = AccessLevel[override["access_level"]]
                logger.info(f"Using local override for {user_name}: {override_level.name}")
                
                if override_level == AccessLevel.ADMIN:
                    return {}
                elif override_level == AccessLevel.MANAGER:
                    # Get user's teams and direct reports from RBAC
                    user_rbac = await self.app_db.users_rbac.find_one({
                        "org_id": org_id,
                        "$or": [
                            {"name": {"$regex": f"^{user_name}$", "$options": "i"}},
                            {"login": {"$regex": f"^{user_name}$", "$options": "i"}}
                        ]
                    })
                    team_names = user_rbac.get("odoo_team_names", []) if user_rbac else []
                    direct_report_names = user_rbac.get("direct_report_names", []) if user_rbac else []
                    return self._build_manager_filter(user_name, team_names, direct_report_names, entity_type)
                elif override_level == AccessLevel.USER:
                    return self._build_owner_filter(user_name, entity_type, name_pattern=name_pattern)
                else:
                    return {"_id": {"$eq": "NO_ACCESS_RESTRICTED_BY_OVERRIDE"}}
        
        # Get user's RBAC metadata - search by email (most reliable), name, or login
        rbac_query = {
            "org_id": org_id,
            "$or": [
                {"name": {"$regex": f"^{user_name}$", "$options": "i"}},
                {"login": {"$regex": f"^{user_name}$", "$options": "i"}}
            ]
        }
        # Add email-based RBAC lookup if email provided (most reliable match)
        if user_email:
            rbac_query["$or"].insert(0, {"email": {"$regex": f"^{user_email}$", "$options": "i"}})
        
        user_rbac = await self.app_db.users_rbac.find_one(rbac_query)
        
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
        direct_report_names = user_rbac.get("direct_report_names", [])
        is_manager = user_rbac.get("is_manager", False)
        
        access_level = self.determine_access_level(group_names)
        
        # IMPORTANT: If user has direct reports, they are effectively a manager
        # even if their Odoo groups don't include "Manager"
        if is_manager and access_level.value < AccessLevel.MANAGER.value:
            logger.info(f"User {user_name} has {len(direct_report_names)} direct reports - upgrading to MANAGER access")
            access_level = AccessLevel.MANAGER
        
        # Check if user is a Product Director - they should see only their product data
        # even if Odoo grants them admin-level group access
        if user_email:
            app_user = await self.app_db.users.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}})
            app_roles = app_user.get("roles", []) if app_user else []
            
            if "product_director" in app_roles or "product_manager" in app_roles:
                # Use the canonical name from DB (not JWT which might have stale data)
                db_name = app_user.get("name", user_name) if app_user else user_name
                # Normalize whitespace for matching
                import re
                normalized_name = re.sub(r'\s+', ' ', db_name).strip()
                
                logger.info(f"User {normalized_name} is Product Director - applying product_manager filter")
                if entity_type in ["opportunity", "lead"]:
                    return {"product_manager": {"$regex": f"^{normalized_name}$", "$options": "i"}}
                elif entity_type == "activity":
                    # PD sees activities linked to their opportunities
                    from libs.database import get_canonical_db
                    c_db = get_canonical_db()
                    opp_ids = await c_db.opportunities.distinct(
                        "canonical_id", {"product_manager": {"$regex": f"^{normalized_name}$", "$options": "i"}}
                    )
                    return {"opportunity_id": {"$in": opp_ids}} if opp_ids else {}
                elif entity_type == "invoice":
                    # PD sees invoices for accounts in their product scope
                    from libs.database import get_canonical_db
                    c_db = get_canonical_db()
                    acct_names = await c_db.opportunities.distinct(
                        "account_name", {"product_manager": {"$regex": f"^{normalized_name}$", "$options": "i"}}
                    )
                    acct_names = [a for a in acct_names if a]
                    return {"account_name": {"$in": acct_names}} if acct_names else {}
                else:
                    return {}  # PDs see all accounts
        
        logger.debug(f"User {user_name} has access level: {access_level.name}")
        
        if access_level == AccessLevel.ADMIN:
            # Admin sees all records
            return {}
        
        elif access_level == AccessLevel.MANAGER:
            # Manager sees their team's records + direct reports' records + their own
            return self._build_manager_filter(user_name, team_names, direct_report_names, entity_type)
        
        elif access_level == AccessLevel.USER:
            # User sees only their own records
            return self._build_owner_filter(user_name, entity_type, name_pattern=name_pattern)
        
        else:
            # Restricted - no access (empty result)
            return {"_id": None}  # Will match nothing
    
    def _build_owner_filter(self, user_name: str, entity_type: str, user_email: str = None, name_pattern: str = None) -> Dict:
        """Build filter for own records only. Uses name_pattern for OR matching multiple name variants."""
        pat = name_pattern or f"^{user_name}$"
        if entity_type in ["opportunity", "lead"]:
            return {"owner_name": {"$regex": pat, "$options": "i"}}
        elif entity_type == "activity":
            return {"$or": [{"assigned_user": {"$regex": pat, "$options": "i"}}, {"owner_name": {"$regex": pat, "$options": "i"}}]}
        elif entity_type in ["account", "contact"]:
            return {"owner_name": {"$regex": pat, "$options": "i"}}
        elif entity_type == "invoice":
            return {"$or": [{"salesperson": {"$regex": pat, "$options": "i"}}, {"owner_name": {"$regex": pat, "$options": "i"}}]}
        else:
            return {"owner_name": {"$regex": pat, "$options": "i"}}
    
    def _build_manager_filter(
        self, 
        user_name: str, 
        team_names: List[str], 
        direct_report_names: List[str],
        entity_type: str
    ) -> Dict:
        """Build filter for manager - includes own + team + direct reports records
        
        A manager can see:
        1. Their own records (owner_name = user)
        2. Their team's records (team_name in their teams)
        3. Their direct reports' records (owner_name in direct_report_names)
        """
        or_conditions = []
        
        # Always include own records
        or_conditions.append({"owner_name": {"$regex": f"^{user_name}$", "$options": "i"}})
        
        # Include team records
        if team_names:
            or_conditions.append({"team_name": {"$in": team_names}})
        
        # Include direct reports' records
        if direct_report_names:
            # Build regex patterns for each direct report
            report_patterns = [f"^{name}$" for name in direct_report_names]
            or_conditions.append({
                "owner_name": {"$regex": "|".join(report_patterns), "$options": "i"}
            })
        
        if entity_type in ["opportunity", "lead"]:
            return {"$or": or_conditions}
        elif entity_type == "activity":
            # For activities, also check assigned_to
            activity_conditions = [
                {"assigned_to": {"$regex": f"^{user_name}$", "$options": "i"}}
            ]
            if direct_report_names:
                report_patterns = [f"^{name}$" for name in direct_report_names]
                activity_conditions.append({
                    "assigned_to": {"$regex": "|".join(report_patterns), "$options": "i"}
                })
            return {"$or": activity_conditions}
        elif entity_type in ["account", "invoice"]:
            # For accounts/invoices, use salesperson field
            account_conditions = [
                {"salesperson": {"$regex": f"^{user_name}$", "$options": "i"}}
            ]
            if direct_report_names:
                report_patterns = [f"^{name}$" for name in direct_report_names]
                account_conditions.append({
                    "salesperson": {"$regex": "|".join(report_patterns), "$options": "i"}
                })
            return {"$or": account_conditions}
        else:
            return {"$or": or_conditions}
    
    def _build_team_filter(self, user_name: str, team_names: List[str], entity_type: str) -> Dict:
        """Build filter for team records (legacy - now use _build_manager_filter)"""
        return self._build_manager_filter(user_name, team_names, [], entity_type)
    
    async def get_user_access_summary(self, user_name: str, org_id: str = "default", user_email: str = None) -> Dict:
        """Get a summary of user's access permissions
        
        Useful for debugging and UI display
        """
        # Build RBAC query - email is most reliable
        rbac_query = {
            "org_id": org_id,
            "$or": [
                {"name": {"$regex": f"^{user_name}$", "$options": "i"}},
                {"login": {"$regex": f"^{user_name}$", "$options": "i"}}
            ]
        }
        if user_email:
            rbac_query["$or"].insert(0, {"email": {"$regex": f"^{user_email}$", "$options": "i"}})
        
        user_rbac = await self.app_db.users_rbac.find_one(rbac_query)
        
        if not user_rbac:
            return {
                "user_name": user_name,
                "user_email": user_email,
                "rbac_synced": False,
                "access_level": "RESTRICTED",
                "groups": [],
                "teams": [],
                "direct_reports": [],
                "is_manager": False,
                "filter_type": "no_access"
            }
        
        group_names = user_rbac.get("odoo_group_names", [])
        team_names = user_rbac.get("odoo_team_names", [])
        direct_report_names = user_rbac.get("direct_report_names", [])
        is_manager = user_rbac.get("is_manager", False)
        
        access_level = self.determine_access_level(group_names)
        
        # Upgrade to MANAGER if user has direct reports
        if is_manager and access_level.value < AccessLevel.MANAGER.value:
            access_level = AccessLevel.MANAGER
        
        filter_type = {
            AccessLevel.ADMIN: "all_records",
            AccessLevel.MANAGER: "team_and_direct_reports",
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
            "direct_reports": direct_report_names,
            "direct_report_count": len(direct_report_names),
            "is_manager": is_manager,
            "manager_name": user_rbac.get("manager_name", ""),
            "department": user_rbac.get("department_name", ""),
            "job_title": user_rbac.get("job_title", ""),
            "filter_type": filter_type,
            "synced_at": user_rbac.get("synced_at").isoformat() if user_rbac.get("synced_at") else None
        }


# Global singleton
access_rule_engine = AccessRuleEngine()
