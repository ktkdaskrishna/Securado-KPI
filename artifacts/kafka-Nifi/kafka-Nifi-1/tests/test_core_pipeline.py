"""
ESIP Core Pipeline POC - Odoo → Transform → MongoDB → KPIs
Tests the complete data flow with real Odoo connection
"""
import os
import sys
import xmlrpc.client
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import json

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# MongoDB connection
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

# Odoo Configuration
ODOO_URL = os.environ.get('ODOO_URL', 'https://securadotest.odoo.com')
ODOO_DB = os.environ.get('ODOO_DB', 'securadotest')
ODOO_USERNAME = os.environ.get('ODOO_USERNAME', 'krishna@securado.net')
ODOO_API_KEY = os.environ.get('ODOO_API_KEY', 'a14e5c5c0a69504f6e28f648890767f0711a416d')

# MongoDB Configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'esip_db')


class OdooExtractor:
    """Extract data from Odoo CRM via XML-RPC"""
    
    def __init__(self, url: str, db: str, username: str, api_key: str):
        self.url = url
        self.db = db
        self.username = username
        self.api_key = api_key
        self.uid = None
        self.common = None
        self.models = None
    
    def connect(self) -> bool:
        """Authenticate with Odoo"""
        try:
            print(f"🔗 Connecting to Odoo at {self.url}...")
            self.common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
            version = self.common.version()
            print(f"   Odoo version: {version.get('server_version', 'unknown')}")
            
            self.uid = self.common.authenticate(self.db, self.username, self.api_key, {})
            if self.uid:
                print(f"✅ Authenticated! User ID: {self.uid}")
                self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
                return True
            else:
                print("❌ Authentication failed")
                return False
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False
    
    def discover_models(self) -> List[Dict[str, Any]]:
        """Discover available CRM models"""
        models = self.models.execute_kw(
            self.db, self.uid, self.api_key,
            'ir.model', 'search_read',
            [[['model', 'like', 'crm.%']]],
            {'fields': ['model', 'name'], 'limit': 20}
        )
        return models
    
    def discover_fields(self, model: str) -> Dict[str, Any]:
        """Discover fields for a specific model"""
        fields = self.models.execute_kw(
            self.db, self.uid, self.api_key,
            model, 'fields_get',
            [],
            {'attributes': ['string', 'type', 'required', 'relation']}
        )
        return fields
    
    def extract_leads(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Extract CRM leads/opportunities"""
        fields = [
            'id', 'name', 'email_from', 'phone', 'partner_id',
            'stage_id', 'user_id', 'team_id',
            'expected_revenue', 'probability',
            'create_date', 'write_date', 'date_deadline',
            'date_closed', 'active', 'type'
        ]
        
        leads = self.models.execute_kw(
            self.db, self.uid, self.api_key,
            'crm.lead', 'search_read',
            [[]],  # No filter - get all
            {'fields': fields, 'limit': limit, 'order': 'write_date desc'}
        )
        print(f"📥 Extracted {len(leads)} leads from Odoo")
        return leads
    
    def extract_stages(self) -> List[Dict[str, Any]]:
        """Extract CRM stages"""
        stages = self.models.execute_kw(
            self.db, self.uid, self.api_key,
            'crm.stage', 'search_read',
            [[]],
            {'fields': ['id', 'name', 'sequence', 'is_won']}
        )
        print(f"📥 Extracted {len(stages)} stages from Odoo")
        return stages
    
    def extract_users(self) -> List[Dict[str, Any]]:
        """Extract sales users"""
        users = self.models.execute_kw(
            self.db, self.uid, self.api_key,
            'res.users', 'search_read',
            [[['active', '=', True]]],
            {'fields': ['id', 'name', 'email', 'login'], 'limit': 50}
        )
        print(f"📥 Extracted {len(users)} users from Odoo")
        return users


class DataTransformer:
    """Transform Odoo data to canonical model"""
    
    def __init__(self, stages: List[Dict], users: List[Dict]):
        # Build lookup maps
        self.stage_map = {s['id']: s for s in stages}
        self.user_map = {u['id']: u for u in users}
    
    def transform_lead(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a single Odoo lead to canonical opportunity"""
        # Get stage info
        stage_id = lead.get('stage_id')
        stage_name = "Unknown"
        is_won = False
        probability = lead.get('probability', 0)
        
        if stage_id and isinstance(stage_id, (list, tuple)):
            stage_info = self.stage_map.get(stage_id[0], {})
            stage_name = stage_id[1] if len(stage_id) > 1 else stage_info.get('name', 'Unknown')
            is_won = stage_info.get('is_won', False)
        
        # Get user info
        user_id = lead.get('user_id')
        owner_user_id = None
        owner_name = None
        if user_id and isinstance(user_id, (list, tuple)):
            owner_user_id = str(user_id[0])
            owner_name = user_id[1] if len(user_id) > 1 else None
        
        # Determine if closed
        is_closed = bool(lead.get('date_closed')) or is_won or probability == 0
        
        # Parse dates safely
        def parse_date(val):
            if not val:
                return None
            if isinstance(val, str):
                try:
                    return datetime.fromisoformat(val.replace('Z', '+00:00'))
                except:
                    return None
            return val
        
        return {
            'opportunity_id': f"odoo_lead_{lead['id']}",
            'source_system': 'odoo',
            'source_record_id': str(lead['id']),
            'name': lead.get('name', 'Untitled'),
            'amount': float(lead.get('expected_revenue', 0) or 0),
            'currency': 'USD',
            'stage': stage_name,
            'probability': float(probability or 0),
            'is_closed': is_closed,
            'is_won': is_won,
            'owner_user_id': owner_user_id,
            'owner_name': owner_name,
            'contact_email': lead.get('email_from'),
            'contact_phone': lead.get('phone'),
            'created_at': parse_date(lead.get('create_date')),
            'updated_at': parse_date(lead.get('write_date')),
            'closed_at': parse_date(lead.get('date_closed')),
            'expected_close_date': parse_date(lead.get('date_deadline')),
            'raw_data': lead,  # Keep original for debugging
            'transformed_at': datetime.now(timezone.utc)
        }
    
    def transform_leads(self, leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Transform all leads"""
        transformed = []
        for lead in leads:
            try:
                transformed.append(self.transform_lead(lead))
            except Exception as e:
                print(f"⚠️ Error transforming lead {lead.get('id')}: {e}")
        print(f"🔄 Transformed {len(transformed)} leads to canonical model")
        return transformed


class MongoLoader:
    """Load transformed data to MongoDB"""
    
    def __init__(self, mongo_url: str, db_name: str):
        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[db_name]
    
    async def upsert_opportunities(self, opportunities: List[Dict[str, Any]]) -> Dict[str, int]:
        """Upsert opportunities to silver collection (idempotent)"""
        inserted = 0
        updated = 0
        
        for opp in opportunities:
            result = await self.db.silver_opportunities.update_one(
                {'source_record_id': opp['source_record_id'], 'source_system': opp['source_system']},
                {'$set': opp},
                upsert=True
            )
            if result.upserted_id:
                inserted += 1
            elif result.modified_count > 0:
                updated += 1
        
        print(f"💾 MongoDB: {inserted} inserted, {updated} updated")
        return {'inserted': inserted, 'updated': updated}
    
    async def save_bronze(self, data: List[Dict[str, Any]], collection: str) -> int:
        """Save raw data to bronze collection"""
        if not data:
            return 0
        
        # Add metadata
        for item in data:
            item['_ingested_at'] = datetime.now(timezone.utc)
        
        result = await self.db[f'bronze_{collection}'].insert_many(data)
        print(f"💾 Bronze {collection}: {len(result.inserted_ids)} records saved")
        return len(result.inserted_ids)
    
    async def compute_kpis(self) -> Dict[str, Any]:
        """Compute KPIs from silver_opportunities"""
        
        # Pipeline Amount (sum of open deals)
        pipeline_result = await self.db.silver_opportunities.aggregate([
            {'$match': {'is_closed': False}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}, 'count': {'$sum': 1}}}
        ]).to_list(1)
        
        pipeline_amount = pipeline_result[0] if pipeline_result else {'total': 0, 'count': 0}
        
        # Win Rate
        closed_result = await self.db.silver_opportunities.aggregate([
            {'$match': {'is_closed': True}},
            {'$group': {
                '_id': None,
                'total_closed': {'$sum': 1},
                'total_won': {'$sum': {'$cond': ['$is_won', 1, 0]}},
                'won_amount': {'$sum': {'$cond': ['$is_won', '$amount', 0]}}
            }}
        ]).to_list(1)
        
        closed = closed_result[0] if closed_result else {'total_closed': 0, 'total_won': 0, 'won_amount': 0}
        win_rate = (closed['total_won'] / closed['total_closed'] * 100) if closed['total_closed'] > 0 else 0
        
        # Average Deal Size (won deals)
        avg_result = await self.db.silver_opportunities.aggregate([
            {'$match': {'is_won': True}},
            {'$group': {'_id': None, 'avg': {'$avg': '$amount'}, 'count': {'$sum': 1}}}
        ]).to_list(1)
        
        avg_deal = avg_result[0] if avg_result else {'avg': 0, 'count': 0}
        
        # Total records
        total = await self.db.silver_opportunities.count_documents({})
        
        kpis = {
            'pipeline_amount': pipeline_amount.get('total', 0),
            'pipeline_count': pipeline_amount.get('count', 0),
            'win_rate': round(win_rate, 2),
            'closed_won': closed.get('total_won', 0),
            'closed_lost': closed.get('total_closed', 0) - closed.get('total_won', 0),
            'won_revenue': closed.get('won_amount', 0),
            'avg_deal_size': round(avg_deal.get('avg', 0), 2),
            'total_opportunities': total
        }
        
        return kpis
    
    async def close(self):
        self.client.close()


async def run_pipeline():
    """Run the complete POC pipeline"""
    print("=" * 60)
    print("ESIP Core Pipeline POC")
    print("Odoo CRM → Transform → MongoDB → KPIs")
    print("=" * 60)
    
    # Step 1: Connect to Odoo
    extractor = OdooExtractor(ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY)
    if not extractor.connect():
        print("❌ Failed to connect to Odoo. Aborting.")
        return False
    
    # Step 2: Discover models (optional, for debugging)
    print("\n📋 Available CRM Models:")
    models = extractor.discover_models()
    for m in models[:5]:
        print(f"   - {m['model']}: {m['name']}")
    
    # Step 3: Extract data
    print("\n" + "=" * 40)
    print("EXTRACTING DATA")
    print("=" * 40)
    
    stages = extractor.extract_stages()
    users = extractor.extract_users()
    leads = extractor.extract_leads(limit=200)
    
    if not leads:
        print("⚠️ No leads found in Odoo. Check if CRM has data.")
        return False
    
    # Step 4: Transform data
    print("\n" + "=" * 40)
    print("TRANSFORMING DATA")
    print("=" * 40)
    
    transformer = DataTransformer(stages, users)
    opportunities = transformer.transform_leads(leads)
    
    # Show sample transformed record
    if opportunities:
        print("\n📄 Sample transformed record:")
        sample = {k: v for k, v in opportunities[0].items() if k != 'raw_data'}
        print(json.dumps(sample, indent=2, default=str))
    
    # Step 5: Load to MongoDB
    print("\n" + "=" * 40)
    print("LOADING TO MONGODB")
    print("=" * 40)
    
    loader = MongoLoader(MONGO_URL, DB_NAME)
    
    # Save to silver (canonical)
    upsert_result = await loader.upsert_opportunities(opportunities)
    
    # Step 6: Compute KPIs
    print("\n" + "=" * 40)
    print("COMPUTING KPIs")
    print("=" * 40)
    
    kpis = await loader.compute_kpis()
    
    print("\n📊 KPI Summary:")
    print(json.dumps(kpis, indent=2))
    
    await loader.close()
    
    # Final summary
    print("\n" + "=" * 60)
    print("✅ PIPELINE COMPLETED SUCCESSFULLY")
    print("=" * 60)
    print(f"   Extracted: {len(leads)} leads, {len(stages)} stages, {len(users)} users")
    print(f"   Transformed: {len(opportunities)} opportunities")
    print(f"   Loaded: {upsert_result['inserted']} new, {upsert_result['updated']} updated")
    print(f"   Pipeline Amount: ${kpis['pipeline_amount']:,.2f} ({kpis['pipeline_count']} deals)")
    print(f"   Win Rate: {kpis['win_rate']}%")
    print(f"   Avg Deal Size: ${kpis['avg_deal_size']:,.2f}")
    print("=" * 60)
    
    return True


if __name__ == '__main__':
    success = asyncio.run(run_pipeline())
    sys.exit(0 if success else 1)
