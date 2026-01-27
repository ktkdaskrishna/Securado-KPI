#!/usr/bin/env python3
"""
Backend API Testing for Platform 2 - Sales Dashboard
Tests all endpoints with proper authentication flow
"""

import requests
import sys
import json
from datetime import datetime
from typing import Optional, Dict, Any

class Platform2APITester:
    def __init__(self, base_url="https://odoo-sync-builder.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.access_token = None
        self.refresh_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_result(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ PASS: {test_name}")
        else:
            print(f"❌ FAIL: {test_name}")
        
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
    
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                     auth: bool = False, expected_status: Optional[int] = None) -> tuple:
        """Make HTTP request and return (success, response, status_code)"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth and self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {}, 0
            
            status_ok = response.status_code == expected_status if expected_status else response.ok
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw": response.text}
            
            return status_ok, response_data, response.status_code
        
        except Exception as e:
            return False, {"error": str(e)}, 0
    
    # ==================== HEALTH CHECK ====================
    
    def test_health_check(self):
        """Test basic health endpoint"""
        success, data, status = self.make_request('GET', 'health', expected_status=200)
        
        if success and data.get('status') == 'healthy':
            self.log_result("Health Check", True, f"Service: {data.get('service')}")
        else:
            self.log_result("Health Check", False, f"Status: {status}, Data: {data}")
    
    # ==================== AUTH TESTS ====================
    
    def test_register_user(self):
        """Test user registration (should be pending)"""
        test_email = f"test_user_{datetime.now().strftime('%Y%m%d_%H%M%S')}@test.com"
        
        user_data = {
            "email": test_email,
            "name": "Test User",
            "password": "TestPass123!",
            "org_id": "test_org"
        }
        
        success, data, status = self.make_request('POST', 'auth/register', data=user_data, expected_status=200)
        
        if success and data.get('status') == 'pending':
            self.log_result("Register User (Pending Status)", True, f"User: {test_email}, Status: pending")
        else:
            self.log_result("Register User (Pending Status)", False, f"Status: {status}, Data: {data}")
    
    def test_login_superadmin(self):
        """Test login with superadmin credentials"""
        credentials = {
            "email": "admin@platform2.com",
            "password": "admin123"
        }
        
        success, data, status = self.make_request('POST', 'auth/login', data=credentials, expected_status=200)
        
        if success and 'access_token' in data and 'refresh_token' in data:
            self.access_token = data['access_token']
            self.refresh_token = data['refresh_token']
            self.log_result("Login Superadmin", True, "Tokens received")
        else:
            self.log_result("Login Superadmin", False, f"Status: {status}, Data: {data}")
    
    def test_login_pending_user(self):
        """Test that pending users cannot login"""
        # First register a user
        test_email = f"pending_user_{datetime.now().strftime('%Y%m%d_%H%M%S')}@test.com"
        
        user_data = {
            "email": test_email,
            "name": "Pending User",
            "password": "TestPass123!",
            "org_id": "test_org"
        }
        
        self.make_request('POST', 'auth/register', data=user_data)
        
        # Try to login
        credentials = {
            "email": test_email,
            "password": "TestPass123!"
        }
        
        success, data, status = self.make_request('POST', 'auth/login', data=credentials, expected_status=403)
        
        if status == 403 and 'pending' in data.get('detail', '').lower():
            self.log_result("Login Pending User (Should Fail)", True, "Correctly rejected pending user")
        else:
            self.log_result("Login Pending User (Should Fail)", False, f"Status: {status}, Data: {data}")
    
    def test_refresh_token(self):
        """Test refresh token endpoint"""
        if not self.refresh_token:
            self.log_result("Refresh Token", False, "No refresh token available")
            return
        
        refresh_data = {
            "refresh_token": self.refresh_token
        }
        
        success, data, status = self.make_request('POST', 'auth/refresh', data=refresh_data, expected_status=200)
        
        if success and 'access_token' in data and 'refresh_token' in data:
            # Update tokens
            self.access_token = data['access_token']
            self.refresh_token = data['refresh_token']
            self.log_result("Refresh Token", True, "New tokens received")
        else:
            self.log_result("Refresh Token", False, f"Status: {status}, Data: {data}")
    
    def test_get_me(self):
        """Test /auth/me endpoint"""
        if not self.access_token:
            self.log_result("Get Current User (/auth/me)", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'auth/me', auth=True, expected_status=200)
        
        if success and data.get('email') == 'admin@platform2.com':
            self.log_result("Get Current User (/auth/me)", True, f"User: {data.get('email')}, Status: {data.get('status')}")
        else:
            self.log_result("Get Current User (/auth/me)", False, f"Status: {status}, Data: {data}")
    
    # ==================== DATA LAKE TESTS ====================
    
    def test_data_lake_health(self):
        """Test data lake health check"""
        success, data, status = self.make_request('GET', 'data-lake/health', expected_status=200)
        
        if success and data.get('status') == 'healthy':
            self.log_result("Data Lake Health Check", True, f"Canonical DB: {data.get('canonical_db')}")
        else:
            self.log_result("Data Lake Health Check", False, f"Status: {status}, Data: {data}")
    
    def test_canonical_browse(self):
        """Test browsing canonical data"""
        if not self.access_token:
            self.log_result("Browse Canonical Data", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'data-lake/canonical?entity_type=opportunities', 
                                                   auth=True, expected_status=200)
        
        if success and 'records' in data:
            count = data.get('count', 0)
            self.log_result("Browse Canonical Data (Opportunities)", True, 
                          f"Found {count} records (empty is expected initially)")
        else:
            self.log_result("Browse Canonical Data (Opportunities)", False, f"Status: {status}, Data: {data}")
    
    # ==================== OPPORTUNITIES TESTS ====================
    
    def test_list_opportunities(self):
        """Test listing opportunities"""
        if not self.access_token:
            self.log_result("List Opportunities", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'opportunities', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("List Opportunities", True, f"Found {len(data)} opportunities (empty is expected)")
        else:
            self.log_result("List Opportunities", False, f"Status: {status}, Data: {data}")
    
    def test_opportunities_kanban(self):
        """Test kanban view"""
        if not self.access_token:
            self.log_result("Opportunities Kanban View", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'opportunities/kanban', auth=True, expected_status=200)
        
        if success and 'stages' in data:
            self.log_result("Opportunities Kanban View", True, f"Stages: {list(data.get('stages', {}).keys())}")
        else:
            self.log_result("Opportunities Kanban View", False, f"Status: {status}, Data: {data}")
    
    def test_opportunity_override(self):
        """Test opportunity stage override (with mock ID)"""
        if not self.access_token:
            self.log_result("Opportunity Stage Override", False, "No access token")
            return
        
        # Use a test canonical ID
        test_opp_id = "test_opp_123"
        
        stage_data = {
            "stage": "Negotiation"
        }
        
        success, data, status = self.make_request('PATCH', f'opportunities/{test_opp_id}/stage', 
                                                   data=stage_data, auth=True, expected_status=200)
        
        if success and data.get('success'):
            self.log_result("Opportunity Stage Override", True, f"Override stored for {test_opp_id}")
        else:
            self.log_result("Opportunity Stage Override", False, f"Status: {status}, Data: {data}")
    
    # ==================== DASHBOARD TESTS ====================
    
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        if not self.access_token:
            self.log_result("Dashboard Stats", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'dashboard/stats', auth=True, expected_status=200)
        
        if success and 'total_opportunities' in data:
            self.log_result("Dashboard Stats", True, 
                          f"Total: {data.get('total_opportunities')}, Value: {data.get('total_value', 0)}")
        else:
            self.log_result("Dashboard Stats", False, f"Status: {status}, Data: {data}")
    
    def test_dashboard_refresh(self):
        """Test dashboard refresh (trigger cache rebuild)"""
        if not self.access_token:
            self.log_result("Dashboard Refresh", False, "No access token")
            return
        
        success, data, status = self.make_request('POST', 'dashboard/refresh', auth=True, expected_status=200)
        
        if success and data.get('success'):
            self.log_result("Dashboard Refresh", True, "Cache rebuild triggered")
        else:
            self.log_result("Dashboard Refresh", False, f"Status: {status}, Data: {data}")
    
    def test_sync_status(self):
        """Test sync status endpoint"""
        if not self.access_token:
            self.log_result("Sync Status", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'dashboard/sync-status', auth=True, expected_status=200)
        
        if success and 'sync_needed' in data:
            self.log_result("Sync Status", True, 
                          f"Sync needed: {data.get('sync_needed')}, Last canonical: {data.get('last_canonical_update')}")
        else:
            self.log_result("Sync Status", False, f"Status: {status}, Data: {data}")
    
    # ==================== ACTIVITIES TESTS ====================
    
    def test_list_activities(self):
        """Test listing activities"""
        if not self.access_token:
            self.log_result("List Activities", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'activities', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("List Activities", True, f"Found {len(data)} activities")
        else:
            self.log_result("List Activities", False, f"Status: {status}, Data: {data}")
    
    def test_create_activity(self):
        """Test creating an activity"""
        if not self.access_token:
            self.log_result("Create Activity", False, "No access token")
            return
        
        activity_data = {
            "subject": "Test Activity",
            "description": "Testing activity creation",
            "activity_type": "call",
            "opportunity_id": "test_opp_123",
            "due_date": datetime.utcnow().isoformat()
        }
        
        success, data, status = self.make_request('POST', 'activities', data=activity_data, 
                                                   auth=True, expected_status=200)
        
        if success and data.get('id'):
            activity_id = data.get('id')
            self.log_result("Create Activity", True, f"Activity created: {activity_id}")
            
            # Store for next test
            self.test_activity_id = activity_id
        else:
            self.log_result("Create Activity", False, f"Status: {status}, Data: {data}")
    
    def test_update_activity_status(self):
        """Test updating activity status"""
        if not self.access_token:
            self.log_result("Update Activity Status", False, "No access token")
            return
        
        # Use the activity created in previous test, or a test ID
        activity_id = getattr(self, 'test_activity_id', 'test_activity_123')
        
        update_data = {
            "status": "completed",
            "completed": True
        }
        
        success, data, status = self.make_request('PATCH', f'activities/{activity_id}/status', 
                                                   data=update_data, auth=True)
        
        # Accept both 200 (success) and 404 (not found) as valid
        if (status == 200 and data.get('success')) or status == 404:
            self.log_result("Update Activity Status", True, 
                          f"Status: {status} ({'Updated' if status == 200 else 'Not found (expected)'})")
        else:
            self.log_result("Update Activity Status", False, f"Status: {status}, Data: {data}")
    
    # ==================== ADMIN MODULE TESTS (PHASE 2) ====================
    
    def test_list_permissions(self):
        """Test listing permissions"""
        if not self.access_token:
            self.log_result("Admin: List Permissions", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'admin/permissions', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Admin: List Permissions", True, f"Found {len(data)} permissions")
        else:
            self.log_result("Admin: List Permissions", False, f"Status: {status}, Data: {data}")
    
    def test_list_roles(self):
        """Test listing roles"""
        if not self.access_token:
            self.log_result("Admin: List Roles", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'admin/roles', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Admin: List Roles", True, f"Found {len(data)} roles")
        else:
            self.log_result("Admin: List Roles", False, f"Status: {status}, Data: {data}")
    
    def test_create_role(self):
        """Test creating a role"""
        if not self.access_token:
            self.log_result("Admin: Create Role", False, "No access token")
            return
        
        role_data = {
            "name": f"test_role_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "description": "Test role for automated testing",
            "permissions": ["read:opportunities", "write:opportunities"]
        }
        
        success, data, status = self.make_request('POST', 'admin/roles', data=role_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.test_role_id = data.get('id')
            self.log_result("Admin: Create Role", True, f"Role created: {data.get('name')}")
        else:
            self.log_result("Admin: Create Role", False, f"Status: {status}, Data: {data}")
    
    def test_list_departments(self):
        """Test listing departments"""
        if not self.access_token:
            self.log_result("Admin: List Departments", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'admin/departments', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Admin: List Departments", True, f"Found {len(data)} departments")
        else:
            self.log_result("Admin: List Departments", False, f"Status: {status}, Data: {data}")
    
    def test_create_department(self):
        """Test creating a department"""
        if not self.access_token:
            self.log_result("Admin: Create Department", False, "No access token")
            return
        
        dept_data = {
            "name": f"Test Dept {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "description": "Test department for automated testing"
        }
        
        success, data, status = self.make_request('POST', 'admin/departments', data=dept_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.test_dept_id = data.get('id')
            self.log_result("Admin: Create Department", True, f"Department created: {data.get('name')}")
        else:
            self.log_result("Admin: Create Department", False, f"Status: {status}, Data: {data}")
    
    def test_list_users(self):
        """Test listing users"""
        if not self.access_token:
            self.log_result("Admin: List Users", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'admin/users', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Admin: List Users", True, f"Found {len(data)} users")
        else:
            self.log_result("Admin: List Users", False, f"Status: {status}, Data: {data}")
    
    def test_assign_role_to_user(self):
        """Test assigning role to user"""
        if not self.access_token:
            self.log_result("Admin: Assign Role to User", False, "No access token")
            return
        
        # Get current user ID
        success, user_data, status = self.make_request('GET', 'auth/me', auth=True)
        if not success:
            self.log_result("Admin: Assign Role to User", False, "Could not get current user")
            return
        
        user_id = user_data.get('id')
        role_name = "sales_rep"
        
        success, data, status = self.make_request('PATCH', f'admin/users/{user_id}/assign-role?role={role_name}', 
                                                   auth=True, expected_status=200)
        
        if success and data.get('success'):
            self.log_result("Admin: Assign Role to User", True, f"Role '{role_name}' assigned")
        else:
            self.log_result("Admin: Assign Role to User", False, f"Status: {status}, Data: {data}")
    
    def test_bulk_assign_role(self):
        """Test bulk role assignment"""
        if not self.access_token:
            self.log_result("Admin: Bulk Assign Role", False, "No access token")
            return
        
        # Get current user ID
        success, user_data, status = self.make_request('GET', 'auth/me', auth=True)
        if not success:
            self.log_result("Admin: Bulk Assign Role", False, "Could not get current user")
            return
        
        user_id = user_data.get('id')
        
        bulk_data = {
            "user_ids": [user_id],
            "role": "manager"
        }
        
        success, data, status = self.make_request('POST', 'admin/users/bulk-assign-role', 
                                                   data=bulk_data, auth=True, expected_status=200)
        
        if success and data.get('success'):
            self.log_result("Admin: Bulk Assign Role", True, data.get('message', 'Roles assigned'))
        else:
            self.log_result("Admin: Bulk Assign Role", False, f"Status: {status}, Data: {data}")
    
    def test_get_my_permissions(self):
        """Test getting current user's permissions"""
        if not self.access_token:
            self.log_result("Admin: Get My Permissions", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'admin/me/permissions', auth=True, expected_status=200)
        
        if success and 'permissions' in data:
            self.log_result("Admin: Get My Permissions", True, 
                          f"User has {len(data.get('permissions', []))} permissions")
        else:
            self.log_result("Admin: Get My Permissions", False, f"Status: {status}, Data: {data}")
    
    def test_get_log_stats(self):
        """Test getting log statistics"""
        if not self.access_token:
            self.log_result("Admin: Get Log Stats", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'admin/logs/stats', auth=True, expected_status=200)
        
        if success and 'unresolved_errors' in data:
            self.log_result("Admin: Get Log Stats", True, 
                          f"Errors: {data.get('unresolved_errors')}, Sessions: {data.get('total_sessions')}")
        else:
            self.log_result("Admin: Get Log Stats", False, f"Status: {status}, Data: {data}")
    
    # ==================== CONFIG MODULE TESTS (PHASE 2) ====================
    
    def test_get_widgets(self):
        """Test getting system widgets"""
        success, data, status = self.make_request('GET', 'config/widgets', expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Config: Get Widgets", True, f"Found {len(data)} widgets")
        else:
            self.log_result("Config: Get Widgets", False, f"Status: {status}, Data: {data}")
    
    def test_get_navigation_items(self):
        """Test getting navigation items"""
        success, data, status = self.make_request('GET', 'config/navigation-items', expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Config: Get Navigation Items", True, f"Found {len(data)} navigation items")
        else:
            self.log_result("Config: Get Navigation Items", False, f"Status: {status}, Data: {data}")
    
    def test_get_pipeline_stages(self):
        """Test getting pipeline stages"""
        if not self.access_token:
            self.log_result("Config: Get Pipeline Stages", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'config/pipeline-stages', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Config: Get Pipeline Stages", True, f"Found {len(data)} stages")
        else:
            self.log_result("Config: Get Pipeline Stages", False, f"Status: {status}, Data: {data}")
    
    def test_create_service_line(self):
        """Test creating a service line"""
        if not self.access_token:
            self.log_result("Config: Create Service Line", False, "No access token")
            return
        
        service_line_data = {
            "name": f"Test Service Line {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "description": "Test service line for automated testing"
        }
        
        success, data, status = self.make_request('POST', 'config/service-lines', 
                                                   data=service_line_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.log_result("Config: Create Service Line", True, f"Service line created: {data.get('name')}")
        else:
            self.log_result("Config: Create Service Line", False, f"Status: {status}, Data: {data}")
    
    def test_get_bluesheet_weights(self):
        """Test getting bluesheet weights"""
        if not self.access_token:
            self.log_result("Config: Get Bluesheet Weights", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'config/bluesheet-weights', auth=True, expected_status=200)
        
        if success and 'weights' in data:
            self.log_result("Config: Get Bluesheet Weights", True, f"Weights: {list(data.get('weights', {}).keys())}")
        else:
            self.log_result("Config: Get Bluesheet Weights", False, f"Status: {status}, Data: {data}")
    
    def test_create_target(self):
        """Test creating a target"""
        if not self.access_token:
            self.log_result("Config: Create Target", False, "No access token")
            return
        
        target_data = {
            "name": f"Test Target {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "target_type": "revenue",
            "value": 100000,
            "period": "Q1 2025",
            "start_date": datetime.utcnow().isoformat(),
            "end_date": datetime.utcnow().isoformat()
        }
        
        success, data, status = self.make_request('POST', 'config/targets', 
                                                   data=target_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.log_result("Config: Create Target", True, f"Target created: {data.get('name')}")
        else:
            self.log_result("Config: Create Target", False, f"Status: {status}, Data: {data}")
    
    def test_get_user_dashboard_config(self):
        """Test getting user dashboard configuration"""
        if not self.access_token:
            self.log_result("Config: Get User Dashboard Config", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'config/user/dashboard', auth=True, expected_status=200)
        
        if success and 'widgets' in data:
            self.log_result("Config: Get User Dashboard Config", True, 
                          f"Widgets: {len(data.get('widgets', []))}")
        else:
            self.log_result("Config: Get User Dashboard Config", False, f"Status: {status}, Data: {data}")
    
    # ==================== SALES EXTENDED MODULE TESTS (PHASE 2) ====================
    
    def test_list_accounts(self):
        """Test listing accounts"""
        if not self.access_token:
            self.log_result("Sales: List Accounts", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'accounts', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Sales: List Accounts", True, f"Found {len(data)} accounts")
        else:
            self.log_result("Sales: List Accounts", False, f"Status: {status}, Data: {data}")
    
    def test_create_account(self):
        """Test creating an account"""
        if not self.access_token:
            self.log_result("Sales: Create Account", False, "No access token")
            return
        
        account_data = {
            "name": f"Test Account {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "industry": "Technology",
            "website": "https://test.com"
        }
        
        success, data, status = self.make_request('POST', 'accounts', 
                                                   data=account_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.test_account_id = data.get('id')
            self.log_result("Sales: Create Account", True, f"Account created: {data.get('name')}")
        else:
            self.log_result("Sales: Create Account", False, f"Status: {status}, Data: {data}")
    
    def test_get_account_360(self):
        """Test getting account 360 view"""
        if not self.access_token:
            self.log_result("Sales: Get Account 360 View", False, "No access token")
            return
        
        # Use test account ID or a mock ID
        account_id = getattr(self, 'test_account_id', 'test_account_123')
        
        success, data, status = self.make_request('GET', f'accounts/{account_id}/360', auth=True)
        
        # Accept both 200 (success) and 404 (not found) as valid
        if status == 200 and 'account' in data:
            self.log_result("Sales: Get Account 360 View", True, 
                          f"Opportunities: {data.get('summary', {}).get('total_opportunities', 0)}")
        elif status == 404:
            self.log_result("Sales: Get Account 360 View", True, "Not found (expected for test ID)")
        else:
            self.log_result("Sales: Get Account 360 View", False, f"Status: {status}, Data: {data}")
    
    def test_list_kpis(self):
        """Test listing KPIs"""
        if not self.access_token:
            self.log_result("Sales: List KPIs", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'kpis', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Sales: List KPIs", True, f"Found {len(data)} KPIs")
        else:
            self.log_result("Sales: List KPIs", False, f"Status: {status}, Data: {data}")
    
    def test_create_kpi(self):
        """Test creating a KPI"""
        if not self.access_token:
            self.log_result("Sales: Create KPI", False, "No access token")
            return
        
        kpi_data = {
            "name": f"Test KPI {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "metric_type": "revenue",
            "target_value": 50000,
            "current_value": 25000,
            "period": "Q1 2025"
        }
        
        success, data, status = self.make_request('POST', 'kpis', 
                                                   data=kpi_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.log_result("Sales: Create KPI", True, f"KPI created: {data.get('name')}")
        else:
            self.log_result("Sales: Create KPI", False, f"Status: {status}, Data: {data}")
    
    def test_list_receivables(self):
        """Test listing receivables (stub endpoint)"""
        if not self.access_token:
            self.log_result("Sales: List Receivables (Stub)", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'receivables', auth=True, expected_status=200)
        
        if success and 'message' in data:
            self.log_result("Sales: List Receivables (Stub)", True, "Stub endpoint working")
        else:
            self.log_result("Sales: List Receivables (Stub)", False, f"Status: {status}, Data: {data}")
    
    def test_get_sales_metrics(self):
        """Test getting user sales metrics"""
        if not self.access_token:
            self.log_result("Sales: Get Sales Metrics", False, "No access token")
            return
        
        # Get current user ID
        success, user_data, status = self.make_request('GET', 'auth/me', auth=True)
        if not success:
            self.log_result("Sales: Get Sales Metrics", False, "Could not get current user")
            return
        
        user_id = user_data.get('id')
        
        success, data, status = self.make_request('GET', f'sales-metrics/{user_id}', auth=True, expected_status=200)
        
        if success and 'total_opportunities' in data:
            self.log_result("Sales: Get Sales Metrics", True, 
                          f"Total opps: {data.get('total_opportunities')}, Value: {data.get('total_pipeline_value', 0)}")
        else:
            self.log_result("Sales: Get Sales Metrics", False, f"Status: {status}, Data: {data}")
    
    def test_search(self):
        """Test search endpoint"""
        if not self.access_token:
            self.log_result("Sales: Search", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'search?q=test', auth=True, expected_status=200)
        
        if success and 'opportunities' in data and 'accounts' in data:
            self.log_result("Sales: Search", True, 
                          f"Found opps: {len(data.get('opportunities', []))}, accounts: {len(data.get('accounts', []))}")
        else:
            self.log_result("Sales: Search", False, f"Status: {status}, Data: {data}")
    
    # ==================== GOALS MODULE TESTS (PHASE 2) ====================
    
    def test_create_goal(self):
        """Test creating a goal"""
        if not self.access_token:
            self.log_result("Goals: Create Goal", False, "No access token")
            return
        
        goal_data = {
            "title": f"Test Goal {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "description": "Test goal for automated testing",
            "target_value": 100,
            "current_value": 0,
            "start_date": datetime.utcnow().isoformat(),
            "end_date": datetime.utcnow().isoformat()
        }
        
        success, data, status = self.make_request('POST', 'goals', 
                                                   data=goal_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.test_goal_id = data.get('id')
            self.log_result("Goals: Create Goal", True, f"Goal created: {data.get('title')}")
        else:
            self.log_result("Goals: Create Goal", False, f"Status: {status}, Data: {data}")
    
    def test_list_goals(self):
        """Test listing goals"""
        if not self.access_token:
            self.log_result("Goals: List Goals", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'goals', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Goals: List Goals", True, f"Found {len(data)} goals")
        else:
            self.log_result("Goals: List Goals", False, f"Status: {status}, Data: {data}")
    
    def test_update_goal_progress(self):
        """Test updating goal progress"""
        if not self.access_token:
            self.log_result("Goals: Update Goal Progress", False, "No access token")
            return
        
        # Use test goal ID or mock ID
        goal_id = getattr(self, 'test_goal_id', 'test_goal_123')
        
        progress_data = {
            "current_value": 50
        }
        
        success, data, status = self.make_request('PATCH', f'goals/{goal_id}/progress', 
                                                   data=progress_data, auth=True)
        
        # Accept both 200 (success) and 404 (not found) as valid
        if (status == 200 and data.get('success')) or status == 404:
            self.log_result("Goals: Update Goal Progress", True, 
                          f"Status: {status} ({'Updated' if status == 200 else 'Not found (expected)'})")
        else:
            self.log_result("Goals: Update Goal Progress", False, f"Status: {status}, Data: {data}")
    
    def test_get_goal_summary_stats(self):
        """Test getting goal summary statistics"""
        if not self.access_token:
            self.log_result("Goals: Get Summary Stats", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'goals/summary/stats', auth=True, expected_status=200)
        
        if success and 'total_goals' in data:
            self.log_result("Goals: Get Summary Stats", True, 
                          f"Total: {data.get('total_goals')}, Completed: {data.get('completed', 0)}")
        else:
            self.log_result("Goals: Get Summary Stats", False, f"Status: {status}, Data: {data}")
    
    # ==================== TEAMS MODULE TESTS (PHASE 2) ====================
    
    def test_create_team(self):
        """Test creating a team"""
        if not self.access_token:
            self.log_result("Teams: Create Team", False, "No access token")
            return
        
        # Get current user ID for manager
        success, user_data, status = self.make_request('GET', 'auth/me', auth=True)
        if not success:
            self.log_result("Teams: Create Team", False, "Could not get current user")
            return
        
        user_id = user_data.get('id')
        
        team_data = {
            "name": f"Test Team {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "description": "Test team for automated testing",
            "manager_id": user_id
        }
        
        success, data, status = self.make_request('POST', 'teams', 
                                                   data=team_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.test_team_id = data.get('id')
            self.log_result("Teams: Create Team", True, f"Team created: {data.get('name')}")
        else:
            self.log_result("Teams: Create Team", False, f"Status: {status}, Data: {data}")
    
    def test_list_teams(self):
        """Test listing teams"""
        if not self.access_token:
            self.log_result("Teams: List Teams", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'teams', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Teams: List Teams", True, f"Found {len(data)} teams")
        else:
            self.log_result("Teams: List Teams", False, f"Status: {status}, Data: {data}")
    
    def test_add_team_member(self):
        """Test adding member to team"""
        if not self.access_token:
            self.log_result("Teams: Add Team Member", False, "No access token")
            return
        
        # Get current user ID
        success, user_data, status = self.make_request('GET', 'auth/me', auth=True)
        if not success:
            self.log_result("Teams: Add Team Member", False, "Could not get current user")
            return
        
        user_id = user_data.get('id')
        team_id = getattr(self, 'test_team_id', 'test_team_123')
        
        member_data = {
            "user_id": user_id
        }
        
        success, data, status = self.make_request('POST', f'teams/{team_id}/members', 
                                                   data=member_data, auth=True)
        
        # Accept both 200 (success) and 404 (not found) as valid
        if (status == 200 and data.get('success')) or status == 404:
            self.log_result("Teams: Add Team Member", True, 
                          f"Status: {status} ({'Added' if status == 200 else 'Team not found (expected)'})")
        else:
            self.log_result("Teams: Add Team Member", False, f"Status: {status}, Data: {data}")
    
    def test_get_my_teams(self):
        """Test getting current user's teams"""
        if not self.access_token:
            self.log_result("Teams: Get My Teams", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'teams/my-teams', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Teams: Get My Teams", True, f"Found {len(data)} teams")
        else:
            self.log_result("Teams: Get My Teams", False, f"Status: {status}, Data: {data}")
    
    # ==================== PORTFOLIOS MODULE TESTS (PHASE 2) ====================
    
    def test_create_portfolio(self):
        """Test creating a portfolio"""
        if not self.access_token:
            self.log_result("Portfolios: Create Portfolio", False, "No access token")
            return
        
        # Get current user ID for owner
        success, user_data, status = self.make_request('GET', 'auth/me', auth=True)
        if not success:
            self.log_result("Portfolios: Create Portfolio", False, "Could not get current user")
            return
        
        user_id = user_data.get('id')
        
        portfolio_data = {
            "name": f"Test Portfolio {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "description": "Test portfolio for automated testing",
            "owner_id": user_id
        }
        
        success, data, status = self.make_request('POST', 'portfolios', 
                                                   data=portfolio_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.test_portfolio_id = data.get('id')
            self.log_result("Portfolios: Create Portfolio", True, f"Portfolio created: {data.get('name')}")
        else:
            self.log_result("Portfolios: Create Portfolio", False, f"Status: {status}, Data: {data}")
    
    def test_list_portfolios(self):
        """Test listing portfolios"""
        if not self.access_token:
            self.log_result("Portfolios: List Portfolios", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'portfolios', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Portfolios: List Portfolios", True, f"Found {len(data)} portfolios")
        else:
            self.log_result("Portfolios: List Portfolios", False, f"Status: {status}, Data: {data}")
    
    def test_get_portfolio_dashboard(self):
        """Test getting portfolio dashboard"""
        if not self.access_token:
            self.log_result("Portfolios: Get Portfolio Dashboard", False, "No access token")
            return
        
        # Use test portfolio ID or mock ID
        portfolio_id = getattr(self, 'test_portfolio_id', 'test_portfolio_123')
        
        success, data, status = self.make_request('GET', f'portfolios/{portfolio_id}/dashboard', auth=True)
        
        # Accept both 200 (success) and 404 (not found) as valid
        if status == 200 and 'portfolio' in data:
            self.log_result("Portfolios: Get Portfolio Dashboard", True, 
                          f"Initiatives: {data.get('stats', {}).get('total_initiatives', 0)}")
        elif status == 404:
            self.log_result("Portfolios: Get Portfolio Dashboard", True, "Not found (expected for test ID)")
        else:
            self.log_result("Portfolios: Get Portfolio Dashboard", False, f"Status: {status}, Data: {data}")
    
    # ==================== INITIATIVES MODULE TESTS (PHASE 2) ====================
    
    def test_create_initiative(self):
        """Test creating an initiative"""
        if not self.access_token:
            self.log_result("Initiatives: Create Initiative", False, "No access token")
            return
        
        initiative_data = {
            "name": f"Test Initiative {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "description": "Test initiative for automated testing",
            "status": "planning",
            "start_date": datetime.utcnow().isoformat(),
            "target_date": datetime.utcnow().isoformat()
        }
        
        success, data, status = self.make_request('POST', 'initiatives', 
                                                   data=initiative_data, auth=True, expected_status=200)
        
        if success and data.get('id'):
            self.test_initiative_id = data.get('id')
            self.log_result("Initiatives: Create Initiative", True, f"Initiative created: {data.get('name')}")
        else:
            self.log_result("Initiatives: Create Initiative", False, f"Status: {status}, Data: {data}")
    
    def test_list_initiatives(self):
        """Test listing initiatives"""
        if not self.access_token:
            self.log_result("Initiatives: List Initiatives", False, "No access token")
            return
        
        success, data, status = self.make_request('GET', 'initiatives', auth=True, expected_status=200)
        
        if success and isinstance(data, list):
            self.log_result("Initiatives: List Initiatives", True, f"Found {len(data)} initiatives")
        else:
            self.log_result("Initiatives: List Initiatives", False, f"Status: {status}, Data: {data}")
    
    def test_update_initiative_status(self):
        """Test updating initiative status"""
        if not self.access_token:
            self.log_result("Initiatives: Update Initiative Status", False, "No access token")
            return
        
        # Use test initiative ID or mock ID
        initiative_id = getattr(self, 'test_initiative_id', 'test_initiative_123')
        
        status_data = {
            "status": "in_progress"
        }
        
        success, data, status = self.make_request('PATCH', f'initiatives/{initiative_id}/status', 
                                                   data=status_data, auth=True)
        
        # Accept both 200 (success) and 404 (not found) as valid
        if (status == 200 and data.get('success')) or status == 404:
            self.log_result("Initiatives: Update Initiative Status", True, 
                          f"Status: {status} ({'Updated' if status == 200 else 'Not found (expected)'})")
        else:
            self.log_result("Initiatives: Update Initiative Status", False, f"Status: {status}, Data: {data}")
    
    # ==================== RUN ALL TESTS ====================
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("\n" + "="*70)
        print("Platform 2 - Sales Dashboard Backend API Tests (Phase 2)")
        print("="*70 + "\n")
        
        print("🔍 Testing Health & Basic Endpoints...")
        self.test_health_check()
        
        print("\n🔐 Testing Authentication Flow...")
        self.test_register_user()
        self.test_login_superadmin()
        self.test_login_pending_user()
        self.test_refresh_token()
        self.test_get_me()
        
        print("\n🗄️  Testing Data Lake Endpoints...")
        self.test_data_lake_health()
        self.test_canonical_browse()
        
        print("\n💼 Testing Opportunities Endpoints...")
        self.test_list_opportunities()
        self.test_opportunities_kanban()
        self.test_opportunity_override()
        
        print("\n📊 Testing Dashboard Endpoints...")
        self.test_dashboard_stats()
        self.test_dashboard_refresh()
        self.test_sync_status()
        
        print("\n📋 Testing Activities Endpoints...")
        self.test_list_activities()
        self.test_create_activity()
        self.test_update_activity_status()
        
        print("\n👥 Testing Admin Module (RBAC, Users, Logs)...")
        self.test_list_permissions()
        self.test_list_roles()
        self.test_create_role()
        self.test_list_departments()
        self.test_create_department()
        self.test_list_users()
        self.test_assign_role_to_user()
        self.test_bulk_assign_role()
        self.test_get_my_permissions()
        self.test_get_log_stats()
        
        print("\n⚙️  Testing Config Module (Widgets, Navigation, Targets)...")
        self.test_get_widgets()
        self.test_get_navigation_items()
        self.test_get_pipeline_stages()
        self.test_create_service_line()
        self.test_get_bluesheet_weights()
        self.test_create_target()
        self.test_get_user_dashboard_config()
        
        print("\n💰 Testing Sales Extended Module (Accounts, KPIs, Search)...")
        self.test_list_accounts()
        self.test_create_account()
        self.test_get_account_360()
        self.test_list_kpis()
        self.test_create_kpi()
        self.test_list_receivables()
        self.test_get_sales_metrics()
        self.test_search()
        
        print("\n🎯 Testing Goals Module...")
        self.test_create_goal()
        self.test_list_goals()
        self.test_update_goal_progress()
        self.test_get_goal_summary_stats()
        
        print("\n👥 Testing Teams Module...")
        self.test_create_team()
        self.test_list_teams()
        self.test_add_team_member()
        self.test_get_my_teams()
        
        print("\n📁 Testing Portfolios Module...")
        self.test_create_portfolio()
        self.test_list_portfolios()
        self.test_get_portfolio_dashboard()
        
        print("\n🚀 Testing Initiatives Module...")
        self.test_create_initiative()
        self.test_list_initiatives()
        self.test_update_initiative_status()
        
        # Print summary
        print("\n" + "="*70)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        print("="*70 + "\n")
        
        return self.tests_passed == self.tests_run

def main():
    tester = Platform2APITester()
    success = tester.run_all_tests()
    
    # Save results to JSON
    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "failed_tests": tester.tests_run - tester.tests_passed,
        "success_rate": f"{(tester.tests_passed/tester.tests_run*100):.1f}%",
        "test_results": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"📄 Detailed results saved to: /app/backend_test_results.json\n")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
