import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { DataTable, MetricCard, ModalForm, EmptyState } from '../../components/common';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import {
  Users2,
  Search,
  Plus,
  UserPlus,
  Trash2,
  Edit,
} from 'lucide-react';

const teamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

const TeamsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await apiClient.get('/teams');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/teams', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['teams']);
      toast.success('Team created');
      setCreateOpen(false);
    },
    onError: () => {
      toast.error('Failed to create team');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['teams']);
      toast.success('Team deleted');
    },
    onError: () => {
      toast.error('Failed to delete team');
    },
  });

  const filteredTeams = (teams || []).filter((team) => {
    if (!search) return true;
    return team.name?.toLowerCase().includes(search.toLowerCase());
  });

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    {
      key: 'members_count',
      label: 'Members',
      sortable: true,
      render: (value) => value || 0,
    },
    { key: 'manager_name', label: 'Manager', sortable: true },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
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
            data-testid={`delete-team-${row.id}`}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  const formFields = [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter team name' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your sales teams</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-team-button">
          <Plus className="mr-2 h-4 w-4" />
          New Team
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          label="Total Teams"
          value={teams?.length || 0}
          icon={Users2}
          loading={isLoading}
        />
        <MetricCard
          label="Total Members"
          value={(teams || []).reduce((sum, t) => sum + (t.members_count || 0), 0)}
          icon={UserPlus}
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
            placeholder="Search teams..."
            className="pl-9"
            data-testid="team-search"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={tableColumns}
        data={filteredTeams}
        loading={isLoading}
        emptyTitle="No teams"
        emptyDescription="Create your first team to get started."
        emptyIcon={Users2}
      />

      {/* Create Modal */}
      <ModalForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Team"
        fields={formFields}
        schema={teamSchema}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        submitLabel="Create"
      />
    </div>
  );
};

export default TeamsPage;
