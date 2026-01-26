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
import { Plus, GitMerge, Trash2, Play, RefreshCw, Workflow, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  idle: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

export function PipelinesPage() {
  const [pipelines, setPipelines] = useState([]);
  const [connections, setConnections] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    connection_id: '',
    mapping_id: '',
    extract_limit: 500,
    sync_mode: 'full',
    description: '',
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
      setPipelines(pipelinesRes.data);
      setConnections(connectionsRes.data);
      setMappings(mappingsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await etlAPI.createPipeline(formData);
      toast.success('Pipeline created');
      setDialogOpen(false);
      setFormData({ name: '', connection_id: '', mapping_id: '', extract_limit: 500, sync_mode: 'full', description: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create pipeline');
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Pipelines</h1>
          <p className="text-gray-500">Create and run ETL pipelines</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="pipelines-new-button">
              <Plus className="h-4 w-4 mr-2" />
              New Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Pipeline</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="CRM Sync Pipeline"
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
              <div className="space-y-2">
                <Label>Mapping</Label>
                <Select value={formData.mapping_id} onValueChange={(v) => setFormData({ ...formData, mapping_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mapping" />
                  </SelectTrigger>
                  <SelectContent>
                    {mappings.map((map) => (
                      <SelectItem key={map.id} value={map.id}>{map.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Extract Limit</Label>
                <Input
                  type="number"
                  value={formData.extract_limit}
                  onChange={(e) => setFormData({ ...formData, extract_limit: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sync Mode</Label>
                <Select value={formData.sync_mode} onValueChange={(v) => setFormData({ ...formData, sync_mode: v })}>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {pipelines.length === 0 ? (
        <Card className="p-8 text-center">
          <Workflow className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pipelines yet</h3>
          <p className="text-gray-500 mb-4">Create a pipeline to start syncing data</p>
          <Button onClick={() => setDialogOpen(true)}>
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
                    <p className="text-sm text-gray-500 mt-1">{pipeline.description || 'No description'}</p>
                  </div>
                  <Badge className={statusColors[pipeline.status] || statusColors.idle}>
                    {pipeline.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <GitMerge className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {mappings.find(m => m.id === pipeline.mapping_id)?.name || 'Unknown mapping'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {pipeline.last_run ? new Date(pipeline.last_run).toLocaleString() : 'Never run'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {pipeline.run_count || 0} runs
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      onClick={() => handleRun(pipeline.id)}
                      disabled={runningId === pipeline.id || pipeline.status === 'running'}
                      className="flex-1"
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
