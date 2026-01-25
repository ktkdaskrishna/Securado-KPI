import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { Checkbox } from '../components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { toast } from 'sonner';
import {
  Shield, Plus, Settings, Trash2, Edit, Check, Lock, Users, Database, Play, FileCode, BarChart3
} from 'lucide-react';
import { adminAPI } from '../lib/api';

const CATEGORY_ICONS = {
  user_management: Users,
  role_management: Shield,
  connection_management: Database,
  pipeline_management: Play,
  schema_management: FileCode,
  system_settings: Settings,
  reports: BarChart3,
};

const CATEGORY_LABELS = {
  user_management: 'User Management',
  role_management: 'Role Management',
  connection_management: 'Connection Management',
  pipeline_management: 'Pipeline Management',
  schema_management: 'Schema Management',
  system_settings: 'System Settings',
  reports: 'Reports',
};

const RoleManagementPage = () => {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newRole, setNewRole] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: []
  });
  const [editRole, setEditRole] = useState(null);

  // Fetch roles
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await adminAPI.listRoles();
      return res.data;
    },
  });

  // Fetch permissions
  const { data: permissionsData } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const res = await adminAPI.listPermissions();
      return res.data;
    },
  });

  // Create role mutation
  const createRole = useMutation({
    mutationFn: async (data) => {
      const res = await adminAPI.createRole(data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Role created successfully');
      setShowCreateDialog(false);
      setNewRole({ name: '', display_name: '', description: '', permissions: [] });
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (error) => {
      toast.error('Failed to create role: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await adminAPI.updateRole(id, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Role updated successfully');
      setShowEditDialog(false);
      setEditRole(null);
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (error) => {
      toast.error('Failed to update role: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Delete role mutation
  const deleteRole = useMutation({
    mutationFn: async (id) => {
      const res = await adminAPI.deleteRole(id);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Role deleted successfully');
      setShowDeleteDialog(false);
      setSelectedRole(null);
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (error) => {
      toast.error('Failed to delete role: ' + (error.response?.data?.detail || error.message));
    },
  });

  const roles = rolesData?.roles || [];
  const permissionsByCategory = permissionsData?.by_category || {};

  const togglePermission = (permId, roleData, setRoleData) => {
    const current = roleData.permissions || [];
    if (current.includes(permId)) {
      setRoleData({ ...roleData, permissions: current.filter(p => p !== permId) });
    } else {
      setRoleData({ ...roleData, permissions: [...current, permId] });
    }
  };

  const toggleCategoryPermissions = (category, roleData, setRoleData) => {
    const categoryPerms = permissionsByCategory[category]?.map(p => p.id) || [];
    const current = roleData.permissions || [];
    const allSelected = categoryPerms.every(p => current.includes(p));
    
    if (allSelected) {
      // Remove all category permissions
      setRoleData({ ...roleData, permissions: current.filter(p => !categoryPerms.includes(p)) });
    } else {
      // Add all category permissions
      const newPerms = [...new Set([...current, ...categoryPerms])];
      setRoleData({ ...roleData, permissions: newPerms });
    }
  };

  const openEditDialog = (role) => {
    setEditRole({
      id: role.id,
      display_name: role.display_name,
      description: role.description || '',
      permissions: role.permissions || []
    });
    setShowEditDialog(true);
  };

  const handleCreateRole = () => {
    if (!newRole.name || !newRole.display_name) {
      toast.error('Name and display name are required');
      return;
    }
    createRole.mutate(newRole);
  };

  const handleUpdateRole = () => {
    if (!editRole.display_name) {
      toast.error('Display name is required');
      return;
    }
    updateRole.mutate({
      id: editRole.id,
      data: {
        display_name: editRole.display_name,
        description: editRole.description,
        permissions: editRole.permissions
      }
    });
  };

  const PermissionSelector = ({ roleData, setRoleData, disabled = false }) => (
    <Accordion type="multiple" className="w-full">
      {Object.entries(permissionsByCategory).map(([category, perms]) => {
        const Icon = CATEGORY_ICONS[category] || Shield;
        const categoryPerms = perms.map(p => p.id);
        const selectedCount = categoryPerms.filter(p => roleData.permissions?.includes(p)).length;
        const allSelected = selectedCount === categoryPerms.length;
        
        return (
          <AccordionItem key={category} value={category}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{CATEGORY_LABELS[category] || category}</span>
                <Badge variant="secondary" className="ml-2">
                  {selectedCount}/{categoryPerms.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => toggleCategoryPermissions(category, roleData, setRoleData)}
                    disabled={disabled}
                  />
                  Select All
                </label>
                <div className="space-y-2 ml-4">
                  {perms.map((perm) => (
                    <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={roleData.permissions?.includes(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id, roleData, setRoleData)}
                        disabled={disabled}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm">{perm.name}</span>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );

  return (
    <div className="space-y-6" data-testid="role-management-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Role Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure role templates and permissions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2" data-testid="create-role-btn">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rolesLoading ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))
        ) : roles.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No roles configured</p>
              <Button variant="link" onClick={() => setShowCreateDialog(true)}>Create your first role</Button>
            </CardContent>
          </Card>
        ) : (
          roles.map((role) => (
            <Card
              key={role.id}
              className={`border-border/60 cursor-pointer transition-all hover:shadow-md ${
                selectedRole?.id === role.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedRole(role)}
              data-testid={`role-card-${role.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {role.is_system ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Shield className="h-4 w-4 text-primary" />
                    )}
                    <CardTitle className="text-base">{role.display_name}</CardTitle>
                  </div>
                  {role.is_system && (
                    <Badge variant="outline" className="text-xs">System</Badge>
                  )}
                </div>
                <CardDescription className="text-xs">{role.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {role.permissions?.length || 0} permissions
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); openEditDialog(role); }}
                      data-testid={`edit-role-${role.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!role.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => { e.stopPropagation(); setSelectedRole(role); setShowDeleteDialog(true); }}
                        data-testid={`delete-role-${role.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Selected Role Details */}
      {selectedRole && (
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {selectedRole.is_system ? <Lock className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                  {selectedRole.display_name}
                </CardTitle>
                <CardDescription>{selectedRole.description}</CardDescription>
              </div>
              <Button variant="outline" onClick={() => openEditDialog(selectedRole)}>
                <Edit className="h-4 w-4 mr-2" /> Edit Permissions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <h4 className="font-medium mb-3">Permissions ({selectedRole.permissions?.length || 0})</h4>
            <div className="flex flex-wrap gap-2">
              {selectedRole.permissions?.map((permId) => {
                const perm = permissionsData?.permissions?.find(p => p.id === permId);
                return (
                  <Badge key={permId} variant="secondary" className="text-xs">
                    {perm?.name || permId}
                  </Badge>
                );
              })}
              {!selectedRole.permissions?.length && (
                <span className="text-muted-foreground text-sm">No permissions assigned</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Role Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>Define a custom role with specific permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name (ID) *</Label>
                <Input
                  id="role-name"
                  placeholder="e.g., data_analyst"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  data-testid="new-role-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-display">Display Name *</Label>
                <Input
                  id="role-display"
                  placeholder="e.g., Data Analyst"
                  value={newRole.display_name}
                  onChange={(e) => setNewRole({ ...newRole, display_name: e.target.value })}
                  data-testid="new-role-display"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                placeholder="Describe the role's purpose..."
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                <PermissionSelector roleData={newRole} setRoleData={setNewRole} />
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRole} disabled={createRole.isPending} data-testid="save-role-btn">
              {createRole.isPending ? 'Creating...' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Modify role permissions</DialogDescription>
          </DialogHeader>
          {editRole && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-display">Display Name *</Label>
                <Input
                  id="edit-display"
                  value={editRole.display_name}
                  onChange={(e) => setEditRole({ ...editRole, display_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={editRole.description}
                  onChange={(e) => setEditRole({ ...editRole, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <ScrollArea className="h-[300px] border rounded-md p-2">
                  <PermissionSelector roleData={editRole} setRoleData={setEditRole} />
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateRole} disabled={updateRole.isPending}>
              {updateRole.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedRole?.display_name}"? 
              This will remove the role from all users who have it assigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRole.mutate(selectedRole?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRole.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoleManagementPage;
