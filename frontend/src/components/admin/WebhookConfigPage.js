import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { 
  Webhook, 
  RefreshCw, 
  Trash2, 
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Settings,
  Server,
  Key
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

export function WebhookConfigPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`${API_BASE_URL}/api/webhooks/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(res.data);
    } catch (error) {
      toast.error('Failed to load webhook configuration');
      console.error('Error fetching webhook config:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const toggleWebhooks = async (enabled) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_BASE_URL}/api/webhooks/config?enabled=${enabled}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(prev => ({ ...prev, enabled }));
      toast.success(enabled ? 'Webhooks enabled' : 'Webhooks disabled');
    } catch (error) {
      toast.error('Failed to update webhook settings');
      console.error('Error toggling webhooks:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const setupWebhooks = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const webhookUrl = window.location.origin;
      
      const res = await axios.post(
        `${API_BASE_URL}/api/webhooks/setup-odoo-automations?webhook_base_url=${encodeURIComponent(webhookUrl)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.success) {
        toast.success(`Created ${res.data.created_actions?.length || 0} webhook automations in Odoo`);
        fetchConfig();
      } else {
        toast.error(`Setup completed with errors: ${res.data.errors?.join(', ')}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to setup webhooks');
      console.error('Error setting up webhooks:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteWebhooks = async () => {
    if (!window.confirm('Are you sure you want to delete all Odoo webhook automations? This will stop real-time sync.')) {
      return;
    }
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.delete(`${API_BASE_URL}/api/webhooks/odoo-automations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(res.data.message);
      fetchConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete webhooks');
      console.error('Error deleting webhooks:', error);
    } finally {
      setActionLoading(false);
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
    <div className="space-y-6" data-testid="webhook-config-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Webhook Configuration</h1>
        <p className="text-sm text-gray-500">Configure real-time data sync from Odoo via webhooks</p>
      </div>

      {/* Warning Alert */}
      <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800">Important</AlertTitle>
        <AlertDescription className="text-yellow-700">
          Webhooks enable real-time sync but can cause performance issues if Odoo has high activity. 
          Only enable if your system can handle the load. Disable immediately if you notice slowness.
        </AlertDescription>
      </Alert>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Status
          </CardTitle>
          <CardDescription>Current webhook processing configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {config?.enabled ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 text-gray-400" />
              )}
              <div>
                <Label className="text-base font-medium">Webhook Processing</Label>
                <p className="text-sm text-gray-500">
                  {config?.enabled 
                    ? 'Incoming webhooks are being processed' 
                    : 'Incoming webhooks are being ignored'}
                </p>
              </div>
            </div>
            <Switch 
              checked={config?.enabled || false}
              onCheckedChange={toggleWebhooks}
              disabled={actionLoading}
            />
          </div>

          {/* Odoo Automations Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Server className="h-6 w-6 text-gray-500" />
              <div>
                <Label className="text-base font-medium">Odoo Automations</Label>
                <p className="text-sm text-gray-500">
                  {config?.odoo_automations_created 
                    ? `${config.automation_ids?.length || 0} automations configured in Odoo`
                    : 'No automations configured in Odoo'}
                </p>
              </div>
            </div>
            <Badge variant={config?.odoo_automations_created ? 'default' : 'secondary'}>
              {config?.odoo_automations_created ? 'Active' : 'Not Setup'}
            </Badge>
          </div>

          {/* Models Being Synced */}
          {config?.models && config.models.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <Label className="text-base font-medium mb-2 block">Models Being Synced</Label>
              <div className="flex flex-wrap gap-2">
                {config.models.map(model => (
                  <Badge key={model} variant="outline">{model}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Created At */}
          {config?.created_at && (
            <p className="text-sm text-gray-500">
              Configured on: {new Date(config.created_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Actions
          </CardTitle>
          <CardDescription>Setup or remove Odoo webhook automations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Setup Button */}
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Setup Webhooks</h3>
              <p className="text-sm text-gray-500 mb-4">
                Create automated actions in Odoo to send real-time updates to this application.
              </p>
              <Button 
                onClick={setupWebhooks}
                disabled={actionLoading || config?.odoo_automations_created}
                className="w-full"
              >
                {actionLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Setup Odoo Webhooks
              </Button>
              {config?.odoo_automations_created && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Webhooks already configured
                </p>
              )}
            </div>

            {/* Delete Button */}
            <div className="p-4 border rounded-lg border-red-200 bg-red-50">
              <h3 className="font-medium mb-2 text-red-700">Remove Webhooks</h3>
              <p className="text-sm text-red-600 mb-4">
                Delete all webhook automations from Odoo. This will stop real-time sync completely.
              </p>
              <Button 
                variant="destructive"
                onClick={deleteWebhooks}
                disabled={actionLoading}
                className="w-full"
              >
                {actionLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Odoo Webhooks
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Webhooks Work</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li><strong>Setup:</strong> Creates "Automated Actions" in Odoo that trigger on record create/update/delete</li>
            <li><strong>Trigger:</strong> When a record changes in Odoo, it sends a POST request to this application</li>
            <li><strong>Process:</strong> This application receives the webhook and updates its local database</li>
            <li><strong>Result:</strong> Data stays in sync between Odoo and this CRM dashboard in real-time</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> If webhooks are disabled, Odoo will still try to send them, but this application 
              will silently ignore them. To completely stop webhook traffic, delete the automations from Odoo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WebhookConfigPage;
