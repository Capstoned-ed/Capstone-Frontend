import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authApi } from '../api/auth';
import usersApi from '../api/users';
import { ROLES } from '../constants/roles';
import { AuthContext } from './AuthContextDefinition';
import { clearAllDraftStorage } from '../utils/draftStorage';
import apiCache from '../api/cache';
import requestsApi from '../api/requests';

export { AuthContext };

function normalizeRole(roleVal) {
  return String(roleVal || '').trim().toLowerCase();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastFocusRefreshRef = useRef(0);
  const prevUserIdRef = useRef(null);

  useEffect(() => {
    const currentUid = user?.userId || user?.id || null;
    if (prevUserIdRef.current && currentUid && prevUserIdRef.current !== currentUid) {
      try {
        apiCache.clear();
        requestsApi.clearCache();
      } catch {}
    }
    prevUserIdRef.current = currentUid;
  }, [user]);

  const parseToken = useCallback((token) => {
    try {
      const decoded = jwtDecode(token);
      let firstName = decoded.first_name || '';
      let lastName = decoded.last_name || '';
      let fullName = (firstName ? `${firstName} ${lastName || ''}`.trim() : (decoded.full_name || ''));
      let program = decoded.program || '';
      let yearLevel = decoded.year_level || '';
      let studentId = decoded.student_id || decoded.username || '';
      const resolvedRole = normalizeRole(decoded.role);
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
          if (u.email && !email) email = u.email;
        }
      } catch {}

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

  const mergeWithMe = useCallback((baseUser, me) => {
    if (!me) return baseUser;
    const firstName = me.first_name !== undefined ? me.first_name : (baseUser?.first_name || '');
    const middleName = me.middle_name !== undefined ? me.middle_name : (baseUser?.middle_name || '');
    const lastName = me.last_name !== undefined ? me.last_name : (baseUser?.last_name || '');
    const nameExtension = me.name_extension !== undefined ? me.name_extension : (baseUser?.name_extension || '');
    const nameParts = [firstName, middleName, lastName].filter(Boolean);
    let fullName = nameParts.join(' ').trim();
    if (nameExtension) fullName = `${fullName} ${nameExtension}`.trim();
    if (!fullName) fullName = me.full_name || baseUser?.full_name || '';

    return {
      ...baseUser,
      ...me,
      role: normalizeRole(me.role || baseUser?.role),
      userId: me.id || baseUser?.userId,
      id: me.id || baseUser?.id,
      student_id: me.username || me.student_id || baseUser?.student_id || baseUser?.username,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      name_extension: nameExtension,
      full_name: fullName,
      program: me.course_name || me.program || baseUser?.program || '',
      course_name: me.course_name || baseUser?.course_name || '',
      course_code: me.course_code || baseUser?.course_code || '',
      birth_date: me.birth_date !== undefined ? me.birth_date : (baseUser?.birth_date || ''),
      birthdate: me.birth_date !== undefined ? me.birth_date : (baseUser?.birthdate || ''),
      contact_number: me.contact_number !== undefined ? me.contact_number : (baseUser?.contact_number || ''),
      year_level: me.year_level || baseUser?.year_level || '1st year',
    };
  }, []);

  const updateUser = useCallback((updatedData) => {
    if (!updatedData) return;
    setUser((prev) => {
      if (!prev) return updatedData;
      return mergeWithMe(prev, updatedData);
    });
  }, [mergeWithMe]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
    } finally {
      try {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } catch (e) {
        console.warn('Failed to clear auth tokens on logout:', e);
      }
      try {
        await clearAllDraftStorage();
      } catch (e) {
        console.warn('Failed to clear draft storage on logout:', e);
      }
      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn('Failed to clear sessionStorage on logout:', e);
      }
      try {
        apiCache.clear();
        requestsApi.clearCache();
      } catch {}
      setUser(null);
    }
  }, []);

  const hydrateWithRefresh = useCallback(async (refreshToken) => {
    const data = await authApi.refresh(refreshToken);
    localStorage.setItem('access_token', data.access);
    if (data.refresh) {
      localStorage.setItem('refresh_token', data.refresh);
    }
    const freshUser = parseToken(data.access);
    try {
      const me = await usersApi.getMe();
      if (me?.is_active === false) {
        await logout();
        return null;
      }
      return mergeWithMe(freshUser, me);
    } catch {
      return freshUser;
    }
  }, [parseToken, mergeWithMe, logout]);

  const refreshProfile = useCallback(async () => {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    if (!accessToken && !refreshToken) return null;

    try {
      const me = await usersApi.getMe();
      if (!me) return null;

      if (me.is_active === false) {
        await logout();
        return null;
      }

      setUser((prev) => {
        if (!prev) return prev;
        return mergeWithMe(prev, me);
      });
      return me;
    } catch (err) {
      if (err?.response?.status === 401 && refreshToken) {
        try {
          const freshUser = await hydrateWithRefresh(refreshToken);
          if (freshUser) {
            setUser(freshUser);
            return freshUser;
          }
        } catch {
          await logout();
        }
      } else if (err?.response?.status === 401 || err?.response?.status === 403) {
        await logout();
      }
      return null;
    }
  }, [logout, mergeWithMe, hydrateWithRefresh]);

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');

      if (!accessToken || !refreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const decoded = parseToken(accessToken);

      try {
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

          // Wait for /api/users/me/ to resolve BEFORE setting loading=false so RoleRoute
          // never evaluates an unhydrated/partial user role on page refresh.
          let hydratedUser = decoded;
          try {
            const me = await usersApi.getMe();
            if (me?.is_active === false) {
              await logout();
              return;
            }
            hydratedUser = mergeWithMe(decoded, me);
          } catch (meErr) {
            if (meErr?.response?.status === 401 && refreshToken) {
              hydratedUser = await hydrateWithRefresh(refreshToken);
            }
          }

          if (active) {
            setUser(hydratedUser);
          }
        } else if (refreshToken) {
          const hydratedUser = await hydrateWithRefresh(refreshToken);
          if (active) {
            setUser(hydratedUser);
          }
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          if (active) {
            setUser(null);
          }
        }
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    initializeAuth();
    return () => {
      active = false;
    };
  }, [parseToken, mergeWithMe, hydrateWithRefresh, logout]);

  // Real-time role/profile sync on window focus and tab visibility change
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefreshRef.current > 4000) {
        lastFocusRefreshRef.current = now;
        refreshProfile();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshProfile]);

  const login = useCallback(async (username, password) => {
    try {
      apiCache.clear();
      requestsApi.clearCache();
    } catch {}

    const data = await authApi.login(username, password);
    const { access, refresh } = data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);

    let decoded = parseToken(access);

    try {
      const me = await usersApi.getMe();
      if (me) {
        decoded = mergeWithMe(decoded, me);
      }
    } catch {}

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
  }, [parseToken, mergeWithMe]);

  const value = useMemo(() => ({
    user,
    role: user?.role || null,
    force_password_change: Boolean(user?.force_password_change),
    isAuthenticated: Boolean(user),
    loading,
    login,
    logout,
    refreshProfile,
    updateUser,
    isStaffOrRegistrar: user?.role === ROLES.STAFF || user?.role === ROLES.REGISTRAR,
    isAdminOrRegistrar: user?.role === ROLES.ADMIN || user?.role === ROLES.REGISTRAR,
  }), [user, loading, login, logout, refreshProfile, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
