import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import {
  UserRound,
  Mail,
  Building,
  Shield,
  Settings,
  Save,
  Loader2,
} from 'lucide-react';

const ProfilePage = () => {
  const { user, fetchUser } = useAuth();
  const queryClient = useQueryClient();
  const [dashboardPrefs, setDashboardPrefs] = useState(null);

  const { data: userConfig, isLoading: configLoading } = useQuery({
    queryKey: ['user-dashboard-config'],
    queryFn: async () => {
      const response = await apiClient.get('/config/user/dashboard');
      setDashboardPrefs(response.data);
      return response.data;
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data) => {
      await apiClient.put('/config/user/dashboard', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-dashboard-config']);
      toast.success('Preferences saved');
    },
    onError: () => {
      toast.error('Failed to save preferences');
    },
  });

  const handlePreferenceChange = (key, value) => {
    setDashboardPrefs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSavePreferences = () => {
    updateConfigMutation.mutate(dashboardPrefs);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* User Info Card */}
      <Card data-testid="profile-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserRound size={18} />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
              <UserRound size={36} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user?.name || 'User'}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">
                <Mail size={12} className="inline mr-1" />
                Email
              </Label>
              <div className="font-medium">{user?.email || '-'}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">
                <Shield size={12} className="inline mr-1" />
                Role
              </Label>
              <div className="font-medium">{user?.role || user?.role_name || '-'}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">
                <Building size={12} className="inline mr-1" />
                Department
              </Label>
              <div className="font-medium">{user?.department || user?.department_name || '-'}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">
                Status
              </Label>
              <div className="font-medium capitalize">{user?.status || '-'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Preferences Card */}
      <Card data-testid="preferences-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings size={18} />
            Dashboard Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Pipeline Chart</Label>
                  <p className="text-xs text-muted-foreground">Display pipeline chart on dashboard</p>
                </div>
                <Switch
                  checked={dashboardPrefs?.show_pipeline_chart ?? true}
                  onCheckedChange={(checked) => handlePreferenceChange('show_pipeline_chart', checked)}
                  data-testid="pref-pipeline-chart"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Activity Stats</Label>
                  <p className="text-xs text-muted-foreground">Display activity statistics on dashboard</p>
                </div>
                <Switch
                  checked={dashboardPrefs?.show_activity_stats ?? true}
                  onCheckedChange={(checked) => handlePreferenceChange('show_activity_stats', checked)}
                  data-testid="pref-activity-stats"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Leaderboard</Label>
                  <p className="text-xs text-muted-foreground">Display team leaderboard on dashboard</p>
                </div>
                <Switch
                  checked={dashboardPrefs?.show_leaderboard ?? true}
                  onCheckedChange={(checked) => handlePreferenceChange('show_leaderboard', checked)}
                  data-testid="pref-leaderboard"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Compact View</Label>
                  <p className="text-xs text-muted-foreground">Use compact layout for dashboard widgets</p>
                </div>
                <Switch
                  checked={dashboardPrefs?.compact_view ?? false}
                  onCheckedChange={(checked) => handlePreferenceChange('compact_view', checked)}
                  data-testid="pref-compact-view"
                />
              </div>

              <div className="space-y-2">
                <Label>Default Page Size</Label>
                <Input
                  type="number"
                  value={dashboardPrefs?.default_page_size || 10}
                  onChange={(e) => handlePreferenceChange('default_page_size', parseInt(e.target.value) || 10)}
                  className="w-32"
                  min={5}
                  max={100}
                  data-testid="pref-page-size"
                />
              </div>

              <Separator />

              <Button
                onClick={handleSavePreferences}
                disabled={updateConfigMutation.isPending}
                data-testid="save-preferences-button"
              >
                {updateConfigMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Preferences
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
