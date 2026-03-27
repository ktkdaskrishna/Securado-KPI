import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Plus, Shield, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

export function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        adminAPI.listRoles(),
        adminAPI.listPermissions(),
      ]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (editingRole) {
        await adminAPI.updateRole(editingRole.id, formData);
        toast.success('Role updated');
      } else {
        await adminAPI.createRole(formData);
        toast.success('Role created');
      }
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save role');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      await adminAPI.deleteRole(id);
      toast.success('Role deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete role');
    }
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || [],
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', permissions: [] });
  };

  const togglePermission = (permName) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permName)
        ? prev.permissions.filter(p => p !== permName)
        : [...prev.permissions, permName]
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Group permissions by resource
  const permissionGroups = permissions.reduce((acc, perm) => {
    const resource = perm.resource || 'other';
    if (!acc[resource]) acc[resource] = [];
    acc[resource].push(perm);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
          <p className="text-gray-500">Manage roles and permissions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Sales Manager"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Manages sales team"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="border rounded-lg p-4 space-y-4 max-h-[40vh] overflow-y-auto">
                  {Object.entries(permissionGroups).map(([resource, perms]) => (
                    <div key={resource}>
                      <h4 className="font-medium text-sm text-gray-700 capitalize mb-2">{resource}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {perms.map((perm) => (
                          <div key={perm.name} className="flex items-center space-x-2">
                            <Checkbox
                              id={perm.name}
                              checked={formData.permissions.includes(perm.name)}
                              onCheckedChange={() => togglePermission(perm.name)}
                              data-testid={`rbac-permission-cell-${perm.name}`}
                            />
                            <label
                              htmlFor={perm.name}
                              className="text-sm text-gray-600 cursor-pointer"
                            >
                              {perm.description || perm.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="border-t pt-3 mt-2 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleCreate} className="bg-[#800000] hover:bg-[#9a1919] text-white">{editingRole ? 'Update Role' : 'Create Role'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Users</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No roles found
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id} data-testid={`rbac-role-row-${role.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-cyan-500" />
                      {role.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {role.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {role.permissions?.length || 0} permissions
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {role.users_count || 0} users
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(role)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(role.id)}
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
