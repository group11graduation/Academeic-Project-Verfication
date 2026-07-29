import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api, { AUTH_LOGOUT_EVENT } from '../lib/api';
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  setStoredAuthToken,
} from '../lib/authStorage';

const AuthContext = createContext();

/**
 * Normalize login JSON across shapes used by our API and some student/preview backends:
 * - { success, token, user }
 * - { token|accessToken|access_token, user, message } (no success)
 * - { data: { token, user }, message }
 */
function extractLoginPayload(body) {
  if (!body || typeof body !== 'object') {
    return { token: null, user: null, message: '', explicitFail: false };
  }
  const nested = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
  const token =
    body.token ||
    body.accessToken ||
    body.access_token ||
    nested.token ||
    nested.accessToken ||
    nested.access_token ||
    null;
  const user = body.user || nested.user || null;
  const message = body.message || nested.message || '';
  const explicitFail = body.success === false || nested.success === false;
  return {
    token: typeof token === 'string' && token.trim() ? token.trim() : null,
    user: user && typeof user === 'object' ? user : null,
    message: String(message || ''),
    explicitFail,
  };
}

function extractMeUser(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    if (body.data.email || body.data.role || body.data._id || body.data.id) return body.data;
    if (body.data.user && typeof body.data.user === 'object') return body.data.user;
  }
  if (body.user && typeof body.user === 'object') return body.user;
  return null;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getStoredAuthToken());
  const [loading, setLoading] = useState(true);
  const skipNextMeCheckRef = useRef(false);

  const logout = useCallback(() => {
    clearStoredAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const onForcedLogout = () => logout();
    window.addEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
  }, [logout]);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      if (skipNextMeCheckRef.current) {
        skipNextMeCheckRef.current = false;
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (cancelled) return;
        const body = res.data || {};
        const meUser = extractMeUser(body);
        if (body.success === false) {
          logout();
        } else if (meUser) {
          setUser(meUser);
        } else {
          console.error('Auth /me returned unexpected shape:', body);
          logout();
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Auth verification failed:', err);
        const status = err.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          logout();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(Boolean(token));
    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const login = async (identifier, password, { rememberMe = true } = {}) => {
    try {
      const res = await api.post('/auth/login', {
        identifier,
        passcode: password,
      });

      const { token: t, user: u, message, explicitFail } = extractLoginPayload(res.data);

      // Do not require a `success` boolean - backends may only return token/user/message.
      if (explicitFail || !t || !u) {
        return {
          success: false,
          message:
            message ||
            (!t
              ? 'Login succeeded but no token was returned'
              : !u
                ? 'Login succeeded but no user was returned'
                : 'Login failed'),
        };
      }

      skipNextMeCheckRef.current = true;
      setStoredAuthToken(t, Boolean(rememberMe));
      setToken(t);
      setUser(u);
      return { success: true, role: u.role, roles: u.roles || [u.role] };
    } catch (err) {
      console.error('Login request failed:', err);
      return {
        success: false,
        message: err.response?.data?.message || err.userMessage || 'Login failed',
      };
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
