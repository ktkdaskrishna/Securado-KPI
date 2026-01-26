import React, { useState, useEffect } from 'react';
import { etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { 
  Plus, GitMerge, Trash2, ArrowRight, Eye, Wand2, CheckCircle, AlertCircle, 
  XCircle, RefreshCw, Shield, Database, Layers, Search, Download, ChevronRight,
  CheckSquare, Square, Boxes
} from 'lucide-react';
import { toast } from 'sonner';

const TRANSFORMS = [
  { value: 'direct', label: 'Direct Copy' },
  { value: 'to_float', label: 'To Float' },
  { value: 'to_int', label: 'To Integer' },
  { value: 'to_bool', label: 'To Boolean' },
  { value: 'extract_id', label: 'Extract ID (from relation)' },
  { value: 'extract_name', label: 'Extract Name (from relation)' },
];

const TARGET_ENTITIES = [
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'account', label: 'Account' },
  { value: 'contact', label: 'Contact' },
  { value: 'user', label: 'User' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'product', label: 'Product' },
  { value: 'order', label: 'Order' },
];

// Model categories for grouping
const MODEL_CATEGORIES = {
  'crm': { label: 'CRM', icon: '🎯', models: ['crm.lead', 'crm.stage', 'crm.team', 'crm.lost.reason'] },
  'account': { label: 'Accounting', icon: '💰', models: ['account.move', 'account.invoice', 'account.payment', 'account.journal'] },
  'sale': { label: 'Sales', icon: '📈', models: ['sale.order', 'sale.order.line'] },
  'purchase': { label: 'Purchase', icon: '🛒', models: ['purchase.order', 'purchase.order.line'] },
  'product': { label: 'Products', icon: '📦', models: ['product.product', 'product.template', 'product.category'] },
  'stock': { label: 'Inventory', icon: '🏭', models: ['stock.move', 'stock.picking', 'stock.warehouse'] },
  'hr': { label: 'HR', icon: '👥', models: ['hr.employee', 'hr.department'] },
  'res': { label: 'Core', icon: '⚙️', models: ['res.partner', 'res.users', 'res.company', 'res.currency'] },
};

const confidenceColors = {
  high: 'text-emerald-600 bg-emerald-50',
  medium: 'text-amber-600 bg-amber-50',
  low: 'text-gray-600 bg-gray-50',
};

