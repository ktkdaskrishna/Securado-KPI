import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { analyticsAPI } from './api';

// Default filter state
const defaultFilters = {
  timePeriod: 'all',        // all, year, quarter, month, week
  year: null,               // 2024, 2025, etc.
  quarter: null,            // Q1, Q2, Q3, Q4
  month: null,              // 1-12
  salesRep: null,           // owner_name
  team: null,               // team_id
  account: null,            // account_id or account_name
  stage: null,              // stage name
  dateField: 'close_date',  // which date to filter on: close_date, create_date
};

const GlobalFilterContext = createContext(null);

export function GlobalFilterProvider({ children }) {
  const [filters, setFilters] = useState(defaultFilters);
  const [filterOptions, setFilterOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const loadFilterOptions = useCallback(async () => {
    // Don't load if no token (not logged in) or already loading/loaded
    const token = localStorage.getItem('token');
    if (!token || loading || loadedRef.current) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await analyticsAPI.getFilters();
      setFilterOptions(response.data);
      loadedRef.current = true;
    } catch (error) {
      console.error('Failed to load filter options:', error);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Simple effect to load on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !loadedRef.current && !loading) {
      loadFilterOptions();
    }
  }, [loadFilterOptions, loading]);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const setMultipleFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  // Build query params for API calls
  const getQueryParams = useCallback(() => {
    const params = {};
    
    if (filters.timePeriod && filters.timePeriod !== 'all') {
      params.time_period = filters.timePeriod;
    }
    if (filters.year) {
      params.year = filters.year;
    }
    if (filters.quarter) {
      params.quarter = filters.quarter;
    }
    if (filters.month) {
      params.month = filters.month;
    }
    if (filters.salesRep) {
      params.sales_rep = filters.salesRep;
    }
    if (filters.team) {
      params.team_id = filters.team;
    }
    if (filters.account) {
      params.account = filters.account;
    }
    if (filters.stage) {
      params.stage = filters.stage;
    }
    if (filters.dateField) {
      params.date_field = filters.dateField;
    }
    
    return params;
  }, [filters]);

  // Get human-readable filter summary
  const getFilterSummary = useCallback(() => {
    const parts = [];
    
    if (filters.year) parts.push(`Year: ${filters.year}`);
    if (filters.quarter) parts.push(`Quarter: ${filters.quarter}`);
    if (filters.salesRep) parts.push(`Rep: ${filters.salesRep}`);
    if (filters.team) {
      const teamName = filterOptions?.teams?.find(t => t.id === filters.team)?.name || filters.team;
      parts.push(`Team: ${teamName}`);
    }
    if (filters.account) parts.push(`Account: ${filters.account}`);
    if (filters.stage) parts.push(`Stage: ${filters.stage}`);
    
    return parts.length > 0 ? parts.join(' • ') : 'All Data';
  }, [filters, filterOptions]);

  // Check if any filter is active
  const hasActiveFilters = useCallback(() => {
    return (
      filters.timePeriod !== 'all' ||
      filters.year !== null ||
      filters.quarter !== null ||
      filters.salesRep !== null ||
      filters.team !== null ||
      filters.account !== null ||
      filters.stage !== null
    );
  }, [filters]);

  const value = {
    filters,
    filterOptions,
    loading,
    updateFilter,
    resetFilters,
    setMultipleFilters,
    getQueryParams,
    getFilterSummary,
    hasActiveFilters,
    loadFilterOptions,
  };

  return (
    <GlobalFilterContext.Provider value={value}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilters() {
  const context = useContext(GlobalFilterContext);
  if (!context) {
    throw new Error('useGlobalFilters must be used within GlobalFilterProvider');
  }
  return context;
}

// Helper to get years for filtering
export function getYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year >= currentYear - 5; year--) {
    years.push({ value: year.toString(), label: year.toString() });
  }
  return years;
}

// Helper to get quarter options
export function getQuarterOptions() {
  return [
    { value: 'Q1', label: 'Q1 (Jan-Mar)' },
    { value: 'Q2', label: 'Q2 (Apr-Jun)' },
    { value: 'Q3', label: 'Q3 (Jul-Sep)' },
    { value: 'Q4', label: 'Q4 (Oct-Dec)' },
  ];
}

// Helper to get month options
export function getMonthOptions() {
  return [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];
}
