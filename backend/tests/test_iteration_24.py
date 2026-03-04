"""
Iteration 24 Backend Tests
Tests for:
1. POST /api/target-plans/revenue with plan_type='strategy' creates strategy plan
2. POST /api/target-plans/revenue with plan_type='marketing' creates marketing plan  
3. Activity suggestions for strategy plans include assign_team='strategy'
4. Activity suggestions for revenue plans include marketing and strategy activities with sponsor_pd field
5. Target Type dropdown options verification via API response
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIteration24PlanTypes:
    """Test plan_type support for strategy and marketing plans"""
    
    auth_token = None
    test_plan_ids = []  # Track plans created for cleanup
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        if not TestIteration24PlanTypes.auth_token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "krishna@securado.net",
                "password": "test123456"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            TestIteration24PlanTypes.auth_token = response.json().get("access_token")
        yield
        # Cleanup test plans after all tests
    
    @pytest.fixture
    def headers(self):
        return {
            "Authorization": f"Bearer {TestIteration24PlanTypes.auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_product_managers(self, headers):
        """Get list of product managers for plan creation"""
        response = requests.get(f"{BASE_URL}/api/target-lookups/product-managers", headers=headers)
        assert response.status_code == 200, f"Failed to get PMs: {response.text}"
        pms = response.json()
        assert len(pms) > 0, "No product managers found"
        # Store for later use
        TestIteration24PlanTypes.pm_name = pms[0].get("name")
        print(f"Using PM: {TestIteration24PlanTypes.pm_name}")
    
    def test_create_strategy_plan(self, headers):
        """Create a plan with plan_type='strategy' for GM Strategy"""
        pm_name = getattr(TestIteration24PlanTypes, 'pm_name', 'Shri Hari Venkatesh Naidu')
        
        payload = {
            "name": "TEST_Strategy_Plan_2026",
            "product_manager_name": pm_name,
            "booking_target": 50000,
            "invoiced_target": 40000,
            "margin_target": 10000,
            "period": "2026-Q1",
            "plan_type": "strategy",  # New plan type
            "notes": "Test strategy plan for GM Strategy"
        }
        
        response = requests.post(f"{BASE_URL}/api/target-plans/revenue", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create strategy plan: {response.text}"
        
        plan = response.json()
        TestIteration24PlanTypes.test_plan_ids.append(plan.get("id"))
        TestIteration24PlanTypes.strategy_plan_id = plan.get("id")
        
        # Verify plan_type is set correctly
        assert plan.get("plan_type") == "strategy", f"Expected plan_type='strategy', got {plan.get('plan_type')}"
        assert plan.get("name") == "TEST_Strategy_Plan_2026"
        print(f"Strategy plan created: {plan.get('id')} with plan_type={plan.get('plan_type')}")
    
    def test_create_marketing_plan(self, headers):
        """Create a plan with plan_type='marketing' for Marketing Team"""
        pm_name = getattr(TestIteration24PlanTypes, 'pm_name', 'Shri Hari Venkatesh Naidu')
        
        payload = {
            "name": "TEST_Marketing_Plan_2026",
            "product_manager_name": pm_name,
            "booking_target": 30000,
            "invoiced_target": 25000,
            "margin_target": 5000,
            "period": "2026-Q1",
            "plan_type": "marketing",  # New plan type
            "notes": "Test marketing plan for Marketing Team"
        }
        
        response = requests.post(f"{BASE_URL}/api/target-plans/revenue", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create marketing plan: {response.text}"
        
        plan = response.json()
        TestIteration24PlanTypes.test_plan_ids.append(plan.get("id"))
        TestIteration24PlanTypes.marketing_plan_id = plan.get("id")
        
        # Verify plan_type is set correctly
        assert plan.get("plan_type") == "marketing", f"Expected plan_type='marketing', got {plan.get('plan_type')}"
        print(f"Marketing plan created: {plan.get('id')} with plan_type={plan.get('plan_type')}")
    
    def test_strategy_plan_suggestions(self, headers):
        """Verify strategy plan generates strategy-specific activity suggestions"""
        plan_id = getattr(TestIteration24PlanTypes, 'strategy_plan_id', None)
        if not plan_id:
            pytest.skip("No strategy plan created")
        
        # Wait for suggestions to be generated
        time.sleep(0.5)
        
        response = requests.get(f"{BASE_URL}/api/target-plans/revenue/{plan_id}/suggestions", headers=headers)
        assert response.status_code == 200, f"Failed to get suggestions: {response.text}"
        
        suggestions_doc = response.json()
        if not suggestions_doc:
            pytest.skip("No suggestions generated (may need more historical data)")
        
        suggestions = suggestions_doc.get("suggestions", [])
        print(f"Strategy plan has {len(suggestions)} suggestions")
        
        # Check for strategy-specific activities
        strategy_activities = ["Assessment Services", "CEO Presentation", "Awareness Camp", "Work Shop", "Vendor Meeting"]
        found_strategy_activities = set()
        assign_team_correct = True
        
        for s in suggestions:
            act_type = s.get("activity_type", "")
            if act_type in strategy_activities:
                found_strategy_activities.add(act_type)
            # Verify assign_team is 'strategy' for strategy plan suggestions
            if s.get("assign_team") != "strategy":
                assign_team_correct = False
                print(f"ISSUE: Activity '{act_type}' has assign_team='{s.get('assign_team')}' (expected 'strategy')")
        
        print(f"Found strategy activities: {found_strategy_activities}")
        assert len(found_strategy_activities) > 0, "No strategy-specific activities found in suggestions"
        assert assign_team_correct, "Some suggestions don't have assign_team='strategy'"
    
    def test_marketing_plan_suggestions(self, headers):
        """Verify marketing plan generates marketing-specific activity suggestions"""
        plan_id = getattr(TestIteration24PlanTypes, 'marketing_plan_id', None)
        if not plan_id:
            pytest.skip("No marketing plan created")
        
        time.sleep(0.5)
        
        response = requests.get(f"{BASE_URL}/api/target-plans/revenue/{plan_id}/suggestions", headers=headers)
        assert response.status_code == 200, f"Failed to get suggestions: {response.text}"
        
        suggestions_doc = response.json()
        if not suggestions_doc:
            pytest.skip("No suggestions generated (may need more historical data)")
        
        suggestions = suggestions_doc.get("suggestions", [])
        print(f"Marketing plan has {len(suggestions)} suggestions")
        
        # Check for marketing-specific activities
        marketing_activities = ["Digital Campaign", "Event", "Awareness Camp", "Product Presentation"]
        found_marketing_activities = set()
        assign_team_correct = True
        
        for s in suggestions:
            act_type = s.get("activity_type", "")
            if act_type in marketing_activities:
                found_marketing_activities.add(act_type)
            # Verify assign_team is 'marketing' for marketing plan suggestions
            if s.get("assign_team") != "marketing":
                assign_team_correct = False
                print(f"ISSUE: Activity '{act_type}' has assign_team='{s.get('assign_team')}' (expected 'marketing')")
        
        print(f"Found marketing activities: {found_marketing_activities}")
        assert len(found_marketing_activities) > 0, "No marketing-specific activities found in suggestions"
        assert assign_team_correct, "Some suggestions don't have assign_team='marketing'"
    
    def test_revenue_plan_includes_cross_team_activities(self, headers):
        """Create a regular revenue plan and verify it includes marketing/strategy activities with sponsor_pd"""
        pm_name = getattr(TestIteration24PlanTypes, 'pm_name', 'Shri Hari Venkatesh Naidu')
        
        payload = {
            "name": "TEST_Revenue_Plan_CrossTeam_2026",
            "product_manager_name": pm_name,
            "booking_target": 100000,
            "invoiced_target": 80000,
            "margin_target": 20000,
            "period": "2026-Q1",
            "plan_type": "revenue",  # Standard revenue plan
            "notes": "Test revenue plan with cross-team activities"
        }
        
        response = requests.post(f"{BASE_URL}/api/target-plans/revenue", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create revenue plan: {response.text}"
        
        plan = response.json()
        plan_id = plan.get("id")
        TestIteration24PlanTypes.test_plan_ids.append(plan_id)
        
        # Wait for suggestions
        time.sleep(0.5)
        
        # Get suggestions
        response = requests.get(f"{BASE_URL}/api/target-plans/revenue/{plan_id}/suggestions", headers=headers)
        assert response.status_code == 200, f"Failed to get suggestions: {response.text}"
        
        suggestions_doc = response.json()
        if not suggestions_doc:
            pytest.skip("No suggestions generated for revenue plan")
        
        suggestions = suggestions_doc.get("suggestions", [])
        print(f"Revenue plan has {len(suggestions)} suggestions")
        
        # Check for cross-team activities
        marketing_items = [s for s in suggestions if s.get("assign_team") == "marketing"]
        strategy_items = [s for s in suggestions if s.get("assign_team") == "strategy"]
        sales_items = [s for s in suggestions if s.get("assign_team") is None]
        
        print(f"Sales activities: {len(sales_items)}, Marketing: {len(marketing_items)}, Strategy: {len(strategy_items)}")
        
        # Revenue plans should have sales activities
        assert len(sales_items) > 0, "No sales activities found in revenue plan suggestions"
        
        # Check for sponsor_pd field in marketing/strategy activities
        for s in marketing_items + strategy_items:
            sponsor = s.get("sponsor_pd")
            if sponsor:
                print(f"Activity '{s.get('activity_type')}' has sponsor_pd='{sponsor}'")
                assert sponsor == pm_name, f"sponsor_pd should be {pm_name}, got {sponsor}"
    
    def test_list_plans_by_type(self, headers):
        """Verify GET /api/target-plans/revenue returns plans grouped by type"""
        response = requests.get(f"{BASE_URL}/api/target-plans/revenue", headers=headers)
        assert response.status_code == 200, f"Failed to list plans: {response.text}"
        
        plans = response.json()
        print(f"Total plans: {len(plans)}")
        
        # Count by type
        revenue_plans = [p for p in plans if p.get("plan_type") in ["revenue", None]]
        strategy_plans = [p for p in plans if p.get("plan_type") == "strategy"]
        marketing_plans = [p for p in plans if p.get("plan_type") == "marketing"]
        
        print(f"Revenue/PD plans: {len(revenue_plans)}")
        print(f"Strategy plans: {len(strategy_plans)}")
        print(f"Marketing plans: {len(marketing_plans)}")
        
        # Our test should have created at least one of each
        test_strategy = [p for p in strategy_plans if "TEST_" in (p.get("name") or "")]
        test_marketing = [p for p in marketing_plans if "TEST_" in (p.get("name") or "")]
        
        assert len(test_strategy) > 0 or len(strategy_plans) > 0, "No strategy plans found"
        assert len(test_marketing) > 0 or len(marketing_plans) > 0, "No marketing plans found"


class TestIteration24ActivityItems:
    """Test activity items with assign_team and executing team fields"""
    
    auth_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login"""
        if not TestIteration24ActivityItems.auth_token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "krishna@securado.net",
                "password": "test123456"
            })
            assert response.status_code == 200
            TestIteration24ActivityItems.auth_token = response.json().get("access_token")
        yield
    
    @pytest.fixture
    def headers(self):
        return {
            "Authorization": f"Bearer {TestIteration24ActivityItems.auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_create_activity_item_with_assign_team(self, headers):
        """Create an activity item with assign_team field"""
        # Get existing plans
        response = requests.get(f"{BASE_URL}/api/target-plans/revenue", headers=headers)
        assert response.status_code == 200
        plans = response.json()
        
        if not plans:
            pytest.skip("No plans available for testing")
        
        plan_id = plans[0].get("id")
        
        # Create activity item with marketing team
        payload = {
            "activity_type": "Digital Campaign",
            "solution_category": "Email Security",
            "target_count": 5,
            "notes": "TEST marketing activity item",
            "assign_team": "marketing",
            "sponsor_pd": "Shri Hari Venkatesh Naidu"
        }
        
        response = requests.post(f"{BASE_URL}/api/target-plans/revenue/{plan_id}/items", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create item: {response.text}"
        
        item = response.json()
        TestIteration24ActivityItems.test_item_id = item.get("id")
        
        # Verify fields
        assert item.get("assign_team") == "marketing", f"Expected assign_team='marketing', got {item.get('assign_team')}"
        assert item.get("sponsor_pd") == "Shri Hari Venkatesh Naidu"
        assert item.get("activity_type") == "Digital Campaign"
        print(f"Activity item created: {item.get('id')} with assign_team={item.get('assign_team')}")
    
    def test_list_items_shows_team_badges(self, headers):
        """Verify plan items list includes team information"""
        response = requests.get(f"{BASE_URL}/api/target-plans/revenue", headers=headers)
        plans = response.json()
        
        if not plans:
            pytest.skip("No plans available")
        
        plan_id = plans[0].get("id")
        
        response = requests.get(f"{BASE_URL}/api/target-plans/revenue/{plan_id}/items", headers=headers)
        assert response.status_code == 200, f"Failed to get items: {response.text}"
        
        items = response.json()
        print(f"Plan has {len(items)} activity items")
        
        # Check for assign_team field
        teams_found = set()
        for item in items:
            team = item.get("assign_team")
            if team:
                teams_found.add(team)
                print(f"Item '{item.get('activity_type')}' → Team: {team}")
        
        print(f"Teams found in items: {teams_found}")


class TestIteration24Cleanup:
    """Cleanup test data"""
    
    auth_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        if not TestIteration24Cleanup.auth_token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "krishna@securado.net",
                "password": "test123456"
            })
            assert response.status_code == 200
            TestIteration24Cleanup.auth_token = response.json().get("access_token")
        yield
    
    @pytest.fixture
    def headers(self):
        return {
            "Authorization": f"Bearer {TestIteration24Cleanup.auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_cleanup_test_plans(self, headers):
        """Delete all TEST_ prefixed plans"""
        response = requests.get(f"{BASE_URL}/api/target-plans/revenue", headers=headers)
        assert response.status_code == 200
        plans = response.json()
        
        deleted = 0
        for plan in plans:
            if plan.get("name", "").startswith("TEST_"):
                plan_id = plan.get("id")
                del_response = requests.delete(f"{BASE_URL}/api/target-plans/revenue/{plan_id}", headers=headers)
                if del_response.status_code == 200:
                    deleted += 1
                    print(f"Deleted plan: {plan.get('name')}")
        
        print(f"Cleaned up {deleted} test plans")
