import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Play, Plus, Trash2, Clock, CheckCircle, XCircle, Loader2, Calendar, Timer, Webhook, Settings, Server } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const configs = {
    idle: { icon: Clock, className: 'status-badge idle', label: 'Idle' },
    running: { icon: Loader2, className: 'status-badge running', label: 'Running', spin: true },
    completed: { icon: CheckCircle, className: 'status-badge completed', label: 'Completed' },
    failed: { icon: XCircle, className: 'status-badge failed', label: 'Failed' },
  };
  const config = configs[status] || configs.idle;
  const Icon = config.icon;

  return (
    <span className={config.className}>
      <Icon className={`h-3 w-3 ${config.spin ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
};

const PipelinesPage = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPipeline, setNewPipeline] = useState({
    name: 'Odoo CRM Sync',
    connection_id: '',
    mapping_id: '',
    extract_limit: 500,
    target_id: '',
    target_table: 'silver_opportunities',
    schedule_enabled: false,
    schedule_type: 'manual',
    interval_minutes: 60,
    cron_expression: '0 * * * *',
    webhook_enabled: false,
    sync_mode: 'full',
    delete_mode: 'soft',
  });

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const res = await api.pipelines.list();
      return res.data;
    },
    refetchInterval: 5000,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.connections.list();
      return res.data;
    },
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ['mappings'],
    queryFn: async () => {
      const res = await api.mappings.list();
      return res.data;
    },
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['targets'],
    queryFn: async () => {
      const res = await api.targets.list();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.pipelines.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline created!');
      setDialogOpen(false);
      setNewPipeline({
        name: 'Odoo CRM Sync',
        connection_id: '',
        mapping_id: '',
        extract_limit: 500,
        target_id: '',
        target_table: 'silver_opportunities',
        schedule_enabled: false,
        schedule_type: 'manual',
        interval_minutes: 60,
        cron_expression: '0 * * * *',
        webhook_enabled: false,
        sync_mode: 'full',
        delete_mode: 'soft',
      });
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create pipeline');
    },
  });

  const runMutation = useMutation({
    mutationFn: (id) => api.pipelines.run(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
      toast.success('Pipeline started!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to start pipeline');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.pipelines.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline deleted');
    },
  });

  const handleCreate = () => {
    if (!newPipeline.name || !newPipeline.connection_id || !newPipeline.mapping_id) {
      toast.error('Name, connection, and mapping are required');
      return;
    }
    createMutation.mutate(newPipeline);
  };

  const getConnectionName = (id) => connections.find(c => c.id === id)?.name || 'Unknown';
  const getMappingName = (id) => mappings.find(m => m.id === id)?.name || 'Unknown';
  const getTargetName = (id) => targets.find(t => t.id === id)?.name || 'MongoDB (Default)';

  return (
    <div className="space-y-6" data-testid="pipelines-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground">Manage and run data pipelines</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-pipeline-button">
              <Plus className="h-4 w-4 mr-2" />
              Create Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Pipeline</DialogTitle>
              <DialogDescription>Set up a new ETL pipeline with scheduling and target configuration</DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="target">Target</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Pipeline Name</Label>
                  <Input
                    value={newPipeline.name}
                    onChange={(e) => setNewPipeline({ ...newPipeline, name: e.target.value })}
                    data-testid="pipeline-name-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source Connection</Label>
                    <Select
                      value={newPipeline.connection_id}
                      onValueChange={(v) => setNewPipeline({ ...newPipeline, connection_id: v })}
                    >
                      <SelectTrigger data-testid="pipeline-connection-select">
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
                    <Label>Mapping</Label>
                    <Select
                      value={newPipeline.mapping_id}
                      onValueChange={(v) => setNewPipeline({ ...newPipeline, mapping_id: v })}
                    >
                      <SelectTrigger data-testid="pipeline-mapping-select">
                        <SelectValue placeholder="Select mapping" />
                      </SelectTrigger>
                      <SelectContent>
                        {mappings.map((mapping) => (
                          <SelectItem key={mapping.id} value={mapping.id}>
                            {mapping.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Extract Limit</Label>
                    <Input
                      type="number"
                      value={newPipeline.extract_limit}
                      onChange={(e) => setNewPipeline({ ...newPipeline, extract_limit: parseInt(e.target.value) || 500 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sync Mode</Label>
                    <Select
                      value={newPipeline.sync_mode}
                      onValueChange={(v) => setNewPipeline({ ...newPipeline, sync_mode: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Sync</SelectItem>
                        <SelectItem value="incremental">Incremental</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="schedule" className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Enable Scheduling</p>
                      <p className="text-sm text-muted-foreground">Run pipeline automatically</p>
                    </div>
                  </div>
                  <Switch
                    checked={newPipeline.schedule_enabled}
                    onCheckedChange={(v) => setNewPipeline({ ...newPipeline, schedule_enabled: v })}
                  />
                </div>
                
                {newPipeline.schedule_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Schedule Type</Label>
                      <Select
                        value={newPipeline.schedule_type}
                        onValueChange={(v) => setNewPipeline({ ...newPipeline, schedule_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interval">
                            <div className="flex items-center gap-2">
                              <Timer className="h-4 w-4" />
                              Interval
                            </div>
                          </SelectItem>
                          <SelectItem value="cron">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Cron Expression
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {newPipeline.schedule_type === 'interval' ? (
                      <div className="space-y-2">
                        <Label>Run every (minutes)</Label>
                        <Input
                          type="number"
                          min={5}
                          value={newPipeline.interval_minutes}
                          onChange={(e) => setNewPipeline({ ...newPipeline, interval_minutes: parseInt(e.target.value) || 60 })}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Cron Expression</Label>
                        <Input
                          value={newPipeline.cron_expression}
                          onChange={(e) => setNewPipeline({ ...newPipeline, cron_expression: e.target.value })}
                          placeholder="0 * * * *"
                        />
                        <p className="text-xs text-muted-foreground">
                          Examples: "0 * * * *" (hourly), "0 0 * * *" (daily), "0 0 * * 0" (weekly)
                        </p>
                      </div>
                    )}
                  </>
                )}
                
                <div className="flex items-center justify-between p-4 border rounded-lg mt-4">
                  <div className="flex items-center gap-3">
                    <Webhook className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Webhook Trigger</p>
                      <p className="text-sm text-muted-foreground">Run on Odoo record changes</p>
                    </div>
                  </div>
                  <Switch
                    checked={newPipeline.webhook_enabled}
                    onCheckedChange={(v) => setNewPipeline({ ...newPipeline, webhook_enabled: v })}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="target" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Target Database</Label>
                  <Select
                    value={newPipeline.target_id || 'default'}
                    onValueChange={(v) => setNewPipeline({ ...newPipeline, target_id: v === 'default' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="MongoDB (Default)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">MongoDB (Default)</SelectItem>
                      {targets.map((target) => (
                        <SelectItem key={target.id} value={target.id}>
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            {target.name} ({target.type})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Data will always be stored in MongoDB. Select an additional target to sync data externally.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Target Table Name</Label>
                  <Input
                    value={newPipeline.target_table}
                    onChange={(e) => setNewPipeline({ ...newPipeline, target_table: e.target.value })}
                    placeholder="opportunities"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Delete Mode</Label>
                  <Select
                    value={newPipeline.delete_mode}
                    onValueChange={(v) => setNewPipeline({ ...newPipeline, delete_mode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soft">Soft Delete (Mark as deleted)</SelectItem>
                      <SelectItem value="hard">Hard Delete (Remove permanently)</SelectItem>
                      <SelectItem value="ignore">Ignore Deletes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="pipeline-submit-button">
                {createMutation.isPending ? 'Creating...' : 'Create Pipeline'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipelines List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <Card className="bg-card/80 border-border/60">
          <CardContent className="py-12 text-center">
            <Play className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No pipelines yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a pipeline to start syncing data</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Pipeline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="pipelines-list">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id} className={`bg-card/80 border-border/60 ${pipeline.status === 'running' ? 'running-indicator' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Play className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {pipeline.name}
                        {pipeline.schedule_enabled && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {pipeline.schedule_type === 'cron' ? pipeline.cron_expression : `Every ${pipeline.interval_minutes}m`}
                          </Badge>
                        )}
                        {pipeline.webhook_enabled && (
                          <Badge variant="outline" className="text-xs">
                            <Webhook className="h-3 w-3 mr-1" />
                            Webhook
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {getConnectionName(pipeline.connection_id)} → {getMappingName(pipeline.mapping_id)}
                        {pipeline.target_id && ` → ${getTargetName(pipeline.target_id)}`}
                      </CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={pipeline.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground space-x-4">
                    <span>Runs: {pipeline.run_count || 0}</span>
                    {pipeline.last_run && (
                      <span>Last: {new Date(pipeline.last_run).toLocaleString()}</span>
                    )}
                    {pipeline.next_run && (
                      <span className="text-cyan-500">Next: {new Date(pipeline.next_run).toLocaleString()}</span>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {pipeline.sync_mode || 'full'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => runMutation.mutate(pipeline.id)}
                      disabled={pipeline.status === 'running' || runMutation.isPending}
                      data-testid={`run-pipeline-${pipeline.id}`}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      {pipeline.status === 'running' ? 'Running...' : 'Run Now'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(pipeline.id)}
                      disabled={pipeline.status === 'running'}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
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
};

export default PipelinesPage;
