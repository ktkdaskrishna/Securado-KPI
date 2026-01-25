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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { AlertTriangle, Clock, TrendingDown, GitBranch } from 'lucide-react';

const formatCurrency = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const KPICard = ({ title, value, format = 'number', icon: Icon, status = 'default', subtitle, loading }) => {
  const statusColors = {
    default: 'border-border/60',
    warning: 'border-[hsl(var(--warning))]/50',
    critical: 'border-[hsl(var(--danger))]/50',
  };

  const statusIcons = {
    default: null,
    warning: <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />,
    critical: <AlertTriangle className="h-4 w-4 text-[hsl(var(--danger))]" />,
  };

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
                         format === 'percent' ? `${value}%` : 
                         format === 'days' ? `${value} days` : value;

  return (
    <Card className={`bg-card/80 hover:border-border transition-colors ${statusColors[status]}`} data-testid="kpi-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs text-muted-foreground font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {statusIcons[status]}
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
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

const FUNNEL_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
];

const PipelineHealth = () => {
  const { currentTenant } = useOutletContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ['pipeline-health', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const res = await kpiAPI.getPipelineHealth(currentTenant.id);
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
        <h1 className="text-2xl font-bold tracking-tight">Pipeline Health</h1>
        <p className="text-muted-foreground">Monitor your sales pipeline efficiency</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        <KPICard
          title="Stage Conversion"
          value={data?.kpis?.stage_conversion?.value || 0}
          format="percent"
          icon={GitBranch}
          loading={isLoading}
        />
        <KPICard
          title="Stalled Deals"
          value={data?.kpis?.stalled_deals?.value || 0}
          icon={AlertTriangle}
          status={data?.kpis?.stalled_deals?.value > 10 ? 'warning' : 'default'}
          subtitle="Not updated in 14+ days"
          loading={isLoading}
        />
        <KPICard
          title="Avg Sales Cycle"
          value={data?.kpis?.velocity_days?.avg_cycle_days || 0}
          format="days"
          icon={Clock}
          loading={isLoading}
        />
        <KPICard
          title="Pipeline Leakage"
          value={data?.kpis?.leakage?.value || 0}
          format="percent"
          icon={TrendingDown}
          status={data?.kpis?.leakage?.value > 20 ? 'critical' : 'default'}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Pipeline Funnel</CardTitle>
            <CardDescription>Deal distribution by stage</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="pipeline-funnel-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.pipeline_funnel || []}>
                    <CartesianGrid stroke="hsla(0, 0%, 100%, 0.06)" vertical={false} />
                    <XAxis dataKey="stage" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <YAxis stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(24, 28, 34, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" name="Deals" radius={[4, 4, 0, 0]}>
                      {(data?.pipeline_funnel || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aging Distribution */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Deal Aging Distribution</CardTitle>
            <CardDescription>How long deals stay in pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="aging-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.aging_distribution || []}
                      dataKey="count"
                      nameKey="range"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ range, count }) => `${range}: ${count}`}
                    >
                      {(data?.aging_distribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'rgba(24, 28, 34, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stalled Deals Table */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Stalled Deals</CardTitle>
          <CardDescription>Deals not updated in 14+ days - needs attention</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.stalled_deals?.length > 0 ? (
            <div className="overflow-x-auto" data-testid="stalled-deals-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Deal Name</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Stage</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Amount</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Days Stalled</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stalled_deals.map((deal) => (
                    <tr key={deal.id} className="border-b border-border/40 hover:bg-muted/20" data-testid="table-row">
                      <td className="py-3 px-4 font-medium">{deal.name}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="border-border/60">{deal.stage}</Badge>
                      </td>
                      <td className="text-right py-3 px-4 tabular-nums">{formatCurrency(deal.amount)}</td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="outline" className={deal.days_stalled > 21 ? 'border-[hsl(var(--danger))]/50 text-[hsl(var(--danger))]' : 'border-[hsl(var(--warning))]/50 text-[hsl(var(--warning))]'}>
                          {deal.days_stalled} days
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground" data-testid="table-empty-state">
              No stalled deals - great job keeping things moving!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PipelineHealth;
