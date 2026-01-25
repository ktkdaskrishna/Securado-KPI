import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DataTable, JSONViewerDrawer, EmptyState } from '../../components/common';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Database,
  Search,
  Eye,
  Server,
  RefreshCw,
  Loader2,
} from 'lucide-react';

const ENTITIES = [
  { value: 'accounts', label: 'Accounts' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'activities', label: 'Activities' },
  { value: 'users', label: 'Users' },
];

const DataLakePage = () => {
  const [tab, setTab] = useState('canonical');
  const [entity, setEntity] = useState('accounts');
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false);

  const { data: canonicalData, isLoading: canonicalLoading, refetch: refetchCanonical } = useQuery({
    queryKey: ['data-lake-canonical', entity],
    queryFn: async () => {
      const response = await apiClient.get(`/data-lake/canonical`, {
        params: { entity },
      });
      return response.data;
    },
    enabled: tab === 'canonical',
  });

  const { data: servingData, isLoading: servingLoading, refetch: refetchServing } = useQuery({
    queryKey: ['data-lake-serving', entity],
    queryFn: async () => {
      const response = await apiClient.get(`/data-lake/serving`, {
        params: { entity },
      });
      return response.data;
    },
    enabled: tab === 'serving',
  });

  const { data: searchResults, isLoading: searchLoading, refetch: refetchSearch } = useQuery({
    queryKey: ['data-lake-search', search],
    queryFn: async () => {
      const response = await apiClient.get(`/search`, {
        params: { q: search },
      });
      return response.data;
    },
    enabled: search.length >= 2,
  });

  const handleViewRecord = (record) => {
    setSelectedRecord(record);
    setJsonDrawerOpen(true);
  };

  const data = tab === 'canonical' ? canonicalData : servingData;
  const isLoading = tab === 'canonical' ? canonicalLoading : servingLoading;
  const refetch = tab === 'canonical' ? refetchCanonical : refetchServing;

  // Generate columns dynamically from data
  const generateColumns = (records) => {
    if (!records || records.length === 0) return [];
    const firstRecord = records[0];
    const keys = Object.keys(firstRecord).filter(
      (key) => !['_id', '__v'].includes(key)
    ).slice(0, 6); // Limit to 6 columns

    return [
      ...keys.map((key) => ({
        key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        sortable: true,
        render: (value) => {
          if (value === null || value === undefined) return '-';
          if (typeof value === 'object') return JSON.stringify(value).slice(0, 50) + '...';
          if (typeof value === 'boolean') return value ? 'Yes' : 'No';
          return String(value).slice(0, 50);
        },
      })),
      {
        key: 'actions',
        label: '',
        render: (_, row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleViewRecord(row);
            }}
            data-testid="view-json-button"
          >
            <Eye size={14} className="mr-1" />
            JSON
          </Button>
        ),
      },
    ];
  };

  const columns = generateColumns(data?.records || data);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Data Lake</h1>
          <p className="text-muted-foreground text-sm mt-1">Browse canonical and serving data</p>
        </div>
      </div>

      {/* Global Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search across all entities..."
                className="pl-9"
                data-testid="data-lake-search"
              />
            </div>
          </div>

          {/* Search Results */}
          {search.length >= 2 && (
            <div className="mt-4">
              {searchLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : searchResults?.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.slice(0, 10).map((result, i) => (
                    <Card
                      key={result.id || i}
                      className="p-3 cursor-pointer hover:bg-white/5"
                      onClick={() => handleViewRecord(result)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {result.name || result.title || result.subject || result.id}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {result._type || result.entity_type || 'Record'}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye size={14} />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No results found
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Browser */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="canonical" data-testid="canonical-tab">
              <Database size={16} className="mr-2" />
              Canonical
            </TabsTrigger>
            <TabsTrigger value="serving" data-testid="serving-tab">
              <Server size={16} className="mr-2" />
              Serving
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="w-40" data-testid="entity-selector">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {ENTITIES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              data-testid="refresh-data-button"
            >
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>

        <TabsContent value="canonical" className="mt-4">
          <DataTable
            columns={columns}
            data={data?.records || data || []}
            loading={isLoading}
            onRowClick={handleViewRecord}
            emptyTitle="No records"
            emptyDescription="Select an entity to view canonical data."
            emptyIcon={Database}
          />
        </TabsContent>

        <TabsContent value="serving" className="mt-4">
          <DataTable
            columns={columns}
            data={data?.records || data || []}
            loading={isLoading}
            onRowClick={handleViewRecord}
            emptyTitle="No records"
            emptyDescription="Select an entity to view serving data."
            emptyIcon={Server}
          />
        </TabsContent>
      </Tabs>

      {/* JSON Viewer Drawer */}
      <JSONViewerDrawer
        open={jsonDrawerOpen}
        onOpenChange={setJsonDrawerOpen}
        data={selectedRecord}
        title="Record Details"
      />
    </div>
  );
};

export default DataLakePage;
