import React, { useState, useEffect } from 'react';
import { etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, GitMerge, Trash2, ArrowRight, Eye } from 'lucide-react';
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
];

export function MappingsPage() {
  const [mappings, setMappings] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const handleCreate = async () => {
    try {
      await etlAPI.createMapping(formData);
      toast.success('Mapping created');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create mapping');
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
  };

  const addMappingRule = () => {
    setFormData({
      ...formData,
      mappings: [...formData.mappings, { source_field: '', target_field: '', transform: 'direct' }],
    });
  };

  const removeMappingRule = (index) => {
    setFormData({
      ...formData,
      mappings: formData.mappings.filter((_, i) => i !== index),
    });
  };

  const updateMappingRule = (index, field, value) => {
    const newMappings = [...formData.mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setFormData({ ...formData, mappings: newMappings });
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Mappings</h1>
          <p className="text-gray-500">Define field transformations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="mappings-new-button">
              <Plus className="h-4 w-4 mr-2" />
              New Mapping
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Mapping</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Opportunity Mapping"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Connection</Label>
                  <Select value={formData.connection_id} onValueChange={(v) => setFormData({ ...formData, connection_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>{conn.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Model</Label>
                  <Input
                    value={formData.source_model}
                    onChange={(e) => setFormData({ ...formData, source_model: e.target.value })}
                    placeholder="crm.lead"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Entity</Label>
                  <Select value={formData.target_entity} onValueChange={(v) => setFormData({ ...formData, target_entity: v })}>
                    <SelectTrigger>
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Field Mappings</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMappingRule}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Field
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.mappings.map((rule, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <Input
                        placeholder="source_field"
                        value={rule.source_field}
                        onChange={(e) => updateMappingRule(index, 'source_field', e.target.value)}
                        className="flex-1"
                      />
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="target_field"
                        value={rule.target_field}
                        onChange={(e) => updateMappingRule(index, 'target_field', e.target.value)}
                        className="flex-1"
                      />
                      <Select value={rule.transform} onValueChange={(v) => updateMappingRule(index, 'transform', v)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSFORMS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.mappings.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMappingRule(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} data-testid="mappings-save-button">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No mappings yet. Create one to define field transformations.
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <GitMerge className="h-4 w-4 text-gray-400" />
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(mapping.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
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
