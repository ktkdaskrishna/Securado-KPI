"""CRM Sales Service - Split into separate modules for maintainability.

Modules:
- opportunities.py (1,089 lines) - Pipeline, kanban, bluesheet, stages
- leads.py (267 lines) - Lead management, conversion
- accounts.py (346 lines) - Account 360, contacts
- activities.py (409 lines) - Calls, meetings, demos, RBAC-filtered
- kpis.py (80 lines) - KPI CRUD
- receivables.py (385 lines) - Invoices, collection, stats
- helpers.py - Shared utilities (stage aliases, date filters)
"""

# Re-export all routers so server.py doesn't need changes
from services.crm_sales.opportunities import opportunities_router
from services.crm_sales.leads import leads_router
from services.crm_sales.accounts import accounts_router
from services.crm_sales.activities import activities_router
from services.crm_sales.kpis import kpis_router
from services.crm_sales.receivables import receivables_router

__all__ = [
    'opportunities_router', 'leads_router', 'accounts_router',
    'activities_router', 'kpis_router', 'receivables_router'
]
