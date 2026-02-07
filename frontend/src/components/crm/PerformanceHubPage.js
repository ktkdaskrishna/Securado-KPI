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
import { Separator } from '../ui/separator';
import {
  Target, Plus, TrendingUp, TrendingDown, Trophy, Users, User, Trash2,
  ArrowUpRight, BarChart2, Activity, Phone, Mail, Calendar, Monitor,
  FlaskConical, Presentation, Building2, DollarSign, Calculator, Zap,
  ChevronDown, ChevronRight, Crosshair, Layers, Award, Minus, PieChart
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie } from 'recharts';
import { toast } from 'sonner';

// ==================== CONSTANTS ====================
const activityIcons = { call: Phone, email: Mail, meeting: Calendar, demo: Monitor, poc: FlaskConical, workshop: Presentation };
const activityColors = { call: '#3b82f6', email: '#8b5cf6', meeting: '#10b981', demo: '#f59e0b', poc: '#ef4444', workshop: '#06b6d4' };

const statusConfig = {
  active: { label: 'Active', class: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  achieved: { label: 'Achieved', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  missed: { label: 'Missed', class: 'bg-red-500/10 text-red-400 border-red-500/30' },
  draft: { label: 'Draft', class: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
  in_progress: { label: 'In Progress', class: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  on_track: { label: 'On Track', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  at_risk: { label: 'At Risk', class: 'bg-red-500/10 text-red-400 border-red-500/30' },
  completed: { label: 'Completed', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
};

// ==================== METRIC CARD ====================
function MetricCard({ label, value, subValue, icon: Icon, color = 'text-blue-400', trend, className = '' }) {
  return (
    <div className={`p-4 rounded-xl bg-[#111] border border-[#222] ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">{label}</span>
        {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
      </div>
      <p className={`text-xl font-bold text-white leading-tight`}>{value}</p>
      {subValue && <p className="text-[11px] text-gray-500 mt-0.5">{subValue}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-0.5 mt-1 text-[11px] ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend >= 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  );
}

// ==================== REVENUE TARGET ROW ====================
function RevenueTargetRow({ target, depth = 0, onUpdate, onDelete, children: childTargets }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [editing, setEditing] = useState(false);
  const [newVal, setNewVal] = useState(target.current_value || 0);
  const progress = target.target_value > 0 ? Math.min(100, ((target.current_value || 0) / target.target_value) * 100) : 0;
  const hasChildren = childTargets && childTargets.length > 0;
  const status = statusConfig[target.status] || statusConfig.active;

  const progressColor = progress >= 100 ? 'bg-emerald-500' : progress >= 70 ? 'bg-blue-500' : progress >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  const handleSave = () => {
    onUpdate(target.id, parseFloat(newVal));
    setEditing(false);
  };

  return (
    <>
      <TableRow className={`border-[#222] hover:bg-[#111] ${depth === 0 ? 'bg-[#0a0a0a]' : ''}`} data-testid={`target-row-${target.id}`}>
        <TableCell className="py-2">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 24}px` }}>
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="p-0.5 rounded hover:bg-[#222] text-gray-500">
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : <span className="w-5" />}
            <div className="min-w-0">
              <p className={`text-sm text-white truncate ${depth === 0 ? 'font-semibold' : 'font-medium'}`}>{target.name}</p>
              {target.product_name && <p className="text-[10px] text-[#800000]">{target.product_name}</p>}
            </div>
          </div>
        </TableCell>
        <TableCell className="py-2">
          {target.assigned_to_name ? (
            <span className="text-xs text-gray-300 flex items-center gap-1"><User className="h-3 w-3 text-gray-500" />{target.assigned_to_name}</span>
          ) : (
            <span className="text-xs text-gray-600">{target.department || '-'}</span>
          )}
        </TableCell>
        <TableCell className="py-2 text-right">
          <span className="text-sm text-white font-mono">{(target.target_value || 0).toLocaleString()}</span>
          <span className="text-[10px] text-gray-500 ml-1">{target.target_unit || 'OMR'}</span>
        </TableCell>
        <TableCell className="py-2 text-right">
          {editing ? (
            <div className="flex items-center gap-1 justify-end">
              <Input type="number" value={newVal} onChange={e => setNewVal(e.target.value)} className="h-6 w-20 text-xs bg-[#111] border-[#333] text-white text-right" />
              <Button size="sm" className="h-6 text-[10px] bg-[#800000] px-2" onClick={handleSave}>OK</Button>
              <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-white"><Minus className="h-3 w-3" /></button>
            </div>
          ) : (
            <button onClick={() => { setEditing(true); setNewVal(target.current_value || 0); }}
              className="text-sm text-white font-mono hover:text-[#800000] transition-colors">
              {(target.current_value || 0).toLocaleString()}
            </button>
          )}
        </TableCell>
        <TableCell className="py-2">
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-[#222] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${progressColor} transition-all`} style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <span className={`text-xs font-medium min-w-[36px] text-right ${progress >= 100 ? 'text-emerald-400' : progress >= 70 ? 'text-blue-400' : progress >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
              {progress.toFixed(0)}%
            </span>
          </div>
        </TableCell>
        <TableCell className="py-2">
          <Badge variant="outline" className={`text-[10px] ${status.class}`}>{status.label}</Badge>
        </TableCell>
        <TableCell className="py-2 text-right">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-600 hover:text-red-400" onClick={() => onDelete(target.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </TableCell>
      </TableRow>
      {expanded && hasChildren && childTargets.map(child => (
        <RevenueTargetRow key={child.id} target={child} depth={depth + 1} onUpdate={onUpdate} onDelete={onDelete}
          childTargets={(child.children || []).length > 0 ? child.children : undefined} />
      ))}
    </>
  );
}

// ==================== CREATE TARGET DIALOG ====================
function CreateTargetDialog({ open, onClose, onCreated, existingTargets = [] }) {
  const [form, setForm] = useState({
    name: '', description: '', target_type: 'revenue', target_value: 0,
    target_unit: 'OMR', period_type: 'quarterly', department: 'sales',
    start_date: '2026-01-01', end_date: '2026-03-31', assigned_to_name: '',
    product_name: '', parent_target_id: ''
  });
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
      onCreated();
      onClose();
    } catch { toast.error('Failed to create'); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-[#333] text-white max-w-lg" data-testid="create-target-dialog">
        <DialogHeader><DialogTitle className="text-white">Create Revenue / Activity Target</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label className="text-gray-400 text-[11px] uppercase">Name</Label>
            <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="bg-[#0a0a0a] border-[#333] text-white h-9" placeholder="Q1 Revenue - Product Manager A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Type</Label>
              <Select value={form.target_type} onValueChange={v => setForm(p => ({...p, target_type: v}))}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="product">Product-Specific</SelectItem>
                  <SelectItem value="activity">Activity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Department</Label>
              <Select value={form.department} onValueChange={v => setForm(p => ({...p, department: v}))}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="presales">Pre-Sales</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Target Value</Label>
              <Input type="number" value={form.target_value} onChange={e => setForm(p => ({...p, target_value: parseFloat(e.target.value) || 0}))} className="bg-[#0a0a0a] border-[#333] text-white h-9" />
            </div>
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Unit</Label>
              <Select value={form.target_unit} onValueChange={v => setForm(p => ({...p, target_unit: v}))}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  <SelectItem value="OMR">OMR</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="count">Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Period</Label>
              <Select value={form.period_type} onValueChange={v => setForm(p => ({...p, period_type: v}))}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  <SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Assigned To (Name)</Label>
              <Input value={form.assigned_to_name} onChange={e => setForm(p => ({...p, assigned_to_name: e.target.value}))} className="bg-[#0a0a0a] border-[#333] text-white h-9" placeholder="Product Manager name" />
            </div>
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Parent Target</Label>
              <Select value={form.parent_target_id || '_none'} onValueChange={v => setForm(p => ({...p, parent_target_id: v === '_none' ? '' : v}))}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white h-9"><SelectValue placeholder="None (Top-level)" /></SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  <SelectItem value="_none">None (Top-level)</SelectItem>
                  {parentTargets.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(form.target_type === 'product') && (
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Product / Solution Category</Label>
              <Input value={form.product_name} onChange={e => setForm(p => ({...p, product_name: e.target.value}))} className="bg-[#0a0a0a] border-[#333] text-white h-9" placeholder="AI Security Suite" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Start</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(p => ({...p, start_date: e.target.value}))} className="bg-[#0a0a0a] border-[#333] text-white h-9" />
            </div>
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">End</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(p => ({...p, end_date: e.target.value}))} className="bg-[#0a0a0a] border-[#333] text-white h-9" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#333] text-gray-400 h-9">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] h-9" data-testid="create-target-submit">
            {submitting ? 'Creating...' : 'Create Target'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== CREATE ACTIVITY TARGET DIALOG ====================
function CreateActivityDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', activity_type: 'call', target_count: 10, period_type: 'monthly',
    assigned_to_name: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    setSubmitting(true);
    try {
      await targetAPI.createActivityTarget(form);
      toast.success('Activity target created');
      onCreated();
      onClose();
    } catch { toast.error('Failed'); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-[#333] text-white max-w-md" data-testid="create-activity-dialog">
        <DialogHeader><DialogTitle className="text-white">Create Activity Target</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-gray-400 text-[11px] uppercase">Name</Label>
            <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="bg-[#0a0a0a] border-[#333] text-white h-9" placeholder="Outbound Calls - Ahmed" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Activity Type</Label>
              <Select value={form.activity_type} onValueChange={v => setForm(p => ({...p, activity_type: v}))}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  <SelectItem value="call">Calls</SelectItem><SelectItem value="email">Emails</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem><SelectItem value="demo">Demos</SelectItem>
                  <SelectItem value="poc">POCs</SelectItem><SelectItem value="workshop">Workshops</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-[11px] uppercase">Target Count</Label>
              <Input type="number" value={form.target_count} onChange={e => setForm(p => ({...p, target_count: parseInt(e.target.value) || 0}))} className="bg-[#0a0a0a] border-[#333] text-white h-9" />
            </div>
          </div>
          <div>
            <Label className="text-gray-400 text-[11px] uppercase">Assigned To</Label>
            <Input value={form.assigned_to_name} onChange={e => setForm(p => ({...p, assigned_to_name: e.target.value}))} className="bg-[#0a0a0a] border-[#333] text-white h-9" placeholder="Person name" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#333] text-gray-400 h-9">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] h-9">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== MAIN PAGE ====================
export default function PerformanceHubPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('revenue');
  const [periodFilter, setPeriodFilter] = useState('quarterly');

  // Revenue data
  const [targets, setTargets] = useState([]);
  const [summary, setSummary] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);

  // Activity data
  const [activityTargets, setActivityTargets] = useState([]);
  const [activitySummary, setActivitySummary] = useState({});
  const [scoreboard, setScoreboard] = useState([]);

  // Goals/KPIs data
  const [goals, setGoals] = useState([]);
  const [kpis, setKpis] = useState([]);

  // Dialogs
  const [showCreateTarget, setShowCreateTarget] = useState(false);
  const [showCreateActivity, setShowCreateActivity] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        targetAPI.listSalesTargets({ period_type: periodFilter }),
        targetAPI.getTargetsSummary({ period_type: periodFilter }),
        targetAPI.getTargetLeaderboard({ period_type: periodFilter }),
        targetAPI.listActivityTargets({ period_type: periodFilter === 'quarterly' ? 'monthly' : periodFilter }),
        targetAPI.getActivityTargetsSummary({ period_type: periodFilter === 'quarterly' ? 'monthly' : periodFilter }),
        targetAPI.getActivityScoreboard({ period_type: periodFilter === 'quarterly' ? 'monthly' : periodFilter }),
        crmAPI.listGoals(),
        crmAPI.listKPIs(),
      ]);

      if (results[0].status === 'fulfilled') setTargets(results[0].value.data);
      if (results[1].status === 'fulfilled') setSummary(results[1].value.data);
      if (results[2].status === 'fulfilled') setLeaderboard(results[2].value.data);
      if (results[3].status === 'fulfilled') setActivityTargets(results[3].value.data);
      if (results[4].status === 'fulfilled') setActivitySummary(results[4].value.data);
      if (results[5].status === 'fulfilled') setScoreboard(results[5].value.data);
      if (results[6].status === 'fulfilled') setGoals(results[6].value.data);
      if (results[7].status === 'fulfilled') setKpis(results[7].value.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdateProgress = async (id, value) => {
    try {
      await targetAPI.updateTargetProgress(id, value);
      toast.success('Progress updated');
      loadData();
    } catch { toast.error('Failed to update'); }
  };

  const handleDeleteTarget = async (id) => {
    try {
      await targetAPI.deleteSalesTarget(id);
      toast.success('Deleted');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const handleLogActivity = async (id) => {
    try {
      await targetAPI.logActivityCount(id, 1);
      loadData();
    } catch { toast.error('Failed'); }
  };

  const handleDeleteActivity = async (id) => {
    try {
      await targetAPI.deleteActivityTarget(id);
      toast.success('Deleted');
      loadData();
    } catch { toast.error('Failed'); }
  };

  // Build hierarchy for revenue targets table
  const buildHierarchy = () => {
    const map = {};
    targets.forEach(t => { map[t.id] = { ...t, children: [] }; });
    const roots = [];
    targets.forEach(t => {
      if (t.parent_target_id && map[t.parent_target_id]) {
        map[t.parent_target_id].children.push(map[t.id]);
      } else {
        roots.push(map[t.id]);
      }
    });
    return roots;
  };

  // Department breakdown for pie chart
  const deptData = Object.entries(summary.by_department || {}).map(([dept, data]) => ({
    name: dept.charAt(0).toUpperCase() + dept.slice(1),
    value: data.target,
    achieved: data.achieved,
  }));

  const DEPT_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  if (loading) {
    return (
      <div className="space-y-4 p-6" data-testid="performance-hub-loading">
        <Skeleton className="h-8 w-64 bg-[#222]" />
        <div className="grid grid-cols-5 gap-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 bg-[#222]" />)}</div>
        <Skeleton className="h-96 bg-[#222]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6 max-w-[1600px] mx-auto" data-testid="performance-hub-page">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-[#800000]" /> Performance Hub
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Revenue targets, activity tracking, leaderboard & incentives in one view</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-28 h-8 bg-[#111] border-[#333] text-white text-xs" data-testid="hub-period-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#111] border-[#333]">
              <SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreateTarget(true)} className="bg-[#800000] hover:bg-[#9a1919] h-8 text-xs" data-testid="hub-create-target">
            <Plus className="h-3.5 w-3.5 mr-1" /> Revenue Target
          </Button>
          <Button onClick={() => setShowCreateActivity(true)} variant="outline" className="border-[#333] text-gray-300 h-8 text-xs" data-testid="hub-create-activity">
            <Plus className="h-3.5 w-3.5 mr-1" /> Activity Target
          </Button>
        </div>
      </div>

      {/* TOP METRICS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <MetricCard label="Total Target" value={`OMR ${(summary.total_target_value || 0).toLocaleString()}`} icon={Target} color="text-blue-400" />
        <MetricCard label="Achieved" value={`OMR ${(summary.total_achieved_value || 0).toLocaleString()}`} icon={TrendingUp} color="text-emerald-400" />
        <MetricCard label="Attainment" value={`${summary.overall_achievement_pct || 0}%`} icon={BarChart2}
          color={summary.overall_achievement_pct >= 80 ? 'text-emerald-400' : 'text-yellow-400'} />
        <MetricCard label="Active / At Risk" value={`${summary.active || 0} / ${summary.at_risk || 0}`} icon={ArrowUpRight} color="text-orange-400" />
        <MetricCard label="Activities Done" value={`${activitySummary.total_actual_count || 0} / ${activitySummary.total_target_count || 0}`}
          subValue={`${activitySummary.overall_achievement_pct || 0}% complete`} icon={Activity} color="text-purple-400" />
        <MetricCard label="Team Members" value={leaderboard.length || 0} icon={Users} color="text-cyan-400" />
      </div>

      {/* MAIN CONTENT TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#111] border border-[#222] h-9">
          <TabsTrigger value="revenue" className="text-xs data-[state=active]:bg-[#800000] data-[state=active]:text-white h-7">Revenue Targets</TabsTrigger>
          <TabsTrigger value="activities" className="text-xs data-[state=active]:bg-[#800000] data-[state=active]:text-white h-7">Activity Tracker</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs data-[state=active]:bg-[#800000] data-[state=active]:text-white h-7">Leaderboard</TabsTrigger>
          <TabsTrigger value="incentives" className="text-xs data-[state=active]:bg-[#800000] data-[state=active]:text-white h-7">Incentives</TabsTrigger>
        </TabsList>

        {/* ============ REVENUE TARGETS TAB ============ */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Revenue Table (3/4 width) */}
            <Card className="bg-[#0d0d0d] border-[#222] lg:col-span-3">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#800000]" /> Revenue Target Hierarchy
                  <Badge variant="outline" className="text-[10px] border-[#333] text-gray-500 ml-2">{targets.length} targets</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#222] hover:bg-transparent">
                      <TableHead className="text-gray-500 text-[11px] uppercase py-2">Target</TableHead>
                      <TableHead className="text-gray-500 text-[11px] uppercase py-2">Owner</TableHead>
                      <TableHead className="text-gray-500 text-[11px] uppercase py-2 text-right">Target</TableHead>
                      <TableHead className="text-gray-500 text-[11px] uppercase py-2 text-right">Actual</TableHead>
                      <TableHead className="text-gray-500 text-[11px] uppercase py-2">Progress</TableHead>
                      <TableHead className="text-gray-500 text-[11px] uppercase py-2">Status</TableHead>
                      <TableHead className="text-gray-500 text-[11px] uppercase py-2 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buildHierarchy().map(root => (
                      <RevenueTargetRow key={root.id} target={root} onUpdate={handleUpdateProgress} onDelete={handleDeleteTarget}
                        childTargets={root.children} />
                    ))}
                    {targets.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-600">No targets. Click "Revenue Target" to create one.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Right sidebar: Dept breakdown */}
            <div className="space-y-4">
              <Card className="bg-[#0d0d0d] border-[#222]">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-white text-sm flex items-center gap-2"><PieChart className="h-4 w-4 text-[#800000]" /> By Department</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  {deptData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <RePieChart>
                          <Pie data={deptData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2}>
                            {deptData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                        </RePieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {deptData.map((d, i) => (
                          <div key={d.name} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                              <span className="text-gray-400">{d.name}</span>
                            </span>
                            <span className="text-white font-mono">{d.value?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-gray-600 text-xs text-center py-4">No dept data</p>}
                </CardContent>
              </Card>

              {/* Quick KPIs */}
              <Card className="bg-[#0d0d0d] border-[#222]">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-white text-sm">Goals & KPIs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                  {goals.slice(0, 4).map(g => {
                    const pct = g.target_value > 0 ? Math.min(100, (g.current_value / g.target_value) * 100) : 0;
                    return (
                      <div key={g.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 truncate flex-1 mr-2">{g.name}</span>
                        <span className={`font-medium ${pct >= 100 ? 'text-emerald-400' : 'text-white'}`}>{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                  {kpis.slice(0, 4).map(k => {
                    const pct = k.target_value > 0 ? Math.min(100, (k.current_value / k.target_value) * 100) : 0;
                    return (
                      <div key={k.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 truncate flex-1 mr-2">{k.name}</span>
                        <span className={`font-medium ${pct >= 100 ? 'text-emerald-400' : 'text-white'}`}>{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                  {goals.length === 0 && kpis.length === 0 && <p className="text-gray-600 text-xs text-center py-2">No goals/KPIs set</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ============ ACTIVITY TRACKER TAB ============ */}
        <TabsContent value="activities" className="mt-4 space-y-4">
          {/* Activity type cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {Object.entries(activitySummary.by_type || {}).map(([type, data]) => {
              const Icon = activityIcons[type] || Activity;
              const pct = data.achievement_pct || 0;
              return (
                <div key={type} className="p-3 rounded-xl bg-[#111] border border-[#222]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5" style={{ color: activityColors[type] }} />
                    <span className="text-[11px] text-gray-500 uppercase">{type}s</span>
                  </div>
                  <p className="text-lg font-bold text-white">{data.actual_count}<span className="text-gray-600 text-sm font-normal">/{data.target_count}</span></p>
                  <div className="w-full h-1 bg-[#222] rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: activityColors[type] }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chart + Scoreboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart */}
            <Card className="bg-[#0d0d0d] border-[#222]">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-white text-sm">Target vs Actual</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={Object.entries(activitySummary.by_type || {}).map(([t, d]) => ({ name: t, target: d.target_count, actual: d.actual_count, color: activityColors[t] }))} barGap={2}>
                    <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                    <Bar dataKey="target" fill="#222" radius={[3, 3, 0, 0]} name="Target" />
                    <Bar dataKey="actual" radius={[3, 3, 0, 0]} name="Actual">
                      {Object.entries(activitySummary.by_type || {}).map(([t], i) => <Cell key={i} fill={activityColors[t] || '#666'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Scoreboard */}
            <Card className="bg-[#0d0d0d] border-[#222]">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-white text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-400" /> Activity Scoreboard</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#222]">
                      <TableHead className="text-gray-500 text-[11px] w-8">#</TableHead>
                      <TableHead className="text-gray-500 text-[11px]">Name</TableHead>
                      <TableHead className="text-gray-500 text-[11px] text-right">Done</TableHead>
                      <TableHead className="text-gray-500 text-[11px] text-right">Score</TableHead>
                      <TableHead className="text-gray-500 text-[11px]">Breakdown</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoreboard.map((s, idx) => (
                      <TableRow key={s.user_id} className="border-[#222] hover:bg-[#111]">
                        <TableCell className="py-1.5">{idx === 0 ? <Trophy className="h-3.5 w-3.5 text-yellow-400" /> : <span className="text-gray-500 text-xs">{idx + 1}</span>}</TableCell>
                        <TableCell className="text-white text-xs font-medium py-1.5">{s.user_name}</TableCell>
                        <TableCell className="text-white text-xs text-right py-1.5">{s.total_actual}</TableCell>
                        <TableCell className="text-right py-1.5">
                          <span className={`text-xs font-medium ${s.achievement_pct >= 100 ? 'text-emerald-400' : s.achievement_pct >= 70 ? 'text-blue-400' : 'text-red-400'}`}>{s.achievement_pct}%</span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex gap-0.5 flex-wrap">
                            {Object.entries(s.activities || {}).map(([type, data]) => {
                              const Icon = activityIcons[type] || Activity;
                              return <span key={type} className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-[#1a1a1a] text-gray-400">
                                <Icon className="h-2.5 w-2.5" style={{ color: activityColors[type] }} />{data.actual}/{data.target}
                              </span>;
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {scoreboard.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-600 text-xs">No scoreboard data</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* All activity targets table */}
          <Card className="bg-[#0d0d0d] border-[#222]">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-white text-sm">All Activity Targets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-gray-500 text-[11px]">Activity</TableHead>
                    <TableHead className="text-gray-500 text-[11px]">Assigned To</TableHead>
                    <TableHead className="text-gray-500 text-[11px]">Type</TableHead>
                    <TableHead className="text-gray-500 text-[11px] text-right">Progress</TableHead>
                    <TableHead className="text-gray-500 text-[11px] text-right">%</TableHead>
                    <TableHead className="text-gray-500 text-[11px] w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityTargets.map(t => {
                    const Icon = activityIcons[t.activity_type] || Activity;
                    const pct = t.progress_pct || 0;
                    return (
                      <TableRow key={t.id} className="border-[#222] hover:bg-[#111]">
                        <TableCell className="py-1.5"><div className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" style={{ color: activityColors[t.activity_type] }} /><span className="text-white text-xs">{t.name}</span></div></TableCell>
                        <TableCell className="text-gray-400 text-xs py-1.5">{t.assigned_to_name || '-'}</TableCell>
                        <TableCell className="py-1.5"><Badge variant="outline" className="text-[9px] capitalize" style={{ borderColor: activityColors[t.activity_type], color: activityColors[t.activity_type] }}>{t.activity_type}</Badge></TableCell>
                        <TableCell className="text-right text-white text-xs py-1.5">{t.current_count || 0} / {t.target_count}</TableCell>
                        <TableCell className="text-right py-1.5"><span className={`text-xs ${pct >= 100 ? 'text-emerald-400' : pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</span></TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-6 text-[10px] border-[#333] text-gray-400 hover:bg-[#800000] hover:text-white hover:border-[#800000] px-2"
                              onClick={() => handleLogActivity(t.id)}>+1</Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-600 hover:text-red-400" onClick={() => handleDeleteActivity(t.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {activityTargets.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-600 text-xs">No activity targets</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ LEADERBOARD TAB ============ */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card className="bg-[#0d0d0d] border-[#222]">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-white text-sm flex items-center gap-2"><Award className="h-4 w-4 text-yellow-400" /> Revenue Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-gray-500 text-[11px] w-10">#</TableHead>
                    <TableHead className="text-gray-500 text-[11px]">Name</TableHead>
                    <TableHead className="text-gray-500 text-[11px] text-right">Target</TableHead>
                    <TableHead className="text-gray-500 text-[11px] text-right">Achieved</TableHead>
                    <TableHead className="text-gray-500 text-[11px]">Progress</TableHead>
                    <TableHead className="text-gray-500 text-[11px] text-right">Attainment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry, idx) => (
                    <TableRow key={entry.user_id} className={`border-[#222] hover:bg-[#111] ${idx < 3 ? 'bg-[#0a0a0a]' : ''}`} data-testid={`leaderboard-row-${idx}`}>
                      <TableCell className="py-2">
                        {idx === 0 ? <Trophy className="h-4 w-4 text-yellow-400" /> : idx === 1 ? <Trophy className="h-4 w-4 text-gray-400" /> : idx === 2 ? <Trophy className="h-4 w-4 text-amber-700" /> : <span className="text-gray-500 text-sm">{idx + 1}</span>}
                      </TableCell>
                      <TableCell className="py-2"><span className="text-white text-sm font-medium">{entry.user_name}</span></TableCell>
                      <TableCell className="py-2 text-right text-gray-400 text-sm font-mono">{entry.total_target.toLocaleString()}</TableCell>
                      <TableCell className="py-2 text-right text-white text-sm font-mono">{entry.total_achieved.toLocaleString()}</TableCell>
                      <TableCell className="py-2">
                        <div className="w-24 h-1.5 bg-[#222] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${entry.achievement_pct >= 100 ? 'bg-emerald-500' : entry.achievement_pct >= 70 ? 'bg-blue-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(entry.achievement_pct, 100)}%` }} />
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Badge variant="outline" className={`text-xs ${
                          entry.achievement_pct >= 100 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          entry.achievement_pct >= 80 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          entry.achievement_pct >= 50 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                          'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}>{entry.achievement_pct}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {leaderboard.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-600 text-sm">No leaderboard data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ INCENTIVES TAB ============ */}
        <TabsContent value="incentives" className="mt-4">
          <IncentivesSection targets={targets} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateTargetDialog open={showCreateTarget} onClose={() => setShowCreateTarget(false)} onCreated={loadData} existingTargets={targets} />
      <CreateActivityDialog open={showCreateActivity} onClose={() => setShowCreateActivity(false)} onCreated={loadData} />
    </div>
  );
}

// ==================== INLINE INCENTIVES SECTION ====================
function IncentivesSection({ targets }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    targetAPI.listIncentivePlans().then(r => setPlans(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCalc = async () => {
    if (!selectedTarget) { toast.error('Select a target'); return; }
    setCalculating(true);
    try {
      const res = await targetAPI.calculateIncentive({ target_id: selectedTarget });
      setResult(res.data);
    } catch { toast.error('Calculation failed'); } finally { setCalculating(false); }
  };

  const assignedTargets = targets.filter(t => t.assigned_to_name);

  return (
    <div className="space-y-4">
      {/* Plans summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {plans.map(plan => (
          <Card key={plan.id} className="bg-[#0d0d0d] border-[#222]">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-white mb-2">{plan.name}</h4>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="text-center p-1.5 rounded bg-[#111]">
                  <p className="text-[9px] text-gray-500">BASE</p>
                  <p className="text-xs font-bold text-white">{(plan.base_salary || 0).toLocaleString()}</p>
                </div>
                <div className="text-center p-1.5 rounded bg-[#111]">
                  <p className="text-[9px] text-gray-500">OTE</p>
                  <p className="text-xs font-bold text-white">{(plan.ote || 0).toLocaleString()}</p>
                </div>
                <div className="text-center p-1.5 rounded bg-[#111]">
                  <p className="text-[9px] text-gray-500">VARIABLE</p>
                  <p className="text-xs font-bold text-emerald-400">{((plan.ote || 0) * ((plan.pay_mix_variable || 40) / 100)).toLocaleString()}</p>
                </div>
              </div>
              <div className="space-y-0.5">
                {(plan.slabs || []).map((s, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="text-gray-500">{s.label || `${s.min_percent}-${s.max_percent}%`}</span>
                    <span className="text-white">{s.commission_rate}%</span>
                  </div>
                ))}
              </div>
              {(plan.spiffs?.length > 0 || plan.product_multipliers?.length > 0) && (
                <div className="flex gap-1 mt-2">
                  {plan.spiffs?.length > 0 && <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400"><Zap className="h-2 w-2 mr-0.5" />{plan.spiffs.length} SPIFFs</Badge>}
                  {plan.product_multipliers?.length > 0 && <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400"><ArrowUpRight className="h-2 w-2 mr-0.5" />{plan.product_multipliers.length} Multipliers</Badge>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && !loading && (
          <Card className="bg-[#0d0d0d] border-[#222] col-span-full"><CardContent className="p-6 text-center text-gray-600 text-xs">No incentive plans. Go to Incentives page to create one.</CardContent></Card>
        )}
      </div>

      {/* Calculator */}
      <Card className="bg-[#0d0d0d] border-[#222]">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-white text-sm flex items-center gap-2"><Calculator className="h-4 w-4 text-[#800000]" /> Quick Calculator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <Label className="text-gray-400 text-[11px] uppercase">Sales Target</Label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger className="bg-[#111] border-[#333] text-white h-9" data-testid="hub-calc-select"><SelectValue placeholder="Select a target" /></SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  {assignedTargets.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.assigned_to_name})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCalc} disabled={calculating} className="bg-[#800000] hover:bg-[#9a1919] h-9" data-testid="hub-calc-btn">
              <Calculator className="h-3.5 w-3.5 mr-1" /> {calculating ? '...' : 'Calculate'}
            </Button>
          </div>
          {result && (
            <div className="space-y-3" data-testid="hub-calc-result">
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2.5 rounded bg-[#111] border border-[#222]">
                  <p className="text-[9px] text-gray-500">TARGET</p>
                  <p className="text-sm font-bold text-white">{(result.target_value || 0).toLocaleString()}</p>
                </div>
                <div className="p-2.5 rounded bg-[#111] border border-[#222]">
                  <p className="text-[9px] text-gray-500">ACTUAL</p>
                  <p className="text-sm font-bold text-white">{(result.actual_value || 0).toLocaleString()}</p>
                </div>
                <div className="p-2.5 rounded bg-[#111] border border-[#222]">
                  <p className="text-[9px] text-gray-500">ATTAINMENT</p>
                  <p className={`text-sm font-bold ${result.attainment_pct >= 100 ? 'text-emerald-400' : 'text-yellow-400'}`}>{result.attainment_pct}%</p>
                </div>
                <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-[9px] text-emerald-400">PAYOUT</p>
                  <p className="text-sm font-bold text-emerald-400">{(result.total_payout || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="space-y-1">
                {(result.breakdown || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1 border-b border-[#222] last:border-0">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-emerald-400 font-mono">{(item.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