export function MappingsPage() {
  const [mappings, setMappings] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [selectedMappingForVerify, setSelectedMappingForVerify] = useState(null);
  const [autoSuggesting, setAutoSuggesting] = useState(false);
  
  // Schema discovery state
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [discoveredModels, setDiscoveredModels] = useState([]);
  const [selectedModelFields, setSelectedModelFields] = useState(null);
  const [discoveringSchema, setDiscoveringSchema] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  
  // Multi-model selection state
  const [selectedModels, setSelectedModels] = useState([]);
  const [multiModelMode, setMultiModelMode] = useState(false);
  const [activeModelTab, setActiveModelTab] = useState(null);
  const [modelMappings, setModelMappings] = useState({}); // { modelName: { target_entity, mappings: [] } }
  
  const [formData, setFormData] = useState({
    name: '',
    connection_id: '',
    source_model: '',
    target_entity: 'opportunity',
    mappings: [{ source_field: '', target_field: '', transform: 'direct' }],
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [mappingsRes, connectionsRes] = await Promise.all([
        etlAPI.listMappings(),
        etlAPI.listConnections(),
      ]);
      setMappings(mappingsRes.data);
      setConnections(connectionsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // When connection is selected, discover its schema
  const handleConnectionSelect = async (connectionId) => {
    setFormData({ ...formData, connection_id: connectionId, source_model: '' });
    setSelectedConnection(connectionId);
    setDiscoveredModels([]);
    setSelectedModelFields(null);
    setSelectedModels([]);
    setModelMappings({});
    setActiveModelTab(null);
    
    if (!connectionId) return;
    
    setDiscoveringSchema(true);
    try {
      // First try to get existing schema
      let schemaData;
      try {
        const schemaRes = await etlAPI.getSchema(connectionId);
        schemaData = schemaRes.data;
      } catch (e) {
        // Schema not discovered yet, discover it
        toast.info('Discovering schema from source system...');
        const discoverRes = await etlAPI.discoverSchema(connectionId);
        schemaData = discoverRes.data;
      }
      
      if (schemaData?.models) {
        setDiscoveredModels(schemaData.models);
        toast.success(`Found ${schemaData.models.length} models in source system`);
      }
    } catch (error) {
      toast.error('Failed to discover schema: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDiscoveringSchema(false);
    }
  };

  // Toggle model selection for multi-model mode
  const toggleModelSelection = (modelName) => {
    setSelectedModels(prev => {
      if (prev.includes(modelName)) {
        // Remove model
        const newModels = prev.filter(m => m !== modelName);
        const newMappings = { ...modelMappings };
        delete newMappings[modelName];
        setModelMappings(newMappings);
        if (activeModelTab === modelName && newModels.length > 0) {
          setActiveModelTab(newModels[0]);
        }
        return newModels;
      } else {
        // Add model and initialize its mappings
        const newModels = [...prev, modelName];
        setModelMappings(prevMappings => ({
          ...prevMappings,
          [modelName]: {
            target_entity: guessTargetEntity(modelName),
            mappings: [{ source_field: '', target_field: '', transform: 'direct' }]
          }
        }));
        if (!activeModelTab) setActiveModelTab(modelName);
        return newModels;
      }
    });
  };

  // Guess target entity based on model name
  const guessTargetEntity = (modelName) => {
    if (modelName.includes('crm.lead')) return 'opportunity';
    if (modelName.includes('partner')) return 'account';
    if (modelName.includes('account.move') || modelName.includes('invoice')) return 'invoice';
    if (modelName.includes('product')) return 'product';
    if (modelName.includes('sale.order')) return 'order';
    if (modelName.includes('user')) return 'user';
    return 'account';
  };

  // When model is selected (single mode), get its fields and auto-suggest mappings
  const handleModelSelect = async (modelName) => {
    if (multiModelMode) {
      toggleModelSelection(modelName);
      return;
    }
    
    setFormData({ ...formData, source_model: modelName });
    setSelectedModelFields(null);
    
    if (!modelName || !formData.connection_id) return;
    
    setLoadingFields(true);
    try {
      // Get model fields
      const fieldsRes = await etlAPI.getModelFields(formData.connection_id, modelName);
      setSelectedModelFields(fieldsRes.data);
      
      // Auto-suggest mappings
      await handleAutoSuggest(modelName);
    } catch (error) {
      toast.error('Failed to load model fields');
    } finally {
      setLoadingFields(false);
    }
  };

  // Load fields for a model in multi-model mode
  const loadModelFields = async (modelName) => {
    if (!formData.connection_id) return;
    
    setLoadingFields(true);
    try {
      const fieldsRes = await etlAPI.getModelFields(formData.connection_id, modelName);
      setSelectedModelFields(fieldsRes.data);
      
      // Also auto-suggest mappings for this model
      const res = await etlAPI.autoSuggestMappings(
        formData.connection_id,
        modelName,
        modelMappings[modelName]?.target_entity || 'account'
      );
      
      const suggestions = res.data.suggestions || [];
      if (suggestions.length > 0) {
        const mappingRules = suggestions.map(s => ({
          source_field: s.source_field,
          target_field: s.target_field,
          transform: s.transform || 'direct',
          confidence: s.confidence
        }));
        
        setModelMappings(prev => ({
          ...prev,
          [modelName]: {
            ...prev[modelName],
            mappings: mappingRules
          }
        }));
      }
    } catch (error) {
      toast.error('Failed to load model fields');
    } finally {
      setLoadingFields(false);
    }
  };

  // Update model mappings in multi-model mode
  const updateModelMapping = (modelName, field, value) => {
    setModelMappings(prev => ({
      ...prev,
      [modelName]: {
        ...prev[modelName],
        [field]: value
      }
    }));
  };

  // Handle tab change in multi-model mode
  const handleModelTabChange = async (modelName) => {
    setActiveModelTab(modelName);
    await loadModelFields(modelName);
  };

  const handleAutoSuggest = async (sourceModel = formData.source_model) => {
    if (!formData.connection_id || !sourceModel) {
      toast.error('Please select a connection and source model first');
      return;
    }

    setAutoSuggesting(true);
    try {
      const res = await etlAPI.autoSuggestMappings(
        formData.connection_id,
        sourceModel,
        formData.target_entity
      );
      
      const suggestions = res.data.suggestions || [];
      const targetEntity = res.data.target_entity || formData.target_entity;
      
      if (suggestions.length > 0) {
        // Convert suggestions to mapping rules
        const mappingRules = suggestions.map(s => ({
          source_field: s.source_field,
          target_field: s.target_field,
          transform: s.transform || 'direct',
          confidence: s.confidence
        }));
        
        setFormData(prev => ({
          ...prev,
          target_entity: targetEntity,
          mappings: mappingRules,
          name: prev.name || `${sourceModel} to ${targetEntity}`
        }));
        
        toast.success(`Auto-populated ${mappingRules.length} field mappings`);
      } else if (res.data.canonical_fields) {
        toast.info('No auto-suggestions available. Please map fields manually.');
      } else {
        toast.warning('No mapping suggestions available');
      }
    } catch (error) {
      toast.error('Failed to auto-suggest mappings');
    } finally {
      setAutoSuggesting(false);
    }
  };

  const handleVerifyMapping = async (mappingId) => {
    setSelectedMappingForVerify(mappingId);
    setVerifyDialogOpen(true);
    
    try {
      const res = await etlAPI.verifyMapping(mappingId);
      setVerificationResult(res.data);
    } catch (error) {
      setVerificationResult({
        status: 'error',
        errors: ['Failed to verify mapping'],
        warnings: [],
        field_checks: []
      });
    }
  };

  const handleCreate = async () => {
    if (multiModelMode && selectedModels.length > 0) {
      // Create multiple mappings for multi-model mode
      try {
        let successCount = 0;
        for (const modelName of selectedModels) {
          const modelConfig = modelMappings[modelName];
          if (modelConfig && modelConfig.mappings.length > 0) {
            const cleanedMappings = modelConfig.mappings.map(({ confidence, ...rest }) => rest);
            await etlAPI.createMapping({
              name: `${formData.name || 'Multi-Model Sync'} - ${modelName}`,
              connection_id: formData.connection_id,
              source_model: modelName,
              target_entity: modelConfig.target_entity,
              mappings: cleanedMappings,
              description: formData.description,
              batch_id: formData.name || 'multi-model-batch' // Group related mappings
            });
            successCount++;
          }
        }
        toast.success(`Created ${successCount} mappings for ${selectedModels.length} models`);
        setDialogOpen(false);
        resetForm();
        loadData();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to create mappings');
      }
    } else {
      // Single model mode
      const cleanedMappings = formData.mappings.map(({ confidence, ...rest }) => rest);
      
      try {
        await etlAPI.createMapping({
          ...formData,
          mappings: cleanedMappings
        });
        toast.success('Mapping created');
        setDialogOpen(false);
        resetForm();
        loadData();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to create mapping');
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) return;
    try {
      await etlAPI.deleteMapping(id);
      toast.success('Mapping deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete mapping');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      connection_id: '',
      source_model: '',
      target_entity: 'opportunity',
      mappings: [{ source_field: '', target_field: '', transform: 'direct' }],
      description: '',
    });
    setSelectedConnection(null);
    setDiscoveredModels([]);
    setSelectedModelFields(null);
    setModelSearchQuery('');
    setSelectedModels([]);
    setModelMappings({});
    setActiveModelTab(null);
    setMultiModelMode(false);
  };

  const addMappingRule = (modelName = null) => {
    if (multiModelMode && modelName) {
      setModelMappings(prev => ({
        ...prev,
        [modelName]: {
          ...prev[modelName],
          mappings: [...(prev[modelName]?.mappings || []), { source_field: '', target_field: '', transform: 'direct' }]
        }
      }));
    } else {
      setFormData({
        ...formData,
        mappings: [...formData.mappings, { source_field: '', target_field: '', transform: 'direct' }],
      });
    }
  };

  const removeMappingRule = (index, modelName = null) => {
    if (multiModelMode && modelName) {
      setModelMappings(prev => ({
        ...prev,
        [modelName]: {
          ...prev[modelName],
          mappings: prev[modelName]?.mappings?.filter((_, i) => i !== index) || []
        }
      }));
    } else {
      setFormData({
        ...formData,
        mappings: formData.mappings.filter((_, i) => i !== index),
      });
    }
  };

  const updateMappingRule = (index, field, value, modelName = null) => {
    if (multiModelMode && modelName) {
      setModelMappings(prev => {
        const newMappings = [...(prev[modelName]?.mappings || [])];
        newMappings[index] = { ...newMappings[index], [field]: value };
        return {
          ...prev,
          [modelName]: {
            ...prev[modelName],
            mappings: newMappings
          }
        };
      });
    } else {
      const newMappings = [...formData.mappings];
      newMappings[index] = { ...newMappings[index], [field]: value };
      setFormData({ ...formData, mappings: newMappings });
    }
  };

  // Group models by category
  const getModelCategory = (modelName) => {
    const prefix = modelName.split('.')[0];
    return MODEL_CATEGORIES[prefix] || { label: 'Other', icon: '📄' };
  };

  const groupedModels = discoveredModels.reduce((acc, model) => {
    const category = getModelCategory(model.model);
    const key = category.label;
    if (!acc[key]) {
      acc[key] = { ...category, models: [] };
    }
    acc[key].models.push(model);
    return acc;
  }, {});

  const filteredModels = discoveredModels.filter(m => 
    !modelSearchQuery || 
    m.model?.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    m.name?.toLowerCase().includes(modelSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mappings</h1>
          <p className="text-muted-foreground">Define field transformations with auto-discovery</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" data-testid="mappings-new-button">
              <Plus className="h-4 w-4 mr-2" />
              New Mapping
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Create Mapping</DialogTitle>
              <DialogDescription>
                Select a connection to discover available models, then configure field mappings
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-3 gap-4 h-[60vh]">
              {/* Left Panel - Connection & Model Selection */}
              <div className="col-span-1 border-r pr-4 space-y-4">
                <div className="space-y-2">
                  <Label>1. Select Connection</Label>
                  <Select 
                    value={formData.connection_id} 
                    onValueChange={handleConnectionSelect}
                  >
                    <SelectTrigger data-testid="mapping-connection-select">
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            {conn.name}
                            <Badge variant="outline" className="text-xs">{conn.type}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {discoveringSchema ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Discovering schema...</span>
                  </div>
                ) : discoveredModels.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>2. Select Source Model(s)</Label>
                      <div className="flex gap-1">
                        {multiModelMode && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Select all visible filtered models
                              const allFiltered = filteredModels.map(m => m.model);
                              if (selectedModels.length === allFiltered.length) {
                                // Deselect all
                                setSelectedModels([]);
                                setModelMappings({});
                              } else {
                                // Select all
                                setSelectedModels(allFiltered);
                                const newMappings = {};
                                allFiltered.forEach(modelName => {
                                  newMappings[modelName] = {
                                    target_entity: guessTargetEntity(modelName),
                                    mappings: [{ source_field: '', target_field: '', transform: 'direct' }]
                                  };
                                });
                                setModelMappings(newMappings);
                                if (!activeModelTab && allFiltered.length > 0) {
                                  setActiveModelTab(allFiltered[0]);
                                }
                              }
                            }}
                            className="h-7 text-xs"
                          >
                            <CheckSquare className="h-3 w-3 mr-1" />
                            {selectedModels.length === filteredModels.length ? 'None' : 'All'}
                          </Button>
                        )}
                        <Button
                          variant={multiModelMode ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMultiModelMode(!multiModelMode)}
                          className="h-7 text-xs"
                        >
                          <Boxes className="h-3 w-3 mr-1" />
                          {multiModelMode ? 'Multi' : 'Single'}
                        </Button>
                      </div>
                    </div>
                    
                    {multiModelMode && selectedModels.length > 0 && (
                      <div className="flex flex-wrap gap-1 p-2 bg-muted rounded-md max-h-20 overflow-y-auto">
                        {selectedModels.map(m => (
                          <Badge key={m} variant="secondary" className="text-xs cursor-pointer" onClick={() => {
                            setActiveModelTab(m);
                            loadModelFields(m);
                          }}>
                            {m.split('.').pop()}
                            <button onClick={(e) => { e.stopPropagation(); toggleModelSelection(m); }} className="ml-1 hover:text-red-500">×</button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search models..."
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        className="pl-8"
                        data-testid="model-search-input"
                      />
                    </div>
                    <ScrollArea className="h-[220px] border rounded-md">
                      <div className="p-2">
                        {/* Group models by category */}
                        {Object.entries(groupedModels).map(([categoryName, category]) => {
                          const categoryModels = category.models.filter(m => 
                            !modelSearchQuery || 
                            m.model?.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                            m.name?.toLowerCase().includes(modelSearchQuery.toLowerCase())
                          );
                          
                          if (categoryModels.length === 0) return null;
                          
                          return (
                            <div key={categoryName} className="mb-3">
                              <div className="flex items-center justify-between px-2 py-1">
                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  <span>{category.icon}</span>
                                  <span>{categoryName}</span>
                                  <Badge variant="outline" className="text-xs h-4">{categoryModels.length}</Badge>
                                </div>
                                {multiModelMode && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 text-xs px-1"
                                    onClick={() => {
                                      const categoryModelNames = categoryModels.map(m => m.model);
                                      const allSelected = categoryModelNames.every(m => selectedModels.includes(m));
                                      if (allSelected) {
                                        setSelectedModels(prev => prev.filter(m => !categoryModelNames.includes(m)));
                                      } else {
                                        setSelectedModels(prev => [...new Set([...prev, ...categoryModelNames])]);
                                        categoryModelNames.forEach(modelName => {
                                          if (!modelMappings[modelName]) {
                                            setModelMappings(prev => ({
                                              ...prev,
                                              [modelName]: {
                                                target_entity: guessTargetEntity(modelName),
                                                mappings: [{ source_field: '', target_field: '', transform: 'direct' }]
                                              }
                                            }));
                                          }
                                        });
                                      }
                                    }}
                                  >
                                    Select
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-0.5">
                                {categoryModels.map((model) => (
                                  <button
                                    key={model.model}
                                    onClick={() => handleModelSelect(model.model)}
                                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                                      multiModelMode 
                                        ? selectedModels.includes(model.model)
                                          ? 'bg-primary/10 text-primary border border-primary/30'
                                          : 'hover:bg-muted'
                                        : formData.source_model === model.model 
                                          ? 'bg-primary text-primary-foreground' 
                                          : 'hover:bg-muted'
                                    }`}
                                    data-testid={`model-item-${model.model}`}
                                  >
                                    {multiModelMode && (
                                      <Checkbox 
                                        checked={selectedModels.includes(model.model)}
                                        className="h-3.5 w-3.5"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-xs truncate">{model.model}</div>
                                      <div className="text-xs opacity-60 truncate">{model.name}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{filteredModels.length} of {discoveredModels.length} models</span>
                      {multiModelMode && <span className="text-primary font-medium">{selectedModels.length} selected</span>}
                    </div>
                  </div>
                ) : selectedConnection ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No models discovered</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => handleConnectionSelect(selectedConnection)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry Discovery
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* Right Panel - Mapping Configuration */}
              <div className="col-span-2 pl-4 space-y-4 overflow-y-auto">
                {/* Multi-Model Mode - Show tabs for each selected model */}
                {multiModelMode && selectedModels.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label>Batch Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Odoo Full Sync"
                        data-testid="mapping-name-input"
                      />
                    </div>
                    
                    {/* Model tabs */}
                    <Tabs value={activeModelTab || selectedModels[0]} onValueChange={handleModelTabChange}>
                      <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
                        {selectedModels.map(model => (
                          <TabsTrigger 
                            key={model} 
                            value={model}
                            className="text-xs px-2 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                          >
                            {model.split('.').pop()}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      
                      {selectedModels.map(modelName => (
                        <TabsContent key={modelName} value={modelName} className="mt-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-primary" />
                              <span className="font-medium">{modelName}</span>
                              {selectedModelFields && activeModelTab === modelName && (
                                <Badge variant="secondary">
                                  {Object.keys(selectedModelFields.fields || {}).length} fields
                                </Badge>
                              )}
                            </div>
                            <Select 
                              value={modelMappings[modelName]?.target_entity || 'account'} 
                              onValueChange={(v) => updateModelMapping(modelName, 'target_entity', v)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TARGET_ENTITIES.map((e) => (
                                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Field Mappings for this model */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Field Mappings</Label>
                              <div className="flex gap-1">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => loadModelFields(modelName)}
                                  disabled={loadingFields}
                                  className="h-7 text-xs"
                                >
                                  {loadingFields && activeModelTab === modelName ? (
                                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <Wand2 className="h-3 w-3 mr-1" />
                                  )}
                                  Auto-Suggest
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => addMappingRule(modelName)}
                                  className="h-7 text-xs"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </Button>
                              </div>
                            </div>
                            
                            <ScrollArea className="h-[200px] border rounded-md p-2">
                              <div className="space-y-2">
                                {(modelMappings[modelName]?.mappings || []).length === 0 ? (
                                  <div className="text-center py-4 text-muted-foreground text-sm">
                                    Click "Auto-Suggest" to populate mappings
                                  </div>
                                ) : (
                                  (modelMappings[modelName]?.mappings || []).map((rule, index) => (
                                    <div key={index} className="flex items-center gap-2 p-2 border rounded bg-background">
                                      <div className="flex-1">
                                        <Select 
                                          value={rule.source_field} 
                                          onValueChange={(v) => updateMappingRule(index, 'source_field', v, modelName)}
                                        >
                                          <SelectTrigger className="h-8 text-sm">
                                            <SelectValue placeholder="Source field" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {selectedModelFields?.fields && activeModelTab === modelName && Object.entries(selectedModelFields.fields).map(([fieldName, fieldInfo]) => (
                                              <SelectItem key={fieldName} value={fieldName}>
                                                <div className="flex items-center gap-2">
                                                  <span>{fieldName}</span>
                                                  <span className="text-xs text-muted-foreground">({fieldInfo.type})</span>
                                                </div>
                                              </SelectItem>
                                            ))}
                                            {rule.source_field && (
                                              <SelectItem value={rule.source_field}>{rule.source_field}</SelectItem>
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <div className="flex-1">
                                        <Input
                                          placeholder="target_field"
                                          value={rule.target_field}
                                          onChange={(e) => updateMappingRule(index, 'target_field', e.target.value, modelName)}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                      <Select value={rule.transform} onValueChange={(v) => updateMappingRule(index, 'transform', v, modelName)}>
                                        <SelectTrigger className="w-28 h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {TRANSFORMS.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {rule.confidence !== undefined && (
                                        <Badge className={`text-xs ${confidenceColors[rule.confidence >= 0.7 ? 'high' : rule.confidence >= 0.5 ? 'medium' : 'low']}`}>
                                          {Math.round(rule.confidence * 100)}%
                                        </Badge>
                                      )}
                                      {(modelMappings[modelName]?.mappings || []).length > 1 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => removeMappingRule(index, modelName)}
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </>
                ) : formData.source_model ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Mapping Name</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., Odoo Opportunities Sync"
                          data-testid="mapping-name-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Target Entity</Label>
                        <Select 
                          value={formData.target_entity} 
                          onValueChange={(v) => {
                            setFormData({ ...formData, target_entity: v });
                            // Re-suggest mappings when target changes
                            handleAutoSuggest(formData.source_model);
                          }}
                        >
                          <SelectTrigger data-testid="target-entity-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_ENTITIES.map((e) => (
                              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Source Model Info */}
                    {selectedModelFields && (
                      <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-primary" />
                              <span className="font-medium">{formData.source_model}</span>
                            </div>
                            <Badge variant="secondary">
                              {Object.keys(selectedModelFields.fields || {}).length} fields
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Available fields: {Object.keys(selectedModelFields.fields || {}).slice(0, 5).join(', ')}
                            {Object.keys(selectedModelFields.fields || {}).length > 5 && '...'}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Field Mappings */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Field Mappings</Label>
                        <div className="flex gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleAutoSuggest()}
                            disabled={autoSuggesting || loadingFields}
                            data-testid="mappings-auto-suggest-button"
                          >
                            {autoSuggesting || loadingFields ? (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3 mr-1" />
                            )}
                            Auto-Suggest
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={addMappingRule}>
                            <Plus className="h-3 w-3 mr-1" />
                            Add Field
                          </Button>
                        </div>
                      </div>
                      
                      <ScrollArea className="h-[250px] border rounded-md p-2">
                        <div className="space-y-2">
                          {formData.mappings.map((rule, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 border rounded bg-background">
                              <div className="flex-1">
                                <Select 
                                  value={rule.source_field} 
                                  onValueChange={(v) => updateMappingRule(index, 'source_field', v)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Source field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedModelFields?.fields && Object.entries(selectedModelFields.fields).map(([fieldName, fieldInfo]) => (
                                      <SelectItem key={fieldName} value={fieldName}>
                                        <div className="flex items-center gap-2">
                                          <span>{fieldName}</span>
                                          <span className="text-xs text-muted-foreground">({fieldInfo.type})</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                    {/* Allow custom input too */}
                                    {rule.source_field && !selectedModelFields?.fields?.[rule.source_field] && (
                                      <SelectItem value={rule.source_field}>{rule.source_field}</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1">
                                <Input
                                  placeholder="target_field"
                                  value={rule.target_field}
                                  onChange={(e) => updateMappingRule(index, 'target_field', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <Select value={rule.transform} onValueChange={(v) => updateMappingRule(index, 'transform', v)}>
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TRANSFORMS.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {rule.confidence !== undefined && (
                                <Badge className={`text-xs ${confidenceColors[rule.confidence >= 0.7 ? 'high' : rule.confidence >= 0.5 ? 'medium' : 'low']}`}>
                                  {Math.round(rule.confidence * 100)}%
                                </Badge>
                              )}
                              {formData.mappings.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeMappingRule(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <ChevronRight className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a source model</p>
                    <p className="text-sm">Choose a connection and model from the left panel to configure field mappings</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleCreate} 
                disabled={!formData.name || !formData.connection_id || !formData.source_model || formData.mappings.length === 0}
                className="bg-primary hover:bg-primary/90"
                data-testid="mappings-save-button"
              >
                Create Mapping
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Verify Mapping Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schema Verification</DialogTitle>
            <DialogDescription>
              Validate mapping against source and target schemas
            </DialogDescription>
          </DialogHeader>
          
          {verificationResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {verificationResult.status === 'valid' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : verificationResult.status === 'warning' ? (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium capitalize">{verificationResult.status}</span>
              </div>
              
              {verificationResult.summary && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{verificationResult.summary.total_fields}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded">
                    <div className="text-lg font-bold text-emerald-600">{verificationResult.summary.valid}</div>
                    <div className="text-xs text-muted-foreground">Valid</div>
                  </div>
                  <div className="p-2 bg-amber-50 rounded">
                    <div className="text-lg font-bold text-amber-600">{verificationResult.summary.warnings}</div>
                    <div className="text-xs text-muted-foreground">Warnings</div>
                  </div>
                  <div className="p-2 bg-red-50 rounded">
                    <div className="text-lg font-bold text-red-600">{verificationResult.summary.errors}</div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </div>
                </div>
              )}
              
              {verificationResult.errors?.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {verificationResult.errors.map((err, i) => (
                        <li key={i} className="text-sm">{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              {verificationResult.warnings?.length > 0 && (
                <Alert>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {verificationResult.warnings.map((warn, i) => (
                        <li key={i} className="text-sm text-amber-700">{warn}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setVerifyDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing Mappings Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Source Model</TableHead>
              <TableHead>Target Entity</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No mappings yet. Create one to define field transformations.
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <GitMerge className="h-4 w-4 text-muted-foreground" />
                      {mapping.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {connections.find(c => c.id === mapping.connection_id)?.name || 'Unknown'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{mapping.source_model}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{mapping.target_entity}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{mapping.mappings?.length || 0} fields</Badge>
                  </TableCell>
                  <TableCell>v{mapping.version || 1}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleVerifyMapping(mapping.id)}
                        title="Verify Schema"
                        data-testid={`mapping-verify-${mapping.id}`}
                      >
                        <Shield className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(mapping.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
