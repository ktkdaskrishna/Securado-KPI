import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dlqAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { AlertCircle, RefreshCw, RotateCcw, Inbox, Clock } from 'lucide-react';

const AdminDLQ = () => {
  const { currentTenant } = useOutletContext();
  const queryClient = useQueryClient();

  const { data: dlqItems = [], isLoading, refetch } = useQuery({
    queryKey: ['dlq', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const res = await dlqAPI.list(currentTenant.id);
      return res.data;
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 30000,
  });

  const retryMutation = useMutation({
    mutationFn: (id) => dlqAPI.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq'] });
      toast.success('Event requeued for processing');
    },
    onError: (error) => {
      toast.error('Failed to retry event');
    },
  });

  const bulkRetryMutation = useMutation({
    mutationFn: () => dlqAPI.bulkRetry(currentTenant.id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['dlq'] });
      toast.success(`${response.data.retried_count} events requeued`);
    },
    onError: (error) => {
      toast.error('Failed to bulk retry events');
    },
  });

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a tenant first</p>
      </div>
    );
  }

  const failedItems = dlqItems.filter(item => item.status === 'failed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dead Letter Queue</h1>
          <p className="text-muted-foreground">Manage failed events and retry processing</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            data-testid="dlq-refresh-button"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {failedItems.length > 0 && (
            <Button
              onClick={() => bulkRetryMutation.mutate()}
              disabled={bulkRetryMutation.isPending}
              data-testid="dlq-bulk-retry-button"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Bulk Retry All ({failedItems.length})
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/80 border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(var(--danger))]/10">
                <AlertCircle className="h-5 w-5 text-[hsl(var(--danger))]" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{failedItems.length}</div>
                <div className="text-xs text-muted-foreground">Failed Events</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(var(--warning))]/10">
                <Clock className="h-5 w-5 text-[hsl(var(--warning))]" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {dlqItems.filter(item => item.status === 'retried').length}
                </div>
                <div className="text-xs text-muted-foreground">Retried</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Inbox className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{dlqItems.length}</div>
                <div className="text-xs text-muted-foreground">Total Events</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DLQ Table */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Failed Events</CardTitle>
          <CardDescription>Events that failed processing and need attention</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : failedItems.length === 0 ? (
            <div className="text-center py-12" data-testid="table-empty-state">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No failed events</h3>
              <p className="text-sm text-muted-foreground">All events are processing successfully!</p>
            </div>
          ) : (
            <div className="overflow-x-auto" data-testid="dlq-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Event ID</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Topic</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Error</th>
                    <th className="text-center py-3 px-4 text-xs text-muted-foreground font-medium">Retries</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Created</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {failedItems.map((item) => (
                    <tr key={item.id} className="border-b border-border/40 hover:bg-muted/20" data-testid="table-row">
                      <td className="py-3 px-4 font-mono text-xs">{item.id.slice(0, 8)}...</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="border-border/60 font-mono text-xs">
                          {item.topic}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[hsl(var(--danger))]" data-testid="dlq-error-message">
                          {item.error_message}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant="outline" className="border-border/60">
                          {item.retry_count}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryMutation.mutate(item.id)}
                          disabled={retryMutation.isPending}
                          data-testid="dlq-retry-button"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDLQ;
