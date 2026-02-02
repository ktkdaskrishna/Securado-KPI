"""
Script to simulate/populate test data for different users
This creates opportunities with different owners to test RBAC filtering

Run: cd /app/backend && python scripts/simulate_test_data.py
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import random


def generate_id():
    return str(uuid.uuid4())


def now_utc():
    return datetime.now(timezone.utc)


async def simulate_test_data():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    
    canonical_db = client['event_mesh_canonical']
    org_id = "default"
    
    # Define test users and their data
    test_users = [
        {"name": "Test Sales User", "email": "sales@test.securado.com", "team": "Team A"},
        {"name": "Test Sales Director", "email": "sales.director@test.securado.com", "team": "Team A"},
        {"name": "Test Product Director", "email": "product.director@test.securado.com", "team": "Team B"},
        {"name": "Test Presales Engineer", "email": "presales@test.securado.com", "team": "Team A"},
        {"name": "Test Finance Manager", "email": "finance@test.securado.com", "team": "Finance"},
    ]
    
    # Opportunity stages and values
    stages = ["qualified", "proposal", "negotiation", "closed_won", "closed_lost"]
    accounts = [
        "Test Company Alpha",
        "Test Company Beta",
        "Test Company Gamma",
        "Test Corp Delta",
        "Test Inc Epsilon"
    ]
    
    print("=" * 60)
    print("Simulating Test Data")
    print("=" * 60)
    
    # Create test opportunities for each user
    print("\n📊 Creating Test Opportunities...")
    opp_count = 0
    
    for user in test_users:
        for i in range(5):  # 5 opportunities per user
            opp_doc = {
                "canonical_id": f"test_opp_{generate_id()[:8]}",
                "source_system": "test",
                "source_record_id": f"test_{random.randint(100000, 999999)}",
                "name": f"Test Opportunity - {user['name']} #{i+1}",
                "type": "opportunity",
                "stage": random.choice(stages),
                "owner_name": user["name"],
                "owner_email": user["email"],
                "team_name": user["team"],
                "account_name": random.choice(accounts),
                "sale_value": random.randint(5000, 100000),
                "probability": random.randint(10, 90),
                "create_date": (now_utc() - timedelta(days=random.randint(1, 90))).strftime("%Y-%m-%d"),
                "close_date": (now_utc() + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d"),
                "org_id": org_id,
                "synced_at": now_utc()
            }
            await canonical_db.opportunities.insert_one(opp_doc)
            opp_count += 1
    
    print(f"   ✅ Created {opp_count} test opportunities")
    
    # Create test activities for each user
    print("\n📅 Creating Test Activities...")
    activity_types = ["Call", "Meeting", "Email", "Task", "Follow-up"]
    act_count = 0
    
    for user in test_users:
        for i in range(3):  # 3 activities per user
            act_doc = {
                "canonical_id": f"test_act_{generate_id()[:8]}",
                "source_system": "test",
                "source_record_id": f"test_act_{random.randint(100000, 999999)}",  # Unique source_record_id
                "activity_type": random.choice(activity_types),
                "summary": f"Test Activity - {user['name']} #{i+1}",
                "assigned_user": user["name"],
                "assigned_to": user["name"],
                "salesperson": user["name"],
                "date_deadline": (now_utc() + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d"),
                "state": random.choice(["pending", "done"]),
                "res_model": "crm.lead",
                "org_id": org_id,
                "synced_at": now_utc()
            }
            await canonical_db.activities.insert_one(act_doc)
            act_count += 1
    
    print(f"   ✅ Created {act_count} test activities")
    
    # Create test invoices with salesperson field
    print("\n💰 Creating Test Invoices with Salesperson...")
    inv_count = 0
    
    for user in test_users:
        for i in range(3):  # 3 invoices per user
            amount = random.randint(1000, 50000)
            inv_doc = {
                "canonical_id": f"test_inv_{generate_id()[:8]}",
                "source_system": "test",
                "source_model": "account.move",
                "source_record_id": f"test_{random.randint(100000, 999999)}",
                "invoice_number": f"TEST/INV/{now_utc().year}/{inv_count+1:04d}",
                "account_name": random.choice(accounts),
                "amount_total": amount,
                "amount_untaxed": amount * 0.95,
                "amount_tax": amount * 0.05,
                "currency": "OMR",
                "invoice_date": (now_utc() - timedelta(days=random.randint(1, 60))).strftime("%Y-%m-%d"),
                "due_date": (now_utc() + timedelta(days=random.randint(-30, 60))).strftime("%Y-%m-%d"),
                "payment_state": random.choice(["paid", "not_paid", "not_paid"]),
                "state": "posted",
                "salesperson": user["name"],  # KEY: Adding salesperson field!
                "salesperson_email": user["email"],
                "org_id": org_id,
                "synced_at": now_utc()
            }
            await canonical_db.invoices.insert_one(inv_doc)
            inv_count += 1
    
    print(f"   ✅ Created {inv_count} test invoices with salesperson field")
    
    print("\n" + "=" * 60)
    print("Test Data Summary")
    print("=" * 60)
    print(f"Total Opportunities: {opp_count}")
    print(f"Total Activities: {act_count}")
    print(f"Total Invoices: {inv_count}")
    
    print("\n📋 Data per User:")
    for user in test_users:
        print(f"  - {user['name']}: 5 opps, 3 activities, 3 invoices")
    
    print("\n🔔 Testing Instructions:")
    print("1. Login as sales@test.securado.com - should see OWN records only")
    print("2. Login as sales.director@test.securado.com - should see ALL records")
    print("3. Login as finance@test.securado.com - should see ALL invoices")
    print("4. Use filters to test by year, quarter, salesperson")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(simulate_test_data())
