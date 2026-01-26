import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Search, Filter, GripVertical, DollarSign, User, Mail } from 'lucide-react';
import { toast } from 'sonner';

const STAGES = ['qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

const stageColors = {
  qualified: 'bg-blue-100 text-blue-700 border-blue-200',
  proposal: 'bg-purple-100 text-purple-700 border-purple-200',
  negotiation: 'bg-amber-100 text-amber-700 border-amber-200',
  closed_won: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed_lost: 'bg-red-100 text-red-700 border-red-200',
};

const formatStage = (stage) => {
  return stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

function SortableCard({ opportunity, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.canonical_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      data-testid={`opps-card-${opportunity.canonical_id}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{opportunity.name}</h4>
          <p className="text-xs text-gray-500 truncate mt-1">
            {opportunity.account_name || 'No Account'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <DollarSign className="h-3 w-3 text-gray-400" />
            <span className="text-sm font-semibold">
              ${(opportunity.amount || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <User className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500 truncate">
              {opportunity.owner_name || 'Unassigned'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ stage, opportunities, onDrop }) {
  const stageOpps = opportunities.filter(o => o.stage === stage);
  
  return (
    <div 
      className="flex-shrink-0 w-72 bg-gray-50 rounded-lg"
      data-testid={`opps-kanban-column-${stage}`}
    >
      <div className="p-3 border-b bg-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{formatStage(stage)}</h3>
          <Badge variant="secondary" className={stageColors[stage]}>
            {stageOpps.length}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          ${stageOpps.reduce((sum, o) => sum + (o.amount || 0), 0).toLocaleString()}
        </p>
      </div>
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="p-2 space-y-2">
          <SortableContext items={stageOpps.map(o => o.canonical_id)} strategy={verticalListSortingStrategy}>
            {stageOpps.map((opp) => (
              <SortableCard key={opp.canonical_id} opportunity={opp} />
            ))}
          </SortableContext>
          {stageOpps.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-sm">
              No opportunities
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState([]);
  const [kanbanData, setKanbanData] = useState({ stages: [], data: {} });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [listRes, kanbanRes] = await Promise.all([
        crmAPI.listOpportunities(),
        crmAPI.getKanban(),
      ]);
      setOpportunities(listRes.data);
      setKanbanData(kanbanRes.data);
    } catch (error) {
      toast.error('Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    // Find the target stage from the over element
    const overElement = document.querySelector(`[data-testid*="${over.id}"]`);
    if (!overElement) return;
    
    // Find which column the item was dropped in
    const columnElement = overElement.closest('[data-testid^="opps-kanban-column-"]');
    if (!columnElement) return;
    
    const newStage = columnElement.getAttribute('data-testid').replace('opps-kanban-column-', '');
    const opp = opportunities.find(o => o.canonical_id === active.id);
    
    if (opp && opp.stage !== newStage) {
      try {
        await crmAPI.updateStage(active.id, newStage);
        toast.success('Stage updated');
        loadData();
      } catch (error) {
        toast.error('Failed to update stage');
      }
    }
  };

  const allOpportunities = Object.values(kanbanData.data || {}).flat();
  const filteredOpportunities = allOpportunities.filter(opp =>
    !searchQuery || 
    opp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opp.account_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-500">Manage and track your sales opportunities</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="list" data-testid="opps-tab-list">List View</TabsTrigger>
            <TabsTrigger value="kanban" data-testid="opps-tab-kanban">Kanban Board</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search opportunities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
                data-testid="opps-search-input"
              />
            </div>
          </div>
        </div>

        <TabsContent value="list" className="mt-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Probability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No opportunities found. Run an ETL pipeline to import data.
                    </TableCell>
                  </TableRow>
                ) : (
                  opportunities
                    .filter(opp => 
                      !searchQuery ||
                      opp.name?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((opp) => (
                      <TableRow key={opp.canonical_id} data-testid={`opp-row-${opp.canonical_id}`}>
                        <TableCell className="font-medium">{opp.name}</TableCell>
                        <TableCell>{opp.account_name || '-'}</TableCell>
                        <TableCell>
                          <Badge className={stageColors[opp.stage] || 'bg-gray-100'}>
                            {formatStage(opp.stage || 'unknown')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${(opp.amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>{opp.owner_name || '-'}</TableCell>
                        <TableCell>{opp.probability || 0}%</TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="mt-6">
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STAGES.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  opportunities={filteredOpportunities}
                />
              ))}
            </div>
          </DndContext>
        </TabsContent>
      </Tabs>
    </div>
  );
}
