import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { targetAPI } from '../../lib/api';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import EditChartDialog from './EditChartDialog';
import {
  Target, TrendingUp, DollarSign, Trophy, AlertTriangle, Building2,
  Users, BarChart2, Pencil, RefreshCw, Layers, Activity, Save,
  Settings, Plus, Trash2, GripVertical, Lock, Unlock,
  LayoutGrid, ChevronRight, X, ExternalLink, Calendar,
  Eye, Info, Copy, PanelLeft
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, RadialBarChart, RadialBar, PolarGrid } from 'recharts';
import { toast } from 'sonner';

const ICONS = { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, Building2, Users, BarChart2, Activity };
const CHART_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const CARD_COLORS_INFO = {
  '#1e3a5f': { muted: '#8bb4e0', iconBg: 'rgba(255,255,255,0.12)' },
  '#8b1a1a': { muted: '#e8a0a0', iconBg: 'rgba(255,255,255,0.12)' },
  '#1a6b4a': { muted: '#8fd4b4', iconBg: 'rgba(255,255,255,0.12)' },
  '#b45309': { muted: '#fbbf6e', iconBg: 'rgba(255,255,255,0.12)' },
  '#5b21b6': { muted: '#c4a8ec', iconBg: 'rgba(255,255,255,0.12)' },
  '#800000': { muted: '#d4a0a0', iconBg: 'rgba(255,255,255,0.12)' },
};
const getCI = c => CARD_COLORS_INFO[c] || { muted: 'rgba(255,255,255,0.7)', iconBg: 'rgba(255,255,255,0.12)' };

// ============ KPI PREVIEW CARD (with hover controls) ============
function BuilderKpiCard({ card, data, onEdit, onRemove, onClone }) {
  const Icon = ICONS[card?.icon] || Target;
  const groups = data?.groups || [];
  const bg = card?.color || '#1e3a5f';
  const ci = getCI(bg);
  const [hovered, setHovered] = useState(false);

  const displayValue = () => {
    if (card?.display_type === 'win_rate') {
      const won = groups.find(g => g.label === 'Won')?.count || 0;
      const lost = groups.find(g => g.label === 'Lost')?.count || 0;
      return ((won / Math.max(won + lost, 1)) * 100).toFixed(0) + '%';
    }
    const val = data?.value || 0;
    if (card?.aggregation === 'sum' || card?.aggregation === 'avg') {
      if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
      if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K';
      return val.toLocaleString();
    }
    return val.toLocaleString();
  };

  return (
    <div className="h-full rounded-lg overflow-hidden relative group" style={{ backgroundColor: bg }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-end gap-0.5 px-2 py-1.5 bg-black/20 backdrop-blur-sm">
          <button onMouseDown={e => e.stopPropagation()} className="p-1 rounded hover:bg-white/20"><GripVertical className="h-3.5 w-3.5 text-white/80" /></button>
          {onEdit && <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(card); }} className="p-1 rounded hover:bg-white/20" title="Edit"><Pencil className="h-3.5 w-3.5 text-white/80" /></button>}
          {onClone && <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onClone(card); }} className="p-1 rounded hover:bg-white/20" title="Clone"><Copy className="h-3.5 w-3.5 text-white/80" /></button>}
          <button onMouseDown={e => e.stopPropagation()} className="p-1 rounded hover:bg-white/20" title="Info"><Info className="h-3.5 w-3.5 text-white/80" /></button>
          {onRemove && <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-red-500/40" title="Remove"><X className="h-3.5 w-3.5 text-white/80" /></button>}
        </div>
      )}
      <div className="p-4 flex flex-col h-full justify-center items-center text-center">
        <div className="mb-2 p-2 rounded-lg" style={{ backgroundColor: ci.iconBg }}><Icon className="h-5 w-5" style={{ color: ci.muted }} /></div>
        <p className="text-3xl font-black text-white tracking-tight leading-none">{displayValue()}</p>
        <p className="text-xs font-medium mt-2 uppercase tracking-wider text-white/80">{card?.name}</p>
      </div>
    </div>
  );
}

