import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { DataTable, MetricCard, ModalForm, StatusBadge, EmptyState } from '../../components/common';
import { Progress } from '../../components/ui/progress';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import {
  Rocket,
  Search,
  Plus,
  Target,
  CheckCircle2,
  Clock,
  Trash2,
} from 'lucide-react';

const initiativeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  target_date: z.string().optional(),
});

const InitiativesPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: initiatives, isLoading } = useQuery({
    queryKey: ['initiatives'],
    queryFn: async () => {
      const response = await apiClient.get('/initiatives');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/initiatives', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['initiatives']);
      toast.success('Initiative created');
      setCreateOpen(false);
    },
    onError: () => {
      toast.error('Failed to create initiative');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`/initiatives/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['initiatives']);
      toast.success('Initiative deleted');
    },
    onError: () => {
      toast.error('Failed to delete initiative');
    },
  });

  const filteredInitiatives = (initiatives || []).filter((initiative) => {
    if (!search) return true;
    return initiative.name?.toLowerCase().includes(search.toLowerCase());
  });

  const activeCount = (initiatives || []).filter(i => i.status === 'active' || i.status === 'in_progress').length;
  const completedCount = (initiatives || []).filter(i => i.status === 'completed').length;

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    {
      key: 'progress',
      label: 'Progress',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-3 min-w-[120px]">
          <Progress value={value || 0} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground w-10">{value || 0}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (status) => <StatusBadge status={status}>{status?.replace(/_/g, ' ')}</StatusBadge>,
    },
    {
      key: 'target_date',
      label: 'Target Date',
      sortable: true,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    { key: 'owner_name', label: 'Owner', sortable: true },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(row.id);
            }}
            data-testid={`delete-initiative-${row.id}`}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  const formFields = [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter initiative name' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description' },
    { name: 'target_date', label: 'Target Date', type: 'date' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Initiatives</h1>
          <p className="text-muted-foreground text-sm mt-1">Track strategic sales initiatives</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-initiative-button">
          <Plus className="mr-2 h-4 w-4" />
          New Initiative
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          label="Total Initiatives"
          value={initiatives?.length || 0}
          icon={Rocket}
          loading={isLoading}
        />
        <MetricCard
          label="Active"
          value={activeCount}
          icon={Target}
          loading={isLoading}
        />
        <MetricCard
          label="Completed"
          value={completedCount}
          icon={CheckCircle2}
          loading={isLoading}
        />
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search initiatives..."
            className="pl-9"
            data-testid="initiative-search"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={tableColumns}
        data={filteredInitiatives}
        loading={isLoading}
        emptyTitle="No initiatives"
        emptyDescription="Create your first initiative to get started."
        emptyIcon={Rocket}
      />

      {/* Create Modal */}
      <ModalForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Initiative"
        fields={formFields}
        schema={initiativeSchema}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        submitLabel="Create"
      />
    </div>
  );
};

export default InitiativesPage;
