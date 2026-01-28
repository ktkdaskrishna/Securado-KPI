import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { 
  Search, 
  Database,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Box,
  Link2,
  Star,
  Layers,
  FileText,
  Users,
  DollarSign,
  Briefcase,
  Code
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

const CATEGORY_ICONS = {
  crm_sales: <Briefcase className="h-4 w-4" />,
  accounting: <DollarSign className="h-4 w-4" />,
  hr: <Users className="h-4 w-4" />,
  project: <FileText className="h-4 w-4" />,
  custom: <Star className="h-4 w-4" />,
  other: <Layers className="h-4 w-4" />
};

const CATEGORY_LABELS = {
  crm_sales: 'CRM & Sales',
  accounting: 'Accounting',
  hr: 'Human Resources',
  project: 'Project',
  custom: 'Custom Models',
  other: 'Other'
};

export function OdooModelBrowserPage() {
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [models, setModels] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [fields, setFields] = useState(null);
  const [modelSearch, setModelSearch] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(['crm_sales', 'custom']);

  // Fetch Odoo connections
  const fetchConnections = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`${API_BASE_URL}/api/integrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const odooConns = (res.data || []).filter(c => c.type === 'odoo');
      setConnections(odooConns);
      if (odooConns.length > 0 && !selectedConnection) {
        setSelectedConnection(odooConns[0]);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  // Fetch models from Odoo
  const fetchModels = async () => {
    if (!selectedConnection) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(
        `${API_BASE_URL}/api/integrations/connections/${selectedConnection.id}/odoo/models`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { search: modelSearch }
        }
      );
      setModels(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch models');
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch fields for a model
  const fetchFields = async (modelName) => {
    if (!selectedConnection) return;
    
    setLoadingFields(true);
    setSelectedModel(modelName);
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(
        `${API_BASE_URL}/api/integrations/connections/${selectedConnection.id}/odoo/models/${modelName}/fields`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { search: fieldSearch, show_all: false }
        }
      );
      setFields(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch fields');
      console.error('Error fetching fields:', error);
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      fetchModels();
    }
  }, [selectedConnection]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getFieldTypeBadge = (type) => {
    const colors = {
      'char': 'bg-blue-100 text-blue-700',
      'text': 'bg-blue-100 text-blue-700',
      'integer': 'bg-green-100 text-green-700',
      'float': 'bg-green-100 text-green-700',
      'monetary': 'bg-yellow-100 text-yellow-700',
      'boolean': 'bg-purple-100 text-purple-700',
      'date': 'bg-orange-100 text-orange-700',
      'datetime': 'bg-orange-100 text-orange-700',
      'selection': 'bg-pink-100 text-pink-700',
      'many2one': 'bg-cyan-100 text-cyan-700',
      'one2many': 'bg-cyan-100 text-cyan-700',
      'many2many': 'bg-cyan-100 text-cyan-700',
      'binary': 'bg-gray-100 text-gray-700',
      'html': 'bg-indigo-100 text-indigo-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6" data-testid="odoo-model-browser">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Odoo Model Browser</h1>
          <p className="text-sm text-gray-500">
            Browse Odoo models and fields to verify what's available for syncing
          </p>
        </div>
        
        {connections.length > 0 && (
          <Select 
            value={selectedConnection?.id} 
            onValueChange={(id) => setSelectedConnection(connections.find(c => c.id === id))}
          >
            <SelectTrigger className="w-64">
              <Database className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select connection" />
            </SelectTrigger>
            <SelectContent>
              {connections.map(conn => (
                <SelectItem key={conn.id} value={conn.id}>
                  {conn.name} ({conn.url})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No Odoo Connection Found</h3>
            <p className="text-gray-500 mb-4">
              You need to set up an Odoo connection first to browse models.
            </p>
            <Button onClick={() => window.location.href = '/etl/connections'}>
              Go to Connections
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Models Panel */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Box className="h-5 w-5" />
                  Models
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchModels}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search models..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchModels()}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : models ? (
                  <div className="px-4 pb-4">
                    {Object.entries(models.categories || {}).map(([category, categoryModels]) => (
                      categoryModels.length > 0 && (
                        <Collapsible 
                          key={category}
                          open={expandedCategories.includes(category)}
                          onOpenChange={() => toggleCategory(category)}
                        >
                          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-gray-50 rounded px-2">
                            <span className="flex items-center gap-2">
                              {CATEGORY_ICONS[category]}
                              {CATEGORY_LABELS[category]}
                              <Badge variant="secondary" className="ml-1">
                                {categoryModels.length}
                              </Badge>
                            </span>
                            {expandedCategories.includes(category) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="pl-6 space-y-1">
                              {categoryModels.map(model => (
                                <div
                                  key={model.id}
                                  onClick={() => fetchFields(model.model)}
                                  className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                                    selectedModel === model.model
                                      ? 'bg-cyan-50 border-l-2 border-cyan-500'
                                      : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="font-mono text-xs text-gray-600">
                                    {model.model}
                                  </div>
                                  <div className="text-gray-900 truncate">
                                    {model.name}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500">
                    <p>Click refresh to load models</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Fields Panel */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                {selectedModel ? (
                  <span>
                    Fields for <code className="bg-gray-100 px-2 py-1 rounded text-cyan-700">{selectedModel}</code>
                  </span>
                ) : (
                  'Model Fields'
                )}
              </CardTitle>
              {selectedModel && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search fields..."
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchFields(selectedModel)}
                      className="pl-9"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fetchFields(selectedModel)}
                    disabled={loadingFields}
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingFields ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!selectedModel ? (
                <div className="text-center py-20 text-gray-500">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a model to view its fields</p>
                  <p className="text-sm mt-2">
                    Browse the models on the left panel and click to see available fields
                  </p>
                </div>
              ) : loadingFields ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : fields ? (
                <Tabs defaultValue="custom" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="custom" className="flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Custom ({fields.categories?.custom?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="relations" className="flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Relations ({fields.categories?.relations?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="standard" className="flex items-center gap-2">
                      <Box className="h-4 w-4" />
                      Standard ({fields.categories?.standard?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="all">
                      All ({fields.total_fields})
                    </TabsTrigger>
                  </TabsList>

                  {['custom', 'relations', 'standard', 'all'].map(tab => (
                    <TabsContent key={tab} value={tab}>
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[250px]">Field Name</TableHead>
                              <TableHead>Label</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Relation</TableHead>
                              <TableHead className="text-right">Flags</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(tab === 'all' ? fields.all_fields : fields.categories?.[tab] || []).map(field => (
                              <TableRow key={field.name}>
                                <TableCell>
                                  <code className={`text-sm px-1 py-0.5 rounded ${
                                    field.is_studio ? 'bg-purple-100 text-purple-700' :
                                    field.is_custom ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {field.name}
                                  </code>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {field.label}
                                </TableCell>
                                <TableCell>
                                  <Badge className={getFieldTypeBadge(field.type)}>
                                    {field.type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {field.relation && (
                                    <code className="text-xs bg-cyan-50 text-cyan-700 px-1 py-0.5 rounded">
                                      {field.relation}
                                    </code>
                                  )}
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                  {field.required && (
                                    <Badge variant="outline" className="text-xs">Required</Badge>
                                  )}
                                  {field.readonly && (
                                    <Badge variant="outline" className="text-xs text-gray-400">Readonly</Badge>
                                  )}
                                  {field.is_studio && (
                                    <Badge className="bg-purple-100 text-purple-700 text-xs">Studio</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </TabsContent>
                  ))}
                </Tabs>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default OdooModelBrowserPage;
