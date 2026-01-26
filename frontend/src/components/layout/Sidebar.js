import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Separator } from '../ui/separator';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  TrendingUp,
  Building2,
  CheckSquare,
  Target,
  Users,
  Briefcase,
  BarChart2,
  Link as LinkIcon,
  GitMerge,
  Workflow,
  History,
  Database,
  AlertTriangle,
  Shield,
  Building,
  Settings,
  LogOut,
  Rocket
} from 'lucide-react';
import { useAuth } from '../../lib/auth';

const iconMap = {
  LayoutDashboard,
  TrendingUp,
  Building2,
  CheckSquare,
  Target,
  Users,
  Briefcase,
  BarChart2,
  Link: LinkIcon,
  GitMerge,
  Workflow,
  History,
  Database,
  AlertTriangle,
  Shield,
  Building,
  Rocket,
};

const navigation = {
  crm: [
    { name: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { name: 'Opportunities', href: '/opportunities', icon: 'TrendingUp' },
    { name: 'Accounts', href: '/accounts', icon: 'Building2' },
    { name: 'Activities', href: '/activities', icon: 'CheckSquare' },
    { name: 'Goals', href: '/goals', icon: 'Target' },
    { name: 'Teams', href: '/teams', icon: 'Users' },
    { name: 'Portfolios', href: '/portfolios', icon: 'Briefcase' },
    { name: 'Initiatives', href: '/initiatives', icon: 'Rocket' },
    { name: 'KPIs', href: '/kpis', icon: 'BarChart2' },
  ],
  etl: [
    { name: 'Connections', href: '/etl/connections', icon: 'Link' },
    { name: 'Mappings', href: '/etl/mappings', icon: 'GitMerge' },
    { name: 'Pipelines', href: '/etl/pipelines', icon: 'Workflow' },
    { name: 'Run History', href: '/etl/runs', icon: 'History' },
    { name: 'Data Lake', href: '/etl/data-lake', icon: 'Database' },
    { name: 'DLQ', href: '/etl/dlq', icon: 'AlertTriangle' },
  ],
  admin: [
    { name: 'Users', href: '/admin/users', icon: 'Users' },
    { name: 'Roles', href: '/admin/roles', icon: 'Shield' },
    { name: 'Departments', href: '/admin/departments', icon: 'Building' },
  ],
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const NavItem = ({ item }) => {
    const Icon = iconMap[item.icon] || LayoutDashboard;
    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');

    const content = (
      <Link
        to={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          isActive
            ? 'bg-white/10 text-white'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        )}
        data-testid={`nav-${item.name.toLowerCase().replace(/\s/g, '-')}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.name}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <TooltipProvider key={item.href}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">
              {item.name}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-[#0E1217] text-white transition-[width] duration-200',
        collapsed ? 'w-20' : 'w-64'
      )}
      data-testid="sidebar"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-800">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">EM</span>
              </div>
              <span className="font-semibold text-lg">Event Mesh</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-white hover:bg-white/10"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          {/* CRM Platform */}
          <div className="mb-6">
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                CRM Platform
              </h3>
            )}
            <nav className="space-y-1">
              {navigation.crm.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </nav>
          </div>

          <Separator className="bg-gray-800 my-4" />

          {/* ETL Platform */}
          <div className="mb-6">
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ETL Platform
              </h3>
            )}
            <nav className="space-y-1">
              {navigation.etl.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </nav>
          </div>

          <Separator className="bg-gray-800 my-4" />

          {/* Admin */}
          <div>
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Admin
              </h3>
            )}
            <nav className="space-y-1">
              {navigation.admin.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </nav>
          </div>
        </ScrollArea>

        {/* User section */}
        <div className="border-t border-gray-800 p-4">
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-sm font-medium">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-gray-400 hover:text-white hover:bg-white/10"
                data-testid="logout-button"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
