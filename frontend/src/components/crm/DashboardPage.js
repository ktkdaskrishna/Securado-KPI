import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { TrendingUp, TrendingDown, DollarSign, Target, Users, Activity, RefreshCw, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';

export function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { formatCurrency, currency } = useCurrency();

  const loadStats = async () => {
    try {
      const res = await crmAPI.getDashboardStats();
      setStats(res.data);
    } catch (error) {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await crmAPI.refreshDashboard();
      await loadStats();
      toast.success('Dashboard refreshed');
    } catch (error) {
      toast.error('Failed to refresh dashboard');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'Total Pipeline',
      value: stats?.total_pipeline || 0,
      change: stats?.pipeline_change || 0,
      format: 'currency',
      icon: DollarSign,
      color: 'cyan',
    },
    {
      title: 'Win Rate',
      value: stats?.win_rate || 0,
      change: stats?.win_rate_change || 0,
      format: 'percent',
      icon: Target,
      color: 'emerald',
    },
    {
      title: 'Open Opportunities',
      value: stats?.open_count || 0,
      change: stats?.open_change || 0,
      format: 'number',
      icon: TrendingUp,
      color: 'blue',
    },
    {
      title: 'Won This Period',
      value: stats?.won_value || 0,
      change: 0,
      format: 'currency',
      icon: Zap,
      color: 'amber',
    },
  ];

  const formatValue = (value, format) => {
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your sales performance</p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          disabled={refreshing}
          data-testid="dashboard-refresh-button"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <Card key={index} data-testid={`crm-kpi-card-${kpi.title.toLowerCase().replace(/\s/g, '-')}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
                  <p className="text-2xl font-bold mt-1">{formatValue(kpi.value, kpi.format)}</p>
                </div>
                <div className={`p-3 rounded-full bg-${kpi.color}-100`}>
                  <kpi.icon className={`h-6 w-6 text-${kpi.color}-600`} />
                </div>
              </div>
              {kpi.change !== 0 && (
                <div className="flex items-center mt-2">
                  {kpi.change > 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={kpi.change > 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {kpi.change > 0 ? '+' : ''}{kpi.change.toFixed(1)}%
                  </span>
                  <span className="text-gray-500 text-sm ml-1">vs last period</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="crm-pipeline-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.pipeline_by_stage || []}>
                  <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(value), 'Value']}
                    labelFormatter={(label) => `Stage: ${label}`}
                  />
                  <Bar dataKey="value" fill="hsl(190, 90%, 40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64" data-testid="crm-leaderboard-table">
              <div className="space-y-4">
                {(stats?.leaderboard || []).map((person, index) => (
                  <div key={person.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                        ${index === 0 ? 'bg-amber-100 text-amber-700' : 
                          index === 1 ? 'bg-gray-100 text-gray-700' : 
                          index === 2 ? 'bg-orange-100 text-orange-700' : 
                          'bg-gray-50 text-gray-500'}`}>
                        {index + 1}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-sm font-medium">
                        {person.name.charAt(0)}
                      </div>
                      <span className="font-medium">{person.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(person.value)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Activity Stats and Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Calls', value: stats?.activity_stats?.calls || 0, color: 'blue' },
                { label: 'Emails', value: stats?.activity_stats?.emails || 0, color: 'cyan' },
                { label: 'Meetings', value: stats?.activity_stats?.meetings || 0, color: 'emerald' },
                { label: 'Tasks', value: stats?.activity_stats?.tasks || 0, color: 'amber' },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-500">{item.label}</p>
                  <p className="text-2xl font-bold mt-1">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center justify-between">
                <span className="text-emerald-700 font-medium">Completed</span>
                <span className="text-2xl font-bold text-emerald-700">
                  {stats?.activity_stats?.completed || 0} / {stats?.activity_stats?.total || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-4">
                {(stats?.recent_activities || []).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No recent activities</p>
                ) : (
                  stats?.recent_activities.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Activity className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{activity.subject}</p>
                        <p className="text-xs text-gray-500">{activity.type} • {activity.owner_name}</p>
                      </div>
                      <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'}>
                        {activity.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
