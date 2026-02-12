import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Target, Plus, Trash2, BarChart2, DollarSign, TrendingUp, Trophy,
  AlertTriangle, Building2, Users, Pencil, Play, RefreshCw, Save,
  Settings, Eye, GripVertical, Copy, Layers
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const ICONS = { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, Building2, Users, BarChart2 };
const CHART_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316'];

// ========================= CARD RENDERER =========================
export function RenderCard({ card, data, compact = false, onEdit, onDelete, showControls = true }) {
  const Icon = ICONS[card.icon] || Target;
  const isChart = card.display_type === 'chart' || card.display_type === 'pie';
  const isGrouped = data?.type === 'grouped';
  const groups = data?.groups || [];

  return (
    <Card className={`overflow-hidden transition-all duration-200 hover:shadow-lg ${isChart ? 'col-span-2' : ''} group relative border-0 shadow-sm`}
      style={{ borderTop: `3px solid ${card.color || '#800000'}` }}>
      
      {/* Controls overlay */}
      {showControls && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          {onEdit && <button onClick={() => onEdit(card)} className="p-1 rounded bg-white/90 shadow-sm hover:bg-gray-100"><Pencil className="h-3 w-3 text-gray-500" /></button>}
          {onDelete && <button onClick={() => onDelete(card.id)} className="p-1 rounded bg-white/90 shadow-sm hover:bg-red-50"><Trash2 className="h-3 w-3 text-red-400" /></button>}
        </div>
      )}

      <CardContent className={compact ? "p-3" : "p-5"}>
        {isGrouped && (card.display_type === 'chart') ? (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{card.name}</h4>
            <ResponsiveContainer width="100%" height={compact ? 160 : 220}>
              <BarChart data={groups.slice(0, 10)} margin={{ left: -10 }}>
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  formatter={v => [`OMR ${typeof v === 'number' ? v.toLocaleString() : v}`]} />
                <Bar dataKey={card.aggregation === 'count' ? 'count' : 'total'} radius={[6, 6, 0, 0]}>
                  {groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : isGrouped && card.display_type === 'pie' ? (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{card.name}</h4>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={compact ? 120 : 160}>
                <PieChart>
                  <Pie data={groups.slice(0, 8)} dataKey={card.aggregation === 'count' ? 'count' : 'total'} nameKey="label" cx="50%" cy="50%" innerRadius={25} outerRadius={55} paddingAngle={2}>
                    {groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 flex-1">
                {groups.slice(0, 5).map((g, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                    <span className="text-gray-500 truncate flex-1">{g.label || '-'}</span>
                    <span className="font-mono text-gray-700">{(g.total || g.count || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : data?.type === 'list' ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">{card.name}</h4>
              <Badge variant="secondary" className="text-xs">{data.total}</Badge>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {(data.records || []).slice(0, 8).map((r, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-gray-50 text-xs">
                  <span className="text-gray-600 truncate flex-1">{r.name || r.invoice_number || '-'}</span>
                  <span className="font-mono font-semibold text-gray-900 ml-2">OMR {(r.sale_value || r.amount_total || r.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Number card
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.name}</span>
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${card.color || '#800000'}10` }}>
                <Icon className="h-4 w-4" style={{ color: card.color || '#800000' }} />
              </div>
            </div>
            <p className={`font-bold text-gray-900 ${compact ? 'text-xl' : 'text-3xl'}`}>
              {card.aggregation === 'sum' || card.aggregation === 'avg' 
                ? `OMR ${(data?.value || 0).toLocaleString()}`
                : (data?.value || 0).toLocaleString()
              }
            </p>
            {data?.count !== undefined && data.count > 0 && (
              <p className="text-xs text-gray-400 mt-1">{data.count} records</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========================= QUERY EDITOR DIALOG =========================
export function QueryEditorDialog({ open, onClose, card, onSave }) {
  const [form, setForm] = useState({
    name: '', collection: 'opportunities', aggregation: 'count', field: '',
    filters: '{}', group_by: '', display_type: 'number', color: '#800000',
    icon: 'Target', size: 'small', year_filter: true, cache_ttl: 60, description: ''
  });
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [tab, setTab] = useState('config');

  useEffect(() => {
    if (card) {
      setForm({
        name: card.name || '', collection: card.collection || 'opportunities',
        aggregation: card.aggregation || 'count', field: card.field || '',
        filters: typeof card.filters === 'string' ? card.filters : JSON.stringify(card.filters || {}, null, 2),
        group_by: card.group_by || '', display_type: card.display_type || 'number',
        color: card.color || '#800000', icon: card.icon || 'Target',
        size: card.size || 'small', year_filter: card.year_filter !== false,
        cache_ttl: card.cache_ttl || 60, description: card.description || ''
      });
      setPreview(null);
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
    if (!form.name) { toast.error('Card name required'); return; }
    let filters = {};
    try { filters = JSON.parse(form.filters); } catch { toast.error('Invalid filter JSON'); return; }
    onSave({ ...form, filters, field: form.field || undefined, group_by: form.group_by || undefined });
  };

  // Common filter presets
  const presets = [
    { label: 'Won Opportunities', filters: '{"type": "opportunity", "stage": "Won"}' },
    { label: 'Open Pipeline', filters: '{"type": "opportunity", "stage": {"$nin": ["Won", "Lost"]}}' },
    { label: 'Lost Deals', filters: '{"type": "opportunity", "stage": "Lost"}' },
    { label: 'All Opportunities', filters: '{"type": "opportunity"}' },
    { label: 'Overdue Invoices', filters: '{"payment_state": {"$in": ["not_paid", "partial"]}}' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#800000]" />
            {card?.id ? 'Edit Card Query' : 'Create Dashboard Card'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="config">Query Config</TabsTrigger>
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-3">
            <TabsContent value="config" className="space-y-3 m-0">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-gray-500">Card Name</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Total Pipeline" /></div>
                <div><Label className="text-xs text-gray-500">Data Source</Label>
                  <Select value={form.collection} onValueChange={v => setForm(f => ({...f, collection: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opportunities">Opportunities (crm.lead)</SelectItem>
                      <SelectItem value="accounts">Accounts (res.partner)</SelectItem>
                      <SelectItem value="invoices">Invoices (account.move)</SelectItem>
                      <SelectItem value="activities">Activities (mail.activity)</SelectItem>
                      <SelectItem value="employees">Employees (hr.employee)</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-xs text-gray-500">Aggregation</Label>
                  <Select value={form.aggregation} onValueChange={v => setForm(f => ({...f, aggregation: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Count records</SelectItem>
                      <SelectItem value="sum">Sum of field</SelectItem>
                      <SelectItem value="avg">Average of field</SelectItem>
                      <SelectItem value="list">Record list</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-xs text-gray-500">Value Field</Label>
                  <Select value={form.field || '_none'} onValueChange={v => setForm(f => ({...f, field: v === '_none' ? '' : v}))}>
                    <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None (count only)</SelectItem>
                      <SelectItem value="sale_value">Sale Value (OMR)</SelectItem>
                      <SelectItem value="x_studio_sale_value">Studio Sale Value</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="amount_total">Invoice Amount Total</SelectItem>
                      <SelectItem value="probability">Probability %</SelectItem>
                      <SelectItem value="expected_revenue">Expected Revenue</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <div><Label className="text-xs text-gray-500">Group By (leave empty for single value)</Label>
                <Select value={form.group_by || '_none'} onValueChange={v => setForm(f => ({...f, group_by: v === '_none' ? '' : v}))}>
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
                    <SelectItem value="activity_type">Activity Type</SelectItem>
                  </SelectContent>
                </Select></div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-gray-500">Filter Query (JSON)</Label>
                  <div className="flex gap-1">{presets.map(p => (
                    <button key={p.label} onClick={() => setForm(f => ({...f, filters: p.filters}))}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-[#800000] hover:text-white transition-colors">{p.label}</button>
                  ))}</div>
                </div>
                <textarea value={form.filters} onChange={e => setForm(f => ({...f, filters: e.target.value}))}
                  className="w-full h-24 text-xs font-mono p-2.5 border rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-[#800000] resize-none"
                  placeholder='{"type": "opportunity", "stage": "Won"}' />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><Switch checked={form.year_filter} onCheckedChange={v => setForm(f => ({...f, year_filter: v}))} /><Label className="text-xs">Apply year filter</Label></div>
                <div className="flex items-center gap-1"><Label className="text-xs text-gray-500">Cache:</Label><Input type="number" value={form.cache_ttl} onChange={e => setForm(f => ({...f, cache_ttl: parseInt(e.target.value) || 60}))} className="w-16 h-7 text-xs" /><span className="text-xs text-gray-400">sec</span></div>
              </div>
            </TabsContent>

            <TabsContent value="display" className="space-y-3 m-0">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-gray-500">Display Type</Label>
                  <Select value={form.display_type} onValueChange={v => setForm(f => ({...f, display_type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number Card</SelectItem>
                      <SelectItem value="chart">Bar Chart</SelectItem>
                      <SelectItem value="pie">Pie Chart</SelectItem>
                      <SelectItem value="table">Data Table</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-xs text-gray-500">Icon</Label>
                  <Select value={form.icon} onValueChange={v => setForm(f => ({...f, icon: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(ICONS).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div><Label className="text-xs text-gray-500">Accent Color</Label>
                <div className="flex gap-2 mt-1">
                  {['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899'].map(c => (
                    <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                      className={`w-8 h-8 rounded-lg transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="m-0">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-500">Live Preview ({new Date().getFullYear()})</span>
                <Button size="sm" onClick={handlePreview} disabled={previewing} className="bg-[#800000] hover:bg-[#9a1919] text-white">
                  <Play className="h-3.5 w-3.5 mr-1" /> {previewing ? 'Running...' : 'Execute Query'}
                </Button>
              </div>
              {preview ? (
                <div className="max-w-md">
                  <RenderCard card={{...form, filters: (() => { try { return JSON.parse(form.filters); } catch { return {}; } })()}} data={preview} showControls={false} compact />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Eye className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Click "Execute Query" to see a preview</p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="mt-3 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-[#800000] hover:bg-[#9a1919] text-white">
            <Save className="h-4 w-4 mr-1" /> {card?.id ? 'Update Card' : 'Create Card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========================= MAIN DASHBOARD BUILDER =========================
export default function ConfigurableDashboard() {
  const [cards, setCards] = useState([]);
  const [cardData, setCardData] = useState({});
  const [loading, setLoading] = useState(true);
  const [editCard, setEditCard] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await targetAPI.listCards();
      setCards(res.data);
      const dataMap = {};
      await Promise.allSettled(
        res.data.map(async (card) => {
          try {
            const r = await targetAPI.executeCard(card.id, year);
            dataMap[card.id] = r.data;
          } catch {}
        })
      );
      setCardData(dataMap);
    } catch {} finally { setLoading(false); }
  }, [year]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const handleSaveCard = async (formData) => {
    try {
      if (editCard?.id) {
        await targetAPI.updateCard(editCard.id, formData);
        toast.success('Card updated');
      } else {
        await targetAPI.createCard(formData);
        toast.success('Card created');
      }
      setShowEditor(false);
      setEditCard(null);
      loadCards();
    } catch { toast.error('Failed'); }
  };

  const handleDeleteCard = async (id) => {
    try { await targetAPI.deleteCard(id); toast.success('Deleted'); loadCards(); } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-4 gap-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-[#800000]" /> Dashboard Builder
          </h1>
          <p className="text-gray-500 text-sm">Each card is a configurable query. Hover to edit or delete.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={v => setYear(v)}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" onClick={loadCards}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          {cards.length === 0 && <Button variant="outline" onClick={async () => { try { await targetAPI.seedDefaultCards(); toast.success('Default cards created'); loadCards(); } catch {} }}><Settings className="h-4 w-4 mr-1" /> Seed Defaults</Button>}
          <Button onClick={() => { setEditCard({}); setShowEditor(true); }} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Plus className="h-4 w-4 mr-1" /> New Card</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <RenderCard key={card.id} card={card} data={cardData[card.id]}
            onEdit={c => { setEditCard(c); setShowEditor(true); }}
            onDelete={handleDeleteCard} />
        ))}
      </div>

      {cards.length === 0 && (
        <Card className="border-dashed border-2"><CardContent className="p-12 text-center">
          <Layers className="h-16 w-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No Dashboard Cards</h3>
          <p className="text-gray-300 mb-4">Create cards or seed defaults to build your dashboard</p>
          <Button onClick={async () => { try { await targetAPI.seedDefaultCards(); toast.success('Created'); loadCards(); } catch {} }} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Settings className="h-4 w-4 mr-1" /> Create Default Dashboard</Button>
        </CardContent></Card>
      )}

      <QueryEditorDialog open={showEditor} onClose={() => { setShowEditor(false); setEditCard(null); }} card={editCard} onSave={handleSaveCard} />
    </div>
  );
}
