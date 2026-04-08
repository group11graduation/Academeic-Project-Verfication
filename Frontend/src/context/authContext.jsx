import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            if (token) {
                try {
                    const res = await api.get('/auth/me');
                    if (res.data.success) {
                        setUser(res.data.data);
                    } else {
                        logout();
                    }
                } catch (err) {
                    console.error('Auth verification failed:', err);
                    if (err.response && err.response.status === 401) {
                        logout();
                    }
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, [token]);

    const login = async (identifier, password) => {
        try {
            const res = await api.post('/auth/login', {
                identifier,
                passcode: password
            });

            if (res.data.success) {
                const { token: t, user: u } = res.data;
                localStorage.setItem('token', t);
                setToken(t);
                setUser(u);
                return { success: true, role: u.role, roles: u.roles || [u.role] };
            }
            return { success: false, message: res.data.message || 'Login failed' };
        } catch (err) {
            return {
                success: false,
                message: err.response?.data?.message || 'Login failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
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
