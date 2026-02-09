import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
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
  Crosshair, Award, FileText, AlertTriangle, CheckCircle2, ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';

const actIcons = { Call: Phone, Email: Mail, Meeting: Calendar, Demo: Monitor, 'Proof of concept': FlaskConical, 'Work Shop': Presentation, 'Site Visit': Target, 'Follow-up': ArrowRight };
const actColors = { Call: '#3b82f6', Email: '#8b5cf6', Meeting: '#10b981', Demo: '#f59e0b', 'Proof of concept': '#ef4444', 'Work Shop': '#06b6d4', 'Site Visit': '#ec4899', 'Follow-up': '#6366f1' };

// ================= MAIN PAGE =================
export default function PerformanceHubPage() {
  const [tab, setTab] = useState('ceo');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [pmActuals, setPmActuals] = useState([]);
  const [spActuals, setSpActuals] = useState([]);
  const [collection, setCollection] = useState({});
  const [activityActuals, setActivityActuals] = useState([]);
  const [productManagers, setProductManagers] = useState([]);
  const [solutionCats, setSolutionCats] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [alertsData, setAlertsData] = useState({ alerts: [], summary: {} });
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planItems, setPlanItems] = useState([]);
  const [redistributions, setRedistributions] = useState([]);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRedistribute, setShowRedistribute] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const [plansR, pmR, collR, pmsR, catsR, spR, atR] = await Promise.allSettled([
        targetAPI.listRevenuePlans(), targetAPI.getActualsByPM(),
        targetAPI.getCollectionActuals(), targetAPI.getProductManagers(),
        targetAPI.getSolutionCategories(), targetAPI.getSalespersons(),
        targetAPI.getActivityTypes(),
      ]);
      if (plansR.status === 'fulfilled') setPlans(plansR.value.data);
      if (pmR.status === 'fulfilled') setPmActuals(pmR.value.data);
      if (collR.status === 'fulfilled') setCollection(collR.value.data);
      if (pmsR.status === 'fulfilled') setProductManagers(pmsR.value.data);
      if (catsR.status === 'fulfilled') setSolutionCats(catsR.value.data);
      if (spR.status === 'fulfilled') setSalespersons(spR.value.data);
      if (atR.status === 'fulfilled') setActivityTypes(atR.value.data);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCore(); }, [loadCore]);

  const loadPlanDetails = useCallback(async (planId) => {
    if (!planId) return;
    try {
      const [itemsR, redistR, actR] = await Promise.allSettled([
        targetAPI.listPlanItems(planId),
        targetAPI.listRedistributions(planId),
        targetAPI.getActualActivities(),
      ]);
      if (itemsR.status === 'fulfilled') setPlanItems(itemsR.value.data);
      if (redistR.status === 'fulfilled') setRedistributions(redistR.value.data);
      if (actR.status === 'fulfilled') setActivityActuals(actR.value.data);
    } catch {}
  }, []);

  useEffect(() => { if (selectedPlan) loadPlanDetails(selectedPlan.id); }, [selectedPlan, loadPlanDetails]);

  const handleDeletePlan = async (id) => {
    try { await targetAPI.deleteRevenuePlan(id); toast.success('Plan deleted'); if (selectedPlan?.id === id) setSelectedPlan(null); loadCore(); } catch { toast.error('Failed'); }
  };

  const handleDeleteItem = async (id) => {
    try { await targetAPI.deletePlanItem(id); toast.success('Deleted'); loadPlanDetails(selectedPlan.id); } catch { toast.error('Failed'); }
  };

  const handleDeleteRedist = async (id) => {
    try { await targetAPI.deleteRedistribution(id); toast.success('Deleted'); loadPlanDetails(selectedPlan.id); } catch { toast.error('Failed'); }
  };

  // Summary metrics
  const totalTarget = plans.reduce((s, p) => s + (p.target_amount || 0), 0);
  const totalPipeline = pmActuals.reduce((s, p) => s + (p.total_pipeline || 0), 0);
  const totalWon = pmActuals.reduce((s, p) => s + (p.won_amount || 0), 0);
  const totalItems = plans.reduce((s, p) => s + (p.activity_items_count || 0), 0);

  if (loading) return <div className="space-y-4" data-testid="performance-hub-loading"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-5 gap-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-96" /></div>;

  return (
    <div className="space-y-5" data-testid="performance-hub-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Crosshair className="h-6 w-6 text-[#800000]" /> Performance Hub</h1>
          <p className="text-gray-500 text-sm">CEO targets, PM plans, Sales Director redistribution, collection tracking</p>
        </div>
        <Button onClick={() => setShowCreatePlan(true)} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="create-plan-btn"><Plus className="h-4 w-4 mr-1" /> Assign Revenue Target</Button>
      </div>

      {/* Metric Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: 'Revenue Targets', v: `OMR ${totalTarget.toLocaleString()}`, icon: Target, c: 'text-blue-600', bg: 'bg-blue-50' },
          { l: 'Total Pipeline', v: `OMR ${totalPipeline.toLocaleString()}`, icon: TrendingUp, c: 'text-emerald-600', bg: 'bg-emerald-50' },
          { l: 'Won Revenue', v: `OMR ${totalWon.toLocaleString()}`, icon: Trophy, c: 'text-yellow-600', bg: 'bg-yellow-50' },
          { l: 'Plan Items', v: totalItems, icon: Activity, c: 'text-purple-600', bg: 'bg-purple-50' },
          { l: 'Overdue Invoices', v: `${collection.overdue_count || 0} (OMR ${(collection.overdue_amount || 0).toLocaleString()})`, icon: AlertTriangle, c: 'text-red-600', bg: 'bg-red-50' },
        ].map((m, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1"><span className="text-xs text-gray-500">{m.l}</span><div className={`p-1.5 rounded-full ${m.bg}`}><m.icon className={`h-3.5 w-3.5 ${m.c}`} /></div></div>
              <p className="text-lg font-bold text-gray-900">{m.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="ceo">CEO View</TabsTrigger><TabsTrigger value="pm">PM Plan Builder</TabsTrigger><TabsTrigger value="sd">Sales Director</TabsTrigger><TabsTrigger value="compare">Team Compare</TabsTrigger><TabsTrigger value="marketing">Marketing</TabsTrigger><TabsTrigger value="collection">Collection</TabsTrigger><TabsTrigger value="incentive">Incentive</TabsTrigger></TabsList>

        {/* =========== CEO VIEW =========== */}
        <TabsContent value="ceo" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Plans */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-[#800000]" /> Revenue Plans Assigned to PMs</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Product Manager</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Pipeline</TableHead><TableHead className="text-right">Won</TableHead><TableHead>Items</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {plans.map(p => (
                      <TableRow key={p.id} className={`cursor-pointer hover:bg-gray-50 ${selectedPlan?.id === p.id ? 'bg-blue-50' : ''}`} onClick={() => { setSelectedPlan(p); setTab('pm'); }} data-testid={`plan-row-${p.id}`}>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell className="text-sm text-gray-600">{p.product_manager_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">OMR {(p.target_amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm text-gray-500 font-mono">{(p.total_pipeline || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm text-emerald-600 font-mono">{(p.actual_revenue || 0).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{p.activity_items_count || 0} items</Badge></TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={e => { e.stopPropagation(); handleDeletePlan(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
                    {plans.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No revenue plans yet. Click "Assign Revenue Target" to create one.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* PM Actuals */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="h-4 w-4 text-[#800000]" /> PM Performance (from Odoo)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {pmActuals.map(pm => (
                  <div key={pm.product_manager} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between items-center"><span className="text-sm font-medium">{pm.product_manager}</span><span className="text-xs text-gray-400">{pm.opp_count} opps</span></div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Pipeline: <span className="font-mono text-gray-700">{pm.total_pipeline.toLocaleString()}</span></span>
                      <span>Won: <span className="font-mono text-emerald-600">{pm.won_amount.toLocaleString()}</span></span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{pm.categories?.slice(0, 3).join(', ')}</div>
                  </div>
                ))}
                {pmActuals.length === 0 && <p className="text-gray-400 text-xs text-center py-4">No PM data</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =========== PM PLAN BUILDER =========== */}
        <TabsContent value="pm" className="mt-4 space-y-4">
          {!selectedPlan ? (
            <Card><CardContent className="p-8 text-center text-gray-400"><Target className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>Select a revenue plan from the CEO View tab to build its activity plan.</p></CardContent></Card>
          ) : (
            <>
              <Card className="border-[#800000]/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{selectedPlan.name}</h3>
                      <p className="text-sm text-gray-500">PM: {selectedPlan.product_manager_name} | Target: <span className="font-semibold text-gray-900">OMR {(selectedPlan.target_amount || 0).toLocaleString()}</span></p>
                    </div>
                    <Button onClick={() => setShowAddItem(true)} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="add-plan-item-btn"><Plus className="h-4 w-4 mr-1" /> Add Activity Plan</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Activity Plan Items <Badge variant="secondary" className="ml-2">{planItems.length}</Badge></CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Activity Type</TableHead><TableHead>Solution Category</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Actual (Odoo)</TableHead><TableHead>Assigned</TableHead><TableHead>Match</TableHead><TableHead className="w-20">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {planItems.map(item => {
                        const Icon = actIcons[item.activity_type] || Activity;
                        const color = actColors[item.activity_type] || '#6b7280';
                        const assignedTotal = item.redistributed_total || 0;
                        const targetCount = item.target_count || 0;
                        const matched = assignedTotal >= targetCount && targetCount > 0;
                        return (
                          <TableRow key={item.id} data-testid={`plan-item-${item.id}`}>
                            <TableCell><div className="flex items-center gap-2"><Icon className="h-4 w-4" style={{ color }} /><span className="text-sm font-medium">{item.activity_type}</span></div></TableCell>
                            <TableCell className="text-sm text-gray-500">{item.solution_category || '-'}</TableCell>
                            <TableCell className="text-right font-semibold text-sm">{targetCount}</TableCell>
                            <TableCell className="text-right text-sm"><span className={item.actual_count >= targetCount && targetCount > 0 ? 'text-emerald-600 font-semibold' : 'text-gray-600'}>{item.actual_count || 0}</span></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className={`text-sm font-mono ${matched ? 'text-emerald-600' : 'text-orange-600'}`}>{assignedTotal}/{targetCount}</span>
                                <span className="text-xs text-gray-400">to {item.redistributed_to_count || 0} people</span>
                              </div>
                            </TableCell>
                            <TableCell>{matched ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-orange-400" />}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRedistribute(item)} data-testid={`redistribute-${item.id}`}>Assign</Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {planItems.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No activity items. Click "Add Activity Plan" to create one.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Redistributions detail */}
              {redistributions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Redistribution Details (Sales Director Assignments)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Solution</TableHead><TableHead>Assigned To</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {redistributions.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm">{r.activity_type}</TableCell>
                            <TableCell className="text-sm text-gray-500">{r.solution_category || '-'}</TableCell>
                            <TableCell className="text-sm font-medium">{r.assigned_to_name}</TableCell>
                            <TableCell className="text-right font-semibold">{r.assigned_count}</TableCell>
                            <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => handleDeleteRedist(r.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* =========== SALES DIRECTOR BUCKET =========== */}
        <TabsContent value="sd" className="mt-4 space-y-4">
          {plans.map(plan => {
            const items = planItems.filter(i => i.revenue_plan_id === plan.id || (selectedPlan?.id === plan.id));
            return (
              <Card key={plan.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#800000]" /> {plan.product_manager_name}
                    <Badge variant="secondary" className="text-xs ml-2">OMR {(plan.target_amount || 0).toLocaleString()}</Badge>
                    <Badge variant="outline" className="text-xs">{plan.activity_items_count || 0} items</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 mb-2">{plan.name}</p>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedPlan(plan); setTab('pm'); }}>View & Redistribute Plan Items</Button>
                </CardContent>
              </Card>
            );
          })}
          {plans.length === 0 && <Card><CardContent className="p-8 text-center text-gray-400">No plans to show. CEO needs to assign revenue targets first.</CardContent></Card>}

          {/* Salesperson actuals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-yellow-500" /> Salesperson Performance (from Odoo)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Salesperson</TableHead><TableHead className="text-right">Pipeline</TableHead><TableHead className="text-right">Won</TableHead><TableHead className="text-right">Deals</TableHead></TableRow></TableHeader>
                <TableBody>
                  {salespersons.slice(0, 15).map((sp, idx) => (
                    <TableRow key={sp.name} className={idx < 3 ? 'bg-gray-50/50' : ''}>
                      <TableCell>{idx === 0 ? <Trophy className="h-4 w-4 text-yellow-500" /> : <span className="text-gray-400 text-sm">{idx + 1}</span>}</TableCell>
                      <TableCell className="font-medium text-sm">{sp.name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{sp.total_pipeline.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-600">-</TableCell>
                      <TableCell className="text-right text-sm">{sp.opp_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========== TEAM COMPARISON =========== */}
        <TabsContent value="compare" className="mt-4">
          <TeamComparisonView plans={plans} />
        </TabsContent>

        {/* =========== MARKETING =========== */}
        <TabsContent value="marketing" className="mt-4">
          <MarketingMetricsView />
        </TabsContent>

        {/* =========== COLLECTION =========== */}
        <TabsContent value="collection" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(collection.by_state || {}).map(([state, data]) => (
              <Card key={state}>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">{state.replace('_', ' ')}</p>
                  <p className="text-xl font-bold text-gray-900">{data.count} invoices</p>
                  <p className="text-sm text-gray-500 font-mono">OMR {data.amount.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-red-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-50"><AlertTriangle className="h-6 w-6 text-red-500" /></div>
              <div>
                <h3 className="font-semibold text-gray-900">Overdue Invoices</h3>
                <p className="text-sm text-gray-500">{collection.overdue_count || 0} invoices are past due date</p>
                <p className="text-lg font-bold text-red-600 font-mono">OMR {(collection.overdue_amount || 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========== INCENTIVE SCORE =========== */}
        <TabsContent value="incentive" className="mt-4 space-y-4">
          <MultiVectorIncentiveCalc plans={plans} />
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <CreatePlanDialog open={showCreatePlan} onClose={() => setShowCreatePlan(false)} onCreated={() => { loadCore(); setShowCreatePlan(false); }} productManagers={productManagers} />
      {selectedPlan && <AddItemDialog open={showAddItem} onClose={() => setShowAddItem(false)} onCreated={() => { loadPlanDetails(selectedPlan.id); loadCore(); setShowAddItem(false); }} planId={selectedPlan.id} solutionCats={solutionCats} activityTypes={activityTypes} />}
      {showRedistribute && <RedistributeDialog open={!!showRedistribute} onClose={() => setShowRedistribute(null)} onCreated={() => { loadPlanDetails(selectedPlan.id); setShowRedistribute(null); }} item={showRedistribute} salespersons={salespersons} />}
    </div>
  );
}

// ================= DIALOGS =================
function CreatePlanDialog({ open, onClose, onCreated, productManagers }) {
  const [form, setForm] = useState({ name: '', product_manager_name: '', product_manager_id: '', target_amount: 0, period: '2026-Q1' });
  const [submitting, setSubmitting] = useState(false);

  const handlePMChange = (pmName) => {
    const pm = productManagers.find(p => p.name === pmName);
    setForm(f => ({ ...f, product_manager_name: pmName, product_manager_id: pm?.id || '', name: `Q1 2026 - ${pmName}` }));
  };

  const handleSubmit = async () => {
    if (!form.product_manager_name || !form.target_amount) { toast.error('Select PM and set target'); return; }
    setSubmitting(true);
    try { await targetAPI.createRevenuePlan(form); toast.success('Revenue plan created'); onCreated(); } catch { toast.error('Failed'); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="create-plan-dialog">
        <DialogHeader><DialogTitle>Assign Revenue Target to Product Manager</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Product Manager</Label>
            <Select value={form.product_manager_name} onValueChange={handlePMChange}>
              <SelectTrigger data-testid="pm-select"><SelectValue placeholder="Select Product Manager" /></SelectTrigger>
              <SelectContent>{productManagers.map(pm => <SelectItem key={pm.name} value={pm.name}>{pm.name} ({pm.opp_count} opps)</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-xs">Revenue Target (OMR)</Label>
            <Input type="number" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: parseFloat(e.target.value) || 0 }))} placeholder="3000000" /></div>
          <div><Label className="text-xs">Plan Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label className="text-xs">Period</Label>
            <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="2026-Q1">2026 Q1</SelectItem><SelectItem value="2026-Q2">2026 Q2</SelectItem><SelectItem value="2026-Q3">2026 Q3</SelectItem><SelectItem value="2026-Q4">2026 Q4</SelectItem></SelectContent>
            </Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="submit-plan">{submitting ? 'Creating...' : 'Assign Target'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({ open, onClose, onCreated, planId, solutionCats, activityTypes }) {
  const [form, setForm] = useState({ activity_type: '', solution_category: '', target_count: 10, notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.activity_type || !form.target_count) { toast.error('Select activity type and count'); return; }
    setSubmitting(true);
    try { await targetAPI.createPlanItem(planId, form); toast.success('Plan item added'); onCreated(); } catch { toast.error('Failed'); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="add-item-dialog">
        <DialogHeader><DialogTitle>Add Activity Plan Item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Activity Type (from Odoo)</Label>
            <Select value={form.activity_type} onValueChange={v => setForm(f => ({ ...f, activity_type: v }))}>
              <SelectTrigger data-testid="activity-type-select"><SelectValue placeholder="Select activity type" /></SelectTrigger>
              <SelectContent>{activityTypes.map(at => <SelectItem key={at.type} value={at.type}>{at.type} ({at.count} existing)</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-xs">Solution Category</Label>
            <Select value={form.solution_category || '_none'} onValueChange={v => setForm(f => ({ ...f, solution_category: v === '_none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Any category" /></SelectTrigger>
              <SelectContent><SelectItem value="_none">Any</SelectItem>{solutionCats.map(c => <SelectItem key={c.name} value={c.name}>{c.name} ({c.opp_count} opps)</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-xs">Target Count</Label>
            <Input type="number" value={form.target_count} onChange={e => setForm(f => ({ ...f, target_count: parseInt(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. NDR demos for enterprise accounts" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="submit-item">{submitting ? 'Adding...' : 'Add to Plan'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedistributeDialog({ open, onClose, onCreated, item, salespersons }) {
  const [form, setForm] = useState({ assigned_to_name: '', assigned_count: 0 });
  const [submitting, setSubmitting] = useState(false);

  const remaining = (item.target_count || 0) - (item.redistributed_total || 0);

  const handleSubmit = async () => {
    if (!form.assigned_to_name || !form.assigned_count) { toast.error('Select person and count'); return; }
    setSubmitting(true);
    try {
      await targetAPI.redistributePlanItem(item.id, { plan_item_id: item.id, assigned_to_name: form.assigned_to_name, assigned_count: form.assigned_count });
      toast.success(`Assigned ${form.assigned_count} ${item.activity_type} to ${form.assigned_to_name}`);
      onCreated();
    } catch { toast.error('Failed'); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="redistribute-dialog">
        <DialogHeader><DialogTitle>Redistribute: {item.activity_type} ({item.solution_category || 'General'})</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-500">Target: {item.target_count} | Already assigned: {item.redistributed_total || 0} | <span className="font-semibold text-orange-600">Remaining: {remaining}</span></p>
        <div className="space-y-3">
          <div><Label className="text-xs">Account Manager / Salesperson</Label>
            <Select value={form.assigned_to_name} onValueChange={v => setForm(f => ({ ...f, assigned_to_name: v }))}>
              <SelectTrigger data-testid="salesperson-select"><SelectValue placeholder="Select salesperson" /></SelectTrigger>
              <SelectContent>{salespersons.map(sp => <SelectItem key={sp.name} value={sp.name}>{sp.name} ({sp.opp_count} opps)</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-xs">Assign Count (max {remaining})</Label>
            <Input type="number" value={form.assigned_count} onChange={e => setForm(f => ({ ...f, assigned_count: Math.min(parseInt(e.target.value) || 0, remaining) }))} max={remaining} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="submit-redistribute">{submitting ? 'Assigning...' : 'Assign'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MultiVectorIncentiveCalc({ plans }) {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [weights, setWeights] = useState({ revenue_weight: 50, activity_weight: 30, collection_weight: 20 });
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalc = async () => {
    if (!selectedPlan) { toast.error('Select a plan'); return; }
    setCalculating(true);
    try {
      const res = await targetAPI.calculateMultiVectorIncentive({ plan_id: selectedPlan, ...weights });
      setResult(res.data);
    } catch { toast.error('Calculation failed'); }
    finally { setCalculating(false); }
  };

  const tierColors = { 'Super Achiever': 'text-purple-600 bg-purple-50', 'Achiever': 'text-emerald-600 bg-emerald-50', 'On Track': 'text-blue-600 bg-blue-50', 'Developing': 'text-yellow-600 bg-yellow-50', 'Below Threshold': 'text-red-600 bg-red-50' };

  return (
    <div className="space-y-4" data-testid="multi-vector-incentive">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4 text-[#800000]" /> Multi-Vector Incentive Calculator</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">Calculate incentive score based on three weighted vectors: Revenue Achievement, Activity Completion, and Invoice Collection Rate.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">Revenue Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger data-testid="mv-plan-select"><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.product_manager_name})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Revenue Weight (%)</Label>
              <Input type="number" value={weights.revenue_weight} onChange={e => setWeights(w => ({ ...w, revenue_weight: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label className="text-xs">Activity Weight (%)</Label>
              <Input type="number" value={weights.activity_weight} onChange={e => setWeights(w => ({ ...w, activity_weight: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label className="text-xs">Collection Weight (%)</Label>
              <Input type="number" value={weights.collection_weight} onChange={e => setWeights(w => ({ ...w, collection_weight: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <Button onClick={handleCalc} disabled={calculating} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="mv-calc-btn">
            <Calculator className="h-4 w-4 mr-1" /> {calculating ? 'Calculating...' : 'Calculate Score'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4" data-testid="mv-result">
          {/* Score & Tier */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1 border-2 border-[#800000]/20">
              <CardContent className="p-6 text-center">
                <p className="text-xs text-gray-500 uppercase mb-1">Composite Score</p>
                <p className="text-5xl font-bold text-gray-900">{result.composite_score}</p>
                <Badge className={`mt-2 text-sm px-3 py-1 ${tierColors[result.tier] || ''}`}>{result.tier}</Badge>
                <p className="text-xs text-gray-400 mt-2">Multiplier: {result.multiplier}x</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">Payout: OMR {result.calculated_payout.toLocaleString()}</p>
              </CardContent>
            </Card>

            {/* Vector Cards */}
            <Card className="md:col-span-2">
              <CardContent className="p-4 space-y-3">
                {result.breakdown.map((b, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-40">{b.label}</span>
                    <div className="flex-1">
                      <Progress value={Math.min(b.score, 100)} className="h-3" />
                    </div>
                    <span className="text-sm font-mono text-gray-500 w-14 text-right">{b.score}%</span>
                    <span className="text-sm font-semibold text-[#800000] w-14 text-right">{b.weighted}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Vectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Revenue */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-blue-500" /> Revenue Vector</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Target</span><span className="font-mono">OMR {(result.vectors.revenue.target || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Actual Won</span><span className="font-mono text-emerald-600">OMR {(result.vectors.revenue.actual || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Won Deals</span><span>{result.vectors.revenue.won_deals}</span></div>
                <div className="flex justify-between font-semibold"><span>Achievement</span><span>{result.vectors.revenue.achievement_pct}%</span></div>
              </CardContent>
            </Card>

            {/* Activity */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-purple-500" /> Activity Vector</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {(result.vectors.activity.details || []).map((d, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-500">{d.type} ({d.category || 'General'})</span>
                    <span className={d.achievement_pct >= 100 ? 'text-emerald-600 font-semibold' : ''}>{d.actual}/{d.target} ({d.achievement_pct}%)</span>
                  </div>
                ))}
                <div className="pt-1 border-t flex justify-between font-semibold"><span>Total Achievement</span><span>{result.vectors.activity.achievement_pct}%</span></div>
              </CardContent>
            </Card>

            {/* Collection */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" /> Collection Vector</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total Invoices</span><span>{result.vectors.collection.total_invoices}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="text-emerald-600">{result.vectors.collection.paid_invoices}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Overdue</span><span className="text-red-600">{result.vectors.collection.overdue_count}</span></div>
                <div className="flex justify-between font-semibold"><span>On-Time Rate</span><span>{result.vectors.collection.on_time_pct}%</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}


function TeamComparisonView({ plans }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    targetAPI.getTeamComparison().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64" />;

  const chartData = data.map(d => ({
    name: d.product_manager?.split(' ').slice(-1)[0] || 'Unknown',
    Revenue: d.revenue.pct,
    Activity: d.activity.pct,
    Leads: Math.min((d.leads_generated / 10) * 100, 100),
    composite: d.composite,
  }));

  return (
    <div className="space-y-4" data-testid="team-comparison">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-[#800000]" /> PM Performance Comparison</CardTitle></CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <RTooltip />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Revenue %" />
                <Bar dataKey="Activity" fill="#10b981" radius={[3, 3, 0, 0]} name="Activity %" />
                <Bar dataKey="Leads" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Leads Score" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-8">No comparison data. Assign revenue targets to PMs first.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Product Manager</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Pipeline</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Rev %</TableHead>
                <TableHead className="text-right">Activities</TableHead>
                <TableHead className="text-right">Act %</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d, idx) => (
                <TableRow key={d.plan_id} className={idx === 0 ? 'bg-yellow-50/50' : ''}>
                  <TableCell>{idx === 0 ? <Trophy className="h-4 w-4 text-yellow-500" /> : <span className="text-gray-400">{idx + 1}</span>}</TableCell>
                  <TableCell className="font-medium">{d.product_manager}</TableCell>
                  <TableCell className="text-right font-mono text-sm">OMR {(d.target_amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-gray-500">{(d.revenue.pipeline || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600">{(d.revenue.won || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right"><Badge variant={d.revenue.pct >= 80 ? 'default' : 'secondary'} className={d.revenue.pct >= 100 ? 'bg-emerald-100 text-emerald-700' : ''}>{d.revenue.pct}%</Badge></TableCell>
                  <TableCell className="text-right text-sm">{d.activity.actual}/{d.activity.target}</TableCell>
                  <TableCell className="text-right"><Badge variant={d.activity.pct >= 80 ? 'default' : 'secondary'} className={d.activity.pct >= 100 ? 'bg-emerald-100 text-emerald-700' : ''}>{d.activity.pct}%</Badge></TableCell>
                  <TableCell className="text-right text-sm">{d.leads_generated}</TableCell>
                  <TableCell className="text-right font-bold text-[#800000]">{d.composite}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-400">No data</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MarketingMetricsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    targetAPI.getMarketingMetrics().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64" />;
  if (!data) return <p className="text-gray-400 text-center py-8">No marketing data</p>;

  const funnelData = (data.lead_funnel || []).slice(0, 8).map(f => ({
    name: f.stage || 'Unknown',
    count: f.count,
  }));

  return (
    <div className="space-y-4" data-testid="marketing-metrics">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total Leads</p><p className="text-2xl font-bold text-gray-900">{data.total_leads}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Opportunities</p><p className="text-2xl font-bold text-gray-900">{data.total_opportunities}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Conversion Rate</p><p className="text-2xl font-bold text-emerald-600">{data.conversion_rate}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Converted</p><p className="text-2xl font-bold text-gray-900">{data.converted_count}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lead Funnel */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Lead Funnel by Stage</CardTitle></CardHeader>
          <CardContent>
            {funnelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funnelData} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                  <RTooltip />
                  <Bar dataKey="count" fill="#800000" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-xs text-center py-4">No funnel data</p>}
          </CardContent>
        </Card>

        {/* Leads by PM */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Leads by Product Manager</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Product Manager</TableHead><TableHead className="text-right">Leads</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data.leads_by_pm || []).map(pm => (
                  <TableRow key={pm.pm}><TableCell className="text-sm font-medium">{pm.pm}</TableCell><TableCell className="text-right font-semibold">{pm.count}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Leads by Category */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Leads by Solution Category</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Lead Count</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data.leads_by_category || []).map(cat => (
                <TableRow key={cat.category}><TableCell className="text-sm">{cat.category}</TableCell><TableCell className="text-right font-semibold">{cat.count}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

