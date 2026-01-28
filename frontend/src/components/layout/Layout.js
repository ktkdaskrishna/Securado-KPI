import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from '../ui/sonner';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="pl-64 min-h-screen">
        <div className="p-6 max-w-[1400px] mx-auto">
          {/* Each page handles its own contextual filters */}
          <Outlet />
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

