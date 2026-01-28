#!/usr/bin/env python3
"""
Backend API Testing for Leads Feature
Tests leads endpoints, opportunities separation, and filter functionality
"""
import requests
import sys
from datetime import datetime

BASE_URL = "https://crm-win-fix.preview.emergentagent.com"

class LeadsAPITester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.lead_id = None  # Store a lead ID for conversion test

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
                self.log_result("Login", True, f"Token obtained")
                return True
            else:
                self.log_result("Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Login", False, f"Error: {str(e)}")
            return False

    def test_leads_list(self):
        """Test GET /api/leads - should return only type=lead"""
        print("\n📋 Testing GET /api/leads...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/leads",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                count = len(data)
                
                # Verify all records are type=lead
                all_leads = all(record.get("type") == "lead" for record in data)
                
                if all_leads:
                    # Store first lead ID for conversion test
                    if data and len(data) > 0:
                        self.lead_id = data[0].get("canonical_id")
                    self.log_result("GET /api/leads", True, f"Returned {count} leads, all type=lead")
                    return count
                else:
                    self.log_result("GET /api/leads", False, f"Some records are not type=lead")
                    return None
            else:
                self.log_result("GET /api/leads", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_result("GET /api/leads", False, f"Error: {str(e)}")
            return None

    def test_leads_year_filter(self, year="2026"):
        """Test GET /api/leads?year=2026 - should filter by year"""
        print(f"\n📋 Testing GET /api/leads?year={year}...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/leads?year={year}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                count = len(data)
                
                # Verify all records are type=lead
                all_leads = all(record.get("type") == "lead" for record in data)
                
                if all_leads:
                    self.log_result(f"GET /api/leads?year={year}", True, f"Returned {count} leads for year {year}")
                    return count
                else:
                    self.log_result(f"GET /api/leads?year={year}", False, f"Some records are not type=lead")
                    return None
            else:
                self.log_result(f"GET /api/leads?year={year}", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result(f"GET /api/leads?year={year}", False, f"Error: {str(e)}")
            return None

    def test_leads_stats(self):
        """Test GET /api/leads/stats"""
        print("\n📊 Testing GET /api/leads/stats...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/leads/stats",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                total_leads = data.get("total_leads", 0)
                new_leads = data.get("new_leads", 0)
                qualified_leads = data.get("qualified_leads", 0)
                conversion_rate = data.get("conversion_rate", 0)
                
                self.log_result("GET /api/leads/stats", True, 
                              f"total_leads={total_leads}, new_leads={new_leads}, qualified_leads={qualified_leads}, conversion_rate={conversion_rate}%")
                return data
            else:
                self.log_result("GET /api/leads/stats", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result("GET /api/leads/stats", False, f"Error: {str(e)}")
            return None

    def test_leads_kanban(self):
        """Test GET /api/leads/kanban"""
        print("\n📊 Testing GET /api/leads/kanban...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/leads/kanban",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                total_count = data.get("total_count", 0)
                stages = data.get("stages", [])
                
                self.log_result("GET /api/leads/kanban", True, 
                              f"total_count={total_count}, stages={stages}")
                return data
            else:
                self.log_result("GET /api/leads/kanban", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result("GET /api/leads/kanban", False, f"Error: {str(e)}")
            return None

    def test_opportunities_exclude_leads(self):
        """Test GET /api/opportunities - should only return type=opportunity"""
        print("\n📋 Testing GET /api/opportunities (should exclude leads)...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/opportunities",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                count = len(data)
                
                # Verify all records are type=opportunity
                all_opportunities = all(record.get("type") == "opportunity" for record in data)
                
                if all_opportunities:
                    self.log_result("GET /api/opportunities", True, f"Returned {count} opportunities, all type=opportunity (no leads)")
                    return count
                else:
                    # Check if any leads are present
                    leads_found = [r for r in data if r.get("type") == "lead"]
                    self.log_result("GET /api/opportunities", False, f"Found {len(leads_found)} leads in opportunities endpoint!")
                    return None
            else:
                self.log_result("GET /api/opportunities", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result("GET /api/opportunities", False, f"Error: {str(e)}")
            return None

    def test_dashboard_stats_separation(self):
        """Test GET /api/dashboard/stats - should show separate counts for opportunities and leads"""
        print("\n📊 Testing GET /api/dashboard/stats (opportunities vs leads separation)...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                total_opportunities = data.get("total_opportunities", 0)
                total_leads = data.get("total_leads", 0)
                new_leads = data.get("new_leads", 0)
                qualified_leads = data.get("qualified_leads", 0)
                
                # Check if separate counts exist
                has_separation = "total_leads" in data and "total_opportunities" in data
                
                if has_separation:
                    self.log_result("Dashboard Stats Separation", True, 
                                  f"total_opportunities={total_opportunities}, total_leads={total_leads}, new_leads={new_leads}, qualified_leads={qualified_leads}")
                    return data
                else:
                    self.log_result("Dashboard Stats Separation", False, 
                                  f"Missing separate counts for leads and opportunities")
                    return None
            else:
                self.log_result("Dashboard Stats Separation", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result("Dashboard Stats Separation", False, f"Error: {str(e)}")
            return None

    def test_dashboard_stats_filtered(self, year="2025"):
        """Test GET /api/dashboard/stats?year=2025 - should show filtered counts"""
        print(f"\n📊 Testing GET /api/dashboard/stats?year={year} (filtered)...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats?year={year}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                total_opportunities = data.get("total_opportunities", 0)
                total_leads = data.get("total_leads", 0)
                filtered = data.get("filtered", False)
                applied_filters = data.get("applied_filters", {})
                
                if filtered and applied_filters.get("year") == year:
                    self.log_result(f"Dashboard Stats year={year}", True, 
                                  f"total_opportunities={total_opportunities}, total_leads={total_leads}, filtered={filtered}")
                    return data
                else:
                    self.log_result(f"Dashboard Stats year={year}", False, 
                                  f"Filter not applied correctly. filtered={filtered}, applied_filters={applied_filters}")
                    return None
            else:
                self.log_result(f"Dashboard Stats year={year}", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result(f"Dashboard Stats year={year}", False, f"Error: {str(e)}")
            return None

    def test_convert_lead(self):
        """Test POST /api/leads/{id}/convert - convert lead to opportunity"""
        if not self.lead_id:
            self.log_result("Convert Lead", False, "No lead ID available for conversion test")
            return False
            
        print(f"\n🔄 Testing POST /api/leads/{self.lead_id}/convert...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/leads/{self.lead_id}/convert",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                success = data.get("success", False)
                
                if success:
                    self.log_result("Convert Lead", True, f"Lead {self.lead_id} converted to opportunity")
                    return True
                else:
                    self.log_result("Convert Lead", False, f"Conversion failed: {data}")
                    return False
            else:
                self.log_result("Convert Lead", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Convert Lead", False, f"Error: {str(e)}")
            return False

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
        
        if self.tests_passed == self.tests_run:
            print("✅ ALL TESTS PASSED!")
            return 0
        else:
            print("❌ SOME TESTS FAILED")
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  - {result['test']}: {result['message']}")
            return 1

def main():
    tester = LeadsAPITester()
    
    # Login first
    if not tester.login():
        print("❌ Login failed, cannot proceed with tests")
        return 1
    
    # Test leads endpoints
    tester.test_leads_list()
    tester.test_leads_year_filter("2026")
    tester.test_leads_stats()
    tester.test_leads_kanban()
    
    # Test opportunities endpoint (should exclude leads)
    tester.test_opportunities_exclude_leads()
    
    # Test dashboard stats (should show separate counts)
    tester.test_dashboard_stats_separation()
    tester.test_dashboard_stats_filtered("2025")
    
    # Test lead conversion (this will modify data, so do it last)
    tester.test_convert_lead()
    
    # Print summary
    return tester.print_summary()

if __name__ == "__main__":
    sys.exit(main())
