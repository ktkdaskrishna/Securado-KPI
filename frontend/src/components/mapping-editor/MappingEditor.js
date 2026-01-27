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

  // Load initial data
  useEffect(() => {
    loadConnections();
    loadTargetModels();
    loadSavedMappings();
  }, []);

  // Load connections
  const loadConnections = async () => {
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
  };

  // Load source models from Odoo
  const loadSourceModels = async (connectionId) => {
    if (!connectionId) return;
    
    setLoading(true);
    try {
      const res = await etlAPI.discoverSchema(connectionId);
      const models = res.data?.models || [];
      
      // Group by category
      const grouped = models.reduce((acc, model) => {
        const category = model.category || 'other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(model);
        return acc;
      }, {});
      
      setSourceModels(grouped);
      toast.success(`Discovered ${models.length} models from Odoo`);
    } catch (error) {
      console.error('Failed to load source models:', error);
      toast.error('Failed to discover Odoo models');
    } finally {
      setLoading(false);
    }
  };

  // Load canonical target models
  const loadTargetModels = async () => {
    try {
      const res = await etlAPI.getDataModel();
      setTargetModels(res.data?.entities || []);
    } catch (error) {
      // Use default models
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

  // Auto-suggest mappings for a model pair
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
              onClick={() => loadSourceModels(selectedConnection?.id)}
              disabled={!selectedConnection || loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
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
                onRemoveMapping={removeFieldMapping}
              />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="relationships" className="flex-1 p-4 mt-0">
          <RelationshipDiagram
            targetModels={targetModels}
            relationships={mappingConfig.relationships}
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
