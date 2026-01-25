import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import {
  Database,
  FolderTree,
  GitBranch,
  Play,
  History,
  Table,
  BarChart3,
  Menu,
  LogOut,
  User,
  ChevronDown,
  Server,
  ArrowLeftRight,
  Webhook,
} from 'lucide-react';
import { Library, FileCode, Users, Shield } from 'lucide-react';

const navItems = [
  { path: '/connections', icon: Database, label: 'Source Connections', section: 'sources' },
  { path: '/targets', icon: Server, label: 'Target Connections', section: 'sources' },
  { path: '/schema', icon: FolderTree, label: 'Schema Discovery', section: 'schema' },
  { path: '/schema-match', icon: ArrowLeftRight, label: 'Schema Matching', section: 'schema' },
  { path: '/schema-library', icon: Library, label: 'Schema Library', section: 'schema' },
  { path: '/target-templates', icon: FileCode, label: 'Target Templates', section: 'schema' },
  { path: '/mappings', icon: GitBranch, label: 'Field Mappings', section: 'pipeline' },
  { path: '/pipelines', icon: Play, label: 'Pipelines', section: 'pipeline' },
  { path: '/runs', icon: History, label: 'Pipeline Runs', section: 'pipeline' },
  { path: '/events', icon: Webhook, label: 'Event Stream', section: 'pipeline' },
  { path: '/preview', icon: Table, label: 'Data Preview', section: 'data' },
  { path: '/dashboard', icon: BarChart3, label: 'KPI Dashboard', section: 'data' },
  { path: '/users', icon: Users, label: 'User Management', section: 'admin' },
  { path: '/roles', icon: Shield, label: 'Role Management', section: 'admin' },
];

const sections = {
  sources: 'Data Sources',
  schema: 'Schema',
  pipeline: 'Pipeline',
  data: 'Analytics',
  admin: 'Administration'
};

const Sidebar = ({ className = '', onNavigate }) => {
  let currentSection = '';
  
  return (
    <nav className={`space-y-1 ${className}`}>
      {navItems.map((item) => {
        const showSectionHeader = item.section !== currentSection;
        currentSection = item.section;
        
        return (
          <React.Fragment key={item.path}>
            {showSectionHeader && (
              <div className="px-3 py-2 mt-4 first:mt-0">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {sections[item.section]}
                </h3>
              </div>
            )}
            <NavLink
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `sidebar-link flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md mx-2 ${
                  isActive ? 'active' : 'text-muted-foreground hover:text-foreground'
                }`
              }
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          </React.Fragment>
        );
      })}
    </nav>
  );
};

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto px-4 h-14 flex items-center gap-3">
          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Database className="h-6 w-6 text-primary" />
                  <span className="font-semibold">ESIP</span>
                </div>
              </div>
              <Sidebar className="py-4" onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="hidden lg:flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <span className="font-semibold tracking-tight">ESIP Pipeline Platform</span>
          </div>

          <div className="flex-1" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="hidden sm:inline text-sm">{user?.name}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled>
                <User className="h-4 w-4 mr-2" />
                {user?.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:w-64 shrink-0 border-r border-border/60 bg-card min-h-[calc(100vh-56px)]">
          <Sidebar className="py-4 w-full" />
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 lg:p-8 min-h-[calc(100vh-56px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
