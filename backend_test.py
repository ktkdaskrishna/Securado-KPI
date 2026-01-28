#!/usr/bin/env python3
"""
Backend API Testing for CRM Dashboard with RBAC
Tests all critical APIs including RBAC permissions
"""
import requests
import sys
import time
from datetime import datetime

BASE_URL = "https://data-sync-fix-7.preview.emergentagent.com"

class CRMAPITester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.performance_issues = []

    def log_result(self, test_name, passed, message="", response_time=None):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            status = "✅ PASSED"
        else:
            status = "❌ FAILED"
        
        perf_msg = f" ({response_time:.2f}s)" if response_time else ""
        print(f"{status} {test_name}{perf_msg}: {message}")
        
        # Track slow APIs (>2 seconds)
        if response_time and response_time > 2.0:
            self.performance_issues.append({
                "endpoint": test_name,
                "response_time": response_time
            })
        
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "message": message,
            "response_time": response_time
        })

    def test_api(self, name, method, endpoint, expected_status=200, json_data=None, check_response=None):
        """Generic API test with performance tracking"""
        try:
            headers = {'Content-Type': 'application/json'}
            if self.token:
                headers['Authorization'] = f'Bearer {self.token}'
            
            url = f"{BASE_URL}{endpoint}"
            start_time = time.time()
            
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=json_data, headers=headers, timeout=15)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response_time = time.time() - start_time
            
            if response.status_code == expected_status:
                data = response.json() if response.content else {}
                
                # Additional response validation
                if check_response and not check_response(data):
                    self.log_result(name, False, f"Response validation failed", response_time)
                    return False, data
                
                self.log_result(name, True, f"Status: {response.status_code}", response_time)
                return True, data
            else:
                self.log_result(name, False, f"Expected {expected_status}, got {response.status_code}: {response.text[:200]}", response_time)
                return False, {}
        except requests.Timeout:
            self.log_result(name, False, "Request timed out (>15s)")
            return False, {}
        except Exception as e:
            self.log_result(name, False, f"Error: {str(e)}")
            return False, {}

    def run_tests(self):
        """Run all API tests"""
        print("\n" + "="*80)
        print("🧪 CRM Dashboard API Testing - RBAC & Performance Check")
        print("="*80)
        
        # 1. Login Test
        print("\n📋 Authentication Tests")
        print("-" * 80)
        success, data = self.test_api(
            "Login API",
            "POST",
            "/api/auth/login",
            json_data={"email": "test@securado.com", "password": "test123456"},
            check_response=lambda d: 'access_token' in d
        )
        
        if not success:
            print("\n❌ Login failed. Cannot proceed with other tests.")
            return False
        
        self.token = data.get('access_token')
        
        # 2. RBAC Tests - CRITICAL for sidebar
        print("\n📋 RBAC Tests (Critical for Sidebar)")
        print("-" * 80)
        success, rbac_data = self.test_api(
            "RBAC Current User",
            "GET",
            "/api/odoo-rbac/current-user-rbac",
            check_response=lambda d: 'effective_permissions' in d
        )
        
        if success:
            permissions = rbac_data.get('effective_permissions', [])
            roles = rbac_data.get('app_roles', [])
            record_access = rbac_data.get('record_access', 'unknown')
            
            print(f"   📊 User Permissions: {len(permissions)} permissions")
            print(f"   📊 User Roles: {roles}")
            print(f"   📊 Record Access: {record_access}")
            
            # Check if user has basic permissions
            required_perms = ['view_dashboard', 'view_opportunities', 'view_accounts', 'view_activities']
            missing_perms = [p for p in required_perms if p not in permissions]
            
            if missing_perms:
                print(f"   ⚠️  WARNING: Missing basic permissions: {missing_perms}")
                print(f"   ⚠️  This will cause sidebar items to be hidden!")
        
        # 3. Dashboard APIs
        print("\n📋 Dashboard APIs")
        print("-" * 80)
        self.test_api("Dashboard Stats", "GET", "/api/dashboard/stats")
        self.test_api("Dashboard Leaderboard", "GET", "/api/dashboard/stats", 
                     check_response=lambda d: 'leaderboard' in d)
        self.test_api("Dashboard Pipeline Stages", "GET", "/api/dashboard/stats",
                     check_response=lambda d: 'pipeline_by_stage' in d)
        
        # 4. CRM APIs
        print("\n📋 CRM APIs")
        print("-" * 80)
        self.test_api("Opportunities List", "GET", "/api/opportunities")
        self.test_api("Leads List", "GET", "/api/leads")
        self.test_api("Accounts List", "GET", "/api/accounts")
        self.test_api("Activities List", "GET", "/api/activities")
        
        # 5. Invoices/Receivables
        print("\n📋 Invoices/Receivables APIs")
        print("-" * 80)
        self.test_api("Receivables List", "GET", "/api/receivables")
        self.test_api("Receivables Stats", "GET", "/api/receivables/stats")
        
        # 6. Analytics
        print("\n📋 Analytics APIs")
        print("-" * 80)
        self.test_api("Analytics Overview", "GET", "/api/analytics/overview")
        self.test_api("Analytics Conversion Funnel", "GET", "/api/analytics/conversion-funnel")
        
        # 7. Performance Summary
        print("\n📋 Performance Summary")
        print("-" * 80)
        if self.performance_issues:
            print(f"⚠️  Found {len(self.performance_issues)} slow API(s) (>2 seconds):")
            for issue in self.performance_issues:
                print(f"   - {issue['endpoint']}: {issue['response_time']:.2f}s")
        else:
            print("✅ All APIs responded within 2 seconds")
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("📊 Test Summary")
        print("="*80)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.performance_issues:
            print(f"\n⚠️  Performance Issues: {len(self.performance_issues)} slow API(s)")
        
        print("="*80)
        
        return self.tests_passed == self.tests_run

def main():
    tester = CRMAPITester()
    
    try:
        tester.run_tests()
        success = tester.print_summary()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
