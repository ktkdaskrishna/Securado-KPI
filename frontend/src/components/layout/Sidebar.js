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
  User,
  Boxes,
  Brain,
  Lock,
  Webhook,
  ShieldCheck,
  HelpCircle,
  Activity,
  DollarSign,
  Crosshair
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useRBAC } from '../../lib/RBACContext';

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
  Boxes,
  Brain,
  Lock,
  Webhook,
  ShieldCheck,
  HelpCircle,
  Activity,
  DollarSign,
  Crosshair,
};

// Permission requirements for each navigation item
const permissionRequirements = {
  dashboard: 'view_dashboard',
  analytics: 'view_analytics',
  opportunities: 'view_opportunities',
  leads: 'view_opportunities',
  accounts: 'view_accounts',
  activities: 'view_activities',
  'activity-timeline': 'view_activities',
  invoices: 'view_invoices',
  performance: 'view_goals',
  incentives: 'view_goals',
  'org-structure': null, // visible to all
  profile: null, // Always visible
  // ETL Platform - System Admin only
  connections: 'system_admin',
  'model-browser': 'system_admin',
  mappings: 'system_admin',
  'data-model': 'system_admin',
  pipelines: 'system_admin',
  runs: 'system_admin',
  datalake: 'system_admin',
  dlq: 'system_admin',
  // Admin section - manage_users or system_admin
  users: 'manage_users',
  roles: 'manage_users',
  'rbac-sync': 'system_admin',
  departments: 'manage_users',
  settings: 'system_admin',
  'system-logs': 'system_admin',
  webhooks: 'system_admin',
  'custom-fields': 'system_admin',
  'data-quality': 'system_admin',
  help: null, // Always visible
};

