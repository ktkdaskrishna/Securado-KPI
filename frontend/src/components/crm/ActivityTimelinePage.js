import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Activity, Phone, Mail, Calendar, Users, FileText, Target,
  Clock, CheckCircle, AlertCircle, Filter, Search, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getActivityIcon = (type) => {
  const icons = {
    call: Phone,
    email: Mail,
    meeting: Users,
    task: FileText,
    note: FileText,
    deal: Target,
    default: Activity
  };
  return icons[type?.toLowerCase()] || icons.default;
};

const getActivityColor = (type) => {
  const colors = {
    call: 'bg-blue-100 text-blue-700 border-blue-200',
    email: 'bg-purple-100 text-purple-700 border-purple-200',
    meeting: 'bg-amber-100 text-amber-700 border-amber-200',
    task: 'bg-slate-100 text-slate-700 border-slate-200',
    note: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    deal: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    default: 'bg-gray-100 text-gray-700 border-gray-200'
  };
  return colors[type?.toLowerCase()] || colors.default;
};

export function ActivityTimelinePage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadActivities();
    loadStats();
  }, []);

  const loadActivities = async () => {
    try {
      const res = await crmAPI.listActivities();
      setActivities(res.data || []);
    } catch (error) {
      toast.error('Failed to load activities');
      // Set mock data for demonstration
      setActivities([
        { id: '1', type: 'call', subject: 'Discovery Call with Acme Corp', status: 'completed', created_at: new Date().toISOString(), owner_name: 'John Doe' },
        { id: '2', type: 'email', subject: 'Follow-up on proposal', status: 'pending', created_at: new Date(Date.now() - 3600000).toISOString(), owner_name: 'Jane Smith' },
        { id: '3', type: 'meeting', subject: 'Product Demo - TechStart', status: 'pending', created_at: new Date(Date.now() - 7200000).toISOString(), owner_name: 'John Doe' },
        { id: '4', type: 'task', subject: 'Send contract to Global Services', status: 'overdue', created_at: new Date(Date.now() - 86400000).toISOString(), owner_name: 'Jane Smith' },
        { id: '5', type: 'deal', subject: 'Opportunity stage updated to Negotiation', status: 'completed', created_at: new Date(Date.now() - 172800000).toISOString(), owner_name: 'System' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await crmAPI.getActivityStats();
      setStats(res.data);
    } catch (error) {
      // Use default stats
      setStats({ total: 5, completed: 2, pending: 2, overdue: 1 });
    }
  };

  const filteredActivities = activities.filter(act => {
    const matchesSearch = !searchQuery ||
      act.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.owner_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || act.type === filterType;
    const matchesStatus = filterStatus === 'all' || act.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Group activities by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = formatDate(activity.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {});

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'overdue': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="activity-timeline-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity Timeline</h1>
          <p className="text-muted-foreground">Track all activities across your organization</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" data-testid="log-activity-btn">
          <Activity className="h-4 w-4 mr-2" />
          Log Activity
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Activities</p>
                <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-emerald-600">{stats?.completed || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{stats?.pending || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats?.overdue || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="activity-search"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]" data-testid="filter-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="call">Calls</SelectItem>
                  <SelectItem value="email">Emails</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]" data-testid="filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {Object.keys(groupedActivities).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No activities found
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedActivities).map(([date, dateActivities]) => (
                  <div key={date}>
                    <div className="sticky top-0 bg-background z-10 py-2">
                      <Badge variant="outline" className="font-medium">{date}</Badge>
                    </div>
                    <div className="relative ml-4 border-l-2 border-muted pl-6 space-y-4">
                      {dateActivities.map((activity) => {
                        const Icon = getActivityIcon(activity.type);
                        const colorClass = getActivityColor(activity.type);
                        return (
                          <div 
                            key={activity.id} 
                            className="relative group"
                            data-testid={`activity-item-${activity.id}`}
                          >
                            {/* Timeline dot */}
                            <div className={`absolute -left-[30px] w-4 h-4 rounded-full border-2 ${colorClass}`} />
                            
                            {/* Activity Card */}
                            <div className="bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg ${colorClass}`}>
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">{activity.subject}</p>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                      <span>{formatTime(activity.created_at)}</span>
                                      <span>•</span>
                                      <span>{activity.owner_name}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(activity.status)}
                                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {activity.notes && (
                                <p className="mt-2 text-sm text-muted-foreground pl-11">{activity.notes}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
