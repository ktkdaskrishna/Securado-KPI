import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('esip_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('esip_token');
      localStorage.removeItem('esip_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// Connection API
export const connectionAPI = {
  list: () => api.get('/connections'),
  get: (id) => api.get(`/connections/${id}`),
  create: (data) => api.post('/connections', data),
  test: (id) => api.post(`/connections/${id}/test`),
  delete: (id) => api.delete(`/connections/${id}`),
  discover: (id) => api.post(`/connections/${id}/discover`),
  getSchema: (id) => api.get(`/connections/${id}/schema`),
  getModelFields: (connId, model) => api.get(`/connections/${connId}/schema/${encodeURIComponent(model)}/fields`),
};

// Target API (Multi-database outputs)
export const targetAPI = {
  list: () => api.get('/targets'),
  get: (id) => api.get(`/targets/${id}`),
  create: (data) => api.post('/targets', data),
  update: (id, data) => api.put(`/targets/${id}`, data),
  test: (id) => api.post(`/targets/${id}/test`),
  delete: (id) => api.delete(`/targets/${id}`),
  discoverSchema: (id) => api.post(`/targets/${id}/discover`),
  getSchema: (id) => api.get(`/targets/${id}/schema`),
  getTableFields: (id, table) => api.get(`/targets/${id}/schema/${encodeURIComponent(table)}/fields`),
  getTypes: () => api.get('/targets/types'),
};

// Schema Matching API
export const schemaAPI = {
  discover: (connId) => api.post(`/connections/${connId}/discover`),
  match: (sourceConnId, sourceModel, targetId, targetTable) => 
    api.post(`/schema/match?source_connection_id=${sourceConnId}&source_model=${encodeURIComponent(sourceModel)}&target_id=${targetId}&target_table=${encodeURIComponent(targetTable)}`),
};

// Webhook API
export const webhookAPI = {
  events: (params) => api.get('/webhook-events', { params }),
  stats: () => api.get('/webhook-events/stats'),
  retryEvent: (id) => api.post(`/webhook-events/${id}/retry`),
  configs: () => api.get('/webhook-configs'),
  createConfig: (data) => api.post('/webhook-configs', data),
  deleteConfig: (id) => api.delete(`/webhook-configs/${id}`),
};

// Mapping API
export const mappingAPI = {
  list: (connectionId) => api.get('/mappings', { params: { connection_id: connectionId } }),
  get: (id) => api.get(`/mappings/${id}`),
  create: (data) => api.post('/mappings', data),
  update: (id, data) => api.put(`/mappings/${id}`, data),
  delete: (id) => api.delete(`/mappings/${id}`),
  getCanonicalModel: () => api.get('/canonical-model'),
};

// Pipeline API
export const pipelineAPI = {
  list: () => api.get('/pipelines'),
  get: (id) => api.get(`/pipelines/${id}`),
  create: (data) => api.post('/pipelines', data),
  update: (id, data) => api.put(`/pipelines/${id}`, data),
  delete: (id) => api.delete(`/pipelines/${id}`),
  run: (id) => api.post(`/pipelines/${id}/run`),
  getRuns: (id, limit = 20) => api.get(`/pipelines/${id}/runs`, { params: { limit } }),
  updateSchedule: (id, type, config) => api.post(`/pipelines/${id}/schedule?schedule_type=${type}`, config),
};

// Scheduler API
export const schedulerAPI = {
  getJobs: () => api.get('/scheduler/jobs'),
};

// Pipeline Runs API
export const runAPI = {
  list: (limit = 50) => api.get('/pipeline-runs', { params: { limit } }),
  get: (id) => api.get(`/pipeline-runs/${id}`),
  getLogs: (id) => api.get(`/pipeline-runs/${id}/logs`),
};

// Preview API
export const previewAPI = {
  sourceData: (connId, model, limit = 10) => api.get(`/preview/${connId}/${encodeURIComponent(model)}`, { params: { limit } }),
  silverData: (limit = 20) => api.get('/preview/silver', { params: { limit } }),
};

// KPI API
export const kpiAPI = {
  getSummary: () => api.get('/kpi/summary'),
  getOpportunities: (params) => api.get('/kpi/opportunities', { params }),
  health: () => api.get('/kpi/health'),
};

// DLQ API
export const dlqAPI = {
  list: (limit = 100) => api.get('/dlq', { params: { limit } }),
  retry: (id) => api.post(`/dlq/${id}/retry`),
};

// Schema Library API
export const schemaLibraryAPI = {
  list: (params) => api.get('/schemas', { params }),
  listBuiltin: (params) => api.get('/schemas/builtin', { params }),
  get: (id) => api.get(`/schemas/${id}`),
  create: (data) => api.post('/schemas', data),
  update: (id, data) => api.put(`/schemas/${id}`, data),
  delete: (id) => api.delete(`/schemas/${id}`),
  getVersions: (id) => api.get(`/schemas/${id}/versions`),
  createVersion: (id, comment) => api.post(`/schemas/${id}/versions`, null, { params: { comment } }),
  extend: (id, newName, fields) => api.post(`/schemas/${id}/extend`, { new_name: newName, additional_fields: fields }),
  import: (data) => api.post('/schemas/import', data),
  export: (id, format, targetType) => api.post(`/schemas/${id}/export`, { format, target_type: targetType }),
  validate: (id, data) => api.post(`/schemas/${id}/validate`, data),
  getCategories: () => api.get('/schemas/meta/categories'),
  getIndustries: () => api.get('/schemas/meta/industries'),
  getDataTypes: () => api.get('/schemas/meta/data-types'),
};

// Target Templates API
export const targetTemplateAPI = {
  list: (params) => api.get('/templates', { params }),
  get: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  getTargetTypes: () => api.get('/templates/target-types'),
  generateDDL: (schemaId, targetType, tableName, schemaName) => 
    api.post('/templates/generate-ddl', null, { 
      params: { schema_id: schemaId, target_type: targetType, table_name: tableName, schema_name: schemaName }
    }),
  getDDL: (id) => api.get(`/templates/${id}/ddl`),
  autoGenerate: (schemaId, targetType, tableName, schemaName) =>
    api.post('/templates/auto-generate', null, {
      params: { schema_id: schemaId, target_type: targetType, table_name: tableName, schema_name: schemaName }
    }),
  getTypeMappings: (targetType) => api.get(`/templates/type-mappings/${targetType}`),
};

// Admin / RBAC API
export const adminAPI = {
  // Initialization
  initRBAC: () => api.post('/admin/init'),
  
  // Permissions
  listPermissions: () => api.get('/admin/permissions'),
  getMyPermissions: () => api.get('/admin/permissions/my'),
  
  // Roles
  listRoles: () => api.get('/admin/roles'),
  getRole: (id) => api.get(`/admin/roles/${id}`),
  createRole: (data) => api.post('/admin/roles', data),
  updateRole: (id, data) => api.put(`/admin/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/admin/roles/${id}`),
  
  // Users
  listUsers: () => api.get('/admin/users'),
  getUser: (id) => api.get(`/admin/users/${id}`),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  assignRoles: (userId, roleIds) => api.post(`/admin/users/${userId}/roles`, roleIds),
  toggleSuperAdmin: (userId) => api.post(`/admin/users/${userId}/toggle-super-admin`),
};

// Unified API export
api.auth = authAPI;
api.connections = connectionAPI;
api.targets = targetAPI;
api.schema = schemaAPI;
api.webhooks = webhookAPI;
api.mappings = mappingAPI;
api.pipelines = pipelineAPI;
api.scheduler = schedulerAPI;
api.runs = runAPI;
api.preview = previewAPI;
api.kpi = kpiAPI;
api.dlq = dlqAPI;
api.schemaLibrary = schemaLibraryAPI;
api.targetTemplates = targetTemplateAPI;
api.admin = adminAPI;

export default api;
