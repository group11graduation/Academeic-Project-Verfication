import axios from 'axios';
import { getApiErrorMessage } from '../shared/utils/apiErrors.js';

const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Default for JSON/list requests — fail fast instead of hanging. */
export const API_TIMEOUT_MS = 12_000;

/** Used automatically for FormData / file uploads. */
export const UPLOAD_TIMEOUT_MS = 120_000;

/** Axios instance: base URL includes `/api`; sends Bearer token from localStorage */
export const api = axios.create({
  baseURL: `${base.replace(/\/$/, '')}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    if (config.timeout == null || config.timeout === API_TIMEOUT_MS) {
      config.timeout = UPLOAD_TIMEOUT_MS;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    error.userMessage = getApiErrorMessage(error);
    return Promise.reject(error);
  }
);

export function getApiOrigin() {
  return base.replace(/\/$/, '');
}

export { getApiErrorMessage };

export default api;
