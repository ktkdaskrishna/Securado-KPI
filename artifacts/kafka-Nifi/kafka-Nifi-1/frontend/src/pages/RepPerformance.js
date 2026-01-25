import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { kpiAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Trophy, Target, Calendar, TrendingUp, Users } from 'lucide-react';

const formatCurrency = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const KPICard = ({ title, value, format = 'number', icon: Icon, subtitle, loading }) => {
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

  const formattedValue = format === 'currency' ? formatCurrency(value) : 
                         format === 'percent' ? `${value}%` : value;

  return (
    <Card className="bg-card/80 border-border/60 hover:border-border transition-colors" data-testid="kpi-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs text-muted-foreground font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-2xl tracking-tight tabular-nums" data-testid="kpi-value">
          {formattedValue}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
};

const RepPerformance = () => {
  const { currentTenant } = useOutletContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ['rep-performance', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const res = await kpiAPI.getRepPerformance(currentTenant.id);
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
        <h1 className="text-2xl font-bold tracking-tight">Rep Performance</h1>
        <p className="text-muted-foreground">Individual and team performance metrics</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        <KPICard
          title="Quota Attainment"
          value={data?.kpis?.quota_attainment?.value || 0}
          format="percent"
          icon={Target}
          loading={isLoading}
        />
        <KPICard
          title="Team Win Rate"
          value={data?.kpis?.team_win_rate?.value || 0}
          format="percent"
          icon={Trophy}
          loading={isLoading}
        />
        <KPICard
          title="Total Meetings"
          value={data?.kpis?.total_meetings?.value || 0}
          icon={Calendar}
          loading={isLoading}
        />
        <KPICard
          title="Revenue Closed"
          value={data?.kpis?.total_closed?.value || 0}
          format="currency"
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Quota Attainment Trend */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Quota Attainment Trend</CardTitle>
            <CardDescription>Weekly progress toward quota</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="quota-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.performance_trend || []}>
                    <CartesianGrid stroke="hsla(0, 0%, 100%, 0.06)" vertical={false} />
                    <XAxis dataKey="week" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <YAxis stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} unit="%" />
                    <Tooltip
                      contentStyle={{ background: 'rgba(24, 28, 34, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="quota_attainment"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-1))' }}
                      name="Attainment %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rep Comparison */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Revenue by Rep</CardTitle>
            <CardDescription>Comparison of closed revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="rep-comparison-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data?.rep_details || []).slice(0, 8)} layout="vertical">
                    <CartesianGrid stroke="hsla(0, 0%, 100%, 0.06)" horizontal={false} />
                    <XAxis type="number" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} tickFormatter={formatCurrency} />
                    <YAxis type="category" dataKey="name" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={11} width={80} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(24, 28, 34, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Bar dataKey="won_amount" name="Won Revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rep Details Table */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">All Sales Representatives</CardTitle>
          <CardDescription>Detailed performance breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto" data-testid="rep-performance-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Name</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Pipeline</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Won</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Total Deals</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Won Deals</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rep_details || []).map((rep, index) => (
                    <tr key={rep.user_id} className="border-b border-border/40 hover:bg-muted/20" data-testid="table-row">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{rep.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 tabular-nums">{formatCurrency(rep.pipeline_amount)}</td>
                      <td className="text-right py-3 px-4 tabular-nums text-[hsl(var(--success))]">{formatCurrency(rep.won_amount)}</td>
                      <td className="text-right py-3 px-4 tabular-nums">{rep.total_deals}</td>
                      <td className="text-right py-3 px-4 tabular-nums">{rep.won_deals}</td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={rep.win_rate} className="w-16 h-2" />
                          <span className="text-xs tabular-nums w-10 text-right">{rep.win_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RepPerformance;
