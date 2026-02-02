"""
Script to create test users for different roles and fix RBAC issues

Test Users:
1. Sales User - sales@test.securado.com
2. Sales Director - sales.director@test.securado.com  
3. Product Director - product.director@test.securado.com
4. Presales (Product Specific Solution Team) - presales@test.securado.com
5. Finance Manager - finance@test.securado.com
6. Admin (fix krishna) - krishna@securado.net

Run: cd /app/backend && python scripts/create_test_users.py
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from libs.utils import generate_id, hash_password, now_utc


async def create_test_users():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    
    app_db = client['event_mesh_app']
    canonical_db = client['event_mesh_canonical']
    
    org_id = "default"
    
    # Define test users with their roles and permissions
    test_users = [
        {
            "email": "sales@test.securado.com",
            "name": "Test Sales User",
            "password": "test123456",
            "app_roles": ["sales_user_own"],
            "odoo_group_names": ["Sales / User: Own Documents Only"],
            "effective_permissions": [
                "view_dashboard", "view_opportunities", "manage_opportunities", 
                "update_stage", "view_accounts", "view_activities", "manage_activities", "view_goals"
            ],
            "record_access": "own",
            "field_access": "standard"
        },
        {
            "email": "sales.director@test.securado.com",
            "name": "Test Sales Director",
            "password": "test123456",
            "app_roles": ["sales_director"],
            "odoo_group_names": ["CRM / Sales Director", "Sales / User: All Documents"],
            "effective_permissions": [
                "view_dashboard", "manage_dashboard", "view_opportunities", "manage_opportunities",
                "update_stage", "update_probability", "view_accounts", "manage_accounts",
                "view_activities", "manage_activities", "view_goals", "manage_goals",
                "view_teams", "manage_teams", "view_kpis", "manage_kpis", "view_users",
                "view_invoices", "manage_invoices", "view_analytics", "manage_analytics"
            ],
            "record_access": "all",
            "field_access": "all"
        },
        {
            "email": "product.director@test.securado.com",
            "name": "Test Product Director",
            "password": "test123456",
            "app_roles": ["sales_director", "product_manager"],
            "odoo_group_names": ["CRM / Sales Director", "Sales / User: All Documents"],
            "effective_permissions": [
                "view_dashboard", "manage_dashboard", "view_opportunities", "manage_opportunities",
                "update_stage", "update_probability", "view_accounts", "manage_accounts",
                "view_activities", "manage_activities", "view_goals", "manage_goals",
                "view_teams", "manage_teams", "view_kpis", "manage_kpis", "view_users",
                "view_invoices", "manage_invoices", "view_analytics", "manage_analytics"
            ],
            "record_access": "all",
            "field_access": "all"
        },
        {
            "email": "presales@test.securado.com",
            "name": "Test Presales Engineer",
            "password": "test123456",
            "app_roles": ["sales_user_all"],
            "odoo_group_names": ["Sales / User: All Documents", "Sales / Non sales / CRM  Readonly"],
            "effective_permissions": [
                "view_dashboard", "view_opportunities", "manage_opportunities", "update_stage",
                "view_accounts", "manage_accounts", "view_activities", "manage_activities",
                "view_goals", "view_invoices", "view_analytics"
            ],
            "record_access": "all",
            "field_access": "standard"
        },
        {
            "email": "finance@test.securado.com",
            "name": "Test Finance Manager",
            "password": "test123456",
            "app_roles": ["accountant", "billing"],
            "odoo_group_names": ["Accounting / Accountant", "Administration / Settings"],
            "effective_permissions": [
                "view_dashboard", "view_invoices", "manage_invoices", "view_accounts", "view_analytics"
            ],
            "record_access": "all",
            "field_access": "all"
        }
    ]
    
    print("=" * 60)
    print("Creating Test Users")
    print("=" * 60)
    
    for user_data in test_users:
        email = user_data["email"]
        print(f"\n📝 Creating: {user_data['name']} ({email})")
        
        # Check if user exists in app.users
        existing = await app_db.users.find_one({"email": email})
        if existing:
            print(f"   User already exists in app.users, updating...")
            await app_db.users.update_one(
                {"email": email},
                {"$set": {
                    "name": user_data["name"],
                    "status": "approved",
                    "roles": user_data["app_roles"],
                    "updated_at": now_utc()
                }}
            )
        else:
            user_doc = {
                "id": generate_id(),
                "email": email,
                "name": user_data["name"],
                "password_hash": hash_password(user_data["password"]),
                "status": "approved",
                "org_id": org_id,
                "roles": user_data["app_roles"],
                "permissions": [],
                "created_at": now_utc()
            }
            await app_db.users.insert_one(user_doc)
            print(f"   ✅ Created in app.users")
        
        # Create/update in users_rbac
        rbac_doc = {
            "email": email,
            "name": user_data["name"],
            "login": email.split("@")[0],
            "odoo_group_names": user_data["odoo_group_names"],
            "odoo_team_names": [],
            "direct_report_names": [],
            "is_manager": "director" in email or "finance" in email,
            "org_id": org_id,
            "synced_at": now_utc()
        }
        await app_db.users_rbac.update_one(
            {"email": email, "org_id": org_id},
            {"$set": rbac_doc},
            upsert=True
        )
        print(f"   ✅ Created/updated in users_rbac")
        
        # Create/update in canonical.sales_users
        sales_user_doc = {
            "email": email,
            "name": user_data["name"],
            "login": email.split("@")[0],
            "app_roles": user_data["app_roles"],
            "effective_permissions": user_data["effective_permissions"],
            "record_access": user_data["record_access"],
            "field_access": user_data["field_access"],
            "active": True,
            "org_id": org_id,
            "updated_at": now_utc()
        }
        await canonical_db.sales_users.update_one(
            {"email": email, "org_id": org_id},
            {"$set": sales_user_doc},
            upsert=True
        )
        print(f"   ✅ Created/updated in canonical.sales_users")
    
    # Fix Krishna's admin access
    print("\n" + "=" * 60)
    print("Fixing Admin Access for krishna@securado.net")
    print("=" * 60)
    
    krishna_email = "krishna@securado.net"
    
    # Add to users_rbac with admin groups
    krishna_rbac = {
        "email": krishna_email,
        "name": "Krishnadas KT",
        "login": "krishna",
        "odoo_group_names": [
            "Administration / Settings",
            "Administration / Access Rights",
            "Sales / Administrator",
            "Sales / User: All Documents",
            "CRM / Sales Director"
        ],
        "odoo_team_names": [],
        "direct_report_names": [],
        "is_manager": True,
        "org_id": org_id,
        "synced_at": now_utc()
    }
    await app_db.users_rbac.update_one(
        {"email": krishna_email, "org_id": org_id},
        {"$set": krishna_rbac},
        upsert=True
    )
    print(f"✅ Added krishna to users_rbac with admin groups")
    
    # Add to canonical.sales_users with full permissions
    krishna_sales = {
        "email": krishna_email,
        "name": "Krishnadas KT",
        "login": "krishna",
        "app_roles": ["admin", "sales_admin"],
        "effective_permissions": [
            "view_dashboard", "manage_dashboard",
            "view_opportunities", "manage_opportunities", "update_stage", "update_probability", "delete_opportunities",
            "view_accounts", "manage_accounts", "delete_accounts",
            "view_activities", "manage_activities", "delete_activities",
            "view_goals", "manage_goals", "delete_goals",
            "view_teams", "manage_teams", "delete_teams",
            "view_kpis", "manage_kpis",
            "view_users", "manage_users",
            "view_invoices", "manage_invoices",
            "view_analytics", "manage_analytics",
            "admin:*"
        ],
        "record_access": "all",
        "field_access": "all",
        "active": True,
        "org_id": org_id,
        "updated_at": now_utc()
    }
    await canonical_db.sales_users.update_one(
        {"email": krishna_email, "org_id": org_id},
        {"$set": krishna_sales},
        upsert=True
    )
    print(f"✅ Added krishna to canonical.sales_users with full permissions")
    
    # Update app.users to ensure admin role
    await app_db.users.update_one(
        {"email": krishna_email},
        {"$set": {"roles": ["admin", "sales_admin"], "updated_at": now_utc()}}
    )
    print(f"✅ Updated krishna's roles in app.users")
    
    print("\n" + "=" * 60)
    print("Summary of Test Users Created")
    print("=" * 60)
    print("\n📋 Test User Credentials:")
    print("-" * 40)
    for user in test_users:
        print(f"Email: {user['email']}")
        print(f"Password: {user['password']}")
        print(f"Roles: {', '.join(user['app_roles'])}")
        print(f"Record Access: {user['record_access']}")
        print("-" * 40)
    
    print("\n✅ Admin Fixed:")
    print(f"Email: {krishna_email}")
    print("Now has full admin access including invoice viewing")
    
    print("\n🔔 IMPORTANT:")
    print("- Restart the backend service to apply changes")
    print("- Clear browser cache and re-login to test")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(create_test_users())
