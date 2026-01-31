import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { CurrencyProvider } from './lib/CurrencyContext';
import { GlobalFilterProvider } from './lib/GlobalFilterContext';
import { RBACProvider } from './lib/RBACContext';
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
import { GoalsPage } from './components/crm/GoalsPage';
import { TeamsPage } from './components/crm/TeamsPage';
import { PortfoliosPage } from './components/crm/PortfoliosPage';
import { InitiativesPage } from './components/crm/InitiativesPage';
import { KPIsPage } from './components/crm/KPIsPage';
import { ProfilePage } from './components/crm/ProfilePage';
import { InvoicesPage } from './components/crm/InvoicesPage';
import { ActivityTimelinePage } from './components/crm/ActivityTimelinePage';
import AnalyticsPage from './components/crm/AnalyticsPage';

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

import './App.css';

// Check for Microsoft SSO token in URL BEFORE React renders
// If found, process it and prevent React from rendering until redirect completes
const ssoTokenInUrl = (function checkMicrosoftSSOToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const provider = urlParams.get('provider');
  const errorParam = urlParams.get('error');
  
  // Handle SSO errors
  if (errorParam) {
    console.error('Microsoft SSO error:', errorParam, urlParams.get('message'));
    window.history.replaceState({}, '', window.location.pathname);
    return false;
  }
  
  // Handle successful Microsoft SSO token
  if (token && provider === 'microsoft') {
    console.log('Processing Microsoft SSO token...');
    
    // Store token using the same key as the main auth system
    localStorage.setItem('access_token', token);
    
    // Decode token to get user info
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      localStorage.setItem('user', JSON.stringify({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        org_id: payload.org_id,
        access_level: payload.access_level,
        rbac_linked: payload.rbac_linked,
      }));
      console.log('Microsoft SSO successful for:', payload.email);
    } catch (e) {
      console.error('Failed to decode Microsoft token:', e);
    }
    
    // Signal that we have a token to process
    return true;
  }
  
  return false;
})();

// If we found SSO token, redirect now and show nothing
if (ssoTokenInUrl) {
  // Replace history to clean URL, then redirect
  window.location.replace('/dashboard');
}

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  // If we just processed an SSO token, show loading while redirect happens
  if (ssoTokenInUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Completing sign-in...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Public Route wrapper (redirect if logged in)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Protected Routes with Layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* CRM Platform */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/activity-timeline" element={<ActivityTimelinePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/portfolios" element={<PortfoliosPage />} />
        <Route path="/initiatives" element={<InitiativesPage />} />
        <Route path="/kpis" element={<KPIsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* ETL Platform */}
        <Route path="/etl/connections" element={<ConnectionsPage />} />
        <Route path="/etl/mappings" element={<MappingEditor />} />
        <Route path="/etl/pipelines" element={<PipelinesPage />} />
        <Route path="/etl/runs" element={<RunsPage />} />
        <Route path="/etl/data-lake" element={<DataLakePage />} />
        <Route path="/etl/dlq" element={<DLQPage />} />
        <Route path="/etl/data-model" element={<DataModelEditor />} />
        <Route path="/etl/model-browser" element={<OdooModelBrowserPage />} />

        {/* Admin */}
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/roles" element={<RolesPage />} />
        <Route path="/admin/rbac" element={<RBACManagementPage />} />
        <Route path="/admin/departments" element={<DepartmentsPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
        <Route path="/admin/logs" element={<SystemLogsPage />} />
        <Route path="/admin/webhooks" element={<WebhookConfigPage />} />
        <Route path="/admin/custom-fields" element={<CustomFieldsPage />} />
        <Route path="/admin/data-quality" element={<DataQualityPage />} />
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
