import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ModalForm, StatusBadge, EmptyState } from '../../components/common';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from 'sonner';
import {
  BarChart3,
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Edit,
} from 'lucide-react';

const kpiSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  target_value: z.number().min(0, 'Target value must be positive'),
  unit: z.string().optional(),
});

const formatValue = (value, unit) => {
  if (value === null || value === undefined) return '-';
  if (unit === 'currency') {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value}`;
  }
  if (unit === 'percent' || unit === '%') return `${value}%`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value;
};

const KPICard = ({ kpi, onEdit, onDelete }) => {
  const progress = kpi.target_value > 0
    ? Math.min(100, Math.round((kpi.current_value / kpi.target_value) * 100))
    : 0;
  const delta = kpi.change || 0;

  const getTrendIcon = () => {
    if (delta === 0) return <Minus size={14} />;
    return delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />;
  };

  const getTrendColor = () => {
    if (delta === 0) return 'text-muted-foreground';
    return delta > 0 ? 'text-[hsl(var(--chart-2))]' : 'text-destructive';
  };

  return (
    <Card className="transition-shadow duration-200 hover:shadow-[0_10px_24px_rgba(0,0,0,0.35)]" data-testid="kpi-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpi.name}
            </CardTitle>
            <div className="text-2xl font-bold mt-1">
              {formatValue(kpi.current_value, kpi.unit)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(kpi)}
              data-testid={`edit-kpi-${kpi.id}`}
            >
              <Edit size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDelete(kpi.id)}
              data-testid={`delete-kpi-${kpi.id}`}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Target: {formatValue(kpi.target_value, kpi.unit)}
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {delta !== 0 && (
            <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{delta > 0 ? '+' : ''}{delta}% vs last period</span>
            </div>
          )}
        </div>
        {kpi.description && (
          <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
            {kpi.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const KPIsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editKpi, setEditKpi] = useState(null);

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: async () => {
      const response = await apiClient.get('/kpis');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/kpis', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['kpis']);
      toast.success('KPI created');
      setCreateOpen(false);
    },
    onError: () => {
      toast.error('Failed to create KPI');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put(`/kpis/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['kpis']);
      toast.success('KPI updated');
      setEditKpi(null);
    },
    onError: () => {
      toast.error('Failed to update KPI');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`/kpis/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['kpis']);
      toast.success('KPI deleted');
    },
    onError: () => {
      toast.error('Failed to delete KPI');
    },
  });

  const handleEdit = (kpi) => {
    setEditKpi(kpi);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const filteredKpis = (kpis || []).filter((kpi) => {
    if (!search) return true;
    return kpi.name?.toLowerCase().includes(search.toLowerCase());
  });

  const formFields = [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter KPI name' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description' },
    { name: 'target_value', label: 'Target Value', type: 'number', required: true, placeholder: '0' },
    {
      name: 'unit',
      label: 'Unit',
      type: 'select',
      options: [
        { value: 'number', label: 'Number' },
        { value: 'currency', label: 'Currency ($)' },
        { value: 'percent', label: 'Percentage (%)' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">KPIs</h1>
          <p className="text-muted-foreground text-sm mt-1">Track key performance indicators</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-kpi-button">
          <Plus className="mr-2 h-4 w-4" />
          New KPI
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search KPIs..."
            className="pl-9"
            data-testid="kpi-search"
          />
        </div>
      </div>

      {/* KPI Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32 mb-4" />
                <Skeleton className="h-2 w-full mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredKpis.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredKpis.map((kpi) => (
            <KPICard
              key={kpi.id}
              kpi={kpi}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No KPIs"
          description="Create your first KPI to start tracking performance."
          action={() => setCreateOpen(true)}
          actionLabel="Create KPI"
        />
      )}

      {/* Create Modal */}
      <ModalForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create KPI"
        fields={formFields}
        schema={kpiSchema}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        submitLabel="Create"
      />

      {/* Edit Modal */}
      <ModalForm
        open={!!editKpi}
        onOpenChange={() => setEditKpi(null)}
        title="Edit KPI"
        fields={formFields}
        schema={kpiSchema}
        defaultValues={editKpi ? {
          name: editKpi.name,
          description: editKpi.description,
          target_value: editKpi.target_value,
          unit: editKpi.unit,
        } : undefined}
        onSubmit={(data) => updateMutation.mutate({ id: editKpi?.id, data })}
        loading={updateMutation.isPending}
        submitLabel="Save"
      />
    </div>
  );
};

export default KPIsPage;
