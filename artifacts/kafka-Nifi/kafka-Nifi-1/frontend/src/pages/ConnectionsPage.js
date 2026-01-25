import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
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
import { Database, Plus, RefreshCw, Plug, CheckCircle, AlertTriangle, XCircle, Trash2 } from 'lucide-react';

const HealthBadge = ({ health }) => {
  const configs = {
    healthy: { icon: CheckCircle, className: 'border-[hsl(var(--success))]/50 text-[hsl(var(--success))]', label: 'Healthy' },
    degraded: { icon: AlertTriangle, className: 'border-[hsl(var(--warning))]/50 text-[hsl(var(--warning))]', label: 'Degraded' },
    unhealthy: { icon: XCircle, className: 'border-[hsl(var(--danger))]/50 text-[hsl(var(--danger))]', label: 'Unhealthy' },
    unknown: { icon: Database, className: 'border-border/60 text-muted-foreground', label: 'Unknown' },
  };
  const config = configs[health] || configs.unknown;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <span className={`health-dot ${health} mr-1.5`} />
      {config.label}
    </Badge>
  );
};

const ConnectionsPage = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newConnection, setNewConnection] = useState({
    name: '',
    type: 'odoo',
    url: 'https://securadotest.odoo.com',
    database: 'securadotest',
    username: 'krishna@securado.net',
    api_key: 'a14e5c5c0a69504f6e28f648890767f0711a416d',
  });

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await connectionAPI.list();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => connectionAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Connection created!');
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create connection');
    },
  });

  const testMutation = useMutation({
    mutationFn: (id) => connectionAPI.test(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      if (response.data.status === 'success') {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    },
    onError: (error) => {
      toast.error('Connection test failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => connectionAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Connection deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete connection');
    },
  });

  const handleCreate = () => {
    if (!newConnection.name || !newConnection.url) {
      toast.error('Name and URL are required');
      return;
    }
    createMutation.mutate(newConnection);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground">Manage your data source connections</p>
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
              <DialogTitle>Add Odoo Connection</DialogTitle>
              <DialogDescription>Connect to your Odoo CRM instance</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="conn-name">Connection Name</Label>
                <Input
                  id="conn-name"
                  placeholder="My Odoo CRM"
                  value={newConnection.name}
                  onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                  data-testid="connection-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-url">Odoo URL</Label>
                <Input
                  id="conn-url"
                  placeholder="https://your-instance.odoo.com"
                  value={newConnection.url}
                  onChange={(e) => setNewConnection({ ...newConnection, url: e.target.value })}
                  data-testid="connection-url-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-db">Database Name</Label>
                <Input
                  id="conn-db"
                  placeholder="your_database"
                  value={newConnection.database}
                  onChange={(e) => setNewConnection({ ...newConnection, database: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-user">Username / Email</Label>
                <Input
                  id="conn-user"
                  placeholder="admin@company.com"
                  value={newConnection.username}
                  onChange={(e) => setNewConnection({ ...newConnection, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-key">API Key</Label>
                <Input
                  id="conn-key"
                  type="password"
                  placeholder="••••••••••••"
                  value={newConnection.api_key}
                  onChange={(e) => setNewConnection({ ...newConnection, api_key: e.target.value })}
                />
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
            <h3 className="font-semibold mb-2">No connections yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first Odoo connection to get started</p>
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
                <CardDescription className="capitalize">{conn.type} • {conn.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Database: {conn.database} • User: {conn.username}
                  </div>
                  {conn.odoo_version && (
                    <div className="text-xs text-muted-foreground">
                      Odoo Version: {conn.odoo_version}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-muted-foreground">
                      Last test: {conn.last_test ? new Date(conn.last_test).toLocaleString() : 'Never'}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(conn.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

export default ConnectionsPage;
