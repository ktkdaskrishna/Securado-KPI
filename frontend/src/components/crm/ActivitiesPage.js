import React, { useState, useEffect, useCallback } from 'react';
import { crmAPI, analyticsAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Plus, CheckSquare, Phone, Mail, Calendar, FileText, CheckCircle, Clock, AlertCircle, Filter, Presentation, Eye, MapPin, FileCheck, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { PageFilters, YearFilter, QuarterFilter, SalesRepFilter, ActivityTypeFilter, ActivityStatusFilter } from '../layout/PageFilters';

const typeIcons = {
  demo: Presentation,
  'proof of concept': Wrench,
  'site visit': MapPin,
  'work shop': Eye,
  'rfp submission': FileCheck,
  'product presentation': Presentation,
  'vendor meeting': Calendar,
  poc: Wrench,
};

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
};

export function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    type: 'task',
    description: '',
    due_date: '',
  });
  const [filterOptions, setFilterOptions] = useState({ years: [], salesReps: [], types: ['Demo', 'Proof of concept', 'Site Visit', 'Work Shop', 'Product Presentation', 'Vendor Meeting', 'POC'] });
  
  // Contextual filters for Activities page
  const [filters, setFilters] = useState({
    year: null,
    quarter: null,
    salesRep: null,
    type: null,
    status: null
  });

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ year: null, quarter: null, salesRep: null, type: null, status: null });
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(v => v !== null);
  };

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await analyticsAPI.getFilters();
      if (res.data) {
        setFilterOptions({
          years: res.data.years || [],
          salesReps: res.data.sales_reps || res.data.salesReps || [],
          types: ['Demo', 'Proof of concept', 'Site Visit', 'Work Shop', 'Product Presentation', 'Vendor Meeting', 'POC']
        });
      }
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  }, []);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Load data when filters change
  useEffect(() => {
    loadData();
  }, [filters.year, filters.quarter, filters.salesRep, filters.type, filters.status]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Build filter params from contextual filters
      const params = {};
      if (filters.year) params.year = filters.year;
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.salesRep) params.sales_rep = filters.salesRep;
      if (filters.type) params.activity_type = filters.type;
      if (filters.status) params.status = filters.status;
      
      const [activitiesRes, statsRes] = await Promise.all([
        crmAPI.listActivities(params),
        crmAPI.getActivityStats(params),  // Pass same filters to stats
      ]);
      setActivities(activitiesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await crmAPI.createActivity(formData);
      toast.success('Activity created');
      setDialogOpen(false);
      setFormData({ subject: '', type: 'task', description: '', due_date: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to create activity');
    }
  };

  const handleComplete = async (id) => {
    try {
      await crmAPI.completeActivity(id);
      toast.success('Activity completed');
      loadData();
    } catch (error) {
      toast.error('Failed to complete activity');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
          <p className="text-gray-500">Value-selling activities: Demos, POCs, Site Visits, Workshops, RFPs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="activity-quickadd-button">
              <Plus className="h-4 w-4 mr-2" />
              New Activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Activity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Follow up call"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} data-testid="activity-save-button">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contextual Filters for Activities */}
      <PageFilters 
        onReset={resetFilters}
        activeFilters={[filters.year, filters.quarter, filters.salesRep, filters.type, filters.status]}
        title="Activity Filters"
      >
        <YearFilter 
          value={filters.year} 
          onChange={(v) => updateFilter('year', v)} 
          years={filterOptions.years}
        />
        <QuarterFilter 
          value={filters.quarter} 
          onChange={(v) => updateFilter('quarter', v)} 
        />
        <SalesRepFilter 
          value={filters.salesRep} 
          onChange={(v) => updateFilter('salesRep', v)} 
          salesReps={filterOptions.salesReps}
        />
        <ActivityTypeFilter 
          value={filters.type} 
          onChange={(v) => updateFilter('type', v)} 
          types={filterOptions.types}
        />
        <ActivityStatusFilter 
          value={filters.status} 
          onChange={(v) => updateFilter('status', v)} 
        />
      </PageFilters>

      {/* Value-Selling Activity Summary */}
      {activities.length > 0 && (() => {
        const typeCounts = {};
        activities.forEach(a => { const t = a.type || '?'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
        const summaryCards = [
          { label: 'Demos', key: 'demo', icon: Presentation, color: '#3b82f6' },
          { label: 'Site Visits', key: 'site_visit', icon: MapPin, color: '#10b981' },
          { label: 'POC', key: 'proof_of_concept', icon: Wrench, color: '#f59e0b' },
          { label: 'Workshops', key: 'work_shop', icon: Eye, color: '#8b5cf6' },
        ];
        return (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {summaryCards.map(s => (
              <Card key={s.key}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{typeCounts[s.key] || 0}</p>
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: s.color + '15' }}>
                      <s.icon className="h-5 w-5" style={{ color: s.color }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })()}

      {/* Overdue & Member Performance */}
      {activities.length > 0 && (() => {
        const now = new Date();
        const overdue = activities.filter(a => a.due_date && new Date(a.due_date) < now && a.status !== 'done');
        const memberStats = {};
        activities.forEach(a => {
          const owner = a.owner_name || 'Unassigned';
          if (!memberStats[owner]) memberStats[owner] = { total: 0, overdue: 0, done: 0 };
          memberStats[owner].total++;
          if (a.status === 'done') memberStats[owner].done++;
          if (a.due_date && new Date(a.due_date) < now && a.status !== 'done') memberStats[owner].overdue++;
        });
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">Overdue Activities</p>
                  <span className={`text-lg font-bold ${overdue.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{overdue.length}</span>
                </div>
                {overdue.length > 0 ? (
                  <div className="space-y-1.5 max-h-[120px] overflow-auto">{overdue.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                      <span className="text-gray-700 truncate flex-1">{a.subject || a.type_display || a.type}</span>
                      <span className="text-red-500 font-medium ml-2">{a.due_date?.split(' ')[0]}</span>
                    </div>
                  ))}</div>
                ) : <p className="text-xs text-green-600">All activities are on track!</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-sm font-semibold text-gray-700 mb-3">Member Performance</p>
                <div className="space-y-2 max-h-[120px] overflow-auto">{Object.entries(memberStats).sort((a,b) => b[1].total - a[1].total).slice(0, 5).map(([name, s]) => (
                  <div key={name} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-700 truncate flex-1 font-medium">{name}</span>
                    <span className="text-gray-500">{s.total} tasks</span>
                    {s.done > 0 && <span className="text-green-600">{s.done} done</span>}
                    {s.overdue > 0 && <span className="text-red-600 font-bold">{s.overdue} overdue</span>}
                  </div>
                ))}</div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Activities List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Opportunity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No value-selling activities found.
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => {
                const Icon = typeIcons[activity.type] || FileText;
                const isOverdue = activity.due_date && new Date(activity.due_date) < new Date() && activity.status !== 'done';
                const daysUntilDue = activity.due_date ? Math.ceil((new Date(activity.due_date) - new Date()) / (1000*60*60*24)) : null;
                return (
                  <TableRow key={activity.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-400" />
                        <span className="capitalize text-sm">{activity.type_display || activity.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{activity.subject}</TableCell>
                    <TableCell>
                      {activity.opportunity_name ? (
                        <button onClick={() => window.location.href = `/opportunities?search=${encodeURIComponent(activity.opportunity_name)}`}
                          className="text-xs text-[#800000] hover:underline font-medium">
                          {activity.opportunity_name}
                        </button>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[activity.status] || statusColors.pending}>
                        {activity.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{activity.owner_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{activity.due_date || '-'}</span>
                        {isOverdue && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">OVERDUE</span>}
                        {!isOverdue && daysUntilDue != null && daysUntilDue <= 3 && daysUntilDue >= 0 && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{daysUntilDue}d left</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {activity.status !== 'completed' && (
                        <Button variant="ghost" size="sm" onClick={() => handleComplete(activity.id)}>Complete</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
