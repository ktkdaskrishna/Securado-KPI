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
  Filter
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, groupsRes, teamsRes, connectionsRes] = await Promise.all([
        rbacSyncAPI.getStats(),
        rbacSyncAPI.listUsers(),
        rbacSyncAPI.listGroups(),
        rbacSyncAPI.listTeams(),
        etlAPI.listConnections()
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data.users || []);
      setGroups(groupsRes.data.groups || []);
      setTeams(teamsRes.data.teams || []);
      
      // Filter to only Odoo connections
      const odooConnections = (connectionsRes.data || []).filter(c => c.type === 'odoo' && c.status === 'active');
      setConnections(odooConnections);
      if (odooConnections.length > 0 && !selectedConnection) {
        setSelectedConnection(odooConnections[0].connection_id);
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
        await fetchData(); // Refresh data
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

  const getAccessLevelBadge = (level) => {
    const colors = {
      'ADMIN': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'MANAGER': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'USER': 'bg-green-500/20 text-green-400 border-green-500/30',
      'RESTRICTED': 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return (
      <Badge variant="outline" className={colors[level] || colors['RESTRICTED']}>
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
                <option key={conn.connection_id} value={conn.connection_id}>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      {/* Grace Period Info */}
      {stats?.users_synced === 0 && (
        <Alert className="bg-blue-500/10 border-blue-500/30">
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-500">Grace Period Active</AlertTitle>
          <AlertDescription className="text-blue-400/80">
            RBAC has not been synced yet. All users currently have full access to all data. 
            Once you sync from Odoo, users will only see data based on their permissions.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-[#2a2a2a] border-[#444]">
          <TabsTrigger value="users" className="data-[state=active]:bg-[#800000]">
            <Users className="h-4 w-4 mr-2" />
            Users ({users.length})
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
                Users synced from Odoo with their access levels
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                          {users.length === 0 
                            ? "No users synced yet. Click 'Sync from Odoo' to start."
                            : "No users match your search."
                          }
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user, idx) => (
                        <TableRow key={user.odoo_user_id || idx} className="border-[#333] hover:bg-[#2a2a2a]">
                          <TableCell className="text-white font-medium">{user.name}</TableCell>
                          <TableCell className="text-gray-400">{user.login}</TableCell>
                          <TableCell>{getAccessLevelBadge(user.access_level)}</TableCell>
                          <TableCell className="text-gray-400">
                            {user.teams?.length > 0 ? user.teams.join(', ') : '-'}
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {user.synced_at ? new Date(user.synced_at).toLocaleString() : '-'}
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
                Test what data filter will be applied for a specific user
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
