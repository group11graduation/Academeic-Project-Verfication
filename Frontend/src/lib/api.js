import axios from 'axios';

const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Axios instance: base URL includes `/api`; sends Bearer token from localStorage */
export const api = axios.create({
  baseURL: `${base.replace(/\/$/, '')}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

export function getApiOrigin() {
  return base.replace(/\/$/, '');
}

export default api;
