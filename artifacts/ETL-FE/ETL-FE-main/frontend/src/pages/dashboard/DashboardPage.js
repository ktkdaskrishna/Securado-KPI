import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { MetricCard } from '../../components/common';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  Users,
  Target,
  Activity,
  RefreshCw,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

const fetchDashboardStats = async () => {
  const response = await apiClient.get('/dashboard/stats');
  return response.data;
};

const formatCurrency = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value}`;
};

const formatNumber = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value;
};

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const DashboardPage = () => {
  const queryClient = useQueryClient();

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiClient.post('/dashboard/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard-stats']);
      toast.success('Dashboard refreshed');
    },
    onError: () => {
      toast.error('Failed to refresh dashboard');
    },
  });

  // Transform pipeline data for bar chart - handle Platform 2 format
  const pipelineData = stats?.pipeline_by_stage || 
    (stats?.stage_counts ? Object.entries(stats.stage_counts).map(([stage, count]) => ({
      stage: stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: count,
      count: count
    })) : []);
  
  // Transform activity data for pie chart
  const activityData = stats?.activity_stats
    ? Object.entries(stats.activity_stats).map(([name, value]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value,
      }))
    : [];

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
        </div>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Failed to load dashboard data</p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => queryClient.invalidateQueries(['dashboard-stats'])}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of your sales performance</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          data-testid="refresh-dashboard-button"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Pipeline"
          value={isLoading ? '-' : formatCurrency(stats?.total_pipeline || stats?.total_value || 0)}
          delta={stats?.pipeline_change}
          positive={stats?.pipeline_change > 0}
          icon={DollarSign}
          loading={isLoading}
        />
        <MetricCard
          label="Won Deals"
          value={isLoading ? '-' : formatCurrency(stats?.won_value || 0)}
          deltaLabel={`${stats?.won_count || 0} deals`}
          positive={true}
          icon={CheckCircle2}
          loading={isLoading}
        />
        <MetricCard
          label="Open Opportunities"
          value={isLoading ? '-' : formatNumber(stats?.open_count || stats?.total_opportunities || 0)}
          delta={stats?.open_change}
          positive={stats?.open_change > 0}
          icon={Target}
          loading={isLoading}
        />
        <MetricCard
          label="Win Rate"
          value={isLoading ? '-' : `${stats?.win_rate || 0}%`}
          delta={stats?.win_rate_change}
          positive={stats?.win_rate_change > 0}
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pipeline by Stage */}
        <Card className="lg:col-span-8" data-testid="pipeline-chart-card">
          <CardHeader>
            <CardTitle className="text-lg">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80" />
            ) : pipelineData.length > 0 ? (
              <div className="h-80" data-testid="pipeline-bar-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} layout="vertical">
                    <XAxis
                      type="number"
                      tickFormatter={formatCurrency}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value) => [formatCurrency(value), 'Value']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {pipelineData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                No pipeline data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Stats */}
        <Card className="lg:col-span-4" data-testid="activity-chart-card">
          <CardHeader>
            <CardTitle className="text-lg">Activity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80" />
            ) : activityData.length > 0 ? (
              <div className="h-80" data-testid="activity-pie-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activityData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {activityData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span style={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                No activity data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <Card data-testid="recent-activities-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity size={18} />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-1" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recent_activities?.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_activities.slice(0, 5).map((activity, i) => (
                  <div
                    key={activity.id || i}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.title || activity.type}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.description || activity.subject}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activities
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Leaderboard */}
        <Card data-testid="leaderboard-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users size={18} />
              Team Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : stats?.leaderboard?.length > 0 ? (
              <div className="space-y-2">
                {stats.leaderboard.slice(0, 5).map((user, i) => (
                  <div
                    key={user.id || i}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0
                          ? 'bg-[hsl(var(--chart-4))] text-background'
                          : i === 1
                          ? 'bg-gray-400 text-background'
                          : i === 2
                          ? 'bg-amber-700 text-background'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <span className="flex-1 text-sm font-medium truncate">
                      {user.name}
                    </span>
                    <span className="text-sm text-primary font-semibold">
                      {formatCurrency(user.value || user.total)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No leaderboard data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
