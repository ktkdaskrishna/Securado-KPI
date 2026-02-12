import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { targetAPI, crmAPI, analyticsAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RenderCard, QueryEditorDialog } from './ConfigurableDashboard';
import {
  Target, TrendingUp, DollarSign, Trophy, Users, Pencil, RefreshCw,
  BarChart2, Layers, Settings, Award, Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';

const STAGE_COLORS = { Qualified: '#3b82f6', Proposal: '#8b5cf6', Negotiation: '#f59e0b', 'Closed Won': '#10b981', Won: '#10b981', 'Closed Lost': '#ef4444', Lost: '#ef4444' };
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

// ==================== PREMIUM WIDGETS ====================

function KPISummaryWidget({ title, value, format, icon: Icon = Target, color = '#800000' }) {
  const formatted = format === 'currency' ? `OMR ${(value || 0).toLocaleString()}` 
    : format === 'percent' ? `${(value || 0).toFixed(1)}%`
    : (value || 0).toLocaleString();
  
  return (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 font-medium">{title}</span>
          <div className="p-2 rounded-full" style={{ backgroundColor: `${color}10` }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-900">{formatted}</p>
      </CardContent>
    </Card>
  );
}

function SalesLeaderboardWidget({ data, year }) {
  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-2"><CardTitle className="text-base">Sales Leaderboard</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(data || []).map((person, idx) => (
          <div key={person.name || idx} className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-400 w-5">{idx + 1}</span>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
              {(person.name || '?').charAt(0)}
            </div>
            <span className="flex-1 text-sm font-medium text-gray-700 truncate">{person.name}</span>
            <span className="text-sm font-bold text-gray-900">OMR {(person.value || 0).toLocaleString()}</span>
          </div>
        ))}
        {(!data || data.length === 0) && <p className="text-gray-400 text-sm text-center py-4">No data</p>}
      </CardContent>
    </Card>
  );
}

