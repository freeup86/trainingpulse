import axios from 'axios';

// We'll set the baseURL dynamically in the interceptor
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';

// Create axios instance with dynamic baseURL
const api = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and dynamic baseURL
api.interceptors.request.use(
  (config) => {
    // Use environment variable for API base URL in production
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 
                       (import.meta.env.DEV ? 'http://localhost:3001' : 'https://rainingpulse-api.onrender.com');
    config.baseURL = `${apiBaseUrl}/api/${API_VERSION}`;
    
    // Add auth token
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/${API_VERSION}/auth/refresh`, {
            refreshToken
          });

          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// API methods
export const auth = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  
  register: (userData) =>
    api.post('/auth/register', userData),
  
  refresh: (refreshToken) =>
    api.post('/auth/refresh', { refreshToken }),
  
  logout: () =>
    api.post('/auth/logout'),
  
  me: () =>
    api.get('/users/current'),
};

export const courses = {
  getAll: (params = {}) =>
    api.get('/courses', { params }),
  
  getById: (id) =>
    api.get(`/courses/${id}`),
  
  getByUser: (userId, params = {}) =>
    api.get(`/users/${userId}/courses`, { params }),
  
  create: (courseData) =>
    api.post('/courses', courseData),
  
  update: (id, updates) =>
    api.put(`/courses/${id}`, updates),
  
  delete: (id) =>
    api.delete(`/courses/${id}`),
  
  getAssignments: (id) =>
    api.get(`/courses/${id}/assignments`),
  
  addAssignment: (id, assignment) =>
    api.post(`/courses/${id}/assignments`, assignment),
  
  updateStatus: (id, status, notes) =>
    api.patch(`/courses/${id}/status`, { status, notes }),
  
  getDependencies: (id) =>
    api.get(`/courses/${id}/dependencies`),
  
  addDependency: (id, dependency) =>
    api.post(`/courses/${id}/dependencies`, dependency),
  
  // Subtask operations
  createSubtask: (courseId, subtaskData) =>
    api.post(`/courses/${courseId}/subtasks`, subtaskData),
    
  updateSubtask: (courseId, subtaskId, updateData) =>
    api.put(`/courses/${courseId}/subtasks/${subtaskId}`, updateData),
    
  deleteSubtask: (courseId, subtaskId) =>
    api.delete(`/courses/${courseId}/subtasks/${subtaskId}`),

  // Phase status history operations
  updatePhaseStatusHistory: (courseId, subtaskId, historyId, dateData) =>
    api.put(`/courses/${courseId}/subtasks/${subtaskId}/phase-history/${historyId}`, dateData),
    
  // Course phase history from archives
  getPhaseHistory: (courseId) =>
    api.get(`/courses/${courseId}/phase-history`),
    
  recalculateStatus: (courseId) =>
    api.post(`/courses/${courseId}/recalculate-status`),
    
  transitionWorkflow: (courseId, newState, notes = '') =>
    api.post(`/courses/${courseId}/transition`, { newState, notes }),

  // Deliverable and modality operations
  getDeliverables: () =>
    api.get('/courses/deliverables'),
    
  getModalityDeliverables: (modality) =>
    api.get(`/courses/deliverables/${modality}`),
    
  getModalityInfo: (modality) =>
    api.get(`/courses/modality-info/${encodeURIComponent(modality)}`),
};

export const teams = {
  getAll: (params = {}) =>
    api.get('/teams', { params }),
  
  getById: (id) =>
    api.get(`/teams/${id}`),
  
  create: (teamData) =>
    api.post('/teams', teamData),
  
  update: (id, updates) =>
    api.put(`/teams/${id}`, updates),
  
  delete: (id) =>
    api.delete(`/teams/${id}`),
};


export const users = {
  getAll: (params = {}) =>
    api.get('/users', { params }),
  
  getById: (id) =>
    api.get(`/users/${id}`),
  
  getProfile: (id) =>
    api.get(`/users/${id}/profile`),
  
  getStats: (id) =>
    api.get(`/users/${id}/stats`),
  
  getActivity: (id, params = {}) =>
    api.get(`/users/${id}/activity`, { params }),
  
  updateProfile: (id, updates) =>
    api.put(`/users/${id}/profile`, updates),
  
  create: (userData) =>
    api.post('/users', userData),
  
  update: (id, updates) =>
    api.put(`/users/${id}`, updates),
  
  updateCurrent: (updates) =>
    api.put('/users/current', updates),
  
  updateCapacity: (id, capacity) =>
    api.put(`/users/${id}/capacity`, capacity),

  getSubtaskAssignments: (id) =>
    api.get(`/users/${id}/subtask-assignments`),
  
  getWorkload: (id, params = {}) =>
    api.get(`/users/${id}/workload`, { params }),
  
  deactivate: (id) =>
    api.delete(`/users/${id}`),
};

export const analytics = {
  getBottlenecks: (params = {}) =>
    api.get('/analytics/bottlenecks', { params }),
  
  getWorkload: (params = {}) =>
    api.get('/analytics/workload', { params }),
  
  getWorkloadAnalysis: (params = {}) =>
    api.get('/analytics/workload-analysis', { params }),
  
  getPerformance: (params = {}) =>
    api.get('/analytics/performance', { params }),
  
  getImpactAnalysis: (courseId, params = {}) =>
    api.get(`/analytics/impact/${courseId}`, { params }),
  
  getCourseBottlenecks: (courseId) =>
    api.get(`/analytics/course/${courseId}/bottlenecks`),
  
  clearCache: (pattern) =>
    api.post('/analytics/cache/clear', { pattern }),
};

export const workflows = {
  getTemplates: (params = {}) =>
    api.get('/workflows/templates', { params }),
  
  getInstances: (params = {}) =>
    api.get('/workflows/instances', { params }),
  
  getById: (id) =>
    api.get(`/workflows/templates/${id}`),
  
  getActivity: (id, params = {}) =>
    api.get(`/workflows/templates/${id}/activity`, { params }),
  
  createTemplate: (template) =>
    api.post('/workflows/templates', template),
  
  updateTemplate: (id, template) =>
    api.put(`/workflows/templates/${id}`, template),
  
  deleteTemplate: (id) =>
    api.delete(`/workflows/templates/${id}`),
  
  addStage: (templateId, stage) =>
    api.post(`/workflows/templates/${templateId}/stages`, stage),
  
  updateStage: (templateId, stageId, updates) =>
    api.put(`/workflows/templates/${templateId}/stages/${stageId}`, updates),
  
  deleteStage: (templateId, stageId) =>
    api.delete(`/workflows/templates/${templateId}/stages/${stageId}`),
  
  addTransition: (templateId, transition) =>
    api.post(`/workflows/templates/${templateId}/transitions`, transition),
  
  deleteTransition: (templateId, transitionId) =>
    api.delete(`/workflows/templates/${templateId}/transitions/${transitionId}`),
  
  getInstance: (courseId) =>
    api.get(`/workflows/instances/${courseId}`),
  
  createInstance: (courseId, templateId) =>
    api.post(`/workflows/instances/${courseId}`, { templateId }),
  
  updateInstance: (instanceId, updates) =>
    api.put(`/workflows/instances/${instanceId}`, updates),
  
  transition: (instanceId, action, notes, assignToUser) =>
    api.post(`/workflows/instances/${instanceId}/transition`, {
      action,
      notes,
      assignToUser
    }),
};

export const bulkOperations = {
  execute: (params) =>
    api.post('/bulk/execute', params),
  
  getHistory: (params = {}) =>
    api.get('/bulk/history', { params }),
  
  preview: (filter, updates, options = {}) =>
    api.post('/bulk/preview', { filter, updates, options }),
  
  cancel: (previewId) =>
    api.delete(`/bulk/cancel/${previewId}`),
  
  validate: (criteria) =>
    api.post('/bulk/validate', criteria),
  
  getTemplates: () =>
    api.get('/bulk/templates'),
  
  applyTemplate: (templateId, params = {}) =>
    api.post(`/bulk/template/${templateId}`, params),
};

export const bulk = bulkOperations;

export const notifications = {
  getDigest: (params = {}) =>
    api.get('/notifications/digest', { params }),
  
  getAll: (params = {}) =>
    api.get('/notifications', { params }),
  
  getStats: (params = {}) =>
    api.get('/notifications/stats', { params }),
  
  markAsRead: (id) =>
    api.put(`/notifications/${id}/read`),
  
  markAllAsRead: () =>
    api.put('/notifications/read-all'),
  
  delete: (id) =>
    api.delete(`/notifications/${id}`),
  
  getPreferences: () =>
    api.get('/notifications/preferences'),
  
  updatePreferences: (preferences) =>
    api.put('/notifications/preferences', preferences),
  
  sendTest: (testData) =>
    api.post('/notifications/test', testData),
  
  cleanup: (daysToKeep = 30) =>
    api.post('/notifications/cleanup', { daysToKeep }),
};

export const settings = {
  getAll: () =>
    api.get('/settings'),
  
  update: (settings) =>
    api.put('/settings', settings),
  
  get: (key) =>
    api.get(`/settings/${key}`),
  
  set: (key, value) =>
    api.put(`/settings/${key}`, { value }),
};

export const statuses = {
  getAll: () =>
    api.get('/statuses'),
  
  create: (statusData) =>
    api.post('/statuses', statusData),
  
  update: (id, statusData) =>
    api.put(`/statuses/${id}`, statusData),
  
  delete: (id) =>
    api.delete(`/statuses/${id}`),
  
  getById: (id) =>
    api.get(`/statuses/${id}`),
};

export const roles = {
  getAll: () =>
    api.get('/roles'),
  
  getById: (id) =>
    api.get(`/roles/${id}`),
  
  create: (roleData) =>
    api.post('/roles', roleData),
  
  update: (id, roleData) =>
    api.put(`/roles/${id}`, roleData),
  
  delete: (id) =>
    api.delete(`/roles/${id}`),
};

export const permissions = {
  getAll: () =>
    api.get('/permissions'),
  
  getById: (id) =>
    api.get(`/permissions/${id}`),
  
  getGrouped: () =>
    api.get('/permissions/grouped'),
  
  getCategories: () =>
    api.get('/permissions/categories'),
  
  create: (permissionData) =>
    api.post('/permissions', permissionData),
  
  update: (id, permissionData) =>
    api.put(`/permissions/${id}`, permissionData),
  
  delete: (id) =>
    api.delete(`/permissions/${id}`),
};

export const userPermissions = {
  getCurrent: () =>
    api.get('/user-permissions'),
  
  getCurrentRole: () =>
    api.get('/user-permissions/role'),
};

export const phaseStatuses = {
  getAll: (params = {}) =>
    api.get('/phase-statuses', { params }),
  
  getById: (id) =>
    api.get(`/phase-statuses/${id}`),
  
  create: (data) =>
    api.post('/phase-statuses', data),
  
  update: (id, data) =>
    api.put(`/phase-statuses/${id}`, data),
  
  delete: (id) =>
    api.delete(`/phase-statuses/${id}`),
  
  reorder: (statusIds) =>
    api.post('/phase-statuses/reorder', { statusIds }),
};

export const modalityTasks = {
  getAll: () =>
    api.get('/modality/tasks'),
  
  getByModality: (modality) =>
    api.get(`/modality/tasks/${modality}`),
  
  create: (data) =>
    api.post('/modality/tasks', data),
  
  update: (id, data) =>
    api.put(`/modality/tasks/${id}`, data),
  
  delete: (id) =>
    api.delete(`/modality/tasks/${id}`),
  
  reorder: (modality, taskIds) =>
    api.post('/modality/tasks/reorder', { modality, taskIds }),
};

export default api;