import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { useGlobalFilters } from '../../lib/GlobalFilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Plus, CheckSquare, Phone, Mail, Calendar, FileText, CheckCircle, Clock, AlertCircle, Filter } from 'lucide-react';
import { toast } from 'sonner';

const typeIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: FileText,
};

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
};

export function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    type: 'task',
    description: '',
    due_date: '',
  });
  
  // Global filters
  const { filters, hasActiveFilters } = useGlobalFilters();

  // Load data when filters change
  useEffect(() => {
    loadData();
  }, [filters.year, filters.quarter, filters.salesRep, filters.team]);

  const loadData = async () => {
    try {
      // Build filter params from global filters
      const params = {};
      if (filters.year) params.year = filters.year;
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.salesRep) params.sales_rep = filters.salesRep;
      
      const [activitiesRes, statsRes] = await Promise.all([
        crmAPI.listActivities(params),
        crmAPI.getActivityStats(),
      ]);
      setActivities(activitiesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await crmAPI.createActivity(formData);
      toast.success('Activity created');
      setDialogOpen(false);
      setFormData({ subject: '', type: 'task', description: '', due_date: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to create activity');
    }
  };

  const handleComplete = async (id) => {
    try {
      await crmAPI.completeActivity(id);
      toast.success('Activity completed');
      loadData();
    } catch (error) {
      toast.error('Failed to complete activity');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
          <p className="text-gray-500">Track tasks, calls, emails, and meetings</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="activity-quickadd-button">
              <Plus className="h-4 w-4 mr-2" />
              New Activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Activity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Follow up call"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} data-testid="activity-save-button">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Calls', value: stats?.by_type?.calls || 0, icon: Phone, color: 'blue' },
          { label: 'Emails', value: stats?.by_type?.emails || 0, icon: Mail, color: 'cyan' },
          { label: 'Meetings', value: stats?.by_type?.meetings || 0, icon: Calendar, color: 'emerald' },
          { label: 'Tasks', value: stats?.by_type?.tasks || 0, icon: FileText, color: 'amber' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{item.label}</p>
                  <p className="text-2xl font-bold">{item.value}</p>
                </div>
                <item.icon className={`h-8 w-8 text-${item.color}-500`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activities List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No activities yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => {
                const Icon = typeIcons[activity.type] || FileText;
                return (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-400" />
                        <span className="capitalize">{activity.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{activity.subject}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[activity.status] || statusColors.pending}>
                        {activity.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{activity.owner_name || '-'}</TableCell>
                    <TableCell>{activity.due_date || '-'}</TableCell>
                    <TableCell className="text-right">
                      {activity.status !== 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleComplete(activity.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
