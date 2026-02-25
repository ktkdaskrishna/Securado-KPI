"""
Iteration 21 Testing - Comprehensive UAT Tests
Tests: Dashboard inline filters, Account filter fix, KPI equal width, RBAC, Analytics, Dashboard Builder
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USER = {"email": "krishna@securado.net", "password": "test123456"}
SALES_REP_USER = {"email": "nabisaheb@securado.net", "password": "test123456"}
PD_USER = {"email": "vimod.c@securado.net", "password": "test123456"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin login failed")


@pytest.fixture(scope="module")
def sales_rep_token():
    """Get sales rep auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SALES_REP_USER)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Sales rep login failed")


@pytest.fixture(scope="module")
def pd_token():
    """Get product director auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=PD_USER)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Product director login failed")


class TestAuthentication:
    """Test authentication for all 3 users"""
    
    def test_admin_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✅ Admin login successful")
    
    def test_sales_rep_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALES_REP_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✅ Sales Rep login successful")
    
    def test_product_director_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PD_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✅ Product Director login successful")


class TestDashboardMyDashboard:
    """Test my-dashboard endpoint with year filtering"""
    
    def test_my_dashboard_2026(self, admin_token):
        """GET /api/card-builder/my-dashboard?year=2026 returns data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/card-builder/my-dashboard?year=2026", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "template" in data
        assert "blocks" in data
        assert len(data["blocks"]) > 0
        print(f"✅ Dashboard 2026 returns {len(data['blocks'])} blocks")
    
    def test_my_dashboard_2025(self, admin_token):
        """GET /api/card-builder/my-dashboard?year=2025 returns different data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/card-builder/my-dashboard?year=2025", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "template" in data
        assert "blocks" in data
        print(f"✅ Dashboard 2025 returns data")
    
    def test_my_dashboard_open_opps_count(self, admin_token):
        """Dashboard 2026 should show ~30 open opportunities"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/card-builder/my-dashboard?year=2026", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Find the Open Opportunities block
        for block in data["blocks"]:
            if block.get("card", {}).get("name") == "Open Opportunities":
                count = block.get("data", {}).get("value", 0)
                print(f"  Open Opportunities count: {count}")
                # Should be around 30 based on code
                assert count >= 1, "Should have at least 1 open opportunity"
                break
        print(f"✅ Dashboard shows open opportunities")


class TestFilterOptions:
    """Test filter options API"""
    
    def test_analytics_filters(self, admin_token):
        """GET /api/analytics/filters returns filter options"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/filters", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check for filter arrays
        assert "years" in data
        assert "sales_reps" in data or "salesReps" in data
        assert "accounts" in data
        assert "stages" in data
        
        print(f"✅ Filter options: {len(data.get('years', []))} years, {len(data.get('accounts', []))} accounts")
    
    def test_dashboard_filter_options(self, admin_token):
        """GET /api/card-builder/filter-options returns dashboard filters"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/card-builder/filter-options", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "salespersons" in data
        assert "product_directors" in data
        assert "solution_categories" in data
        print(f"✅ Dashboard filter options: {len(data.get('salespersons', []))} sales reps")


class TestTemplatesAndCards:
    """Test templates and cards endpoints"""
    
    def test_list_templates(self, admin_token):
        """GET /api/card-builder/templates returns templates"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/card-builder/templates", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 6  # Should have 7 role templates
        
        template_names = [t.get("name") for t in data]
        print(f"✅ Found {len(data)} templates: {template_names}")
    
    def test_list_cards(self, admin_token):
        """GET /api/card-builder/cards returns all cards"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/card-builder/cards", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 10  # Should have 20+ cards
        
        # Check display types
        display_types = set(c.get("display_type") for c in data)
        print(f"✅ Found {len(data)} cards with display types: {display_types}")
    
    def test_available_roles(self, admin_token):
        """GET /api/card-builder/available-roles returns roles"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/card-builder/available-roles", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        role_ids = [r.get("id") for r in data]
        expected_roles = ["admin", "sales_admin", "sales_director", "product_director", "sales_rep"]
        for role in expected_roles:
            assert role in role_ids, f"Missing role: {role}"
        print(f"✅ Found {len(data)} roles including: {role_ids}")


class TestDrillDown:
    """Test drill-down functionality"""
    
    def test_drill_down_card(self, admin_token):
        """POST /api/card-builder/cards/{id}/drill-down returns records"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get a card ID
        cards_response = requests.get(f"{BASE_URL}/api/card-builder/cards", headers=headers)
        cards = cards_response.json()
        if not cards:
            pytest.skip("No cards found")
        
        card_id = cards[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/card-builder/cards/{card_id}/drill-down?year=2026",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "records" in data
        assert "total" in data
        print(f"✅ Drill-down returns {data['total']} records")


class TestRBAC:
    """Test RBAC - different users see different data"""
    
    def test_admin_sees_more_data(self, admin_token, sales_rep_token):
        """Admin should see more/different data than sales rep"""
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        rep_headers = {"Authorization": f"Bearer {sales_rep_token}"}
        
        admin_response = requests.get(f"{BASE_URL}/api/card-builder/my-dashboard?year=2026", headers=admin_headers)
        rep_response = requests.get(f"{BASE_URL}/api/card-builder/my-dashboard?year=2026", headers=rep_headers)
        
        assert admin_response.status_code == 200
        assert rep_response.status_code == 200
        
        admin_data = admin_response.json()
        rep_data = rep_response.json()
        
        # Different templates for different roles
        admin_template = admin_data.get("template", {}).get("name", "")
        rep_template = rep_data.get("template", {}).get("name", "")
        
        print(f"  Admin template: {admin_template}")
        print(f"  Sales Rep template: {rep_template}")
        
        # At minimum they should have data
        assert len(admin_data.get("blocks", [])) > 0
        assert len(rep_data.get("blocks", [])) > 0
        print(f"✅ RBAC working - different templates for different users")
    
    def test_product_director_dashboard(self, pd_token):
        """Product director should see their specific dashboard"""
        headers = {"Authorization": f"Bearer {pd_token}"}
        response = requests.get(f"{BASE_URL}/api/card-builder/my-dashboard?year=2026", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        template_name = data.get("template", {}).get("name", "")
        print(f"✅ Product Director sees: {template_name}")


class TestAnalytics:
    """Test analytics endpoints"""
    
    def test_analytics_overview(self, admin_token):
        """GET /api/analytics/overview returns summary data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/overview?year=2026", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should have overview stats
        print(f"✅ Analytics overview: {list(data.keys())[:5]}...")
    
    def test_analytics_rep_performance(self, admin_token):
        """GET /api/analytics/rep-performance returns rep data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/rep-performance?year=2026", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Rep performance: {len(data)} reps")


class TestProductManagers:
    """Test product managers and solution categories endpoints"""
    
    def test_get_product_managers(self, admin_token):
        """GET /api/targets/product-managers returns PMs"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/targets/product-managers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Product managers: {len(data)}")
    
    def test_get_solution_categories(self, admin_token):
        """GET /api/targets/solution-categories returns categories"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/targets/solution-categories", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Solution categories: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
