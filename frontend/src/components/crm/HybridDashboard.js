import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { targetAPI } from '../../lib/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import {
  Target, TrendingUp, DollarSign, Trophy, AlertTriangle, Building2,
  Users, BarChart2, Activity, RefreshCw, Layers, Calendar,
  Search, Eye, Info, ExternalLink, ArrowRight, Filter, X
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
          <SheetHeader className="px-6 py-4 border-b" style={{ backgroundColor: card?.color || '#1e3a5f' }}>
            <SheetTitle className="text-white">
              <span className="text-lg font-bold">{card?.name || 'Records'}</span>
              <Badge className="ml-2 bg-white/20 text-white border-0">{total} records</Badge>
            </SheetTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..."
                className="pl-9 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/20" />
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1 bg-gray-50">
            {loading ? <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            : filtered.length === 0 ? <div className="p-12 text-center text-gray-400"><Target className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No records found</p></div>
            : <div className="p-4 space-y-2">{filtered.map((r, idx) => {
                const mainVal = r.sale_value || r.amount_total || 0;
                const name = r.name || r.invoice_number || r.summary || Object.values(r)[0];
                return (
                  <div key={idx} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer" data-testid={`drill-down-row-${idx}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                          {columns.slice(1, 6).map(c => {
                            const val = fmtV(c, r[c]);
                            if (val === '-') return null;
                            return (
                              <div key={c} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-400 uppercase tracking-wide">{fmtH(c)}</span>
                                <span className="text-xs font-medium text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded">{val}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {mainVal > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-[#800000]">OMR {mainVal.toLocaleString()}</p>
                          {r.probability && <p className="text-[10px] text-gray-400">{r.probability}% prob.</p>}
                        </div>
                      )}
                    </div>
                    {r.stage && (
                      <div className="mt-2 pt-2 border-t border-gray-50">
                        <Badge variant="outline" className="text-[10px]">{r.stage}</Badge>
                        {r.owner_name && <Badge variant="outline" className="text-[10px] ml-1">{r.owner_name}</Badge>}
                        {r.product_manager && <Badge variant="outline" className="text-[10px] ml-1">{r.product_manager}</Badge>}
                      </div>
                    )}
                  </div>
                );
              })}</div>}
          </ScrollArea>
          <div className="px-6 py-3 border-t bg-white flex items-center justify-between text-xs text-gray-500">
            <span>Showing {filtered.length} of {total}</span><span className="text-gray-400">{card?.collection}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============ KPI CARD (Read-only, Odoo-style) ============
function KpiCard({ card, data, onDrillDown, onNavigate }) {
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
function ChartCard({ card, data, onDrillDown, onNavigate }) {
  const groups = data?.groups || [];
  if (!card) return null;

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">{card.name}</h4>
        <div className="flex gap-1">
          {onNavigate && <button onClick={() => onNavigate(card)} className="p-1 rounded hover:bg-gray-100" title="Open in page"><ArrowRight className="h-3.5 w-3.5 text-gray-400" /></button>}
          {onDrillDown && <button onClick={() => onDrillDown(card)} className="p-1 rounded hover:bg-gray-100" title="Drill down"><ExternalLink className="h-3.5 w-3.5 text-gray-400" /></button>}
        </div>
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
        {card.display_type === 'area' && (() => {
          const dk = card.aggregation === 'count' ? 'count' : 'total';
          const cfg = {}; groups.slice(0, 12).forEach((g, i) => { cfg[g.label || `i${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; }); cfg[dk] = { label: card.name };
          return (
            <ChartContainer config={cfg} className="h-full w-full">
              <AreaChart accessibilityLayer data={groups.slice(0, 12)} margin={{ left: -10, bottom: 20, right: 10 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <defs><linearGradient id="fillArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#800000" stopOpacity={0.8}/><stop offset="95%" stopColor="#800000" stopOpacity={0.1}/></linearGradient></defs>
                <Area dataKey={dk} type="monotone" fill="url(#fillArea)" stroke="#800000" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>);
        })()}
        {card.display_type === 'radial' && (() => {
          const dk = card.aggregation === 'count' ? 'count' : 'total';
          const cfg = {}; const radialData = groups.slice(0, 6).map((g, i) => ({ ...g, fill: CHART_COLORS[i % CHART_COLORS.length] }));
          radialData.forEach((g, i) => { cfg[g.label || `s${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; });
          return (
            <div className="flex items-center gap-3 h-full">
              <ChartContainer config={cfg} className="h-full w-1/2">
                <RadialBarChart data={radialData} innerRadius="20%" outerRadius="90%" startAngle={180} endAngle={0}>
                  <PolarGrid gridType="circle" radialLines={false} stroke="none" polarRadius={[56, 44]} />
                  <RadialBar dataKey={dk} background cornerRadius={6} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="label" />} />
                </RadialBarChart>
              </ChartContainer>
              <div className="space-y-1 flex-1 overflow-auto">{radialData.map((g, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.fill }} /><span className="text-gray-500 truncate flex-1">{g.label || '-'}</span><span className="font-mono font-semibold text-gray-700">{(g.total || g.count || 0).toLocaleString()}</span></div>))}</div>
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
  // Global filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ salespersons: [], product_directors: [], solution_categories: [] });
  const [filters, setFilters] = useState({ salesperson: '', product_director: '', solution_category: '' });
  const navigate = useNavigate();

  const activeFilterCount = Object.values(filters).filter(v => v).length;

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams = {};
      if (filters.salesperson) filterParams.salesperson = filters.salesperson;
      if (filters.product_director) filterParams.product_director = filters.product_director;
      if (filters.solution_category) filterParams.solution_category = filters.solution_category;
      const r = await targetAPI.getMyDashboard(year, filterParams);
      setBlocks(r.data.blocks || []);
      setTemplateName(r.data.template?.name || 'Dashboard');
    } catch {} finally { setLoading(false); }
  }, [year, filters]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Load filter options once
  useEffect(() => {
    (async () => {
      try { const r = await targetAPI.getFilterOptions(); setFilterOptions(r.data); } catch {}
    })();
  }, []);

  const clearFilters = () => setFilters({ salesperson: '', product_director: '', solution_category: '' });

  // Navigate to opportunities page with filters from a card
  const handleCardNavigate = (card) => {
    if (!card) return;
    const params = new URLSearchParams();
    if (card.filters) {
      const f = typeof card.filters === 'string' ? JSON.parse(card.filters) : card.filters;
      if (f.stage === 'Won') params.set('stage', 'Won');
      else if (f.stage === 'Lost') params.set('stage', 'Lost');
      else if (f.stage?.$nin) params.set('stage_exclude', f.stage.$nin.join(','));
    }
    if (filters.salesperson) params.set('salesperson', filters.salesperson);
    if (filters.product_director) params.set('product_director', filters.product_director);

    if (card.collection === 'opportunities') navigate(`/opportunities?${params.toString()}`);
    else if (card.collection === 'invoices') navigate('/invoices');
    else if (card.collection === 'accounts') navigate('/accounts');
    else if (card.collection === 'activities') navigate('/activities');
  };

  const isKpi = (b) => ['number', 'win_rate'].includes(b.card?.display_type);
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
    <div className="space-y-4" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900" data-testid="dashboard-title">{templateName}</h1>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32 h-9 text-sm" data-testid="year-select"><Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" /><SelectValue /></SelectTrigger>
            <SelectContent>{DATE_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-[#800000] hover:bg-[#9a1919] text-white" : ""} data-testid="filter-toggle-btn">
            <Filter className="h-4 w-4 mr-1" /> Filters
            {activeFilterCount > 0 && <Badge className="ml-1.5 bg-white/20 text-white h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">{activeFilterCount}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={loadDashboard} data-testid="refresh-btn"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Global Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm" data-testid="global-filter-panel">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Global Filters</span>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-gray-500 h-7">
                <X className="h-3 w-3 mr-1" /> Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Salesperson</label>
              <Select value={filters.salesperson || '_all'} onValueChange={v => setFilters(f => ({ ...f, salesperson: v === '_all' ? '' : v }))}>
                <SelectTrigger className="h-9 text-sm" data-testid="filter-salesperson"><SelectValue placeholder="All Salespersons" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Salespersons</SelectItem>
                  {filterOptions.salespersons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Product Director</label>
              <Select value={filters.product_director || '_all'} onValueChange={v => setFilters(f => ({ ...f, product_director: v === '_all' ? '' : v }))}>
                <SelectTrigger className="h-9 text-sm" data-testid="filter-pd"><SelectValue placeholder="All Product Directors" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Product Directors</SelectItem>
                  {filterOptions.product_directors.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Solution Category</label>
              <Select value={filters.solution_category || '_all'} onValueChange={v => setFilters(f => ({ ...f, solution_category: v === '_all' ? '' : v }))}>
                <SelectTrigger className="h-9 text-sm" data-testid="filter-category"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Categories</SelectItem>
                  {filterOptions.solution_categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex gap-1.5 mt-3 pt-3 border-t">
              {filters.salesperson && <Badge className="bg-blue-50 text-blue-700 border-blue-200" variant="outline">{filters.salesperson} <button onClick={() => setFilters(f => ({...f, salesperson: ''}))} className="ml-1"><X className="h-3 w-3" /></button></Badge>}
              {filters.product_director && <Badge className="bg-purple-50 text-purple-700 border-purple-200" variant="outline">{filters.product_director} <button onClick={() => setFilters(f => ({...f, product_director: ''}))} className="ml-1"><X className="h-3 w-3" /></button></Badge>}
              {filters.solution_category && <Badge className="bg-green-50 text-green-700 border-green-200" variant="outline">{filters.solution_category} <button onClick={() => setFilters(f => ({...f, solution_category: ''}))} className="ml-1"><X className="h-3 w-3" /></button></Badge>}
            </div>
          )}
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Layers className="h-16 w-16 mx-auto mb-4 text-gray-200" />
          <h3 className="text-lg font-semibold text-gray-400">No Dashboard Configured</h3>
          <p className="text-sm text-gray-300 mt-1">Ask your admin to configure a dashboard in the Dashboard Builder</p>
        </div>
      ) : (
        <>
          {/* KPI Cards Row */}
          {kpiBlocks.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {kpiBlocks.map(b => <KpiCard key={b.card_id} card={b.card} data={b.data}
                onDrillDown={c => setDrillDown({ open: true, card: c })}
                onNavigate={handleCardNavigate} />)}
            </div>
          )}

          {/* Chart Cards */}
          {chartBlocks.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {chartBlocks.map(b => (
                <div key={b.card_id} className="min-h-[280px]">
                  <ChartCard card={b.card} data={b.data}
                    onDrillDown={c => setDrillDown({ open: true, card: c })}
                    onNavigate={handleCardNavigate} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <DrillDownPanel open={drillDown.open} onClose={() => setDrillDown({ open: false, card: null })} card={drillDown.card} year={year} onNavigate={handleCardNavigate} />
    </div>
  );
}
