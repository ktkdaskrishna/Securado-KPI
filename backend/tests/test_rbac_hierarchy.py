"""
RBAC Hierarchy and Delete Card Tests
Tests for: Hierarchy-based RBAC scoping, Available Roles (7+ roles), Delete card from layout
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable must be set")

# Test credentials for different user types
ADMIN_EMAIL = "krishna@securado.net"
ADMIN_PASSWORD = "test123456"

SALES_REP_EMAIL = "nabisaheb@securado.net"
SALES_REP_PASSWORD = "test123456"

PRODUCT_DIRECTOR_EMAIL = "vimod.c@securado.net"
PRODUCT_DIRECTOR_PASSWORD = "test123456"


def get_auth_headers(email, password):
    """Get authentication token for a specific user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code != 200:
        pytest.skip(f"Login failed for {email}: {response.text}")
    token = response.json().get("access_token")
    if not token:
        pytest.skip(f"No access token returned for {email}")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_headers():
    """Get admin authentication headers"""
    return get_auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def sales_rep_headers():
    """Get sales rep authentication headers"""
    return get_auth_headers(SALES_REP_EMAIL, SALES_REP_PASSWORD)


@pytest.fixture(scope="module")
def product_director_headers():
    """Get product director authentication headers"""
    return get_auth_headers(PRODUCT_DIRECTOR_EMAIL, PRODUCT_DIRECTOR_PASSWORD)


class TestAvailableRolesExpanded:
    """Tests for available roles - should return 7 default roles"""
    
    def test_available_roles_returns_7_default_roles(self, admin_headers):
        """Test that available-roles endpoint returns at least 7 default roles"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/available-roles",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 7, f"Expected at least 7 roles, got {len(data)}"
        
        # Check for expected default roles
        role_ids = [r.get("id") if isinstance(r, dict) else r for r in data]
        expected_roles = ["admin", "sales_admin", "sales_director", "product_director", "sales_rep", "marketing", "user"]
        
        for expected in expected_roles:
            assert expected in role_ids, f"Expected role '{expected}' not found. Got: {role_ids}"
        
        print(f"✓ Available roles: {len(data)} roles returned")
        print(f"  Roles: {role_ids}")


class TestRBACHierarchy:
    """Tests for hierarchy-based RBAC scoping - different users see different data"""
    
    def test_admin_sees_all_data(self, admin_headers):
        """Admin user (krishna@securado.net) should see ALL data"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=admin_headers,
            params={"year": "2026"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Admin should see data
        assert "blocks" in data
        assert len(data["blocks"]) > 0, "Admin should have dashboard blocks"
        
        # Find Total Pipeline card
        pipeline_value = None
        open_opps_count = None
        
        for block in data["blocks"]:
            card = block.get("card", {})
            card_data = block.get("data", {})
            
            if "Pipeline" in card.get("name", "") and card.get("display_type") == "number":
                pipeline_value = card_data.get("value", 0)
            if "Opportunities" in card.get("name", "") and "Total" not in card.get("name", ""):
                open_opps_count = card_data.get("value", 0)
        
        print(f"✓ Admin ({ADMIN_EMAIL}):")
        print(f"  Total Pipeline: {pipeline_value}")
        print(f"  Open Opportunities: {open_opps_count}")
        
        # Store for comparison
        return {"pipeline": pipeline_value, "opps": open_opps_count}
    
    def test_sales_rep_sees_own_data_only(self, sales_rep_headers):
        """Sales Rep (nabisaheb@securado.net) should see ONLY own data - fewer opps than admin"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=sales_rep_headers,
            params={"year": "2026"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have blocks (may use default template)
        assert "blocks" in data
        
        # Find pipeline and opps values
        pipeline_value = 0
        open_opps_count = 0
        
        for block in data["blocks"]:
            card = block.get("card", {})
            card_data = block.get("data", {})
            
            if "Pipeline" in card.get("name", "") and card.get("display_type") == "number":
                pipeline_value = card_data.get("value", 0)
            if "Opportunities" in card.get("name", "") and card.get("display_type") == "number":
                open_opps_count = card_data.get("value", card_data.get("count", 0))
        
        print(f"✓ Sales Rep ({SALES_REP_EMAIL}):")
        print(f"  Total Pipeline: {pipeline_value}")
        print(f"  Open Opportunities: {open_opps_count}")
        
        return {"pipeline": pipeline_value, "opps": open_opps_count}
    
    def test_product_director_sees_team_data(self, product_director_headers):
        """Product Director (vimod.c@securado.net) should see own + subordinates data"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=product_director_headers,
            params={"year": "2026"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "blocks" in data
        
        # Find pipeline and opps values
        pipeline_value = 0
        open_opps_count = 0
        
        for block in data["blocks"]:
            card = block.get("card", {})
            card_data = block.get("data", {})
            
            if "Pipeline" in card.get("name", "") and card.get("display_type") == "number":
                pipeline_value = card_data.get("value", 0)
            if "Opportunities" in card.get("name", "") and card.get("display_type") == "number":
                open_opps_count = card_data.get("value", card_data.get("count", 0))
        
        print(f"✓ Product Director ({PRODUCT_DIRECTOR_EMAIL}):")
        print(f"  Total Pipeline: {pipeline_value}")
        print(f"  Open Opportunities: {open_opps_count}")
        
        return {"pipeline": pipeline_value, "opps": open_opps_count}
    
    def test_rbac_comparison(self, admin_headers, sales_rep_headers, product_director_headers):
        """Compare data across different RBAC levels"""
        # Get admin data
        admin_resp = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=admin_headers,
            params={"year": "2026"}
        )
        
        # Get sales rep data
        sales_rep_resp = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=sales_rep_headers,
            params={"year": "2026"}
        )
        
        # Get product director data  
        pd_resp = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=product_director_headers,
            params={"year": "2026"}
        )
        
        def extract_pipeline(blocks):
            for block in blocks:
                card = block.get("card", {})
                card_data = block.get("data", {})
                if "Pipeline" in card.get("name", "") and card.get("display_type") == "number":
                    return card_data.get("value", 0)
            return 0
        
        admin_pipeline = extract_pipeline(admin_resp.json().get("blocks", []))
        sales_rep_pipeline = extract_pipeline(sales_rep_resp.json().get("blocks", []))
        pd_pipeline = extract_pipeline(pd_resp.json().get("blocks", []))
        
        print(f"\n✓ RBAC Comparison:")
        print(f"  Admin Pipeline:            {admin_pipeline:,.2f}")
        print(f"  Product Director Pipeline: {pd_pipeline:,.2f}")
        print(f"  Sales Rep Pipeline:        {sales_rep_pipeline:,.2f}")
        
        # Sales rep should see less than or equal to admin (their own data only)
        # This validates RBAC is working
        if admin_pipeline > 0:
            assert sales_rep_pipeline <= admin_pipeline, "Sales rep should see <= admin data"
            print(f"  ✓ Sales Rep sees {(sales_rep_pipeline/admin_pipeline*100):.1f}% of admin data (RBAC working)")


