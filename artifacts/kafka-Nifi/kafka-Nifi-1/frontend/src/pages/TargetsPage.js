import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Database, Plus, TestTube, Trash2, Settings, Server, Globe, RefreshCw, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

const TARGET_TYPES = [
  { id: 'mongodb', name: 'MongoDB', icon: Database, description: 'NoSQL document database', defaultPort: 27017 },
  { id: 'postgresql', name: 'PostgreSQL', icon: Database, description: 'Advanced relational database', defaultPort: 5432 },
  { id: 'mysql', name: 'MySQL', icon: Database, description: 'Popular relational database', defaultPort: 3306 },
  { id: 'api', name: 'REST API', icon: Globe, description: 'Push to external API endpoint', defaultPort: 443 },
];

const TargetsPage = () => {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testing, setTesting] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    type: 'postgresql',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    url: '',
    api_key: '',
    schema_name: 'public',
  });

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    try {
      const response = await api.targets.list();
      setTargets(response.data);
    } catch (error) {
      toast.error('Failed to load targets');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type) => {
    const typeConfig = TARGET_TYPES.find(t => t.id === type);
    setFormData({
      ...formData,
      type,
      port: typeConfig?.defaultPort || 5432
    });
  };

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }
    
    try {
      await api.targets.create(formData);
      toast.success('Target created!');
      setDialogOpen(false);
      setFormData({
        name: '',
        type: 'postgresql',
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: '',
        url: '',
        api_key: '',
        schema_name: 'public',
      });
      loadTargets();
    } catch (error) {
      toast.error('Failed to create target');
    }
  };

  const handleTest = async (targetId) => {
    setTesting(prev => ({ ...prev, [targetId]: true }));
    try {
      const response = await api.targets.test(targetId);
      if (response.data.status === 'healthy') {
        toast.success(`Connected! ${response.data.message}`);
      } else {
        toast.error(response.data.message);
      }
      loadTargets();
    } catch (error) {
      toast.error('Connection test failed');
    } finally {
      setTesting(prev => ({ ...prev, [targetId]: false }));
    }
  };

  const handleDelete = async (targetId) => {
    if (!confirm('Delete this target connection?')) return;
    try {
      await api.targets.delete(targetId);
      toast.success('Target deleted');
      loadTargets();
    } catch (error) {
      toast.error('Failed to delete target');
    }
  };

  const getHealthIcon = (health) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTypeIcon = (type) => {
    const config = TARGET_TYPES.find(t => t.id === type);
    const Icon = config?.icon || Database;
    return <Icon className="h-6 w-6" />;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="targets-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Target Connections</h1>
          <p className="text-muted-foreground">Configure where to send your transformed data</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-target-button">
              <Plus className="h-4 w-4 mr-2" />
              Add Target
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Target Connection</DialogTitle>
              <DialogDescription>Configure a database or API endpoint to receive pipeline data</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Target Type</Label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPES.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="target-name">Connection Name</Label>
                <Input
                  id="target-name"
                  placeholder="e.g., Production PostgreSQL"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              {formData.type !== 'api' ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="target-host">Host</Label>
                      <Input
                        id="target-host"
                        placeholder="localhost"
                        value={formData.host}
                        onChange={(e) => setFormData({...formData, host: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target-port">Port</Label>
                      <Input
                        id="target-port"
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({...formData, port: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="target-database">Database Name</Label>
                    <Input
                      id="target-database"
                      placeholder="my_database"
                      value={formData.database}
                      onChange={(e) => setFormData({...formData, database: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="target-username">Username</Label>
                      <Input
                        id="target-username"
                        placeholder="postgres"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target-password">Password</Label>
                      <Input
                        id="target-password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  {formData.type === 'postgresql' && (
                    <div className="space-y-2">
                      <Label htmlFor="target-schema">Schema</Label>
                      <Input
                        id="target-schema"
                        placeholder="public"
                        value={formData.schema_name}
                        onChange={(e) => setFormData({...formData, schema_name: e.target.value})}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="target-url">API URL</Label>
                    <Input
                      id="target-url"
                      placeholder="https://api.example.com/data"
                      value={formData.url}
                      onChange={(e) => setFormData({...formData, url: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target-apikey">API Key</Label>
                    <Input
                      id="target-apikey"
                      type="password"
                      placeholder="Bearer token or API key"
                      value={formData.api_key}
                      onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                    />
                  </div>
                </>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} data-testid="target-submit-button">Create Target</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {targets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No targets configured</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Add a target database to push your transformed data to external systems
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Target
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((target) => (
            <Card key={target.id} data-testid={`target-card-${target.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      {getTypeIcon(target.type)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{target.name}</CardTitle>
                      <CardDescription className="capitalize">{target.type}</CardDescription>
                    </div>
                  </div>
                  {getHealthIcon(target.health)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  {target.type !== 'api' ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Host:</span>
                        <span className="font-mono">{target.host}:{target.port}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Database:</span>
                        <span>{target.database}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">URL:</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">{target.url}</span>
                    </div>
                  )}
                  {target.version && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version:</span>
                      <span>{target.version}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Badge variant={target.health === 'healthy' ? 'default' : 'secondary'}>
                    {target.health || 'Unknown'}
                  </Badge>
                  {target.last_test && (
                    <span className="text-xs text-muted-foreground">
                      Tested: {new Date(target.last_test).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleTest(target.id)}
                    disabled={testing[target.id]}
                  >
                    {testing[target.id] ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(target.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TargetsPage;
