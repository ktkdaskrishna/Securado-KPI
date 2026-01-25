import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { previewAPI, connectionAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Table, RefreshCw, Code, Database } from 'lucide-react';

const PreviewPage = () => {
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [selectedModel, setSelectedModel] = useState('crm.lead');
  const [viewMode, setViewMode] = useState('table');

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await connectionAPI.list();
      return res.data;
    },
  });

  const { data: sourceData, isLoading: sourceLoading, refetch: refetchSource } = useQuery({
    queryKey: ['preview-source', selectedConnection, selectedModel],
    queryFn: async () => {
      if (!selectedConnection) return null;
      const res = await previewAPI.sourceData(selectedConnection, selectedModel, 10);
      return res.data;
    },
    enabled: !!selectedConnection,
  });

  const { data: silverData, isLoading: silverLoading, refetch: refetchSilver } = useQuery({
    queryKey: ['preview-silver'],
    queryFn: async () => {
      const res = await previewAPI.silverData(20);
      return res.data;
    },
  });

  const renderTableView = (records) => {
    if (!records || records.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No records found</div>;
    }

    const columns = Object.keys(records[0]).filter(k => !k.startsWith('_'));

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              {columns.slice(0, 8).map((col) => (
                <th key={col} className="text-left py-2 px-3 text-xs text-muted-foreground font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record, i) => (
              <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                {columns.slice(0, 8).map((col) => (
                  <td key={col} className="py-2 px-3 truncate max-w-[200px]">
                    {typeof record[col] === 'object'
                      ? JSON.stringify(record[col])
                      : String(record[col] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderJsonView = (records) => {
    return (
      <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-[500px]">
        {JSON.stringify(records, null, 2)}
      </pre>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Preview</h1>
        <p className="text-muted-foreground">Preview source and transformed data</p>
      </div>

      <Tabs defaultValue="source" className="space-y-4">
        <TabsList>
          <TabsTrigger value="source" data-testid="source-tab">
            <Database className="h-4 w-4 mr-2" />
            Source Data (Odoo)
          </TabsTrigger>
          <TabsTrigger value="silver" data-testid="silver-tab">
            <Table className="h-4 w-4 mr-2" />
            Transformed Data (Silver)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="source">
          <Card className="bg-card/80 border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Source Data from Odoo</CardTitle>
                  <CardDescription>Raw data from your Odoo CRM</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={selectedConnection || ''} onValueChange={setSelectedConnection}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crm.lead">crm.lead</SelectItem>
                      <SelectItem value="crm.stage">crm.stage</SelectItem>
                      <SelectItem value="res.partner">res.partner</SelectItem>
                      <SelectItem value="res.users">res.users</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => refetchSource()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedConnection ? (
                <div className="text-center py-8 text-muted-foreground">
                  Select a connection to preview data
                </div>
              ) : sourceLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div data-testid="source-preview">
                  <div className="flex justify-end mb-2">
                    <div className="flex gap-1">
                      <Button
                        variant={viewMode === 'table' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                      >
                        <Table className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'json' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('json')}
                      >
                        <Code className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    {viewMode === 'table'
                      ? renderTableView(sourceData?.records)
                      : renderJsonView(sourceData?.records)}
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="silver">
          <Card className="bg-card/80 border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Transformed Data (Silver Layer)</CardTitle>
                  <CardDescription>
                    {silverData?.count || 0} records in silver_opportunities
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchSilver()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {silverLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div data-testid="silver-preview">
                  <div className="flex justify-end mb-2">
                    <div className="flex gap-1">
                      <Button
                        variant={viewMode === 'table' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                      >
                        <Table className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'json' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('json')}
                      >
                        <Code className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    {viewMode === 'table'
                      ? renderTableView(silverData?.records)
                      : renderJsonView(silverData?.records)}
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PreviewPage;
