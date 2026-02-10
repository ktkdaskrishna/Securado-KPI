import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI, etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Database, Wifi, WifiOff, Play, RefreshCw, CheckCircle2, AlertTriangle,
  Clock, ArrowLeft, Plus, Copy, Loader2, GitMerge, Search, History, Webhook, Settings
} from 'lucide-react';
import { toast } from 'sonner';

// Import original ETL components (keeping their full UI)
import { MappingsPage } from '../etl/MappingsPage';
import { OdooModelBrowserPage } from '../etl/OdooModelBrowserPage';
import { RunsPage } from '../etl/RunsPage';

// Source card on main view
function SourceCard({ source, onClick }) {
  return (
    <Card className={`cursor-pointer hover:shadow-lg transition-all hover:border-[#800000]/30 ${source.connected ? '' : 'opacity-60'}`} onClick={onClick} data-testid={`source-${source.id}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#800000]/10 flex items-center justify-center">
              <Database className="h-6 w-6 text-[#800000]" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{source.name}</h3>
              <p className="text-xs text-gray-500">{source.type}</p>
            </div>
          </div>
          {source.connected ? <Badge className="bg-emerald-100 text-emerald-700">Connected</Badge> : <Badge variant="secondary">Disconnected</Badge>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-gray-50">
            <p className="text-xl font-bold text-gray-900">{source.total_records?.toLocaleString() || 0}</p>
            <p className="text-[10px] text-gray-400">Records</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50">
            <p className="text-sm font-medium text-gray-700">{source.entities_count || 0}</p>
            <p className="text-[10px] text-gray-400">Entities</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50">
            <p className="text-sm font-medium text-gray-700">{source.overdue_count || 0}</p>
            <p className="text-[10px] text-gray-400">{source.overdue_count > 0 ? '⚠ Overdue' : 'Healthy'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Future source placeholder
function AddSourceCard() {
  return (
    <Card className="border-dashed border-2 hover:border-[#800000]/30 cursor-pointer transition-all opacity-60 hover:opacity-80">
      <CardContent className="p-6 flex flex-col items-center justify-center min-h-[180px]">
        <Plus className="h-10 w-10 text-gray-300 mb-2" />
        <p className="text-sm font-medium text-gray-400">Add Integration</p>
        <p className="text-xs text-gray-300 mt-1">Microsoft 365, Salesforce, etc.</p>
      </CardContent>
    </Card>
  );
}

// Source detail view with tabs
function SourceDetail({ overview, onBack, onRefresh }) {
  const [tab, setTab] = useState('sync');
  const [syncing, setSyncing] = useState(null);
  const [queue, setQueue] = useState({ items: [], pending: 0 });
  const [history, setHistory] = useState([]);
  const [webhookConfig, setWebhookConfig] = useState(null);
  const [mappings, setMappings] = useState([]);

  useEffect(() => {
    targetAPI.getWebhookQueue(30).then(r => setQueue(r.data)).catch(() => {});
    targetAPI.getSyncHistory({ limit: 30 }).then(r => setHistory(r.data)).catch(() => {});
    targetAPI.getWebhookConfig().then(r => setWebhookConfig(r.data)).catch(() => {});
    etlAPI.listMappings().then(r => setMappings(r.data)).catch(() => {});
  }, []);

  const handleSync = async (entityId) => {
    setSyncing(entityId);
    try {
      const res = await targetAPI.triggerSync(entityId);
      toast.success(res.data.message);
      setTimeout(() => { onRefresh(); setSyncing(null); }, 2000);
    } catch { toast.error('Sync failed'); setSyncing(null); }
  };

  const handleSyncAll = async () => {
    setSyncing('all');
    toast.info('Syncing all entities...');
    for (const entity of overview?.entities || []) {
      try { await targetAPI.triggerSync(entity.id); } catch {}
    }
    setTimeout(() => { onRefresh(); setSyncing(null); toast.success('All syncs triggered'); }, 3000);
  };

  const handleScheduleChange = async (entityId, schedule) => {
    try {
      await targetAPI.updateSyncSchedule(entityId, { schedule, webhook_enabled: false });
      toast.success(`${entityId}: ${schedule}`);
      onRefresh();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="w-10 h-10 rounded-xl bg-[#800000]/10 flex items-center justify-center"><Database className="h-5 w-5 text-[#800000]" /></div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{overview?.connection_name || 'Odoo ERP'}</h2>
            <p className="text-xs text-gray-500">{overview?.total_records?.toLocaleString()} records across {overview?.entities?.length} entities</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overview?.connected ? <Badge className="bg-emerald-100 text-emerald-700"><Wifi className="h-3 w-3 mr-1" /> Connected</Badge> : <Badge variant="destructive"><WifiOff className="h-3 w-3 mr-1" /> Disconnected</Badge>}
          <Button onClick={handleSyncAll} disabled={syncing === 'all'} className="bg-[#800000] hover:bg-[#9a1919] text-white">
            {syncing === 'all' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />} Sync All
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sync">Sync Status</TabsTrigger>
          <TabsTrigger value="mapping">Data Mapping</TabsTrigger>
          <TabsTrigger value="browser">Model Browser</TabsTrigger>
          <TabsTrigger value="log">Sync Log</TabsTrigger>
        </TabsList>

        {/* SYNC STATUS */}
        <TabsContent value="sync" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead className="w-28">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overview?.entities || []).map(entity => (
                    <TableRow key={entity.id} className={entity.is_overdue ? 'bg-yellow-50/50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-[#800000]" />
                          <div>
                            <span className="font-medium text-sm">{entity.label}</span>
                            <p className="text-[10px] text-gray-400 font-mono">{entity.odoo_model}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">{entity.record_count.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`text-xs ${entity.is_overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          {entity.last_sync ? new Date(entity.last_sync).toLocaleDateString() : 'Never'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select value={entity.schedule} onValueChange={(v) => handleScheduleChange(entity.id, v)}>
                          <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {entity.is_overdue ? <AlertTriangle className="h-4 w-4 text-yellow-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        {entity.queued_events > 0 && <Badge variant="outline" className="text-[9px] ml-1 text-blue-600 border-blue-200">{entity.queued_events}q</Badge>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSync(entity.id)} disabled={syncing === entity.id}>
                          {syncing === entity.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                          Sync
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Webhook status */}
          {queue.pending > 0 && (
            <Card className="mt-3 border-blue-200 bg-blue-50/30">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><Webhook className="h-4 w-4 text-blue-500" /><span className="text-sm text-blue-700">{queue.pending} webhook events queued</span></div>
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => targetAPI.processWebhookQueue().then(() => { toast.success('Queue processed'); onRefresh(); })}><Play className="h-3 w-3 mr-1" /> Process Queue</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DATA MAPPING */}
        <TabsContent value="mapping" className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitMerge className="h-4 w-4 text-[#800000]" /> Field Mappings (Odoo → CRM)</CardTitle></CardHeader>
            <CardContent>
              {mappings.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Mapping</TableHead><TableHead>Source Model</TableHead><TableHead>Target</TableHead><TableHead>Fields</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {mappings.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-sm">{m.name}</TableCell>
                        <TableCell className="text-xs text-gray-500 font-mono">{m.source_model}</TableCell>
                        <TableCell className="text-xs text-gray-500">{m.target_entity}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{m.field_mappings?.length || 0} fields</Badge></TableCell>
                        <TableCell><Badge variant={m.status === 'active' ? 'default' : 'secondary'} className={`text-xs ${m.status === 'active' ? 'bg-emerald-100 text-emerald-700' : ''}`}>{m.status || 'active'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <GitMerge className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Mappings are auto-configured from ETL templates.</p>
                  <p className="text-gray-300 text-xs mt-1">Advanced mapping editor available in Settings → Mappings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MODEL BROWSER */}
        <TabsContent value="browser" className="mt-4">
          <ModelBrowserInline />
        </TabsContent>

        {/* SYNC LOG */}
        <TabsContent value="log" className="mt-4 space-y-3">
          {/* Webhook config */}
          {webhookConfig && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Webhook className="h-4 w-4 text-[#800000]" /> Webhook Endpoint</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <code className="text-xs flex-1 font-mono text-gray-600 truncate">{webhookConfig.webhook_url}</code>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => { navigator.clipboard.writeText(webhookConfig.webhook_url); toast.success('Copied'); }}><Copy className="h-3 w-3" /></Button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Configure in Odoo: Settings → Technical → Automated Actions → Send Webhook on Create/Update</p>
              </CardContent>
            </Card>
          )}

          {/* Recent webhook events */}
          {(queue.items || []).length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Webhook Events</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>Time</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(queue.items || []).slice(0, 15).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{item.entity}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{item.action}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{item.record_id || '-'}</TableCell>
                        <TableCell className="text-xs text-gray-500">{item.received_at ? new Date(item.received_at).toLocaleString() : '-'}</TableCell>
                        <TableCell>{item.processed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Clock className="h-3.5 w-3.5 text-yellow-500" />}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Sync history */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-[#800000]" /> Sync History</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Trigger</TableHead><TableHead>By</TableHead><TableHead>Status</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{h.entity || h.pipeline_name || '-'}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{h.trigger || h.trigger_type || '-'}</Badge></TableCell>
                      <TableCell className="text-xs text-gray-500">{h.triggered_by || '-'}</TableCell>
                      <TableCell><Badge variant={h.status === 'completed' ? 'default' : 'secondary'} className={`text-xs ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : h.status === 'failed' ? 'bg-red-100 text-red-700' : ''}`}>{h.status}</Badge></TableCell>
                      <TableCell className="text-xs text-gray-500">{h.started_at ? new Date(h.started_at).toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-400 text-sm">No sync history yet. Click "Sync" on any entity to start.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Inline model browser
function ModelBrowserInline() {
  const [models, setModels] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const connections = await etlAPI.listConnections();
        if (connections.data?.length > 0) {
          const connId = connections.data[0].id;
          const schema = await etlAPI.getSchema(connId);
          if (schema.data?.models) {
            setModels(Object.entries(schema.data.models).map(([name, data]) => ({
              name, fields: data.fields?.length || 0, description: data.description || ''
            })));
          }
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = models.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Search className="h-4 w-4 text-[#800000]" /> Odoo Models ({models.length})</CardTitle>
          <div className="relative"><Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..." className="pl-7 h-7 w-48 text-xs" /></div>
        </div>
      </CardHeader>
      <CardContent className="p-0 max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Model Name</TableHead><TableHead className="text-right">Fields</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.slice(0, 50).map(m => (
              <TableRow key={m.name}><TableCell className="text-sm font-mono">{m.name}</TableCell><TableCell className="text-right text-sm">{m.fields}</TableCell></TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-6 text-gray-400">{models.length === 0 ? 'No models discovered. Run schema discovery first.' : 'No matching models'}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ==================== MAIN PAGE ====================
export default function SyncCenterPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState(null);

  const loadOverview = useCallback(async () => {
    try {
      const res = await targetAPI.getHubOverview();
      setOverview(res.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-3 gap-4"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div></div>;

  // Source detail view
  if (selectedSource) {
    return <SourceDetail overview={overview} onBack={() => setSelectedSource(null)} onRefresh={loadOverview} />;
  }

  // Source list view
  const odooSource = {
    id: 'odoo',
    name: overview?.connection_name || 'Odoo ERP',
    type: 'Odoo v17.0',
    connected: overview?.connected || false,
    total_records: overview?.total_records || 0,
    entities_count: overview?.entities?.length || 0,
    overdue_count: (overview?.entities || []).filter(e => e.is_overdue).length,
  };

  return (
    <div className="space-y-6" data-testid="sync-center-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><RefreshCw className="h-6 w-6 text-[#800000]" /> Sync Center</h1>
        <p className="text-gray-500 text-sm">Manage data synchronization from external systems</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SourceCard source={odooSource} onClick={() => setSelectedSource('odoo')} />
        <AddSourceCard />
      </div>
    </div>
  );
}
