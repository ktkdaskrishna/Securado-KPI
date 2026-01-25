import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { DataTable, StatusBadge, EmptyState } from '../../components/common';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  Globe,
  MapPin,
  Users,
  DollarSign,
  Activity,
  KanbanSquare,
} from 'lucide-react';

const formatCurrency = (value) => {
  if (!value) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value}`;
};

const Account360Drawer = ({ account, open, onOpenChange }) => {
  const { data: accountData, isLoading } = useQuery({
    queryKey: ['account-360', account?.id],
    queryFn: async () => {
      const response = await apiClient.get(`/accounts/${account.id}/360`);
      return response.data;
    },
    enabled: !!account?.id && open,
  });

  if (!account) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl" data-testid="account-360-drawer">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 size={20} />
            {account.name}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="opportunities" className="flex-1">Opportunities</TabsTrigger>
            <TabsTrigger value="activities" className="flex-1">Activities</TabsTrigger>
            <TabsTrigger value="contacts" className="flex-1">Contacts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground uppercase">Industry</div>
                      <div className="font-medium mt-1">
                        {accountData?.industry || account.industry || '-'}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground uppercase">Type</div>
                      <div className="font-medium mt-1">
                        {accountData?.type || account.type || '-'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="pt-4 space-y-3">
                    {(accountData?.website || account.website) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe size={14} className="text-muted-foreground" />
                        <a
                          href={accountData?.website || account.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {accountData?.website || account.website}
                        </a>
                      </div>
                    )}
                    {(accountData?.phone || account.phone) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone size={14} className="text-muted-foreground" />
                        <span>{accountData?.phone || account.phone}</span>
                      </div>
                    )}
                    {(accountData?.email || account.email) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={14} className="text-muted-foreground" />
                        <span>{accountData?.email || account.email}</span>
                      </div>
                    )}
                    {(accountData?.address || account.address) && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin size={14} className="text-muted-foreground mt-0.5" />
                        <span>{accountData?.address || account.address}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <DollarSign className="mx-auto h-5 w-5 text-primary mb-1" />
                      <div className="text-lg font-semibold text-primary">
                        {formatCurrency(accountData?.total_value || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Value</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <KanbanSquare className="mx-auto h-5 w-5 text-chart-2 mb-1" />
                      <div className="text-lg font-semibold">
                        {accountData?.opportunities_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Opportunities</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <Activity className="mx-auto h-5 w-5 text-chart-4 mb-1" />
                      <div className="text-lg font-semibold">
                        {accountData?.activities_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Activities</div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="opportunities" className="mt-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : accountData?.opportunities?.length > 0 ? (
              <div className="space-y-2">
                {accountData.opportunities.map((opp) => (
                  <Card key={opp.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{opp.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {opp.owner_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-primary">
                          {formatCurrency(opp.value || opp.amount)}
                        </div>
                        <StatusBadge status={opp.stage} className="mt-1">
                          {opp.stage?.replace(/_/g, ' ')}
                        </StatusBadge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No opportunities found
              </div>
            )}
          </TabsContent>

          <TabsContent value="activities" className="mt-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : accountData?.activities?.length > 0 ? (
              <div className="space-y-2">
                {accountData.activities.map((activity) => (
                  <Card key={activity.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">
                          {activity.subject || activity.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {activity.type} • {activity.owner_name}
                        </div>
                      </div>
                      <StatusBadge status={activity.status}>
                        {activity.status}
                      </StatusBadge>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No activities found
              </div>
            )}
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : accountData?.contacts?.length > 0 ? (
              <div className="space-y-2">
                {accountData.contacts.map((contact) => (
                  <Card key={contact.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users size={16} className="text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{contact.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {contact.title || contact.role}
                        </div>
                        {contact.email && (
                          <div className="text-xs text-primary">{contact.email}</div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No contacts found
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

const AccountsPage = () => {
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await apiClient.get('/accounts');
      return response.data;
    },
  });

  const handleSelectAccount = (account) => {
    setSelectedAccount(account);
    setDrawerOpen(true);
  };

  const filteredAccounts = (accounts || []).filter((account) => {
    if (!search) return true;
    return (
      account.name?.toLowerCase().includes(search.toLowerCase()) ||
      account.industry?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'industry', label: 'Industry', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'website', label: 'Website', sortable: false,
      render: (value) => value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {value}
        </a>
      ) : '-'
    },
    {
      key: 'owner_name',
      label: 'Owner',
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your customer accounts</p>
        </div>
        <Button data-testid="create-account-button">
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
            className="pl-9"
            data-testid="account-search"
          />
        </div>
      </div>

      <DataTable
        columns={tableColumns}
        data={filteredAccounts}
        loading={isLoading}
        onRowClick={handleSelectAccount}
        searchable={false}
        emptyTitle="No accounts"
        emptyDescription="Create your first account to get started."
        emptyIcon={Building2}
      />

      <Account360Drawer
        account={selectedAccount}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
};

export default AccountsPage;
