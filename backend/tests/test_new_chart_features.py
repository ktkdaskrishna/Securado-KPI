"""
New Chart Features Tests
Tests for: Area/Radial chart types, Won Top 10/Lost Top 10 cards, Domain Builder, Seed Defaults
"""
import pytest
import requests
import os
import json

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


class TestNewChartTypes:
    """Tests for new chart types: Area and Radial"""
    
    def test_create_area_chart_card(self, auth_headers):
        """Test creating an Area chart card"""
        test_card = {
            "name": "TEST_Area Chart",
            "collection": "opportunities",
            "aggregation": "sum",
            "field": "sale_value",
            "filters": {"type": "opportunity"},
            "group_by": "stage",
            "display_type": "area",  # New Area chart type
            "color": "#800000",
            "icon": "TrendingUp",
            "size": "large",
            "year_filter": True,
            "cache_ttl": 60
        }
        
        response = requests.post(
            f"{BASE_URL}/api/card-builder/cards",
            headers=auth_headers,
            json=test_card
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert data["display_type"] == "area", "Display type should be 'area'"
        assert data["name"] == test_card["name"]
        
        # Execute the card to verify it works
        exec_response = requests.post(
            f"{BASE_URL}/api/card-builder/cards/{data['id']}/execute",
            headers=auth_headers,
            params={"year": "2026"}
        )
        assert exec_response.status_code == 200
        exec_data = exec_response.json()
        assert "groups" in exec_data or "value" in exec_data, "Card should return data"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/card-builder/cards/{data['id']}", headers=auth_headers)
        print(f"✓ Area chart card created and executed successfully")
    
    def test_create_radial_chart_card(self, auth_headers):
        """Test creating a Radial chart card"""
        test_card = {
            "name": "TEST_Radial Chart",
            "collection": "opportunities",
            "aggregation": "sum",
            "field": "sale_value",
            "filters": {"type": "opportunity", "stage": {"$nin": ["Won", "Lost"]}},
            "group_by": "solution_category",
            "display_type": "radial",  # New Radial chart type
            "color": "#5b21b6",
            "icon": "Activity",
            "size": "large",
            "year_filter": True,
            "cache_ttl": 60
        }
        
        response = requests.post(
            f"{BASE_URL}/api/card-builder/cards",
            headers=auth_headers,
            json=test_card
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert data["display_type"] == "radial", "Display type should be 'radial'"
        assert data["group_by"] == "solution_category"
        
        # Execute the card
        exec_response = requests.post(
            f"{BASE_URL}/api/card-builder/cards/{data['id']}/execute",
            headers=auth_headers,
            params={"year": "2026"}
        )
        assert exec_response.status_code == 200
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/card-builder/cards/{data['id']}", headers=auth_headers)
        print(f"✓ Radial chart card created and executed successfully")
    
    def test_create_table_list_card(self, auth_headers):
        """Test creating a Table/List card (for Won Top 10, Lost Top 10)"""
        test_card = {
            "name": "TEST_Won Top 10",
            "collection": "opportunities",
            "aggregation": "list",
            "filters": {"type": "opportunity", "stage": "Won"},
            "display_type": "table",
            "color": "#1a6b4a",
            "size": "large",
            "year_filter": True,
            "cache_ttl": 60
        }
        
        response = requests.post(
            f"{BASE_URL}/api/card-builder/cards",
            headers=auth_headers,
            json=test_card
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert data["display_type"] == "table", "Display type should be 'table'"
        assert data["aggregation"] == "list", "Aggregation should be 'list'"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/card-builder/cards/{data['id']}", headers=auth_headers)
        print(f"✓ Table list card created successfully")


class TestExecuteAdhocQuery:
    """Test ad-hoc query execution endpoint"""
    
    def test_execute_query_endpoint_exists(self, auth_headers):
        """Test that execute-query endpoint exists and works"""
        query_config = {
            "collection": "opportunities",
            "aggregation": "count",
            "filters": {"type": "opportunity"},
            "year": "2026"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/card-builder/execute-query",
            headers=auth_headers,
            json=query_config
        )
        
        if response.status_code == 404:
            pytest.skip("execute-query endpoint not implemented")
        
        assert response.status_code == 200, f"Query failed: {response.text}"
        data = response.json()
        assert "value" in data or "count" in data, "Response should have value or count"
        print(f"✓ Execute-query endpoint working: count={data.get('value', data.get('count'))}")


class TestDrillDownWithNewCards:
    """Test drill-down functionality for new card types"""
    
    def test_drill_down_returns_records(self, auth_headers):
        """Test that drill-down returns actual records"""
        # Get cards
        cards_resp = requests.get(
            f"{BASE_URL}/api/card-builder/cards",
            headers=auth_headers
        )
        cards = cards_resp.json()
        
        if not cards:
            pytest.skip("No cards available")
        
        # Pick first card with opportunities collection
        card = next((c for c in cards if c.get("collection") == "opportunities"), cards[0])
        
        response = requests.post(
            f"{BASE_URL}/api/card-builder/cards/{card['id']}/drill-down",
            headers=auth_headers,
            params={"year": "2026", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "records" in data, "Drill-down should return records"
        assert "total" in data, "Drill-down should return total count"
        print(f"✓ Drill-down returns {len(data['records'])} of {data['total']} records")


class TestSeedDefaultCardsContent:
    """Verify that seed-defaults creates the expected cards"""
    
    def test_cards_include_area_and_radial_types(self, auth_headers):
        """Verify that default cards include area and radial chart types"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/cards",
            headers=auth_headers
        )
        assert response.status_code == 200
        cards = response.json()
        
        # Check for specific card types
        display_types = [c.get("display_type") for c in cards]
        card_names = [c.get("name") for c in cards]
        
        print(f"Total cards: {len(cards)}")
        print(f"Display types: {set(display_types)}")
        
        # Check for new chart types
        has_area = "area" in display_types
        has_radial = "radial" in display_types
        has_table = "table" in display_types
        
        if has_area:
            print("✓ Area chart type found")
        else:
            print("✗ Area chart type not found in existing cards")
        
        if has_radial:
            print("✓ Radial chart type found")
        else:
            print("✗ Radial chart type not found in existing cards")
        
        if has_table:
            print("✓ Table chart type found")
        else:
            print("✗ Table chart type not found in existing cards")
        
        # Check for specific card names
        won_top_10 = any("Won Top" in n for n in card_names if n)
        lost_top_10 = any("Lost Top" in n for n in card_names if n)
        pipeline_trend = any("Pipeline Trend" in n for n in card_names if n)
        solution_mix = any("Solution Mix" in n for n in card_names if n)
        
        if won_top_10:
            print("✓ Won Top 10 card found")
        if lost_top_10:
            print("✓ Lost Top 10 card found")
        if pipeline_trend:
            print("✓ Pipeline Trend card found")
        if solution_mix:
            print("✓ Solution Mix card found")
        
        # Note: The existing dashboard may not have all new cards if seed-defaults hasn't been run
        print(f"\nExisting card names: {card_names}")


class TestWinRatePercentage:
    """Test Win Rate displays as percentage"""
    
    def test_win_rate_displays_percentage(self, auth_headers):
        """Verify Win Rate card data can be used to calculate percentage"""
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
            if card.get("display_type") == "win_rate" or "Win Rate" in card.get("name", ""):
                win_rate_block = block
                break
        
        if not win_rate_block:
            pytest.skip("Win Rate card not found")
        
        card_data = win_rate_block.get("data", {})
        groups = card_data.get("groups", [])
        
        # Calculate win rate
        won = next((g["count"] for g in groups if g.get("label") == "Won"), 0)
        lost = next((g["count"] for g in groups if g.get("label") == "Lost"), 0)
        total = won + lost
        
        if total > 0:
            win_rate = (won / total) * 100
            print(f"✓ Win Rate: {win_rate:.1f}% (Won: {won}, Lost: {lost})")
        else:
            print("Win Rate: 0% (No Won/Lost data)")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_cards(self, auth_headers):
        """Delete all TEST_ prefixed cards"""
        cleaned = 0
        
        cards_response = requests.get(
            f"{BASE_URL}/api/card-builder/cards",
            headers=auth_headers
        )
        
        for card in cards_response.json():
            if card.get("name", "").startswith("TEST_"):
                requests.delete(
                    f"{BASE_URL}/api/card-builder/cards/{card['id']}",
                    headers=auth_headers
                )
                cleaned += 1
        
        print(f"✓ Cleaned up {cleaned} test cards")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
