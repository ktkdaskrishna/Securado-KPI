import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Webhook, Activity, RefreshCw, AlertCircle, CheckCircle, Clock, Zap, ArrowRight, Filter } from 'lucide-react';

const EventStreamPage = () => {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'all', type: 'all' });
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadData();
    const interval = autoRefresh ? setInterval(loadData, 5000) : null;
    return () => interval && clearInterval(interval);
  }, [autoRefresh]);

  const loadData = async () => {
    try {
      const [eventsRes, statsRes, configsRes, connsRes] = await Promise.all([
        api.webhooks.events(),
        api.webhooks.stats(),
        api.webhooks.configs(),
        api.connections.list()
      ]);
      setEvents(eventsRes.data);
      setStats(statsRes.data);
      setConfigs(configsRes.data);
      setConnections(connsRes.data);
    } catch (error) {
      console.error('Failed to load event data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (eventId) => {
    try {
      await api.webhooks.retryEvent(eventId);
      toast.success('Event queued for retry');
      loadData();
    } catch (error) {
      toast.error('Failed to retry event');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getEventTypeBadge = (type) => {
    const colors = {
      CREATE: 'bg-green-500/10 text-green-500 border-green-500/20',
      UPDATE: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      DELETE: 'bg-red-500/10 text-red-500 border-red-500/20'
    };
    return (
      <Badge variant="outline" className={colors[type] || 'bg-gray-500/10'}>
        {type}
      </Badge>
    );
  };

  const filteredEvents = events.filter(event => {
    if (filter.status !== 'all' && event.status !== filter.status) return false;
    if (filter.type !== 'all' && event.event_type !== filter.type) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="event-stream-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-6 w-6" />
            Event Stream
          </h1>
          <p className="text-muted-foreground">Real-time CDC events from your data sources</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refreshing' : 'Auto-refresh off'}
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Events</CardDescription>
            <CardTitle className="text-3xl">{stats?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Created
            </CardDescription>
            <CardTitle className="text-3xl text-green-500">
              {stats?.by_event_type?.CREATE || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Updated
            </CardDescription>
            <CardTitle className="text-3xl text-blue-500">
              {stats?.by_event_type?.UPDATE || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Deleted
            </CardDescription>
            <CardTitle className="text-3xl text-red-500">
              {stats?.by_event_type?.DELETE || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      
      {/* Webhook Configuration Info */}
      {connections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Webhook Configuration</CardTitle>
            <CardDescription>Configure Odoo to send events to these endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {connections.map(conn => (
                <div key={conn.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-cyan-500" />
                    <div>
                      <p className="font-medium">{conn.name}</p>
                      <p className="text-xs text-muted-foreground">POST to receive events</p>
                    </div>
                  </div>
                  <code className="text-xs bg-background px-3 py-1 rounded border font-mono">
                    /api/webhooks/receive/{conn.id}
                  </code>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 rounded-lg border border-dashed">
              <h4 className="font-medium mb-2">How to configure Odoo webhooks:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to Settings → Technical → Automation → Server Actions</li>
                <li>Create a new action with "Execute Python Code" type</li>
                <li>Use the webhook URL above in your HTTP POST request</li>
                <li>Send payload: {`{model, record_id, event_type, fields}`}</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Events Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Event Log</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filter.status} onValueChange={(v) => setFilter({...filter, status: v})}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filter.type} onValueChange={(v) => setFilter({...filter, type: v})}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No events yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Events will appear here when Odoo sends webhook notifications for record changes
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs">
                      {new Date(event.received_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{getEventTypeBadge(event.event_type)}</TableCell>
                    <TableCell className="font-mono text-sm">{event.model}</TableCell>
                    <TableCell className="font-mono">#{event.record_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(event.status)}
                        <span className="capitalize">{event.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {event.status === 'error' && (
                        <Button size="sm" variant="outline" onClick={() => handleRetry(event.id)}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EventStreamPage;