const defaultNavigation = {
  crm: [
    { id: 'dashboard', name: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', default: true },
    { id: 'analytics', name: 'AI Analytics', href: '/analytics', icon: 'Brain', default: true },
    { id: 'opportunities', name: 'Opportunities', href: '/opportunities', icon: 'TrendingUp', default: true },
    { id: 'leads', name: 'Leads', href: '/leads', icon: 'Users', default: true },
    { id: 'accounts', name: 'Accounts', href: '/accounts', icon: 'Building2', default: true },
    { id: 'activities', name: 'Activities', href: '/activities', icon: 'CheckSquare', default: true },
    { id: 'activity-timeline', name: 'Timeline', href: '/activity-timeline', icon: 'Clock', default: true },
    { id: 'invoices', name: 'Invoices', href: '/invoices', icon: 'FileText', default: true },
    { id: 'performance', name: 'Performance Hub', href: '/performance', icon: 'Crosshair', default: true },
    { id: 'incentives', name: 'Incentives', href: '/incentives', icon: 'DollarSign', default: true },
    { id: 'org-structure', name: 'Organization', href: '/org-structure', icon: 'Building2', default: true },
    { id: 'profile', name: 'My Profile', href: '/profile', icon: 'User', default: true },
  ],
  etl: [
    { id: 'connections', name: 'Connections', href: '/etl/connections', icon: 'Link', default: true },
    { id: 'model-browser', name: 'Model Browser', href: '/etl/model-browser', icon: 'Database', default: true },
    { id: 'mappings', name: 'Mappings', href: '/etl/mappings', icon: 'GitMerge', default: true },
    { id: 'data-model', name: 'Data Model', href: '/etl/data-model', icon: 'Boxes', default: true },
    { id: 'pipelines', name: 'Pipelines', href: '/etl/pipelines', icon: 'Workflow', default: true },
    { id: 'runs', name: 'Run History', href: '/etl/runs', icon: 'History', default: false },
    { id: 'datalake', name: 'Data Lake', href: '/etl/data-lake', icon: 'Database', default: false },
    { id: 'dlq', name: 'DLQ', href: '/etl/dlq', icon: 'AlertTriangle', default: false },
  ],
  admin: [
    { id: 'users', name: 'Users', href: '/admin/users', icon: 'Users', default: true },
    { id: 'roles', name: 'Roles', href: '/admin/roles', icon: 'Shield', default: true },
    { id: 'rbac-sync', name: 'RBAC Sync', href: '/admin/rbac', icon: 'ShieldCheck', default: true },
    { id: 'departments', name: 'Departments', href: '/admin/departments', icon: 'Building', default: false },
    { id: 'data-quality', name: 'Data Quality', href: '/admin/data-quality', icon: 'ShieldCheck', default: true },
    { id: 'settings', name: 'Settings', href: '/admin/settings', icon: 'Settings', default: true },
    { id: 'system-logs', name: 'System Logs', href: '/admin/logs', icon: 'AlertTriangle', default: true },
    { id: 'webhooks', name: 'Webhooks', href: '/admin/webhooks', icon: 'Webhook', default: true },
    { id: 'custom-fields', name: 'Custom Fields', href: '/admin/custom-fields', icon: 'Boxes', default: true },
    { id: 'help', name: 'Help & Support', href: '/help', icon: 'HelpCircle', default: true },
  ],
};

const getStoredNavigation = () => {
  try {
    const stored = localStorage.getItem('securado_nav_preferences');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate stored preferences - ensure all items have default values if not set
      const defaults = {};
      Object.values(defaultNavigation).flat().forEach(item => {
        // If item is not in stored preferences, use default
        // If item is explicitly set, use that value
        defaults[item.id] = parsed[item.id] !== undefined ? parsed[item.id] : item.default;
      });
      return defaults;
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
  const { hasPermission, loading: rbacLoading, roles, permissions } = useRBAC();

  useEffect(() => {
    saveNavigationPreferences(navPreferences);
  }, [navPreferences]);

  const toggleNavItem = (itemId) => {
    setNavPreferences(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Filter items based on both preferences AND permissions
  // Memoized to recalculate when rbacLoading or permissions change
  const getVisibleItems = React.useCallback((items) => {
    // While RBAC is still loading, show all default items
    if (rbacLoading) {
      return items.filter(item => {
        if (navPreferences[item.id] === false) return false;
        return item.default !== false;
      });
    }
    
    return items.filter(item => {
      // Check if user disabled it in preferences
      if (navPreferences[item.id] === false) return false;
      
      // Check permission requirement
      const requiredPermission = permissionRequirements[item.id];
      
      // Always show items with no permission requirement (like profile)
      if (requiredPermission === null) return true;
      
      // If no specific permission defined, show by default
      if (!requiredPermission) return true;
      
      // Check if user has the required permission using permissions array directly
      if (permissions.includes('admin:*')) return true;
      return permissions.includes(requiredPermission);
    });
  }, [navPreferences, rbacLoading, permissions]);

  // Check if user has access to a section
  const hasSectionAccess = (section) => {
    if (section === 'crm') return true; // CRM always visible
    if (section === 'etl') return hasPermission('system_admin'); // ETL Platform - System Admin only
    if (section === 'admin') return hasPermission('manage_users') || hasPermission('system_admin');
    return true;
  };

  // List of pages that should preserve filter params
  const FILTER_ENABLED_PATHS = [
    '/dashboard',
    '/opportunities',
    '/leads',
    '/accounts',
    '/activities',
    '/analytics',
    '/invoices',
    '/activity-timeline',
    '/performance',
    '/incentives'
  ];

  const NavItem = ({ item }) => {
    const Icon = iconMap[item.icon] || LayoutDashboard;
    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
    
    // Preserve search params when navigating between filter-enabled pages
    const shouldPreserveParams = FILTER_ENABLED_PATHS.includes(location.pathname) && FILTER_ENABLED_PATHS.includes(item.href);
    const linkTo = shouldPreserveParams ? `${item.href}${location.search}` : item.href;

    const content = (
      <Link
        to={linkTo}
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

  const NavigationSettings = () => {
    // Helper to check if item is accessible
    const canAccessItem = (item) => {
      const requiredPermission = permissionRequirements[item.id];
      if (requiredPermission === null) return true;
      if (!requiredPermission) return true;
      return hasPermission(requiredPermission);
    };
    
    return (
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
            Select which menu items to show in the sidebar.
            {roles.length > 0 && (
              <span className="block mt-1 text-xs">
                Your roles: {roles.join(', ')}
              </span>
            )}
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
                {defaultNavigation.crm.map((item) => {
                  const accessible = canAccessItem(item);
                  return (
                  <div key={item.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`nav-${item.id}`}
                      checked={navPreferences[item.id] !== false && accessible}
                      onCheckedChange={() => accessible && toggleNavItem(item.id)}
                      disabled={!accessible}
                      className="border-gray-600 data-[state=checked]:bg-[#800000] data-[state=checked]:border-[#800000] disabled:opacity-50"
                    />
                    <Label 
                      htmlFor={`nav-${item.id}`} 
                      className={cn(
                        "text-sm cursor-pointer flex items-center gap-2",
                        accessible ? "text-gray-300" : "text-gray-500"
                      )}
                    >
                      {React.createElement(iconMap[item.icon], { className: "h-4 w-4" })}
                      {item.name}
                      {!accessible && <Lock className="h-3 w-3 text-gray-500" />}
                    </Label>
                  </div>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-gray-700" />

            {/* ETL Section */}
            {hasSectionAccess('etl') && (
            <div>
              <h4 className="text-sm font-semibold text-[#800000] uppercase tracking-wider mb-3">
                ETL Platform
              </h4>
              <div className="space-y-3">
                {defaultNavigation.etl.map((item) => {
                  const accessible = canAccessItem(item);
                  return (
                  <div key={item.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`nav-${item.id}`}
                      checked={navPreferences[item.id] !== false && accessible}
                      onCheckedChange={() => accessible && toggleNavItem(item.id)}
                      disabled={!accessible}
                      className="border-gray-600 data-[state=checked]:bg-[#800000] data-[state=checked]:border-[#800000] disabled:opacity-50"
                    />
                    <Label 
                      htmlFor={`nav-${item.id}`} 
                      className={cn(
                        "text-sm cursor-pointer flex items-center gap-2",
                        accessible ? "text-gray-300" : "text-gray-500"
                      )}
                    >
                      {React.createElement(iconMap[item.icon], { className: "h-4 w-4" })}
                      {item.name}
                      {!accessible && <Lock className="h-3 w-3 text-gray-500" />}
                    </Label>
                  </div>
                  );
                })}
              </div>
            </div>
            )}

            {hasSectionAccess('etl') && <Separator className="bg-gray-700" />}

            {/* Admin Section */}
            {hasSectionAccess('admin') && (
            <div>
              <h4 className="text-sm font-semibold text-[#800000] uppercase tracking-wider mb-3">
                Admin
              </h4>
              <div className="space-y-3">
                {defaultNavigation.admin.map((item) => {
                  const accessible = canAccessItem(item);
                  return (
                  <div key={item.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`nav-${item.id}`}
                      checked={navPreferences[item.id] !== false && accessible}
                      onCheckedChange={() => accessible && toggleNavItem(item.id)}
                      disabled={!accessible}
                      className="border-gray-600 data-[state=checked]:bg-[#800000] data-[state=checked]:border-[#800000] disabled:opacity-50"
                    />
                    <Label 
                      htmlFor={`nav-${item.id}`} 
                      className={cn(
                        "text-sm cursor-pointer flex items-center gap-2",
                        accessible ? "text-gray-300" : "text-gray-500"
                      )}
                    >
                      {React.createElement(iconMap[item.icon], { className: "h-4 w-4" })}
                      {item.name}
                      {!accessible && <Lock className="h-3 w-3 text-gray-500" />}
                    </Label>
                  </div>
                  );
                })}
              </div>
            </div>
            )}
            
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-[width] duration-200',
        'bg-gradient-to-b from-[#333333] to-[#2a2a2a] text-white',
        collapsed ? 'w-20' : 'w-64'
      )}
      data-testid="sidebar"
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header with Securado Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img 
                src={SECURADO_LOGO_REVERSE} 
                alt="Securado" 
                className="h-12 w-auto"
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
        <ScrollArea className="flex-1 px-3 py-4 overflow-y-auto">
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
