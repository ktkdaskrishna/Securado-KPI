import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { analyticsAPI } from './api';

// Default filter state
const defaultFilters = {
  timePeriod: 'all',
  year: null,
  quarter: null,
  month: null,
  salesRep: null,
  team: null,
  account: null,
  stage: null,
  dateField: 'create_date',
  productDirector: null,    // Product Director/Manager filter
  solutionCategory: null,   // Solution category filter
};

const GlobalFilterContext = createContext(null);

// Parse URL params to filter state
function parseUrlParams(searchParams) {
  const params = {};
  if (searchParams.get('year')) params.year = searchParams.get('year');
  if (searchParams.get('quarter')) params.quarter = searchParams.get('quarter');
  if (searchParams.get('month')) params.month = searchParams.get('month');
  if (searchParams.get('salesRep')) params.salesRep = searchParams.get('salesRep');
  if (searchParams.get('team')) params.team = searchParams.get('team');
  if (searchParams.get('account')) params.account = searchParams.get('account');
  if (searchParams.get('stage')) params.stage = searchParams.get('stage');
  if (searchParams.get('dateField')) params.dateField = searchParams.get('dateField');
  if (searchParams.get('timePeriod')) params.timePeriod = searchParams.get('timePeriod');
  if (searchParams.get('productDirector')) params.productDirector = searchParams.get('productDirector');
  if (searchParams.get('solutionCategory')) params.solutionCategory = searchParams.get('solutionCategory');
  return params;
}

// Convert filter state to URL params
function filtersToUrlParams(filters) {
  const params = new URLSearchParams();
  
  if (filters.year) params.set('year', filters.year);
  if (filters.quarter) params.set('quarter', filters.quarter);
  if (filters.month) params.set('month', filters.month);
  if (filters.salesRep) params.set('salesRep', filters.salesRep);
  if (filters.team) params.set('team', filters.team);
  if (filters.account) params.set('account', filters.account);
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.dateField && filters.dateField !== 'create_date') params.set('dateField', filters.dateField);
  if (filters.timePeriod && filters.timePeriod !== 'all') params.set('timePeriod', filters.timePeriod);
  if (filters.productDirector) params.set('productDirector', filters.productDirector);
  if (filters.solutionCategory) params.set('solutionCategory', filters.solutionCategory);
  return params;
}

export function GlobalFilterProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Initialize filters from URL on mount
  const [filters, setFilters] = useState(() => {
    const urlParams = parseUrlParams(searchParams);
    return { ...defaultFilters, ...urlParams };
  });
  
  const [filterOptions, setFilterOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const isUpdatingUrl = useRef(false);

  const loadFilterOptions = useCallback(async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
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

  // Load on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    if (token && !loadedRef.current && !loading) {
      loadFilterOptions();
    }
  }, [loadFilterOptions, loading]);

  // Sync URL params to filters when URL changes (e.g., browser back/forward)
  useEffect(() => {
    if (isUpdatingUrl.current) {
      isUpdatingUrl.current = false;
      return;
    }
    
    const urlParams = parseUrlParams(searchParams);
    const hasUrlParams = Object.keys(urlParams).length > 0;
    
    if (hasUrlParams) {
      setFilters(prev => ({ ...defaultFilters, ...urlParams }));
    }
  }, [searchParams]);

  // Update URL when filters change
  const syncFiltersToUrl = useCallback((newFilters) => {
    isUpdatingUrl.current = true;
    const params = filtersToUrlParams(newFilters);
    const paramString = params.toString();
    
    // Only update if params have changed
    const currentParams = searchParams.toString();
    if (paramString !== currentParams) {
      // Use replace to avoid polluting browser history on every filter change
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [key]: value
      };
      // Sync to URL
      syncFiltersToUrl(newFilters);
      return newFilters;
    });
  }, [syncFiltersToUrl]);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    // Clear URL params
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const setMultipleFilters = useCallback((newFilters) => {
    setFilters(prev => {
      const updated = {
        ...prev,
        ...newFilters
      };
      syncFiltersToUrl(updated);
      return updated;
    });
  }, [syncFiltersToUrl]);

  // Build query params for API calls - THIS IS THE KEY FIX
  const getQueryParams = useCallback(() => {
    const params = {};
    
    // Always include these if set
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
    if (filters.timePeriod && filters.timePeriod !== 'all') {
      params.time_period = filters.timePeriod;
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
      (filters.timePeriod && filters.timePeriod !== 'all') ||
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
  // Include future years for forecasting
  for (let year = currentYear + 2; year >= currentYear - 5; year--) {
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
