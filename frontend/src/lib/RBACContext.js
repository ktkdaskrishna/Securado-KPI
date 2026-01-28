import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

const RBACContext = createContext(null);

export function RBACProvider({ children }) {
  const [rbac, setRbac] = useState({
    loading: true,
    permissions: [],
    roles: [],
    recordAccess: 'own',
    fieldAccess: 'limited',
    hiddenFields: [],
    userId: null
  });

  useEffect(() => {
    fetchRBAC();
  }, []);

  const fetchRBAC = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setRbac({
          loading: false,
          permissions: [],
          roles: [],
          recordAccess: 'own',
          fieldAccess: 'limited',
          hiddenFields: [],
          userId: null
        });
        return;
      }

      const res = await axios.get(`${API_BASE_URL}/api/odoo-rbac/current-user-rbac`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setRbac({
        loading: false,
        permissions: res.data.effective_permissions || [],
        roles: res.data.app_roles || [],
        recordAccess: res.data.record_access || 'own',
        fieldAccess: res.data.field_access || 'limited',
        hiddenFields: res.data.hidden_fields || [],
        userId: res.data.user_id
      });
    } catch (error) {
      console.error('Failed to fetch RBAC:', error);
      setRbac({
        loading: false,
        permissions: [],
        roles: [],
        recordAccess: 'own',
        fieldAccess: 'limited',
        hiddenFields: [],
        userId: null
      });
    }
  };

  const hasPermission = (permission) => {
    if (rbac.permissions.includes('admin:*')) return true;
    return rbac.permissions.includes(permission);
  };

  const hasAnyPermission = (permissions) => {
    if (rbac.permissions.includes('admin:*')) return true;
    return permissions.some(p => rbac.permissions.includes(p));
  };

  const hasRole = (role) => {
    return rbac.roles.includes(role);
  };

  const canSeeField = (fieldName) => {
    return !rbac.hiddenFields.includes(fieldName);
  };

  const canAccessAllRecords = () => {
    return rbac.recordAccess === 'all';
  };

  const filterHiddenFields = (record) => {
    if (!record || typeof record !== 'object') return record;
    
    const filtered = { ...record };
    rbac.hiddenFields.forEach(field => {
      delete filtered[field];
    });
    return filtered;
  };

  const value = {
    ...rbac,
    hasPermission,
    hasAnyPermission,
    hasRole,
    canSeeField,
    canAccessAllRecords,
    filterHiddenFields,
    refresh: fetchRBAC
  };

  return (
    <RBACContext.Provider value={value}>
      {children}
    </RBACContext.Provider>
  );
}

export function useRBAC() {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within a RBACProvider');
  }
  return context;
}

// Permission-gated component wrapper
export function RequirePermission({ permission, children, fallback = null }) {
  const { hasPermission, loading } = useRBAC();
  
  if (loading) return null;
  if (!hasPermission(permission)) return fallback;
  return children;
}

// Role-gated component wrapper
export function RequireRole({ role, children, fallback = null }) {
  const { hasRole, loading } = useRBAC();
  
  if (loading) return null;
  if (!hasRole(role)) return fallback;
  return children;
}

export default RBACContext;
