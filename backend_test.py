#!/usr/bin/env python3
"""
Backend API Testing for CRM Filter Functionality
Tests year/quarter filtering on all major endpoints
"""
import requests
import sys
from datetime import datetime

BASE_URL = "https://filter-connect.preview.emergentagent.com"

class FilterAPITester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, passed, message=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED {message}")
        else:
            print(f"❌ {test_name}: FAILED {message}")
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "message": message
        })

    def login(self):
        """Login and get token"""
        print("\n🔐 Testing Login...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "test@securado.com", "password": "test123456"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.log_result("Login", True, f"Token: {self.token[:20]}...")
                return True
            else:
                self.log_result("Login", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Login", False, f"Error: {str(e)}")
            return False

    def test_dashboard_no_filter(self):
        """Test dashboard without filters"""
        print("\n📊 Testing Dashboard - No Filter...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                total_opps = data.get("total_opportunities", 0)
                self.log_result("Dashboard No Filter", True, f"Total opportunities: {total_opps}")
                return total_opps
            else:
                self.log_result("Dashboard No Filter", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result("Dashboard No Filter", False, f"Error: {str(e)}")
            return None

    def test_dashboard_year_filter(self, year):
        """Test dashboard with year filter"""
        print(f"\n📊 Testing Dashboard - Year Filter ({year})...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats?year={year}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                total_opps = data.get("total_opportunities", 0)
                filtered = data.get("filtered", False)
                applied_filters = data.get("applied_filters", {})
                
                # Verify filter was applied
                if applied_filters.get("year") == year and filtered:
                    self.log_result(f"Dashboard Year={year}", True, 
                                  f"Filtered opportunities: {total_opps}, filters applied: {applied_filters}")
                    return total_opps
                else:
                    self.log_result(f"Dashboard Year={year}", False, 
                                  f"Filter not applied correctly. filtered={filtered}, applied_filters={applied_filters}")
                    return None
            else:
                self.log_result(f"Dashboard Year={year}", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result(f"Dashboard Year={year}", False, f"Error: {str(e)}")
            return None

    def test_dashboard_quarter_filter(self, year, quarter):
        """Test dashboard with year and quarter filter"""
        print(f"\n📊 Testing Dashboard - Year={year}, Quarter={quarter}...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats?year={year}&quarter={quarter}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                total_opps = data.get("total_opportunities", 0)
                filtered = data.get("filtered", False)
                applied_filters = data.get("applied_filters", {})
                
                if applied_filters.get("year") == year and applied_filters.get("quarter") == quarter and filtered:
                    self.log_result(f"Dashboard Year={year} Quarter={quarter}", True, 
                                  f"Filtered opportunities: {total_opps}")
                    return total_opps
                else:
                    self.log_result(f"Dashboard Year={year} Quarter={quarter}", False, 
                                  f"Filters not applied correctly")
                    return None
            else:
                self.log_result(f"Dashboard Year={year} Quarter={quarter}", False, 
                              f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result(f"Dashboard Year={year} Quarter={quarter}", False, f"Error: {str(e)}")
            return None

    def test_opportunities_year_filter(self, year):
        """Test opportunities list with year filter"""
        print(f"\n💼 Testing Opportunities - Year Filter ({year})...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/opportunities?year={year}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
                self.log_result(f"Opportunities Year={year}", True, f"Count: {count}")
                return count
            else:
                self.log_result(f"Opportunities Year={year}", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result(f"Opportunities Year={year}", False, f"Error: {str(e)}")
            return None

    def test_kanban_year_filter(self, year):
        """Test kanban view with year filter"""
        print(f"\n📋 Testing Kanban - Year Filter ({year})...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/opportunities/kanban?year={year}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                total_count = data.get("total_count", 0)
                filtered = data.get("filtered", False)
                
                if filtered:
                    self.log_result(f"Kanban Year={year}", True, f"Total count: {total_count}, filtered: {filtered}")
                    return total_count
                else:
                    self.log_result(f"Kanban Year={year}", False, "Filter not applied")
                    return None
            else:
                self.log_result(f"Kanban Year={year}", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result(f"Kanban Year={year}", False, f"Error: {str(e)}")
            return None

    def test_accounts_year_filter(self, year):
        """Test accounts list with year filter"""
        print(f"\n🏢 Testing Accounts - Year Filter ({year})...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/accounts?year={year}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
                self.log_result(f"Accounts Year={year}", True, f"Count: {count}")
                return count
            else:
                self.log_result(f"Accounts Year={year}", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result(f"Accounts Year={year}", False, f"Error: {str(e)}")
            return None

    def test_activities_year_filter(self, year):
        """Test activities list with year filter"""
        print(f"\n📅 Testing Activities - Year Filter ({year})...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/activities?year={year}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
                self.log_result(f"Activities Year={year}", True, f"Count: {count}")
                return count
            else:
                self.log_result(f"Activities Year={year}", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result(f"Activities Year={year}", False, f"Error: {str(e)}")
            return None

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        print("="*60)
        
        if self.tests_passed < self.tests_run:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return 0 if self.tests_passed == self.tests_run else 1


def main():
    print("="*60)
    print("🧪 CRM FILTER API TESTING")
    print("="*60)
    
    tester = FilterAPITester()
    
    # Login
    if not tester.login():
        print("\n❌ Login failed. Cannot proceed with tests.")
        return 1
    
    # Test 1: Dashboard without filter (baseline)
    baseline_count = tester.test_dashboard_no_filter()
    
    # Test 2: Dashboard with year=2025
    year_2025_count = tester.test_dashboard_year_filter("2025")
    
    # Test 3: Dashboard with year=2026
    year_2026_count = tester.test_dashboard_year_filter("2026")
    
    # Test 4: Dashboard with year=2025, quarter=Q1
    quarter_count = tester.test_dashboard_quarter_filter("2025", "Q1")
    
    # Test 5: Opportunities with year filter
    opp_2025_count = tester.test_opportunities_year_filter("2025")
    
    # Test 6: Kanban with year filter
    kanban_2025_count = tester.test_kanban_year_filter("2025")
    
    # Test 7: Accounts with year filter
    accounts_2025_count = tester.test_accounts_year_filter("2025")
    
    # Test 8: Activities with year filter
    activities_2025_count = tester.test_activities_year_filter("2025")
    
    # Verify filtering is working (counts should be different)
    print("\n🔍 FILTER EFFECTIVENESS CHECK:")
    if baseline_count and year_2025_count is not None and year_2026_count is not None:
        if year_2025_count != baseline_count or year_2026_count != baseline_count:
            print(f"✅ Filtering is working: baseline={baseline_count}, 2025={year_2025_count}, 2026={year_2026_count}")
        else:
            print(f"⚠️  Warning: All counts are the same. Filtering may not be working correctly.")
            print(f"   baseline={baseline_count}, 2025={year_2025_count}, 2026={year_2026_count}")
    
    # Print summary
    return tester.print_summary()


if __name__ == "__main__":
    sys.exit(main())
