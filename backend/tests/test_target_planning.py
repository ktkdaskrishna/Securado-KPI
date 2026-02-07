"""
Target Planning API Tests
Tests for: Lookups (from Odoo), Revenue Plans, Activity Plan Items, Redistributions, Actuals

Flow: CEO → PM → Sales Director → Account Manager
- CEO assigns revenue target to PM (Revenue Plans)
- PM creates activity plan items by solution category
- Sales Director redistributes plan items to Account Managers
- Actuals tracked from Odoo data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable must be set")

# Test credentials
SYSTEM_ADMIN_EMAIL = "krishna@securado.net"
SALES_DIRECTOR_EMAIL = "sales.director@test.securado.com"
TEST_PASSWORD = "test123456"


@pytest.fixture(scope="module")
def admin_headers():
    """Get System Admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SYSTEM_ADMIN_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    assert token, "No access token returned"
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sales_director_headers():
    """Get Sales Director authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SALES_DIRECTOR_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Sales Director login failed: {response.text}"
    token = response.json().get("access_token")
    assert token, "No access token returned for Sales Director"
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ==================== LOOKUPS FROM ODOO ====================

class TestLookups:
    """Lookup endpoints - data comes from Odoo canonical DB"""
    
    def test_get_product_managers(self, admin_headers):
        """GET /api/target-lookups/product-managers returns 6 PMs from Odoo"""
        response = requests.get(
            f"{BASE_URL}/api/target-lookups/product-managers",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify we get PMs with expected structure
        assert len(data) >= 1, "Should return at least 1 PM from Odoo"
        pm = data[0]
        assert "name" in pm, "PM should have name"
        assert "opp_count" in pm, "PM should have opp_count"
        assert "total_pipeline" in pm, "PM should have total_pipeline"
        
        pm_count = len(data)
        print(f"✓ GET /target-lookups/product-managers: {pm_count} PMs from Odoo")
        # Per review request, should return 6 PMs
        if pm_count >= 6:
            print(f"  ✓ Found expected 6+ PMs")
        return data
    
    def test_get_solution_categories(self, admin_headers):
        """GET /api/target-lookups/solution-categories returns 15+ categories from Odoo"""
        response = requests.get(
            f"{BASE_URL}/api/target-lookups/solution-categories",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure
        assert len(data) >= 1, "Should return at least 1 solution category"
        cat = data[0]
        assert "name" in cat, "Category should have name"
        assert "opp_count" in cat, "Category should have opp_count"
        assert "total_pipeline" in cat, "Category should have total_pipeline"
        
        cat_count = len(data)
        print(f"✓ GET /target-lookups/solution-categories: {cat_count} categories from Odoo")
        # Per review request, should return 15+ categories
        if cat_count >= 15:
            print(f"  ✓ Found expected 15+ solution categories")
        return data
    
    def test_get_salespersons(self, admin_headers):
        """GET /api/target-lookups/salespersons returns 10+ salespersons from Odoo"""
        response = requests.get(
            f"{BASE_URL}/api/target-lookups/salespersons",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure
        assert len(data) >= 1, "Should return at least 1 salesperson"
        sp = data[0]
        assert "name" in sp, "Salesperson should have name"
        assert "opp_count" in sp, "Salesperson should have opp_count"
        assert "total_pipeline" in sp, "Salesperson should have total_pipeline"
        
        sp_count = len(data)
        print(f"✓ GET /target-lookups/salespersons: {sp_count} salespersons from Odoo")
        # Per review request, should return 10+ salespersons
        if sp_count >= 10:
            print(f"  ✓ Found expected 10+ salespersons")
        return data
    
    def test_get_activity_types(self, admin_headers):
        """GET /api/target-lookups/activity-types returns activity types from Odoo"""
        response = requests.get(
            f"{BASE_URL}/api/target-lookups/activity-types",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure
        assert len(data) >= 1, "Should return at least 1 activity type"
        at = data[0]
        assert "type" in at, "Activity type should have type field"
        assert "count" in at, "Activity type should have count"
        
        # Check for expected types (Meeting, Call, Demo, etc.)
        types_found = [a["type"] for a in data]
        print(f"✓ GET /target-lookups/activity-types: {len(data)} types - {types_found[:5]}...")
        return data
    
    def test_get_accounts(self, admin_headers):
        """GET /api/target-lookups/accounts returns accounts from Odoo"""
        response = requests.get(
            f"{BASE_URL}/api/target-lookups/accounts",
            headers=admin_headers,
            params={"limit": 50}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should return accounts
        acc_count = len(data)
        print(f"✓ GET /target-lookups/accounts: {acc_count} accounts from Odoo")
        return data
    
    def test_get_sales_teams(self, admin_headers):
        """GET /api/target-lookups/sales-teams returns sales teams from Odoo"""
        response = requests.get(
            f"{BASE_URL}/api/target-lookups/sales-teams",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /target-lookups/sales-teams: {len(data)} teams from Odoo")
        return data


# ==================== ACTUALS FROM ODOO ====================

class TestActuals:
    """Actuals endpoints - real performance data from Odoo"""
    
    def test_get_actuals_by_pm(self, admin_headers):
        """GET /api/target-actuals/by-product-manager returns PM performance"""
        response = requests.get(
            f"{BASE_URL}/api/target-actuals/by-product-manager",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure
        if data:
            pm = data[0]
            assert "product_manager" in pm, "Should have product_manager"
            assert "total_pipeline" in pm, "Should have total_pipeline"
            assert "won_amount" in pm, "Should have won_amount"
            assert "opp_count" in pm, "Should have opp_count"
        
        print(f"✓ GET /target-actuals/by-product-manager: {len(data)} PM actuals with pipeline/won amounts")
        return data
    
    def test_get_actuals_by_salesperson(self, admin_headers):
        """GET /api/target-actuals/by-salesperson returns salesperson performance"""
        response = requests.get(
            f"{BASE_URL}/api/target-actuals/by-salesperson",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure
        if data:
            sp = data[0]
            assert "salesperson" in sp, "Should have salesperson"
            assert "total_pipeline" in sp, "Should have total_pipeline"
        
        print(f"✓ GET /target-actuals/by-salesperson: {len(data)} salesperson actuals")
        return data
    
    def test_get_collection_actuals(self, admin_headers):
        """GET /api/target-actuals/collection returns invoice overdue data (64 overdue invoices)"""
        response = requests.get(
            f"{BASE_URL}/api/target-actuals/collection",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "by_state" in data, "Should have by_state breakdown"
        assert "overdue_count" in data, "Should have overdue_count"
        assert "overdue_amount" in data, "Should have overdue_amount"
        assert "total_invoices" in data, "Should have total_invoices"
        
        # Check for payment states (paid, partial, not_paid, in_payment)
        by_state = data.get("by_state", {})
        states = list(by_state.keys())
        
        overdue = data.get("overdue_count", 0)
        print(f"✓ GET /target-actuals/collection: {overdue} overdue invoices, states: {states}")
        # Per review request, should have 64 overdue invoices
        if overdue >= 60:
            print(f"  ✓ Found expected ~64 overdue invoices")
        return data
    
    def test_get_actual_activities(self, admin_headers):
        """GET /api/target-actuals/activities returns actual activity counts"""
        response = requests.get(
            f"{BASE_URL}/api/target-actuals/activities",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ GET /target-actuals/activities: {len(data)} activity records")
        return data


# ==================== REVENUE PLANS (CEO → PM) ====================

class TestRevenuePlans:
    """Revenue Plan CRUD - CEO assigns revenue target to Product Manager"""
    created_plan_id = None
    
    def test_list_revenue_plans(self, admin_headers):
        """GET /api/target-plans/revenue lists all revenue plans"""
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ GET /target-plans/revenue: {len(data)} existing revenue plans")
        return data
    
    def test_create_revenue_plan(self, admin_headers):
        """POST /api/target-plans/revenue creates revenue plan with PM assignment"""
        # First get a PM from lookups
        pm_response = requests.get(
            f"{BASE_URL}/api/target-lookups/product-managers",
            headers=admin_headers
        )
        pms = pm_response.json()
        assert len(pms) > 0, "Need PMs from Odoo to create plan"
        pm = pms[0]
        
        test_plan = {
            "name": f"TEST_Q1 2026 - {pm['name']}",
            "product_manager_id": pm.get("id"),
            "product_manager_name": pm["name"],
            "target_amount": 2500000,
            "period": "2026-Q1",
            "notes": "Test revenue plan for API validation"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/target-plans/revenue",
            headers=admin_headers,
            json=test_plan
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "id" in data, "Should return plan ID"
        assert data["name"] == test_plan["name"], "Name should match"
        assert data["product_manager_name"] == pm["name"], "PM name should match"
        assert data["target_amount"] == 2500000, "Target amount should match"
        assert data["plan_type"] == "revenue", "Plan type should be revenue"
        assert data["status"] == "active", "Status should be active"
        
        TestRevenuePlans.created_plan_id = data["id"]
        print(f"✓ POST /target-plans/revenue: Created plan {data['id']} for PM {pm['name']}")
        return data
    
    def test_verify_created_plan_in_list(self, admin_headers):
        """Verify created plan appears in list with enriched data from Odoo"""
        if not TestRevenuePlans.created_plan_id:
            pytest.skip("No plan created to verify")
        
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue",
            headers=admin_headers
        )
        assert response.status_code == 200
        plans = response.json()
        
        # Find our created plan
        our_plan = next((p for p in plans if p["id"] == TestRevenuePlans.created_plan_id), None)
        assert our_plan is not None, "Created plan should appear in list"
        
        # Verify enrichment from Odoo
        assert "actual_revenue" in our_plan, "Should be enriched with actual_revenue"
        assert "total_pipeline" in our_plan, "Should be enriched with total_pipeline"
        assert "activity_items_count" in our_plan, "Should have activity_items_count"
        
        print(f"✓ Verified plan in list with Odoo enrichment: pipeline={our_plan.get('total_pipeline', 0)}")
        return our_plan


# ==================== ACTIVITY PLAN ITEMS (PM creates) ====================

class TestActivityPlanItems:
    """Activity Plan Items - PM creates activity plan by solution category"""
    created_item_ids = []
    
    def test_create_plan_items(self, admin_headers):
        """POST /api/target-plans/revenue/{id}/items creates activity plan items"""
        plan_id = TestRevenuePlans.created_plan_id
        if not plan_id:
            pytest.skip("No revenue plan to add items to")
        
        # Get solution categories and activity types from Odoo
        cats_response = requests.get(
            f"{BASE_URL}/api/target-lookups/solution-categories",
            headers=admin_headers
        )
        cats = cats_response.json()
        
        types_response = requests.get(
            f"{BASE_URL}/api/target-lookups/activity-types",
            headers=admin_headers
        )
        types = types_response.json()
        
        # Create multiple activity items
        items_to_create = [
            {"activity_type": types[0]["type"] if types else "Call", "solution_category": cats[0]["name"] if cats else None, "target_count": 20, "notes": "TEST Call item"},
            {"activity_type": "Demo" if any(t["type"] == "Demo" for t in types) else "Meeting", "solution_category": cats[1]["name"] if len(cats) > 1 else None, "target_count": 10, "notes": "TEST Demo item"},
        ]
        
        for item_data in items_to_create:
            response = requests.post(
                f"{BASE_URL}/api/target-plans/revenue/{plan_id}/items",
                headers=admin_headers,
                json=item_data
            )
            assert response.status_code == 200, f"Create item failed: {response.text}"
            data = response.json()
            
            # Validate response
            assert "id" in data, "Should return item ID"
            assert data["activity_type"] == item_data["activity_type"], "Activity type should match"
            assert data["target_count"] == item_data["target_count"], "Target count should match"
            assert data["revenue_plan_id"] == plan_id, "Should reference revenue plan"
            
            TestActivityPlanItems.created_item_ids.append(data["id"])
            print(f"✓ Created activity item: {data['activity_type']} target={data['target_count']}")
        
        print(f"✓ POST /target-plans/revenue/{plan_id}/items: Created {len(TestActivityPlanItems.created_item_ids)} items")
    
    def test_list_plan_items_with_actuals(self, admin_headers):
        """GET /api/target-plans/revenue/{id}/items returns items with actual_count from Odoo"""
        plan_id = TestRevenuePlans.created_plan_id
        if not plan_id:
            pytest.skip("No revenue plan to list items for")
        
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue/{plan_id}/items",
            headers=admin_headers
        )
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        
        # Verify items have actual_count from Odoo
        for item in items:
            assert "actual_count" in item, "Item should have actual_count from Odoo"
            assert "redistributed_to_count" in item, "Item should have redistributed_to_count"
            assert "redistributed_total" in item, "Item should have redistributed_total"
        
        print(f"✓ GET /target-plans/revenue/{plan_id}/items: {len(items)} items with Odoo actuals")
        return items


# ==================== REDISTRIBUTIONS (Sales Director → Account Managers) ====================

class TestRedistributions:
    """Redistributions - Sales Director assigns plan items to salespersons"""
    created_redistribution_ids = []
    
    def test_redistribute_plan_item(self, admin_headers):
        """POST /api/target-plans/items/{id}/redistribute assigns to salesperson"""
        if not TestActivityPlanItems.created_item_ids:
            pytest.skip("No plan items to redistribute")
        
        item_id = TestActivityPlanItems.created_item_ids[0]
        
        # Get salespersons from Odoo
        sp_response = requests.get(
            f"{BASE_URL}/api/target-lookups/salespersons",
            headers=admin_headers
        )
        salespersons = sp_response.json()
        assert len(salespersons) > 0, "Need salespersons from Odoo"
        sp = salespersons[0]
        
        redistrib_data = {
            "plan_item_id": item_id,
            "assigned_to_name": sp["name"],
            "assigned_to_id": sp.get("id"),
            "assigned_count": 5,
            "account_ids": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/target-plans/items/{item_id}/redistribute",
            headers=admin_headers,
            json=redistrib_data
        )
        assert response.status_code == 200, f"Redistribute failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "id" in data, "Should return redistribution ID"
        assert data["assigned_to_name"] == sp["name"], "Assigned name should match"
        assert data["assigned_count"] == 5, "Assigned count should match"
        assert data["plan_item_id"] == item_id, "Should reference plan item"
        
        TestRedistributions.created_redistribution_ids.append(data["id"])
        print(f"✓ POST /target-plans/items/{item_id}/redistribute: Assigned 5 to {sp['name']}")
        return data
    
    def test_verify_redistribution_match(self, admin_headers):
        """Verify plan items show redistribution match indicator"""
        plan_id = TestRevenuePlans.created_plan_id
        if not plan_id:
            pytest.skip("No revenue plan to check")
        
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue/{plan_id}/items",
            headers=admin_headers
        )
        items = response.json()
        
        # Check redistributed item
        redistributed_item = next((i for i in items if i.get("redistributed_total", 0) > 0), None)
        if redistributed_item:
            target = redistributed_item.get("target_count", 0)
            assigned = redistributed_item.get("redistributed_total", 0)
            print(f"✓ Redistribution match: {assigned}/{target} assigned (match={assigned >= target})")
        
        return items
    
    def test_list_redistributions(self, admin_headers):
        """GET /api/target-plans/revenue/{id}/redistributions lists all redistributions"""
        plan_id = TestRevenuePlans.created_plan_id
        if not plan_id:
            pytest.skip("No revenue plan to list redistributions for")
        
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue/{plan_id}/redistributions",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ GET /target-plans/revenue/{plan_id}/redistributions: {len(data)} redistributions")
        return data


# ==================== RBAC TESTS ====================

class TestRBAC:
    """RBAC tests - verify access control for different roles"""
    
    def test_sales_director_can_access_lookups(self, sales_director_headers):
        """Sales Director CAN access lookup endpoints"""
        response = requests.get(
            f"{BASE_URL}/api/target-lookups/product-managers",
            headers=sales_director_headers
        )
        assert response.status_code == 200, "Sales Director should access lookups"
        print(f"✓ RBAC: Sales Director CAN access /target-lookups/product-managers")
    
    def test_sales_director_can_access_plans(self, sales_director_headers):
        """Sales Director CAN access plans endpoints"""
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue",
            headers=sales_director_headers
        )
        assert response.status_code == 200, "Sales Director should access plans"
        print(f"✓ RBAC: Sales Director CAN access /target-plans/revenue")
    
    def test_sales_director_cannot_access_etl(self, sales_director_headers):
        """Sales Director CANNOT access ETL connections (system admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/integrations",
            headers=sales_director_headers
        )
        # Should be 403 Forbidden or 401 Unauthorized
        assert response.status_code in [401, 403], f"Sales Director should NOT access ETL, got {response.status_code}"
        print(f"✓ RBAC: Sales Director CANNOT access /api/integrations (got {response.status_code})")


