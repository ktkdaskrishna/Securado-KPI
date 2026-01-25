import React, { useState } from 'react';
import './ApiDocs.css';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const apiEndpoints = {
  'Authentication': [
    { method: 'POST', path: '/api/auth/register', desc: 'Register a new user (status: pending)', body: {email: 'user@example.com', name: 'John Doe', password: 'secure123'} },
    { method: 'POST', path: '/api/auth/login', desc: 'Login and get JWT tokens', body: {email: 'admin@platform2.com', password: 'admin123'} },
    { method: 'POST', path: '/api/auth/refresh', desc: 'Refresh access token', body: {refresh_token: 'YOUR_REFRESH_TOKEN'} },
    { method: 'GET', path: '/api/auth/me', desc: 'Get current user info', auth: true },
    { method: 'GET', path: '/api/auth/users', desc: 'List all users', auth: true },
    { method: 'GET', path: '/api/health', desc: 'Backend health check', auth: false },
  ],
  'Admin - Roles & Permissions': [
    { method: 'GET', path: '/api/admin/roles', desc: 'List all roles', auth: true },
    { method: 'POST', path: '/api/admin/roles', desc: 'Create a new role', auth: true, body: {name: 'sales_rep', description: 'Sales Representative', permissions: ['opportunities:read']} },
    { method: 'GET', path: '/api/admin/roles/{role_id}', desc: 'Get single role', auth: true },
    { method: 'PUT', path: '/api/admin/roles/{role_id}', desc: 'Update role', auth: true },
    { method: 'DELETE', path: '/api/admin/roles/{role_id}', desc: 'Delete role', auth: true },
    { method: 'GET', path: '/api/admin/permissions', desc: 'List all permissions', auth: true },
    { method: 'POST', path: '/api/admin/permissions', desc: 'Create permission', auth: true },
    { method: 'GET', path: '/api/admin/me/permissions', desc: 'Get my permissions', auth: true },
  ],
  'Admin - Users': [
    { method: 'GET', path: '/api/admin/users', desc: 'List all users', auth: true },
    { method: 'GET', path: '/api/admin/users/{user_id}', desc: 'Get single user', auth: true },
    { method: 'POST', path: '/api/admin/users', desc: 'Create user (admin)', auth: true },
    { method: 'PUT', path: '/api/admin/users/{user_id}', desc: 'Update user', auth: true },
    { method: 'DELETE', path: '/api/admin/users/{user_id}', desc: 'Delete user', auth: true },
    { method: 'POST', path: '/api/admin/users/{user_id}/approve', desc: 'Approve pending user', auth: true },
    { method: 'POST', path: '/api/admin/users/{user_id}/reject', desc: 'Reject pending user', auth: true },
    { method: 'PATCH', path: '/api/admin/users/{user_id}/assign-role', desc: 'Assign role to user', auth: true },
    { method: 'POST', path: '/api/admin/users/bulk-assign-role', desc: 'Bulk assign role', auth: true },
  ],
  'Admin - Departments & Logs': [
    { method: 'GET', path: '/api/admin/departments', desc: 'List departments', auth: true },
    { method: 'POST', path: '/api/admin/departments', desc: 'Create department', auth: true },
    { method: 'PUT', path: '/api/admin/departments/{dept_id}', desc: 'Update department', auth: true },
    { method: 'GET', path: '/api/admin/logs/errors', desc: 'Get error logs', auth: true },
    { method: 'GET', path: '/api/admin/logs/sessions', desc: 'Get session logs', auth: true },
    { method: 'GET', path: '/api/admin/logs/api-calls', desc: 'Get API call logs', auth: true },
    { method: 'GET', path: '/api/admin/logs/stats', desc: 'Get log statistics', auth: true },
  ],
  'Config - System': [
    { method: 'GET', path: '/api/config/widgets', desc: 'Get available system widgets', auth: false },
    { method: 'GET', path: '/api/config/navigation-items', desc: 'Get navigation items', auth: false },
    { method: 'GET', path: '/api/config/pipeline-stages', desc: 'List pipeline stages', auth: true },
    { method: 'POST', path: '/api/config/pipeline-stages', desc: 'Create pipeline stage', auth: true },
    { method: 'GET', path: '/api/config/service-lines', desc: 'List service lines', auth: true },
    { method: 'POST', path: '/api/config/service-lines', desc: 'Create service line', auth: true },
  ],
  'Config - User & Targets': [
    { method: 'GET', path: '/api/config/user/dashboard', desc: 'Get user dashboard config', auth: true },
    { method: 'PUT', path: '/api/config/user/dashboard', desc: 'Update user dashboard', auth: true },
    { method: 'GET', path: '/api/config/bluesheet-weights', desc: 'Get bluesheet weights', auth: true },
    { method: 'PUT', path: '/api/config/bluesheet-weights', desc: 'Update bluesheet weights', auth: true },
    { method: 'GET', path: '/api/config/targets', desc: 'List targets', auth: true },
    { method: 'POST', path: '/api/config/targets', desc: 'Create target', auth: true },
  ],
  'Data Lake': [
    { method: 'GET', path: '/api/data-lake/health', desc: 'Check canonical DB health', auth: false },
    { method: 'GET', path: '/api/data-lake/canonical', desc: 'Browse canonical data', auth: true, params: '?entity_type=opportunities&limit=10' },
    { method: 'GET', path: '/api/data-lake/serving', desc: 'Get serving cache data', auth: true },
    { method: 'GET', path: '/api/search', desc: 'Search across entities', auth: true, params: '?q=test' },
  ],
  'Sales - Opportunities': [
    { method: 'GET', path: '/api/opportunities', desc: 'List opportunities', auth: true },
    { method: 'GET', path: '/api/opportunities/kanban', desc: 'Get kanban view by stage', auth: true },
    { method: 'GET', path: '/api/opportunities/{opp_id}', desc: 'Get single opportunity', auth: true },
    { method: 'PATCH', path: '/api/opportunities/{opp_id}/stage', desc: 'Update opportunity stage', auth: true, body: {stage: 'Qualified'} },
    { method: 'POST', path: '/api/opportunities/{opp_id}/calculate-probability', desc: 'Calculate probability', auth: true, body: {probability: 75} },
  ],
  'Sales - Accounts & Activities': [
    { method: 'GET', path: '/api/accounts', desc: 'List accounts', auth: true },
    { method: 'GET', path: '/api/accounts/{account_id}/360', desc: 'Get 360 account view', auth: true },
    { method: 'POST', path: '/api/accounts', desc: 'Create local account', auth: true },
    { method: 'GET', path: '/api/activities', desc: 'List activities', auth: true },
    { method: 'POST', path: '/api/activities', desc: 'Create activity', auth: true, body: {activity_type: 'call', subject: 'Follow up call'} },
    { method: 'PATCH', path: '/api/activities/{activity_id}/status', desc: 'Update activity status', auth: true },
  ],
  'Sales - KPIs & Metrics': [
    { method: 'GET', path: '/api/kpis', desc: 'List KPIs', auth: true },
    { method: 'POST', path: '/api/kpis', desc: 'Create KPI', auth: true },
    { method: 'GET', path: '/api/receivables', desc: 'List receivables (stub)', auth: true },
    { method: 'GET', path: '/api/sales-metrics/{user_id}', desc: 'Get user sales metrics', auth: true },
  ],
  'Dashboard': [
    { method: 'GET', path: '/api/dashboard/stats', desc: 'Get dashboard statistics', auth: true },
    { method: 'POST', path: '/api/dashboard/refresh', desc: 'Manual cache rebuild', auth: true },
    { method: 'GET', path: '/api/dashboard/sync-status', desc: 'Get sync status', auth: true },
  ],
  'Goals': [
    { method: 'GET', path: '/api/goals', desc: 'List goals', auth: true },
    { method: 'POST', path: '/api/goals', desc: 'Create goal', auth: true },
    { method: 'GET', path: '/api/goals/{goal_id}', desc: 'Get single goal', auth: true },
    { method: 'PATCH', path: '/api/goals/{goal_id}/progress', desc: 'Update goal progress', auth: true },
    { method: 'GET', path: '/api/goals/summary/stats', desc: 'Get goal summary statistics', auth: true },
  ],
  'Teams': [
    { method: 'POST', path: '/api/teams', desc: 'Create team', auth: true },
    { method: 'GET', path: '/api/teams', desc: 'List teams', auth: true },
    { method: 'GET', path: '/api/teams/{team_id}', desc: 'Get single team', auth: true },
    { method: 'POST', path: '/api/teams/{team_id}/members', desc: 'Add team member', auth: true },
    { method: 'GET', path: '/api/teams/my-teams', desc: 'Get my teams', auth: true },
  ],
  'Portfolios & Initiatives': [
    { method: 'POST', path: '/api/portfolios', desc: 'Create portfolio', auth: true },
    { method: 'GET', path: '/api/portfolios', desc: 'List portfolios', auth: true },
    { method: 'GET', path: '/api/portfolios/{portfolio_id}/dashboard', desc: 'Get portfolio dashboard', auth: true },
    { method: 'POST', path: '/api/initiatives', desc: 'Create initiative', auth: true },
    { method: 'GET', path: '/api/initiatives', desc: 'List initiatives', auth: true },
    { method: 'PATCH', path: '/api/initiatives/{initiative_id}/status', desc: 'Update initiative status', auth: true },
  ],
};

