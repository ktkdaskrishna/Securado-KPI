import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schemaAPI, mappingAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { GitBranch, ArrowRight, Check, Plus } from 'lucide-react';

const AdminMappings = () => {
  const { currentTenant } = useOutletContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [mappings, setMappings] = useState([]);
  const [mappingName, setMappingName] = useState('');

  const { data: schemas = [], isLoading: schemasLoading } = useQuery({
    queryKey: ['schemas', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const res = await schemaAPI.list(currentTenant.id);
      return res.data;
    },
    enabled: !!currentTenant?.id,
  });

  const { data: existingMappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['mappings', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const res = await mappingAPI.list(currentTenant.id);
      return res.data;
    },
    enabled: !!currentTenant?.id,
  });

  const { data: canonicalModel } = useQuery({
    queryKey: ['canonical-model'],
    queryFn: async () => {
      const res = await mappingAPI.getCanonicalModel();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => mappingAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      toast.success('Mapping saved successfully!');
      setDialogOpen(false);
      setMappings([]);
      setMappingName('');
      setSelectedSchema(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to save mapping');
    },
  });

  const handleOpenMappingDialog = (schema) => {
    setSelectedSchema(schema);
    setMappingName(`${schema.connection_id}_mapping`);
    // Initialize mappings with empty target fields
    const initialMappings = (schema.objects || []).flatMap(obj => 
      obj.fields.map(field => ({
        source_object: obj.name,
        source_field: field,
        target_entity: '',
        target_field: '',
      }))
    );
    setMappings(initialMappings);
    setDialogOpen(true);
  };

  const handleMappingChange = (index, targetEntity, targetField) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], target_entity: targetEntity, target_field: targetField };
    setMappings(updated);
  };

  const handleSaveMapping = () => {
    if (!mappingName) {
      toast.error('Mapping name is required');
      return;
    }
    createMutation.mutate({
      name: mappingName,
      version: '1.0',
      source_schema_id: selectedSchema.id,
      mappings: mappings.filter(m => m.target_entity && m.target_field),
      tenant_id: currentTenant.id,
    });
  };

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a tenant first</p>
      </div>
    );
  }

  const isLoading = schemasLoading || mappingsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schema Mappings</h1>
        <p className="text-muted-foreground">Map source fields to canonical data model</p>
      </div>

      {/* Existing Mappings */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Saved Mappings</CardTitle>
          <CardDescription>Configured field mappings</CardDescription>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : existingMappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="table-empty-state">
              No mappings configured yet. Discover a schema and create mappings.
            </div>
          ) : (
            <div className="space-y-3" data-testid="mappings-list">
              {existingMappings.map((mapping) => (
                <div key={mapping.id} className="p-4 rounded-lg border border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-medium">{mapping.name}</div>
                        <div className="text-xs text-muted-foreground">Version {mapping.version} • {mapping.mappings?.length || 0} field mappings</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-[hsl(var(--success))]/50 text-[hsl(var(--success))]">
                      <Check className="h-3 w-3 mr-1" />
                      {mapping.status || 'active'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discovered Schemas */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Discovered Schemas</CardTitle>
          <CardDescription>Schemas available for mapping</CardDescription>
        </CardHeader>
        <CardContent>
          {schemasLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : schemas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="table-empty-state">
              No schemas discovered. Go to Connections and discover a schema first.
            </div>
          ) : (
            <div className="space-y-4" data-testid="schemas-list">
              {schemas.map((schema) => (
                <div key={schema.id} className="p-4 rounded-lg border border-border/60">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">Schema v{schema.version}</div>
                      <div className="text-xs text-muted-foreground">
                        Discovered: {new Date(schema.discovered_at).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenMappingDialog(schema)}
                      data-testid={`create-mapping-${schema.id}`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Mapping
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {schema.objects?.map((obj) => (
                      <Badge key={obj.name} variant="outline" className="border-border/60">
                        {obj.name} ({obj.fields?.length || 0} fields)
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mapping Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Create Field Mapping</DialogTitle>
            <DialogDescription>Map source fields to canonical data model fields</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mapping-name">Mapping Name</Label>
              <Input
                id="mapping-name"
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                data-testid="mapping-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Source Fields</h4>
                <ScrollArea className="h-[300px] border border-border/60 rounded-lg p-3">
                  <div className="space-y-2">
                    {mappings.map((m, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 rounded bg-muted/40 text-sm"
                        data-testid="schema-source-field"
                      >
                        <span className="text-muted-foreground">{m.source_object}.</span>
                        {m.source_field}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Target (Canonical Model)</h4>
                <ScrollArea className="h-[300px] border border-border/60 rounded-lg p-3">
                  <div className="space-y-2">
                    {canonicalModel?.entities?.map((entity) => (
                      <div key={entity.name} className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">{entity.name}</div>
                        {entity.fields?.map((field) => (
                          <div
                            key={field}
                            className="px-3 py-2 rounded border border-dashed border-border/70 text-sm cursor-pointer hover:border-primary/50 hover:bg-primary/5"
                            data-testid="schema-target-slot"
                          >
                            {field}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMapping} disabled={createMutation.isPending} data-testid="mapping-commit-button">
              {createMutation.isPending ? 'Saving...' : 'Save Mapping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMappings;
