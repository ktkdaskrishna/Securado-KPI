import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Target, Plus, TrendingUp, TrendingDown, Trophy, ChevronRight,
  Building2, Users, User, Trash2, ArrowUpRight, BarChart2, Minus
} from 'lucide-react';
import { toast } from 'sonner';

const statusConfig = {
  active: { label: 'Active', class: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  achieved: { label: 'Achieved', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  missed: { label: 'Missed', class: 'bg-red-500/10 text-red-400 border-red-500/30' },
  draft: { label: 'Draft', class: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
  cancelled: { label: 'Cancelled', class: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
};

const deptIcons = {
  company: Building2,
  product: Target,
  sales: TrendingUp,
  presales: Users,
};

function SummaryCards({ summary }) {
  const cards = [
    { label: 'Total Target Value', value: `OMR ${(summary.total_target_value || 0).toLocaleString()}`, icon: Target, color: 'text-blue-400' },
    { label: 'Total Achieved', value: `OMR ${(summary.total_achieved_value || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Achievement', value: `${summary.overall_achievement_pct || 0}%`, icon: BarChart2, color: summary.overall_achievement_pct >= 80 ? 'text-emerald-400' : 'text-yellow-400' },
    { label: 'Active Targets', value: summary.active || 0, icon: ArrowUpRight, color: 'text-blue-400' },
    { label: 'Achieved', value: summary.achieved || 0, icon: Trophy, color: 'text-emerald-400' },
    { label: 'At Risk', value: summary.at_risk || 0, icon: TrendingDown, color: 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="summary-cards">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={i} className="bg-[#1a1a1a] border-[#333] hover:border-[#800000]/50 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-xs text-gray-400">{c.label}</span>
              </div>
              <p className="text-lg font-bold text-white">{c.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TargetCard({ target, onDelete, onUpdateProgress }) {
  const [editing, setEditing] = useState(false);
  const [newVal, setNewVal] = useState(target.current_value || 0);
  const progress = target.progress_pct || 0;
  const status = statusConfig[target.status] || statusConfig.active;
  const DeptIcon = deptIcons[target.department] || Target;

  const handleSave = () => {
    onUpdateProgress(target.id, parseFloat(newVal));
    setEditing(false);
  };

  return (
    <Card className="bg-[#1a1a1a] border-[#333] hover:border-[#800000]/40 transition-all" data-testid={`target-card-${target.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <DeptIcon className="h-4 w-4 text-[#800000] shrink-0" />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-white truncate">{target.name}</h4>
              {target.assigned_to_name && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <User className="h-3 w-3" /> {target.assigned_to_name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className={status.class}>{status.label}</Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-red-400" onClick={() => onDelete(target.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Progress</span>
            <span className="text-white font-medium">{progress}%</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2 bg-[#333]" />

          <div className="flex justify-between text-xs mt-2">
            <span className="text-gray-400">
              {editing ? (
                <div className="flex items-center gap-1">
                  <Input type="number" value={newVal} onChange={e => setNewVal(e.target.value)}
                    className="h-6 w-24 text-xs bg-[#222] border-[#444] text-white" />
                  <Button size="sm" className="h-6 text-xs bg-[#800000]" onClick={handleSave}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditing(false)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button onClick={() => { setEditing(true); setNewVal(target.current_value || 0); }}
                  className="hover:text-white transition-colors">
                  Current: <span className="text-white">{(target.current_value || 0).toLocaleString()}</span> {target.target_unit}
                </button>
              )}
            </span>
            <span className="text-gray-400">
              Target: <span className="text-white">{(target.target_value || 0).toLocaleString()}</span> {target.target_unit}
            </span>
          </div>

          {target.product_name && (
            <p className="text-xs text-[#800000] mt-1">Product: {target.product_name}</p>
          )}
          {target.period_type && (
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">
              {target.period_type} | {target.start_date || 'N/A'} - {target.end_date || 'N/A'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardTable({ leaderboard }) {
  if (!leaderboard.length) return <p className="text-gray-500 text-sm text-center py-4">No leaderboard data</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#333] hover:bg-transparent">
          <TableHead className="text-gray-400 w-10">#</TableHead>
          <TableHead className="text-gray-400">Name</TableHead>
          <TableHead className="text-gray-400 text-right">Target</TableHead>
          <TableHead className="text-gray-400 text-right">Achieved</TableHead>
          <TableHead className="text-gray-400 text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leaderboard.map((entry, idx) => (
          <TableRow key={entry.user_id} className="border-[#333] hover:bg-[#222]" data-testid={`leaderboard-row-${idx}`}>
            <TableCell className="text-white font-bold">
              {idx === 0 ? <Trophy className="h-4 w-4 text-yellow-400" /> : idx + 1}
            </TableCell>
            <TableCell className="text-white font-medium">{entry.user_name}</TableCell>
            <TableCell className="text-gray-400 text-right">{entry.total_target.toLocaleString()}</TableCell>
            <TableCell className="text-white text-right">{entry.total_achieved.toLocaleString()}</TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className={
                entry.achievement_pct >= 100 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                entry.achievement_pct >= 80 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                entry.achievement_pct >= 50 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                'bg-red-500/10 text-red-400 border-red-500/30'
              }>{entry.achievement_pct}%</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CreateTargetDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '', target_type: 'revenue', target_value: 0,
    target_unit: 'OMR', period_type: 'quarterly', department: 'sales',
    start_date: '', end_date: '', assigned_to_name: '', product_name: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.target_value) {
      toast.error('Name and target value are required');
      return;
    }
    setSubmitting(true);
    try {
      await targetAPI.createSalesTarget(form);
      toast.success('Target created');
      onCreated();
      onClose();
      setForm({ name: '', description: '', target_type: 'revenue', target_value: 0, target_unit: 'OMR', period_type: 'quarterly', department: 'sales', start_date: '', end_date: '', assigned_to_name: '', product_name: '' });
    } catch {
      toast.error('Failed to create target');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-[#333] text-white max-w-lg" data-testid="create-target-dialog">
        <DialogHeader>
          <DialogTitle className="text-white">Create Sales Target</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label className="text-gray-300 text-xs">Name</Label>
            <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
              className="bg-[#222] border-[#444] text-white" placeholder="Q1 Revenue Target" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-xs">Target Type</Label>
              <Select value={form.target_type} onValueChange={v => setForm(p => ({...p, target_type: v}))}>
                <SelectTrigger className="bg-[#222] border-[#444] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#222] border-[#444]">
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="activity">Activity</SelectItem>
                  <SelectItem value="composite">Composite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Department</Label>
              <Select value={form.department} onValueChange={v => setForm(p => ({...p, department: v}))}>
                <SelectTrigger className="bg-[#222] border-[#444] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#222] border-[#444]">
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="presales">Pre-Sales</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-xs">Target Value</Label>
              <Input type="number" value={form.target_value} onChange={e => setForm(p => ({...p, target_value: parseFloat(e.target.value) || 0}))}
                className="bg-[#222] border-[#444] text-white" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Unit</Label>
              <Select value={form.target_unit} onValueChange={v => setForm(p => ({...p, target_unit: v}))}>
                <SelectTrigger className="bg-[#222] border-[#444] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#222] border-[#444]">
                  <SelectItem value="OMR">OMR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="%">%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-xs">Period</Label>
              <Select value={form.period_type} onValueChange={v => setForm(p => ({...p, period_type: v}))}>
                <SelectTrigger className="bg-[#222] border-[#444] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#222] border-[#444]">
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Assigned To</Label>
              <Input value={form.assigned_to_name} onChange={e => setForm(p => ({...p, assigned_to_name: e.target.value}))}
                className="bg-[#222] border-[#444] text-white" placeholder="Person name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-xs">Start Date</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(p => ({...p, start_date: e.target.value}))}
                className="bg-[#222] border-[#444] text-white" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs">End Date</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(p => ({...p, end_date: e.target.value}))}
                className="bg-[#222] border-[#444] text-white" />
            </div>
          </div>
          {form.target_type === 'product' && (
            <div>
              <Label className="text-gray-300 text-xs">Product Name</Label>
              <Input value={form.product_name} onChange={e => setForm(p => ({...p, product_name: e.target.value}))}
                className="bg-[#222] border-[#444] text-white" placeholder="Product name" />
            </div>
          )}
          <div>
            <Label className="text-gray-300 text-xs">Description</Label>
            <Input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
              className="bg-[#222] border-[#444] text-white" placeholder="Optional description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#444] text-gray-300">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919]" data-testid="create-target-submit">
            {submitting ? 'Creating...' : 'Create Target'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TargetManagementPage() {
  const [targets, setTargets] = useState([]);
  const [summary, setSummary] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('quarterly');
  const [deptFilter, setDeptFilter] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const loadData = useCallback(async () => {
    try {
      const params = { period_type: periodFilter };
      if (deptFilter) params.department = deptFilter;

      const [targetsRes, summaryRes, leaderboardRes] = await Promise.all([
        targetAPI.listSalesTargets(params),
        targetAPI.getTargetsSummary({ period_type: periodFilter }),
        targetAPI.getTargetLeaderboard({ period_type: periodFilter, department: deptFilter || undefined }),
      ]);
      setTargets(targetsRes.data);
      setSummary(summaryRes.data);
      setLeaderboard(leaderboardRes.data);
    } catch {
      toast.error('Failed to load targets');
    } finally {
      setLoading(false);
    }
  }, [periodFilter, deptFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (id) => {
    try {
      await targetAPI.deleteSalesTarget(id);
      toast.success('Target deleted');
      loadData();
    } catch {
      toast.error('Failed to delete target');
    }
  };

  const handleUpdateProgress = async (id, value) => {
    try {
      await targetAPI.updateTargetProgress(id, value);
      toast.success('Progress updated');
      loadData();
    } catch {
      toast.error('Failed to update progress');
    }
  };

  // Group targets by department
  const grouped = targets.reduce((acc, t) => {
    const dept = t.department || 'other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(t);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-4 p-6" data-testid="target-management-loading">
        {[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-[#222]" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto" data-testid="target-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="h-6 w-6 text-[#800000]" /> Target Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">Assign, track, and cascade sales targets across your organization</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-32 bg-[#222] border-[#444] text-white" data-testid="period-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#222] border-[#444]">
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setDialogOpen(true)} className="bg-[#800000] hover:bg-[#9a1919]" data-testid="create-target-btn">
            <Plus className="h-4 w-4 mr-1" /> New Target
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={summary} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#222] border border-[#333]">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">Overview</TabsTrigger>
          <TabsTrigger value="leaderboard" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">Leaderboard</TabsTrigger>
          <TabsTrigger value="by-department" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">By Department</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {targets.map(t => (
              <TargetCard key={t.id} target={t} onDelete={handleDelete} onUpdateProgress={handleUpdateProgress} />
            ))}
          </div>
          {targets.length === 0 && (
            <Card className="bg-[#1a1a1a] border-[#333]">
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No targets found. Create your first target to get started.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <Card className="bg-[#1a1a1a] border-[#333]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" /> Target Achievement Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeaderboardTable leaderboard={leaderboard} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-department" className="mt-4 space-y-6">
          {Object.entries(grouped).map(([dept, deptTargets]) => {
            const DIcon = deptIcons[dept] || Target;
            return (
              <div key={dept}>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <DIcon className="h-4 w-4 text-[#800000]" /> {dept}
                  <Badge variant="outline" className="text-gray-400 border-[#444]">{deptTargets.length}</Badge>
                </h3>
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {deptTargets.map(t => (
                    <TargetCard key={t.id} target={t} onDelete={handleDelete} onUpdateProgress={handleUpdateProgress} />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      <CreateTargetDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={loadData} />
    </div>
  );
}
