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
  RotateCcw, ChevronDown, RefreshCw, Users, Award
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
  const [filterOptions, setFilterOptions] = useState({ accounts: [], years: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [accountOpen, setAccountOpen] = useState(false);
  const { currency: globalCurrency, formatCurrency, updateCurrency } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency);

  // Contextual filters for Invoices page
  const [filters, setFilters] = useState({
    year: null,
    quarter: null,
    account: null
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
    setFilters({ year: null, quarter: null, account: null });
    setActiveTab('all');
  };

  const hasActiveFilters = () => {
    return filters.year || filters.quarter || filters.account;
  };

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build params based on active tab and filters
      const params = {
        status: activeTab === 'all' ? null : activeTab,
        year: filters.year,
        quarter: filters.quarter,
        account: filters.account,
        limit: 200
      };
      
      // Remove null values
      Object.keys(params).forEach(key => {
        if (params[key] === null) delete params[key];
      });
      
      const [invoicesRes, statsRes] = await Promise.all([
        crmAPI.listReceivables(params),
        crmAPI.getReceivablesStats({ year: filters.year, quarter: filters.quarter })
      ]);
      
      // Handle new API response format
      const invoiceData = invoicesRes.data?.invoices || invoicesRes.data || [];
      const statsData = statsRes.data?.stats || invoicesRes.data?.stats || {};
      const options = statsRes.data?.filter_options || { accounts: [], years: [] };
      
      setInvoices(invoiceData);
      setStats(statsData);
      setFilterOptions(options);
      
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
      inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const viewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setSheetOpen(true);
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
                  {curr.symbol} {curr.code}
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

        {/* Active Filter Summary */}
        {hasActiveFilters() && (
          <div className="ml-auto">
            <Badge variant="secondary" className="text-xs">
              {[filters.year, filters.quarter, filters.account].filter(Boolean).join(' • ')}
            </Badge>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoiced</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total">
                  {formatCurrency(stats?.total_invoiced || 0, selectedCurrency)}
                </p>
                <p className="text-xs text-muted-foreground">{stats?.count_total || 0} invoices</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600" data-testid="stat-pending">
                  {formatCurrency(stats?.total_pending || 0, selectedCurrency)}
                </p>
                <p className="text-xs text-muted-foreground">{stats?.count_pending || 0} invoices</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-overdue">
                  {formatCurrency(stats?.total_overdue || 0, selectedCurrency)}
                </p>
                <p className="text-xs text-muted-foreground">{stats?.count_overdue || 0} invoices</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-bold text-emerald-600" data-testid="stat-paid">
                  {formatCurrency(stats?.total_paid || 0, selectedCurrency)}
                </p>
                <p className="text-xs text-muted-foreground">{stats?.count_paid || 0} invoices</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Amount</TableHead>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {invoice.account}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {formatCurrency(invoice.amount, selectedCurrency)}
                    </TableCell>
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
        </CardContent>
      </Card>

      {/* Invoice Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedInvoice?.invoice_number}
            </SheetTitle>
          </SheetHeader>
          
          {selectedInvoice && (
            <div className="mt-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-muted-foreground">Bill To</p>
                  <p className="font-medium text-lg">{selectedInvoice.account}</p>
                </div>
                {getStatusBadge(selectedInvoice.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.due_date)}</p>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <span className="font-medium">Total Amount</span>
                <span className="text-2xl font-bold">{formatCurrency(selectedInvoice.amount, selectedCurrency)}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                {selectedInvoice.status !== 'paid' && (
                  <Button className="flex-1 bg-primary hover:bg-primary/90">
                    <Send className="h-4 w-4 mr-2" />
                    Send Reminder
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
