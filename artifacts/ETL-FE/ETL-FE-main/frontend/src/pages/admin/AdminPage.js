import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DataTable, StatusBadge, ModalForm, MetricCard, EmptyState } from '../../components/common';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner';
import {
  Shield,
  Users,
  Key,
  Lock,
  Building,
  Settings,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  UserPlus,
  Clock,
} from 'lucide-react';

const roleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

const departmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

// Users Tab
const UsersTab = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/users');
      return response.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.post(`/admin/users/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('User approved');
    },
    onError: () => {
      toast.error('Failed to approve user');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.post(`/admin/users/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('User rejected');
    },
    onError: () => {
      toast.error('Failed to reject user');
    },
  });

  const filteredUsers = (users || []).filter((user) => {
    const matchesSearch = !search ||
      user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = (users || []).filter((u) => u.status === 'pending').length;

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (status) => {
        // Handle both 'approved' and 'active' statuses
        const displayStatus = status === 'approved' ? 'active' : status;
        return <StatusBadge status={displayStatus}>{displayStatus}</StatusBadge>;
      },
    },
    { 
      key: 'roles', 
      label: 'Role', 
      sortable: true,
      render: (roles, row) => {
        // Handle both array of roles and single role_name
        if (Array.isArray(roles) && roles.length > 0) {
          return roles.join(', ');
        }
        return row.role_name || '-';
      }
    },
    { key: 'department_name', label: 'Department', sortable: true },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.status === 'pending' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-[hsl(var(--chart-2))]"
                onClick={(e) => {
                  e.stopPropagation();
                  approveMutation.mutate(row.id);
                }}
                data-testid={`approve-user-${row.id}`}
              >
                <CheckCircle2 size={14} className="mr-1" />
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  rejectMutation.mutate(row.id);
                }}
                data-testid={`reject-user-${row.id}`}
              >
                <XCircle size={14} className="mr-1" />
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <Card className="bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))]/20">
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-[hsl(var(--accent))]" />
            <span className="font-medium">
              {pendingCount} user{pendingCount > 1 ? 's' : ''} pending approval
            </span>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 w-64"
            data-testid="user-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="user-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={tableColumns}
        data={filteredUsers}
        loading={isLoading}
        emptyTitle="No users"
        emptyDescription="No users found."
        emptyIcon={Users}
      />
    </div>
  );
};

// Roles Tab
const RolesTab = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: roles, isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/roles');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      await apiClient.post('/admin/roles', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-roles']);
      toast.success('Role created');
      setCreateOpen(false);
    },
    onError: () => {
      toast.error('Failed to create role');
    },
  });

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    {
      key: 'users_count',
      label: 'Users',
      sortable: true,
      render: (value) => value || 0,
    },
    {
      key: 'permissions_count',
      label: 'Permissions',
      sortable: true,
      render: (value) => value || 0,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} data-testid="create-role-button">
          <UserPlus className="mr-2 h-4 w-4" />
          New Role
        </Button>
      </div>

      <DataTable
        columns={tableColumns}
        data={roles || []}
        loading={isLoading}
        emptyTitle="No roles"
        emptyDescription="Create your first role."
        emptyIcon={Key}
      />

      <ModalForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Role"
        fields={[
          { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter role name' },
          { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description' },
        ]}
        schema={roleSchema}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        submitLabel="Create"
      />
    </div>
  );
};

// Permissions Tab
const PermissionsTab = () => {
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/permissions');
      return response.data;
    },
  });

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'resource', label: 'Resource', sortable: true },
    { key: 'action', label: 'Action', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
  ];

  return (
    <DataTable
      columns={tableColumns}
      data={permissions || []}
      loading={isLoading}
      searchable
      searchPlaceholder="Search permissions..."
      emptyTitle="No permissions"
      emptyDescription="No permissions configured."
      emptyIcon={Lock}
    />
  );
};

// Departments Tab
const DepartmentsTab = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: departments, isLoading } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/departments');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      await apiClient.post('/admin/departments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-departments']);
      toast.success('Department created');
      setCreateOpen(false);
    },
    onError: () => {
      toast.error('Failed to create department');
    },
  });

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    {
      key: 'users_count',
      label: 'Users',
      sortable: true,
      render: (value) => value || 0,
    },
    { key: 'manager_name', label: 'Manager', sortable: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} data-testid="create-department-button">
          <Building className="mr-2 h-4 w-4" />
          New Department
        </Button>
      </div>

      <DataTable
        columns={tableColumns}
        data={departments || []}
        loading={isLoading}
        emptyTitle="No departments"
        emptyDescription="Create your first department."
        emptyIcon={Building}
      />

      <ModalForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Department"
        fields={[
          { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter department name' },
          { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description' },
        ]}
        schema={departmentSchema}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        submitLabel="Create"
      />
    </div>
  );
};

// System Config Tab
const SystemConfigTab = () => {
  const { data: config, isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      const response = await apiClient.get('/config');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6 h-24 animate-pulse bg-muted rounded"></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const configItems = config ? Object.entries(config).filter(([key]) => !key.startsWith('_')) : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {configItems.length > 0 ? (
        configItems.map(([key, value]) => (
          <Card key={key}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground uppercase mb-1">{key}</div>
              <div className="font-medium">
                {typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : String(value)}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card className="col-span-2">
          <CardContent className="pt-6 text-center text-muted-foreground">
            No configuration available
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Admin Logs Tab
const AdminLogsTab = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/logs');
      return response.data;
    },
  });

  const tableColumns = [
    {
      key: 'timestamp',
      label: 'Time',
      sortable: true,
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    { key: 'action', label: 'Action', sortable: true },
    { key: 'user_name', label: 'User', sortable: true },
    { key: 'resource', label: 'Resource', sortable: true },
    { key: 'details', label: 'Details', sortable: false },
  ];

  return (
    <DataTable
      columns={tableColumns}
      data={logs || []}
      loading={isLoading}
      searchable
      searchPlaceholder="Search logs..."
      emptyTitle="No logs"
      emptyDescription="No admin logs available."
      emptyIcon={FileText}
    />
  );
};

// Main Admin Page
const AdminPage = () => {
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/users');
      return response.data;
    },
  });

  const pendingCount = (users || []).filter((u) => u.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage users, roles, and system settings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Users"
          value={users?.length || 0}
          icon={Users}
        />
        <MetricCard
          label="Pending Approval"
          value={pendingCount}
          icon={Clock}
        />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users" data-testid="admin-users-tab">
            <Users size={16} className="mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" data-testid="admin-roles-tab">
            <Key size={16} className="mr-2" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="permissions" data-testid="admin-permissions-tab">
            <Lock size={16} className="mr-2" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="departments" data-testid="admin-departments-tab">
            <Building size={16} className="mr-2" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="admin-config-tab">
            <Settings size={16} className="mr-2" />
            System Config
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="admin-logs-tab">
            <FileText size={16} className="mr-2" />
            Admin Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesTab />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <PermissionsTab />
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <DepartmentsTab />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <SystemConfigTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <AdminLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
