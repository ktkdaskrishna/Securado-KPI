"""
Iteration 27 - Test new features:
1. Activity creation + completion toggle in Opportunities
2. Account alert summary - only count companies with overdue 
3. AI Activity Recommendations in Performance Hub
4. Excel/PDF report export in AI Assistant
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "krishna@securado.net"
ADMIN_PASSWORD = "test123456"
DIRECTOR_EMAIL = "vimod.c@securado.net"
DIRECTOR_PASSWORD = "test123456"


class TestAuth:
    """Authentication tests"""

    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 0
        print(f"Admin login successful - token: {data['access_token'][:20]}...")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get admin auth headers"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }


class TestAccountsOverdueCount:
    """Test accounts endpoint - with_overdue should only count companies"""

    def test_accounts_endpoint_returns_summary(self, admin_headers):
        """Test /api/accounts returns correct summary with companies-only overdue count"""
        response = requests.get(f"{BASE_URL}/api/accounts", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()

        assert "summary" in data
        assert "data" in data
        summary = data["summary"]

        # Verify summary fields exist
        assert "total" in summary
        assert "companies" in summary
        assert "contacts" in summary
        assert "with_overdue" in summary

        print(f"Accounts summary: {json.dumps(summary, indent=2)}")

        # Verify with_overdue <= companies (can't have more overdue than companies)
        assert summary["with_overdue"] <= summary["companies"], (
            f"with_overdue ({summary['with_overdue']}) should be <= companies ({summary['companies']})"
        )

        # Verify with_overdue only counts companies with is_company=True
        accounts_data = data["data"]
        overdue_companies = [
            a for a in accounts_data if a.get("has_overdue") and a.get("is_company")
        ]
        assert summary["with_overdue"] == len(overdue_companies), (
            f"with_overdue ({summary['with_overdue']}) should equal count of companies with has_overdue ({len(overdue_companies)})"
        )

    def test_accounts_entity_type_company_filter(self, admin_headers):
        """Test filtering by entity_type=company"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?entity_type=company", headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()

        # All returned items should be companies
        for item in data.get("data", []):
            assert item.get("is_company") == True, f"Item {item.get('name')} should be company"


class TestOpportunityActivities:
    """Test opportunity activity creation and toggle"""

    @pytest.fixture
    def test_opportunity_id(self, admin_headers):
        """Get a test opportunity ID"""
        response = requests.get(
            f"{BASE_URL}/api/opportunities?limit=10", headers=admin_headers
        )
        if response.status_code == 200:
            data = response.json()
            # Handle both "items" and "data" response formats
            opps = data.get("items", []) or data.get("data", [])
            if opps:
                return opps[0].get("canonical_id")
        pytest.skip("No opportunities available for testing")

    def test_get_opportunity_activities(self, admin_headers, test_opportunity_id):
        """Test getting activities for an opportunity"""
        response = requests.get(
            f"{BASE_URL}/api/opportunities/{test_opportunity_id}/activities",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} activities for opportunity {test_opportunity_id}")

    def test_create_opportunity_activity(self, admin_headers, test_opportunity_id):
        """Test creating a new activity for an opportunity"""
        activity_data = {
            "type": "Call",
            "subject": "TEST_Activity_from_iteration_27",
            "description": "Test activity created by automated tests",
            "date_deadline": "2026-02-15",
            "assigned_user": "Test User",
        }
        response = requests.post(
            f"{BASE_URL}/api/opportunities/{test_opportunity_id}/activities",
            headers=admin_headers,
            json=activity_data,
        )
        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "id" in data
        assert data["subject"] == "TEST_Activity_from_iteration_27"
        assert data["type"] == "call"  # Type is lowercased
        assert data["completed"] == False
        assert data["source_system"] == "local"

        print(f"Created activity: {data['id']}")
        return data["id"]

    def test_update_activity_toggle_complete(self, admin_headers, test_opportunity_id):
        """Test toggling activity completion status"""
        # First create an activity
        create_data = {
            "type": "To Do",
            "subject": "TEST_Toggle_Activity_iteration_27",
        }
        create_response = requests.post(
            f"{BASE_URL}/api/opportunities/{test_opportunity_id}/activities",
            headers=admin_headers,
            json=create_data,
        )
        assert create_response.status_code == 200
        activity_id = create_response.json()["id"]

        # Toggle to complete
        toggle_response = requests.patch(
            f"{BASE_URL}/api/opportunities/{test_opportunity_id}/activities/{activity_id}",
            headers=admin_headers,
            json={"completed": True},
        )
        assert toggle_response.status_code == 200
        assert toggle_response.json().get("success") == True
        print(f"Activity {activity_id} toggled to completed")

        # Toggle back to incomplete
        toggle_back = requests.patch(
            f"{BASE_URL}/api/opportunities/{test_opportunity_id}/activities/{activity_id}",
            headers=admin_headers,
            json={"completed": False},
        )
        assert toggle_back.status_code == 200
        print(f"Activity {activity_id} toggled back to pending")


