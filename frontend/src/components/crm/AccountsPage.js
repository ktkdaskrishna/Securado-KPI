import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Building2, Search, Eye, Phone, Mail, Globe, DollarSign, TrendingUp, Activity, Plus } from 'lucide-react';
import { toast } from 'sonner';

export function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [account360, setAccount360] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { formatCurrency, currency } = useCurrency();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await crmAPI.listAccounts();
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
              <TableHead>Industry</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No accounts found. Run an ETL pipeline to import data.
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account) => (
                <TableRow key={account.canonical_id || account.id} data-testid={`account-row-${account.canonical_id || account.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {account.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {account.industry ? (
                      <Badge variant="outline">{account.industry}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {account.currency || DEFAULT_CURRENCY}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {account.revenue ? formatCurrency(account.revenue, account.currency || DEFAULT_CURRENCY) : '-'}
                  </TableCell>
                  <TableCell>{account.phone || '-'}</TableCell>
                  <TableCell>{account.owner_name || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
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
        <SheetContent className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedAccount?.name}
            </SheetTitle>
          </SheetHeader>
          
          {account360 ? (
            <ScrollArea className="h-[calc(100vh-100px)] mt-6">
              <div className="space-y-6 pr-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Total Value</p>
                          <p className="text-xl font-bold">{formatCurrency(account360.total_value || 0)}</p>
                        </div>
                        <DollarSign className="h-8 w-8 text-emerald-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Opportunities</p>
                          <p className="text-xl font-bold">{account360.opportunities_count || 0}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-cyan-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Contact Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {account360.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{account360.phone}</span>
                      </div>
                    )}
                    {account360.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{account360.email}</span>
                      </div>
                    )}
                    {account360.website && (
                      <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a href={account360.website} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">
                          {account360.website}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contacts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Key Contacts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(account360.contacts || []).map((contact, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded bg-gray-50">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-sm">
                            {contact.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{contact.name}</p>
                            <p className="text-xs text-gray-500">{contact.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Opportunities */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Opportunities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(account360.opportunities || []).length === 0 ? (
                        <p className="text-gray-500 text-sm">No opportunities</p>
                      ) : (
                        (account360.opportunities || []).map((opp, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded bg-gray-50">
                            <div>
                              <p className="font-medium text-sm">{opp.name}</p>
                              <Badge variant="outline" className="text-xs">{opp.stage}</Badge>
                            </div>
                            <span className="font-mono text-sm">${(opp.amount || 0).toLocaleString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Activities */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Recent Activities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(account360.activities || []).length === 0 ? (
                        <p className="text-gray-500 text-sm">No activities</p>
                      ) : (
                        (account360.activities || []).map((act, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 rounded bg-gray-50">
                            <Activity className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-sm">{act.subject}</p>
                              <p className="text-xs text-gray-500">{act.type}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
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
