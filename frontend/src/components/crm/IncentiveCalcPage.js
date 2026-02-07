import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  DollarSign, Calculator, Plus, Trash2, TrendingUp, BarChart2, Zap,
  Award, Settings, ChevronRight, ArrowUpRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { toast } from 'sonner';

function PlanCard({ plan, onDelete, onSelect }) {
  const slabs = plan.slabs || [];
  const variablePay = (plan.ote || 0) * ((plan.pay_mix_variable || 40) / 100);

  return (
    <Card className="bg-[#1a1a1a] border-[#333] hover:border-[#800000]/40 transition-all cursor-pointer" onClick={() => onSelect(plan)}
      data-testid={`plan-card-${plan.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-white">{plan.name}</h4>
            <p className="text-xs text-gray-400 mt-0.5">{plan.description || 'No description'}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-red-400"
            onClick={e => { e.stopPropagation(); onDelete(plan.id); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded bg-[#222]">
            <p className="text-[10px] text-gray-500 uppercase">Base</p>
            <p className="text-sm font-bold text-white">{(plan.base_salary || 0).toLocaleString()}</p>
          </div>
          <div className="text-center p-2 rounded bg-[#222]">
            <p className="text-[10px] text-gray-500 uppercase">OTE</p>
            <p className="text-sm font-bold text-white">{(plan.ote || 0).toLocaleString()}</p>
          </div>
          <div className="text-center p-2 rounded bg-[#222]">
            <p className="text-[10px] text-gray-500 uppercase">Variable</p>
            <p className="text-sm font-bold text-emerald-400">{variablePay.toLocaleString()}</p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Commission Tiers</p>
          {slabs.map((s, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-400">{s.label || `${s.min_percent}-${s.max_percent}%`}</span>
              <span className="text-white font-medium">{s.commission_rate}%</span>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mt-3">
          {(plan.spiffs || []).length > 0 && (
            <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400">
              <Zap className="h-2.5 w-2.5 mr-0.5" /> {plan.spiffs.length} SPIFFs
            </Badge>
          )}
          {(plan.product_multipliers || []).length > 0 && (
            <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
              <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> {plan.product_multipliers.length} Multipliers
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IncentiveCalculator({ plans, targets }) {
  const [selectedTarget, setSelectedTarget] = useState('');
  const [actualValue, setActualValue] = useState('');
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = async () => {
    if (!selectedTarget) {
      toast.error('Select a target');
      return;
    }
    setCalculating(true);
    try {
      const payload = { target_id: selectedTarget };
      if (actualValue) payload.actual_value = parseFloat(actualValue);
      const res = await targetAPI.calculateIncentive(payload);
      setResult(res.data);
    } catch {
      toast.error('Calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Card className="bg-[#1a1a1a] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Calculator className="h-5 w-5 text-[#800000]" /> Incentive Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-gray-300 text-xs">Sales Target</Label>
            <Select value={selectedTarget} onValueChange={setSelectedTarget}>
              <SelectTrigger className="bg-[#222] border-[#444] text-white" data-testid="calc-target-select">
                <SelectValue placeholder="Select target" />
              </SelectTrigger>
              <SelectContent className="bg-[#222] border-[#444]">
                {targets.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.assigned_to_name || 'Unassigned'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-300 text-xs">Override Actual Value (optional)</Label>
            <Input type="number" value={actualValue} onChange={e => setActualValue(e.target.value)}
              className="bg-[#222] border-[#444] text-white" placeholder="Leave empty to use current" />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCalculate} disabled={calculating} className="bg-[#800000] hover:bg-[#9a1919] w-full"
              data-testid="calculate-incentive-btn">
              <Calculator className="h-4 w-4 mr-1" /> {calculating ? 'Calculating...' : 'Calculate'}
            </Button>
          </div>
        </div>

        {result && (
          <div className="mt-4 space-y-4" data-testid="incentive-result">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#222] border border-[#333]">
                <p className="text-[10px] text-gray-500 uppercase">Target</p>
                <p className="text-lg font-bold text-white">{(result.target_value || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#222] border border-[#333]">
                <p className="text-[10px] text-gray-500 uppercase">Actual</p>
                <p className="text-lg font-bold text-white">{(result.actual_value || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#222] border border-[#333]">
                <p className="text-[10px] text-gray-500 uppercase">Attainment</p>
                <p className={`text-lg font-bold ${result.attainment_pct >= 100 ? 'text-emerald-400' : result.attainment_pct >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {result.attainment_pct}%
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-[10px] text-emerald-400 uppercase">Total Payout</p>
                <p className="text-lg font-bold text-emerald-400">{(result.total_payout || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Breakdown */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Payout Breakdown - {result.plan_name}</p>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#333]">
                    <TableHead className="text-gray-400">Component</TableHead>
                    <TableHead className="text-gray-400 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result.breakdown || []).map((item, idx) => (
                    <TableRow key={idx} className="border-[#333]">
                      <TableCell className="text-white text-sm">{item.label}</TableCell>
                      <TableCell className="text-emerald-400 text-right font-medium">{(item.amount || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-[#333] bg-[#222]">
                    <TableCell className="text-white font-bold">Total Payout</TableCell>
                    <TableCell className="text-emerald-400 text-right font-bold">{(result.total_payout || 0).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SimulationChart({ plans }) {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [targetValue, setTargetValue] = useState(100000);
  const [simData, setSimData] = useState(null);
  const [running, setRunning] = useState(false);

  const runSimulation = async () => {
    if (!selectedPlan) {
      toast.error('Select a plan');
      return;
    }
    setRunning(true);
    try {
      const res = await targetAPI.simulateIncentive(selectedPlan, targetValue, [30, 50, 70, 80, 90, 100, 110, 120, 150]);
      setSimData(res.data);
    } catch {
      toast.error('Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="bg-[#1a1a1a] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-[#800000]" /> Payout Simulation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-gray-300 text-xs">Incentive Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger className="bg-[#222] border-[#444] text-white" data-testid="sim-plan-select">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent className="bg-[#222] border-[#444]">
                {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-300 text-xs">Target Value</Label>
            <Input type="number" value={targetValue} onChange={e => setTargetValue(parseFloat(e.target.value) || 0)}
              className="bg-[#222] border-[#444] text-white" />
          </div>
          <div className="flex items-end">
            <Button onClick={runSimulation} disabled={running} className="bg-[#800000] hover:bg-[#9a1919] w-full"
              data-testid="run-simulation-btn">
              {running ? 'Running...' : 'Run Simulation'}
            </Button>
          </div>
        </div>

        {simData && (
          <div data-testid="simulation-result">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={simData.simulations}>
                <XAxis dataKey="attainment_pct" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v.toLocaleString()} />
                <Tooltip contentStyle={{ background: '#222', border: '1px solid #444', borderRadius: '8px', color: '#fff' }}
                  formatter={(v, name) => [v.toLocaleString(), name]} />
                <Line type="monotone" dataKey="commission" stroke="#800000" strokeWidth={2} dot={{ fill: '#800000', r: 4 }} name="Commission" />
                <Line type="monotone" dataKey="actual_value" stroke="#444" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>

            <Table>
              <TableHeader>
                <TableRow className="border-[#333]">
                  <TableHead className="text-gray-400">Attainment</TableHead>
                  <TableHead className="text-gray-400 text-right">Revenue</TableHead>
                  <TableHead className="text-gray-400 text-right">Commission</TableHead>
                  <TableHead className="text-gray-400 text-right">Eff. Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simData.simulations.map((s, idx) => (
                  <TableRow key={idx} className={`border-[#333] ${s.attainment_pct === 100 ? 'bg-[#800000]/10' : ''}`}>
                    <TableCell className="text-white font-medium">{s.attainment_pct}%</TableCell>
                    <TableCell className="text-gray-400 text-right">{s.actual_value.toLocaleString()}</TableCell>
                    <TableCell className="text-emerald-400 text-right font-medium">{s.commission.toLocaleString()}</TableCell>
                    <TableCell className="text-gray-400 text-right">{s.effective_rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreatePlanDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '', base_salary: 24000, ote: 40000,
    pay_mix_base: 60, pay_mix_variable: 40, period_type: 'quarterly',
    slabs: [
      { min_percent: 0, max_percent: 50, commission_rate: 0, label: 'Below Threshold' },
      { min_percent: 50, max_percent: 80, commission_rate: 5, label: 'Base Rate' },
      { min_percent: 80, max_percent: 100, commission_rate: 8, label: 'Standard' },
      { min_percent: 100, max_percent: 120, commission_rate: 12, label: 'Accelerated' },
      { min_percent: 120, max_percent: 200, commission_rate: 15, label: 'Super Accelerated' },
    ],
    spiffs: [],
    product_multipliers: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const updateSlab = (idx, field, value) => {
    const newSlabs = [...form.slabs];
    newSlabs[idx] = { ...newSlabs[idx], [field]: field === 'label' ? value : parseFloat(value) || 0 };
    setForm(p => ({ ...p, slabs: newSlabs }));
  };

  const addSlab = () => {
    const lastSlab = form.slabs[form.slabs.length - 1];
    setForm(p => ({
      ...p,
      slabs: [...p.slabs, { min_percent: lastSlab?.max_percent || 0, max_percent: (lastSlab?.max_percent || 0) + 20, commission_rate: 0, label: '' }]
    }));
  };

  const removeSlab = (idx) => {
    setForm(p => ({ ...p, slabs: p.slabs.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Plan name is required'); return; }
    setSubmitting(true);
    try {
      await targetAPI.createIncentivePlan(form);
      toast.success('Incentive plan created');
      onCreated();
      onClose();
    } catch {
      toast.error('Failed to create plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-[#333] text-white max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="create-plan-dialog">
        <DialogHeader>
          <DialogTitle className="text-white">Create Incentive Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-xs">Plan Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                className="bg-[#222] border-[#444] text-white" placeholder="Standard Sales Plan" />
            </div>
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
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-gray-300 text-xs">Base Salary</Label>
              <Input type="number" value={form.base_salary} onChange={e => setForm(p => ({...p, base_salary: parseFloat(e.target.value) || 0}))}
                className="bg-[#222] border-[#444] text-white" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs">OTE</Label>
              <Input type="number" value={form.ote} onChange={e => setForm(p => ({...p, ote: parseFloat(e.target.value) || 0}))}
                className="bg-[#222] border-[#444] text-white" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Pay Mix (Base/Variable)</Label>
              <div className="flex items-center gap-1">
                <Input type="number" value={form.pay_mix_base} onChange={e => {
                  const base = parseFloat(e.target.value) || 0;
                  setForm(p => ({...p, pay_mix_base: base, pay_mix_variable: 100 - base}));
                }} className="bg-[#222] border-[#444] text-white w-16 text-center" />
                <span className="text-gray-500">/</span>
                <Input type="number" value={form.pay_mix_variable} readOnly className="bg-[#333] border-[#444] text-gray-400 w-16 text-center" />
              </div>
            </div>
          </div>

          {/* Slabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-300 text-xs uppercase tracking-wider">Commission Tiers</Label>
              <Button size="sm" variant="outline" className="h-6 text-xs border-[#444] text-gray-300" onClick={addSlab}>
                <Plus className="h-3 w-3 mr-0.5" /> Add Tier
              </Button>
            </div>
            <div className="space-y-2">
              {form.slabs.map((slab, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded bg-[#222] border border-[#333]">
                  <Input value={slab.label} onChange={e => updateSlab(idx, 'label', e.target.value)}
                    className="bg-transparent border-0 text-white text-xs flex-1 h-7 p-1" placeholder="Label" />
                  <Input type="number" value={slab.min_percent} onChange={e => updateSlab(idx, 'min_percent', e.target.value)}
                    className="bg-[#333] border-[#444] text-white text-xs w-16 h-7 text-center" />
                  <span className="text-gray-500 text-xs">-</span>
                  <Input type="number" value={slab.max_percent} onChange={e => updateSlab(idx, 'max_percent', e.target.value)}
                    className="bg-[#333] border-[#444] text-white text-xs w-16 h-7 text-center" />
                  <span className="text-gray-500 text-xs">%</span>
                  <span className="text-gray-500 text-xs">@</span>
                  <Input type="number" value={slab.commission_rate} onChange={e => updateSlab(idx, 'commission_rate', e.target.value)}
                    className="bg-[#333] border-[#444] text-white text-xs w-16 h-7 text-center" />
                  <span className="text-gray-500 text-xs">%</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-500 hover:text-red-400" onClick={() => removeSlab(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-gray-300 text-xs">Description</Label>
            <Input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
              className="bg-[#222] border-[#444] text-white" placeholder="Optional description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#444] text-gray-300">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919]" data-testid="create-plan-submit">
            {submitting ? 'Creating...' : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function IncentiveCalcPage() {
  const [plans, setPlans] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [activeTab, setActiveTab] = useState('calculator');

  const loadData = useCallback(async () => {
    try {
      const [plansRes, targetsRes] = await Promise.all([
        targetAPI.listIncentivePlans(),
        targetAPI.listSalesTargets({ period_type: 'quarterly' }),
      ]);
      setPlans(plansRes.data);
      setTargets(targetsRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeletePlan = async (id) => {
    try {
      await targetAPI.deleteIncentivePlan(id);
      toast.success('Plan deleted');
      loadData();
    } catch {
      toast.error('Failed to delete plan');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6" data-testid="incentive-calc-loading">
        {[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-[#222]" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto" data-testid="incentive-calc-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-[#800000]" /> Incentive Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">Configure commission plans, calculate payouts, and simulate scenarios</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#800000] hover:bg-[#9a1919]" data-testid="create-plan-btn">
          <Plus className="h-4 w-4 mr-1" /> New Plan
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#222] border border-[#333]">
          <TabsTrigger value="calculator" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">Calculator</TabsTrigger>
          <TabsTrigger value="plans" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">Plans ({plans.length})</TabsTrigger>
          <TabsTrigger value="simulation" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">Simulation</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="mt-4">
          <IncentiveCalculator plans={plans} targets={targets} />
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {plans.map(p => (
              <PlanCard key={p.id} plan={p} onDelete={handleDeletePlan} onSelect={setSelectedPlan} />
            ))}
          </div>
          {plans.length === 0 && (
            <Card className="bg-[#1a1a1a] border-[#333]">
              <CardContent className="p-8 text-center">
                <Settings className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No incentive plans configured. Create your first plan.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="simulation" className="mt-4">
          <SimulationChart plans={plans} />
        </TabsContent>
      </Tabs>

      <CreatePlanDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={loadData} />
    </div>
  );
}
