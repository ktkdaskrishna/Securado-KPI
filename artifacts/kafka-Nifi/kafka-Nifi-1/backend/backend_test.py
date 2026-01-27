import requests
import sys
from datetime import datetime

class ESIPAPITester:
    def __init__(self, base_url="https://datamapper-10.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tenant_id = None
        self.connection_id = None
        self.schema_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
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
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "Login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_register(self, name, email, password):
        """Test user registration"""
        success, response = self.run_test(
            "Register User",
            "POST",
            "/api/auth/register",
            200,
            data={"name": name, "email": email, "password": password, "role": "user"}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "/api/auth/me",
            200
        )
        return success

    def test_create_tenant(self, name, domain=None):
        """Test tenant creation"""
        success, response = self.run_test(
            "Create Tenant",
            "POST",
            "/api/tenants",
            200,
            data={"name": name, "domain": domain}
        )
        if success and 'id' in response:
            self.tenant_id = response['id']
            print(f"   Tenant ID: {self.tenant_id}")
            return True
        return False

    def test_list_tenants(self):
        """Test list tenants"""
        success, response = self.run_test(
            "List Tenants",
            "GET",
            "/api/tenants",
            200
        )
        if success:
            print(f"   Found {len(response)} tenants")
            if len(response) > 0 and not self.tenant_id:
                self.tenant_id = response[0]['id']
                print(f"   Using tenant ID: {self.tenant_id}")
        return success

    def test_get_tenant(self, tenant_id):
        """Test get tenant by ID"""
        success, response = self.run_test(
            "Get Tenant",
            "GET",
            f"/api/tenants/{tenant_id}",
            200
        )
        return success

    def test_seed_data(self, tenant_id):
        """Test seed sample data"""
        success, response = self.run_test(
            "Seed Sample Data",
            "POST",
            f"/api/kpi/seed/{tenant_id}",
            200
        )
        if success:
            print(f"   Seeded: {response.get('opportunities', 0)} opportunities, {response.get('activities', 0)} activities")
        return success

    def test_executive_overview(self, tenant_id):
        """Test executive overview KPIs"""
        success, response = self.run_test(
            "Executive Overview KPIs",
            "GET",
            f"/api/kpi/executive-overview/{tenant_id}",
            200
        )
        if success:
            kpis = response.get('kpis', {})
            print(f"   Pipeline: ${kpis.get('pipeline_amount', {}).get('value', 0):,.0f}")
            print(f"   Win Rate: {kpis.get('win_rate', {}).get('value', 0)}%")
        return success

    def test_pipeline_health(self, tenant_id):
        """Test pipeline health metrics"""
        success, response = self.run_test(
            "Pipeline Health Metrics",
            "GET",
            f"/api/kpi/pipeline-health/{tenant_id}",
            200
        )
        if success:
            kpis = response.get('kpis', {})
            print(f"   Stalled Deals: {kpis.get('stalled_deals', {}).get('value', 0)}")
        return success

    def test_rep_performance(self, tenant_id):
        """Test rep performance metrics"""
        success, response = self.run_test(
            "Rep Performance Metrics",
            "GET",
            f"/api/kpi/rep-performance/{tenant_id}",
            200
        )
        if success:
            reps = response.get('rep_details', [])
            print(f"   Found {len(reps)} sales reps")
        return success

    def test_activity_insights(self, tenant_id):
        """Test activity insights"""
        success, response = self.run_test(
            "Activity Insights",
            "GET",
            f"/api/kpi/activity-insights/{tenant_id}",
            200,
            params={"days": 30}
        )
        if success:
            kpis = response.get('kpis', {})
            print(f"   Total Touchpoints: {kpis.get('touchpoints', {}).get('value', 0)}")
        return success

    def test_create_connection(self, tenant_id):
        """Test create connection"""
        success, response = self.run_test(
            "Create Connection",
            "POST",
            "/api/connections",
            200,
            data={
                "name": "Test Odoo Connection",
                "type": "odoo",
                "config": {"url": "https://test.odoo.com", "database": "test_db", "username": "admin", "password": "admin"},
                "tenant_id": tenant_id
            }
        )
        if success and 'id' in response:
            self.connection_id = response['id']
            print(f"   Connection ID: {self.connection_id}")
            return True
        return False

    def test_list_connections(self, tenant_id):
        """Test list connections"""
        success, response = self.run_test(
            "List Connections",
            "GET",
            "/api/connections",
            200,
            params={"tenant_id": tenant_id}
        )
        if success:
            print(f"   Found {len(response)} connections")
        return success

    def test_connection_test(self, connection_id):
        """Test connection health check"""
        success, response = self.run_test(
            "Test Connection Health",
            "POST",
            f"/api/connections/{connection_id}/test",
            200
        )
        if success:
            print(f"   Health: {response.get('health', 'unknown')}")
        return success

    def test_discover_schema(self, connection_id):
        """Test schema discovery"""
        success, response = self.run_test(
            "Discover Schema",
            "POST",
            f"/api/schema/discover/{connection_id}",
            200
        )
        if success and 'id' in response:
            self.schema_id = response['id']
            print(f"   Schema ID: {self.schema_id}")
            print(f"   Objects: {len(response.get('objects', []))}")
            return True
        return False

    def test_list_schemas(self, tenant_id):
        """Test list schemas"""
        success, response = self.run_test(
            "List Schemas",
            "GET",
            "/api/schema",
            200,
            params={"tenant_id": tenant_id}
        )
        if success:
            print(f"   Found {len(response)} schemas")
        return success

    def test_canonical_model(self):
        """Test get canonical model"""
        success, response = self.run_test(
            "Get Canonical Model",
            "GET",
            "/api/canonical-model",
            200
        )
        if success:
            print(f"   Entities: {len(response.get('entities', []))}")
        return success

    def test_create_mapping(self, tenant_id, schema_id):
        """Test create mapping"""
        success, response = self.run_test(
            "Create Mapping",
            "POST",
            "/api/mappings",
            200,
            data={
                "name": "Test Mapping",
                "version": "1.0",
                "source_schema_id": schema_id,
                "mappings": [
                    {"source_object": "crm.lead", "source_field": "name", "target_entity": "cdm.opportunity", "target_field": "name"}
                ],
                "tenant_id": tenant_id
            }
        )
        return success

    def test_list_mappings(self, tenant_id):
        """Test list mappings"""
        success, response = self.run_test(
            "List Mappings",
            "GET",
            "/api/mappings",
            200,
            params={"tenant_id": tenant_id}
        )
        if success:
            print(f"   Found {len(response)} mappings")
        return success

    def test_list_dlq(self, tenant_id):
        """Test list DLQ items"""
        success, response = self.run_test(
            "List DLQ Items",
            "GET",
            "/api/dlq",
            200,
            params={"tenant_id": tenant_id}
        )
        if success:
            print(f"   Found {len(response)} DLQ items")
            if len(response) > 0:
                return True, response[0]['id']
        return success, None

    def test_retry_dlq(self, item_id):
        """Test retry DLQ item"""
        success, response = self.run_test(
            "Retry DLQ Item",
            "POST",
            f"/api/dlq/{item_id}/retry",
            200
        )
        return success

    def test_bulk_retry_dlq(self, tenant_id):
        """Test bulk retry DLQ"""
        success, response = self.run_test(
            "Bulk Retry DLQ",
            "POST",
            "/api/dlq/bulk-retry",
            200,
            params={"tenant_id": tenant_id}
        )
        if success:
            print(f"   Retried: {response.get('retried_count', 0)} items")
        return success

    def test_kpi_health(self):
        """Test KPI service health"""
        success, response = self.run_test(
            "KPI Service Health",
            "GET",
            "/api/kpi/health",
            200
        )
        if success:
            print(f"   Status: {response.get('status', 'unknown')}")
        return success

    # ==================== PHASE 3: TARGET CONNECTIONS ====================
    
    def test_get_target_types(self):
        """Test get supported target types"""
        success, response = self.run_test(
            "Get Target Types",
            "GET",
            "/api/targets/types",
            200
        )
        if success:
            types = response.get('types', [])
            print(f"   Found {len(types)} target types: {', '.join([t['id'] for t in types])}")
            return success, types
        return False, []
    
    def test_create_target(self):
        """Test create target connection"""
        success, response = self.run_test(
            "Create Target Connection",
            "POST",
            "/api/targets",
            200,
            data={
                "name": "Test PostgreSQL Target",
                "type": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "test_db",
                "username": "postgres",
                "password": "postgres",
                "schema_name": "public"
            }
        )
        if success and 'id' in response:
            print(f"   Target ID: {response['id']}")
            return True, response['id']
        return False, None
    
    def test_list_targets(self):
        """Test list targets"""
        success, response = self.run_test(
            "List Targets",
            "GET",
            "/api/targets",
            200
        )
        if success:
            print(f"   Found {len(response)} targets")
        return success
    
    def test_target_test(self, target_id):
        """Test target connection"""
        success, response = self.run_test(
            "Test Target Connection",
            "POST",
            f"/api/targets/{target_id}/test",
            200
        )
        if success:
            print(f"   Status: {response.get('status', 'unknown')}")
        return success
    
    # ==================== PHASE 3: WEBHOOK & EVENTS ====================
    
    def test_webhook_stats(self):
        """Test webhook event statistics"""
        success, response = self.run_test(
            "Get Webhook Stats",
            "GET",
            "/api/webhook-events/stats",
            200
        )
        if success:
            print(f"   Total Events: {response.get('total', 0)}")
            print(f"   By Event Type: {response.get('by_event_type', {})}")
            print(f"   By Status: {response.get('by_status', {})}")
        return success
    
    def test_list_webhook_events(self):
        """Test list webhook events"""
        success, response = self.run_test(
            "List Webhook Events",
            "GET",
            "/api/webhook-events",
            200
        )
        if success:
            print(f"   Found {len(response)} webhook events")
        return success
    
    def test_list_webhook_configs(self):
        """Test list webhook configs"""
        success, response = self.run_test(
            "List Webhook Configs",
            "GET",
            "/api/webhook-configs",
            200
        )
        if success:
            print(f"   Found {len(response)} webhook configs")
        return success
    
    # ==================== PHASE 3: SCHEDULER ====================
    
    def test_scheduler_jobs(self):
        """Test get scheduler jobs"""
        # Note: This endpoint might not exist in the API, but we'll test it
        # The scheduler is internal, so we might need to check via pipelines
        success, response = self.run_test(
            "Get Scheduler Jobs",
            "GET",
            "/api/scheduler/jobs",
            200
        )
        if success:
            print(f"   Found {len(response)} scheduled jobs")
        return success
    
    # ==================== SCHEMA LIBRARY & TARGET TEMPLATES ====================
    
    def test_list_builtin_schemas(self):
        """Test list built-in schemas"""
        success, response = self.run_test(
            "List Built-in Schemas",
            "GET",
            "/api/schemas/builtin",
            200
        )
        if success:
            schemas = response.get('schemas', [])
            print(f"   Found {len(schemas)} built-in schemas")
            if len(schemas) > 0:
                print(f"   Sample: {schemas[0].get('name', 'N/A')}")
                return True, schemas
        return False, []
    
    def test_list_all_schemas(self):
        """Test list all schemas (builtin + custom)"""
        success, response = self.run_test(
            "List All Schemas",
            "GET",
            "/api/schemas",
            200,
            params={"include_builtin": True}
        )
        if success:
            schemas = response.get('schemas', [])
            print(f"   Found {len(schemas)} total schemas")
            builtin_count = sum(1 for s in schemas if s.get('source') == 'builtin')
            custom_count = sum(1 for s in schemas if s.get('source') == 'custom')
            print(f"   Built-in: {builtin_count}, Custom: {custom_count}")
        return success
    
    def test_get_schema_detail(self, schema_id):
        """Test get schema detail"""
        success, response = self.run_test(
            f"Get Schema Detail ({schema_id})",
            "GET",
            f"/api/schemas/{schema_id}",
            200
        )
        if success:
            print(f"   Schema: {response.get('name', 'N/A')}")
            print(f"   Fields: {len(response.get('fields', []))}")
            print(f"   Version: {response.get('version', 'N/A')}")
        return success
    
    def test_get_target_types_templates(self):
        """Test get target types for templates"""
        success, response = self.run_test(
            "Get Target Types (Templates)",
            "GET",
            "/api/templates/target-types",
            200
        )
        if success:
            types = response.get('target_types', [])
            print(f"   Found {len(types)} target types")
            type_names = [t.get('value') for t in types]
            print(f"   Types: {', '.join(type_names)}")
            return True, types
        return False, []
    
    def test_generate_ddl(self, schema_id, target_type='postgresql'):
        """Test generate DDL from schema"""
        success, response = self.run_test(
            f"Generate DDL ({schema_id} -> {target_type})",
            "POST",
            "/api/templates/generate-ddl",
            200,
            params={
                "schema_id": schema_id,
                "target_type": target_type
            }
        )
        if success:
            ddl = response.get('ddl', '')
            print(f"   Generated DDL length: {len(ddl)} chars")
            print(f"   Table: {response.get('table_name', 'N/A')}")
            if ddl:
                # Show first line of DDL
                first_line = ddl.split('\n')[0]
                print(f"   DDL starts with: {first_line[:60]}...")
        return success
    
    def test_auto_generate_template(self, schema_id, target_type='postgresql'):
        """Test auto-generate template from schema"""
        success, response = self.run_test(
            f"Auto-Generate Template ({schema_id} -> {target_type})",
            "POST",
            "/api/templates/auto-generate",
            200,
            params={
                "schema_id": schema_id,
                "target_type": target_type
            }
        )
        if success:
            template = response.get('template', {})
            print(f"   Template ID: {template.get('id', 'N/A')}")
            print(f"   Template Name: {template.get('name', 'N/A')}")
            print(f"   Columns: {len(template.get('table', {}).get('columns', []))}")
            ddl_preview = response.get('ddl_preview', '')
            print(f"   DDL Preview length: {len(ddl_preview)} chars")
            return True, template.get('id')
        return False, None
    
    def test_list_templates(self):
        """Test list target templates"""
        success, response = self.run_test(
            "List Target Templates",
            "GET",
            "/api/templates",
            200
        )
        if success:
            templates = response.get('templates', [])
            print(f"   Found {len(templates)} templates")
        return success
    
    def test_get_template_ddl(self, template_id):
        """Test get DDL for a template"""
        success, response = self.run_test(
            f"Get Template DDL ({template_id})",
            "GET",
            f"/api/templates/{template_id}/ddl",
            200
        )
        if success:
            ddl = response.get('ddl', '')
            print(f"   DDL length: {len(ddl)} chars")
        return success
    
    # ==================== RBAC TESTS ====================
    
    def test_init_rbac(self):
        """Test initialize RBAC system"""
        success, response = self.run_test(
            "Initialize RBAC",
            "POST",
            "/api/admin/init",
            200
        )
        if success:
            print(f"   Status: {response.get('status', 'N/A')}")
            print(f"   Message: {response.get('message', 'N/A')}")
            print(f"   Roles Created: {response.get('roles_created', 0)}")
        return success
    
    def test_list_permissions(self):
        """Test list all permissions"""
        success, response = self.run_test(
            "List All Permissions",
            "GET",
            "/api/admin/permissions",
            200
        )
        if success:
            permissions = response.get('permissions', [])
            by_category = response.get('by_category', {})
            print(f"   Total Permissions: {len(permissions)}")
            print(f"   Categories: {len(by_category)}")
            for cat, perms in by_category.items():
                print(f"     - {cat}: {len(perms)} permissions")
        return success
    
    def test_get_my_permissions(self):
        """Test get current user's permissions"""
        success, response = self.run_test(
            "Get My Permissions",
            "GET",
            "/api/admin/permissions/my",
            200
        )
        if success:
            print(f"   User ID: {response.get('user_id', 'N/A')}")
            print(f"   Is Super Admin: {response.get('is_super_admin', False)}")
            print(f"   Permissions Count: {response.get('count', 0)}")
        return success
    
    def test_list_roles(self):
        """Test list all roles"""
        success, response = self.run_test(
            "List All Roles",
            "GET",
            "/api/admin/roles",
            200
        )
        if success:
            roles = response.get('roles', [])
            print(f"   Total Roles: {len(roles)}")
            for role in roles:
                print(f"     - {role.get('display_name', 'N/A')} ({role.get('name', 'N/A')}): {len(role.get('permissions', []))} permissions")
            return True, roles
        return False, []
    
    def test_create_role(self):
        """Test create custom role"""
        success, response = self.run_test(
            "Create Custom Role",
            "POST",
            "/api/admin/roles",
            200,
            data={
                "name": "test_analyst",
                "display_name": "Test Analyst",
                "description": "Test role for analysts",
                "permissions": ["reports.view", "reports.export", "pipelines.view"]
            }
        )
        if success:
            print(f"   Role ID: {response.get('id', 'N/A')}")
            print(f"   Role Name: {response.get('name', 'N/A')}")
            print(f"   Permissions: {len(response.get('permissions', []))}")
            return True, response.get('id')
        return False, None
    
    def test_update_role(self, role_id):
        """Test update role permissions"""
        success, response = self.run_test(
            f"Update Role ({role_id})",
            "PUT",
            f"/api/admin/roles/{role_id}",
            200,
            data={
                "description": "Updated test role description",
                "permissions": ["reports.view", "reports.export", "pipelines.view", "schemas.view"]
            }
        )
        if success:
            print(f"   Updated Permissions: {len(response.get('permissions', []))}")
        return success
    
    def test_delete_role(self, role_id):
        """Test delete custom role"""
        success, response = self.run_test(
            f"Delete Role ({role_id})",
            "DELETE",
            f"/api/admin/roles/{role_id}",
            200
        )
        if success:
            print(f"   Status: {response.get('status', 'N/A')}")
        return success
    
    def test_list_users(self):
        """Test list all users"""
        success, response = self.run_test(
            "List All Users",
            "GET",
            "/api/admin/users",
            200
        )
        if success:
            users = response.get('users', [])
            print(f"   Total Users: {len(users)}")
            for user in users:
                roles_str = ', '.join([r.get('display_name', '') for r in user.get('roles', [])])
                print(f"     - {user.get('name', 'N/A')} ({user.get('email', 'N/A')}): {roles_str}")
        return success
    
    def test_create_user(self):
        """Test create new user"""
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Create New User",
            "POST",
            "/api/admin/users",
            200,
            data={
                "name": f"Test User {timestamp}",
                "email": f"testuser{timestamp}@esip.com",
                "password": "testpass123",
                "role_ids": [],
                "is_active": True
            }
        )
        if success:
            print(f"   User ID: {response.get('id', 'N/A')}")
            print(f"   Email: {response.get('email', 'N/A')}")
            return True, response.get('id')
        return False, None
    
    def test_update_user(self, user_id):
        """Test update user"""
        success, response = self.run_test(
            f"Update User ({user_id})",
            "PUT",
            f"/api/admin/users/{user_id}",
            200,
            data={
                "name": "Updated Test User",
                "is_active": True
            }
        )
        if success:
            print(f"   Updated Name: {response.get('name', 'N/A')}")
        return success
    
    def test_assign_roles(self, user_id, role_ids):
        """Test assign roles to user"""
        success, response = self.run_test(
            f"Assign Roles to User ({user_id})",
            "POST",
            f"/api/admin/users/{user_id}/roles",
            200,
            data=role_ids
        )
        if success:
            print(f"   Status: {response.get('status', 'N/A')}")
            roles = response.get('roles', [])
            print(f"   Assigned Roles: {len(roles)}")
        return success
    
    def test_delete_user(self, user_id):
        """Test delete user"""
        success, response = self.run_test(
            f"Delete User ({user_id})",
            "DELETE",
            f"/api/admin/users/{user_id}",
            200
        )
        if success:
            print(f"   Status: {response.get('status', 'N/A')}")
        return success

