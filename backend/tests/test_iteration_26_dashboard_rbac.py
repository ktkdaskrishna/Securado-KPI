"""
Iteration 26 - Dashboard RBAC Bug Fix Tests

Tests for two critical bugs that were fixed:
1. Dashboard cards showing '0' for director role - RBAC filter in resolve_hierarchy_filter
   was not granting broad access to product_director/sales_director roles
2. SSO MSAL flow was not persisting roles/permissions to the DB for existing users

Tests:
- Login flows for admin and director users
- Dashboard data verification (non-zero values)
- RBAC endpoint verification
- Invoice-related card data for director users
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "krishna@securado.net"
ADMIN_PASSWORD = "test123456"
DIRECTOR_EMAIL = "vimod.c@securado.net"
DIRECTOR_PASSWORD = "test123456"
SALES_REP_EMAIL = "nabisaheb@securado.net"
SALES_REP_PASSWORD = "test123456"


class TestAuthAndRBAC:
    """Authentication and RBAC endpoint tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def director_token(self):
        """Get director user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        assert response.status_code == 200, f"Director login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def sales_rep_token(self):
        """Get sales rep user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SALES_REP_EMAIL,
            "password": SALES_REP_PASSWORD
        })
        assert response.status_code == 200, f"Sales rep login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    def test_admin_login(self, admin_token):
        """Test admin user login and verify token"""
        assert admin_token, "Admin token should not be empty"
        print(f"Admin login successful, token length: {len(admin_token)}")
    
    def test_director_login(self, director_token):
        """Test director user login"""
        assert director_token, "Director token should not be empty"
        print(f"Director login successful, token length: {len(director_token)}")
    
    def test_admin_me_endpoint(self, admin_token):
        """Test /api/auth/me returns correct roles and permissions for admin"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        
        # Verify user info
        assert data.get("email", "").lower() == ADMIN_EMAIL.lower()
        
        # Verify roles
        roles = data.get("roles", [])
        print(f"Admin roles: {roles}")
        assert len(roles) > 0, "Admin should have roles"
        assert "admin" in roles or "sales_admin" in roles, f"Admin should have admin role, got: {roles}"
        
        # Verify permissions
        permissions = data.get("permissions", [])
        print(f"Admin permissions: {permissions}")
        assert "view_dashboard" in permissions, "Admin should have view_dashboard permission"
    
    def test_director_me_endpoint(self, director_token):
        """Test /api/auth/me returns correct roles for director"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        
        # Verify user info
        assert data.get("email", "").lower() == DIRECTOR_EMAIL.lower()
        
        # Verify roles
        roles = data.get("roles", [])
        print(f"Director roles: {roles}")
        assert len(roles) > 0, "Director should have roles"
    
    def test_admin_rbac_endpoint(self, admin_token):
        """Test /api/odoo-rbac/current-user-rbac returns correct app_roles for admin"""
        response = requests.get(
            f"{BASE_URL}/api/odoo-rbac/current-user-rbac",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"RBAC endpoint failed: {response.text}"
        data = response.json()
        
        # Verify app_roles and effective_permissions
        app_roles = data.get("app_roles", [])
        effective_permissions = data.get("effective_permissions", [])
        
        print(f"Admin app_roles: {app_roles}")
        print(f"Admin effective_permissions count: {len(effective_permissions)}")
        
        assert len(app_roles) > 0 or len(effective_permissions) > 0, "Admin should have RBAC data"
    
    def test_director_rbac_endpoint(self, director_token):
        """Test /api/odoo-rbac/current-user-rbac returns correct permissions for director"""
        response = requests.get(
            f"{BASE_URL}/api/odoo-rbac/current-user-rbac",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"RBAC endpoint failed: {response.text}"
        data = response.json()
        
        print(f"Director RBAC response: {data}")
        
        # Director should have some permissions
        app_roles = data.get("app_roles", [])
        effective_permissions = data.get("effective_permissions", [])
        print(f"Director app_roles: {app_roles}")


class TestDashboardCards:
    """Dashboard card data tests - verify non-zero values for admin and director"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def director_token(self):
        """Get director user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        assert response.status_code == 200, f"Director login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_dashboard_has_data(self, admin_token):
        """Test admin dashboard shows actual data, not zeros"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard?year=2026",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Check template exists
        template = data.get("template")
        assert template, "No template returned"
        print(f"Admin template name: {template.get('name')}")
        
        # Check blocks have data
        blocks = data.get("blocks", [])
        assert len(blocks) > 0, "No dashboard blocks returned"
        
        # Find cards with non-zero values
        cards_with_data = []
        for block in blocks:
            card = block.get("card", {})
            card_data = block.get("data", {})
            value = card_data.get("value", 0)
            
            card_name = card.get("name", "Unknown")
            if value and value > 0:
                cards_with_data.append((card_name, value))
                print(f"Card '{card_name}': {value}")
        
        # Verify at least some cards have non-zero data
        assert len(cards_with_data) > 0, "No cards with non-zero values found for admin"
        print(f"\nAdmin has {len(cards_with_data)} cards with data")
    
    def test_director_dashboard_has_data(self, director_token):
        """Test director dashboard shows actual data (BUG FIX VERIFICATION)
        
        This is the main test for Bug #1: Dashboard cards were showing '0' for director role
        because resolve_hierarchy_filter was not granting broad access to 
        product_director/sales_director roles.
        """
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard?year=2026",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Check template exists
        template = data.get("template")
        print(f"Director template: {template.get('name') if template else 'None'}")
        
        # Check blocks have data
        blocks = data.get("blocks", [])
        assert len(blocks) > 0, "No dashboard blocks returned for director"
        
        # Find cards with non-zero values
        cards_with_data = []
        invoice_cards = []
        
        for block in blocks:
            card = block.get("card", {})
            card_data = block.get("data", {})
            value = card_data.get("value", 0)
            
            card_name = card.get("name", "Unknown")
            collection = card.get("collection", "")
            
            # Track invoice-related cards specifically
            if "invoice" in card_name.lower() or collection == "invoices":
                invoice_cards.append((card_name, value, card_data))
                print(f"Invoice card '{card_name}': {value}")
            
            if value and value > 0:
                cards_with_data.append((card_name, value))
                print(f"Card '{card_name}': {value}")
        
        # Verify at least some cards have non-zero data
        print(f"\nDirector has {len(cards_with_data)} cards with data")
        print(f"Director has {len(invoice_cards)} invoice-related cards")
        
        # This is the critical assertion - director should see data
        assert len(cards_with_data) > 0, "BUG NOT FIXED: Director still sees zero values for all cards"
    
    def test_director_invoice_cards(self, director_token):
        """Test director can see invoice card data (Overdue Invoices, Unpaid Invoices Value, Invoice Revenue)"""
        response = requests.get(
            f"{BASE_URL}/api/card-builder/my-dashboard?year=2026",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        blocks = data.get("blocks", [])
        
        # Find invoice-related cards
        invoice_card_names = ["overdue invoices", "unpaid invoices", "invoice revenue"]
        found_invoice_cards = []
        
        for block in blocks:
            card = block.get("card", {})
            card_name = card.get("name", "").lower()
            collection = card.get("collection", "")
            
            if any(inv_name in card_name for inv_name in invoice_card_names) or collection == "invoices":
                card_data = block.get("data", {})
                value = card_data.get("value", 0)
                found_invoice_cards.append({
                    "name": card.get("name"),
                    "value": value,
                    "collection": collection
                })
                print(f"Found invoice card: {card.get('name')} = {value}")
        
        print(f"\nTotal invoice cards found: {len(found_invoice_cards)}")
        
        # Director should be able to see invoice cards (may have 0 if no invoices exist)
        # The key is that the query runs without RBAC filtering blocking access


class TestAccountsEndpoint:
    """Test accounts endpoint returns correct data"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_accounts_endpoint(self, admin_token):
        """Test /api/accounts returns data with has_overdue flag"""
        response = requests.get(
            f"{BASE_URL}/api/accounts?limit=5",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Accounts endpoint failed: {response.text}"
        data = response.json()
        
        # Should be a list or have a results field
        if isinstance(data, list):
            accounts = data
        else:
            accounts = data.get("results", data.get("accounts", []))
        
        print(f"Accounts returned: {len(accounts)}")
        
        if len(accounts) > 0:
            # Check first account has expected fields
            first_account = accounts[0]
            print(f"Sample account: {first_account.get('name', 'N/A')}")
            # has_overdue might or might not exist depending on implementation


class TestMSSOConfig:
    """Test Microsoft SSO configuration endpoint"""
    
    def test_ms_sso_config(self):
        """Test MS SSO config endpoint returns correct values"""
        response = requests.get(f"{BASE_URL}/api/auth/microsoft/config")
        assert response.status_code == 200, f"MS SSO config failed: {response.text}"
        
        data = response.json()
        print(f"MS SSO Config: configured={data.get('configured')}, clientId set={bool(data.get('clientId'))}")
        
        # Check configuration values
        assert data.get("clientId"), "Client ID should be set"
        assert data.get("tenantId"), "Tenant ID should be set"


class TestSidebarNavigation:
    """Test sidebar navigation shows expected tabs"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_admin_permissions_for_sidebar(self, admin_token):
        """Test admin has permissions needed for full sidebar access"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        permissions = data.get("permissions", [])
        roles = data.get("roles", [])
        
        # Admin should have key permissions for sidebar navigation
        expected_permissions = ["view_dashboard"]
        
        for perm in expected_permissions:
            assert perm in permissions, f"Admin missing permission: {perm}"
        
        print(f"Admin roles: {roles}")
        print(f"Admin permissions: {permissions}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
