import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { 
  Shield, 
  Users, 
  Building2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  AlertTriangle,
  Eye,
  ShieldCheck,
  UserCog,
  Filter,
  Plus,
  Edit2,
  Trash2,
  ShieldAlert,
  UserPlus,
  Upload,
  Download,
  CheckSquare,
  Square
} from 'lucide-react';
import { toast } from 'sonner';
import { rbacSyncAPI, etlAPI } from '../../lib/api';

const RBACManagementPage = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [teams, setTeams] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [testUser, setTestUser] = useState('');
  const [testResult, setTestResult] = useState(null);
  
  // Permission Overrides state
  const [overrides, setOverrides] = useState([]);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [showBulkOverride, setShowBulkOverride] = useState(false);
  const [editingOverride, setEditingOverride] = useState(null);
  const [overrideForm, setOverrideForm] = useState({
    user_email: '',
    access_level: 'USER',
    reason: '',
    expires_at: ''
  });
  const [bulkForm, setBulkForm] = useState({
    access_level: 'MANAGER',
    reason: '',
    expires_at: ''
  });
  const [savingOverride, setSavingOverride] = useState(false);
  
  // Selection state for bulk operations
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [selectedOverrides, setSelectedOverrides] = useState(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, groupsRes, teamsRes, connectionsRes, overridesRes] = await Promise.all([
        rbacSyncAPI.getStats(),
        rbacSyncAPI.listUsers(),
        rbacSyncAPI.listGroups(),
        rbacSyncAPI.listTeams(),
        etlAPI.listConnections(),
        rbacSyncAPI.listOverrides()
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data.users || []);
      setGroups(groupsRes.data.groups || []);
      setTeams(teamsRes.data.teams || []);
      setOverrides(overridesRes.data.overrides || []);
      
      const odooConnections = (connectionsRes.data || []).filter(c => c.type === 'odoo' && c.status === 'active');
      setConnections(odooConnections);
      if (odooConnections.length > 0 && !selectedConnection) {
        setSelectedConnection(odooConnections[0].id || odooConnections[0].connection_id);
      }
    } catch (error) {
      console.error('Error fetching RBAC data:', error);
      toast.error('Failed to load RBAC data');
    } finally {
      setLoading(false);
    }
  }, [selectedConnection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    if (!selectedConnection) {
      toast.error('Please select an Odoo connection first');
      return;
    }
    
    setSyncing(true);
    try {
      const result = await rbacSyncAPI.triggerSync(selectedConnection);
      if (result.data.status === 'success') {
        toast.success(`Synced ${result.data.users_synced} users, ${result.data.groups_synced} groups, ${result.data.teams_synced} teams`);
        await fetchData();
      } else {
        toast.error(result.data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error.response?.data?.detail || 'Failed to sync RBAC data from Odoo');
    } finally {
      setSyncing(false);
    }
  };

  const handleTestFilter = async () => {
    if (!testUser.trim()) {
      toast.error('Please enter a user name to test');
      return;
    }
    
    try {
      const result = await rbacSyncAPI.testFilter(testUser.trim(), 'opportunity');
      setTestResult(result.data);
    } catch (error) {
      console.error('Test filter error:', error);
      toast.error('Failed to test filter');
    }
  };

  // Single override handlers
  const handleCreateOverride = async () => {
    if (!overrideForm.user_email.trim()) {
      toast.error('Please enter a user email');
      return;
    }
    
    setSavingOverride(true);
    try {
      await rbacSyncAPI.createOverride({
        user_email: overrideForm.user_email.trim(),
        access_level: overrideForm.access_level,
        reason: overrideForm.reason,
        expires_at: overrideForm.expires_at || null
      });
      toast.success('Permission override created');
      setShowAddOverride(false);
      setOverrideForm({ user_email: '', access_level: 'USER', reason: '', expires_at: '' });
      await fetchData();
    } catch (error) {
      console.error('Create override error:', error);
      toast.error(error.response?.data?.detail || 'Failed to create override');
    } finally {
      setSavingOverride(false);
    }
  };

  const handleUpdateOverride = async () => {
    if (!editingOverride) return;
    
    setSavingOverride(true);
    try {
      await rbacSyncAPI.updateOverride(editingOverride.id, {
        access_level: overrideForm.access_level,
        reason: overrideForm.reason,
        expires_at: overrideForm.expires_at || null,
        is_active: true
      });
      toast.success('Permission override updated');
      setEditingOverride(null);
      setOverrideForm({ user_email: '', access_level: 'USER', reason: '', expires_at: '' });
      await fetchData();
    } catch (error) {
      console.error('Update override error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update override');
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteOverride = async (overrideId) => {
    if (!window.confirm('Are you sure you want to delete this permission override?')) return;
    
    try {
      await rbacSyncAPI.deleteOverride(overrideId);
      toast.success('Permission override deleted');
      await fetchData();
    } catch (error) {
      console.error('Delete override error:', error);
      toast.error('Failed to delete override');
    }
  };

  const handleToggleOverrideActive = async (override) => {
    try {
      await rbacSyncAPI.updateOverride(override.id, { is_active: !override.is_active });
      toast.success(override.is_active ? 'Override deactivated' : 'Override activated');
      await fetchData();
    } catch (error) {
      console.error('Toggle override error:', error);
      toast.error('Failed to update override');
    }
  };

  // Bulk override handlers
  const handleBulkCreateOverrides = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Please select users first');
      return;
    }
    
    setSavingOverride(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const userLogin of selectedUsers) {
      try {
        await rbacSyncAPI.createOverride({
          user_email: userLogin,
          access_level: bulkForm.access_level,
          reason: bulkForm.reason || `Bulk override - ${new Date().toLocaleDateString()}`,
          expires_at: bulkForm.expires_at || null
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Failed to create override for ${userLogin}:`, error);
      }
    }
    
    if (successCount > 0) {
      toast.success(`Created ${successCount} permission overrides`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to create ${errorCount} overrides (may already exist)`);
    }
    
    setShowBulkOverride(false);
    setSelectedUsers(new Set());
    setBulkForm({ access_level: 'MANAGER', reason: '', expires_at: '' });
    await fetchData();
    setSavingOverride(false);
  };

  const handleBulkDeleteOverrides = async () => {
    if (selectedOverrides.size === 0) {
      toast.error('Please select overrides to delete');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete ${selectedOverrides.size} overrides?`)) return;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const overrideId of selectedOverrides) {
      try {
        await rbacSyncAPI.deleteOverride(overrideId);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      toast.success(`Deleted ${successCount} overrides`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to delete ${errorCount} overrides`);
    }
    
    setSelectedOverrides(new Set());
    await fetchData();
  };

  const handleBulkToggleOverrides = async (setActive) => {
    if (selectedOverrides.size === 0) {
      toast.error('Please select overrides first');
      return;
    }
    
    let successCount = 0;
    
    for (const overrideId of selectedOverrides) {
      try {
        await rbacSyncAPI.updateOverride(overrideId, { is_active: setActive });
        successCount++;
      } catch (error) {
        console.error(`Failed to update override ${overrideId}:`, error);
      }
    }
    
    toast.success(`${setActive ? 'Activated' : 'Deactivated'} ${successCount} overrides`);
    setSelectedOverrides(new Set());
    await fetchData();
  };

  // Selection helpers
  const toggleUserSelection = (login) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(login)) {
      newSelected.delete(login);
    } else {
      newSelected.add(login);
    }
    setSelectedUsers(newSelected);
  };

  const toggleOverrideSelection = (id) => {
    const newSelected = new Set(selectedOverrides);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOverrides(newSelected);
  };

  const selectAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.login)));
    }
  };

  const selectAllOverrides = () => {
    if (selectedOverrides.size === overrides.length) {
      setSelectedOverrides(new Set());
    } else {
      setSelectedOverrides(new Set(overrides.map(o => o.id)));
    }
  };

  const openEditOverride = (override) => {
    setEditingOverride(override);
    setOverrideForm({
      user_email: override.user_email,
      access_level: override.access_level,
      reason: override.reason || '',
      expires_at: override.expires_at ? override.expires_at.split('T')[0] : ''
    });
  };

  const getAccessLevelBadge = (level, isOverride = false) => {
    const colors = {
      'ADMIN': 'bg-purple-100 text-purple-700 border-purple-200',
      'MANAGER': 'bg-blue-100 text-blue-700 border-blue-200',
      'USER': 'bg-green-100 text-green-700 border-green-200',
      'RESTRICTED': 'bg-red-100 text-red-700 border-red-200'
    };
    return (
      <Badge variant="outline" className={`${colors[level] || colors['RESTRICTED']} ${isOverride ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}>
        {isOverride && <ShieldAlert className="h-3 w-3 mr-1" />}
        {level}
      </Badge>
    );
  };

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      (user.name || '').toLowerCase().includes(query) ||
      (user.login || '').toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="space-y-6" data-testid="rbac-management-page">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="rbac-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-[#800000]" />
            RBAC Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage row-level security by syncing user permissions from Odoo
          </p>
        </div>
        <div className="flex items-center gap-3">
          {connections.length > 0 && (
            <select
              value={selectedConnection || ''}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-gray-700 text-sm bg-white focus:ring-2 focus:ring-[#800000] focus:border-[#800000]"
              data-testid="connection-select"
            >
              {connections.map(conn => (
                <option key={conn.id || conn.connection_id} value={conn.id || conn.connection_id}>
                  {conn.name}
                </option>
              ))}
            </select>
          )}
          <Button
            onClick={handleSync}
            disabled={syncing || connections.length === 0}
            className="bg-[#800000] hover:bg-[#990000] text-white"
            data-testid="sync-rbac-button"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync from Odoo
              </>
            )}
          </Button>
        </div>
      </div>

      {/* No Connection Warning */}
      {connections.length === 0 && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">No Odoo Connection</AlertTitle>
          <AlertDescription className="text-amber-700">
            You need an active Odoo connection to sync RBAC data. Go to ETL Platform → Connections to set one up.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#800000]" />
              Users Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats?.users_synced || 0}</p>
            {stats?.last_sync && (
              <p className="text-xs text-gray-400 mt-1">
                Last sync: {new Date(stats.last_sync).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#800000]" />
              Groups Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats?.groups_synced || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#800000]" />
              Teams Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats?.teams_synced || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Local Overrides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{overrides.filter(o => o.is_active).length}</p>
            <p className="text-xs text-gray-400 mt-1">
              {overrides.length} total ({overrides.filter(o => !o.is_active).length} inactive)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <UserCog className="h-4 w-4 text-[#800000]" />
              Access Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {stats?.access_level_distribution && Object.entries(stats.access_level_distribution).map(([level, count]) => (
                count > 0 && (
                  <span key={level} className="text-xs flex items-center gap-1">
                    {getAccessLevelBadge(level)} <span className="text-gray-500">{count}</span>
                  </span>
                )
              ))}
              {(!stats?.access_level_distribution || Object.values(stats.access_level_distribution).every(v => v === 0)) && (
                <span className="text-gray-400 text-sm">No users synced yet</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-gray-100 border border-gray-200">
          <TabsTrigger value="users" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-2" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="overrides" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Overrides ({overrides.filter(o => o.is_active).length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <Shield className="h-4 w-4 mr-2" />
            Groups ({groups.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <Building2 className="h-4 w-4 mr-2" />
            Teams ({teams.length})
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <Filter className="h-4 w-4 mr-2" />
            Test Filter
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900">Synced Users</CardTitle>
                  <CardDescription className="text-gray-500">
                    Users synced from Odoo with their access levels. Select users for bulk operations.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
                      data-testid="search-users-input"
                    />
                  </div>
                  {selectedUsers.size > 0 && (
                    <Button
                      onClick={() => setShowBulkOverride(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      data-testid="bulk-override-button"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Bulk Override ({selectedUsers.size})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-gray-50">
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                          onCheckedChange={selectAllUsers}
                          className="border-gray-300"
                        />
                      </TableHead>
                      <TableHead className="text-gray-600 font-semibold">Name</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Login</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Access Level</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Teams</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Synced At</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                          {users.length === 0 
                            ? "No users synced yet. Click 'Sync from Odoo' to start."
                            : "No users match your search."
                          }
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user, idx) => {
                        const hasOverride = overrides.find(o => 
                          o.user_email?.toLowerCase() === user.login?.toLowerCase() && o.is_active
                        );
                        const isSelected = selectedUsers.has(user.login);
                        return (
                          <TableRow 
                            key={user.odoo_user_id || idx} 
                            className={`border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-amber-50' : ''}`}
                          >
                            <TableCell>
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={() => toggleUserSelection(user.login)}
                                className="border-gray-300"
                              />
                            </TableCell>
                            <TableCell className="text-gray-900 font-medium">{user.name}</TableCell>
                            <TableCell className="text-gray-600">{user.login}</TableCell>
                            <TableCell>
                              {hasOverride ? (
                                <div className="flex items-center gap-2">
                                  {getAccessLevelBadge(hasOverride.access_level, true)}
                                </div>
                              ) : (
                                getAccessLevelBadge(user.access_level)
                              )}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {user.teams?.length > 0 ? user.teams.join(', ') : '-'}
                            </TableCell>
                            <TableCell className="text-gray-500 text-sm">
                              {user.synced_at ? new Date(user.synced_at).toLocaleString() : '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setOverrideForm({
                                    user_email: user.login || user.email,
                                    access_level: 'MANAGER',
                                    reason: '',
                                    expires_at: ''
                                  });
                                  setShowAddOverride(true);
                                }}
                                className="text-gray-500 hover:text-[#800000] hover:bg-red-50"
                                title="Add permission override"
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permission Overrides Tab */}
        <TabsContent value="overrides">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                    Local Permission Overrides
                  </CardTitle>
                  <CardDescription className="text-gray-500 mt-1">
                    Override Odoo-synced permissions locally. Useful for temporary access or testing.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedOverrides.size > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkToggleOverrides(true)}
                        className="border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Activate ({selectedOverrides.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkToggleOverrides(false)}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Deactivate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDeleteOverrides}
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                  <Dialog open={showAddOverride} onOpenChange={setShowAddOverride}>
                    <DialogTrigger asChild>
                      <Button className="bg-[#800000] hover:bg-[#990000] text-white" data-testid="add-override-button">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Override
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border-gray-200">
                      <DialogHeader>
                        <DialogTitle className="text-gray-900">Create Permission Override</DialogTitle>
                        <DialogDescription className="text-gray-500">
                          Grant or restrict access for a specific user, bypassing their Odoo permissions.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label className="text-gray-700">User Email</Label>
                          <Input
                            placeholder="user@example.com"
                            value={overrideForm.user_email}
                            onChange={(e) => setOverrideForm({...overrideForm, user_email: e.target.value})}
                            className="border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
                            data-testid="override-user-email-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700">Access Level</Label>
                          <Select
                            value={overrideForm.access_level}
                            onValueChange={(val) => setOverrideForm({...overrideForm, access_level: val})}
                          >
                            <SelectTrigger className="border-gray-300 focus:ring-[#800000]" data-testid="override-access-level-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              <SelectItem value="ADMIN">ADMIN - Full access to all data</SelectItem>
                              <SelectItem value="MANAGER">MANAGER - Access to team data</SelectItem>
                              <SelectItem value="USER">USER - Own records only</SelectItem>
                              <SelectItem value="RESTRICTED">RESTRICTED - No data access</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700">Reason (optional)</Label>
                          <Textarea
                            placeholder="Why is this override needed?"
                            value={overrideForm.reason}
                            onChange={(e) => setOverrideForm({...overrideForm, reason: e.target.value})}
                            className="border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
                            data-testid="override-reason-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700">Expires At (optional)</Label>
                          <Input
                            type="date"
                            value={overrideForm.expires_at}
                            onChange={(e) => setOverrideForm({...overrideForm, expires_at: e.target.value})}
                            className="border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
                            data-testid="override-expires-input"
                          />
                          <p className="text-xs text-gray-400">Leave empty for no expiration</p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddOverride(false)} className="border-gray-300">
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateOverride} 
                          disabled={savingOverride}
                          className="bg-[#800000] hover:bg-[#990000] text-white"
                          data-testid="save-override-button"
                        >
                          {savingOverride ? 'Creating...' : 'Create Override'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Dialog */}
                  <Dialog open={!!editingOverride} onOpenChange={() => setEditingOverride(null)}>
                    <DialogContent className="bg-white border-gray-200">
                      <DialogHeader>
                        <DialogTitle className="text-gray-900">Edit Permission Override</DialogTitle>
                        <DialogDescription className="text-gray-500">
                          Modify the override for {editingOverride?.user_email}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label className="text-gray-700">Access Level</Label>
                          <Select
                            value={overrideForm.access_level}
                            onValueChange={(val) => setOverrideForm({...overrideForm, access_level: val})}
                          >
                            <SelectTrigger className="border-gray-300 focus:ring-[#800000]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              <SelectItem value="ADMIN">ADMIN - Full access to all data</SelectItem>
                              <SelectItem value="MANAGER">MANAGER - Access to team data</SelectItem>
                              <SelectItem value="USER">USER - Own records only</SelectItem>
                              <SelectItem value="RESTRICTED">RESTRICTED - No data access</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700">Reason</Label>
                          <Textarea
                            value={overrideForm.reason}
                            onChange={(e) => setOverrideForm({...overrideForm, reason: e.target.value})}
                            className="border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700">Expires At</Label>
                          <Input
                            type="date"
                            value={overrideForm.expires_at}
                            onChange={(e) => setOverrideForm({...overrideForm, expires_at: e.target.value})}
                            className="border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingOverride(null)} className="border-gray-300">
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleUpdateOverride} 
                          disabled={savingOverride}
                          className="bg-[#800000] hover:bg-[#990000] text-white"
                        >
                          {savingOverride ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Bulk Override Dialog */}
                  <Dialog open={showBulkOverride} onOpenChange={setShowBulkOverride}>
                    <DialogContent className="bg-white border-gray-200">
                      <DialogHeader>
                        <DialogTitle className="text-gray-900">Bulk Create Overrides</DialogTitle>
                        <DialogDescription className="text-gray-500">
                          Create permission overrides for {selectedUsers.size} selected users
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-sm text-amber-800">
                            <strong>{selectedUsers.size}</strong> users selected: {Array.from(selectedUsers).slice(0, 3).join(', ')}
                            {selectedUsers.size > 3 && ` and ${selectedUsers.size - 3} more...`}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700">Access Level for All</Label>
                          <Select
                            value={bulkForm.access_level}
                            onValueChange={(val) => setBulkForm({...bulkForm, access_level: val})}
                          >
                            <SelectTrigger className="border-gray-300 focus:ring-[#800000]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              <SelectItem value="ADMIN">ADMIN - Full access to all data</SelectItem>
                              <SelectItem value="MANAGER">MANAGER - Access to team data</SelectItem>
                              <SelectItem value="USER">USER - Own records only</SelectItem>
                              <SelectItem value="RESTRICTED">RESTRICTED - No data access</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700">Reason (optional)</Label>
                          <Textarea
                            placeholder="Why are these overrides needed?"
                            value={bulkForm.reason}
                            onChange={(e) => setBulkForm({...bulkForm, reason: e.target.value})}
                            className="border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700">Expires At (optional)</Label>
                          <Input
                            type="date"
                            value={bulkForm.expires_at}
                            onChange={(e) => setBulkForm({...bulkForm, expires_at: e.target.value})}
                            className="border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkOverride(false)} className="border-gray-300">
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleBulkCreateOverrides} 
                          disabled={savingOverride}
                          className="bg-[#800000] hover:bg-[#990000] text-white"
                        >
                          {savingOverride ? 'Creating...' : `Create ${selectedUsers.size} Overrides`}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-gray-50">
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedOverrides.size === overrides.length && overrides.length > 0}
                          onCheckedChange={selectAllOverrides}
                          className="border-gray-300"
                        />
                      </TableHead>
                      <TableHead className="text-gray-600 font-semibold">User</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Access Level</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Reason</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Expires</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Status</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Created By</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                          No permission overrides configured. Click "Add Override" to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      overrides.map((override, idx) => {
                        const isSelected = selectedOverrides.has(override.id);
                        return (
                          <TableRow 
                            key={override.id || idx} 
                            className={`border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-amber-50' : ''}`}
                          >
                            <TableCell>
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={() => toggleOverrideSelection(override.id)}
                                className="border-gray-300"
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-gray-900 font-medium">{override.user_name}</p>
                                <p className="text-gray-500 text-xs">{override.user_email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{getAccessLevelBadge(override.access_level, true)}</TableCell>
                            <TableCell className="text-gray-600 max-w-[200px] truncate" title={override.reason}>
                              {override.reason || '-'}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {override.expires_at ? (
                                <span className={new Date(override.expires_at) < new Date() ? 'text-red-600 font-medium' : ''}>
                                  {new Date(override.expires_at).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="text-gray-400">Never</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {override.is_active ? (
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-500 text-sm">
                              {override.created_by?.split('@')[0] || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditOverride(override)}
                                  className="text-gray-500 hover:text-[#800000] hover:bg-red-50"
                                  title="Edit override"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleOverrideActive(override)}
                                  className={override.is_active ? "text-gray-500 hover:text-gray-700" : "text-green-600 hover:text-green-700"}
                                  title={override.is_active ? 'Deactivate' : 'Activate'}
                                >
                                  {override.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteOverride(override.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Delete override"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Synced Groups</CardTitle>
              <CardDescription className="text-gray-500">
                Odoo security groups that determine access levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-gray-50">
                      <TableHead className="text-gray-600 font-semibold">Group Name</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Category</TableHead>
                      <TableHead className="text-gray-600 font-semibold">User Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-12">
                          No groups synced yet. Click 'Sync from Odoo' to start.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groups.map((group, idx) => (
                        <TableRow key={group.odoo_group_id || idx} className="border-gray-100 hover:bg-gray-50">
                          <TableCell className="text-gray-900 font-medium">
                            {group.full_name || group.name}
                          </TableCell>
                          <TableCell className="text-gray-600">{group.category || '-'}</TableCell>
                          <TableCell className="text-gray-600">{group.user_count || 0}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Synced Teams</CardTitle>
              <CardDescription className="text-gray-500">
                Sales teams from Odoo - managers can see their team's data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-gray-50">
                      <TableHead className="text-gray-600 font-semibold">Team Name</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Leader</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Members</TableHead>
                      <TableHead className="text-gray-600 font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-12">
                          No teams synced yet. Click 'Sync from Odoo' to start.
                        </TableCell>
                      </TableRow>
                    ) : (
                      teams.map((team, idx) => (
                        <TableRow key={team.odoo_team_id || idx} className="border-gray-100 hover:bg-gray-50">
                          <TableCell className="text-gray-900 font-medium">{team.name}</TableCell>
                          <TableCell className="text-gray-600">{team.leader_name || '-'}</TableCell>
                          <TableCell className="text-gray-600">{team.member_count || 0}</TableCell>
                          <TableCell>
                            {team.active ? (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Filter Tab */}
        <TabsContent value="test">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Eye className="h-5 w-5 text-[#800000]" />
                Test RBAC Filter
              </CardTitle>
              <CardDescription className="text-gray-500">
                Test what data filter will be applied for a specific user (includes local overrides)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter user name (e.g., Nabisaheb)"
                  value={testUser}
                  onChange={(e) => setTestUser(e.target.value)}
                  className="flex-1 border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
                  data-testid="test-user-input"
                />
                <Button 
                  onClick={handleTestFilter}
                  className="bg-[#800000] hover:bg-[#990000] text-white"
                  data-testid="test-filter-button"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Test Filter
                </Button>
              </div>

              {testResult && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">User:</span>
                    <span className="text-gray-900 font-medium">{testResult.user_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Access Level:</span>
                    {getAccessLevelBadge(testResult.access_level)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Filter Type:</span>
                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                      {testResult.filter_type?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {testResult.groups?.length > 0 && (
                    <div>
                      <span className="text-gray-600 text-sm">Groups:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {testResult.groups.slice(0, 5).map((g, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-200">
                            {g}
                          </Badge>
                        ))}
                        {testResult.groups.length > 5 && (
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-200">
                            +{testResult.groups.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {testResult.teams?.length > 0 && (
                    <div>
                      <span className="text-gray-600 text-sm">Teams:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {testResult.teams.map((t, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200">
                    <span className="text-gray-600 text-sm">MongoDB Filter Applied:</span>
                    <pre className="mt-2 bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(testResult.mongodb_filter, null, 2) || '{}'}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RBACManagementPage;