def main():
    print("=" * 60)
    print("ESIP Backend API Testing")
    print("=" * 60)
    
    tester = ESIPAPITester()
    
    # Test 1: Login with demo user
    print("\n" + "=" * 60)
    print("AUTHENTICATION TESTS")
    print("=" * 60)
    if not tester.test_login("demo@esip.com", "demodemo"):
        print("\n❌ Demo user login failed. Trying to register...")
        if not tester.test_register("Demo User", "demo@esip.com", "demodemo"):
            print("❌ Registration also failed. Stopping tests.")
            return 1
    
    tester.test_get_me()
    
    # Test 2: Tenant Management
    print("\n" + "=" * 60)
    print("TENANT MANAGEMENT TESTS")
    print("=" * 60)
    tester.test_list_tenants()
    
    if not tester.tenant_id:
        tester.test_create_tenant(f"Test Tenant {datetime.now().strftime('%H%M%S')}", "test.com")
    
    if tester.tenant_id:
        tester.test_get_tenant(tester.tenant_id)
    
    # Test 3: Seed Data
    print("\n" + "=" * 60)
    print("DATA SEEDING TESTS")
    print("=" * 60)
    if tester.tenant_id:
        tester.test_seed_data(tester.tenant_id)
    
    # Test 4: KPI Endpoints
    print("\n" + "=" * 60)
    print("KPI DASHBOARD TESTS")
    print("=" * 60)
    if tester.tenant_id:
        tester.test_executive_overview(tester.tenant_id)
        tester.test_pipeline_health(tester.tenant_id)
        tester.test_rep_performance(tester.tenant_id)
        tester.test_activity_insights(tester.tenant_id)
        tester.test_kpi_health()
    
    # Test 5: Connection Management
    print("\n" + "=" * 60)
    print("CONNECTION MANAGEMENT TESTS")
    print("=" * 60)
    if tester.tenant_id:
        tester.test_create_connection(tester.tenant_id)
        tester.test_list_connections(tester.tenant_id)
        
        if tester.connection_id:
            tester.test_connection_test(tester.connection_id)
    
    # Test 6: Schema Discovery
    print("\n" + "=" * 60)
    print("SCHEMA DISCOVERY TESTS")
    print("=" * 60)
    if tester.connection_id:
        tester.test_discover_schema(tester.connection_id)
        tester.test_list_schemas(tester.tenant_id)
        tester.test_canonical_model()
    
    # Test 7: Mapping Management
    print("\n" + "=" * 60)
    print("MAPPING MANAGEMENT TESTS")
    print("=" * 60)
    if tester.schema_id:
        tester.test_create_mapping(tester.tenant_id, tester.schema_id)
        tester.test_list_mappings(tester.tenant_id)
    
    # Test 8: DLQ Management
    print("\n" + "=" * 60)
    print("DLQ MANAGEMENT TESTS")
    print("=" * 60)
    if tester.tenant_id:
        success, dlq_item_id = tester.test_list_dlq(tester.tenant_id)
        if dlq_item_id:
            tester.test_retry_dlq(dlq_item_id)
        tester.test_bulk_retry_dlq(tester.tenant_id)
    
    # Test 9: PHASE 3 - Target Connections
    print("\n" + "=" * 60)
    print("PHASE 3: TARGET CONNECTIONS TESTS")
    print("=" * 60)
    success, target_types = tester.test_get_target_types()
    if success and len(target_types) == 4:
        print("✅ All 4 target types available (mongodb, postgresql, mysql, api)")
    
    success, target_id = tester.test_create_target()
    tester.test_list_targets()
    if target_id:
        tester.test_target_test(target_id)
    
    # Test 10: PHASE 3 - Webhook & Events
    print("\n" + "=" * 60)
    print("PHASE 3: WEBHOOK & EVENTS TESTS")
    print("=" * 60)
    tester.test_webhook_stats()
    tester.test_list_webhook_events()
    tester.test_list_webhook_configs()
    
    # Test 11: PHASE 3 - Scheduler
    print("\n" + "=" * 60)
    print("PHASE 3: SCHEDULER TESTS")
    print("=" * 60)
    tester.test_scheduler_jobs()
    
    # Test 12: Schema Library & Target Templates
    print("\n" + "=" * 60)
    print("SCHEMA LIBRARY & TARGET TEMPLATES TESTS")
    print("=" * 60)
    
    # Test built-in schemas
    success, builtin_schemas = tester.test_list_builtin_schemas()
    tester.test_list_all_schemas()
    
    # Test schema detail with a built-in schema
    test_schema_id = None
    if builtin_schemas and len(builtin_schemas) > 0:
        test_schema_id = builtin_schemas[0].get('id')
        tester.test_get_schema_detail(test_schema_id)
    
    # Test target types for templates
    success, target_types_templates = tester.test_get_target_types_templates()
    
    # Test DDL generation
    if test_schema_id:
        tester.test_generate_ddl(test_schema_id, 'postgresql')
        tester.test_generate_ddl(test_schema_id, 'mysql')
        tester.test_generate_ddl(test_schema_id, 'mongodb')
    
    # Test auto-generate template
    template_id = None
    if test_schema_id:
        success, template_id = tester.test_auto_generate_template(test_schema_id, 'postgresql')
    
    # Test list templates
    tester.test_list_templates()
    
    # Test get template DDL
    if template_id:
        tester.test_get_template_ddl(template_id)
    
    # Test 13: RBAC System
    print("\n" + "=" * 60)
    print("RBAC SYSTEM TESTS")
    print("=" * 60)
    
    # Initialize RBAC
    tester.test_init_rbac()
    
    # Test permissions
    tester.test_list_permissions()
    tester.test_get_my_permissions()
    
    # Test roles
    success, roles = tester.test_list_roles()
    
    # Create custom role
    success, custom_role_id = tester.test_create_role()
    
    # Update role if created
    if custom_role_id:
        tester.test_update_role(custom_role_id)
    
    # Test users
    tester.test_list_users()
    
    # Create new user
    success, new_user_id = tester.test_create_user()
    
    # Update user if created
    if new_user_id:
        tester.test_update_user(new_user_id)
        
        # Assign roles to user
        if roles and len(roles) > 0:
            # Assign the first role (should be a system role)
            viewer_role = next((r for r in roles if r.get('name') == 'viewer'), None)
            if viewer_role:
                tester.test_assign_roles(new_user_id, [viewer_role['id']])
        
        # Delete the test user
        tester.test_delete_user(new_user_id)
    
    # Delete custom role if created
    if custom_role_id:
        tester.test_delete_role(custom_role_id)
    
    # Print Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for test in tester.failed_tests:
            print(f"  - {test.get('test', 'Unknown')}: {test.get('error', test.get('response', 'Unknown error'))}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
