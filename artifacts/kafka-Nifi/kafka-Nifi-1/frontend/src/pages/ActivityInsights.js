import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { kpiAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Mail, Phone, Calendar, Zap, TrendingUp } from 'lucide-react';

const KPICard = ({ title, value, icon: Icon, trend, loading }) => {
  if (loading) {
    return (
      <Card className="bg-card/80 border-border/60">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 border-border/60 hover:border-border transition-colors" data-testid="kpi-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs text-muted-foreground font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-2">
        <div className="font-semibold text-2xl tracking-tight tabular-nums" data-testid="kpi-value">
          {value.toLocaleString()}
        </div>
        {trend !== undefined && (
          <Badge variant="outline" className="border-border/60 gap-1" data-testid="kpi-delta">
            <TrendingUp className="h-3 w-3 text-[hsl(var(--success))]" />
            {trend}%
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

const ACTIVITY_COLORS = {
  emails: 'hsl(var(--chart-1))',
  calls: 'hsl(var(--chart-2))',
  meetings: 'hsl(var(--chart-3))',
  tasks: 'hsl(var(--chart-4))',
};

const ActivityInsights = () => {
  const { currentTenant } = useOutletContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ['activity-insights', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const res = await kpiAPI.getActivityInsights(currentTenant.id, 30);
      return res.data;
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 60000,
  });

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a tenant to view data</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading data. Please try seeding data first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Insights</h1>
        <p className="text-muted-foreground">Track sales activities and engagement</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        <KPICard
          title="Emails Sent"
          value={data?.kpis?.emails?.value || 0}
          icon={Mail}
          trend={12}
          loading={isLoading}
        />
        <KPICard
          title="Calls Made"
          value={data?.kpis?.calls?.value || 0}
          icon={Phone}
          trend={8}
          loading={isLoading}
        />
        <KPICard
          title="Meetings Held"
          value={data?.kpis?.meetings?.value || 0}
          icon={Calendar}
          trend={15}
          loading={isLoading}
        />
        <KPICard
          title="Total Touchpoints"
          value={data?.kpis?.touchpoints?.value || 0}
          icon={Zap}
          trend={10}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Activity Trend */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Activity Trend</CardTitle>
            <CardDescription>Daily activities over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="activity-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.activity_trend || []}>
                    <defs>
                      <linearGradient id="actFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsla(0, 0%, 100%, 0.06)" vertical={false} />
                    <XAxis dataKey="date" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <YAxis stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(24, 28, 34, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--chart-1))"
                      fill="url(#actFill)"
                      strokeWidth={2}
                      name="Activities"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity by Type */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Activity by Type</CardTitle>
            <CardDescription>Distribution of activity types</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="activity-type-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.activity_by_type || []}>
                    <CartesianGrid stroke="hsla(0, 0%, 100%, 0.06)" vertical={false} />
                    <XAxis dataKey="type" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <YAxis stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(24, 28, 34, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                      {(data?.activity_by_type || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={ACTIVITY_COLORS[entry.type] || 'hsl(var(--chart-5))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Cards */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Activity Breakdown</CardTitle>
          <CardDescription>Detailed view of activities by type</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="activity-breakdown">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-5 w-5 text-[hsl(var(--chart-1))]" />
                  <span className="text-sm font-medium">Emails</span>
                </div>
                <div className="text-2xl font-bold tabular-nums">{data?.kpis?.emails?.value || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Last 30 days</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-5 w-5 text-[hsl(var(--chart-2))]" />
                  <span className="text-sm font-medium">Calls</span>
                </div>
                <div className="text-2xl font-bold tabular-nums">{data?.kpis?.calls?.value || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Last 30 days</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-[hsl(var(--chart-3))]" />
                  <span className="text-sm font-medium">Meetings</span>
                </div>
                <div className="text-2xl font-bold tabular-nums">{data?.kpis?.meetings?.value || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Last 30 days</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-[hsl(var(--chart-4))]" />
                  <span className="text-sm font-medium">Tasks</span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {(data?.activity_by_type?.find(a => a.type === 'tasks')?.count) || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Last 30 days</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityInsights;
