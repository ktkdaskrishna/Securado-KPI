/**
 * Microsoft Login Button
 * Uses MSAL.js browser library with POPUP login (not redirect)
 * This approach is more reliable and matches the working Sales-Command implementation
 */
import React, { useState, useEffect, useCallback } from 'react';
import { PublicClientApplication, LogLevel } from '@azure/msal-browser';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

// Microsoft logo SVG
const MicrosoftLogo = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
  </svg>
);

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// MSAL configuration generator
const getMsalConfig = (clientId, tenantId) => ({
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: `${window.location.origin}/login`,
    postLogoutRedirectUri: `${window.location.origin}/login`,
    navigateToLoginRequestUrl: false, // Changed to false to prevent redirect issues
  },
  cache: {
    cacheLocation: 'localStorage', // Changed from sessionStorage to localStorage for better persistence
    storeAuthStateInCookie: true, // Enable for IE11/Edge compatibility and cross-domain scenarios
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error('[MSAL]', message);
        else if (level === LogLevel.Warning) console.warn('[MSAL]', message);
        else if (level === LogLevel.Info) console.info('[MSAL]', message);
      },
      logLevel: LogLevel.Info, // Increased logging for debugging
    },
    allowNativeBroker: false,
  },
});

// Login request scopes
const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

const MicrosoftLoginButton = ({ className = '', onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msalInstance, setMsalInstance] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Initialize MSAL when component mounts
  useEffect(() => {
    const initMsal = async () => {
      try {
        // Fetch Microsoft config from backend
        const configResponse = await fetch(`${API_URL}/api/auth/microsoft/config`);
        const config = await configResponse.json();
        
        if (config.clientId && config.tenantId) {
          console.log('[MSAL] Initializing with clientId:', config.clientId.substring(0, 8) + '...');
          const msalConfig = getMsalConfig(config.clientId, config.tenantId);
          const pca = new PublicClientApplication(msalConfig);
          await pca.initialize();
          setMsalInstance(pca);
          setConfigLoaded(true);
          console.log('[MSAL] Initialized successfully');
          
          // Handle any pending redirect response
          handleRedirectResponse(pca);
        } else {
          console.warn('[MSAL] Microsoft SSO not configured');
          setConfigLoaded(false);
        }
      } catch (err) {
        console.error('[MSAL] Failed to initialize:', err);
        setConfigLoaded(false);
      }
    };
    
    initMsal();
  }, []);

  // Handle redirect response if user was redirected back from Microsoft
  const handleRedirectResponse = useCallback(async (pca) => {
    try {
      const response = await pca.handleRedirectPromise();
      if (response && response.accessToken) {
        console.log('[MSAL] Got redirect response, completing login...');
        setMsLoading(true);
        await completeMicrosoftLogin(response);
      }
    } catch (err) {
      // Ignore no_token_request_cache_error as it's expected when no redirect is in progress
      if (err.errorCode === 'no_token_request_cache_error') {
        console.log('[MSAL] No redirect in progress (this is normal on fresh page load)');
        return;
      }
      console.error('[MSAL] Redirect response error:', err);
      setError(err.message || 'Microsoft login failed');
      setMsLoading(false);
    }
  }, []);

  // Complete Microsoft login by sending tokens to our backend
  const completeMicrosoftLogin = async (msalResponse) => {
    try {
      console.log('[MSAL] Sending tokens to backend...');
      
      // Send Microsoft auth data to our backend
      const response = await fetch(`${API_URL}/api/auth/microsoft/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: msalResponse.accessToken,
          id_token: msalResponse.idToken,
          account: {
            username: msalResponse.account.username,
            name: msalResponse.account.name,
            localAccountId: msalResponse.account.localAccountId,
            tenantId: msalResponse.account.tenantId,
          }
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MSAL] Backend error:', errorText);
        setError('Failed to complete Microsoft login');
        onError?.(new Error(errorText));
        return;
      }
      
      const data = await response.json();
      
      if (data.access_token) {
        console.log('[MSAL] Login successful, storing token...');
        
        // Store token in localStorage
        localStorage.setItem('access_token', data.access_token);
        
        // Store user info
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        // Navigate to dashboard
        window.location.href = '/dashboard';
        onSuccess?.();
      } else {
        setError(data.detail || 'Failed to complete login');
        onError?.(new Error(data.detail));
      }
    } catch (err) {
      console.error('[MSAL] Login completion error:', err);
      setError(err.message || 'Failed to complete Microsoft login');
      onError?.(err);
    } finally {
      setMsLoading(false);
    }
  };

  // Handle Microsoft login button click
  const handleMicrosoftLogin = async () => {
    if (!msalInstance) {
      setError('Microsoft SSO not configured. Please contact your administrator.');
      return;
    }

    setMsLoading(true);
    setError(null);
    
    try {
      console.log('[MSAL] Starting popup login...');
      
      // Use popup login (more reliable than redirect)
      const response = await msalInstance.loginPopup(loginRequest);
      console.log('[MSAL] Popup login successful');
      await completeMicrosoftLogin(response);
      
    } catch (err) {
      console.error('[MSAL] Login error:', err);
      
      // Handle specific MSAL errors
      if (err.errorCode === 'user_cancelled') {
        setError('Login was cancelled');
      } else if (err.errorCode === 'popup_window_error') {
        // Fallback to redirect if popup is blocked
        console.log('[MSAL] Popup blocked, trying redirect...');
        try {
          await msalInstance.loginRedirect(loginRequest);
        } catch (redirectErr) {
          setError('Failed to initiate Microsoft login');
        }
      } else {
        setError(err.message || 'Microsoft login failed');
      }
      onError?.(err);
      setMsLoading(false);
    }
  };

  // Show disabled state if not configured
  if (!configLoaded && !msalInstance) {
    return (
      <div className={className}>
        <Button
          type="button"
          variant="outline"
          disabled
          className="w-full bg-white/5 border-white/20 text-gray-400 cursor-not-allowed"
          data-testid="microsoft-login-btn-loading"
        >
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Loading Microsoft SSO...
        </Button>
      </div>
    );
  }

  if (configLoaded === false) {
    return (
      <div className={className}>
        <Button
          type="button"
          variant="outline"
          disabled
          className="w-full bg-white/5 border-white/20 text-gray-400 cursor-not-allowed"
          data-testid="microsoft-login-btn-disabled"
        >
          <MicrosoftLogo />
          Sign in with Microsoft
        </Button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Microsoft SSO not configured
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {error && (
        <Alert variant="destructive" className="mb-3 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
      )}
      
      <Button
        type="button"
        variant="outline"
        onClick={handleMicrosoftLogin}
        disabled={msLoading}
        className="w-full bg-white hover:bg-gray-100 text-gray-900 border-gray-300"
        data-testid="microsoft-login-btn"
      >
        {msLoading ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <MicrosoftLogo />
        )}
        Sign in with Microsoft
      </Button>
    </div>
  );
};

export default MicrosoftLoginButton;
