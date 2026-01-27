import React, { useState, useEffect, useCallback } from 'react';
import { etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { 
  Zap, CheckCircle, XCircle, Clock, Database, RefreshCw,
  Play, Pause, AlertTriangle, FileText, Loader2, History
} from 'lucide-react';
import { toast } from 'sonner';

export function SyncControls({ connectionId, fieldMappings }) {
  const [syncStatus, setSyncStatus] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadSyncStatus = useCallback(async () => {
    if (!connectionId) {
      setLoading(false);
      return;
    }
    try {
      const res = await etlAPI.getSyncStatus(connectionId);
      setSyncStatus(res.data);
    } catch (error) {
      console.log('No sync status available');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  const loadRecentRuns = useCallback(async () => {
    try {
      const res = await etlAPI.listRuns(10);
      setRecentRuns(res.data || []);
    } catch (error) {
      console.log('No recent runs');
    }
  }, []);

  useEffect(() => {
    loadSyncStatus();
    loadRecentRuns();
  }, [loadSyncStatus, loadRecentRuns]);

  const handleSync = async () => {
    if (!connectionId) {
      toast.error('No connection selected');
      return;
    }
    
    setSyncing(true);
    try {
      const res = await etlAPI.runMappingSync({
        connectionId,
        fieldMappings
      });
      toast.success(`Sync completed: ${res.data?.recordsProcessed || 0} records`);
      loadSyncStatus();
      loadRecentRuns();
    } catch (error) {
      toast.error('Sync failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSyncing(false);
    }
  };

  // Calculate stats from mappings
  const mappingStats = {
    totalMappings: Object.keys(fieldMappings).length,
    totalFields: Object.values(fieldMappings).reduce((sum, arr) => sum + arr.length, 0),
    entities: Object.keys(fieldMappings).map(k => k.split('__')[1]).filter((v, i, a) => a.indexOf(v) === i)
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-full" data-testid="sync-controls">
      {/* Left: Sync Status */}
      <div className="col-span-8 space-y-4">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Sync Status
            </CardTitle>
            <CardDescription>
              Current synchronization status and controls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 text-blue-700">
                  <Database className="h-4 w-4" />
                  <span className="text-sm font-medium">Configured Mappings</span>
                </div>
                <p className="text-2xl font-bold text-blue-900 mt-2">
                  {mappingStats.totalMappings}
                </p>
                <p className="text-xs text-blue-600">
                  {mappingStats.totalFields} field mappings
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Target Entities</span>
                </div>
                <p className="text-2xl font-bold text-green-900 mt-2">
                  {mappingStats.entities.length}
                </p>
                <p className="text-xs text-green-600">
                  {mappingStats.entities.join(', ') || 'None configured'}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center gap-2 text-purple-700">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Last Sync</span>
                </div>
                <p className="text-2xl font-bold text-purple-900 mt-2">
                  {syncStatus?.lastSync 
                    ? new Date(syncStatus.lastSync).toLocaleTimeString()
                    : 'Never'
                  }
                </p>
                <p className="text-xs text-purple-600">
                  {syncStatus?.lastSync 
                    ? new Date(syncStatus.lastSync).toLocaleDateString()
                    : 'No sync performed yet'
                  }
                </p>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Ready to sync</p>
                <p className="text-sm text-muted-foreground">
                  {mappingStats.totalMappings > 0 
                    ? `${mappingStats.totalFields} fields will be synced to ${mappingStats.entities.length} entities`
                    : 'Configure field mappings first'
                  }
                </p>
              </div>
              
              <Button 
                size="lg" 
                onClick={handleSync}
                disabled={syncing || mappingStats.totalMappings === 0}
                className="bg-primary"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {syncing ? 'Syncing...' : 'Run Sync Now'}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Recent Runs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Sync Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRuns.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {recentRuns.map((run, idx) => (
                    <div 
                      key={run.id || idx}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white"
                    >
                      <div className="flex items-center gap-3">
                        {run.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : run.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {run.pipeline_name || 'Manual Sync'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {run.started_at 
                              ? new Date(run.started_at).toLocaleString()
                              : 'Unknown time'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={run.status === 'completed' ? 'default' : 'destructive'}>
                          {run.status}
                        </Badge>
                        {run.records_processed !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {run.records_processed} records
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No sync runs yet</p>
                <p className="text-xs mt-1">Run your first sync to see history</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Right: Quick Actions */}
      <div className="col-span-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={loadSyncStatus}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <FileText className="h-4 w-4 mr-2" />
              View Logs
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <AlertTriangle className="h-4 w-4 mr-2" />
              View Errors
            </Button>
          </CardContent>
        </Card>
        
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Tip:</strong> Configure all field mappings before running sync to ensure complete data transfer.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
