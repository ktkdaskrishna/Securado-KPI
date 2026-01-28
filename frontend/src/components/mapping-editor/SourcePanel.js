import React, { useState, useEffect } from 'react';
import { etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Skeleton } from '../ui/skeleton';
import { 
  Database, Search, ChevronDown, ChevronRight, 
  Table, Key, Link2, Hash, Type, Calendar, ToggleLeft,
  Box, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Field type icons
const fieldTypeIcons = {
  'integer': Hash,
  'float': Hash,
  'char': Type,
  'text': Type,
  'boolean': ToggleLeft,
  'date': Calendar,
  'datetime': Calendar,
  'many2one': Link2,
  'one2many': Link2,
  'many2many': Link2,
  'selection': Box,
};

// Category icons and colors
const categoryConfig = {
  'crm': { icon: '🎯', color: 'bg-amber-100 text-amber-800', label: 'CRM' },
  'account': { icon: '💰', color: 'bg-green-100 text-green-800', label: 'Accounting' },
  'sale': { icon: '📈', color: 'bg-blue-100 text-blue-800', label: 'Sales' },
  'purchase': { icon: '🛒', color: 'bg-purple-100 text-purple-800', label: 'Purchase' },
  'stock': { icon: '🏭', color: 'bg-orange-100 text-orange-800', label: 'Inventory' },
  'product': { icon: '📦', color: 'bg-cyan-100 text-cyan-800', label: 'Products' },
  'hr': { icon: '👥', color: 'bg-pink-100 text-pink-800', label: 'HR' },
  'project': { icon: '📋', color: 'bg-indigo-100 text-indigo-800', label: 'Projects' },
  'other': { icon: '📁', color: 'bg-gray-100 text-gray-800', label: 'Other' },
};

export function SourcePanel({ sourceModels, selectedModel, onSelectModel, loading, connectionId }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(['crm', 'account']);
  const [expandedModels, setExpandedModels] = useState({});
  const [modelFields, setModelFields] = useState({});
  const [loadingFields, setLoadingFields] = useState({});

  // Auto-expand categories when searching
  useEffect(() => {
    if (searchQuery) {
      // Find categories with matching models and expand them
      const matchingCategories = Object.entries(sourceModels)
        .filter(([_, models]) => models.some(m => 
          m.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.name?.toLowerCase().includes(searchQuery.toLowerCase())
        ))
        .map(([category]) => category);
      
      if (matchingCategories.length > 0) {
        setExpandedCategories(prev => [...new Set([...prev, ...matchingCategories])]);
      }
    }
  }, [searchQuery, sourceModels]);

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Load fields for a model
  const loadModelFields = async (modelName) => {
    if (modelFields[modelName] || loadingFields[modelName]) return;
    
    setLoadingFields(prev => ({ ...prev, [modelName]: true }));
    try {
      const res = await etlAPI.getModelFields(connectionId, modelName);
      const fieldsData = res.data?.fields || {};
      
      // Convert object to array format
      const fieldsArray = Object.entries(fieldsData).map(([name, field]) => ({
        name,
        type: field.type,
        label: field.string || name,
        required: field.required || false,
        relation: field.relation,
        help: field.help
      }));
      
      setModelFields(prev => ({ ...prev, [modelName]: fieldsArray }));
    } catch (error) {
      console.error(`Failed to load fields for ${modelName}:`, error);
      // Use cached fields from discovery if available
      const allModels = Object.values(sourceModels).flat();
      const model = allModels.find(m => m.model === modelName);
      if (model?.fields) {
        setModelFields(prev => ({ ...prev, [modelName]: model.fields }));
      }
    } finally {
      setLoadingFields(prev => ({ ...prev, [modelName]: false }));
    }
  };

  // Toggle model expansion and load fields
  const toggleModel = (modelName) => {
    const isExpanding = !expandedModels[modelName];
    setExpandedModels(prev => ({ ...prev, [modelName]: isExpanding }));
    
    if (isExpanding) {
      loadModelFields(modelName);
    }
  };

  // Select a model
  const handleSelectModel = (modelName) => {
    onSelectModel(modelName);
    if (!expandedModels[modelName]) {
      toggleModel(modelName);
    }
  };

  // Filter models by search
  const filterModels = (models) => {
    if (!searchQuery) return models;
    const query = searchQuery.toLowerCase();
    return models.filter(m => 
      m.model?.toLowerCase().includes(query) ||
      m.name?.toLowerCase().includes(query)
    );
  };

  // Count total models
  const totalModels = Object.values(sourceModels).flat().length;

  return (
    <Card className="h-full flex flex-col" data-testid="source-panel">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-orange-500" />
            Source Models
            <Badge variant="secondary">{totalModels}</Badge>
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">From Odoo</p>
        
        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="source-search"
          />
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : Object.keys(sourceModels).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No models discovered</p>
              <p className="text-xs mt-1">Select a connection to discover models</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(sourceModels).map(([category, models]) => {
                const config = categoryConfig[category] || categoryConfig.other;
                const filteredModels = filterModels(models);
                
                if (filteredModels.length === 0) return null;
                
                return (
                  <Collapsible
                    key={category}
                    open={expandedCategories.includes(category)}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className={`flex items-center justify-between p-2 rounded-lg ${config.color} hover:opacity-80 transition-opacity`}>
                        <div className="flex items-center gap-2">
                          <span>{config.icon}</span>
                          <span className="font-medium text-sm">{config.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {filteredModels.length}
                          </Badge>
                        </div>
                        {expandedCategories.includes(category) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="mt-1 space-y-1 pl-2">
                        {filteredModels.map((model) => (
                          <div key={model.model} className="border rounded-lg overflow-hidden">
                            {/* Model Header */}
                            <button
                              onClick={() => handleSelectModel(model.model)}
                              className={`w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 transition-colors ${
                                selectedModel === model.model ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                              }`}
                              data-testid={`source-model-${model.model}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Table className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-mono text-sm truncate">{model.model}</p>
                                  {model.name && model.name !== model.model && (
                                    <p className="text-xs text-muted-foreground truncate">{model.name}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {model.record_count !== undefined && (
                                  <Badge variant="outline" className="text-xs">
                                    {model.record_count} rows
                                  </Badge>
                                )}
                                {loadingFields[model.model] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : expandedModels[model.model] ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </div>
                            </button>
                            
                            {/* Model Fields */}
                            {expandedModels[model.model] && (
                              <div className="border-t bg-gray-50 p-2">
                                {/* Field Search */}
                                <div className="relative mb-2">
                                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                  <Input
                                    placeholder="Search fields... (e.g., x_studio)"
                                    value={fieldSearchQuery}
                                    onChange={(e) => setFieldSearchQuery(e.target.value)}
                                    className="pl-7 h-7 text-xs"
                                  />
                                </div>
                                
                                {loadingFields[model.model] ? (
                                  <div className="space-y-1">
                                    {[1, 2, 3].map(i => (
                                      <Skeleton key={i} className="h-6 w-full" />
                                    ))}
                                  </div>
                                ) : (modelFields[model.model] || model.fields || []).length > 0 ? (
                                  (() => {
                                    const allFields = modelFields[model.model] || model.fields || [];
                                    const filteredFields = fieldSearchQuery 
                                      ? allFields.filter(f => 
                                          f.name?.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
                                          f.label?.toLowerCase().includes(fieldSearchQuery.toLowerCase())
                                        )
                                      : allFields;
                                    
                                    // Sort fields: custom (x_studio) first, then alphabetically
                                    const sortedFields = [...filteredFields].sort((a, b) => {
                                      const aIsCustom = a.name?.startsWith('x_');
                                      const bIsCustom = b.name?.startsWith('x_');
                                      if (aIsCustom && !bIsCustom) return -1;
                                      if (!aIsCustom && bIsCustom) return 1;
                                      return (a.name || '').localeCompare(b.name || '');
                                    });
                                    
                                    return (
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground px-1 mb-1">
                                          <span>Showing {sortedFields.length} of {allFields.length} fields</span>
                                          {fieldSearchQuery && (
                                            <button 
                                              onClick={() => setFieldSearchQuery('')}
                                              className="text-blue-500 hover:underline"
                                            >
                                              Clear
                                            </button>
                                          )}
                                        </div>
                                        <ScrollArea className="h-64">
                                          <div className="space-y-1 pr-2">
                                            {sortedFields.map((field, idx) => {
                                              const FieldIcon = fieldTypeIcons[field.type] || Type;
                                              const isCustom = field.name?.startsWith('x_');
                                              const isStudio = field.name?.startsWith('x_studio_');
                                              return (
                                                <div
                                                  key={idx}
                                                  className={`flex items-center justify-between py-1.5 px-2 rounded hover:bg-white hover:shadow-sm text-xs group cursor-grab active:cursor-grabbing border transition-all ${
                                                    isStudio ? 'border-purple-200 bg-purple-50' :
                                                    isCustom ? 'border-yellow-200 bg-yellow-50' :
                                                    'border-transparent hover:border-blue-200'
                                                  }`}
                                                  draggable
                                                  onDragStart={(e) => {
                                                    e.dataTransfer.setData('sourceField', JSON.stringify({
                                                      model: model.model,
                                                      field: field.name,
                                                      type: field.type
                                                    }));
                                                    e.dataTransfer.effectAllowed = 'copy';
                                                    e.target.classList.add('opacity-50', 'scale-95');
                                                  }}
                                                  onDragEnd={(e) => {
                                                    e.target.classList.remove('opacity-50', 'scale-95');
                                                  }}
                                                  data-testid={`source-field-${model.model}-${field.name}`}
                                                  title={`${field.label || field.name}\nType: ${field.type}\nDrag to target field to create mapping`}
                                                >
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <FieldIcon className={`h-3 w-3 flex-shrink-0 ${
                                                      isStudio ? 'text-purple-500' :
                                                      isCustom ? 'text-yellow-600' :
                                                      'text-gray-400 group-hover:text-blue-500'
                                                    }`} />
                                                    <span className="font-mono truncate">{field.name}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1 flex-shrink-0">
                                                    <Badge variant="outline" className="text-[10px] px-1">
                                                      {field.type}
                                                    </Badge>
                                                    {isStudio && (
                                                      <Badge className="text-[10px] px-1 bg-purple-100 text-purple-700">Studio</Badge>
                                                    )}
                                                    {field.required && (
                                                      <Badge variant="destructive" className="text-[10px] px-1">REQ</Badge>
                                                    )}
                                                    <span className="opacity-0 group-hover:opacity-100 text-blue-500 text-[10px] ml-1">
                                                      drag →
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </ScrollArea>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    No fields available
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
