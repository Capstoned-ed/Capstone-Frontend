import { jwtDecode } from 'jwt-decode';
import apiClient from './client';

export function getActiveUserId(user = null) {
  if (user?.id) return String(user.id);
  if (user?.user_id) return String(user.user_id);
  if (typeof window === 'undefined') return 'anon';
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return 'anon';
    const decoded = jwtDecode(token);
    return String(decoded.user_id || decoded.id || 'anon');
  } catch {
    return 'anon';
  }
}

export function getNotificationsStorageKey(user = null) {
  const uid = getActiveUserId(user);
  return uid !== 'anon' ? `notifications_${uid}` : 'notifications_anon';
}

export const NOTIFICATIONS_STORAGE_KEY = 'regquest_stored_notifications';

// Cross-tab broadcast channel for instant real-time notification sync
let broadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('regquest_realtime_notifications');
  } catch (err) {
    console.warn('BroadcastChannel error:', err);
  }
}

export function notifyRealtimeUpdate(payload = {}) {
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'REFRESH_NOTIFICATIONS', timestamp: Date.now(), ...payload });
    }
  } catch {
    // Ignore broadcast errors
  }
}

function getUserNamespace(user) {
  if (!user) return 'guest';
  return (user.username || user.role || String(user.id || 'anon')).toLowerCase();
}

/**
 * Check if a notification is a legacy hardcoded seed or hallucinated synthetic item.
 */
export function isHallucinatedNotification(item) {
  if (!item) return true;
  const id = String(item.id || '');
  if (
    id.startsWith('staff_act_') ||
    id.startsWith('admin_act_') ||
    id.startsWith('student_act_') ||
    id.startsWith('dyn_student_') ||
    id.startsWith('dyn_staff_') ||
    id.startsWith('dyn_admin_')
  ) {
    return true;
  }
  const msg = String(item.message || '');
  if (
    msg.includes('Love (2023-1029)') ||
    msg.includes('RQ-829104') ||
    msg.includes('CLR-2026-002') ||
    msg.includes('RQ-092144') ||
    msg.includes('Institutional Volume: 3 new') ||
    msg.includes('Student profile synchronization completed') ||
    msg.includes('Security Audit: Registrar staff delegation') ||
    msg.includes('CLR-2026-001') ||
    /Student\s*#?\s*[1-4]\b/i.test(msg)
  ) {
    return true;
  }
  return false;
}

export function getUserAccountCreationTime(user) {
  if (!user) return null;
  const username = String(user.username || user.student_id || user.id || '').toLowerCase();
  if (!username) return null;

  // 1. Direct property on user object
  if (user.date_joined) return new Date(user.date_joined).getTime();
  if (user.created_at) return new Date(user.created_at).getTime();

  // 2. Check dedicated creation dates map
  try {
    const creationDates = JSON.parse(localStorage.getItem('regquest_account_creation_dates') || '{}');
    if (creationDates[username]) {
      return new Date(creationDates[username]).getTime();
    }
    if (user.id && creationDates[String(user.id)]) {
      return new Date(creationDates[String(user.id)]).getTime();
    }
  } catch {}

  // 3. Check cached users from database
  try {
    const cachedUsers = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
    const match = cachedUsers.find(
      (u) =>
        (u.username && u.username.toLowerCase() === username) ||
        (u.id && String(u.id) === String(user.id)) ||
        (u.id_number && u.id_number.toLowerCase() === username)
    );
    if (match?.date_joined) {
      const time = new Date(match.date_joined).getTime();
      try {
        const creationDates = JSON.parse(localStorage.getItem('regquest_account_creation_dates') || '{}');
        creationDates[username] = match.date_joined;
        localStorage.setItem('regquest_account_creation_dates', JSON.stringify(creationDates));
      } catch {}
      return time;
    }
    if (match?.created_at) return new Date(match.created_at).getTime();
  } catch {}

  // 4. Check student profiles
  try {
    const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
    const p = profiles[username] || (user.id && profiles[user.id]);
    if (p?.created_at) return new Date(p.created_at).getTime();
  } catch {}

  // 5. Default/First Session Fallback:
  // If an account has no recorded creation time, register its appearance as NOW so that
  // any previous notifications created before this account was born are strictly excluded.
  try {
    const nowIso = new Date().toISOString();
    const creationDates = JSON.parse(localStorage.getItem('regquest_account_creation_dates') || '{}');
    creationDates[username] = nowIso;
    if (user.id) creationDates[String(user.id)] = nowIso;
    localStorage.setItem('regquest_account_creation_dates', JSON.stringify(creationDates));
    return new Date(nowIso).getTime();
  } catch {}

  return null;
}