class TestAIRecommendActivities:
    """Test AI activity recommendations endpoint"""

    def test_recommend_activities_basic(self, admin_headers):
        """Test the recommend-activities endpoint returns recommendations"""
        payload = {
            "segment_name": "Networking",
            "target_amount": 100000,
            "product_manager": "Manickath Vimod Chandran",
        }
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/recommend-activities",
            headers=admin_headers,
            json=payload,
        )
        assert response.status_code == 200
        data = response.json()

        assert "recommendations" in data
        recommendations = data["recommendations"]
        assert isinstance(recommendations, list)
        assert len(recommendations) >= 1, "Should have at least 1 recommendation"

        # Verify recommendation structure
        for rec in recommendations[:3]:
            assert "type" in rec
            assert "title" in rec
            assert "description" in rec
            assert "priority" in rec
            assert "impact" in rec

        print(f"Got {len(recommendations)} AI activity recommendations")
        print(f"First recommendation: {recommendations[0]['title']}")

    def test_recommend_activities_with_plan_id(self, admin_headers):
        """Test recommendations with a plan_id"""
        payload = {
            "plan_id": "some-plan-id",
            "segment_name": "Enterprise",
            "target_amount": 500000,
        }
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/recommend-activities",
            headers=admin_headers,
            json=payload,
        )
        assert response.status_code == 200
        data = response.json()
        assert "recommendations" in data


class TestExportReport:
    """Test report export functionality"""

    def test_export_pipeline_excel(self, admin_headers):
        """Test exporting pipeline report as Excel"""
        payload = {"format": "excel", "type": "pipeline", "year": "2026"}
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/export-report",
            headers=admin_headers,
            json=payload,
        )
        assert response.status_code == 200

        # Verify it's an Excel file
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheetml" in content_type or "xlsx" in content_type or "octet-stream" in content_type

        # Verify file has content (> 5KB for actual data)
        content_length = len(response.content)
        assert content_length > 1000, f"Excel file too small: {content_length} bytes"
        print(f"Pipeline Excel export: {content_length} bytes")

    def test_export_performance_pdf(self, admin_headers):
        """Test exporting performance report as PDF"""
        payload = {"format": "pdf", "type": "performance", "year": "2026"}
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/export-report",
            headers=admin_headers,
            json=payload,
        )
        assert response.status_code == 200

        # Verify it's a PDF file
        content_type = response.headers.get("Content-Type", "")
        assert "pdf" in content_type or "octet-stream" in content_type

        content_length = len(response.content)
        assert content_length > 500, f"PDF file too small: {content_length} bytes"
        print(f"Performance PDF export: {content_length} bytes")

    def test_export_invoices_excel(self, admin_headers):
        """Test exporting invoices report as Excel"""
        payload = {"format": "excel", "type": "invoices", "year": "2026"}
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/export-report",
            headers=admin_headers,
            json=payload,
        )
        assert response.status_code == 200
        content_length = len(response.content)
        assert content_length > 1000, f"Invoices Excel file too small: {content_length} bytes"
        print(f"Invoices Excel export: {content_length} bytes")

    def test_export_activities_pdf(self, admin_headers):
        """Test exporting activities report as PDF"""
        payload = {"format": "pdf", "type": "activities", "year": "2026"}
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/export-report",
            headers=admin_headers,
            json=payload,
        )
        assert response.status_code == 200
        content_length = len(response.content)
        assert content_length > 500, f"Activities PDF file too small: {content_length} bytes"
        print(f"Activities PDF export: {content_length} bytes")


class TestOpportunityDetails:
    """Test opportunity detail view endpoints"""

    def test_opportunity_detail_tabs_data(self, admin_headers):
        """Test that opportunity detail has data for all tabs"""
        # Get an opportunity
        response = requests.get(
            f"{BASE_URL}/api/opportunities?limit=1", headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        opps = data.get("items", []) or data.get("data", [])
        if not opps:
            pytest.skip("No opportunities for testing")

        opp_id = opps[0]["canonical_id"]

        # Get opportunity details
        detail_response = requests.get(
            f"{BASE_URL}/api/opportunities/{opp_id}", headers=admin_headers
        )
        assert detail_response.status_code == 200

        # Get activities
        activities_response = requests.get(
            f"{BASE_URL}/api/opportunities/{opp_id}/activities", headers=admin_headers
        )
        assert activities_response.status_code == 200

        # Get logs
        logs_response = requests.get(
            f"{BASE_URL}/api/opportunities/{opp_id}/logs", headers=admin_headers
        )
        assert logs_response.status_code == 200

        print(f"Opportunity {opp_id} detail endpoints working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
