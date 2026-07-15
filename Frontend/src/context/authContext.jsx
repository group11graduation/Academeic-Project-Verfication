import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api, { AUTH_LOGOUT_EVENT } from '../lib/api';
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  setStoredAuthToken,
} from '../lib/authStorage';

const AuthContext = createContext();

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
        if (res.data.success) {
          setUser(res.data.data);
        } else {
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

      if (res.data.success) {
        const { token: t, user: u } = res.data;
        if (!t) {
          return { success: false, message: 'Login succeeded but no token was returned' };
        }
        skipNextMeCheckRef.current = true;
        setStoredAuthToken(t, Boolean(rememberMe));
        setToken(t);
        setUser(u);
        return { success: true, role: u.role, roles: u.roles || [u.role] };
      }
      return { success: false, message: res.data.message || 'Login failed' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Login failed',
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
