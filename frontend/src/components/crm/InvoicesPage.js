import React, { useState, useEffect, useCallback } from 'react';
import { crmAPI } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
import { getCurrencyOptions } from '../../lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { ScrollArea } from '../ui/scroll-area';
import { 
  FileText, Search, Eye, DollarSign, Calendar, Clock, AlertTriangle,
  CheckCircle, TrendingUp, Building2, Download, Send, Plus, Filter, 
  RotateCcw, ChevronDown, RefreshCw, Users, Award, Maximize2, Minimize2
} from 'lucide-react';
import { toast } from 'sonner';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [salespersonData, setSalespersonData] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ accounts: [], years: [], salespersons: [], product_managers: [], solution_categories: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [agingFilter, setAgingFilter] = useState(null);
  const [statusDrill, setStatusDrill] = useState(null);
  const [invoiceNotes, setInvoiceNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('note'); // null=all, 'paid', 'overdue', 'pending' // null=all, '0_30', '30_60', '60_90', '90_plus'
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [accountOpen, setAccountOpen] = useState(false);
  const { currency: globalCurrency, formatCurrency, updateCurrency } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency);

  // Contextual filters for Invoices page
  const [filters, setFilters] = useState({
    year: null, quarter: null, account: null,
    salesperson: null, product_manager: null, solution_category: null
  });

  // Sync with global currency setting
  useEffect(() => {
    setSelectedCurrency(globalCurrency);
  }, [globalCurrency]);

  // Update global currency when changed in this page
  const handleCurrencyChange = (newCurrency) => {
    setSelectedCurrency(newCurrency);
    updateCurrency(newCurrency);
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ year: null, quarter: null, account: null, salesperson: null, product_manager: null, solution_category: null });
    setActiveTab('all');
  };

  const hasActiveFilters = () => {
    return filters.year || filters.quarter || filters.account || filters.salesperson || filters.product_manager || filters.solution_category;
  };

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build params based on active tab and filters
      const params = {
        status: activeTab === 'all' || activeTab === 'salesperson' ? null : activeTab,
        year: filters.year,
        quarter: filters.quarter,
        account: filters.account,
        limit: 200
      };
      
      // Remove null values
      Object.keys(params).forEach(key => {
        if (params[key] === null) delete params[key];
      });
      
      const [invoicesRes, statsRes, salespersonRes] = await Promise.all([
        crmAPI.listReceivables(params),
        crmAPI.getReceivablesStats({ year: filters.year, quarter: filters.quarter }),
        crmAPI.getReceivablesBySalesperson({ year: filters.year, quarter: filters.quarter })
      ]);
      
      // Handle new API response format
      const invoiceData = invoicesRes.data?.invoices || invoicesRes.data || [];
      const mainStats = invoicesRes.data?.stats || {};
      const statsData = statsRes.data?.stats || statsRes.data || {};
      const options = statsRes.data?.filter_options || { accounts: [], years: [] };
      const spData = salespersonRes.data?.data || [];
      
      // Merge stats — prefer main response (has collection_rate + aging)
      const mergedStats = {
        ...statsData,
        total_invoiced: mainStats.total || statsData.total_invoiced || 0,
        total_paid: mainStats.paid || statsData.total_paid || 0,
        total_overdue: mainStats.overdue || statsData.total_overdue || 0,
        total_pending: mainStats.pending || statsData.total_pending || 0,
        count_total: mainStats.total_count || statsData.count_total || 0,
        count_paid: mainStats.paid_count || statsData.count_paid || 0,
        count_overdue: mainStats.overdue_count || statsData.count_overdue || 0,
        count_pending: mainStats.pending_count || statsData.count_pending || 0,
        collection_rate: invoicesRes.data?.collection_rate,
        aging_breakdown: invoicesRes.data?.aging_breakdown,
      };
      
      setInvoices(invoiceData);
      setStats(mergedStats);
      setFilterOptions(options);
      // Also extract salesperson, PM, category from invoice data
      const salespersons = [...new Set(invoiceData.map(i => i.salesperson).filter(Boolean))].sort();
      const pms = [...new Set(invoiceData.map(i => i.product_manager).filter(Boolean))].sort();
      const cats = [...new Set(invoiceData.map(i => i.solution_category).filter(Boolean))].sort();
      setFilterOptions(prev => ({ ...prev, ...options, salespersons, product_managers: pms, solution_categories: cats }));
      setSalespersonData(spData);
      
    } catch (error) {
      console.error('Failed to load invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters.year, filters.quarter, filters.account]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      paid: { variant: 'default', icon: CheckCircle, className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
      pending: { variant: 'secondary', icon: Clock, className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
      overdue: { variant: 'destructive', icon: AlertTriangle, className: 'bg-red-100 text-red-700 hover:bg-red-100' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </Badge>
    );
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !searchQuery ||
      inv.account?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.so_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.salesperson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.product_manager?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status drill-down
    if (statusDrill && inv.status !== statusDrill) return false;
    
    // Salesperson / PM / Category filters
    if (filters.salesperson && inv.salesperson !== filters.salesperson) return false;
    if (filters.product_manager && inv.product_manager !== filters.product_manager) return false;
    if (filters.solution_category && inv.solution_category !== filters.solution_category) return false;
    
    // Aging drill-down filter
    if (agingFilter && inv.status === 'overdue') {
      const days = inv.aging_days || 0;
      if (agingFilter === '0_30' && (days < 0 || days > 30)) return false;
      if (agingFilter === '30_60' && (days <= 30 || days > 60)) return false;
      if (agingFilter === '60_90' && (days <= 60 || days > 90)) return false;
      if (agingFilter === '90_plus' && days <= 90) return false;
    } else if (agingFilter) {
      return false; // Only show overdue when aging filter active
    }
    
    return matchesSearch;
  });

  const viewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setSheetOpen(true);
    // Load notes for this invoice
    setInvoiceNotes([]);
    setNewNote('');
    setNoteType('note');
    if (invoice?.id) {
      crmAPI.getInvoiceNotes(invoice.id).then(r => setInvoiceNotes(r.data || [])).catch(() => {});
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedInvoice?.id) return;
    try {
      const res = await crmAPI.addInvoiceNote(selectedInvoice.id, { text: newNote, type: noteType });
      setInvoiceNotes(prev => [res.data, ...prev]);
      setNewNote('');
      toast.success('Note added');
    } catch { toast.error('Failed to add note'); }
  };


  // Calculate collection rate
  const collectionRate = stats?.total_invoiced > 0 
    ? (stats.total_paid / stats.total_invoiced) * 100 
    : 0;

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const quarterOptions = [
    { value: 'Q1', label: 'Q1 (Jan-Mar)' },
    { value: 'Q2', label: 'Q2 (Apr-Jun)' },
    { value: 'Q3', label: 'Q3 (Jul-Sep)' },
    { value: 'Q4', label: 'Q4 (Oct-Dec)' }
  ];

  return (
    <div className="space-y-6 p-6" data-testid="invoices-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices & Receivables</h1>
          <p className="text-muted-foreground">Track payments and manage invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="w-[120px]" data-testid="currency-selector">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {getCurrencyOptions().map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  {curr.code === 'OMR' || curr.code === 'SAR' ? curr.code : `${curr.symbol} ${curr.code}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={loadInvoices} variant="outline" data-testid="refresh-invoices">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-primary hover:bg-primary/90" data-testid="create-invoice-btn">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Contextual Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-muted/30 to-muted/50 rounded-lg border" data-testid="invoice-filters">
        <div className="flex items-center gap-2 mr-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filters</span>
        </div>

        {/* Year Filter */}
        <Select 
          value={filters.year || 'all'} 
          onValueChange={(v) => updateFilter('year', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[110px] h-9" data-testid="filter-year">
            <Calendar className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {filterOptions.years?.map(year => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Quarter Filter */}
        <Select 
          value={filters.quarter || 'all'} 
          onValueChange={(v) => updateFilter('quarter', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[140px] h-9" data-testid="filter-quarter">
            <SelectValue placeholder="Quarter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quarters</SelectItem>
            {quarterOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Account Filter - Searchable */}
        <Popover open={accountOpen} onOpenChange={setAccountOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              role="combobox" 
              className="w-[180px] h-9 justify-between"
              data-testid="filter-account"
            >
              <Building2 className="h-3 w-3 mr-1 shrink-0" />
              <span className="truncate">
                {filters.account || "All Accounts"}
              </span>
              <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command shouldFilter={true}>
              <CommandInput placeholder="Search account..." />
              <CommandList>
                <CommandEmpty>No account found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all-accounts"
                    onSelect={() => {
                      updateFilter('account', null);
                      setAccountOpen(false);
                    }}
                  >
                    All Accounts
                  </CommandItem>
                  {filterOptions.accounts?.map((acc) => (
                    <CommandItem
                      key={acc}
                      value={acc}
                      onSelect={(value) => {
                        updateFilter('account', value);
                        setAccountOpen(false);
                      }}
                    >
                      {acc}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Salesperson Filter */}
        <Select value={filters.salesperson || 'all'} onValueChange={v => updateFilter('salesperson', v === 'all' ? null : v)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="All Sales Reps" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sales Reps</SelectItem>
            {filterOptions.salespersons?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Product Manager Filter */}
        <Select value={filters.product_manager || 'all'} onValueChange={v => updateFilter('product_manager', v === 'all' ? null : v)}>
          <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="All Product Mgrs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Product Mgrs</SelectItem>
            {filterOptions.product_managers?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Solution Category Filter */}
        <Select value={filters.solution_category || 'all'} onValueChange={v => updateFilter('solution_category', v === 'all' ? null : v)}>
          <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {filterOptions.solution_categories?.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Reset Button */}
        {hasActiveFilters() && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetFilters}
            className="h-9 text-muted-foreground hover:text-foreground"
            data-testid="filter-reset"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
        
        {/* Export Excel */}
        <Button variant="outline" size="sm" className="h-9 ml-auto"
          onClick={async () => {
            try {
              const res = await crmAPI.exportInvoicesExcel(filteredInvoices);
              const url = URL.createObjectURL(new Blob([res.data]));
              const a = document.createElement('a'); a.href = url; a.download = 'invoices_export.xlsx'; a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${filteredInvoices.length} invoices`);
            } catch { toast.error('Export failed'); }
          }} data-testid="export-excel-btn">
          <Download className="h-4 w-4 mr-1" /> Export Excel
        </Button>

        {/* Active Filter Summary */}
        {hasActiveFilters() && (
          <div className="ml-auto">
            <Badge variant="secondary" className="text-xs">
              {[filters.year, filters.quarter, filters.account].filter(Boolean).join(' • ')}
            </Badge>
          </div>
        )}
      </div>

      {/* Stats Cards — Clickable Drill-Down */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoiced', value: stats?.total_invoiced, count: stats?.count_total, icon: FileText, color: 'text-foreground', bgIcon: 'bg-primary/10', iconColor: 'text-primary', status: null },
          { label: 'Pending', value: stats?.total_pending, count: stats?.count_pending, icon: Clock, color: 'text-amber-600', bgIcon: 'bg-amber-100', iconColor: 'text-amber-600', status: 'pending' },
          { label: 'Overdue', value: stats?.total_overdue, count: stats?.count_overdue, icon: AlertTriangle, color: 'text-red-600', bgIcon: 'bg-red-100', iconColor: 'text-red-600', status: 'overdue' },
          { label: 'Collected', value: stats?.total_paid, count: stats?.count_paid, icon: CheckCircle, color: 'text-emerald-600', bgIcon: 'bg-emerald-100', iconColor: 'text-emerald-600', status: 'paid' },
        ].map(kpi => { const KI = kpi.icon; return (
          <Card key={kpi.label} className={`cursor-pointer transition-all hover:shadow-md ${statusDrill === kpi.status && kpi.status ? 'ring-2 ring-[#800000] ring-offset-1' : ''}`}
            onClick={() => { setStatusDrill(statusDrill === kpi.status ? null : kpi.status); setAgingFilter(null); }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    {statusDrill === kpi.status && kpi.status && <Badge className="bg-[#800000] text-white text-[9px]">Filtered</Badge>}
                  </div>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{formatCurrency(kpi.value || 0, selectedCurrency)}</p>
                  <p className="text-xs text-muted-foreground">{kpi.count || 0} invoices</p>
                </div>
                <div className={`h-12 w-12 rounded-full ${kpi.bgIcon} flex items-center justify-center`}><KI className={`h-6 w-6 ${kpi.iconColor}`} /></div>
              </div>
            </CardContent>
          </Card>); })}
      </div>

      {(statusDrill || agingFilter) && (
        <div className="flex items-center gap-2 bg-[#800000]/5 border border-[#800000]/20 rounded-lg px-4 py-2">
          <span className="text-sm text-[#800000] font-medium">Drill-down: {statusDrill ? statusDrill + ' invoices' : ''} {agingFilter ? 'aging ' + agingFilter.replace('_','-') + ' days' : ''}</span>
          <Button variant="ghost" size="sm" onClick={() => { setStatusDrill(null); setAgingFilter(null); }} className="h-6 text-xs text-[#800000]">Clear filter</Button>
          <span className="text-xs text-gray-500 ml-auto">{filteredInvoices.length} results</span>
        </div>
      )}

      {/* Collection Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Collection Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Collection Rate</span>
              <span className="font-medium">
                {formatCurrency(stats?.total_paid || 0, selectedCurrency)} / {formatCurrency(stats?.total_invoiced || 0, selectedCurrency)} 
                ({collectionRate.toFixed(1)}%)
              </span>
            </div>
            <Progress value={collectionRate} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Aging Breakdown */}
      {stats?.aging_breakdown && (stats.aging_breakdown['0_30'] > 0 || stats.aging_breakdown['30_60'] > 0 || stats.aging_breakdown['60_90'] > 0 || stats.aging_breakdown['90_plus'] > 0) && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '0-30 Days', key: '0_30', color: 'text-amber-600 bg-amber-50', min: 0, max: 30 },
            { label: '30-60 Days', key: '30_60', color: 'text-orange-600 bg-orange-50', min: 30, max: 60 },
            { label: '60-90 Days', key: '60_90', color: 'text-red-500 bg-red-50', min: 60, max: 90 },
            { label: '90+ Days', key: '90_plus', color: 'text-red-700 bg-red-100', min: 90, max: 9999 },
          ].map(bucket => (
            <Card key={bucket.key} className={`cursor-pointer transition-all hover:shadow-md ${agingFilter === bucket.key ? 'ring-2 ring-[#800000] ring-offset-1' : ''}`}
              onClick={() => setAgingFilter(agingFilter === bucket.key ? null : bucket.key)}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">{bucket.label}</p>
                  {agingFilter === bucket.key && <Badge className="bg-[#800000] text-white text-[9px]">Filtered</Badge>}
                </div>
                <p className={`text-lg font-bold ${bucket.color.split(' ')[0]}`}>{formatCurrency(stats.aging_breakdown[bucket.key] || 0, selectedCurrency)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">
                  All ({stats?.count_total || 0})
                </TabsTrigger>
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending ({stats?.count_pending || 0})
                </TabsTrigger>
                <TabsTrigger value="overdue" data-testid="tab-overdue">
                  Overdue ({stats?.count_overdue || 0})
                </TabsTrigger>
                <TabsTrigger value="paid" data-testid="tab-paid">
                  Paid ({stats?.count_paid || 0})
                </TabsTrigger>
                <TabsTrigger value="salesperson" data-testid="tab-salesperson" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  By Salesperson
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="invoice-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'salesperson' ? (
            /* Salesperson Performance Table */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Award className="h-4 w-4" />
                <span>Salesperson receivables performance breakdown</span>
              </div>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Salesperson</TableHead>
                      <TableHead className="text-right">Won Value</TableHead>
                      <TableHead className="text-right">Won Deals</TableHead>
                      <TableHead className="text-right">Billed</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salespersonData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No salesperson data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      salespersonData.map((sp, index) => {
                        const collectionRate = sp.billed > 0 ? (sp.collected / sp.billed) * 100 : 0;
                        return (
                          <TableRow key={sp.salesperson} data-testid={`sp-row-${index}`}>
                            <TableCell>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                                ${index === 0 ? 'bg-amber-100 text-amber-700' : 
                                  index === 1 ? 'bg-gray-200 text-gray-700' : 
                                  index === 2 ? 'bg-orange-100 text-orange-700' : 
                                  'bg-gray-50 text-gray-500'}`}>
                                {index + 1}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xs font-medium">
                                  {sp.salesperson.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium truncate max-w-[150px]">{sp.salesperson}</span>
                                  <div className="flex items-center gap-1">
                                    <Progress value={collectionRate} className="w-16 h-1.5" />
                                    <span className="text-xs text-muted-foreground">{collectionRate.toFixed(0)}%</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-emerald-600">
                              {formatCurrency(sp.won_value, selectedCurrency)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{sp.won_count}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(sp.billed, selectedCurrency)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-emerald-600">
                              {formatCurrency(sp.collected, selectedCurrency)}
                            </TableCell>
                            <TableCell className="text-right">
                              {sp.overdue > 0 ? (
                                <span className="font-mono text-red-600 font-medium">
                                  {formatCurrency(sp.overdue, selectedCurrency)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{sp.count_invoices}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {/* Totals Row */}
              {salespersonData.length > 0 && (
                <div className="border-t pt-4 grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Won</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatCurrency(salespersonData.reduce((sum, sp) => sum + sp.won_value, 0), selectedCurrency)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Billed</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(salespersonData.reduce((sum, sp) => sum + sp.billed, 0), selectedCurrency)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Collected</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatCurrency(salespersonData.reduce((sum, sp) => sum + sp.collected, 0), selectedCurrency)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Overdue</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(salespersonData.reduce((sum, sp) => sum + sp.overdue, 0), selectedCurrency)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Regular Invoice Table */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>SO #</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead>Product Mgr</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {invoice.invoice_number}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">{invoice.so_number || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {invoice.account}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(invoice.amount, selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-sm">{invoice.salesperson || '-'}</TableCell>
                      <TableCell className="text-sm">{invoice.product_manager || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(invoice.invoice_date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(invoice.due_date)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => viewInvoice(invoice)} data-testid={`view-invoice-${invoice.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          {invoice.status !== 'paid' && (
                            <Button variant="ghost" size="sm">
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Sheet — Enhanced */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className={`${sheetExpanded ? 'w-[90vw] sm:w-[85vw] sm:max-w-[1200px]' : 'w-[500px] sm:w-[650px]'} overflow-y-auto transition-all duration-300`}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedInvoice?.invoice_number}
              <button onClick={() => setSheetExpanded(!sheetExpanded)} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Double-click or click to expand/collapse">
                {sheetExpanded ? <Minimize2 className="h-4 w-4 text-gray-500" /> : <Maximize2 className="h-4 w-4 text-gray-500" />}
              </button>
            </SheetTitle>
          </SheetHeader>
          
          {selectedInvoice && (
            <div className="mt-4 space-y-5">
              {/* Status + Amount Header */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-muted-foreground">Bill To</p>
                  <p className="font-semibold text-lg">{selectedInvoice.account}</p>
                </div>
                {getStatusBadge(selectedInvoice.status)}
              </div>

              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <span className="font-medium">Total Amount</span>
                <span className="text-2xl font-bold">{formatCurrency(selectedInvoice.amount, selectedCurrency)}</span>
              </div>

              {/* Key Dates */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Invoice Date</p>
                  <p className="text-sm font-medium mt-0.5">{formatDate(selectedInvoice.invoice_date) || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Due Date</p>
                  <p className="text-sm font-medium mt-0.5">{formatDate(selectedInvoice.due_date) || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Aging</p>
                  <p className={`text-sm font-bold mt-0.5 ${selectedInvoice.aging_days > 60 ? 'text-red-600' : selectedInvoice.aging_days > 30 ? 'text-amber-600' : 'text-green-600'}`}>
                    {selectedInvoice.status === 'overdue' ? `${selectedInvoice.aging_days || 0} days overdue` : selectedInvoice.status === 'paid' ? 'Paid' : 'Current'}
                  </p>
                </div>
              </div>

              {/* Sales & Product Info */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sales Information</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">SO Number</p>
                      <p className="font-medium">{selectedInvoice.so_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Salesperson</p>
                      <p className="font-medium">{selectedInvoice.salesperson || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Product Manager</p>
                      <p className="font-medium">{selectedInvoice.product_manager ? <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-xs">{selectedInvoice.product_manager}</span> : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Solution Category</p>
                      <p className="font-medium">{selectedInvoice.solution_category ? <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-xs">{selectedInvoice.solution_category}</span> : '-'}</p>
                    </div>
                  </div>
                  {selectedInvoice.opportunity_name && (
                    <div>
                      <p className="text-xs text-gray-400">Linked Opportunity</p>
                      <p className="text-sm font-medium text-[#800000]">{selectedInvoice.opportunity_name}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial Details */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Financial Details</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-500">Subtotal (excl. tax)</span>
                      <span className="font-mono">{formatCurrency(selectedInvoice.amount - (selectedInvoice.amount * 0.05), selectedCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-500">Tax (est. 5%)</span>
                      <span className="font-mono">{formatCurrency(selectedInvoice.amount * 0.05, selectedCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-500">Total</span>
                      <span className="font-mono font-bold">{formatCurrency(selectedInvoice.amount, selectedCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1.5">
                      <span className="text-gray-500">Amount Remaining</span>
                      <span className={`font-mono font-bold ${selectedInvoice.amount_residual > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(selectedInvoice.amount_residual || 0, selectedCurrency)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment & Collection */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Status</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Collection Progress</span>
                        <span>{selectedInvoice.amount > 0 ? Math.round(((selectedInvoice.amount - (selectedInvoice.amount_residual || 0)) / selectedInvoice.amount) * 100) : 0}%</span>
                      </div>
                      <Progress value={selectedInvoice.amount > 0 ? ((selectedInvoice.amount - (selectedInvoice.amount_residual || 0)) / selectedInvoice.amount) * 100 : 0} className="h-2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                    <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                      <p className="text-[10px] text-green-600">Collected</p>
                      <p className="font-bold text-green-700">{formatCurrency(selectedInvoice.amount - (selectedInvoice.amount_residual || 0), selectedCurrency)}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                      <p className="text-[10px] text-red-600">Outstanding</p>
                      <p className="font-bold text-red-700">{formatCurrency(selectedInvoice.amount_residual || 0, selectedCurrency)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Collection Notes & Follow-up Logs */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Collection Notes</p>
                    <Badge variant="outline" className="text-[10px]">{invoiceNotes.length} notes</Badge>
                  </div>
                  {/* Add Note Form */}
                  <div className="flex gap-2">
                    <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter' && newNote.trim()) handleAddNote(); }} />
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="followup">Follow-up</SelectItem>
                        <SelectItem value="reminder">Reminder</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 bg-[#800000] hover:bg-[#9a1919] text-white" disabled={!newNote.trim()} onClick={handleAddNote}>Add</Button>
                  </div>
                  {/* Notes List */}
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {invoiceNotes.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">No collection notes yet</p>
                    ) : invoiceNotes.map(note => (
                      <div key={note.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-[9px] ${note.type === 'payment' ? 'bg-green-100 text-green-700' : note.type === 'followup' ? 'bg-blue-100 text-blue-700' : note.type === 'reminder' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{note.type}</Badge>
                          <span className="text-[10px] text-gray-500">{note.author}</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        <p className="text-xs text-gray-700">{note.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>
                {selectedInvoice.status !== 'paid' && (
                  <Button className="flex-1 bg-[#800000] hover:bg-[#9a1919] text-white">
                    <Send className="h-4 w-4 mr-2" /> Send Reminder
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
