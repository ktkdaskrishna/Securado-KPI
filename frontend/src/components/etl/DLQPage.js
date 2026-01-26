import React, { useState, useEffect } from 'react';
import { eventsAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RefreshCw, AlertTriangle, RotateCcw, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function DLQPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('failed');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        eventsAPI.listDLQ({ status: statusFilter }),
        eventsAPI.getDLQStats(),
      ]);
      setItems(itemsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load DLQ data');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id) => {
    try {
      await eventsAPI.retryDLQ(id);
      toast.success('Item marked for retry');
      loadData();
    } catch (error) {
      toast.error('Failed to retry item');
    }
  };

  const handleDismiss = async (id) => {
    try {
      await eventsAPI.dismissDLQ(id);
      toast.success('Item dismissed');
      loadData();
    } catch (error) {
      toast.error('Failed to dismiss item');
    }
  };

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dead Letter Queue</h1>
          <p className="text-gray-500">Manage failed records</p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Failed</p>
                <p className="text-3xl font-bold text-red-700">{stats?.failed || 0}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">Retried</p>
                <p className="text-3xl font-bold text-amber-700">{stats?.retried || 0}</p>
              </div>
              <RotateCcw className="h-10 w-10 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Dismissed</p>
                <p className="text-3xl font-bold text-gray-700">{stats?.dismissed || 0}</p>
              </div>
              <Trash2 className="h-10 w-10 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="dlq-filter-select">
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="retried">Retried</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Items Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Record ID</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No {statusFilter} items</p>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">
                    {item.record_id}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.pipeline_id?.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-red-600 truncate">{item.error}</p>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {statusFilter === 'failed' && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(item.id)}
                          data-testid="dlq-retry-button"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Retry
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismiss(item.id)}
                          data-testid="dlq-discard-button"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
