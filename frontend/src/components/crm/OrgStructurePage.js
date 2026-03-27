import React, { useState, useEffect } from 'react';
import { targetAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Building2, Users, ChevronRight, ChevronDown, Search, Archive, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';

function OrgNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <>
      <div className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 ${!node.active ? 'opacity-50' : ''}`} style={{ paddingLeft: `${depth * 24 + 8}px` }}>
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 rounded hover:bg-gray-200">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          </button>
        ) : <span className="w-5" />}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${depth === 0 ? 'bg-[#800000] text-white' : depth === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
          {node.name?.charAt(0) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{node.name}</p>
          <p className="text-[10px] text-gray-400">{node.job_title || 'Employee'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {node.department && <span className="text-[10px] text-gray-400 hidden md:inline">{node.department.split('/').pop().trim()}</span>}
          {!node.active && <Badge variant="outline" className="text-[10px] text-red-500 border-red-200">Inactive</Badge>}
          {hasChildren && <Badge variant="secondary" className="text-[10px]">{node.children.length}</Badge>}
        </div>
      </div>
      {expanded && hasChildren && node.children.map(child => (
        <OrgNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default function OrgStructurePage() {
  const [tree, setTree] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tree');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [treeR, deptR, empR] = await Promise.allSettled([
          targetAPI.getOrgTree(), targetAPI.getDepartments(), targetAPI.getEmployees()
        ]);
        if (treeR.status === 'fulfilled') setTree(treeR.value.data);
        if (deptR.status === 'fulfilled') setDepartments(deptR.value.data);
        if (empR.status === 'fulfilled') setEmployees(empR.value.data);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const handleArchive = async (empId, name) => {
    try {
      const res = await targetAPI.toggleArchiveEmployee(empId);
      toast.success(`${name}: ${res.data.active ? 'Activated' : 'Archived'}`);
      const empR = await targetAPI.getEmployees();
      setEmployees(empR.data);
      const treeR = await targetAPI.getOrgTree();
      setTree(treeR.data);
    } catch { toast.error('Failed'); }
  };

  const filteredEmps = employees.filter(e => {
    if (!showInactive && !e.active) return false;
    if (search && !e.name?.toLowerCase().includes(search.toLowerCase()) && !e.department_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalActive = employees.filter(e => e.active).length;
  const totalInactive = employees.filter(e => !e.active).length;

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96" /></div>;

  return (
    <div className="space-y-5" data-testid="org-structure-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 className="h-6 w-6 text-[#800000]" /> Organization Structure</h1>
          <p className="text-gray-500 text-sm">Company hierarchy synced from Odoo ({totalActive} active, {totalInactive} inactive)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-8 h-8 w-48 text-sm" />
          </div>
          <Button variant={showInactive ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setShowInactive(!showInactive)}>
            {showInactive ? <UserX className="h-3.5 w-3.5 mr-1" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
            {showInactive ? 'Showing Inactive' : 'Active Only'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total Employees</p><p className="text-2xl font-bold">{employees.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Active</p><p className="text-2xl font-bold text-emerald-600">{totalActive}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Inactive/Resigned</p><p className="text-2xl font-bold text-red-600">{totalInactive}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Departments</p><p className="text-2xl font-bold">{departments.length}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tree">Org Tree</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="employees">All Employees</TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-[#800000]" /> Company Hierarchy</CardTitle></CardHeader>
            <CardContent className="p-2">
              {tree.filter(n => showInactive || n.active).map(node => <OrgNode key={node.id} node={node} />)}
              {tree.length === 0 && <p className="text-gray-400 text-center py-8">No employee data synced from Odoo</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="mt-4 space-y-3">
          {departments.map(dept => (
            <Card key={dept.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#800000]" />
                  {dept.name.split('/').pop().trim()}
                  <Badge variant="secondary" className="text-xs">{dept.active} active</Badge>
                  {dept.inactive > 0 && <Badge variant="outline" className="text-xs text-red-500 border-red-200">{dept.inactive} inactive</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {dept.members.filter(m => showInactive || m.active).map((m, i) => (
                      <TableRow key={i} className={!m.active ? 'opacity-50' : ''}>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${m.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{m.name?.charAt(0)}</div>
                            <span className="text-sm font-medium">{m.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 py-1.5">{m.job_title || '-'}</TableCell>
                        <TableCell className="py-1.5">{!m.active && <Badge variant="outline" className="text-[10px] text-red-500 border-red-200">Inactive</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="employees" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>App Account</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmps.map(e => (
                    <TableRow key={e.source_record_id || e.canonical_id} className={!e.active ? 'opacity-50 bg-red-50/30' : ''}>
                      <TableCell className="font-medium text-sm">{e.name}</TableCell>
                      <TableCell className="text-sm text-gray-500">{e.job_title || '-'}</TableCell>
                      <TableCell className="text-xs text-gray-400">{e.department_name?.split('/').pop().trim() || '-'}</TableCell>
                      <TableCell className="text-xs text-gray-400">{e.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={e.active ? 'default' : 'secondary'} className={`text-[10px] ${e.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {e.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {e.has_app_account ? <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200">Yes</Badge> : <span className="text-gray-300 text-xs">No</span>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className={`h-7 text-xs ${e.active ? 'text-red-500 hover:text-red-700' : 'text-emerald-500 hover:text-emerald-700'}`}
                          onClick={() => handleArchive(e.source_record_id, e.name)}>
                          <Archive className="h-3 w-3 mr-0.5" /> {e.active ? 'Archive' : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
