import axios from 'axios';
import { ElMessage } from 'element-plus';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response.data,
  error => {
    const status = error.response?.status;
    const msg = error.response?.data?.error || error.message || '网络请求错误';

    if (status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/setup')) {
        window.location.href = '/login';
      }
    } else if (status >= 400) {
      ElMessage.error(msg);
    }
    return Promise.reject(error);
  }
);
