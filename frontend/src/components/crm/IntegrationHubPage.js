import React, { useState, useEffect } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import {
  RefreshCw, CheckCircle2, AlertTriangle, Clock, Database, Wifi, WifiOff,
  Play, Settings, History, Webhook, Copy, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

function EntityCard({ entity, onSync, onScheduleChange, syncing }) {
  const isSyncing = syncing === entity.id;
  return (
    <Card className={`hover:shadow-md transition-all ${entity.is_overdue ? 'border-yellow-300' : ''}`} data-testid={`entity-${entity.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#800000]" />
            <h4 className="text-sm font-semibold text-gray-900">{entity.label}</h4>
          </div>
          <div className="flex items-center gap-2">
            {entity.queued_events > 0 && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{entity.queued_events} queued</Badge>}
            {entity.is_overdue && <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">Overdue</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-gray-50">
            <p className="text-2xl font-bold text-gray-900">{entity.record_count.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400">Records</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50">
            <p className="text-xs font-medium text-gray-600">{entity.last_sync ? new Date(entity.last_sync).toLocaleDateString() : 'Never'}</p>
            <p className="text-[10px] text-gray-400">Last Sync</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50">
            <p className="text-xs font-medium text-gray-600 capitalize">{entity.schedule}</p>
            <p className="text-[10px] text-gray-400">Schedule</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Select value={entity.schedule} onValueChange={(v) => onScheduleChange(entity.id, v, entity.webhook_enabled)}>
            <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSync(entity.id)} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntegrationHubPage() {
  const [overview, setOverview] = useState(null);
  const [webhookConfig, setWebhookConfig] = useState(null);
  const [history, setHistory] = useState([]);
  const [queue, setQueue] = useState({ items: [], pending: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const load = async () => {
      try {
        const [ovR, whR, hR, qR] = await Promise.allSettled([
          targetAPI.getHubOverview(), targetAPI.getWebhookConfig(),
          targetAPI.getSyncHistory(), targetAPI.getWebhookQueue(30)
        ]);
        if (ovR.status === 'fulfilled') setOverview(ovR.value.data);
        if (whR.status === 'fulfilled') setWebhookConfig(whR.value.data);
        if (hR.status === 'fulfilled') setHistory(hR.value.data);
        if (qR.status === 'fulfilled') setQueue(qR.value.data);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const handleSync = async (entityId) => {
    setSyncing(entityId);
    try {
      const res = await targetAPI.triggerSync(entityId);
      toast.success(res.data.message);
      // Refresh overview after delay
      setTimeout(async () => {
        const ovR = await targetAPI.getHubOverview();
        setOverview(ovR.data);
        setSyncing(null);
      }, 2000);
    } catch { toast.error('Sync failed'); setSyncing(null); }
  };

  const handleScheduleChange = async (entityId, schedule, webhookEnabled) => {
    try {
      await targetAPI.updateSyncSchedule(entityId, { schedule, webhook_enabled: webhookEnabled });
      toast.success(`Schedule updated: ${entityId} → ${schedule}`);
      const ovR = await targetAPI.getHubOverview();
      setOverview(ovR.data);
    } catch { toast.error('Failed'); }
  };

  const handleProcessQueue = async () => {
    try {
      const res = await targetAPI.processWebhookQueue();
      toast.success(`Processed ${res.data.processed} events`);
      const qR = await targetAPI.getWebhookQueue(30);
      setQueue(qR.data);
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-5" data-testid="integration-hub-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Database className="h-6 w-6 text-[#800000]" /> Integration Hub</h1>
          <p className="text-gray-500 text-sm">Sync management, webhook queue, scheduling</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {overview?.connected ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
            <span className="text-sm font-medium">{overview?.connected ? 'Odoo Connected' : 'Not Connected'}</span>
          </div>
          <Badge variant="secondary">{overview?.total_records?.toLocaleString() || 0} total records</Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Data Sync</TabsTrigger>
          <TabsTrigger value="webhook">Webhook Queue</TabsTrigger>
          <TabsTrigger value="history">Sync History</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(overview?.entities || []).map(entity => (
              <EntityCard key={entity.id} entity={entity} onSync={handleSync} onScheduleChange={handleScheduleChange} syncing={syncing} />
            ))}
          </div>
        </TabsContent>

        {/* WEBHOOK QUEUE */}
        <TabsContent value="webhook" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={queue.pending > 0 ? "default" : "secondary"} className={queue.pending > 0 ? "bg-blue-600" : ""}>{queue.pending} pending</Badge>
              <span className="text-sm text-gray-500">{queue.items?.length || 0} recent events</span>
            </div>
            {queue.pending > 0 && <Button size="sm" onClick={handleProcessQueue} className="bg-[#800000] hover:bg-[#9a1919] text-white"><Play className="h-3.5 w-3.5 mr-1" /> Process Queue Now</Button>}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Model</TableHead><TableHead>Action</TableHead><TableHead>Record ID</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(queue.items || []).map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{item.entity}</TableCell>
                      <TableCell className="text-xs text-gray-500">{item.odoo_model}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{item.action}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{item.record_id || '-'}</TableCell>
                      <TableCell className="text-xs text-gray-500">{item.received_at ? new Date(item.received_at).toLocaleString() : '-'}</TableCell>
                      <TableCell>{item.processed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-yellow-500" />}</TableCell>
                    </TableRow>
                  ))}
                  {(queue.items || []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No webhook events received yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SYNC HISTORY */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Trigger</TableHead><TableHead>By</TableHead><TableHead>Status</TableHead><TableHead>Started</TableHead></TableRow></TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{h.entity || h.pipeline_name || '-'}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{h.trigger || h.trigger_type || '-'}</Badge></TableCell>
                      <TableCell className="text-sm text-gray-500">{h.triggered_by || '-'}</TableCell>
                      <TableCell><Badge variant={h.status === 'completed' ? 'default' : 'secondary'} className={`text-xs ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : h.status === 'failed' ? 'bg-red-100 text-red-700' : ''}`}>{h.status}</Badge></TableCell>
                      <TableCell className="text-xs text-gray-500">{h.started_at ? new Date(h.started_at).toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-400">No sync history</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIGURATION */}
        <TabsContent value="config" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Webhook className="h-4 w-4 text-[#800000]" /> Webhook Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-500">Configure Odoo to send webhook notifications to this URL for real-time sync.</p>
              {webhookConfig && (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-gray-400">Webhook URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm bg-white px-3 py-1.5 rounded border flex-1 font-mono">{webhookConfig.webhook_url}</code>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => { navigator.clipboard.writeText(webhookConfig.webhook_url); toast.success('Copied'); }}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Setup Instructions</Label>
                    <ol className="mt-1 space-y-1.5">
                      {webhookConfig.instructions?.map((step, i) => (
                        <li key={i} className="text-sm text-gray-600 flex gap-2"><span className="text-[#800000] font-bold">{i + 1}.</span> {step}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Supported Odoo Models</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(webhookConfig.supported_models || {}).map(([entity, model]) => (
                        <Badge key={entity} variant="outline" className="text-xs">{entity}: {model}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4 text-[#800000]" /> Schedule Configuration</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Odoo Model</TableHead><TableHead>Schedule</TableHead><TableHead>Records</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(overview?.entities || []).map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium text-sm">{e.label}</TableCell>
                      <TableCell className="text-xs text-gray-500 font-mono">{e.odoo_model}</TableCell>
                      <TableCell>
                        <Select value={e.schedule} onValueChange={(v) => handleScheduleChange(e.id, v, e.webhook_enabled)}>
                          <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="hourly">Hourly</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">{e.record_count.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
