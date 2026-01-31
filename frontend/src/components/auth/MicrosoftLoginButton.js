import React, { useState, useEffect } from 'react';
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

const MicrosoftLoginButton = ({ className = '', onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [configStatus, setConfigStatus] = useState(null);

  // Check if Microsoft auth is configured
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/auth/microsoft/status`
        );
        const data = await response.json();
        setConfigStatus(data);
      } catch (err) {
        console.error('Failed to check Microsoft auth config:', err);
        setConfigStatus({ configured: false, message: 'Failed to check configuration' });
      }
    };
    
    checkConfig();
  }, []);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if configured
      if (!configStatus?.configured) {
        setError('Microsoft SSO is not configured. Please contact your administrator.');
        return;
      }
      
      // Redirect to backend Microsoft auth endpoint
      // The backend will handle the OAuth flow and redirect back
      const redirectTo = encodeURIComponent(window.location.origin);
      window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/microsoft/login?redirect_to=${redirectTo}`;
      
    } catch (err) {
      console.error('Microsoft login error:', err);
      setError(err.message || 'Failed to initiate Microsoft login');
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth callback token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const provider = urlParams.get('provider');
    const errorParam = urlParams.get('error');
    const errorMessage = urlParams.get('message');
    
    if (errorParam) {
      setError(decodeURIComponent(errorMessage || errorParam));
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    
    if (token && provider === 'microsoft') {
      // Store token using the same key as the main auth system
      localStorage.setItem('access_token', token);
      
      // Decode token to get user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        localStorage.setItem('user', JSON.stringify({
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          org_id: payload.org_id,
          access_level: payload.access_level,
          rbac_linked: payload.rbac_linked,
        }));
      } catch (e) {
        console.error('Failed to decode token:', e);
      }
      
      // Clean URL and redirect to dashboard
      window.history.replaceState({}, '', '/dashboard');
      window.location.href = '/dashboard';
      onSuccess?.();
    }
  }, [onSuccess]);

  // Show configuration status if not configured
  if (configStatus && !configStatus.configured) {
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
        disabled={loading}
        className="w-full bg-white hover:bg-gray-100 text-gray-900 border-gray-300"
        data-testid="microsoft-login-btn"
      >
        {loading ? (
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