function ApiDocs() {
  const [token, setToken] = useState(localStorage.getItem('api_token') || '');
  const [email, setEmail] = useState('admin@platform2.com');
  const [password, setPassword] = useState('admin123');
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Authentication');

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.access_token) {
        setToken(data.access_token);
        localStorage.setItem('api_token', data.access_token);
        setResponse({ success: true, message: 'Login successful!', data });
      } else {
        setResponse({ success: false, error: data });
      }
    } catch (error) {
      setResponse({ success: false, error: error.message });
    }
    setLoading(false);
  };

  const testEndpoint = async (endpoint) => {
    setLoading(true);
    setSelectedEndpoint(endpoint);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (endpoint.auth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `${API_BASE}${endpoint.path}${endpoint.params || ''}`;
      const options = {
        method: endpoint.method,
        headers
      };

      if (endpoint.body && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        options.body = JSON.stringify(endpoint.body);
      }

      const res = await fetch(url, options);
      const contentType = res.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      
      setResponse({ success: res.ok, status: res.status, data });
    } catch (error) {
      setResponse({ success: false, error: error.message });
    }
    setLoading(false);
  };

  const filteredEndpoints = Object.entries(apiEndpoints).reduce((acc, [category, endpoints]) => {
    const filtered = endpoints.filter(e => 
      e.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.desc.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {});

  return (
    <div className="api-docs">
      <header className="docs-header">
        <div className="header-content">
          <h1>🚀 Platform 2 API Documentation</h1>
          <p>Sales Dashboard Backend - 71 Endpoints</p>
        </div>
      </header>

      <div className="docs-container">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <div className="auth-section">
            <h3>🔐 Authentication</h3>
            {!token ? (
              <div className="login-form">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button onClick={handleLogin} disabled={loading}>
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            ) : (
              <div className="token-info">
                <p className="success">✓ Authenticated</p>
                <button onClick={() => { setToken(''); localStorage.removeItem('api_token'); }}>Logout</button>
              </div>
            )}
          </div>

          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search endpoints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <nav className="category-nav">
            {Object.keys(filteredEndpoints).map(category => (
              <button
                key={category}
                className={activeCategory === category ? 'active' : ''}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="docs-main">
          <div className="endpoints-list">
            {Object.entries(filteredEndpoints).map(([category, endpoints]) => (
              <div key={category} className="category-section" id={category}>
                <h2>{category}</h2>
                {endpoints.map((endpoint, idx) => (
                  <div key={idx} className="endpoint-card">
                    <div className="endpoint-header">
                      <span className={`method method-${endpoint.method.toLowerCase()}`}>
                        {endpoint.method}
                      </span>
                      <code className="path">{endpoint.path}</code>
                      {endpoint.auth && <span className="auth-badge">🔒 Auth Required</span>}
                    </div>
                    <p className="endpoint-desc">{endpoint.desc}</p>
                    {endpoint.params && (
                      <div className="params">
                        <strong>Query Params:</strong> <code>{endpoint.params}</code>
                      </div>
                    )}
                    {endpoint.body && (
                      <div className="request-body">
                        <strong>Request Body:</strong>
                        <pre>{JSON.stringify(endpoint.body, null, 2)}</pre>
                      </div>
                    )}
                    <button
                      className="test-btn"
                      onClick={() => testEndpoint(endpoint)}
                      disabled={loading || (endpoint.auth && !token)}
                    >
                      {endpoint.auth && !token ? '🔒 Login Required' : '▶ Test Endpoint'}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </main>

        {/* Response Panel */}
        {response && (
          <aside className="response-panel">
            <div className="panel-header">
              <h3>Response</h3>
              <button onClick={() => setResponse(null)}>✕</button>
            </div>
            {selectedEndpoint && (
              <div className="tested-endpoint">
                <span className={`method method-${selectedEndpoint.method.toLowerCase()}`}>
                  {selectedEndpoint.method}
                </span>
                <code>{selectedEndpoint.path}</code>
              </div>
            )}
            <div className={`response-content ${response.success ? 'success' : 'error'}`}>
              {response.status && (
                <div className="status-code">
                  Status: <span className={response.success ? 'status-success' : 'status-error'}>
                    {response.status}
                  </span>
                </div>
              )}
              <pre>{JSON.stringify(response.data || response.error, null, 2)}</pre>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default ApiDocs;
