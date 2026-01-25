import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { runAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { History, CheckCircle, XCircle, Clock, Loader2, ArrowDownToLine, RefreshCw, Upload } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const configs = {
    pending: { icon: Clock, className: 'status-badge pending', label: 'Pending' },
    extracting: { icon: ArrowDownToLine, className: 'status-badge running', label: 'Extracting', spin: false },
    transforming: { icon: RefreshCw, className: 'status-badge running', label: 'Transforming', spin: true },
    loading: { icon: Upload, className: 'status-badge running', label: 'Loading', spin: false },
    running: { icon: Loader2, className: 'status-badge running', label: 'Running', spin: true },
    completed: { icon: CheckCircle, className: 'status-badge completed', label: 'Completed' },
    failed: { icon: XCircle, className: 'status-badge failed', label: 'Failed' },
  };
  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <span className={config.className}>
      <Icon className={`h-3 w-3 ${config.spin ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
};

const RunsPage = () => {
  const [selectedRun, setSelectedRun] = useState(null);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['pipeline-runs'],
    queryFn: async () => {
      const res = await runAPI.list(50);
      return res.data;
    },
    refetchInterval: 3000, // Poll for updates
  });

  const { data: runDetails } = useQuery({
    queryKey: ['run-details', selectedRun],
    queryFn: async () => {
      if (!selectedRun) return null;
      const res = await runAPI.get(selectedRun);
      return res.data;
    },
    enabled: !!selectedRun,
    refetchInterval: selectedRun ? 2000 : false,
  });

  const viewLogs = (runId) => {
    setSelectedRun(runId);
    setLogsDialogOpen(true);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline Runs</h1>
        <p className="text-muted-foreground">Monitor pipeline execution history and logs</p>
      </div>

      {/* Runs Table */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Recent Runs
          </CardTitle>
          <CardDescription>{runs.length} runs found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No pipeline runs yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto" data-testid="runs-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Run ID</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Extracted</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Transformed</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Loaded</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Duration</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Started</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Logs</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-border/40 hover:bg-muted/20" data-testid="run-row">
                      <td className="py-3 px-4 font-mono text-xs">{run.id.slice(0, 8)}...</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="text-right py-3 px-4 tabular-nums">{run.extracted_count || 0}</td>
                      <td className="text-right py-3 px-4 tabular-nums">{run.transformed_count || 0}</td>
                      <td className="text-right py-3 px-4 tabular-nums">{run.loaded_count || 0}</td>
                      <td className="text-right py-3 px-4 tabular-nums">{formatDuration(run.duration_seconds)}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(run.started_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => viewLogs(run.id)}
                          className="text-primary hover:underline text-xs"
                          data-testid={`view-logs-${run.id}`}
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Pipeline Run Logs
              {runDetails && <StatusBadge status={runDetails.status} />}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {runDetails && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground">Extracted</div>
                    <div className="text-xl font-bold tabular-nums">{runDetails.extracted_count || 0}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground">Transformed</div>
                    <div className="text-xl font-bold tabular-nums">{runDetails.transformed_count || 0}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground">Loaded</div>
                    <div className="text-xl font-bold tabular-nums">{runDetails.loaded_count || 0}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground">Errors</div>
                    <div className="text-xl font-bold tabular-nums text-destructive">{runDetails.error_count || 0}</div>
                  </div>
                </div>

                {/* Logs */}
                <ScrollArea className="h-[350px] border rounded-lg p-3 bg-background">
                  <div className="space-y-1" data-testid="log-viewer">
                    {runDetails.logs?.map((log, index) => (
                      <div key={index} className={`log-entry ${log.level}`}>
                        <span className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="mx-2">•</span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                    {(!runDetails.logs || runDetails.logs.length === 0) && (
                      <div className="text-center text-muted-foreground py-4">
                        No logs available
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {runDetails.error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <div className="text-xs text-destructive font-medium mb-1">Error</div>
                    <div className="text-sm text-destructive">{runDetails.error}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RunsPage;
