import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { 
  Box, Search, ChevronDown, ChevronRight, 
  Key, Link2, Hash, Type, Calendar, ToggleLeft,
  Building, Target, User, FileText, CheckSquare, Calendar as CalendarIcon,
  Briefcase, UserCircle, Trash2, ArrowLeft
} from 'lucide-react';

// Entity icons
const entityIcons = {
  'opportunity': Target,
  'account': Building,
  'contact': UserCircle,
  'invoice': FileText,
  'activity': CalendarIcon,
  'task': CheckSquare,
  'employee': Briefcase,
  'sales_user': User,
  'sales_team': User,
};

// Entity colors
const entityColors = {
  'opportunity': 'bg-amber-500',
  'account': 'bg-emerald-500',
  'contact': 'bg-cyan-500',
  'invoice': 'bg-red-500',
  'activity': 'bg-pink-500',
  'task': 'bg-indigo-500',
  'employee': 'bg-lime-500',
  'sales_user': 'bg-blue-500',
  'sales_team': 'bg-purple-500',
};

export function TargetPanel({ 
  targetModels, 
  selectedModel, 
  onSelectModel, 
  fieldMappings = {},
  selectedSourceModel,
  onAddMapping,
  onRemoveMapping 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModels, setExpandedModels] = useState(['opportunity', 'account']);
  const [dragOverField, setDragOverField] = useState(null);

  // Toggle model expansion
  const toggleModel = (modelId) => {
    setExpandedModels(prev => 
      prev.includes(modelId) 
        ? prev.filter(m => m !== modelId)
        : [...prev, modelId]
    );
  };

  // Select a model
  const handleSelectModel = (modelId) => {
    onSelectModel(modelId);
    if (!expandedModels.includes(modelId)) {
      toggleModel(modelId);
    }
  };

  // Get mappings for a specific source-target pair
  const getMappingsForTarget = (targetModelId) => {
    if (!selectedSourceModel) return [];
    const key = `${selectedSourceModel}__${targetModelId}`;
    return fieldMappings[key] || [];
  };

  // Check if a target field is mapped
  const isFieldMapped = (targetModelId, fieldName) => {
    const mappings = getMappingsForTarget(targetModelId);
    return mappings.some(m => m.targetField === fieldName);
  };

  // Get source field for a mapped target field
  const getSourceFieldForTarget = (targetModelId, fieldName) => {
    const mappings = getMappingsForTarget(targetModelId);
    const mapping = mappings.find(m => m.targetField === fieldName);
    return mapping?.sourceField;
  };

  // Filter models by search
  const filteredModels = targetModels.filter(m => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return m.id?.toLowerCase().includes(query) || 
           m.label?.toLowerCase().includes(query);
  });

  return (
    <Card className="h-full flex flex-col" data-testid="target-panel">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Box className="h-5 w-5 text-blue-500" />
            Target Models
            <Badge variant="secondary">{targetModels.length}</Badge>
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Canonical (Local)</p>
        
        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="target-search"
          />
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          <div className="space-y-2">
            {filteredModels.map((model) => {
              const Icon = entityIcons[model.id] || Box;
              const colorClass = entityColors[model.id] || 'bg-gray-500';
              const mappings = getMappingsForTarget(model.id);
              const isSelected = selectedModel === model.id;
              
              return (
                <div 
                  key={model.id} 
                  className={`border rounded-lg overflow-hidden ${
                    isSelected ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {/* Model Header */}
                  <button
                    onClick={() => handleSelectModel(model.id)}
                    className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-gray-50'
                    }`}
                    data-testid={`target-model-${model.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClass} text-white`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold">{model.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {model.fields?.length || 0} fields
                          {model.sourceModels?.length > 0 && (
                            <span className="ml-2">← {model.sourceModels.join(', ')}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {mappings.length > 0 && (
                        <Badge variant="default" className="bg-green-500">
                          {mappings.length} mapped
                        </Badge>
                      )}
                      {expandedModels.includes(model.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                  
                  {/* Model Fields */}
                  {expandedModels.includes(model.id) && (
                    <div className="border-t bg-gray-50 p-2">
                      <div className="space-y-1">
                        {(model.fields || []).map((field, idx) => {
                          const isMapped = isFieldMapped(model.id, field.name);
                          const sourceField = getSourceFieldForTarget(model.id, field.name);
                          
                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between py-1.5 px-2 rounded text-xs ${
                                isMapped 
                                  ? 'bg-green-50 border border-green-200' 
                                  : 'hover:bg-white'
                              }`}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                // Handle drop from source panel
                                const data = e.dataTransfer.getData('sourceField');
                                if (data) {
                                  const { model: srcModel, field: srcField } = JSON.parse(data);
                                  // This would trigger adding the mapping
                                  console.log(`Map ${srcModel}.${srcField} -> ${model.id}.${field.name}`);
                                }
                              }}
                              data-testid={`target-field-${model.id}-${field.name}`}
                            >
                              <div className="flex items-center gap-2">
                                {isMapped && (
                                  <ArrowLeft className="h-3 w-3 text-green-600" />
                                )}
                                <span className={`font-mono ${field.required ? 'font-bold' : ''}`}>
                                  {field.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {isMapped && sourceField && (
                                  <span className="text-green-700 font-mono mr-2">
                                    ← {sourceField}
                                  </span>
                                )}
                                <Badge variant="outline" className="text-[10px] px-1">
                                  {field.type}
                                </Badge>
                                {field.pk && (
                                  <Badge variant="default" className="text-[10px] px-1 bg-amber-500">PK</Badge>
                                )}
                                {field.fk && (
                                  <Badge variant="outline" className="text-[10px] px-1 bg-blue-50 text-blue-700">
                                    FK→{field.fk}
                                  </Badge>
                                )}
                                {field.required && !field.pk && (
                                  <Badge variant="destructive" className="text-[10px] px-1">REQ</Badge>
                                )}
                                {isMapped && onRemoveMapping && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 ml-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveMapping(selectedSourceModel, model.id, sourceField, field.name);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
