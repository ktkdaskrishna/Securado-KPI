#!/usr/bin/env python3
"""
Event Mesh CRM - Comprehensive Backend API Test
Tests all major endpoints using the public URL
"""
import requests
import sys
import json
from datetime import datetime

# Use the public endpoint
BASE_URL = "https://streamhub-crm.preview.emergentagent.com/api"

class APITester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.user_id = None

    def log(self, message, success=None):
        """Log test output"""
        prefix = ""
        if success is True:
            prefix = "✅ "
            self.tests_passed += 1
        elif success is False:
            prefix = "❌ "
        else:
            prefix = "➡️ "
        
        print(f"{prefix}{message}")
        
        if success is not None:
            self.tests_run += 1
            self.test_results.append({
                "message": message,
                "success": success,
                "timestamp": datetime.now().isoformat()
            })

    def make_request(self, method, endpoint, data=None, expected_status=None, description=""):
        """Make an API request and validate response"""
        url = f"{BASE_URL}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

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
                self.log(f"Invalid method: {method}", False)
                return None, None

            # Check expected status
            if expected_status:
                if response.status_code == expected_status:
                    self.log(f"{description} - Status: {response.status_code}", True)
                else:
                    self.log(f"{description} - Expected {expected_status}, got {response.status_code}", False)
                    try:
                        print(f"   Response: {response.json()}")
                    except:
                        print(f"   Response: {response.text[:200]}")
                    return response.status_code, None

            # Try to parse JSON
            try:
                return response.status_code, response.json()
            except:
                return response.status_code, response.text

        except requests.exceptions.Timeout:
            self.log(f"{description} - Request timeout", False)
            return None, None
        except requests.exceptions.ConnectionError:
            self.log(f"{description} - Connection error", False)
            return None, None
        except Exception as e:
            self.log(f"{description} - Error: {str(e)}", False)
            return None, None

    def test_health(self):
        """Test health endpoint"""
        print("\n" + "="*60)
        print("TEST: Health Check")
        print("="*60)
        
        status, data = self.make_request(
            'GET', 
            'health', 
            expected_status=200,
            description="Health check"
        )
        
        if data and isinstance(data, dict):
            print(f"   Service: {data.get('service')}")
            print(f"   Status: {data.get('status')}")
            print(f"   Components: {data.get('components')}")

    def test_auth_login(self):
        """Test login with existing approved user"""
        print("\n" + "="*60)
        print("TEST: Authentication - Login")
        print("="*60)
        
        status, data = self.make_request(
            'POST',
            'auth/login',
            data={"email": "admin@test.com", "password": "Test123!"},
            expected_status=200,
            description="Login with approved user"
        )
        
        if data and isinstance(data, dict):
            if 'access_token' in data:
                self.token = data['access_token']
                self.log("Access token received", True)
            else:
                self.log("No access token in response", False)

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        print("\n" + "="*60)
        print("TEST: Authentication - Get Current User")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping /auth/me test", False)
            return
        
        status, data = self.make_request(
            'GET',
            'auth/me',
            expected_status=200,
            description="Get current user info"
        )
        
        if data and isinstance(data, dict):
            self.user_id = data.get('id')
            print(f"   User ID: {data.get('id')}")
            print(f"   Email: {data.get('email')}")
            print(f"   Name: {data.get('name')}")
            print(f"   Status: {data.get('status')}")

    def test_dashboard(self):
        """Test dashboard endpoints"""
        print("\n" + "="*60)
        print("TEST: Dashboard")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping dashboard tests", False)
            return
        
        # Dashboard stats
        status, data = self.make_request(
            'GET',
            'dashboard/stats',
            expected_status=200,
            description="Get dashboard stats"
        )
        
        if data and isinstance(data, dict):
            print(f"   Stats keys: {list(data.keys())}")

    def test_opportunities(self):
        """Test opportunities endpoints"""
        print("\n" + "="*60)
        print("TEST: Opportunities")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping opportunities tests", False)
            return
        
        # List opportunities
        status, data = self.make_request(
            'GET',
            'opportunities',
            expected_status=200,
            description="List opportunities"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} opportunities")
        
        # Kanban view
        status, data = self.make_request(
            'GET',
            'opportunities/kanban',
            expected_status=200,
            description="Get opportunities kanban"
        )
        
        if data and isinstance(data, dict):
            print(f"   Kanban stages: {list(data.keys())}")

    def test_accounts(self):
        """Test accounts endpoints"""
        print("\n" + "="*60)
        print("TEST: Accounts")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping accounts tests", False)
            return
        
        # List accounts
        status, data = self.make_request(
            'GET',
            'accounts',
            expected_status=200,
            description="List accounts"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} accounts")

    def test_activities(self):
        """Test activities endpoints"""
        print("\n" + "="*60)
        print("TEST: Activities")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping activities tests", False)
            return
        
        # List activities
        status, data = self.make_request(
            'GET',
            'activities',
            expected_status=200,
            description="List activities"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} activities")
        
        # Activity stats
        status, data = self.make_request(
            'GET',
            'activities/stats',
            expected_status=200,
            description="Get activity stats"
        )

    def test_etl_connections(self):
        """Test ETL connections endpoints"""
        print("\n" + "="*60)
        print("TEST: ETL Connections")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping ETL connections tests", False)
            return
        
        # List connections
        status, data = self.make_request(
            'GET',
            'integrations',
            expected_status=200,
            description="List ETL connections"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} connections")

    def test_etl_pipelines(self):
        """Test ETL pipelines endpoints"""
        print("\n" + "="*60)
        print("TEST: ETL Pipelines")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping ETL pipelines tests", False)
            return
        
        # List pipelines
        status, data = self.make_request(
            'GET',
            'pipelines',
            expected_status=200,
            description="List ETL pipelines"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} pipelines")

    def test_admin_users(self):
        """Test admin users endpoints"""
        print("\n" + "="*60)
        print("TEST: Admin - Users")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping admin users tests", False)
            return
        
        # List users
        status, data = self.make_request(
            'GET',
            'admin/users',
            expected_status=200,
            description="List users"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} users")
            for user in data[:3]:  # Show first 3 users
                print(f"   - {user.get('email')} ({user.get('status')})")

    def test_admin_roles(self):
        """Test admin roles endpoints"""
        print("\n" + "="*60)
        print("TEST: Admin - Roles")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping admin roles tests", False)
            return
        
        # List roles
        status, data = self.make_request(
            'GET',
            'admin/roles',
            expected_status=200,
            description="List roles"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} roles")

    def test_goals(self):
        """Test goals endpoints"""
        print("\n" + "="*60)
        print("TEST: Goals")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping goals tests", False)
            return
        
        # List goals
        status, data = self.make_request(
            'GET',
            'goals',
            expected_status=200,
            description="List goals"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} goals")

    def test_teams(self):
        """Test teams endpoints"""
        print("\n" + "="*60)
        print("TEST: Teams")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping teams tests", False)
            return
        
        # List teams
        status, data = self.make_request(
            'GET',
            'teams',
            expected_status=200,
            description="List teams"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} teams")

    def test_portfolios(self):
        """Test portfolios endpoints"""
        print("\n" + "="*60)
        print("TEST: Portfolios")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping portfolios tests", False)
            return
        
        # List portfolios
        status, data = self.make_request(
            'GET',
            'portfolios',
            expected_status=200,
            description="List portfolios"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} portfolios")

    def test_initiatives(self):
        """Test initiatives endpoints"""
        print("\n" + "="*60)
        print("TEST: Initiatives")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping initiatives tests", False)
            return
        
        # List initiatives
        status, data = self.make_request(
            'GET',
            'initiatives',
            expected_status=200,
            description="List initiatives"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} initiatives")

    def test_kpis(self):
        """Test KPIs endpoints"""
        print("\n" + "="*60)
        print("TEST: KPIs")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping KPIs tests", False)
            return
        
        # List KPIs
        status, data = self.make_request(
            'GET',
            'kpis',
            expected_status=200,
            description="List KPIs"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} KPIs")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("\n" + "="*70)
        print("EVENT MESH CRM - COMPREHENSIVE BACKEND API TEST")
        print("="*70)
        print(f"Base URL: {BASE_URL}")
        print(f"Test User: admin@test.com")
        print("="*70)
        
        # Health check (no auth required)
        self.test_health()
        
        # Auth tests
        self.test_auth_login()
        self.test_auth_me()
        
        # Only proceed if we have a token
        if not self.token:
            print("\n❌ Authentication failed - cannot proceed with other tests")
            return False
        
        # Dashboard
        self.test_dashboard()
        
        # CRM modules
        self.test_opportunities()
        self.test_accounts()
        self.test_activities()
        self.test_goals()
        self.test_teams()
        self.test_portfolios()
        self.test_initiatives()
        self.test_kpis()
        
        # ETL modules
        self.test_etl_connections()
        self.test_etl_pipelines()
        
        # Admin modules
        self.test_admin_users()
        self.test_admin_roles()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0:.1f}%")
        print("="*70)
        
        # Show failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   - {test['message']}")
        
        return self.tests_run == self.tests_passed


def main():
    tester = APITester()
    
    try:
        tester.run_all_tests()
        success = tester.print_summary()
        
        # Save results to file
        with open('/app/backend_test_results.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'total_tests': tester.tests_run,
                'passed': tester.tests_passed,
                'failed': tester.tests_run - tester.tests_passed,
                'success_rate': (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
                'results': tester.test_results
            }, f, indent=2)
        
        return 0 if success else 1
    
    except Exception as e:
        print(f"\n❌ Test execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
