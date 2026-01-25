import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { KanbanBoard, DataTable, StatusBadge, EmptyState } from '../../components/common';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { toast } from 'sonner';
import {
  KanbanSquare,
  Table2,
  Search,
  Plus,
  DollarSign,
  Calendar,
  User,
  Building2,
  Calculator,
  MessageSquare,
  Loader2,
  Filter,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const STAGES = [
  { id: 'qualified', title: 'Qualified' },
  { id: 'proposal', title: 'Proposal' },
  { id: 'negotiation', title: 'Negotiation' },
  { id: 'closed_won', title: 'Closed Won' },
  { id: 'closed_lost', title: 'Closed Lost' },
];

const formatCurrency = (value) => {
  if (!value) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value}`;
};

const OpportunityCard = ({ opportunity, onSelect }) => (
  <div
    className="cursor-pointer"
    onClick={(e) => {
      e.stopPropagation();
      onSelect(opportunity);
    }}
  >
    <div className="font-medium text-sm truncate">{opportunity.name}</div>
    <div className="flex items-center gap-2 mt-2">
      <DollarSign size={12} className="text-primary" />
      <span className="text-sm text-primary font-medium">
        {formatCurrency(opportunity.value || opportunity.amount)}
      </span>
    </div>
    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
      <Building2 size={12} />
      <span className="truncate">{opportunity.account_name || opportunity.company}</span>
    </div>
    {opportunity.owner_name && (
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <User size={12} />
        <span className="truncate">{opportunity.owner_name}</span>
      </div>
    )}
  </div>
);

const OpportunityDetailDrawer = ({ opportunity, open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [calculating, setCalculating] = useState(false);

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['opportunity-messages', opportunity?.id],
    queryFn: async () => {
      const response = await apiClient.get(`/opportunities/${opportunity.id}/messages`);
      return response.data;
    },
    enabled: !!opportunity?.id && open,
  });

  const calculateProbability = async () => {
    setCalculating(true);
    try {
      const response = await apiClient.post(`/opportunities/${opportunity.id}/calculate-probability`);
      toast.success(`Probability: ${response.data.probability}%`);
      queryClient.invalidateQueries(['opportunities']);
    } catch (err) {
      toast.error('Failed to calculate probability');
    } finally {
      setCalculating(false);
    }
  };

  if (!opportunity) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg" data-testid="opportunity-drawer">
        <SheetHeader>
          <SheetTitle>{opportunity.name}</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Value</div>
              <div className="text-lg font-semibold text-primary">
                {formatCurrency(opportunity.value || opportunity.amount)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Stage</div>
              <StatusBadge status={opportunity.stage}>
                {opportunity.stage?.replace(/_/g, ' ')}
              </StatusBadge>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Probability</div>
              <div className="font-medium">{opportunity.probability || 0}%</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Close Date</div>
              <div className="font-medium">
                {opportunity.close_date
                  ? new Date(opportunity.close_date).toLocaleDateString()
                  : 'Not set'}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase">Account</div>
            <div className="font-medium">{opportunity.account_name || opportunity.company || '-'}</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase">Owner</div>
            <div className="font-medium">{opportunity.owner_name || '-'}</div>
          </div>

          {opportunity.description && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Description</div>
              <div className="text-sm text-muted-foreground">{opportunity.description}</div>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <Button
              onClick={calculateProbability}
              disabled={calculating}
              className="w-full"
              data-testid="calculate-probability-button"
            >
              {calculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              Calculate Probability
            </Button>
          </div>

          {/* Messages Section */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={16} />
              <span className="text-sm font-medium">Related Messages</span>
            </div>
            {messagesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded"></div>
                ))}
              </div>
            ) : messages?.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {messages.map((msg, i) => (
                  <div key={msg.id || i} className="p-3 bg-secondary/50 rounded-lg text-sm">
                    <div className="font-medium truncate">{msg.subject || msg.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {msg.preview || msg.body?.slice(0, 100)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No messages found
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const OpportunitiesPage = () => {
  const queryClient = useQueryClient();
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const response = await apiClient.get('/opportunities');
      return response.data;
    },
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }) => {
      await apiClient.patch(`/opportunities/${id}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['opportunities']);
      toast.success('Stage updated');
    },
    onError: () => {
      toast.error('Failed to update stage');
    },
  });

  const handleSelectOpportunity = (opp) => {
    setSelectedOpportunity(opp);
    setDrawerOpen(true);
  };

  const handleDragEnd = (itemId, newColumnId) => {
    stageMutation.mutate({ id: itemId, stage: newColumnId });
  };

  // Filter and transform data
  const filteredOpportunities = (opportunities || []).filter((opp) => {
    const matchesSearch = !search || 
      opp.name?.toLowerCase().includes(search.toLowerCase()) ||
      opp.account_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === 'all' || opp.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  // Transform for kanban
  const kanbanItems = filteredOpportunities.map((opp) => ({
    ...opp,
    columnId: opp.stage,
  }));

  // Table columns
  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'value',
      label: 'Value',
      sortable: true,
      render: (value) => (
        <span className="text-primary font-medium">{formatCurrency(value)}</span>
      ),
    },
    { key: 'account_name', label: 'Account', sortable: true },
    {
      key: 'stage',
      label: 'Stage',
      sortable: true,
      render: (stage) => (
        <StatusBadge status={stage}>{stage?.replace(/_/g, ' ')}</StatusBadge>
      ),
    },
    {
      key: 'probability',
      label: 'Probability',
      sortable: true,
      render: (val) => `${val || 0}%`,
    },
    {
      key: 'close_date',
      label: 'Close Date',
      sortable: true,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    { key: 'owner_name', label: 'Owner', sortable: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Opportunities</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your sales pipeline
          </p>
        </div>
        <Button data-testid="create-opportunity-button">
          <Plus className="mr-2 h-4 w-4" />
          New Opportunity
        </Button>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search opportunities..."
              className="pl-9 w-64"
              data-testid="opportunity-search"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-40" data-testid="stage-filter">
              <Filter size={14} className="mr-2" />
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGES.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="kanban" data-testid="kanban-view-tab">
              <KanbanSquare size={16} className="mr-2" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="table" data-testid="table-view-tab">
              <Table2 size={16} className="mr-2" />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {view === 'kanban' ? (
        <KanbanBoard
          columns={STAGES}
          items={kanbanItems}
          onDragEnd={handleDragEnd}
          loading={isLoading}
          emptyTitle="No opportunities"
          emptyDescription="Create your first opportunity to get started."
          emptyIcon={KanbanSquare}
          renderCard={(item) => (
            <OpportunityCard opportunity={item} onSelect={handleSelectOpportunity} />
          )}
          renderColumnHeader={(column, items) => {
            const total = items.reduce((sum, i) => sum + (i.value || i.amount || 0), 0);
            return (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{column.title}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                <div className="text-xs text-primary mt-1">{formatCurrency(total)}</div>
              </div>
            );
          }}
        />
      ) : (
        <DataTable
          columns={tableColumns}
          data={filteredOpportunities}
          loading={isLoading}
          onRowClick={handleSelectOpportunity}
          emptyTitle="No opportunities"
          emptyDescription="Create your first opportunity to get started."
          emptyIcon={KanbanSquare}
        />
      )}

      {/* Detail Drawer */}
      <OpportunityDetailDrawer
        opportunity={selectedOpportunity}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
};

export default OpportunitiesPage;
