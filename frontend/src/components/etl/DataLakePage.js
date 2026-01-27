import React, { useState, useEffect } from 'react';
import { dataLakeAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Database, RefreshCw, Search, FileJson } from 'lucide-react';
import { Input } from '../ui/input';
import { toast } from 'sonner';

const ENTITIES = ['opportunities', 'accounts', 'contacts', 'users', 'activities', 'invoices'];

export function DataLakePage() {
  const [selectedEntity, setSelectedEntity] = useState('opportunities');
  const [data, setData] = useState({ records: [], total: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
    loadStats();
  }, [selectedEntity]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataLakeAPI.listCanonical(selectedEntity, { limit: 100 });
      setData(res.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await dataLakeAPI.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    try {
      const res = await dataLakeAPI.search(searchQuery, selectedEntity);
      setData({ records: res.data, total: res.data.length });
    } catch (error) {
      toast.error('Search failed');
    }
  };

  const filteredRecords = data.records;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Lake</h1>
          <p className="text-gray-500">Browse canonical data</p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ENTITIES.map((entity) => (
          <Card
            key={entity}
            className={`cursor-pointer transition-all ${selectedEntity === entity ? 'ring-2 ring-cyan-500' : ''}`}
            onClick={() => setSelectedEntity(entity)}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 capitalize">{entity}</p>
                  <p className="text-2xl font-bold">
                    {stats?.entity_counts?.[entity] || 0}
                  </p>
                </div>
                <Database className={`h-8 w-8 ${selectedEntity === entity ? 'text-cyan-500' : 'text-gray-300'}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
            data-testid="datalake-search-input"
          />
        </div>
        <Button onClick={handleSearch} variant="secondary">
          Search
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Records Table */}
        <div className="lg:col-span-2">
          <Card data-testid="datalake-table-preview">
            <CardHeader>
              <CardTitle className="capitalize">{selectedEntity}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8">
                  <Skeleton className="h-64" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canonical ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No records found. Run an ETL pipeline to populate data.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow
                          key={record.canonical_id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <TableCell className="font-mono text-xs">
                            {record.canonical_id}
                          </TableCell>
                          <TableCell className="font-medium">
                            {record.name || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{record.source_system || 'unknown'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <FileJson className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* JSON Viewer */}
        <div>
          <Card data-testid="datalake-json-viewer">
            <CardHeader>
              <CardTitle>Record Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedRecord ? (
                <ScrollArea className="h-[500px]">
                  <pre className="text-xs font-mono bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedRecord, null, 2)}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  Select a record to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
