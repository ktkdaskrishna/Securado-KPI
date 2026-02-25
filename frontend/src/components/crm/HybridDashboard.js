import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { targetAPI, analyticsAPI } from '../../lib/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import { PageFilters, YearFilter, QuarterFilter, SalesRepFilter, AccountFilter, StageFilter, ProductDirectorFilter, SolutionCategoryFilter } from '../layout/PageFilters';
import {
  Target, TrendingUp, DollarSign, Trophy, AlertTriangle, Building2,
  Users, BarChart2, Activity, RefreshCw, Layers,
  Search, ExternalLink, ArrowRight, X, Play, Pause, Download
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

// ============ DRILL-DOWN PANEL ============
function DrillDownPanel({ open, onClose, card, year, onNavigate }) {
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
            <span>Showing {filtered.length} of {total}</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{card?.collection}</span>
              {onNavigate && <Button variant="outline" size="sm" onClick={() => { onNavigate(card); onClose(); }} className="h-7 text-xs"><ArrowRight className="h-3 w-3 mr-1" /> View All in Page</Button>}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============ KPI CARD (Read-only, Odoo-style with comparison) ============
function KpiCard({ card, data, prevPeriod, onDrillDown, onNavigate }) {
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

  const changePct = prevPeriod?.change_pct;
  const hasChange = changePct !== undefined && changePct !== null && changePct !== 0;

  return (
    <div className="h-full rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:brightness-110 group"
      style={{ backgroundColor: bg }} onClick={() => onNavigate?.(card)} data-testid={`kpi-card-${card.id}`}>
      <div className="p-4 flex flex-col h-full justify-center items-center text-center relative">
        <div className="mb-2 p-2 rounded-lg" style={{ backgroundColor: ci.iconBg }}><Icon className="h-5 w-5" style={{ color: ci.muted }} /></div>
        <p className="text-3xl font-black text-white tracking-tight leading-none">{displayValue()}</p>
        <p className="text-xs font-medium mt-1.5 uppercase tracking-wider text-white/80">{card.name}</p>
        {/* Previous period comparison */}
        {hasChange && (
          <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-semibold ${changePct > 0 ? 'text-green-300' : 'text-red-300'}`} data-testid={`kpi-change-${card.id}`}>
            {changePct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
            <span>{changePct > 0 ? '+' : ''}{changePct}%</span>
            <span className="text-white/40 font-normal">vs {prevPeriod?.year}</span>
          </div>
        )}
        {!hasChange && data?.count > 0 && card.display_type !== 'win_rate' && <p className="text-[10px] mt-1 text-white/40">{data.count} records</p>}
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
          <div className="px-3 space-y-1 overflow-auto h-full">{groups.slice(0, 10).map((g, idx) => (
            <div key={idx} className="flex items-center gap-2.5 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors">
              <span className="text-xs font-bold text-gray-400 w-5 text-center shrink-0">{idx + 1}</span>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                {(g.label || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
              <span className="flex-1 text-xs font-medium text-gray-700 truncate min-w-0">{g.label || '-'}</span>
              <span className="text-xs font-bold text-[#800000] whitespace-nowrap shrink-0 tabular-nums">OMR {(g.total || 0).toLocaleString()}</span>
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
  const [drillDown, setDrillDown] = useState({ open: false, card: null });
  // Standard filters (same as Opportunities page)
  const [filterOptions, setFilterOptions] = useState({ years: [], salesReps: [], accounts: [], stages: [], productDirectors: [], solutionCategories: [] });
  const [filters, setFilters] = useState({ year: String(new Date().getFullYear()), quarter: null, salesRep: null, stage: null, productDirector: null, solutionCategory: null });
  // Slideshow mode
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowTemplates, setSlideshowTemplates] = useState([]);
  const [slideshowIdx, setSlideshowIdx] = useState(0);
  const navigate = useNavigate();

  const updateFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const resetFilters = () => setFilters({ year: String(new Date().getFullYear()), quarter: null, salesRep: null, stage: null, productDirector: null, solutionCategory: null });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams = {};
      if (filters.salesRep) filterParams.salesperson = filters.salesRep;
      if (filters.productDirector) filterParams.product_director = filters.productDirector;
      if (filters.solutionCategory) filterParams.solution_category = filters.solutionCategory;
      const r = await targetAPI.getMyDashboard(filters.year || String(new Date().getFullYear()), filterParams);
      setBlocks(r.data.blocks || []);
      setTemplateName(r.data.template?.name || 'Dashboard');
    } catch {} finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Load filter options (same API as Opportunities page for consistency)
  useEffect(() => {
    (async () => {
      try {
        const [fRes, pmRes, catRes] = await Promise.allSettled([
          analyticsAPI.getFilters(),
          targetAPI.getProductManagers(),
          targetAPI.getSolutionCategories(),
        ]);
        const fData = fRes.status === 'fulfilled' ? fRes.value.data : {};
        const pms = pmRes.status === 'fulfilled' ? pmRes.value.data : [];
        const cats = catRes.status === 'fulfilled' ? catRes.value.data : [];
        setFilterOptions({
          years: fData.years || [],
          salesReps: fData.sales_reps || fData.salesReps || [],
          accounts: (fData.accounts || []).map(a => typeof a === 'object' ? a.name : a).filter(Boolean),
          stages: fData.stages || [],
          productDirectors: pms.map(p => p.name),
          solutionCategories: cats.map(c => c.name),
        });
      } catch {}
    })();
  }, []);

  // Slideshow auto-rotate between templates
  useEffect(() => {
    if (!slideshowActive || slideshowTemplates.length < 2) return;
    const interval = setInterval(async () => {
      const nextIdx = (slideshowIdx + 1) % slideshowTemplates.length;
      setSlideshowIdx(nextIdx);
      const tpl = slideshowTemplates[nextIdx];
      try {
        const r = await targetAPI.renderTemplate(tpl.id, filters.year);
        const t = r.data.template;
        const cards = r.data.cards || [];
        const tb = t.blocks || [];
        const enriched = tb.length > 0
          ? tb.map(b => { const m = cards.find(c => c.card_id === b.card_id); return { ...b, card: m?.card, data: m?.data }; })
          : cards.map((c, i) => ({ i: c.card_id, x: (i % 6) * 2, y: Math.floor(i / 6), w: 2, h: 1, type: 'query_card', card_id: c.card_id, card: c.card, data: c.data }));
        setBlocks(enriched);
        setTemplateName(t.name);
      } catch {}
    }, 10000); // 10 seconds per template
    return () => clearInterval(interval);
  }, [slideshowActive, slideshowIdx, slideshowTemplates, filters.year]);


  const handleCardNavigate = (card) => {
    if (!card) return;
    const params = new URLSearchParams();
    // Pass year filter
    if (filters.year) params.set('year', filters.year);
    // Pass card-specific stage filters
    if (card.filters) {
      const f = typeof card.filters === 'string' ? JSON.parse(card.filters) : card.filters;
      if (f.stage === 'Won') params.set('stage', 'Won');
      else if (f.stage === 'Lost') params.set('stage', 'Lost');
      else if (f.stage?.$nin) params.set('stage_exclude', f.stage.$nin.join(','));
    }
    // Pass global filters
    if (filters.salesRep) params.set('salesRep', filters.salesRep);
    if (filters.productDirector) params.set('productDirector', filters.productDirector);
    if (filters.solutionCategory) params.set('solutionCategory', filters.solutionCategory);

    if (card.collection === 'opportunities') navigate(`/opportunities?${params.toString()}`);
    else if (card.collection === 'invoices') navigate('/invoices');
    else if (card.collection === 'accounts') navigate('/accounts');
    else if (card.collection === 'activities') navigate('/activities');
  };

  const isKpi = (b) => ['number', 'win_rate'].includes(b.card?.display_type);
  const kpiBlocks = blocks.filter(b => isKpi(b));
  const chartBlocks = blocks.filter(b => !isKpi(b));

  const handleExportPDF = async () => {
    const el = document.querySelector('[data-testid="dashboard-page"]');
    if (!el) return;
    toast.info('Generating PDF...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`${templateName.replace(/\s+/g, '_')}_${year}.pdf`);
      toast.success('PDF downloaded');
    } catch (e) { toast.error('PDF export failed'); console.error(e); }
  };

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
        <div>
          <h1 className="text-xl font-bold text-gray-900" data-testid="dashboard-title">{templateName}</h1>
          {blocks.length > 0 && <p className="text-sm text-muted-foreground">Showing filtered data ({blocks.filter(b => ['number','win_rate'].includes(b.card?.display_type)).length} KPIs, {blocks.filter(b => !['number','win_rate'].includes(b.card?.display_type)).length} charts)</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDashboard} data-testid="refresh-btn"><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          <Button variant={slideshowActive ? "default" : "outline"} size="sm" data-testid="slideshow-btn"
            className={slideshowActive ? "bg-[#800000] hover:bg-[#9a1919] text-white" : ""}
            onClick={async () => {
              if (slideshowActive) { setSlideshowActive(false); return; }
              try { const r = await targetAPI.listTemplates(); setSlideshowTemplates(r.data); setSlideshowIdx(0); setSlideshowActive(true); } catch {}
            }}>
            {slideshowActive ? <><Pause className="h-4 w-4 mr-1" /> Stop</> : <><Play className="h-4 w-4 mr-1" /> Slideshow</>}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="export-pdf-btn">
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Standard Inline Filter Bar (same as Opportunities page) */}
      <PageFilters
        title="Dashboard Filters"
        onReset={resetFilters}
        activeFilters={[filters.year, filters.quarter, filters.salesRep, filters.stage, filters.productDirector, filters.solutionCategory]}
      >
        <YearFilter value={filters.year} onChange={v => updateFilter('year', v)} years={filterOptions.years} />
        <QuarterFilter value={filters.quarter} onChange={v => updateFilter('quarter', v)} />
        <SalesRepFilter value={filters.salesRep} onChange={v => updateFilter('salesRep', v)} salesReps={filterOptions.salesReps} />
        <StageFilter value={filters.stage} onChange={v => updateFilter('stage', v)} stages={filterOptions.stages} />
        <ProductDirectorFilter value={filters.productDirector} onChange={v => updateFilter('productDirector', v)} productDirectors={filterOptions.productDirectors} />
        <SolutionCategoryFilter value={filters.solutionCategory} onChange={v => updateFilter('solutionCategory', v)} categories={filterOptions.solutionCategories} />
      </PageFilters>

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
            <div className={`grid gap-3 ${kpiBlocks.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : kpiBlocks.length <= 6 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'}`}>
              {kpiBlocks.map(b => <KpiCard key={b.card_id} card={b.card} data={b.data}
                prevPeriod={b.prev_period}
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

      <DrillDownPanel open={drillDown.open} onClose={() => setDrillDown({ open: false, card: null })} card={drillDown.card} year={filters.year} onNavigate={handleCardNavigate} />
    </div>
  );
}
