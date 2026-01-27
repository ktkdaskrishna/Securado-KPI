import requests
import sys
from datetime import datetime

class Platform3APITester:
    def __init__(self, base_url="https://datamapper-10.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "endpoint": endpoint,
                "error": str(e)
            })
            return False, {}

    def test_login(self):
        """Test login and get token"""
        print("\n" + "="*60)
        print("TESTING AUTHENTICATION")
        print("="*60)
        
        success, response = self.run_test(
            "Login",
            "POST",
            "auth/login",
            200,
            data={"email": "test@platform3.com", "password": "test123"}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token received: {self.token[:20]}...")
            return True
        return False

    def test_auth_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        if success and 'email' in response:
            print(f"   User: {response.get('name')} ({response.get('email')})")
        return success

    def test_dashboard(self):
        """Test dashboard endpoints"""
        print("\n" + "="*60)
        print("TESTING DASHBOARD")
        print("="*60)
        
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        if success:
            print(f"   Total Pipeline: ${response.get('total_pipeline', 0):,.0f}")
            print(f"   Won Value: ${response.get('won_value', 0):,.0f}")
            print(f"   Open Count: {response.get('open_count', 0)}")
            print(f"   Win Rate: {response.get('win_rate', 0)}%")
        
        self.run_test(
            "Dashboard Refresh",
            "POST",
            "dashboard/refresh",
            200
        )
        
        return success

    def test_opportunities(self):
        """Test opportunities endpoints"""
        print("\n" + "="*60)
        print("TESTING OPPORTUNITIES")
        print("="*60)
        
        # Get opportunities list
        success, response = self.run_test(
            "Get Opportunities",
            "GET",
            "opportunities",
            200
        )
        if success:
            print(f"   Found {len(response)} opportunities")
        
        # Get kanban view
        success2, response2 = self.run_test(
            "Get Opportunities Kanban",
            "GET",
            "opportunities/kanban",
            200
        )
        if success2:
            print(f"   Kanban view: {len(response2)} opportunities")
        
        # Create opportunity
        success3, new_opp = self.run_test(
            "Create Opportunity",
            "POST",
            "opportunities",
            200,
            data={
                "name": "Test Opportunity",
                "value": 50000,
                "stage": "qualified",
                "account_name": "Test Account"
            }
        )
        
        # Test stage update if we created an opportunity
        if success3 and 'id' in new_opp:
            opp_id = new_opp['id']
            self.run_test(
                "Update Opportunity Stage",
                "PATCH",
                f"opportunities/{opp_id}/stage",
                200,
                data={"stage": "proposal"}
            )
            
            self.run_test(
                "Calculate Probability",
                "POST",
                f"opportunities/{opp_id}/calculate-probability",
                200
            )
            
            self.run_test(
                "Get Opportunity Messages",
                "GET",
                f"opportunities/{opp_id}/messages",
                200
            )
        
        return success and success2

    def test_accounts(self):
        """Test accounts endpoints"""
        print("\n" + "="*60)
        print("TESTING ACCOUNTS")
        print("="*60)
        
        success, response = self.run_test(
            "Get Accounts",
            "GET",
            "accounts",
            200
        )
        if success:
            print(f"   Found {len(response)} accounts")
            
            # Test 360 view if we have accounts
            if len(response) > 0:
                account_id = response[0].get('id')
                if account_id:
                    self.run_test(
                        "Get Account 360 View",
                        "GET",
                        f"accounts/{account_id}/360",
                        200
                    )
        
        # Create account
        self.run_test(
            "Create Account",
            "POST",
            "accounts",
            200,
            data={
                "name": "Test Account",
                "industry": "Technology",
                "type": "Enterprise"
            }
        )
        
        return success

    def test_activities(self):
        """Test activities endpoints"""
        print("\n" + "="*60)
        print("TESTING ACTIVITIES")
        print("="*60)
        
        success, response = self.run_test(
            "Get Activities",
            "GET",
            "activities",
            200
        )
        if success:
            print(f"   Found {len(response)} activities")
        
        success2, stats = self.run_test(
            "Get Activities Stats",
            "GET",
            "activities/stats",
            200
        )
        if success2:
            print(f"   Total: {stats.get('total', 0)}, Completed: {stats.get('completed', 0)}, Pending: {stats.get('pending', 0)}")
        
        # Create activity
        success3, new_activity = self.run_test(
            "Create Activity",
            "POST",
            "activities",
            200,
            data={
                "subject": "Test Activity",
                "type": "task",
                "status": "pending"
            }
        )
        
        # Test activity status update
        if success3 and 'id' in new_activity:
            activity_id = new_activity['id']
            self.run_test(
                "Complete Activity",
                "PATCH",
                f"activities/{activity_id}/complete",
                200
            )
        
        return success and success2

    def test_goals(self):
        """Test goals endpoints"""
        print("\n" + "="*60)
        print("TESTING GOALS")
        print("="*60)
        
        success, response = self.run_test(
            "Get Goals",
            "GET",
            "goals",
            200
        )
        if success:
            print(f"   Found {len(response)} goals")
        
        success2, stats = self.run_test(
            "Get Goals Stats",
            "GET",
            "goals/summary/stats",
            200
        )
        if success2:
            print(f"   Total: {stats.get('total', 0)}, On Track: {stats.get('on_track', 0)}, Completed: {stats.get('completed', 0)}")
        
        # Create goal
        success3, new_goal = self.run_test(
            "Create Goal",
            "POST",
            "goals",
            200,
            data={
                "name": "Test Goal",
                "target_value": 100000,
                "current_value": 50000,
                "status": "on_track"
            }
        )
        
        # Test goal update
        if success3 and 'id' in new_goal:
            goal_id = new_goal['id']
            self.run_test(
                "Update Goal Progress",
                "PATCH",
                f"goals/{goal_id}/progress",
                200,
                data={"current_value": 60000}
            )
        
        return success and success2

    def test_teams(self):
        """Test teams endpoints"""
        print("\n" + "="*60)
        print("TESTING TEAMS")
        print("="*60)
        
        success, response = self.run_test(
            "Get Teams",
            "GET",
            "teams",
            200
        )
        if success:
            print(f"   Found {len(response)} teams")
        
        # Create team
        self.run_test(
            "Create Team",
            "POST",
            "teams",
            200,
            data={
                "name": "Test Team",
                "members_count": 5
            }
        )
        
        return success

    def test_portfolios(self):
        """Test portfolios endpoints"""
        print("\n" + "="*60)
        print("TESTING PORTFOLIOS")
        print("="*60)
        
        success, response = self.run_test(
            "Get Portfolios",
            "GET",
            "portfolios",
            200
        )
        if success:
            print(f"   Found {len(response)} portfolios")
        
        return success

    def test_initiatives(self):
        """Test initiatives endpoints"""
        print("\n" + "="*60)
        print("TESTING INITIATIVES")
        print("="*60)
        
        success, response = self.run_test(
            "Get Initiatives",
            "GET",
            "initiatives",
            200
        )
        if success:
            print(f"   Found {len(response)} initiatives")
        
        return success

    def test_kpis(self):
        """Test KPIs endpoints"""
        print("\n" + "="*60)
        print("TESTING KPIS")
        print("="*60)
        
        success, response = self.run_test(
            "Get KPIs",
            "GET",
            "kpis",
            200
        )
        if success:
            print(f"   Found {len(response)} KPIs")
        
        # Create KPI
        self.run_test(
            "Create KPI",
            "POST",
            "kpis",
            200,
            data={
                "name": "Test KPI",
                "target_value": 100,
                "unit": "number"
            }
        )
        
        return success

    def test_data_lake(self):
        """Test data lake endpoints"""
        print("\n" + "="*60)
        print("TESTING DATA LAKE")
        print("="*60)
        
        success, response = self.run_test(
            "Get Canonical Data",
            "GET",
            "data-lake/canonical",
            200,
            params={"entity": "accounts"}
        )
        if success:
            print(f"   Canonical records: {len(response.get('records', []))}")
        
        success2, response2 = self.run_test(
            "Get Serving Data",
            "GET",
            "data-lake/serving",
            200,
            params={"entity": "opportunities"}
        )
        if success2:
            print(f"   Serving records: {len(response2.get('records', []))}")
        
        return success and success2

    def test_search(self):
        """Test search endpoint"""
        print("\n" + "="*60)
        print("TESTING SEARCH")
        print("="*60)
        
        success, response = self.run_test(
            "Search Data",
            "GET",
            "search",
            200,
            params={"q": "test"}
        )
        if success:
            print(f"   Found {len(response)} search results")
        
        return success

    def test_admin(self):
        """Test admin endpoints"""
        print("\n" + "="*60)
        print("TESTING ADMIN")
        print("="*60)
        
        success, users = self.run_test(
            "Get Admin Users",
            "GET",
            "admin/users",
            200
        )
        if success:
            print(f"   Found {len(users)} users")
        
        success2, roles = self.run_test(
            "Get Admin Roles",
            "GET",
            "admin/roles",
            200
        )
        if success2:
            print(f"   Found {len(roles)} roles")
        
        success3, departments = self.run_test(
            "Get Admin Departments",
            "GET",
            "admin/departments",
            200
        )
        if success3:
            print(f"   Found {len(departments)} departments")
        
        self.run_test(
            "Get Admin Logs",
            "GET",
            "admin/logs",
            200
        )
        
        self.run_test(
            "Get Admin Permissions",
            "GET",
            "admin/permissions",
            200
        )
        
        return success and success2 and success3

    def test_config(self):
        """Test config endpoints"""
        print("\n" + "="*60)
        print("TESTING CONFIG")
        print("="*60)
        
        success, response = self.run_test(
            "Get System Config",
            "GET",
            "config",
            200
        )
        if success:
            print(f"   App: {response.get('app_name')}, Version: {response.get('version')}")
        
        self.run_test(
            "Get User Dashboard Config",
            "GET",
            "config/user/dashboard",
            200
        )
        
        return success

def main():
    print("\n" + "="*60)
    print("PLATFORM 3 API TESTING")
    print("="*60)
    
    tester = Platform3APITester()
    
    # Run all tests
    if not tester.test_login():
        print("\n❌ Login failed, stopping tests")
        return 1
    
    tester.test_auth_me()
    tester.test_dashboard()
    tester.test_opportunities()
    tester.test_accounts()
    tester.test_activities()
    tester.test_goals()
    tester.test_teams()
    tester.test_portfolios()
    tester.test_initiatives()
    tester.test_kpis()
    tester.test_data_lake()
    tester.test_search()
    tester.test_admin()
    tester.test_config()
    
    # Print final results
    print("\n" + "="*60)
    print("FINAL RESULTS")
    print("="*60)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"✅ Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ Failed tests ({len(tester.failed_tests)}):")
        for failed in tester.failed_tests:
            print(f"   - {failed.get('test')}: {failed.get('endpoint')}")
            if 'error' in failed:
                print(f"     Error: {failed['error']}")
            else:
                print(f"     Expected {failed.get('expected')}, got {failed.get('actual')}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
