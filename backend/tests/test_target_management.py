"""
Target Management API Tests
Tests for: Sales Targets, Activity Targets, Incentive Plans, and Incentive Calculation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable must be set")

# Test credentials
TEST_EMAIL = "krishna@securado.net"
TEST_PASSWORD = "test123456"


@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    assert token, "No access token returned"
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ API is healthy: {data.get('service')}")


class TestSalesTargets:
    """Sales Target CRUD tests"""
    
    def test_list_sales_targets(self, auth_headers):
        """Test listing sales targets"""
        response = requests.get(
            f"{BASE_URL}/api/sales-targets",
            headers=auth_headers,
            params={"period_type": "quarterly"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} sales targets")
        return data
    
    def test_get_targets_summary(self, auth_headers):
        """Test getting targets summary statistics"""
        response = requests.get(
            f"{BASE_URL}/api/sales-targets/summary",
            headers=auth_headers,
            params={"period_type": "quarterly"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate summary structure
        assert "total_targets" in data
        assert "total_target_value" in data
        assert "total_achieved_value" in data
        assert "overall_achievement_pct" in data
        assert "active" in data
        assert "achieved" in data
        assert "at_risk" in data
        assert "by_department" in data
        
        print(f"✓ Summary: {data['total_targets']} targets, {data['overall_achievement_pct']}% achievement")
        return data
    
    def test_get_target_leaderboard(self, auth_headers):
        """Test getting target leaderboard"""
        response = requests.get(
            f"{BASE_URL}/api/sales-targets/leaderboard",
            headers=auth_headers,
            params={"period_type": "quarterly", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Validate leaderboard entry structure
        if data:
            entry = data[0]
            assert "user_id" in entry
            assert "user_name" in entry
            assert "total_target" in entry
            assert "total_achieved" in entry
            assert "achievement_pct" in entry
        
        print(f"✓ Leaderboard has {len(data)} entries")
        return data
    
    def test_create_sales_target(self, auth_headers):
        """Test creating a new sales target"""
        test_target = {
            "name": "TEST_Q1 Revenue Target",
            "description": "Test target for API validation",
            "target_type": "revenue",
            "target_value": 50000,
            "target_unit": "OMR",
            "period_type": "quarterly",
            "department": "sales",
            "start_date": "2026-01-01",
            "end_date": "2026-03-31",
            "assigned_to_name": "Test User"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sales-targets",
            headers=auth_headers,
            json=test_target
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "id" in data
        assert data["name"] == test_target["name"]
        assert data["target_value"] == test_target["target_value"]
        assert data["status"] == "active"
        assert data["current_value"] == 0
        
        print(f"✓ Created target: {data['id']}")
        return data
    
    def test_update_target_progress(self, auth_headers):
        """Test updating target progress"""
        # First create a target
        create_response = requests.post(
            f"{BASE_URL}/api/sales-targets",
            headers=auth_headers,
            json={
                "name": "TEST_Progress Update Target",
                "target_value": 100000,
                "target_unit": "OMR",
                "period_type": "quarterly",
                "department": "sales"
            }
        )
        assert create_response.status_code == 200
        target_id = create_response.json()["id"]
        
        # Update progress
        update_response = requests.patch(
            f"{BASE_URL}/api/sales-targets/{target_id}/progress",
            headers=auth_headers,
            json={"current_value": 75000}
        )
        assert update_response.status_code == 200
        data = update_response.json()
        
        assert data["success"] == True
        assert data["current_value"] == 75000
        assert data["progress_pct"] == 75.0
        assert data["status"] == "active"
        
        # Verify with GET
        get_response = requests.get(
            f"{BASE_URL}/api/sales-targets/{target_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["current_value"] == 75000
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sales-targets/{target_id}", headers=auth_headers)
        print(f"✓ Progress updated: 75%")
    
    def test_delete_sales_target(self, auth_headers):
        """Test deleting a sales target"""
        # Create a target first
        create_response = requests.post(
            f"{BASE_URL}/api/sales-targets",
            headers=auth_headers,
            json={
                "name": "TEST_Delete Target",
                "target_value": 10000,
                "target_unit": "OMR",
                "period_type": "quarterly",
                "department": "sales"
            }
        )
        assert create_response.status_code == 200
        target_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/sales-targets/{target_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] == True
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/sales-targets/{target_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404
        print(f"✓ Target deleted and verified")


class TestActivityTargets:
    """Activity Target tests"""
    
    def test_list_activity_targets(self, auth_headers):
        """Test listing activity targets"""
        response = requests.get(
            f"{BASE_URL}/api/activity-targets",
            headers=auth_headers,
            params={"period_type": "monthly"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} activity targets")
        return data
    
    def test_get_activity_summary(self, auth_headers):
        """Test getting activity targets summary"""
        response = requests.get(
            f"{BASE_URL}/api/activity-targets/summary",
            headers=auth_headers,
            params={"period_type": "monthly"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate structure
        assert "total_targets" in data
        assert "total_target_count" in data
        assert "total_actual_count" in data
        assert "overall_achievement_pct" in data
        assert "by_type" in data
        
        print(f"✓ Activity summary: {data['overall_achievement_pct']}% achievement")
        return data
    
    def test_get_activity_scoreboard(self, auth_headers):
        """Test getting activity scoreboard"""
        response = requests.get(
            f"{BASE_URL}/api/activity-targets/scoreboard",
            headers=auth_headers,
            params={"period_type": "monthly"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Validate entry structure
        if data:
            entry = data[0]
            assert "user_id" in entry
            assert "user_name" in entry
            assert "activities" in entry
            assert "total_target" in entry
            assert "total_actual" in entry
            assert "achievement_pct" in entry
        
        print(f"✓ Activity scoreboard has {len(data)} entries")
        return data
    
    def test_create_activity_target(self, auth_headers):
        """Test creating an activity target"""
        test_activity = {
            "name": "TEST_Call Target",
            "activity_type": "call",
            "target_count": 50,
            "period_type": "monthly",
            "assigned_to_name": "Test User"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/activity-targets",
            headers=auth_headers,
            json=test_activity
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["name"] == test_activity["name"]
        assert data["activity_type"] == "call"
        assert data["target_count"] == 50
        assert data["current_count"] == 0
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/activity-targets/{data['id']}", headers=auth_headers)
        print(f"✓ Created activity target: {data['id']}")
        return data
    
    def test_log_activity_count(self, auth_headers):
        """Test incrementing activity count"""
        # Create an activity target
        create_response = requests.post(
            f"{BASE_URL}/api/activity-targets",
            headers=auth_headers,
            json={
                "name": "TEST_Log Activity Target",
                "activity_type": "meeting",
                "target_count": 10,
                "period_type": "monthly"
            }
        )
        assert create_response.status_code == 200
        target_id = create_response.json()["id"]
        
        # Log activity (+1)
        log_response = requests.patch(
            f"{BASE_URL}/api/activity-targets/{target_id}/log",
            headers=auth_headers,
            params={"increment": 1}
        )
        assert log_response.status_code == 200
        data = log_response.json()
        assert data["current_count"] == 1
        assert data["progress_pct"] == 10.0
        
        # Log more activity (+5)
        log_response2 = requests.patch(
            f"{BASE_URL}/api/activity-targets/{target_id}/log",
            headers=auth_headers,
            params={"increment": 5}
        )
        assert log_response2.status_code == 200
        assert log_response2.json()["current_count"] == 6
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/activity-targets/{target_id}", headers=auth_headers)
        print(f"✓ Activity logged: count increased to 6")


class TestIncentivePlans:
    """Incentive Plan tests"""
    
    def test_list_incentive_plans(self, auth_headers):
        """Test listing incentive plans"""
        response = requests.get(
            f"{BASE_URL}/api/incentive-plans",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} incentive plans")
        return data
    
    def test_create_incentive_plan(self, auth_headers):
        """Test creating an incentive plan with commission tiers"""
        test_plan = {
            "name": "TEST_Sales Commission Plan",
            "description": "Test plan with tiered commissions",
            "base_salary": 24000,
            "ote": 40000,
            "pay_mix_base": 60,
            "pay_mix_variable": 40,
            "period_type": "quarterly",
            "slabs": [
                {"min_percent": 0, "max_percent": 50, "commission_rate": 0, "label": "Below Threshold"},
                {"min_percent": 50, "max_percent": 80, "commission_rate": 5, "label": "Base Rate"},
                {"min_percent": 80, "max_percent": 100, "commission_rate": 8, "label": "Standard"},
                {"min_percent": 100, "max_percent": 120, "commission_rate": 12, "label": "Accelerated"},
                {"min_percent": 120, "max_percent": 200, "commission_rate": 15, "label": "Super Accelerated"}
            ],
            "spiffs": [
                {"name": "Early Closure Bonus", "amount": 500, "min_attainment": 100}
            ],
            "product_multipliers": [
                {"product_id": "prod1", "product_name": "Premium Product", "multiplier": 1.5}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/incentive-plans",
            headers=auth_headers,
            json=test_plan
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["name"] == test_plan["name"]
        assert len(data["slabs"]) == 5
        assert len(data["spiffs"]) == 1
        assert len(data["product_multipliers"]) == 1
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/incentive-plans/{data['id']}", headers=auth_headers)
        print(f"✓ Created incentive plan with 5 tiers, 1 SPIFF, 1 multiplier")
        return data


class TestIncentiveCalculation:
    """Incentive Calculation tests"""
    
    def test_calculate_incentive(self, auth_headers):
        """Test calculating incentive payout for a target"""
        # Get existing targets
        targets_response = requests.get(
            f"{BASE_URL}/api/sales-targets",
            headers=auth_headers
        )
        targets = targets_response.json()
        
        if not targets:
            pytest.skip("No targets available for calculation test")
        
        target = targets[0]
        
        response = requests.post(
            f"{BASE_URL}/api/incentive-calc/calculate",
            headers=auth_headers,
            json={
                "target_id": target["id"],
                "actual_value": target.get("target_value", 100000) * 0.8  # 80% attainment
            }
        )
        assert response.status_code == 200, f"Calculate failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "target_id" in data
        assert "target_value" in data
        assert "actual_value" in data
        assert "attainment_pct" in data
        assert "total_payout" in data
        assert "breakdown" in data
        
        print(f"✓ Calculated incentive: {data['attainment_pct']}% attainment, {data['total_payout']} payout")
        return data
    
    def test_simulate_incentive(self, auth_headers):
        """Test simulating incentive payouts at different levels"""
        # Get existing plans
        plans_response = requests.get(
            f"{BASE_URL}/api/incentive-plans",
            headers=auth_headers
        )
        plans = plans_response.json()
        
        if not plans:
            pytest.skip("No incentive plans available for simulation test")
        
        plan = plans[0]
        
        response = requests.post(
            f"{BASE_URL}/api/incentive-calc/simulate",
            headers=auth_headers,
            params={
                "plan_id": plan["id"],
                "target_value": 100000,
                "scenarios": [50, 80, 100, 120, 150]
            }
        )
        assert response.status_code == 200, f"Simulate failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "plan_name" in data
        assert "target_value" in data
        assert "simulations" in data
        assert len(data["simulations"]) == 5
        
        # Validate simulation entry structure
        sim = data["simulations"][0]
        assert "attainment_pct" in sim
        assert "actual_value" in sim
        assert "commission" in sim
        assert "effective_rate" in sim
        
        print(f"✓ Simulated payouts for {len(data['simulations'])} scenarios")
        return data


class TestCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_test_data(self, auth_headers):
        """Delete all TEST_ prefixed data"""
        cleaned = 0
        
        # Clean sales targets
        targets_response = requests.get(
            f"{BASE_URL}/api/sales-targets",
            headers=auth_headers
        )
        for target in targets_response.json():
            if target.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/sales-targets/{target['id']}", headers=auth_headers)
                cleaned += 1
        
        # Clean activity targets
        activity_response = requests.get(
            f"{BASE_URL}/api/activity-targets",
            headers=auth_headers
        )
        for activity in activity_response.json():
            if activity.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/activity-targets/{activity['id']}", headers=auth_headers)
                cleaned += 1
        
        # Clean incentive plans
        plans_response = requests.get(
            f"{BASE_URL}/api/incentive-plans",
            headers=auth_headers
        )
        for plan in plans_response.json():
            if plan.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/incentive-plans/{plan['id']}", headers=auth_headers)
                cleaned += 1
        
        print(f"✓ Cleaned up {cleaned} test records")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
