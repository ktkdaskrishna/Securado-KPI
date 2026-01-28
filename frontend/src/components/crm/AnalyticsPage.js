import React, { useState, useEffect, useCallback } from 'react';
import { analyticsAPI } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
import { useGlobalFilters } from '../../lib/GlobalFilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Building2, 
  DollarSign, 
  Target,
  BarChart3,
  PieChart,
  Activity,
  Brain,
  RefreshCw,
  Filter,
  Sparkles,
  ArrowRight,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function AnalyticsPage() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [repPerformance, setRepPerformance] = useState(null);
  const [teamPerformance, setTeamPerformance] = useState(null);
  const [accountHealth, setAccountHealth] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [localFilters, setLocalFilters] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  
  // Use global filters
  const { filters: globalFilters, hasActiveFilters } = useGlobalFilters();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Merge global filters with local period selection
      const params = { time_period: selectedPeriod };
      if (globalFilters.year) params.year = globalFilters.year;
      if (globalFilters.quarter) params.quarter = globalFilters.quarter;
      if (globalFilters.salesRep) params.sales_rep = globalFilters.salesRep;
      if (globalFilters.team) params.team_id = globalFilters.team;
      if (globalFilters.account) params.account = globalFilters.account;
      
      const [overviewRes, funnelRes, repRes, teamRes, accountRes, filtersRes] = await Promise.all([
        analyticsAPI.getOverview(params),
        analyticsAPI.getConversionFunnel(params),
        analyticsAPI.getRepPerformance(params),
        analyticsAPI.getTeamPerformance(params),
        analyticsAPI.getAccountHealth(params),
        analyticsAPI.getFilters()
      ]);
      
      setOverview(overviewRes.data);
      setFunnel(funnelRes.data);
      setRepPerformance(repRes.data);
      setTeamPerformance(teamRes.data);
      setAccountHealth(accountRes.data);
      setLocalFilters(filtersRes.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, globalFilters.year, globalFilters.quarter, globalFilters.salesRep, globalFilters.team, globalFilters.account]);

  const loadAIInsights = async () => {
    setAiLoading(true);
    try {
      const response = await analyticsAPI.getAIInsights();
      setAiInsights(response.data);
      toast.success('AI insights generated');
    } catch (error) {
      console.error('Failed to generate AI insights:', error);
      toast.error('Failed to generate AI insights');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="analytics-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Sales Analytics
          </h1>
          <p className="text-muted-foreground">AI-powered insights into your sales performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40" data-testid="period-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              {localFilters?.time_periods?.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData} data-testid="refresh-analytics">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Total Pipeline</p>
                <p className="text-2xl font-bold text-emerald-800">{formatCurrency(overview?.summary?.total_pipeline || 0)}</p>
                <p className="text-xs text-emerald-600 mt-1">{overview?.summary?.total_opportunities || 0} opportunities</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Won Value</p>
                <p className="text-2xl font-bold text-blue-800">{formatCurrency(overview?.summary?.won_value || 0)}</p>
                <p className="text-xs text-blue-600 mt-1">{overview?.summary?.won_count || 0} deals closed</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                <Award className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Win Rate</p>
                <p className="text-2xl font-bold text-purple-800">{overview?.summary?.win_rate || 0}%</p>
                <p className="text-xs text-purple-600 mt-1">Avg deal: {formatCurrency(overview?.summary?.avg_deal_size || 0)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Sales Team</p>
                <p className="text-2xl font-bold text-amber-800">{overview?.summary?.total_sales_reps || 0}</p>
                <p className="text-xs text-amber-600 mt-1">{overview?.summary?.total_accounts || 0} accounts</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="funnel" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Conversion Funnel
          </TabsTrigger>
          <TabsTrigger value="reps" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Rep Performance
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Account Health
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        {/* Conversion Funnel Tab */}
        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Sales Conversion Funnel
              </CardTitle>
              <CardDescription>
                Overall conversion: <span className="font-bold text-primary">{funnel?.overall_conversion || 0}%</span> from lead to won
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {funnel?.funnel?.map((stage, index) => {
                  const maxCount = Math.max(...(funnel?.funnel?.map(s => s.count) || [1]));
                  const width = (stage.count / maxCount) * 100;
                  
                  return (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium w-24">{stage.stage}</span>
                          <Badge variant="outline">{stage.count} deals</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{formatCurrency(stage.value)}</span>
                          {index > 0 && (
                            <Badge variant={stage.conversion_rate >= 50 ? "default" : "secondary"}>
                              {stage.conversion_rate}% conversion
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="relative h-8 bg-muted rounded overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary/70 rounded transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="text-xs font-medium text-white drop-shadow">{stage.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Lost deals */}
              {funnel?.lost_count > 0 && (
                <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Lost Deals: {funnel.lost_count}</span>
                    <span className="text-sm">({formatCurrency(funnel.lost_value)})</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rep Performance Tab */}
        <TabsContent value="reps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Sales Rep Performance
                </div>
                <Badge variant="outline">{repPerformance?.total_reps || 0} reps</Badge>
              </CardTitle>
              <CardDescription>
                Top performer: <span className="font-bold text-primary">{repPerformance?.top_performer || 'N/A'}</span>
                {' • '}Average win rate: <span className="font-bold">{repPerformance?.avg_win_rate || 0}%</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {repPerformance?.reps?.map((rep, index) => (
                    <Card key={rep.name} className={index === 0 ? "border-2 border-amber-400 bg-amber-50" : ""}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                              index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-primary'
                            }`}>
                              {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{rep.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {rep.total_opportunities} opportunities • {rep.won_count} won
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Won Value</p>
                              <p className="font-bold">{formatCurrency(rep.won_value)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Win Rate</p>
                              <Badge variant={rep.win_rate >= 70 ? "default" : rep.win_rate >= 50 ? "secondary" : "destructive"}>
                                {rep.win_rate}%
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Avg Deal</p>
                              <p className="font-mono text-sm">{formatCurrency(rep.avg_deal_size)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Pipeline</p>
                              <p className="font-mono text-sm text-primary">{formatCurrency(rep.pipeline_value)}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Product Managers & Categories Tab */}
        <TabsContent value="teams" className="space-y-6">
          {/* Product Managers Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-500" />
                Product Manager Performance
              </CardTitle>
              <CardDescription>{teamPerformance?.total_product_managers || 0} product managers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamPerformance?.product_managers?.slice(0, 6).map((pm, index) => (
                  <Card key={pm.name} className={index === 0 ? "border-2 border-violet-400 bg-violet-50/50" : "hover:shadow-md transition-shadow"}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 
                            index === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' : 
                            index === 2 ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 
                            'bg-gradient-to-br from-gray-400 to-gray-500'
                          }`}>
                            {index < 3 ? ['🥇', '🥈', '🥉'][index] : (pm.name || 'U').charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{pm.name}</p>
                            <p className="text-xs text-muted-foreground">{pm.categories_count || 0} categories</p>
                          </div>
                        </div>
                        {index === 0 && <Badge className="bg-violet-500">Top PM</Badge>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-lg font-bold text-emerald-600">{pm.won_count}</p>
                          <p className="text-[10px] text-muted-foreground">Won</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-sm font-bold">{formatCurrency(pm.won_value)}</p>
                          <p className="text-[10px] text-muted-foreground">Revenue</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <Badge variant={pm.win_rate >= 70 ? "default" : pm.win_rate >= 50 ? "secondary" : "destructive"} className="text-xs">
                            {pm.win_rate}%
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">Win Rate</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Solution Categories Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-500" />
                Solution Category Performance
              </CardTitle>
              <CardDescription>{teamPerformance?.total_categories || 0} solution categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamPerformance?.categories?.slice(0, 6).map((cat, index) => (
                  <Card key={cat.name} className={index === 0 ? "border-2 border-blue-400 bg-blue-50/50" : "hover:shadow-md transition-shadow"}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                            index === 0 ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 
                            index === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' : 
                            index === 2 ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 
                            'bg-gradient-to-br from-gray-400 to-gray-500'
                          }`}>
                            {index < 3 ? ['🥇', '🥈', '🥉'][index] : (cat.name || 'U').charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm truncate max-w-[150px]">{cat.name}</p>
                            <p className="text-xs text-muted-foreground">{cat.product_managers_count || 0} PMs</p>
                          </div>
                        </div>
                        {index === 0 && <Badge className="bg-blue-500">Top Category</Badge>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-lg font-bold text-emerald-600">{cat.won_count}</p>
                          <p className="text-[10px] text-muted-foreground">Won</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-sm font-bold">{formatCurrency(cat.won_value)}</p>
                          <p className="text-[10px] text-muted-foreground">Revenue</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <Badge variant={cat.win_rate >= 70 ? "default" : cat.win_rate >= 50 ? "secondary" : "destructive"} className="text-xs">
                            {cat.win_rate}%
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">Win Rate</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Health Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
                <p className="text-3xl font-bold text-emerald-700">{accountHealth?.summary?.healthy || 0}</p>
                <p className="text-sm text-emerald-600">Healthy Accounts</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-6 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto text-amber-600 mb-2" />
                <p className="text-3xl font-bold text-amber-700">{accountHealth?.summary?.at_risk || 0}</p>
                <p className="text-sm text-amber-600">At Risk</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6 text-center">
                <Clock className="h-8 w-8 mx-auto text-red-600 mb-2" />
                <p className="text-3xl font-bold text-red-700">{accountHealth?.summary?.dormant || 0}</p>
                <p className="text-sm text-red-600">Dormant</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Account Engagement Scores</CardTitle>
              <CardDescription>Top 50 accounts by engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {accountHealth?.accounts?.map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          account.status === 'healthy' ? 'bg-emerald-500' :
                          account.status === 'at_risk' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {account.total_opportunities} opportunities • {account.active_opportunities} active
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-mono">{formatCurrency(account.total_value)}</p>
                          <p className="text-xs text-muted-foreground">Pipeline</p>
                        </div>
                        <div className="w-24">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs">Score</span>
                            <span className="text-xs font-bold">{account.engagement_score}</span>
                          </div>
                          <Progress 
                            value={account.engagement_score} 
                            className="h-2"
                          />
                        </div>
                        <Badge variant={
                          account.status === 'healthy' ? 'default' :
                          account.status === 'at_risk' ? 'secondary' : 'destructive'
                        }>
                          {account.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI-Generated Insights
                </div>
                <Button 
                  onClick={loadAIInsights} 
                  disabled={aiLoading}
                  data-testid="generate-ai-insights"
                >
                  {aiLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Insights
                    </>
                  )}
                </Button>
              </CardTitle>
              <CardDescription>
                Powered by GPT-5.2 • Click to generate fresh insights based on your sales data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiInsights ? (
                <div className="space-y-6">
                  {/* AI Response */}
                  <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="whitespace-pre-wrap">{aiInsights.insights}</div>
                    </div>
                  </div>
                  
                  {/* Data Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Total Opportunities</p>
                        <p className="text-xl font-bold">{aiInsights.data_summary?.total_opportunities || 0}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Pipeline Value</p>
                        <p className="text-xl font-bold">{formatCurrency(aiInsights.data_summary?.total_pipeline_value || 0)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Win Rate</p>
                        <p className="text-xl font-bold">{aiInsights.data_summary?.win_rate || 0}%</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                        <p className="text-xl font-bold">{formatCurrency(aiInsights.data_summary?.avg_deal_size || 0)}</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-right">
                    Generated at {aiInsights.generated_at} using {aiInsights.ai_model}
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No AI insights generated yet</p>
                  <p className="text-muted-foreground mb-4">
                    Click the button above to generate AI-powered insights based on your sales data
                  </p>
                  <Button onClick={loadAIInsights} disabled={aiLoading}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Insights
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
