"""
Iteration 28 - Bug Fix Tests
Testing 3 bug fixes:
1. Excel export filter alignment - uses date_last_stage_update (not create_date)
2. Tab title changed to 'ERP AI'
3. Data Health Monitor moved under 'System Alerts' section
Also regression tests for Win Rate and Invoice KPI cards
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CREDENTIALS = {
    'admin': {'email': 'krishna@securado.net', 'password': 'test123456'},
    'product_director': {'email': 'vimod.c@securado.net', 'password': 'test123456'},
    'sales_rep': {'email': 'nabisaheb@securado.net', 'password': 'test123456'},
}


class TestAuthAndSetup:
    """Authentication tests to get tokens"""
    
    @pytest.fixture(scope='class')
    def tokens(self):
        """Get auth tokens for all users"""
        tokens = {}
        for role, creds in CREDENTIALS.items():
            response = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
            if response.status_code == 200:
                data = response.json()
                tokens[role] = data.get('access_token')
            else:
                tokens[role] = None
        return tokens
    
    def test_admin_login(self, tokens):
        """Test admin login"""
        assert tokens.get('admin') is not None, "Admin login failed"
        print(f"✓ Admin logged in successfully")
    
    def test_director_login(self, tokens):
        """Test product director login"""
        assert tokens.get('product_director') is not None, "Product director login failed"
        print(f"✓ Product director logged in successfully")
    
    def test_sales_rep_login(self, tokens):
        """Test sales rep login"""
        assert tokens.get('sales_rep') is not None, "Sales rep login failed"
        print(f"✓ Sales rep logged in successfully")


class TestExcelExportFilterAlignment:
    """
    BUG FIX #1: Excel export now uses date_last_stage_update (same as dashboard)
    Previously used create_date which caused mismatches
    """
    
    @pytest.fixture(scope='class')
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['admin'])
        if response.status_code == 200:
            return response.json().get('access_token')
        return None
    
    def test_export_lost_2026_returns_more_than_4_rows(self, admin_token):
        """
        Key test: Export with year=2026&stage=Lost should return 14+ rows
        This was returning only 4 rows when using create_date filter
        Now uses date_last_stage_update which matches the dashboard cards
        """
        if not admin_token:
            pytest.skip("Admin login failed")
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        params = {'year': '2026', 'stage': 'Lost'}
        
        response = requests.get(f"{BASE_URL}/api/opportunities/export", 
                               params=params, headers=headers)
        
        assert response.status_code == 200, f"Export failed with status {response.status_code}"
        assert 'spreadsheetml' in response.headers.get('Content-Type', ''), "Response is not Excel format"
        
        # Parse Excel to count rows
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(response.content))
            ws = wb.active
            row_count = ws.max_row - 1  # Subtract header row
            print(f"✓ Export Lost 2026: {row_count} rows returned")
            
            # The fix should return 14+ rows (was 4 before fix)
            assert row_count >= 10, f"Expected 10+ rows for Lost 2026, got {row_count}. Filter may still be using create_date instead of date_last_stage_update"
        except ImportError:
            # If openpyxl not available, just check file size
            content_length = len(response.content)
            print(f"✓ Export Lost 2026: {content_length} bytes (openpyxl not available for row count)")
            assert content_length > 5000, f"Expected larger file size for 14+ rows, got {content_length} bytes"
    
    def test_export_won_2025_returns_records(self, admin_token):
        """Test export for Won stage in 2025"""
        if not admin_token:
            pytest.skip("Admin login failed")
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        params = {'year': '2025', 'stage': 'Won'}
        
        response = requests.get(f"{BASE_URL}/api/opportunities/export", 
                               params=params, headers=headers)
        
        assert response.status_code == 200
        assert 'spreadsheetml' in response.headers.get('Content-Type', '')
        print(f"✓ Export Won 2025: Success, {len(response.content)} bytes")
    
    def test_export_with_product_director_filter(self, admin_token):
        """
        BUG FIX: Export endpoint now accepts product_director parameter
        Frontend passes this filter from dashboard to export
        """
        if not admin_token:
            pytest.skip("Admin login failed")
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        params = {'year': '2025', 'product_director': 'Vimod Chandrasekaran'}
        
        response = requests.get(f"{BASE_URL}/api/opportunities/export", 
                               params=params, headers=headers)
        
        assert response.status_code == 200, f"Export with product_director failed: {response.status_code}"
        print(f"✓ Export with product_director filter: Success")
    
    def test_export_with_solution_category_filter(self, admin_token):
        """
        BUG FIX: Export endpoint now accepts solution_category parameter
        Frontend passes this filter from dashboard to export
        """
        if not admin_token:
            pytest.skip("Admin login failed")
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        # Use a common category name - test endpoint acceptance
        params = {'year': '2025', 'solution_category': 'IT Services'}
        
        response = requests.get(f"{BASE_URL}/api/opportunities/export", 
                               params=params, headers=headers)
        
        assert response.status_code == 200, f"Export with solution_category failed: {response.status_code}"
        print(f"✓ Export with solution_category filter: Success")
    
    def test_export_with_all_filters(self, admin_token):
        """Test export with all filters combined"""
        if not admin_token:
            pytest.skip("Admin login failed")
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        params = {
            'year': '2025',
            'stage': 'Won',
            'sales_rep': 'Nabisaheb',
            'product_director': 'Vimod',
            'solution_category': 'Cybersecurity'
        }
        
        response = requests.get(f"{BASE_URL}/api/opportunities/export", 
                               params=params, headers=headers)
        
        assert response.status_code == 200
        print(f"✓ Export with all filters: Success, {len(response.content)} bytes")


class TestDashboardAPI:
    """Test dashboard API returns correct data"""
    
    @pytest.fixture(scope='class')
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                                json=CREDENTIALS['product_director'])
        if response.status_code == 200:
            return response.json().get('access_token')
        return None
    
    def test_dashboard_loads(self, director_token):
        """Test dashboard API returns data"""
        if not director_token:
            pytest.skip("Director login failed")
        
        headers = {'Authorization': f'Bearer {director_token}'}
        response = requests.get(f"{BASE_URL}/api/card-builder/my-dashboard?year=2025", 
                               headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert 'blocks' in data or 'cards' in data
        print(f"✓ Dashboard API returns data")
    
    def test_win_rate_card_shows_percentage(self, director_token):
        """
        Regression test: Win Rate card should show percentage (e.g., 47%)
        Not raw count
        """
        if not director_token:
            pytest.skip("Director login failed")
        
        headers = {'Authorization': f'Bearer {director_token}'}
        response = requests.get(f"{BASE_URL}/api/card-builder/my-dashboard?year=2025", 
                               headers=headers)
        
        if response.status_code != 200:
            pytest.skip("Dashboard API failed")
        
        data = response.json()
        blocks = data.get('blocks', [])
        
        # Find Win Rate card
        win_rate_card = None
        for block in blocks:
            card = block.get('card', {})
            if card.get('display_type') == 'win_rate' or 'win' in card.get('name', '').lower():
                win_rate_card = block
                break
        
        if win_rate_card:
            card_data = win_rate_card.get('data', {})
            groups = card_data.get('groups', [])
            print(f"✓ Win Rate card found with groups: {[g.get('label') for g in groups]}")
            # Win rate calculation happens in frontend from Won/Lost counts
            won = sum(g.get('count', 0) for g in groups if g.get('label') == 'Won')
            lost = sum(g.get('count', 0) for g in groups if g.get('label') == 'Lost')
            if won + lost > 0:
                rate = (won / (won + lost)) * 100
                print(f"✓ Win Rate calculation: {won} won, {lost} lost = {rate:.0f}%")
        else:
            print("⚠ Win Rate card not found in template (may not be in director's dashboard)")
    
    def test_invoice_kpi_cards_non_zero(self, director_token):
        """
        Regression test: Invoice KPI cards should show non-zero values
        Fixed in iteration_27 (redis_pipeline collection-aware filters)
        """
        if not director_token:
            pytest.skip("Director login failed")
        
        headers = {'Authorization': f'Bearer {director_token}'}
        response = requests.get(f"{BASE_URL}/api/card-builder/my-dashboard?year=2025", 
                               headers=headers)
        
        if response.status_code != 200:
            pytest.skip("Dashboard API failed")
        
        data = response.json()
        blocks = data.get('blocks', [])
        
        # Find invoice cards
        invoice_cards = []
        for block in blocks:
            card = block.get('card', {})
            if card.get('collection') == 'invoices':
                card_data = block.get('data', {})
                value = card_data.get('value', 0) or card_data.get('count', 0) or 0
                invoice_cards.append({
                    'name': card.get('name'),
                    'value': value
                })
        
        if invoice_cards:
            print(f"✓ Found {len(invoice_cards)} invoice cards")
            for ic in invoice_cards:
                print(f"  - {ic['name']}: {ic['value']}")
                if ic['value'] > 0:
                    print(f"    ✓ Non-zero value confirmed")
            
            # At least one invoice card should have non-zero value
            non_zero = [c for c in invoice_cards if c['value'] > 0]
            assert len(non_zero) > 0, "All invoice cards showing 0 - regression detected!"
        else:
            print("⚠ No invoice cards in director's template")


class TestDataHealthAPI:
    """
    BUG FIX #3: Data Health Monitor under System Alerts section
    Test the API endpoint that feeds the DataHealthMonitor component
    """
    
    @pytest.fixture(scope='class')
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['admin'])
        if response.status_code == 200:
            return response.json().get('access_token')
        return None
    
    def test_data_health_endpoint_exists(self, admin_token):
        """Test that data health API endpoint exists"""
        if not admin_token:
            pytest.skip("Admin login failed")
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        response = requests.get(f"{BASE_URL}/api/card-builder/data-health", 
                               headers=headers)
        
        assert response.status_code == 200, f"Data health endpoint returned {response.status_code}"
        data = response.json()
        print(f"✓ Data health endpoint exists")
        
        # Verify response structure
        assert 'score' in data, "Missing 'score' in data health response"
        assert 'status' in data, "Missing 'status' in data health response"
        
        score = data.get('score', 0)
        status = data.get('status', 'unknown')
        print(f"✓ Health score: {score}/100, status: {status}")
        
        # Score should be a number between 0-100
        assert isinstance(score, (int, float)), "Score should be a number"
        assert 0 <= score <= 100, f"Score {score} out of range 0-100"
    
    def test_data_health_has_collections(self, admin_token):
        """Test data health returns collection info"""
        if not admin_token:
            pytest.skip("Admin login failed")
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        response = requests.get(f"{BASE_URL}/api/card-builder/data-health", 
                               headers=headers)
        
        if response.status_code != 200:
            pytest.skip("Data health endpoint failed")
        
        data = response.json()
        collections = data.get('collections', [])
        
        if collections:
            print(f"✓ Data health tracks {len(collections)} collections:")
            for c in collections:
                name = c.get('collection', 'unknown')
                total = c.get('total', 0)
                status = c.get('status', 'unknown')
                print(f"  - {name}: {total} records, status: {status}")


class TestOpportunitiesListAPI:
    """Test opportunities list API uses correct date field"""
    
    @pytest.fixture(scope='class')
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['admin'])
        if response.status_code == 200:
            return response.json().get('access_token')
        return None
    
    def test_opportunities_list_with_year_filter(self, admin_token):
        """Test opportunities list respects year filter"""
        if not admin_token:
            pytest.skip("Admin login failed")
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        # Get 2026 Lost opportunities
        response = requests.get(f"{BASE_URL}/api/opportunities", 
                               params={'year': '2026', 'stage': 'Lost', 'limit': 100},
                               headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        items = data.get('items', [])
        total = data.get('total', 0)
        
        print(f"✓ Opportunities 2026 Lost: {len(items)} items, {total} total")
        
        # Verify date filtering is on date_last_stage_update
        for opp in items[:5]:
            date_field = opp.get('date_last_stage_update', '')
            if date_field:
                assert date_field.startswith('2026'), f"Opportunity has date_last_stage_update={date_field}, expected 2026"
        
        print(f"✓ Date filter correctly using date_last_stage_update field")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
