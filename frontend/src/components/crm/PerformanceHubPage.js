import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
import { useRBAC } from '../../lib/RBACContext';
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
  Target, Plus, TrendingUp, TrendingDown, Trophy, Users, Trash2,
  BarChart2, Activity, Phone, Mail, Calendar, Monitor, FlaskConical,
  Presentation, DollarSign, Calculator, ChevronDown, ChevronRight,
  Crosshair, Award, FileText, AlertTriangle, CheckCircle2, ArrowRight, Bell, User
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';

const actIcons = { Call: Phone, Email: Mail, Meeting: Calendar, Demo: Monitor, 'Proof of concept': FlaskConical, 'Work Shop': Presentation, 'Site Visit': Target };
const actColors = { Call: '#3b82f6', Email: '#8b5cf6', Meeting: '#10b981', Demo: '#f59e0b', 'Proof of concept': '#ef4444', 'Work Shop': '#06b6d4', 'Site Visit': '#ec4899' };

export default function PerformanceHubPage() {
  const { permissions, roles: rbacRoles } = useRBAC();
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

  // Role detection from /my-data response (server-side role check)
  const isAdmin = permissions.includes('admin:*') || permissions.includes('system_admin');
  const isPD = myData?.is_product_director;
  const isSD = myData?.is_sales_director && !isPD;
  const isRep = myData?.is_sales_rep;
  const canManage = permissions.includes('manage_goals');
  const showExecutiveTabs = isAdmin || isSD; // Only admin/SD see CEO/SD tabs, NOT product directors

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const calls = [targetAPI.getMyData(), targetAPI.getCollectionActuals(), targetAPI.getAlerts()];
      if (canManage) {
        calls.push(targetAPI.listRevenuePlans(), targetAPI.getActualsByPM(),
          targetAPI.getProductManagers(), targetAPI.getSolutionCategories(),
          targetAPI.getSalespersons(), targetAPI.getActivityTypes());
      }
      const results = await Promise.allSettled(calls);
      if (results[0].status === 'fulfilled') setMyData(results[0].value.data);
      if (results[1].status === 'fulfilled') setCollection(results[1].value.data);
      if (results[2].status === 'fulfilled') setAlertsData(results[2].value.data);
      if (canManage) {
        if (results[3]?.status === 'fulfilled') setPlans(results[3].value.data);
        if (results[4]?.status === 'fulfilled') setPmActuals(results[4].value.data);
        if (results[5]?.status === 'fulfilled') setProductManagers(results[5].value.data);
        if (results[6]?.status === 'fulfilled') setSolutionCats(results[6].value.data);
        if (results[7]?.status === 'fulfilled') setSalespersons(results[7].value.data);
        if (results[8]?.status === 'fulfilled') setActivityTypes(results[8].value.data);
      }
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, [canManage]);

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

  const isPD = myData?.is_product_director;
  const isRep = myData?.is_sales_rep;
  const defaultTab = isAdmin || isSD ? 'ceo' : isPD ? 'myplan' : 'mytargets';

  const [tab, setTab] = useState(null);
  useEffect(() => { if (myData && !tab) setTab(defaultTab); }, [myData, defaultTab, tab]);

  if (loading || !myData) return <div className="space-y-4" data-testid="performance-hub-loading"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-5 gap-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20" />)}</div></div>;

  return (
    <div className="space-y-5" data-testid="performance-hub-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Crosshair className="h-6 w-6 text-[#800000]" /> Performance Hub</h1>
          <p className="text-gray-500 text-sm">
            {isAdmin || isSD ? 'CEO targets, PM plans, Sales Director redistribution' : isPD ? `Product Director: ${myData.user_name}` : `My Targets: ${myData.user_name}`}
          </p>
        </div>
        {canManage && <Button onClick={() => setShowCreatePlan(true)} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="create-plan-btn"><Plus className="h-4 w-4 mr-1" /> Assign Revenue Target</Button>}
      </div>

      {/* Alert Center */}
      {alertsData.summary?.total > 0 && canManage && (
        <AlertBanner alertsData={alertsData} expanded={showAlerts} onToggle={() => setShowAlerts(!showAlerts)} />
      )}

      <Tabs value={tab || defaultTab} onValueChange={setTab}>
        <TabsList>
          {/* Admin/SD tabs */}
          {(isAdmin || isSD) && <TabsTrigger value="ceo">CEO View</TabsTrigger>}
          {(isAdmin || isSD) && <TabsTrigger value="pm">PM Plan Builder</TabsTrigger>}
          {(isAdmin || isSD) && <TabsTrigger value="sd">Sales Director</TabsTrigger>}
          {(isAdmin || isSD) && <TabsTrigger value="marketing">Marketing</TabsTrigger>}
          {/* Product Director tabs */}
          {isPD && <TabsTrigger value="myplan">My Plan</TabsTrigger>}
          {isPD && <TabsTrigger value="myteam">My Team</TabsTrigger>}
          {/* Sales Rep tab */}
          {isRep && <TabsTrigger value="mytargets">My Targets</TabsTrigger>}
          {/* Shared tabs */}
          <TabsTrigger value="collection">Collection</TabsTrigger>
          {canManage && <TabsTrigger value="incentive">Incentive</TabsTrigger>}
        </TabsList>

        {/* ===== CEO VIEW (Admin/SD only) ===== */}
        {(isAdmin || isSD) && (
          <TabsContent value="ceo" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-[#800000]" /> Revenue Plans Assigned to PMs</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Product Director</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Pipeline</TableHead><TableHead>Items</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {plans.map(p => (
                        <TableRow key={p.id} className={`cursor-pointer hover:bg-gray-50 ${selectedPlan?.id === p.id ? 'bg-blue-50' : ''}`} onClick={() => { setSelectedPlan(p); setTab('pm'); }}>
                          <TableCell className="font-medium text-sm">{p.name}</TableCell>
                          <TableCell className="text-sm text-gray-600">{p.product_manager_name}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">OMR {(p.target_amount || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm text-gray-500 font-mono">{(p.total_pipeline || 0).toLocaleString()}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{p.activity_items_count || 0} items</Badge></TableCell>
                          <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={e => { e.stopPropagation(); targetAPI.deleteRevenuePlan(p.id).then(() => { toast.success('Deleted'); loadData(); }); }}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                        </TableRow>
                      ))}
                      {plans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No revenue plans yet.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">PM Performance (Odoo)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {pmActuals.map(pm => (
                    <div key={pm.product_manager} className="p-2 rounded-lg bg-gray-50">
                      <div className="flex justify-between"><span className="text-sm font-medium">{pm.product_manager}</span><span className="text-xs text-gray-400">{pm.opp_count} opps</span></div>
                      <div className="text-xs text-gray-500 mt-0.5">{pm.categories?.slice(0, 3).join(', ')}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* ===== PM PLAN BUILDER (Admin/SD) ===== */}
        {(isAdmin || isSD) && (
          <TabsContent value="pm" className="mt-4 space-y-4">
            <PlanBuilderView selectedPlan={selectedPlan} planItems={planItems} redistributions={redistributions}
              onAddItem={() => setShowAddItem(true)} onRedistribute={setShowRedistribute}
              onDeleteItem={id => targetAPI.deletePlanItem(id).then(() => { toast.success('Deleted'); loadPlanDetails(selectedPlan.id); })}
              onDeleteRedist={id => targetAPI.deleteRedistribution(id).then(() => { toast.success('Deleted'); loadPlanDetails(selectedPlan.id); })}
              selectPlanPrompt="Select a plan from CEO View" />
          </TabsContent>
        )}

        {/* ===== SALES DIRECTOR (Admin/SD) ===== */}
        {(isAdmin || isSD) && (
          <TabsContent value="sd" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-yellow-500" /> Salesperson Performance (Odoo)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Salesperson</TableHead><TableHead className="text-right">Pipeline</TableHead><TableHead className="text-right">Opps</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {salespersons.slice(0, 15).map((sp, idx) => (
                      <TableRow key={sp.name} className={idx < 3 ? 'bg-gray-50/50' : ''}>
                        <TableCell>{idx === 0 ? <Trophy className="h-4 w-4 text-yellow-500" /> : <span className="text-gray-400 text-sm">{idx+1}</span>}</TableCell>
                        <TableCell className="font-medium text-sm">{sp.name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{sp.total_pipeline.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">{sp.opp_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ===== MARKETING (Admin/SD) ===== */}
        {(isAdmin || isSD) && <TabsContent value="marketing" className="mt-4"><MarketingView /></TabsContent>}

        {/* ===== MY PLAN (Product Director) ===== */}
        {isPD && (
          <TabsContent value="myplan" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">My Opportunities</p><p className="text-2xl font-bold">{myData.pm_summary?.opp_count || 0}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Pipeline</p><p className="text-2xl font-bold">OMR {(myData.pm_summary?.total_pipeline || 0).toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Won Deals</p><p className="text-2xl font-bold text-emerald-600">{myData.pm_summary?.won_count || 0}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Categories</p><p className="text-2xl font-bold">{myData.my_categories?.length || 0}</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">My Solution Categories</CardTitle></CardHeader>
              <CardContent><div className="flex flex-wrap gap-2">{(myData.my_categories || []).map(c => <Badge key={c} variant="secondary">{c}</Badge>)}</div></CardContent>
            </Card>
            {(myData.my_plans || []).map(plan => (
              <Card key={plan.id}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{plan.name} <Badge variant="outline" className="ml-2">OMR {(plan.target_amount || 0).toLocaleString()}</Badge></CardTitle></CardHeader>
                <CardContent>
                  {(plan.items || []).length > 0 ? (
                    <Table>
                      <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Target</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {(plan.items || []).map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-sm">{item.activity_type}</TableCell>
                            <TableCell className="text-sm text-gray-500">{item.solution_category || '-'}</TableCell>
                            <TableCell className="text-right font-semibold">{item.target_count}</TableCell>
                            <TableCell className="text-sm text-gray-400">{item.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : <p className="text-gray-400 text-sm py-4 text-center">No activity items in this plan yet.</p>}
                </CardContent>
              </Card>
            ))}
            {(myData.my_plans || []).length === 0 && <Card><CardContent className="p-8 text-center text-gray-400">No plans assigned to you yet. Ask your CEO/Sales Director to assign a revenue target.</CardContent></Card>}
          </TabsContent>
        )}

        {/* ===== MY TEAM (Product Director) ===== */}
        {isPD && (
          <TabsContent value="myteam" className="mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-[#800000]" /> Salespersons on My Opportunities</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Salesperson</TableHead><TableHead className="text-right">Opportunities</TableHead><TableHead className="text-right">Pipeline</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(myData.my_salespersons || []).map((sp, idx) => (
                      <TableRow key={sp.name}>
                        <TableCell>{idx === 0 ? <Trophy className="h-4 w-4 text-yellow-500" /> : <span className="text-gray-400">{idx+1}</span>}</TableCell>
                        <TableCell className="font-medium">{sp.name}</TableCell>
                        <TableCell className="text-right">{sp.opp_count}</TableCell>
                        <TableCell className="text-right font-mono">{sp.pipeline.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ===== MY TARGETS (Sales Rep) ===== */}
        {isRep && (
          <TabsContent value="mytargets" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">My Opportunities</p><p className="text-2xl font-bold">{myData.my_opp_summary?.opp_count || 0}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">My Pipeline</p><p className="text-2xl font-bold">OMR {(myData.my_opp_summary?.total_pipeline || 0).toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Won Deals</p><p className="text-2xl font-bold text-emerald-600">{myData.my_opp_summary?.won_count || 0}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">My Accounts</p><p className="text-2xl font-bold">{myData.my_accounts_count || 0}</p></CardContent></Card>
            </div>

            {/* My Activities from Odoo */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-purple-500" /> My Activities (from Odoo)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(myData.my_activities || []).map(a => {
                    const Icon = actIcons[a.type] || Activity;
                    return (
                      <div key={a.type} className="p-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-1.5 mb-1"><Icon className="h-3.5 w-3.5" style={{ color: actColors[a.type] || '#6b7280' }} /><span className="text-xs text-gray-500">{a.type}</span></div>
                        <p className="text-lg font-bold text-gray-900">{a.count}</p>
                      </div>
                    );
                  })}
                </div>
                {(myData.my_activities || []).length === 0 && <p className="text-gray-400 text-sm text-center py-4">No activities recorded</p>}
              </CardContent>
            </Card>

            {/* Assigned Tasks (from Sales Director redistribution) */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-[#800000]" /> Assigned Targets</CardTitle></CardHeader>
              <CardContent>
                {(myData.my_assigned_tasks || []).length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Solution</TableHead><TableHead>From PM</TableHead><TableHead className="text-right">Target Count</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(myData.my_assigned_tasks || []).map(t => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium text-sm">{t.activity_type}</TableCell>
                          <TableCell className="text-sm text-gray-500">{t.solution_category || '-'}</TableCell>
                          <TableCell className="text-sm text-gray-500">{t.product_manager_name || '-'}</TableCell>
                          <TableCell className="text-right font-semibold">{t.assigned_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-gray-400 text-sm text-center py-4">No targets assigned to you yet. Your Sales Director will assign activity targets.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ===== COLLECTION (all roles) ===== */}
        <TabsContent value="collection" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(collection.by_state || {}).map(([state, data]) => (
              <Card key={state}><CardContent className="p-4"><p className="text-xs text-gray-500 uppercase">{state.replace('_', ' ')}</p><p className="text-xl font-bold">{data.count} invoices</p><p className="text-sm text-gray-500 font-mono">OMR {data.amount.toLocaleString()}</p></CardContent></Card>
            ))}
          </div>
          <Card className="border-red-200"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-full bg-red-50"><AlertTriangle className="h-6 w-6 text-red-500" /></div><div><h3 className="font-semibold">Overdue Invoices</h3><p className="text-sm text-gray-500">{collection.overdue_count || 0} past due</p><p className="text-lg font-bold text-red-600 font-mono">OMR {(collection.overdue_amount || 0).toLocaleString()}</p></div></CardContent></Card>
        </TabsContent>

        {/* ===== INCENTIVE (managers only) ===== */}
        {canManage && (
          <TabsContent value="incentive" className="mt-4">
            <IncentiveSection plans={plans} />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      {canManage && <CreatePlanDialog open={showCreatePlan} onClose={() => setShowCreatePlan(false)} onCreated={() => { loadData(); setShowCreatePlan(false); }} productManagers={productManagers} />}
      {selectedPlan && canManage && <AddItemDialog open={showAddItem} onClose={() => setShowAddItem(false)} onCreated={() => { loadPlanDetails(selectedPlan.id); loadData(); setShowAddItem(false); }} planId={selectedPlan.id} solutionCats={solutionCats} activityTypes={activityTypes} />}
      {showRedistribute && canManage && <RedistributeDialog open={!!showRedistribute} onClose={() => setShowRedistribute(null)} onCreated={() => { loadPlanDetails(selectedPlan.id); setShowRedistribute(null); }} item={showRedistribute} salespersons={salespersons} />}
    </div>
  );
}

// ================= SHARED COMPONENTS =================

function PlanBuilderView({ selectedPlan, planItems, redistributions, onAddItem, onRedistribute, onDeleteItem, onDeleteRedist, selectPlanPrompt }) {
  if (!selectedPlan) return <Card><CardContent className="p-8 text-center text-gray-400"><Target className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>{selectPlanPrompt}</p></CardContent></Card>;
  return (
    <>
      <Card className="border-[#800000]/20"><CardContent className="p-4 flex items-center justify-between"><div><h3 className="font-semibold">{selectedPlan.name}</h3><p className="text-sm text-gray-500">PM: {selectedPlan.product_manager_name} | Target: <span className="font-semibold">OMR {(selectedPlan.target_amount || 0).toLocaleString()}</span></p></div><Button onClick={onAddItem} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Plus className="h-4 w-4 mr-1" /> Add Activity Plan</Button></CardContent></Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Activity Plan Items <Badge variant="secondary" className="ml-2">{planItems.length}</Badge></CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Actual</TableHead><TableHead>Assigned</TableHead><TableHead>Match</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {planItems.map(item => {
                const Icon = actIcons[item.activity_type] || Activity;
                const assigned = item.redistributed_total || 0;
                const matched = assigned >= (item.target_count || 0) && item.target_count > 0;
                return (
                  <TableRow key={item.id}>
                    <TableCell><div className="flex items-center gap-2"><Icon className="h-4 w-4" style={{ color: actColors[item.activity_type] }} /><span className="text-sm font-medium">{item.activity_type}</span></div></TableCell>
                    <TableCell className="text-sm text-gray-500">{item.solution_category || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{item.target_count}</TableCell>
                    <TableCell className="text-right"><span className={(item.actual_count || 0) >= (item.target_count || 0) ? 'text-emerald-600 font-semibold' : ''}>{item.actual_count || 0}</span></TableCell>
                    <TableCell><span className={matched ? 'text-emerald-600' : 'text-orange-600'}>{assigned}/{item.target_count}</span> <span className="text-xs text-gray-400">to {item.redistributed_to_count || 0}</span></TableCell>
                    <TableCell>{matched ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-orange-400" />}</TableCell>
                    <TableCell><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRedistribute(item)}>Assign</Button><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => onDeleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button></div></TableCell>
                  </TableRow>
                );
              })}
              {planItems.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No items yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {redistributions.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Redistribution Details</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Category</TableHead><TableHead>Assigned To</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
              <TableBody>{redistributions.map(r => (
                <TableRow key={r.id}><TableCell>{r.activity_type}</TableCell><TableCell className="text-gray-500">{r.solution_category || '-'}</TableCell><TableCell className="font-medium">{r.assigned_to_name}</TableCell><TableCell className="text-right font-semibold">{r.assigned_count}</TableCell><TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => onDeleteRedist(r.id)}><Trash2 className="h-3 w-3" /></Button></TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function MarketingView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { targetAPI.getMarketingMetrics().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading) return <Skeleton className="h-64" />;
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total Leads</p><p className="text-2xl font-bold">{data.total_leads}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Opportunities</p><p className="text-2xl font-bold">{data.total_opportunities}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Conversion</p><p className="text-2xl font-bold text-emerald-600">{data.conversion_rate}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Converted</p><p className="text-2xl font-bold">{data.converted_count}</p></CardContent></Card>
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Leads by Product Director</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Product Director</TableHead><TableHead className="text-right">Leads</TableHead></TableRow></TableHeader><TableBody>{(data.leads_by_pm || []).map(pm => <TableRow key={pm.pm}><TableCell className="font-medium">{pm.pm}</TableCell><TableCell className="text-right font-semibold">{pm.count}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </div>
  );
}

function IncentiveSection({ plans }) {
  const [selectedTarget, setSelectedTarget] = useState('');
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const handleCalc = async () => {
    if (!selectedTarget) { toast.error('Select a plan'); return; }
    setCalculating(true);
    try { const res = await targetAPI.calculateMultiVectorIncentive({ plan_id: selectedTarget, revenue_weight: 50, activity_weight: 30, collection_weight: 20 }); setResult(res.data); } catch { toast.error('Failed'); } finally { setCalculating(false); }
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4 text-[#800000]" /> Multi-Vector Incentive</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="flex-1"><Label className="text-xs">Revenue Plan</Label><Select value={selectedTarget} onValueChange={setSelectedTarget}><SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger><SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <Button onClick={handleCalc} disabled={calculating} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Calculator className="h-4 w-4 mr-1" /> Calculate</Button>
        </div>
        {result && (
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-gray-50 text-center"><p className="text-[10px] text-gray-400">Score</p><p className="text-2xl font-bold">{result.composite_score}</p><Badge className="mt-1">{result.tier}</Badge></div>
            <div className="p-3 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400">Revenue</p><p className="text-sm font-bold">{result.vectors.revenue.achievement_pct}%</p></div>
            <div className="p-3 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400">Activity</p><p className="text-sm font-bold">{result.vectors.activity.achievement_pct}%</p></div>
            <div className="p-3 rounded-lg bg-emerald-50"><p className="text-[10px] text-emerald-600">Payout</p><p className="text-sm font-bold text-emerald-600">OMR {result.calculated_payout.toLocaleString()}</p></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertBanner({ alertsData, expanded, onToggle }) {
  const { alerts, summary } = alertsData;
  const sevConfig = { critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertTriangle }, high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: AlertTriangle }, medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: Bell }, positive: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2 } };
  return (
    <div data-testid="alert-center">
      <button onClick={onToggle} className={`w-full p-3 rounded-lg border flex items-center justify-between ${summary.critical > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center gap-3"><Bell className={`h-5 w-5 ${summary.critical > 0 ? 'text-red-500' : 'text-blue-500'}`} /><span className="text-sm font-medium">Alert Center</span>
          <div className="flex gap-2">{summary.critical > 0 && <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200">{summary.critical} Critical</Badge>}{(summary.medium || 0) > 0 && <Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-700 border-yellow-200">{summary.medium} Medium</Badge>}{(summary.positive || 0) > 0 && <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">{summary.positive} Positive</Badge>}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && <div className="mt-2 space-y-2">{alerts.map((a, i) => { const c = sevConfig[a.severity] || sevConfig.medium; const Icon = c.icon; return (
        <div key={i} className={`p-3 rounded-lg border ${c.bg} ${c.border} flex items-start gap-3`}><Icon className={`h-4 w-4 mt-0.5 ${c.text}`} /><div className="flex-1"><span className={`text-sm font-semibold ${c.text}`}>{a.title}</span><p className="text-xs text-gray-600">{a.message}</p></div>{a.metric !== undefined && <span className={`text-lg font-bold ${c.text}`}>{a.metric}%</span>}</div>
      ); })}</div>}
    </div>
  );
}

// ================= DIALOGS =================
function CreatePlanDialog({ open, onClose, onCreated, productManagers }) {
  const [form, setForm] = useState({ name: '', product_manager_name: '', product_manager_id: '', target_amount: 0, period: '2026-Q1' });
  const [submitting, setSubmitting] = useState(false);
  const handlePMChange = (pmName) => { const pm = productManagers.find(p => p.name === pmName); setForm(f => ({ ...f, product_manager_name: pmName, product_manager_id: pm?.id || '', name: `Q1 2026 - ${pmName}` })); };
  const handleSubmit = async () => { if (!form.product_manager_name || !form.target_amount) { toast.error('Select PM and target'); return; } setSubmitting(true); try { await targetAPI.createRevenuePlan(form); toast.success('Created'); onCreated(); } catch { toast.error('Failed'); } finally { setSubmitting(false); } };
  return (
    <Dialog open={open} onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>Assign Revenue Target to Product Director</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label className="text-xs">Product Director</Label><Select value={form.product_manager_name} onValueChange={handlePMChange}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{productManagers.map(pm => <SelectItem key={pm.name} value={pm.name}>{pm.name} ({pm.opp_count} opps)</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Revenue Target (OMR)</Label><Input type="number" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: parseFloat(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Plan Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] text-white">{submitting ? 'Creating...' : 'Assign'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function AddItemDialog({ open, onClose, onCreated, planId, solutionCats, activityTypes }) {
  const [form, setForm] = useState({ activity_type: '', solution_category: '', target_count: 10, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => { if (!form.activity_type) { toast.error('Select type'); return; } setSubmitting(true); try { await targetAPI.createPlanItem(planId, form); toast.success('Added'); onCreated(); } catch { toast.error('Failed'); } finally { setSubmitting(false); } };
  return (
    <Dialog open={open} onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>Add Activity Plan Item</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label className="text-xs">Activity Type</Label><Select value={form.activity_type} onValueChange={v => setForm(f => ({ ...f, activity_type: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{activityTypes.map(at => <SelectItem key={at.type} value={at.type}>{at.type} ({at.count})</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Solution Category</Label><Select value={form.solution_category || '_none'} onValueChange={v => setForm(f => ({ ...f, solution_category: v === '_none' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="_none">Any</SelectItem>{solutionCats.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Target Count</Label><Input type="number" value={form.target_count} onChange={e => setForm(f => ({ ...f, target_count: parseInt(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] text-white">{submitting ? 'Adding...' : 'Add'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function RedistributeDialog({ open, onClose, onCreated, item, salespersons }) {
  const [form, setForm] = useState({ assigned_to_name: '', assigned_count: 0 });
  const [submitting, setSubmitting] = useState(false);
  const remaining = (item.target_count || 0) - (item.redistributed_total || 0);
  const handleSubmit = async () => { if (!form.assigned_to_name || !form.assigned_count) { toast.error('Select person and count'); return; } setSubmitting(true); try { await targetAPI.redistributePlanItem(item.id, { plan_item_id: item.id, assigned_to_name: form.assigned_to_name, assigned_count: form.assigned_count }); toast.success('Assigned'); onCreated(); } catch { toast.error('Failed'); } finally { setSubmitting(false); } };
  return (
    <Dialog open={open} onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>Assign: {item.activity_type}</DialogTitle></DialogHeader>
      <p className="text-sm text-gray-500">Target: {item.target_count} | Assigned: {item.redistributed_total || 0} | <span className="text-orange-600 font-semibold">Remaining: {remaining}</span></p>
      <div className="space-y-3">
        <div><Label className="text-xs">Salesperson</Label><Select value={form.assigned_to_name} onValueChange={v => setForm(f => ({ ...f, assigned_to_name: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{salespersons.map(sp => <SelectItem key={sp.name} value={sp.name}>{sp.name} ({sp.opp_count} opps)</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Count (max {remaining})</Label><Input type="number" value={form.assigned_count} onChange={e => setForm(f => ({ ...f, assigned_count: Math.min(parseInt(e.target.value) || 0, remaining) }))} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] text-white">{submitting ? 'Assigning...' : 'Assign'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
