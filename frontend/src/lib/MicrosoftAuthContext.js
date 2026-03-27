import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginRequest, isMicrosoftAuthConfigured, apiConfig } from './msalConfig';
import { useAuth } from './AuthContext';

const MicrosoftAuthContext = createContext(null);

// Initialize MSAL instance only if configured
let msalInstance = null;
if (isMicrosoftAuthConfigured()) {
  msalInstance = new PublicClientApplication(msalConfig);
}

export const MicrosoftAuthProvider = ({ children }) => {
  const { login: appLogin } = useAuth();
  const [isConfigured, setIsConfigured] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [msAccount, setMsAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check configuration on mount
  useEffect(() => {
    const checkConfig = async () => {
      // Check frontend config
      const frontendConfigured = isMicrosoftAuthConfigured();
      
      // Also check backend config
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}${apiConfig.statusEndpoint}`);
        const data = await response.json();
        setIsConfigured(frontendConfigured || data.configured);
      } catch (err) {
        setIsConfigured(frontendConfigured);
      }
    };
    
    checkConfig();
  }, []);

  // Initialize MSAL
  useEffect(() => {
    const initMsal = async () => {
      if (!msalInstance) {
        setIsInitialized(true);
        return;
      }
      
      try {
        await msalInstance.initialize();
        
        // Handle redirect response
        const response = await msalInstance.handleRedirectPromise();
        if (response) {
          setMsAccount(response.account);
          // Exchange Microsoft token for app token
          await exchangeTokenForAppLogin(response.accessToken);
        } else {
          // Check for existing accounts
          const accounts = msalInstance.getAllAccounts();
          if (accounts.length > 0) {
            setMsAccount(accounts[0]);
          }
        }
        
        setIsInitialized(true);
      } catch (err) {
        console.error('MSAL initialization error:', err);
        setError(err.message);
        setIsInitialized(true);
      }
    };
    
    initMsal();
  }, []);

  // Exchange Microsoft token for app JWT
  const exchangeTokenForAppLogin = useCallback(async (accessToken) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${apiConfig.tokenLoginEndpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken }),
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to exchange Microsoft token');
      }
      
      const data = await response.json();
      
      // Use the app's auth context to complete login
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/'; // Refresh to apply auth
      }
      
      return data;
    } catch (err) {
      console.error('Token exchange error:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  // Login with Microsoft
  const loginWithMicrosoft = useCallback(async () => {
    if (!msalInstance) {
      // Fallback: Use backend redirect flow
      window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/microsoft/login?redirect_to=${encodeURIComponent(window.location.origin)}`;
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Try popup first
      const response = await msalInstance.loginPopup(loginRequest);
      setMsAccount(response.account);
      
      // Exchange for app token
      await exchangeTokenForAppLogin(response.accessToken);
    } catch (err) {
      if (err.name === 'BrowserAuthError' || err.message?.includes('popup')) {
        // Popup blocked, try redirect
        try {
          await msalInstance.loginRedirect(loginRequest);
        } catch (redirectErr) {
          setError(redirectErr.message);
        }
      } else {
        console.error('Microsoft login error:', err);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [exchangeTokenForAppLogin]);

  // Logout from Microsoft
  const logoutFromMicrosoft = useCallback(async () => {
    if (!msalInstance) return;
    
    try {
      await msalInstance.logoutPopup();
      setMsAccount(null);
    } catch (err) {
      console.error('Microsoft logout error:', err);
    }
  }, []);

  // Acquire token silently (for API calls)
  const acquireTokenSilent = useCallback(async () => {
    if (!msalInstance || !msAccount) return null;
    
    try {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: msAccount,
      });
      return response.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        // Need interactive login
        return loginWithMicrosoft();
      }
      throw err;
    }
  }, [msAccount, loginWithMicrosoft]);

  const value = {
    isConfigured,
    isInitialized,
    msAccount,
    loading,
    error,
    loginWithMicrosoft,
    logoutFromMicrosoft,
    acquireTokenSilent,
    msalInstance,
  };

  return (
    <MicrosoftAuthContext.Provider value={value}>
      {children}
    </MicrosoftAuthContext.Provider>
  );
};

export const useMicrosoftAuth = () => {
  const context = useContext(MicrosoftAuthContext);
  if (!context) {
    throw new Error('useMicrosoftAuth must be used within MicrosoftAuthProvider');
  }
  return context;
};

export default MicrosoftAuthContext;
