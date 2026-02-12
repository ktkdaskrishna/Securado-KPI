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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { QueryEditorDialog } from './ConfigurableDashboard';
import { useRBAC } from '../../lib/RBACContext';
import {
  Target, TrendingUp, DollarSign, Trophy, AlertTriangle, Building2,
  Users, BarChart2, Pencil, RefreshCw, Layers, Activity, Save,
  Settings, Plus, Trash2, GripVertical, Lock, Unlock, Copy,
  LayoutGrid, ChevronRight, X, Check
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const ICONS = { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, Building2, Users, BarChart2, Activity };
const CHART_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

// ============ UNIVERSAL CARD RENDERER ============
function DashboardCard({ card, data, onEdit, editMode }) {
  const Icon = ICONS[card?.icon] || Target;
  const groups = data?.groups || [];
  const color = card?.color || '#800000';

  if (!card) return <div className="h-full flex items-center justify-center text-gray-300 text-sm">No card data</div>;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Edit overlay */}
      {editMode && (
        <div className="absolute top-1.5 left-1.5 z-20 cursor-grab active:cursor-grabbing" data-testid="drag-handle">
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
      )}
      {onEdit && (
        <button onClick={(e) => { e.stopPropagation(); onEdit(card); }}
          data-testid={`edit-card-${card.id}`}
          className="absolute top-1.5 right-1.5 z-20 p-1.5 rounded-lg bg-white/80 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-100">
          <Pencil className="h-3.5 w-3.5 text-gray-400" />
        </button>
      )}

      <div className="p-4 flex-1 flex flex-col">
        {/* NUMBER CARD */}
        {card.display_type === 'number' && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{card.name}</span>
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}12` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900" data-testid={`card-value-${card.id}`}>
              {card.aggregation === 'sum' || card.aggregation === 'avg' ? `OMR ${(data?.value || 0).toLocaleString()}` : (data?.value || 0).toLocaleString()}
            </p>
            {data?.count > 0 && <p className="text-xs text-gray-400 mt-1">{data.count} records</p>}
          </div>
        )}

        {/* WIN RATE */}
        {card.display_type === 'win_rate' && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{card.name}</span>
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}12` }}>
                <TrendingUp className="h-4 w-4" style={{ color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900" data-testid={`card-value-${card.id}`}>
              {groups.length > 0 ? (() => {
                const won = groups.find(g => g.label === 'Won')?.count || 0;
                const lost = groups.find(g => g.label === 'Lost')?.count || 0;
                return ((won / Math.max(won + lost, 1)) * 100).toFixed(1) + '%';
              })() : '0%'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Won / (Won + Lost)</p>
          </div>
        )}

        {/* BAR CHART */}
        {card.display_type === 'chart' && (
          <div className="flex-1 flex flex-col">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{card.name}</h4>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groups.slice(0, 12)} margin={{ left: -10, bottom: 20 }}>
                  <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    formatter={v => [`OMR ${typeof v === 'number' ? v.toLocaleString() : v}`]} />
                  <Bar dataKey={card.aggregation === 'count' ? 'count' : 'total'} radius={[6, 6, 0, 0]}>
                    {groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* PIE CHART */}
        {card.display_type === 'pie' && (
          <div className="flex-1 flex flex-col">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">{card.name}</h4>
            <div className="flex items-center gap-3 flex-1 min-h-0">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={groups.slice(0, 8)} dataKey={card.aggregation === 'count' ? 'count' : 'total'} nameKey="label" cx="50%" cy="50%" innerRadius={25} outerRadius={55} paddingAngle={2}>
                    {groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [`OMR ${typeof v === 'number' ? v.toLocaleString() : v}`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1 overflow-auto">
                {groups.slice(0, 6).map((g, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-gray-500 truncate flex-1">{g.label || '-'}</span>
                    <span className="font-mono font-semibold text-gray-700">{(g.total || g.count || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LEADERBOARD */}
        {card.display_type === 'leaderboard' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">{card.name}</h4>
              <Badge variant="secondary" className="text-xs">{groups.reduce((s, g) => s + (g.count || 0), 0)} deals</Badge>
            </div>
            <div className="space-y-2 overflow-auto flex-1">
              {groups.slice(0, 8).map((g, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-gray-400 w-4">{idx + 1}</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                    {(g.label || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-700 truncate">{g.label || '-'}</span>
                  <span className="text-sm font-bold" style={{ color }}>OMR {(g.total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
            {groups.length > 0 && (
              <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-bold" style={{ color }}>OMR {groups.reduce((s, g) => s + (g.total || 0), 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* PROGRESS BARS */}
        {card.display_type === 'progress' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">{card.name}</h4>
              <Badge variant="secondary" className="text-xs">{groups.reduce((s, g) => s + (g.count || 0), 0)} deals</Badge>
            </div>
            <div className="space-y-2 overflow-auto flex-1">
              {(() => {
                const maxVal = Math.max(...groups.map(g => g.total || g.count || 0), 1);
                return groups.slice(0, 8).map((g, idx) => (
                  <div key={idx}>
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
          </div>
        )}

        {/* TABLE */}
        {card.display_type === 'table' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{card.name}</h4>
            <div className="space-y-1 overflow-auto flex-1">
              {(data?.records || groups || []).slice(0, 10).map((r, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-gray-50 text-xs">
                  <span className="text-gray-600 truncate flex-1">{r.name || r.label || r.invoice_number || '-'}</span>
                  <span className="font-mono font-semibold text-gray-900 ml-2">OMR {(r.sale_value || r.total || r.amount_total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ TEMPLATE MANAGER DIALOG ============
function TemplateManagerDialog({ open, onClose, currentTemplateId, onSwitch }) {
  const [templates, setTemplates] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', assigned_roles: [], is_default: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes, rRes] = await Promise.all([
        targetAPI.listTemplates(),
        targetAPI.listCards(),
        targetAPI.getAvailableRoles()
      ]);
      setTemplates(tRes.data);
      setAllCards(cRes.data);
      setRoles(Array.isArray(rRes.data) ? rRes.data : []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Name required'); return; }
    try {
      await targetAPI.createTemplate({ name: newName, cards: [], assigned_roles: [], is_default: false });
      toast.success('Template created');
      setNewName('');
      load();
    } catch { toast.error('Failed to create'); }
  };

  const handleDelete = async (id) => {
    try {
      await targetAPI.deleteTemplate(id);
      toast.success('Deleted');
      load();
    } catch { toast.error('Failed'); }
  };

  const handleEditSave = async () => {
    if (!editingTemplate) return;
    try {
      await targetAPI.updateTemplate(editingTemplate.id, editForm);
      toast.success('Template updated');
      setEditingTemplate(null);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const openEdit = (t) => {
    setEditingTemplate(t);
    setEditForm({
      name: t.name || '',
      description: t.description || '',
      assigned_roles: t.assigned_roles || [],
      is_default: t.is_default || false,
      cards: t.cards || [],
    });
  };

  const toggleRole = (roleId) => {
    setEditForm(f => ({
      ...f,
      assigned_roles: f.assigned_roles.includes(roleId)
        ? f.assigned_roles.filter(r => r !== roleId)
        : [...f.assigned_roles, roleId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="template-manager-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-[#800000]" /> Dashboard Templates
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : editingTemplate ? (
          /* Edit form */
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}>
                <ChevronRight className="h-4 w-4 rotate-180 mr-1" /> Back
              </Button>
              <span className="text-sm font-medium text-gray-500">Edit: {editingTemplate.name}</span>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Template Name</Label>
                <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} data-testid="template-name-input" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Description</Label>
                <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editForm.is_default} onCheckedChange={v => setEditForm(f => ({ ...f, is_default: v }))} />
                <Label className="text-sm">Default template (fallback for unassigned roles)</Label>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-2 block">Assign to Roles</Label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(role => {
                    const roleId = role.id || role.name || role;
                    const roleName = role.name || role.id || role;
                    return (
                      <div key={roleId} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleRole(roleId)} data-testid={`role-${roleId}`}>
                        <Checkbox checked={editForm.assigned_roles.includes(roleId)} />
                        <span className="text-sm">{roleName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
              <Button onClick={handleEditSave} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="save-template-btn">
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        ) : (
          /* Templates list */
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            {/* Create new */}
            <div className="flex gap-2">
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New template name..." className="flex-1" data-testid="new-template-name" />
              <Button onClick={handleCreate} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="create-template-btn">
                <Plus className="h-4 w-4 mr-1" /> Create
              </Button>
            </div>

            {/* List */}
            {templates.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <LayoutGrid className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No templates yet. Create one above.</p>
              </div>
            )}
            {templates.map(t => (
              <div key={t.id} className={`p-4 rounded-xl border transition-all hover:shadow-sm ${t.id === currentTemplateId ? 'border-[#800000]/30 bg-[#800000]/5' : 'border-gray-200'}`}
                data-testid={`template-${t.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{t.name}</span>
                      {t.is_default && <Badge className="bg-[#800000]/10 text-[#800000] text-[10px]">Default</Badge>}
                      {t.id === currentTemplateId && <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(t.assigned_roles || []).length > 0 ? `Roles: ${t.assigned_roles.join(', ')}` : 'No roles assigned'}
                      {' · '}{(t.cards || t.blocks || []).length} cards
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {t.id !== currentTemplateId && (
                      <Button variant="ghost" size="sm" onClick={() => onSwitch(t.id)} data-testid={`switch-template-${t.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
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

// ============ ADD CARD TO DASHBOARD DIALOG ============
function AddCardDialog({ open, onClose, existingCardIds, onAdd }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const res = await targetAPI.listCards();
        setCards(res.data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [open]);

  const available = cards.filter(c => !existingCardIds.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="add-card-dialog">
        <DialogHeader>
          <DialogTitle>Add Card to Dashboard</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : available.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center">All cards are already on the dashboard</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {available.map(card => (
                <div key={card.id} className="flex items-center justify-between p-3 rounded-lg border hover:border-[#800000]/30 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onAdd(card)} data-testid={`add-card-${card.id}`}>
                  <div>
                    <span className="text-sm font-medium text-gray-900">{card.name}</span>
                    <p className="text-xs text-gray-400">{card.display_type} · {card.collection}</p>
                  </div>
                  <Plus className="h-4 w-4 text-[#800000]" />
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
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
  const { hasPermission, permissions } = useRBAC();
  const isAdmin = permissions.includes('admin:*') || hasPermission('manage_dashboard');
  const { width: containerWidth, containerRef } = useContainerWidth({ initialWidth: 1200 });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await targetAPI.getMyDashboard(year);
      const data = res.data;
      setBlocks(data.blocks || []);
      setTemplateId(data.template?.id || null);
      setTemplateName(data.template?.name || 'Dashboard');
      setHasChanges(false);
    } catch { }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Build react-grid-layout items (12-column grid)
  const layout = blocks.map(b => ({
    i: b.i || b.card_id || String(Math.random()),
    x: b.x ?? 0, y: b.y ?? 0,
    w: b.w ?? 3, h: b.h ?? 1,
    minW: 2, minH: 1, maxW: 12,
  }));

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
    if (!templateId) { toast.error('No template to save'); return; }
    try {
      const layoutBlocks = blocks.map(b => ({
        i: b.i || b.card_id,
        x: b.x, y: b.y, w: b.w, h: b.h,
        type: b.type || 'query_card',
        card_id: b.card_id
      }));
      await targetAPI.saveTemplateLayout(templateId, layoutBlocks);
      toast.success('Layout saved');
      setHasChanges(false);
    } catch { toast.error('Failed to save layout'); }
  };

  const handleRemoveCard = (blockI) => {
    setBlocks(prev => prev.filter(b => (b.i || b.card_id) !== blockI));
    setHasChanges(true);
    toast.success('Card removed from layout');
  };

  const handleAddCard = (card) => {
    const maxY = blocks.reduce((max, b) => Math.max(max, (b.y || 0) + (b.h || 1)), 0);
    const isChart = ['chart', 'pie', 'leaderboard', 'progress'].includes(card.display_type);
    const newBlock = {
      i: card.id, x: 0, y: maxY, w: isChart ? 6 : 3, h: isChart ? 3 : 1,
      type: 'query_card', card_id: card.id, card, data: null
    };
    setBlocks(prev => [...prev, newBlock]);
    setHasChanges(true);
    setShowAddCard(false);
    toast.success(`Added "${card.name}"`);
    // Execute card query
    targetAPI.executeCard(card.id, year).then(res => {
      setBlocks(prev => prev.map(b => b.card_id === card.id ? { ...b, data: res.data } : b));
    }).catch(() => {});
  };

  const handleEditCard = (card) => {
    setEditCard({ ...card, filters: typeof card.filters === 'string' ? card.filters : JSON.stringify(card.filters || {}, null, 2) });
    setShowEditor(true);
  };

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
      loadDashboard();
    } catch { toast.error('Failed'); }
  };

  const handleSwitchTemplate = async (tplId) => {
    setShowTemplateManager(false);
    setLoading(true);
    try {
      const res = await targetAPI.renderTemplate(tplId, year);
      const tpl = res.data.template;
      const cards = res.data.cards || [];
      // Convert rendered cards to blocks
      const tplBlocks = tpl.blocks || [];
      if (tplBlocks.length > 0) {
        const enriched = tplBlocks.map(b => {
          const match = cards.find(c => c.card_id === b.card_id);
          return { ...b, card: match?.card, data: match?.data };
        });
        setBlocks(enriched);
      } else {
        // Generate blocks from cards (12-column grid)
        let col = 0, row = 0;
        const genBlocks = cards.map(c => {
          const isChart = ['chart', 'pie', 'leaderboard', 'progress'].includes(c.card?.display_type);
          const w = isChart ? 6 : 3;
          const h = isChart ? 3 : 1;
          if (col + w > 12) { col = 0; row += 3; }
          const block = { i: c.card_id, x: col, y: row, w, h, type: 'query_card', card_id: c.card_id, card: c.card, data: c.data };
          col += w;
          if (col >= 12) { col = 0; row += h; }
          return block;
        });
        setBlocks(genBlocks);
      }
      setTemplateId(tpl.id);
      setTemplateName(tpl.name);
      setHasChanges(false);
    } catch { toast.error('Failed to load template'); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="space-y-5" data-testid="dashboard-loading">
      <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-64" /></div>
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  );

  const existingCardIds = blocks.map(b => b.card_id).filter(Boolean);

  return (
    <div className="space-y-4" data-testid="dashboard-page" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="dashboard-title">Dashboard</h1>
          <p className="text-sm text-gray-500">{templateName} · {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-9" data-testid="year-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadDashboard} data-testid="refresh-btn">
            <RefreshCw className="h-4 w-4" />
          </Button>

          {isAdmin && (
            <>
              <div className="h-6 w-px bg-gray-200" />
              <Button variant={editMode ? "default" : "outline"} size="sm"
                onClick={() => setEditMode(!editMode)}
                className={editMode ? "bg-[#800000] hover:bg-[#9a1919] text-white" : ""}
                data-testid="edit-mode-btn">
                {editMode ? <Unlock className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                {editMode ? 'Editing' : 'Edit Layout'}
              </Button>
              {editMode && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowAddCard(true)} data-testid="add-card-btn">
                    <Plus className="h-4 w-4 mr-1" /> Add Card
                  </Button>
                  {hasChanges && (
                    <Button size="sm" onClick={handleSaveLayout} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="save-layout-btn">
                      <Save className="h-4 w-4 mr-1" /> Save Layout
                    </Button>
                  )}
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowTemplateManager(true)} data-testid="template-manager-btn">
                <Settings className="h-4 w-4 mr-1" /> Templates
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between" data-testid="edit-mode-banner">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <GripVertical className="h-4 w-4" />
            <span className="font-medium">Layout Edit Mode</span>
            <span className="text-amber-600">— Drag to reorder, resize edges to resize cards</span>
          </div>
          {hasChanges && <Badge className="bg-amber-100 text-amber-700">Unsaved changes</Badge>}
        </div>
      )}

      {/* Grid Layout */}
      {blocks.length > 0 ? (
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768 }}
          cols={{ lg: 12, md: 8, sm: 4 }}
          rowHeight={80}
          width={containerWidth || 1200}
          isDraggable={editMode}
          isResizable={editMode}
          onLayoutChange={(currentLayout, allLayouts) => onLayoutChange(currentLayout)}
          draggableHandle="[data-testid='drag-handle']"
          compactor={verticalCompactor}
          margin={[16, 16]}
        >
          {blocks.map(block => (
            <div key={block.i || block.card_id} className="group"
              data-testid={`dashboard-block-${block.card_id}`}>
              <Card className="h-full overflow-hidden border-0 shadow-sm relative transition-shadow hover:shadow-lg"
                style={{ borderTop: `3px solid ${block.card?.color || '#800000'}` }}>
                {editMode && (
                  <button onClick={() => handleRemoveCard(block.i || block.card_id)}
                    className="absolute top-1.5 right-1.5 z-20 p-1 rounded-full bg-red-50 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100"
                    data-testid={`remove-card-${block.card_id}`}>
                    <X className="h-3.5 w-3.5 text-red-500" />
                  </button>
                )}
                <DashboardCard
                  card={block.card}
                  data={block.data}
                  editMode={editMode}
                  onEdit={isAdmin ? handleEditCard : null}
                />
              </Card>
            </div>
          ))}
        </ResponsiveGridLayout>
      ) : (
        <Card className="border-dashed border-2" data-testid="empty-dashboard">
          <CardContent className="p-12 text-center">
            <Layers className="h-16 w-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400">No Dashboard Configured</h3>
            <p className="text-gray-300 mb-4">
              {isAdmin ? 'Seed default cards or manage templates to get started' : 'Contact your admin to set up a dashboard template'}
            </p>
            {isAdmin && (
              <div className="flex gap-2 justify-center">
                <Button onClick={async () => {
                  try { await targetAPI.seedDefaultCards(); toast.success('Default cards created'); loadDashboard(); } catch { toast.error('Failed'); }
                }} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="seed-defaults-btn">
                  <Layers className="h-4 w-4 mr-1" /> Create Default Dashboard
                </Button>
                <Button variant="outline" onClick={() => setShowTemplateManager(true)}>
                  <Settings className="h-4 w-4 mr-1" /> Manage Templates
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <TemplateManagerDialog
        open={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        currentTemplateId={templateId}
        onSwitch={handleSwitchTemplate}
      />
      <AddCardDialog
        open={showAddCard}
        onClose={() => setShowAddCard(false)}
        existingCardIds={existingCardIds}
        onAdd={handleAddCard}
      />
      <QueryEditorDialog
        open={showEditor}
        onClose={() => { setShowEditor(false); setEditCard(null); }}
        card={editCard}
        onSave={handleSaveCard}
      />
    </div>
  );
}
