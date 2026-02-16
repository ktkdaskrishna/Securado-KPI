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
import { QueryEditorDialog } from './ConfigurableDashboard';
import { useRBAC } from '../../lib/RBACContext';
import {
  Target, TrendingUp, DollarSign, Trophy, AlertTriangle, Building2,
  Users, BarChart2, Pencil, RefreshCw, Layers, Activity, Save,
  Settings, Plus, Trash2, GripVertical, Lock, Unlock,
  LayoutGrid, ChevronRight, X, ArrowRight, Download,
  Calendar, Filter, ChevronDown, ExternalLink, Search
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const ICONS = { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, Building2, Users, BarChart2, Activity };
const CHART_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

// Premium card color palettes (gradient pairs)
const CARD_PALETTES = [
  { bg: 'from-blue-600 to-blue-800', text: 'text-white', muted: 'text-blue-200', icon: 'text-blue-300/60' },
  { bg: 'from-emerald-500 to-emerald-700', text: 'text-white', muted: 'text-emerald-200', icon: 'text-emerald-300/60' },
  { bg: 'from-violet-600 to-violet-800', text: 'text-white', muted: 'text-violet-200', icon: 'text-violet-300/60' },
  { bg: 'from-amber-500 to-amber-700', text: 'text-white', muted: 'text-amber-200', icon: 'text-amber-300/60' },
  { bg: 'from-rose-600 to-rose-800', text: 'text-white', muted: 'text-rose-200', icon: 'text-rose-300/60' },
  { bg: 'from-cyan-500 to-cyan-700', text: 'text-white', muted: 'text-cyan-200', icon: 'text-cyan-300/60' },
  { bg: 'from-pink-500 to-pink-700', text: 'text-white', muted: 'text-pink-200', icon: 'text-pink-300/60' },
  { bg: 'from-indigo-600 to-indigo-800', text: 'text-white', muted: 'text-indigo-200', icon: 'text-indigo-300/60' },
  { bg: 'from-[#800000] to-[#5a0000]', text: 'text-white', muted: 'text-red-200', icon: 'text-red-300/60' },
  { bg: 'from-teal-500 to-teal-700', text: 'text-white', muted: 'text-teal-200', icon: 'text-teal-300/60' },
];

const DATE_PRESETS = [
  { label: 'This Year', value: new Date().getFullYear().toString() },
  { label: 'Last Year', value: (new Date().getFullYear() - 1).toString() },
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

  const columns = records.length > 0 ? Object.keys(records[0]).filter(k => !k.startsWith('canonical') && !k.startsWith('source_record') && k !== 'deleted') : [];

  const formatValue = (key, val) => {
    if (val === null || val === undefined) return '-';
    if (key.includes('value') || key.includes('amount') || key.includes('revenue')) return `OMR ${Number(val).toLocaleString()}`;
    if (key.includes('date') && typeof val === 'string') return val.split('T')[0];
    if (key.includes('probability')) return `${val}%`;
    return String(val);
  };

  const formatHeader = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[700px] sm:w-[800px] sm:max-w-[800px] p-0" data-testid="drill-down-panel">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b bg-gray-50/80">
            <SheetTitle className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-gray-900">{card?.name || 'Records'}</span>
                <Badge className="ml-2 bg-[#800000]/10 text-[#800000]">{total} records</Badge>
              </div>
            </SheetTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..."
                className="pl-9 h-9 text-sm" data-testid="drill-down-search" />
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No records found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((record, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="px-6 py-3 hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    data-testid={`drill-down-row-${idx}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">
                          {record.name || record.invoice_number || record.summary || Object.values(record)[0]}
                        </p>
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
                        <span className="text-sm font-bold text-[#800000] ml-3 whitespace-nowrap">
                          OMR {(record.sale_value || record.amount_total || 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </motion.div>
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

// ============ KPI CARD (Colorful, Odoo-style) ============
function KpiCard({ card, data, palette, editMode, onEdit, onDrillDown }) {
  const Icon = ICONS[card?.icon] || Target;
  const groups = data?.groups || [];

  if (!card) return null;

  const displayValue = () => {
    if (card.display_type === 'win_rate') {
      const won = groups.find(g => g.label === 'Won')?.count || 0;
      const lost = groups.find(g => g.label === 'Lost')?.count || 0;
      return ((won / Math.max(won + lost, 1)) * 100).toFixed(1) + '%';
    }
    if (card.aggregation === 'sum' || card.aggregation === 'avg') return `OMR ${(data?.value || 0).toLocaleString()}`;
    return (data?.value || 0).toLocaleString();
  };

  return (
    <div className={`h-full rounded-xl bg-gradient-to-br ${palette.bg} relative overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl hover:scale-[1.02]`}
      onClick={() => onDrillDown?.(card)} data-testid={`kpi-card-${card.id}`}>
      {/* Background icon */}
      <Icon className={`absolute -right-4 -bottom-4 h-28 w-28 ${palette.icon} rotate-12 transition-transform group-hover:rotate-6 group-hover:scale-110`} />
      
      <div className="relative z-10 p-5 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${palette.muted}`}>{card.name}</span>
          <div className="flex gap-1">
            {onEdit && (
              <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(card); }}
                className="p-1 rounded-lg bg-white/10 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20">
                <Pencil className="h-3 w-3 text-white/80" />
              </button>
            )}
          </div>
        </div>
        <div>
          <p className={`text-3xl font-black ${palette.text} tracking-tight leading-none`} data-testid={`kpi-value-${card.id}`}>
            {displayValue()}
          </p>
          {data?.count > 0 && <p className={`text-xs mt-1.5 ${palette.muted}`}>{data.count} records</p>}
          <div className={`flex items-center gap-1 mt-2 text-xs ${palette.muted} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <span>Click to drill down</span><ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ CHART CARD (White, with drill-down) ============
function ChartCard({ card, data, editMode, onEdit, onDrillDown }) {
  const groups = data?.groups || [];

  if (!card) return null;

  const handleBarClick = (entry) => {
    if (entry?.label && onDrillDown) onDrillDown(card, entry.label);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">{card.name}</h4>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(card); }}
              className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-100">
              <Pencil className="h-3 w-3 text-gray-400" />
            </button>
          )}
          {onDrillDown && (
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDrillDown(card); }}
              className="p-1 rounded-lg hover:bg-gray-100 transition-all">
              <ExternalLink className="h-3 w-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-2 pb-3">
        {card.display_type === 'chart' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groups.slice(0, 12)} margin={{ left: -10, bottom: 20, right: 10 }}>
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '12px' }}
                formatter={v => [`OMR ${typeof v === 'number' ? v.toLocaleString() : v}`]} cursor={{ fill: 'rgba(128,0,0,0.05)' }} />
              <Bar dataKey={card.aggregation === 'count' ? 'count' : 'total'} radius={[6, 6, 0, 0]} onClick={(_, idx) => handleBarClick(groups[idx])}>
                {groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="cursor-pointer hover:opacity-80 transition-opacity" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {card.display_type === 'pie' && (
          <div className="flex items-center gap-3 h-full">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie data={groups.slice(0, 8)} dataKey={card.aggregation === 'count' ? 'count' : 'total'} nameKey="label"
                  cx="50%" cy="50%" innerRadius="35%" outerRadius="70%" paddingAngle={2} onClick={(_, idx) => handleBarClick(groups[idx])}>
                  {groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="cursor-pointer hover:opacity-80" />)}
                </Pie>
                <Tooltip formatter={v => [`OMR ${typeof v === 'number' ? v.toLocaleString() : v}`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 flex-1 overflow-auto">
              {groups.slice(0, 6).map((g, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                  onClick={() => handleBarClick(g)}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-gray-500 truncate flex-1">{g.label || '-'}</span>
                  <span className="font-mono font-semibold text-gray-700">{(g.total || g.count || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {card.display_type === 'leaderboard' && (
          <div className="px-3 space-y-2 overflow-auto h-full">
            {groups.slice(0, 8).map((g, idx) => (
              <div key={idx} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
                onClick={() => handleBarClick(g)}>
                <span className="text-sm font-bold text-gray-400 w-4">{idx + 1}</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                  {(g.label || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{g.label || '-'}</span>
                <span className="text-sm font-bold text-[#800000]">OMR {(g.total || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        {card.display_type === 'progress' && (
          <div className="px-3 space-y-2.5 overflow-auto h-full">
            {(() => {
              const maxVal = Math.max(...groups.map(g => g.total || g.count || 0), 1);
              return groups.slice(0, 8).map((g, idx) => (
                <div key={idx} className="cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors" onClick={() => handleBarClick(g)}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600 truncate flex-1">{g.label || '-'}</span>
                    <span className="font-semibold text-gray-900 ml-2">OMR {(g.total || 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${((g.total || g.count || 0) / maxVal) * 100}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05 }}
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
        {card.display_type === 'table' && (
          <div className="px-3 space-y-1 overflow-auto h-full">
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
    try {
      const [tRes, rRes] = await Promise.all([targetAPI.listTemplates(), targetAPI.getAvailableRoles()]);
      setTemplates(tRes.data);
      setRoles(Array.isArray(rRes.data) ? rRes.data : []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await targetAPI.createTemplate({ name: newName, cards: [], assigned_roles: [], is_default: false }); toast.success('Created'); setNewName(''); load(); } catch {}
  };
  const handleDelete = async (id) => { try { await targetAPI.deleteTemplate(id); toast.success('Deleted'); load(); } catch {} };
  const handleEditSave = async () => {
    if (!editingTemplate) return;
    try { await targetAPI.updateTemplate(editingTemplate.id, editForm); toast.success('Saved'); setEditingTemplate(null); load(); } catch {}
  };
  const openEdit = (t) => { setEditingTemplate(t); setEditForm({ name: t.name || '', description: t.description || '', assigned_roles: t.assigned_roles || [], is_default: t.is_default || false, cards: t.cards || [] }); };
  const toggleRole = (roleId) => { setEditForm(f => ({ ...f, assigned_roles: f.assigned_roles.includes(roleId) ? f.assigned_roles.filter(r => r !== roleId) : [...f.assigned_roles, roleId] })); };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="template-manager-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-[#800000]" /> Dashboard Templates</DialogTitle></DialogHeader>
        {loading ? <div className="space-y-3 py-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        : editingTemplate ? (
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}><ChevronRight className="h-4 w-4 rotate-180 mr-1" /> Back</Button>
              <span className="text-sm font-medium text-gray-500">Edit: {editingTemplate.name}</span>
            </div>
            <div className="space-y-3">
              <div><Label className="text-xs text-gray-500">Template Name</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} data-testid="template-name-input" /></div>
              <div><Label className="text-xs text-gray-500">Description</Label><Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" /></div>
              <div className="flex items-center gap-3"><Switch checked={editForm.is_default} onCheckedChange={v => setEditForm(f => ({ ...f, is_default: v }))} /><Label className="text-sm">Default template</Label></div>
              <div>
                <Label className="text-xs text-gray-500 mb-2 block">Assign to Roles</Label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(role => { const roleId = role.id || role.name || role; const roleName = role.name || role.id || role; return (
                    <div key={roleId} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 cursor-pointer" onClick={() => toggleRole(roleId)} data-testid={`role-${roleId}`}>
                      <Checkbox checked={editForm.assigned_roles.includes(roleId)} /><span className="text-sm">{roleName}</span>
                    </div>
                  ); })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
              <Button onClick={handleEditSave} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="save-template-btn"><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            <div className="flex gap-2">
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New template name..." className="flex-1" data-testid="new-template-name" />
              <Button onClick={handleCreate} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="create-template-btn"><Plus className="h-4 w-4 mr-1" /> Create</Button>
            </div>
            {templates.map(t => (
              <div key={t.id} className={`p-4 rounded-xl border transition-all hover:shadow-sm ${t.id === currentTemplateId ? 'border-[#800000]/30 bg-[#800000]/5' : 'border-gray-200'}`} data-testid={`template-${t.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{t.name}</span>
                      {t.is_default && <Badge className="bg-[#800000]/10 text-[#800000] text-[10px]">Default</Badge>}
                      {t.id === currentTemplateId && <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{(t.assigned_roles || []).length > 0 ? `Roles: ${t.assigned_roles.join(', ')}` : 'No roles'} · {(t.cards || t.blocks || []).length} cards</p>
                  </div>
                  <div className="flex items-center gap-1">
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
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!open) return; (async () => { setLoading(true); try { const res = await targetAPI.listCards(); setCards(res.data); } catch {} finally { setLoading(false); } })(); }, [open]);
  const available = cards.filter(c => !existingCardIds.includes(c.id));
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="add-card-dialog">
        <DialogHeader><DialogTitle>Add Card to Dashboard</DialogTitle></DialogHeader>
        {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        : available.length === 0 ? <p className="text-gray-400 text-sm py-6 text-center">All cards already on dashboard</p>
        : <ScrollArea className="max-h-[400px]"><div className="space-y-2">{available.map(card => (
            <div key={card.id} className="flex items-center justify-between p-3 rounded-lg border hover:border-[#800000]/30 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onAdd(card)} data-testid={`add-card-${card.id}`}>
              <div><span className="text-sm font-medium text-gray-900">{card.name}</span><p className="text-xs text-gray-400">{card.display_type} · {card.collection}</p></div>
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
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [editMode, setEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [drillDown, setDrillDown] = useState({ open: false, card: null, groupValue: null });
  const { hasPermission, permissions } = useRBAC();
  const isAdmin = permissions.includes('admin:*') || hasPermission('manage_dashboard');
  const { width: containerWidth, containerRef } = useContainerWidth({ initialWidth: 1200 });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await targetAPI.getMyDashboard(year);
      setBlocks(res.data.blocks || []);
      setTemplateId(res.data.template?.id || null);
      setTemplateName(res.data.template?.name || 'Dashboard');
      setHasChanges(false);
    } catch {} finally { setLoading(false); }
  }, [year]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const layout = blocks.map(b => ({ i: b.i || b.card_id || String(Math.random()), x: b.x ?? 0, y: b.y ?? 0, w: b.w ?? 3, h: b.h ?? 1, minW: 2, minH: 1, maxW: 12 }));

  const onLayoutChange = (newLayout) => {
    if (!editMode) return;
    setBlocks(prev => prev.map(block => {
      const item = newLayout.find(l => l.i === (block.i || block.card_id));
      if (!item) return block;
      return { ...block, i: item.i, x: item.x, y: item.y, w: item.w, h: item.h };
    }));
    setHasChanges(true);
  };

  const handleSaveLayout = async () => {
    if (!templateId) return;
    try {
      const layoutBlocks = blocks.map(b => ({ i: b.i || b.card_id, x: b.x, y: b.y, w: b.w, h: b.h, type: b.type || 'query_card', card_id: b.card_id }));
      await targetAPI.saveTemplateLayout(templateId, layoutBlocks);
      toast.success('Layout saved');
      setHasChanges(false);
    } catch { toast.error('Failed'); }
  };

  const handleRemoveCard = (blockI) => { setBlocks(prev => prev.filter(b => (b.i || b.card_id) !== blockI)); setHasChanges(true); toast.success('Card removed'); };

  const handleAddCard = (card) => {
    const maxY = blocks.reduce((max, b) => Math.max(max, (b.y || 0) + (b.h || 1)), 0);
    const isChart = ['chart', 'pie', 'leaderboard', 'progress'].includes(card.display_type);
    setBlocks(prev => [...prev, { i: card.id, x: 0, y: maxY, w: isChart ? 6 : 3, h: isChart ? 3 : 1, type: 'query_card', card_id: card.id, card, data: null }]);
    setHasChanges(true); setShowAddCard(false);
    targetAPI.executeCard(card.id, year).then(res => { setBlocks(prev => prev.map(b => b.card_id === card.id ? { ...b, data: res.data } : b)); }).catch(() => {});
  };

  const handleEditCard = (card) => { setEditCard({ ...card, filters: typeof card.filters === 'string' ? card.filters : JSON.stringify(card.filters || {}, null, 2) }); setShowEditor(true); };
  const handleSaveCard = async (formData) => { try { if (editCard?.id) { await targetAPI.updateCard(editCard.id, formData); } else { await targetAPI.createCard(formData); } setShowEditor(false); setEditCard(null); loadDashboard(); } catch {} };

  const handleDrillDown = (card, groupValue) => { setDrillDown({ open: true, card, groupValue }); };

  const handleSwitchTemplate = async (tplId) => {
    setShowTemplateManager(false); setLoading(true);
    try {
      const res = await targetAPI.renderTemplate(tplId, year);
      const tpl = res.data.template; const cards = res.data.cards || [];
      const tplBlocks = tpl.blocks || [];
      if (tplBlocks.length > 0) {
        setBlocks(tplBlocks.map(b => { const m = cards.find(c => c.card_id === b.card_id); return { ...b, card: m?.card, data: m?.data }; }));
      } else {
        let col = 0, row = 0;
        setBlocks(cards.map(c => { const isC = ['chart','pie','leaderboard','progress'].includes(c.card?.display_type); const w = isC ? 6 : 3; const h = isC ? 3 : 1; if (col+w>12){col=0;row+=3;} const b = { i: c.card_id, x: col, y: row, w, h, type: 'query_card', card_id: c.card_id, card: c.card, data: c.data }; col+=w; if(col>=12){col=0;row+=h;} return b; }));
      }
      setTemplateId(tpl.id); setTemplateName(tpl.name); setHasChanges(false);
    } catch {} finally { setLoading(false); }
  };

  // Determine if a block is a KPI (number/win_rate) or a chart
  const isKpiCard = (block) => ['number', 'win_rate'].includes(block.card?.display_type);

  if (loading) return (
    <div className="space-y-5" data-testid="dashboard-loading">
      <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-64" /></div>
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="dashboard-page" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="dashboard-title">Dashboard</h1>
          <p className="text-sm text-gray-500">{templateName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28 h-9" data-testid="year-select">
              <Calendar className="h-3.5 w-3.5 mr-1 text-gray-400" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadDashboard} data-testid="refresh-btn"><RefreshCw className="h-4 w-4" /></Button>
          {isAdmin && (
            <>
              <Separator orientation="vertical" className="h-6" />
              <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode(!editMode)}
                className={editMode ? "bg-[#800000] hover:bg-[#9a1919] text-white" : ""} data-testid="edit-mode-btn">
                {editMode ? <Unlock className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                {editMode ? 'Editing' : 'Edit Layout'}
              </Button>
              {editMode && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowAddCard(true)} data-testid="add-card-btn"><Plus className="h-4 w-4 mr-1" /> Add Card</Button>
                  {hasChanges && <Button size="sm" onClick={handleSaveLayout} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="save-layout-btn"><Save className="h-4 w-4 mr-1" /> Save</Button>}
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowTemplateManager(true)} data-testid="template-manager-btn"><Settings className="h-4 w-4 mr-1" /> Templates</Button>
            </>
          )}
        </div>
      </div>

      {editMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between" data-testid="edit-mode-banner">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <GripVertical className="h-4 w-4" /><span className="font-medium">Layout Edit Mode</span>
            <span className="text-amber-600">— Drag to reorder, resize edges to resize</span>
          </div>
          {hasChanges && <Badge className="bg-amber-100 text-amber-700">Unsaved changes</Badge>}
        </div>
      )}

      {/* Grid Layout */}
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
          margin={[16, 16]}
        >
          {blocks.map((block, idx) => (
            <div key={block.i || block.card_id} className="group" data-testid={`dashboard-block-${block.card_id}`}>
              {editMode && (
                <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); handleRemoveCard(block.i || block.card_id); }}
                  className="absolute top-1.5 right-1.5 z-30 p-1.5 rounded-full bg-red-100 hover:bg-red-200 shadow-sm transition-all cursor-pointer"
                  data-testid={`remove-card-${block.card_id}`}><X className="h-4 w-4 text-red-600" /></button>
              )}

              {isKpiCard(block) ? (
                <KpiCard card={block.card} data={block.data} palette={CARD_PALETTES[idx % CARD_PALETTES.length]}
                  editMode={editMode} onEdit={isAdmin ? handleEditCard : null} onDrillDown={handleDrillDown} />
              ) : (
                <Card className="h-full overflow-hidden border-0 shadow-sm hover:shadow-lg transition-shadow">
                  <ChartCard card={block.card} data={block.data} editMode={editMode}
                    onEdit={isAdmin ? handleEditCard : null} onDrillDown={handleDrillDown} />
                </Card>
              )}
            </div>
          ))}
        </ResponsiveGridLayout>
      ) : (
        <Card className="border-dashed border-2" data-testid="empty-dashboard">
          <CardContent className="p-12 text-center">
            <Layers className="h-16 w-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400">No Dashboard Configured</h3>
            <p className="text-gray-300 mb-4">{isAdmin ? 'Seed defaults or manage templates' : 'Contact admin'}</p>
            {isAdmin && (
              <div className="flex gap-2 justify-center">
                <Button onClick={async () => { try { await targetAPI.seedDefaultCards(); loadDashboard(); } catch {} }} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="seed-defaults-btn">
                  <Layers className="h-4 w-4 mr-1" /> Create Default Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drill-Down Panel */}
      <DrillDownPanel open={drillDown.open} onClose={() => setDrillDown({ open: false, card: null })}
        card={drillDown.card} year={year} />

      {/* Dialogs */}
      <TemplateManagerDialog open={showTemplateManager} onClose={() => setShowTemplateManager(false)} currentTemplateId={templateId} onSwitch={handleSwitchTemplate} />
      <AddCardDialog open={showAddCard} onClose={() => setShowAddCard(false)} existingCardIds={blocks.map(b => b.card_id).filter(Boolean)} onAdd={handleAddCard} />
      <QueryEditorDialog open={showEditor} onClose={() => { setShowEditor(false); setEditCard(null); }} card={editCard} onSave={handleSaveCard} />
    </div>
  );
}
