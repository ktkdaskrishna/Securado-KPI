"""
Schema Library API Testing
Tests all Schema Library CRUD endpoints
"""
import requests
import sys
import json
from datetime import datetime

class SchemaLibraryTester:
    def __init__(self, base_url="https://datamapper-10.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_schema_id = None
        self.imported_schema_id = None

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
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)

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
        print("AUTHENTICATION")
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
            print(f"   🔑 Token obtained")
            return True
        return False

    def test_list_schemas(self):
        """Test listing all schemas"""
        print("\n" + "="*60)
        print("LIST SCHEMAS")
        print("="*60)
        
        success, response = self.run_test(
            "List all schemas (builtin + custom)",
            "GET",
            "schemas",
            200
        )
        
        if success:
            schemas = response.get('schemas', [])
            count = response.get('count', 0)
            print(f"   📊 Found {count} schemas")
            
            # Count by source
            builtin_count = sum(1 for s in schemas if s.get('source') == 'builtin')
            custom_count = sum(1 for s in schemas if s.get('source') == 'custom')
            print(f"   📋 Built-in: {builtin_count}, Custom: {custom_count}")
            
            if builtin_count > 0:
                print("   ✓ Built-in schemas found")
            
            return True
        return False

    def test_create_schema(self):
        """Test creating a custom schema"""
        print("\n" + "="*60)
        print("CREATE CUSTOM SCHEMA")
        print("="*60)
        
        # Create a test schema
        test_schema = {
            "name": "TestCustomSchema",
            "display_name": "Test Custom Schema",
            "version": "1.0",
            "category": "custom",
            "industry": "saas",
            "description": "A test custom schema for automated testing",
            "fields": [
                {
                    "name": "id",
                    "display_name": "ID",
                    "data_type": "uuid",
                    "required": True,
                    "primary_key": True,
                    "description": "Unique identifier"
                },
                {
                    "name": "name",
                    "display_name": "Name",
                    "data_type": "string",
                    "required": True,
                    "primary_key": False,
                    "description": "Name field"
                },
                {
                    "name": "email",
                    "display_name": "Email",
                    "data_type": "email",
                    "required": True,
                    "primary_key": False,
                    "description": "Email address"
                }
            ]
        }
        
        success, response = self.run_test(
            "Create TestCustomSchema",
            "POST",
            "schemas",
            200,
            data=test_schema
        )
        
        if success:
            self.created_schema_id = response.get('id')
            print(f"   ✓ Schema created with ID: {self.created_schema_id}")
            print(f"   📝 Name: {response.get('name')}")
            print(f"   📝 Fields: {len(response.get('fields', []))}")
            return True
        return False

    def test_get_schema(self):
        """Test getting a specific schema"""
        print("\n" + "="*60)
        print("GET SPECIFIC SCHEMA")
        print("="*60)
        
        if not self.created_schema_id:
            print("   ⚠️ No schema ID available, skipping")
            return False
        
        success, response = self.run_test(
            f"Get schema {self.created_schema_id}",
            "GET",
            f"schemas/{self.created_schema_id}",
            200
        )
        
        if success:
            print(f"   ✓ Retrieved schema: {response.get('name')}")
            print(f"   📝 Category: {response.get('category')}")
            print(f"   📝 Source: {response.get('source')}")
            print(f"   📝 Fields: {len(response.get('fields', []))}")
            return True
        return False

    def test_import_schema_json(self):
        """Test importing a schema from JSON"""
        print("\n" + "="*60)
        print("IMPORT SCHEMA (JSON)")
        print("="*60)
        
        # Create a JSON schema to import
        json_schema = {
            "name": "ImportedTestSchema",
            "display_name": "Imported Test Schema",
            "version": "1.0",
            "description": "Schema imported from JSON for testing",
            "fields": [
                {
                    "name": "id",
                    "data_type": "uuid",
                    "required": True,
                    "primary_key": True
                },
                {
                    "name": "title",
                    "data_type": "string",
                    "required": True
                },
                {
                    "name": "created_at",
                    "data_type": "datetime",
                    "required": False
                }
            ]
        }
        
        import_request = {
            "format": "json",
            "content": json.dumps(json_schema),
            "category": "custom"
        }
        
        success, response = self.run_test(
            "Import schema from JSON",
            "POST",
            "schemas/import",
            200,
            data=import_request
        )
        
        if success:
            schema = response.get('schema', {})
            self.imported_schema_id = schema.get('id')
            print(f"   ✓ Schema imported with ID: {self.imported_schema_id}")
            print(f"   📝 Name: {schema.get('name')}")
            print(f"   📝 Fields: {len(schema.get('fields', []))}")
            return True
        return False

    def test_export_schema(self):
        """Test exporting a schema"""
        print("\n" + "="*60)
        print("EXPORT SCHEMA")
        print("="*60)
        
        if not self.created_schema_id:
            print("   ⚠️ No schema ID available, skipping")
            return False
        
        export_request = {
            "format": "json"
        }
        
        success, response = self.run_test(
            f"Export schema {self.created_schema_id} as JSON",
            "POST",
            f"schemas/{self.created_schema_id}/export",
            200,
            data=export_request
        )
        
        if success:
            print(f"   ✓ Schema exported")
            print(f"   📝 Format: {response.get('format')}")
            print(f"   📝 Filename: {response.get('filename')}")
            content = response.get('content', '')
            if content:
                print(f"   📝 Content length: {len(content)} characters")
            return True
        return False

    def test_delete_schema(self):
        """Test deleting custom schemas"""
        print("\n" + "="*60)
        print("DELETE CUSTOM SCHEMAS")
        print("="*60)
        
        schemas_to_delete = [self.created_schema_id, self.imported_schema_id]
        deleted_count = 0
        
        for schema_id in schemas_to_delete:
            if not schema_id:
                continue
            
            success, response = self.run_test(
                f"Delete schema {schema_id}",
                "DELETE",
                f"schemas/{schema_id}",
                200
            )
            
            if success:
                print(f"   ✓ Schema deleted: {schema_id}")
                deleted_count += 1
        
        print(f"\n   📊 Deleted {deleted_count} schemas")
        return deleted_count > 0

    def test_builtin_schemas(self):
        """Test built-in schemas endpoint"""
        print("\n" + "="*60)
        print("BUILT-IN SCHEMAS")
        print("="*60)
        
        success, response = self.run_test(
            "List built-in schemas",
            "GET",
            "schemas/builtin",
            200
        )
        
        if success:
            schemas = response.get('schemas', [])
            count = response.get('count', 0)
            print(f"   📊 Found {count} built-in schemas")
            
            if count > 0:
                # Show some examples
                for schema in schemas[:3]:
                    print(f"   📋 {schema.get('name')} - {schema.get('category')}")
            
            return True
        return False

    def test_filter_schemas(self):
        """Test filtering schemas by category"""
        print("\n" + "="*60)
        print("FILTER SCHEMAS")
        print("="*60)
        
        # Test filtering by custom category
        success, response = self.run_test(
            "Filter schemas by category=custom",
            "GET",
            "schemas?category=custom",
            200
        )
        
        if success:
            schemas = response.get('schemas', [])
            print(f"   📊 Found {len(schemas)} custom schemas")
            
            # Verify all are custom
            all_custom = all(s.get('category') == 'custom' for s in schemas)
            if all_custom:
                print("   ✓ All schemas are custom category")
            else:
                print("   ⚠️ Some schemas are not custom category")
            
            return True
        return False

    def run_all_tests(self):
        """Run all Schema Library tests"""
        print("\n" + "="*70)
        print("SCHEMA LIBRARY API TESTING")
        print("="*70)
        print(f"Base URL: {self.base_url}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Run tests in order
        if not self.test_login():
            print("\n❌ Login failed - cannot proceed with other tests")
            return False
        
        self.test_list_schemas()
        self.test_builtin_schemas()
        self.test_filter_schemas()
        self.test_create_schema()
        self.test_get_schema()
        self.test_import_schema_json()
        self.test_export_schema()
        self.test_delete_schema()
        
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
    tester = SchemaLibraryTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
