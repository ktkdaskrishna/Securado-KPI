/**
 * Microsoft Authentication Configuration
 * 
 * This file configures MSAL (Microsoft Authentication Library) for Azure AD SSO.
 * 
 * To configure:
 * 1. Create an App Registration in Azure Portal (portal.azure.com)
 * 2. Set the values below or use environment variables:
 *    - REACT_APP_MICROSOFT_CLIENT_ID
 *    - REACT_APP_MICROSOFT_TENANT_ID
 */

// Get config from environment or use empty placeholders
const clientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID || '';
const tenantId = process.env.REACT_APP_MICROSOFT_TENANT_ID || '';

export const msalConfig = {
  auth: {
    clientId: clientId,
    authority: tenantId ? `https://login.microsoftonline.com/${tenantId}` : '',
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage', // 'localStorage' for persistent login
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (process.env.NODE_ENV === 'development') {
          console.log(`[MSAL] ${message}`);
        }
      },
    },
  },
};

// Scopes for Microsoft Graph API
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

// Check if Microsoft auth is configured
export const isMicrosoftAuthConfigured = () => {
  return Boolean(clientId && tenantId);
};

// API endpoint for token exchange
export const apiConfig = {
  tokenLoginEndpoint: '/api/auth/microsoft/token-login',
  statusEndpoint: '/api/auth/microsoft/status',
  configEndpoint: '/api/auth/microsoft/config',
};
