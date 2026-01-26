"""
Backend API Testing for ESIP Data Pipeline Platform
Tests all API endpoints with real data
"""
import requests
import sys
from datetime import datetime

class ESIPAPITester:
    def __init__(self, base_url="https://streamhub-crm.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.connection_id = None
        self.mapping_id = None
        self.pipeline_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}")
        print(f"   {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"   ✅ PASS - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"   ❌ FAIL - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"   ❌ FAIL - Error: {str(e)}")
            return False, {}

    def test_login(self):
        """Test login with demo credentials"""
        print("\n" + "="*60)
        print("AUTHENTICATION TESTS")
        print("="*60)
        
        success, response = self.run_test(
            "Login with demo@esip.com",
            "POST",
            "auth/login",
            200,
            data={"email": "demo@esip.com", "password": "demodemo"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   🔑 Token obtained: {self.token[:20]}...")
            return True
        else:
            print("   ⚠️ Login failed - trying to register first")
            # Try to register if login fails
            success, response = self.run_test(
                "Register demo@esip.com",
                "POST",
                "auth/register",
                200,
                data={"email": "demo@esip.com", "password": "demodemo", "name": "Demo User"}
            )
            if success and 'access_token' in response:
                self.token = response['access_token']
                print(f"   🔑 Token obtained after registration: {self.token[:20]}...")
                return True
        return False

    def test_connections(self):
        """Test connection management"""
        print("\n" + "="*60)
        print("CONNECTION TESTS")
        print("="*60)
        
        # List connections
        success, response = self.run_test(
            "List connections",
            "GET",
            "connections",
            200
        )
        
        if success:
            connections = response if isinstance(response, list) else []
            print(f"   📊 Found {len(connections)} connections")
            
            # Check if Securado Odoo connection exists
            securado_conn = None
            for conn in connections:
                if 'Securado' in conn.get('name', '') or 'securado' in conn.get('url', '').lower():
                    securado_conn = conn
                    self.connection_id = conn['id']
                    print(f"   ✓ Found Securado Odoo connection: {conn['name']}")
                    break
            
            if not securado_conn:
                print("   ⚠️ Securado Odoo connection not found, creating it...")
                # Create connection
                success, response = self.run_test(
                    "Create Securado Odoo connection",
                    "POST",
                    "connections",
                    200,
                    data={
                        "name": "Securado Odoo",
                        "type": "odoo",
                        "url": "https://securadotest.odoo.com",
                        "database": "securadotest",
                        "username": "krishna@securado.net",
                        "api_key": "a14e5c5c0a69504f6e28f648890767f0711a416d"
                    }
                )
                if success:
                    self.connection_id = response.get('id')
                    print(f"   ✓ Connection created with ID: {self.connection_id}")
        
        # Test connection
        if self.connection_id:
            success, response = self.run_test(
                "Test Securado Odoo connection",
                "POST",
                f"connections/{self.connection_id}/test",
                200
            )
            if success:
                health = response.get('health', 'unknown')
                print(f"   🏥 Connection health: {health}")
                if health == 'healthy':
                    print("   ✓ Connection is healthy!")
                else:
                    print(f"   ⚠️ Connection health is {health}")

    def test_schema_discovery(self):
        """Test schema discovery"""
        print("\n" + "="*60)
        print("SCHEMA DISCOVERY TESTS")
        print("="*60)
        
        if not self.connection_id:
            print("   ⚠️ No connection ID available, skipping schema tests")
            return
        
        # Discover schema
        success, response = self.run_test(
            "Discover Odoo schema",
            "POST",
            f"connections/{self.connection_id}/discover",
            200
        )
        
        if success:
            models = response.get('models', [])
            print(f"   📋 Discovered {len(models)} models")
            if len(models) >= 24:
                print("   ✓ Found 24+ CRM models as expected")
            else:
                print(f"   ⚠️ Expected 24+ models, found {len(models)}")
        
        # Get schema
        success, response = self.run_test(
            "Get discovered schema",
            "GET",
            f"connections/{self.connection_id}/schema",
            200
        )
        
        if success:
            models = response.get('models', [])
            print(f"   📋 Schema has {len(models)} models")
            
            # Check for crm.lead model
            crm_lead_found = any(m.get('model') == 'crm.lead' for m in models)
            if crm_lead_found:
                print("   ✓ Found crm.lead model")
                
                # Get fields for crm.lead
                success, response = self.run_test(
                    "Get crm.lead fields",
                    "GET",
                    f"connections/{self.connection_id}/schema/crm.lead/fields",
                    200
                )
                
                if success:
                    fields = response.get('fields', {})
                    print(f"   📝 crm.lead has {len(fields)} fields")
                    if len(fields) >= 100:
                        print("   ✓ Found 100+ fields as expected")
                    else:
                        print(f"   ⚠️ Expected 100+ fields, found {len(fields)}")

    def test_mappings(self):
        """Test mapping management"""
        print("\n" + "="*60)
        print("MAPPING TESTS")
        print("="*60)
        
        # List mappings
        success, response = self.run_test(
            "List mappings",
            "GET",
            "mappings",
            200
        )
        
        if success:
            mappings = response if isinstance(response, list) else []
            print(f"   📊 Found {len(mappings)} mappings")
            
            # Check if mapping exists
            if mappings:
                self.mapping_id = mappings[0]['id']
                print(f"   ✓ Using existing mapping: {mappings[0].get('name')}")

    def test_pipelines(self):
        """Test pipeline management"""
        print("\n" + "="*60)
        print("PIPELINE TESTS")
        print("="*60)
        
        # List pipelines
        success, response = self.run_test(
            "List pipelines",
            "GET",
            "pipelines",
            200
        )
        
        if success:
            pipelines = response if isinstance(response, list) else []
            print(f"   📊 Found {len(pipelines)} pipelines")
            
            # Check for Odoo CRM Lead Pipeline
            odoo_pipeline = None
            for pipeline in pipelines:
                if 'Odoo CRM' in pipeline.get('name', ''):
                    odoo_pipeline = pipeline
                    self.pipeline_id = pipeline['id']
                    print(f"   ✓ Found pipeline: {pipeline['name']}")
                    print(f"      Status: {pipeline.get('status')}")
                    print(f"      Run count: {pipeline.get('run_count', 0)}")
                    break
            
            if not odoo_pipeline:
                print("   ⚠️ 'Odoo CRM Lead Pipeline' not found")

    def test_pipeline_runs(self):
        """Test pipeline runs"""
        print("\n" + "="*60)
        print("PIPELINE RUNS TESTS")
        print("="*60)
        
        # List all runs
        success, response = self.run_test(
            "List pipeline runs",
            "GET",
            "pipeline-runs",
            200
        )
        
        if success:
            runs = response if isinstance(response, list) else []
            print(f"   📊 Found {len(runs)} pipeline runs")
            
            if runs:
                # Check the most recent run
                latest_run = runs[0]
                print(f"   📝 Latest run:")
                print(f"      Status: {latest_run.get('status')}")
                print(f"      Extracted: {latest_run.get('extracted_count', 0)}")
                print(f"      Transformed: {latest_run.get('transformed_count', 0)}")
                print(f"      Loaded: {latest_run.get('loaded_count', 0)}")
                
                # Check if we have the expected 10 records
                if latest_run.get('status') == 'completed':
                    loaded = latest_run.get('loaded_count', 0)
                    if loaded == 10:
                        print("   ✓ Found completed run with 10 records as expected")
                    else:
                        print(f"   ⚠️ Expected 10 loaded records, found {loaded}")

    def test_data_preview(self):
        """Test data preview"""
        print("\n" + "="*60)
        print("DATA PREVIEW TESTS")
        print("="*60)
        
        # Preview silver data
        success, response = self.run_test(
            "Preview transformed data (silver)",
            "GET",
            "preview/silver?limit=20",
            200
        )
        
        if success:
            count = response.get('count', 0)
            records = response.get('records', [])
            print(f"   📊 Silver layer has {count} records")
            
            if count >= 10:
                print("   ✓ Found 10+ records as expected")
                
                # Show sample record structure
                if records:
                    sample = records[0]
                    print(f"   📝 Sample record fields: {', '.join(list(sample.keys())[:10])}")
            else:
                print(f"   ⚠️ Expected 10+ records, found {count}")

    def test_kpi_dashboard(self):
        """Test KPI dashboard"""
        print("\n" + "="*60)
        print("KPI DASHBOARD TESTS")
        print("="*60)
        
        # Get KPI summary
        success, response = self.run_test(
            "Get KPI summary",
            "GET",
            "kpi/summary",
            200
        )
        
        if success:
            kpis = response.get('kpis', {})
            by_stage = response.get('by_stage', [])
            by_owner = response.get('by_owner', [])
            
            print(f"   📊 KPI Metrics:")
            
            # Pipeline Amount
            pipeline_amount = kpis.get('pipeline_amount', {}).get('value', 0)
            print(f"      Pipeline Amount: ${pipeline_amount:,.0f}")
            
            # Total Opportunities
            total_opps = kpis.get('total_opportunities', {}).get('value', 0)
            print(f"      Total Opportunities: {total_opps}")
            
            # Win Rate
            win_rate = kpis.get('win_rate', {}).get('value', 0)
            print(f"      Win Rate: {win_rate}%")
            
            # Stages
            print(f"      Stages breakdown: {len(by_stage)} stages")
            
            # Owners
            print(f"      Sales reps: {len(by_owner)} reps")
            
            # Validate expected values
            if total_opps >= 10:
                print("   ✓ Found 10+ opportunities as expected")
            else:
                print(f"   ⚠️ Expected 10+ opportunities, found {total_opps}")
            
            if pipeline_amount >= 600000:  # $600K+
                print("   ✓ Pipeline amount is $600K+ as expected")
            else:
                print(f"   ⚠️ Expected $600K+ pipeline, found ${pipeline_amount:,.0f}")

    def test_canonical_model(self):
        """Test canonical model endpoint"""
        print("\n" + "="*60)
        print("CANONICAL MODEL TEST")
        print("="*60)
        
        success, response = self.run_test(
            "Get canonical model",
            "GET",
            "canonical-model",
            200
        )
        
        if success:
            entities = response.get('entities', [])
            print(f"   📋 Canonical model has {len(entities)} entities")
            
            # Check for opportunity entity
            opp_entity = next((e for e in entities if e.get('name') == 'opportunity'), None)
            if opp_entity:
                fields = opp_entity.get('fields', [])
                print(f"   ✓ Found 'opportunity' entity with {len(fields)} fields")

    def run_all_tests(self):
        """Run all tests"""
        print("\n" + "="*70)
        print("ESIP DATA PIPELINE PLATFORM - BACKEND API TESTING")
        print("="*70)
        print(f"Base URL: {self.base_url}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Run tests in order
        if not self.test_login():
            print("\n❌ Login failed - cannot proceed with other tests")
            return False
        
        self.test_connections()
        self.test_schema_discovery()
        self.test_mappings()
        self.test_pipelines()
        self.test_pipeline_runs()
        self.test_data_preview()
        self.test_kpi_dashboard()
        self.test_canonical_model()
        
        # Print summary
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        print("="*70)
        
        return self.tests_passed == self.tests_run

def main():
    tester = ESIPAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
