import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  Database,
  ArrowRight,
  Info,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

const TRANSFORMS = [
  { value: 'direct', label: 'Direct Copy', description: 'Copy value as-is' },
  { value: 'extract_name', label: 'Extract Name', description: 'Extract name from [id, name] tuple' },
  { value: 'extract_id', label: 'Extract ID', description: 'Extract ID from [id, name] tuple' },
  { value: 'to_float', label: 'To Float', description: 'Convert to decimal number' },
  { value: 'to_int', label: 'To Integer', description: 'Convert to whole number' },
  { value: 'to_bool', label: 'To Boolean', description: 'Convert to true/false' },
];

export function CustomFieldsPage() {
  const [mappings, setMappings] = useState([]);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [standardFields, setStandardFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newField, setNewField] = useState({
    source_field: '',
    target_field: '',
    transform: 'extract_name'
  });

  // Fetch all mappings
  const fetchMappings = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`${API_BASE_URL}/api/mappings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMappings(res.data || []);
    } catch (error) {
      toast.error('Failed to load mappings');
      console.error('Error fetching mappings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch custom fields for selected mapping
  const fetchCustomFields = async (mappingId) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`${API_BASE_URL}/api/mappings/${mappingId}/custom-fields`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomFields(res.data.custom_fields || []);
      setStandardFields(res.data.standard_fields || []);
    } catch (error) {
      toast.error('Failed to load custom fields');
      console.error('Error fetching custom fields:', error);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  useEffect(() => {
    if (selectedMapping) {
      fetchCustomFields(selectedMapping.id);
    }
  }, [selectedMapping]);

  // Add new custom field
  const handleAddField = async () => {
    if (!newField.source_field || !newField.target_field) {
      toast.error('Please fill in both source and target field names');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({
        source_field: newField.source_field,
        target_field: newField.target_field,
        transform: newField.transform
      });
      
      const res = await axios.post(
        `${API_BASE_URL}/api/mappings/${selectedMapping.id}/add-custom-field?${params}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(res.data.message);
      setAddDialogOpen(false);
      setNewField({ source_field: '', target_field: '', transform: 'extract_name' });
      fetchCustomFields(selectedMapping.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add custom field');
      console.error('Error adding custom field:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="custom-fields-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Custom Field Mappings</h1>
        <p className="text-sm text-gray-500">
          Add Odoo Studio custom fields (x_studio_*) to your ETL mappings
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">How to add custom fields</AlertTitle>
        <AlertDescription className="text-blue-700">
          1. Select a mapping (e.g., crm.lead → opportunity)<br />
          2. Enter the Odoo custom field name (e.g., <code className="bg-blue-100 px-1 rounded">x_studio_opportunity_stages_1</code>)<br />
          3. Choose a target field name and transformation type<br />
          4. Run an ETL sync to populate the data
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mapping Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Select Mapping
            </CardTitle>
            <CardDescription>Choose a mapping to configure custom fields</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mappings.length === 0 ? (
                <p className="text-sm text-gray-500">No mappings found. Create a mapping first.</p>
              ) : (
                mappings.map(mapping => (
                  <div
                    key={mapping.id}
                    onClick={() => setSelectedMapping(mapping)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedMapping?.id === mapping.id 
                        ? 'bg-cyan-50 border-cyan-300' 
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="font-medium">{mapping.name || mapping.source_model}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      {mapping.source_model}
                      <ArrowRight className="h-3 w-3" />
                      {mapping.target_entity}
                    </div>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {mapping.mappings?.length || 0} fields
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Custom Fields List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>
                {selectedMapping 
                  ? `Custom fields for ${selectedMapping.source_model}` 
                  : 'Select a mapping to view custom fields'}
              </CardDescription>
            </div>
            {selectedMapping && (
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Field
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Custom Field Mapping</DialogTitle>
                    <DialogDescription>
                      Map an Odoo custom field to your canonical data model
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="source_field">Odoo Field Name</Label>
                      <Input
                        id="source_field"
                        placeholder="x_studio_opportunity_stages_1"
                        value={newField.source_field}
                        onChange={(e) => setNewField(prev => ({ ...prev, source_field: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500">
                        Enter the exact field name from Odoo (e.g., x_studio_my_field)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target_field">Target Field Name</Label>
                      <Input
                        id="target_field"
                        placeholder="custom_stage"
                        value={newField.target_field}
                        onChange={(e) => setNewField(prev => ({ ...prev, target_field: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500">
                        Name for the field in your canonical data model
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Transformation</Label>
                      <Select 
                        value={newField.transform} 
                        onValueChange={(v) => setNewField(prev => ({ ...prev, transform: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSFORMS.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              <div>
                                <div className="font-medium">{t.label}</div>
                                <div className="text-xs text-gray-500">{t.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        For selection/relation fields, use "Extract Name" to get the display value
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddField}>
                      Add Field
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!selectedMapping ? (
              <div className="text-center py-10 text-gray-500">
                <Database className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Select a mapping from the left panel</p>
              </div>
            ) : customFields.length === 0 && standardFields.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No fields configured for this mapping</p>
                <p className="text-sm">Click "Add Custom Field" to get started</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Custom Fields Section */}
                {customFields.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-700">Custom</Badge>
                      Custom Fields ({customFields.length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Odoo Field</TableHead>
                          <TableHead></TableHead>
                          <TableHead>Target Field</TableHead>
                          <TableHead>Transform</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customFields.map((field, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">
                              {field.source_field}
                            </TableCell>
                            <TableCell>
                              <ArrowRight className="h-4 w-4 text-gray-400" />
                            </TableCell>
                            <TableCell className="font-medium">
                              {field.target_field}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{field.transform}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Standard Fields Section */}
                {standardFields.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Badge className="bg-gray-100 text-gray-700">Standard</Badge>
                      Standard Fields ({standardFields.length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Odoo Field</TableHead>
                          <TableHead></TableHead>
                          <TableHead>Target Field</TableHead>
                          <TableHead>Transform</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {standardFields.map((field, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">
                              {field.source_field}
                            </TableCell>
                            <TableCell>
                              <ArrowRight className="h-4 w-4 text-gray-400" />
                            </TableCell>
                            <TableCell className="font-medium">
                              {field.target_field}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{field.transform}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Next Steps */}
      {selectedMapping && customFields.length > 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Custom fields configured!</AlertTitle>
          <AlertDescription className="text-green-700">
            Run an ETL pipeline sync to populate your custom field data. Go to{' '}
            <a href="/etl/pipelines" className="underline font-medium">Pipelines</a> and trigger a sync.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default CustomFieldsPage;
