import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import {
  Target, TrendingUp, DollarSign, Trophy, AlertTriangle, Building2,
  Users, BarChart2, Activity, RefreshCw, Layers, Calendar,
  Search, Eye, Info, ExternalLink, ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, RadialBarChart, RadialBar, PolarGrid } from 'recharts';
import { toast } from 'sonner';

const ICONS = { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, Building2, Users, BarChart2, Activity };
const CHART_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const CARD_COLORS = {
  '#1e3a5f': { muted: '#8bb4e0', iconBg: 'rgba(255,255,255,0.12)' },
  '#8b1a1a': { muted: '#e8a0a0', iconBg: 'rgba(255,255,255,0.12)' },
  '#1a6b4a': { muted: '#8fd4b4', iconBg: 'rgba(255,255,255,0.12)' },
  '#b45309': { muted: '#fbbf6e', iconBg: 'rgba(255,255,255,0.12)' },
  '#5b21b6': { muted: '#c4a8ec', iconBg: 'rgba(255,255,255,0.12)' },
  '#0e7490': { muted: '#7dd3e8', iconBg: 'rgba(255,255,255,0.12)' },
  '#800000': { muted: '#d4a0a0', iconBg: 'rgba(255,255,255,0.12)' },
  '#3730a3': { muted: '#a5b4fc', iconBg: 'rgba(255,255,255,0.12)' },
  '#4d5e2f': { muted: '#b8cc94', iconBg: 'rgba(255,255,255,0.12)' },
  '#334155': { muted: '#94a3b8', iconBg: 'rgba(255,255,255,0.12)' },
  '#3b82f6': { muted: '#93c5fd', iconBg: 'rgba(255,255,255,0.12)' },
};
const getColorInfo = (c) => CARD_COLORS[c] || { muted: 'rgba(255,255,255,0.7)', iconBg: 'rgba(255,255,255,0.12)' };

const DATE_PRESETS = [
  { label: 'This Year', value: String(new Date().getFullYear()) },
  { label: 'Last Year', value: String(new Date().getFullYear() - 1) },
  { label: '2024', value: '2024' },
];

