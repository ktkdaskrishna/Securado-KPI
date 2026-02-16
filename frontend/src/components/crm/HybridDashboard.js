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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import EditChartDialog from './EditChartDialog';
import { useRBAC } from '../../lib/RBACContext';
import {
  Target, TrendingUp, DollarSign, Trophy, AlertTriangle, Building2,
  Users, BarChart2, Pencil, RefreshCw, Layers, Activity, Save,
  Settings, Plus, Trash2, GripVertical, Lock, Unlock,
  LayoutGrid, ChevronRight, X, ArrowRight, Download,
  Calendar, Filter, ExternalLink, Search, Move, Info,
  Copy, ChevronDown, Eye
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const ICONS = { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, Building2, Users, BarChart2, Activity };
const CHART_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

// Odoo-style flat solid colors
const CARD_COLORS = {
  blue: { bg: '#1e3a5f', text: '#ffffff', muted: '#8bb4e0', iconBg: 'rgba(255,255,255,0.12)' },
  green: { bg: '#1a6b4a', text: '#ffffff', muted: '#8fd4b4', iconBg: 'rgba(255,255,255,0.12)' },
  red: { bg: '#8b1a1a', text: '#ffffff', muted: '#e8a0a0', iconBg: 'rgba(255,255,255,0.12)' },
  orange: { bg: '#b45309', text: '#ffffff', muted: '#fbbf6e', iconBg: 'rgba(255,255,255,0.12)' },
  purple: { bg: '#5b21b6', text: '#ffffff', muted: '#c4a8ec', iconBg: 'rgba(255,255,255,0.12)' },
  teal: { bg: '#0e7490', text: '#ffffff', muted: '#7dd3e8', iconBg: 'rgba(255,255,255,0.12)' },
  maroon: { bg: '#800000', text: '#ffffff', muted: '#d4a0a0', iconBg: 'rgba(255,255,255,0.12)' },
  indigo: { bg: '#3730a3', text: '#ffffff', muted: '#a5b4fc', iconBg: 'rgba(255,255,255,0.12)' },
  olive: { bg: '#4d5e2f', text: '#ffffff', muted: '#b8cc94', iconBg: 'rgba(255,255,255,0.12)' },
  slate: { bg: '#334155', text: '#ffffff', muted: '#94a3b8', iconBg: 'rgba(255,255,255,0.12)' },
};

const COLOR_ORDER = ['blue', 'blue', 'maroon', 'maroon', 'orange', 'purple', 'green', 'green', 'green', 'red', 'olive', 'olive', 'blue', 'teal', 'indigo', 'maroon', 'purple', 'slate'];

const DATE_PRESETS = [
  { label: 'This Year', value: String(new Date().getFullYear()) },
  { label: 'Last Year', value: String(new Date().getFullYear() - 1) },
  { label: '2024', value: '2024' },
];

// ============ ODOO-STYLE KPI CARD ============
function OdooKpiCard({ card, data, colorKey, editMode, onEdit, onDrillDown, onRemove }) {
  const Icon = ICONS[card?.icon] || Target;
  const groups = data?.groups || [];
  const color = CARD_COLORS[colorKey] || CARD_COLORS.blue;
  const [hovered, setHovered] = useState(false);

  if (!card) return null;

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
    <div className="h-full rounded-lg overflow-hidden relative cursor-pointer transition-shadow duration-200 hover:shadow-xl"
      style={{ backgroundColor: color.bg }}
      onClick={() => onDrillDown?.(card)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      data-testid={`kpi-card-${card.id}`}>

      {/* Hover action bar (Odoo-style) */}
      {hovered && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-end gap-0.5 px-2 py-1.5 bg-black/20 backdrop-blur-sm">
          {editMode && (
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); }}
              className="p-1 rounded hover:bg-white/20 transition-colors" title="Move">
              <GripVertical className="h-3.5 w-3.5 text-white/80" />
            </button>
          )}
          {onEdit && (
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(card); }}
              className="p-1 rounded hover:bg-white/20 transition-colors" title="Edit">
              <Pencil className="h-3.5 w-3.5 text-white/80" />
            </button>
          )}
          <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDrillDown?.(card); }}
            className="p-1 rounded hover:bg-white/20 transition-colors" title="Drill Down">
            <Eye className="h-3.5 w-3.5 text-white/80" />
          </button>
          <button onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
            className="p-1 rounded hover:bg-white/20 transition-colors" title="Info">
            <Info className="h-3.5 w-3.5 text-white/80" />
          </button>
          {editMode && onRemove && (
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded hover:bg-red-500/40 transition-colors" title="Remove">
              <X className="h-3.5 w-3.5 text-white/80" />
            </button>
          )}
        </div>
      )}

      {/* Card content */}
      <div className="p-4 flex flex-col h-full justify-center items-center text-center relative">
        {/* Icon */}
        <div className="mb-2 p-2 rounded-lg" style={{ backgroundColor: color.iconBg }}>
          <Icon className="h-5 w-5" style={{ color: color.muted }} />
        </div>
        {/* Value */}
        <p className="text-3xl font-black tracking-tight leading-none" style={{ color: color.text }}
          data-testid={`kpi-value-${card.id}`}>
          {displayValue()}
        </p>
        {/* Label */}
        <p className="text-xs font-medium mt-2 uppercase tracking-wider leading-tight" style={{ color: color.muted }}>
          {card.name}
        </p>
        {data?.count > 0 && card.display_type !== 'win_rate' && (
          <p className="text-[10px] mt-1 opacity-50" style={{ color: color.muted }}>{data.count} records</p>
        )}
      </div>
    </div>
  );
}

