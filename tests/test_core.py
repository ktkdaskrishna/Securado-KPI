#!/usr/bin/env python3
"""
Event Mesh CRM - Core POC Test Script

Tests the core end-to-end flows:
1. Auth Flow: Register → Pending → Approve → Login → /me
2. ETL Run Flow: Create connection/mapping/pipeline → Publish run → Runner completes
3. Canonical Query: Canonical upserts visible via /api/data-lake/canonical
4. CRM Read: CRM endpoints show data from canonical
5. Override Flow: Update opportunity stage (override, not canonical)
"""
import asyncio
import aiohttp
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8001/api"

# Test state
test_results = []
test_state = {}


def log(message, success=None):
    """Log test output"""
    prefix = ""
    if success is True:
        prefix = "✅ "
    elif success is False:
        prefix = "❌ "
    else:
        prefix = "➡️ "
    print(f"{prefix}{message}")
    if success is not None:
        test_results.append({"message": message, "success": success})


async def test_auth_flow():
    """Test 1: Auth Flow"""
    print("\n" + "="*60)
    print("TEST 1: Authentication Flow")
    print("="*60)
    
    async with aiohttp.ClientSession() as session:
        # 1.1 Register a new user
        log("Registering new user...")
        async with session.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": "test@example.com",
                "password": "test123",
                "name": "Test User",
                "org_id": "test-org"
            }
        ) as resp:
            data = await resp.json()
            if resp.status == 200:
                log(f"User registered: {data.get('email')} (status: {data.get('status')})", True)
                test_state["user_id"] = data.get("id")
                test_state["user_email"] = data.get("email")
            else:
                log(f"Registration failed: {data}", False)
                return False
        
        # 1.2 Try to login (should fail - pending approval)
        log("Attempting login with pending user (should fail)...")
        async with session.post(
            f"{BASE_URL}/auth/login",
            json={"email": "test@example.com", "password": "test123"}
        ) as resp:
            if resp.status == 403:
                data = await resp.json()
                log(f"Login blocked as expected: {data.get('detail')}", True)
            else:
                log("Login should have been blocked for pending user", False)
                return False
        
        # 1.3 Create admin user (auto-approved for testing)
        log("Creating admin user...")
        async with session.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": "admin@example.com",
                "password": "admin123",
                "name": "Admin User",
                "org_id": "test-org"
            }
        ) as resp:
            data = await resp.json()
            test_state["admin_user_id"] = data.get("id")
        
        # 1.4 Manually approve the admin (bypass)
        log("Setting up admin bypass...")
        # We'll use a direct MongoDB update via a special test endpoint
        # For now, simulate by approving via the regular flow
        
        # First, let's create a super admin that's auto-approved
        import motor.motor_asyncio
        client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["event_mesh_app"]
        
        # Auto-approve admin
        await db.users.update_one(
            {"email": "admin@example.com"},
            {"$set": {"status": "approved"}}
        )
        log("Admin user auto-approved via DB", True)
        
        # 1.5 Login as admin
        log("Logging in as admin...")
        async with session.post(
            f"{BASE_URL}/auth/login",
            json={"email": "admin@example.com", "password": "admin123"}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                test_state["admin_token"] = data.get("access_token")
                log(f"Admin logged in, token received", True)
            else:
                data = await resp.json()
                log(f"Admin login failed: {data}", False)
                return False
        
        # 1.6 Admin approves test user
        log("Admin approving test user...")
        async with session.post(
            f"{BASE_URL}/admin/users/{test_state['user_id']}/approve",
            headers={"Authorization": f"Bearer {test_state['admin_token']}"}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                log(f"User approved: {data.get('message')}", True)
            else:
                data = await resp.json()
                log(f"Approval failed: {data}", False)
                return False
        
        # 1.7 Login as approved user
        log("Logging in as approved user...")
        async with session.post(
            f"{BASE_URL}/auth/login",
            json={"email": "test@example.com", "password": "test123"}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                test_state["user_token"] = data.get("access_token")
                log(f"User logged in successfully", True)
            else:
                data = await resp.json()
                log(f"Login failed: {data}", False)
                return False
        
        # 1.8 Call /me endpoint
        log("Calling /me endpoint...")
        async with session.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {test_state['user_token']}"}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                log(f"/me returned: {data.get('email')} (status: {data.get('status')})", True)
            else:
                data = await resp.json()
                log(f"/me failed: {data}", False)
                return False
        
        client.close()
        return True


async def test_etl_flow():
    """Test 2: ETL Pipeline Flow"""
    print("\n" + "="*60)
    print("TEST 2: ETL Pipeline Flow")
    print("="*60)
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {test_state['admin_token']}"}
        
        # 2.1 Create connection (mock type)
        log("Creating data source connection...")
        async with session.post(
            f"{BASE_URL}/integrations",
            headers=headers,
            json={
                "name": "Test Mock Connection",
                "type": "mock",
                "url": "http://mock-source",
                "database": "test_db",
                "username": "user",
                "api_key": "key123",
                "description": "Test connection for POC"
            }
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                test_state["connection_id"] = data.get("id")
                log(f"Connection created: {data.get('name')} (id: {data.get('id')})", True)
            else:
                data = await resp.json()
                log(f"Connection creation failed: {data}", False)
                return False
        
        # 2.2 Create mapping
        log("Creating field mapping...")
        async with session.post(
            f"{BASE_URL}/mappings",
            headers=headers,
            json={
                "name": "Opportunity Mapping",
                "connection_id": test_state["connection_id"],
                "source_model": "crm.lead",
                "target_entity": "opportunity",
                "mappings": [
                    {"source_field": "name", "target_field": "name", "transform": "direct"},
                    {"source_field": "expected_revenue", "target_field": "amount", "transform": "to_float"},
                    {"source_field": "probability", "target_field": "probability", "transform": "to_int"},
                    {"source_field": "stage_id", "target_field": "stage", "transform": "extract_name"},
                    {"source_field": "user_id", "target_field": "owner_name", "transform": "extract_name"},
                    {"source_field": "email_from", "target_field": "contact_email", "transform": "direct"},
                    {"source_field": "phone", "target_field": "contact_phone", "transform": "direct"}
                ],
                "description": "Maps CRM leads to canonical opportunities"
            }
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                test_state["mapping_id"] = data.get("id")
                log(f"Mapping created: {data.get('name')} (id: {data.get('id')})", True)
            else:
                data = await resp.json()
                log(f"Mapping creation failed: {data}", False)
                return False
        
        # 2.3 Create pipeline
        log("Creating pipeline...")
        async with session.post(
            f"{BASE_URL}/pipelines",
            headers=headers,
            json={
                "name": "Test Pipeline",
                "connection_id": test_state["connection_id"],
                "mapping_id": test_state["mapping_id"],
                "extract_limit": 20,
                "sync_mode": "full",
                "description": "Test pipeline for POC"
            }
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                test_state["pipeline_id"] = data.get("id")
                log(f"Pipeline created: {data.get('name')} (id: {data.get('id')})", True)
            else:
                data = await resp.json()
                log(f"Pipeline creation failed: {data}", False)
                return False
        
        # 2.4 Run pipeline
        log("Triggering pipeline run...")
        async with session.post(
            f"{BASE_URL}/pipelines/{test_state['pipeline_id']}/run",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                test_state["run_id"] = data.get("id")
                log(f"Pipeline run started: {data.get('id')} (status: {data.get('status')})", True)
            else:
                data = await resp.json()
                log(f"Pipeline run failed: {data}", False)
                return False
        
        # 2.5 Wait for run to complete
        log("Waiting for pipeline run to complete...")
        max_wait = 30
        waited = 0
        while waited < max_wait:
            await asyncio.sleep(1)
            waited += 1
            
            async with session.get(
                f"{BASE_URL}/runs/{test_state['run_id']}",
                headers=headers
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    status = data.get("status")
                    if status in ["completed", "failed"]:
                        if status == "completed":
                            log(f"Pipeline run completed: {data.get('loaded_count')} records loaded", True)
                            test_state["run_status"] = status
                        else:
                            log(f"Pipeline run failed: {data.get('error')}", False)
                            return False
                        break
                    else:
                        print(f"   ... status: {status}, waiting...")
        
        if waited >= max_wait:
            log("Pipeline run timed out", False)
            return False
        
        return True


async def test_canonical_query():
    """Test 3: Canonical Query"""
    print("\n" + "="*60)
    print("TEST 3: Canonical Data Query")
    print("="*60)
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {test_state['admin_token']}"}
        
        # 3.1 Query canonical opportunities
        log("Querying canonical opportunities...")
        async with session.get(
            f"{BASE_URL}/data-lake/canonical?entity=opportunities",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                records = data.get("records", [])
                total = data.get("total", 0)
                log(f"Canonical query returned {total} opportunities", True)
                
                if records:
                    first = records[0]
                    test_state["canonical_id"] = first.get("canonical_id")
                    log(f"First record: {first.get('name')} ({first.get('canonical_id')})", True)
                else:
                    log("No canonical records found after ETL run", False)
                    return False
            else:
                data = await resp.json()
                log(f"Canonical query failed: {data}", False)
                return False
        
        # 3.2 Search
        log("Testing search...")
        async with session.get(
            f"{BASE_URL}/search?q=Opportunity",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                log(f"Search returned {len(data)} results", True)
            else:
                data = await resp.json()
                log(f"Search failed: {data}", False)
        
        # 3.3 Data lake stats
        log("Getting data lake stats...")
        async with session.get(
            f"{BASE_URL}/data-lake/stats",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                log(f"Data lake stats: {data.get('entity_counts')}", True)
            else:
                log("Data lake stats failed", False)
        
        return True


async def test_crm_read():
    """Test 4: CRM Read from Canonical"""
    print("\n" + "="*60)
    print("TEST 4: CRM Endpoints (Read from Canonical)")
    print("="*60)
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {test_state['admin_token']}"}
        
        # 4.1 List opportunities
        log("Listing CRM opportunities...")
        async with session.get(
            f"{BASE_URL}/opportunities",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                log(f"CRM opportunities: {len(data)} records", True)
                if data:
                    first = data[0]
                    log(f"First opp: {first.get('name')} (stage: {first.get('stage')}, has_overrides: {first.get('has_overrides')})", True)
                    test_state["opp_canonical_id"] = first.get("canonical_id")
            else:
                data = await resp.json()
                log(f"List opportunities failed: {data}", False)
                return False
        
        # 4.2 Kanban view
        log("Getting kanban view...")
        async with session.get(
            f"{BASE_URL}/opportunities/kanban",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                stages = data.get("stages", [])
                kanban_data = data.get("data", {})
                log(f"Kanban stages: {stages}", True)
                for stage, opps in kanban_data.items():
                    if opps:
                        log(f"  {stage}: {len(opps)} opportunities", True)
            else:
                log("Kanban view failed", False)
        
        # 4.3 Dashboard stats
        log("Getting dashboard stats...")
        async with session.get(
            f"{BASE_URL}/dashboard/stats",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                log(f"Dashboard: total_pipeline=${data.get('total_pipeline', 0):,.0f}, win_rate={data.get('win_rate', 0):.1f}%", True)
            else:
                log("Dashboard stats failed", False)
        
        return True


async def test_override_flow():
    """Test 5: Override Flow (Stage Update)"""
    print("\n" + "="*60)
    print("TEST 5: Override Flow (Stage Update)")
    print("="*60)
    
    if not test_state.get("opp_canonical_id"):
        log("No opportunity to test override with", False)
        return False
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {test_state['admin_token']}"}
        opp_id = test_state["opp_canonical_id"]
        
        # 5.1 Get current opportunity
        log(f"Getting opportunity {opp_id}...")
        async with session.get(
            f"{BASE_URL}/opportunities/{opp_id}",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                old_stage = data.get("stage")
                has_overrides = data.get("has_overrides")
                log(f"Current stage: {old_stage}, has_overrides: {has_overrides}", True)
                test_state["old_stage"] = old_stage
            else:
                data = await resp.json()
                log(f"Get opportunity failed: {data}", False)
                return False
        
        # 5.2 Update stage (override)
        new_stage = "negotiation"
        log(f"Updating stage to '{new_stage}'...")
        async with session.patch(
            f"{BASE_URL}/opportunities/{opp_id}/stage",
            headers=headers,
            json={"stage": new_stage}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                log(f"Stage updated: {data.get('message')}", True)
            else:
                data = await resp.json()
                log(f"Stage update failed: {data}", False)
                return False
        
        # 5.3 Verify override applied
        log("Verifying override applied...")
        async with session.get(
            f"{BASE_URL}/opportunities/{opp_id}",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                current_stage = data.get("stage")
                has_overrides = data.get("has_overrides")
                if current_stage == new_stage and has_overrides:
                    log(f"Override verified: stage={current_stage}, has_overrides={has_overrides}", True)
                else:
                    log(f"Override not applied correctly: stage={current_stage}, has_overrides={has_overrides}", False)
                    return False
            else:
                log("Verification failed", False)
                return False
        
        # 5.4 Check kanban reflects change
        log("Checking kanban reflects override...")
        async with session.get(
            f"{BASE_URL}/opportunities/kanban",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                kanban_data = data.get("data", {})
                found_in_new_stage = any(
                    opp.get("canonical_id") == opp_id 
                    for opp in kanban_data.get(new_stage, [])
                )
                if found_in_new_stage:
                    log(f"Opportunity found in '{new_stage}' stage in kanban", True)
                else:
                    log(f"Opportunity not found in '{new_stage}' stage", False)
            else:
                log("Kanban check failed", False)
        
        return True


async def test_events():
    """Test 6: Events and DLQ"""
    print("\n" + "="*60)
    print("TEST 6: Events and DLQ")
    print("="*60)
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {test_state['admin_token']}"}
        
        # 6.1 Get event history
        log("Getting event history...")
        async with session.get(
            f"{BASE_URL}/events/history?limit=20",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                log(f"Event history: {len(data)} events", True)
                if data:
                    for evt in data[:5]:
                        log(f"  - {evt.get('event_type')}: {evt.get('occurred_at')}", True)
            else:
                log("Event history failed", False)
        
        # 6.2 Get run events
        if test_state.get("run_id"):
            log(f"Getting events for run {test_state['run_id']}...")
            async with session.get(
                f"{BASE_URL}/events/runs/{test_state['run_id']}",
                headers=headers
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    log(f"Run events: {len(data)} events", True)
                else:
                    log("Run events failed", False)
        
        # 6.3 Get DLQ stats
        log("Getting DLQ stats...")
        async with session.get(
            f"{BASE_URL}/dlq/stats",
            headers=headers
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                log(f"DLQ stats: failed={data.get('failed', 0)}, retried={data.get('retried', 0)}, dismissed={data.get('dismissed', 0)}", True)
            else:
                log("DLQ stats failed", False)
        
        return True


async def cleanup():
    """Cleanup test data"""
    print("\n" + "="*60)
    print("CLEANUP")
    print("="*60)
    
    import motor.motor_asyncio
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    
    app_db = client["event_mesh_app"]
    canonical_db = client["event_mesh_canonical"]
    
    # Clean up test users
    await app_db.users.delete_many({"org_id": "test-org"})
    
    # Clean up test connections/mappings/pipelines/runs
    await app_db.connections.delete_many({"org_id": "test-org"})
    await app_db.mappings.delete_many({"org_id": "test-org"})
    await app_db.pipelines.delete_many({"org_id": "test-org"})
    await app_db.pipeline_runs.delete_many({"org_id": "test-org"})
    await app_db.overrides.delete_many({"org_id": "test-org"})
    
    # Clean up canonical data
    await canonical_db.opportunities.delete_many({"org_id": "test-org"})
    
    # Clean up events
    await app_db.events.delete_many({"org_id": "test-org"})
    await app_db.processed_events.delete_many({})
    
    # Clean up serving cache
    await app_db.serving_cache.delete_many({"org_id": "test-org"})
    
    client.close()
    log("Test data cleaned up", True)


async def main():
    """Run all tests"""
    print("="*60)
    print("EVENT MESH CRM - CORE POC TEST")
    print("="*60)
    print(f"Started at: {datetime.now().isoformat()}")
    print(f"Base URL: {BASE_URL}")
    
    all_passed = True
    
    try:
        # Test 1: Auth Flow
        if not await test_auth_flow():
            all_passed = False
        
        # Test 2: ETL Flow
        if not await test_etl_flow():
            all_passed = False
        
        # Test 3: Canonical Query
        if not await test_canonical_query():
            all_passed = False
        
        # Test 4: CRM Read
        if not await test_crm_read():
            all_passed = False
        
        # Test 5: Override Flow
        if not await test_override_flow():
            all_passed = False
        
        # Test 6: Events
        if not await test_events():
            all_passed = False
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    finally:
        # Cleanup
        await cleanup()
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for r in test_results if r["success"])
    failed = sum(1 for r in test_results if not r["success"])
    
    print(f"Total: {len(test_results)} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if all_passed:
        print("\n✅ ALL CORE POC TESTS PASSED!")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        for r in test_results:
            if not r["success"]:
                print(f"  - {r['message']}")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
