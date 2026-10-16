import apiClient from './client';

export const NOTIFICATIONS_STORAGE_KEY = 'regquest_stored_notifications';

function getUserNamespace(user) {
  if (!user) return 'guest';
  return (user.username || user.role || String(user.id || 'anon')).toLowerCase();
}

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
 * Initial curated activity notifications tailored specifically by role
 */
const SEED_NOTIFICATIONS_BY_ROLE = {
  staff: [
    {
      id: 'staff_act_1',
      event_type: 'REQUEST_CREATED',
      message: 'Incoming Request: Love (2023-1029) submitted a request for Transcript of Records (RQ-829104).',
      related_object_type: 'CredentialRequest',
      related_object_id: 'RQ-829104',
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      target_role: 'staff',
    },
    {
      id: 'staff_act_2',
      event_type: 'CLEARANCE_SUBMITTED',
      message: 'Clearance Verification: Student 2023301564 uploaded academic clearance for evaluation.',
      related_object_type: 'StudentClearance',
      related_object_id: 'CLR-2026-002',
      created_at: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
      target_role: 'staff',
    },
    {
      id: 'staff_act_3',
      event_type: 'REQUEST_STATUS_CHANGED',
      message: 'Release Queue: Document for Request RQ-092144 is verified and ready for student window release.',
      related_object_type: 'CredentialRequest',
      related_object_id: 'RQ-092144',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      target_role: 'staff',
    },
  ],
  admin: [
    {
      id: 'admin_act_1',
      event_type: 'REQUEST_CREATED',
      message: 'Institutional Volume: 3 new credential requests logged across engineering and computing programs.',
      related_object_type: 'CredentialRequest',
      related_object_id: '',
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      target_role: 'admin',
    },
    {
      id: 'admin_act_2',
      event_type: 'REQUEST_STATUS_CHANGED',
      message: 'Workflow Audit: Request RQ-829104 was received and placed in the Registrar processing queue.',
      related_object_type: 'CredentialRequest',
      related_object_id: 'RQ-829104',
      created_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
      target_role: 'admin',
    },
    {
      id: 'admin_act_3',
      event_type: 'ACCOUNT_CREATED',
      message: 'User Management: Student profile synchronization completed for academic term 2025-2026.',
      related_object_type: 'User',
      related_object_id: '',
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      target_role: 'admin',
    },
    {
      id: 'admin_act_4',
      event_type: 'PASSWORD_RESET',
      message: 'Security Audit: Registrar staff delegation and authorization policies verified.',
      related_object_type: 'System',
      related_object_id: '',
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      target_role: 'admin',
    },
  ],
  student: [
    {
      id: 'student_act_1',
      event_type: 'REQUEST_CREATED',
      message: 'Your credential request (RQ-829104) for Transcript of Records has been successfully submitted.',
      related_object_type: 'CredentialRequest',
      related_object_id: 'RQ-829104',
      created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      target_role: 'student',
    },
    {
      id: 'student_act_2',
      event_type: 'CLEARANCE_APPROVED',
      message: 'Your academic clearance for the semester has been reviewed and approved by the Registrar.',
      related_object_type: 'StudentClearance',
      related_object_id: 'CLR-2026-001',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      target_role: 'student',
    },
  ],
};

/**
 * Retrieve notifications stored locally and dynamically derived from submitted requests,
 * strictly differentiated based on the user's role and specific system activities.
 */
