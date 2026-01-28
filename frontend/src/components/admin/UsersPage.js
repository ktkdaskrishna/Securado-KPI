import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Users, CheckCircle, XCircle, Clock, Trash2, UserCheck, UserX, Shield, Settings, UserPlus, Mail, Key, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-gray-100 text-gray-700',
  invited: 'bg-blue-100 text-blue-700',
};

const statusIcons = {
  pending: <Clock className="h-4 w-4" />,
  approved: <CheckCircle className="h-4 w-4" />,
  rejected: <XCircle className="h-4 w-4" />,
  invited: <Mail className="h-4 w-4" />,
};

export function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    roles: [],
    send_email: false,
    temp_password: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        adminAPI.listUsers(),
        adminAPI.listRoles()
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await adminAPI.approveUser(id);
      toast.success('User approved');
      loadData();
    } catch (error) {
      toast.error('Failed to approve user');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Rejection reason (optional):');
    try {
      await adminAPI.rejectUser(id, reason);
      toast.success('User rejected');
      loadData();
    } catch (error) {
      toast.error('Failed to reject user');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminAPI.deleteUser(id);
      toast.success('User deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const openRoleDialog = (user) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles || []);
    setRoleDialogOpen(true);
  };

  const toggleRole = (roleId) => {
    setSelectedRoles(prev => 
      prev.includes(roleId)
        ? prev.filter(r => r !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSaveRoles = async () => {
    try {
      await adminAPI.updateUserRoles(selectedUser.id, selectedRoles);
      toast.success('User roles updated');
      setRoleDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error('Failed to update roles');
    }
  };

  const filteredUsers = statusFilter === 'all' 
    ? users 
    : users.filter(u => u.status === statusFilter);

  const pendingCount = users.filter(u => u.status === 'pending').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500">Manage user accounts, approvals, and roles</p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-amber-100 text-amber-700" data-testid="users-pending-pill">
            {pendingCount} pending approval
          </Badge>
        )}
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All Users ({users.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({users.filter(u => u.status === 'approved').length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({users.filter(u => u.status === 'rejected').length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Role Assignment Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Roles</DialogTitle>
            <DialogDescription>
              {selectedUser && `Select roles for ${selectedUser.name || selectedUser.email}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              {roles.map((role) => (
                <div 
                  key={role.id} 
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedRoles.includes(role.id) ? 'border-cyan-500 bg-cyan-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleRole(role.id)}
                >
                  <Checkbox 
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                    data-testid={`user-role-checkbox-${role.id}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-cyan-500" />
                      <span className="font-medium text-sm">{role.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {role.permissions?.length || 0} permissions
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoles} data-testid="save-user-roles-button">Save Roles</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-sm font-medium">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                      {user.name}
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusIcons[user.status]}
                      <Badge className={statusColors[user.status]}>
                        {user.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.roles?.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {user.roles.map((roleId, i) => {
                          const role = roles.find(r => r.id === roleId);
                          return (
                            <Badge key={i} variant="outline" className="text-xs">
                              {role?.name || roleId}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-gray-400">No roles</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.status === 'approved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRoleDialog(user)}
                          data-testid={`users-manage-roles-button-${user.id}`}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Roles
                        </Button>
                      )}
                      {user.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(user.id)}
                            className="text-emerald-600"
                            data-testid="users-approve-button"
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(user.id)}
                            className="text-red-600"
                            data-testid="users-reject-button"
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
