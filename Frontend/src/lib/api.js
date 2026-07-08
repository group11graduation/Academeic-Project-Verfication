import axios from 'axios';
import { getApiErrorMessage } from '../shared/utils/apiErrors.js';

const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Default for JSON/list requests — fail fast instead of hanging. */
export const API_TIMEOUT_MS = 12_000;

/** Used automatically for FormData / file uploads. */
export const UPLOAD_TIMEOUT_MS = 120_000;

/** Bulk import (many bcrypt hashes + DB writes) can take several minutes. */
export const IMPORT_TIMEOUT_MS = 300_000;

/** Proposal finalize runs AI similarity (can take 1–3+ min on first model load). */
export const PROPOSAL_AI_SUBMIT_TIMEOUT_MS = 180_000;

/** Preview start can extract ZIP, audit, and start Docker (several minutes). */
export const PREVIEW_TIMEOUT_MS = 600_000;

/** Axios instance: base URL includes `/api`; sends Bearer token from localStorage */
export const AUTH_TOKEN_KEY = 'token';
export const AUTH_LOGOUT_EVENT = 'auth:logout';

export function clearStoredAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export const api = axios.create({
  baseURL: `${base.replace(/\/$/, '')}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
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
    const status = error.response?.status;
    const url = String(error.config?.url || '');
    const isLoginRequest = url.includes('/auth/login');

    if (status === 401 && !isLoginRequest && localStorage.getItem(AUTH_TOKEN_KEY)) {
      clearStoredAuthToken();
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
    }

    error.userMessage = getApiErrorMessage(error);
    return Promise.reject(error);
  }
);

export function getApiOrigin() {
  return base.replace(/\/$/, '');
}

export { getApiErrorMessage };

export default api;
