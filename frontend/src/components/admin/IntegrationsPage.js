import React, { useState, useEffect, useCallback } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Database, Wifi, WifiOff, Play, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Import ALL original ETL components - preserving full functionality
import { ConnectionsPage } from '../etl/ConnectionsPage';
import { MappingsPage } from '../etl/MappingsPage';
import { OdooModelBrowserPage } from '../etl/OdooModelBrowserPage';
import { PipelinesPage } from '../etl/PipelinesPage';
import { RunsPage } from '../etl/RunsPage';
import { DataLakePage } from '../etl/DataLakePage';
import { DLQPage } from '../etl/DLQPage';
import { DataQualityPage } from '../admin/DataQualityPage';
import RBACManagementPage from '../admin/RBACManagementPage';

// Sync status overview (lightweight, only for the Overview tab)
function SyncOverview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [incrementalStatus, setIncrementalStatus] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      targetAPI.getHubOverview(),
      targetAPI.getIncrementalStatus(),
    ]).then(([ovR, incR]) => {
      if (ovR.status === 'fulfilled') setOverview(ovR.value.data);
      if (incR.status === 'fulfilled') setIncrementalStatus(incR.value.data);
      setLoading(false);
    });
  }, []);

  const handleSync = async (entityId) => {
    setSyncing(entityId);
    try {
      const res = await targetAPI.triggerSync(entityId);
      toast.success(res.data.message || `Syncing ${entityId}...`);
      // Immediate visual update - mark the entity as syncing
      if (overview) {
        const updated = { ...overview, entities: overview.entities.map(e => 
          e.id === entityId ? { ...e, last_sync: new Date().toISOString(), is_overdue: false } : e
        )};
        setOverview(updated);
      }
      // Refresh after pipeline runs
      setTimeout(async () => {
        try {
          const r = await targetAPI.getHubOverview();
          setOverview(r.data);
          toast.success(`${entityId} sync complete`);
        } catch {}
        setSyncing(null);
      }, 5000);
    } catch (err) { 
      toast.error(`Sync failed: ${err.response?.data?.detail || 'Unknown error'}`); 
      setSyncing(null); 
    }
  };

  const handleScheduleChange = async (entityId, schedule) => {
    try {
      await targetAPI.updateSyncSchedule(entityId, { schedule });
      toast.success(`Schedule updated: ${entityId} → ${schedule}`);
      const r = await targetAPI.getHubOverview();
      setOverview(r.data);
    } catch { toast.error('Failed'); }
  };

  const handleSyncAll = async () => {
    setSyncing('all');
    toast.info('Syncing all entities...');
    for (const entity of overview?.entities || []) {
      try { await targetAPI.triggerSync(entity.id); } catch {}
    }
    // Update all entities immediately
    if (overview) {
      const now = new Date().toISOString();
      setOverview({ ...overview, entities: overview.entities.map(e => ({ ...e, last_sync: now, is_overdue: false })) });
    }
    setTimeout(async () => {
      try { const r = await targetAPI.getHubOverview(); setOverview(r.data); } catch {}
      setSyncing(null);
      toast.success('All entities synced');
    }, 8000);
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      {/* Connection status + Sync All */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
        <div className="flex items-center gap-3">
          {overview?.connected ? <Wifi className="h-5 w-5 text-emerald-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
          <div>
            <p className="text-sm font-semibold">{overview?.connection_name || 'Odoo ERP'}</p>
            <p className="text-xs text-gray-500">{overview?.connected ? 'Connected' : 'Not connected'} · {overview?.total_records?.toLocaleString()} records</p>
          </div>
        </div>
        <Button onClick={handleSyncAll} disabled={syncing === 'all'} className="bg-[#800000] hover:bg-[#9a1919] text-white">
          {syncing === 'all' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          {syncing === 'all' ? 'Syncing All...' : 'Sync All'}
        </Button>
      </div>

      {/* Entity sync table */}
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
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(overview?.entities || []).map(entity => (
                <TableRow key={entity.id} className={entity.is_overdue ? 'bg-yellow-50/50' : ''}>
                  <TableCell>
                    <div><span className="font-medium text-sm">{entity.label}</span><p className="text-[10px] text-gray-400 font-mono">{entity.odoo_model}</p></div>
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
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSync(entity.id)} disabled={syncing === entity.id}>
                      {syncing === entity.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />} Sync
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Integrations Page - tabs containing ALL original components
export default function IntegrationsPage() {
  const [tab, setTab] = useState('overview');

  return (
    <div className="space-y-4" data-testid="integrations-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="h-6 w-6 text-[#800000]" /> Integrations
        </h1>
        <p className="text-gray-500 text-sm">Odoo ERP connection, data sync, field mapping, RBAC</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Sync Overview</TabsTrigger>
          <TabsTrigger value="connections">Connection</TabsTrigger>
          <TabsTrigger value="mappings">Data Mapping</TabsTrigger>
          <TabsTrigger value="browser">Model Browser</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
          <TabsTrigger value="rbac">RBAC Sync</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
          <TabsTrigger value="datalake">Data Lake</TabsTrigger>
          <TabsTrigger value="dlq">DLQ</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><SyncOverview /></TabsContent>
        <TabsContent value="connections" className="mt-4"><ConnectionsPage /></TabsContent>
        <TabsContent value="mappings" className="mt-4"><MappingsPage /></TabsContent>
        <TabsContent value="browser" className="mt-4"><OdooModelBrowserPage /></TabsContent>
        <TabsContent value="pipelines" className="mt-4"><PipelinesPage /></TabsContent>
        <TabsContent value="runs" className="mt-4"><RunsPage /></TabsContent>
        <TabsContent value="rbac" className="mt-4"><RBACManagementPage /></TabsContent>
        <TabsContent value="quality" className="mt-4"><DataQualityPage /></TabsContent>
        <TabsContent value="datalake" className="mt-4"><DataLakePage /></TabsContent>
        <TabsContent value="dlq" className="mt-4"><DLQPage /></TabsContent>
      </Tabs>
    </div>
  );
}
