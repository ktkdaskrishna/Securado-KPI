"""
Card Builder API Tests
Tests for: Dashboard Cards, Templates, Layout Management, Win Rate Display
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


class TestMyDashboard:
    """Tests for GET /api/card-builder/my-dashboard"""
    
    def test_get_my_dashboard_returns_template_and_blocks(self, auth_headers):
        """Test that my-dashboard returns template and blocks"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=auth_headers,
            params={"year": "2026"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate structure
        assert "template" in data
        assert "blocks" in data
        assert data["template"] is not None, "Template should not be None"
        assert len(data["blocks"]) > 0, "Should have blocks"
        
        # Validate template structure
        template = data["template"]
        assert "id" in template
        assert "name" in template
        print(f"✓ Dashboard loaded: {template['name']} with {len(data['blocks'])} blocks")
    
    def test_win_rate_card_displays_percentage(self, auth_headers):
        """Test that Win Rate card returns data for percentage calculation"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=auth_headers,
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
        
        assert win_rate_block is not None, "Win Rate card not found"
        
        # Validate groups data for win rate calculation
        card_data = win_rate_block.get("data", {})
        groups = card_data.get("groups", [])
        assert len(groups) > 0, "Win rate card should have groups data"
        
        # Find Won and Lost counts
        won_count = next((g["count"] for g in groups if g.get("label") == "Won"), 0)
        lost_count = next((g["count"] for g in groups if g.get("label") == "Lost"), 0)
        
        # Calculate win rate
        total = won_count + lost_count
        if total > 0:
            win_rate = (won_count / total) * 100
            print(f"✓ Win Rate: {win_rate:.1f}% (Won: {won_count}, Lost: {lost_count})")
        else:
            print("✓ Win Rate: 0% (No Won/Lost data)")
        
        assert won_count >= 0
        assert lost_count >= 0


class TestTemplatesCRUD:
    """Tests for Template CRUD operations"""
    
    def test_list_templates(self, auth_headers):
        """Test listing all templates"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/templates",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} templates")
        return data
    
    def test_create_template(self, auth_headers):
        """Test creating a new template"""
        test_template = {
            "name": "TEST_New Dashboard Template",
            "description": "Test template created by automated tests",
            "cards": [],
            "assigned_roles": ["sales_rep"],
            "is_default": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/card-builder/templates",
            headers=auth_headers,
            json=test_template
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["name"] == test_template["name"]
        assert data["description"] == test_template["description"]
        assert data["assigned_roles"] == test_template["assigned_roles"]
        
        print(f"✓ Created template: {data['id']}")
        return data
    
    def test_update_template(self, auth_headers):
        """Test updating a template"""
        # First create a template
        create_response = requests.post(
            f"{BASE_URL}/api/card-builder/templates",
            headers=auth_headers,
            json={
                "name": "TEST_Update Template",
                "description": "Original description",
                "cards": [],
                "assigned_roles": [],
                "is_default": False
            }
        )
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Update the template
        update_response = requests.put(
            f"{BASE_URL}/api/card-builder/templates/{template_id}",
            headers=auth_headers,
            json={
                "name": "TEST_Update Template MODIFIED",
                "description": "Updated description",
                "cards": [],
                "assigned_roles": ["admin", "sales_admin"],
                "is_default": False
            }
        )
        assert update_response.status_code == 200
        assert update_response.json()["success"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/card-builder/templates/{template_id}", headers=auth_headers)
        print(f"✓ Template updated successfully")
    
    def test_delete_template(self, auth_headers):
        """Test deleting a template"""
        # Create a template first
        create_response = requests.post(
            f"{BASE_URL}/api/card-builder/templates",
            headers=auth_headers,
            json={
                "name": "TEST_Delete Template",
                "description": "To be deleted",
                "cards": [],
                "assigned_roles": [],
                "is_default": False
            }
        )
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/card-builder/templates/{template_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] == True
        
        print(f"✓ Template deleted: {template_id}")


class TestLayoutManagement:
    """Tests for template layout save functionality"""
    
    def test_save_template_layout(self, auth_headers):
        """Test saving layout for a template"""
        # Get current template
        dashboard_response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard",
            headers=auth_headers
        )
        assert dashboard_response.status_code == 200
        template_id = dashboard_response.json()["template"]["id"]
        
        # Get current blocks to restore later
        current_blocks = dashboard_response.json()["blocks"]
        
        # Save a test layout
        test_blocks = [
            {"i": "test-1", "x": 0, "y": 0, "w": 3, "h": 1, "type": "query_card", "card_id": "test-card-1"}
        ]
        
        save_response = requests.post(
            f"{BASE_URL}/api/card-builder/templates/{template_id}/layout",
            headers=auth_headers,
            json={"blocks": test_blocks}
        )
        assert save_response.status_code == 200
        assert save_response.json()["success"] == True
        
        # Restore original layout
        restore_blocks = [
            {
                "i": b.get("i") or b.get("card_id"),
                "x": b.get("x", 0),
                "y": b.get("y", 0),
                "w": b.get("w", 3),
                "h": b.get("h", 1),
                "type": b.get("type", "query_card"),
                "card_id": b.get("card_id")
            }
            for b in current_blocks if b.get("card_id")
        ]
        
        requests.post(
            f"{BASE_URL}/api/card-builder/templates/{template_id}/layout",
            headers=auth_headers,
            json={"blocks": restore_blocks}
        )
        
        print(f"✓ Layout saved and restored for template: {template_id}")


class TestAvailableRoles:
    """Tests for available roles endpoint"""
    
    def test_get_available_roles(self, auth_headers):
        """Test getting available roles for template assignment"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/available-roles",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have at least one role"
        
        # Validate role structure
        role = data[0]
        if isinstance(role, dict):
            # Dict format: {"id": "...", "name": "..."}
            assert "id" in role or "name" in role
        else:
            # String format
            assert isinstance(role, str)
        
        print(f"✓ Available roles: {len(data)}")
        return data


class TestCards:
    """Tests for dashboard cards"""
    
    def test_list_cards(self, auth_headers):
        """Test listing all cards"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/cards",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Validate card structure
        if data:
            card = data[0]
            assert "id" in card
            assert "name" in card
            assert "display_type" in card
            assert "collection" in card
        
        print(f"✓ Listed {len(data)} cards")
        return data
    
    def test_execute_card(self, auth_headers):
        """Test executing a card query"""
        # Get cards first
        cards_response = requests.get(
            f"{BASE_URL}/api/card-builder/cards",
            headers=auth_headers
        )
        cards = cards_response.json()
        
        if not cards:
            pytest.skip("No cards available")
        
        card = cards[0]
        
        response = requests.post(
            f"{BASE_URL}/api/card-builder/cards/{card['id']}/execute",
            headers=auth_headers,
            params={"year": "2026"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "card_id" in data
        assert "card_name" in data
        assert "display_type" in data
        
        print(f"✓ Executed card '{card['name']}': display_type={data['display_type']}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_templates(self, auth_headers):
        """Delete all TEST_ prefixed templates"""
        cleaned = 0
        
        templates_response = requests.get(
            f"{BASE_URL}/api/card-builder/templates",
            headers=auth_headers
        )
        
        for template in templates_response.json():
            if template.get("name", "").startswith("TEST_"):
                requests.delete(
                    f"{BASE_URL}/api/card-builder/templates/{template['id']}",
                    headers=auth_headers
                )
                cleaned += 1
        
        print(f"✓ Cleaned up {cleaned} test templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