// ============ CHART PREVIEW CARD (with hover controls) ============
function BuilderChartCard({ card, data, onEdit, onRemove, onClone }) {
  const groups = data?.groups || [];
  const [hovered, setHovered] = useState(false);
  if (!card) return null;

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden relative"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-1.5 bg-white/90 backdrop-blur-sm border-b">
          <span className="text-xs font-semibold text-gray-700 truncate">{card.name}</span>
          <div className="flex gap-0.5">
            <button onMouseDown={e => e.stopPropagation()} className="p-1 rounded hover:bg-gray-100"><GripVertical className="h-3.5 w-3.5 text-gray-400" /></button>
            {onEdit && <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(card); }} className="p-1 rounded hover:bg-gray-100"><Pencil className="h-3.5 w-3.5 text-gray-400" /></button>}
            {onClone && <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onClone(card); }} className="p-1 rounded hover:bg-gray-100" title="Clone"><Copy className="h-3.5 w-3.5 text-gray-400" /></button>}
            {onRemove && <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-red-50"><X className="h-3.5 w-3.5 text-red-400" /></button>}
          </div>
        </div>
      )}
      <div className="px-4 pt-3 pb-1"><h4 className="text-sm font-semibold text-gray-800">{card.name}</h4></div>
      <div className="flex-1 min-h-0 px-2 pb-2">
        {card.display_type === 'chart' && (() => {
          const dk = card.aggregation === 'count' ? 'count' : 'total';
          const cfg = {}; groups.slice(0, 12).forEach((g, i) => { cfg[g.label || `i${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; }); cfg[dk] = { label: card.name };
          return (<ChartContainer config={cfg} className="h-full w-full"><BarChart accessibilityLayer data={groups.slice(0, 12)} margin={{ left: -10, bottom: 20, right: 10 }}>
            <CartesianGrid vertical={false} /><XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} /><Bar dataKey={dk} radius={[6, 6, 0, 0]}>{groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
          </BarChart></ChartContainer>);
        })()}
        {card.display_type === 'pie' && (() => {
          const dk = card.aggregation === 'count' ? 'count' : 'total'; const cfg = {}; groups.slice(0, 8).forEach((g, i) => { cfg[g.label || `s${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; });
          return (<div className="flex items-center gap-3 h-full"><ChartContainer config={cfg} className="h-full w-1/2"><PieChart><ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie data={groups.slice(0, 8)} dataKey={dk} nameKey="label" cx="50%" cy="50%" innerRadius="30%" outerRadius="65%" paddingAngle={2}>{groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie></PieChart></ChartContainer>
            <div className="space-y-1 flex-1 overflow-auto">{groups.slice(0, 6).map((g, i) => (<div key={i} className="flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-gray-500 truncate flex-1">{g.label || '-'}</span><span className="font-mono font-semibold text-gray-700">{(g.total || g.count || 0).toLocaleString()}</span></div>))}</div></div>);
        })()}
        {card.display_type === 'area' && (() => {
          const dk = card.aggregation === 'count' ? 'count' : 'total';
          const cfg = {}; groups.slice(0, 12).forEach((g, i) => { cfg[g.label || `i${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; }); cfg[dk] = { label: card.name };
          return (<ChartContainer config={cfg} className="h-full w-full"><AreaChart accessibilityLayer data={groups.slice(0, 12)} margin={{ left: -10, bottom: 20, right: 10 }}>
            <CartesianGrid vertical={false} /><XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <defs><linearGradient id="bFillArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#800000" stopOpacity={0.8}/><stop offset="95%" stopColor="#800000" stopOpacity={0.1}/></linearGradient></defs>
            <Area dataKey={dk} type="monotone" fill="url(#bFillArea)" stroke="#800000" strokeWidth={2} />
          </AreaChart></ChartContainer>);
        })()}
        {card.display_type === 'radial' && (() => {
          const dk = card.aggregation === 'count' ? 'count' : 'total'; const cfg = {};
          const rd = groups.slice(0, 6).map((g, i) => ({ ...g, fill: CHART_COLORS[i % CHART_COLORS.length] }));
          rd.forEach((g, i) => { cfg[g.label || `s${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; });
          return (<div className="flex items-center gap-3 h-full"><ChartContainer config={cfg} className="h-full w-1/2">
            <RadialBarChart data={rd} innerRadius="20%" outerRadius="90%" startAngle={180} endAngle={0}>
              <PolarGrid gridType="circle" radialLines={false} stroke="none" /><RadialBar dataKey={dk} background cornerRadius={6} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="label" />} />
            </RadialBarChart></ChartContainer>
            <div className="space-y-1 flex-1 overflow-auto">{rd.map((g, i) => (<div key={i} className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.fill }} /><span className="text-gray-500 truncate flex-1">{g.label || '-'}</span><span className="font-mono font-semibold text-gray-700">{(g.total || g.count || 0).toLocaleString()}</span></div>))}</div></div>);
        })()}
        {card.display_type === 'leaderboard' && (<div className="px-2 space-y-1.5 overflow-auto h-full">{groups.slice(0, 10).map((g, idx) => (
          <div key={idx} className="flex items-center gap-2 hover:bg-gray-50 rounded px-2 py-1"><span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>{(g.label || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
            <span className="flex-1 text-xs font-medium text-gray-700 truncate">{g.label || '-'}</span><span className="text-xs font-bold text-[#800000]">OMR {(g.total || 0).toLocaleString()}</span></div>))}</div>)}
        {card.display_type === 'progress' && (<div className="px-2 space-y-2 overflow-auto h-full">{(() => { const mx = Math.max(...groups.map(g => g.total || g.count || 0), 1); return groups.slice(0, 8).map((g, i) => (<div key={i}><div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600 truncate flex-1">{g.label || '-'}</span><span className="font-semibold text-gray-900 ml-2">OMR {(g.total || 0).toLocaleString()}</span></div><div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${((g.total || g.count || 0) / mx) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} /></div></div>)); })()}</div>)}
      </div>
    </div>
  );
}

// ============ MAIN DASHBOARD BUILDER ============
export default function ConfigurableDashboard() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [roles, setRoles] = useState([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [hasChanges, setHasChanges] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [tab, setTab] = useState('layout');
  // Template edit form
  const [tplForm, setTplForm] = useState({ name: '', description: '', assigned_roles: [], is_default: false });
  const [newTplName, setNewTplName] = useState('');
  const { width: containerWidth, containerRef } = useContainerWidth({ initialWidth: 1200 });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes, rRes] = await Promise.all([targetAPI.listTemplates(), targetAPI.listCards(), targetAPI.getAvailableRoles()]);
      setTemplates(tRes.data);
      setAllCards(cRes.data);
      setRoles(Array.isArray(rRes.data) ? rRes.data : []);
      // Load first template if none active
      if (tRes.data.length > 0 && !activeTemplate) {
        const first = tRes.data.find(t => t.is_default) || tRes.data[0];
        await loadTemplate(first.id);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadTemplate = async (tplId) => {
    try {
      const res = await targetAPI.renderTemplate(tplId, year);
      const tpl = res.data.template;
      const cards = res.data.cards || [];
      const tplBlocks = tpl.blocks || [];
      let enriched;
      if (tplBlocks.length > 0) {
        enriched = tplBlocks.map(b => { const m = cards.find(c => c.card_id === b.card_id); return { ...b, card: m?.card, data: m?.data }; });
      } else {
        let col = 0, row = 0;
        enriched = cards.map(c => { const ic = ['chart','pie','leaderboard','progress'].includes(c.card?.display_type); const w = ic ? 6 : 2; const h = ic ? 3 : 1; if (col+w>12){col=0;row+=3;} const b = {i:c.card_id,x:col,y:row,w,h,type:'query_card',card_id:c.card_id,card:c.card,data:c.data}; col+=w; if(col>=12){col=0;row+=h;} return b; });
      }
      setBlocks(enriched);
      setActiveTemplate(tpl);
      setTplForm({ name: tpl.name || '', description: tpl.description || '', assigned_roles: tpl.assigned_roles || [], is_default: tpl.is_default || false });
      setHasChanges(false);
    } catch { toast.error('Failed to load template'); }
  };

  const layout = blocks.map(b => ({ i: b.i || b.card_id, x: b.x ?? 0, y: b.y ?? 0, w: b.w ?? 2, h: b.h ?? 1, minW: 2, minH: 1, maxW: 12 }));
  const onLayoutChange = (nl) => { setBlocks(prev => prev.map(block => { const item = nl.find(l => l.i === (block.i || block.card_id)); if (!item) return block; return { ...block, i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }; })); setHasChanges(true); };

  const handleSaveLayout = async () => {
    if (!activeTemplate) return;
    try {
      const lb = blocks.map(b => ({ i: b.i || b.card_id, x: b.x, y: b.y, w: b.w, h: b.h, type: 'query_card', card_id: b.card_id }));
      await targetAPI.saveTemplateLayout(activeTemplate.id, lb);
      toast.success('Layout saved');
      setHasChanges(false);
    } catch { toast.error('Failed'); }
  };

  const handleSaveTemplateSettings = async () => {
    if (!activeTemplate) return;
    try { await targetAPI.updateTemplate(activeTemplate.id, tplForm); toast.success('Template settings saved'); loadAll(); } catch {}
  };

  const handleCreateTemplate = async () => {
    if (!newTplName.trim()) return;
    try { await targetAPI.createTemplate({ name: newTplName, cards: [], assigned_roles: [], is_default: false }); toast.success('Created'); setNewTplName(''); loadAll(); } catch {}
  };

  const handleDeleteTemplate = async (id) => {
    try { await targetAPI.deleteTemplate(id); toast.success('Deleted'); if (activeTemplate?.id === id) { setActiveTemplate(null); setBlocks([]); } loadAll(); } catch {}
  };

  const handleRemoveCard = (blockI) => { setBlocks(prev => prev.filter(b => (b.i || b.card_id) !== blockI)); setHasChanges(true); toast.success('Card removed'); };

  const handleAddCard = (card) => {
    const maxY = blocks.reduce((max, b) => Math.max(max, (b.y || 0) + (b.h || 1)), 0);
    const isChart = ['chart','pie','leaderboard','progress'].includes(card.display_type);
    setBlocks(prev => [...prev, { i: card.id, x: 0, y: maxY, w: isChart ? 6 : 2, h: isChart ? 3 : 1, type: 'query_card', card_id: card.id, card, data: null }]);
    setHasChanges(true);
    setShowAddCard(false);
    targetAPI.executeCard(card.id, year).then(r => { setBlocks(prev => prev.map(b => b.card_id === card.id ? { ...b, data: r.data } : b)); }).catch(() => {});
  };

  const handleEditCard = (card) => { setEditCard({ ...card, filters: typeof card.filters === 'string' ? card.filters : JSON.stringify(card.filters || {}, null, 2) }); setShowEditor(true); };
  const handleSaveCard = async (fd) => {
    try {
      if (editCard?.id) { await targetAPI.updateCard(editCard.id, fd); toast.success('Card updated'); }
      else { const res = await targetAPI.createCard(fd); toast.success('Card created'); if (activeTemplate) handleAddCard(res.data); }
      setShowEditor(false); setEditCard(null);
      if (activeTemplate) loadTemplate(activeTemplate.id);
      const cRes = await targetAPI.listCards(); setAllCards(cRes.data);
    } catch { toast.error('Failed'); }
  };

  const handleDeleteCard = async (id) => { try { await targetAPI.deleteCard(id); toast.success('Deleted'); const cRes = await targetAPI.listCards(); setAllCards(cRes.data); } catch {} };

  const handleCloneCard = async (card) => {
    try {
      const cloneData = {
        name: `${card.name} (Copy)`,
        collection: card.collection, aggregation: card.aggregation, field: card.field,
        filters: card.filters, group_by: card.group_by, display_type: card.display_type,
        color: card.color, icon: card.icon, size: card.size, year_filter: card.year_filter,
        date_filter_field: card.date_filter_field, sort_by: card.sort_by, sort_order: card.sort_order,
        cache_ttl: card.cache_ttl, description: card.description,
      };
      const res = await targetAPI.createCard(cloneData);
      toast.success(`Cloned: ${cloneData.name}`);
      const cRes = await targetAPI.listCards(); setAllCards(cRes.data);
      if (activeTemplate) handleAddCard(res.data);
    } catch { toast.error('Clone failed'); }
  };

  const isKpi = (b) => ['number', 'win_rate'].includes(b.card?.display_type);
  const existingIds = blocks.map(b => b.card_id).filter(Boolean);

  const toggleRole = (rid) => setTplForm(f => ({ ...f, assigned_roles: f.assigned_roles.includes(rid) ? f.assigned_roles.filter(r => r !== rid) : [...f.assigned_roles, rid] }));

  if (loading) return (
    <div className="space-y-5"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-4 gap-4">{[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}</div></div>
  );

  return (
    <div className="space-y-4" ref={containerRef} data-testid="dashboard-builder-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2" data-testid="builder-title">
            <LayoutGrid className="h-5 w-5 text-[#800000]" /> Dashboard Builder
          </h1>
          <p className="text-sm text-gray-500">{activeTemplate ? `Editing: ${activeTemplate.name}` : 'Select or create a template'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28 h-9 text-sm"><Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" /><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setEditCard({}); setShowEditor(true); }} data-testid="create-chart-btn">
            <Plus className="h-4 w-4 mr-1" /> Create New Chart
          </Button>
          {activeTemplate && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowAddCard(true)} data-testid="add-card-btn"><Plus className="h-4 w-4 mr-1" /> Add to Layout</Button>
              {hasChanges && <Button size="sm" onClick={handleSaveLayout} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="save-layout-btn"><Save className="h-4 w-4 mr-1" /> Save Layout</Button>}
              {hasChanges && <Button variant="outline" size="sm" onClick={() => loadTemplate(activeTemplate.id)}>Discard</Button>}
            </>
          )}
        </div>
      </div>

      {/* Main Tabs: Layout / Templates / All Cards */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-gray-100 border">
          <TabsTrigger value="layout"><PanelLeft className="h-4 w-4 mr-1" /> Layout Editor</TabsTrigger>
          <TabsTrigger value="templates"><LayoutGrid className="h-4 w-4 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="cards"><Settings className="h-4 w-4 mr-1" /> All Cards</TabsTrigger>
        </TabsList>

        {/* LAYOUT TAB */}
        <TabsContent value="layout" className="mt-4">
          {!activeTemplate ? (
            <Card className="border-dashed border-2"><CardContent className="p-12 text-center">
              <Layers className="h-16 w-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400">No Template Selected</h3>
              <p className="text-sm text-gray-300 mt-1 mb-4">Go to the Templates tab to select or create a template</p>
              <Button variant="outline" onClick={() => setTab('templates')}>Go to Templates</Button>
            </CardContent></Card>
          ) : blocks.length === 0 ? (
            <Card className="border-dashed border-2"><CardContent className="p-12 text-center">
              <Layers className="h-16 w-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400">Empty Layout</h3>
              <p className="text-sm text-gray-300 mt-1 mb-4">Add cards to this template or seed defaults</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setShowAddCard(true)}><Plus className="h-4 w-4 mr-1" /> Add Card</Button>
                <Button onClick={async () => { try { await targetAPI.seedDefaultCards(); toast.success('Default cards created'); loadAll(); } catch {} }} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Layers className="h-4 w-4 mr-1" /> Seed Default Cards</Button>
                <Button variant="outline" onClick={async () => { try { const r = await targetAPI.seedRoleTemplates(); toast.success(`${r.data.templates_created} templates created`); loadAll(); } catch {} }}><LayoutGrid className="h-4 w-4 mr-1" /> Create All Role Templates</Button>
              </div>
            </CardContent></Card>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2 text-amber-700 text-sm mb-3">
                <GripVertical className="h-4 w-4" />
                <span className="font-medium">Drag to reorder, resize from edges, hover for controls</span>
                {hasChanges && <Badge className="bg-amber-100 text-amber-700 ml-auto">Unsaved</Badge>}
              </div>
              <ResponsiveGridLayout
                className="layout dashboard-editing"
                layouts={{ lg: layout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768 }}
                cols={{ lg: 12, md: 8, sm: 4 }}
                rowHeight={85}
                width={containerWidth || 1200}
                isDraggable={true}
                isResizable={true}
                onLayoutChange={onLayoutChange}
                compactor={verticalCompactor}
                margin={[12, 12]}
              >
                {blocks.map(block => (
                  <div key={block.i || block.card_id} data-testid={`builder-block-${block.card_id}`}>
                    {isKpi(block) ? (
                      <BuilderKpiCard card={block.card} data={block.data} onEdit={handleEditCard} onRemove={() => handleRemoveCard(block.i || block.card_id)} />
                    ) : (
                      <BuilderChartCard card={block.card} data={block.data} onEdit={handleEditCard} onRemove={() => handleRemoveCard(block.i || block.card_id)} />
                    )}
                  </div>
                ))}
              </ResponsiveGridLayout>
            </>
          )}
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template List */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex gap-2">
                <Input value={newTplName} onChange={e => setNewTplName(e.target.value)} placeholder="New template..." className="flex-1" data-testid="new-template-name" />
                <Button onClick={handleCreateTemplate} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="create-template-btn"><Plus className="h-4 w-4" /></Button>
              </div>
              {templates.length === 0 && (
                <Button variant="outline" className="w-full" onClick={async () => { try { const r = await targetAPI.seedRoleTemplates(); toast.success(`${r.data.templates_created} templates created`); loadAll(); } catch {} }}>
                  <LayoutGrid className="h-4 w-4 mr-1" /> Auto-Create Role Templates
                </Button>
              )}
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} onClick={() => loadTemplate(t.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${activeTemplate?.id === t.id ? 'border-[#800000] bg-[#800000]/5' : 'border-gray-200 hover:border-gray-300'}`}
                    data-testid={`template-item-${t.id}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-gray-900">{t.name}</span>
                          {t.is_default && <Badge className="bg-[#800000]/10 text-[#800000] text-[9px]">Default</Badge>}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">{(t.assigned_roles || []).join(', ') || 'No roles'} · {(t.blocks || t.cards || []).length} cards</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleDeleteTemplate(t.id); }}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Template Settings */}
            <div className="lg:col-span-2">
              {activeTemplate ? (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-semibold text-gray-900">Template Settings: {activeTemplate.name}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="text-xs text-gray-500">Name</Label><Input value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} /></div>
                      <div><Label className="text-xs text-gray-500">Description</Label><Input value={tplForm.description} onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))} /></div>
                    </div>
                    <div className="flex items-center gap-3"><Switch checked={tplForm.is_default} onCheckedChange={v => setTplForm(f => ({ ...f, is_default: v }))} /><Label className="text-sm">Default template (fallback)</Label></div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-2 block">Assign to Roles</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {roles.map(role => { const rid = role.id || role.name; const rn = role.name || role.id; return (
                          <div key={rid} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 cursor-pointer" onClick={() => toggleRole(rid)} data-testid={`builder-role-${rid}`}>
                            <Checkbox checked={tplForm.assigned_roles.includes(rid)} /><span className="text-sm">{rn}</span>
                          </div>); })}
                      </div>
                    </div>
                    <Button onClick={handleSaveTemplateSettings} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Save className="h-4 w-4 mr-1" /> Save Settings</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-20 text-gray-400"><LayoutGrid className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>Select a template to edit</p></div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ALL CARDS TAB - Visual previews */}
        <TabsContent value="cards" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{allCards.length} cards available</p>
            <Button onClick={() => { setEditCard({}); setShowEditor(true); }} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="new-card-btn"><Plus className="h-4 w-4 mr-1" /> Create New Chart</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {allCards.map(card => {
              const isKpiType = ['number', 'win_rate'].includes(card.display_type);
              const Icon = ICONS[card.icon] || Target;
              return (
                <Card key={card.id} className="overflow-hidden hover:shadow-lg transition-all group cursor-pointer" data-testid={`card-item-${card.id}`}
                  onClick={() => handleEditCard(card)}>
                  {isKpiType ? (
                    /* KPI card visual preview */
                    <div className="h-24 flex flex-col items-center justify-center text-center relative" style={{ backgroundColor: card.color || '#1e3a5f' }}>
                      <Icon className="h-4 w-4 text-white/40 mb-1" />
                      <p className="text-lg font-black text-white">{card.display_type === 'win_rate' ? '%' : '#'}</p>
                      <p className="text-[9px] text-white/70 uppercase tracking-wider px-2 truncate w-full">{card.name}</p>
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); handleDeleteCard(card.id); }}
                          className="p-0.5 rounded bg-black/20 hover:bg-red-500/40"><Trash2 className="h-3 w-3 text-white/80" /></button>
                      </div>
                    </div>
                  ) : (
                    /* Chart card visual preview */
                    <div className="h-24 flex flex-col items-center justify-center bg-gray-50 relative border-b">
                      <div className="flex gap-0.5 items-end h-10">
                        {[40, 65, 30, 80, 50, 45].map((h, i) => (
                          <div key={i} className="w-3 rounded-t" style={{ height: `${h}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length], opacity: 0.7 }} />
                        ))}
                      </div>
                      <p className="text-[9px] text-gray-500 mt-1.5 uppercase tracking-wider px-2 truncate w-full text-center">{card.name}</p>
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); handleDeleteCard(card.id); }}
                          className="p-0.5 rounded bg-white/80 hover:bg-red-50"><Trash2 className="h-3 w-3 text-red-400" /></button>
                      </div>
                    </div>
                  )}
                  <CardContent className="p-2">
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[9px] h-4">{card.display_type}</Badge>
                      <Badge variant="outline" className="text-[9px] h-4">{card.collection}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Card Dialog */}
      <Dialog open={showAddCard} onOpenChange={() => setShowAddCard(false)}>
        <DialogContent className="max-w-lg" data-testid="add-card-dialog">
          <DialogHeader><DialogTitle>Add Card to Layout</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">{allCards.filter(c => !existingIds.includes(c.id)).map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:border-[#800000]/30 hover:bg-gray-50 cursor-pointer" onClick={() => handleAddCard(c)} data-testid={`add-card-${c.id}`}>
                <div><span className="text-sm font-medium text-gray-900">{c.name}</span><p className="text-xs text-gray-400">{c.display_type} · {c.collection}</p></div>
                <Plus className="h-4 w-4 text-[#800000]" />
              </div>))}</div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Chart Dialog (Odoo-style) */}
      <EditChartDialog open={showEditor} onClose={() => { setShowEditor(false); setEditCard(null); }} card={editCard} onSave={handleSaveCard} />
    </div>
  );
}

export { ConfigurableDashboard };
