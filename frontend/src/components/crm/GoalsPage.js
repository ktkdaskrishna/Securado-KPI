import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Plus, Target, Trash2, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  in_progress: 'bg-blue-100 text-blue-700',
  on_track: 'bg-emerald-100 text-emerald-700',
  at_risk: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-700',
};

export function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_value: 100000,
    current_value: 0,
    target_date: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [goalsRes, statsRes] = await Promise.all([
        crmAPI.listGoals(),
        crmAPI.getGoalsStats(),
      ]);
      setGoals(goalsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await crmAPI.createGoal(formData);
      toast.success('Goal created');
      setDialogOpen(false);
      setFormData({ name: '', description: '', target_value: 100000, current_value: 0, target_date: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to create goal');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await crmAPI.deleteGoal(id);
      toast.success('Goal deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete goal');
    }
  };

  const handleUpdateProgress = async (id, newValue) => {
    try {
      await crmAPI.updateGoalProgress(id, parseFloat(newValue));
      toast.success('Progress updated');
      loadData();
    } catch (error) {
      toast.error('Failed to update progress');
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
          <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
          <p className="text-gray-500">Track and manage your goals</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Q1 Revenue Target"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Achieve $100k in new revenue"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Value</Label>
                  <Input
                    type="number"
                    value={formData.target_value}
                    onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Value</Label>
                  <Input
                    type="number"
                    value={formData.current_value}
                    onChange={(e) => setFormData({ ...formData, current_value: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Goals</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <Target className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold">{stats?.completed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">On Track</p>
                <p className="text-2xl font-bold">{stats?.on_track || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">At Risk</p>
                <p className="text-2xl font-bold">{stats?.at_risk || 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.length === 0 ? (
          <Card className="col-span-full p-8 text-center">
            <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium mb-2">No goals yet</h3>
            <p className="text-gray-500 mb-4">Create a goal to start tracking progress</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Goal
            </Button>
          </Card>
        ) : (
          goals.map((goal) => {
            const progress = goal.target_value > 0 
              ? Math.min(100, (goal.current_value / goal.target_value) * 100)
              : 0;
            return (
              <Card key={goal.id} data-testid={`goal-row-${goal.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{goal.name}</CardTitle>
                    <Badge className={statusColors[goal.status] || statusColors.in_progress}>
                      {goal.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">{goal.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium">{progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" data-testid={`goal-progress-bar-${goal.id}`} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Current</span>
                      <span className="font-mono">${goal.current_value?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Target</span>
                      <span className="font-mono">${goal.target_value?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                      <Input
                        type="number"
                        placeholder="Update progress"
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateProgress(goal.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(goal.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