// ============ CHART CARD (White background, Odoo-style) ============
function OdooChartCard({ card, data, editMode, onEdit, onDrillDown, onRemove }) {
  const groups = data?.groups || [];
  const [hovered, setHovered] = useState(false);

  if (!card) return null;

  const handleBarClick = (entry) => {
    if (entry?.label && onDrillDown) onDrillDown(card, entry.label);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden relative"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>

      {/* Hover action bar */}
      {hovered && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-1.5 bg-white/90 backdrop-blur-sm border-b">
          <span className="text-xs font-semibold text-gray-700 truncate">{card.name}</span>
          <div className="flex items-center gap-0.5">
            {editMode && (
              <button onMouseDown={e => e.stopPropagation()} className="p-1 rounded hover:bg-gray-100"><GripVertical className="h-3.5 w-3.5 text-gray-400" /></button>
            )}
            {onEdit && (
              <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(card); }}
                className="p-1 rounded hover:bg-gray-100"><Pencil className="h-3.5 w-3.5 text-gray-400" /></button>
            )}
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDrillDown?.(card); }}
              className="p-1 rounded hover:bg-gray-100"><ExternalLink className="h-3.5 w-3.5 text-gray-400" /></button>
            {editMode && onRemove && (
              <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRemove(); }}
                className="p-1 rounded hover:bg-red-50"><X className="h-3.5 w-3.5 text-red-400" /></button>
            )}
          </div>
        </div>
      )}

      <div className="px-4 pt-3 pb-1">
        <h4 className="text-sm font-semibold text-gray-800">{card.name}</h4>
      </div>

      <div className="flex-1 min-h-0 px-2 pb-2">
        {card.display_type === 'chart' && (() => {
          const dataKey = card.aggregation === 'count' ? 'count' : 'total';
          const chartConfig = {};
          groups.slice(0, 12).forEach((g, i) => { chartConfig[g.label || `item${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; });
          chartConfig[dataKey] = { label: card.name };
          return (
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart accessibilityLayer data={groups.slice(0, 12)} margin={{ left: -10, bottom: 20, right: 10 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => `OMR ${typeof v === 'number' ? v.toLocaleString() : v}`} />} />
                <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} onClick={(_, idx) => handleBarClick(groups[idx])}>
                  {groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="cursor-pointer" />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          );
        })()}
        {card.display_type === 'pie' && (() => {
          const dataKey = card.aggregation === 'count' ? 'count' : 'total';
          const chartConfig = {};
          groups.slice(0, 8).forEach((g, i) => { chartConfig[g.label || `s${i}`] = { label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] }; });
          return (
            <div className="flex items-center gap-3 h-full">
              <ChartContainer config={chartConfig} className="h-full w-1/2">
                <PieChart>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Pie data={groups.slice(0, 8)} dataKey={dataKey} nameKey="label"
                    cx="50%" cy="50%" innerRadius="30%" outerRadius="65%" paddingAngle={2} onClick={(_, idx) => handleBarClick(groups[idx])}>
                    {groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="cursor-pointer" />)}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="space-y-1 flex-1 overflow-auto">
                {groups.slice(0, 6).map((g, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5" onClick={() => handleBarClick(g)}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-gray-500 truncate flex-1">{g.label || '-'}</span>
                    <span className="font-mono font-semibold text-gray-700">{(g.total || g.count || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {card.display_type === 'leaderboard' && (
          <div className="px-2 space-y-1.5 overflow-auto h-full">
            {groups.slice(0, 10).map((g, idx) => (
              <div key={idx} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 transition-colors" onClick={() => handleBarClick(g)}>
                <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                  {(g.label || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <span className="flex-1 text-xs font-medium text-gray-700 truncate">{g.label || '-'}</span>
                <span className="text-xs font-bold text-[#800000]">OMR {(g.total || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        {card.display_type === 'progress' && (
          <div className="px-2 space-y-2 overflow-auto h-full">
            {(() => {
              const maxVal = Math.max(...groups.map(g => g.total || g.count || 0), 1);
              return groups.slice(0, 8).map((g, idx) => (
                <div key={idx} className="cursor-pointer hover:bg-gray-50 rounded px-2 py-0.5" onClick={() => handleBarClick(g)}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600 truncate flex-1">{g.label || '-'}</span>
                    <span className="font-semibold text-gray-900 ml-2">OMR {(g.total || 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${((g.total || g.count || 0) / maxVal) * 100}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
        {card.display_type === 'table' && (
          <div className="px-2 space-y-0.5 overflow-auto h-full">
            {(data?.records || groups || []).slice(0, 10).map((r, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-gray-50 text-xs cursor-pointer">
                <span className="text-gray-600 truncate flex-1">{r.name || r.label || r.invoice_number || '-'}</span>
                <span className="font-mono font-semibold text-gray-900 ml-2">OMR {(r.sale_value || r.total || r.amount_total || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
      try {
        const res = await targetAPI.drillDownCard(card.id, { year, limit: 100 });
        setRecords(res.data.records || []);
        setTotal(res.data.total || 0);
      } catch { toast.error('Failed to load records'); }
      finally { setLoading(false); }
    })();
  }, [open, card?.id, year]);

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return Object.values(r).some(v => String(v).toLowerCase().includes(q));
  });

  const formatValue = (key, val) => {
    if (val === null || val === undefined) return '-';
    if (key.includes('value') || key.includes('amount') || key.includes('revenue')) return `OMR ${Number(val).toLocaleString()}`;
    if (key.includes('date') && typeof val === 'string') return val.split('T')[0];
    if (key.includes('probability')) return `${val}%`;
    return String(val);
  };

  const columns = records.length > 0 ? Object.keys(records[0]).filter(k => !k.startsWith('canonical') && !k.startsWith('source_record') && k !== 'deleted') : [];
  const formatHeader = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

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
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." className="pl-9 h-9 text-sm" data-testid="drill-down-search" />
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400"><Target className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No records found</p></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((record, idx) => (
                  <div key={idx} className="px-6 py-3 hover:bg-gray-50/80 transition-colors cursor-pointer" data-testid={`drill-down-row-${idx}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">{record.name || record.invoice_number || record.summary || Object.values(record)[0]}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          {columns.slice(1, 5).map(col => (
                            <span key={col} className="text-xs text-gray-500">
                              <span className="text-gray-400">{formatHeader(col)}:</span>{' '}
                              <span className="font-medium text-gray-700">{formatValue(col, record[col])}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      {(record.sale_value || record.amount_total) && (
                        <span className="text-sm font-bold text-[#800000] ml-3 whitespace-nowrap">OMR {(record.sale_value || record.amount_total || 0).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="px-6 py-3 border-t bg-gray-50/80 flex items-center justify-between text-xs text-gray-500">
            <span>Showing {filtered.length} of {total} records</span>
            <span className="text-gray-400">{card?.collection}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============ TEMPLATE MANAGER ============
function TemplateManagerDialog({ open, onClose, currentTemplateId, onSwitch }) {
  const [templates, setTemplates] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', assigned_roles: [], is_default: false });

  const load = useCallback(async () => {
    setLoading(true);
    try { const [t, r] = await Promise.all([targetAPI.listTemplates(), targetAPI.getAvailableRoles()]); setTemplates(t.data); setRoles(Array.isArray(r.data) ? r.data : []); } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  const handleCreate = async () => { if (!newName.trim()) return; try { await targetAPI.createTemplate({ name: newName, cards: [], assigned_roles: [], is_default: false }); toast.success('Created'); setNewName(''); load(); } catch {} };
  const handleDelete = async (id) => { try { await targetAPI.deleteTemplate(id); toast.success('Deleted'); load(); } catch {} };
  const handleEditSave = async () => { if (!editingTemplate) return; try { await targetAPI.updateTemplate(editingTemplate.id, editForm); toast.success('Saved'); setEditingTemplate(null); load(); } catch {} };
  const openEdit = (t) => { setEditingTemplate(t); setEditForm({ name: t.name || '', description: t.description || '', assigned_roles: t.assigned_roles || [], is_default: t.is_default || false, cards: t.cards || [] }); };
  const toggleRole = (rid) => { setEditForm(f => ({ ...f, assigned_roles: f.assigned_roles.includes(rid) ? f.assigned_roles.filter(r => r !== rid) : [...f.assigned_roles, rid] })); };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="template-manager-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-[#800000]" /> Dashboard Templates</DialogTitle></DialogHeader>
        {loading ? <div className="space-y-3 py-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        : editingTemplate ? (
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}><ChevronRight className="h-4 w-4 rotate-180 mr-1" /> Back to list</Button>
            <div className="space-y-3">
              <div><Label className="text-xs text-gray-500">Template Name</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label className="text-xs text-gray-500">Description</Label><Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" /></div>
              <div className="flex items-center gap-3"><Switch checked={editForm.is_default} onCheckedChange={v => setEditForm(f => ({ ...f, is_default: v }))} /><Label className="text-sm">Default template</Label></div>
              <div>
                <Label className="text-xs text-gray-500 mb-2 block">Assign to Roles</Label>
                <div className="grid grid-cols-2 gap-2">{roles.map(role => { const rid = role.id || role.name; const rn = role.name || role.id; return (
                  <div key={rid} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 cursor-pointer" onClick={() => toggleRole(rid)}>
                    <Checkbox checked={editForm.assigned_roles.includes(rid)} /><span className="text-sm">{rn}</span>
                  </div>); })}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
              <Button onClick={handleEditSave} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            <div className="flex gap-2">
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New template name..." className="flex-1" />
              <Button onClick={handleCreate} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Plus className="h-4 w-4 mr-1" /> Create</Button>
            </div>
            {templates.map(t => (
              <div key={t.id} className={`p-4 rounded-xl border transition-all hover:shadow-sm ${t.id === currentTemplateId ? 'border-[#800000]/30 bg-[#800000]/5' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{t.name}</span>
                      {t.is_default && <Badge className="bg-[#800000]/10 text-[#800000] text-[10px]">Default</Badge>}
                      {t.id === currentTemplateId && <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{(t.assigned_roles || []).length > 0 ? `Roles: ${t.assigned_roles.join(', ')}` : 'No roles'} · {(t.cards || t.blocks || []).length} cards</p>
                  </div>
                  <div className="flex gap-1">
                    {t.id !== currentTemplateId && <Button variant="ghost" size="sm" onClick={() => onSwitch(t.id)}><ChevronRight className="h-4 w-4" /></Button>}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="h-4 w-4 text-gray-400" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ ADD CARD DIALOG ============
function AddCardDialog({ open, onClose, existingCardIds, onAdd }) {
  const [cards, setCards] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!open) return; (async () => { setLoading(true); try { setCards((await targetAPI.listCards()).data); } catch {} finally { setLoading(false); } })(); }, [open]);
  const avail = cards.filter(c => !existingCardIds.includes(c.id));
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Add Card</DialogTitle></DialogHeader>
        {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        : avail.length === 0 ? <p className="text-gray-400 text-sm py-6 text-center">All cards on dashboard</p>
        : <ScrollArea className="max-h-[400px]"><div className="space-y-2">{avail.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:border-[#800000]/30 hover:bg-gray-50 cursor-pointer" onClick={() => onAdd(c)}>
              <div><span className="text-sm font-medium text-gray-900">{c.name}</span><p className="text-xs text-gray-400">{c.display_type} · {c.collection}</p></div>
              <Plus className="h-4 w-4 text-[#800000]" />
            </div>))}</div></ScrollArea>}
      </DialogContent>
    </Dialog>
  );
}

// ============ MAIN DASHBOARD ============
export default function HybridDashboard() {
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [editMode, setEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [drillDown, setDrillDown] = useState({ open: false, card: null });
  const { hasPermission, permissions } = useRBAC();
  const isAdmin = permissions.includes('admin:*') || hasPermission('manage_dashboard');
  const { width: containerWidth, containerRef } = useContainerWidth({ initialWidth: 1200 });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try { const r = await targetAPI.getMyDashboard(year); setBlocks(r.data.blocks || []); setTemplateId(r.data.template?.id || null); setTemplateName(r.data.template?.name || 'Dashboard'); setHasChanges(false); } catch {} finally { setLoading(false); }
  }, [year]);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const layout = blocks.map(b => ({ i: b.i || b.card_id || String(Math.random()), x: b.x ?? 0, y: b.y ?? 0, w: b.w ?? 2, h: b.h ?? 1, minW: 2, minH: 1, maxW: 12 }));

  const onLayoutChange = (nl) => { if (!editMode) return; setBlocks(prev => prev.map(block => { const item = nl.find(l => l.i === (block.i || block.card_id)); if (!item) return block; return { ...block, i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }; })); setHasChanges(true); };
  const handleSaveLayout = async () => { if (!templateId) return; try { await targetAPI.saveTemplateLayout(templateId, blocks.map(b => ({ i: b.i || b.card_id, x: b.x, y: b.y, w: b.w, h: b.h, type: b.type || 'query_card', card_id: b.card_id }))); toast.success('Layout saved'); setHasChanges(false); } catch {} };
  const handleRemoveCard = (blockI) => { setBlocks(prev => prev.filter(b => (b.i || b.card_id) !== blockI)); setHasChanges(true); toast.success('Card removed'); };
  const handleAddCard = (card) => { const maxY = blocks.reduce((max, b) => Math.max(max, (b.y || 0) + (b.h || 1)), 0); const isChart = ['chart','pie','leaderboard','progress'].includes(card.display_type); setBlocks(prev => [...prev, { i: card.id, x: 0, y: maxY, w: isChart ? 6 : 2, h: isChart ? 3 : 1, type: 'query_card', card_id: card.id, card, data: null }]); setHasChanges(true); setShowAddCard(false); targetAPI.executeCard(card.id, year).then(r => { setBlocks(prev => prev.map(b => b.card_id === card.id ? { ...b, data: r.data } : b)); }).catch(() => {}); };
  const handleEditCard = (card) => { setEditCard({ ...card, filters: typeof card.filters === 'string' ? card.filters : JSON.stringify(card.filters || {}, null, 2) }); setShowEditor(true); };
  const handleSaveCard = async (fd) => { try { if (editCard?.id) await targetAPI.updateCard(editCard.id, fd); else await targetAPI.createCard(fd); setShowEditor(false); setEditCard(null); loadDashboard(); } catch {} };
  const handleDrillDown = (card) => { setDrillDown({ open: true, card }); };
  const handleSwitchTemplate = async (tplId) => { setShowTemplateManager(false); setLoading(true); try { const r = await targetAPI.renderTemplate(tplId, year); const tpl = r.data.template; const cards = r.data.cards || []; const tb = tpl.blocks || []; if (tb.length > 0) { setBlocks(tb.map(b => { const m = cards.find(c => c.card_id === b.card_id); return { ...b, card: m?.card, data: m?.data }; })); } else { let col=0,row=0; setBlocks(cards.map(c => { const ic=['chart','pie','leaderboard','progress'].includes(c.card?.display_type); const w=ic?6:2; const h=ic?3:1; if(col+w>12){col=0;row+=3;} const b={i:c.card_id,x:col,y:row,w,h,type:'query_card',card_id:c.card_id,card:c.card,data:c.data}; col+=w; if(col>=12){col=0;row+=h;} return b; })); } setTemplateId(tpl.id); setTemplateName(tpl.name); setHasChanges(false); } catch {} finally { setLoading(false); } };

  const isKpiCard = (block) => ['number', 'win_rate'].includes(block.card?.display_type);

  if (loading) return (
    <div className="space-y-5" data-testid="dashboard-loading">
      <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-64" /></div>
      <div className="grid grid-cols-6 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      <div className="grid grid-cols-6 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-56 rounded-lg" /><Skeleton className="h-56 rounded-lg" /></div>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="dashboard-page" ref={containerRef}>
      {/* Header - Odoo style */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900" data-testid="dashboard-title">{templateName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32 h-9 text-sm" data-testid="year-select"><Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" /><SelectValue /></SelectTrigger>
            <SelectContent>{DATE_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadDashboard} data-testid="refresh-btn"><RefreshCw className="h-4 w-4" /></Button>
          {isAdmin && (
            <>
              <Separator orientation="vertical" className="h-6" />
              {editMode ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setEditMode(false); loadDashboard(); }}>Discard</Button>
                  <Button size="sm" onClick={() => { handleSaveLayout(); setEditMode(false); }} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Save className="h-4 w-4 mr-1" /> Save Layout</Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)} data-testid="edit-mode-btn"><Pencil className="h-4 w-4 mr-1" /> Edit Layout</Button>
              )}
              {editMode && <Button variant="outline" size="sm" onClick={() => setShowAddCard(true)} data-testid="add-card-btn"><Plus className="h-4 w-4 mr-1" /> Create New Chart</Button>}
              <Button variant="outline" size="sm" onClick={() => setShowTemplateManager(true)} data-testid="template-manager-btn"><Settings className="h-4 w-4 mr-1" /> Templates</Button>
            </>
          )}
        </div>
      </div>

      {editMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2 text-amber-700 text-sm">
          <GripVertical className="h-4 w-4" /><span className="font-medium">Layout Edit Mode</span>
          <span className="text-amber-600">— Drag cards to reorder, resize from edges, hover for controls</span>
          {hasChanges && <Badge className="bg-amber-100 text-amber-700 ml-auto">Unsaved</Badge>}
        </div>
      )}

      {/* Grid */}
      {blocks.length > 0 ? (
        <ResponsiveGridLayout
          className={`layout ${editMode ? 'dashboard-editing' : ''}`}
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768 }}
          cols={{ lg: 12, md: 8, sm: 4 }}
          rowHeight={85}
          width={containerWidth || 1200}
          isDraggable={editMode}
          isResizable={editMode}
          onLayoutChange={(cl) => onLayoutChange(cl)}
          compactor={verticalCompactor}
          margin={[12, 12]}
        >
          {blocks.map((block, idx) => (
            <div key={block.i || block.card_id} data-testid={`dashboard-block-${block.card_id}`}>
              {isKpiCard(block) ? (
                <OdooKpiCard card={block.card} data={block.data} colorKey={COLOR_ORDER[idx % COLOR_ORDER.length]}
                  editMode={editMode} onEdit={isAdmin ? handleEditCard : null} onDrillDown={handleDrillDown}
                  onRemove={() => handleRemoveCard(block.i || block.card_id)} />
              ) : (
                <OdooChartCard card={block.card} data={block.data} editMode={editMode}
                  onEdit={isAdmin ? handleEditCard : null} onDrillDown={handleDrillDown}
                  onRemove={() => handleRemoveCard(block.i || block.card_id)} />
              )}
            </div>
          ))}
        </ResponsiveGridLayout>
      ) : (
        <Card className="border-dashed border-2" data-testid="empty-dashboard">
          <CardContent className="p-12 text-center">
            <Layers className="h-16 w-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400">No Dashboard Configured</h3>
            <p className="text-gray-300 mb-4">{isAdmin ? 'Create a default dashboard to get started' : 'Contact admin'}</p>
            {isAdmin && <Button onClick={async () => { try { await targetAPI.seedDefaultCards(); loadDashboard(); } catch {} }} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Layers className="h-4 w-4 mr-1" /> Create Default Dashboard</Button>}
          </CardContent>
        </Card>
      )}

      <DrillDownPanel open={drillDown.open} onClose={() => setDrillDown({ open: false, card: null })} card={drillDown.card} year={year} />
      <TemplateManagerDialog open={showTemplateManager} onClose={() => setShowTemplateManager(false)} currentTemplateId={templateId} onSwitch={handleSwitchTemplate} />
      <AddCardDialog open={showAddCard} onClose={() => setShowAddCard(false)} existingCardIds={blocks.map(b => b.card_id).filter(Boolean)} onAdd={handleAddCard} />
      <QueryEditorDialog open={showEditor} onClose={() => { setShowEditor(false); setEditCard(null); }} card={editCard} onSave={handleSaveCard} />
    </div>
  );
}
