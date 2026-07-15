import axios from 'axios';
import { getApiErrorMessage } from '../shared/utils/apiErrors.js';
import {
  AUTH_TOKEN_KEY,
  clearStoredAuthToken,
  getStoredAuthToken,
} from './authStorage';

function resolveApiBase() {
  if (typeof window !== 'undefined') {
    const runtime = window.__APP_CONFIG__?.API_URL;
    if (typeof runtime === 'string' && runtime.trim()) {
      return runtime.trim().replace(/\/$/, '');
    }
  }

  const built = String(import.meta.env.VITE_API_URL || '').trim();
  const isDockerBuildPlaceholder =
    built === 'http://localhost:5000' || built === 'http://127.0.0.1:5000';

  if (built && !isDockerBuildPlaceholder) {
    return built.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin && import.meta.env.PROD) {
    return window.location.origin;
  }

  return built.replace(/\/$/, '') || 'http://localhost:5000';
}

const base = resolveApiBase();

/** Default for JSON/list requests — fail fast instead of hanging. */
export const API_TIMEOUT_MS = 12_000;

/** Used automatically for FormData / file uploads (large project ZIPs can take several minutes). */
export const UPLOAD_TIMEOUT_MS = 600_000;

/** Bulk import (many bcrypt hashes + DB writes) can take several minutes. */
export const IMPORT_TIMEOUT_MS = 300_000;

/** Proposal finalize runs AI similarity (can take 1–3+ min on first model load). */
export const PROPOSAL_AI_SUBMIT_TIMEOUT_MS = 180_000;

/** Preview start can extract ZIP, audit, and start Docker (several minutes). */
export const PREVIEW_TIMEOUT_MS = 600_000;

export { AUTH_TOKEN_KEY, clearStoredAuthToken, getStoredAuthToken };
export const AUTH_LOGOUT_EVENT = 'auth:logout';

export const api = axios.create({
  baseURL: `${base.replace(/\/$/, '')}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
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
    const isAuthPublic =
      url.includes('/auth/login') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password');

    if (status === 401 && !isAuthPublic && getStoredAuthToken()) {
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

export function assetUrl(path) {
  const value = String(path || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const origin = getApiOrigin();
  return value.startsWith('/') ? `${origin}${value}` : `${origin}/${value}`;
}

export { getApiErrorMessage };

export default api;
