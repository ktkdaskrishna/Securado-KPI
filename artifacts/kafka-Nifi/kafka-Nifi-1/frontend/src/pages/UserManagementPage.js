import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Users, Plus, Search, MoreHorizontal, Edit, Trash2, Shield, ShieldCheck, UserCog, Key, Mail
} from 'lucide-react';
import { adminAPI } from '../lib/api';

const UserManagementPage = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRolesDialog, setShowRolesDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role_ids: [],
    is_active: true
  });
  const [editUser, setEditUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await adminAPI.listUsers();
      return res.data;
    },
  });

  // Fetch roles for assignment
  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await adminAPI.listRoles();
      return res.data;
    },
  });

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (data) => {
      const res = await adminAPI.createUser(data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('User created successfully');
      setShowCreateDialog(false);
      setNewUser({ name: '', email: '', password: '', role_ids: [], is_active: true });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error('Failed to create user: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Update user mutation
  const updateUser = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await adminAPI.updateUser(id, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('User updated successfully');
      setShowEditDialog(false);
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error('Failed to update user: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Delete user mutation
  const deleteUser = useMutation({
    mutationFn: async (id) => {
      const res = await adminAPI.deleteUser(id);
      return res.data;
    },
    onSuccess: () => {
      toast.success('User deleted successfully');
      setShowDeleteDialog(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error('Failed to delete user: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Assign roles mutation
  const assignRoles = useMutation({
    mutationFn: async ({ userId, roleIds }) => {
      const res = await adminAPI.assignRoles(userId, roleIds);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Roles assigned successfully');
      setShowRolesDialog(false);
      setSelectedUser(null);
      setSelectedRoles([]);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error('Failed to assign roles: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Toggle super admin mutation
  const toggleSuperAdmin = useMutation({
    mutationFn: async (userId) => {
      const res = await adminAPI.toggleSuperAdmin(userId);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Super Admin ${data.is_super_admin ? 'granted' : 'revoked'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error('Failed: ' + (error.response?.data?.detail || error.message));
    },
  });

  const users = usersData?.users || [];
  const roles = rolesData?.roles || [];

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEditDialog = (user) => {
    setEditUser({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      is_active: user.is_active
    });
    setShowEditDialog(true);
  };

  const openRolesDialog = (user) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles?.map(r => r.id) || []);
    setShowRolesDialog(true);
  };

  const toggleRole = (roleId) => {
    setSelectedRoles(prev => 
      prev.includes(roleId) 
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleCreateUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    createUser.mutate(newUser);
  };

  const handleUpdateUser = () => {
    if (!editUser.name || !editUser.email) {
      toast.error('Name and email are required');
      return;
    }
    const updateData = {
      name: editUser.name,
      email: editUser.email,
      is_active: editUser.is_active
    };
    if (editUser.password) {
      updateData.password = editUser.password;
    }
    updateUser.mutate({ id: editUser.id, data: updateData });
  };

  return (
    <div className="space-y-6" data-testid="user-management-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage users and their access to the platform
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2" data-testid="create-user-btn">
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Search */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="user-search"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
          <CardDescription>{filteredUsers.length} users total</CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {user.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {user.name}
                            {user.is_super_admin && (
                              <ShieldCheck className="h-4 w-4 text-amber-500" title="Super Admin" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge key={role.id} variant="secondary" className="text-xs">
                              {role.display_name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">No roles</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`user-menu-${user.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            <Edit className="h-4 w-4 mr-2" /> Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openRolesDialog(user)}>
                            <Shield className="h-4 w-4 mr-2" /> Manage Roles
                          </DropdownMenuItem>
                          {!user.is_super_admin && (
                            <DropdownMenuItem onClick={() => toggleSuperAdmin.mutate(user.id)}>
                              <ShieldCheck className="h-4 w-4 mr-2" /> Make Super Admin
                            </DropdownMenuItem>
                          )}
                          {user.is_super_admin && (
                            <DropdownMenuItem onClick={() => toggleSuperAdmin.mutate(user.id)}>
                              <Shield className="h-4 w-4 mr-2" /> Remove Super Admin
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { setSelectedUser(user); setShowDeleteDialog(true); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Full Name *</Label>
              <Input
                id="new-name"
                placeholder="John Doe"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                data-testid="new-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="john@company.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                data-testid="new-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password *</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                data-testid="new-user-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Assign Roles</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.role_ids.includes(role.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUser({ ...newUser, role_ids: [...newUser.role_ids, role.id] });
                        } else {
                          setNewUser({ ...newUser, role_ids: newUser.role_ids.filter(id => id !== role.id) });
                        }
                      }}
                      className="rounded"
                    />
                    {role.display_name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newUser.is_active}
                onCheckedChange={(checked) => setNewUser({ ...newUser, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={createUser.isPending} data-testid="save-new-user-btn">
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">New Password (leave empty to keep current)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="••••••••"
                  value={editUser.password}
                  onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editUser.is_active}
                  onCheckedChange={(checked) => setEditUser({ ...editUser, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateUser} disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Roles Dialog */}
      <Dialog open={showRolesDialog} onOpenChange={setShowRolesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              Assign roles to {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {roles.map((role) => (
              <label
                key={role.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedRoles.includes(role.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="mt-1 rounded"
                />
                <div>
                  <div className="font-medium">{role.display_name}</div>
                  <div className="text-sm text-muted-foreground">{role.description}</div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRolesDialog(false)}>Cancel</Button>
            <Button
              onClick={() => assignRoles.mutate({ userId: selectedUser?.id, roleIds: selectedRoles })}
              disabled={assignRoles.isPending}
            >
              {assignRoles.isPending ? 'Saving...' : 'Save Roles'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUser.mutate(selectedUser?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUser.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagementPage;
