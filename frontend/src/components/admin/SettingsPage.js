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

  const loadSsoConfig = async () => {
    try {
      const [configRes, statusRes] = await Promise.all([
        microsoftAuthAPI.getAdminConfig(),
        microsoftAuthAPI.getStatus()
      ]);
      
      if (configRes.data?.settings) {
        setSsoConfig(prev => ({ ...prev, ...configRes.data.settings }));
      }
      if (statusRes.data) {
        setSsoStatus(statusRes.data);
      }
    } catch (error) {
      console.log('SSO config not available');
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

  const updateSsoConfig = (key, value) => {
    setSsoConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSso = async () => {
    setSsoSaving(true);
    try {
      const res = await microsoftAuthAPI.saveAdminConfig(ssoConfig);
      if (res.data?.success) {
        toast.success('Microsoft SSO configuration saved');
        setSsoStatus({ configured: res.data.configured });
        // Reload config to get masked secret
        await loadSsoConfig();
      }
    } catch (error) {
      toast.error('Failed to save SSO configuration');
    } finally {
      setSsoSaving(false);
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
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="sso" data-testid="tab-sso">
            <KeyRound className="h-4 w-4 mr-2" />
            SSO
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

        {/* SSO Configuration Tab */}
        <TabsContent value="sso" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Microsoft SSO Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure Azure AD / Microsoft Entra ID for Single Sign-On
                  </CardDescription>
                </div>
                <Badge 
                  variant={ssoStatus.configured ? "default" : "secondary"}
                  className={ssoStatus.configured ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}
                >
                  {ssoStatus.configured ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Configured</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Not Configured</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Setup Instructions */}
              <Alert className="bg-blue-500/10 border-blue-500/30">
                <AlertDescription className="text-sm">
                  <strong>Setup Instructions:</strong>
                  <ol className="list-decimal ml-4 mt-2 space-y-1">
                    <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">Azure Portal <ExternalLink className="h-3 w-3" /></a> → Azure Active Directory → App registrations</li>
                    <li>Create a new registration for your application</li>
                    <li>Set the redirect URI to the value shown below</li>
                    <li>Copy the Application (Client) ID and Directory (Tenant) ID</li>
                    <li>Create a Client Secret under "Certificates & secrets"</li>
                    <li>Enter all values below and save</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                {/* Application (Client) ID */}
                <div className="space-y-2">
                  <Label htmlFor="client_id">Application (Client) ID</Label>
                  <Input
                    id="client_id"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={ssoConfig.client_id}
                    onChange={(e) => updateSsoConfig('client_id', e.target.value)}
                    data-testid="sso-client-id-input"
                  />
                  <p className="text-xs text-muted-foreground">Found in Azure AD → App registration → Overview</p>
                </div>

                {/* Directory (Tenant) ID */}
                <div className="space-y-2">
                  <Label htmlFor="tenant_id">Directory (Tenant) ID</Label>
                  <Input
                    id="tenant_id"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={ssoConfig.tenant_id}
                    onChange={(e) => updateSsoConfig('tenant_id', e.target.value)}
                    data-testid="sso-tenant-id-input"
                  />
                  <p className="text-xs text-muted-foreground">Found in Azure AD → Overview</p>
                </div>

                {/* Client Secret */}
                <div className="space-y-2">
                  <Label htmlFor="client_secret">Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="client_secret"
                      type={showSecret ? "text" : "password"}
                      placeholder={ssoConfig.client_secret_masked || "Enter client secret"}
                      value={ssoConfig.client_secret}
                      onChange={(e) => updateSsoConfig('client_secret', e.target.value)}
                      data-testid="sso-client-secret-input"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Found in Azure AD → App registration → Certificates & secrets
                    {ssoConfig.client_secret_masked && (
                      <span className="ml-2 text-green-500">Current: {ssoConfig.client_secret_masked}</span>
                    )}
                  </p>
                </div>

                {/* Redirect URI */}
                <div className="space-y-2">
                  <Label htmlFor="redirect_uri">Redirect URI</Label>
                  <Input
                    id="redirect_uri"
                    placeholder="https://your-domain.com/api/auth/microsoft/callback"
                    value={ssoConfig.redirect_uri}
                    onChange={(e) => updateSsoConfig('redirect_uri', e.target.value)}
                    data-testid="sso-redirect-uri-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must match exactly in Azure AD. Suggested: <code className="bg-muted px-1 rounded">{window.location.origin}/api/auth/microsoft/callback</code>
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {ssoStatus.configured ? (
                    <span className="text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Microsoft SSO is active. Users can sign in with their Microsoft accounts.
                    </span>
                  ) : (
                    <span className="text-yellow-500">
                      Complete the configuration above to enable Microsoft SSO.
                    </span>
                  )}
                </div>
                <Button 
                  onClick={handleSaveSso}
                  disabled={ssoSaving}
                  className="bg-primary hover:bg-primary/90"
                  data-testid="save-sso-config-btn"
                >
                  {ssoSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save SSO Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* RBAC Auto-Linking Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                RBAC Auto-Linking
              </CardTitle>
              <CardDescription>
                How Microsoft users are linked to Odoo RBAC profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</div>
                  <div>
                    <p className="font-medium">User signs in with Microsoft</p>
                    <p className="text-muted-foreground">User clicks "Sign in with Microsoft" and authenticates</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</div>
                  <div>
                    <p className="font-medium">Email matching</p>
                    <p className="text-muted-foreground">System searches for a matching email in the synced RBAC users</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</div>
                  <div>
                    <p className="font-medium">Access level assigned</p>
                    <p className="text-muted-foreground">
                      If matched → User gets Odoo permissions (ADMIN/MANAGER/USER)<br/>
                      If not matched → User gets RESTRICTED access with a warning
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-500">
                  <strong>Tip:</strong> Make sure to sync RBAC from Odoo (Admin → RBAC Sync) before enabling Microsoft SSO, 
                  so users' emails can be matched to their Odoo permissions.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
