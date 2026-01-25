import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { kpiAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DollarSign, Percent, Target, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';

const formatCurrency = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const KPICard = ({ title, value, format = 'number', icon: Icon, loading }) => {
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
      </CardContent>
    </Card>
  );
};

const STAGE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const KPIDashboard = () => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['kpi-summary'],
    queryFn: async () => {
      const res = await kpiAPI.getSummary();
      return res.data;
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KPI Dashboard</h1>
          <p className="text-muted-foreground">Sales metrics from Odoo CRM</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        <KPICard
          title="Pipeline Amount"
          value={data?.kpis?.pipeline_amount?.value || 0}
          format="currency"
          icon={DollarSign}
          loading={isLoading}
        />
        <KPICard
          title="Win Rate"
          value={data?.kpis?.win_rate?.value || 0}
          format="percent"
          icon={Percent}
          loading={isLoading}
        />
        <KPICard
          title="Avg Deal Size"
          value={data?.kpis?.avg_deal_size?.value || 0}
          format="currency"
          icon={Target}
          loading={isLoading}
        />
        <KPICard
          title="Total Opportunities"
          value={data?.kpis?.total_opportunities?.value || 0}
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Pipeline by Stage</CardTitle>
            <CardDescription>Deal distribution across pipeline stages</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="stage-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.by_stage || []}>
                    <CartesianGrid stroke="hsla(0, 0%, 100%, 0.06)" vertical={false} />
                    <XAxis dataKey="stage" stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <YAxis stroke="hsla(0, 0%, 100%, 0.55)" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(24, 28, 34, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" name="Deals" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Amount by Stage */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Pipeline Value by Stage</CardTitle>
            <CardDescription>Revenue distribution across stages</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64" data-testid="value-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.by_stage?.filter(s => s.amount > 0) || []}
                      dataKey="amount"
                      nameKey="stage"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ stage, amount }) => `${stage}: ${formatCurrency(amount)}`}
                    >
                      {(data?.by_stage || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'rgba(24, 28, 34, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                      formatter={(value) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rep Performance Table */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Sales Rep Performance</CardTitle>
          <CardDescription>Performance by owner from Odoo CRM</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.by_owner?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No data available. Run a pipeline to sync data from Odoo.
            </div>
          ) : (
            <div className="overflow-x-auto" data-testid="rep-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Owner</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Pipeline</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Won</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Total Deals</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_owner.map((rep, index) => (
                    <tr key={index} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-3 px-4 font-medium">{rep.name}</td>
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

export default KPIDashboard;