/**
 * Determines whether a notification is strictly meant for the currently logged-in user.
 * Enforces strict role isolation and timeline bounds:
 * - A user can NEVER see notifications from before their account was created.
 * - Student personal notifications (e.g. "Your request...", "Your credential request...")
 *   can NEVER be seen by Admin or Staff.
 * - Admin/Staff operational alerts (e.g. "Incoming Request:", "New credential request submitted by...",
 *   "System Audit:", "Processing Queue:") can NEVER be seen by Students.
 * - Notifications with a specific student identity can only be seen by that specific student.
 */
export function isNotificationForUser(notification, user) {
  if (!notification || !user) return false;

  // RULE 0: A user cannot see notifications created BEFORE their account was created!
  const accountCreatedTime = getUserAccountCreationTime(user);
  if (accountCreatedTime && notification.created_at) {
    const notifTime = new Date(notification.created_at).getTime();
    // Allow a 1-minute buffer for clock tolerance when account provisioning and initial alert are dispatched
    if (notifTime < accountCreatedTime - 60000) {
      return false;
    }
  }

  const role = (user.role || '').toLowerCase();
  const currentUsername = (user.username || '').toLowerCase();
  const currentStudentId = (user.student_id || user.studentId || '').toLowerCase();
  const currentUserId = user.id ? String(user.id) : user.userId ? String(user.userId) : null;

  const targetRole = (notification.target_role || '').toLowerCase();
  const targetRoles = Array.isArray(notification.target_roles)
    ? notification.target_roles.map((r) => String(r).toLowerCase())
    : [];

  const msg = String(notification.message || '').trim();

  // Personal student request / clearance / payment status feedback
  const isPersonalRequestMsg =
    msg.startsWith('Your credential request') ||
    msg.startsWith('Your request') ||
    msg.startsWith('Your student clearance') ||
    msg.startsWith('Your academic clearance') ||
    msg.startsWith('Your OTC payment') ||
    msg.startsWith('Your payment') ||
    msg.startsWith('Status update: Your request');

  // Operational / audit notifications for admin & staff
  const isOperationalMsg =
    msg.startsWith('Incoming Request:') ||
    msg.startsWith('New credential request') ||
    msg.startsWith('Clearance Submitted:') ||
    msg.startsWith('Clearance Verification:') ||
    msg.startsWith('Payment Submitted:') ||
    msg.startsWith('Processing Queue:') ||
    msg.startsWith('Production Queue:') ||
    msg.startsWith('Release Queue:') ||
    msg.startsWith('Document Release:') ||
    msg.startsWith('System Audit:') ||
    msg.startsWith('Workflow Audit:') ||
    msg.startsWith('Institutional Volume:') ||
    msg.startsWith('Security Audit:') ||
    msg.startsWith('New assigned request:') ||
    msg.startsWith('Assigned Request:') ||
    msg.startsWith('Request ');

  // -------------------------------------------------------------
  // RULE 1: CURRENT USER IS STUDENT
  // -------------------------------------------------------------
  if (role === 'student') {
    // Under no circumstances can a student see staff or admin operational logs
    if (isOperationalMsg) return false;
    if (targetRole === 'staff' || targetRole === 'admin' || targetRole === 'registrar') return false;
    if (targetRoles.length > 0 && !targetRoles.includes('student')) return false;

    // Check if notification is targeted to a specific student
    const hasTargetSpecifier = Boolean(
      notification.target_user_id ||
      notification.target_student_id ||
      notification.target_username ||
      notification.related_object_id
    );

    if (hasTargetSpecifier) {
      const matchUserId = Boolean(
        notification.target_user_id && currentUserId && String(notification.target_user_id) === currentUserId
      );

      const matchStudentId = Boolean(
        notification.target_student_id && (
          (currentStudentId && String(notification.target_student_id).toLowerCase() === currentStudentId) ||
          (currentUsername && String(notification.target_student_id).toLowerCase() === currentUsername)
        )
      );

      const userFullName = (user.full_name || user.fullName || `${user.first_name || ''} ${user.last_name || ''}`).trim().toLowerCase();
      const matchUsername = Boolean(
        notification.target_username && (
          (currentUsername && String(notification.target_username).toLowerCase() === currentUsername) ||
          (currentStudentId && String(notification.target_username).toLowerCase() === currentStudentId) ||
          (userFullName && String(notification.target_username).toLowerCase() === userFullName) ||
          (user.first_name && String(notification.target_username).toLowerCase().includes(String(user.first_name).toLowerCase()))
        )
      );

      // Check if related request belongs to this student
      let matchRequestOwnership = false;
      if (notification.related_object_id) {
        try {
          const reqs = JSON.parse(localStorage.getItem('regquest_submitted_requests') || '[]');
          const req = reqs.find((r) =>
            String(r.tracking_number) === String(notification.related_object_id) ||
            String(r.id) === String(notification.related_object_id) ||
            String(r.trackingId) === String(notification.related_object_id)
          );
          if (req) {
            matchRequestOwnership = Boolean(
              (currentUserId && String(req.user) === currentUserId) ||
              (currentStudentId && String(req.student_id).toLowerCase() === currentStudentId) ||
              (currentUsername && (String(req.student_id).toLowerCase() === currentUsername || String(req.student_name).toLowerCase() === currentUsername)) ||
              (userFullName && String(req.student_name).toLowerCase() === userFullName)
            );
          }
        } catch {}
      }

      // If any of the identity / ownership attributes match, allow this notification!
      if (matchUserId || matchStudentId || matchUsername || matchRequestOwnership) {
        return true;
      }

      // If target fields were explicitly provided but NONE matched this student, reject
      if (notification.target_user_id || notification.target_student_id || notification.target_username) {
        return false;
      }
    }

    return true;
  }

  // -------------------------------------------------------------
  // RULE 2: CURRENT USER IS STAFF OR REGISTRAR
  // -------------------------------------------------------------
  if (role === 'staff' || role === 'registrar') {
    // Staff/Registrar should never see personal student request messages
    if (isPersonalRequestMsg) return false;
    if (targetRole === 'student') return false;
    if (targetRoles.length > 0 && !targetRoles.some((r) => r === 'staff' || r === 'registrar')) return false;

    // Direct targeting check if notification was explicitly addressed to a particular staff/user
    const hasSpecificTarget = Boolean(
      notification.target_user_id ||
      notification.target_username ||
      notification.target_name
    );

    if (hasSpecificTarget) {
      const candidates = new Set();
      const addCandidate = (val) => {
        if (val !== undefined && val !== null) {
          const s = String(val).trim().toLowerCase();
          if (s) candidates.add(s);
        }
      };
      addCandidate(user.username);
      addCandidate(user.full_name);
      addCandidate([user.first_name, user.last_name].filter(Boolean).join(' '));
      addCandidate(user.id);
      addCandidate(user.userId);

      const targetId = notification.target_user_id ? String(notification.target_user_id).trim() : null;
      const targetUser = notification.target_username ? String(notification.target_username).trim().toLowerCase() : null;
      const targetName = notification.target_name ? String(notification.target_name).trim().toLowerCase() : null;

      let matched = false;
      if (targetId && (targetId === String(user.id) || targetId === String(user.userId))) {
        matched = true;
      }
      if (targetUser && candidates.has(targetUser)) {
        matched = true;
      }
      if (targetName) {
        for (const c of candidates) {
          if (c === targetName || (c.length >= 3 && (targetName.includes(c) || c.includes(targetName)))) {
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        return false;
      }
    }

    return true;
  }

  // -------------------------------------------------------------
  // RULE 3: CURRENT USER IS ADMIN
  // -------------------------------------------------------------
  if (role === 'admin') {
    // Admin should never see personal student request messages
    if (isPersonalRequestMsg) return false;
    if (targetRole === 'student') return false;
    if (targetRoles.length > 0 && !targetRoles.includes('admin')) return false;

    // Direct targeting check if notification was explicitly addressed to a specific admin
    if (notification.target_username && currentUsername && notification.target_username.toLowerCase() !== currentUsername) {
      return false;
    }
    if (notification.target_user_id && currentUserId && String(notification.target_user_id) !== currentUserId) {
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Permanently purge any legacy seed or hallucinated dummy notifications from localStorage.
 */
export function purgeHallucinatedNotifications() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((item) => !isHallucinatedNotification(item));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(cleaned));
        }
      }
    }
  } catch (e) {
    console.warn('Failed to purge hallucinated notifications:', e);
  }
}

