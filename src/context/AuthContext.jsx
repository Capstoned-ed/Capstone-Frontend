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
      let firstName = decoded.first_name || '';
      let lastName = decoded.last_name || '';
      let fullName = (firstName ? `${firstName} ${lastName || ''}`.trim() : '');
      let program = decoded.program || '';
      let yearLevel = decoded.year_level || '';
      let studentId = decoded.student_id || decoded.username || '';
      let resolvedRole = decoded.role;
      let email = decoded.email || '';

      try {
        const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
        const p = profiles[decoded.user_id] || profiles[decoded.username];
        if (p) {
          if (!firstName) firstName = p.first_name || '';
          if (!lastName) lastName = p.last_name || '';
          if (!fullName) fullName = p.full_name || `${firstName} ${lastName || ''}`.trim();
          if (!program) program = p.program || '';
          if (!yearLevel) yearLevel = p.year_level || '';
          if (!studentId || studentId === decoded.username) studentId = p.student_id || decoded.username;
          if (p.email) email = p.email;
        }
      } catch {}

      try {
        const staffProfiles = JSON.parse(localStorage.getItem('regquest_staff_profiles') || '{}');
        const sp = staffProfiles[decoded.user_id] || staffProfiles[decoded.username];
        if (sp) {
          if (!fullName) fullName = sp.full_name || '';
          if (sp.email) email = sp.email;
        }
      } catch {}

      try {
        const usersCache = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
        const u = usersCache.find(
          (x) =>
            String(x.id) === String(decoded.user_id) ||
            (x.username &&
              decoded.username &&
              String(x.username).toLowerCase() === String(decoded.username).toLowerCase())
        );
        if (u) {
          if (!firstName) firstName = u.first_name || '';
          if (!lastName) lastName = u.last_name || '';
          if (!fullName) fullName = u.full_name || `${firstName} ${lastName || ''}`.trim();
          if (!program) program = u.program || '';
          if (!yearLevel) yearLevel = u.year_level || '';
          if (!studentId || studentId === decoded.username) studentId = u.student_id || decoded.username;
          if (u.role) resolvedRole = u.role;
          if (u.email && !email) email = u.email;
        }
        const overrides = JSON.parse(localStorage.getItem('regquest_users_overrides') || '{}');
        const ovById = overrides[String(decoded.user_id)];
        const ovByUser = decoded.username ? overrides[String(decoded.username).toLowerCase()] : null;
        if (ovByUser?.role) resolvedRole = ovByUser.role;
        if (ovById?.role) resolvedRole = ovById.role;
        if (ovByUser?.email) email = ovByUser.email;
        if (ovById?.email) email = ovById.email;
      } catch {}

      if (decoded.username === '2023301564') {
        if (!firstName) firstName = 'Daisy';
        if (!lastName) lastName = 'Traya';
        if (!fullName) fullName = 'Daisy Traya';
        if (!email) email = 'daisy.traya@ustp.edu.ph';
      }

      return {
        userId: decoded.user_id,
        id: decoded.user_id,
        username: decoded.username || '',
        email: email || '',
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        program,
        year_level: yearLevel,
        student_id: studentId,
        role: resolvedRole,
        force_password_change: Boolean(decoded.force_password_change),
        exp: decoded.exp,
      };
    } catch {
      return null;
    }
  }, []);

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

      if (decoded && decoded.exp * 1000 > Date.now() + 10000) {
        try {
          const uKey = (decoded.username || '').toLowerCase();
          if (uKey) {
            const creationDates = JSON.parse(localStorage.getItem('regquest_account_creation_dates') || '{}');
            if (!creationDates[uKey]) {
              const usersCache = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
              const match = usersCache.find((x) => x.username && x.username.toLowerCase() === uKey);
              const time = match?.date_joined || new Date().toISOString();
              creationDates[uKey] = time;
              if (decoded.userId) creationDates[String(decoded.userId)] = time;
              localStorage.setItem('regquest_account_creation_dates', JSON.stringify(creationDates));
            }
          }
        } catch {}

        setUser(decoded);
        setLoading(false);
      } else if (refreshToken) {
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

    try {
      const uKey = (decoded?.username || username || '').toLowerCase();
      if (uKey) {
        const creationDates = JSON.parse(localStorage.getItem('regquest_account_creation_dates') || '{}');
        if (!creationDates[uKey]) {
          const usersCache = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
          const match = usersCache.find((x) => x.username && x.username.toLowerCase() === uKey);
          const time = match?.date_joined || new Date().toISOString();
          creationDates[uKey] = time;
          if (decoded?.userId) creationDates[String(decoded.userId)] = time;
          localStorage.setItem('regquest_account_creation_dates', JSON.stringify(creationDates));
        }
      }
    } catch {}

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
    isStaffOrRegistrar: user?.role === ROLES.STAFF || user?.role === ROLES.REGISTRAR,
    isAdminOrRegistrar: user?.role === ROLES.ADMIN || user?.role === ROLES.REGISTRAR,
  }), [user, loading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
