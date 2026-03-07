import React, { useState, useEffect } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ShieldCheck, ShieldAlert, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  healthy: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Healthy' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Warning' },
  critical: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Critical' },
  empty: { icon: Database, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', label: 'No Data' },
};

const SEVERITY_COLORS = {
  critical: 'bg-red-500/80 text-white',
  warning: 'bg-amber-500/80 text-white',
  info: 'bg-blue-500/60 text-white',
};

export default function DataHealthMonitor() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

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
      <Card className="border-gray-800 bg-gray-900/60" data-testid="data-health-loading">
        <CardContent className="p-4 flex items-center justify-center h-32">
          <RefreshCw className="h-5 w-5 text-gray-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  const cfg = STATUS_CONFIG[health.status] || STATUS_CONFIG.warning;
  const StatusIcon = cfg.icon;
  const issueCollections = (health.collections || []).filter(c => c.issues?.length > 0);

  return (
    <Card className={`border ${cfg.border} bg-gray-900/60 backdrop-blur`} data-testid="data-health-monitor">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${cfg.bg}`}>
              <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
            </div>
            <CardTitle className="text-sm font-semibold text-white">Data Health</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-black ${cfg.color}`} data-testid="health-score">{health.score}</span>
            <span className="text-xs text-gray-500">/100</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-500 hover:text-white" onClick={fetchHealth} disabled={loading} data-testid="health-refresh-btn">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        {/* Collection status strip */}
        <div className="flex gap-1.5 mb-2">
          {(health.collections || []).map(c => {
            const cc = STATUS_CONFIG[c.status] || STATUS_CONFIG.warning;
            return (
              <div key={c.collection} className={`flex-1 rounded px-2 py-1 ${cc.bg} border ${cc.border}`} data-testid={`health-${c.collection}`}>
                <p className="text-[10px] text-gray-400 capitalize truncate">{c.collection}</p>
                <p className={`text-xs font-bold ${cc.color}`}>{c.total.toLocaleString()}</p>
              </div>
            );
          })}
        </div>

        {/* Issues summary */}
        {health.total_issues > 0 && (
          <button className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 transition-colors py-1"
            onClick={() => setExpanded(!expanded)} data-testid="health-toggle-details">
            <span>{health.total_issues} issue{health.total_issues > 1 ? 's' : ''} detected</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}

        {expanded && issueCollections.length > 0 && (
          <div className="space-y-2 mt-1 max-h-48 overflow-y-auto" data-testid="health-issues-list">
            {issueCollections.map(c => (
              <div key={c.collection} className="space-y-1">
                <p className="text-[11px] font-semibold text-gray-300 capitalize">{c.collection}</p>
                {c.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <Badge className={`text-[9px] px-1 py-0 ${SEVERITY_COLORS[issue.severity]}`}>{issue.severity}</Badge>
                    <span className="text-[11px] text-gray-400 leading-tight">{issue.message}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {health.total_issues === 0 && (
          <p className="text-xs text-emerald-400/80" data-testid="health-all-clear">All collections healthy</p>
        )}
      </CardContent>
    </Card>
  );
}
