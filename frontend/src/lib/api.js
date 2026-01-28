import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
  me: () => api.get('/auth/me'),
};

// Admin APIs
export const adminAPI = {
  listUsers: (status) => api.get('/admin/users', { params: { status } }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  approveUser: (id) => api.post(`/admin/users/${id}/approve`),
  rejectUser: (id, reason) => api.post(`/admin/users/${id}/reject`, null, { params: { reason } }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  listRoles: () => api.get('/admin/roles'),
  createRole: (data) => api.post('/admin/roles', data),
  updateRole: (id, data) => api.put(`/admin/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/admin/roles/${id}`),
  listPermissions: () => api.get('/admin/permissions'),
  listDepartments: () => api.get('/admin/departments'),
  createDepartment: (data) => api.post('/admin/departments', data),
  updateDepartment: (id, data) => api.put(`/admin/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/admin/departments/${id}`),
  updateUserRoles: (userId, roles) => api.put(`/admin/users/${userId}/roles`, { roles }),
  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
};

// ETL APIs
export const etlAPI = {
  // Connections
  listConnections: () => api.get('/integrations'),
  getConnection: (id) => api.get(`/integrations/${id}`),
  createConnection: (data) => api.post('/integrations', data),
  updateConnection: (id, data) => api.put(`/integrations/${id}`, data),
  deleteConnection: (id) => api.delete(`/integrations/${id}`),
  testConnection: (id) => api.post(`/integrations/${id}/test`),
  discoverSchema: (id) => api.post(`/integrations/${id}/discover`),
  getSchema: (id) => api.get(`/integrations/${id}/schema`),
  getModelFields: (connId, modelName) => api.get(`/integrations/${connId}/schema/${modelName}/fields`),
  
  // Templates
  listTemplates: () => api.get('/templates'),
  getTemplate: (id) => api.get(`/templates/${id}`),
  createConnectionFromTemplate: (templateId, data) => api.post(`/templates/${templateId}/create-connection`, data),
  getTemplateDefaultMappings: (templateId, sourceModel) => api.get(`/templates/${templateId}/default-mappings/${sourceModel}`),
  
  // Mappings
  listMappings: (connectionId) => api.get('/mappings', { params: { connection_id: connectionId } }),
  getMapping: (id) => api.get(`/mappings/${id}`),
  createMapping: (data) => api.post('/mappings', data),
  updateMapping: (id, data) => api.put(`/mappings/${id}`, data),
  deleteMapping: (id) => api.delete(`/mappings/${id}`),
  previewMapping: (id, limit) => api.post(`/mappings/${id}/preview`, null, { params: { limit } }),
  autoSuggestMappings: (connectionId, sourceModel, targetEntity) => 
    api.post('/mappings/auto-suggest', null, { params: { connection_id: connectionId, source_model: sourceModel, target_entity: targetEntity } }),
  verifyMapping: (id) => api.post(`/mappings/${id}/verify`),
  
  // Pipelines
  listPipelines: () => api.get('/pipelines'),
  getPipeline: (id) => api.get(`/pipelines/${id}`),
  createPipeline: (data) => api.post('/pipelines', data),
  updatePipeline: (id, data) => api.put(`/pipelines/${id}`, data),
  deletePipeline: (id) => api.delete(`/pipelines/${id}`),
  runPipeline: (id) => api.post(`/pipelines/${id}/run`),
  getPipelineRuns: (id, limit) => api.get(`/pipelines/${id}/runs`, { params: { limit } }),
  
  // Runs
  listRuns: (limit) => api.get('/runs', { params: { limit } }),
  getRun: (id) => api.get(`/runs/${id}`),
  getRunLogs: (id) => api.get(`/runs/${id}/logs`),
  
  // Canonical/Data Lake
  getCanonicalModel: () => api.get('/integrations/canonical-model'),
  
  // Data Model
  getDataModel: () => api.get('/data-model'),
  saveDataModel: (data) => api.put('/data-model', data),
  regenerateDataModel: () => api.post('/data-model/regenerate'),
  
  // Visual Mapping Editor
  getMappingConfig: () => api.get('/mapping-editor/config'),
  saveMappingConfig: (data) => api.put('/mapping-editor/config', data),
  previewTransformation: (data) => api.post('/mapping-editor/preview', data),
  runMappingSync: (data) => api.post('/mapping-editor/sync', data),
  getSyncStatus: (connectionId) => api.get(`/mapping-editor/sync/status/${connectionId}`),
  getCanonicalEntities: () => api.get('/mapping-editor/entities'),
};

// Data Lake APIs
export const dataLakeAPI = {
  listCanonical: (entity, params) => api.get('/data-lake/canonical', { params: { entity, ...params } }),
  getCanonicalRecord: (entity, id) => api.get(`/data-lake/canonical/${entity}/${id}`),
  getStats: () => api.get('/data-lake/stats'),
  search: (q, entityTypes) => api.get('/search', { params: { q, entity_types: entityTypes } }),
};

// CRM APIs
export const crmAPI = {
  // Dashboard - now supports filters
  getDashboardStats: (params) => api.get('/dashboard/stats', { params }),
  refreshDashboard: () => api.post('/dashboard/refresh'),
  getSyncStatus: () => api.get('/dashboard/sync-status'),
  getProductManagerLeaderboard: (params) => api.get('/dashboard/product-manager-leaderboard', { params }),
  getCategoryStats: (params) => api.get('/dashboard/category-stats', { params }),
  
  // Opportunities - supports filters
  listOpportunities: (params) => api.get('/opportunities', { params }),
  getKanban: (params) => api.get('/opportunities/kanban', { params }),
  getOpportunity: (id) => api.get(`/opportunities/${id}`),
  updateStage: (id, stage) => api.patch(`/opportunities/${id}/stage`, { stage }),
  updateProbability: (id, probability) => api.post(`/opportunities/${id}/calculate-probability`, { probability }),
  getMessages: (id) => api.get(`/opportunities/${id}/messages`),
  getOpportunityActivities: (id) => api.get(`/opportunities/${id}/activities`),
  getOpportunityLogs: (id) => api.get(`/opportunities/${id}/logs`),  // Log messages/chatter
  createOpportunityNote: (id, data) => api.post(`/opportunities/${id}/notes`, data),
  exportOpportunities: (params) => api.get('/opportunities/export', { params, responseType: 'blob' }),
  getWonWithInvoices: (params) => api.get('/opportunities/won-with-invoices', { params }),
  
  // Bluesheet
  getBluesheet: (oppId) => api.get(`/opportunities/${oppId}/bluesheet`),
  updateBluesheet: (oppId, data) => api.put(`/opportunities/${oppId}/bluesheet`, data),
  calculateBluesheet: (oppId) => api.post(`/opportunities/${oppId}/bluesheet/calculate`),
  
  // Accounts - now supports filters and entity_type
  listAccounts: (params) => api.get('/accounts', { params }),
  createAccount: (data) => api.post('/accounts', data),
  getAccount360: (id) => api.get(`/accounts/${id}/360`),
  
  // Activities
  listActivities: (params) => api.get('/activities', { params }),
  getActivityStats: () => api.get('/activities/stats'),
  createActivity: (data) => api.post('/activities', data),
  updateActivityStatus: (id, data) => api.patch(`/activities/${id}/status`, data),
  completeActivity: (id) => api.patch(`/activities/${id}/complete`),
  
  // Leads
  listLeads: (params) => api.get('/leads', { params }),
  getLeadsKanban: (params) => api.get('/leads/kanban', { params }),
  getLeadsStats: (params) => api.get('/leads/stats', { params }),
  getLead: (id) => api.get(`/leads/${id}`),
  convertLeadToOpportunity: (id) => api.post(`/leads/${id}/convert`),
  
  // Goals
  listGoals: (params) => api.get('/goals', { params }),
  getGoalsStats: () => api.get('/goals/summary/stats'),
  getGoal: (id) => api.get(`/goals/${id}`),
  createGoal: (data) => api.post('/goals', data),
  updateGoal: (id, data) => api.put(`/goals/${id}`, data),
  deleteGoal: (id) => api.delete(`/goals/${id}`),
  updateGoalProgress: (id, currentValue) => api.patch(`/goals/${id}/progress`, { current_value: currentValue }),
  
  // Teams
  listTeams: () => api.get('/teams'),
  getTeam: (id) => api.get(`/teams/${id}`),
  createTeam: (data) => api.post('/teams', data),
  updateTeam: (id, data) => api.put(`/teams/${id}`, data),
  deleteTeam: (id) => api.delete(`/teams/${id}`),
  addTeamMember: (teamId, userId) => api.post(`/teams/${teamId}/members`, { user_id: userId }),
  removeTeamMember: (teamId, userId) => api.delete(`/teams/${teamId}/members/${userId}`),
  
  // Portfolios
  listPortfolios: () => api.get('/portfolios'),
  getPortfolio: (id) => api.get(`/portfolios/${id}`),
  createPortfolio: (data) => api.post('/portfolios', data),
  deletePortfolio: (id) => api.delete(`/portfolios/${id}`),
  getPortfolioDashboard: (id) => api.get(`/portfolios/${id}/dashboard`),
  
  // Initiatives
  listInitiatives: (params) => api.get('/initiatives', { params }),
  getInitiative: (id) => api.get(`/initiatives/${id}`),
  createInitiative: (data) => api.post('/initiatives', data),
  deleteInitiative: (id) => api.delete(`/initiatives/${id}`),
  getInitiativeProgress: (id) => api.get(`/initiatives/${id}/progress`),
  updateInitiativeStatus: (id, data) => api.patch(`/initiatives/${id}/status`, data),
  
  // KPIs
  listKPIs: () => api.get('/kpis'),
  createKPI: (data) => api.post('/kpis', data),
  updateKPI: (id, data) => api.put(`/kpis/${id}`, data),
  deleteKPI: (id) => api.delete(`/kpis/${id}`),
  
  // Receivables
  listReceivables: (params) => api.get('/receivables', { params }),
  getReceivablesStats: (params) => api.get('/receivables/stats', { params }),
  getReceivablesBySalesperson: (params) => api.get('/receivables/by-salesperson', { params }),
};

// Events/DLQ APIs
export const eventsAPI = {
  getEventHistory: (params) => api.get('/events/history', { params }),
  getRunEvents: (runId) => api.get(`/events/runs/${runId}`),
  listDLQ: (params) => api.get('/dlq', { params }),
  getDLQStats: () => api.get('/dlq/stats'),
  retryDLQ: (id) => api.post(`/dlq/${id}/retry`),
  dismissDLQ: (id) => api.post(`/dlq/${id}/dismiss`),
};

// Config APIs
export const configAPI = {
  getSystemConfig: () => api.get('/config'),
  updateSystemConfig: (data) => api.put('/config', data),
  getUserDashboardConfig: () => api.get('/config/user/dashboard'),
  updateUserDashboardConfig: (data) => api.put('/config/user/dashboard', data),
  getWidgets: () => api.get('/config/widgets'),
  getNavigation: () => api.get('/config/navigation'),
};

// AI Analytics APIs
export const analyticsAPI = {
  getOverview: (params) => api.get('/analytics/overview', { params }),
  getConversionFunnel: (params) => api.get('/analytics/conversion-funnel', { params }),
  getRepPerformance: (params) => api.get('/analytics/rep-performance', { params }),
  getTeamPerformance: (params) => api.get('/analytics/team-performance', { params }),
  getAccountHealth: (params) => api.get('/analytics/account-health', { params }),
  getAIInsights: () => api.post('/analytics/ai-insights'),
  getFilters: () => api.get('/analytics/filters'),
};

// Odoo RBAC APIs
export const rbacAPI = {
  getCurrentUserRBAC: () => api.get('/odoo-rbac/current-user-rbac'),
  getUserPermissions: (userId) => api.get(`/odoo-rbac/user-permissions/${userId}`),
  syncGroups: () => api.post('/odoo-rbac/sync-groups'),
  syncUsers: () => api.post('/odoo-rbac/sync-users'),
  getWebhookInstructions: () => api.get('/webhooks/setup-instructions'),
};
