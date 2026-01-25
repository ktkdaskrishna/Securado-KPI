import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { DataTable, MetricCard, ModalForm, StatusBadge, EmptyState } from '../../components/common';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import {
  Briefcase,
  Search,
  Plus,
  DollarSign,
  Trash2,
} from 'lucide-react';

const portfolioSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

const formatCurrency = (value) => {
  if (!value) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value}`;
};

const PortfoliosPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: portfolios, isLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: async () => {
      const response = await apiClient.get('/portfolios');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/portfolios', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['portfolios']);
      toast.success('Portfolio created');
      setCreateOpen(false);
    },
    onError: () => {
      toast.error('Failed to create portfolio');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`/portfolios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['portfolios']);
      toast.success('Portfolio deleted');
    },
    onError: () => {
      toast.error('Failed to delete portfolio');
    },
  });

  const filteredPortfolios = (portfolios || []).filter((portfolio) => {
    if (!search) return true;
    return portfolio.name?.toLowerCase().includes(search.toLowerCase());
  });

  const totalValue = (portfolios || []).reduce((sum, p) => sum + (p.total_value || 0), 0);

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    {
      key: 'total_value',
      label: 'Total Value',
      sortable: true,
      render: (value) => (
        <span className="text-primary font-medium">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'accounts_count',
      label: 'Accounts',
      sortable: true,
      render: (value) => value || 0,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (status) => <StatusBadge status={status}>{status?.replace(/_/g, ' ')}</StatusBadge>,
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
            data-testid={`delete-portfolio-${row.id}`}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  const formFields = [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter portfolio name' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Portfolios</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage account portfolios</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-portfolio-button">
          <Plus className="mr-2 h-4 w-4" />
          New Portfolio
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          label="Total Portfolios"
          value={portfolios?.length || 0}
          icon={Briefcase}
          loading={isLoading}
        />
        <MetricCard
          label="Total Value"
          value={formatCurrency(totalValue)}
          icon={DollarSign}
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
            placeholder="Search portfolios..."
            className="pl-9"
            data-testid="portfolio-search"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={tableColumns}
        data={filteredPortfolios}
        loading={isLoading}
        emptyTitle="No portfolios"
        emptyDescription="Create your first portfolio to get started."
        emptyIcon={Briefcase}
      />

      {/* Create Modal */}
      <ModalForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Portfolio"
        fields={formFields}
        schema={portfolioSchema}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        submitLabel="Create"
      />
    </div>
  );
};

export default PortfoliosPage;
