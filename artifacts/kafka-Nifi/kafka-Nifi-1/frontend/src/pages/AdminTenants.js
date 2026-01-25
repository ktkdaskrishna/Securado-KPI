import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantAPI, kpiAPI } from '../lib/api';
import { useAuth } from '../lib/auth-context';
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
import { Building2, Plus, Database, CheckCircle } from 'lucide-react';

const AdminTenants = () => {
  const queryClient = useQueryClient();
  const { selectTenant } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', domain: '' });

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await tenantAPI.list();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => tenantAPI.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant created successfully!');
      setDialogOpen(false);
      setNewTenant({ name: '', domain: '' });
      // Auto-select the new tenant
      selectTenant(response.data);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create tenant');
    },
  });

  const seedMutation = useMutation({
    mutationFn: (tenantId) => kpiAPI.seed(tenantId),
    onSuccess: () => {
      toast.success('Sample data seeded successfully!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to seed data');
    },
  });

  const handleCreate = () => {
    if (!newTenant.name) {
      toast.error('Tenant name is required');
      return;
    }
    createMutation.mutate(newTenant);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenant Management</h1>
          <p className="text-muted-foreground">Create and manage your organization's tenants</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-tenant-button">
              <Plus className="h-4 w-4 mr-2" />
              Create Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>Add a new tenant to your organization</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Tenant Name</Label>
                <Input
                  id="tenant-name"
                  placeholder="Acme Inc"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  data-testid="tenant-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-domain">Domain (optional)</Label>
                <Input
                  id="tenant-domain"
                  placeholder="acme.com"
                  value={newTenant.domain}
                  onChange={(e) => setNewTenant({ ...newTenant, domain: e.target.value })}
                  data-testid="tenant-domain-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="tenant-submit-button">
                {createMutation.isPending ? 'Creating...' : 'Create Tenant'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tenants Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <Card className="bg-card/80 border-border/60">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No tenants yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first tenant to get started</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Tenant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="tenants-grid">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="bg-card/80 border-border/60 hover:border-border transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{tenant.name}</CardTitle>
                  <Badge variant="outline" className="border-[hsl(var(--success))]/50 text-[hsl(var(--success))]">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {tenant.status || 'active'}
                  </Badge>
                </div>
                {tenant.domain && (
                  <CardDescription>{tenant.domain}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(tenant.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => seedMutation.mutate(tenant.id)}
                      disabled={seedMutation.isPending}
                      data-testid={`seed-tenant-${tenant.id}`}
                    >
                      <Database className="h-4 w-4 mr-1" />
                      {seedMutation.isPending ? 'Seeding...' : 'Seed Data'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectTenant(tenant)}
                      data-testid={`select-tenant-${tenant.id}`}
                    >
                      Select
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

export default AdminTenants;
