import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authApi } from '../api/auth';
import { ROLES } from '../constants/roles';
import { AuthContext } from './AuthContextDefinition';

export { AuthContext };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const parseToken = useCallback((token) => {
    try {
      const decoded = jwtDecode(token);
      return {
        userId: decoded.user_id,
        username: decoded.username || '',
        role: decoded.role,
        force_password_change: Boolean(decoded.force_password_change),
        exp: decoded.exp,
      };
    } catch {
      return null;
    }
  }, []);

  // Initialize auth state on application startup
  useEffect(() => {
    const initializeAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');

      if (!accessToken || !refreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setLoading(false);
        return;
      }

      const decoded = parseToken(accessToken);

      // Check if access token is still valid (with 10-second buffer)
      if (decoded && decoded.exp * 1000 > Date.now() + 10000) {
        setUser(decoded);
        setLoading(false);
      } else if (refreshToken) {
        // Attempt silent refresh if access token expired
        try {
          const data = await authApi.refresh(refreshToken);
          localStorage.setItem('access_token', data.access);
          if (data.refresh) {
            localStorage.setItem('refresh_token', data.refresh);
          }
          const freshUser = parseToken(data.access);
          setUser(freshUser);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setLoading(false);
      }
    };

    initializeAuth();
  }, [parseToken]);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    const { access, refresh } = data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);

    const decoded = parseToken(access);
    setUser(decoded);
    return { user: decoded, access, refresh };
  }, [parseToken]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Ignore logout API failures and clear state locally
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    role: user?.role || null,
    force_password_change: Boolean(user?.force_password_change),
    isAuthenticated: Boolean(user),
    loading,
    login,
    logout,
    // Helper property reflecting that Staff and Registrar share responsibilities
    isStaffOrRegistrar: user?.role === ROLES.STAFF || user?.role === ROLES.REGISTRAR,
  }), [user, loading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
