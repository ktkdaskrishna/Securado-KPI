import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// CRITICAL: Process Microsoft SSO token BEFORE React renders anything
// This prevents any API calls from being made with stale/no token
(function handleMicrosoftSSORedirect() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const provider = urlParams.get('provider');
  
  if (token && provider === 'microsoft') {
    console.log('[SSO] Microsoft token detected in URL, processing...');
    
    // Store token immediately
    localStorage.setItem('access_token', token);
    
    // Decode and store user info
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
      console.log('[SSO] Token stored for:', payload.email);
    } catch (e) {
      console.error('[SSO] Failed to decode token:', e);
    }
    
    // CRITICAL: Stop all execution and redirect immediately
    // This prevents React from mounting and making API calls
    console.log('[SSO] Redirecting to dashboard...');
    window.location.href = '/dashboard';
    
    // Throw to stop any further code execution
    throw new Error('SSO_REDIRECT');
  }
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
