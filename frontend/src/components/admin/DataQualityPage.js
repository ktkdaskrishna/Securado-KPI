import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { 
  Database, AlertTriangle, CheckCircle, RefreshCw, Trash2, 
  Shield, Activity, AlertCircle, FileCheck, Layers,
  Play, Pause, Clock, Zap, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

const healthColors = {
  healthy: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const healthIcons = {
  healthy: <CheckCircle className="h-5 w-5 text-emerald-600" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  critical: <AlertCircle className="h-5 w-5 text-red-600" />,
};

export function DataQualityPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [duplicates, setDuplicates] = useState({});
  const [selectedCollection, setSelectedCollection] = useState('opportunities');
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [queueStats, setQueueStats] = useState(null);
  const [failedEvents, setFailedEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('duplicates');

  useEffect(() => {
    loadData();
    // Poll queue stats every 10 seconds
    const interval = setInterval(loadQueueStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      
      // Load summary
      const summaryRes = await axios.get(`${API_BASE_URL}/api/admin/data-quality/reconciliation/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(summaryRes.data);
      
      // Load duplicates for selected collection
      await loadDuplicates(selectedCollection);
      
      // Load queue stats
      await loadQueueStats();
    } catch (error) {
      console.error('Failed to load data quality info:', error);
      toast.error('Failed to load data quality information');
    } finally {
      setLoading(false);
    }
  };

  const loadQueueStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/data-quality/queue/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQueueStats(res.data);
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    }
  };

  const loadFailedEvents = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/data-quality/queue/failed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFailedEvents(res.data.events || []);
    } catch (error) {
      console.error('Failed to load failed events:', error);
    }
  };

  const retryEvent = async (eventId) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_BASE_URL}/api/admin/data-quality/queue/retry/${eventId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Event queued for retry');
      loadFailedEvents();
      loadQueueStats();
    } catch (error) {
      console.error('Failed to retry event:', error);
      toast.error('Failed to retry event');
    }
  };

  const loadDuplicates = async (collection) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/data-quality/duplicates/${collection}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDuplicates(prev => ({ ...prev, [collection]: res.data }));
    } catch (error) {
      console.error('Failed to load duplicates:', error);
    }
  };

  const handleCleanup = async (dryRun = true) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/data-quality/cleanup/full?dry_run=${dryRun}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCleanupResult(res.data);
      
      if (!dryRun) {
        toast.success(`Cleanup complete! Removed ${res.data.summary.total_records_deleted} duplicates`);
        loadData(); // Refresh data
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      toast.error('Cleanup operation failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleCollectionChange = (collection) => {
    setSelectedCollection(collection);
    if (!duplicates[collection]) {
      loadDuplicates(collection);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Data Quality
          </h1>
          <p className="text-gray-500">Monitor data integrity and manage duplicates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData} disabled={processing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setCleanupDialogOpen(true)}
            disabled={summary?.total_duplicates === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clean Duplicates
          </Button>
        </div>
      </div>

      {/* Overall Health Alert */}
      {summary?.overall_health !== 'healthy' && (
        <Alert variant={summary?.overall_health === 'critical' ? 'destructive' : 'warning'}>
          {healthIcons[summary?.overall_health]}
          <AlertTitle>
            {summary?.overall_health === 'critical' ? 'Critical Data Issues Detected' : 'Data Quality Warning'}
          </AlertTitle>
          <AlertDescription>
            Found {summary?.total_duplicates.toLocaleString()} duplicate records across {summary?.total_records.toLocaleString()} total records.
            This may cause inaccurate reports and dashboard metrics.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Records</p>
                <p className="text-2xl font-bold">{summary?.total_records?.toLocaleString() || 0}</p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Duplicates Found</p>
                <p className="text-2xl font-bold text-red-600">{summary?.total_duplicates?.toLocaleString() || 0}</p>
              </div>
              <Layers className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Overall Health</p>
                <Badge className={healthColors[summary?.overall_health || 'healthy']}>
                  {summary?.overall_health?.toUpperCase() || 'HEALTHY'}
                </Badge>
              </div>
              {healthIcons[summary?.overall_health || 'healthy']}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Collections</p>
                <p className="text-2xl font-bold">{summary?.collections?.length || 0}</p>
              </div>
              <FileCheck className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collection Details */}
      <Card>
        <CardHeader>
          <CardTitle>Collection Health</CardTitle>
          <CardDescription>Data quality status by collection</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collection</TableHead>
                <TableHead>Total Records</TableHead>
                <TableHead>Unique Records</TableHead>
                <TableHead>Duplicates</TableHead>
                <TableHead>Duplicate %</TableHead>
                <TableHead>Last Synced</TableHead>
                <TableHead>Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary?.collections?.map((coll) => (
                <TableRow key={coll.collection}>
                  <TableCell className="font-medium">{coll.collection}</TableCell>
                  <TableCell>{coll.total_records.toLocaleString()}</TableCell>
                  <TableCell>{coll.unique_records.toLocaleString()}</TableCell>
                  <TableCell className={coll.duplicate_count > 0 ? 'text-red-600 font-semibold' : ''}>
                    {coll.duplicate_count.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={coll.duplicate_percentage} 
                        className={`w-16 h-2 ${coll.duplicate_percentage > 10 ? '[&>div]:bg-red-500' : coll.duplicate_percentage > 0 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
                      />
                      <span className="text-sm">{coll.duplicate_percentage}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {coll.last_synced ? new Date(coll.last_synced).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Badge className={healthColors[coll.health]}>
                      {coll.health}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Duplicate Details */}
      <Card>
        <CardHeader>
          <CardTitle>Duplicate Records</CardTitle>
          <CardDescription>View and manage duplicate records by collection</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCollection} onValueChange={handleCollectionChange}>
            <TabsList>
              <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
            </TabsList>
            
            <TabsContent value={selectedCollection} className="mt-4">
              {duplicates[selectedCollection] ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Total: {duplicates[selectedCollection].total_records}</span>
                    <span>Unique: {duplicates[selectedCollection].unique_source_ids}</span>
                    <span className="text-red-600 font-medium">
                      Duplicates: {duplicates[selectedCollection].duplicate_count}
                    </span>
                  </div>
                  
                  {duplicates[selectedCollection].duplicates?.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source Record ID</TableHead>
                          <TableHead>Copies</TableHead>
                          <TableHead>Record Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {duplicates[selectedCollection].duplicates.slice(0, 20).map((dup, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{dup._id}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{dup.count} copies</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {dup.records?.slice(0, 3).map((r, i) => (
                                <div key={i} className="truncate max-w-xs">
                                  {r.name || r.canonical_id}
                                </div>
                              ))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-2" />
                      <p>No duplicates found in {selectedCollection}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Cleanup Dialog */}
      <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Data Cleanup
            </DialogTitle>
            <DialogDescription>
              Remove duplicate records from all collections. The most recently updated record will be kept.
            </DialogDescription>
          </DialogHeader>
          
          {!cleanupResult ? (
            <div className="py-6 space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Before You Proceed</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>This will permanently delete duplicate records</li>
                    <li>The most recently updated copy of each record will be kept</li>
                    <li>Unique indexes will be created to prevent future duplicates</li>
                    <li>We recommend running a dry run first to preview changes</li>
                  </ul>
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleCleanup(true)} disabled={processing}>
                  {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Preview Changes (Dry Run)
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(cleanupResult.collections || {}).map(([name, data]) => (
                  <Card key={name}>
                    <CardContent className="pt-4">
                      <p className="font-medium capitalize">{name}</p>
                      <div className="text-sm text-gray-500 mt-2 space-y-1">
                        <p>Duplicates found: <span className="text-red-600 font-medium">{data.duplicates_found}</span></p>
                        <p>Records to delete: {data.records_to_delete}</p>
                        {!cleanupResult.dry_run && (
                          <p>Records deleted: <span className="text-emerald-600 font-medium">{data.records_deleted}</span></p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium">Summary</p>
                <p className="text-sm text-gray-500">
                  Total duplicates: {cleanupResult.summary?.total_duplicates_found || 0}
                </p>
                {cleanupResult.dry_run ? (
                  <p className="text-amber-600 text-sm mt-2">
                    ⚠️ This is a preview. No changes have been made yet.
                  </p>
                ) : (
                  <p className="text-emerald-600 text-sm mt-2">
                    ✅ Cleanup complete! {cleanupResult.summary?.total_records_deleted} records removed.
                  </p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCleanupDialogOpen(false); setCleanupResult(null); }}>
              {cleanupResult && !cleanupResult.dry_run ? 'Done' : 'Cancel'}
            </Button>
            {cleanupResult?.dry_run && (
              <Button 
                variant="destructive" 
                onClick={() => handleCleanup(false)} 
                disabled={processing}
              >
                {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Execute Cleanup
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DataQualityPage;
