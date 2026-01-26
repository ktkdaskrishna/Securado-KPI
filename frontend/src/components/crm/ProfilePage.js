import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { authAPI, adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { User, Mail, Building2, Shield, Bell, Key, Calendar, Activity, Settings } from 'lucide-react';
import { toast } from 'sonner';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    dealUpdates: true,
    activityReminders: true,
    weeklyDigest: false
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await authAPI.me();
      setProfile(res.data);
      
      // Load roles for display
      try {
        const rolesRes = await adminAPI.listRoles();
        setRoles(rolesRes.data || []);
      } catch (e) {
        // Roles may not be accessible
      }
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success('Notification preferences updated');
  };

  const getUserRoleNames = () => {
    if (!profile?.roles || !roles.length) return [];
    return profile.roles.map(roleId => {
      const role = roles.find(r => r.id === roleId);
      return role?.name || roleId;
    });
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
    <div className="space-y-6" data-testid="profile-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-3xl font-bold mb-4">
                {profile?.name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
              </div>
              <h2 className="text-xl font-bold text-foreground">{profile?.name || 'User'}</h2>
              <p className="text-sm text-muted-foreground mb-2">{profile?.email}</p>
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {getUserRoleNames().map((role, i) => (
                  <Badge key={i} variant="secondary">{role}</Badge>
                ))}
              </div>
              <Badge variant={profile?.status === 'approved' ? 'default' : 'outline'} className="capitalize">
                {profile?.status || 'Active'}
              </Badge>
            </div>
            
            <div className="border-t mt-6 pt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{profile?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">Organization: {profile?.org_id || 'Default'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">Member since: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Tabs */}
        <Card className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile" data-testid="tab-profile">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="notifications" data-testid="tab-notifications">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="security" data-testid="tab-security">
                  <Shield className="h-4 w-4 mr-2" />
                  Security
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              <TabsContent value="profile" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" defaultValue={profile?.name} placeholder="Enter your name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" defaultValue={profile?.email} disabled />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" placeholder="+1 (555) 000-0000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Job Title</Label>
                      <Input id="title" placeholder="Sales Manager" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" defaultValue="America/New_York" placeholder="Select timezone" />
                  </div>
                  <Button className="bg-primary hover:bg-primary/90" data-testid="save-profile-btn">
                    Save Changes
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="notifications" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">Email Alerts</p>
                      <p className="text-sm text-muted-foreground">Receive email notifications for important updates</p>
                    </div>
                    <Switch 
                      checked={notifications.emailAlerts} 
                      onCheckedChange={() => handleNotificationChange('emailAlerts')}
                      data-testid="toggle-email-alerts"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">Deal Updates</p>
                      <p className="text-sm text-muted-foreground">Get notified when deal stages change</p>
                    </div>
                    <Switch 
                      checked={notifications.dealUpdates} 
                      onCheckedChange={() => handleNotificationChange('dealUpdates')}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">Activity Reminders</p>
                      <p className="text-sm text-muted-foreground">Reminders for upcoming activities and tasks</p>
                    </div>
                    <Switch 
                      checked={notifications.activityReminders} 
                      onCheckedChange={() => handleNotificationChange('activityReminders')}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">Weekly Digest</p>
                      <p className="text-sm text-muted-foreground">Weekly summary of your sales performance</p>
                    </div>
                    <Switch 
                      checked={notifications.weeklyDigest} 
                      onCheckedChange={() => handleNotificationChange('weeklyDigest')}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Change Password
                      </CardTitle>
                      <CardDescription>Update your password to keep your account secure</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input id="current-password" type="password" placeholder="Enter current password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input id="new-password" type="password" placeholder="Enter new password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input id="confirm-password" type="password" placeholder="Confirm new password" />
                      </div>
                      <Button variant="outline" data-testid="change-password-btn">
                        Update Password
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Active Sessions
                      </CardTitle>
                      <CardDescription>Manage your active login sessions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium text-sm">Current Session</p>
                            <p className="text-xs text-muted-foreground">Chrome on Windows • Active now</p>
                          </div>
                          <Badge variant="default">Current</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="pt-4 border-t">
                    <Button variant="destructive" onClick={logout} data-testid="logout-btn">
                      Sign Out
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
