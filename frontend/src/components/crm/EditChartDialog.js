import React, { useState, useEffect } from 'react';
import { targetAPI } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import DomainBuilderDialog, { DATE_FILTER_FIELDS } from './DomainBuilderDialog';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, AreaChart, Area } from 'recharts';
import {
  BarChart3, PieChart, LineChart, Activity, Target, TrendingUp,
  DollarSign, Trophy, AlertTriangle, Building2, Users, List,
  Save, Play, Eye, Palette, Database, Crosshair, FileText,
  LayoutGrid, Gauge, Waves, Circle, Hexagon
} from 'lucide-react';
import { toast } from 'sonner';

const ICONS_MAP = { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, Building2, Users, BarChart3, Activity };

// Odoo-style chart type selector
const CHART_TYPES = [
  { id: 'number', label: 'KPI', icon: Gauge, description: 'Single number card' },
  { id: 'chart', label: 'Bar', icon: BarChart3, description: 'Bar chart' },
  { id: 'area', label: 'Area', icon: Waves, description: 'Area chart' },
  { id: 'pie', label: 'Pie', icon: PieChart, description: 'Pie / Donut' },
  { id: 'radial', label: 'Radial', icon: Circle, description: 'Radial bar' },
  { id: 'leaderboard', label: 'List', icon: List, description: 'Ranked list' },
  { id: 'progress', label: 'Progress', icon: Activity, description: 'Progress bars' },
  { id: 'win_rate', label: 'Rate', icon: TrendingUp, description: 'Percentage KPI' },
  { id: 'table', label: 'Table', icon: FileText, description: 'Data table' },
];

// Theme colors matching Odoo's palette
const THEME_COLORS = [
  { id: 'navy', bg: '#1e3a5f', label: 'Navy' },
  { id: 'crimson', bg: '#8b1a1a', label: 'Crimson' },
  { id: 'forest', bg: '#1a6b4a', label: 'Forest' },
  { id: 'orange', bg: '#b45309', label: 'Orange' },
  { id: 'purple', bg: '#5b21b6', label: 'Purple' },
  { id: 'olive', bg: '#4d5e2f', label: 'Olive' },
  { id: 'teal', bg: '#0e7490', label: 'Teal' },
  { id: 'indigo', bg: '#3730a3', label: 'Indigo' },
  { id: 'maroon', bg: '#800000', label: 'Maroon' },
  { id: 'slate', bg: '#334155', label: 'Slate' },
];

const FILTER_PRESETS = [
  { label: 'Won Opportunities', filters: '{"type": "opportunity", "stage": "Won"}' },
  { label: 'Open Pipeline', filters: '{"type": "opportunity", "stage": {"$nin": ["Won", "Lost"]}}' },
  { label: 'Lost Deals', filters: '{"type": "opportunity", "stage": "Lost"}' },
  { label: 'All Opportunities', filters: '{"type": "opportunity"}' },
  { label: 'Overdue Invoices', filters: '{"payment_state": {"$in": ["not_paid", "partial"]}}' },
];

const PREVIEW_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899'];

