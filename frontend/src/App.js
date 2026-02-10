import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { CurrencyProvider } from './lib/CurrencyContext';
import { GlobalFilterProvider } from './lib/GlobalFilterContext';
import { RBACProvider, useRBAC } from './lib/RBACContext';
import { Toaster } from './components/ui/sonner';

// Layout
import { Layout } from './components/layout/Layout';

// Auth Pages
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';

// CRM Pages
import { DashboardPage } from './components/crm/DashboardPage';
import { OpportunitiesPage } from './components/crm/OpportunitiesPage';
import LeadsPage from './components/crm/LeadsPage';
import { AccountsPage } from './components/crm/AccountsPage';
import { ActivitiesPage } from './components/crm/ActivitiesPage';
import { ProfilePage } from './components/crm/ProfilePage';
import { InvoicesPage } from './components/crm/InvoicesPage';
import { ActivityTimelinePage } from './components/crm/ActivityTimelinePage';
import AnalyticsPage from './components/crm/AnalyticsPage';
import PerformanceHubPage from './components/crm/PerformanceHubPage';
import IncentiveCalcPage from './components/crm/IncentiveCalcPage';
import OrgStructurePage from './components/crm/OrgStructurePage';
import IntegrationsPage from './components/admin/IntegrationsPage';

// ETL Pages
import { ConnectionsPage } from './components/etl/ConnectionsPage';
import { MappingEditor } from './components/mapping-editor';
import { PipelinesPage } from './components/etl/PipelinesPage';
import { RunsPage } from './components/etl/RunsPage';
import { DataLakePage } from './components/etl/DataLakePage';
import { DLQPage } from './components/etl/DLQPage';
import { OdooModelBrowserPage } from './components/etl/OdooModelBrowserPage';

// Data Modeling
import { DataModelEditor } from './components/data-modeling/DataModelEditor';

// Admin Pages
import { UsersPage } from './components/admin/UsersPage';
import { RolesPage } from './components/admin/RolesPage';
import { DepartmentsPage } from './components/admin/DepartmentsPage';
import { SettingsPage } from './components/admin/SettingsPage';
import { SystemLogsPage } from './components/admin/SystemLogsPage';
import { WebhookConfigPage } from './components/admin/WebhookConfigPage';
import { CustomFieldsPage } from './components/admin/CustomFieldsPage';
import { DataQualityPage } from './components/admin/DataQualityPage';
import RBACManagementPage from './components/admin/RBACManagementPage';
import HelpPage from './components/admin/HelpPage';
import IntegrationsPage from './components/admin/IntegrationsPage';

import './App.css';

// Protected Route wrapper (auth check)
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#800000]"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Public Route wrapper
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#800000]"></div>
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

// RBAC Route Guard - blocks access to pages if user lacks permission
function RBACGuard({ permission, children }) {
  const { hasPermission, loading, permissions } = useRBAC();

  if (loading) return null;

  // admin:* has access to everything
  if (permissions.includes('admin:*')) return children;

  if (!hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8" data-testid="access-denied">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400 max-w-md">You don't have permission to access this page. Contact your administrator if you believe this is an error.</p>
      </div>
    );
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Protected Routes with Layout */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* CRM Platform - with RBAC guards */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/opportunities" element={<RBACGuard permission="view_opportunities"><OpportunitiesPage /></RBACGuard>} />
        <Route path="/leads" element={<RBACGuard permission="view_opportunities"><LeadsPage /></RBACGuard>} />
        <Route path="/accounts" element={<RBACGuard permission="view_accounts"><AccountsPage /></RBACGuard>} />
        <Route path="/activities" element={<RBACGuard permission="view_activities"><ActivitiesPage /></RBACGuard>} />
        <Route path="/activity-timeline" element={<RBACGuard permission="view_activities"><ActivityTimelinePage /></RBACGuard>} />
        <Route path="/analytics" element={<RBACGuard permission="view_analytics"><AnalyticsPage /></RBACGuard>} />
        <Route path="/invoices" element={<RBACGuard permission="view_invoices"><InvoicesPage /></RBACGuard>} />
        <Route path="/performance" element={<RBACGuard permission="view_goals"><PerformanceHubPage /></RBACGuard>} />
        <Route path="/incentives" element={<RBACGuard permission="view_goals"><IncentiveCalcPage /></RBACGuard>} />
        <Route path="/org-structure" element={<OrgStructurePage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* ETL Platform - System Admin only */}
        <Route path="/integration-hub" element={<RBACGuard permission="system_admin"><IntegrationHubPage /></RBACGuard>} />
        <Route path="/sync-center" element={<RBACGuard permission="system_admin"><IntegrationHubPage /></RBACGuard>} />
        <Route path="/etl/connections" element={<RBACGuard permission="system_admin"><ConnectionsPage /></RBACGuard>} />
        <Route path="/etl/mappings" element={<RBACGuard permission="system_admin"><MappingEditor /></RBACGuard>} />
        <Route path="/etl/pipelines" element={<RBACGuard permission="system_admin"><PipelinesPage /></RBACGuard>} />
        <Route path="/etl/runs" element={<RBACGuard permission="system_admin"><RunsPage /></RBACGuard>} />
        <Route path="/etl/data-lake" element={<RBACGuard permission="system_admin"><DataLakePage /></RBACGuard>} />
        <Route path="/etl/dlq" element={<RBACGuard permission="system_admin"><DLQPage /></RBACGuard>} />
        <Route path="/etl/data-model" element={<RBACGuard permission="system_admin"><DataModelEditor /></RBACGuard>} />
        <Route path="/etl/model-browser" element={<RBACGuard permission="system_admin"><OdooModelBrowserPage /></RBACGuard>} />

        {/* Admin - manage_users or system_admin */}
        <Route path="/admin/users" element={<RBACGuard permission="manage_users"><UsersPage /></RBACGuard>} />
        <Route path="/admin/roles" element={<RBACGuard permission="manage_users"><RolesPage /></RBACGuard>} />
        <Route path="/admin/rbac" element={<RBACGuard permission="system_admin"><RBACManagementPage /></RBACGuard>} />
        <Route path="/admin/departments" element={<RBACGuard permission="manage_users"><DepartmentsPage /></RBACGuard>} />
        <Route path="/admin/settings" element={<RBACGuard permission="system_admin"><SettingsPage /></RBACGuard>} />
        <Route path="/admin/logs" element={<RBACGuard permission="system_admin"><SystemLogsPage /></RBACGuard>} />
        <Route path="/admin/webhooks" element={<RBACGuard permission="system_admin"><WebhookConfigPage /></RBACGuard>} />
        <Route path="/admin/custom-fields" element={<RBACGuard permission="system_admin"><CustomFieldsPage /></RBACGuard>} />
        <Route path="/admin/data-quality" element={<RBACGuard permission="system_admin"><DataQualityPage /></RBACGuard>} />
        <Route path="/admin/integrations" element={<RBACGuard permission="system_admin"><IntegrationsPage /></RBACGuard>} />
        <Route path="/help" element={<HelpPage />} />
      </Route>

      {/* 404 Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
          <GlobalFilterProvider>
            <RBACProvider>
              <AppRoutes />
              <Toaster position="top-right" richColors closeButton />
            </RBACProvider>
          </GlobalFilterProvider>
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
