import axios from 'axios';
import toast from 'react-hot-toast';

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance for authentication
export const authAPI = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create axios instance for general API calls
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const token = localStorage.getItem('token');
        if (token) {
          const refreshResponse = await authAPI.post('/auth/refresh', { token });
          
          if (refreshResponse.data.success) {
            const newToken = refreshResponse.data.data.token;
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(refreshResponse.data.data.user));
            
            // Update authorization header
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            // Retry original request
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }

      // If refresh fails, logout user
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
      
      // Redirect to login page
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Handle other errors
    if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.response?.status === 403) {
      toast.error('Access denied. You do not have permission to perform this action.');
    } else if (error.response?.status === 404) {
      toast.error('Resource not found.');
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please check your connection.');
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authService = {
  login: (credentials) => authAPI.post('/auth/login', credentials),
  register: (userData) => authAPI.post('/auth/register', userData),
  logout: () => authAPI.post('/auth/logout'),
  verifyToken: (token) => authAPI.post('/auth/verify', { token }),
  refreshToken: (token) => authAPI.post('/auth/refresh', { token }),
  changePassword: (passwords) => authAPI.post('/auth/change-password', passwords),
};

// User API endpoints
export const userService = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (userData) => api.put('/users/profile', userData),
  getDashboard: () => api.get('/users/dashboard'),
  getNotificationSettings: () => api.get('/users/notification-settings'),
  updateNotificationSettings: (settings) => api.put('/users/notification-settings', settings),
  searchUsers: (query, limit = 10) => api.get(`/users/search?q=${query}&limit=${limit}`),
};

// Task API endpoints
export const taskService = {
  getTasks: (params = {}) => {
    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v != null && v !== '')
    );
    const queryString = new URLSearchParams(cleanedParams).toString();
    return api.get(`/tasks?${queryString}`);
  },
  getTask: (id) => api.get(`/tasks/${id}`),
  createTask: (taskData) => api.post('/tasks', taskData),
  updateTask: (id, taskData) => api.put(`/tasks/${id}`, taskData),
  updateTaskStatus: (id, statusData) => api.put(`/tasks/${id}/status`, statusData),
  deleteTask: (id) => api.delete(`/tasks/${id}`),
};

// Group API endpoints
export const groupService = {
  getGroups: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/groups?${queryString}`);
  },
  getGroup: (id) => api.get(`/groups/${id}`),
  createGroup: (groupData) => api.post('/groups', groupData),
  updateGroup: (id, groupData) => api.put(`/groups/${id}`, groupData),
  deleteGroup: (id) => api.delete(`/groups/${id}`),
  addMember: (groupId, memberData) => api.post(`/groups/${groupId}/members`, memberData),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
};

// Notification API endpoints
export const notificationService = {
  getLogs: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/notifications/logs?${queryString}`);
  },
  getStats: () => api.get('/notifications/stats'),
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (preferences) => api.put('/notifications/preferences', preferences),
  testNotification: (testData) => api.post('/notifications/test', testData),
  retryNotification: (id) => api.post(`/notifications/${id}/retry`),
};

// Analytics API endpoints (for admins)
export const analyticsService = {
  getTaskAnalytics: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/analytics/tasks?${queryString}`);
  },
  getGroupAnalytics: (groupId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/analytics/groups/${groupId}?${queryString}`);
  },
  exportTasks: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/analytics/export/tasks?${queryString}`, {
      responseType: 'blob',
    });
  },
};

// File upload utility
export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });
};

// Utility functions
export const handleApiError = (error) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  } else if (error.message) {
    return error.message;
  } else {
    return 'An unexpected error occurred';
  }
};

export const isApiError = (error) => {
  return error.response && error.response.data;
};

// Request cancellation utility
export const createCancelToken = () => {
  return axios.CancelToken.source();
};

export const isRequestCancelled = (error) => {
  return axios.isCancel(error);
};

// Health check
export const healthCheck = () => {
  return axios.get(`${API_BASE_URL.replace('/api', '')}/health`, {
    timeout: 5000,
  });
};

export default api;