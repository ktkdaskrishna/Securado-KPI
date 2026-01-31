import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from '../ui/sonner';
import RBACLinkWarning from '../common/RBACLinkWarning';
import { useAuth } from '../../lib/auth';

export function Layout() {
  const { user } = useAuth();
  const [showWarning, setShowWarning] = useState(false);

  // Check for RBAC link status after login
  useEffect(() => {
    if (user) {
      // Check if user came from Microsoft login (has rbac_linked property)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          if (userData.rbac_linked === false) {
            setShowWarning(true);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [user]);

  // Get user data with rbac_linked status
  const getUserWithRbac = () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        return JSON.parse(storedUser);
      }
    } catch (e) {
      // Ignore
    }
    return user;
  };

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
      
      {/* RBAC Link Warning Popup */}
      <RBACLinkWarning 
        user={getUserWithRbac()}
        onDismiss={() => setShowWarning(false)}
        onContactAdmin={() => {
          // Could open mailto link or show admin contact
          window.location.href = 'mailto:admin@securado.com?subject=RBAC%20Access%20Request';
        }}
      />
    </div>
  );
}

