import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionAPI, mappingAPI } from '../lib/api';
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
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { GitBranch, Plus, ArrowRight, Check, Trash2 } from 'lucide-react';

const DEFAULT_MAPPINGS = [
  { source_field: 'id', target_field: 'opportunity_id', transform: 'to_string' },
  { source_field: 'name', target_field: 'name', transform: 'direct' },
  { source_field: 'expected_revenue', target_field: 'amount', transform: 'to_float' },
  { source_field: 'stage_id', target_field: 'stage', transform: 'name' },
  { source_field: 'probability', target_field: 'probability', transform: 'to_float' },
  { source_field: 'user_id', target_field: 'owner_name', transform: 'name' },
  { source_field: 'user_id', target_field: 'owner_user_id', transform: 'id' },
  { source_field: 'email_from', target_field: 'contact_email', transform: 'direct' },
  { source_field: 'phone', target_field: 'contact_phone', transform: 'direct' },
  { source_field: 'create_date', target_field: 'created_at', transform: 'direct' },
  { source_field: 'write_date', target_field: 'updated_at', transform: 'direct' },
  { source_field: 'date_closed', target_field: 'closed_at', transform: 'direct' },
];

const MappingsPage = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [newMapping, setNewMapping] = useState({
    name: 'CRM Lead to Opportunity',
    source_model: 'crm.lead',
    target_entity: 'opportunity',
    mappings: DEFAULT_MAPPINGS,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await connectionAPI.list();
      return res.data;
    },
  });

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['mappings'],
    queryFn: async () => {
      const res = await mappingAPI.list();
      return res.data;
    },
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
      toast.success('Mapping created!');
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create mapping');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => mappingAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      toast.success('Mapping deleted');
    },
  });

  const handleCreate = () => {
    if (!selectedConnection || !newMapping.name) {
      toast.error('Connection and name are required');
      return;
    }
    createMutation.mutate({
      ...newMapping,
      connection_id: selectedConnection,
    });
  };

  const updateMappingField = (index, field, value) => {
    const updated = [...newMapping.mappings];
    updated[index] = { ...updated[index], [field]: value };
    setNewMapping({ ...newMapping, mappings: updated });
  };

  const addMappingRow = () => {
    setNewMapping({
      ...newMapping,
      mappings: [...newMapping.mappings, { source_field: '', target_field: '', transform: 'direct' }],
    });
  };

  const removeMappingRow = (index) => {
    const updated = newMapping.mappings.filter((_, i) => i !== index);
    setNewMapping({ ...newMapping, mappings: updated });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Mappings</h1>
          <p className="text-muted-foreground">Map source fields to target schema</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-mapping-button">
              <Plus className="h-4 w-4 mr-2" />
              Create Mapping
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Create Field Mapping</DialogTitle>
              <DialogDescription>Map Odoo fields to the canonical data model</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Connection</Label>
                  <Select value={selectedConnection || ''} onValueChange={setSelectedConnection}>
                    <SelectTrigger data-testid="mapping-connection-select">
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mapping Name</Label>
                  <Input
                    value={newMapping.name}
                    onChange={(e) => setNewMapping({ ...newMapping, name: e.target.value })}
                    data-testid="mapping-name-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Model</Label>
                  <Input
                    value={newMapping.source_model}
                    onChange={(e) => setNewMapping({ ...newMapping, source_model: e.target.value })}
                    placeholder="crm.lead"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Entity</Label>
                  <Select
                    value={newMapping.target_entity}
                    onValueChange={(v) => setNewMapping({ ...newMapping, target_entity: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {canonicalModel?.entities?.map((entity) => (
                        <SelectItem key={entity.name} value={entity.name}>
                          {entity.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Mapping Rules */}
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <Label>Field Mappings</Label>
                  <Button variant="outline" size="sm" onClick={addMappingRow}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Row
                  </Button>
                </div>
                <ScrollArea className="h-[280px] border rounded-lg p-3">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto_1fr_100px_40px] gap-2 text-xs text-muted-foreground font-medium px-1">
                      <span>Source Field</span>
                      <span></span>
                      <span>Target Field</span>
                      <span>Transform</span>
                      <span></span>
                    </div>
                    {newMapping.mappings.map((rule, index) => (
                      <div key={index} className="grid grid-cols-[1fr_auto_1fr_100px_40px] gap-2 items-center" data-testid={`mapping-row-${index}`}>
                        <Input
                          value={rule.source_field}
                          onChange={(e) => updateMappingField(index, 'source_field', e.target.value)}
                          placeholder="source_field"
                          className="font-mono text-xs"
                        />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Input
                          value={rule.target_field}
                          onChange={(e) => updateMappingField(index, 'target_field', e.target.value)}
                          placeholder="target_field"
                          className="font-mono text-xs"
                        />
                        <Select
                          value={rule.transform}
                          onValueChange={(v) => updateMappingField(index, 'transform', v)}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="direct">Direct</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="id">ID</SelectItem>
                            <SelectItem value="to_float">To Float</SelectItem>
                            <SelectItem value="to_int">To Int</SelectItem>
                            <SelectItem value="to_bool">To Bool</SelectItem>
                            <SelectItem value="to_string">To String</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMappingRow(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="mapping-submit-button">
                {createMutation.isPending ? 'Creating...' : 'Create Mapping'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Mappings */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : mappings.length === 0 ? (
        <Card className="bg-card/80 border-border/60">
          <CardContent className="py-12 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No mappings yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first field mapping to transform data</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Mapping
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="mappings-list">
          {mappings.map((mapping) => (
            <Card key={mapping.id} className="bg-card/80 border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{mapping.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {mapping.source_model} → {mapping.target_entity}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-[hsl(var(--success))]/50 text-[hsl(var(--success))]">
                      <Check className="h-3 w-3 mr-1" />
                      v{mapping.version}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(mapping.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {mapping.mappings?.slice(0, 6).map((rule, i) => (
                    <Badge key={i} variant="outline" className="font-mono text-xs">
                      {rule.source_field} → {rule.target_field}
                    </Badge>
                  ))}
                  {mapping.mappings?.length > 6 && (
                    <Badge variant="outline" className="text-xs">
                      +{mapping.mappings.length - 6} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MappingsPage;
