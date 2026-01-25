import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionAPI, schemaAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
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
  DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Database, Plus, RefreshCw, Plug, CheckCircle, AlertTriangle, XCircle, Search } from 'lucide-react';

const CONNECTION_TYPES = [
  { value: 'odoo', label: 'Odoo CRM', description: 'Connect to Odoo via XML-RPC' },
  { value: 'kafka', label: 'Apache Kafka', description: 'Event streaming platform' },
  { value: 'clickhouse', label: 'ClickHouse', description: 'OLAP analytics database' },
  { value: 'cube', label: 'Cube', description: 'Semantic layer for metrics' },
  { value: 'wso2', label: 'WSO2', description: 'API Gateway & Identity Server' },
];

const HealthBadge = ({ health }) => {
  const configs = {
    healthy: { icon: CheckCircle, className: 'border-[hsl(var(--success))]/50 text-[hsl(var(--success))]' },
    degraded: { icon: AlertTriangle, className: 'border-[hsl(var(--warning))]/50 text-[hsl(var(--warning))]' },
    unhealthy: { icon: XCircle, className: 'border-[hsl(var(--danger))]/50 text-[hsl(var(--danger))]' },
    unknown: { icon: Database, className: 'border-border/60 text-muted-foreground' },
  };
  const config = configs[health] || configs.unknown;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <span className={`health-dot ${health} mr-1.5`} />
      {health || 'unknown'}
    </Badge>
  );
};

const AdminConnections = () => {
  const { currentTenant } = useOutletContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newConnection, setNewConnection] = useState({
    name: '',
    type: 'odoo',
    config: { url: '', database: '', username: '', password: '' },
  });

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['connections', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const res = await connectionAPI.list(currentTenant.id);
      return res.data;
    },
    enabled: !!currentTenant?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => connectionAPI.create({ ...data, tenant_id: currentTenant.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Connection created successfully!');
      setDialogOpen(false);
      setNewConnection({ name: '', type: 'odoo', config: { url: '', database: '', username: '', password: '' } });
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create connection');
    },
  });

  const testMutation = useMutation({
    mutationFn: (id) => connectionAPI.test(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success(`Connection test: ${response.data.health}`);
    },
    onError: (error) => {
      toast.error('Connection test failed');
    },
  });

  const discoverMutation = useMutation({
    mutationFn: (connId) => schemaAPI.discover(connId),
    onSuccess: () => {
      toast.success('Schema discovered successfully!');
    },
    onError: (error) => {
      toast.error('Schema discovery failed');
    },
  });

  const handleCreate = () => {
    if (!newConnection.name || !newConnection.type) {
      toast.error('Name and type are required');
      return;
    }
    createMutation.mutate(newConnection);
  };

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a tenant first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground">Manage data source connections for {currentTenant.name}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-connection-button">
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Connection</DialogTitle>
              <DialogDescription>Configure a new data source connection</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="conn-name">Connection Name</Label>
                <Input
                  id="conn-name"
                  placeholder="My CRM Connection"
                  value={newConnection.name}
                  onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                  data-testid="connection-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Connection Type</Label>
                <Select
                  value={newConnection.type}
                  onValueChange={(value) => setNewConnection({ ...newConnection, type: value })}
                >
                  <SelectTrigger data-testid="connection-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONNECTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-url">URL / Host</Label>
                <Input
                  id="conn-url"
                  placeholder="https://your-instance.odoo.com"
                  value={newConnection.config.url}
                  onChange={(e) => setNewConnection({ ...newConnection, config: { ...newConnection.config, url: e.target.value } })}
                  data-testid="connection-url-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="conn-user">Username</Label>
                  <Input
                    id="conn-user"
                    placeholder="admin"
                    value={newConnection.config.username}
                    onChange={(e) => setNewConnection({ ...newConnection, config: { ...newConnection.config, username: e.target.value } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conn-pass">Password / API Key</Label>
                  <Input
                    id="conn-pass"
                    type="password"
                    placeholder="••••••••"
                    value={newConnection.config.password}
                    onChange={(e) => setNewConnection({ ...newConnection, config: { ...newConnection.config, password: e.target.value } })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="connection-submit-button">
                {createMutation.isPending ? 'Creating...' : 'Create Connection'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connections Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : connections.length === 0 ? (
        <Card className="bg-card/80 border-border/60">
          <CardContent className="py-12 text-center">
            <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No connections configured</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first data source connection</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="connections-grid">
          {connections.map((conn) => (
            <Card key={conn.id} className="bg-card/80 border-border/60 hover:border-border transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{conn.name}</CardTitle>
                  </div>
                  <HealthBadge health={conn.health} />
                </div>
                <CardDescription className="capitalize">{conn.type}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground truncate">
                    {conn.config?.url || 'No URL configured'}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Last check: {conn.last_check ? new Date(conn.last_check).toLocaleString() : 'Never'}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testMutation.mutate(conn.id)}
                        disabled={testMutation.isPending}
                        data-testid={`test-connection-${conn.id}`}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${testMutation.isPending ? 'animate-spin' : ''}`} />
                        Test
                      </Button>
                      {conn.type === 'odoo' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => discoverMutation.mutate(conn.id)}
                          disabled={discoverMutation.isPending}
                          data-testid={`discover-schema-${conn.id}`}
                        >
                          <Search className={`h-4 w-4 mr-1`} />
                          Discover
                        </Button>
                      )}
                    </div>
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

export default AdminConnections;