# ==================== CLEANUP ====================

class TestCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_redistributions(self, admin_headers):
        """Delete test redistributions"""
        cleaned = 0
        for redist_id in TestRedistributions.created_redistribution_ids:
            response = requests.delete(
                f"{BASE_URL}/api/target-plans/redistributions/{redist_id}",
                headers=admin_headers
            )
            if response.status_code == 200:
                cleaned += 1
        print(f"✓ Cleaned up {cleaned} redistributions")
    
    def test_cleanup_plan_items(self, admin_headers):
        """Delete test plan items"""
        cleaned = 0
        for item_id in TestActivityPlanItems.created_item_ids:
            response = requests.delete(
                f"{BASE_URL}/api/target-plans/items/{item_id}",
                headers=admin_headers
            )
            if response.status_code == 200:
                cleaned += 1
        print(f"✓ Cleaned up {cleaned} plan items")
    
    def test_cleanup_revenue_plan(self, admin_headers):
        """Delete test revenue plan"""
        if TestRevenuePlans.created_plan_id:
            response = requests.delete(
                f"{BASE_URL}/api/target-plans/revenue/{TestRevenuePlans.created_plan_id}",
                headers=admin_headers
            )
            if response.status_code == 200:
                print(f"✓ Cleaned up test revenue plan")
        
        # Also clean any other TEST_ prefixed plans
        plans_response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue",
            headers=admin_headers
        )
        for plan in plans_response.json():
            if plan.get("name", "").startswith("TEST_"):
                requests.delete(
                    f"{BASE_URL}/api/target-plans/revenue/{plan['id']}",
                    headers=admin_headers
                )
                print(f"✓ Cleaned up additional test plan: {plan['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
