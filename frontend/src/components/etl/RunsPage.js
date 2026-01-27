import React, { useState, useEffect } from 'react';
import { etlAPI, eventsAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RefreshCw, Play, CheckCircle, XCircle, Clock, AlertCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  pending: 'bg-gray-100 text-gray-700',
  extracting: 'bg-blue-100 text-blue-700',
  transforming: 'bg-purple-100 text-purple-700',
  loading: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

const statusIcons = {
  pending: <Clock className="h-4 w-4" />,
  extracting: <Activity className="h-4 w-4 animate-pulse" />,
  transforming: <Activity className="h-4 w-4 animate-pulse" />,
  loading: <Activity className="h-4 w-4 animate-pulse" />,
  completed: <CheckCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
};

export function RunsPage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [sseConnected, setSSEConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);

  useEffect(() => {
    loadRuns();
    connectSSE();
    return () => {
      // Cleanup SSE
    };
  }, []);

  const loadRuns = async () => {
    try {
      const res = await etlAPI.listRuns(50);
      setRuns(res.data);
    } catch (error) {
      toast.error('Failed to load runs');
    } finally {
      setLoading(false);
    }
  };

  const connectSSE = () => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
    const eventSource = new EventSource(`${backendUrl}/api/events/stream`);
    
    eventSource.onopen = () => {
      setSSEConnected(true);
    };
    
    eventSource.onerror = () => {
      setSSEConnected(false);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'keepalive') return;
        
        setLiveEvents(prev => [data, ...prev].slice(0, 100));
        
        // Refresh runs list when run events come in
        if (data.event_type === 'etl.pipeline_run.event.v1') {
          loadRuns();
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };
    
    return () => eventSource.close();
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Run History</h1>
          <p className="text-gray-500">Monitor pipeline execution</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2" data-testid="runs-sse-connection-indicator">
            <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-500">
              {sseConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          <Button variant="outline" onClick={loadRuns}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Runs Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Runs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No runs yet. Run a pipeline to see history.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map((run) => (
                      <TableRow 
                        key={run.id} 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedRun(run)}
                        data-testid={`run-row-${run.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {statusIcons[run.status]}
                            <Badge className={statusColors[run.status]}>
                              {run.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {(run.pipeline_id || run.id || 'unknown').slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(run.started_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {run.duration_seconds ? `${run.duration_seconds.toFixed(2)}s` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-emerald-600">{run.loaded_count || 0}</span>
                            {run.error_count > 0 && (
                              <span className="text-red-600 ml-2">({run.error_count} errors)</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Live Events Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Live Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {liveEvents.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">
                      Waiting for events...
                    </p>
                  ) : (
                    liveEvents.map((event, index) => (
                      <div key={index} className="p-2 rounded bg-gray-50 border text-xs font-mono">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-xs">
                            {event.event_type?.split('.').slice(-2).join('.')}
                          </Badge>
                          <span className="text-gray-400">
                            {event.occurred_at ? new Date(event.occurred_at).toLocaleTimeString() : ''}
                          </span>
                        </div>
                        <pre className="text-gray-600 overflow-hidden text-ellipsis">
                          {JSON.stringify(event.payload, null, 2).slice(0, 200)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Selected Run Details */}
      {selectedRun && (
        <Card>
          <CardHeader>
            <CardTitle>Run Details: {selectedRun.id.slice(0, 8)}...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge className={statusColors[selectedRun.status]}>
                  {selectedRun.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Extracted</p>
                <p className="font-medium">{selectedRun.extracted_count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Transformed</p>
                <p className="font-medium">{selectedRun.transformed_count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Loaded</p>
                <p className="font-medium">{selectedRun.loaded_count || 0}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Logs</p>
              <ScrollArea className="h-48 border rounded p-3 bg-gray-900">
                <div className="space-y-1 font-mono text-xs">
                  {(selectedRun.logs || []).map((log, index) => (
                    <div key={index} className={`
                      ${log.level === 'error' ? 'text-red-400' : 
                        log.level === 'success' ? 'text-emerald-400' : 
                        log.level === 'warning' ? 'text-amber-400' : 'text-gray-300'}
                    `}>
                      <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