// Run purge on module load
purgeHallucinatedNotifications();

/**
 * Retrieve the set of notification IDs that the user has marked as read locally.
 */
export function getReadNotificationIds(user = null) {
  try {
    const ns = getUserNamespace(user);
    const raw = localStorage.getItem(`regquest_read_notifs_${ns}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * Mark a specific notification ID as read locally for the given user.
 */
export function markNotificationIdAsRead(id, user = null) {
  try {
    const ns = getUserNamespace(user);
    const readSet = getReadNotificationIds(user);
    readSet.add(String(id));
    localStorage.setItem(`regquest_read_notifs_${ns}`, JSON.stringify(Array.from(readSet)));
  } catch (e) {
    console.warn('Failed to persist read notification ID:', e);
  }
}

/**
 * Mark all given notification IDs as read locally for the given user.
 */
export function markAllNotificationIdsAsRead(ids = [], user = null) {
  try {
    const ns = getUserNamespace(user);
    const readSet = getReadNotificationIds(user);
    ids.forEach((id) => readSet.add(String(id)));
    localStorage.setItem(`regquest_read_notifs_${ns}`, JSON.stringify(Array.from(readSet)));
  } catch (e) {
    console.warn('Failed to persist read notification IDs:', e);
  }
}

/**
 * Retrieve genuinely saved local notifications strictly matching the authenticated user.
 * Strictly enforces isNotificationForUser so student items never leak to staff/admin,
 * and staff/admin items never leak to students.
 */
export function getStoredNotifications(user = null) {
  try {
    purgeHallucinatedNotifications();

    if (!user) return [];

    const key = getNotificationsStorageKey(user);
    const rawSaved = localStorage.getItem(key);
    const savedNotifications = rawSaved ? JSON.parse(rawSaved) : [];

    const readIds = getReadNotificationIds(user);

    // Strictly filter notifications relevant to this specific user
    const filtered = savedNotifications.filter((n) => {
      if (!n || isHallucinatedNotification(n)) return false;
      return isNotificationForUser(n, user);
    });

    // Deduplicate by unique notification ID
    const uniqueMap = new Map();
    filtered.forEach((item) => {
      if (item && item.id && !uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, {
          ...item,
          is_read: Boolean(item.is_read || readIds.has(String(item.id))),
        });
      }
    });

    return Array.from(uniqueMap.values());
  } catch (err) {
    console.warn('Failed to load stored notifications:', err);
    return [];
  }
}

/**
 * Save a genuine real-time notification into local storage and notify active listeners.
 * Explicitly infers and sets target_role and target_roles to prevent cross-role leaks.
 */
export function saveStoredNotification(notification, user = null) {
  if (!notification || !notification.message) return null;
  if (isHallucinatedNotification(notification)) return null;

  try {
    const targetUser = user || (notification.target_user_id ? { id: notification.target_user_id } : null);
    const key = getNotificationsStorageKey(targetUser);
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];

    const msg = String(notification.message || '').trim();
    const isPersonal =
      msg.startsWith('Your credential request') ||
      msg.startsWith('Your request') ||
      msg.startsWith('Your student clearance') ||
      msg.startsWith('Your academic clearance') ||
      msg.startsWith('Your OTC payment') ||
      msg.startsWith('Your payment') ||
      msg.startsWith('Status update: Your request');

    const inferredTargetRole = notification.target_role || (isPersonal ? 'student' : 'staff');
    const inferredTargetRoles =
      notification.target_roles ||
      (isPersonal ? ['student'] : ['admin', 'staff', 'registrar']);

    // Deduplicate: prevent saving identical event + related object + message within recent timeframe
    const now = Date.now();
    const isDuplicate = existing.some((item) => {
      const sameType = item.event_type === notification.event_type;
      const sameObj = String(item.related_object_id || '') === String(notification.related_object_id || '');
      const sameMsg = item.message === notification.message;
      const timeDiff = Math.abs(now - new Date(item.created_at || 0).getTime());
      return sameType && sameObj && sameMsg && timeDiff < 10000;
    });

    if (isDuplicate) {
      return null;
    }

    const item = {
      id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event_type: notification.event_type || 'REQUEST_STATUS_CHANGED',
      title: notification.title || null,
      message: notification.message,
      related_object_type: notification.related_object_type || 'CredentialRequest',
      related_object_id: notification.related_object_id || '',
      is_read: false,
      created_at: notification.created_at || new Date().toISOString(),
      target_user_id: notification.target_user_id || null,
      target_username: notification.target_username || null,
      target_name: notification.target_name || null,
      target_student_id: notification.target_student_id || null,
      target_role: inferredTargetRole,
      target_roles: inferredTargetRoles,
    };

    const updated = [item, ...existing];
    localStorage.setItem(key, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('regquest_notification_created', { detail: item }));
      window.dispatchEvent(new CustomEvent('regquest_requests_updated', { detail: item }));
      notifyRealtimeUpdate({ reason: 'notification_created', item });
    }
    return item;
  } catch (err) {
    console.warn('Failed to save stored notification:', err);
    return null;
  }
}

/**
 * Mark a specific stored notification as read for the user.
 */
export function markStoredNotificationRead(id, user = null) {
  try {
    markNotificationIdAsRead(id, user);
    const key = getNotificationsStorageKey(user);
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];
    const updated = existing.map((n) => (String(n.id) === String(id) ? { ...n, is_read: true } : n));
    localStorage.setItem(key, JSON.stringify(updated));
    notifyRealtimeUpdate({ reason: 'marked_read', id });
  } catch (err) {
    console.warn('Failed to mark stored notification as read:', err);
  }
}

/**
 * Mark all stored notifications as read for a given user.
 */
export function markAllStoredNotificationsRead(user = null, currentNotifications = []) {
  try {
    const idsToMark = currentNotifications.map((n) => n.id);
    markAllNotificationIdsAsRead(idsToMark, user);

    const key = getNotificationsStorageKey(user);
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];

    const updated = existing.map((n) => {
      if (idsToMark.includes(n.id)) {
        return { ...n, is_read: true };
      }
      return n;
    });
    localStorage.setItem(key, JSON.stringify(updated));
    notifyRealtimeUpdate({ reason: 'marked_all_read' });
  } catch (err) {
    console.warn('Failed to mark all stored notifications as read:', err);
  }
}

export const notificationsApi = {
  /**
   * Fetch all notifications for the authenticated user from backend API.
   */
  list: async (params = {}) => {
    try {
      const response = await apiClient.get('/api/notifications/', {
        params: { page_size: 100, ...params },
      });
      return Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
    } catch (err) {
      console.warn('notificationsApi.list backend returned error:', err);
      return [];
    }
  },

  /**
   * Mark a specific notification as read in backend.
   */
  markRead: async (id) => {
    try {
      const response = await apiClient.patch(`/api/notifications/${id}/read/`);
      notifyRealtimeUpdate({ reason: 'backend_marked_read', id });
      return response.data;
    } catch (err) {
      console.warn(`notificationsApi.markRead error for #${id}:`, err);
      return { id, is_read: true };
    }
  },

  /**
   * Mark all notifications as read for the authenticated user in backend.
   */
  markAllRead: async () => {
    try {
      const response = await apiClient.post('/api/notifications/mark_all_read/');
      notifyRealtimeUpdate({ reason: 'backend_marked_all_read' });
      return response.data;
    } catch {
      try {
        const response = await apiClient.post('/api/notifications/mark-all-read/');
        notifyRealtimeUpdate({ reason: 'backend_marked_all_read' });
        return response.data;
      } catch (err) {
        console.warn('notificationsApi.markAllRead error:', err);
        return { status: 'success' };
      }
    }
  },
};

export default notificationsApi;
