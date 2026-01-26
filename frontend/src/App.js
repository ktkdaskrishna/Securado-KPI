import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Toaster } from './components/ui/sonner';

// Layout
import { Layout } from './components/layout/Layout';

// Auth Pages
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';

// CRM Pages
import { DashboardPage } from './components/crm/DashboardPage';
import { OpportunitiesPage } from './components/crm/OpportunitiesPage';
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

// ETL Pages
import { ConnectionsPage } from './components/etl/ConnectionsPage';
import { MappingsPage } from './components/etl/MappingsPage';
import { PipelinesPage } from './components/etl/PipelinesPage';
import { RunsPage } from './components/etl/RunsPage';
import { DataLakePage } from './components/etl/DataLakePage';
import { DLQPage } from './components/etl/DLQPage';

// Admin Pages
import { UsersPage } from './components/admin/UsersPage';
import { RolesPage } from './components/admin/RolesPage';
import { DepartmentsPage } from './components/admin/DepartmentsPage';
import { SettingsPage } from './components/admin/SettingsPage';

import './App.css';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

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
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/activity-timeline" element={<ActivityTimelinePage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/portfolios" element={<PortfoliosPage />} />
        <Route path="/initiatives" element={<InitiativesPage />} />
        <Route path="/kpis" element={<KPIsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* ETL Platform */}
        <Route path="/etl/connections" element={<ConnectionsPage />} />
        <Route path="/etl/mappings" element={<MappingsPage />} />
        <Route path="/etl/pipelines" element={<PipelinesPage />} />
        <Route path="/etl/runs" element={<RunsPage />} />
        <Route path="/etl/data-lake" element={<DataLakePage />} />
        <Route path="/etl/dlq" element={<DLQPage />} />

        {/* Admin */}
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/roles" element={<RolesPage />} />
        <Route path="/admin/departments" element={<DepartmentsPage />} />
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
        <AppRoutes />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
