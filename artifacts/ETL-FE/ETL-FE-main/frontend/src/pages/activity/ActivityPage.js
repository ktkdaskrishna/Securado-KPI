import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { DataTable, StatusBadge, MetricCard, ModalForm, EmptyState } from '../../components/common';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner';
import {
  Activity,
  Search,
  Plus,
  Calendar,
  User,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Phone,
  Mail,
  MessageSquare,
  Video,
} from 'lucide-react';

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Video },
  { value: 'task', label: 'Task', icon: CheckCircle2 },
  { value: 'note', label: 'Note', icon: MessageSquare },
];

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const activitySchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  type: z.string().min(1, 'Type is required'),
  description: z.string().optional(),
  due_date: z.string().optional(),
  opportunity_id: z.string().optional(),
});

const ActivityPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const response = await apiClient.get('/activities');
      return response.data;
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['activities-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/activities/stats');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Platform 2 uses activity_type instead of type
      const payload = {
        ...data,
        activity_type: data.type,
      };
      const response = await apiClient.post('/activities', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['activities']);
      queryClient.invalidateQueries(['activities-stats']);
      toast.success('Activity created');
      setCreateOpen(false);
    },
    onError: () => {
      toast.error('Failed to create activity');
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.patch(`/activities/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['activities']);
      queryClient.invalidateQueries(['activities-stats']);
      toast.success('Activity marked as completed');
    },
    onError: () => {
      toast.error('Failed to update activity');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      await apiClient.patch(`/activities/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['activities']);
      queryClient.invalidateQueries(['activities-stats']);
      toast.success('Status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const filteredActivities = (activities || []).filter((activity) => {
    const matchesSearch = !search ||
      activity.subject?.toLowerCase().includes(search.toLowerCase()) ||
      activity.description?.toLowerCase().includes(search.toLowerCase());
    // Handle both 'type' and 'activity_type' field names (Platform 2 uses activity_type)
    const actType = activity.type || activity.activity_type;
    const matchesType = typeFilter === 'all' || actType === typeFilter;
    const matchesStatus = statusFilter === 'all' || activity.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeIcon = (type) => {
    const activityType = ACTIVITY_TYPES.find((t) => t.value === type);
    const Icon = activityType?.icon || Activity;
    return <Icon size={14} />;
  };

  const tableColumns = [
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (type, row) => {
        const actType = type || row.activity_type;
        return (
          <div className="flex items-center gap-2">
            {getTypeIcon(actType)}
            <span className="capitalize">{actType}</span>
          </div>
        );
      },
    },
    { key: 'subject', label: 'Subject', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (status) => <StatusBadge status={status}>{status?.replace(/_/g, ' ')}</StatusBadge>,
    },
    {
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    { key: 'owner_name', label: 'Owner', sortable: true },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.status !== 'completed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                completeMutation.mutate(row.id);
              }}
              data-testid={`complete-activity-${row.id}`}
            >
              <CheckCircle2 size={14} className="mr-1" />
              Complete
            </Button>
          )}
        </div>
      ),
    },
  ];

  const formFields = [
    { name: 'subject', label: 'Subject', type: 'text', required: true, placeholder: 'Enter subject' },
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      required: true,
      options: ACTIVITY_TYPES.map((t) => ({ value: t.value, label: t.label })),
    },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description' },
    { name: 'due_date', label: 'Due Date', type: 'date' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Activity Timeline</h1>
          <p className="text-muted-foreground text-sm mt-1">Track all your sales activities</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-activity-button">
          <Plus className="mr-2 h-4 w-4" />
          New Activity
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Activities"
          value={stats?.total || 0}
          icon={Activity}
          loading={statsLoading}
        />
        <MetricCard
          label="Completed"
          value={stats?.completed || 0}
          icon={CheckCircle2}
          loading={statsLoading}
        />
        <MetricCard
          label="Pending"
          value={stats?.pending || 0}
          icon={Clock}
          loading={statsLoading}
        />
        <MetricCard
          label="Overdue"
          value={stats?.overdue || 0}
          icon={XCircle}
          loading={statsLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities..."
            className="pl-9 w-64"
            data-testid="activity-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36" data-testid="type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ACTIVITY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={tableColumns}
        data={filteredActivities}
        loading={isLoading}
        emptyTitle="No activities"
        emptyDescription="Create your first activity to get started."
        emptyIcon={Activity}
      />

      {/* Create Modal */}
      <ModalForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Activity"
        fields={formFields}
        schema={activitySchema}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        submitLabel="Create"
      />
    </div>
  );
};

export default ActivityPage;
