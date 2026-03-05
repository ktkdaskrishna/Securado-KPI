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
  Target, Plus, TrendingUp, Trophy, Users, Trash2, BarChart2, Activity, Phone, Mail, Calendar, Monitor, FlaskConical, Presentation, DollarSign, Calculator, ChevronDown, Crosshair, Award, FileText, AlertTriangle, CheckCircle2, Bell, User, ExternalLink, Clock, XCircle, Filter, PieChart, Layers, ArrowRight, GitBranch
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, PieChart as RPieChart, Pie } from 'recharts';
import { toast } from 'sonner';

const actIcons = { Call: Phone, Email: Mail, Meeting: Calendar, Demo: Monitor, 'Proof of concept': FlaskConical, 'Work Shop': Presentation, 'Site Visit': Target, 'To Do': CheckCircle2, Task: FileText, 'Follow-up': Clock };
const actColors = { Call: '#3b82f6', Email: '#8b5cf6', Meeting: '#10b981', Demo: '#f59e0b', 'Proof of concept': '#ef4444', 'Work Shop': '#06b6d4', 'Site Visit': '#ec4899', 'To Do': '#6366f1', Task: '#84cc16' };
const SEGMENT_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#6366f1'];

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
    <Card className={`hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer hover:border-[#800000]/30' : ''}`} onClick={onClick} data-testid={`metric-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
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
  // Segment state
  const [showSegmentEditor, setShowSegmentEditor] = useState(false);
  const [segments, setSegments] = useState(null);
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
      const fParams = {};
      if (yearFilter && yearFilter !== 'all') fParams.year = yearFilter;
      if (pmFilter && pmFilter !== 'all') fParams.product_manager = pmFilter;

      const calls = [targetAPI.getMyData(), targetAPI.getAlerts(),
        targetAPI.getSolutionCategories(), targetAPI.getSalespersons(), targetAPI.getActivityTypes()];
      if (canManage) {
        const planParams = {};
        if (pmFilter && pmFilter !== 'all') planParams.product_manager = pmFilter;
        if (yearFilter && yearFilter !== 'all') planParams.year = yearFilter;
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
      const [itemsR, redistR, segR] = await Promise.allSettled([
        targetAPI.listPlanItems(planId),
        targetAPI.listRedistributions(planId),
        targetAPI.listSegments(planId),
      ]);
      if (itemsR.status === 'fulfilled') setPlanItems(itemsR.value.data);
      if (redistR.status === 'fulfilled') setRedistributions(redistR.value.data);
      if (segR.status === 'fulfilled') setSegments(segR.value.data);
    } catch {}
  }, []);
  useEffect(() => { if (selectedPlan) loadPlanDetails(selectedPlan.id); }, [selectedPlan, loadPlanDetails]);

  const defaultTab = showExecutiveTabs ? 'cascade' : isPD ? 'myplan' : 'mytargets';
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
          <p className="text-gray-500 text-sm">{showExecutiveTabs ? 'Cascading targets: CEO → Product Director → Sales Team' : isPD ? `Product Director: ${myData.user_name}` : `My Targets: ${myData.user_name}`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-24 h-8 text-xs" data-testid="year-filter"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Years</SelectItem><SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
          </Select>
          {showExecutiveTabs && (
            <Select value={pmFilter} onValueChange={setPmFilter}>
              <SelectTrigger className="w-36 h-8 text-xs" data-testid="pd-filter"><SelectValue placeholder="Product Director" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All PDs</SelectItem>{productManagers.map(pm => <SelectItem key={pm.name} value={pm.name}>{pm.name.split(' ').slice(-1)[0]}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-36 h-8 text-xs" data-testid="category-filter"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Categories</SelectItem>{(isPD ? solutionCats.filter(c => (myData?.my_categories || []).includes(c.name)) : solutionCats).slice(0, 15).map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          {showExecutiveTabs && <Button onClick={() => setShowCreatePlan(true)} className="bg-[#800000] hover:bg-[#9a1919] text-white h-8 text-xs" data-testid="assign-target-btn"><Plus className="h-3.5 w-3.5 mr-1" /> Assign Target</Button>}
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
        <button onClick={() => setShowAlerts(!showAlerts)} className={`w-full p-2.5 rounded-lg border flex items-center justify-between text-left ${alertsData.summary.critical > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`} data-testid="alerts-btn">
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
      {showExecutiveTabs && <CeoSummaryCard year={yearFilter} />}

      {/* Tabs */}
      <Tabs value={tab || defaultTab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {showExecutiveTabs && <TabsTrigger value="cascade" data-testid="tab-cascade"><GitBranch className="h-3.5 w-3.5 mr-1" /> Cascade View</TabsTrigger>}
          {showExecutiveTabs && <TabsTrigger value="pm" data-testid="tab-pm">Plan Builder</TabsTrigger>}
          {showExecutiveTabs && <TabsTrigger value="sd" data-testid="tab-sd">Sales Team</TabsTrigger>}
          {isPD && <TabsTrigger value="myplan">My Plan</TabsTrigger>}
          {isPD && <TabsTrigger value="myteam">My Team</TabsTrigger>}
          {isRep && <TabsTrigger value="mytargets">My Targets</TabsTrigger>}
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="collection">Collection</TabsTrigger>
          {canManage && <TabsTrigger value="incentive">Incentive</TabsTrigger>}
        </TabsList>

        {/* CASCADE VIEW (CEO) — The main new view */}
        {showExecutiveTabs && <TabsContent value="cascade" className="mt-4 space-y-6" data-testid="cascade-view">
          {/* PD Revenue Plans */}
          {plans.filter(p => !p.plan_type || p.plan_type === 'revenue').length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Target className="h-4 w-4 text-[#800000]" /> Product Director Targets</h3>
              {plans.filter(p => !p.plan_type || p.plan_type === 'revenue').map(plan => (
                <CascadePlanCard key={plan.id} plan={plan} selected={selectedPlan?.id === plan.id}
                  onSelect={() => { setSelectedPlan(plan); }}
                  onSegment={() => { setSelectedPlan(plan); setShowSegmentEditor(true); }}
                  onViewPlan={() => { setSelectedPlan(plan); setTab('pm'); }}
                  onDelete={() => { targetAPI.deleteRevenuePlan(plan.id).then(() => { toast.success('Deleted'); loadData(); }); }}
                />
              ))}
            </div>
          )}

          {/* Strategy GM Plans */}
          {plans.filter(p => p.plan_type === 'strategy').length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Presentation className="h-4 w-4 text-purple-600" /> Strategy Team Targets</h3>
              {plans.filter(p => p.plan_type === 'strategy').map(plan => (
                <CascadePlanCard key={plan.id} plan={plan} selected={selectedPlan?.id === plan.id} planTypeLabel="Strategy"
                  onSelect={() => { setSelectedPlan(plan); }}
                  onSegment={() => { setSelectedPlan(plan); setShowSegmentEditor(true); }}
                  onViewPlan={() => { setSelectedPlan(plan); setTab('pm'); }}
                  onDelete={() => { targetAPI.deleteRevenuePlan(plan.id).then(() => { toast.success('Deleted'); loadData(); }); }}
                />
              ))}
            </div>
          )}

          {/* Marketing Plans */}
          {plans.filter(p => p.plan_type === 'marketing').length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-blue-600" /> Marketing Team Targets</h3>
              {plans.filter(p => p.plan_type === 'marketing').map(plan => (
                <CascadePlanCard key={plan.id} plan={plan} selected={selectedPlan?.id === plan.id} planTypeLabel="Marketing"
                  onSelect={() => { setSelectedPlan(plan); }}
                  onSegment={() => { setSelectedPlan(plan); setShowSegmentEditor(true); }}
                  onViewPlan={() => { setSelectedPlan(plan); setTab('pm'); }}
                  onDelete={() => { targetAPI.deleteRevenuePlan(plan.id).then(() => { toast.success('Deleted'); loadData(); }); }}
                />
              ))}
            </div>
          )}

          {plans.length === 0 && (
            <Card><CardContent className="p-12 text-center">
              <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-500 mb-1">No Target Plans Yet</h3>
              <p className="text-sm text-gray-400 mb-4">Start by assigning a revenue target to a Product Director, Strategy GM, or Marketing Team</p>
              <Button onClick={() => setShowCreatePlan(true)} className="bg-[#800000] hover:bg-[#9a1919] text-white">
                <Plus className="h-4 w-4 mr-1" /> Assign First Target
              </Button>
            </CardContent></Card>
          )}
        </TabsContent>}

        {/* PM PLAN BUILDER */}
        {showExecutiveTabs && <TabsContent value="pm" className="mt-4 space-y-4">
          {!selectedPlan ? <Card><CardContent className="p-8 text-center text-gray-400">Select a plan from Cascade View</CardContent></Card> : <>
            <SuggestionsCard planId={selectedPlan.id} onAccepted={() => { loadPlanDetails(selectedPlan.id); loadData(); }} />
            
            {/* Segments Section */}
            {segments && segments.segments && segments.segments.length > 0 && (
              <SegmentBreakdownCard segments={segments} onEdit={() => setShowSegmentEditor(true)} />
            )}
            
            <Card className="border-[#800000]/20"><CardContent className="p-4 flex items-center justify-between"><div><h3 className="font-semibold">{selectedPlan.name}</h3><p className="text-sm text-gray-500">PD: {selectedPlan.product_manager_name} | Booking: OMR {(selectedPlan.booking_target || selectedPlan.target_amount || 0).toLocaleString()}{selectedPlan.invoiced_target > 0 ? ` | Invoiced: OMR ${selectedPlan.invoiced_target.toLocaleString()}` : ''}{selectedPlan.margin_target > 0 ? ` | Margin: OMR ${selectedPlan.margin_target.toLocaleString()}` : ''}</p></div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSegmentEditor(true)} className="text-xs"><Layers className="h-3.5 w-3.5 mr-1" /> Segment by Category</Button>
                <Button onClick={() => setShowAddItem(true)} className="bg-[#800000] hover:bg-[#9a1919] text-white text-xs"><Plus className="h-4 w-4 mr-1" /> Add Activity</Button>
              </div>
            </CardContent></Card>
            
            <Card><CardHeader className="pb-2"><CardTitle className="text-base">Activity Plan Items <Badge variant="secondary" className="ml-2">{planItems.length}</Badge>
              {planItems.filter(i => i.assign_team === 'marketing').length > 0 && <Badge variant="outline" className="ml-1 text-[10px] border-blue-200 bg-blue-50 text-blue-700">{planItems.filter(i => i.assign_team === 'marketing').length} Marketing</Badge>}
              {planItems.filter(i => i.assign_team === 'strategy').length > 0 && <Badge variant="outline" className="ml-1 text-[10px] border-purple-200 bg-purple-50 text-purple-700">{planItems.filter(i => i.assign_team === 'strategy').length} Strategy</Badge>}
            </CardTitle></CardHeader>
              <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Category</TableHead><TableHead>Team</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Actual</TableHead><TableHead>Assigned</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{planItems.map(item => { const Icon = actIcons[item.activity_type] || Activity; const assigned = item.redistributed_total || 0; const matched = assigned >= (item.target_count || 0) && item.target_count > 0; const remaining = (item.target_count || 0) - assigned; const teamLabel = item.assign_team === 'marketing' ? 'Marketing' : item.assign_team === 'strategy' ? 'Strategy' : 'Sales'; const teamColor = item.assign_team === 'marketing' ? 'bg-blue-100 text-blue-700' : item.assign_team === 'strategy' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'; return (
                  <TableRow key={item.id}><TableCell><div className="flex items-center gap-2"><Icon className="h-4 w-4" style={{ color: actColors[item.activity_type] }} /><span className="text-sm font-medium">{item.activity_type}</span></div></TableCell>
                    <TableCell className="text-sm text-gray-500">{item.solution_category || '-'}</TableCell>
                    <TableCell><Badge variant="secondary" className={`text-[10px] ${teamColor}`}>{teamLabel}</Badge>{item.sponsor_pd && <p className="text-[9px] text-gray-400 mt-0.5">Sponsor: {item.sponsor_pd}</p>}</TableCell>
                    <TableCell className="text-right font-semibold">{item.target_count}</TableCell>
                    <TableCell className="text-right"><span className={(item.actual_count || 0) >= (item.target_count || 0) ? 'text-emerald-600 font-semibold' : ''}>{item.actual_count || 0}</span></TableCell>
                    <TableCell><span className={matched ? 'text-emerald-600' : 'text-orange-600'}>{assigned}/{item.target_count}</span> {remaining > 0 && <span className="text-xs text-red-500 ml-1">({remaining} left)</span>}</TableCell>
                    <TableCell><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRedistribute(item)}>Assign</Button><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => targetAPI.deletePlanItem(item.id).then(() => { toast.success('Deleted'); loadPlanDetails(selectedPlan.id); })}><Trash2 className="h-3 w-3" /></Button></div></TableCell>
                  </TableRow>); })}{planItems.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No activity items. Add items or accept system suggestions.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
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
              <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base">{plan.name} <Badge variant="outline" className="ml-2">OMR {(plan.target_amount || 0).toLocaleString()}</Badge></CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" className="text-xs" onClick={() => { setSelectedPlan(plan); setShowSegmentEditor(true); }}><Layers className="h-3.5 w-3.5 mr-1" /> Segment</Button>
                  <Button onClick={() => { setSelectedPlan(plan); setShowAddItem(true); }} className="bg-[#800000] hover:bg-[#9a1919] text-white text-xs"><Plus className="h-4 w-4 mr-1" /> Add Activity</Button>
                </div>
              </div></CardHeader>
              <CardContent>{(plan.items || []).length > 0 ? <Table><TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Target</TableHead><TableHead>Notes</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader><TableBody>{(plan.items || []).map(item => { const remaining = (item.target_count || 0) - (item.redistributed_total || 0); return (
                <TableRow key={item.id}><TableCell className="font-medium text-sm">{item.activity_type}</TableCell><TableCell className="text-sm text-gray-500">{item.solution_category || '-'}</TableCell><TableCell className="text-right font-semibold">{item.target_count} {remaining > 0 && <span className="text-xs text-red-500">({remaining} unassigned)</span>}</TableCell><TableCell className="text-sm text-gray-400">{item.notes || '-'}</TableCell>
                  <TableCell><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedPlan(plan); setShowRedistribute(item); }}>Assign</Button><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => targetAPI.deletePlanItem(item.id).then(() => { toast.success('Deleted'); loadData(); })}><Trash2 className="h-3 w-3" /></Button></div></TableCell></TableRow>); })}</TableBody></Table> : <p className="text-gray-400 text-sm py-4 text-center">No items yet. Segment your target by category, then add activity plans.</p>}</CardContent>
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
      {showExecutiveTabs && <CreatePlanDialog open={showCreatePlan} onClose={() => setShowCreatePlan(false)} onCreated={(newPlan) => { loadData().then(() => { setShowCreatePlan(false); if (newPlan) { setSelectedPlan(newPlan); setTab('pm'); } }); }} productManagers={productManagers} />}
      {selectedPlan && <AddItemDialog open={showAddItem} onClose={() => setShowAddItem(false)} onCreated={() => { if (selectedPlan) loadPlanDetails(selectedPlan.id); loadData(); setShowAddItem(false); }} planId={selectedPlan.id} solutionCats={isPD ? solutionCats.filter(c => (myData?.my_categories || []).includes(c.name)) : solutionCats} activityTypes={activityTypes} />}
      {showRedistribute && <RedistributeDialog open={!!showRedistribute} onClose={() => setShowRedistribute(null)} onCreated={() => { if (selectedPlan) loadPlanDetails(selectedPlan.id); loadData(); setShowRedistribute(null); }} item={showRedistribute} salespersons={isPD ? (myData?.my_salespersons || []).map(s => ({...s, total_pipeline: s.pipeline || 0})) : salespersons} />}
      {selectedPlan && <SegmentEditorDialog open={showSegmentEditor} onClose={() => setShowSegmentEditor(false)} plan={selectedPlan} solutionCats={solutionCats} onSaved={() => { loadPlanDetails(selectedPlan.id); loadData(); setShowSegmentEditor(false); }} />}
      <AdvancedFilterBuilder open={showAdvancedFilter} onClose={() => setShowAdvancedFilter(false)}
        currentFilters={{ year: yearFilter, productDirector: pmFilter, solutionCategory: catFilter }}
        filterOptions={{ productDirectors: productManagers.map(p => p.name), solutionCategories: solutionCats.map(c => c.name), salespersons: salespersons.map(s => s.name) }}
        onApply={(filters) => {
          if (filters.year) setYearFilter(filters.year);
          if (filters.productDirector) setPmFilter(filters.productDirector);
          if (filters.solutionCategory) setCatFilter(filters.solutionCategory);
          if (filters.quarter) setYearFilter('');
        }}
      />
    </div>
  );
}

// ===== CASCADE PLAN CARD (shows the visual flow: CEO → PD → Categories → Activities) =====
function CascadePlanCard({ plan, selected, onSelect, onSegment, onViewPlan, onDelete, planTypeLabel }) {
  const bookingTarget = plan.booking_target || plan.target_amount || 0;
  const bookingPct = plan.booking_pct || 0;
  const invoicedPct = plan.invoiced_pct || 0;
  const marginPct = plan.margin_pct || 0;
  const isSegmented = plan.segmented || plan.segment_count > 0;
  const pType = plan.plan_type || 'revenue';
  const typeColor = pType === 'strategy' ? 'purple' : pType === 'marketing' ? 'blue' : 'gray';

  return (
    <Card className={`transition-all ${selected ? 'border-[#800000] shadow-md' : 'hover:border-gray-300'}`} data-testid={`cascade-card-${plan.id}`}>
      <CardContent className="p-4">
        {/* Plan Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="cursor-pointer" onClick={onSelect}>
            <h3 className="font-semibold text-base text-gray-900 flex items-center gap-2">
              {plan.name}
              {planTypeLabel && <Badge variant="outline" className={`text-[10px] border-${typeColor}-200 bg-${typeColor}-50 text-${typeColor}-700`}>{planTypeLabel}</Badge>}
            </h3>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <User className="h-3 w-3" /> {plan.product_manager_name}
              <span className="text-gray-300 mx-1">|</span>
              {plan.period}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!isSegmented && (
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100" onClick={onSegment}>
                <Layers className="h-3 w-3 mr-1" /> Segment
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onViewPlan}>
              <ArrowRight className="h-3 w-3 mr-1" /> Plan Builder
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Triple Target Progress */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-gray-500 uppercase">Booking</span>
              <span className="text-xs font-bold text-gray-900">{bookingPct}%</span>
            </div>
            <Progress value={Math.min(bookingPct, 100)} className="h-2" />
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-gray-400">OMR {(plan.actual_booking || 0).toLocaleString()}</span>
              <span className="text-[10px] text-gray-400">/ {bookingTarget.toLocaleString()}</span>
            </div>
          </div>
          {plan.invoiced_target > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-gray-500 uppercase">Invoiced</span>
                <span className="text-xs font-bold text-gray-900">{invoicedPct}%</span>
              </div>
              <Progress value={Math.min(invoicedPct, 100)} className="h-2" />
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-gray-400">OMR {(plan.actual_invoiced || 0).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">/ {plan.invoiced_target.toLocaleString()}</span>
              </div>
            </div>
          )}
          {plan.margin_target > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-gray-500 uppercase">Margin</span>
                <span className="text-xs font-bold text-gray-900">{marginPct}%</span>
              </div>
              <Progress value={Math.min(marginPct, 100)} className="h-2" />
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-gray-400">OMR {(plan.actual_margin || 0).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">/ {plan.margin_target.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2 text-[10px]">
          <Badge variant="secondary" className="text-[10px]">{plan.total_opps || 0} open opps</Badge>
          <Badge variant="secondary" className="text-[10px]">Pipeline: OMR {(plan.total_pipeline || 0).toLocaleString()}</Badge>
          {isSegmented && <Badge variant="outline" className="text-[10px] border-green-200 bg-green-50 text-green-700"><Layers className="h-2.5 w-2.5 mr-0.5" /> {plan.segment_count || '?'} categories</Badge>}
          <Badge variant="secondary" className="text-[10px]">{plan.activity_items_count || 0} activities</Badge>
          {plan.won_deals > 0 && <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">{plan.won_deals} won</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== SEGMENT BREAKDOWN CARD (visual category breakdown) =====
function SegmentBreakdownCard({ segments, onEdit }) {
  const segList = segments?.segments || [];
  const totals = segments?.totals || {};
  const planTargets = segments?.plan_targets || {};
  const isBalanced = segments?.is_balanced;

  if (segList.length === 0) return null;

  const chartData = segList.map((s, i) => ({
    name: s.solution_category,
    value: s.booking_target,
    fill: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }));

  return (
    <Card className="border-[#800000]/10" data-testid="segment-breakdown">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#800000]" /> Category Segmentation
            {isBalanced ? <Badge variant="outline" className="text-[10px] border-green-200 bg-green-50 text-green-700"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Balanced</Badge>
              : <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Unbalanced</Badge>}
          </CardTitle>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEdit}>Edit Segments</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <div className="h-48">
            <ResponsiveContainer>
              <RPieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name.substring(0, 10)} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <RTooltip formatter={(v) => `OMR ${v.toLocaleString()}`} />
              </RPieChart>
            </ResponsiveContainer>
          </div>
          {/* Table */}
          <div className="lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Booking Target</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Pipeline</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segList.map((seg, i) => (
                  <TableRow key={seg.id || i}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                        <span className="text-sm font-medium">{seg.solution_category}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">OMR {(seg.booking_target || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-sm ${seg.booking_pct >= 80 ? 'text-emerald-600' : seg.booking_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {seg.booking_pct || 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-gray-500">OMR {(seg.pipeline || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className={`text-[10px] ${(seg.coverage_ratio || 0) >= 3 ? 'bg-emerald-100 text-emerald-700' : (seg.coverage_ratio || 0) >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {seg.coverage_ratio || 0}x
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-semibold">
                  <TableCell className="text-sm">Total</TableCell>
                  <TableCell className="text-right font-mono text-sm">OMR {(totals.booking_target || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-sm">OMR {(totals.actual_booking || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-sm">OMR {(totals.pipeline || 0).toLocaleString()}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== SEGMENT EDITOR DIALOG =====
function SegmentEditorDialog({ open, onClose, plan, solutionCats, onSaved }) {
  const bookingTarget = plan?.booking_target || plan?.target_amount || 0;
  const invoicedTarget = plan?.invoiced_target || 0;
  const marginTarget = plan?.margin_target || 0;
  
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Load existing segments or initialize from categories
  useEffect(() => {
    if (!open || !plan) return;
    setLoadingExisting(true);
    targetAPI.listSegments(plan.id).then(res => {
      const existing = res.data?.segments || [];
      if (existing.length > 0) {
        setRows(existing.map(s => ({
          solution_category: s.solution_category,
          booking_target: s.booking_target || 0,
          invoiced_target: s.invoiced_target || 0,
          margin_target: s.margin_target || 0,
          notes: s.notes || '',
        })));
      } else {
        // Initialize from solution categories
        const cats = solutionCats.slice(0, 8);
        if (cats.length > 0) {
          const weight = 1 / cats.length;
          setRows(cats.map(c => ({
            solution_category: c.name,
            booking_target: Math.round(bookingTarget * weight),
            invoiced_target: Math.round(invoicedTarget * weight),
            margin_target: Math.round(marginTarget * weight),
            notes: '',
          })));
        }
      }
    }).catch(() => {}).finally(() => setLoadingExisting(false));
  }, [open, plan, solutionCats, bookingTarget, invoicedTarget, marginTarget]);

  const sumBooking = rows.reduce((s, r) => s + (r.booking_target || 0), 0);
  const sumInvoiced = rows.reduce((s, r) => s + (r.invoiced_target || 0), 0);
  const sumMargin = rows.reduce((s, r) => s + (r.margin_target || 0), 0);
  const bookingDiff = sumBooking - bookingTarget;
  const invoicedDiff = invoicedTarget > 0 ? sumInvoiced - invoicedTarget : 0;
  const marginDiff = marginTarget > 0 ? sumMargin - marginTarget : 0;
  const isValid = Math.abs(bookingDiff) < 2 && Math.abs(invoicedDiff) < 2 && Math.abs(marginDiff) < 2;

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, { solution_category: '', booking_target: 0, invoiced_target: 0, margin_target: 0, notes: '' }]);
  };

  const removeRow = (idx) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const autoBalance = () => {
    if (rows.length === 0) return;
    const remaining_booking = bookingTarget - rows.slice(0, -1).reduce((s, r) => s + (r.booking_target || 0), 0);
    const remaining_invoiced = invoicedTarget - rows.slice(0, -1).reduce((s, r) => s + (r.invoiced_target || 0), 0);
    const remaining_margin = marginTarget - rows.slice(0, -1).reduce((s, r) => s + (r.margin_target || 0), 0);
    setRows(prev => prev.map((r, i) => i === prev.length - 1 ? {
      ...r,
      booking_target: Math.max(0, Math.round(remaining_booking)),
      invoiced_target: Math.max(0, Math.round(remaining_invoiced)),
      margin_target: Math.max(0, Math.round(remaining_margin)),
    } : r));
  };

  const handleSave = async () => {
    const validRows = rows.filter(r => r.solution_category && r.booking_target > 0);
    if (validRows.length === 0) { toast.error('Add at least one category'); return; }
    if (!isValid) { toast.error('Category totals must match plan target'); return; }
    setSaving(true);
    try {
      await targetAPI.saveSegments(plan.id, validRows);
      toast.success(`${validRows.length} category segments saved`);
      onSaved();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to save segments');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]" data-testid="segment-editor-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#800000]" />
            Segment by Solution Category
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Break down <strong>{plan?.product_manager_name}</strong>'s target into solution categories.
            Total must match: Booking OMR {bookingTarget.toLocaleString()}
            {invoicedTarget > 0 ? ` | Invoiced OMR ${invoicedTarget.toLocaleString()}` : ''}
            {marginTarget > 0 ? ` | Margin OMR ${marginTarget.toLocaleString()}` : ''}
          </p>
        </DialogHeader>

        {loadingExisting ? <div className="p-8 text-center"><Skeleton className="h-32 w-full" /></div> : (
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: SEGMENT_COLORS[idx % SEGMENT_COLORS.length] }} />
                  <div className="flex-1 grid grid-cols-5 gap-2">
                    <div>
                      <Label className="text-[10px] text-gray-400">Category</Label>
                      <Select value={row.solution_category} onValueChange={v => updateRow(idx, 'solution_category', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{solutionCats.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-400">Booking (OMR)</Label>
                      <Input type="number" value={row.booking_target} onChange={e => updateRow(idx, 'booking_target', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    {invoicedTarget > 0 && <div>
                      <Label className="text-[10px] text-gray-400">Invoiced (OMR)</Label>
                      <Input type="number" value={row.invoiced_target} onChange={e => updateRow(idx, 'invoiced_target', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>}
                    {marginTarget > 0 && <div>
                      <Label className="text-[10px] text-gray-400">Margin (OMR)</Label>
                      <Input type="number" value={row.margin_target} onChange={e => updateRow(idx, 'margin_target', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>}
                    <div>
                      <Label className="text-[10px] text-gray-400">Notes</Label>
                      <Input value={row.notes} onChange={e => updateRow(idx, 'notes', e.target.value)} className="h-8 text-xs" placeholder="Optional" />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500 shrink-0" onClick={() => removeRow(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Validation summary */}
        <div className={`p-3 rounded-lg border ${isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between text-sm">
            <div className="space-y-0.5">
              <div className="flex items-center gap-4">
                <span className="text-gray-600">Booking: <span className={`font-bold ${Math.abs(bookingDiff) < 2 ? 'text-green-700' : 'text-red-700'}`}>OMR {sumBooking.toLocaleString()}</span> / {bookingTarget.toLocaleString()}</span>
                {bookingDiff !== 0 && <span className="text-xs text-red-500">({bookingDiff > 0 ? '+' : ''}{bookingDiff.toLocaleString()})</span>}
              </div>
              {invoicedTarget > 0 && <div className="flex items-center gap-4">
                <span className="text-gray-600">Invoiced: <span className={`font-bold ${Math.abs(invoicedDiff) < 2 ? 'text-green-700' : 'text-red-700'}`}>OMR {sumInvoiced.toLocaleString()}</span> / {invoicedTarget.toLocaleString()}</span>
              </div>}
              {marginTarget > 0 && <div className="flex items-center gap-4">
                <span className="text-gray-600">Margin: <span className={`font-bold ${Math.abs(marginDiff) < 2 ? 'text-green-700' : 'text-red-700'}`}>OMR {sumMargin.toLocaleString()}</span> / {marginTarget.toLocaleString()}</span>
              </div>}
            </div>
            {isValid ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow} className="text-xs"><Plus className="h-3 w-3 mr-1" /> Add Category</Button>
            <Button variant="outline" size="sm" onClick={autoBalance} className="text-xs">Auto-Balance Last Row</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !isValid} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="save-segments-btn">
              {saving ? 'Saving...' : `Save ${rows.filter(r => r.solution_category).length} Segments`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== ASSIGNEE INPUT (for strategy/marketing — loads employees) =====
function AssigneeInput({ value, onChange, teamType }) {
  const [employees, setEmployees] = useState([]);
  const [inputVal, setInputVal] = useState(value || '');
  useEffect(() => {
    targetAPI.getEmployees({ department: teamType === 'strategy' ? 'Strategy' : 'Marketing' })
      .then(r => setEmployees(r.data || []))
      .catch(() => {
        // Fallback: load all employees
        targetAPI.getEmployees({}).then(r => setEmployees(r.data || [])).catch(() => {});
      });
  }, [teamType]);

  return (
    <div>
      <Input value={inputVal} onChange={e => { setInputVal(e.target.value); onChange(e.target.value); }}
        placeholder={`Type ${teamType === 'strategy' ? 'Strategy' : 'Marketing'} team member name`}
        className="h-9 text-sm" data-testid="assignee-input" />
      {employees.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {employees.slice(0, 10).map(emp => (
            <button key={emp.name || emp.canonical_id} onClick={() => { setInputVal(emp.name); onChange(emp.name); }}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${inputVal === emp.name ? 'bg-[#800000] text-white border-[#800000]' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
              {emp.name} {emp.job_title ? `(${emp.job_title})` : ''}
            </button>
          ))}
        </div>
      )}
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
  const [form, setForm] = useState({ name: '', product_manager_name: '', product_manager_id: '', booking_target: 0, invoiced_target: 0, margin_target: 0, target_amount: 0, period: '2026-Q1', plan_type: 'revenue' }); const [sub, setSub] = useState(false);
  const handlePM = (n) => { const pm = productManagers.find(p => p.name === n); setForm(f => ({ ...f, product_manager_name: n, product_manager_id: String(pm?.id || ''), name: `${f.period.split('-')[1]} ${f.period.split('-')[0]} - ${n}` })); };
  const planTypeLabels = { revenue: 'Product Director', strategy: 'Strategy Team Member', marketing: 'Marketing Team Member' };
  const submit = async () => { if (!form.product_manager_name || !form.booking_target) { toast.error('Select assignee and booking target'); return; } setSub(true); try { const res = await targetAPI.createRevenuePlan({...form, target_amount: form.booking_target}); toast.success('Plan created!'); onCreated(res.data); } catch (err) { const detail = err.response?.data?.detail; const msg = Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') : (typeof detail === 'string' ? detail : 'Failed'); toast.error(msg); } finally { setSub(false); } };
  return <Dialog open={open} onOpenChange={onClose}><DialogContent className="max-w-lg" data-testid="create-plan-dialog"><DialogHeader><DialogTitle>Assign Revenue Target</DialogTitle></DialogHeader><div className="space-y-3">
    <div><Label className="text-xs text-gray-500">Target Type</Label>
      <Select value={form.plan_type} onValueChange={v => setForm(f => ({ ...f, plan_type: v }))}>
        <SelectTrigger data-testid="select-plan-type"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="revenue">Product Director (Revenue)</SelectItem>
          <SelectItem value="strategy">Strategy Team (Revenue + Activities)</SelectItem>
          <SelectItem value="marketing">Marketing Team (Campaign Activities)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div><Label className="text-xs text-gray-500">{planTypeLabels[form.plan_type] || 'Assignee'}</Label>
      {form.plan_type === 'revenue' ? (
        <Select value={form.product_manager_name} onValueChange={handlePM}><SelectTrigger data-testid="select-pd"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{productManagers.map(pm => <SelectItem key={pm.name} value={pm.name}>{pm.name} ({pm.opp_count} opps)</SelectItem>)}</SelectContent></Select>
      ) : (
        <AssigneeInput value={form.product_manager_name} onChange={(name) => setForm(f => ({ ...f, product_manager_name: name, name: `${f.period.split('-')[1]} ${f.period.split('-')[0]} - ${name}` }))} teamType={form.plan_type} />
      )}
      {form.plan_type === 'strategy' && <p className="text-[10px] text-purple-600 mt-1">Strategy Team gets a parallel revenue target from CEO + assessment/workshop activities</p>}
      {form.plan_type === 'marketing' && <p className="text-[10px] text-blue-600 mt-1">Marketing gets campaign activities; PDs sponsor, marketing executes</p>}
    </div>
    <div className="grid grid-cols-3 gap-3"><div><Label className="text-xs text-gray-500">Booking Target (OMR)</Label><p className="text-[10px] text-gray-400 mb-1">{form.plan_type === 'strategy' ? 'Revenue from services' : form.plan_type === 'marketing' ? 'Lead pipeline value' : 'Won CRM deals'}</p><Input type="number" value={form.booking_target} onChange={e => setForm(f => ({ ...f, booking_target: parseFloat(e.target.value) || 0 }))} data-testid="booking-target-input" /></div><div><Label className="text-xs text-gray-500">Invoiced Target (OMR)</Label><p className="text-[10px] text-gray-400 mb-1">Paid invoices</p><Input type="number" value={form.invoiced_target} onChange={e => setForm(f => ({ ...f, invoiced_target: parseFloat(e.target.value) || 0 }))} data-testid="invoiced-target-input" /></div><div><Label className="text-xs text-gray-500">Margin Target (OMR)</Label><p className="text-[10px] text-gray-400 mb-1">Gross profit</p><Input type="number" value={form.margin_target} onChange={e => setForm(f => ({ ...f, margin_target: parseFloat(e.target.value) || 0 }))} data-testid="margin-target-input" /></div></div><div className="grid grid-cols-2 gap-3"><div><Label className="text-xs text-gray-500">Period</Label><Select value={form.period} onValueChange={v => setForm(f => ({...f, period: v, name: `${v.split('-')[1]} ${v.split('-')[0]} - ${f.product_manager_name || ''}`}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2026-Q1">Q1 2026</SelectItem><SelectItem value="2026-Q2">Q2 2026</SelectItem><SelectItem value="2026-Q3">Q3 2026</SelectItem><SelectItem value="2026-Q4">Q4 2026</SelectItem></SelectContent></Select></div><div><Label className="text-xs text-gray-500">Plan Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={sub} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="submit-plan-btn">{sub ? '...' : 'Assign Target'}</Button></DialogFooter></DialogContent></Dialog>;
}

function AddItemDialog({ open, onClose, onCreated, planId, solutionCats, activityTypes }) {
  const [form, setForm] = useState({ activity_type: '', solution_category: '', target_count: 10, notes: '', assign_team: '', sponsor_pd: '' }); const [sub, setSub] = useState(false);
  const allActivityTypes = [
    ...activityTypes,
    ...[
      { type: 'Awareness Camp', count: 0 },
      { type: 'Assessment Services', count: 0 },
      { type: 'CEO Presentation', count: 0 },
      { type: 'Digital Campaign', count: 0 },
      { type: 'Event', count: 0 },
    ].filter(at => !activityTypes.find(a => a.type === at.type))
  ];
  const submit = async () => { if (!form.activity_type) { toast.error('Select type'); return; } setSub(true); try { await targetAPI.createPlanItem(planId, { ...form, assign_team: form.assign_team || null, sponsor_pd: form.sponsor_pd || null }); toast.success('Added'); onCreated(); } catch { toast.error('Failed'); } finally { setSub(false); } };
  return <Dialog open={open} onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>Add Activity Plan Item</DialogTitle></DialogHeader><div className="space-y-3">
    <div><Label className="text-xs">Activity Type</Label><Select value={form.activity_type} onValueChange={v => setForm(f => ({ ...f, activity_type: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{allActivityTypes.map(at => <SelectItem key={at.type} value={at.type}>{at.type} {at.count > 0 ? `(${at.count})` : ''}</SelectItem>)}</SelectContent></Select></div>
    <div><Label className="text-xs">Solution Category</Label><Select value={form.solution_category || '_none'} onValueChange={v => setForm(f => ({ ...f, solution_category: v === '_none' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="_none">Any</SelectItem>{solutionCats.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label className="text-xs">Executing Team</Label><Select value={form.assign_team || '_sales'} onValueChange={v => setForm(f => ({ ...f, assign_team: v === '_sales' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="_sales">Sales Team</SelectItem><SelectItem value="marketing">Marketing Team (PD sponsors)</SelectItem><SelectItem value="strategy">Strategy GM Team (PD sponsors)</SelectItem></SelectContent></Select>
      {(form.assign_team === 'marketing' || form.assign_team === 'strategy') && <p className="text-[10px] text-gray-500 mt-1">PD sponsors this activity; {form.assign_team} team executes</p>}
    </div>
    <div><Label className="text-xs">Target Count</Label><Input type="number" value={form.target_count} onChange={e => setForm(f => ({ ...f, target_count: parseInt(e.target.value) || 0 }))} /></div>
    <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Thales DAM customer awareness roundtable Q2" /></div>
  </div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={sub} className="bg-[#800000] hover:bg-[#9a1919] text-white">{sub ? '...' : 'Add'}</Button></DialogFooter></DialogContent></Dialog>;
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
        {form.assign_type === 'team' && <div><Label className="text-xs">Team / Department</Label><Select value={form.assigned_to_name} onValueChange={v => { const t = teamOptions.find(x => x.name === v); setForm(f => ({ ...f, assigned_to_name: v, team_name: v, notes: t?.manager_name ? `HOD: ${t.manager_name} (${t.member_count} members)` : '' })); }}><SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger><SelectContent>{teamOptions.map(t => <SelectItem key={t.name} value={t.name}>{t.name} - {t.member_count || 0} members</SelectItem>)}</SelectContent></Select>
          {form.team_name && teamOptions.find(t => t.name === form.team_name)?.members && <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs"><p className="font-medium text-gray-600 mb-1">Members:</p>{teamOptions.find(t => t.name === form.team_name)?.members?.map(m => <p key={m.name} className="text-gray-500">{m.name} - {m.job_title || 'Member'}</p>)}</div>}
        </div>}
        <div><Label className="text-xs">Count (max {remaining})</Label><Input type="number" value={form.assigned_count} onChange={e => setForm(f => ({ ...f, assigned_count: Math.min(parseInt(e.target.value) || 0, remaining) }))} /></div>
        <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={sub || !form.assigned_to_name} className="bg-[#800000] hover:bg-[#9a1919] text-white">{sub ? '...' : form.assign_type === 'team' ? 'Assign to Team' : 'Assign'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function CeoSummaryCard({ year }) {
  const [data, setData] = useState(null);
  useEffect(() => { targetAPI.getCeoSummary(year || new Date().getFullYear().toString()).then(r => setData(r.data)).catch(() => {}); }, [year]);
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
        {data.avg_deal_size > 0 && <p className="text-xs text-gray-600">
          Based on your historical data: Avg deal OMR {data.avg_deal_size?.toLocaleString()}, Win rate {data.win_rate}%, {data.required_deals} deals needed.
          Pipeline coverage: OMR {data.pipeline_coverage?.toLocaleString()} (3x target).
        </p>}
        {data.avg_deal_size === 0 && <p className="text-xs text-gray-600">
          AI-recommended activities based on solution categories and team type.
        </p>}
        <Table>
          <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Category</TableHead><TableHead>Team</TableHead><TableHead>Formula</TableHead><TableHead className="text-right w-24">Count</TableHead></TableRow></TableHeader>
          <TableBody>
            {mods.map((s, idx) => {
              const teamLabel = s.assign_team === 'marketing' ? 'Marketing' : s.assign_team === 'strategy' ? 'Strategy' : 'Sales';
              const teamColor = s.assign_team === 'marketing' ? 'bg-blue-100 text-blue-700' : s.assign_team === 'strategy' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600';
              return (
              <TableRow key={idx}>
                <TableCell className="font-medium text-sm">{s.activity_type}</TableCell>
                <TableCell className="text-xs text-gray-500">{s.solution_category || '-'}</TableCell>
                <TableCell><Badge variant="secondary" className={`text-[9px] ${teamColor}`}>{teamLabel}</Badge></TableCell>
                <TableCell className="text-xs text-gray-500">{s.formula}</TableCell>
                <TableCell className="text-right">
                  <Input type="number" value={s.count} onChange={e => {
                    const newMods = [...mods];
                    newMods[idx] = { ...newMods[idx], count: parseInt(e.target.value) || 0 };
                    setMods(newMods);
                  }} className="w-20 h-7 text-xs text-right" />
                </TableCell>
              </TableRow>);
            })}
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
