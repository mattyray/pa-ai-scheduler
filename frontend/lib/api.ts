import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    console.log('🔴 API Error Intercepted:', {
      status: error.response?.status,
      url: originalRequest?.url,
      method: originalRequest?.method,
      errorData: error.response?.data,
      hasRetried: originalRequest._retry
    });

    if (error.response?.status === 403) {
      console.error('❌ 403 Forbidden:', error.response?.data?.error || 'You do not have permission');
      alert(`Access Denied: ${error.response?.data?.error || error.response?.data?.detail || 'You do not have permission to perform this action'}`);
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      console.log('🔄 Attempting token refresh...');

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          console.log('❌ No refresh token found');
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/api/auth/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('access_token', access);
        originalRequest.headers.Authorization = `Bearer ${access}`;

        console.log('✅ Token refreshed successfully, retrying original request');
        return api(originalRequest);
      } catch (refreshError) {
        console.log('❌ Token refresh failed:', refreshError);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data: {
    email: string;
    username: string;
    password: string;
    password_confirm: string;
    first_name: string;
    last_name: string;
    phone_number: string;
  }) => api.post('/api/auth/register/', data),

  login: (email: string, password: string) => 
    api.post('/api/auth/login/', { email, password }),

  verifyEmail: (token: string) => 
    api.post('/api/auth/verify-email/', { token }),

  requestPasswordReset: (email: string) => 
    api.post('/api/auth/password-reset/', { email }),

  resetPassword: (token: string, password: string, password_confirm: string) => 
    api.post('/api/auth/password-reset-confirm/', { token, password, password_confirm }),

  logout: (refreshToken: string) => 
    api.post('/api/auth/logout/', { refresh: refreshToken }),

  getCurrentUser: () => 
    api.get('/api/auth/me/'),
};