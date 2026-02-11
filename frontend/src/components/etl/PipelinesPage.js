import React, { useState, useEffect } from 'react';
import { etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Plus, GitMerge, Trash2, Play, RefreshCw, Workflow, Clock, CheckCircle, XCircle, Pencil,
  Calendar, Webhook, Settings, Copy, Eye, Pause, AlertTriangle, Database, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  idle: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  scheduled: 'bg-purple-100 text-purple-700',
};

const SCHEDULE_OPTIONS = [
  { value: 'manual', label: 'Manual Only', cron: null },
  { value: '5min', label: 'Every 5 minutes', cron: '*/5 * * * *' },
  { value: '15min', label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { value: '30min', label: 'Every 30 minutes', cron: '*/30 * * * *' },
  { value: 'hourly', label: 'Every hour', cron: '0 * * * *' },
  { value: '6hours', label: 'Every 6 hours', cron: '0 */6 * * *' },
  { value: 'daily', label: 'Daily (midnight)', cron: '0 0 * * *' },
  { value: 'weekly', label: 'Weekly (Sunday midnight)', cron: '0 0 * * 0' },
];

export function PipelinesPage() {
  const [pipelines, setPipelines] = useState([]);
  const [connections, setConnections] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [selectedMappings, setSelectedMappings] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  
  const [formData, setFormData] = useState({
    name: '',
    connection_id: '',
    mapping_ids: [], // Multiple mappings
    extract_limit: 1000,
    sync_mode: 'incremental',
    description: '',
    // Schedule
    schedule: 'manual',
    schedule_enabled: false,
    // Webhook
    webhook_enabled: false,
    webhook_secret: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pipelinesRes, connectionsRes, mappingsRes] = await Promise.all([
        etlAPI.listPipelines(),
        etlAPI.listConnections(),
        etlAPI.listMappings(),
      ]);
      setPipelines(pipelinesRes.data || []);
      setConnections(connectionsRes.data || []);
      setMappings(mappingsRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generateWebhookSecret = () => {
    const secret = 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setFormData({ ...formData, webhook_secret: secret });
  };

  const toggleMappingSelection = (mappingId) => {
    setSelectedMappings(prev => {
      if (prev.includes(mappingId)) {
        return prev.filter(id => id !== mappingId);
      }
      return [...prev, mappingId];
    });
  };

  const handleCreate = async () => {
    try {
      const pipelineData = {
        ...formData,
        mapping_ids: selectedMappings,
        // For backward compatibility, also set mapping_id to first selection
        mapping_id: selectedMappings[0],
        cron_expression: SCHEDULE_OPTIONS.find(s => s.value === formData.schedule)?.cron,
      };
      
      await etlAPI.createPipeline(pipelineData);
      toast.success('Pipeline created');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create pipeline');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      connection_id: '',
      mapping_ids: [],
      extract_limit: 1000,
      sync_mode: 'incremental',
      description: '',
      schedule: 'manual',
      schedule_enabled: false,
      webhook_enabled: false,
      webhook_secret: '',
    });
    setSelectedMappings([]);
    setActiveTab('basic');
  };

  const handleRun = async (id) => {
    setRunningId(id);
    try {
      const res = await etlAPI.runPipeline(id);
      toast.success(`Pipeline run started: ${res.data.id}`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to run pipeline');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this pipeline?')) return;
    try {
      await etlAPI.deletePipeline(id);
      toast.success('Pipeline deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete pipeline');
    }
  };

  const handleEditPipeline = (pipeline) => {
    // Pre-fill the form with pipeline data
    setFormData({
      name: pipeline.name || '',
      description: pipeline.description || '',
      connection_id: pipeline.connection_id || '',
      schedule_type: pipeline.schedule_type || 'manual',
      interval_minutes: pipeline.interval_minutes || 60,
      cron_expression: pipeline.cron_expression || '',
      sync_mode: pipeline.sync_mode || 'full',
      incremental_field: pipeline.incremental_field || 'write_date',
    });
    setSelectedMappings(pipeline.mappings || (pipeline.mapping_id ? [pipeline.mapping_id] : []));
    setEditingPipelineId(pipeline.id);
    setDialogOpen(true);
  };

  // Filter mappings by selected connection
  const filteredMappings = mappings.filter(m => 
    !formData.connection_id || m.connection_id === formData.connection_id
  );

  // Group mappings by source model for better display
  const groupedMappings = filteredMappings.reduce((acc, mapping) => {
    const key = mapping.source_model || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(mapping);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pipelines-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipelines</h1>
          <p className="text-muted-foreground">Create and run ETL pipelines with scheduling</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" data-testid="pipelines-new-button">
              <Plus className="h-4 w-4 mr-2" />
              New Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Create Pipeline</DialogTitle>
              <DialogDescription>
                Configure a pipeline to sync data from your connections
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">
                  <Settings className="h-4 w-4 mr-2" />
                  Basic
                </TabsTrigger>
                <TabsTrigger value="mappings">
                  <GitMerge className="h-4 w-4 mr-2" />
                  Mappings
                </TabsTrigger>
                <TabsTrigger value="schedule">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule & Webhook
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Pipeline Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Odoo Full Sync"
                      data-testid="pipeline-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Connection</Label>
                    <Select 
                      value={formData.connection_id} 
                      onValueChange={(v) => {
                        setFormData({ ...formData, connection_id: v });
                        setSelectedMappings([]); // Reset mapping selection when connection changes
                      }}
                    >
                      <SelectTrigger data-testid="pipeline-connection-select">
                        <SelectValue placeholder="Select connection" />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map((conn) => (
                          <SelectItem key={conn.id} value={conn.id}>
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4" />
                              {conn.name}
                              <Badge variant="outline" className="text-xs">{conn.type}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sync Mode</Label>
                    <Select value={formData.sync_mode} onValueChange={(v) => setFormData({ ...formData, sync_mode: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Sync (all records)</SelectItem>
                        <SelectItem value="incremental">Incremental (changed only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Extract Limit</Label>
                    <Input
                      type="number"
                      value={formData.extract_limit}
                      onChange={(e) => setFormData({ ...formData, extract_limit: parseInt(e.target.value) || 1000 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Sync CRM, Accounts, and Invoices from Odoo"
                  />
                </div>
              </TabsContent>

              <TabsContent value="mappings" className="mt-4">
                {!formData.connection_id ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Please select a connection first in the Basic tab
                    </AlertDescription>
                  </Alert>
                ) : filteredMappings.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No mappings found for this connection. Create mappings first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Select Mappings to Include ({selectedMappings.length} selected)</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMappings(filteredMappings.map(m => m.id))}
                        >
                          Select All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMappings([])}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    
                    <ScrollArea className="h-[300px] border rounded-md p-4">
                      <div className="space-y-4">
                        {Object.entries(groupedMappings).map(([sourceModel, modelMappings]) => (
                          <div key={sourceModel} className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                              <Database className="h-4 w-4" />
                              {sourceModel}
                              <Badge variant="outline" className="text-xs">{modelMappings.length}</Badge>
                            </div>
                            <div className="space-y-2 ml-6">
                              {modelMappings.map((mapping) => (
                                <div 
                                  key={mapping.id}
                                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                    selectedMappings.includes(mapping.id) 
                                      ? 'bg-primary/5 border-primary/30' 
                                      : 'hover:bg-muted'
                                  }`}
                                >
                                  <Checkbox
                                    checked={selectedMappings.includes(mapping.id)}
                                    onCheckedChange={() => toggleMappingSelection(mapping.id)}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{mapping.name}</span>
                                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                      <Badge variant="secondary">{mapping.target_entity}</Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {mapping.mappings?.length || 0} field mappings
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="schedule" className="mt-4 space-y-6">
                {/* Schedule Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Automatic Schedule
                        </CardTitle>
                        <CardDescription>Run this pipeline automatically on a schedule</CardDescription>
                      </div>
                      <Switch
                        checked={formData.schedule_enabled}
                        onCheckedChange={(v) => setFormData({ ...formData, schedule_enabled: v })}
                        data-testid="schedule-toggle"
                      />
                    </div>
                  </CardHeader>
                  {formData.schedule_enabled && (
                    <CardContent>
                      <div className="space-y-2">
                        <Label>Schedule Frequency</Label>
                        <Select value={formData.schedule} onValueChange={(v) => setFormData({ ...formData, schedule: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SCHEDULE_OPTIONS.filter(s => s.value !== 'manual').map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  {opt.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formData.schedule !== 'manual' && (
                          <p className="text-xs text-muted-foreground">
                            Cron: <code className="bg-muted px-1 rounded">{SCHEDULE_OPTIONS.find(s => s.value === formData.schedule)?.cron}</code>
                          </p>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Webhook Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Webhook className="h-4 w-4" />
                          Webhook Trigger
                        </CardTitle>
                        <CardDescription>Trigger this pipeline from Odoo webhooks</CardDescription>
                      </div>
                      <Switch
                        checked={formData.webhook_enabled}
                        onCheckedChange={(v) => {
                          setFormData({ ...formData, webhook_enabled: v });
                          if (v && !formData.webhook_secret) {
                            generateWebhookSecret();
                          }
                        }}
                        data-testid="webhook-toggle"
                      />
                    </div>
                  </CardHeader>
                  {formData.webhook_enabled && (
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Webhook Secret</Label>
                        <div className="flex gap-2">
                          <Input
                            value={formData.webhook_secret}
                            readOnly
                            className="font-mono text-sm"
                          />
                          <Button variant="outline" size="sm" onClick={generateWebhookSecret}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Alert>
                        <Webhook className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          <strong>Odoo Webhook Setup:</strong>
                          <ol className="list-decimal ml-4 mt-2 space-y-1">
                            <li>Go to Odoo → Settings → Technical → Automation → Automated Actions</li>
                            <li>Create a new action for the model you want to sync</li>
                            <li>Set trigger: "On Creation" and/or "On Update"</li>
                            <li>Action: Execute Python Code with HTTP POST to your webhook URL</li>
                            <li>Include the webhook secret in the X-Webhook-Secret header</li>
                          </ol>
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  )}
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter className="border-t pt-4 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleCreate}
                disabled={!formData.name || !formData.connection_id || selectedMappings.length === 0}
                className="bg-primary hover:bg-primary/90"
                data-testid="pipeline-create-button"
              >
                Create Pipeline ({selectedMappings.length} mappings)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pipelines</p>
                <p className="text-2xl font-bold">{pipelines.length}</p>
              </div>
              <Workflow className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold text-purple-600">
                  {pipelines.filter(p => p.schedule_enabled).length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful Runs</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {pipelines.reduce((sum, p) => sum + (p.success_count || 0), 0)}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed Runs</p>
                <p className="text-2xl font-bold text-red-600">
                  {pipelines.reduce((sum, p) => sum + (p.error_count || 0), 0)}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipelines Grid */}
      {pipelines.length === 0 ? (
        <Card className="p-8 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No pipelines yet</h3>
          <p className="text-muted-foreground mb-4">Create a pipeline to start syncing data from your connections</p>
          <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Create Pipeline
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id} data-testid={`pipeline-card-${pipeline.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{pipeline.description || 'No description'}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge className={statusColors[pipeline.status] || statusColors.idle}>
                      {pipeline.status}
                    </Badge>
                    {pipeline.schedule_enabled && (
                      <Badge variant="outline" className="text-purple-600 border-purple-200">
                        <Calendar className="h-3 w-3 mr-1" />
                        Scheduled
                      </Badge>
                    )}
                    {pipeline.webhook_enabled && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        <Webhook className="h-3 w-3 mr-1" />
                        Webhook
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <GitMerge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {pipeline.mapping_ids?.length || 1} mapping(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {pipeline.last_run ? new Date(pipeline.last_run).toLocaleString() : 'Never run'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span>{pipeline.success_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>{pipeline.error_count || 0}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditPipeline(pipeline)}
                      title="Edit Pipeline"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRun(pipeline.id)}
                      disabled={runningId === pipeline.id || pipeline.status === 'running'}
                      className="flex-1 bg-primary hover:bg-primary/90"
                    >
                      {runningId === pipeline.id ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Run Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(pipeline.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
