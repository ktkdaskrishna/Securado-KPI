import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Bug, 
  RefreshCw, 
  Search,
  Clock,
  Server,
  Database,
  Globe,
  Trash2,
  Download,
  Filter
} from 'lucide-react';
import axios from 'axios';
import DataHealthMonitor from '../crm/DataHealthMonitor';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

export function SystemLogsPage() {
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [systemStatus, setSystemStatus] = useState({
    backend: 'unknown',
    database: 'unknown',
    lastSync: null
  });

  // Fetch system status
  const fetchSystemStatus = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`${API_BASE_URL}/api/health`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      setSystemStatus(prev => ({
        ...prev,
        backend: 'healthy',
        database: res.data.database || 'healthy'
      }));
    } catch (error) {
      setSystemStatus(prev => ({
        ...prev,
        backend: 'error',
        database: 'unknown'
      }));
      // Add to alerts
      addAlert('error', 'Backend Connection', error.message || 'Failed to connect to backend');
    }
  };

  // Add an alert to the list
  const addAlert = (type, source, message) => {
    const newAlert = {
      id: Date.now(),
      type,
      source,
      message,
      timestamp: new Date().toISOString()
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 100)); // Keep last 100 alerts
  };

  // Clear all alerts
  const clearAlerts = () => {
    setAlerts([]);
  };

  // Add a log entry
  const addLog = (level, category, message, details = null) => {
    const newLog = {
      id: Date.now(),
      level,
      category,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev].slice(0, 500)); // Keep last 500 logs
  };

  // Fetch recent API activity
  const fetchRecentActivity = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      
      // Fetch ETL runs for activity log
      const runsRes = await axios.get(`${API_BASE_URL}/api/etl/runs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (runsRes.data && runsRes.data.runs) {
        runsRes.data.runs.forEach(run => {
          addLog(
            run.status === 'completed' ? 'info' : run.status === 'failed' ? 'error' : 'warning',
            'ETL',
            `Pipeline run ${run.status}`,
            { pipeline: run.pipeline_id, records: run.records_processed }
          );
        });
      }
      
      // Update last sync time
      setSystemStatus(prev => ({
        ...prev,
        lastSync: new Date().toISOString()
      }));
      
      addLog('info', 'System', 'Refreshed system logs');
      
    } catch (error) {
      addAlert('error', 'API', error.message || 'Failed to fetch activity');
      addLog('error', 'System', 'Failed to refresh logs', { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSystemStatus();
    addLog('info', 'System', 'System logs page initialized');
    
    // Poll system status every 30 seconds
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter logs based on level and search
  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.level === filter;
    const matchesSearch = searchQuery === '' || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Get badge color based on status/level
  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':
      case 'info':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Error</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/30">Unknown</Badge>;
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'debug':
        return <Bug className="h-4 w-4 text-gray-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (ts) => {
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="space-y-6" data-testid="system-logs-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Logs & Alerts</h1>
        <p className="text-sm text-gray-500">Monitor system health, errors, and activity</p>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-gray-500" />
                <span className="font-medium">Backend</span>
              </div>
              {getStatusBadge(systemStatus.backend)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-gray-500" />
                <span className="font-medium">Database</span>
              </div>
              {getStatusBadge(systemStatus.database)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                <span className="font-medium">Last Sync</span>
              </div>
              <span className="text-sm text-gray-500">
                {systemStatus.lastSync ? formatTimestamp(systemStatus.lastSync) : 'Never'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-gray-500" />
                <span className="font-medium">Active Alerts</span>
              </div>
              <Badge variant={alerts.length > 0 ? 'destructive' : 'secondary'}>
                {alerts.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alerts ({alerts.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Logs ({logs.length})
            </TabsTrigger>
            <TabsTrigger value="data-health" className="flex items-center gap-2" data-testid="data-health-tab">
              <Database className="h-4 w-4" />
              Data Health
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchRecentActivity}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>System Alerts</CardTitle>
                <CardDescription>Active warnings and errors that need attention</CardDescription>
              </div>
              {alerts.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearAlerts}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                    <AlertCircle className="h-10 w-10 mb-2 opacity-50" />
                    <p>No active alerts</p>
                    <p className="text-sm">System is running normally</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map(alert => (
                      <div 
                        key={alert.id}
                        className={`p-4 rounded-lg border ${
                          alert.type === 'error' ? 'bg-red-50 border-red-200' :
                          alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                          'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {getLevelIcon(alert.type)}
                            <div>
                              <p className="font-medium">{alert.source}</p>
                              <p className="text-sm text-gray-600">{alert.message}</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(alert.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activity Logs</CardTitle>
                  <CardDescription>System activity and event history</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-32">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="error">Errors</SelectItem>
                      <SelectItem value="warning">Warnings</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                    <Info className="h-10 w-10 mb-2 opacity-50" />
                    <p>No logs to display</p>
                    <p className="text-sm">Click refresh to load recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLogs.map(log => (
                      <div 
                        key={log.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 border-b"
                      >
                        {getLevelIcon(log.level)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {log.category}
                            </Badge>
                            <span className="text-sm font-medium">{log.message}</span>
                          </div>
                          {log.details && (
                            <pre className="mt-1 text-xs text-gray-500 overflow-hidden text-ellipsis">
                              {JSON.stringify(log.details)}
                            </pre>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Health Tab */}
        <TabsContent value="data-health">
          <DataHealthMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SystemLogsPage;
