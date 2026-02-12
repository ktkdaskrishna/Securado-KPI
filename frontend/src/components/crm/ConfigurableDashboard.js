import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Switch } from '../ui/switch';
import {
  Target, Plus, Trash2, Settings, BarChart2, DollarSign, TrendingUp,
  Trophy, AlertTriangle, Building2, Users, Pencil, Play, Eye, RefreshCw, Save
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const ICONS = { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, Building2, Users, BarChart2 };
const COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899'];

// Render a single card based on its data
function DashboardCard({ card, data, onEdit, onDelete, year }) {
  const Icon = ICONS[card.icon] || Target;
  const isChart = card.display_type === 'chart' || card.display_type === 'pie';
  const isGrouped = data?.type === 'grouped';

  return (
    <Card className={`hover:shadow-md transition-all ${isChart ? 'col-span-2' : ''} group relative`}>
      <CardContent className="p-4">
        {/* Edit/Delete overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(card)}><Pencil className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => onDelete(card.id)}><Trash2 className="h-3 w-3" /></Button>
        </div>

        {isGrouped && isChart ? (
          // Chart card
          <>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{card.name}</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(data.groups || []).slice(0, 10)} margin={{ left: 0 }}>
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip contentStyle={{ fontSize: '12px' }} formatter={v => [typeof v === 'number' ? v.toLocaleString() : v]} />
                <Bar dataKey={card.aggregation === 'count' ? 'count' : 'total'} radius={[4, 4, 0, 0]}>
                  {(data.groups || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : isGrouped && card.display_type === 'pie' ? (
          // Pie chart
          <>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{card.name}</h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={(data.groups || []).slice(0, 8)} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={30} outerRadius={70}>
                  {(data.groups || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </>
        ) : data?.type === 'list' ? (
          // Table card
          <>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{card.name} ({data.total})</h4>
            <div className="max-h-48 overflow-y-auto text-xs">
              {(data.records || []).slice(0, 10).map((r, i) => (
                <div key={i} className="py-1 border-b border-gray-100 flex justify-between">
                  <span className="truncate flex-1">{r.name || r.invoice_number || '-'}</span>
                  <span className="font-mono ml-2">{(r.sale_value || r.amount_total || r.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          // Number card (default)
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{card.name}</span>
              <div className="p-1.5 rounded-full" style={{ backgroundColor: `${card.color}15` }}>
                <Icon className="h-4 w-4" style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {card.aggregation === 'sum' ? `OMR ${(data?.value || 0).toLocaleString()}` : (data?.value || 0).toLocaleString()}
            </p>
            {data?.count !== undefined && <p className="text-xs text-gray-400">{data.count} records</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Card Editor Dialog
function CardEditorDialog({ open, onClose, card, onSave }) {
  const [form, setForm] = useState({
    name: '', collection: 'opportunities', aggregation: 'count', field: '',
    filters: '{}', group_by: '', display_type: 'number', color: '#800000',
    icon: 'Target', size: 'small', year_filter: true, cache_ttl: 60, description: ''
  });
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (card) {
      setForm({
        name: card.name || '', collection: card.collection || 'opportunities',
        aggregation: card.aggregation || 'count', field: card.field || '',
        filters: JSON.stringify(card.filters || {}, null, 2), group_by: card.group_by || '',
        display_type: card.display_type || 'number', color: card.color || '#800000',
        icon: card.icon || 'Target', size: card.size || 'small',
        year_filter: card.year_filter !== false, cache_ttl: card.cache_ttl || 60,
        description: card.description || ''
      });
    }
  }, [card]);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      let filters = {};
      try { filters = JSON.parse(form.filters); } catch {}
      const res = await targetAPI.executeQuery({
        collection: form.collection, aggregation: form.aggregation,
        field: form.field || undefined, filters,
        group_by: form.group_by || undefined, year: form.year_filter ? new Date().getFullYear().toString() : undefined,
        cache_ttl: 10
      });
      setPreview(res.data);
    } catch { toast.error('Preview failed'); }
    finally { setPreviewing(false); }
  };

  const handleSave = () => {
    let filters = {};
    try { filters = JSON.parse(form.filters); } catch { toast.error('Invalid filter JSON'); return; }
    onSave({ ...form, filters, field: form.field || undefined, group_by: form.group_by || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{card?.id ? 'Edit Card' : 'Create Card'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Card Name</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Total Pipeline" /></div>
          <div><Label className="text-xs">Collection</Label>
            <Select value={form.collection} onValueChange={v => setForm(f => ({...f, collection: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="opportunities">Opportunities</SelectItem>
                <SelectItem value="accounts">Accounts</SelectItem>
                <SelectItem value="invoices">Invoices</SelectItem>
                <SelectItem value="activities">Activities</SelectItem>
                <SelectItem value="employees">Employees</SelectItem>
              </SelectContent>
            </Select></div>
          <div><Label className="text-xs">Aggregation</Label>
            <Select value={form.aggregation} onValueChange={v => setForm(f => ({...f, aggregation: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="sum">Sum</SelectItem>
                <SelectItem value="avg">Average</SelectItem>
                <SelectItem value="list">List (Table)</SelectItem>
              </SelectContent>
            </Select></div>
          <div><Label className="text-xs">Field (for sum/avg)</Label><Input value={form.field} onChange={e => setForm(f => ({...f, field: e.target.value}))} placeholder="sale_value" /></div>
          <div><Label className="text-xs">Group By (for charts)</Label><Input value={form.group_by} onChange={e => setForm(f => ({...f, group_by: e.target.value}))} placeholder="stage, owner_name, product_manager" /></div>
          <div><Label className="text-xs">Display Type</Label>
            <Select value={form.display_type} onValueChange={v => setForm(f => ({...f, display_type: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="number">Number Card</SelectItem>
                <SelectItem value="chart">Bar Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
                <SelectItem value="table">Table</SelectItem>
              </SelectContent>
            </Select></div>
          <div><Label className="text-xs">Icon</Label>
            <Select value={form.icon} onValueChange={v => setForm(f => ({...f, icon: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(ICONS).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select></div>
          <div><Label className="text-xs">Color</Label><Input type="color" value={form.color} onChange={e => setForm(f => ({...f, color: e.target.value}))} className="h-9" /></div>
          <div className="col-span-2"><Label className="text-xs">Filters (JSON)</Label>
            <textarea value={form.filters} onChange={e => setForm(f => ({...f, filters: e.target.value}))} className="w-full h-20 text-xs font-mono p-2 border rounded bg-gray-50" placeholder='{"type": "opportunity", "stage": "Won"}' />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.year_filter} onCheckedChange={v => setForm(f => ({...f, year_filter: v}))} />
            <Label className="text-xs">Apply Year Filter</Label>
          </div>
          <div><Label className="text-xs">Cache TTL (seconds)</Label><Input type="number" value={form.cache_ttl} onChange={e => setForm(f => ({...f, cache_ttl: parseInt(e.target.value) || 60}))} /></div>
        </div>

        {/* Preview */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Preview</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePreview} disabled={previewing}>
              <Play className="h-3 w-3 mr-1" /> {previewing ? 'Running...' : 'Run Query'}
            </Button>
          </div>
          {preview && (
            <div className="text-sm">
              {preview.type === 'scalar' && <p className="text-2xl font-bold">{preview.aggregation === 'sum' ? `OMR ${(preview.value || 0).toLocaleString()}` : preview.value?.toLocaleString()}</p>}
              {preview.type === 'grouped' && <p>{preview.groups?.length} groups, top: {preview.groups?.[0]?.label} ({preview.groups?.[0]?.count})</p>}
              {preview.type === 'list' && <p>{preview.total} records</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Save className="h-4 w-4 mr-1" /> Save Card</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Configurable Dashboard Page
export default function ConfigurableDashboard() {
  const [cards, setCards] = useState([]);
  const [cardData, setCardData] = useState({});
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editCard, setEditCard] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const loadCards = useCallback(async () => {
    try {
      const res = await targetAPI.listCards();
      setCards(res.data);
      // Execute all cards
      const dataMap = {};
      for (const card of res.data) {
        try {
          const r = await targetAPI.executeCard(card.id, year);
          dataMap[card.id] = r.data;
        } catch {}
      }
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

  const handleSeed = async () => {
    try {
      const res = await targetAPI.seedDefaultCards();
      toast.success(`Created ${res.data.cards_created} cards`);
      loadCards();
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart2 className="h-6 w-6 text-[#800000]" /> Dashboard Builder</h1>
          <p className="text-gray-500 text-sm">Configurable cards with query engine backed by Redis cache</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={v => { setYear(v); setLoading(true); }}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" onClick={loadCards}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          {cards.length === 0 && <Button variant="outline" onClick={handleSeed}><Settings className="h-4 w-4 mr-1" /> Seed Defaults</Button>}
          <Button onClick={() => { setEditCard({}); setShowEditor(true); }} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Plus className="h-4 w-4 mr-1" /> New Card</Button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map(card => (
          <DashboardCard key={card.id} card={card} data={cardData[card.id]} year={year}
            onEdit={(c) => { setEditCard(c); setShowEditor(true); }}
            onDelete={handleDeleteCard} />
        ))}
      </div>

      {cards.length === 0 && (
        <Card><CardContent className="p-8 text-center">
          <BarChart2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No dashboard cards configured.</p>
          <Button onClick={handleSeed} variant="outline" className="mt-3"><Settings className="h-4 w-4 mr-1" /> Create Default Cards</Button>
        </CardContent></Card>
      )}

      <CardEditorDialog open={showEditor} onClose={() => { setShowEditor(false); setEditCard(null); }} card={editCard} onSave={handleSaveCard} />
    </div>
  );
}
