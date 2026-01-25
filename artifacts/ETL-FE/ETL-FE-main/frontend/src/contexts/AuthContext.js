import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/apiClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoading(false);
      return null;
    }
    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      return response.data;
    } catch (err) {
      console.error('Failed to fetch user:', err);
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      // Platform 2 uses access_token instead of token
      const token = response.data.access_token || response.data.token;
      localStorage.setItem('authToken', token);
      
      // Fetch user data separately since Platform 2 doesn't return it with login
      const userResponse = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = userResponse.data;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    fetchUser,
    isAuthenticated: !!user,
    isPending: user?.status === 'pending',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
