import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
import { useGlobalFilters } from '../../lib/GlobalFilterContext';
import { getCurrencyOptions, DEFAULT_CURRENCY } from '../../lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Building2, Search, Eye, Phone, Mail, Globe, DollarSign, TrendingUp, Activity, Plus, MapPin, Users, FileText, Receipt, Filter, User, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [account360, setAccount360] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { formatCurrency, currency } = useCurrency();
  const { filters, hasActiveFilters, getQueryParams } = useGlobalFilters();

  // Load accounts when filters change
  useEffect(() => {
    loadAccounts();
  }, [filters.year, filters.quarter, filters.salesRep, filters.team]);

  const loadAccounts = async () => {
    try {
      // Build filter params from global filters
      const params = {};
      if (filters.year) params.year = filters.year;
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.salesRep) params.sales_rep = filters.salesRep;
      
      const res = await crmAPI.listAccounts(params);
      // Enrich accounts with currency if not present
      const enrichedAccounts = (res.data || []).map(acc => ({
        ...acc,
        currency: acc.currency || DEFAULT_CURRENCY,
        revenue: acc.revenue || 0
      }));
      setAccounts(enrichedAccounts);
    } catch (error) {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const load360 = async (account) => {
    setSelectedAccount(account);
    setSheetOpen(true);
    try {
      const res = await crmAPI.getAccount360(account.canonical_id || account.id);
      setAccount360(res.data);
    } catch (error) {
      toast.error('Failed to load account details');
    }
  };

  const filteredAccounts = accounts.filter(a =>
    !searchQuery ||
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-muted-foreground">Manage customer accounts</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" data-testid="add-account-btn">
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="accounts-search-input"
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No accounts found. Run an ETL pipeline to import data.
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account) => {
                // Determine if this is a Company or Contact
                const isCompany = account.is_company || 
                  (account.company_type === 'company') || 
                  (!account.parent_id && !account.company_name);
                
                return (
                <TableRow key={account.canonical_id || account.id} data-testid={`account-row-${account.canonical_id || account.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {/* Icon to differentiate Company vs Contact */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                        isCompany 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                          : 'bg-gradient-to-br from-purple-500 to-purple-600'
                      }`}>
                        {isCompany ? (
                          <Building2 className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{account.name}</p>
                          <Badge variant={isCompany ? "default" : "secondary"} className="text-xs py-0">
                            {isCompany ? "Company" : "Contact"}
                          </Badge>
                        </div>
                        {account.company_name && !isCompany && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {account.company_name}
                          </p>
                        )}
                        {account.email && (
                          <p className="text-xs text-muted-foreground">{account.email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {account.city || account.country ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{[account.city, account.country].filter(Boolean).join(', ') || '-'}</span>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {account.phone ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{account.phone}</span>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {account.industry ? (
                      <Badge variant="outline">{account.industry}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {account.owner_name ? (
                      <span className="text-sm">{account.owner_name}</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => load360(account)}
                      data-testid={`account-360-open-button-${account.canonical_id || account.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      360° View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 360 View Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[600px] sm:w-[700px] sm:max-w-[700px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white font-medium">
                {selectedAccount?.name?.charAt(0) || '?'}
              </div>
              <div>
                <span className="text-lg">{selectedAccount?.name}</span>
                {selectedAccount?.city && (
                  <p className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[selectedAccount.city, selectedAccount.country].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </SheetTitle>
          </SheetHeader>
          
          {account360 ? (
            <div className="mt-6">
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="pt-3 pb-3">
                    <p className="text-xs text-emerald-600">Pipeline Value</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(account360.total_value || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-3 pb-3">
                    <p className="text-xs text-blue-600">Opportunities</p>
                    <p className="text-lg font-bold text-blue-700">{account360.opportunities_count || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="pt-3 pb-3">
                    <p className="text-xs text-amber-600">Invoiced</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(account360.total_invoiced || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-3 pb-3">
                    <p className="text-xs text-red-600">Outstanding</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(account360.total_outstanding || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="contacts">Contacts ({account360.contacts?.length || 0})</TabsTrigger>
                  <TabsTrigger value="opportunities">Deals ({account360.opportunities_count || 0})</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices ({account360.invoices_count || 0})</TabsTrigger>
                </TabsList>
                
                <ScrollArea className="h-[calc(100vh-320px)] mt-4">
                  <TabsContent value="overview" className="space-y-4 pr-4">
                    {/* Contact Info */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Company Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {account360.phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{account360.phone}</span>
                          </div>
                        )}
                        {account360.email && (
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{account360.email}</span>
                          </div>
                        )}
                        {account360.website && (
                          <div className="flex items-center gap-3">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a href={account360.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {account360.website}
                            </a>
                          </div>
                        )}
                        {account360.address && (
                          <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{account360.address}</span>
                          </div>
                        )}
                        {account360.industry && (
                          <div className="flex items-center gap-3">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline">{account360.industry}</Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Recent Activity */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Recent Activities
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(account360.activities || []).length === 0 ? (
                          <p className="text-muted-foreground text-sm">No recent activities</p>
                        ) : (
                          <div className="space-y-2">
                            {(account360.activities || []).slice(0, 5).map((act, i) => (
                              <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">{act.subject}</p>
                                  <p className="text-xs text-muted-foreground">{act.type}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="contacts" className="space-y-2 pr-4">
                    {(account360.contacts || []).length === 0 ? (
                      <Card>
                        <CardContent className="pt-6 text-center">
                          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">No contacts found for this account</p>
                        </CardContent>
                      </Card>
                    ) : (
                      (account360.contacts || []).map((contact, i) => (
                        <Card key={i} className="hover:bg-muted/50 transition-colors">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-sm font-medium">
                                {contact.name?.charAt(0) || '?'}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{contact.name}</p>
                                {contact.title && <p className="text-sm text-muted-foreground">{contact.title}</p>}
                              </div>
                              <div className="text-right text-sm">
                                {contact.email && (
                                  <p className="text-muted-foreground">{contact.email}</p>
                                )}
                                {contact.phone && (
                                  <p className="text-muted-foreground">{contact.phone}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="opportunities" className="space-y-2 pr-4">
                    {(account360.opportunities || []).length === 0 ? (
                      <Card>
                        <CardContent className="pt-6 text-center">
                          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">No opportunities for this account</p>
                        </CardContent>
                      </Card>
                    ) : (
                      (account360.opportunities || []).map((opp, i) => (
                        <Card key={i} className="hover:bg-muted/50 transition-colors">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{opp.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">{opp.stage}</Badge>
                                  {opp.probability && (
                                    <span className="text-xs text-muted-foreground">{opp.probability}% prob.</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-medium">{formatCurrency(opp.sale_value || opp.amount || 0)}</p>
                                {opp.owner_name && (
                                  <p className="text-xs text-muted-foreground">{opp.owner_name}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="invoices" className="space-y-2 pr-4">
                    {(account360.invoices || []).length === 0 ? (
                      <Card>
                        <CardContent className="pt-6 text-center">
                          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">No invoices for this account</p>
                        </CardContent>
                      </Card>
                    ) : (
                      (account360.invoices || []).map((inv, i) => (
                        <Card key={i} className="hover:bg-muted/50 transition-colors">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium font-mono">{inv.invoice_number || 'INV-' + (i + 1)}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant={inv.status === 'paid' ? 'default' : inv.status === 'partial' ? 'secondary' : 'destructive'}
                                    className="text-xs"
                                  >
                                    {inv.status || 'pending'}
                                  </Badge>
                                  {inv.invoice_date && (
                                    <span className="text-xs text-muted-foreground">{inv.invoice_date}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-medium">{formatCurrency(inv.amount || 0)}</p>
                                {inv.due_date && (
                                  <p className="text-xs text-muted-foreground">Due: {inv.due_date}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <Skeleton className="h-32 w-full" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
