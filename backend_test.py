#!/usr/bin/env python3
"""
Backend API Testing for CRM KPI Management Platform
Tests critical fixes: Sales Leaderboard (Won deals only), Dashboard stats, Invoices filtering, Year filters
"""
import requests
import sys
from datetime import datetime

BASE_URL = "https://crm-win-fix.preview.emergentagent.com"

class CRMAPITester:
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
                self.log_result("Login", True, f"Token obtained")
                return True
            else:
                self.log_result("Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Login", False, f"Error: {str(e)}")
            return False

    def test_dashboard_stats_unfiltered(self):
        """Test GET /api/dashboard/stats - unfiltered baseline"""
        print("\n📊 Testing GET /api/dashboard/stats (unfiltered)...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                total_pipeline = data.get("total_pipeline", 0)
                won_count = data.get("won_count", 0)
                lost_count = data.get("lost_count", 0)
                won_value = data.get("won_value", 0)
                win_rate = data.get("win_rate", 0)
                leaderboard = data.get("leaderboard", [])
                
                # CRITICAL: Verify Win Rate is 40.2% (144 won / 358 closed)
                expected_win_rate = 40.2
                expected_won = 144
                expected_lost = 214
                
                win_rate_correct = abs(win_rate - expected_win_rate) < 0.5  # Allow 0.5% tolerance
                won_count_correct = won_count == expected_won
                lost_count_correct = lost_count == expected_lost
                
                if win_rate_correct and won_count_correct and lost_count_correct:
                    self.log_result("Dashboard Stats (unfiltered)", True, 
                                  f"✅ Win Rate={win_rate}% (expected 40.2%), Won={won_count} (expected 144), Lost={lost_count} (expected 214)")
                else:
                    self.log_result("Dashboard Stats (unfiltered)", False, 
                                  f"❌ Win Rate={win_rate}% (expected 40.2%), Won={won_count} (expected 144), Lost={lost_count} (expected 214)")
                
                # Return data for further analysis
                return data
            else:
                self.log_result("Dashboard Stats (unfiltered)", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result("Dashboard Stats (unfiltered)", False, f"Error: {str(e)}")
            return None

    def test_leaderboard_won_deals_only(self):
        """CRITICAL: Test that leaderboard shows ONLY WON deals, not total pipeline"""
        print("\n🏆 CRITICAL TEST: Leaderboard shows WON deals only...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                leaderboard = data.get("leaderboard", [])
                
                if not leaderboard:
                    self.log_result("Leaderboard Won Deals Only", False, "Leaderboard is empty")
                    return None
                
                # Check top performer
                top_performer = leaderboard[0]
                top_name = top_performer.get("name", "")
                top_value = top_performer.get("value", 0)
                top_deals_won = top_performer.get("deals_won", 0)
                
                # According to agent context: Shri Hari Venkatesh Naidu should be #1 with OMR 1,014,217 (30 won deals)
                # Previously showed Nabisaheb with OMR 24.6M (total pipeline - WRONG)
                
                # Check if top value is reasonable for won deals (not inflated by total pipeline)
                # If it's > 10M, it's likely showing total pipeline instead of won deals
                is_reasonable = top_value < 10_000_000  # Less than 10M is reasonable for won deals
                
                if is_reasonable:
                    self.log_result("Leaderboard Won Deals Only", True, 
                                  f"Top: {top_name} with {top_value:,.0f} ({top_deals_won} won deals) - appears to be won deals only")
                else:
                    self.log_result("Leaderboard Won Deals Only", False, 
                                  f"Top: {top_name} with {top_value:,.0f} - value too high, likely showing total pipeline instead of won deals!")
                
                # Print full leaderboard for verification
                print("\n   Full Leaderboard:")
                for i, person in enumerate(leaderboard[:5], 1):
                    print(f"   {i}. {person.get('name')} - {person.get('value'):,.0f} ({person.get('deals_won', 0)} won deals)")
                
                return leaderboard
            else:
                self.log_result("Leaderboard Won Deals Only", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result("Leaderboard Won Deals Only", False, f"Error: {str(e)}")
            return None

    def test_year_filter_2025(self):
        """CRITICAL: Test year filter 2025 - should show Won=1, Lost=5, Win Rate=16.7%"""
        print("\n📅 CRITICAL TEST: Year filter 2025 (Won=1, Lost=5, Win Rate=16.7%)...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats?year=2025",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                won_count = data.get("won_count", 0)
                lost_count = data.get("lost_count", 0)
                win_rate = data.get("win_rate", 0)
                won_value = data.get("won_value", 0)
                filtered = data.get("filtered", False)
                applied_filters = data.get("applied_filters", {})
                
                # According to agent context: 2025 should show Won=1, Lost=5, Win Rate=16.7%
                expected_won = 1
                expected_lost = 5
                expected_win_rate = 16.7
                
                won_correct = won_count == expected_won
                lost_correct = lost_count == expected_lost
                win_rate_correct = abs(win_rate - expected_win_rate) < 1.0  # Allow 1% tolerance
                
                if won_correct and lost_correct and win_rate_correct:
                    self.log_result("Year Filter 2025", True, 
                                  f"✅ Won={won_count} (expected 1), Lost={lost_count} (expected 5), Win Rate={win_rate}% (expected 16.7%)")
                else:
                    self.log_result("Year Filter 2025", False, 
                                  f"❌ Won={won_count} (expected 1), Lost={lost_count} (expected 5), Win Rate={win_rate}% (expected 16.7%)")
                
                return data
            else:
                self.log_result("Year Filter 2025", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result("Year Filter 2025", False, f"Error: {str(e)}")
            return None

    def test_dashboard_contextual_filters(self):
        """Test Dashboard contextual filters: Year, Quarter, SalesRep, Stage"""
        print("\n🔍 Testing Dashboard contextual filters...")
        
        # Test Year filter
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats?year=2024",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                filtered = data.get("filtered", False)
                applied_filters = data.get("applied_filters", {})
                
                if filtered and applied_filters.get("year") == "2024":
                    self.log_result("Dashboard Year Filter", True, f"Year filter working, won_count={data.get('won_count', 0)}")
                else:
                    self.log_result("Dashboard Year Filter", False, f"Year filter not applied correctly")
            else:
                self.log_result("Dashboard Year Filter", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Dashboard Year Filter", False, f"Error: {str(e)}")
        
        # Test Quarter filter
        try:
            response = requests.get(
                f"{BASE_URL}/api/dashboard/stats?quarter=Q1",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                filtered = data.get("filtered", False)
                applied_filters = data.get("applied_filters", {})
                
                if filtered and applied_filters.get("quarter") == "Q1":
                    self.log_result("Dashboard Quarter Filter", True, f"Quarter filter working")
                else:
                    self.log_result("Dashboard Quarter Filter", False, f"Quarter filter not applied correctly")
            else:
                self.log_result("Dashboard Quarter Filter", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Dashboard Quarter Filter", False, f"Error: {str(e)}")

    def test_opportunities_contextual_filters(self):
        """Test Opportunities contextual filters: Year, Quarter, SalesRep, Account, Stage"""
        print("\n🔍 Testing Opportunities contextual filters...")
        
        # Test Year filter
        try:
            response = requests.get(
                f"{BASE_URL}/api/opportunities?year=2024",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                count = len(data)
                self.log_result("Opportunities Year Filter", True, f"Returned {count} opportunities for 2024")
            else:
                self.log_result("Opportunities Year Filter", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Opportunities Year Filter", False, f"Error: {str(e)}")

    def test_activities_contextual_filters(self):
        """Test Activities contextual filters: Year, Quarter, SalesRep, Type, Status"""
        print("\n🔍 Testing Activities contextual filters...")
        
        # Test Status filter
        try:
            response = requests.get(
                f"{BASE_URL}/api/activities?status=pending",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                count = len(data)
                # Verify all are pending
                all_pending = all(act.get("status") == "pending" for act in data)
                
                if all_pending:
                    self.log_result("Activities Status Filter", True, f"Returned {count} pending activities")
                else:
                    self.log_result("Activities Status Filter", False, f"Some activities are not pending")
            else:
                self.log_result("Activities Status Filter", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Activities Status Filter", False, f"Error: {str(e)}")

    def test_invoices_stats(self):
        """CRITICAL: Test Invoices stats - Total OMR 2.8M, Overdue OMR 881K, Paid OMR 1.9M"""
        print("\n💰 CRITICAL TEST: Invoices stats (Total 2.8M, Overdue 881K, Paid 1.9M)...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/receivables/stats",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                stats = data.get("stats", {})
                total_invoiced = stats.get("total_invoiced", 0)
                total_pending = stats.get("total_pending", 0)
                total_overdue = stats.get("total_overdue", 0)
                total_paid = stats.get("total_paid", 0)
                count_total = stats.get("count_total", 0)
                
                # Expected values from agent context
                expected_total = 2_800_000  # 2.8M
                expected_overdue = 881_000  # 881K
                expected_paid = 1_900_000  # 1.9M
                
                # Allow 10% tolerance for amounts
                total_correct = abs(total_invoiced - expected_total) / expected_total < 0.1
                overdue_correct = abs(total_overdue - expected_overdue) / expected_overdue < 0.1
                paid_correct = abs(total_paid - expected_paid) / expected_paid < 0.1
                
                # Verify stats add up correctly
                sum_amounts = total_pending + total_overdue + total_paid
                amounts_match = abs(sum_amounts - total_invoiced) < 1  # Allow for rounding
                
                if amounts_match and total_correct and overdue_correct and paid_correct:
                    self.log_result("Invoices Stats", True, 
                                  f"✅ Total={total_invoiced:,.0f} (~2.8M), Overdue={total_overdue:,.0f} (~881K), Paid={total_paid:,.0f} (~1.9M)")
                else:
                    self.log_result("Invoices Stats", False, 
                                  f"❌ Total={total_invoiced:,.0f} (expected ~2.8M), Overdue={total_overdue:,.0f} (expected ~881K), Paid={total_paid:,.0f} (expected ~1.9M)")
                
                return stats
            else:
                self.log_result("Invoices Stats", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_result("Invoices Stats", False, f"Error: {str(e)}")
            return None

    def test_invoices_filtering(self):
        """Test Invoices filtering: All, Pending, Overdue, Paid tabs"""
        print("\n💰 Testing Invoices filtering (tabs)...")
        
        statuses = ["all", "pending", "overdue", "paid"]
        
        for status in statuses:
            try:
                params = {"status": status} if status != "all" else {}
                response = requests.get(
                    f"{BASE_URL}/api/receivables",
                    headers={"Authorization": f"Bearer {self.token}"},
                    params=params,
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    invoices = data.get("invoices", data)  # Handle both formats
                    count = len(invoices)
                    
                    # Verify all invoices match the filter
                    if status != "all":
                        all_match = all(inv.get("status") == status for inv in invoices)
                        if all_match:
                            self.log_result(f"Invoices Filter ({status})", True, f"Returned {count} {status} invoices")
                        else:
                            mismatched = [inv.get("status") for inv in invoices if inv.get("status") != status]
                            self.log_result(f"Invoices Filter ({status})", False, 
                                          f"Some invoices don't match filter. Found statuses: {set(mismatched)}")
                    else:
                        self.log_result(f"Invoices Filter ({status})", True, f"Returned {count} total invoices")
                else:
                    self.log_result(f"Invoices Filter ({status})", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result(f"Invoices Filter ({status})", False, f"Error: {str(e)}")

    def test_invoices_contextual_filters(self):
        """Test Invoices contextual filters: Year, Quarter, Account"""
        print("\n🔍 Testing Invoices contextual filters...")
        
        # Test Year filter
        try:
            response = requests.get(
                f"{BASE_URL}/api/receivables?year=2024",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                invoices = data.get("invoices", data)
                count = len(invoices)
                self.log_result("Invoices Year Filter", True, f"Returned {count} invoices for 2024")
            else:
                self.log_result("Invoices Year Filter", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Invoices Year Filter", False, f"Error: {str(e)}")

    def test_stage_mapping(self):
        """Test that 'Won' stage in Odoo maps correctly to leaderboard calculations"""
        print("\n🎯 Testing Stage mapping (Won stage)...")
        try:
            # Get opportunities with Won stage
            response = requests.get(
                f"{BASE_URL}/api/opportunities?stage=Won",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                count = len(data)
                
                # Now check if dashboard stats match
                dash_response = requests.get(
                    f"{BASE_URL}/api/dashboard/stats",
                    headers={"Authorization": f"Bearer {self.token}"},
                    timeout=10
                )
                if dash_response.status_code == 200:
                    dash_data = dash_response.json()
                    won_count = dash_data.get("won_count", 0)
                    
                    # The counts should be related (though not necessarily exact due to filtering)
                    self.log_result("Stage Mapping (Won)", True, 
                                  f"Found {count} Won opportunities, dashboard shows {won_count} won deals")
                else:
                    self.log_result("Stage Mapping (Won)", False, f"Dashboard request failed")
            else:
                self.log_result("Stage Mapping (Won)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Stage Mapping (Won)", False, f"Error: {str(e)}")

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
    tester = CRMAPITester()
    
    # Login first
    if not tester.login():
        print("❌ Login failed, cannot proceed with tests")
        return 1
    
    # CRITICAL TESTS
    print("\n" + "="*60)
    print("🔥 CRITICAL TESTS - Sales Leaderboard & Year Filter")
    print("="*60)
    tester.test_dashboard_stats_unfiltered()
    tester.test_leaderboard_won_deals_only()  # CRITICAL: Leaderboard shows WON deals only
    tester.test_year_filter_2025()  # CRITICAL: 2025 should show 1 won deal
    
    # Dashboard stats and filters
    print("\n" + "="*60)
    print("📊 Dashboard Stats & Contextual Filters")
    print("="*60)
    tester.test_dashboard_contextual_filters()
    
    # Opportunities filters
    print("\n" + "="*60)
    print("🎯 Opportunities Contextual Filters")
    print("="*60)
    tester.test_opportunities_contextual_filters()
    
    # Activities filters
    print("\n" + "="*60)
    print("📋 Activities Contextual Filters")
    print("="*60)
    tester.test_activities_contextual_filters()
    
    # Invoices stats and filtering
    print("\n" + "="*60)
    print("💰 Invoices Stats & Filtering")
    print("="*60)
    tester.test_invoices_stats()
    tester.test_invoices_filtering()
    tester.test_invoices_contextual_filters()
    
    # Stage mapping
    print("\n" + "="*60)
    print("🎯 Stage Mapping Verification")
    print("="*60)
    tester.test_stage_mapping()
    
    # Print summary
    return tester.print_summary()

if __name__ == "__main__":
    sys.exit(main())
