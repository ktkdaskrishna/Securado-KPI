from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import database and scheduler
from core.database import db_manager
from scheduler.jobs import start_scheduler, stop_scheduler

# Import routers
from auth.routes import router as auth_router
from data_lake.routes import router as data_lake_router
from sales.routes import router as opportunities_router, activities_router
from sales.extended_routes import (
    accounts_router, kpis_router, receivables_router, 
    invoices_router, sales_metrics_router, search_router
)
from dashboard.routes import router as dashboard_router
from admin.routes import router as admin_router
from config.routes import router as config_router
from goals.routes import (
    goals_router, teams_router, portfolios_router, initiatives_router
)

# Create FastAPI app
app = FastAPI(
    title="Platform 2 - Sales Dashboard Backend",
    description="Backend API for Sales Dashboard / CRM application",
    version="1.0.0"
)

# Create API router with /api prefix
api_router = APIRouter(prefix="/api")

# Health check endpoint (no auth required)
@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Platform 2 Backend",
        "version": "1.0.0"
    }

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(data_lake_router)
api_router.include_router(opportunities_router)
api_router.include_router(activities_router)
api_router.include_router(accounts_router)
api_router.include_router(kpis_router)
api_router.include_router(receivables_router)
api_router.include_router(invoices_router)
api_router.include_router(sales_metrics_router)
api_router.include_router(search_router)
api_router.include_router(dashboard_router)
api_router.include_router(admin_router)
api_router.include_router(config_router)
api_router.include_router(goals_router)
api_router.include_router(teams_router)
api_router.include_router(portfolios_router)
api_router.include_router(initiatives_router)

# Include API router in main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("Starting Platform 2 Backend...")
    
    # Connect to databases
    await db_manager.connect()
    
    # Start scheduler
    start_scheduler()
    
    logger.info("Platform 2 Backend started successfully")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Platform 2 Backend...")
    
    # Stop scheduler
    stop_scheduler()
    
    # Disconnect from databases
    await db_manager.disconnect()
    
    logger.info("Platform 2 Backend shut down successfully")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
