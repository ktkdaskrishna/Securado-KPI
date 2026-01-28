import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
import { useGlobalFilters } from '../../lib/GlobalFilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Building2, Search, Eye, Phone, Mail, MapPin, Users, FileText, Receipt, User2, Briefcase, Trophy, ChevronRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [account360, setAccount360] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { formatCurrency } = useCurrency();
  const { getQueryParams } = useGlobalFilters();

  // Load accounts
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await crmAPI.listAccounts(getQueryParams());
      setAccounts(response.data || []);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const load360 = async (account) => {
    setSelectedAccount(account);
    setSheetOpen(true);
    try {
      const response = await crmAPI.getAccount360(account.canonical_id || account.id);
      setAccount360(response.data);
    } catch (error) {
      console.error('Failed to load 360 view:', error);
      toast.error('Failed to load account details');
      setAccount360(null);
    }
  };

  // Filter accounts by search query
  const filteredAccounts = accounts.filter(account =>
    (account.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (account.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (account.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Generate a consistent color based on name
  const getAvatarColor = (name) => {
    const colors = [
      'from-violet-500 to-purple-600',
      'from-blue-500 to-cyan-600', 
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-amber-600',
      'from-pink-500 to-rose-600',
      'from-indigo-500 to-blue-600',
    ];
    const hash = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="accounts-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Accounts
          </h1>
          <p className="text-gray-500 text-sm mt-1">{filteredAccounts.length} accounts found</p>
        </div>
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Accounts Grid - Modern Card Design */}
      {filteredAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-16 w-16 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No accounts found</p>
          <p className="text-gray-400 text-sm">Try adjusting your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => (
            <Card 
              key={account.canonical_id || account.id}
              className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-gray-100 bg-white rounded-2xl overflow-hidden"
              onClick={() => load360(account)}
              data-testid={`account-card-${account.canonical_id || account.id}`}
            >
              <CardContent className="p-5">
                {/* Header with Avatar */}
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarColor(account.name)} flex items-center justify-center text-white font-semibold text-lg shadow-lg relative`}>
                    {getInitials(account.name)}
                    {/* Company/Contact indicator */}
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-md ${account.is_company ? 'bg-blue-500' : 'bg-green-500'}`}>
                      {account.is_company ? (
                        <Building2 className="h-3 w-3" />
                      ) : (
                        <User2 className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
                      {account.name}
                    </h3>
                    {account.email && (
                      <p className="text-sm text-gray-500 truncate flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3" />
                        {account.email}
                      </p>
                    )}
                    {account.phone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {account.phone}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>

                {/* Location & Industry */}
                <div className="flex items-center gap-3 mt-4 text-sm text-gray-500">
                  {(account.city || account.country) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {[account.city, account.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {account.industry && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {account.industry}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 360° View Sheet - Modern Design */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl p-0 overflow-hidden">
          {selectedAccount && (
            <div className="h-full flex flex-col">
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getAvatarColor(selectedAccount.name)} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                    {getInitials(selectedAccount.name)}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900">{selectedAccount.name}</h2>
                    {selectedAccount.email && (
                      <p className="text-gray-600 flex items-center gap-2 mt-1">
                        <Mail className="h-4 w-4" />
                        {selectedAccount.email}
                      </p>
                    )}
                    {selectedAccount.phone && (
                      <p className="text-gray-600 flex items-center gap-2 mt-0.5">
                        <Phone className="h-4 w-4" />
                        {selectedAccount.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Cards - Clean & Modern */}
              {account360 ? (
                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-4 border border-emerald-100">
                        <div className="flex items-center gap-2 text-emerald-600 mb-1">
                          <Briefcase className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Pipeline Value</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700">{formatCurrency(account360.total_value || 0)}</p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl p-4 border border-amber-100">
                        <div className="flex items-center gap-2 text-amber-600 mb-1">
                          <Trophy className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Won Deals</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-700">{formatCurrency(account360.won_value || 0)}</p>
                        <p className="text-xs text-amber-600 mt-0.5">{account360.won_count || 0} deals</p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                          <FileText className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Opportunities</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">{account360.opportunities_count || 0}</p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl p-4 border border-purple-100">
                        <div className="flex items-center gap-2 text-purple-600 mb-1">
                          <Receipt className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Invoiced</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-700">{formatCurrency(account360.total_invoiced || 0)}</p>
                      </div>
                    </div>

                    {/* Tabs for Details */}
                    <Tabs defaultValue="deals" className="w-full">
                      <TabsList className="w-full bg-gray-100/80 rounded-xl p-1">
                        <TabsTrigger value="overview" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          Overview
                        </TabsTrigger>
                        <TabsTrigger value="deals" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          Deals ({account360.opportunities_count || 0})
                        </TabsTrigger>
                        <TabsTrigger value="contacts" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          Contacts ({account360.contacts?.length || 0})
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="overview" className="mt-4">
                        <Card className="border-gray-100 rounded-xl">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base font-medium">Company Details</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            {selectedAccount.email && (
                              <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-600">{selectedAccount.email}</span>
                              </div>
                            )}
                            {selectedAccount.phone && (
                              <div className="flex items-center gap-3">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-600">{selectedAccount.phone}</span>
                              </div>
                            )}
                            {(selectedAccount.city || selectedAccount.country) && (
                              <div className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-600">
                                  {[selectedAccount.street, selectedAccount.city, selectedAccount.country].filter(Boolean).join(', ')}
                                </span>
                              </div>
                            )}
                            {selectedAccount.website && (
                              <div className="flex items-center gap-3">
                                <ExternalLink className="h-4 w-4 text-gray-400" />
                                <a href={selectedAccount.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {selectedAccount.website}
                                </a>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        
                        {/* Recent Activities */}
                        <Card className="border-gray-100 rounded-xl mt-4">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base font-medium">Recent Activities</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {account360.activities?.length > 0 ? (
                              <div className="space-y-2">
                                {account360.activities.slice(0, 5).map((act, idx) => (
                                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                                    <span className="text-sm text-gray-600">{act.summary || act.subject || 'Activity'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-400 text-sm">No recent activities</p>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                      
                      <TabsContent value="deals" className="mt-4">
                        {account360.opportunities?.length > 0 ? (
                          <div className="space-y-2">
                            {account360.opportunities.map((opp, idx) => (
                              <Card key={idx} className="border-gray-100 rounded-xl hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{opp.name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge 
                                          variant={opp.stage?.toLowerCase() === 'won' ? 'default' : 'secondary'}
                                          className={`text-xs ${opp.stage?.toLowerCase() === 'won' ? 'bg-emerald-500' : ''}`}
                                        >
                                          {opp.stage}
                                        </Badge>
                                        {opp.owner_name && (
                                          <span className="text-xs text-gray-500">{opp.owner_name}</span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="font-bold text-gray-900 ml-4">
                                      {formatCurrency(opp.sale_value || opp.amount || 0)}
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400">No deals found</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="contacts" className="mt-4">
                        {account360.contacts?.length > 0 ? (
                          <div className="space-y-2">
                            {account360.contacts.map((contact, idx) => (
                              <Card key={idx} className="border-gray-100 rounded-xl">
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarColor(contact.name)} flex items-center justify-center text-white text-sm font-medium`}>
                                      {getInitials(contact.name)}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">{contact.name}</p>
                                      {contact.email && (
                                        <p className="text-sm text-gray-500">{contact.email}</p>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400">No contacts found</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
