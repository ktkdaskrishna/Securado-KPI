import React, { useState, useEffect } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { ShieldCheck, ShieldAlert, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  healthy: { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  critical: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700 border-red-200' },
  empty: { icon: Database, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const SEVERITY_BADGE = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function DataHealthMonitor() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await targetAPI.getDataHealth();
      setHealth(res.data);
    } catch (e) {
      toast.error('Failed to load data health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  if (loading && !health) {
    return (
      <Card data-testid="data-health-loading">
        <CardContent className="p-6 flex items-center justify-center h-40">
          <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  const cfg = STATUS_CONFIG[health.status] || STATUS_CONFIG.warning;
  const StatusIcon = cfg.icon;
  const issueCollections = (health.collections || []).filter(c => c.issues?.length > 0);

  return (
    <div className="space-y-4" data-testid="data-health-monitor">
      {/* Score Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <StatusIcon className={`h-5 w-5 ${cfg.color}`} />
              Data Health Score
            </CardTitle>
            <CardDescription>Overall data quality across all synced collections</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className={`text-3xl font-black ${cfg.color}`} data-testid="health-score">{health.score}</span>
              <span className="text-sm text-gray-400 ml-1">/100</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading} data-testid="health-refresh-btn">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Collection status cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(health.collections || []).map(c => {
              const cc = STATUS_CONFIG[c.status] || STATUS_CONFIG.warning;
              return (
                <div key={c.collection} className={`rounded-lg px-3 py-2.5 border ${cc.border} ${cc.bg}`} data-testid={`health-${c.collection}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-600 capitalize">{c.collection}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cc.badge}`}>{c.status}</Badge>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{c.total.toLocaleString()}</p>
                  {c.issues?.length > 0 && <p className="text-[10px] text-gray-500 mt-0.5">{c.issues.length} issue{c.issues.length > 1 ? 's' : ''}</p>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Issues Detail Card */}
      {health.total_issues > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <button className="flex items-center justify-between w-full" onClick={() => setExpanded(!expanded)} data-testid="health-toggle-details">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {health.total_issues} Issue{health.total_issues > 1 ? 's' : ''} Detected
              </CardTitle>
              {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
          </CardHeader>
          {expanded && (
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-4" data-testid="health-issues-list">
                  {issueCollections.map(c => (
                    <div key={c.collection}>
                      <h4 className="text-sm font-semibold text-gray-800 capitalize mb-2">{c.collection}</h4>
                      <div className="space-y-2">
                        {c.issues.map((issue, i) => (
                          <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                            issue.severity === 'critical' ? 'bg-red-50 border-red-200' :
                            issue.severity === 'warning' ? 'bg-amber-50 border-amber-200' :
                            'bg-blue-50 border-blue-200'
                          }`}>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${SEVERITY_BADGE[issue.severity]}`}>
                              {issue.severity}
                            </Badge>
                            <span className="text-sm text-gray-700">{issue.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}

      {health.total_issues === 0 && (
        <Card>
          <CardContent className="py-8 flex flex-col items-center justify-center text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-500 mb-2" />
            <p className="text-sm font-medium text-gray-700" data-testid="health-all-clear">All collections healthy</p>
            <p className="text-xs text-gray-400">No data quality issues detected</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
