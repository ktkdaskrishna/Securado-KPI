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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Rocket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  active: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  on_hold: 'bg-gray-100 text-gray-700',
};

export function InitiativesPage() {
  const [initiatives, setInitiatives] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    portfolio_id: '',
    status: 'active',
    target_date: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [initRes, portRes] = await Promise.all([
        crmAPI.listInitiatives(),
        crmAPI.listPortfolios(),
      ]);
      setInitiatives(initRes.data);
      setPortfolios(portRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await crmAPI.createInitiative(formData);
      toast.success('Initiative created');
      setDialogOpen(false);
      setFormData({ name: '', description: '', portfolio_id: '', status: 'active', target_date: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to create initiative');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this initiative?')) return;
    try {
      await crmAPI.deleteInitiative(id);
      toast.success('Initiative deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete initiative');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await crmAPI.updateInitiativeStatus(id, { status });
      toast.success('Status updated');
      loadData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Initiatives</h1>
          <p className="text-gray-500">Track strategic initiatives</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Initiative
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Initiative</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Customer Success Program"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Improve customer retention"
                />
              </div>
              <div className="space-y-2">
                <Label>Portfolio</Label>
                <Select value={formData.portfolio_id || 'none'} onValueChange={(v) => setFormData({ ...formData, portfolio_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select portfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {initiatives.length === 0 ? (
          <Card className="col-span-full p-8 text-center">
            <Rocket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium mb-2">No initiatives yet</h3>
            <p className="text-gray-500 mb-4">Create an initiative to track progress</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Initiative
            </Button>
          </Card>
        ) : (
          initiatives.map((initiative) => (
            <Card key={initiative.id} data-testid={`initiative-card-${initiative.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-cyan-500" />
                    <CardTitle className="text-lg">{initiative.name}</CardTitle>
                  </div>
                  <Select value={initiative.status} onValueChange={(v) => handleStatusChange(initiative.id, v)}>
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-gray-500">{initiative.description || 'No description'}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium">{initiative.progress || 0}%</span>
                    </div>
                    <Progress value={initiative.progress || 0} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Target: {initiative.target_date || 'Not set'}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(initiative.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
