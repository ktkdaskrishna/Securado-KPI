import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Separator } from '../ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '../ui/sheet';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
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
  Rocket,
  Menu,
  FileText,
  Clock,
  User
} from 'lucide-react';
import { useAuth } from '../../lib/auth';

const SECURADO_LOGO_PRIMARY = "https://customer-assets.emergentagent.com/job_streamhub-crm/artifacts/39apig25_Securado%20Logo-01.jpg";
const SECURADO_LOGO_REVERSE = "https://customer-assets.emergentagent.com/job_streamhub-crm/artifacts/690tpc8y_Securado%20Logo-Reverse-01.png";

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
  FileText,
  Clock,
  User,
  Settings,
};

const defaultNavigation = {
  crm: [
    { id: 'dashboard', name: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', default: true },
    { id: 'opportunities', name: 'Opportunities', href: '/opportunities', icon: 'TrendingUp', default: true },
    { id: 'accounts', name: 'Accounts', href: '/accounts', icon: 'Building2', default: true },
    { id: 'activities', name: 'Activities', href: '/activities', icon: 'CheckSquare', default: true },
    { id: 'activity-timeline', name: 'Timeline', href: '/activity-timeline', icon: 'Clock', default: true },
    { id: 'invoices', name: 'Invoices', href: '/invoices', icon: 'FileText', default: true },
    { id: 'goals', name: 'Goals', href: '/goals', icon: 'Target', default: false },
    { id: 'teams', name: 'Teams', href: '/teams', icon: 'Users', default: false },
    { id: 'portfolios', name: 'Portfolios', href: '/portfolios', icon: 'Briefcase', default: false },
    { id: 'initiatives', name: 'Initiatives', href: '/initiatives', icon: 'Rocket', default: false },
    { id: 'kpis', name: 'KPIs', href: '/kpis', icon: 'BarChart2', default: false },
    { id: 'profile', name: 'My Profile', href: '/profile', icon: 'User', default: true },
  ],
  etl: [
    { id: 'connections', name: 'Connections', href: '/etl/connections', icon: 'Link', default: true },
    { id: 'mappings', name: 'Mappings', href: '/etl/mappings', icon: 'GitMerge', default: true },
    { id: 'pipelines', name: 'Pipelines', href: '/etl/pipelines', icon: 'Workflow', default: true },
    { id: 'runs', name: 'Run History', href: '/etl/runs', icon: 'History', default: false },
    { id: 'datalake', name: 'Data Lake', href: '/etl/data-lake', icon: 'Database', default: false },
    { id: 'dlq', name: 'DLQ', href: '/etl/dlq', icon: 'AlertTriangle', default: false },
  ],
  admin: [
    { id: 'users', name: 'Users', href: '/admin/users', icon: 'Users', default: true },
    { id: 'roles', name: 'Roles', href: '/admin/roles', icon: 'Shield', default: true },
    { id: 'departments', name: 'Departments', href: '/admin/departments', icon: 'Building', default: false },
    { id: 'settings', name: 'Settings', href: '/admin/settings', icon: 'Settings', default: true },
  ],
};

const getStoredNavigation = () => {
  try {
    const stored = localStorage.getItem('securado_nav_preferences');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading navigation preferences:', e);
  }
  // Return default enabled items
  const defaults = {};
  Object.values(defaultNavigation).flat().forEach(item => {
    defaults[item.id] = item.default;
  });
  return defaults;
};

const saveNavigationPreferences = (prefs) => {
  try {
    localStorage.setItem('securado_nav_preferences', JSON.stringify(prefs));
  } catch (e) {
    console.error('Error saving navigation preferences:', e);
  }
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [navPreferences, setNavPreferences] = useState(getStoredNavigation);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    saveNavigationPreferences(navPreferences);
  }, [navPreferences]);

  const toggleNavItem = (itemId) => {
    setNavPreferences(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const getVisibleItems = (items) => {
    return items.filter(item => navPreferences[item.id] !== false);
  };

  const NavItem = ({ item }) => {
    const Icon = iconMap[item.icon] || LayoutDashboard;
    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');

    const content = (
      <Link
        to={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-[#800000] text-white shadow-md'
            : 'text-gray-400 hover:text-white hover:bg-[#800000]/20'
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
            <TooltipContent side="right" className="bg-[#333333] text-white border-[#444444]">
              {item.name}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  };

  const NavigationSettings = () => (
    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-white hover:bg-white/10"
          data-testid="nav-settings-button"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-[#1a1a1a] text-white border-[#333333] overflow-hidden">
        <SheetHeader>
          <SheetTitle className="text-white">Navigation Settings</SheetTitle>
          <SheetDescription className="text-gray-400">
            Select which menu items to show in the sidebar
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
            {/* CRM Section */}
            <div>
              <h4 className="text-sm font-semibold text-[#800000] uppercase tracking-wider mb-3">
                CRM Platform
              </h4>
              <div className="space-y-3">
                {defaultNavigation.crm.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`nav-${item.id}`}
                      checked={navPreferences[item.id] !== false}
                      onCheckedChange={() => toggleNavItem(item.id)}
                      className="border-gray-600 data-[state=checked]:bg-[#800000] data-[state=checked]:border-[#800000]"
                    />
                    <Label 
                      htmlFor={`nav-${item.id}`} 
                      className="text-sm text-gray-300 cursor-pointer flex items-center gap-2"
                    >
                      {React.createElement(iconMap[item.icon], { className: "h-4 w-4" })}
                      {item.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-gray-700" />

            {/* ETL Section */}
            <div>
              <h4 className="text-sm font-semibold text-[#800000] uppercase tracking-wider mb-3">
                ETL Platform
              </h4>
              <div className="space-y-3">
                {defaultNavigation.etl.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`nav-${item.id}`}
                      checked={navPreferences[item.id] !== false}
                      onCheckedChange={() => toggleNavItem(item.id)}
                      className="border-gray-600 data-[state=checked]:bg-[#800000] data-[state=checked]:border-[#800000]"
                    />
                    <Label 
                      htmlFor={`nav-${item.id}`} 
                      className="text-sm text-gray-300 cursor-pointer flex items-center gap-2"
                    >
                      {React.createElement(iconMap[item.icon], { className: "h-4 w-4" })}
                      {item.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-gray-700" />

            {/* Admin Section */}
            <div>
              <h4 className="text-sm font-semibold text-[#800000] uppercase tracking-wider mb-3">
                Admin
              </h4>
              <div className="space-y-3">
                {defaultNavigation.admin.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`nav-${item.id}`}
                      checked={navPreferences[item.id] !== false}
                      onCheckedChange={() => toggleNavItem(item.id)}
                      className="border-gray-600 data-[state=checked]:bg-[#800000] data-[state=checked]:border-[#800000]"
                    />
                    <Label 
                      htmlFor={`nav-${item.id}`} 
                      className="text-sm text-gray-300 cursor-pointer flex items-center gap-2"
                    >
                      {React.createElement(iconMap[item.icon], { className: "h-4 w-4" })}
                      {item.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
          </div>

          <div className="pt-4">
            <Button 
              variant="outline" 
              className="w-full border-[#800000] text-[#800000] hover:bg-[#800000] hover:text-white"
              onClick={() => {
                const defaults = {};
                Object.values(defaultNavigation).flat().forEach(item => {
                  defaults[item.id] = item.default;
                });
                setNavPreferences(defaults);
              }}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-[width] duration-200',
        'bg-gradient-to-b from-[#333333] to-[#2a2a2a] text-white',
        collapsed ? 'w-20' : 'w-64'
      )}
      data-testid="sidebar"
    >
      <div className="flex h-full flex-col">
        {/* Header with Securado Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img 
                src={SECURADO_LOGO_REVERSE} 
                alt="Securado" 
                className="h-10 w-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
          {collapsed && (
            <div className="w-10 h-10 rounded-lg bg-[#800000] flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
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
          {getVisibleItems(defaultNavigation.crm).length > 0 && (
            <div className="mb-6">
              {!collapsed && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-[#86c881] uppercase tracking-wider">
                  CRM Platform
                </h3>
              )}
              <nav className="space-y-1">
                {getVisibleItems(defaultNavigation.crm).map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </nav>
            </div>
          )}

          {getVisibleItems(defaultNavigation.crm).length > 0 && getVisibleItems(defaultNavigation.etl).length > 0 && (
            <Separator className="bg-white/10 my-4" />
          )}

          {/* ETL Platform */}
          {getVisibleItems(defaultNavigation.etl).length > 0 && (
            <div className="mb-6">
              {!collapsed && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-[#86c881] uppercase tracking-wider">
                  ETL Platform
                </h3>
              )}
              <nav className="space-y-1">
                {getVisibleItems(defaultNavigation.etl).map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </nav>
            </div>
          )}

          {(getVisibleItems(defaultNavigation.crm).length > 0 || getVisibleItems(defaultNavigation.etl).length > 0) && 
           getVisibleItems(defaultNavigation.admin).length > 0 && (
            <Separator className="bg-white/10 my-4" />
          )}

          {/* Admin */}
          {getVisibleItems(defaultNavigation.admin).length > 0 && (
            <div>
              {!collapsed && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-[#86c881] uppercase tracking-wider">
                  Admin
                </h3>
              )}
              <nav className="space-y-1">
                {getVisibleItems(defaultNavigation.admin).map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </nav>
            </div>
          )}
        </ScrollArea>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#800000] to-[#9a1919] flex items-center justify-center text-sm font-semibold shadow-lg">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            )}
            {!collapsed && (
              <div className="flex items-center gap-1">
                <NavigationSettings />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="text-gray-400 hover:text-white hover:bg-white/10"
                  data-testid="logout-button"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
