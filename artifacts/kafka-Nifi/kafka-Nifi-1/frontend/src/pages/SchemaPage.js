import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { FolderTree, ChevronRight, Search, Database, FileText, RefreshCw } from 'lucide-react';

const SchemaPage = () => {
  const queryClient = useQueryClient();
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [expandedModels, setExpandedModels] = useState({});

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await connectionAPI.list();
      return res.data;
    },
  });

  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['schema', selectedConnection],
    queryFn: async () => {
      if (!selectedConnection) return null;
      const res = await connectionAPI.getSchema(selectedConnection);
      return res.data;
    },
    enabled: !!selectedConnection,
  });

  const { data: fields, isLoading: fieldsLoading } = useQuery({
    queryKey: ['fields', selectedConnection, selectedModel],
    queryFn: async () => {
      if (!selectedConnection || !selectedModel) return null;
      const res = await connectionAPI.getModelFields(selectedConnection, selectedModel);
      return res.data;
    },
    enabled: !!selectedConnection && !!selectedModel,
  });

  const discoverMutation = useMutation({
    mutationFn: (connId) => connectionAPI.discover(connId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema', selectedConnection] });
      toast.success('Schema discovered successfully!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Schema discovery failed');
    },
  });

  const toggleModel = (modelName) => {
    setSelectedModel(modelName === selectedModel ? null : modelName);
    setExpandedModels(prev => ({ ...prev, [modelName]: !prev[modelName] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schema Discovery</h1>
          <p className="text-muted-foreground">Browse Odoo models and fields</p>
        </div>
      </div>

      {/* Connection Selector */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select value={selectedConnection || ''} onValueChange={setSelectedConnection}>
              <SelectTrigger className="w-64" data-testid="connection-select">
                <SelectValue placeholder="Choose a connection" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      {conn.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedConnection && (
              <Button
                onClick={() => discoverMutation.mutate(selectedConnection)}
                disabled={discoverMutation.isPending}
                data-testid="discover-schema-button"
              >
                <Search className={`h-4 w-4 mr-2 ${discoverMutation.isPending ? 'animate-spin' : ''}`} />
                {discoverMutation.isPending ? 'Discovering...' : 'Discover Schema'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schema Browser */}
      {selectedConnection && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Models List */}
          <Card className="bg-card/80 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Models
              </CardTitle>
              <CardDescription>
                {schema?.models?.length || 0} models discovered
              </CardDescription>
            </CardHeader>
            <CardContent>
              {schemaLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !schema ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Click "Discover Schema" to browse models</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1" data-testid="models-list">
                    {schema.models?.map((model) => (
                      <button
                        key={model.model}
                        onClick={() => toggleModel(model.model)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                          selectedModel === model.model
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/50 text-foreground'
                        }`}
                        data-testid={`model-item-${model.model}`}
                      >
                        <ChevronRight className={`h-4 w-4 transition-transform ${expandedModels[model.model] ? 'rotate-90' : ''}`} />
                        <span className="font-mono text-xs">{model.model}</span>
                        <span className="text-muted-foreground ml-auto text-xs">{model.name}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Fields List */}
          <Card className="bg-card/80 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Fields
                {selectedModel && (
                  <Badge variant="outline" className="ml-2 font-mono text-xs">
                    {selectedModel}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {fields?.fields ? Object.keys(fields.fields).length : 0} fields
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedModel ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Select a model to view its fields</p>
                </div>
              ) : fieldsLoading ? (
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1" data-testid="fields-list">
                    {fields?.fields && Object.entries(fields.fields).map(([name, info]) => (
                      <div
                        key={name}
                        className="px-3 py-2 rounded-md text-sm border border-border/40 hover:border-border/80 transition-colors"
                        data-testid={`field-item-${name}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">{name}</span>
                          <Badge variant="outline" className="text-xs">
                            {info.type}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {info.string}
                          {info.required && <span className="text-destructive ml-1">*</span>}
                          {info.relation && <span className="text-primary ml-1">→ {info.relation}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SchemaPage;
