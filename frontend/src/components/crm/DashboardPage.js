import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmAPI, analyticsAPI, targetAPI } from '../../lib/api';
import EditChartDialog from './EditChartDialog';
import { useCurrency } from '../../lib/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { TrendingUp, TrendingDown, DollarSign, Target, Users, Activity, RefreshCw, Zap, Filter, Award, Layers, Trophy, Download, ExternalLink, Pencil } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';
import { PageFilters, YearFilter, QuarterFilter, SalesRepFilter, StageFilter, ProductDirectorFilter, SolutionCategoryFilter } from '../layout/PageFilters';

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [pmLeaderboard, setPmLeaderboard] = useState(null);
  const [categoryStats, setCategoryStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingCard, setEditingCard] = useState(null);
  const [showQueryEditor, setShowQueryEditor] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ years: [], salesReps: [], stages: [], productDirectors: [], solutionCategories: [] });
  const { formatCurrency, currency, reloadCurrency } = useCurrency();
  
  // Get current year for default filter
  const currentYear = new Date().getFullYear().toString();
  
  // Contextual filters specific to Dashboard - DEFAULT TO CURRENT YEAR
  const [filters, setFilters] = useState({
    year: currentYear,  // Default to current year
    quarter: null,
    salesRep: null,
    stage: null,
    productDirector: null,
    solutionCategory: null,
  });

  // Export dashboard data to Excel
  const handleExportDashboard = async () => {
    try {
      toast.info('Generating dashboard export...');
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year);
      if (filters.quarter) params.append('quarter', filters.quarter);
      if (filters.salesRep) params.append('sales_rep', filters.salesRep);
      if (filters.stage) params.append('stage', filters.stage);
      if (filters.productDirector) params.append('product_director', filters.productDirector);
      if (filters.solutionCategory) params.append('solution_category', filters.solutionCategory);
      
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/opportunities/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard_opportunities_${filters.year || 'all'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Dashboard export downloaded!');
    } catch (error) {
      toast.error('Failed to export dashboard data');
    }
  };

  // Navigation handlers for clickable items
  const handleNavigateToOpportunities = (stage = null, salesRep = null) => {
    const params = new URLSearchParams();
    // Stage can come from click or from current filters
    if (stage) {
      params.append('stage', stage);
    } else if (filters.stage) {
      params.append('stage', filters.stage);
    }
    // SalesRep can come from click (leaderboard) or from current filters
    if (salesRep) {
      params.append('salesRep', salesRep);
    } else if (filters.salesRep) {
      params.append('salesRep', filters.salesRep);
    }
    // Always pass year and quarter from current filters
    if (filters.year) params.append('year', filters.year);
    if (filters.quarter) params.append('quarter', filters.quarter);
    if (filters.productDirector) params.append('productDirector', filters.productDirector);
    if (filters.solutionCategory) params.append('solutionCategory', filters.solutionCategory);
    navigate(`/opportunities?${params.toString()}`);
  };

  const handleNavigateToActivities = (activityType = null) => {
    const params = new URLSearchParams();
    if (activityType) params.append('type', activityType);
    if (filters.year) params.append('year', filters.year);
    if (filters.quarter) params.append('quarter', filters.quarter);
    if (filters.salesRep) params.append('salesRep', filters.salesRep);
    navigate(`/activities?${params.toString()}`);
  };

  const handleNavigateToInvoices = () => {
    navigate('/invoices');
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ year: null, quarter: null, salesRep: null, stage: null, productDirector: null, solutionCategory: null });
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(v => v !== null);
  };

  const loadFilterOptions = useCallback(async () => {
    try {
      const [filterRes, pmRes, catRes] = await Promise.allSettled([
        analyticsAPI.getFilters(),
        targetAPI.getProductManagers(),
        targetAPI.getSolutionCategories(),
      ]);
      const fData = filterRes.status === 'fulfilled' ? filterRes.value.data : {};
      const pms = pmRes.status === 'fulfilled' ? pmRes.value.data : [];
      const cats = catRes.status === 'fulfilled' ? catRes.value.data : [];
      setFilterOptions({
        years: fData.years || [],
        salesReps: fData.sales_reps || fData.salesReps || [],
        stages: fData.stages || [],
        productDirectors: pms.map(p => p.name),
        solutionCategories: cats.map(c => c.name),
      });
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      // Build filter params
      const params = {};
      if (filters.year) params.year = filters.year;
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.salesRep) params.sales_rep = filters.salesRep;
      if (filters.stage) params.stage = filters.stage;
      if (filters.productDirector) params.product_manager = filters.productDirector;
      if (filters.solutionCategory) params.solution_category = filters.solutionCategory;
      
      // Load all dashboard data in parallel
      const [statsRes, pmRes, catRes] = await Promise.all([
        crmAPI.getDashboardStats(params),
        crmAPI.getProductManagerLeaderboard(params),
        crmAPI.getCategoryStats(params)
      ]);
      
      setStats(statsRes.data);
      setPmLeaderboard(pmRes.data);
      setCategoryStats(catRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFilterOptions();
    loadStats();
    // Reload currency when dashboard mounts (useful after login)
    reloadCurrency();
  }, []);

  // Reload when filters change
  useEffect(() => {
    loadStats();
  }, [filters.year, filters.quarter, filters.salesRep, filters.stage, filters.productDirector, filters.solutionCategory]);

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
        // For large numbers, show abbreviated format
        if (value >= 1000000) {
          return `${formatCurrency(value / 1000000).replace(/\.00$/, '')}M`;
        }
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Dashboard
            {hasActiveFilters() && (
              <Badge variant="secondary" className="text-xs font-normal flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Filtered
              </Badge>
            )}
          </h1>
          <p className="text-gray-500">
            {hasActiveFilters() 
              ? `Showing filtered data (${stats?.total_opportunities || 0} opportunities)`
              : 'Overview of your sales performance'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            disabled={refreshing}
            data-testid="dashboard-refresh-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleExportDashboard}
            variant="outline"
            data-testid="dashboard-export-button"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Contextual Filters for Dashboard */}
      <PageFilters 
        onReset={resetFilters}
        activeFilters={[filters.year, filters.quarter, filters.salesRep, filters.stage]}
        title="Dashboard Filters"
      >
        <YearFilter 
          value={filters.year} 
          onChange={(v) => updateFilter('year', v)} 
          years={filterOptions.years}
        />
        <QuarterFilter 
          value={filters.quarter} 
          onChange={(v) => updateFilter('quarter', v)} 
        />
        <SalesRepFilter 
          value={filters.salesRep} 
          onChange={(v) => updateFilter('salesRep', v)} 
          salesReps={filterOptions.salesReps}
        />
        <StageFilter 
          value={filters.stage} 
          onChange={(v) => updateFilter('stage', v)} 
          stages={filterOptions.stages}
        />
        <ProductDirectorFilter
          value={filters.productDirector}
          onChange={(v) => updateFilter('productDirector', v)}
          productDirectors={filterOptions.productDirectors}
        />
        <SolutionCategoryFilter
          value={filters.solutionCategory}
          onChange={(v) => updateFilter('solutionCategory', v)}
          categories={filterOptions.solutionCategories}
        />
      </PageFilters>

      {/* KPI Cards - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <Card 
            key={index} 
            data-testid={`crm-kpi-card-${kpi.title.toLowerCase().replace(/\s/g, '-')}`}
            className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group overflow-hidden relative"
            onClick={() => {
              if (kpi.title === 'Total Pipeline' || kpi.title === 'Open Opportunities') {
                handleNavigateToOpportunities();
              } else if (kpi.title === 'Won This Period') {
                handleNavigateToOpportunities('Won');
              } else if (kpi.title === 'Win Rate') {
                handleNavigateToOpportunities();
              }
            }}
          >
            {/* Edit query button */}
            <button className="absolute top-2 right-2 z-10 p-1 rounded bg-white/80 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); setEditingCard({ name: kpi.title, collection: 'opportunities', aggregation: kpi.format === 'currency' ? 'sum' : 'count', field: kpi.format === 'currency' ? 'sale_value' : '', display_type: 'number', color: '#800000', icon: 'Target', year_filter: true, filters: kpi.title.includes('Won') ? '{"type":"opportunity","stage":"Won"}' : '{"type":"opportunity"}' }); setShowQueryEditor(true); }}>
              <Pencil className="h-3 w-3 text-gray-400" />
            </button>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 truncate">{kpi.title}</p>
                  <p className="text-xl font-bold mt-1 truncate" title={kpi.format === 'currency' ? formatCurrency(kpi.value) : kpi.value}>
                    {formatValue(kpi.value, kpi.format)}
                  </p>
                </div>
                <div className={`p-2 rounded-full bg-${kpi.color}-100 group-hover:scale-110 transition-transform flex-shrink-0`}>
                  <kpi.icon className={`h-5 w-5 text-${kpi.color}-600`} />
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
              <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-primary flex items-center">View Details <ExternalLink className="h-3 w-3 ml-1" /></span>
              </div>
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
                <BarChart 
                  data={stats?.pipeline_by_stage || []}
                  onClick={(data) => {
                    if (data?.activeLabel) {
                      handleNavigateToOpportunities(data.activeLabel);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `OMR ${(v/1000000).toFixed(1)}M` : v >= 1000 ? `OMR ${(v/1000).toFixed(0)}K` : `OMR ${v}`} width={85} />
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
                  <div 
                    key={person.id} 
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors group"
                    onClick={() => handleNavigateToOpportunities(null, person.name)}
                  >
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
                      <span className="font-medium group-hover:text-primary">{person.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(person.value)}
                      </span>
                      <ExternalLink className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Product Manager Leaderboard & Category Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Manager Leaderboard */}
        <Card data-testid="pm-leaderboard-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Product Manager Leaderboard
              </CardTitle>
              {pmLeaderboard?.total_deals && (
                <Badge variant="secondary" className="text-xs">
                  {pmLeaderboard.total_deals} deals
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Product Manager</TableHead>
                    <TableHead className="text-right">Won Value</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pmLeaderboard?.leaderboard || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    pmLeaderboard.leaderboard.map((pm, index) => (
                      <TableRow key={pm.name} data-testid={`pm-row-${index}`}>
                        <TableCell>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                            ${index === 0 ? 'bg-amber-100 text-amber-700' : 
                              index === 1 ? 'bg-gray-200 text-gray-700' : 
                              index === 2 ? 'bg-orange-100 text-orange-700' : 
                              'bg-gray-50 text-gray-500'}`}>
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                              {pm.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="truncate max-w-[150px]">{pm.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatCurrency(pm.value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-xs">
                            {pm.deals_won}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            {pmLeaderboard?.total_won_value && (
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Won Value</span>
                <span className="text-lg font-bold text-emerald-600">
                  {formatCurrency(pmLeaderboard.total_won_value)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Solution Category Performance */}
        <Card data-testid="category-stats-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-cyan-500" />
                Solution Category Performance
              </CardTitle>
              {categoryStats?.total_deals && (
                <Badge variant="secondary" className="text-xs">
                  {categoryStats.total_deals} deals
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <div className="space-y-3">
                {(categoryStats?.categories || []).length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No data available</p>
                ) : (
                  categoryStats.categories.map((cat, index) => {
                    const maxValue = categoryStats.categories[0]?.value || 1;
                    const percentage = (cat.value / maxValue) * 100;
                    const colors = [
                      'from-cyan-500 to-cyan-600',
                      'from-emerald-500 to-emerald-600',
                      'from-violet-500 to-violet-600',
                      'from-amber-500 to-amber-600',
                      'from-rose-500 to-rose-600',
                      'from-blue-500 to-blue-600',
                      'from-purple-500 to-purple-600',
                      'from-teal-500 to-teal-600',
                    ];
                    const gradientColor = colors[index % colors.length];
                    
                    return (
                      <div key={cat.name} className="space-y-1" data-testid={`category-row-${index}`}>
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium truncate max-w-[200px]" title={cat.name}>
                            {cat.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {cat.count} deals
                            </Badge>
                            <span className="font-semibold text-gray-900 min-w-[100px] text-right">
                              {formatCurrency(cat.value)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${gradientColor} rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            {categoryStats?.total_won_value && (
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Won Value</span>
                <span className="text-lg font-bold text-cyan-600">
                  {formatCurrency(categoryStats.total_won_value)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Stats and Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Activity Overview
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleNavigateToActivities()}
                className="text-xs"
              >
                View All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Calls', value: stats?.activity_stats?.calls || 0, color: 'blue', type: 'call' },
                { label: 'Emails', value: stats?.activity_stats?.emails || 0, color: 'cyan', type: 'email' },
                { label: 'Meetings', value: stats?.activity_stats?.meetings || 0, color: 'emerald', type: 'meeting' },
                { label: 'Tasks', value: stats?.activity_stats?.tasks || 0, color: 'amber', type: 'task' },
              ].map((item) => (
                <div 
                  key={item.label} 
                  className="p-4 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors group"
                  onClick={() => handleNavigateToActivities(item.type)}
                  data-testid={`activity-stat-${item.label.toLowerCase()}`}
                >
                  <p className="text-sm text-gray-500">{item.label}</p>
                  <p className="text-2xl font-bold mt-1">{item.value}</p>
                  <p className="text-xs text-primary opacity-0 group-hover:opacity-100 mt-1">Click to view →</p>
                </div>
              ))}
            </div>
            <div 
              className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors"
              onClick={() => handleNavigateToActivities()}
            >
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

      {/* Query Editor for dashboard cards */}
      <EditChartDialog open={showQueryEditor} onClose={() => { setShowQueryEditor(false); setEditingCard(null); }}
        card={editingCard}
        onSave={async (formData) => {
          try {
            await targetAPI.createCard(formData);
            toast.success('Card saved to Dashboard Builder');
            setShowQueryEditor(false);
            setEditingCard(null);
          } catch { toast.error('Failed'); }
        }}
      />
    </div>
  );
}
