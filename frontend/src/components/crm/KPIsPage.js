import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, BarChart2, Trash2, Edit, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';

export function KPIsPage() {
  const [kpis, setKPIs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_value: 100,
    current_value: 0,
    unit: 'number',
  });

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      const res = await crmAPI.listKPIs();
      setKPIs(res.data);
    } catch (error) {
      toast.error('Failed to load KPIs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (editingKPI) {
        await crmAPI.updateKPI(editingKPI.id, formData);
        toast.success('KPI updated');
      } else {
        await crmAPI.createKPI(formData);
        toast.success('KPI created');
      }
      setDialogOpen(false);
      resetForm();
      loadKPIs();
    } catch (error) {
      toast.error('Failed to save KPI');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this KPI?')) return;
    try {
      await crmAPI.deleteKPI(id);
      toast.success('KPI deleted');
      loadKPIs();
    } catch (error) {
      toast.error('Failed to delete KPI');
    }
  };

  const handleEdit = (kpi) => {
    setEditingKPI(kpi);
    setFormData({
      name: kpi.name,
      description: kpi.description || '',
      target_value: kpi.target_value,
      current_value: kpi.current_value,
      unit: kpi.unit || 'number',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingKPI(null);
    setFormData({ name: '', description: '', target_value: 100, current_value: 0, unit: 'number' });
  };

  const formatValue = (value, unit) => {
    switch (unit) {
      case 'currency': return `$${value.toLocaleString()}`;
      case 'percent': return `${value}%`;
      case 'days': return `${value} days`;
      default: return value.toLocaleString();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const chartData = kpis.map(kpi => ({
    name: kpi.name,
    current: kpi.current_value,
    target: kpi.target_value,
    progress: kpi.target_value > 0 ? Math.min(100, (kpi.current_value / kpi.target_value) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPIs</h1>
          <p className="text-gray-500">Track key performance indicators</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New KPI
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingKPI ? 'Edit KPI' : 'Create KPI'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Win Rate"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Percentage of won deals"
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
                <Label>Unit</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="currency">Currency</SelectItem>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleCreate}>{editingKPI ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Chart */}
      <Card data-testid="kpi-chart">
        <CardHeader>
          <CardTitle>KPIs vs Targets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" />
                <Tooltip />
                <Bar dataKey="progress" fill="hsl(190, 90%, 40%)" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.progress >= 100 ? 'hsl(158, 64%, 40%)' : 'hsl(190, 90%, 40%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Table */}
      <Card data-testid="kpi-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kpis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No KPIs yet. Create one to track performance.
                </TableCell>
              </TableRow>
            ) : (
              kpis.map((kpi) => {
                const progress = kpi.target_value > 0 
                  ? Math.min(100, (kpi.current_value / kpi.target_value) * 100)
                  : 0;
                return (
                  <TableRow key={kpi.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-cyan-500" />
                        <div>
                          <p className="font-medium">{kpi.name}</p>
                          <p className="text-xs text-gray-500">{kpi.description}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatValue(kpi.current_value, kpi.unit)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatValue(kpi.target_value, kpi.unit)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="w-20 h-2" />
                        <span className="text-sm">{progress.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {kpi.change !== undefined && (
                        <div className={`flex items-center gap-1 ${kpi.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {kpi.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          <span className="text-sm">{kpi.change >= 0 ? '+' : ''}{kpi.change}%</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(kpi)}
                          data-testid="kpi-edit-target-button"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(kpi.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
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
