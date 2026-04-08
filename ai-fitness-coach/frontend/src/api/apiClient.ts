import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for JWT
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor — NO hard redirects, let React Router handle navigation
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // We intentionally do NOT redirect here. 
    // ProtectedRoute handles auth gating via context.
    return Promise.reject(error);
  }
);

export default apiClient;
