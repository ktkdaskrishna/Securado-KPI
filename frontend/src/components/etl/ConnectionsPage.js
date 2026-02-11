import React, { useState, useEffect } from 'react';
import { etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Plus, Link, RefreshCw, CheckCircle, XCircle, AlertCircle, Trash2, TestTube, Database, Cloud, Target, TrendingUp, FileText, FlaskConical, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  active: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
};

const healthIcons = {
  healthy: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  unhealthy: <XCircle className="h-4 w-4 text-red-500" />,
  unknown: <AlertCircle className="h-4 w-4 text-gray-400" />,
};

const templateIcons = {
  database: Database,
  cloud: Cloud,
  target: Target,
  'trending-up': TrendingUp,
  'file-text': FileText,
  flask: FlaskConical,
};

export function ConnectionsPage() {
  const [connections, setConnections] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [createMode, setCreateMode] = useState('template'); // 'template' or 'manual'
  const [formData, setFormData] = useState({
    name: '',
    type: 'odoo',
    url: '',
    database: '',
    username: '',
    api_key: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [connectionsRes, templatesRes] = await Promise.all([
        etlAPI.listConnections(),
        etlAPI.listTemplates(),
      ]);
      setConnections(connectionsRes.data);
      setTemplates(templatesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setFormData({
      ...formData,
      name: `My ${template.name} Connection`,
      type: template.type,
      description: `Created from ${template.name} template`,
    });
  };

  const handleCreate = async () => {
    try {
      if (editingId) {
        await etlAPI.updateConnection(editingId, formData);
        toast.success('Connection updated');
      } else if (selectedTemplate) {
        await etlAPI.createConnectionFromTemplate(selectedTemplate.id, formData);
        toast.success('Connection created');
      } else {
        await etlAPI.createConnection(formData);
        toast.success('Connection created');
      }
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save connection');
    }
  };

  const handleEdit = (conn) => {
    setEditingId(conn.id);
    setFormData({
      name: conn.name || '',
      type: conn.type || 'odoo',
      url: conn.url || '',
      database: conn.database || '',
      username: conn.username || '',
      api_key: conn.api_key || '',
      description: conn.description || '',
    });
    setCreateMode('manual');
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', type: 'odoo', url: '', database: '', username: '', api_key: '', description: '' });
    setSelectedTemplate(null);
    setCreateMode('template');
    setEditingId(null);
  };

  const handleTest = async (id) => {
    setTestingId(id);
    try {
      const res = await etlAPI.testConnection(id);
      if (res.data.status === 'success') {
        toast.success('Connection test successful');
      } else {
        toast.error(`Connection test failed: ${res.data.message}`);
      }
      loadData();
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) return;
    try {
      await etlAPI.deleteConnection(id);
      toast.success('Connection deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete connection');
    }
  };

  const handleDiscover = async (id) => {
    try {
      toast.info('Discovering schema...');
      await etlAPI.discoverSchema(id);
      toast.success('Schema discovered successfully');
    } catch (error) {
      toast.error('Failed to discover schema');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    const category = template.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
          <p className="text-gray-500">Manage data source connections</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="connections-new-button">
              <Plus className="h-4 w-4 mr-2" />
              New Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Connection</DialogTitle>
              <DialogDescription>
                Choose a template or configure a custom connection
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={createMode} onValueChange={setCreateMode}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="template" data-testid="conn-tab-template">From Template</TabsTrigger>
                <TabsTrigger value="manual" data-testid="conn-tab-manual">Custom</TabsTrigger>
              </TabsList>
              
              <TabsContent value="template" className="space-y-4">
                {/* Template Selection */}
                <div className="space-y-4">
                  <Label>Select Integration Template</Label>
                  {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">{category}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {categoryTemplates.map((template) => {
                          const IconComponent = templateIcons[template.icon] || Database;
                          return (
                            <Card 
                              key={template.id}
                              className={`cursor-pointer transition-all hover:border-cyan-400 ${selectedTemplate?.id === template.id ? 'border-cyan-500 bg-cyan-50' : ''}`}
                              onClick={() => handleSelectTemplate(template)}
                              data-testid={`template-card-${template.id}`}
                            >
                              <CardContent className="p-3 flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${selectedTemplate?.id === template.id ? 'bg-cyan-100' : 'bg-gray-100'}`}>
                                  <IconComponent className="h-5 w-5 text-cyan-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{template.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{template.type}</p>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedTemplate && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="p-3 bg-cyan-50 rounded-lg">
                      <p className="text-sm text-cyan-800">{selectedTemplate.description}</p>
                      {selectedTemplate.models?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {selectedTemplate.models.map((m, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{m.label}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Connection Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="url">URL / Host</Label>
                        <Input
                          id="url"
                          value={formData.url}
                          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                          placeholder={selectedTemplate.type === 'odoo' ? 'https://your-odoo.com' : 'https://api.example.com'}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="database">Database</Label>
                        <Input
                          id="database"
                          value={formData.database}
                          onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_key">API Key / Password</Label>
                      <Input
                        id="api_key"
                        type="password"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Connection"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="odoo">Odoo</SelectItem>
                      <SelectItem value="postgres">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                      <SelectItem value="mongodb">MongoDB</SelectItem>
                      <SelectItem value="api">REST API</SelectItem>
                      <SelectItem value="mock">Mock (Demo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://your-server.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database">Database</Label>
                  <Input
                    id="database"
                    value={formData.database}
                    onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_key">API Key / Password</Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button 
                onClick={handleCreate}
                disabled={createMode === 'template' && !selectedTemplate}
                data-testid="conn-create-button"
              >
                Create Connection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card data-testid="connections-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Last Tested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No connections yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              connections.map((conn) => (
                <TableRow key={conn.id} data-testid={`connection-row-${conn.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-gray-400" />
                      <div>
                        <span>{conn.name}</span>
                        {conn.template_id && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {conn.template_id}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{conn.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                    {conn.url}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[conn.status] || statusColors.pending}>
                      {conn.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {healthIcons[conn.health] || healthIcons.unknown}
                      <span className="text-sm">{conn.health}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {conn.last_test ? new Date(conn.last_test).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(conn)}
                        title="Edit Connection"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTest(conn.id)}
                        disabled={testingId === conn.id}
                        data-testid={`connection-test-button-${conn.id}`}
                        title="Test Connection"
                      >
                        {testingId === conn.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDiscover(conn.id)}
                        title="Discover Schema"
                      >
                        <Database className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(conn.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
