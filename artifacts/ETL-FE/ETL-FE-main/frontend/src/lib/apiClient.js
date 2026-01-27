import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
// Platform 2 backend URL for production use
const PLATFORM2_URL = 'https://dataflow-designer.preview.emergentagent.com';

// Check if we should use Platform 2 backend (can be set via localStorage)
const getApiBase = () => {
  const usePlatform2 = localStorage.getItem('usePlatform2Backend') === 'true';
  return usePlatform2 ? `${PLATFORM2_URL}/api` : `${BACKEND_URL}/api`;
};

export const API_BASE = getApiBase();

export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Dynamic baseURL interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Always use current setting
    config.baseURL = getApiBase();
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper functions to switch backends
export const switchToPlatform2 = () => {
  localStorage.setItem('usePlatform2Backend', 'true');
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  window.location.reload();
};

export const switchToLocal = () => {
  localStorage.setItem('usePlatform2Backend', 'false');
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  window.location.reload();
};

export const isUsingPlatform2 = () => {
  return localStorage.getItem('usePlatform2Backend') === 'true';
};

export default apiClient;
