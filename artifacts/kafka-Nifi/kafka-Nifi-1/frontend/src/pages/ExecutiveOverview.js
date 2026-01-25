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
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, Calendar } from 'lucide-react';

const formatCurrency = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const KPICard = ({ title, value, format = 'number', icon: Icon, delta, status = 'default', loading }) => {
  const statusColors = {
    default: '',
    warning: 'border-[hsl(var(--warning))]',
    critical: 'border-[hsl(var(--danger))]',
  };

  if (loading) {
    return (
      <Card className="kpi-card bg-card/80 border-border/60">
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
    <Card className={`kpi-card bg-card/80 border-border/60 hover:border-border transition-colors ${statusColors[status]}`} data-testid="kpi-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs text-muted-foreground font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-2">
        <div className="font-semibold text-2xl tracking-tight tabular-nums" data-testid="kpi-value">
          {formattedValue}
        </div>
        {delta !== undefined && (
          <Badge variant="outline" className="border-border/60 gap-1" data-testid="kpi-delta">
            {delta >= 0 ? (
              <TrendingUp className="h-3 w-3 text-[hsl(var(--success))]" />
            ) : (
              <TrendingDown className="h-3 w-3 text-[hsl(var(--danger))]" />
            )}
            {Math.abs(delta)}%
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="text-sm font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const STAGE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const ExecutiveOverview = () => {
  const { currentTenant } = useOutletContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ['executive-overview', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const res = await kpiAPI.getExecutiveOverview(currentTenant.id);
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
        <h1 className="text-2xl font-bold tracking-tight">Executive Overview</h1>
        <p className="text-muted-foreground">Key sales metrics at a glance</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        <KPICard
          title="Pipeline Amount"
          value={data?.kpis?.pipeline_amount?.value || 0}
          format="currency"
          icon={DollarSign}
          delta={12}
          loading={isLoading}
        />
        <KPICard
          title="Win Rate"
          value={data?.kpis?.win_rate?.value || 0}
          format="percent"
          icon={Percent}
          delta={-3}
          loading={isLoading}
        />
        <KPICard
          title="Avg Deal Size"
          value={data?.kpis?.avg_deal_size?.value || 0}
          format="currency"
          icon={Target}
          delta={8}
          loading={isLoading}
        />
        <KPICard
          title="Revenue MTD"
          value={data?.kpis?.revenue_mtd?.value || 0}
          format="currency"
          icon={Calendar}
          delta={15}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Revenue by Month</CardTitle>
            <CardDescription>Last 12 months performance</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="revenue-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.revenue_trend || []}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsla(0, 0%, 100%, 0.06)" vertical={false} />
                    <XAxis dataKey="month" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <YAxis stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} tickFormatter={formatCurrency} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--chart-1))"
                      fill="url(#revFill)"
                      strokeWidth={2}
                      name="Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline by Stage */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Pipeline by Stage</CardTitle>
            <CardDescription>Deal distribution across stages</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="pipeline-stage-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.pipeline_by_stage || []} layout="vertical">
                    <CartesianGrid stroke="hsla(0, 0%, 100%, 0.06)" horizontal={false} />
                    <XAxis type="number" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} tickFormatter={formatCurrency} />
                    <YAxis type="category" dataKey="stage" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                      {(data?.pipeline_by_stage || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Reps Table */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Top Performing Reps</CardTitle>
          <CardDescription>Sales representatives ranked by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto" data-testid="top-reps-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Rep Name</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Pipeline</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Won</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Deals</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.top_reps || []).map((rep, index) => (
                    <tr key={rep.user_id} className="border-b border-border/40 hover:bg-muted/20" data-testid="table-row">
                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                            {index + 1}
                          </div>
                          {rep.name}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 tabular-nums">{formatCurrency(rep.pipeline_amount)}</td>
                      <td className="text-right py-3 px-4 tabular-nums text-[hsl(var(--success))]">{formatCurrency(rep.won_amount)}</td>
                      <td className="text-right py-3 px-4 tabular-nums">{rep.total_deals}</td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="outline" className="border-border/60">
                          {rep.win_rate}%
                        </Badge>
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

export default ExecutiveOverview;
