import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalFilterBar } from './GlobalFilterBar';
import { Toaster } from '../ui/sonner';

// Pages where global filter should be shown
const FILTER_ENABLED_PAGES = [
  '/dashboard',
  '/opportunities',
  '/accounts',
  '/activities',
  '/analytics',
  '/invoices',
  '/kpis'
];

export function Layout() {
  const location = useLocation();
  const showGlobalFilter = FILTER_ENABLED_PAGES.some(path => location.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="pl-64 min-h-screen">
        <div className="p-6 max-w-[1400px] mx-auto">
          {/* Global Filter Bar - shown on enabled pages */}
          {showGlobalFilter && (
            <div className="mb-4">
              <GlobalFilterBar />
            </div>
          )}
          <Outlet />
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}