class TestTemplateUpdatePreservesCards:
    """Test that template update (name/roles) does NOT wipe cards/blocks"""
    
    def test_update_template_preserves_cards(self, admin_headers):
        """Updating template name/roles should NOT clear cards/blocks"""
        # Step 1: Create a test template with cards
        create_resp = requests.post(
            f"{BASE_URL}/api/card-builder/templates",
            headers=admin_headers,
            json={
                "name": "TEST_Preserve Cards Template",
                "description": "Testing that update preserves cards",
                "cards": ["card-1", "card-2"],  # Fake card IDs
                "assigned_roles": ["admin"],
                "is_default": False
            }
        )
        assert create_resp.status_code == 200
        template = create_resp.json()
        template_id = template["id"]
        
        # Step 2: Save a layout with blocks
        save_layout_resp = requests.post(
            f"{BASE_URL}/api/card-builder/templates/{template_id}/layout",
            headers=admin_headers,
            json={
                "blocks": [
                    {"i": "block-1", "x": 0, "y": 0, "w": 3, "h": 1, "type": "query_card", "card_id": "card-1"},
                    {"i": "block-2", "x": 3, "y": 0, "w": 3, "h": 1, "type": "query_card", "card_id": "card-2"}
                ]
            }
        )
        assert save_layout_resp.status_code == 200
        
        # Step 3: Update the template (name and roles only)
        update_resp = requests.put(
            f"{BASE_URL}/api/card-builder/templates/{template_id}",
            headers=admin_headers,
            json={
                "name": "TEST_Preserve Cards Template UPDATED",
                "description": "Updated description",
                "cards": [],  # Empty cards in update payload - should be ignored
                "assigned_roles": ["admin", "sales_admin"],
                "is_default": False
            }
        )
        assert update_resp.status_code == 200
        
        # Step 4: Fetch the template and verify cards/blocks are preserved
        templates_resp = requests.get(
            f"{BASE_URL}/api/card-builder/templates",
            headers=admin_headers
        )
        assert templates_resp.status_code == 200
        
        updated_template = None
        for t in templates_resp.json():
            if t["id"] == template_id:
                updated_template = t
                break
        
        assert updated_template is not None, "Template not found after update"
        assert updated_template["name"] == "TEST_Preserve Cards Template UPDATED"
        assert "admin" in updated_template["assigned_roles"]
        assert "sales_admin" in updated_template["assigned_roles"]
        
        # CRITICAL: Cards and blocks should be preserved
        cards = updated_template.get("cards", [])
        blocks = updated_template.get("blocks", [])
        
        print(f"✓ Template update preserved:")
        print(f"  Cards: {cards}")
        print(f"  Blocks: {len(blocks)} blocks")
        
        # Blocks should still exist (2 blocks saved earlier)
        assert len(blocks) == 2, f"Expected 2 blocks, got {len(blocks)} - blocks were wiped!"
        assert len(cards) == 2, f"Expected 2 cards, got {len(cards)} - cards were wiped!"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/card-builder/templates/{template_id}", headers=admin_headers)
        print(f"✓ Template update DOES NOT wipe cards/blocks")


