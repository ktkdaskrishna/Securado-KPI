import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI, crmAPI } from '../../lib/api';
import { useRBAC } from '../../lib/RBACContext';
import { AdvancedFilterBuilder, FilterChipBar } from '../layout/AdvancedFilterBuilder';
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
import { ScrollArea } from '../ui/scroll-area';
import {
  Target, Plus, TrendingUp, Trophy, Users, Trash2, BarChart2, Activity, Phone, Mail, Calendar, Monitor, FlaskConical, Presentation, DollarSign, Calculator, ChevronDown, Crosshair, Award, FileText, AlertTriangle, CheckCircle2, Bell, User, ExternalLink, Clock, XCircle, Filter
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';

const actIcons = { Call: Phone, Email: Mail, Meeting: Calendar, Demo: Monitor, 'Proof of concept': FlaskConical, 'Work Shop': Presentation, 'Site Visit': Target, 'To Do': CheckCircle2, Task: FileText, 'Follow-up': Clock };
const actColors = { Call: '#3b82f6', Email: '#8b5cf6', Meeting: '#10b981', Demo: '#f59e0b', 'Proof of concept': '#ef4444', 'Work Shop': '#06b6d4', 'Site Visit': '#ec4899', 'To Do': '#6366f1', Task: '#84cc16' };

// ===== DRILLABLE POPUP =====
function DrillPopup({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[65vh]">{children}</ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ===== CLICKABLE METRIC CARD =====
function MetricCard({ label, value, subValue, icon: Icon, color = 'text-blue-600', bgColor = 'bg-blue-50', onClick }) {
  return (
    <Card className={`hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer hover:border-[#800000]/30' : ''}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500 font-medium">{label}</span>
          <div className={`p-1.5 rounded-full ${bgColor}`}>{Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}</div>
        </div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {subValue && <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>}
        {onClick && <p className="text-[10px] text-[#800000] mt-1 flex items-center gap-0.5"><ExternalLink className="h-2.5 w-2.5" /> Click to drill down</p>}
      </CardContent>
    </Card>
  );
}

// ===== MAIN PAGE =====
export default function PerformanceHubPage() {
  const { permissions } = useRBAC();
  const [loading, setLoading] = useState(true);
  const [myData, setMyData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [pmActuals, setPmActuals] = useState([]);
  const [collection, setCollection] = useState({});
  const [alertsData, setAlertsData] = useState({ alerts: [], summary: {} });
  const [productManagers, setProductManagers] = useState([]);
  const [solutionCats, setSolutionCats] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planItems, setPlanItems] = useState([]);
  const [redistributions, setRedistributions] = useState([]);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRedistribute, setShowRedistribute] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [drillData, setDrillData] = useState(null);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  // Filters
  const [yearFilter, setYearFilter] = useState('');
  const [pmFilter, setPmFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const isAdmin = permissions.includes('admin:*') || permissions.includes('system_admin');
  const isPD = myData?.is_product_director;
  const isSD = myData?.is_sales_director && !isPD;
  const isRep = myData?.is_sales_rep;
  const canManage = permissions.includes('manage_goals') || permissions.includes('admin:*');
  const showExecutiveTabs = isAdmin || isSD;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Build filter params for API calls
      const fParams = {};
      if (yearFilter && yearFilter !== 'all') fParams.year = yearFilter;
      if (pmFilter && pmFilter !== 'all') fParams.product_manager = pmFilter;

      const calls = [targetAPI.getMyData(), targetAPI.getAlerts(),
        targetAPI.getSolutionCategories(), targetAPI.getSalespersons(), targetAPI.getActivityTypes()];
      if (canManage) {
        const planParams = pmFilter && pmFilter !== 'all' ? { product_manager: pmFilter } : {};
        calls.push(
          targetAPI.listRevenuePlans(planParams),
          targetAPI.getActualsByPM(pmFilter && pmFilter !== 'all' ? { product_manager: pmFilter } : {}),
          targetAPI.getProductManagers()
        );
      }
      const results = await Promise.allSettled(calls);
      if (results[0].status === 'fulfilled') setMyData(results[0].value.data);
      if (results[1].status === 'fulfilled') setAlertsData(results[1].value.data);
      if (results[2]?.status === 'fulfilled') setSolutionCats(results[2].value.data);
      if (results[3]?.status === 'fulfilled') setSalespersons(results[3].value.data);
      if (results[4]?.status === 'fulfilled') setActivityTypes(results[4].value.data);
      if (canManage) {
        if (results[5]?.status === 'fulfilled') setPlans(results[5].value.data);
        if (results[6]?.status === 'fulfilled') setPmActuals(results[6].value.data);
        if (results[7]?.status === 'fulfilled') setProductManagers(results[7].value.data);
      }
      try {
        const collRes = await crmAPI.getReceivablesStats(yearFilter && yearFilter !== 'all' ? { year: yearFilter } : {});
        const stats = collRes.data?.stats || {};
        setCollection({
          by_state: {
            paid: { count: stats.count_paid || 0, amount: stats.total_paid || 0 },
            not_paid: { count: (stats.count_total || 0) - (stats.count_paid || 0) - (stats.count_pending || 0), amount: (stats.total_invoiced || 0) - (stats.total_paid || 0) - (stats.total_pending || 0) },
            pending: { count: stats.count_pending || 0, amount: stats.total_pending || 0 },
          },
          overdue_count: stats.count_overdue || 0, overdue_amount: stats.total_overdue || 0, total_invoices: stats.count_total || 0
        });
      } catch {}
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  }, [canManage, yearFilter, pmFilter, catFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadPlanDetails = useCallback(async (planId) => {
    if (!planId) return;
    try {
      const [itemsR, redistR] = await Promise.allSettled([targetAPI.listPlanItems(planId), targetAPI.listRedistributions(planId)]);
      if (itemsR.status === 'fulfilled') setPlanItems(itemsR.value.data);
      if (redistR.status === 'fulfilled') setRedistributions(redistR.value.data);
    } catch {}
  }, []);
  useEffect(() => { if (selectedPlan) loadPlanDetails(selectedPlan.id); }, [selectedPlan, loadPlanDetails]);

  const defaultTab = showExecutiveTabs ? 'ceo' : isPD ? 'myplan' : 'mytargets';
  const [tab, setTab] = useState(null);
  useEffect(() => { if (myData && !tab) setTab(defaultTab); }, [myData, defaultTab, tab]);

  // Drill handlers
  const drillOpps = async (params = {}) => {
    try {
      const p = { limit: 50, ...params };
      if (yearFilter && yearFilter !== 'all') p.year = yearFilter;
      if (pmFilter && pmFilter !== 'all') p.product_manager = pmFilter;
      if (catFilter && catFilter !== 'all') p.solution_category = catFilter;
      const res = await crmAPI.listOpportunities(p);
      const items = res.data?.items || res.data || [];
      const title = ['Opportunities', params.stage ? `(${params.stage})` : '', yearFilter && yearFilter !== 'all' ? `- ${yearFilter}` : ''].filter(Boolean).join(' ');
      setDrillData({ title, data: items, type: 'opportunities' });
    } catch { toast.error('Failed to load'); }
  };
  const drillActivities = async (status) => {
    try {
      const res = await crmAPI.listActivities({});
      let items = res.data || [];
      if (status === 'pending') items = items.filter(a => a.status === 'pending');
      else if (status === 'completed') items = items.filter(a => a.status === 'completed');
      else if (status === 'overdue') items = items.filter(a => a.status === 'pending' && a.due_date && a.due_date < new Date().toISOString().split('T')[0]);
      setDrillData({ title: `Activities - ${status || 'All'}`, data: items, type: 'activities' });
    } catch { toast.error('Failed'); }
  };
  const drillInvoices = async (state) => {
    try {
      const res = await crmAPI.listReceivables({});
      let items = res.data?.invoices || [];
      if (state) items = items.filter(i => state === 'overdue' ? (i.status_label === 'overdue' || i.is_overdue) : i.payment_state === state);
      setDrillData({ title: `Invoices - ${state || 'All'}`, data: items, type: 'invoices' });
    } catch { toast.error('Failed'); }
  };

  if (loading || !myData) return <div className="space-y-4" data-testid="performance-hub-loading"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-5 gap-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20" />)}</div></div>;

  return (
    <div className="space-y-5" data-testid="performance-hub-page">
      {/* Header + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Crosshair className="h-6 w-6 text-[#800000]" /> Performance Hub</h1>
          <p className="text-gray-500 text-sm">{showExecutiveTabs ? 'CEO targets, PM plans, redistribution' : isPD ? `Product Director: ${myData.user_name}` : `My Targets: ${myData.user_name}`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Years</SelectItem><SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
          </Select>
          {showExecutiveTabs && (
            <Select value={pmFilter} onValueChange={setPmFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Product Director" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All PDs</SelectItem>{productManagers.map(pm => <SelectItem key={pm.name} value={pm.name}>{pm.name.split(' ').slice(-1)[0]}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Categories</SelectItem>{(isPD ? solutionCats.filter(c => (myData?.my_categories || []).includes(c.name)) : solutionCats).slice(0, 15).map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          {showExecutiveTabs && <Button onClick={() => setShowCreatePlan(true)} className="bg-[#800000] hover:bg-[#9a1919] text-white h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" /> Assign Target</Button>}
        </div>
      </div>

      {/* Active Filter Chips */}
      <FilterChipBar
        filters={{ year: yearFilter && yearFilter !== 'all' ? yearFilter : '', productDirector: pmFilter && pmFilter !== 'all' ? pmFilter : '', solutionCategory: catFilter && catFilter !== 'all' ? catFilter : '' }}
        onClear={(key) => { if (key === 'year') setYearFilter(''); if (key === 'productDirector') setPmFilter(''); if (key === 'solutionCategory') setCatFilter(''); }}
        onClearAll={() => { setYearFilter(''); setPmFilter(''); setCatFilter(''); }}
        onOpenAdvanced={() => setShowAdvancedFilter(true)}
      />

      {/* Alert Center */}
      {alertsData.summary?.total > 0 && canManage && (
        <button onClick={() => setShowAlerts(!showAlerts)} className={`w-full p-2.5 rounded-lg border flex items-center justify-between text-left ${alertsData.summary.critical > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center gap-2"><Bell className={`h-4 w-4 ${alertsData.summary.critical > 0 ? 'text-red-500' : 'text-blue-500'}`} /><span className="text-sm font-medium">Alerts</span>
            {alertsData.summary.critical > 0 && <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200">{alertsData.summary.critical} Critical</Badge>}
            {(alertsData.summary.medium || 0) > 0 && <Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-700 border-yellow-200">{alertsData.summary.medium} Medium</Badge>}
          </div><ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showAlerts ? 'rotate-180' : ''}`} />
        </button>
      )}
      {showAlerts && <div className="space-y-1.5">{(alertsData.alerts || []).map((a, i) => {
        const isC = a.severity === 'critical'; const isP = a.severity === 'positive';
        return <div key={i} className={`p-2.5 rounded-lg border text-sm flex items-start gap-2 ${isC ? 'bg-red-50 border-red-200' : isP ? 'bg-emerald-50 border-emerald-200' : 'bg-yellow-50 border-yellow-200'}`}>
          {isC ? <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" /> : isP ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" /> : <Bell className="h-4 w-4 text-yellow-500 mt-0.5" />}
          <div className="flex-1"><span className={`font-semibold ${isC ? 'text-red-700' : isP ? 'text-emerald-700' : 'text-yellow-700'}`}>{a.title}</span><p className="text-xs text-gray-600">{a.message}</p></div>
          {a.metric !== undefined && <span className={`text-lg font-bold ${isC ? 'text-red-600' : isP ? 'text-emerald-600' : 'text-yellow-600'}`}>{a.metric}%</span>}
        </div>;
      })}</div>}

      {/* CEO RAG Summary */}
      {showExecutiveTabs && <CeoSummaryCard />}

      {/* Tabs */}
      <Tabs value={tab || defaultTab} onValueChange={setTab}>
        <TabsList>
          {showExecutiveTabs && <TabsTrigger value="ceo">CEO View</TabsTrigger>}
          {showExecutiveTabs && <TabsTrigger value="pm">PM Plan Builder</TabsTrigger>}
          {showExecutiveTabs && <TabsTrigger value="sd">Sales Director</TabsTrigger>}
          {isPD && <TabsTrigger value="myplan">My Plan</TabsTrigger>}
          {isPD && <TabsTrigger value="myteam">My Team</TabsTrigger>}
          {isRep && <TabsTrigger value="mytargets">My Targets</TabsTrigger>}
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="collection">Collection</TabsTrigger>
          {canManage && <TabsTrigger value="incentive">Incentive</TabsTrigger>}
        </TabsList>

        {/* CEO VIEW */}
        {showExecutiveTabs && <TabsContent value="ceo" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-[#800000]" /> Revenue Plans</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table><TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Product Director</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Pipeline</TableHead><TableHead>Items</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                  <TableBody>{plans.map(p => (
                    <TableRow key={p.id} className={`cursor-pointer hover:bg-gray-50 ${selectedPlan?.id === p.id ? 'bg-blue-50' : ''}`} onClick={() => { setSelectedPlan(p); setTab('pm'); }}>
                      <TableCell className="font-medium text-sm">{p.name}</TableCell><TableCell className="text-sm text-gray-600">{p.product_manager_name}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">OMR {(p.target_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm text-gray-500 font-mono">{(p.total_pipeline || 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{p.activity_items_count || 0}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={e => { e.stopPropagation(); targetAPI.deleteRevenuePlan(p.id).then(() => { toast.success('Deleted'); loadData(); }); }}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>))}
                    {plans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No plans yet.</TableCell></TableRow>}
                  </TableBody></Table>
              </CardContent>
            </Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">PD Performance (Odoo)</CardTitle></CardHeader>
              <CardContent className="space-y-2">{pmActuals.map(pm => (
                <div key={pm.product_manager} className="p-2 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => drillOpps({ sales_rep: pm.product_manager })}>
                  <div className="flex justify-between"><span className="text-sm font-medium">{pm.product_manager}</span><span className="text-xs text-gray-400">{pm.opp_count} opps</span></div>
                  <div className="text-xs text-gray-500 mt-0.5">{pm.categories?.slice(0, 3).join(', ')}</div>
                </div>))}</CardContent>
            </Card>
          </div>
        </TabsContent>}

        {/* PM PLAN BUILDER */}
        {showExecutiveTabs && <TabsContent value="pm" className="mt-4 space-y-4">
          {!selectedPlan ? <Card><CardContent className="p-8 text-center text-gray-400">Select a plan from CEO View</CardContent></Card> : <>
            <Card className="border-[#800000]/20"><CardContent className="p-4 flex items-center justify-between"><div><h3 className="font-semibold">{selectedPlan.name}</h3><p className="text-sm text-gray-500">PD: {selectedPlan.product_manager_name} | Target: OMR {(selectedPlan.target_amount || 0).toLocaleString()}</p></div><Button onClick={() => setShowAddItem(true)} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Plus className="h-4 w-4 mr-1" /> Add Activity Plan</Button></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-base">Plan Items <Badge variant="secondary" className="ml-2">{planItems.length}</Badge></CardTitle></CardHeader>
              <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Actual</TableHead><TableHead>Assigned</TableHead><TableHead>Match</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{planItems.map(item => { const Icon = actIcons[item.activity_type] || Activity; const assigned = item.redistributed_total || 0; const matched = assigned >= (item.target_count || 0) && item.target_count > 0; const remaining = (item.target_count || 0) - assigned; return (
                  <TableRow key={item.id}><TableCell><div className="flex items-center gap-2"><Icon className="h-4 w-4" style={{ color: actColors[item.activity_type] }} /><span className="text-sm font-medium">{item.activity_type}</span></div></TableCell>
                    <TableCell className="text-sm text-gray-500">{item.solution_category || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{item.target_count}</TableCell>
                    <TableCell className="text-right"><span className={(item.actual_count || 0) >= (item.target_count || 0) ? 'text-emerald-600 font-semibold' : ''}>{item.actual_count || 0}</span></TableCell>
                    <TableCell><span className={matched ? 'text-emerald-600' : 'text-orange-600'}>{assigned}/{item.target_count}</span> {remaining > 0 && <span className="text-xs text-red-500 ml-1">({remaining} remaining)</span>}</TableCell>
                    <TableCell>{matched ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-orange-400" />}</TableCell>
                    <TableCell><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRedistribute(item)}>Assign</Button><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => targetAPI.deletePlanItem(item.id).then(() => { toast.success('Deleted'); loadPlanDetails(selectedPlan.id); })}><Trash2 className="h-3 w-3" /></Button></div></TableCell>
                  </TableRow>); })}{planItems.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No items.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
            {redistributions.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Assignments ({redistributions.length})</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Assigned To</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Count</TableHead><TableHead>Notes</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
              <TableBody>{redistributions.map(r => (<TableRow key={r.id}><TableCell>{r.activity_type}</TableCell><TableCell className="font-medium">{r.assigned_to_name}</TableCell><TableCell><Badge variant="secondary" className="text-[10px]">{r.assign_type === 'team' ? 'Team' : 'Person'}</Badge></TableCell><TableCell className="text-right font-semibold">{r.assigned_count}</TableCell><TableCell className="text-xs text-gray-400">{r.notes || '-'}</TableCell><TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => targetAPI.deleteRedistribution(r.id).then(() => { toast.success('Removed'); loadPlanDetails(selectedPlan.id); })}><Trash2 className="h-3 w-3" /></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>}
          </>}
        </TabsContent>}

        {/* SALES DIRECTOR */}
        {showExecutiveTabs && <TabsContent value="sd" className="mt-4"><Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-yellow-500" /> Salesperson Performance</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Salesperson</TableHead><TableHead className="text-right">Pipeline</TableHead><TableHead className="text-right">Opps</TableHead></TableRow></TableHeader><TableBody>{salespersons.slice(0, 15).map((sp, idx) => (<TableRow key={sp.name} className={`cursor-pointer hover:bg-gray-50 ${idx < 3 ? 'bg-gray-50/50' : ''}`} onClick={() => drillOpps({ sales_rep: sp.name })}><TableCell>{idx === 0 ? <Trophy className="h-4 w-4 text-yellow-500" /> : <span className="text-gray-400 text-sm">{idx+1}</span>}</TableCell><TableCell className="font-medium text-sm">{sp.name}</TableCell><TableCell className="text-right font-mono text-sm">{sp.total_pipeline.toLocaleString()}</TableCell><TableCell className="text-right text-sm">{sp.opp_count}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card></TabsContent>}

        {/* MY PLAN (PD) */}
        {isPD && <TabsContent value="myplan" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="My Opportunities" value={myData.pm_summary?.opp_count || 0} icon={Target} color="text-blue-600" bgColor="bg-blue-50" onClick={() => drillOpps({})} />
            <MetricCard label="Pipeline" value={`OMR ${(myData.pm_summary?.total_pipeline || 0).toLocaleString()}`} icon={TrendingUp} color="text-emerald-600" bgColor="bg-emerald-50" />
            <MetricCard label="Won Deals" value={myData.pm_summary?.won_count || 0} icon={Trophy} color="text-yellow-600" bgColor="bg-yellow-50" onClick={() => drillOpps({ stage: 'closed_won' })} />
            <MetricCard label="Categories" value={myData.my_categories?.length || 0} icon={BarChart2} color="text-purple-600" bgColor="bg-purple-50" />
          </div>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">My Solution Categories</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{(myData.my_categories || []).map(c => <Badge key={c} variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => setCatFilter(c)}>{c}</Badge>)}</div></CardContent></Card>
          {(myData.my_plans || []).map(plan => (
            <React.Fragment key={plan.id}>
            <SuggestionsCard planId={plan.id} onAccepted={loadData} />
            <Card className="border-[#800000]/20">
              <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base">{plan.name} <Badge variant="outline" className="ml-2">OMR {(plan.target_amount || 0).toLocaleString()}</Badge></CardTitle><Button onClick={() => { setSelectedPlan(plan); setShowAddItem(true); }} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Plus className="h-4 w-4 mr-1" /> Add Activity Plan</Button></div></CardHeader>
              <CardContent>{(plan.items || []).length > 0 ? <Table><TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Target</TableHead><TableHead>Notes</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader><TableBody>{(plan.items || []).map(item => { const remaining = (item.target_count || 0) - (item.redistributed_total || 0); return (
                <TableRow key={item.id}><TableCell className="font-medium text-sm">{item.activity_type}</TableCell><TableCell className="text-sm text-gray-500">{item.solution_category || '-'}</TableCell><TableCell className="text-right font-semibold">{item.target_count} {remaining > 0 && <span className="text-xs text-red-500">({remaining} unassigned)</span>}</TableCell><TableCell className="text-sm text-gray-400">{item.notes || '-'}</TableCell>
                  <TableCell><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedPlan(plan); setShowRedistribute(item); }}>Assign</Button><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => targetAPI.deletePlanItem(item.id).then(() => { toast.success('Deleted'); loadData(); })}><Trash2 className="h-3 w-3" /></Button></div></TableCell></TableRow>); })}</TableBody></Table> : <p className="text-gray-400 text-sm py-4 text-center">No items yet. Click "Add Activity Plan" to define targets.</p>}</CardContent>
            </Card>
            </React.Fragment>))}
          {(myData.my_plans || []).length === 0 && <Card><CardContent className="p-8 text-center text-gray-400">No plans assigned yet.</CardContent></Card>}
        </TabsContent>}

        {/* MY TEAM (PD) */}
        {isPD && <TabsContent value="myteam" className="mt-4"><Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-[#800000]" /> Salespersons on My Opportunities</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Salesperson</TableHead><TableHead className="text-right">Opportunities</TableHead><TableHead className="text-right">Pipeline</TableHead></TableRow></TableHeader><TableBody>{(myData.my_salespersons || []).map((sp, idx) => (<TableRow key={sp.name} className="cursor-pointer hover:bg-gray-50" onClick={() => drillOpps({ sales_rep: sp.name })}><TableCell>{idx === 0 ? <Trophy className="h-4 w-4 text-yellow-500" /> : <span className="text-gray-400">{idx+1}</span>}</TableCell><TableCell className="font-medium">{sp.name}</TableCell><TableCell className="text-right">{sp.opp_count}</TableCell><TableCell className="text-right font-mono">{sp.pipeline.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card></TabsContent>}

        {/* MY TARGETS (Sales Rep) */}
        {isRep && <TabsContent value="mytargets" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="My Opportunities" value={myData.my_opp_summary?.opp_count || 0} icon={Target} color="text-blue-600" bgColor="bg-blue-50" onClick={() => drillOpps({})} />
            <MetricCard label="My Pipeline" value={`OMR ${(myData.my_opp_summary?.total_pipeline || 0).toLocaleString()}`} icon={TrendingUp} color="text-emerald-600" bgColor="bg-emerald-50" />
            <MetricCard label="Won Deals" value={myData.my_opp_summary?.won_count || 0} icon={Trophy} color="text-yellow-600" bgColor="bg-yellow-50" onClick={() => drillOpps({ stage: 'closed_won' })} />
            <MetricCard label="My Accounts" value={myData.my_accounts_count || 0} icon={Users} color="text-cyan-600" bgColor="bg-cyan-50" />
          </div>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-purple-500" /> My Activities</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{(myData.my_activities || []).map(a => { const Icon = actIcons[a.type] || Activity; return <div key={a.type} className="p-3 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => drillActivities()}><div className="flex items-center gap-1.5 mb-1"><Icon className="h-3.5 w-3.5" style={{ color: actColors[a.type] || '#6b7280' }} /><span className="text-xs text-gray-500">{a.type}</span></div><p className="text-lg font-bold">{a.count}</p></div>; })}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-[#800000]" /> Assigned Targets</CardTitle></CardHeader><CardContent>{(myData.my_assigned_tasks || []).length > 0 ? <Table><TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Solution</TableHead><TableHead>From PD</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader><TableBody>{(myData.my_assigned_tasks || []).map(t => <TableRow key={t.id}><TableCell className="font-medium">{t.activity_type}</TableCell><TableCell className="text-gray-500">{t.solution_category || '-'}</TableCell><TableCell className="text-gray-500">{t.product_manager_name || '-'}</TableCell><TableCell className="text-right font-semibold">{t.assigned_count}</TableCell></TableRow>)}</TableBody></Table> : <p className="text-gray-400 text-sm text-center py-4">No targets assigned yet.</p>}</CardContent></Card>
        </TabsContent>}

        {/* ACTIVITIES TAB (all roles) */}
        <TabsContent value="activities" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="cursor-pointer hover:shadow-md hover:border-yellow-300" onClick={() => drillActivities('pending')}><CardContent className="p-4 text-center"><Clock className="h-6 w-6 text-yellow-500 mx-auto mb-1" /><p className="text-xs text-gray-500">Pending</p><p className="text-2xl font-bold text-yellow-600">-</p></CardContent></Card>
            <Card className="cursor-pointer hover:shadow-md hover:border-red-300" onClick={() => drillActivities('overdue')}><CardContent className="p-4 text-center"><XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" /><p className="text-xs text-gray-500">Overdue</p><p className="text-2xl font-bold text-red-600">-</p></CardContent></Card>
            <Card className="cursor-pointer hover:shadow-md hover:border-emerald-300" onClick={() => drillActivities('completed')}><CardContent className="p-4 text-center"><CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" /><p className="text-xs text-gray-500">Completed</p><p className="text-2xl font-bold text-emerald-600">-</p></CardContent></Card>
          </div>
          <Button variant="outline" onClick={() => drillActivities('')} className="w-full"><Activity className="h-4 w-4 mr-1" /> View All Activities</Button>
        </TabsContent>

        {/* COLLECTION */}
        <TabsContent value="collection" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(collection.by_state || {}).map(([state, data]) => (
              <Card key={state} className="cursor-pointer hover:shadow-md" onClick={() => drillInvoices(state)}><CardContent className="p-4"><p className="text-xs text-gray-500 uppercase">{state.replace('_', ' ')}</p><p className="text-xl font-bold">{data.count} invoices</p><p className="text-sm text-gray-500 font-mono">OMR {data.amount?.toLocaleString()}</p><p className="text-[10px] text-[#800000] flex items-center gap-0.5 mt-1"><ExternalLink className="h-2.5 w-2.5" /> Click to view</p></CardContent></Card>
            ))}
          </div>
          <Card className="border-red-200 cursor-pointer hover:shadow-md" onClick={() => drillInvoices('overdue')}><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-full bg-red-50"><AlertTriangle className="h-6 w-6 text-red-500" /></div><div><h3 className="font-semibold">Overdue Invoices</h3><p className="text-sm text-gray-500">{collection.overdue_count || 0} past due</p><p className="text-lg font-bold text-red-600 font-mono">OMR {(collection.overdue_amount || 0).toLocaleString()}</p></div></CardContent></Card>
        </TabsContent>

        {/* INCENTIVE */}
        {canManage && <TabsContent value="incentive" className="mt-4"><IncentiveSection plans={plans} /></TabsContent>}
      </Tabs>

      {/* DRILL POPUP */}
      <DrillPopup open={!!drillData} onClose={() => setDrillData(null)} title={drillData?.title || ''}>
        {drillData?.type === 'opportunities' && <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Account</TableHead><TableHead>Stage</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Owner</TableHead></TableRow></TableHeader><TableBody>{(drillData?.data || []).map((o, i) => <TableRow key={i}><TableCell className="font-medium text-sm">{o.name}</TableCell><TableCell className="text-sm text-gray-500">{o.account_name || '-'}</TableCell><TableCell><Badge variant="secondary" className="text-xs">{o.custom_stage || o.stage}</Badge></TableCell><TableCell className="text-right font-mono text-sm">OMR {(o.sale_value || o.amount || 0).toLocaleString()}</TableCell><TableCell className="text-sm">{o.owner_name}</TableCell></TableRow>)}{(drillData?.data || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4 text-gray-400">No data</TableCell></TableRow>}</TableBody></Table>}
        {drillData?.type === 'activities' && <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead>Owner</TableHead><TableHead>Due Date</TableHead></TableRow></TableHeader><TableBody>{(drillData?.data || []).map((a, i) => <TableRow key={i}><TableCell><Badge variant="secondary" className="text-xs">{a.type_display || a.type}</Badge></TableCell><TableCell className="text-sm">{a.subject}</TableCell><TableCell><Badge variant={a.status === 'completed' ? 'default' : 'secondary'} className={`text-xs ${a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : ''}`}>{a.status}</Badge></TableCell><TableCell className="text-sm">{a.owner_name}</TableCell><TableCell className="text-sm">{a.due_date}</TableCell></TableRow>)}{(drillData?.data || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4 text-gray-400">No data</TableCell></TableRow>}</TableBody></Table>}
        {drillData?.type === 'invoices' && <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Date</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(drillData?.data || []).map((inv, i) => <TableRow key={i}><TableCell className="text-sm font-mono">{inv.invoice_number}</TableCell><TableCell className="text-sm">{inv.account || inv.account_name}</TableCell><TableCell className="text-right font-mono text-sm">OMR {(inv.amount || inv.amount_total || 0).toLocaleString()}</TableCell><TableCell className="text-sm">{inv.invoice_date}</TableCell><TableCell className="text-sm">{inv.due_date}</TableCell><TableCell><Badge variant="secondary" className={`text-xs ${inv.status_label === 'overdue' || inv.is_overdue ? 'bg-red-100 text-red-700' : inv.payment_state === 'paid' ? 'bg-emerald-100 text-emerald-700' : ''}`}>{inv.status_label || inv.payment_state}</Badge></TableCell></TableRow>)}{(drillData?.data || []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-4 text-gray-400">No data</TableCell></TableRow>}</TableBody></Table>}
      </DrillPopup>

      {/* DIALOGS */}
      {showExecutiveTabs && <CreatePlanDialog open={showCreatePlan} onClose={() => setShowCreatePlan(false)} onCreated={() => { loadData(); setShowCreatePlan(false); }} productManagers={productManagers} />}
      {selectedPlan && <AddItemDialog open={showAddItem} onClose={() => setShowAddItem(false)} onCreated={() => { if (selectedPlan) loadPlanDetails(selectedPlan.id); loadData(); setShowAddItem(false); }} planId={selectedPlan.id} solutionCats={isPD ? solutionCats.filter(c => (myData?.my_categories || []).includes(c.name)) : solutionCats} activityTypes={activityTypes} />}
      {showRedistribute && <RedistributeDialog open={!!showRedistribute} onClose={() => setShowRedistribute(null)} onCreated={() => { if (selectedPlan) loadPlanDetails(selectedPlan.id); loadData(); setShowRedistribute(null); }} item={showRedistribute} salespersons={isPD ? (myData?.my_salespersons || []).map(s => ({...s, total_pipeline: s.pipeline || 0})) : salespersons} />}
      <AdvancedFilterBuilder open={showAdvancedFilter} onClose={() => setShowAdvancedFilter(false)}
        currentFilters={{ year: yearFilter, productDirector: pmFilter, solutionCategory: catFilter }}
        filterOptions={{ productDirectors: productManagers.map(p => p.name), solutionCategories: solutionCats.map(c => c.name), salespersons: salespersons.map(s => s.name) }}
        onApply={(filters) => {
          if (filters.year) setYearFilter(filters.year);
          if (filters.productDirector) setPmFilter(filters.productDirector);
          if (filters.solutionCategory) setCatFilter(filters.solutionCategory);
          if (filters.quarter) setYearFilter(''); // Reset year if quarter set
        }}
      />
    </div>
  );
}

// ===== DIALOGS =====
function IncentiveSection({ plans }) {
  const [sel, setSel] = useState(''); const [result, setResult] = useState(null); const [calc, setCalc] = useState(false);
  const run = async () => { if (!sel) return; setCalc(true); try { const r = await targetAPI.calculateMultiVectorIncentive({ plan_id: sel, revenue_weight: 50, activity_weight: 30, collection_weight: 20 }); setResult(r.data); } catch { toast.error('Failed'); } finally { setCalc(false); } };
  return <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4 text-[#800000]" /> Multi-Vector Incentive</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-end gap-3"><div className="flex-1"><Label className="text-xs">Revenue Plan</Label><Select value={sel} onValueChange={setSel}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div><Button onClick={run} disabled={calc} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Calculator className="h-4 w-4 mr-1" /> Calculate</Button></div>
    {result && <div className="grid grid-cols-4 gap-3"><div className="p-3 rounded-lg bg-gray-50 text-center"><p className="text-[10px] text-gray-400">Score</p><p className="text-2xl font-bold">{result.composite_score}</p><Badge className="mt-1">{result.tier}</Badge></div><div className="p-3 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400">Revenue</p><p className="text-sm font-bold">{result.vectors.revenue.achievement_pct}%</p></div><div className="p-3 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400">Activity</p><p className="text-sm font-bold">{result.vectors.activity.achievement_pct}%</p></div><div className="p-3 rounded-lg bg-emerald-50"><p className="text-[10px] text-emerald-600">Payout</p><p className="text-sm font-bold text-emerald-600">OMR {result.calculated_payout.toLocaleString()}</p></div></div>}
  </CardContent></Card>;
}

function CreatePlanDialog({ open, onClose, onCreated, productManagers }) {
  const [form, setForm] = useState({ name: '', product_manager_name: '', product_manager_id: '', target_amount: 0, period: '2026-Q1' }); const [sub, setSub] = useState(false);
  const handlePM = (n) => { const pm = productManagers.find(p => p.name === n); setForm(f => ({ ...f, product_manager_name: n, product_manager_id: pm?.id || '', name: `Q1 2026 - ${n}` })); };
  const submit = async () => { if (!form.product_manager_name || !form.target_amount) { toast.error('Select PD and target'); return; } setSub(true); try { await targetAPI.createRevenuePlan(form); toast.success('Created'); onCreated(); } catch (err) { toast.error(err.response?.data?.detail || err.message || 'Failed to create plan'); console.error('Create plan error:', err); } finally { setSub(false); } };
  return <Dialog open={open} onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>Assign Revenue Target</DialogTitle></DialogHeader><div className="space-y-3"><div><Label className="text-xs">Product Director</Label><Select value={form.product_manager_name} onValueChange={handlePM}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{productManagers.map(pm => <SelectItem key={pm.name} value={pm.name}>{pm.name} ({pm.opp_count} opps)</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Revenue Target (OMR)</Label><Input type="number" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: parseFloat(e.target.value) || 0 }))} /></div><div><Label className="text-xs">Plan Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={sub} className="bg-[#800000] hover:bg-[#9a1919] text-white">{sub ? '...' : 'Assign'}</Button></DialogFooter></DialogContent></Dialog>;
}

function AddItemDialog({ open, onClose, onCreated, planId, solutionCats, activityTypes }) {
  const [form, setForm] = useState({ activity_type: '', solution_category: '', target_count: 10, notes: '' }); const [sub, setSub] = useState(false);
  const submit = async () => { if (!form.activity_type) { toast.error('Select type'); return; } setSub(true); try { await targetAPI.createPlanItem(planId, form); toast.success('Added'); onCreated(); } catch { toast.error('Failed'); } finally { setSub(false); } };
  return <Dialog open={open} onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>Add Activity Plan Item</DialogTitle></DialogHeader><div className="space-y-3"><div><Label className="text-xs">Activity Type</Label><Select value={form.activity_type} onValueChange={v => setForm(f => ({ ...f, activity_type: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{activityTypes.map(at => <SelectItem key={at.type} value={at.type}>{at.type} ({at.count})</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Solution Category</Label><Select value={form.solution_category || '_none'} onValueChange={v => setForm(f => ({ ...f, solution_category: v === '_none' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="_none">Any</SelectItem>{solutionCats.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Target Count</Label><Input type="number" value={form.target_count} onChange={e => setForm(f => ({ ...f, target_count: parseInt(e.target.value) || 0 }))} /></div><div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={sub} className="bg-[#800000] hover:bg-[#9a1919] text-white">{sub ? '...' : 'Add'}</Button></DialogFooter></DialogContent></Dialog>;
}

function RedistributeDialog({ open, onClose, onCreated, item, salespersons }) {
  const [form, setForm] = useState({ assign_type: 'person', assigned_to_name: '', assigned_count: 0, team_name: '', notes: '' });
  const [sub, setSub] = useState(false);
  const [teams, setTeams] = useState([]);
  const remaining = (item.target_count || 0) - (item.redistributed_total || 0);
  useEffect(() => { targetAPI.getTeamsWithMembers().then(r => setTeams(r.data)).catch(() => {}); }, []);

  const submit = async () => {
    if (!form.assigned_to_name || !form.assigned_count) { toast.error('Select assignee and count'); return; }
    setSub(true);
    try { await targetAPI.redistributePlanItem(item.id, { plan_item_id: item.id, assign_type: form.assign_type, assigned_to_name: form.assigned_to_name, assigned_count: form.assigned_count, team_name: form.team_name, notes: form.notes }); toast.success('Assigned'); onCreated(); } catch { toast.error('Failed'); } finally { setSub(false); }
  };

  const teamOptions = teams.filter(t => t.members && t.members.length > 0);
  return (
    <Dialog open={open} onOpenChange={onClose}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Assign: {item.target_count} {item.activity_type}</DialogTitle></DialogHeader>
      <p className="text-sm text-gray-500">Assigned: {item.redistributed_total || 0} | <span className="text-orange-600 font-semibold">Remaining: {remaining}</span></p>
      <div className="space-y-3">
        <div><Label className="text-xs">Assign To</Label><Select value={form.assign_type} onValueChange={v => setForm(f => ({ ...f, assign_type: v, assigned_to_name: '', team_name: '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="person">Individual</SelectItem><SelectItem value="team">Team / Department</SelectItem></SelectContent></Select></div>
        {form.assign_type === 'person' && <div><Label className="text-xs">Salesperson</Label><Select value={form.assigned_to_name} onValueChange={v => setForm(f => ({ ...f, assigned_to_name: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{salespersons.map(sp => <SelectItem key={sp.name} value={sp.name}>{sp.name} ({sp.opp_count || 0} opps)</SelectItem>)}</SelectContent></Select></div>}
        {form.assign_type === 'team' && <div><Label className="text-xs">Team / Department (HOD will reassign to members)</Label><Select value={form.assigned_to_name} onValueChange={v => { const t = teamOptions.find(x => x.name === v); setForm(f => ({ ...f, assigned_to_name: v, team_name: v, notes: t?.manager_name ? `HOD: ${t.manager_name} (${t.member_count} members)` : '' })); }}><SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger><SelectContent>{teamOptions.map(t => <SelectItem key={t.name} value={t.name}>{t.name} - {t.member_count || 0} members</SelectItem>)}</SelectContent></Select>
          {form.team_name && teamOptions.find(t => t.name === form.team_name)?.members && <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs"><p className="font-medium text-gray-600 mb-1">Members (HOD can reassign):</p>{teamOptions.find(t => t.name === form.team_name)?.members?.map(m => <p key={m.name} className="text-gray-500">{m.name} - {m.job_title || 'Member'}</p>)}</div>}
        </div>}
        <div><Label className="text-xs">Count (max {remaining})</Label><Input type="number" value={form.assigned_count} onChange={e => setForm(f => ({ ...f, assigned_count: Math.min(parseInt(e.target.value) || 0, remaining) }))} /></div>
        <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={sub || !form.assigned_to_name} className="bg-[#800000] hover:bg-[#9a1919] text-white">{sub ? '...' : form.assign_type === 'team' ? 'Assign to Team' : 'Assign'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function CeoSummaryCard() {
  const [data, setData] = useState(null);
  useEffect(() => { targetAPI.getCeoSummary().then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return null;

  const signalColors = { green: 'bg-emerald-500', amber: 'bg-yellow-500', red: 'bg-red-500' };
  const signalBg = { green: 'bg-emerald-50', amber: 'bg-yellow-50', red: 'bg-red-50' };
  const signalText = { green: 'text-emerald-700', amber: 'text-yellow-700', red: 'text-red-700' };

  return (
    <Card className={`border-2 ${data.overall === 'red' ? 'border-red-200 bg-red-50/30' : data.overall === 'amber' ? 'border-yellow-200 bg-yellow-50/30' : 'border-emerald-200 bg-emerald-50/30'}`} data-testid="ceo-summary">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">Executive Summary</h3>
          <Badge variant="outline" className={`text-xs ${signalText[data.overall]} border-current`}>{data.red_count} Red · {data.amber_count} Amber</Badge>
        </div>
        <div className="grid grid-cols-5 gap-3 mb-3">
          {data.signals.map(s => (
            <div key={s.name} className={`p-2.5 rounded-lg ${signalBg[s.signal]} text-center`}>
              <div className={`w-3 h-3 rounded-full ${signalColors[s.signal]} mx-auto mb-1`} />
              <p className="text-xs font-medium text-gray-700">{s.name}</p>
              <p className={`text-lg font-bold ${signalText[s.signal]}`}>{s.value}</p>
              <p className="text-[10px] text-gray-500">{s.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-600 italic">{data.insight}</p>
      </CardContent>
    </Card>
  );
}

function SuggestionsCard({ planId, onAccepted }) {
  const [data, setData] = useState(null);
  const [mods, setMods] = useState([]);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (planId) {
      targetAPI.getActivitySuggestions(planId).then(r => {
        if (r.data && r.data.status === 'pending_review') {
          setData(r.data);
          setMods(r.data.suggestions.map(s => ({ ...s })));
        }
      }).catch(() => {});
    }
  }, [planId]);

  if (!data || data.status !== 'pending_review') return null;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await targetAPI.acceptSuggestions(planId, mods);
      toast.success('Activity plan accepted');
      setData(null);
      if (onAccepted) onAccepted();
    } catch { toast.error('Failed'); }
    finally { setAccepting(false); }
  };

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/30" data-testid="suggestions-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
          <Target className="h-4 w-4" /> Suggested Activity Plan
          <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">Auto-generated</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-600">
          Based on your historical data: Avg deal OMR {data.avg_deal_size?.toLocaleString()}, Win rate {data.win_rate}%, {data.required_deals} deals needed.
          Pipeline coverage: OMR {data.pipeline_coverage?.toLocaleString()} (3x target).
        </p>
        <Table>
          <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Formula</TableHead><TableHead className="text-right w-24">Count</TableHead></TableRow></TableHeader>
          <TableBody>
            {mods.map((s, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium text-sm">{s.activity_type}</TableCell>
                <TableCell className="text-xs text-gray-500">{s.formula}</TableCell>
                <TableCell className="text-right">
                  <Input type="number" value={s.count} onChange={e => {
                    const newMods = [...mods];
                    newMods[idx] = { ...newMods[idx], count: parseInt(e.target.value) || 0 };
                    setMods(newMods);
                  }} className="w-20 h-7 text-xs text-right" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setData(null)}>Dismiss</Button>
          <Button size="sm" className="bg-[#800000] hover:bg-[#9a1919] text-white text-xs" onClick={handleAccept} disabled={accepting}>
            {accepting ? 'Accepting...' : 'Accept & Create Plan Items'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