export function getStoredNotifications(user = null) {
  try {
    const role = (user?.role || '').toLowerCase();
    const currentUsername = (user?.username || '').toLowerCase();
    const currentStudentId = (user?.student_id || user?.studentId || '').toLowerCase();
    const currentUserId = user?.id || user?.userId || null;

    // Load any explicitly saved notifications
    const rawSaved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const savedNotifications = rawSaved ? JSON.parse(rawSaved) : [];

    // Combine with role-specific seed activity
    const roleSeed = SEED_NOTIFICATIONS_BY_ROLE[role] || (role === 'registrar' ? SEED_NOTIFICATIONS_BY_ROLE.staff : []);
    const all = [...savedNotifications, ...roleSeed];

    // Dynamically derive activity notifications from existing submitted requests
    try {
      const storedReqsRaw = localStorage.getItem('regquest_submitted_requests');
      const studentReqsRaw = localStorage.getItem('student_my_requests');
      const combinedReqs = [
        ...(storedReqsRaw ? JSON.parse(storedReqsRaw) : []),
        ...(studentReqsRaw ? JSON.parse(studentReqsRaw) : []),
      ];

      const seenTracking = new Set();

      combinedReqs.forEach((req) => {
        if (!req) return;
        const tracking = req.tracking_number || req.trackingId || req.id;
        if (!tracking || seenTracking.has(tracking)) return;
        seenTracking.add(tracking);

        const docTitle = req.document_type || req.credential_type_details?.name || 'Document';
        const studentName = req.student_name || 'Student';
        const studentNum = req.student_id || '';
        const status = req.status || 'Pending';
        const createdAt = req.created_at || new Date().toISOString();

        // 1. STUDENT VIEW: Only their own requests & personal status updates
        if (role === 'student') {
          const reqStudentName = (req.student_name || '').toLowerCase();
          const reqStudentId = (req.student_id || '').toLowerCase();
          const matchesStudent =
            !currentUsername ||
            reqStudentName.includes(currentUsername) ||
            currentUsername.includes(reqStudentName) ||
            (currentStudentId && reqStudentId === currentStudentId) ||
            (currentUserId && req.user && String(req.user) === String(currentUserId));

          if (matchesStudent) {
            all.push({
              id: `dyn_student_created_${tracking}`,
              event_type: 'REQUEST_CREATED',
              message: `Your credential request (${tracking}) for ${docTitle} has been submitted. Status: ${status}.`,
              related_object_type: 'CredentialRequest',
              related_object_id: tracking,
              created_at: createdAt,
              target_role: 'student',
            });

            if (status.toLowerCase() !== 'pending') {
              all.push({
                id: `dyn_student_status_${tracking}_${status}`,
                event_type: 'REQUEST_STATUS_CHANGED',
                message: `Status update: Your request (${tracking}) has moved to ${status}.`,
                related_object_type: 'CredentialRequest',
                related_object_id: tracking,
                created_at: req.updated_at || createdAt,
                target_role: 'student',
              });
            }
          }
        }

        // 2. STAFF VIEW: Operational processing queue, clearances, releases
        else if (role === 'staff' || role === 'registrar') {
          all.push({
            id: `dyn_staff_incoming_${tracking}`,
            event_type: 'REQUEST_CREATED',
            message: `Incoming Request: ${studentName} (${studentNum || 'Student'}) requested ${docTitle} (${tracking}).`,
            related_object_type: 'CredentialRequest',
            related_object_id: tracking,
            created_at: createdAt,
            target_role: 'staff',
          });

          if (status.toLowerCase() === 'processing') {
            all.push({
              id: `dyn_staff_processing_${tracking}`,
              event_type: 'REQUEST_STATUS_CHANGED',
              message: `Production Queue: Request ${tracking} for ${studentName} is in active processing.`,
              related_object_type: 'CredentialRequest',
              related_object_id: tracking,
              created_at: req.updated_at || createdAt,
              target_role: 'staff',
            });
          } else if (status.toLowerCase().includes('release')) {
            all.push({
              id: `dyn_staff_release_${tracking}`,
              event_type: 'REQUEST_STATUS_CHANGED',
              message: `Document Release: ${docTitle} for ${studentName} (${tracking}) is ready for claim window release.`,
              related_object_type: 'CredentialRequest',
              related_object_id: tracking,
              created_at: req.updated_at || createdAt,
              target_role: 'staff',
            });
          }
        }

        // 3. ADMIN VIEW: Institutional volume, workflow audits, system management
        else if (role === 'admin') {
          all.push({
            id: `dyn_admin_audit_${tracking}`,
            event_type: 'REQUEST_CREATED',
            message: `System Audit: New document request (${tracking}) logged for ${studentName} (${docTitle}).`,
            related_object_type: 'CredentialRequest',
            related_object_id: tracking,
            created_at: createdAt,
            target_role: 'admin',
          });

          if (status.toLowerCase() !== 'pending') {
            all.push({
              id: `dyn_admin_transition_${tracking}_${status}`,
              event_type: 'REQUEST_STATUS_CHANGED',
              message: `Workflow Audit: Request ${tracking} (${studentName}) transitioned to ${status}.`,
              related_object_type: 'CredentialRequest',
              related_object_id: tracking,
              created_at: req.updated_at || createdAt,
              target_role: 'admin',
            });
          }
        }
      });
    } catch (e) {
      console.warn('Dynamic activity notifications sync warning:', e);
    }

    // Role-specific filtering of stored notifications
    const readIds = getReadNotificationIds(user);

    const filtered = all.filter((n) => {
      if (!n) return false;

      // Student: Only student-targeted items
      if (role === 'student') {
        if (n.target_role === 'staff' || n.target_role === 'admin') return false;
        if (n.target_roles && !n.target_roles.includes('student')) return false;
        if (n.target_username && currentUsername && n.target_username.toLowerCase() !== currentUsername) return false;
        return true;
      }

      // Staff / Registrar: Only staff-targeted items
      if (role === 'staff' || role === 'registrar') {
        if (n.target_role === 'student' || n.target_role === 'admin') return false;
        if (n.target_roles && !n.target_roles.some((r) => r === 'staff' || r === 'registrar')) return false;
        return true;
      }

      // Admin: Only admin-targeted items
      if (role === 'admin') {
        if (n.target_role === 'student' || n.target_role === 'staff') return false;
        if (n.target_roles && !n.target_roles.includes('admin')) return false;
        return true;
      }

      return true;
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
 * Save a new notification into local storage and notify active listeners.
 */
export function saveStoredNotification(notification) {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const item = {
      id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event_type: notification.event_type || 'REQUEST_STATUS_CHANGED',
      message: notification.message,
      related_object_type: notification.related_object_type || 'CredentialRequest',
      related_object_id: notification.related_object_id || '',
      is_read: false,
      created_at: notification.created_at || new Date().toISOString(),
      target_user_id: notification.target_user_id || null,
      target_username: notification.target_username || null,
      target_student_id: notification.target_student_id || null,
      target_roles: notification.target_roles || null,
      target_role: notification.target_role || null,
    };

    const updated = [item, ...existing];
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('regquest_notification_created', { detail: item }));
      window.dispatchEvent(new CustomEvent('regquest_requests_updated', { detail: item }));
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
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const updated = existing.map((n) => (String(n.id) === String(id) ? { ...n, is_read: true } : n));
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
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

    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : [];

    const updated = existing.map((n) => {
      if (idsToMark.includes(n.id)) {
        return { ...n, is_read: true };
      }
      return n;
    });
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
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
      const response = await apiClient.get('/api/notifications/', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.results || []);
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
      return response.data;
    } catch {
      const response = await apiClient.post('/api/notifications/mark-all-read/');
      return response.data;
    }
  },
};

export default notificationsApi;
