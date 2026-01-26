import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminAPI } from './api';
import { DEFAULT_CURRENCY, formatCurrency as formatCurrencyUtil, getCurrencySymbol as getCurrencySymbolUtil } from './currency';

// Create Context
const CurrencyContext = createContext(undefined);

// Provider Component
export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  // Function to load currency from settings
  const loadCurrency = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const res = await adminAPI.getSettings();
        if (res.data?.default_currency) {
          setCurrency(res.data.default_currency);
        }
      }
    } catch (error) {
      console.log('Using default currency:', DEFAULT_CURRENCY);
    } finally {
      setLoading(false);
    }
  };

  // Load currency from settings on mount
  useEffect(() => {
    loadCurrency();
    
    // Also listen for storage changes (login/logout)
    const handleStorageChange = (e) => {
      if (e.key === 'access_token') {
        loadCurrency();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Format currency with current context currency
  const formatCurrency = (amount, currencyOverride = null) => {
    return formatCurrencyUtil(amount, currencyOverride || currency);
  };

  // Get currency symbol
  const getCurrencySymbol = (currencyOverride = null) => {
    return getCurrencySymbolUtil(currencyOverride || currency);
  };

  // Update currency globally
  const updateCurrency = async (newCurrency) => {
    setCurrency(newCurrency);
    // Also save to backend
    try {
      await adminAPI.updateSettings({ default_currency: newCurrency });
    } catch (error) {
      console.error('Failed to save currency setting:', error);
    }
  };

  const value = {
    currency,
    setCurrency,
    updateCurrency,
    formatCurrency,
    getCurrencySymbol,
    loading,
    reloadCurrency: loadCurrency,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

// Hook to use currency context
export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

export default CurrencyContext;