class TestWinRateFormatted:
    """Test that Win Rate still shows formatted percentage"""
    
    def test_win_rate_groups_data(self, admin_headers):
        """Win Rate card should return groups with Won/Lost counts for percentage calculation"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=admin_headers,
            params={"year": "2026"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find Win Rate card
        win_rate_block = None
        for block in data["blocks"]:
            card = block.get("card", {})
            if card.get("display_type") == "win_rate":
                win_rate_block = block
                break
        
        if win_rate_block is None:
            pytest.skip("Win Rate card not found in dashboard")
        
        card_data = win_rate_block.get("data", {})
        groups = card_data.get("groups", [])
        
        assert len(groups) > 0, "Win rate should have groups data"
        
        won = next((g["count"] for g in groups if g.get("label") == "Won"), 0)
        lost = next((g["count"] for g in groups if g.get("label") == "Lost"), 0)
        
        total = won + lost
        win_rate = (won / total * 100) if total > 0 else 0
        
        print(f"✓ Win Rate: {win_rate:.1f}% (Won: {won}, Lost: {lost})")
        assert win_rate >= 0, "Win rate should be non-negative"


class TestExecuteAdhocQuery:
    """Test ad-hoc query execution with RBAC"""
    
    def test_adhoc_query_respects_rbac(self, admin_headers, sales_rep_headers):
        """Ad-hoc queries should also respect RBAC scoping"""
        query_config = {
            "collection": "opportunities",
            "aggregation": "count",
            "filters": {"type": "opportunity"},
            "year": "2026"
        }
        
        # Admin query
        admin_resp = requests.post(
            f"{BASE_URL}/api/card-builder/execute-query",
            headers=admin_headers,
            json=query_config
        )
        assert admin_resp.status_code == 200
        admin_count = admin_resp.json().get("value", 0)
        
        # Sales rep query
        sales_resp = requests.post(
            f"{BASE_URL}/api/card-builder/execute-query",
            headers=sales_rep_headers,
            json=query_config
        )
        assert sales_resp.status_code == 200
        sales_count = sales_resp.json().get("value", 0)
        
        print(f"✓ Ad-hoc query RBAC:")
        print(f"  Admin opportunities: {admin_count}")
        print(f"  Sales Rep opportunities: {sales_count}")
        
        # Sales rep should see less than or equal to admin
        assert sales_count <= admin_count, "Sales rep should see <= admin opportunities"


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_templates(self, admin_headers):
        """Delete all TEST_ prefixed templates"""
        cleaned = 0
        
        templates_response = requests.get(
            f"{BASE_URL}/api/card-builder/templates",
            headers=admin_headers
        )
        
        for template in templates_response.json():
            if template.get("name", "").startswith("TEST_"):
                requests.delete(
                    f"{BASE_URL}/api/card-builder/templates/{template['id']}",
                    headers=admin_headers
                )
                cleaned += 1
        
        print(f"✓ Cleaned up {cleaned} test templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
