import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '../ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { useAuth } from '../../contexts/AuthContext';
import {
  Home,
  KanbanSquare,
  Building2,
  Activity,
  Target,
  Users2,
  Briefcase,
  Rocket,
  BarChart3,
  Database,
  Shield,
  UserRound,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { icon: Home, label: 'Dashboard', route: '/dashboard', testId: 'nav-dashboard' },
  { icon: KanbanSquare, label: 'Opportunities', route: '/opportunities', testId: 'nav-opportunities' },
  { icon: Building2, label: 'Accounts', route: '/accounts', testId: 'nav-accounts' },
  { icon: Activity, label: 'Activity', route: '/activity', testId: 'nav-activity' },
  'separator',
  { icon: Target, label: 'Goals', route: '/goals', testId: 'nav-goals' },
  { icon: Users2, label: 'Teams', route: '/teams', testId: 'nav-teams' },
  { icon: Briefcase, label: 'Portfolios', route: '/portfolios', testId: 'nav-portfolios' },
  { icon: Rocket, label: 'Initiatives', route: '/initiatives', testId: 'nav-initiatives' },
  'separator',
  { icon: BarChart3, label: 'KPIs', route: '/kpis', testId: 'nav-kpis' },
  { icon: Database, label: 'Data Lake', route: '/data-lake', testId: 'nav-datalake' },
  { icon: Shield, label: 'Admin', route: '/admin', testId: 'nav-admin' },
];

const NavItem = ({ item, collapsed, onClick }) => {
  const Icon = item.icon;
  const location = useLocation();
  const isActive = location.pathname === item.route || location.pathname.startsWith(item.route + '/');

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={item.route}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150',
              'text-muted-foreground hover:text-foreground hover:bg-white/5',
              isActive && 'bg-white/10 text-foreground border border-white/10',
              collapsed && 'justify-center px-2'
            )}
            data-testid={item.testId}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent side="right">
            {item.label}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

const SidebarContent = ({ collapsed, setCollapsed, onNavigate }) => {
  return (
    <div className="flex flex-col h-full">
      <div className={cn(
        'flex items-center gap-2 px-3 h-16',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg">Platform 3</span>
          )}
        </div>
        {!collapsed && setCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hidden md:flex"
            onClick={() => setCollapsed(true)}
            data-testid="sidebar-collapse-button"
          >
            <ChevronLeft size={16} />
          </Button>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item, index) =>
          item === 'separator' ? (
            <Separator key={index} className="my-3" />
          ) : (
            <NavItem
              key={item.route}
              item={item}
              collapsed={collapsed}
              onClick={onNavigate}
            />
          )
        )}
      </nav>

      {collapsed && setCollapsed && (
        <div className="p-2 hidden md:block">
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-10"
            onClick={() => setCollapsed(false)}
            data-testid="sidebar-expand-button"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
};

const AppLayout = () => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-background transition-all duration-200',
            collapsed ? 'w-16' : 'w-64'
          )}
          data-testid="sidebar"
        >
          <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 flex items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-3">
              {/* Mobile Menu */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    data-testid="sidebar-toggle-button"
                  >
                    <Menu size={18} />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SidebarContent
                    collapsed={false}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2"
                    data-testid="user-menu-trigger"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <UserRound size={16} className="text-primary" />
                    </div>
                    <span className="hidden sm:inline text-sm">
                      {user?.name || user?.email || 'User'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{user?.name || 'User'}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {user?.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <NavLink to="/profile" className="cursor-pointer" data-testid="menu-profile">
                      <UserRound size={16} className="mr-2" />
                      Profile
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                    data-testid="menu-logout"
                  >
                    <LogOut size={16} className="mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page Content */}
          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto" data-testid="page-content">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
};

export default AppLayout;
