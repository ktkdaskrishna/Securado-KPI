import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import PublicRoute from './components/layout/PublicRoute';

// Public Pages
import LoginPage from './pages/auth/LoginPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';

// Protected Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import OpportunitiesPage from './pages/opportunities/OpportunitiesPage';
import AccountsPage from './pages/accounts/AccountsPage';
import ActivityPage from './pages/activity/ActivityPage';
import GoalsPage from './pages/goals/GoalsPage';
import TeamsPage from './pages/teams/TeamsPage';
import PortfoliosPage from './pages/portfolios/PortfoliosPage';
import InitiativesPage from './pages/initiatives/InitiativesPage';
import KPIsPage from './pages/kpis/KPIsPage';
import DataLakePage from './pages/datalake/DataLakePage';
import AdminPage from './pages/admin/AdminPage';
import ProfilePage from './pages/profile/ProfilePage';

import './App.css';

// Enforce dark mode
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
}

function App() {
  useEffect(() => {
    // Ensure dark mode is applied
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
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
              path="/pending-approval"
              element={
                <ProtectedRoute>
                  <PendingApprovalPage />
                </ProtectedRoute>
              }
            />

            {/* Protected Routes with Layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="opportunities" element={<OpportunitiesPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="goals" element={<GoalsPage />} />
              <Route path="teams" element={<TeamsPage />} />
              <Route path="portfolios" element={<PortfoliosPage />} />
              <Route path="initiatives" element={<InitiativesPage />} />
              <Route path="kpis" element={<KPIsPage />} />
              <Route path="data-lake" element={<DataLakePage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
