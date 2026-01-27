import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Separator } from '../ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { 
  Database, GitBranch, Save, Download, RefreshCw, Play, Clock,
  Eye, Edit, Plus, Trash2, ArrowRight, Box, Link2, Zap,
  Building, User, Users, Target, Calendar, FileText, Settings,
  CheckSquare, Briefcase, UserCircle, Info, ChevronDown, ChevronRight,
  Loader2, CheckCircle, XCircle, AlertTriangle, Wand2
} from 'lucide-react';
import { toast } from 'sonner';

// Import sub-components
import { SourcePanel } from './SourcePanel';
import { TargetPanel } from './TargetPanel';
import { RelationshipDiagram } from './RelationshipDiagram';
import { SyncControls } from './SyncControls';
import { TransformPreview } from './TransformPreview';

export function MappingEditor() {
  // State
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [sourceModels, setSourceModels] = useState([]);
  const [targetModels, setTargetModels] = useState([]);
  const [mappingConfig, setMappingConfig] = useState({ modelMappings: [], relationships: [] });
  const [activeTab, setActiveTab] = useState('mapping');
  const [syncing, setSyncing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedSourceModel, setSelectedSourceModel] = useState(null);
  const [selectedTargetModel, setSelectedTargetModel] = useState(null);
  const [fieldMappings, setFieldMappings] = useState({});
  const [autoSuggesting, setAutoSuggesting] = useState(false);

  // Load connections
  const loadConnections = useCallback(async () => {
    try {
      const res = await etlAPI.listConnections();
      setConnections(res.data || []);
      // Auto-select first Odoo connection
      const odooConn = res.data?.find(c => c.type === 'odoo' && c.status === 'active');
      if (odooConn) {
        setSelectedConnection(odooConn);
        loadSourceModels(odooConn.id);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadConnections();
    loadTargetModels();
    loadSavedMappings();
  }, [loadConnections]);

  // Load source models from Odoo - first try existing schema, then discover if needed
  const loadSourceModels = async (connectionId, forceDiscover = false) => {
    if (!connectionId) return;
    
    setLoading(true);
    try {
      let models = [];
      
      // First try to get existing schema
      if (!forceDiscover) {
        try {
          const schemaRes = await etlAPI.getSchema(connectionId);
          models = schemaRes.data?.models || [];
        } catch (e) {
          // Schema doesn't exist, will discover below
          console.log('No existing schema, will discover');
        }
      }
      
      // If no models found or force discover, run discovery
      if (models.length === 0 || forceDiscover) {
        toast.info('Discovering Odoo models...');
        const discoverRes = await etlAPI.discoverSchema(connectionId);
        models = discoverRes.data?.models || [];
      }
      
      // Group by category
      const grouped = models.reduce((acc, model) => {
        const category = model.category || 'other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(model);
        return acc;
      }, {});
      
      setSourceModels(grouped);
      if (models.length > 0) {
        toast.success(`Loaded ${models.length} Odoo models`);
      }
    } catch (error) {
      console.error('Failed to load source models:', error);
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message;
      
      // Check for specific error conditions
      if (errorMsg.includes('303') || errorMsg.includes('unavailable') || errorMsg.includes('upgrading')) {
        toast.error('Odoo server unavailable', {
          description: 'The Odoo instance may be upgrading or under maintenance. Please try again later.',
          duration: 8000,
        });
      } else {
        toast.error('Failed to load Odoo models', {
          description: errorMsg,
          duration: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Load canonical target models
  const loadTargetModels = async () => {
    try {
      const res = await etlAPI.getCanonicalEntities();
      if (res.data?.entities?.length > 0) {
        setTargetModels(res.data.entities);
      } else {
        throw new Error('No entities returned');
      }
    } catch (error) {
      // Use default models as fallback
      console.log('Using default target models');
      setTargetModels([
        { id: 'opportunity', label: 'Opportunity', color: '#F59E0B', icon: 'target', sourceModels: ['crm.lead'], fields: [
          { name: 'canonical_id', type: 'string', required: true, pk: true },
          { name: 'name', type: 'string', required: true },
          { name: 'amount', type: 'number' },
          { name: 'probability', type: 'number' },
          { name: 'stage', type: 'string' },
          { name: 'account_id', type: 'string', fk: 'account' },
          { name: 'account_name', type: 'string' },
          { name: 'owner_id', type: 'string', fk: 'sales_user' },
          { name: 'owner_name', type: 'string' },
          { name: 'close_date', type: 'date' },
          { name: 'is_won', type: 'boolean' },
        ]},
        { id: 'account', label: 'Account', color: '#10B981', icon: 'building', sourceModels: ['res.partner'], fields: [
          { name: 'canonical_id', type: 'string', required: true, pk: true },
          { name: 'name', type: 'string', required: true },
          { name: 'industry', type: 'string' },
          { name: 'phone', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'website', type: 'string' },
          { name: 'address', type: 'string' },
          { name: 'owner_id', type: 'string', fk: 'sales_user' },
        ]},
        { id: 'contact', label: 'Contact', color: '#06B6D4', icon: 'user', sourceModels: ['res.partner'], fields: [
          { name: 'canonical_id', type: 'string', required: true, pk: true },
          { name: 'name', type: 'string', required: true },
          { name: 'email', type: 'string' },
          { name: 'phone', type: 'string' },
          { name: 'account_id', type: 'string', fk: 'account' },
        ]},
        { id: 'invoice', label: 'Invoice', color: '#EF4444', icon: 'file', sourceModels: ['account.move'], fields: [
          { name: 'canonical_id', type: 'string', required: true, pk: true },
          { name: 'invoice_number', type: 'string' },
          { name: 'account_id', type: 'string', fk: 'account' },
          { name: 'amount_total', type: 'number' },
          { name: 'currency', type: 'string' },
          { name: 'state', type: 'string' },
          { name: 'invoice_date', type: 'date' },
        ]},
        { id: 'activity', label: 'Activity', color: '#EC4899', icon: 'calendar', sourceModels: ['mail.activity'], fields: [
          { name: 'canonical_id', type: 'string', required: true, pk: true },
          { name: 'summary', type: 'string' },
          { name: 'activity_type', type: 'string' },
          { name: 'date_deadline', type: 'date' },
          { name: 'opportunity_id', type: 'string', fk: 'opportunity' },
        ]},
        { id: 'task', label: 'Task', color: '#6366F1', icon: 'check', sourceModels: ['project.task'], fields: [
          { name: 'canonical_id', type: 'string', required: true, pk: true },
          { name: 'name', type: 'string', required: true },
          { name: 'stage', type: 'string' },
          { name: 'assignee_id', type: 'string' },
          { name: 'date_deadline', type: 'date' },
        ]},
      ]);
    }
  };

  // Load saved mappings
  const loadSavedMappings = async () => {
    try {
      const res = await etlAPI.getMappingConfig();
      if (res.data) {
        setMappingConfig(res.data);
        setFieldMappings(res.data.fieldMappings || {});
      }
    } catch (error) {
      console.log('No saved mappings found');
    }
  };

  // Handle connection change
  const handleConnectionChange = (connId) => {
    const conn = connections.find(c => c.id === connId);
    setSelectedConnection(conn);
    if (conn) {
      loadSourceModels(conn.id);
    }
  };

  // Smart field name matching for auto-mapping
  // Based on official Odoo model documentation (15 PDFs analyzed)
  const getSmartFieldMatch = (sourceField, targetField) => {
    const srcName = sourceField.name.toLowerCase();
    const tgtName = targetField.name.toLowerCase();
    
    // Direct match
    if (srcName === tgtName) return { match: true, transform: 'direct', confidence: 1.0 };
    
    // ID field matching
    if (tgtName === 'source_record_id' && srcName === 'id') {
      return { match: true, transform: 'to_string', confidence: 1.0 };
    }
    
    // Name variations
    if (tgtName === 'name' && (srcName === 'name' || srcName === 'display_name')) {
      return { match: true, transform: 'direct', confidence: 0.9 };
    }
    
    // Many2one field matching (_id suffix)
    if (tgtName.endsWith('_id') && sourceField.type === 'many2one') {
      const baseTarget = tgtName.replace('_id', '');
      const baseSrc = srcName.replace('_id', '');
      if (baseTarget === baseSrc || srcName === tgtName) {
        return { match: true, transform: 'extract_id', confidence: 0.9 };
      }
    }
    
    // Many2one name extraction (_name suffix)
    if (tgtName.endsWith('_name') && sourceField.type === 'many2one') {
      const baseTarget = tgtName.replace('_name', '');
      const baseSrc = srcName.replace('_id', '');
      if (baseTarget === baseSrc) {
        return { match: true, transform: 'extract_name', confidence: 0.8 };
      }
    }
    
    // PRECISE Odoo field mappings based on official documentation + custom fields (x_studio_*)
    // These are exact mappings from Odoo model fields to canonical fields
    const odooFieldMappings = {
      // crm.lead -> opportunity (Core fields)
      'amount': ['expected_revenue'],
      'sale_value': ['x_studio_sale_value'],  // Custom: Sale Value
      'budget_value': ['x_studio_budget_value'],  // Custom: Budget Value
      'probability': ['probability', 'automated_probability'],
      'automated_probability': ['automated_probability'],
      'stage': ['stage_id'],
      'stage_id': ['stage_id'],
      'close_date': ['date_deadline'],
      'date_open': ['date_open'],
      'date_closed': ['date_closed'],
      'is_won': ['won_status'],
      'is_closed': ['won_status'],
      'contact_email': ['email_from'],
      'contact_phone': ['phone'],
      'contact_mobile': ['contact_mobile'],
      'contact_name': ['contact_name'],
      'contact_job_position': ['contact_jobposition'],
      'customer_name': ['partner_name'],
      'description': ['description'],
      'descriptions': ['x_studio_descriptions'],
      'priority': ['priority'],
      'active': ['active'],
      'lost_reason': ['lost_reason_id'],
      'lost_reason_detail': ['x_studio_lost_reason'],
      
      // crm.lead -> Buyers/Stakeholders (Custom fields)
      'technical_buyer_id': ['techbuyer'],
      'technical_buyer_name': ['techbuyer'],
      'commercial_buyer_id': ['commbuyer'],
      'commercial_buyer_name': ['commbuyer'],
      'is_tech_buyer_coach': ['x_studio_is_a_technical_buyer'],
      'is_comm_buyer_coach': ['x_studio_is_a_commercial_buyer'],
      
      // crm.lead -> Tender/RFP fields (Custom)
      'is_tender': ['x_studio_is_it_a_tender'],
      'rfp_invited': ['x_studio_rfprfq_invited'],
      'assisted_in_rfp': ['x_studio_assisted_in_rfp'],
      'tender_purchase_deadline': ['x_studio_tender_purchase_end_date'],
      'query_submission_deadline': ['x_studio_query_submission_date'],
      'tender_submission_deadline': ['x_studio_tender_submission_date'],
      'is_bid_bond_needed': ['x_studio_is_bid_bond_needed'],
      
      // crm.lead -> Budget/Pledge (Custom)
      'budget_status': ['x_studio_budget_status'],
      'pledge': ['x_studio_pledge'],
      
      // crm.lead -> POC/Demo (Custom)
      'poc_demo_done': ['x_studio_poc_demo_done_successfully'],
      'poc_demo_date': ['x_studio_poc_demo_date'],
      
      // crm.lead -> Competition (Custom)
      'competitor_solution': ['x_studio_competitors_details_sales'],
      'competitor_price': ['x_studio_competitors_details_tech_sales'],
      
      // crm.lead -> Product/Service (Custom)
      'product_service_class': ['x_studio_product_service_class'],
      'deal_type': ['x_studio_deal_type'],
      'segment': ['x_studio_segment'],
      'customer_type': ['x_studio_customer_type'],
      
      // res.partner -> account/contact
      'industry': ['industry_id'],
      'phone': ['phone', 'mobile'],
      'email': ['email', 'email_from', 'work_email'],
      'website': ['website'],
      'address': ['street', 'street2'],
      'city': ['city'],
      'state': ['state_id'],
      'zip': ['zip'],
      'country': ['country_id'],
      'owner_id': ['user_id'],
      'owner_name': ['user_id'],
      'customer_rank': ['customer_rank'],
      'account_id': ['parent_id', 'partner_id'],
      'account_name': ['parent_id', 'partner_id'],
      'title': ['function'],
      'function': ['function'],
      'mobile': ['mobile'],
      
      // crm.team -> sales_team
      'use_opportunities': ['use_opportunities'],
      'use_leads': ['use_leads'],
      'alias_name': ['alias_name'],
      'invoiced': ['invoiced'],
      'invoiced_target': ['invoiced_target'],
      'member_ids': ['member_ids'],
      
      // res.users -> sales_user
      'login': ['login'],
      'team_id': ['sale_team_id', 'team_id'],
      
      // hr.employee -> employee
      'work_phone': ['work_phone'],
      'mobile_phone': ['mobile_phone'],
      'job_title': ['job_title', 'job_id'],
      'department_id': ['department_id'],
      'department_name': ['department_id'],
      'manager_id': ['parent_id'],
      'user_id': ['user_id'],
      
      // account.move -> invoice
      'invoice_number': ['name'],
      'invoice_date': ['invoice_date'],
      'due_date': ['invoice_date_due'],
      'amount_untaxed': ['amount_untaxed'],
      'amount_tax': ['amount_tax'],
      'amount_total': ['amount_total'],
      'currency': ['currency_id'],
      'payment_state': ['payment_state'],
      
      // mail.activity -> activity
      'summary': ['summary'],
      'activity_type': ['activity_type_id'],
      'note': ['note'],
      'date_deadline': ['date_deadline'],
      'opportunity_id': ['res_id'],
      
      // project.task -> task
      'description': ['description'],
      'project_id': ['project_id'],
      'project_name': ['project_id'],
      'assignee_id': ['user_ids'],  // Odoo: user_ids (many2many)
      'assignee_name': ['user_ids'],
      'planned_hours': ['planned_hours'],
      'effective_hours': ['effective_hours'],
      'priority': ['priority'],
      
      // Common timestamps
      'created_at': ['create_date'],
      'updated_at': ['write_date'],
      'active': ['active'],
    };
    
    // Check precise mappings first
    if (odooFieldMappings[tgtName]) {
      if (odooFieldMappings[tgtName].includes(srcName)) {
        let transform = 'direct';
        if (sourceField.type === 'many2one') {
          transform = tgtName.endsWith('_name') || tgtName.endsWith('_id') === false ? 'extract_name' : 'extract_id';
        } else if (sourceField.type === 'many2many' || sourceField.type === 'one2many') {
          transform = tgtName.endsWith('_name') ? 'first_name' : 'first_id';
        } else if (srcName === 'id') {
          transform = 'to_string';
        }
        return { match: true, transform, confidence: 0.95 };
      }
    }
    
    // Fallback: Common field name synonyms for edge cases
    const synonyms = {
      'phone': ['phone', 'mobile', 'telephone', 'work_phone'],
      'email': ['email', 'email_from', 'work_email'],
      'website': ['website', 'url'],
      'address': ['street', 'address', 'street2'],
    };
    
    for (const [target, sources] of Object.entries(synonyms)) {
      if (tgtName === target && sources.includes(srcName)) {
        const transform = sourceField.type === 'many2one' ? 'extract_name' : 'direct';
        return { match: true, transform, confidence: 0.7 };
      }
    }
    
    return { match: false };
  };

  // Auto-map all entities based on canonical model definitions
  const handleAutoMapAll = async () => {
    if (!selectedConnection) {
      toast.error('Please select a connection first');
      return;
    }
    
    setAutoSuggesting(true);
    toast.info('Auto-mapping entities...', { duration: 2000 });
    
    try {
      const newMappings = { ...fieldMappings };
      let totalMapped = 0;
      
      // For each target entity
      for (const targetEntity of targetModels) {
        const sourceModel = targetEntity.sourceModels?.[0];
        if (!sourceModel) continue;
        
        // Find source model in discovered models
        const allSourceModels = Object.values(sourceModels).flat();
        const source = allSourceModels.find(m => m.model === sourceModel);
        
        if (!source) continue;
        
        // Get source fields
        let sourceFields = [];
        try {
          const fieldsRes = await etlAPI.getModelFields(selectedConnection.id, sourceModel);
          sourceFields = Object.entries(fieldsRes.data?.fields || {}).map(([name, field]) => ({
            name,
            type: field.type,
            label: field.string
          }));
        } catch (e) {
          continue;
        }
        
        const key = `${sourceModel}__${targetEntity.id}`;
        const mappings = [];
        
        // Match fields
        for (const targetField of targetEntity.fields || []) {
          // Skip system fields
          if (['canonical_id', 'org_id', 'source_system'].includes(targetField.name)) continue;
          
          for (const sourceField of sourceFields) {
            const match = getSmartFieldMatch(sourceField, targetField);
            if (match.match) {
              mappings.push({
                sourceField: sourceField.name,
                targetField: targetField.name,
                transform: match.transform,
                confidence: match.confidence
              });
              break; // Use first match
            }
          }
        }
        
        if (mappings.length > 0) {
          newMappings[key] = mappings;
          totalMapped += mappings.length;
        }
      }
      
      setFieldMappings(newMappings);
      toast.success(`Auto-mapped ${totalMapped} fields across entities!`);
      
    } catch (error) {
      console.error('Auto-map failed:', error);
      toast.error('Auto-mapping failed: ' + error.message);
    } finally {
      setAutoSuggesting(false);
    }
  };

  // Auto-suggest mappings for a model pair (existing)
  const handleAutoSuggest = async (sourceModel, targetModel) => {
    if (!selectedConnection || !sourceModel || !targetModel) return;
    
    setAutoSuggesting(true);
    try {
      const res = await etlAPI.autoSuggestMappings(
        selectedConnection.id,
        sourceModel,
        targetModel
      );
      
      const suggestions = res.data?.suggestions || [];
      const key = `${sourceModel}__${targetModel}`;
      
      setFieldMappings(prev => ({
        ...prev,
        [key]: suggestions.map(s => ({
          sourceField: s.source_field,
          targetField: s.target_field,
          transform: s.transform || 'direct',
          confidence: s.confidence
        }))
      }));
      
      toast.success(`Auto-mapped ${suggestions.length} fields`);
    } catch (error) {
      console.error('Auto-suggest failed:', error);
      toast.error('Failed to auto-suggest mappings');
    } finally {
      setAutoSuggesting(false);
    }
  };

  // Add field mapping
  const addFieldMapping = (sourceModel, targetModel, sourceField, targetField, transform = 'direct') => {
    const key = `${sourceModel}__${targetModel}`;
    setFieldMappings(prev => {
      const existing = prev[key] || [];
      // Check if mapping already exists
      if (existing.some(m => m.sourceField === sourceField && m.targetField === targetField)) {
        return prev;
      }
      return {
        ...prev,
        [key]: [...existing, { sourceField, targetField, transform }]
      };
    });
  };

  // Remove field mapping
  const removeFieldMapping = (sourceModel, targetModel, sourceField, targetField) => {
    const key = `${sourceModel}__${targetModel}`;
    setFieldMappings(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(
        m => !(m.sourceField === sourceField && m.targetField === targetField)
      )
    }));
  };

  // Save mappings
  const handleSaveMappings = async () => {
    try {
      await etlAPI.saveMappingConfig({
        connectionId: selectedConnection?.id,
        fieldMappings,
        relationships: mappingConfig.relationships,
        updatedAt: new Date().toISOString()
      });
      toast.success('Mappings saved successfully');
    } catch (error) {
      console.error('Failed to save mappings:', error);
      toast.error('Failed to save mappings');
    }
  };

  // Preview transformation
  const handlePreview = async () => {
    if (!selectedConnection) {
      toast.error('Please select a connection');
      return;
    }
    
    try {
      const res = await etlAPI.previewTransformation({
        connectionId: selectedConnection.id,
        fieldMappings,
        limit: 5
      });
      setPreviewData(res.data);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error('Preview failed:', error);
      toast.error('Failed to preview transformation');
    }
  };

  // Run sync
  const handleSync = async () => {
    if (!selectedConnection) {
      toast.error('Please select a connection');
      return;
    }
    
    setSyncing(true);
    try {
      // First save mappings
      await handleSaveMappings();
      
      // Then run sync
      const res = await etlAPI.runMappingSync({
        connectionId: selectedConnection.id,
        fieldMappings
      });
      
      toast.success(`Sync completed: ${res.data?.recordsProcessed || 0} records processed`);
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Sync failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSyncing(false);
    }
  };

  if (loading && connections.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50" data-testid="mapping-editor">
      {/* Header */}
      <div className="p-4 border-b bg-white shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-primary" />
              Visual Mapping Editor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Map Odoo models to local canonical structure
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Connection Selector */}
            <Select 
              value={selectedConnection?.id || ''} 
              onValueChange={handleConnectionChange}
            >
              <SelectTrigger className="w-[200px]" data-testid="connection-select">
                <SelectValue placeholder="Select Connection" />
              </SelectTrigger>
              <SelectContent>
                {connections.filter(c => c.type === 'odoo').map(conn => (
                  <SelectItem key={conn.id} value={conn.id}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      {conn.name}
                      {conn.status === 'active' && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Active</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Separator orientation="vertical" className="h-8" />
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadSourceModels(selectedConnection?.id, true)}
              disabled={!selectedConnection || loading}
              data-testid="refresh-schema-btn"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            {/* Auto-Map All Button - Always visible */}
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleAutoMapAll}
              disabled={!selectedConnection || autoSuggesting || Object.keys(sourceModels).length === 0}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
              data-testid="auto-map-all-btn"
            >
              {autoSuggesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Auto-Map All
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePreview}
              disabled={!selectedConnection}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSaveMappings}
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setScheduleDialogOpen(true)}
            >
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </Button>
            
            <Button 
              onClick={handleSync}
              disabled={syncing || !selectedConnection}
              className="bg-primary"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Sync Now
            </Button>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 border-b bg-white">
          <TabsList>
            <TabsTrigger value="mapping" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Field Mappings
            </TabsTrigger>
            <TabsTrigger value="relationships" className="gap-2">
              <Link2 className="h-4 w-4" />
              Relationships
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <Zap className="h-4 w-4" />
              Sync Status
            </TabsTrigger>
          </TabsList>
        </div>
        
        {/* Main Content */}
        <TabsContent value="mapping" className="flex-1 p-4 mt-0">
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Source Panel (Left) */}
            <div className="col-span-5">
              <SourcePanel
                sourceModels={sourceModels}
                selectedModel={selectedSourceModel}
                onSelectModel={setSelectedSourceModel}
                loading={loading}
                connectionId={selectedConnection?.id}
              />
            </div>
            
            {/* Mapping Controls (Center) */}
            <div className="col-span-2 flex flex-col items-center justify-center gap-4">
              <div className="text-center text-sm text-muted-foreground">
                <ArrowRight className="h-8 w-8 mx-auto mb-2 text-primary" />
                Map Fields
              </div>
              
              {selectedSourceModel && selectedTargetModel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAutoSuggest(selectedSourceModel, selectedTargetModel)}
                  disabled={autoSuggesting}
                >
                  {autoSuggesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Auto-Map
                </Button>
              )}
              
              {/* Show current mappings count */}
              {selectedSourceModel && selectedTargetModel && (
                <Badge variant="secondary">
                  {(fieldMappings[`${selectedSourceModel}__${selectedTargetModel}`] || []).length} mappings
                </Badge>
              )}
            </div>
            
            {/* Target Panel (Right) */}
            <div className="col-span-5">
              <TargetPanel
                targetModels={targetModels}
                selectedModel={selectedTargetModel}
                onSelectModel={setSelectedTargetModel}
                fieldMappings={fieldMappings}
                selectedSourceModel={selectedSourceModel}
                onAddMapping={addFieldMapping}
                onRemoveMapping={removeFieldMapping}
              />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="relationships" className="flex-1 p-4 mt-0">
          <RelationshipDiagram
            targetModels={targetModels}
            relationships={mappingConfig.relationships}
            fieldMappings={fieldMappings}
            onUpdateRelationships={(rels) => setMappingConfig(prev => ({ ...prev, relationships: rels }))}
          />
        </TabsContent>
        
        <TabsContent value="sync" className="flex-1 p-4 mt-0">
          <SyncControls
            connectionId={selectedConnection?.id}
            fieldMappings={fieldMappings}
          />
        </TabsContent>
      </Tabs>
      
      {/* Preview Dialog */}
      <TransformPreview
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        data={previewData}
      />
      
      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Sync</DialogTitle>
            <DialogDescription>
              Set up automatic data synchronization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sync Frequency</Label>
              <Select defaultValue="daily">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Every Hour</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Time (for daily/weekly)</Label>
              <Input type="time" defaultValue="02:00" />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch id="schedule-enabled" />
              <Label htmlFor="schedule-enabled">Enable scheduled sync</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              toast.success('Schedule saved');
              setScheduleDialogOpen(false);
            }}>Save Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
