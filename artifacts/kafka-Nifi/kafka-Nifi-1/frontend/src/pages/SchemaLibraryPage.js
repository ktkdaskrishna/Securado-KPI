import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Library, Search, Plus, FileJson, Code, Upload, Download, Trash2, Check, X, Edit, Copy
} from 'lucide-react';
import { schemaLibraryAPI, targetTemplateAPI } from '../lib/api';

// Data types for field creation
const DATA_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'datetime', label: 'DateTime' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'phone', label: 'Phone' },
  { value: 'uuid', label: 'UUID' },
  { value: 'json', label: 'JSON' },
  { value: 'array', label: 'Array' },
  { value: 'currency', label: 'Currency' },
  { value: 'binary', label: 'Binary' },
];

const SchemaLibraryPage = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedSchema, setSelectedSchema] = useState(null);
  
  // Dialog states
  const [showDDLDialog, setShowDDLDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [schemaToDelete, setSchemaToDelete] = useState(null);
  
  // DDL state
  const [ddlTargetType, setDdlTargetType] = useState('postgresql');
  const [generatedDDL, setGeneratedDDL] = useState('');
  
  // Create schema form state
  const [newSchema, setNewSchema] = useState({
    name: '',
    display_name: '',
    version: '1.0',
    category: 'custom',
    description: '',
    fields: [{ name: '', display_name: '', data_type: 'string', required: false, primary_key: false, description: '' }]
  });
  
  // Import state
  const [importFormat, setImportFormat] = useState('json');
  const [importContent, setImportContent] = useState('');
  const [importName, setImportName] = useState('');

  // Fetch all schemas
  const { data: schemasData, isLoading: schemasLoading, refetch } = useQuery({
    queryKey: ['schema-library', categoryFilter, searchQuery],
    queryFn: async () => {
      const params = {};
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (searchQuery) params.search = searchQuery;
      const res = await schemaLibraryAPI.list(params);
      return res.data;
    },
  });

  // Fetch target types
  const { data: targetTypes } = useQuery({
    queryKey: ['target-types'],
    queryFn: async () => {
      const res = await targetTemplateAPI.getTargetTypes();
      return res.data.target_types;
    },
  });

  // Create schema mutation
  const createSchema = useMutation({
    mutationFn: async (schema) => {
      const res = await schemaLibraryAPI.create(schema);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Schema "${data.name}" created successfully`);
      resetCreateForm();
      // Close dialog with slight delay to ensure proper cleanup
      setTimeout(() => {
        setShowCreateDialog(false);
      }, 100);
      queryClient.invalidateQueries({ queryKey: ['schema-library'] });
    },
    onError: (error) => {
      toast.error('Failed to create schema: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Import schema mutation
  const importSchema = useMutation({
    mutationFn: async (data) => {
      const res = await schemaLibraryAPI.import(data);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Schema "${data.schema.name}" imported successfully`);
      setShowImportDialog(false);
      setImportContent('');
      setImportName('');
      queryClient.invalidateQueries({ queryKey: ['schema-library'] });
    },
    onError: (error) => {
      toast.error('Failed to import schema: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Delete schema mutation
  const deleteSchema = useMutation({
    mutationFn: async (id) => {
      const res = await schemaLibraryAPI.delete(id);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Schema deleted successfully');
      setShowDeleteDialog(false);
      setSchemaToDelete(null);
      if (selectedSchema?.id === schemaToDelete?.id) {
        setSelectedSchema(null);
      }
      queryClient.invalidateQueries({ queryKey: ['schema-library'] });
    },
    onError: (error) => {
      toast.error('Failed to delete schema: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Generate DDL mutation
  const generateDDL = useMutation({
    mutationFn: async ({ schemaId, targetType }) => {
      const res = await targetTemplateAPI.generateDDL(schemaId, targetType);
      return res.data;
    },
    onSuccess: (data) => {
      setGeneratedDDL(data.ddl);
    },
    onError: (error) => {
      toast.error('Failed to generate DDL: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Export schema mutation
  const exportSchema = useMutation({
    mutationFn: async ({ schemaId, format }) => {
      const res = await schemaLibraryAPI.export(schemaId, format);
      return res.data;
    },
    onSuccess: (data) => {
      // Download the file
      const blob = new Blob([data.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Schema exported successfully');
    },
    onError: (error) => {
      toast.error('Failed to export schema: ' + (error.response?.data?.detail || error.message));
    },
  });

  const schemas = schemasData?.schemas || [];

  const resetCreateForm = () => {
    setNewSchema({
      name: '',
      display_name: '',
      version: '1.0',
      category: 'custom',
      description: '',
      fields: [{ name: '', display_name: '', data_type: 'string', required: false, primary_key: false, description: '' }]
    });
  };

  const handleCreateSchema = () => {
    // Validate
    if (!newSchema.name.trim()) {
      toast.error('Schema name is required');
      return;
    }
    if (!newSchema.fields.some(f => f.name.trim())) {
      toast.error('At least one field with a name is required');
      return;
    }
    
    // Filter out empty fields
    const validFields = newSchema.fields.filter(f => f.name.trim());
    
    // Prepare payload - remove empty industry field
    const payload = { ...newSchema, fields: validFields };
    if (!payload.industry) {
      delete payload.industry;
    }
    
    createSchema.mutate(payload);
  };

  const handleImportSchema = () => {
    if (!importContent.trim()) {
      toast.error('Please provide schema content');
      return;
    }
    importSchema.mutate({
      format: importFormat,
      content: importContent,
      name: importName || undefined,
      category: 'custom'
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportContent(e.target.result);
      // Auto-detect format from extension
      if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        setImportFormat('yaml');
      } else {
        setImportFormat('json');
      }
    };
    reader.readAsText(file);
  };

  const addField = () => {
    setNewSchema({
      ...newSchema,
      fields: [...newSchema.fields, { name: '', display_name: '', data_type: 'string', required: false, primary_key: false, description: '' }]
    });
  };

  const removeField = (index) => {
    setNewSchema({
      ...newSchema,
      fields: newSchema.fields.filter((_, i) => i !== index)
    });
  };

  const updateField = (index, key, value) => {
    const updatedFields = [...newSchema.fields];
    updatedFields[index] = { ...updatedFields[index], [key]: value };
    setNewSchema({ ...newSchema, fields: updatedFields });
  };

  const handleGenerateDDL = () => {
    if (selectedSchema && ddlTargetType) {
      generateDDL.mutate({ schemaId: selectedSchema.id, targetType: ddlTargetType });
    }
  };

  const copyDDL = () => {
    navigator.clipboard.writeText(generatedDDL);
    toast.success('DDL copied to clipboard');
  };

  const downloadDDL = () => {
    const blob = new Blob([generatedDDL], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSchema?.name?.toLowerCase().replace(/\s+/g, '_')}_${ddlTargetType}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'canonical': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'industry': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'custom': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  const confirmDelete = (schema) => {
    setSchemaToDelete(schema);
    setShowDeleteDialog(true);
  };

  return (
    <div className="space-y-6" data-testid="schema-library-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" />
            Schema Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse, create, and manage data schemas for your pipelines
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)} className="gap-2" data-testid="import-schema-btn">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2" data-testid="create-schema-btn">
            <Plus className="h-4 w-4" />
            Create Schema
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search schemas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="schema-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48" data-testid="category-filter">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="canonical">Canonical</SelectItem>
                <SelectItem value="industry">Industry</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schema List */}
        <Card className="lg:col-span-1 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Schemas</CardTitle>
            <CardDescription>{schemas.length} schemas available</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {schemasLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : schemas.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileJson className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No schemas found</p>
                  <Button variant="link" onClick={() => setShowCreateDialog(true)} className="mt-2">
                    Create your first schema
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {schemas.map((schema) => (
                    <div
                      key={schema.id}
                      className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                        selectedSchema?.id === schema.id ? 'bg-muted/70' : ''
                      }`}
                      onClick={() => setSelectedSchema(schema)}
                      data-testid={`schema-item-${schema.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {schema.display_name || schema.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {schema.fields?.length || 0} fields · v{schema.version}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className={`text-xs ${getCategoryColor(schema.category)}`}>
                            {schema.category}
                          </Badge>
                          {schema.source === 'custom' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(schema);
                              }}
                              data-testid={`delete-schema-${schema.id}`}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {schema.industry && (
                        <Badge variant="secondary" className="mt-2 text-xs">
                          {schema.industry}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Schema Detail */}
        <Card className="lg:col-span-2 border-border/60">
          {selectedSchema ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedSchema.display_name || selectedSchema.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedSchema.description || 'No description'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportSchema.mutate({ schemaId: selectedSchema.id, format: 'json' })}
                      data-testid="export-schema-btn"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                    <Button
                      onClick={() => setShowDDLDialog(true)}
                      className="gap-2"
                      data-testid="generate-ddl-btn"
                    >
                      <Code className="h-4 w-4" />
                      Generate DDL
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className={getCategoryColor(selectedSchema.category)}>
                    {selectedSchema.category}
                  </Badge>
                  {selectedSchema.industry && (
                    <Badge variant="secondary">{selectedSchema.industry}</Badge>
                  )}
                  {selectedSchema.is_system && (
                    <Badge variant="outline">System</Badge>
                  )}
                  <Badge variant="outline">v{selectedSchema.version}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="fields">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="fields">Fields ({selectedSchema.fields?.length || 0})</TabsTrigger>
                    <TabsTrigger value="relationships">Relationships</TabsTrigger>
                    <TabsTrigger value="indexes">Indexes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="fields" className="mt-4">
                    <ScrollArea className="h-[350px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead className="hidden md:table-cell">Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedSchema.fields?.map((field) => (
                            <TableRow key={field.name}>
                              <TableCell className="font-mono text-sm">
                                {field.name}
                                {field.display_name && (
                                  <span className="block text-xs text-muted-foreground">
                                    {field.display_name}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {field.data_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {field.required && (
                                  <Check className="h-4 w-4 text-emerald-500" />
                                )}
                              </TableCell>
                              <TableCell>
                                {field.primary_key && (
                                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">PK</Badge>
                                )}
                                {field.is_foreign_key && (
                                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">FK</Badge>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                                {field.description}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="relationships" className="mt-4">
                    {selectedSchema.relationships?.length > 0 ? (
                      <ScrollArea className="h-[350px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Target Schema</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Local Field</TableHead>
                              <TableHead>Foreign Field</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedSchema.relationships?.map((rel) => (
                              <TableRow key={rel.name}>
                                <TableCell className="font-medium">{rel.name}</TableCell>
                                <TableCell>{rel.target_schema}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{rel.type}</Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{rel.local_field}</TableCell>
                                <TableCell className="font-mono text-sm">{rel.foreign_field}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        No relationships defined
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="indexes" className="mt-4">
                    {selectedSchema.indexes?.length > 0 ? (
                      <ScrollArea className="h-[350px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Fields</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Unique</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedSchema.indexes?.map((idx) => (
                              <TableRow key={idx.name}>
                                <TableCell className="font-medium">{idx.name}</TableCell>
                                <TableCell className="font-mono text-sm">
                                  {idx.fields?.join(', ')}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{idx.type}</Badge>
                                </TableCell>
                                <TableCell>
                                  {idx.unique && <Check className="h-4 w-4 text-emerald-500" />}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        No indexes defined
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[500px]">
              <div className="text-center text-muted-foreground">
                <FileJson className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a schema to view details</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Create Schema Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Schema</DialogTitle>
            <DialogDescription>
              Define a custom data schema for your pipelines
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schema-name">Schema Name *</Label>
                <Input
                  id="schema-name"
                  placeholder="e.g., CustomLead"
                  value={newSchema.name}
                  onChange={(e) => setNewSchema({ ...newSchema, name: e.target.value })}
                  data-testid="schema-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  placeholder="e.g., Custom Lead Schema"
                  value={newSchema.display_name}
                  onChange={(e) => setNewSchema({ ...newSchema, display_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  placeholder="1.0"
                  value={newSchema.version}
                  onChange={(e) => setNewSchema({ ...newSchema, version: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry (optional)</Label>
                <Select 
                  value={newSchema.industry || undefined} 
                  onValueChange={(v) => setNewSchema({ ...newSchema, industry: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saas">SaaS</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the purpose of this schema..."
                value={newSchema.description}
                onChange={(e) => setNewSchema({ ...newSchema, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Fields *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField} data-testid="add-field-btn">
                  <Plus className="h-4 w-4 mr-1" /> Add Field
                </Button>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {newSchema.fields.map((field, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-muted/30">
                    <div className="flex-1 grid grid-cols-6 gap-2">
                      <Input
                        placeholder="field_name"
                        value={field.name}
                        onChange={(e) => updateField(index, 'name', e.target.value)}
                        className="col-span-2"
                        data-testid={`field-name-${index}`}
                      />
                      <Select 
                        value={field.data_type} 
                        onValueChange={(v) => updateField(index, 'data_type', v)}
                      >
                        <SelectTrigger className="col-span-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATA_TYPES.map(dt => (
                            <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Description"
                        value={field.description}
                        onChange={(e) => updateField(index, 'description', e.target.value)}
                        className="col-span-2"
                      />
                      <div className="flex items-center gap-3 col-span-1">
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(index, 'required', e.target.checked)}
                            className="rounded"
                          />
                          Req
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={field.primary_key}
                            onChange={(e) => updateField(index, 'primary_key', e.target.checked)}
                            className="rounded"
                          />
                          PK
                        </label>
                      </div>
                    </div>
                    {newSchema.fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeField(index)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetCreateForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateSchema} disabled={createSchema.isPending} data-testid="save-schema-btn">
              {createSchema.isPending ? 'Creating...' : 'Create Schema'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Schema Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Schema</DialogTitle>
            <DialogDescription>
              Import a schema from JSON or YAML file
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label>Format</Label>
                <Select value={importFormat} onValueChange={setImportFormat}>
                  <SelectTrigger data-testid="import-format-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="yaml">YAML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label>Schema Name (optional override)</Label>
                <Input
                  placeholder="Leave empty to use name from file"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Upload File or Paste Content</Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="upload-file-btn"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Schema Content ({importFormat.toUpperCase()})</Label>
              <Textarea
                placeholder={importFormat === 'json' 
                  ? '{\n  "name": "MySchema",\n  "fields": [...]\n}'
                  : 'name: MySchema\nfields:\n  - name: id\n    data_type: uuid'
                }
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                data-testid="import-content-textarea"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setImportContent(''); }}>
              Cancel
            </Button>
            <Button onClick={handleImportSchema} disabled={importSchema.isPending} data-testid="import-schema-submit-btn">
              {importSchema.isPending ? 'Importing...' : 'Import Schema'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DDL Generation Dialog */}
      <Dialog open={showDDLDialog} onOpenChange={setShowDDLDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Generate DDL</DialogTitle>
            <DialogDescription>
              Generate CREATE TABLE statements for {selectedSchema?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-4">
              <Select value={ddlTargetType} onValueChange={setDdlTargetType}>
                <SelectTrigger className="w-48" data-testid="ddl-target-select">
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  {targetTypes?.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleGenerateDDL}
                disabled={generateDDL.isPending}
                data-testid="generate-btn"
              >
                {generateDDL.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>

            {generatedDDL && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Generated DDL</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyDDL} data-testid="copy-ddl-btn">
                      <Copy className="h-4 w-4 mr-1" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadDDL} data-testid="download-ddl-btn">
                      <Download className="h-4 w-4 mr-1" /> Download
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[300px] border rounded-md">
                  <pre className="p-4 text-sm font-mono bg-muted/30">
                    {generatedDDL}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDDLDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schema</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{schemaToDelete?.display_name || schemaToDelete?.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSchema.mutate(schemaToDelete?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-btn"
            >
              {deleteSchema.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchemaLibraryPage;
