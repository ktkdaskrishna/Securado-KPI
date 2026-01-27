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
BASE_URL = "https://datamapper-10.preview.emergentagent.com/api"

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
            data={"email": "test@securado.com", "password": "test123456"},
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
        """Test opportunities endpoints including Bluesheet and Notes"""
        print("\n" + "="*60)
        print("TEST: Opportunities (with Bluesheet & Notes)")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping opportunities tests", False)
            return None
        
        # List opportunities
        status, data = self.make_request(
            'GET',
            'opportunities',
            expected_status=200,
            description="List opportunities"
        )
        
        opportunities = data if isinstance(data, list) else []
        print(f"   Found {len(opportunities)} opportunities")
        
        # Kanban view
        status, kanban_data = self.make_request(
            'GET',
            'opportunities/kanban',
            expected_status=200,
            description="Get opportunities kanban"
        )
        
        if kanban_data and isinstance(kanban_data, dict):
            print(f"   Kanban stages: {list(kanban_data.get('data', {}).keys())}")
        
        # Test Bluesheet and Notes if we have opportunities
        if opportunities and len(opportunities) > 0:
            opp_id = opportunities[0].get('canonical_id')
            print(f"\n   Testing Bluesheet & Notes with opportunity: {opp_id}")
            
            # Get Bluesheet
            status, bluesheet_data = self.make_request(
                'GET',
                f'opportunities/{opp_id}/bluesheet',
                expected_status=200,
                description="GET /api/opportunities/{id}/bluesheet - Get bluesheet assessment"
            )
            
            if bluesheet_data and isinstance(bluesheet_data, dict):
                print(f"   Bluesheet loaded successfully")
                if bluesheet_data.get('calculated_probability'):
                    prob = bluesheet_data['calculated_probability']
                    print(f"   Calculated probability: {prob.get('probability')}% (risk: {prob.get('risk_level')})")
            
            # Update Bluesheet
            bluesheet_update = {
                "competition_status": "favored",
                "budget_status": "confirmed",
                "buying_influences": [
                    {"role": "economic_buyer", "name": "John Doe", "title": "CEO", "coverage": 0.8}
                ],
                "win_strategy": "Focus on ROI and quick implementation",
                "key_issues": ["Budget approval", "Timeline"]
            }
            
            status, update_result = self.make_request(
                'PUT',
                f'opportunities/{opp_id}/bluesheet',
                data=bluesheet_update,
                expected_status=200,
                description="PUT /api/opportunities/{id}/bluesheet - Update bluesheet and calculate probability"
            )
            
            if update_result and isinstance(update_result, dict):
                if update_result.get('calculated_probability'):
                    prob = update_result['calculated_probability']
                    print(f"   Updated probability: {prob.get('probability')}% (risk: {prob.get('risk_level')})")
            
            # Create Note
            note_data = {
                "content": "Test note from backend API test",
                "note_type": "general"
            }
            
            status, note_result = self.make_request(
                'POST',
                f'opportunities/{opp_id}/notes',
                data=note_data,
                expected_status=200,
                description="POST /api/opportunities/{id}/notes - Create note under opportunity"
            )
            
            if note_result and isinstance(note_result, dict):
                print(f"   Note created: {note_result.get('id')}")
            
            # Get Activities
            status, activities_data = self.make_request(
                'GET',
                f'opportunities/{opp_id}/activities',
                expected_status=200,
                description="GET /api/opportunities/{id}/activities - Get opportunity activities"
            )
            
            if activities_data and isinstance(activities_data, list):
                print(f"   Found {len(activities_data)} activities for this opportunity")
        else:
            self.log("No opportunities available for Bluesheet/Notes/Activities tests", False)
        
        return opportunities

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

    def test_etl_templates(self):
        """Test ETL integration templates"""
        print("\n" + "="*60)
        print("TEST: ETL Integration Templates")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping ETL templates tests", False)
            return
        
        # List templates
        status, data = self.make_request(
            'GET',
            'templates',
            expected_status=200,
            description="GET /api/templates - List integration templates"
        )
        
        if data and isinstance(data, list):
            print(f"   Found {len(data)} templates")
            # Check for expected templates
            template_ids = [t.get('id') for t in data]
            expected_templates = ['odoo_crm', 'salesforce', 'hubspot', 'pipedrive']
            for expected in expected_templates:
                if expected in template_ids:
                    print(f"   ✓ Template '{expected}' found")
                else:
                    print(f"   ✗ Template '{expected}' NOT found")
            
            # Show first template details
            if data:
                first = data[0]
                print(f"   Sample template: {first.get('name')} ({first.get('type')})")
                print(f"   Description: {first.get('description')}")
        
        return data

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
        
        return data

    def test_etl_mappings(self):
        """Test ETL mappings with auto-suggest and verification"""
        print("\n" + "="*60)
        print("TEST: ETL Mappings (Auto-Suggest & Verification)")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping ETL mappings tests", False)
            return None, None
        
        # List mappings
        status, data = self.make_request(
            'GET',
            'mappings',
            expected_status=200,
            description="List ETL mappings"
        )
        
        mappings = data if isinstance(data, list) else []
        print(f"   Found {len(mappings)} mappings")
        
        # Test auto-suggest (requires a connection)
        connections = self.test_etl_connections()
        if connections and len(connections) > 0:
            conn_id = connections[0].get('id')
            print(f"\n   Testing auto-suggest with connection: {conn_id}")
            
            status, suggest_data = self.make_request(
                'POST',
                f'mappings/auto-suggest?connection_id={conn_id}&source_model=crm.lead&target_entity=opportunity',
                expected_status=200,
                description="POST /api/mappings/auto-suggest - Auto-suggest field mappings"
            )
            
            if suggest_data and isinstance(suggest_data, dict):
                suggestions = suggest_data.get('suggestions', [])
                print(f"   Auto-suggest returned {len(suggestions)} suggestions")
                print(f"   Source: {suggest_data.get('source')}")
                print(f"   Confidence: {suggest_data.get('confidence')}")
                if suggestions:
                    print(f"   Sample suggestion: {suggestions[0]}")
        else:
            self.log("No connections available for auto-suggest test", False)
        
        # Test schema verification (requires a mapping)
        if mappings and len(mappings) > 0:
            mapping_id = mappings[0].get('id')
            print(f"\n   Testing schema verification with mapping: {mapping_id}")
            
            status, verify_data = self.make_request(
                'POST',
                f'mappings/{mapping_id}/verify',
                expected_status=200,
                description="POST /api/mappings/{id}/verify - Verify mapping schema"
            )
            
            if verify_data and isinstance(verify_data, dict):
                print(f"   Verification status: {verify_data.get('status')}")
                print(f"   Errors: {len(verify_data.get('errors', []))}")
                print(f"   Warnings: {len(verify_data.get('warnings', []))}")
                if verify_data.get('summary'):
                    summary = verify_data['summary']
                    print(f"   Summary: {summary.get('valid')}/{summary.get('total_fields')} fields valid")
        else:
            self.log("No mappings available for verification test", False)
        
        return mappings

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
        """Test admin users endpoints including role assignment"""
        print("\n" + "="*60)
        print("TEST: Admin - Users (with Role Assignment)")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping admin users tests", False)
            return None, None
        
        # List users
        status, data = self.make_request(
            'GET',
            'admin/users',
            expected_status=200,
            description="List users"
        )
        
        users = data if isinstance(data, list) else []
        print(f"   Found {len(users)} users")
        for user in users[:3]:  # Show first 3 users
            print(f"   - {user.get('email')} ({user.get('status')})")
        
        # Get roles for role assignment test
        status, roles_data = self.make_request(
            'GET',
            'admin/roles',
            expected_status=200,
            description="List roles"
        )
        
        roles = roles_data if isinstance(roles_data, list) else []
        print(f"   Found {len(roles)} roles")
        
        # Test role assignment if we have users and roles
        if users and roles:
            # Find an approved user (not the current user)
            test_user = None
            for user in users:
                if user.get('status') == 'approved' and user.get('id') != self.user_id:
                    test_user = user
                    break
            
            if test_user and len(roles) > 0:
                user_id = test_user.get('id')
                role_ids = [roles[0].get('id')] if roles else []
                
                print(f"\n   Testing role assignment for user: {test_user.get('email')}")
                print(f"   Assigning roles: {role_ids}")
                
                status, update_result = self.make_request(
                    'PUT',
                    f'admin/users/{user_id}/roles',
                    data={"roles": role_ids},
                    expected_status=200,
                    description="PUT /api/admin/users/{id}/roles - Update user roles"
                )
                
                if update_result and isinstance(update_result, dict):
                    print(f"   Role assignment result: {update_result.get('message')}")
            else:
                self.log("No suitable user found for role assignment test", False)
        else:
            self.log("No users or roles available for role assignment test", False)
        
        return users, roles

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

    def test_schema_discovery(self):
        """Test schema discovery and field loading for Odoo models"""
        print("\n" + "="*60)
        print("TEST: Schema Discovery & Field Loading")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping schema discovery tests", False)
            return None
        
        # Get connections
        connections = self.test_etl_connections()
        if not connections or len(connections) == 0:
            self.log("No connections available for schema discovery test", False)
            return None
        
        # Find an Odoo connection
        odoo_conn = None
        for conn in connections:
            if conn.get('type') == 'odoo':
                odoo_conn = conn
                break
        
        if not odoo_conn:
            self.log("No Odoo connection found for schema discovery test", False)
            return None
        
        conn_id = odoo_conn.get('id')
        print(f"   Using Odoo connection: {odoo_conn.get('name')} (ID: {conn_id})")
        
        # Test 1: Get existing schema (if available)
        print(f"\n   Step 1: Checking for existing schema...")
        status, schema_data = self.make_request(
            'GET',
            f'integrations/{conn_id}/schema',
            expected_status=None,  # May be 404 if not discovered yet
            description="GET /api/integrations/{id}/schema - Get discovered schema"
        )
        
        if status == 200 and schema_data and isinstance(schema_data, dict):
            models = schema_data.get('models', [])
            print(f"   ✓ Existing schema found with {len(models)} models")
            
            # Check if we have 244 models as expected
            if len(models) >= 240:
                self.log(f"Schema has {len(models)} models (expected ~244)", True)
            else:
                print(f"   ⚠ Schema has only {len(models)} models (expected ~244)")
            
            # Check for CRM category and crm.lead model
            crm_models = [m for m in models if m.get('category') == 'crm']
            print(f"   Found {len(crm_models)} CRM models")
            
            crm_lead = next((m for m in models if m.get('model') == 'crm.lead'), None)
            if crm_lead:
                self.log("Found crm.lead model in schema", True)
                print(f"   crm.lead: {crm_lead.get('name')}")
            else:
                self.log("crm.lead model NOT found in schema", False)
        elif status == 404:
            print(f"   No existing schema found (404). Will trigger discovery...")
            
            # Test 2: Discover schema
            print(f"\n   Step 2: Triggering schema discovery...")
            status, discover_data = self.make_request(
                'POST',
                f'integrations/{conn_id}/discover',
                expected_status=200,
                description="POST /api/integrations/{id}/discover - Discover all Odoo models"
            )
            
            if discover_data and isinstance(discover_data, dict):
                models = discover_data.get('models', [])
                print(f"   ✓ Discovery completed: {len(models)} models found")
                
                # Check if we have 244 models as expected
                if len(models) >= 240:
                    self.log(f"Discovered {len(models)} models (expected ~244)", True)
                else:
                    self.log(f"Discovered only {len(models)} models (expected ~244)", False)
                
                # Check for CRM category and crm.lead model
                crm_models = [m for m in models if m.get('category') == 'crm']
                print(f"   Found {len(crm_models)} CRM models")
                
                crm_lead = next((m for m in models if m.get('model') == 'crm.lead'), None)
                if crm_lead:
                    self.log("Found crm.lead model after discovery", True)
                    print(f"   crm.lead: {crm_lead.get('name')}")
                else:
                    self.log("crm.lead model NOT found after discovery", False)
                
                schema_data = discover_data
        else:
            self.log(f"Failed to get schema (status: {status})", False)
            return None
        
        # Test 3: Get fields for crm.lead model
        print(f"\n   Step 3: Loading fields for crm.lead model...")
        status, fields_data = self.make_request(
            'GET',
            f'integrations/{conn_id}/schema/crm.lead/fields',
            expected_status=200,
            description="GET /api/integrations/{id}/schema/crm.lead/fields - Get crm.lead fields"
        )
        
        if fields_data and isinstance(fields_data, dict):
            fields = fields_data.get('fields', {})
            print(f"   ✓ Loaded {len(fields)} fields for crm.lead")
            
            # Check for expected fields
            expected_fields = ['id', 'display_name', 'name', 'expected_revenue', 
                             'probability', 'stage_id', 'user_id', 'partner_id']
            found_fields = []
            missing_fields = []
            
            for field_name in expected_fields:
                if field_name in fields:
                    found_fields.append(field_name)
                    field_info = fields[field_name]
                    print(f"   ✓ {field_name}: {field_info.get('type')} - {field_info.get('string', 'N/A')}")
                else:
                    missing_fields.append(field_name)
            
            if len(found_fields) == len(expected_fields):
                self.log(f"All {len(expected_fields)} expected fields found in crm.lead", True)
            else:
                self.log(f"Only {len(found_fields)}/{len(expected_fields)} expected fields found", False)
                if missing_fields:
                    print(f"   Missing fields: {missing_fields}")
        else:
            self.log("Failed to load fields for crm.lead", False)
        
        return schema_data

    def test_visual_mapping_editor(self):
        """Test Visual Mapping Editor endpoints"""
        print("\n" + "="*60)
        print("TEST: Visual Mapping Editor")
        print("="*60)
        
        if not self.token:
            self.log("No token available, skipping Visual Mapping Editor tests", False)
            return
        
        # Test 1: Get canonical entities from YAML
        status, entities_data = self.make_request(
            'GET',
            'mapping-editor/entities',
            expected_status=200,
            description="GET /api/mapping-editor/entities - Get canonical entities from YAML"
        )
        
        if entities_data and isinstance(entities_data, dict):
            entities = entities_data.get('entities', [])
            print(f"   Found {len(entities)} canonical entities")
            
            # Check for expected 9 entities
            expected_entities = ['sales_user', 'sales_team', 'account', 'contact', 
                               'opportunity', 'activity', 'invoice', 'task', 'employee']
            entity_ids = [e.get('id') for e in entities]
            
            for expected in expected_entities:
                if expected in entity_ids:
                    print(f"   ✓ Entity '{expected}' found")
                else:
                    print(f"   ✗ Entity '{expected}' NOT found")
                    self.log(f"Missing expected entity: {expected}", False)
            
            # Show sample entity structure
            if entities:
                sample = entities[0]
                print(f"   Sample entity: {sample.get('id')} - {sample.get('label')}")
                print(f"   Fields count: {len(sample.get('fields', []))}")
        
        # Test 2: Get mapping config
        status, config_data = self.make_request(
            'GET',
            'mapping-editor/config',
            expected_status=200,
            description="GET /api/mapping-editor/config - Get saved mapping configuration"
        )
        
        if config_data and isinstance(config_data, dict):
            print(f"   Config structure: {list(config_data.keys())}")
            print(f"   Connection ID: {config_data.get('connectionId')}")
            print(f"   Field Mappings: {len(config_data.get('fieldMappings', {}))} mappings")
        
        # Test 3: Get sync status (requires a connection)
        connections = self.test_etl_connections()
        if connections and len(connections) > 0:
            conn_id = connections[0].get('id')
            print(f"\n   Testing sync status with connection: {conn_id}")
            
            status, sync_data = self.make_request(
                'GET',
                f'mapping-editor/sync/status/{conn_id}',
                expected_status=200,
                description="GET /api/mapping-editor/sync/status/{id} - Get sync status"
            )
            
            if sync_data and isinstance(sync_data, dict):
                print(f"   Last sync: {sync_data.get('lastSync')}")
                print(f"   Last run status: {sync_data.get('lastRunStatus')}")
                print(f"   Total records: {sync_data.get('totalRecords')}")
                entity_counts = sync_data.get('entityCounts', {})
                print(f"   Entity counts: {entity_counts}")
        else:
            self.log("No connections available for sync status test", False)

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("\n" + "="*70)
        print("EVENT MESH CRM - COMPREHENSIVE BACKEND API TEST")
        print("="*70)
        print(f"Base URL: {BASE_URL}")
        print(f"Test User: test@securado.com")
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
        self.test_etl_templates()
        self.test_etl_connections()
        self.test_etl_mappings()
        self.test_etl_pipelines()
        
        # Schema Discovery & Field Loading (NEW)
        self.test_schema_discovery()
        
        # Visual Mapping Editor (NEW)
        self.test_visual_mapping_editor()
        
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
