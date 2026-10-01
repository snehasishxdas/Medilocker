import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => api.getSession());
  const [token, setToken] = useState(() => api.getToken());
  const [loading, setLoading] = useState(true);

  // Sync session on mount
  useEffect(() => {
    async function checkAuth() {
      const storedToken = api.getToken();
      if (!storedToken) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        const meUser = res?.user || res?.data || (res?.id ? res : null);
        if (meUser && meUser.id) {
          const normRole = (meUser.role || (meUser.doctorProfile ? 'DOCTOR' : meUser.hospitalProfile ? 'HOSPITAL' : 'PATIENT')).toUpperCase();
          const normalized = { ...meUser, role: normRole };
          setUser(normalized);
          api.setSession(normalized);
        }
      } catch (err) {
        console.warn('Session verification fallback to stored session:', err.message);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = useCallback(async (payload) => {
    const res = await api.login(payload);
    const u = res?.user || res?.data?.user || res?.data;
    const t = res?.token || res?.data?.token;
    if (u && t) {
      const normRole = (u.role || (u.doctorProfile ? 'DOCTOR' : u.hospitalProfile ? 'HOSPITAL' : 'PATIENT')).toUpperCase();
      const normalized = { ...u, role: normRole };
      setUser(normalized);
      setToken(t);
      api.setSession(normalized);
    }
    return res;
  }, []);

  const signup = useCallback(async (payload) => {
    const res = await api.signup(payload);
    const u = res?.user || res?.data?.user || res?.data;
    const t = res?.token || res?.data?.token;
    if (u && t) {
      const normRole = (u.role || (u.doctorProfile ? 'DOCTOR' : u.hospitalProfile ? 'HOSPITAL' : 'PATIENT')).toUpperCase();
      const normalized = { ...u, role: normRole };
      setUser(normalized);
      setToken(t);
      api.setSession(normalized);
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    api.logout();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getMe();
      const meUser = res?.user || res?.data || (res?.id ? res : null);
      if (meUser && meUser.id) {
        const normRole = (meUser.role || (meUser.doctorProfile ? 'DOCTOR' : meUser.hospitalProfile ? 'HOSPITAL' : 'PATIENT')).toUpperCase();
        const normalized = { ...meUser, role: normRole };
        setUser(normalized);
        api.setSession(normalized);
        return normalized;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const effectiveRole = (user?.role || (user?.doctorProfile ? 'DOCTOR' : user?.hospitalProfile ? 'HOSPITAL' : 'PATIENT')).toUpperCase();

  const value = {
    user,
    token,
    role: effectiveRole,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
