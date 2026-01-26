import React, { useState, useEffect } from 'react';
import { etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Plus, GitMerge, Trash2, ArrowRight, Eye, Wand2, CheckCircle, AlertCircle, XCircle, RefreshCw, Shield } from 'lucide-react';
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

  const handleAutoSuggest = async () => {
    if (!formData.connection_id || !formData.source_model) {
      toast.error('Please select a connection and enter a source model first');
      return;
    }

    setAutoSuggesting(true);
    try {
      const res = await etlAPI.autoSuggestMappings(
        formData.connection_id,
        formData.source_model,
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
        
        setFormData({
          ...formData,
          target_entity: targetEntity,
          mappings: mappingRules
        });
        
        toast.success(`Auto-populated ${mappingRules.length} field mappings (${res.data.source || 'analyzed'})`);
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
    // Filter out confidence from mappings before sending
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
          <p className="text-gray-500">Define field transformations with auto-suggestions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="mappings-new-button">
              <Plus className="h-4 w-4 mr-2" />
              New Mapping
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Mapping</DialogTitle>
              <DialogDescription>
                Configure field mappings between source and target schema
              </DialogDescription>
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
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAutoSuggest}
                      disabled={autoSuggesting || !formData.connection_id || !formData.source_model}
                      data-testid="mappings-auto-suggest-button"
                    >
                      {autoSuggesting ? (
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
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {formData.mappings.map((rule, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded bg-gray-50">
                      <div className="flex-1">
                        <Input
                          placeholder="source_field"
                          value={rule.source_field}
                          onChange={(e) => updateMappingRule(index, 'source_field', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="flex-1">
                        <Input
                          placeholder="target_field"
                          value={rule.target_field}
                          onChange={(e) => updateMappingRule(index, 'target_field', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Select value={rule.transform} onValueChange={(v) => updateMappingRule(index, 'transform', v)}>
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSFORMS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {rule.confidence && (
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
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} data-testid="mappings-save-button">Create</Button>
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
                  <div className="p-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold">{verificationResult.summary.total_fields}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded">
                    <div className="text-lg font-bold text-emerald-600">{verificationResult.summary.valid}</div>
                    <div className="text-xs text-gray-500">Valid</div>
                  </div>
                  <div className="p-2 bg-amber-50 rounded">
                    <div className="text-lg font-bold text-amber-600">{verificationResult.summary.warnings}</div>
                    <div className="text-xs text-gray-500">Warnings</div>
                  </div>
                  <div className="p-2 bg-red-50 rounded">
                    <div className="text-lg font-bold text-red-600">{verificationResult.summary.errors}</div>
                    <div className="text-xs text-gray-500">Errors</div>
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
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setVerifyDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleVerifyMapping(mapping.id)}
                        title="Verify Schema"
                        data-testid={`mapping-verify-${mapping.id}`}
                      >
                        <Shield className="h-4 w-4 text-cyan-500" />
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
