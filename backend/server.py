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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("Starting Event Mesh CRM Platform...")
    
    # Connect to database
    await db_manager.connect()
    
    # Initialize event bus
    await event_bus.initialize(db_manager.app_db)
    
    # Start ETL runner
    await etl_runner.start()
    
    # Start dashboard aggregator
    await dashboard_aggregator.start()
    
    logger.info("Event Mesh CRM Platform started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Event Mesh CRM Platform...")
    
    await dashboard_aggregator.stop()
    await etl_runner.stop()
    await event_bus.shutdown()
    await db_manager.disconnect()
    
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# Health check
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "event-mesh-crm",
        "version": "1.0.0",
        "components": {
            "database": "connected" if db_manager.app_db is not None else "disconnected",
            "event_bus": "running" if event_bus._running else "stopped",
            "etl_runner": "running" if etl_runner.running else "stopped"
        }
    }


# Include all service routers under /api prefix

# Authentication
app.include_router(auth_router, prefix="/api")

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
