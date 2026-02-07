import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Phone, Mail, Calendar, Monitor, FlaskConical, Presentation,
  TrendingUp, Users, Trophy, BarChart2, Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';

const activityIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  demo: Monitor,
  poc: FlaskConical,
  workshop: Presentation,
};

const activityColors = {
  call: '#3b82f6',
  email: '#8b5cf6',
  meeting: '#10b981',
  demo: '#f59e0b',
  poc: '#ef4444',
  workshop: '#06b6d4',
};

function ActivitySummaryCards({ summary }) {
  const byType = summary.by_type || {};
  const types = Object.keys(byType);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="activity-summary-cards">
      <Card className="bg-[#1a1a1a] border-[#333] col-span-full md:col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-[#800000]" />
            <span className="text-xs text-gray-400">Overall Achievement</span>
          </div>
          <p className="text-2xl font-bold text-white">{summary.overall_achievement_pct || 0}%</p>
          <Progress value={Math.min(summary.overall_achievement_pct || 0, 100)} className="h-1.5 bg-[#333] mt-2" />
          <p className="text-xs text-gray-500 mt-1">{summary.total_actual_count || 0} / {summary.total_target_count || 0} activities</p>
        </CardContent>
      </Card>
      {types.map(type => {
        const Icon = activityIcons[type] || Activity;
        const data = byType[type];
        return (
          <Card key={type} className="bg-[#1a1a1a] border-[#333] hover:border-[#800000]/40 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4" style={{ color: activityColors[type] || '#666' }} />
                <span className="text-xs text-gray-400 capitalize">{type}s</span>
              </div>
              <p className="text-lg font-bold text-white">{data.actual_count} / {data.target_count}</p>
              <Progress value={Math.min(data.achievement_pct, 100)} className="h-1.5 bg-[#333] mt-1" />
              <p className="text-xs mt-1" style={{ color: data.achievement_pct >= 100 ? '#10b981' : data.achievement_pct >= 70 ? '#f59e0b' : '#ef4444' }}>
                {data.achievement_pct}%
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ActivityChart({ summary }) {
  const byType = summary.by_type || {};
  const chartData = Object.entries(byType).map(([type, data]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    target: data.target_count,
    actual: data.actual_count,
    color: activityColors[type] || '#666',
  }));

  if (!chartData.length) return null;

  return (
    <Card className="bg-[#1a1a1a] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-[#800000]" /> Activity Target vs Actual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} barGap={4}>
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#222', border: '1px solid #444', borderRadius: '8px', color: '#fff' }} />
            <Bar dataKey="target" fill="#444" radius={[4, 4, 0, 0]} name="Target" />
            <Bar dataKey="actual" radius={[4, 4, 0, 0]} name="Actual">
              {chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ScoreboardTable({ scoreboard }) {
  if (!scoreboard.length) return <p className="text-gray-500 text-sm text-center py-4">No scoreboard data</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#333] hover:bg-transparent">
          <TableHead className="text-gray-400 w-10">#</TableHead>
          <TableHead className="text-gray-400">Name</TableHead>
          <TableHead className="text-gray-400 text-right">Total Target</TableHead>
          <TableHead className="text-gray-400 text-right">Completed</TableHead>
          <TableHead className="text-gray-400 text-right">Score</TableHead>
          <TableHead className="text-gray-400">Breakdown</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {scoreboard.map((entry, idx) => (
          <TableRow key={entry.user_id} className="border-[#333] hover:bg-[#222]" data-testid={`scoreboard-row-${idx}`}>
            <TableCell className="text-white font-bold">
              {idx === 0 ? <Trophy className="h-4 w-4 text-yellow-400" /> : idx + 1}
            </TableCell>
            <TableCell className="text-white font-medium">{entry.user_name}</TableCell>
            <TableCell className="text-gray-400 text-right">{entry.total_target}</TableCell>
            <TableCell className="text-white text-right">{entry.total_actual}</TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className={
                entry.achievement_pct >= 100 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                entry.achievement_pct >= 70 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                'bg-red-500/10 text-red-400 border-red-500/30'
              }>{entry.achievement_pct}%</Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(entry.activities || {}).map(([type, data]) => {
                  const Icon = activityIcons[type] || Activity;
                  return (
                    <span key={type} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[#333] text-gray-300">
                      <Icon className="h-3 w-3" style={{ color: activityColors[type] }} />
                      {data.actual}/{data.target}
                    </span>
                  );
                })}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ActivityTrackerPage() {
  const [summary, setSummary] = useState({});
  const [scoreboard, setScoreboard] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('monthly');
  const [activeTab, setActiveTab] = useState('dashboard');

  const loadData = useCallback(async () => {
    try {
      const [summaryRes, scoreboardRes, targetsRes] = await Promise.all([
        targetAPI.getActivityTargetsSummary({ period_type: periodFilter }),
        targetAPI.getActivityScoreboard({ period_type: periodFilter }),
        targetAPI.listActivityTargets({ period_type: periodFilter }),
      ]);
      setSummary(summaryRes.data);
      setScoreboard(scoreboardRes.data);
      setTargets(targetsRes.data);
    } catch {
      toast.error('Failed to load activity data');
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogActivity = async (targetId) => {
    try {
      await targetAPI.logActivityCount(targetId, 1);
      toast.success('Activity logged');
      loadData();
    } catch {
      toast.error('Failed to log activity');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6" data-testid="activity-tracker-loading">
        {[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-[#222]" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto" data-testid="activity-tracker-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-[#800000]" /> Activity Tracker
          </h1>
          <p className="text-sm text-gray-400 mt-1">Monitor sales activity performance against targets</p>
        </div>
        <Select value={periodFilter} onValueChange={v => { setPeriodFilter(v); setLoading(true); }}>
          <SelectTrigger className="w-32 bg-[#222] border-[#444] text-white" data-testid="activity-period-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#222] border-[#444]">
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <ActivitySummaryCards summary={summary} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#222] border border-[#333]">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">Dashboard</TabsTrigger>
          <TabsTrigger value="scoreboard" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">Scoreboard</TabsTrigger>
          <TabsTrigger value="all-targets" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">All Targets</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <ActivityChart summary={summary} />
        </TabsContent>

        <TabsContent value="scoreboard" className="mt-4">
          <Card className="bg-[#1a1a1a] border-[#333]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" /> Activity Scoreboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreboardTable scoreboard={scoreboard} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-targets" className="mt-4">
          <Card className="bg-[#1a1a1a] border-[#333]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Individual Activity Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#333]">
                    <TableHead className="text-gray-400">Activity</TableHead>
                    <TableHead className="text-gray-400">Assigned To</TableHead>
                    <TableHead className="text-gray-400">Type</TableHead>
                    <TableHead className="text-gray-400 text-right">Progress</TableHead>
                    <TableHead className="text-gray-400 text-right">%</TableHead>
                    <TableHead className="text-gray-400 w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map(t => {
                    const Icon = activityIcons[t.activity_type] || Activity;
                    const pct = t.progress_pct || 0;
                    return (
                      <TableRow key={t.id} className="border-[#333] hover:bg-[#222]" data-testid={`activity-target-row-${t.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" style={{ color: activityColors[t.activity_type] }} />
                            <span className="text-white text-sm">{t.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm">{t.assigned_to_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize" style={{ borderColor: activityColors[t.activity_type], color: activityColors[t.activity_type] }}>
                            {t.activity_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-white text-sm">{t.current_count || 0} / {t.target_count}</TableCell>
                        <TableCell className="text-right">
                          <span className={pct >= 100 ? 'text-emerald-400' : pct >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                            {pct}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="h-7 text-xs border-[#444] text-gray-300 hover:bg-[#800000] hover:text-white hover:border-[#800000]"
                            onClick={() => handleLogActivity(t.id)} data-testid={`log-activity-${t.id}`}>
                            +1
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {targets.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-6">No activity targets found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
