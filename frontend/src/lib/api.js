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
      // Don't redirect if already on login page (allows login error to show)
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isOnLoginPage = window.location.pathname === '/login';
      if (!isLoginRequest && !isOnLoginPage) {
        // Only clear tokens and redirect if we're not in the middle of navigating
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
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
  inviteUser: (data) => api.post('/admin/users/invite', data),
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
  getActivityStats: (params) => api.get('/activities/stats', { params }),
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

// Target Management APIs
export const targetAPI = {
  // Sales Targets
  listSalesTargets: (params) => api.get('/sales-targets', { params }),
  getSalesTarget: (id) => api.get(`/sales-targets/${id}`),
  createSalesTarget: (data) => api.post('/sales-targets', data),
  updateSalesTarget: (id, data) => api.put(`/sales-targets/${id}`, data),
  deleteSalesTarget: (id) => api.delete(`/sales-targets/${id}`),
  updateTargetProgress: (id, currentValue) => api.patch(`/sales-targets/${id}/progress`, { current_value: currentValue }),
  getTargetHierarchy: (params) => api.get('/sales-targets/hierarchy', { params }),
  getTargetsSummary: (params) => api.get('/sales-targets/summary', { params }),
  getTargetLeaderboard: (params) => api.get('/sales-targets/leaderboard', { params }),
  cascadeTarget: (id, teamMembers) => api.post(`/sales-targets/${id}/cascade`, teamMembers),

  // Activity Targets
  listActivityTargets: (params) => api.get('/activity-targets', { params }),
  getActivityTarget: (id) => api.get(`/activity-targets/${id}`),
  createActivityTarget: (data) => api.post('/activity-targets', data),
  deleteActivityTarget: (id) => api.delete(`/activity-targets/${id}`),
  logActivityCount: (id, increment) => api.patch(`/activity-targets/${id}/log`, null, { params: { increment } }),
  getActivityTargetsSummary: (params) => api.get('/activity-targets/summary', { params }),
  getActivityScoreboard: (params) => api.get('/activity-targets/scoreboard', { params }),

  // Incentive Plans
  listIncentivePlans: () => api.get('/incentive-plans'),
  getIncentivePlan: (id) => api.get(`/incentive-plans/${id}`),
  createIncentivePlan: (data) => api.post('/incentive-plans', data),
  updateIncentivePlan: (id, data) => api.put(`/incentive-plans/${id}`, data),
  deleteIncentivePlan: (id) => api.delete(`/incentive-plans/${id}`),

  // Incentive Calculation
  calculateIncentive: (data) => api.post('/incentive-calc/calculate', data),
  simulateIncentive: (planId, targetValue, scenarios) =>
    api.post('/incentive-calc/simulate', null, { params: { plan_id: planId, target_value: targetValue, scenarios } }),

  // Target Sheets
  listTargetSheets: (params) => api.get('/target-sheets', { params }),
  getTargetSheet: (id) => api.get(`/target-sheets/${id}`),
  createTargetSheet: (data) => api.post('/target-sheets', data),
  updateTargetSheet: (id, data) => api.put(`/target-sheets/${id}`, data),
  deleteTargetSheet: (id) => api.delete(`/target-sheets/${id}`),
  activateTargetSheet: (id) => api.patch(`/target-sheets/${id}/activate`),

  // Lookups (from Odoo)
  getProductManagers: () => api.get('/target-lookups/product-managers'),
  getSolutionCategories: () => api.get('/target-lookups/solution-categories'),
  getSalespersons: () => api.get('/target-lookups/salespersons'),
  getOdooAccounts: (params) => api.get('/target-lookups/accounts', { params }),
  getActivityTypes: () => api.get('/target-lookups/activity-types'),
  getSalesTeams: () => api.get('/target-lookups/sales-teams'),
  getTeamsWithMembers: () => api.get('/target-lookups/teams-with-members'),

  // Revenue Plans (CEO → PM)
  listRevenuePlans: (params) => api.get('/target-plans/revenue', { params }),
  createRevenuePlan: (data) => api.post('/target-plans/revenue', data),
  deleteRevenuePlan: (id) => api.delete(`/target-plans/revenue/${id}`),

  // Activity Plan Items (PM creates)
  listPlanItems: (planId) => api.get(`/target-plans/revenue/${planId}/items`),
  createPlanItem: (planId, data) => api.post(`/target-plans/revenue/${planId}/items`, data),
  deletePlanItem: (itemId) => api.delete(`/target-plans/items/${itemId}`),

  // Redistributions (Sales Director → Account Managers)
  listRedistributions: (planId) => api.get(`/target-plans/revenue/${planId}/redistributions`),
  redistributePlanItem: (itemId, data) => api.post(`/target-plans/items/${itemId}/redistribute`, data),
  deleteRedistribution: (id) => api.delete(`/target-plans/redistributions/${id}`),

  // Actuals (from Odoo)
  getActualsByPM: (params) => api.get('/target-actuals/by-product-manager', { params }),
  getActualsBySalesperson: (params) => api.get('/target-actuals/by-salesperson', { params }),
  getActualActivities: (params) => api.get('/target-actuals/activities', { params }),
  getCollectionActuals: () => api.get('/target-actuals/collection'),
  calculateMultiVectorIncentive: (data) => api.post('/target-actuals/multi-vector-incentive', data),
  getTeamComparison: () => api.get('/target-actuals/team-comparison'),
  getMarketingMetrics: () => api.get('/target-actuals/marketing-metrics'),
  getAlerts: () => api.get('/alerts'),
  getMyData: () => api.get('/target-actuals/my-data'),
  getRevenueCap: (planId) => api.get(`/target-actuals/revenue-cap/${planId}`),
  getCeoSummary: () => api.get('/target-actuals/ceo-summary'),
  getActivitySuggestions: (planId) => api.get(`/target-plans/revenue/${planId}/suggestions`),
  acceptSuggestions: (planId, modifications) => api.post(`/target-plans/revenue/${planId}/suggestions/accept`, modifications),

  // Org Structure
  getOrgTree: () => api.get('/org-structure/tree'),
  getDepartments: () => api.get('/org-structure/departments'),
  getEmployees: (params) => api.get('/org-structure/employees', { params }),
  toggleArchiveEmployee: (id) => api.patch(`/org-structure/employees/${id}/archive`),

  // Filter Presets
  listFilterPresets: () => api.get('/filter-presets'),
  createFilterPreset: (data) => api.post('/filter-presets', data),
  deleteFilterPreset: (id) => api.delete(`/filter-presets/${id}`),

  // Integration Hub (sync overview only - webhooks handled by original odoo_rbac)
  getHubOverview: () => api.get('/integration-hub/overview'),
  updateSyncSchedule: (entityId, data) => api.put(`/integration-hub/schedule/${entityId}`, data),
  triggerSync: (entityId) => api.post(`/integration-hub/sync/${entityId}`),
  getSyncHistory: (params) => api.get('/integration-hub/history', { params }),
  getIncrementalStatus: () => api.get('/integration-hub/incremental-status'),
  startIncremental: () => api.post('/integration-hub/incremental/start'),
  stopIncremental: () => api.post('/integration-hub/incremental/stop'),
  setIncrementalInterval: (seconds) => api.put('/integration-hub/incremental/interval', null, { params: { interval_seconds: seconds } }),
  rebuildIdentityMap: () => api.post('/integration-hub/rebuild-identity-map'),
  
  // Data Tools (Excel)
  downloadFieldMappings: () => api.get('/data-tools/mappings/download', { responseType: 'blob' }),
  downloadDataTemplate: (entity) => api.get('/data-tools/data-template/download', { params: { entity }, responseType: 'blob' }),
  uploadDataCorrections: (file, entity) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/data-tools/data-template/upload?entity=${entity}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  // Card Builder
  listCards: () => api.get('/card-builder/cards'),
  createCard: (data) => api.post('/card-builder/cards', data),
  updateCard: (id, data) => api.put(`/card-builder/cards/${id}`, data),
  deleteCard: (id) => api.delete(`/card-builder/cards/${id}`),
  executeCard: (id, year) => api.post(`/card-builder/cards/${id}/execute`, null, { params: { year } }),
  executeQuery: (config) => api.post('/card-builder/execute-query', config),
  listTemplates: () => api.get('/card-builder/templates'),
  createTemplate: (data) => api.post('/card-builder/templates', data),
  updateTemplate: (id, data) => api.put(`/card-builder/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/card-builder/templates/${id}`),
  renderTemplate: (id, year) => api.get(`/card-builder/templates/${id}/render`, { params: { year } }),
  seedDefaultCards: () => api.post('/card-builder/seed-defaults'),
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

// Odoo RBAC APIs (legacy)
export const rbacAPI = {
  getCurrentUserRBAC: () => api.get('/odoo-rbac/current-user-rbac'),
  getUserPermissions: (userId) => api.get(`/odoo-rbac/user-permissions/${userId}`),
  syncGroups: () => api.post('/odoo-rbac/sync-groups'),
  syncUsers: () => api.post('/odoo-rbac/sync-users'),
  getWebhookInstructions: () => api.get('/webhooks/setup-instructions'),
};

// RBAC Sync APIs (Hybrid RBAC - syncs from Odoo)
export const rbacSyncAPI = {
  // Trigger sync from Odoo
  triggerSync: (connectionId) => api.post('/rbac/sync', null, { params: { connection_id: connectionId } }),
  
  // List synced data
  listUsers: (limit = 100) => api.get('/rbac/users', { params: { limit } }),
  listGroups: () => api.get('/rbac/groups'),
  listTeams: () => api.get('/rbac/teams'),
  
  // Access info
  getMyAccess: () => api.get('/rbac/my-access'),
  getUserAccess: (userName) => api.get(`/rbac/user-access/${encodeURIComponent(userName)}`),
  testFilter: (userName, entityType = 'opportunity') => 
    api.get(`/rbac/test-filter/${encodeURIComponent(userName)}`, { params: { entity_type: entityType } }),
  
  // Statistics
  getStats: () => api.get('/rbac/stats'),
  
  // Permission Overrides
  listOverrides: () => api.get('/rbac/overrides'),
  createOverride: (data) => api.post('/rbac/overrides', data),
  updateOverride: (overrideId, data) => api.put(`/rbac/overrides/${overrideId}`, data),
  deleteOverride: (overrideId) => api.delete(`/rbac/overrides/${overrideId}`),
  getEffectiveAccess: (userEmail) => api.get(`/rbac/user-effective-access/${encodeURIComponent(userEmail)}`),
};

// Microsoft SSO APIs
export const microsoftAuthAPI = {
  // Get configuration status
  getStatus: () => api.get('/auth/microsoft/status'),
  getFrontendConfig: () => api.get('/auth/microsoft/config'),
  
  // Token exchange (for MSAL.js popup flow)
  tokenLogin: (accessToken) => api.post('/auth/microsoft/token-login', { access_token: accessToken }),
  
  // Check if email is linked to RBAC
  checkRbacStatus: (email) => api.get(`/auth/microsoft/user-rbac-status?email=${encodeURIComponent(email)}`),
  
  // Admin config management
  getAdminConfig: () => api.get('/auth/microsoft/admin/config'),
  saveAdminConfig: (config) => api.post('/auth/microsoft/admin/config', config),
};
