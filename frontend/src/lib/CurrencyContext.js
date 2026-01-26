import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminAPI } from './api';
import { DEFAULT_CURRENCY, formatCurrency as formatCurrencyUtil, getCurrencySymbol as getCurrencySymbolUtil } from './currency';

// Create Context
const CurrencyContext = createContext(undefined);

// Provider Component
export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  // Load currency from settings on mount
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        // Only attempt to load settings if user is likely logged in (has token)
        const token = localStorage.getItem('token');
        if (token) {
          const res = await adminAPI.getSettings();
          if (res.data?.default_currency) {
            setCurrency(res.data.default_currency);
          }
        }
      } catch (error) {
        // Use default currency if settings not available
        console.log('Using default currency:', DEFAULT_CURRENCY);
      } finally {
        setLoading(false);
      }
    };

    loadCurrency();
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
