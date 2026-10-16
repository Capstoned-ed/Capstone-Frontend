import apiClient from './client';
import { saveStoredNotification } from './notifications';

export const STORAGE_KEY = 'regquest_submitted_requests';
export const STUDENT_REQUESTS_KEY = 'student_my_requests';

/**
 * Retrieve stored/submitted requests across student, staff, and admin.
 */
export function getStoredRequests() {
  try {
    const primary = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const student = JSON.parse(localStorage.getItem(STUDENT_REQUESTS_KEY) || '[]');

    const map = new Map();
    [...primary, ...student].forEach((item) => {
      if (!item) return;
      const key = item.tracking_number || item.trackingId || item.id;
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  } catch (err) {
    console.warn('Failed to load stored requests:', err);
    return [];
  }
}

/**
 * Save a newly submitted request into localStorage so it is instantly visible to Admin and Staff,
 * and dynamically trigger notifications for both student and staff/admin.
 */
export function saveStoredRequest(requestItem) {
  try {
    const existing = getStoredRequests();
    const key = requestItem.tracking_number || requestItem.trackingId || requestItem.id;
    const filtered = existing.filter((item) => {
      const itemKey = item.tracking_number || item.trackingId || item.id;
      return itemKey !== key;
    });
    const updated = [requestItem, ...filtered];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(STUDENT_REQUESTS_KEY, JSON.stringify(updated));

    const trackingCode = requestItem.tracking_number || requestItem.trackingId || requestItem.id || 'REQ';
    const docTitle = requestItem.document_type || requestItem.credential_type_details?.name || 'Document';
    const studentName = requestItem.student_name || 'Student';

    // 1. Notification for Student (Personal status & confirmation)
    saveStoredNotification({
      event_type: 'REQUEST_CREATED',
      message: `Your credential request (${trackingCode}) for ${docTitle} has been submitted. Status: Pending.`,
      related_object_type: 'CredentialRequest',
      related_object_id: trackingCode,
      target_user_id: requestItem.user || null,
      target_username: requestItem.student_name || null,
      target_student_id: requestItem.student_id || null,
      target_role: 'student',
    });

    // 2. Notification for Staff (Operational queue alert)
    saveStoredNotification({
      event_type: 'REQUEST_CREATED',
      message: `Incoming Request: ${studentName} (${requestItem.student_id || 'Student'}) requested ${docTitle} (${trackingCode}).`,
      related_object_type: 'CredentialRequest',
      related_object_id: trackingCode,
      target_roles: ['staff', 'registrar'],
      target_role: 'staff',
    });

    // 3. Notification for Admin (Institutional volume audit)
    saveStoredNotification({
      event_type: 'REQUEST_CREATED',
      message: `System Audit: New document request (${trackingCode}) logged for ${studentName} (${docTitle}).`,
      related_object_type: 'CredentialRequest',
      related_object_id: trackingCode,
      target_role: 'admin',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('regquest_requests_updated', { detail: requestItem }));
    }
    return updated;
  } catch (err) {
    console.warn('Failed to save stored request:', err);
    return [];
  }
}

/**
 * Update the status, remarks, or staff assignment of a request in localStorage,
 * and dynamically trigger notifications when status updates.
 */
export function updateStoredRequest(idOrTracking, patch) {
  try {
    const existing = getStoredRequests();
    let targetMatched = null;

    const updated = existing.map((item) => {
      const match =
        item.id === idOrTracking ||
        item.rawId === idOrTracking ||
        item.tracking_number === idOrTracking ||
        item.trackingId === idOrTracking;
      if (match) {
        targetMatched = { ...item, ...patch };
        return targetMatched;
      }
      return item;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(STUDENT_REQUESTS_KEY, JSON.stringify(updated));

    // If status is updated, dynamically notify Student, Staff, and Admin based on their activity
    if (patch.status && targetMatched) {
      const trackingCode = targetMatched.tracking_number || targetMatched.trackingId || targetMatched.id;
      const studentName = targetMatched.student_name || 'Student';
      const docTitle = targetMatched.document_type || 'Document';

      // 1. Notify Student (Direct status feedback)
      saveStoredNotification({
        event_type: 'REQUEST_STATUS_CHANGED',
        message: `Status update: Your request (${trackingCode}) for ${docTitle} has moved to ${patch.status}.`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_user_id: targetMatched.user || null,
        target_username: targetMatched.student_name || null,
        target_student_id: targetMatched.student_id || null,
        target_role: 'student',
      });

      // 2. Notify Staff (Queue state update)
      saveStoredNotification({
        event_type: 'REQUEST_STATUS_CHANGED',
        message: `Processing Queue: Request ${trackingCode} (${studentName}) transitioned to ${patch.status}.`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_roles: ['staff', 'registrar'],
        target_role: 'staff',
      });

      // 3. Notify Admin (Workflow audit log)
      saveStoredNotification({
        event_type: 'REQUEST_STATUS_CHANGED',
        message: `Workflow Audit: Request ${trackingCode} (${studentName}) status updated to ${patch.status}.`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_role: 'admin',
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('regquest_requests_updated', { detail: { idOrTracking, patch } })
      );
    }
    return updated;
  } catch (err) {
    console.warn('Failed to update stored request:', err);
    return [];
  }
}

export const requestsApi = {
  /**
   * Fetch list of all credential requests (for Admin / Staff / Student).
   * Combines backend database requests with submitted frontend requests.
   */
  list: async (params = {}) => {
    let backendResults = [];
    try {
      const response = await apiClient.get('/api/requests/', { params });
      backendResults = Array.isArray(response.data) ? response.data : (response.data?.results || []);
    } catch (err) {
      console.warn('requestsApi.list backend returned error, using local requests:', err);
    }

    const localRequests = getStoredRequests();
    if (!localRequests.length) {
      return backendResults;
    }

    const backendKeyMap = new Map();
    backendResults.forEach((b) => {
      if (b.tracking_number) backendKeyMap.set(b.tracking_number, b);
      if (b.id) backendKeyMap.set(String(b.id), b);
    });

    const combined = [...backendResults];
    localRequests.forEach((loc) => {
      const key = loc.tracking_number || loc.trackingId || String(loc.id);
      if (key && !backendKeyMap.has(key)) {
        combined.unshift(loc);
      } else if (key && backendKeyMap.has(key)) {
        const index = combined.findIndex((c) => c.tracking_number === key || String(c.id) === key);
        if (index !== -1) {
          const backendItem = combined[index];
          const preferredStatus =
            backendItem.status && backendItem.status !== 'PENDING'
              ? backendItem.status
              : (loc.status || backendItem.status);

          combined[index] = {
            ...loc,
            ...backendItem,
            student_name: loc.student_name || backendItem.student_name,
            student_id: loc.student_id || backendItem.student_id,
            document_type: loc.document_type || backendItem.document_type,
            copies: loc.copies || backendItem.copies || '1 copy',
            amount: loc.amount || backendItem.amount,
            price: loc.price || backendItem.price,
            clearance_preview: loc.clearance_preview || backendItem.clearance_preview,
            photo_preview: loc.photo_preview || backendItem.photo_preview,
            purpose: loc.purpose || backendItem.remarks,
            status: preferredStatus,
            remarks: loc.remarks || backendItem.remarks,
          };
        }
      }
    });

    return combined;
  },

  /**
   * Fetch single request details by ID
   */
  get: async (id) => {
    try {
      const response = await apiClient.get(`/api/requests/${id}/`);
      return response.data;
    } catch {
      const stored = getStoredRequests();
      const matched = stored.find(
        (r) => r.id === id || r.rawId === id || r.tracking_number === id || r.trackingId === id
      );
      if (matched) return matched;
      throw new Error(`Request #${id} not found.`);
    }
  },

  /**
   * Create a new credential request (for Students).
   */
  create: async (payload) => {
    const response = await apiClient.post('/api/requests/', payload);
    return response.data;
  },

  /**
   * Transition request status (e.g. PAYMENT_VERIFIED -> PROCESSING -> READY_FOR_RELEASE)
   */
  transition: async (id, payload) => {
    let resData = null;
    try {
      const response = await apiClient.patch(`/api/requests/${id}/transition/`, payload);
      resData = response.data;
    } catch (apiErr) {
      console.warn('Backend transition notice:', apiErr);
    }
    // Update local store as well
    updateStoredRequest(id, {
      status: payload.status,
      remarks: payload.remarks,
    });
    return resData || { id, ...payload };
  },

  /**
   * Fetch all credential types.
   */
  getCredentialTypes: async () => {
    const response = await apiClient.get('/api/credential-types/');
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },
};

export default requestsApi;
