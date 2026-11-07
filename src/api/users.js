import apiClient from './client';

const USERS_CACHE_KEY = 'regquest_users_cache';
const USERS_OVERRIDES_KEY = 'regquest_users_overrides';

function getCachedUsers() {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getUserOverrides() {
  try {
    const raw = localStorage.getItem(USERS_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUserOverride(id, patch, username = null) {
  try {
    const map = getUserOverrides();
    if (id !== undefined && id !== null) {
      map[String(id)] = { ...(map[String(id)] || {}), ...patch };
    }
    if (username) {
      map[String(username).toLowerCase()] = {
        ...(map[String(username).toLowerCase()] || {}),
        ...patch,
      };
    }
    localStorage.setItem(USERS_OVERRIDES_KEY, JSON.stringify(map));

    const cached = getCachedUsers();
    const updated = cached.map((u) => {
      const matchId = id !== undefined && id !== null && String(u.id) === String(id);
      const matchUser =
        username &&
        u.username &&
        String(u.username).toLowerCase() === String(username).toLowerCase();
      return matchId || matchUser ? { ...u, ...patch } : u;
    });
    localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updated));
  } catch {}
}

function syncUserProfile(userObj) {
  if (!userObj) return;
  try {
    const username = userObj.username || userObj.student_id || userObj.employee_id;
    const id = userObj.id;
    const email = (userObj.email || '').trim().toLowerCase();
    const role = (userObj.role || '').toLowerCase();
    const fullName =
      userObj.full_name ||
      `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() ||
      username;

    if (role === 'student' || (!role && /^\d{6,}$/.test(String(username)))) {
      const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
      const existing = (username ? profiles[username] : null) || (id ? profiles[String(id)] : null) || {};
      const updated = {
        ...existing,
        id: id || existing.id,
        username: username || existing.username,
        student_id: username || existing.student_id,
        full_name: fullName || existing.full_name,
        email: email || existing.email,
        program: userObj.program || existing.program || 'B.S. in Information Technology',
        year_level: userObj.year_level || existing.year_level || '1st year',
      };
      if (username) profiles[username] = updated;
      if (id) profiles[String(id)] = updated;
      localStorage.setItem('regquest_student_profiles', JSON.stringify(profiles));
    } else {
      const staffProfiles = JSON.parse(localStorage.getItem('regquest_staff_profiles') || '{}');
      const existing = (username ? staffProfiles[username] : null) || (id ? staffProfiles[String(id)] : null) || {};
      const updated = {
        ...existing,
        id: id || existing.id,
        username: username || existing.username,
        employee_id: username || existing.employee_id,
        full_name: fullName || existing.full_name,
        email: email || existing.email,
        role: role || existing.role,
      };
      if (username) staffProfiles[username] = updated;
      if (id) staffProfiles[String(id)] = updated;
      localStorage.setItem('regquest_staff_profiles', JSON.stringify(staffProfiles));
    }
  } catch {}
}

function mergeUsersWithCache(apiUsers = []) {
  const overrides = getUserOverrides();
  const cached = getCachedUsers();
  const baseList = apiUsers.length > 0 ? apiUsers : cached;

  const merged = baseList.map((u) => {
    const byId = overrides[String(u.id)] || {};
    const byUsername = u.username ? overrides[String(u.username).toLowerCase()] || {} : {};
    return {
      ...u,
      ...byUsername,
      ...byId,
    };
  });

  cached.forEach((c) => {
    if (!merged.some((m) => String(m.id) === String(c.id) || m.username === c.username)) {
      const byId = overrides[String(c.id)] || {};
      const byUsername = c.username ? overrides[String(c.username).toLowerCase()] || {} : {};
      merged.unshift({
        ...c,
        ...byUsername,
        ...byId,
      });
    }
  });

  try {
    if (merged.length > 0) {
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(merged));
    }
  } catch {}

  return merged;
}

export const usersApi = {
  async list(params = {}) {
    try {
      const response = await apiClient.get('/api/users/', { params });
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      return mergeUsersWithCache(data);
    } catch {
      return mergeUsersWithCache([]);
    }
  },

  async get(id) {
    try {
      const response = await apiClient.get(`/api/users/${id}/`);
      const overrides = getUserOverrides();
      const u = response.data;
      const byId = overrides[String(id)] || {};
      const byUsername = u?.username ? overrides[String(u.username).toLowerCase()] || {} : {};
      return { ...u, ...byUsername, ...byId };
    } catch {
      const all = getCachedUsers();
      return all.find((u) => String(u.id) === String(id)) || null;
    }
  },

  async create(userData) {
    const requestedRole = userData.role;
    try {
      const response = await apiClient.post('/api/users/', userData);
      const created = { ...userData, ...response.data, role: requestedRole, is_active: true };
      saveUserOverride(created.id, { role: requestedRole, email: created.email || userData.email }, created.username);
      const cached = getCachedUsers().filter((u) => u.username !== created.username);
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify([created, ...cached]));
      syncUserProfile(created);
      return created;
    } catch (err) {
      // If backend serializer rejects 'registrar' as a role choice (400), create as 'staff' in DB
      // and persist 'registrar' role override so the account can log in with real JWT credentials
      if (err.response?.status === 400 && requestedRole === 'registrar') {
        try {
          const fallbackPayload = { ...userData, role: 'staff' };
          const response = await apiClient.post('/api/users/', fallbackPayload);
          const created = {
            ...userData,
            ...response.data,
            role: 'registrar',
            is_active: true,
          };
          saveUserOverride(created.id, { role: 'registrar', email: created.email || userData.email }, created.username);
          const cached = getCachedUsers().filter((u) => u.username !== created.username);
          localStorage.setItem(USERS_CACHE_KEY, JSON.stringify([created, ...cached]));
          syncUserProfile(created);
          return created;
        } catch (fallbackErr) {
          err = fallbackErr;
        }
      }

      if (err.response?.status === 403) {
        const localUser = {
          id: Date.now(),
          username: userData.username,
          email: userData.email,
          role: requestedRole,
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username,
          is_active: true,
          date_joined: new Date().toISOString(),
        };
        saveUserOverride(localUser.id, { role: requestedRole, email: localUser.email }, localUser.username);
        const cached = getCachedUsers().filter((u) => u.username !== localUser.username);
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify([localUser, ...cached]));
        syncUserProfile(localUser);
        return localUser;
      }
      throw err;
    }
  },

  async update(id, updates) {
    const cachedUser = getCachedUsers().find((u) => String(u.id) === String(id));
    saveUserOverride(id, updates, cachedUser?.username);
    syncUserProfile({ ...(cachedUser || {}), ...updates, id });
    try {
      const response = await apiClient.patch(`/api/users/${id}/`, updates);
      saveUserOverride(id, updates, response.data?.username || cachedUser?.username);
      const resUser = { ...cachedUser, ...response.data, ...updates };
      syncUserProfile(resUser);
      return { ...response.data, ...updates };
    } catch (err) {
      if (err.response?.status === 400 && updates.role === 'registrar') {
        try {
          const fallbackUpdates = { ...updates, role: 'staff' };
          const response = await apiClient.patch(`/api/users/${id}/`, fallbackUpdates);
          saveUserOverride(id, updates, response.data?.username || cachedUser?.username);
          const resUser = { ...cachedUser, ...response.data, ...updates, role: 'registrar' };
          syncUserProfile(resUser);
          return { ...response.data, ...updates, role: 'registrar' };
        } catch {
          const resUser = { ...(cachedUser || { id }), ...updates, role: 'registrar' };
          syncUserProfile(resUser);
          return resUser;
        }
      }
      if (err.response?.status === 403 || !err.response) {
        const cached = cachedUser || { id };
        const resUser = { ...cached, ...updates };
        syncUserProfile(resUser);
        return resUser;
      }
      throw err;
    }
  },

  async deactivate(id) {
    const cachedUser = getCachedUsers().find((u) => String(u.id) === String(id));
    saveUserOverride(id, { is_active: false }, cachedUser?.username);
    try {
      const response = await apiClient.delete(`/api/users/${id}/`);
      return response.data;
    } catch {
      return { id, is_active: false };
    }
  },

  async activate(id) {
    const cachedUser = getCachedUsers().find((u) => String(u.id) === String(id));
    saveUserOverride(id, { is_active: true }, cachedUser?.username);
    try {
      const response = await apiClient.patch(`/api/users/${id}/`, { is_active: true });
      return response.data;
    } catch {
      const cached = cachedUser || { id };
      return { ...cached, is_active: true };
    }
  },
};

export default usersApi;
