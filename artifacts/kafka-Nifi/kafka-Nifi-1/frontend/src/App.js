import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './lib/auth-context';
import './App.css';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/DashboardLayout';
import ConnectionsPage from './pages/ConnectionsPage';
import TargetsPage from './pages/TargetsPage';
import SchemaPage from './pages/SchemaPage';
import SchemaMatchPage from './pages/SchemaMatchPage';
import SchemaLibraryPage from './pages/SchemaLibraryPage';
import TargetTemplatesPage from './pages/TargetTemplatesPage';
import MappingsPage from './pages/MappingsPage';
import PipelinesPage from './pages/PipelinesPage';
import RunsPage from './pages/RunsPage';
import EventStreamPage from './pages/EventStreamPage';
import PreviewPage from './pages/PreviewPage';
import KPIDashboard from './pages/KPIDashboard';
import UserManagementPage from './pages/UserManagementPage';
import RoleManagementPage from './pages/RoleManagementPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      refetchInterval: 30000,
    },
  },
});

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/connections" replace />} />
        <Route path="connections" element={<ConnectionsPage />} />
        <Route path="targets" element={<TargetsPage />} />
        <Route path="schema" element={<SchemaPage />} />
        <Route path="schema-match" element={<SchemaMatchPage />} />
        <Route path="schema-library" element={<SchemaLibraryPage />} />
        <Route path="target-templates" element={<TargetTemplatesPage />} />
        <Route path="mappings" element={<MappingsPage />} />
        <Route path="pipelines" element={<PipelinesPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="events" element={<EventStreamPage />} />
        <Route path="preview" element={<PreviewPage />} />
        <Route path="dashboard" element={<KPIDashboard />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="roles" element={<RoleManagementPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="App">
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