// ============ DRILL-DOWN PANEL ============
function DrillDownPanel({ open, onClose, card, year }) {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || !card?.id) return;
    setSearch('');
    (async () => {
      setLoading(true);
      try { const r = await targetAPI.drillDownCard(card.id, { year, limit: 100 }); setRecords(r.data.records || []); setTotal(r.data.total || 0); } catch {}
      finally { setLoading(false); }
    })();
  }, [open, card?.id, year]);

  const filtered = records.filter(r => !search || Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const columns = records.length > 0 ? Object.keys(records[0]).filter(k => !k.startsWith('canonical') && !k.startsWith('source_record') && k !== 'deleted') : [];
  const fmtH = k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const fmtV = (k, v) => { if (v == null) return '-'; if (k.includes('value') || k.includes('amount')) return `OMR ${Number(v).toLocaleString()}`; if (k.includes('date') && typeof v === 'string') return v.split('T')[0]; return String(v); };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[700px] sm:w-[800px] sm:max-w-[800px] p-0" data-testid="drill-down-panel">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b bg-gray-50/80">
            <SheetTitle className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">{card?.name || 'Records'}</span>
              <Badge className="bg-[#800000]/10 text-[#800000]">{total} records</Badge>
            </SheetTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." className="pl-9 h-9 text-sm" />
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1">
            {loading ? <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            : filtered.length === 0 ? <div className="p-12 text-center text-gray-400"><Target className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No records found</p></div>
            : <div className="divide-y divide-gray-100">{filtered.map((r, idx) => (
                <div key={idx} className="px-6 py-3 hover:bg-gray-50/80 transition-colors" data-testid={`drill-down-row-${idx}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">{r.name || r.invoice_number || r.summary || Object.values(r)[0]}</p>
                      <div className="flex flex-wrap gap-x-4 mt-1">{columns.slice(1, 5).map(c => <span key={c} className="text-xs text-gray-500"><span className="text-gray-400">{fmtH(c)}:</span> <span className="font-medium text-gray-700">{fmtV(c, r[c])}</span></span>)}</div>
                    </div>
                    {(r.sale_value || r.amount_total) && <span className="text-sm font-bold text-[#800000] ml-3 whitespace-nowrap">OMR {(r.sale_value || r.amount_total || 0).toLocaleString()}</span>}
                  </div>
                </div>))}</div>}
          </ScrollArea>
          <div className="px-6 py-3 border-t bg-gray-50/80 flex items-center justify-between text-xs text-gray-500">
            <span>Showing {filtered.length} of {total}</span><span>{card?.collection}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============ KPI CARD (Read-only, Odoo-style) ============
function KpiCard({ card, data, onDrillDown }) {
  const Icon = ICONS[card?.icon] || Target;
  const groups = data?.groups || [];
  const bg = card?.color || '#1e3a5f';
  const ci = getColorInfo(bg);

  const displayValue = () => {
    if (card.display_type === 'win_rate') {
      const won = groups.find(g => g.label === 'Won')?.count || 0;
      const lost = groups.find(g => g.label === 'Lost')?.count || 0;
      return ((won / Math.max(won + lost, 1)) * 100).toFixed(0) + '%';
    }
    const val = data?.value || 0;
    if (card.aggregation === 'sum' || card.aggregation === 'avg') {
      if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
      if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K';
      return val.toLocaleString();
    }
    return val.toLocaleString();
  };

  return (
    <div className="h-full rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:brightness-110 group"
      style={{ backgroundColor: bg }} onClick={() => onDrillDown?.(card)} data-testid={`kpi-card-${card.id}`}>
      <div className="p-4 flex flex-col h-full justify-center items-center text-center relative">
        <div className="mb-2 p-2 rounded-lg" style={{ backgroundColor: ci.iconBg }}><Icon className="h-5 w-5" style={{ color: ci.muted }} /></div>
        <p className="text-3xl font-black text-white tracking-tight leading-none">{displayValue()}</p>
        <p className="text-xs font-medium mt-2 uppercase tracking-wider text-white/80">{card.name}</p>
        {data?.count > 0 && card.display_type !== 'win_rate' && <p className="text-[10px] mt-1 text-white/40">{data.count} records</p>}
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-white/0 group-hover:text-white/60 transition-colors">
          <span>Click to view details</span><ArrowRight className="h-2.5 w-2.5" />
        </div>
      </div>
    </div>
  );
}

// ============ CHART CARD (Read-only, shadcn charts) ============
function ChartCard({ card, data, onDrillDown }) {
  const groups = data?.groups || [];
  if (!card) return null;

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">{card.name}</h4>
        {onDrillDown && <button onClick={() => onDrillDown(card)} className="p-1 rounded hover:bg-gray-100"><ExternalLink className="h-3.5 w-3.5 text-gray-400" /></button>}
      </div>
      <div className="flex-1 min-h-0 px-2 pb-2">
        {card.display_type === 'chart' && (() => {
          const dk = card.aggregation === 'count' ? 'count' : 'total';
          const cfg = {}; groups.slice(0, 12).forEach((g, i) => { cfg[g.label || `i${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; }); cfg[dk] = { label: card.name };
          return (
            <ChartContainer config={cfg} className="h-full w-full">
              <BarChart accessibilityLayer data={groups.slice(0, 12)} margin={{ left: -10, bottom: 20, right: 10 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey={dk} radius={[6, 6, 0, 0]}>{groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
              </BarChart>
            </ChartContainer>);
        })()}
        {card.display_type === 'pie' && (() => {
          const dk = card.aggregation === 'count' ? 'count' : 'total';
          const cfg = {}; groups.slice(0, 8).forEach((g, i) => { cfg[g.label || `s${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; });
          return (
            <div className="flex items-center gap-3 h-full">
              <ChartContainer config={cfg} className="h-full w-1/2">
                <PieChart><ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Pie data={groups.slice(0, 8)} dataKey={dk} nameKey="label" cx="50%" cy="50%" innerRadius="30%" outerRadius="65%" paddingAngle={2}>{groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie>
                </PieChart>
              </ChartContainer>
              <div className="space-y-1 flex-1 overflow-auto">{groups.slice(0, 6).map((g, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-gray-500 truncate flex-1">{g.label || '-'}</span><span className="font-mono font-semibold text-gray-700">{(g.total || g.count || 0).toLocaleString()}</span></div>))}</div>
            </div>);
        })()}
        {card.display_type === 'leaderboard' && (
          <div className="px-2 space-y-1.5 overflow-auto h-full">{groups.slice(0, 10).map((g, idx) => (
            <div key={idx} className="flex items-center gap-2 hover:bg-gray-50 rounded px-2 py-1">
              <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                {(g.label || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
              <span className="flex-1 text-xs font-medium text-gray-700 truncate">{g.label || '-'}</span>
              <span className="text-xs font-bold text-[#800000]">OMR {(g.total || 0).toLocaleString()}</span>
            </div>))}</div>
        )}
        {card.display_type === 'progress' && (
          <div className="px-2 space-y-2 overflow-auto h-full">{(() => { const mx = Math.max(...groups.map(g => g.total || g.count || 0), 1);
            return groups.slice(0, 8).map((g, i) => (<div key={i}><div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600 truncate flex-1">{g.label || '-'}</span><span className="font-semibold text-gray-900 ml-2">OMR {(g.total || 0).toLocaleString()}</span></div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${((g.total || g.count || 0) / mx) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} /></div></div>));
          })()}</div>
        )}
        {card.display_type === 'table' && (
          <div className="px-2 space-y-0.5 overflow-auto h-full">{(data?.records || groups || []).slice(0, 10).map((r, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-gray-50 text-xs"><span className="text-gray-600 truncate flex-1">{r.name || r.label || '-'}</span><span className="font-mono font-semibold text-gray-900 ml-2">OMR {(r.sale_value || r.total || r.amount_total || 0).toLocaleString()}</span></div>))}</div>
        )}
      </div>
    </div>
  );
}

// ============ MAIN READ-ONLY DASHBOARD ============
export default function HybridDashboard() {
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [drillDown, setDrillDown] = useState({ open: false, card: null });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try { const r = await targetAPI.getMyDashboard(year); setBlocks(r.data.blocks || []); setTemplateName(r.data.template?.name || 'Dashboard'); } catch {} finally { setLoading(false); }
  }, [year]);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const isKpi = (b) => ['number', 'win_rate'].includes(b.card?.display_type);

  // Separate KPI cards and chart cards
  const kpiBlocks = blocks.filter(b => isKpi(b));
  const chartBlocks = blocks.filter(b => !isKpi(b));

  if (loading) return (
    <div className="space-y-5" data-testid="dashboard-loading">
      <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-40" /></div>
      <div className="grid grid-cols-6 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-56 rounded-lg" /><Skeleton className="h-56 rounded-lg" /></div>
    </div>
  );

  return (
    <div className="space-y-5" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900" data-testid="dashboard-title">{templateName}</h1>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32 h-9 text-sm" data-testid="year-select"><Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" /><SelectValue /></SelectTrigger>
            <SelectContent>{DATE_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadDashboard} data-testid="refresh-btn"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Layers className="h-16 w-16 mx-auto mb-4 text-gray-200" />
          <h3 className="text-lg font-semibold text-gray-400">No Dashboard Configured</h3>
          <p className="text-sm text-gray-300 mt-1">Ask your admin to configure a dashboard in the Dashboard Builder</p>
        </div>
      ) : (
        <>
          {/* KPI Cards Row (6 per row, Odoo-style) */}
          {kpiBlocks.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {kpiBlocks.map(b => <KpiCard key={b.card_id} card={b.card} data={b.data} onDrillDown={c => setDrillDown({ open: true, card: c })} />)}
            </div>
          )}

          {/* Chart Cards (2 per row) */}
          {chartBlocks.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {chartBlocks.map(b => (
                <div key={b.card_id} className="min-h-[280px]">
                  <ChartCard card={b.card} data={b.data} onDrillDown={c => setDrillDown({ open: true, card: c })} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <DrillDownPanel open={drillDown.open} onClose={() => setDrillDown({ open: false, card: null })} card={drillDown.card} year={year} />
    </div>
  );
}
