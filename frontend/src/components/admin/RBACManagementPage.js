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
  UserPlus
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
  const [editingOverride, setEditingOverride] = useState(null);
  const [overrideForm, setOverrideForm] = useState({
    user_email: '',
    access_level: 'USER',
    reason: '',
    expires_at: ''
  });
  const [savingOverride, setSavingOverride] = useState(false);

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
      
      // Filter to only Odoo connections
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

  // Permission Override handlers
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
    if (!confirm('Are you sure you want to delete this permission override?')) return;
    
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
      await rbacSyncAPI.updateOverride(override.id, {
        is_active: !override.is_active
      });
      toast.success(override.is_active ? 'Override deactivated' : 'Override activated');
      await fetchData();
    } catch (error) {
      console.error('Toggle override error:', error);
      toast.error('Failed to update override');
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
      'ADMIN': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'MANAGER': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'USER': 'bg-green-500/20 text-green-400 border-green-500/30',
      'RESTRICTED': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return (
      <Badge variant="outline" className={`${colors[level] || colors['RESTRICTED']} ${isOverride ? 'ring-1 ring-yellow-500/50' : ''}`}>
        {isOverride && <ShieldAlert className="h-3 w-3 mr-1" />}
        {level}
      </Badge>
    );
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.login?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6" data-testid="rbac-management-page">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="rbac-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-[#800000]" />
            RBAC Management
          </h1>
          <p className="text-gray-400 mt-1">
            Manage row-level security by syncing user permissions from Odoo
          </p>
        </div>
        <div className="flex items-center gap-3">
          {connections.length > 0 && (
            <select
              value={selectedConnection || ''}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="bg-[#2a2a2a] border border-[#444] rounded-md px-3 py-2 text-white text-sm"
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
            className="bg-[#800000] hover:bg-[#990000]"
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
        <Alert className="bg-yellow-500/10 border-yellow-500/30">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-500">No Odoo Connection</AlertTitle>
          <AlertDescription className="text-yellow-400/80">
            You need an active Odoo connection to sync RBAC data. Go to ETL Platform → Connections to set one up.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-[#1e1e1e] border-[#333]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats?.users_synced || 0}</p>
            {stats?.last_sync && (
              <p className="text-xs text-gray-500 mt-1">
                Last sync: {new Date(stats.last_sync).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#1e1e1e] border-[#333]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Groups Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats?.groups_synced || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1e1e1e] border-[#333]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Teams Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats?.teams_synced || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1e1e1e] border-[#333]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-yellow-500" />
              Local Overrides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-400">{overrides.filter(o => o.is_active).length}</p>
            <p className="text-xs text-gray-500 mt-1">
              {overrides.length} total ({overrides.filter(o => !o.is_active).length} inactive)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1e1e1e] border-[#333]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Access Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats?.access_level_distribution && Object.entries(stats.access_level_distribution).map(([level, count]) => (
                count > 0 && (
                  <span key={level} className="text-xs">
                    {getAccessLevelBadge(level)} <span className="text-gray-400">{count}</span>
                  </span>
                )
              ))}
              {(!stats?.access_level_distribution || Object.values(stats.access_level_distribution).every(v => v === 0)) && (
                <span className="text-gray-500 text-sm">No users synced yet</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-[#2a2a2a] border-[#444]">
          <TabsTrigger value="users" className="data-[state=active]:bg-[#800000]">
            <Users className="h-4 w-4 mr-2" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="overrides" className="data-[state=active]:bg-[#800000]">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Overrides ({overrides.filter(o => o.is_active).length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="data-[state=active]:bg-[#800000]">
            <Shield className="h-4 w-4 mr-2" />
            Groups ({groups.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="data-[state=active]:bg-[#800000]">
            <Building2 className="h-4 w-4 mr-2" />
            Teams ({teams.length})
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-[#800000]">
            <Filter className="h-4 w-4 mr-2" />
            Test Filter
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="bg-[#1e1e1e] border-[#333]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Synced Users</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-[#2a2a2a] border-[#444] text-white"
                    data-testid="search-users-input"
                  />
                </div>
              </div>
              <CardDescription>
                Users synced from Odoo with their access levels. Add local overrides to grant temporary access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#333] hover:bg-transparent">
                      <TableHead className="text-gray-400">Name</TableHead>
                      <TableHead className="text-gray-400">Login</TableHead>
                      <TableHead className="text-gray-400">Access Level</TableHead>
                      <TableHead className="text-gray-400">Teams</TableHead>
                      <TableHead className="text-gray-400">Synced At</TableHead>
                      <TableHead className="text-gray-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
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
                        return (
                          <TableRow key={user.odoo_user_id || idx} className="border-[#333] hover:bg-[#2a2a2a]">
                            <TableCell className="text-white font-medium">{user.name}</TableCell>
                            <TableCell className="text-gray-400">{user.login}</TableCell>
                            <TableCell>
                              {hasOverride ? (
                                <div className="flex items-center gap-2">
                                  {getAccessLevelBadge(hasOverride.access_level, true)}
                                  <span className="text-xs text-yellow-400">(override)</span>
                                </div>
                              ) : (
                                getAccessLevelBadge(user.access_level)
                              )}
                            </TableCell>
                            <TableCell className="text-gray-400">
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
                                className="text-gray-400 hover:text-white"
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
          <Card className="bg-[#1e1e1e] border-[#333]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-yellow-500" />
                    Local Permission Overrides
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Override Odoo-synced permissions locally. Useful for temporary access or testing.
                  </CardDescription>
                </div>
                <Dialog open={showAddOverride} onOpenChange={setShowAddOverride}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#800000] hover:bg-[#990000]" data-testid="add-override-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Override
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1e1e1e] border-[#333] text-white">
                    <DialogHeader>
                      <DialogTitle>Create Permission Override</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Grant or restrict access for a specific user, bypassing their Odoo permissions.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>User Email</Label>
                        <Input
                          placeholder="user@example.com"
                          value={overrideForm.user_email}
                          onChange={(e) => setOverrideForm({...overrideForm, user_email: e.target.value})}
                          className="bg-[#2a2a2a] border-[#444]"
                          data-testid="override-user-email-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Access Level</Label>
                        <Select
                          value={overrideForm.access_level}
                          onValueChange={(val) => setOverrideForm({...overrideForm, access_level: val})}
                        >
                          <SelectTrigger className="bg-[#2a2a2a] border-[#444]" data-testid="override-access-level-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#2a2a2a] border-[#444]">
                            <SelectItem value="ADMIN">ADMIN - Full access to all data</SelectItem>
                            <SelectItem value="MANAGER">MANAGER - Access to team data</SelectItem>
                            <SelectItem value="USER">USER - Own records only</SelectItem>
                            <SelectItem value="RESTRICTED">RESTRICTED - No data access</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Reason (optional)</Label>
                        <Textarea
                          placeholder="Why is this override needed?"
                          value={overrideForm.reason}
                          onChange={(e) => setOverrideForm({...overrideForm, reason: e.target.value})}
                          className="bg-[#2a2a2a] border-[#444]"
                          data-testid="override-reason-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expires At (optional)</Label>
                        <Input
                          type="date"
                          value={overrideForm.expires_at}
                          onChange={(e) => setOverrideForm({...overrideForm, expires_at: e.target.value})}
                          className="bg-[#2a2a2a] border-[#444]"
                          data-testid="override-expires-input"
                        />
                        <p className="text-xs text-gray-500">Leave empty for no expiration</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddOverride(false)} className="border-[#444]">
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateOverride} 
                        disabled={savingOverride}
                        className="bg-[#800000] hover:bg-[#990000]"
                        data-testid="save-override-button"
                      >
                        {savingOverride ? 'Creating...' : 'Create Override'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={!!editingOverride} onOpenChange={() => setEditingOverride(null)}>
                  <DialogContent className="bg-[#1e1e1e] border-[#333] text-white">
                    <DialogHeader>
                      <DialogTitle>Edit Permission Override</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Modify the override for {editingOverride?.user_email}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Access Level</Label>
                        <Select
                          value={overrideForm.access_level}
                          onValueChange={(val) => setOverrideForm({...overrideForm, access_level: val})}
                        >
                          <SelectTrigger className="bg-[#2a2a2a] border-[#444]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#2a2a2a] border-[#444]">
                            <SelectItem value="ADMIN">ADMIN - Full access to all data</SelectItem>
                            <SelectItem value="MANAGER">MANAGER - Access to team data</SelectItem>
                            <SelectItem value="USER">USER - Own records only</SelectItem>
                            <SelectItem value="RESTRICTED">RESTRICTED - No data access</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Textarea
                          value={overrideForm.reason}
                          onChange={(e) => setOverrideForm({...overrideForm, reason: e.target.value})}
                          className="bg-[#2a2a2a] border-[#444]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expires At</Label>
                        <Input
                          type="date"
                          value={overrideForm.expires_at}
                          onChange={(e) => setOverrideForm({...overrideForm, expires_at: e.target.value})}
                          className="bg-[#2a2a2a] border-[#444]"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditingOverride(null)} className="border-[#444]">
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleUpdateOverride} 
                        disabled={savingOverride}
                        className="bg-[#800000] hover:bg-[#990000]"
                      >
                        {savingOverride ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#333] hover:bg-transparent">
                      <TableHead className="text-gray-400">User</TableHead>
                      <TableHead className="text-gray-400">Access Level</TableHead>
                      <TableHead className="text-gray-400">Reason</TableHead>
                      <TableHead className="text-gray-400">Expires</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Created By</TableHead>
                      <TableHead className="text-gray-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                          No permission overrides configured. Click "Add Override" to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      overrides.map((override, idx) => (
                        <TableRow key={override.id || idx} className="border-[#333] hover:bg-[#2a2a2a]">
                          <TableCell>
                            <div>
                              <p className="text-white font-medium">{override.user_name}</p>
                              <p className="text-gray-500 text-xs">{override.user_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getAccessLevelBadge(override.access_level, true)}</TableCell>
                          <TableCell className="text-gray-400 max-w-[200px] truncate">
                            {override.reason || '-'}
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {override.expires_at ? (
                              <span className={new Date(override.expires_at) < new Date() ? 'text-red-400' : ''}>
                                {new Date(override.expires_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-500">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {override.is_active ? (
                              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
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
                                className="text-gray-400 hover:text-white"
                                title="Edit override"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleOverrideActive(override)}
                                className="text-gray-400 hover:text-white"
                                title={override.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {override.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteOverride(override.id)}
                                className="text-red-400 hover:text-red-300"
                                title="Delete override"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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

        {/* Groups Tab */}
        <TabsContent value="groups">
          <Card className="bg-[#1e1e1e] border-[#333]">
            <CardHeader>
              <CardTitle className="text-white">Synced Groups</CardTitle>
              <CardDescription>
                Odoo security groups that determine access levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#333] hover:bg-transparent">
                      <TableHead className="text-gray-400">Group Name</TableHead>
                      <TableHead className="text-gray-400">Category</TableHead>
                      <TableHead className="text-gray-400">User Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                          No groups synced yet. Click 'Sync from Odoo' to start.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groups.map((group, idx) => (
                        <TableRow key={group.odoo_group_id || idx} className="border-[#333] hover:bg-[#2a2a2a]">
                          <TableCell className="text-white font-medium">
                            {group.full_name || group.name}
                          </TableCell>
                          <TableCell className="text-gray-400">{group.category || '-'}</TableCell>
                          <TableCell className="text-gray-400">{group.user_count || 0}</TableCell>
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
          <Card className="bg-[#1e1e1e] border-[#333]">
            <CardHeader>
              <CardTitle className="text-white">Synced Teams</CardTitle>
              <CardDescription>
                Sales teams from Odoo - managers can see their team's data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#333] hover:bg-transparent">
                      <TableHead className="text-gray-400">Team Name</TableHead>
                      <TableHead className="text-gray-400">Leader</TableHead>
                      <TableHead className="text-gray-400">Members</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                          No teams synced yet. Click 'Sync from Odoo' to start.
                        </TableCell>
                      </TableRow>
                    ) : (
                      teams.map((team, idx) => (
                        <TableRow key={team.odoo_team_id || idx} className="border-[#333] hover:bg-[#2a2a2a]">
                          <TableCell className="text-white font-medium">{team.name}</TableCell>
                          <TableCell className="text-gray-400">{team.leader_name || '-'}</TableCell>
                          <TableCell className="text-gray-400">{team.member_count || 0}</TableCell>
                          <TableCell>
                            {team.active ? (
                              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
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
          <Card className="bg-[#1e1e1e] border-[#333]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Test RBAC Filter
              </CardTitle>
              <CardDescription>
                Test what data filter will be applied for a specific user (includes local overrides)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter user name (e.g., Nabisaheb)"
                  value={testUser}
                  onChange={(e) => setTestUser(e.target.value)}
                  className="flex-1 bg-[#2a2a2a] border-[#444] text-white"
                  data-testid="test-user-input"
                />
                <Button 
                  onClick={handleTestFilter}
                  className="bg-[#800000] hover:bg-[#990000]"
                  data-testid="test-filter-button"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Test Filter
                </Button>
              </div>

              {testResult && (
                <div className="bg-[#2a2a2a] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">User:</span>
                    <span className="text-white font-medium">{testResult.user_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Access Level:</span>
                    {getAccessLevelBadge(testResult.access_level)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Filter Type:</span>
                    <Badge variant="outline" className="bg-[#333] text-white border-[#444]">
                      {testResult.filter_type?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {testResult.groups?.length > 0 && (
                    <div>
                      <span className="text-gray-400 text-sm">Groups:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {testResult.groups.slice(0, 5).map((g, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-[#333] text-gray-300 border-[#444]">
                            {g}
                          </Badge>
                        ))}
                        {testResult.groups.length > 5 && (
                          <Badge variant="outline" className="text-xs bg-[#333] text-gray-300 border-[#444]">
                            +{testResult.groups.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {testResult.teams?.length > 0 && (
                    <div>
                      <span className="text-gray-400 text-sm">Teams:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {testResult.teams.map((t, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#444]">
                    <span className="text-gray-400 text-sm">MongoDB Filter Applied:</span>
                    <pre className="mt-1 bg-[#1a1a1a] p-2 rounded text-xs text-green-400 overflow-x-auto">
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
