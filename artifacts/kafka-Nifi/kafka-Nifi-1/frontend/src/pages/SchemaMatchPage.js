import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ArrowRight, ArrowLeftRight, Check, X, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';

const SchemaMatchPage = () => {
  const [connections, setConnections] = useState([]);
  const [targets, setTargets] = useState([]);
  const [schemas, setSchemas] = useState({});
  const [sourceConnection, setSourceConnection] = useState('');
  const [sourceModel, setSourceModel] = useState('');
  const [targetId, setTargetId] = useState('');
  const [targetTable, setTargetTable] = useState('');
  const [matchResult, setMatchResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [connsRes, targetsRes] = await Promise.all([
        api.connections.list(),
        api.targets.list()
      ]);
      setConnections(connsRes.data);
      setTargets(targetsRes.data);
      
      // Load schemas for each connection
      for (const conn of connsRes.data) {
        try {
          const schemaRes = await api.schema.discover(conn.id);
          setSchemas(prev => ({ ...prev, [conn.id]: schemaRes.data }));
        } catch (e) {
          // Schema might not be discovered yet
        }
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverTargetSchema = async () => {
    if (!targetId) return;
    try {
      const response = await api.targets.discoverSchema(targetId);
      toast.success(`Discovered ${response.data.tables?.length || 0} tables`);
      // Refresh targets to get schema
    } catch (error) {
      toast.error('Failed to discover target schema');
    }
  };

  const handleMatch = async () => {
    if (!sourceConnection || !sourceModel || !targetId || !targetTable) {
      toast.error('Please select all fields');
      return;
    }
    
    setMatching(true);
    try {
      const response = await api.schema.match(
        sourceConnection,
        sourceModel,
        targetId,
        targetTable
      );
      setMatchResult(response.data);
      toast.success('Schema matching complete!');
    } catch (error) {
      toast.error('Failed to match schemas: ' + (error.response?.data?.detail || error.message));
    } finally {
      setMatching(false);
    }
  };

  const handleCreateMapping = async () => {
    if (!matchResult) return;
    
    try {
      const mappings = matchResult.suggestions.auto_mapped.map(m => ({
        source_field: m.source_field,
        target_field: m.target_field,
        transform: m.transform
      }));
      
      await api.mappings.create({
        name: `${sourceModel} → ${targetTable}`,
        connection_id: sourceConnection,
        source_model: sourceModel,
        target_entity: targetTable,
        mappings: mappings
      });
      
      toast.success('Mapping created from suggestions!');
    } catch (error) {
      toast.error('Failed to create mapping');
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-500';
    if (confidence >= 0.7) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getConfidenceBar = (confidence) => {
    const percentage = Math.round(confidence * 100);
    let color = 'bg-green-500';
    if (confidence < 0.9) color = 'bg-yellow-500';
    if (confidence < 0.7) color = 'bg-orange-500';
    
    return (
      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="schema-match-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6" />
          Schema Matching
        </h1>
        <p className="text-muted-foreground">Automatically match fields between source and target schemas</p>
      </div>
      
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configure Matching</CardTitle>
          <CardDescription>Select source and target to compare schemas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Source */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-500">Source</Badge>
                Odoo CRM
              </h3>
              
              <div className="space-y-2">
                <Label>Connection</Label>
                <Select value={sourceConnection} onValueChange={setSourceConnection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map(conn => (
                      <SelectItem key={conn.id} value={conn.id}>{conn.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={sourceModel} onValueChange={setSourceModel} disabled={!sourceConnection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {schemas[sourceConnection]?.models?.map(model => (
                      <SelectItem key={model.model} value={model.model}>{model.name}</SelectItem>
                    )) || (
                      <SelectItem value="crm.lead">crm.lead (Lead/Opportunity)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <ArrowRight className="h-8 w-8 text-muted-foreground" />
            </div>
            
            {/* Target */}
            <div className="space-y-4 md:col-start-2">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-500">Target</Badge>
                Database
              </h3>
              
              <div className="space-y-2">
                <Label>Target Connection</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map(target => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.name} ({target.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Table Name</Label>
                <Input
                  placeholder="e.g., opportunities"
                  value={targetTable}
                  onChange={(e) => setTargetTable(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-center">
            <Button
              size="lg"
              onClick={handleMatch}
              disabled={matching || !sourceConnection || !sourceModel || !targetId || !targetTable}
            >
              {matching ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Match Schemas
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Match Results */}
      {matchResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Matching Results</CardTitle>
                <CardDescription>
                  {matchResult.suggestions.stats.auto_mapped_count} of {matchResult.suggestions.stats.total_source_fields} fields auto-mapped
                  ({matchResult.suggestions.stats.auto_map_percentage}%)
                </CardDescription>
              </div>
              <Button onClick={handleCreateMapping}>
                <Check className="h-4 w-4 mr-2" />
                Create Mapping from Suggestions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="auto" className="w-full">
              <TabsList>
                <TabsTrigger value="auto">
                  Auto-Mapped ({matchResult.suggestions.auto_mapped.length})
                </TabsTrigger>
                <TabsTrigger value="suggestions">
                  All Suggestions ({matchResult.suggestions.suggestions.length})
                </TabsTrigger>
                <TabsTrigger value="unmapped">
                  Unmapped ({matchResult.suggestions.unmapped_source.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="auto" className="mt-4">
                <div className="space-y-2">
                  {matchResult.suggestions.auto_mapped.map((mapping, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <div className="flex-1">
                        <code className="text-sm font-mono">{mapping.source_field}</code>
                      </div>
                      <ArrowRight className="h-4 w-4 text-green-500" />
                      <div className="flex-1">
                        <code className="text-sm font-mono">{mapping.target_field}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        {getConfidenceBar(mapping.confidence)}
                        <span className={`text-sm font-medium ${getConfidenceColor(mapping.confidence)}`}>
                          {Math.round(mapping.confidence * 100)}%
                        </span>
                      </div>
                      <Badge variant="outline">{mapping.transform}</Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="suggestions" className="mt-4">
                <div className="space-y-2">
                  {matchResult.suggestions.suggestions.map((suggestion, i) => (
                    <div key={i} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div>
                          <code className="text-sm font-mono">{suggestion.source_field}</code>
                          <span className="text-xs text-muted-foreground ml-2">({suggestion.source_type})</span>
                        </div>
                        {suggestion.best_match ? (
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4" />
                            <code className="text-sm font-mono">{suggestion.best_match.target_field}</code>
                            <span className={`text-sm ${getConfidenceColor(suggestion.best_match.confidence)}`}>
                              {Math.round(suggestion.best_match.confidence * 100)}%
                            </span>
                          </div>
                        ) : (
                          <Badge variant="secondary">No match</Badge>
                        )}
                      </div>
                      {suggestion.matches.length > 1 && (
                        <div className="mt-2 pl-4 border-l-2 border-muted">
                          <p className="text-xs text-muted-foreground mb-1">Alternatives:</p>
                          {suggestion.matches.slice(1).map((alt, j) => (
                            <span key={j} className="text-xs mr-2">
                              {alt.target_field} ({Math.round(alt.confidence * 100)}%)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="unmapped" className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {matchResult.suggestions.unmapped_source.map((field, i) => (
                    <Badge key={i} variant="outline" className="bg-red-500/5">
                      <X className="h-3 w-3 mr-1" />
                      {field}
                    </Badge>
                  ))}
                </div>
                {matchResult.suggestions.unmapped_target.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Unmapped target fields:</p>
                    <div className="flex flex-wrap gap-2">
                      {matchResult.suggestions.unmapped_target.map((field, i) => (
                        <Badge key={i} variant="secondary">{field}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SchemaMatchPage;