// Mini bar/area chart for preview pane
function MiniBarPreview({ groups, aggregation, isArea }) {
  const dk = aggregation === 'count' ? 'count' : 'total';
  const data = groups.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height="100%">
      {isArea ? (
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
          <defs><linearGradient id="prevFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#800000" stopOpacity={0.6}/><stop offset="95%" stopColor="#800000" stopOpacity={0.05}/></linearGradient></defs>
          <Area dataKey={dk} type="monotone" fill="url(#prevFill)" stroke="#800000" strokeWidth={2} />
        </AreaChart>
      ) : (
        <BarChart data={data} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
          <Bar dataKey={dk} radius={[3, 3, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={PREVIEW_COLORS[i % PREVIEW_COLORS.length]} />)}
          </Bar>
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

// Mini pie chart for preview
function MiniPiePreview({ groups, aggregation }) {
  const dk = aggregation === 'count' ? 'count' : 'total';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsPie>
        <Pie data={groups.slice(0, 6)} dataKey={dk} nameKey="label" cx="50%" cy="50%" innerRadius="25%" outerRadius="60%" paddingAngle={2}>
          {groups.slice(0, 6).map((_, i) => <Cell key={i} fill={PREVIEW_COLORS[i % PREVIEW_COLORS.length]} />)}
        </Pie>
      </RechartsPie>
    </ResponsiveContainer>
  );
}


export default function EditChartDialog({ open, onClose, card, onSave }) {
  const [form, setForm] = useState({
    name: '', collection: 'opportunities', aggregation: 'count', field: '',
    filters: '{}', group_by: '', display_type: 'number', color: '#1e3a5f',
    icon: 'Target', size: 'small', year_filter: true, cache_ttl: 60, description: ''
  });
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [tab, setTab] = useState('data');
  const [showDomain, setShowDomain] = useState(false);

  useEffect(() => {
    if (card && open) {
      setForm({
        name: card.name || '', collection: card.collection || 'opportunities',
        aggregation: card.aggregation || 'count', field: card.field || '',
        filters: typeof card.filters === 'string' ? card.filters : JSON.stringify(card.filters || {}, null, 2),
        group_by: card.group_by || '', display_type: card.display_type || 'number',
        color: card.color || '#1e3a5f', icon: card.icon || 'Target',
        size: card.size || 'small', year_filter: card.year_filter !== false,
        cache_ttl: card.cache_ttl || 60, description: card.description || ''
      });
      setPreview(null);
      setTab('data');
    }
  }, [card, open]);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      let filters = {};
      try { filters = JSON.parse(form.filters); } catch {}
      const res = await targetAPI.executeQuery({
        collection: form.collection, aggregation: form.aggregation,
        field: form.field || undefined, filters,
        group_by: form.group_by || undefined,
        year: form.year_filter ? new Date().getFullYear().toString() : undefined,
        cache_ttl: 5
      });
      setPreview(res.data);
      toast.success('Query executed');
    } catch { toast.error('Query failed'); }
    finally { setPreviewing(false); }
  };

  const handleSave = () => {
    if (!form.name) { toast.error('Name required'); return; }
    let filters = {};
    try { filters = JSON.parse(form.filters); } catch { toast.error('Invalid filter JSON'); return; }
    onSave({ ...form, filters, field: form.field || undefined, group_by: form.group_by || undefined });
  };

  const u = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Compute preview value
  const previewValue = () => {
    if (!preview) return '—';
    if (form.display_type === 'win_rate') {
      const groups = preview.groups || [];
      const won = groups.find(g => g.label === 'Won')?.count || 0;
      const lost = groups.find(g => g.label === 'Lost')?.count || 0;
      return ((won / Math.max(won + lost, 1)) * 100).toFixed(0) + '%';
    }
    const val = preview.value || 0;
    if (form.aggregation === 'sum' || form.aggregation === 'avg') {
      if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
      if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K';
      return val.toLocaleString();
    }
    return val.toLocaleString();
  };

  const PreviewIcon = ICONS_MAP[form.icon] || Target;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0" data-testid="edit-chart-dialog">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-lg font-bold">
            {card?.id ? 'Edit Chart' : 'Create New Chart'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex">
          {/* Left: Configuration */}
          <div className="flex-1 overflow-y-auto border-r">
            {/* Chart Type Selector */}
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <Label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Chart Type</Label>
              <div className="grid grid-cols-7 gap-1.5" data-testid="chart-type-grid">
                {CHART_TYPES.map(ct => {
                  const Icon = ct.icon;
                  const selected = form.display_type === ct.id;
                  return (
                    <button key={ct.id} onClick={() => u('display_type', ct.id)}
                      data-selected={selected}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center
                        ${selected ? 'border-[#800000] bg-[#800000]/5 text-[#800000]' : 'border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700'}`}
                      data-testid={`chart-type-${ct.id}`}>
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-[10px] font-medium leading-tight">{ct.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configuration Tabs */}
            <Tabs value={tab} onValueChange={setTab} className="flex-1">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 px-6">
                <TabsTrigger value="data" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#800000] data-[state=active]:text-[#800000] data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                  <Database className="h-3.5 w-3.5 mr-1.5" /> Data
                </TabsTrigger>
                <TabsTrigger value="display" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#800000] data-[state=active]:text-[#800000] data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                  <Palette className="h-3.5 w-3.5 mr-1.5" /> Display
                </TabsTrigger>
                <TabsTrigger value="target" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#800000] data-[state=active]:text-[#800000] data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                  <Crosshair className="h-3.5 w-3.5 mr-1.5" /> Target
                </TabsTrigger>
                <TabsTrigger value="description" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#800000] data-[state=active]:text-[#800000] data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                  <FileText className="h-3.5 w-3.5 mr-1.5" /> Description
                </TabsTrigger>
              </TabsList>

              {/* DATA TAB */}
              <TabsContent value="data" className="p-6 space-y-4 m-0">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Name</Label>
                    <Input value={form.name} onChange={e => u('name', e.target.value)} placeholder="e.g., Total Pipeline" data-testid="chart-name-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Data Source (Model)</Label>
                    <Select value={form.collection} onValueChange={v => u('collection', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opportunities">Lead/Opportunity</SelectItem>
                        <SelectItem value="accounts">Account (res.partner)</SelectItem>
                        <SelectItem value="invoices">Invoice (account.move)</SelectItem>
                        <SelectItem value="activities">Activity (mail.activity)</SelectItem>
                        <SelectItem value="employees">Employee (hr.employee)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Record Type</Label>
                    <Select value={form.aggregation} onValueChange={v => u('aggregation', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">Count</SelectItem>
                        <SelectItem value="sum">Sum</SelectItem>
                        <SelectItem value="avg">Average</SelectItem>
                        <SelectItem value="list">Record List</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Value Field</Label>
                    <Select value={form.field || '_none'} onValueChange={v => u('field', v === '_none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">None (count only)</SelectItem>
                        <SelectItem value="sale_value">Sale Value (OMR)</SelectItem>
                        <SelectItem value="x_studio_sale_value">Studio Sale Value</SelectItem>
                        <SelectItem value="amount_total">Invoice Amount Total</SelectItem>
                        <SelectItem value="probability">Probability %</SelectItem>
                        <SelectItem value="expected_revenue">Expected Revenue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Group By</Label>
                  <Select value={form.group_by || '_none'} onValueChange={v => u('group_by', v === '_none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="No grouping" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No grouping (single value)</SelectItem>
                      <SelectItem value="stage">Stage</SelectItem>
                      <SelectItem value="owner_name">Salesperson</SelectItem>
                      <SelectItem value="product_manager">Product Director</SelectItem>
                      <SelectItem value="solution_category">Solution Category</SelectItem>
                      <SelectItem value="account_name">Account</SelectItem>
                      <SelectItem value="team_name">Sales Team</SelectItem>
                      <SelectItem value="payment_state">Payment Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Domain / Filters — Visual Builder */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-gray-500">Domain (Filter Rules)</Label>
                  </div>
                  <div className="bg-gray-50 rounded-lg border p-3 space-y-2">
                    {(() => {
                      let parsed = form.filters;
                      if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { parsed = {}; } }
                      const keys = Object.keys(parsed || {}).filter(k => !k.startsWith('$'));
                      const ruleCount = keys.length + (parsed?.$or ? parsed.$or.length : 0) + (parsed?.$and ? parsed.$and.length : 0);
                      return (
                        <>
                          {ruleCount > 0 ? (
                            <div className="space-y-1">
                              {keys.slice(0, 4).map(k => {
                                const v = parsed[k];
                                const display = typeof v === 'object' ? (v.$in ? `in [${v.$in.join(', ')}]` : v.$nin ? `not in [${v.$nin.join(', ')}]` : v.$ne ? `!= ${v.$ne}` : JSON.stringify(v)) : `= ${v}`;
                                return <div key={k} className="flex items-center gap-2 text-xs"><Badge variant="outline" className="text-[10px]">{k}</Badge><span className="text-gray-500">{display}</span></div>;
                              })}
                              {ruleCount > 4 && <p className="text-[10px] text-gray-400">+{ruleCount - 4} more rules</p>}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">No filter rules defined. Click Edit Domain to add.</p>
                          )}
                        </>
                      );
                    })()}
                    <Button variant="outline" size="sm" onClick={() => setShowDomain(true)} className="w-full text-sm" data-testid="edit-domain-btn">
                      Edit Domain
                    </Button>
                  </div>
                </div>

                {/* Date Filter Field */}
                <div>
                  <Label className="text-xs text-gray-500">Date Filter Field</Label>
                  <Select value={form.date_filter_field || ''} onValueChange={v => u('date_filter_field', v)}>
                    <SelectTrigger><SelectValue placeholder="None (auto)" /></SelectTrigger>
                    <SelectContent>
                      {(DATE_FILTER_FIELDS[form.collection] || DATE_FILTER_FIELDS.opportunities).map(f => (
                        <SelectItem key={f.key || '_none'} value={f.key || '_none'}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.year_filter} onCheckedChange={v => u('year_filter', v)} />
                    <Label className="text-xs">Apply Year Filter</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs text-gray-500">Cache TTL:</Label>
                    <Input type="number" value={form.cache_ttl} onChange={e => u('cache_ttl', parseInt(e.target.value) || 60)} className="w-16 h-7 text-xs" />
                    <span className="text-xs text-gray-400">sec</span>
                  </div>
                </div>
              </TabsContent>

              {/* DISPLAY TAB */}
              <TabsContent value="display" className="p-6 space-y-4 m-0">
                <div>
                  <Label className="text-xs text-gray-500 mb-2 block">Icon</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(ICONS_MAP).map(([key, Icon]) => (
                      <button key={key} onClick={() => u('icon', key)}
                        className={`p-2 rounded-lg border transition-all ${form.icon === key ? 'border-[#800000] bg-[#800000]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <Icon className={`h-4 w-4 ${form.icon === key ? 'text-[#800000]' : 'text-gray-500'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-gray-500 mb-2 block">Theme (Background Color)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {THEME_COLORS.map(tc => (
                      <button key={tc.id} onClick={() => u('color', tc.bg)}
                        className={`w-10 h-10 rounded-lg transition-all relative ${form.color === tc.bg ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: tc.bg }}
                        title={tc.label}
                        data-testid={`theme-color-${tc.id}`}>
                        {form.color === tc.bg && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">&#10003;</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Custom Background Color</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.color} onChange={e => u('color', e.target.value)}
                      className="w-10 h-10 rounded-lg border cursor-pointer" />
                    <Input value={form.color} onChange={e => u('color', e.target.value)} className="w-28 h-9 text-xs font-mono" />
                    <div className="w-20 h-10 rounded-lg border flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: form.color }}>
                      Preview
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TARGET TAB */}
              <TabsContent value="target" className="p-6 space-y-4 m-0">
                <div className="bg-gray-50 rounded-lg p-4 border text-sm text-gray-600">
                  <p className="font-medium text-gray-700 mb-1">Target Settings</p>
                  <p>Set performance targets for this KPI card. When targets are enabled, the card will show progress towards the goal.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch />
                  <Label className="text-sm">Enable Target</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch />
                  <Label className="text-sm">Send Mail on Target Achievement</Label>
                </div>
              </TabsContent>

              {/* DESCRIPTION TAB */}
              <TabsContent value="description" className="p-6 space-y-4 m-0">
                <div>
                  <Label className="text-xs text-gray-500">Item Description</Label>
                  <textarea value={form.description} onChange={e => u('description', e.target.value)}
                    className="w-full h-32 text-sm p-3 border rounded-lg resize-none focus:ring-1 focus:ring-[#800000] focus:border-[#800000]"
                    placeholder="Describe what this chart shows..." />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Live Preview */}
          <div className="w-[280px] bg-gray-50 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">Preview</span>
                <Button size="sm" variant="outline" onClick={handlePreview} disabled={previewing} className="h-7 text-xs" data-testid="preview-btn">
                  <Play className="h-3 w-3 mr-1" /> {previewing ? '...' : 'Run'}
                </Button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              {!preview ? (
                <div className="text-center text-gray-400">
                  <Eye className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs">Click "Run" to preview</p>
                </div>
              ) : ['number', 'win_rate'].includes(form.display_type) ? (
                /* KPI Card preview */
                <div className="w-full rounded-lg overflow-hidden" style={{ backgroundColor: form.color }}>
                  <div className="p-5 text-center">
                    <div className="mb-2 inline-flex p-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                      <PreviewIcon className="h-5 w-5 text-white/60" />
                    </div>
                    <p className="text-3xl font-black text-white tracking-tight">{previewValue()}</p>
                    <p className="text-xs font-medium text-white/80 mt-1.5 uppercase tracking-wider">{form.name || 'Card Name'}</p>
                    {preview?.count > 0 && <p className="text-[10px] text-white/50 mt-1">{preview.count} records</p>}
                  </div>
                </div>
              ) : ['chart', 'area'].includes(form.display_type) && preview.groups ? (
                /* Bar/Area chart mini preview */
                <div className="w-full bg-white rounded-lg border p-3">
                  <p className="text-[10px] font-semibold text-gray-500 mb-1">{form.name || 'Chart'}</p>
                  <div className="h-32">
                    <MiniBarPreview groups={preview.groups} aggregation={form.aggregation} isArea={form.display_type === 'area'} />
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">{preview.groups.length} groups</p>
                </div>
              ) : form.display_type === 'pie' && preview.groups ? (
                /* Pie chart mini preview */
                <div className="w-full bg-white rounded-lg border p-3">
                  <p className="text-[10px] font-semibold text-gray-500 mb-1">{form.name || 'Pie'}</p>
                  <div className="h-32">
                    <MiniPiePreview groups={preview.groups} aggregation={form.aggregation} />
                  </div>
                </div>
              ) : ['leaderboard', 'progress', 'radial'].includes(form.display_type) && preview.groups ? (
                /* List/Progress/Radial preview */
                <div className="w-full bg-white rounded-lg border p-3">
                  <p className="text-[10px] font-semibold text-gray-500 mb-2">{form.name || 'Chart'}</p>
                  <div className="space-y-1.5">
                    {preview.groups.slice(0, 5).map((g, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PREVIEW_COLORS[i % PREVIEW_COLORS.length] }} />
                        <span className="text-gray-600 truncate flex-1">{g.label || '-'}</span>
                        <span className="font-bold text-gray-900">{(g.total || g.count || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">{preview.groups.length} items</p>
                </div>
              ) : form.display_type === 'table' && (preview.records || preview.groups) ? (
                /* Table preview */
                <div className="w-full bg-white rounded-lg border p-3">
                  <p className="text-[10px] font-semibold text-gray-500 mb-2">{form.name || 'Table'}</p>
                  <div className="space-y-1">
                    {(preview.records || preview.groups || []).slice(0, 5).map((r, i) => (
                      <div key={i} className="flex justify-between text-xs py-0.5 border-b border-gray-50 last:border-0">
                        <span className="text-gray-600 truncate flex-1">{r.name || r.label || '-'}</span>
                        <span className="font-bold text-gray-900 ml-2">OMR {(r.sale_value || r.total || r.amount_total || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">{preview.total || (preview.records||[]).length} records</p>
                </div>
              ) : (
                /* Fallback: scalar value */
                <div className="w-full bg-white rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{previewValue()}</p>
                  <p className="text-xs text-gray-500 mt-1">{form.name || 'Value'}</p>
                  {preview?.count > 0 && <p className="text-[10px] text-gray-400">{preview.count} records</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t flex justify-between">
          <Button variant="outline" onClick={onClose}>Discard</Button>
          <Button onClick={handleSave} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="save-chart-btn">
            <Save className="h-4 w-4 mr-1" /> Save & Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Domain Builder Dialog */}
      <DomainBuilderDialog
        open={showDomain}
        onClose={() => setShowDomain(false)}
        collection={form.collection}
        currentFilters={form.filters}
        onSave={(mongoFilter) => u('filters', JSON.stringify(mongoFilter, null, 2))}
      />
    </Dialog>
  );
}
