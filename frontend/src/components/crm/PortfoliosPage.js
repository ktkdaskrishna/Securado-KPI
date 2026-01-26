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
import { Plus, Briefcase, Trash2, TrendingUp, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';

export function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    try {
      const res = await crmAPI.listPortfolios();
      setPortfolios(res.data);
    } catch (error) {
      toast.error('Failed to load portfolios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await crmAPI.createPortfolio(formData);
      toast.success('Portfolio created');
      setDialogOpen(false);
      setFormData({ name: '', description: '' });
      loadPortfolios();
    } catch (error) {
      toast.error('Failed to create portfolio');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this portfolio?')) return;
    try {
      await crmAPI.deletePortfolio(id);
      toast.success('Portfolio deleted');
      loadPortfolios();
    } catch (error) {
      toast.error('Failed to delete portfolio');
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
          <h1 className="text-2xl font-bold text-gray-900">Portfolios</h1>
          <p className="text-gray-500">Manage account portfolios</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Portfolio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Portfolio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enterprise Accounts"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Top enterprise accounts"
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
        {portfolios.length === 0 ? (
          <Card className="col-span-full p-8 text-center">
            <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium mb-2">No portfolios yet</h3>
            <p className="text-gray-500 mb-4">Create a portfolio to organize accounts</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Portfolio
            </Button>
          </Card>
        ) : (
          portfolios.map((portfolio) => (
            <Card key={portfolio.id} data-testid={`portfolio-card-${portfolio.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-cyan-500" />
                    <CardTitle className="text-lg">{portfolio.name}</CardTitle>
                  </div>
                  <Badge variant="outline">{portfolio.status}</Badge>
                </div>
                <p className="text-sm text-gray-500">{portfolio.description || 'No description'}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500">Total Value</p>
                      <p className="text-lg font-bold">${(portfolio.total_value || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500">Accounts</p>
                      <p className="text-lg font-bold">{portfolio.accounts_count || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Owner: {portfolio.owner_name || 'Unassigned'}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(portfolio.id)}
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
