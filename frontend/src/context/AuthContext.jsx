import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../services/apiClient';
import { getErrorMessage } from '../services/errorHandler';

const AuthContext = createContext(null);

const AUTH_KEY = 'dfw_auth_user';
const TOKEN_KEY = 'dfw_access_token';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(AUTH_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        // Set default auth header
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

        // Verify the token is still valid by calling /me endpoint
        apiClient.get('/api/auth/me')
          .then((res) => {
            const userData = {
              id: res.data.id,
              fullName: res.data.full_name,
              username: res.data.username,
              email: res.data.email,
            };
            setUser(userData);
            localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
          })
          .catch(() => {
            // Token expired or invalid, clear auth state
            localStorage.removeItem(AUTH_KEY);
            localStorage.removeItem(TOKEN_KEY);
            delete apiClient.defaults.headers.common['Authorization'];
            setUser(null);
          })
          .finally(() => setLoading(false));
      } catch {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(TOKEN_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const storeAuthData = useCallback((token, userData) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  }, []);

  const login = useCallback(async (emailOrUsername, password) => {
    try {
      const response = await apiClient.post('/api/auth/login', {
        email_or_username: emailOrUsername,
        password: password,
      });

      const { access_token, user: userData } = response.data;
      const formattedUser = {
        id: userData.id,
        fullName: userData.full_name,
        username: userData.username,
        email: userData.email,
      };

      storeAuthData(access_token, formattedUser);
      return formattedUser;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, [storeAuthData]);

  const register = useCallback(async ({ fullName, username, email, password }) => {
    try {
      const response = await apiClient.post('/api/auth/register', {
        full_name: fullName,
        username: username,
        email: email,
        password: password,
      });

      const { access_token, user: userData } = response.data;
      const formattedUser = {
        id: userData.id,
        fullName: userData.full_name,
        username: userData.username,
        email: userData.email,
      };

      storeAuthData(access_token, formattedUser);
      return formattedUser;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, [storeAuthData]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Ignore logout errors — we clear local state regardless
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(AUTH_KEY);
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-info)' }}
          />
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ color: 'var(--color-text-tertiary)' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>{t('auth.accessDenied')}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('auth.loginRequired')}
          </p>
          <a href="/login" className="btn-primary gap-2 inline-flex">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            {t('auth.goToLogin')}
          </a>
        </div>
      </div>
    );
  }
  return children;
};
