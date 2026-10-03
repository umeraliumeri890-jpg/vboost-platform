'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, dashboardApi } from '@/lib/api';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (username: string, email: string, password: string, referralCode?: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeUser(rawUser: User | null): User | null {
  if (!rawUser) return null;
  const roles = Array.isArray(rawUser.roles)
    ? rawUser.roles
    : rawUser.role
    ? [rawUser.role]
    : ['worker'];
  const role =
    rawUser.role ||
    (roles.includes('admin') ? 'admin' : roles[0] || 'worker');

  return {
    ...rawUser,
    role,
    roles,
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await dashboardApi.summary();
      if (data?.data?.user) {
        setUser(normalizeUser(data.data.user));
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<User> => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    const normalized = normalizeUser(data.data.user)!;
    setUser(normalized);
    return normalized;
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    referralCode?: string
  ): Promise<User> => {
    const { data } = await authApi.register({ username, email, password, referralCode });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    const normalized = normalizeUser(data.data.user)!;
    setUser(normalized);
    return normalized;
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    window.location.href = '/login';
  };

  const isAdmin = Boolean(user?.role === 'admin' || user?.roles?.includes('admin'));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
