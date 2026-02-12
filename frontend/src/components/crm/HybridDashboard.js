import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { QueryEditorDialog } from './ConfigurableDashboard';
import {
  Target, TrendingUp, DollarSign, Trophy, AlertTriangle, Building2,
  Users, BarChart2, Pencil, RefreshCw, Layers, Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const ICONS = { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, Building2, Users, BarChart2, Activity };
const CHART_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

// ============ UNIVERSAL CARD RENDERER (all display types from query data) ============
function UniversalCard({ card, data, onEdit }) {
  const Icon = ICONS[card.icon] || Target;
  const groups = data?.groups || [];
  const isLarge = card.size === 'large' || card.display_type === 'chart' || card.display_type === 'leaderboard' || card.display_type === 'progress';

  return (
    <Card className={`overflow-hidden transition-all duration-200 hover:shadow-lg group relative border-0 shadow-sm ${isLarge ? 'col-span-2' : ''}`}
      style={{ borderTop: `3px solid ${card.color || '#800000'}` }}>
      {onEdit && (
        <button onClick={() => onEdit(card)} className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-white/80 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-100">
          <Pencil className="h-3.5 w-3.5 text-gray-400" />
        </button>
      )}
      <CardContent className="p-5">
        {/* NUMBER CARD */}
        {(card.display_type === 'number') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{card.name}</span>
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${card.color}12` }}>
                <Icon className="h-4 w-4" style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {card.aggregation === 'sum' || card.aggregation === 'avg' ? `OMR ${(data?.value || 0).toLocaleString()}` : (data?.value || 0).toLocaleString()}
            </p>
            {data?.count > 0 && <p className="text-xs text-gray-400 mt-1">{data.count} records</p>}
          </div>
        )}

        {/* WIN RATE (special number) */}
        {card.display_type === 'win_rate' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{card.name}</span>
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${card.color}12` }}>
                <TrendingUp className="h-4 w-4" style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
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
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{card.name}</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={groups.slice(0, 12)} margin={{ left: -10 }}>
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
        )}

        {/* PIE CHART */}
        {card.display_type === 'pie' && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{card.name}</h4>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={groups.slice(0, 8)} dataKey={card.aggregation === 'count' ? 'count' : 'total'} nameKey="label" cx="50%" cy="50%" innerRadius={25} outerRadius={60} paddingAngle={2}>
                    {groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [`OMR ${v.toLocaleString()}`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
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

        {/* LEADERBOARD (with avatars) */}
        {card.display_type === 'leaderboard' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">{card.name}</h4>
              <Badge variant="secondary" className="text-xs">{groups.reduce((s, g) => s + (g.count || 0), 0)} deals</Badge>
            </div>
            <div className="space-y-2.5">
              {groups.slice(0, 8).map((g, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-5">{idx + 1}</span>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                    {(g.label || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-700 truncate">{g.label || '-'}</span>
                  <span className="text-sm font-bold" style={{ color: card.color }}>OMR {(g.total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
            {groups.length > 0 && (
              <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-bold" style={{ color: card.color }}>OMR {groups.reduce((s, g) => s + (g.total || 0), 0).toLocaleString()}</span>
              </div>
            )}
            {groups.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No data</p>}
          </div>
        )}

        {/* PROGRESS BARS */}
        {card.display_type === 'progress' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">{card.name}</h4>
              <Badge variant="secondary" className="text-xs">{groups.reduce((s, g) => s + (g.count || 0), 0)} deals</Badge>
            </div>
            <div className="space-y-2.5">
              {(() => {
                const maxVal = Math.max(...groups.map(g => g.total || g.count || 0), 1);
                return groups.slice(0, 8).map((g, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-600 truncate flex-1">{g.label || '-'}</span>
                      <span className="text-gray-400 ml-2">{g.count || 0} deals</span>
                      <span className="font-semibold text-gray-900 ml-2">OMR {(g.total || 0).toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${((g.total || g.count || 0) / maxVal) * 100}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
            {groups.length > 0 && (
              <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-bold" style={{ color: card.color }}>OMR {groups.reduce((s, g) => s + (g.total || 0), 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* TABLE */}
        {card.display_type === 'table' && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{card.name}</h4>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {(data?.records || groups || []).slice(0, 10).map((r, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-gray-50 text-xs">
                  <span className="text-gray-600 truncate flex-1">{r.name || r.label || r.invoice_number || '-'}</span>
                  <span className="font-mono font-semibold text-gray-900 ml-2">OMR {(r.sale_value || r.total || r.amount_total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ MAIN DASHBOARD ============
export default function HybridDashboard() {
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [editCard, setEditCard] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await targetAPI.getMyDashboard(year);
      const data = res.data;
      setBlocks(data.blocks || []);
      setTemplateName(data.template?.name || 'Dashboard');
    } catch {} finally { setLoading(false); }
  }, [year]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleEditCard = (card) => {
    setEditCard({...card, filters: typeof card.filters === 'string' ? card.filters : JSON.stringify(card.filters || {}, null, 2)});
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

  // Group blocks by row
  const kpiRow = blocks.filter(b => b.y === 0);
  const chartRow = blocks.filter(b => b.y >= 1 && b.y < 4);
  const midRow = blocks.filter(b => b.y >= 4 && b.y < 7);
  const extraRow = blocks.filter(b => b.y >= 7);

  const renderBlock = (block) => {
    if (!block.card) return null;
    return <UniversalCard key={block.i} card={block.card} data={block.data} onEdit={handleEditCard} />;
  };

  if (loading) return (
    <div className="space-y-5">
      <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-32" /></div>
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{templateName} · {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" onClick={loadDashboard}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
        </div>
      </div>

      {/* KPI Row */}
      {kpiRow.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiRow.map(renderBlock)}
        </div>
      )}

      {/* Charts Row */}
      {chartRow.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {chartRow.map(renderBlock)}
        </div>
      )}

      {/* Mid Row */}
      {midRow.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {midRow.map(renderBlock)}
        </div>
      )}

      {/* Extra Row */}
      {extraRow.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {extraRow.map(renderBlock)}
        </div>
      )}

      {blocks.length === 0 && (
        <Card className="border-dashed border-2"><CardContent className="p-12 text-center">
          <Layers className="h-16 w-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400">No Dashboard Configured</h3>
          <p className="text-gray-300 mb-4">Go to Dashboard Builder to create and assign a template</p>
        </CardContent></Card>
      )}

      <QueryEditorDialog open={showEditor} onClose={() => { setShowEditor(false); setEditCard(null); }} card={editCard} onSave={handleSaveCard} />
    </div>
  );
}
