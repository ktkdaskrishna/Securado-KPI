"""RBAC Middleware - Applies row-level security to API requests

This middleware can be used to automatically inject RBAC filters
into API requests based on the authenticated user's permissions.

Usage in routes:
    @router.get("/opportunities")
    async def list_opportunities(
        current_user: dict = Depends(get_current_user),
        rbac_filter: dict = Depends(get_rbac_filter)
    ):
        # rbac_filter is automatically computed based on user's permissions
        query = {**base_query, **rbac_filter}
        return await db.opportunities.find(query).to_list(100)
"""
import logging
from typing import Dict, Any, Optional
from functools import lru_cache

from fastapi import Depends, Request

from services.identity.routes import get_current_user
from .access_rules import access_rule_engine

logger = logging.getLogger(__name__)


async def get_rbac_filter(
    request: Request,
    current_user: dict = Depends(get_current_user),
    entity_type: str = "opportunity"
) -> Dict[str, Any]:
    """Dependency that returns RBAC filter for current user
    
    Args:
        request: FastAPI request object
        current_user: Authenticated user from JWT
        entity_type: Type of entity being queried
        
    Returns:
        MongoDB query filter dict
    """
    # Check if RBAC is enabled (can be toggled via header for testing)
    if request.headers.get("X-Disable-RBAC") == "true":
        logger.warning("RBAC disabled via header - allowing full access")
        return {}
    
    user_name = current_user.get("name") or current_user.get("email", "").split("@")[0]
    org_id = current_user.get("org_id", "default")
    
    # Get entity type from query params or path
    # This allows the filter to adapt based on what's being queried
    path = request.url.path
    if "/opportunities" in path or "/leads" in path:
        entity_type = "opportunity"
    elif "/accounts" in path or "/contacts" in path:
        entity_type = "account"
    elif "/activities" in path:
        entity_type = "activity"
    elif "/receivables" in path or "/invoices" in path:
        entity_type = "invoice"
    
    rbac_filter = await access_rule_engine.get_filter_for_user(
        user_name=user_name,
        org_id=org_id,
        entity_type=entity_type
    )
    
    logger.debug(f"RBAC filter for {user_name} on {entity_type}: {rbac_filter}")
    
    return rbac_filter


class RBACFilterFactory:
    """Factory for creating entity-specific RBAC filter dependencies"""
    
    @staticmethod
    def for_opportunities():
        """Get RBAC filter for opportunities"""
        async def _filter(
            request: Request,
            current_user: dict = Depends(get_current_user)
        ) -> Dict:
            return await get_rbac_filter(request, current_user, "opportunity")
        return _filter
    
    @staticmethod
    def for_accounts():
        """Get RBAC filter for accounts"""
        async def _filter(
            request: Request,
            current_user: dict = Depends(get_current_user)
        ) -> Dict:
            return await get_rbac_filter(request, current_user, "account")
        return _filter
    
    @staticmethod
    def for_activities():
        """Get RBAC filter for activities"""
        async def _filter(
            request: Request,
            current_user: dict = Depends(get_current_user)
        ) -> Dict:
            return await get_rbac_filter(request, current_user, "activity")
        return _filter
    
    @staticmethod
    def for_invoices():
        """Get RBAC filter for invoices"""
        async def _filter(
            request: Request,
            current_user: dict = Depends(get_current_user)
        ) -> Dict:
            return await get_rbac_filter(request, current_user, "invoice")
        return _filter


# Pre-built filter dependencies for common use cases
get_opportunity_rbac_filter = RBACFilterFactory.for_opportunities()
get_account_rbac_filter = RBACFilterFactory.for_accounts()
get_activity_rbac_filter = RBACFilterFactory.for_activities()
get_invoice_rbac_filter = RBACFilterFactory.for_invoices()
