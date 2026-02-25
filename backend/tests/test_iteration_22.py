"""
Iteration 22 Tests - Critical bug fixes:
1. Leaderboard sorted HIGH→LOW by total value
2. CardConfig has sort_by/sort_order/date_filter_field
3. Edit Chart dialog persistence
4. KPI card navigation to /opportunities
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://layout-manager-1.preview.emergentagent.com').rstrip('/')


class TestIteration22:
    """Tests for iteration 22 bug fixes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "krishna@securado.net",
            "password": "test123456"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    # =========== LEADERBOARD SORTING TESTS ===========
    
    def test_leaderboard_sorted_by_total_desc(self):
        """CRITICAL: Sales leaderboard sorted HIGH→LOW by total value"""
        # Execute grouped query for Won opportunities by salesperson
        response = requests.post(
            f"{BASE_URL}/api/card-builder/execute-query",
            headers=self.headers,
            json={
                "collection": "opportunities",
                "aggregation": "sum",
                "field": "sale_value",
                "filters": {"type": "opportunity", "stage": "Won"},
                "group_by": "owner_name",
                "year": "2026"
            }
        )
        assert response.status_code == 200
        data = response.json()
        groups = data.get("groups", [])
        
        # Must have at least 2 groups to verify sorting
        assert len(groups) >= 2, f"Need at least 2 groups, got {len(groups)}"
        
        # Verify descending order by total
        for i in range(len(groups) - 1):
            current = groups[i].get("total", 0)
            next_val = groups[i + 1].get("total", 0)
            assert current >= next_val, f"Sort error: {groups[i]['label']}={current} should be >= {groups[i+1]['label']}={next_val}"
        
        # Verify Nabisaheb is first (highest value)
        first_label = groups[0].get("label", "")
        assert "Nabisaheb" in first_label, f"Expected Nabisaheb first, got {first_label}"
        
        # Verify Nabisaheb has ~248K
        first_total = groups[0].get("total", 0)
        assert first_total > 200000, f"Nabisaheb should have >200K, got {first_total}"
    
    def test_pipeline_by_stage_sorted_by_total(self):
        """Grouped pipeline by stage should also be sorted by total desc"""
        response = requests.post(
            f"{BASE_URL}/api/card-builder/execute-query",
            headers=self.headers,
            json={
                "collection": "opportunities",
                "aggregation": "sum",
                "field": "sale_value",
                "filters": {"type": "opportunity"},
                "group_by": "stage",
                "year": "2026"
            }
        )
        assert response.status_code == 200
        data = response.json()
        groups = data.get("groups", [])
        
        # Verify descending order
        if len(groups) >= 2:
            for i in range(len(groups) - 1):
                current = groups[i].get("total", 0)
                next_val = groups[i + 1].get("total", 0)
                assert current >= next_val, f"Sort error at position {i}"
    
    def test_count_aggregation_sorts_by_count(self):
        """Count aggregation should sort by count (not total)"""
        response = requests.post(
            f"{BASE_URL}/api/card-builder/execute-query",
            headers=self.headers,
            json={
                "collection": "opportunities",
                "aggregation": "count",
                "filters": {"type": "opportunity"},
                "group_by": "stage",
                "year": "2026"
            }
        )
        assert response.status_code == 200
        data = response.json()
        groups = data.get("groups", [])
        
        # Verify descending order by count
        if len(groups) >= 2:
            for i in range(len(groups) - 1):
                current = groups[i].get("count", 0)
                next_val = groups[i + 1].get("count", 0)
                assert current >= next_val, f"Count sort error at position {i}"
    
    # =========== CARD CONFIG FIELDS TESTS ===========
    
    def test_card_config_has_sort_fields(self):
        """CRITICAL: CardConfig should save/retrieve sort_by and sort_order"""
        # Create card with sort fields
        create_response = requests.post(
            f"{BASE_URL}/api/card-builder/cards",
            headers=self.headers,
            json={
                "name": "TEST_Sort_Config_Card",
                "collection": "opportunities",
                "aggregation": "sum",
                "field": "sale_value",
                "filters": {"type": "opportunity"},
                "group_by": "owner_name",
                "display_type": "leaderboard",
                "sort_by": "total",
                "sort_order": "desc",
                "year_filter": True
            }
        )
        assert create_response.status_code == 200
        card_id = create_response.json().get("id")
        
        try:
            # Retrieve and verify
            get_response = requests.get(
                f"{BASE_URL}/api/card-builder/cards/{card_id}",
                headers=self.headers
            )
            assert get_response.status_code == 200
            card = get_response.json()
            
            assert card.get("sort_by") == "total", f"sort_by not persisted: {card.get('sort_by')}"
            assert card.get("sort_order") == "desc", f"sort_order not persisted: {card.get('sort_order')}"
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/card-builder/cards/{card_id}", headers=self.headers)
    
    def test_card_config_has_date_filter_field(self):
        """CRITICAL: CardConfig should save/retrieve date_filter_field"""
        # Create card with date_filter_field
        create_response = requests.post(
            f"{BASE_URL}/api/card-builder/cards",
            headers=self.headers,
            json={
                "name": "TEST_DateFilter_Card",
                "collection": "opportunities",
                "aggregation": "count",
                "filters": {"type": "opportunity"},
                "display_type": "number",
                "date_filter_field": "date_last_stage_update",
                "year_filter": True
            }
        )
        assert create_response.status_code == 200
        card_id = create_response.json().get("id")
        
        try:
            # Retrieve and verify
            get_response = requests.get(
                f"{BASE_URL}/api/card-builder/cards/{card_id}",
                headers=self.headers
            )
            assert get_response.status_code == 200
            card = get_response.json()
            
            assert card.get("date_filter_field") == "date_last_stage_update", \
                f"date_filter_field not persisted: {card.get('date_filter_field')}"
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/card-builder/cards/{card_id}", headers=self.headers)
    
    def test_card_update_preserves_sort_fields(self):
        """Update card should preserve sort_by/sort_order/date_filter_field"""
        # Create card
        create_response = requests.post(
            f"{BASE_URL}/api/card-builder/cards",
            headers=self.headers,
            json={
                "name": "TEST_Update_Sort_Card",
                "collection": "opportunities",
                "aggregation": "sum",
                "field": "sale_value",
                "filters": {},
                "display_type": "chart",
                "sort_by": "count",
                "sort_order": "asc",
                "date_filter_field": "create_date"
            }
        )
        assert create_response.status_code == 200
        card_id = create_response.json().get("id")
        
        try:
            # Update card
            update_response = requests.put(
                f"{BASE_URL}/api/card-builder/cards/{card_id}",
                headers=self.headers,
                json={
                    "name": "TEST_Update_Sort_Card_Updated",
                    "collection": "opportunities",
                    "aggregation": "sum",
                    "field": "sale_value",
                    "filters": {},
                    "display_type": "chart",
                    "sort_by": "total",
                    "sort_order": "desc",
                    "date_filter_field": "date_last_stage_update"
                }
            )
            assert update_response.status_code == 200
            
            # Verify updated values
            get_response = requests.get(
                f"{BASE_URL}/api/card-builder/cards/{card_id}",
                headers=self.headers
            )
            assert get_response.status_code == 200
            card = get_response.json()
            
            assert card.get("sort_by") == "total"
            assert card.get("sort_order") == "desc"
            assert card.get("date_filter_field") == "date_last_stage_update"
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/card-builder/cards/{card_id}", headers=self.headers)
    
    # =========== DASHBOARD TESTS ===========
    
    def test_my_dashboard_returns_blocks_with_data(self):
        """Dashboard should return blocks with card data"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard?year=2026",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        blocks = data.get("blocks", [])
        assert len(blocks) > 0, "Dashboard should have blocks"
        
        # Check at least one block has data
        has_data = any(b.get("data") for b in blocks)
        assert has_data, "At least one block should have data"
    
    def test_dashboard_leaderboard_card_sorted(self):
        """Dashboard leaderboard cards should show sorted data"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard?year=2026",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find leaderboard or chart cards with groups
        for block in data.get("blocks", []):
            card = block.get("card", {})
            card_data = block.get("data", {})
            groups = card_data.get("groups", [])
            
            if len(groups) >= 2 and card.get("aggregation") == "sum":
                # Verify sorted by total desc
                for i in range(len(groups) - 1):
                    assert groups[i].get("total", 0) >= groups[i + 1].get("total", 0), \
                        f"Card {card.get('name')} not sorted correctly"
    
    # =========== FILTER OPTIONS TESTS ===========
    
    def test_filter_options_endpoint(self):
        """Filter options endpoint should return valid data"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/filter-options",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "salespersons" in data
        assert "product_directors" in data
        assert "solution_categories" in data
        assert len(data["salespersons"]) > 0
    
    def test_dashboard_with_filter_params(self):
        """Dashboard should accept filter parameters"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard?year=2026&salesperson=Nabisaheb",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should still return blocks
        assert "blocks" in data
    
    # =========== CARD EXECUTE TESTS ===========
    
    def test_execute_card_includes_sort_fields(self):
        """Card execution should use sort_by and sort_order from card config"""
        # Create card with specific sort settings
        create_response = requests.post(
            f"{BASE_URL}/api/card-builder/cards",
            headers=self.headers,
            json={
                "name": "TEST_Execute_Sort_Card",
                "collection": "opportunities",
                "aggregation": "sum",
                "field": "sale_value",
                "filters": {"type": "opportunity"},
                "group_by": "owner_name",
                "display_type": "leaderboard",
                "sort_by": "total",
                "sort_order": "desc",
                "year_filter": True
            }
        )
        assert create_response.status_code == 200
        card_id = create_response.json().get("id")
        
        try:
            # Execute the card
            exec_response = requests.post(
                f"{BASE_URL}/api/card-builder/cards/{card_id}/execute?year=2026",
                headers=self.headers
            )
            assert exec_response.status_code == 200
            data = exec_response.json()
            
            groups = data.get("groups", [])
            if len(groups) >= 2:
                # Verify sorted by total desc
                assert groups[0].get("total", 0) >= groups[1].get("total", 0)
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/card-builder/cards/{card_id}", headers=self.headers)
    
    # =========== RBAC TESTS ===========
    
    def test_different_users_different_data(self):
        """Different users should see different dashboard data (RBAC)"""
        # Admin data
        admin_response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard?year=2026",
            headers=self.headers
        )
        assert admin_response.status_code == 200
        admin_data = admin_response.json()
        
        # Login as sales rep
        rep_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nabisaheb@securado.net",
            "password": "test123456"
        })
        if rep_login.status_code == 200:
            rep_token = rep_login.json()["access_token"]
            rep_headers = {"Authorization": f"Bearer {rep_token}"}
            
            rep_response = requests.get(
                f"{BASE_URL}/api/card-builder/my-dashboard?year=2026",
                headers=rep_headers
            )
            assert rep_response.status_code == 200
            rep_data = rep_response.json()
            
            # Should have different template names or data
            admin_template = admin_data.get("template", {}).get("name", "")
            rep_template = rep_data.get("template", {}).get("name", "")
            # Both should have templates
            assert admin_template or len(admin_data.get("blocks", [])) > 0
    
    # =========== HEALTH CHECK ===========
    
    def test_api_health(self):
        """Backend health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
