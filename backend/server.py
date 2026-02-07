"""
Event Mesh CRM - Unified Microservices Platform

A unified system combining:
- Platform 1 (ETL/ESIP): ETL features (connections → schema → mapping → pipelines → runs)
- Platform 2: CRM backend (admin, RBAC, configs, dashboards, goals)  
- Platform 3: CRM frontend support (opportunities, accounts, activities, KPIs)

Architecture:
- Microservices as modular FastAPI routers
- In-memory event bus with MongoDB persistence (Kafka-compatible patterns)
- Canonical MongoDB (ETL output) + App MongoDB (users, RBAC, configs, overrides)
- SSE for real-time run lifecycle updates

API Routes:
- /api/auth/* - Authentication (register, login, refresh, me)
- /api/admin/* - User management, RBAC, departments
- /api/config/* - System and user configuration
- /api/integrations/* - Data source connections
- /api/mappings/* - Field mappings for ETL
- /api/pipelines/* - ETL pipeline definitions
- /api/runs/* - Pipeline run history
- /api/data-lake/* - Canonical data browsing
- /api/search - Cross-entity search
- /api/dashboard/* - Aggregated statistics
- /api/opportunities/* - CRM opportunities with overrides
- /api/accounts/* - Account management with 360 view
- /api/activities/* - Activity tracking
- /api/goals/* - Goal management
- /api/teams/* - Team management
- /api/portfolios/* - Portfolio management
- /api/initiatives/* - Initiative tracking
- /api/kpis/* - KPI monitoring
- /api/receivables/* - Receivables
- /api/events/* - SSE streaming and event history
- /api/dlq/* - Dead Letter Queue management
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import libs
from libs.database import db_manager
from libs.event_bus import event_bus

# Import service routes
from services.identity.routes import router as auth_router, admin_router as identity_admin_router
from services.rbac.routes import router as rbac_router
from services.config.routes import router as config_router
from services.etl_control.routes import (
    connections_router, 
    mappings_router, 
    pipelines_router,
    runs_router,
    templates_router,
    data_model_router,
    mapping_editor_router
)
from services.etl_runner.runner import etl_runner
from services.serving_cache.cache_builder import cache_builder
from services.serving_cache.cache_reader import cache_reader
from services.serving_cache.routes import router as serving_cache_router
from services.canonical_query.routes import router as canonical_router, search_router
from services.crm_sales.routes import (
    opportunities_router,
    leads_router,
    accounts_router,
    activities_router,
    kpis_router,
    receivables_router
)
from services.crm_goals.routes import (
    goals_router,
    teams_router,
    portfolios_router,
    initiatives_router
)
from services.dashboard_agg.routes import router as dashboard_router, dashboard_aggregator
from services.event_gateway.routes import router as events_router, dlq_router
from services.ai_analytics.routes import router as analytics_router
from services.odoo_rbac.routes import router as odoo_rbac_router, webhook_router
from services.data_integrity.routes import router as data_integrity_router
from services.event_queue.queue_service import event_queue_service
from services.event_queue.worker import event_worker
from services.rbac_sync.routes import router as rbac_sync_router
from services.rbac_sync.user_sync import odoo_user_sync
from services.rbac_sync.access_rules import access_rule_engine
from services.microsoft_auth.routes import router as microsoft_auth_router
from services.target_management.routes import (
    sales_targets_router,
    activity_targets_router,
    incentive_plans_router,
    target_sheets_router,
    incentive_calc_router
)
from services.target_management.planning import (
    lookups_router as target_lookups_router,
    plans_router as target_plans_router,
    actuals_router as target_actuals_router
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("Starting Event Mesh CRM Platform...")
    
    try:
        # Connect to database
        await db_manager.connect()
    except Exception as e:
        logger.error(f"Database connection failed during startup: {e}")
        # Continue - allow app to start even if DB is unavailable
    
    try:
        # Initialize event bus
        await event_bus.initialize(db_manager.app_db)
    except Exception as e:
        logger.error(f"Event bus initialization failed: {e}")
    
    try:
        # Initialize event queue service
        await event_queue_service.initialize(db_manager.app_db)
    except Exception as e:
        logger.error(f"Event queue service initialization failed: {e}")
    
    try:
        # Initialize and start event worker
        await event_worker.initialize(db_manager.app_db, db_manager.canonical_db)
        await event_worker.start()
    except Exception as e:
        logger.error(f"Event worker start failed: {e}")
    
    try:
        # Initialize serving cache
        await cache_builder.initialize(db_manager.app_db, db_manager.canonical_db)
        await cache_reader.initialize(db_manager.app_db)
    except Exception as e:
        logger.error(f"Serving cache initialization failed: {e}")
    
    try:
        # Initialize RBAC sync services
        await odoo_user_sync.initialize(db_manager.app_db)
        await access_rule_engine.initialize(db_manager.app_db)
        logger.info("RBAC sync services initialized")
    except Exception as e:
        logger.error(f"RBAC sync services initialization failed: {e}")
    
    try:
        # Start ETL runner
        await etl_runner.start()
    except Exception as e:
        logger.error(f"ETL runner start failed: {e}")
    
    try:
        # Start dashboard aggregator
        await dashboard_aggregator.start()
    except Exception as e:
        logger.error(f"Dashboard aggregator start failed: {e}")
    
    logger.info("Event Mesh CRM Platform started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Event Mesh CRM Platform...")
    
    try:
        await dashboard_aggregator.stop()
    except Exception as e:
        logger.error(f"Dashboard aggregator stop failed: {e}")
    
    try:
        await etl_runner.stop()
    except Exception as e:
        logger.error(f"ETL runner stop failed: {e}")
    
    try:
        await event_worker.stop()
    except Exception as e:
        logger.error(f"Event worker stop failed: {e}")
    
    try:
        await event_queue_service.shutdown()
    except Exception as e:
        logger.error(f"Event queue service shutdown failed: {e}")
    
    try:
        await event_bus.shutdown()
    except Exception as e:
        logger.error(f"Event bus shutdown failed: {e}")
    
    try:
        await db_manager.disconnect()
    except Exception as e:
        logger.error(f"Database disconnect failed: {e}")
    
    logger.info("Event Mesh CRM Platform shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Event Mesh CRM",
    description="Unified Microservices Platform for ETL and CRM",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
cors_origins = os.environ.get("CORS_ORIGINS", "*")
# Parse CORS origins - support comma-separated values or wildcard
parsed_origins = cors_origins.split(",") if cors_origins != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=parsed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__}
    )


# Health check endpoints
@app.get("/health")
async def root_health_check():
    """Root health check endpoint for Kubernetes/deployment"""
    return {"status": "ok"}


@app.get("/api/health")
async def health_check():
    """Detailed health check endpoint"""
    return {
        "status": "healthy",
        "service": "event-mesh-crm",
        "version": "1.0.0",
        "components": {
            "database": "connected" if db_manager.app_db is not None else "disconnected",
            "event_bus": "running" if event_bus._running else "stopped",
            "event_queue": "running" if event_queue_service._running else "stopped",
            "event_worker": "running" if event_worker._running else "stopped",
            "etl_runner": "running" if etl_runner.running else "stopped"
        }
    }


# Include all service routers under /api prefix

# Authentication
app.include_router(auth_router, prefix="/api")
app.include_router(microsoft_auth_router, prefix="/api")

# Admin & RBAC
app.include_router(identity_admin_router, prefix="/api")
app.include_router(rbac_router, prefix="/api")

# Configuration
app.include_router(config_router, prefix="/api")

# ETL Control
app.include_router(connections_router, prefix="/api")
app.include_router(mappings_router, prefix="/api")
app.include_router(pipelines_router, prefix="/api")
app.include_router(runs_router, prefix="/api")
app.include_router(templates_router, prefix="/api")
app.include_router(data_model_router, prefix="/api")
app.include_router(mapping_editor_router, prefix="/api")

# Data Integrity & Quality
app.include_router(data_integrity_router, prefix="/api/admin")

# Serving Cache (Single Source of Truth)
app.include_router(serving_cache_router, prefix="/api")

# Canonical/Data Lake
app.include_router(canonical_router, prefix="/api")
app.include_router(search_router, prefix="/api")

# CRM Sales
app.include_router(opportunities_router, prefix="/api")
app.include_router(leads_router, prefix="/api")
app.include_router(accounts_router, prefix="/api")
app.include_router(activities_router, prefix="/api")
app.include_router(kpis_router, prefix="/api")
app.include_router(receivables_router, prefix="/api")

# CRM Goals
app.include_router(goals_router, prefix="/api")
app.include_router(teams_router, prefix="/api")
app.include_router(portfolios_router, prefix="/api")
app.include_router(initiatives_router, prefix="/api")

# Dashboard
app.include_router(dashboard_router, prefix="/api")

# AI Analytics
app.include_router(analytics_router, prefix="/api")

# Events & DLQ
app.include_router(events_router, prefix="/api")
app.include_router(dlq_router, prefix="/api")

# Odoo RBAC & Webhooks
app.include_router(odoo_rbac_router, prefix="/api")
app.include_router(webhook_router, prefix="/api")

# RBAC Sync (Hybrid RBAC Implementation)
app.include_router(rbac_sync_router, prefix="/api")

# Target Management
app.include_router(sales_targets_router, prefix="/api")
app.include_router(activity_targets_router, prefix="/api")
app.include_router(incentive_plans_router, prefix="/api")
app.include_router(target_sheets_router, prefix="/api")
app.include_router(incentive_calc_router, prefix="/api")

# Target Planning (Analytics-driven)
app.include_router(target_lookups_router, prefix="/api")
app.include_router(target_plans_router, prefix="/api")
app.include_router(target_actuals_router, prefix="/api")


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Event Mesh CRM",
        "description": "Unified Microservices Platform for ETL and CRM",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
