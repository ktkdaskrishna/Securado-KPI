import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI, crmAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Target, Plus, TrendingUp, TrendingDown, Trophy, Users, User, Trash2,
  ArrowUpRight, BarChart2, Activity, Phone, Mail, Calendar, Monitor,
  FlaskConical, Presentation, Building2, DollarSign, Calculator, Zap,
  ChevronDown, ChevronRight, Crosshair, Layers, Award, Minus, PieChart
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie } from 'recharts';
import { toast } from 'sonner';

const activityIcons = { call: Phone, email: Mail, meeting: Calendar, demo: Monitor, poc: FlaskConical, workshop: Presentation };
const activityColors = { call: '#3b82f6', email: '#8b5cf6', meeting: '#10b981', demo: '#f59e0b', poc: '#ef4444', workshop: '#06b6d4' };

const statusConfig = {
  active: { label: 'Active', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  achieved: { label: 'Achieved', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  missed: { label: 'Missed', class: 'bg-red-50 text-red-700 border-red-200' },
  draft: { label: 'Draft', class: 'bg-gray-50 text-gray-600 border-gray-200' },
  in_progress: { label: 'In Progress', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  on_track: { label: 'On Track', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  at_risk: { label: 'At Risk', class: 'bg-red-50 text-red-700 border-red-200' },
  completed: { label: 'Completed', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function MetricCard({ label, value, subValue, icon: Icon, color = 'text-blue-600', bgColor = 'bg-blue-50' }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500 font-medium">{label}</span>
          <div className={`p-1.5 rounded-full ${bgColor}`}>{Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}</div>
        </div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {subValue && <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>}
      </CardContent>
    </Card>
  );
}

function RevenueTargetRow({ target, depth = 0, onUpdate, onDelete, children: childTargets }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [editing, setEditing] = useState(false);
  const [newVal, setNewVal] = useState(target.current_value || 0);
  const progress = target.target_value > 0 ? Math.min(100, ((target.current_value || 0) / target.target_value) * 100) : 0;
  const hasChildren = childTargets && childTargets.length > 0;
  const status = statusConfig[target.status] || statusConfig.active;

  const handleSave = () => { onUpdate(target.id, parseFloat(newVal)); setEditing(false); };

  return (
    <>
      <TableRow className={`hover:bg-gray-50 ${depth === 0 ? 'bg-gray-50/50 font-medium' : ''}`} data-testid={`target-row-${target.id}`}>
        <TableCell className="py-2.5">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 24}px` }}>
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="p-0.5 rounded hover:bg-gray-200 text-gray-400">
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : <span className="w-5" />}
            <div className="min-w-0">
              <p className={`text-sm text-gray-900 truncate ${depth === 0 ? 'font-semibold' : ''}`}>{target.name}</p>
              {target.product_name && <p className="text-[11px] text-[#800000]">{target.product_name}</p>}
            </div>
          </div>
        </TableCell>
        <TableCell className="py-2.5">
          {target.assigned_to_name ? (
            <span className="text-xs text-gray-600 flex items-center gap-1"><User className="h-3 w-3 text-gray-400" />{target.assigned_to_name}</span>
          ) : <span className="text-xs text-gray-400 capitalize">{target.department || '-'}</span>}
        </TableCell>
        <TableCell className="py-2.5 text-right font-mono text-sm text-gray-900">{(target.target_value || 0).toLocaleString()} <span className="text-gray-400 text-xs">{target.target_unit || 'OMR'}</span></TableCell>
        <TableCell className="py-2.5 text-right">
          {editing ? (
            <div className="flex items-center gap-1 justify-end">
              <Input type="number" value={newVal} onChange={e => setNewVal(e.target.value)} className="h-7 w-20 text-xs text-right" />
              <Button size="sm" className="h-7 text-xs bg-[#800000] hover:bg-[#9a1919] text-white px-2" onClick={handleSave}>OK</Button>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><Minus className="h-3 w-3" /></button>
            </div>
          ) : (
            <button onClick={() => { setEditing(true); setNewVal(target.current_value || 0); }}
              className="text-sm font-mono text-gray-900 hover:text-[#800000] transition-colors cursor-pointer">
              {(target.current_value || 0).toLocaleString()}
            </button>
          )}
        </TableCell>
        <TableCell className="py-2.5">
          <div className="flex items-center gap-2">
            <Progress value={Math.min(progress, 100)} className="w-20 h-2" />
            <span className={`text-xs font-medium ${progress >= 100 ? 'text-emerald-600' : progress >= 70 ? 'text-blue-600' : progress >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
              {progress.toFixed(0)}%
            </span>
          </div>
        </TableCell>
        <TableCell className="py-2.5"><Badge variant="outline" className={`text-[10px] ${status.class}`}>{status.label}</Badge></TableCell>
        <TableCell className="py-2.5 text-right">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => onDelete(target.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </TableCell>
      </TableRow>
      {expanded && hasChildren && childTargets.map(child => (
        <RevenueTargetRow key={child.id} target={child} depth={depth + 1} onUpdate={onUpdate} onDelete={onDelete} childTargets={child.children || []} />
      ))}
    </>
  );
}

function CreateTargetDialog({ open, onClose, onCreated, existingTargets = [] }) {
  const [form, setForm] = useState({ name: '', description: '', target_type: 'revenue', target_value: 0, target_unit: 'OMR', period_type: 'quarterly', department: 'sales', start_date: '2026-01-01', end_date: '2026-03-31', assigned_to_name: '', product_name: '', parent_target_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const parentTargets = existingTargets.filter(t => !t.assigned_to || t.department === 'company' || t.department === 'product');

  const handleSubmit = async () => {
    if (!form.name || !form.target_value) { toast.error('Name and target value required'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.parent_target_id) delete payload.parent_target_id;
      if (!payload.product_name) delete payload.product_name;
      await targetAPI.createSalesTarget(payload);
      toast.success('Target created');
      onCreated(); onClose();
    } catch { toast.error('Failed to create'); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="create-target-dialog">
        <DialogHeader><DialogTitle>Create Revenue / Activity Target</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Q1 Revenue - Product Manager A" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Type</Label>
              <Select value={form.target_type} onValueChange={v => setForm(p => ({...p, target_type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="revenue">Revenue</SelectItem><SelectItem value="product">Product-Specific</SelectItem><SelectItem value="activity">Activity</SelectItem></SelectContent>
              </Select></div>
            <div><Label className="text-xs">Department</Label>
              <Select value={form.department} onValueChange={v => setForm(p => ({...p, department: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="company">Company</SelectItem><SelectItem value="sales">Sales</SelectItem><SelectItem value="product">Product</SelectItem><SelectItem value="presales">Pre-Sales</SelectItem><SelectItem value="marketing">Marketing</SelectItem></SelectContent>
              </Select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Target Value</Label><Input type="number" value={form.target_value} onChange={e => setForm(p => ({...p, target_value: parseFloat(e.target.value) || 0}))} /></div>
            <div><Label className="text-xs">Unit</Label>
              <Select value={form.target_unit} onValueChange={v => setForm(p => ({...p, target_unit: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="OMR">OMR</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="count">Count</SelectItem></SelectContent>
              </Select></div>
            <div><Label className="text-xs">Period</Label>
              <Select value={form.period_type} onValueChange={v => setForm(p => ({...p, period_type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
              </Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Assigned To</Label><Input value={form.assigned_to_name} onChange={e => setForm(p => ({...p, assigned_to_name: e.target.value}))} placeholder="Product Manager name" /></div>
            <div><Label className="text-xs">Parent Target</Label>
              <Select value={form.parent_target_id || '_none'} onValueChange={v => setForm(p => ({...p, parent_target_id: v === '_none' ? '' : v}))}>
                <SelectTrigger><SelectValue placeholder="None (Top-level)" /></SelectTrigger>
                <SelectContent><SelectItem value="_none">None (Top-level)</SelectItem>{parentTargets.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          {form.target_type === 'product' && (
            <div><Label className="text-xs">Product / Solution Category</Label><Input value={form.product_name} onChange={e => setForm(p => ({...p, product_name: e.target.value}))} placeholder="AI Security Suite" /></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Start</Label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({...p, start_date: e.target.value}))} /></div>
            <div><Label className="text-xs">End</Label><Input type="date" value={form.end_date} onChange={e => setForm(p => ({...p, end_date: e.target.value}))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="create-target-submit">{submitting ? 'Creating...' : 'Create Target'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateActivityDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', activity_type: 'call', target_count: 10, period_type: 'monthly', assigned_to_name: '' });
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    setSubmitting(true);
    try { await targetAPI.createActivityTarget(form); toast.success('Activity target created'); onCreated(); onClose(); } catch { toast.error('Failed'); } finally { setSubmitting(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="create-activity-dialog">
        <DialogHeader><DialogTitle>Create Activity Target</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Outbound Calls - Ahmed" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Activity Type</Label>
              <Select value={form.activity_type} onValueChange={v => setForm(p => ({...p, activity_type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="call">Calls</SelectItem><SelectItem value="email">Emails</SelectItem><SelectItem value="meeting">Meetings</SelectItem><SelectItem value="demo">Demos</SelectItem><SelectItem value="poc">POCs</SelectItem><SelectItem value="workshop">Workshops</SelectItem></SelectContent>
              </Select></div>
            <div><Label className="text-xs">Target Count</Label><Input type="number" value={form.target_count} onChange={e => setForm(p => ({...p, target_count: parseInt(e.target.value) || 0}))} /></div>
          </div>
          <div><Label className="text-xs">Assigned To</Label><Input value={form.assigned_to_name} onChange={e => setForm(p => ({...p, assigned_to_name: e.target.value}))} placeholder="Person name" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] text-white">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PerformanceHubPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('revenue');
  const [periodFilter, setPeriodFilter] = useState('quarterly');
  const [targets, setTargets] = useState([]);
  const [summary, setSummary] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [activityTargets, setActivityTargets] = useState([]);
  const [activitySummary, setActivitySummary] = useState({});
  const [scoreboard, setScoreboard] = useState([]);
  const [goals, setGoals] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [showCreateTarget, setShowCreateTarget] = useState(false);
  const [showCreateActivity, setShowCreateActivity] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const actPeriod = periodFilter === 'quarterly' ? 'monthly' : periodFilter;
      const results = await Promise.allSettled([
        targetAPI.listSalesTargets({ period_type: periodFilter }),
        targetAPI.getTargetsSummary({ period_type: periodFilter }),
        targetAPI.getTargetLeaderboard({ period_type: periodFilter }),
        targetAPI.listActivityTargets({ period_type: actPeriod }),
        targetAPI.getActivityTargetsSummary({ period_type: actPeriod }),
        targetAPI.getActivityScoreboard({ period_type: actPeriod }),
        crmAPI.listGoals(), crmAPI.listKPIs(),
      ]);
      if (results[0].status === 'fulfilled') setTargets(results[0].value.data);
      if (results[1].status === 'fulfilled') setSummary(results[1].value.data);
      if (results[2].status === 'fulfilled') setLeaderboard(results[2].value.data);
      if (results[3].status === 'fulfilled') setActivityTargets(results[3].value.data);
      if (results[4].status === 'fulfilled') setActivitySummary(results[4].value.data);
      if (results[5].status === 'fulfilled') setScoreboard(results[5].value.data);
      if (results[6].status === 'fulfilled') setGoals(results[6].value.data);
      if (results[7].status === 'fulfilled') setKpis(results[7].value.data);
    } catch { toast.error('Failed to load data'); } finally { setLoading(false); }
  }, [periodFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdateProgress = async (id, value) => { try { await targetAPI.updateTargetProgress(id, value); toast.success('Updated'); loadData(); } catch { toast.error('Failed'); } };
  const handleDeleteTarget = async (id) => { try { await targetAPI.deleteSalesTarget(id); toast.success('Deleted'); loadData(); } catch { toast.error('Failed'); } };
  const handleLogActivity = async (id) => { try { await targetAPI.logActivityCount(id, 1); loadData(); } catch { toast.error('Failed'); } };
  const handleDeleteActivity = async (id) => { try { await targetAPI.deleteActivityTarget(id); toast.success('Deleted'); loadData(); } catch { toast.error('Failed'); } };

  const buildHierarchy = () => {
    const map = {};
    targets.forEach(t => { map[t.id] = { ...t, children: [] }; });
    const roots = [];
    targets.forEach(t => {
      if (t.parent_target_id && map[t.parent_target_id]) map[t.parent_target_id].children.push(map[t.id]);
      else roots.push(map[t.id]);
    });
    return roots;
  };

  const deptData = Object.entries(summary.by_department || {}).map(([dept, data]) => ({ name: dept.charAt(0).toUpperCase() + dept.slice(1), value: data.target, achieved: data.achieved }));
  const DEPT_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  if (loading) return (
    <div className="space-y-4" data-testid="performance-hub-loading">
      <Skeleton className="h-8 w-64" /><div className="grid grid-cols-6 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-96" />
    </div>
  );

  return (
    <div className="space-y-6" data-testid="performance-hub-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Crosshair className="h-6 w-6 text-[#800000]" /> Performance Hub</h1>
          <p className="text-gray-500 text-sm">Revenue targets, activity tracking, leaderboard & incentives</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-28 h-9" data-testid="hub-period-filter"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
          </Select>
          <Button onClick={() => setShowCreateTarget(true)} className="bg-[#800000] hover:bg-[#9a1919] text-white h-9" data-testid="hub-create-target"><Plus className="h-4 w-4 mr-1" /> Revenue Target</Button>
          <Button onClick={() => setShowCreateActivity(true)} variant="outline" className="h-9" data-testid="hub-create-activity"><Plus className="h-4 w-4 mr-1" /> Activity Target</Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Target" value={`OMR ${(summary.total_target_value || 0).toLocaleString()}`} icon={Target} color="text-blue-600" bgColor="bg-blue-50" />
        <MetricCard label="Achieved" value={`OMR ${(summary.total_achieved_value || 0).toLocaleString()}`} icon={TrendingUp} color="text-emerald-600" bgColor="bg-emerald-50" />
        <MetricCard label="Attainment" value={`${summary.overall_achievement_pct || 0}%`} icon={BarChart2} color={summary.overall_achievement_pct >= 80 ? 'text-emerald-600' : 'text-yellow-600'} bgColor={summary.overall_achievement_pct >= 80 ? 'bg-emerald-50' : 'bg-yellow-50'} />
        <MetricCard label="Active / At Risk" value={`${summary.active || 0} / ${summary.at_risk || 0}`} icon={ArrowUpRight} color="text-orange-600" bgColor="bg-orange-50" />
        <MetricCard label="Activities Done" value={`${activitySummary.total_actual_count || 0} / ${activitySummary.total_target_count || 0}`} subValue={`${activitySummary.overall_achievement_pct || 0}% complete`} icon={Activity} color="text-purple-600" bgColor="bg-purple-50" />
        <MetricCard label="Team Members" value={leaderboard.length || 0} icon={Users} color="text-cyan-600" bgColor="bg-cyan-50" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="revenue">Revenue Targets</TabsTrigger>
          <TabsTrigger value="activities">Activity Tracker</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="incentives">Incentives</TabsTrigger>
        </TabsList>

        {/* REVENUE TAB */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-[#800000]" /> Revenue Target Hierarchy <Badge variant="secondary" className="text-xs ml-2">{targets.length} targets</Badge></CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Target</TableHead><TableHead>Owner</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Actual</TableHead><TableHead>Progress</TableHead><TableHead>Status</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {buildHierarchy().map(root => <RevenueTargetRow key={root.id} target={root} onUpdate={handleUpdateProgress} onDelete={handleDeleteTarget} childTargets={root.children} />)}
                    {targets.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No targets yet. Click "Revenue Target" to create one.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieChart className="h-4 w-4 text-[#800000]" /> By Department</CardTitle></CardHeader>
                <CardContent>
                  {deptData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={150}>
                        <RePieChart><Pie data={deptData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>{deptData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}</Pie><RechartsTooltip /></RePieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">{deptData.map((d, i) => (
                        <div key={d.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: DEPT_COLORS[i] }} /><span className="text-gray-500">{d.name}</span></span><span className="font-semibold text-gray-900">{d.value?.toLocaleString()}</span></div>
                      ))}</div>
                    </>
                  ) : <p className="text-gray-400 text-xs text-center py-4">No department data</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Goals & KPIs</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {goals.slice(0, 4).map(g => { const pct = g.target_value > 0 ? Math.min(100, (g.current_value / g.target_value) * 100) : 0; return (
                    <div key={g.id} className="flex items-center justify-between text-xs"><span className="text-gray-500 truncate flex-1 mr-2">{g.name}</span><span className={`font-semibold ${pct >= 100 ? 'text-emerald-600' : 'text-gray-900'}`}>{pct.toFixed(0)}%</span></div>); })}
                  {kpis.slice(0, 4).map(k => { const pct = k.target_value > 0 ? Math.min(100, (k.current_value / k.target_value) * 100) : 0; return (
                    <div key={k.id} className="flex items-center justify-between text-xs"><span className="text-gray-500 truncate flex-1 mr-2">{k.name}</span><span className={`font-semibold ${pct >= 100 ? 'text-emerald-600' : 'text-gray-900'}`}>{pct.toFixed(0)}%</span></div>); })}
                  {goals.length === 0 && kpis.length === 0 && <p className="text-gray-400 text-xs text-center py-2">No goals/KPIs set</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ACTIVITY TAB */}
        <TabsContent value="activities" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(activitySummary.by_type || {}).map(([type, data]) => {
              const Icon = activityIcons[type] || Activity;
              return (
                <Card key={type} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1"><Icon className="h-3.5 w-3.5" style={{ color: activityColors[type] }} /><span className="text-xs text-gray-500 capitalize">{type}s</span></div>
                    <p className="text-lg font-bold text-gray-900">{data.actual_count}<span className="text-gray-400 text-sm font-normal">/{data.target_count}</span></p>
                    <Progress value={Math.min(data.achievement_pct, 100)} className="h-1.5 mt-1" />
                    <p className={`text-xs mt-0.5 ${data.achievement_pct >= 100 ? 'text-emerald-600' : data.achievement_pct >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{data.achievement_pct}%</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Target vs Actual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={Object.entries(activitySummary.by_type || {}).map(([t, d]) => ({ name: t, target: d.target_count, actual: d.actual_count, color: activityColors[t] }))} barGap={2}>
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip />
                    <Bar dataKey="target" fill="#e5e7eb" radius={[3, 3, 0, 0]} name="Target" />
                    <Bar dataKey="actual" radius={[3, 3, 0, 0]} name="Actual">{Object.entries(activitySummary.by_type || {}).map(([t], i) => <Cell key={i} fill={activityColors[t] || '#6b7280'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" /> Activity Scoreboard</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Done</TableHead><TableHead className="text-right">Score</TableHead><TableHead>Breakdown</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {scoreboard.map((s, idx) => (
                      <TableRow key={s.user_id}>
                        <TableCell className="py-1.5">{idx === 0 ? <Trophy className="h-3.5 w-3.5 text-yellow-500" /> : <span className="text-gray-400 text-xs">{idx+1}</span>}</TableCell>
                        <TableCell className="text-sm font-medium py-1.5">{s.user_name}</TableCell>
                        <TableCell className="text-sm text-right py-1.5">{s.total_actual}</TableCell>
                        <TableCell className="text-right py-1.5"><Badge variant={s.achievement_pct >= 100 ? 'default' : 'secondary'} className={`text-xs ${s.achievement_pct >= 100 ? 'bg-emerald-100 text-emerald-700' : ''}`}>{s.achievement_pct}%</Badge></TableCell>
                        <TableCell className="py-1.5"><div className="flex gap-0.5 flex-wrap">{Object.entries(s.activities || {}).map(([type, data]) => { const Icon = activityIcons[type] || Activity; return <span key={type} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600"><Icon className="h-2.5 w-2.5" style={{ color: activityColors[type] }} />{data.actual}/{data.target}</span>; })}</div></TableCell>
                      </TableRow>
                    ))}
                    {scoreboard.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-400 text-xs">No scoreboard data</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">All Activity Targets</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Assigned To</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Progress</TableHead><TableHead className="text-right">%</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {activityTargets.map(t => { const Icon = activityIcons[t.activity_type] || Activity; const pct = t.progress_pct || 0; return (
                    <TableRow key={t.id}><TableCell className="py-1.5"><div className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" style={{ color: activityColors[t.activity_type] }} /><span className="text-sm">{t.name}</span></div></TableCell>
                    <TableCell className="text-gray-500 text-sm py-1.5">{t.assigned_to_name || '-'}</TableCell>
                    <TableCell className="py-1.5"><Badge variant="outline" className="text-[10px] capitalize">{t.activity_type}</Badge></TableCell>
                    <TableCell className="text-right text-sm py-1.5">{t.current_count || 0} / {t.target_count}</TableCell>
                    <TableCell className="text-right py-1.5"><span className={`text-xs font-medium ${pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</span></TableCell>
                    <TableCell className="py-1.5"><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleLogActivity(t.id)}>+1</Button><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => handleDeleteActivity(t.id)}><Trash2 className="h-3 w-3" /></Button></div></TableCell></TableRow>); })}
                  {activityTargets.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-400 text-xs">No activity targets</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEADERBOARD TAB */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Award className="h-5 w-5 text-yellow-500" /> Revenue Achievement Leaderboard</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Achieved</TableHead><TableHead>Progress</TableHead><TableHead className="text-right">Attainment</TableHead></TableRow></TableHeader>
                <TableBody>
                  {leaderboard.map((entry, idx) => (
                    <TableRow key={entry.user_id} className={idx < 3 ? 'bg-gray-50/50' : ''} data-testid={`leaderboard-row-${idx}`}>
                      <TableCell className="py-2.5">{idx === 0 ? <Trophy className="h-4 w-4 text-yellow-500" /> : idx === 1 ? <Trophy className="h-4 w-4 text-gray-400" /> : idx === 2 ? <Trophy className="h-4 w-4 text-amber-700" /> : <span className="text-gray-400">{idx+1}</span>}</TableCell>
                      <TableCell className="font-medium py-2.5">{entry.user_name}</TableCell>
                      <TableCell className="text-right text-gray-500 font-mono py-2.5">{entry.total_target.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold font-mono py-2.5">{entry.total_achieved.toLocaleString()}</TableCell>
                      <TableCell className="py-2.5"><div className="flex items-center gap-2"><Progress value={Math.min(entry.achievement_pct, 100)} className="w-24 h-2" /><span className="text-xs text-gray-500">{entry.achievement_pct}%</span></div></TableCell>
                      <TableCell className="text-right py-2.5"><Badge variant={entry.achievement_pct >= 100 ? 'default' : 'secondary'} className={entry.achievement_pct >= 100 ? 'bg-emerald-100 text-emerald-700' : ''}>{entry.achievement_pct}%</Badge></TableCell>
                    </TableRow>
                  ))}
                  {leaderboard.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No leaderboard data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INCENTIVES TAB */}
        <TabsContent value="incentives" className="mt-4"><IncentivesSection targets={targets} /></TabsContent>
      </Tabs>

      <CreateTargetDialog open={showCreateTarget} onClose={() => setShowCreateTarget(false)} onCreated={loadData} existingTargets={targets} />
      <CreateActivityDialog open={showCreateActivity} onClose={() => setShowCreateActivity(false)} onCreated={loadData} />
    </div>
  );
}

function IncentivesSection({ targets }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  useEffect(() => { targetAPI.listIncentivePlans().then(r => setPlans(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);
  const handleCalc = async () => {
    if (!selectedTarget) { toast.error('Select a target'); return; }
    setCalculating(true);
    try { const res = await targetAPI.calculateIncentive({ target_id: selectedTarget }); setResult(res.data); } catch { toast.error('Failed'); } finally { setCalculating(false); }
  };
  const assignedTargets = targets.filter(t => t.assigned_to_name);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => (
          <Card key={plan.id}>
            <CardContent className="p-4">
              <h4 className="font-semibold text-gray-900 mb-2">{plan.name}</h4>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400 uppercase">Base</p><p className="text-sm font-bold">{(plan.base_salary||0).toLocaleString()}</p></div>
                <div className="text-center p-2 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400 uppercase">OTE</p><p className="text-sm font-bold">{(plan.ote||0).toLocaleString()}</p></div>
                <div className="text-center p-2 rounded-lg bg-emerald-50"><p className="text-[10px] text-emerald-600 uppercase">Variable</p><p className="text-sm font-bold text-emerald-600">{((plan.ote||0)*((plan.pay_mix_variable||40)/100)).toLocaleString()}</p></div>
              </div>
              <div className="space-y-1">{(plan.slabs||[]).map((s, i) => (<div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{s.label||`${s.min_percent}-${s.max_percent}%`}</span><span className="font-semibold">{s.commission_rate}%</span></div>))}</div>
              {(plan.spiffs?.length > 0 || plan.product_multipliers?.length > 0) && (<div className="flex gap-1 mt-2">{plan.spiffs?.length > 0 && <Badge variant="secondary" className="text-[10px]"><Zap className="h-2.5 w-2.5 mr-0.5" />{plan.spiffs.length} SPIFFs</Badge>}{plan.product_multipliers?.length > 0 && <Badge variant="secondary" className="text-[10px]"><ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />{plan.product_multipliers.length} Multipliers</Badge>}</div>)}
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && !loading && <Card className="col-span-full"><CardContent className="p-6 text-center text-gray-400">No incentive plans. Go to Incentives page to create one.</CardContent></Card>}
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4 text-[#800000]" /> Quick Calculator</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1"><Label className="text-xs">Sales Target</Label><Select value={selectedTarget} onValueChange={setSelectedTarget}><SelectTrigger data-testid="hub-calc-select"><SelectValue placeholder="Select a target" /></SelectTrigger><SelectContent>{assignedTargets.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.assigned_to_name})</SelectItem>)}</SelectContent></Select></div>
            <Button onClick={handleCalc} disabled={calculating} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="hub-calc-btn"><Calculator className="h-4 w-4 mr-1" /> {calculating ? '...' : 'Calculate'}</Button>
          </div>
          {result && (
            <div className="space-y-3" data-testid="hub-calc-result">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400 uppercase">Target</p><p className="text-sm font-bold">{(result.target_value||0).toLocaleString()}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400 uppercase">Actual</p><p className="text-sm font-bold">{(result.actual_value||0).toLocaleString()}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400 uppercase">Attainment</p><p className={`text-sm font-bold ${result.attainment_pct >= 100 ? 'text-emerald-600' : 'text-yellow-600'}`}>{result.attainment_pct}%</p></div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200"><p className="text-[10px] text-emerald-600 uppercase">Payout</p><p className="text-sm font-bold text-emerald-600">{(result.total_payout||0).toLocaleString()}</p></div>
              </div>
              <div className="space-y-1">{(result.breakdown||[]).map((item, idx) => (<div key={idx} className="flex justify-between text-xs py-1.5 border-b last:border-0"><span className="text-gray-500">{item.label}</span><span className="text-emerald-600 font-semibold font-mono">{(item.amount||0).toLocaleString()}</span></div>))}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
