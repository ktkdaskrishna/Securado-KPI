import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { DataTable, StatusBadge, MetricCard, ModalForm, EmptyState } from '../../components/common';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { toast } from 'sonner';
import {
  Target,
  Search,
  Plus,
  TrendingUp,
  CheckCircle2,
  Clock,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';

const goalSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  target_value: z.number().min(0, 'Target value must be positive'),
  target_date: z.string().optional(),
  type: z.string().optional(),
});

const progressSchema = z.object({
  current_value: z.number().min(0, 'Value must be positive'),
});

const formatCurrency = (value) => {
  if (!value) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value}`;
};

const GoalDetailDrawer = ({ goal, open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [editProgressOpen, setEditProgressOpen] = useState(false);

  const updateProgressMutation = useMutation({
    mutationFn: async (data) => {
      await apiClient.patch(`/goals/${goal.id}/progress`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['goals']);
      queryClient.invalidateQueries(['goals-stats']);
      toast.success('Progress updated');
      setEditProgressOpen(false);
    },
    onError: () => {
      toast.error('Failed to update progress');
    },
  });

  if (!goal) return null;

  const progress = goal.target_value > 0
    ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg" data-testid="goal-detail-drawer">
        <SheetHeader>
          <SheetTitle>{goal.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Current: {formatCurrency(goal.current_value)}</span>
              <span>Target: {formatCurrency(goal.target_value)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Status</div>
              <StatusBadge status={goal.status}>{goal.status?.replace(/_/g, ' ')}</StatusBadge>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Target Date</div>
              <div className="font-medium">
                {goal.target_date ? new Date(goal.target_date).toLocaleDateString() : 'Not set'}
              </div>
            </div>
          </div>

          {goal.description && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Description</div>
              <div className="text-sm text-muted-foreground">{goal.description}</div>
            </div>
          )}

          {goal.team_name && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Team</div>
              <div className="font-medium">{goal.team_name}</div>
            </div>
          )}

          {goal.owner_name && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Owner</div>
              <div className="font-medium">{goal.owner_name}</div>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <Button
              onClick={() => setEditProgressOpen(true)}
              className="w-full"
              data-testid="update-progress-button"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Update Progress
            </Button>
          </div>
        </div>

        <ModalForm
          open={editProgressOpen}
          onOpenChange={setEditProgressOpen}
          title="Update Progress"
          fields={[
            {
              name: 'current_value',
              label: 'Current Value',
              type: 'number',
              required: true,
              placeholder: 'Enter current value',
            },
          ]}
          schema={progressSchema}
          defaultValues={{ current_value: goal.current_value || 0 }}
          onSubmit={(data) => updateProgressMutation.mutate(data)}
          loading={updateProgressMutation.isPending}
          submitLabel="Update"
        />
      </SheetContent>
    </Sheet>
  );
};

const GoalsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const response = await apiClient.get('/goals');
      return response.data;
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['goals-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/goals/summary/stats');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/goals', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['goals']);
      queryClient.invalidateQueries(['goals-stats']);
      toast.success('Goal created');
      setCreateOpen(false);
    },
    onError: () => {
      toast.error('Failed to create goal');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['goals']);
      queryClient.invalidateQueries(['goals-stats']);
      toast.success('Goal deleted');
    },
    onError: () => {
      toast.error('Failed to delete goal');
    },
  });

  const handleSelectGoal = (goal) => {
    setSelectedGoal(goal);
    setDetailOpen(true);
  };

  const filteredGoals = (goals || []).filter((goal) => {
    if (!search) return true;
    return goal.name?.toLowerCase().includes(search.toLowerCase());
  });

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'current_value',
      label: 'Progress',
      sortable: true,
      render: (current, row) => {
        const progress = row.target_value > 0
          ? Math.min(100, Math.round((current / row.target_value) * 100))
          : 0;
        return (
          <div className="flex items-center gap-3 min-w-[150px]">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground w-10">{progress}%</span>
          </div>
        );
      },
    },
    {
      key: 'target_value',
      label: 'Target',
      sortable: true,
      render: (value) => formatCurrency(value),
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
            data-testid={`delete-goal-${row.id}`}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  const formFields = [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter goal name' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description' },
    { name: 'target_value', label: 'Target Value', type: 'number', required: true, placeholder: '0' },
    { name: 'target_date', label: 'Target Date', type: 'date' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your sales goals and targets</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-goal-button">
          <Plus className="mr-2 h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Goals"
          value={stats?.total || 0}
          icon={Target}
          loading={statsLoading}
        />
        <MetricCard
          label="On Track"
          value={stats?.on_track || 0}
          icon={TrendingUp}
          loading={statsLoading}
        />
        <MetricCard
          label="Completed"
          value={stats?.completed || 0}
          icon={CheckCircle2}
          loading={statsLoading}
        />
        <MetricCard
          label="At Risk"
          value={stats?.at_risk || 0}
          icon={Clock}
          loading={statsLoading}
        />
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search goals..."
            className="pl-9"
            data-testid="goal-search"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={tableColumns}
        data={filteredGoals}
        loading={isLoading}
        onRowClick={handleSelectGoal}
        emptyTitle="No goals"
        emptyDescription="Create your first goal to get started."
        emptyIcon={Target}
      />

      {/* Create Modal */}
      <ModalForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Goal"
        fields={formFields}
        schema={goalSchema}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        submitLabel="Create"
      />

      {/* Detail Drawer */}
      <GoalDetailDrawer
        goal={selectedGoal}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
};

export default GoalsPage;
