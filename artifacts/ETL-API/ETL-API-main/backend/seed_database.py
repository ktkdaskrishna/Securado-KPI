import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from auth.jwt import hash_password
import os
from dotenv import load_dotenv
from datetime import datetime
import uuid

load_dotenv()

async def seed_database():
    """Seed the database with initial data"""
    
    app_mongo_url = os.getenv("APP_MONGO_URL", "mongodb://localhost:27017")
    app_db_name = os.getenv("APP_DB_NAME", "platform2_app")
    
    client = AsyncIOMotorClient(app_mongo_url)
    db = client[app_db_name]
    
    print(f"Seeding database: {app_db_name}")
    
    # Create superadmin user (approved)
    existing_admin = await db.users.find_one({"email": "admin@platform2.com"})
    
    if not existing_admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@platform2.com",
            "name": "Super Admin",
            "password_hash": hash_password("admin123"),
            "status": "approved",
            "org_id": "default_org",
            "roles": ["admin", "superadmin"],
            "created_at": datetime.utcnow()
        }
        
        await db.users.insert_one(admin_user)
        print("✓ Created superadmin user: admin@platform2.com / admin123")
    else:
        print("✓ Superadmin user already exists")
    
    # Create sample pipeline stages
    stages = [
        {"id": str(uuid.uuid4()), "name": "Lead", "order": 1, "org_id": "default_org"},
        {"id": str(uuid.uuid4()), "name": "Qualified", "order": 2, "org_id": "default_org"},
        {"id": str(uuid.uuid4()), "name": "Proposal", "order": 3, "org_id": "default_org"},
        {"id": str(uuid.uuid4()), "name": "Negotiation", "order": 4, "org_id": "default_org"},
        {"id": str(uuid.uuid4()), "name": "Closed Won", "order": 5, "org_id": "default_org"},
        {"id": str(uuid.uuid4()), "name": "Closed Lost", "order": 6, "org_id": "default_org"}
    ]
    
    existing_stages = await db.pipeline_stages.count_documents({"org_id": "default_org"})
    if existing_stages == 0:
        await db.pipeline_stages.insert_many(stages)
        print("✓ Created pipeline stages")
    else:
        print("✓ Pipeline stages already exist")
    
    # Create sample roles
    roles = [
        {
            "id": str(uuid.uuid4()),
            "name": "admin",
            "description": "Administrator with full access",
            "permissions": ["*"],
            "org_id": "default_org"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "sales_manager",
            "description": "Sales Manager",
            "permissions": ["opportunities:*", "activities:*", "dashboard:read"],
            "org_id": "default_org"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "sales_rep",
            "description": "Sales Representative",
            "permissions": ["opportunities:read", "opportunities:update", "activities:*"],
            "org_id": "default_org"
        }
    ]
    
    existing_roles = await db.roles.count_documents({"org_id": "default_org"})
    if existing_roles == 0:
        await db.roles.insert_many(roles)
        print("✓ Created roles")
    else:
        print("✓ Roles already exist")
    
    print("\n=== Seed Complete ===")
    print("Superadmin credentials:")
    print("  Email: admin@platform2.com")
    print("  Password: admin123")
    print("\nYou can now start the server and log in!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
