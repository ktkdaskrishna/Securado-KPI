import React, { useState, useEffect, useCallback } from 'react';
import { crmAPI, analyticsAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { PageFilters, YearFilter } from '../layout/PageFilters';
import { toast } from 'sonner';
import {
  Activity, Search, Clock, CheckCircle, AlertTriangle, Calendar,
  Users, Target, Eye, Presentation, MapPin, Wrench, FileCheck,
  Filter, TrendingUp, BarChart2
} from 'lucide-react';

const TYPE_CONFIG = {
  demo: { icon: Presentation, color: 'bg-blue-100 text-blue-700', label: 'Demo' },
  'proof_of_concept': { icon: Wrench, color: 'bg-purple-100 text-purple-700', label: 'POC' },
  'site_visit': { icon: MapPin, color: 'bg-green-100 text-green-700', label: 'Site Visit' },
  'work_shop': { icon: Eye, color: 'bg-amber-100 text-amber-700', label: 'Workshop' },
  'product_presentation': { icon: Presentation, color: 'bg-indigo-100 text-indigo-700', label: 'Presentation' },
  'vendor_meeting': { icon: Calendar, color: 'bg-teal-100 text-teal-700', label: 'Vendor Meeting' },
  'poc': { icon: Wrench, color: 'bg-violet-100 text-violet-700', label: 'POC' },
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(null);
  const [years, setYears] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (yearFilter) params.year = yearFilter;
      const [actRes, filterRes] = await Promise.allSettled([
        crmAPI.listActivities(params),
        analyticsAPI.getFilters()
      ]);
      if (actRes.status === 'fulfilled') setActivities(actRes.value.data || []);
      if (filterRes.status === 'fulfilled') {
        const currentYear = new Date().getFullYear();
        setYears((filterRes.value.data?.years || []).filter(y => parseInt(y) <= currentYear));
      }
    } catch {} finally { setLoading(false); }
  }, [yearFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const now = new Date();
  const getStatus = (a) => {
    if (a.status === 'done' || a.status === 'completed') return 'completed';
    if (a.status === 'cancelled') return 'cancelled';
    if (a.due_date && new Date(a.due_date) < now) return 'overdue';
    const dueDate = a.due_date ? new Date(a.due_date) : null;
    if (dueDate && (dueDate - now) / (1000*60*60*24) <= 1) return 'today';
    return 'planned';
  };

  const enriched = activities.map(a => ({ ...a, computed_status: getStatus(a), days_overdue: a.due_date && new Date(a.due_date) < now ? Math.ceil((now - new Date(a.due_date)) / (1000*60*60*24)) : 0 }));
  
  // Stats
  const stats = {
    all: enriched.length,
    planned: enriched.filter(a => a.computed_status === 'planned').length,
    today: enriched.filter(a => a.computed_status === 'today').length,
    completed: enriched.filter(a => a.computed_status === 'completed').length,
    overdue: enriched.filter(a => a.computed_status === 'overdue').length,
    cancelled: enriched.filter(a => a.computed_status === 'cancelled').length,
  };

  // Member performance
  const memberStats = {};
  enriched.forEach(a => {
    const owner = a.owner_name || 'Unassigned';
    if (!memberStats[owner]) memberStats[owner] = { total: 0, completed: 0, overdue: 0, planned: 0 };
    memberStats[owner].total++;
    memberStats[owner][a.computed_status] = (memberStats[owner][a.computed_status] || 0) + 1;
  });

  // Filter
  const filtered = enriched.filter(a => {
    if (tab !== 'all' && a.computed_status !== tab) return false;
    if (search && !Object.values(a).some(v => String(v).toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(filtered.map(a => a.id)));

  const handleBulkAction = async (action) => {
    toast.success(`${action}: ${selected.size} activities (demo — backend integration needed)`);
    setSelected(new Set());
  };

  if (loading) return (
    <div className="space-y-5 p-6">
      <div className="grid grid-cols-6 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );

  return (
    <div className="space-y-5 p-6" data-testid="activities-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#800000]" /> Value-Selling Activities
          </h1>
          <p className="text-sm text-gray-500">Demos, POCs, Site Visits, Workshops — mapped to KPIs</p>
        </div>
        <div className="flex items-center gap-2">
          <YearFilter value={yearFilter} onChange={setYearFilter} years={years} />
          <Button variant="outline" size="sm" onClick={loadData}><Filter className="h-4 w-4 mr-1" /> Refresh</Button>
        </div>
      </div>

      {/* KPI Cards — Clickable Drill-Down */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { key: 'all', label: 'All Activities', value: stats.all, icon: Activity, color: 'text-gray-700', bg: 'bg-gray-50' },
          { key: 'planned', label: 'Planned', value: stats.planned, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
          { key: 'today', label: "Today's", value: stats.today, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { key: 'completed', label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { key: 'overdue', label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { key: 'cancelled', label: 'Cancelled', value: stats.cancelled, icon: Target, color: 'text-gray-500', bg: 'bg-gray-50' },
        ].map(kpi => {
          const KI = kpi.icon;
          return (
            <Card key={kpi.key} className={`cursor-pointer transition-all hover:shadow-md ${tab === kpi.key ? 'ring-2 ring-[#800000] ring-offset-1' : ''}`}
              onClick={() => setTab(tab === kpi.key ? 'all' : kpi.key)}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{kpi.label}</p>
                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.bg}`}><KI className={`h-5 w-5 ${kpi.color}`} /></div>
                </div>
                {tab === kpi.key && kpi.key !== 'all' && <Badge className="bg-[#800000] text-white text-[9px] mt-1">Filtered</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Member Performance + Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Member Performance</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-[180px] overflow-auto">
              {Object.entries(memberStats).sort((a,b) => b[1].total - a[1].total).map(([name, s]) => (
                <div key={name} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
                  <span className="font-medium text-gray-700 flex-1 truncate">{name}</span>
                  <span className="text-gray-500">{s.total}</span>
                  {s.completed > 0 && <Badge className="bg-green-100 text-green-700 text-[9px]">{s.completed} done</Badge>}
                  {s.overdue > 0 && <Badge className="bg-red-100 text-red-700 text-[9px]">{s.overdue} overdue</Badge>}
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.total > 0 ? (s.completed / s.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Activity Type Breakdown</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-[180px] overflow-auto">
              {(() => {
                const types = {};
                enriched.forEach(a => { const t = a.type || '?'; types[t] = (types[t] || 0) + 1; });
                const max = Math.max(...Object.values(types), 1);
                return Object.entries(types).sort((a,b) => b[1] - a[1]).map(([type, count]) => {
                  const cfg = TYPE_CONFIG[type] || { icon: Activity, color: 'bg-gray-100 text-gray-600', label: type };
                  const TI = cfg.icon;
                  return (
                    <div key={type} className="flex items-center gap-2 text-xs py-1">
                      <TI className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-gray-700 w-24 truncate">{cfg.label}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#800000]" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                      <span className="font-bold text-gray-900 w-6 text-right">{count}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Bulk Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activities..." className="pl-9 h-9" />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge className="bg-[#800000] text-white">{selected.size} selected</Badge>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction('Mark Done')} className="h-8 text-xs"><CheckCircle className="h-3.5 w-3.5 mr-1 text-green-600" /> Mark Done</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction('Cancel')} className="h-8 text-xs text-red-600">Cancel</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="h-8 text-xs">Clear</Button>
          </div>
        )}
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} activities</span>
      </div>

      {/* Activities Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-8"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={(c) => c ? selectAll() : setSelected(new Set())} /></TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Opportunity</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No activities found</TableCell></TableRow>
            ) : filtered.map(a => {
              const cfg = TYPE_CONFIG[a.type] || { icon: Activity, color: 'bg-gray-100 text-gray-600', label: a.type_display || a.type };
              const TI = cfg.icon;
              return (
                <TableRow key={a.id} className="hover:bg-gray-50">
                  <TableCell><Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <TI className="h-3.5 w-3.5 text-gray-400" />
                      <Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">{a.subject || '-'}</TableCell>
                  <TableCell>
                    {a.opportunity_name ? (
                      <button onClick={() => window.location.href = `/opportunities?search=${encodeURIComponent(a.opportunity_name)}`}
                        className="text-xs text-[#800000] hover:underline font-medium truncate max-w-[150px] block">{a.opportunity_name}</button>
                    ) : <span className="text-xs text-gray-300">-</span>}
                  </TableCell>
                  <TableCell className="text-sm">{a.owner_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{a.due_date?.split(' ')[0] || '-'}</span>
                      {a.computed_status === 'overdue' && <Badge className="bg-red-100 text-red-700 text-[9px]">{a.days_overdue}d overdue</Badge>}
                      {a.computed_status === 'today' && <Badge className="bg-amber-100 text-amber-700 text-[9px]">Today</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      a.computed_status === 'completed' ? 'bg-green-100 text-green-700' :
                      a.computed_status === 'overdue' ? 'bg-red-100 text-red-700' :
                      a.computed_status === 'today' ? 'bg-amber-100 text-amber-700' :
                      a.computed_status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                      'bg-blue-100 text-blue-700'
                    }>{a.computed_status}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