function PipelineByStageWidget({ data }) {
  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-2"><CardTitle className="text-base">Pipeline by Stage</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data || []}>
            <XAxis dataKey="stage" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000000 ? `OMR${(v/1000000).toFixed(1)}M` : v >= 1000 ? `OMR${(v/1000).toFixed(0)}K` : `OMR${v}`} width={70} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={v => [`OMR ${v.toLocaleString()}`]} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {(data || []).map((entry, i) => <Cell key={i} fill={STAGE_COLORS[entry.stage] || '#3b82f6'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function PMLeaderboardWidget({ data }) {
  const total = (data || []).reduce((s, p) => s + (p.won_value || 0), 0);
  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-yellow-500" /> Product Manager Leaderboard</CardTitle>
          <Badge variant="secondary">{(data || []).reduce((s, p) => s + (p.deals || 0), 0)} deals</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-400"><th className="text-left w-6">#</th><th className="text-left">Product Manager</th><th className="text-right">Won Value</th><th className="text-right">Deals</th></tr></thead>
          <tbody>
            {(data || []).map((pm, idx) => (
              <tr key={pm.name || idx} className="border-t border-gray-50">
                <td className="py-2 text-gray-400">{idx + 1}</td>
                <td className="py-2 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                    {(pm.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <span className="truncate">{pm.name}</span>
                </td>
                <td className="py-2 text-right font-bold text-[#800000]">OMR {(pm.won_value || 0).toLocaleString()}</td>
                <td className="py-2 text-right text-gray-500">{pm.deals || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 pt-3 border-t flex justify-between text-sm">
          <span className="text-gray-500">Total Won Value</span>
          <span className="font-bold text-[#800000]">OMR {total.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryPerformanceWidget({ data }) {
  const total = (data || []).reduce((s, c) => s + (c.value || 0), 0);
  const maxVal = Math.max(...(data || []).map(c => c.value || 0), 1);
  const catColors = ['#06b6d4', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
  
  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Solution Category Performance</CardTitle>
          <Badge variant="secondary">{(data || []).reduce((s, c) => s + (c.deals || 0), 0)} deals</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {(data || []).map((cat, idx) => (
          <div key={cat.name || idx}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-600 truncate flex-1">{cat.name}</span>
              <span className="text-gray-400 ml-2">{cat.deals} deals</span>
              <span className="font-semibold text-gray-900 ml-2">OMR {(cat.value || 0).toLocaleString()}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(cat.value / maxVal) * 100}%`, backgroundColor: catColors[idx % catColors.length] }} />
            </div>
          </div>
        ))}
        <div className="pt-2 border-t flex justify-between text-sm">
          <span className="text-gray-500">Total Won Value</span>
          <span className="font-bold text-[#800000]">OMR {total.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== MAIN HYBRID DASHBOARD ====================

export default function HybridDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [editCard, setEditCard] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // Load both: the template blocks + the traditional dashboard stats
      const [templateRes, statsRes] = await Promise.allSettled([
        targetAPI.getMyDashboard(year),
        crmAPI.getDashboardStats({ year }),
      ]);
      
      const template = templateRes.status === 'fulfilled' ? templateRes.value.data : null;
      const stats = statsRes.status === 'fulfilled' ? statsRes.value.data : {};
      
      // Map dashboard stats to widget data
      const leaderboard = (stats.leaderboard || []).map(l => ({
        name: l.name, value: l.value || l.won_value || 0, deals: l.deals_won || 0
      }));
      
      const stageData = Object.entries(stats.stage_values || {}).map(([stage, value]) => ({
        stage, value, count: (stats.stage_counts || {})[stage] || 0
      }));
      
      // PM data from pipeline_by_stage or a separate call
      let pmData = [];
      let categoryData = [];
      try {
        const pmRes = await analyticsAPI.getTeamPerformance({ year });
        if (pmRes.data?.product_managers) {
          pmData = pmRes.data.product_managers.map(pm => ({
            name: pm.name, won_value: pm.won_value || 0, deals: pm.won_deals || pm.total_opps || 0
          }));
        }
        if (pmRes.data?.solution_categories) {
          categoryData = pmRes.data.solution_categories.map(c => ({
            name: c.category || c.name, value: c.won_value || 0, deals: c.won_count || c.count || 0
          }));
        }
      } catch {}
      
      setDashData({ template, stats, leaderboard, pmData, categoryData, stageData });
    } catch {} finally { setLoading(false); }
  }, [year]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) return (
    <div className="space-y-4">
      <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-8 w-32" /></div>
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  );

  const stats = dashData?.stats || {};
  const blocks = dashData?.template?.blocks || [];

  // Render blocks based on their type
  const renderBlock = (block) => {
    if (block.type === 'premium_widget') {
      switch (block.widget) {
        case 'kpi_summary': {
          const metricMap = {
            total_pipeline: { value: stats.total_pipeline, icon: DollarSign, color: '#3b82f6' },
            win_rate: { value: stats.win_rate, icon: TrendingUp, color: '#10b981' },
            open_opportunities: { value: stats.open_opportunities, icon: Target, color: '#6366f1' },
            won_value: { value: stats.won_value, icon: Trophy, color: '#f59e0b' },
          };
          const m = metricMap[block.config?.metric] || { value: 0 };
          return <KPISummaryWidget key={block.i} title={block.config?.title || ''} value={m.value} format={block.config?.format} icon={m.icon} color={m.color} />;
        }
        case 'pipeline_by_stage':
          return <PipelineByStageWidget key={block.i} data={dashData?.stageData} />;
        case 'sales_leaderboard':
          return <SalesLeaderboardWidget key={block.i} data={dashData?.leaderboard} year={year} />;
        case 'pm_leaderboard':
          return <PMLeaderboardWidget key={block.i} data={dashData?.pmData} />;
        case 'category_performance':
          return <CategoryPerformanceWidget key={block.i} data={dashData?.categoryData} />;
        default:
          return <Card key={block.i}><CardContent className="p-4 text-gray-400">Unknown widget: {block.widget}</CardContent></Card>;
      }
    } else if (block.type === 'query_card' && block.card && block.data) {
      return <RenderCard key={block.i} card={block.card} data={block.data}
        onEdit={c => { setEditCard(c); setShowEditor(true); }}
        showControls={true} />;
    }
    return null;
  };

  // Group blocks by row (y position)
  const kpiBlocks = blocks.filter(b => b.y === 0);
  const row2Blocks = blocks.filter(b => b.y >= 1 && b.y < 4);
  const row3Blocks = blocks.filter(b => b.y >= 4 && b.y < 7);
  const extraBlocks = blocks.filter(b => b.y >= 7);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{stats.total_filtered || blocks.length} opportunities · {year}</p>
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
      {kpiBlocks.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiBlocks.map(renderBlock)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPISummaryWidget title="Total Pipeline" value={stats.total_pipeline} format="currency" icon={DollarSign} color="#3b82f6" />
          <KPISummaryWidget title="Win Rate" value={stats.win_rate} format="percent" icon={TrendingUp} color="#10b981" />
          <KPISummaryWidget title="Open Opportunities" value={stats.open_opportunities} format="number" icon={Target} color="#6366f1" />
          <KPISummaryWidget title="Won This Period" value={stats.won_value} format="currency" icon={Trophy} color="#f59e0b" />
        </div>
      )}

      {/* Charts Row */}
      {row2Blocks.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {row2Blocks.map(renderBlock)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PipelineByStageWidget data={dashData?.stageData} />
          <SalesLeaderboardWidget data={dashData?.leaderboard} year={year} />
        </div>
      )}

      {/* PM + Categories Row */}
      {row3Blocks.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {row3Blocks.map(renderBlock)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PMLeaderboardWidget data={dashData?.pmData} />
          <CategoryPerformanceWidget data={dashData?.categoryData} />
        </div>
      )}

      {/* Extra query cards */}
      {extraBlocks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {extraBlocks.map(renderBlock)}
        </div>
      )}

      <QueryEditorDialog open={showEditor} onClose={() => { setShowEditor(false); setEditCard(null); }} card={editCard}
        onSave={async (formData) => { try { if (editCard?.id) { await targetAPI.updateCard(editCard.id, formData); } else { await targetAPI.createCard(formData); } toast.success('Saved'); setShowEditor(false); loadDashboard(); } catch { toast.error('Failed'); } }} />
    </div>
  );
}
