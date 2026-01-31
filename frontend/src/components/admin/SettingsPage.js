import React, { useState, useEffect } from 'react';
import { adminAPI, microsoftAuthAPI } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
import { getCurrencyOptions, DEFAULT_CURRENCY } from '../../lib/currency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Settings, DollarSign, Globe, Bell, Shield, Database, 
  Save, RefreshCw, Building2, Users, Palette, KeyRound,
  CheckCircle2, XCircle, Eye, EyeOff, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const { setCurrency: setGlobalCurrency } = useCurrency();
  
  // Settings state
  const [settings, setSettings] = useState({
    // General
    company_name: 'Securado',
    default_currency: DEFAULT_CURRENCY,
    timezone: 'UTC',
    date_format: 'MM/DD/YYYY',
    
    // Notifications
    email_notifications: true,
    deal_alerts: true,
    activity_reminders: true,
    weekly_reports: false,
    
    // Integration defaults
    default_sync_interval: '15',
    auto_map_fields: true,
    enable_data_validation: true,
    
    // Security
    session_timeout: '60',
    require_2fa: false,
    password_expiry_days: '90',
  });

  // Microsoft SSO state
  const [ssoConfig, setSsoConfig] = useState({
    client_id: '',
    tenant_id: '',
    redirect_uri: '',
    client_secret: '',
    client_secret_masked: '',
  });
  const [ssoStatus, setSsoStatus] = useState({ configured: false });
  const [ssoSaving, setSsoSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSsoConfig();
  }, []);

  const loadSettings = async () => {
    try {
      // Try to load settings from backend
      const res = await adminAPI.getSettings();
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (error) {
      // Use defaults if no settings exist
      console.log('Using default settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.updateSettings(settings);
      // Update global currency context when settings are saved
      if (settings.default_currency) {
        setGlobalCurrency(settings.default_currency);
      }
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Immediately update global currency when it changes
    if (key === 'default_currency') {
      setGlobalCurrency(value);
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

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure system preferences and defaults</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-primary hover:bg-primary/90"
          data-testid="save-settings-btn"
        >
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" data-testid="tab-general">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="currency" data-testid="tab-currency">
            <DollarSign className="h-4 w-4 mr-2" />
            Currency
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="integration" data-testid="tab-integration">
            <Database className="h-4 w-4 mr-2" />
            Integration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organization
              </CardTitle>
              <CardDescription>Basic organization settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={settings.company_name}
                    onChange={(e) => updateSetting('company_name', e.target.value)}
                    data-testid="company-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(v) => updateSetting('timezone', v)}>
                    <SelectTrigger data-testid="timezone-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                      <SelectItem value="Asia/Muscat">Muscat (GST)</SelectItem>
                      <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_format">Date Format</Label>
                <Select value={settings.date_format} onValueChange={(v) => updateSetting('date_format', v)}>
                  <SelectTrigger className="w-[200px]" data-testid="date-format-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Currency Settings
              </CardTitle>
              <CardDescription>Configure default currency for the organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="default_currency">Default Currency</Label>
                <Select 
                  value={settings.default_currency} 
                  onValueChange={(v) => updateSetting('default_currency', v)}
                >
                  <SelectTrigger className="w-[300px]" data-testid="default-currency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getCurrencyOptions().map((curr) => (
                      <SelectItem key={curr.code} value={curr.code}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{curr.symbol}</span>
                          <span>{curr.code}</span>
                          <span className="text-muted-foreground">- {curr.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This currency will be used as the default for all new invoices, opportunities, and reports.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Supported Currencies</h4>
                <div className="grid grid-cols-4 gap-3">
                  {getCurrencyOptions().map((curr) => (
                    <div 
                      key={curr.code}
                      className={`p-3 rounded-lg border ${
                        settings.default_currency === curr.code 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-mono">{curr.symbol}</span>
                        <div>
                          <div className="font-medium text-sm">{curr.code}</div>
                          <div className="text-xs text-muted-foreground">{curr.name}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Configure system-wide notification defaults</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Send email notifications for important events</p>
                </div>
                <Switch 
                  checked={settings.email_notifications} 
                  onCheckedChange={(v) => updateSetting('email_notifications', v)}
                  data-testid="toggle-email-notifications"
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="font-medium">Deal Alerts</p>
                  <p className="text-sm text-muted-foreground">Notify when deals change stage or are at risk</p>
                </div>
                <Switch 
                  checked={settings.deal_alerts} 
                  onCheckedChange={(v) => updateSetting('deal_alerts', v)}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="font-medium">Activity Reminders</p>
                  <p className="text-sm text-muted-foreground">Send reminders for upcoming activities</p>
                </div>
                <Switch 
                  checked={settings.activity_reminders} 
                  onCheckedChange={(v) => updateSetting('activity_reminders', v)}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="font-medium">Weekly Reports</p>
                  <p className="text-sm text-muted-foreground">Send weekly performance summary to all users</p>
                </div>
                <Switch 
                  checked={settings.weekly_reports} 
                  onCheckedChange={(v) => updateSetting('weekly_reports', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integration" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Integration Defaults
              </CardTitle>
              <CardDescription>Configure default settings for data integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Sync Interval</Label>
                  <Select 
                    value={settings.default_sync_interval} 
                    onValueChange={(v) => updateSetting('default_sync_interval', v)}
                  >
                    <SelectTrigger data-testid="sync-interval-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Every 5 minutes</SelectItem>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                      <SelectItem value="30">Every 30 minutes</SelectItem>
                      <SelectItem value="60">Every hour</SelectItem>
                      <SelectItem value="1440">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="font-medium">Auto-Map Fields</p>
                  <p className="text-sm text-muted-foreground">Automatically suggest field mappings based on names</p>
                </div>
                <Switch 
                  checked={settings.auto_map_fields} 
                  onCheckedChange={(v) => updateSetting('auto_map_fields', v)}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="font-medium">Enable Data Validation</p>
                  <p className="text-sm text-muted-foreground">Validate data before importing to canonical store</p>
                </div>
                <Switch 
                  checked={settings.enable_data_validation} 
                  onCheckedChange={(v) => updateSetting('enable_data_validation', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Default Entity Mappings
              </CardTitle>
              <CardDescription>Configure which source models map to which CRM entities by default</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Source Model Pattern</p>
                    <p className="font-medium">res.partner</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Maps To</p>
                    <Badge>Account / Contact</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                    <Badge variant="outline" className="text-emerald-600">Active</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Source Model Pattern</p>
                    <p className="font-medium">crm.lead</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Maps To</p>
                    <Badge>Opportunity</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                    <Badge variant="outline" className="text-emerald-600">Active</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Source Model Pattern</p>
                    <p className="font-medium">account.move</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Maps To</p>
                    <Badge>Invoice</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                    <Badge variant="outline" className="text-emerald-600">Active</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Source Model Pattern</p>
                    <p className="font-medium">hr.employee</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Maps To</p>
                    <Badge>User</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                    <Badge variant="outline" className="text-emerald-600">Active</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Source Model Pattern</p>
                    <p className="font-medium">sale.order</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Maps To</p>
                    <Badge>Order</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                    <Badge variant="outline" className="text-emerald-600">Active</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
