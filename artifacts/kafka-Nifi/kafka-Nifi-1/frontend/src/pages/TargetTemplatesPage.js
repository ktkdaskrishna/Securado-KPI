import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
import { toast } from 'sonner';
import {
  FileCode, Plus, Database, Code, Download, Copy, Trash2, RefreshCw, Eye, Check, Sparkles
} from 'lucide-react';
import { schemaLibraryAPI, targetTemplateAPI } from '../lib/api';

const TargetTemplatesPage = () => {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [targetTypeFilter, setTargetTypeFilter] = useState('all');
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    schemaId: '',
    targetType: 'postgresql',
    tableName: '',
    schemaName: '',
  });
  const [showDDLPreview, setShowDDLPreview] = useState(false);
  const [ddlContent, setDdlContent] = useState('');

  // Fetch templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['target-templates', targetTypeFilter],
    queryFn: async () => {
      const params = {};
      if (targetTypeFilter !== 'all') params.target_type = targetTypeFilter;
      const res = await targetTemplateAPI.list(params);
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

  // Fetch schemas for the generator
  const { data: schemasData } = useQuery({
    queryKey: ['schemas-for-templates'],
    queryFn: async () => {
      const res = await schemaLibraryAPI.list({ include_builtin: true });
      return res.data;
    },
  });

  // Auto-generate template mutation
  const autoGenerate = useMutation({
    mutationFn: async (params) => {
      const res = await targetTemplateAPI.autoGenerate(
        params.schemaId,
        params.targetType,
        params.tableName || undefined,
        params.schemaName || undefined
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Template generated successfully');
      setDdlContent(data.ddl_preview);
      setShowDDLPreview(true);
      setShowGenerateDialog(false);
      queryClient.invalidateQueries({ queryKey: ['target-templates'] });
    },
    onError: (error) => {
      toast.error('Failed to generate template: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Get DDL for template
  const getDDL = useMutation({
    mutationFn: async (templateId) => {
      const res = await targetTemplateAPI.getDDL(templateId);
      return res.data;
    },
    onSuccess: (data) => {
      setDdlContent(data.ddl);
      setShowDDLPreview(true);
    },
    onError: (error) => {
      toast.error('Failed to get DDL: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: async (id) => {
      await targetTemplateAPI.delete(id);
    },
    onSuccess: () => {
      toast.success('Template deleted');
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['target-templates'] });
    },
    onError: (error) => {
      toast.error('Failed to delete template: ' + (error.response?.data?.detail || error.message));
    },
  });

  const templates = templatesData?.templates || [];
  const schemas = schemasData?.schemas || [];

  const handleGenerate = () => {
    if (!generateForm.schemaId || !generateForm.targetType) {
      toast.error('Please select a schema and target type');
      return;
    }
    autoGenerate.mutate(generateForm);
  };

  const copyDDL = () => {
    navigator.clipboard.writeText(ddlContent);
    toast.success('DDL copied to clipboard');
  };

  const downloadDDL = () => {
    const blob = new Blob([ddlContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate?.name?.toLowerCase().replace(/\s+/g, '_') || 'schema'}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTargetIcon = (type) => {
    return <Database className="h-4 w-4" />;
  };

  const getTargetColor = (type) => {
    switch (type) {
      case 'postgresql': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'mysql': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'mongodb': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'sqlserver': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'clickhouse': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'snowflake': return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6" data-testid="target-templates-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCode className="h-6 w-6 text-primary" />
            Target Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate DDL and manage target database templates
          </p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)} className="gap-2" data-testid="generate-template-btn">
          <Sparkles className="h-4 w-4" />
          Auto-Generate Template
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
              <SelectTrigger className="w-48" data-testid="target-type-filter">
                <SelectValue placeholder="Filter by target" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Targets</SelectItem>
                {targetTypes?.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <Card className="lg:col-span-1 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Templates</CardTitle>
            <CardDescription>{templates.length} templates created</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {templatesLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileCode className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No templates yet</p>
                  <p className="text-sm mt-1">Generate one from a schema</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                        selectedTemplate?.id === template.id ? 'bg-muted/70' : ''
                      }`}
                      data-testid={`template-item-${template.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {template.display_name || template.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Table: {template.table?.table_name || 'N/A'}
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${getTargetColor(template.target_type)}`}>
                          {template.target_type}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Template Detail */}
        <Card className="lg:col-span-2 border-border/60">
          {selectedTemplate ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedTemplate.display_name || selectedTemplate.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedTemplate.description || 'No description'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => getDDL.mutate(selectedTemplate.id)}
                      disabled={getDDL.isPending}
                      data-testid="view-ddl-btn"
                    >
                      <Code className="h-4 w-4 mr-1" />
                      View DDL
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteTemplate.mutate(selectedTemplate.id)}
                      disabled={deleteTemplate.isPending}
                      data-testid="delete-template-btn"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className={getTargetColor(selectedTemplate.target_type)}>
                    {selectedTemplate.target_type}
                  </Badge>
                  <Badge variant="outline">Schema: {selectedTemplate.schema_id}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h4 className="font-medium mb-3">Table Columns</h4>
                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Column Name</TableHead>
                        <TableHead>Native Type</TableHead>
                        <TableHead>Nullable</TableHead>
                        <TableHead>Keys</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTemplate.table?.columns?.map((col) => (
                        <TableRow key={col.name}>
                          <TableCell className="font-mono text-sm">{col.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {col.native_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {col.nullable ? (
                              <span className="text-muted-foreground">Yes</span>
                            ) : (
                              <span className="text-amber-600 font-medium">NOT NULL</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {col.primary_key && (
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 mr-1">PK</Badge>
                            )}
                            {col.unique && !col.primary_key && (
                              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">UQ</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[500px]">
              <div className="text-center text-muted-foreground">
                <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a template to view details</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Generate Template Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Auto-Generate Template</DialogTitle>
            <DialogDescription>
              Create a target template from a schema definition
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Source Schema *</label>
              <Select
                value={generateForm.schemaId}
                onValueChange={(v) => setGenerateForm({ ...generateForm, schemaId: v })}
              >
                <SelectTrigger className="mt-1" data-testid="source-schema-select">
                  <SelectValue placeholder="Select a schema" />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name || s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Target Database *</label>
              <Select
                value={generateForm.targetType}
                onValueChange={(v) => setGenerateForm({ ...generateForm, targetType: v })}
              >
                <SelectTrigger className="mt-1" data-testid="target-db-select">
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
            </div>

            <div>
              <label className="text-sm font-medium">Table Name (optional)</label>
              <Input
                placeholder="Auto-generated from schema name"
                value={generateForm.tableName}
                onChange={(e) => setGenerateForm({ ...generateForm, tableName: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Database Schema (optional)</label>
              <Input
                placeholder="e.g., public, dbo"
                value={generateForm.schemaName}
                onChange={(e) => setGenerateForm({ ...generateForm, schemaName: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={autoGenerate.isPending}
              data-testid="confirm-generate-btn"
            >
              {autoGenerate.isPending ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DDL Preview Dialog */}
      <Dialog open={showDDLPreview} onOpenChange={setShowDDLPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>DDL Preview</DialogTitle>
            <DialogDescription>
              Generated DDL for the selected template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={copyDDL} data-testid="copy-ddl-preview-btn">
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={downloadDDL} data-testid="download-ddl-preview-btn">
                <Download className="h-4 w-4 mr-1" /> Download
              </Button>
            </div>
            <ScrollArea className="h-[400px] border rounded-md">
              <pre className="p-4 text-sm font-mono bg-muted/30">
                {ddlContent}
              </pre>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDDLPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TargetTemplatesPage;
