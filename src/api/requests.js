import apiClient from './client';
import { saveStoredNotification } from './notifications';
import { saveClearanceAttachment, getClearanceAttachment } from './clearances';
import { getStoredPaymentProof } from './payments';

export const STORAGE_KEY = 'regquest_submitted_requests';
export const STUDENT_REQUESTS_KEY = 'student_my_requests';
export const PROCESSED_ACTIONS_KEY = 'regquest_processed_actions';

// Cross-tab broadcast channel for instant real-time requests sync across Student, Staff, and Admin
let requestsBroadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    requestsBroadcastChannel = new BroadcastChannel('regquest_realtime_requests');
    requestsBroadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'REFRESH_REQUESTS') {
        window.dispatchEvent(
          new CustomEvent('regquest_requests_updated', { detail: event.data.payload })
        );
      }
    };
  } catch (err) {
    console.warn('Requests BroadcastChannel error:', err);
  }
}

// Window storage listener for cross-tab sync in all browsers
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (
      event.key === STORAGE_KEY ||
      event.key === STUDENT_REQUESTS_KEY ||
      event.key === 'regquest_stored_requests'
    ) {
      window.dispatchEvent(new CustomEvent('regquest_requests_updated'));
    }
  });
}

/**
 * Log an action processed by an authenticated account (Staff or Admin).
 * Strictly tags the actor's username so the overview log shows ONLY what was processed
 * using that specific account.
 */
export function logProcessedAction({
  actor,
  actorName,
  actorId,
  actorRole,
  targetName,
  targetId,
  trackingNumber,
  documentType,
  action,
  status,
}) {
  if (!actor) return null;
  try {
    const raw = localStorage.getItem(PROCESSED_ACTIONS_KEY);
    const existing = raw ? JSON.parse(raw) : [];

    const newAction = {
      id: `proc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actor: String(actor).toLowerCase(),
      actorName: actorName || actor,
      actorId: actorId ? String(actorId) : null,
      actorRole: actorRole || 'staff',
      targetName: targetName || 'Student',
      targetId: targetId || trackingNumber || 'N/A',
      trackingNumber: trackingNumber || targetId || 'N/A',
      documentType: documentType || 'Credential Request',
      action: action || 'Processed request',
      status: status || 'Updated',
      timestamp: new Date().toISOString(),
    };

    const updated = [newAction, ...existing].slice(0, 300);
    localStorage.setItem(PROCESSED_ACTIONS_KEY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('regquest_action_logged', { detail: newAction }));
    }
    return newAction;
  } catch (err) {
    console.warn('Failed to log processed action:', err);
    return null;
  }
}

/**
 * Retrieve processed actions strictly filtered by the authenticated user's account.
 */
export function getProcessedActions(user = null) {
  try {
    const raw = localStorage.getItem(PROCESSED_ACTIONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!user) return list;

    const username = (user.username || '').toLowerCase();
    const userId = user.id ? String(user.id) : null;

    return list.filter((item) => {
      if (!item) return false;
      const itemActor = String(item.actor || '').toLowerCase();
      const itemActorId = item.actorId ? String(item.actorId) : null;
      return itemActor === username || (userId && itemActorId === userId);
    });
  } catch {
    return [];
  }
}

/**
 * Filter out any mock/dummy requests for student #1 to #4
 */
export function isDummyStudentRequest(item) {
  if (!item) return false;
  const name = String(item.student_name || item.student || '').trim().toLowerCase();
  const id = String(item.student_id || item.studentId || '').trim().toLowerCase();
  const tracking = String(item.tracking_number || item.trackingId || item.id || '').trim().toLowerCase();
  return (
    /^student\s*#?\s*[1-4]$/i.test(name) ||
    /^student\s*#?\s*[1-4]$/i.test(id) ||
    /^student\s*#?\s*[1-4]$/i.test(tracking) ||
    /student\s*#?\s*[1-4]\b/i.test(name)
  );
}

/**
 * Validate that an item is a genuine, complete request.
 * Excludes corrupt, blank, or placeholder requests (like those with missing tracking numbers,
 * missing dates, or placeholder student names).
 */
export function isValidRequest(item) {
  if (!item || typeof item !== 'object') return false;

  const id = item.tracking_number || item.trackingId || item.id || item.rawId;
  const idStr = String(id || '').trim();

  // Rejects empty, undefined, or generic null IDs
  if (!idStr || idStr === 'undefined' || idStr === 'null' || idStr === 'N/A') {
    return false;
  }

  // Filter dummy student #1 to #4 records
  if (isDummyStudentRequest(item)) {
    return false;
  }

  // Must have a real tracking number or id (at least 3 characters)
  if (idStr.length < 3) {
    return false;
  }

  // Reject dummy/mock/placeholder IDs
  if (/^(dummy|mock|placeholder|temp|sample|req_placeholder)/i.test(idStr)) {
    return false;
  }

  // A genuine request MUST have a valid created_at or request_date timestamp
  const rawDate = item.created_at || item.request_date || item.date;
  if (!rawDate || rawDate === 'N/A' || rawDate === 'null' || rawDate === 'undefined') {
    return false;
  }

  // Reject requests with invalid dates that cannot be parsed
  const parsedDate = new Date(rawDate);
  if (isNaN(parsedDate.getTime()) && !/^\d{4}-\d{2}-\d{2}/.test(String(rawDate))) {
    return false;
  }

  // Check student and document info
  const studentName = String(item.student_name || item.student || '').trim();
  const studentId = String(item.student_id || item.studentId || '').trim();

  // If student is generic "Student" or "N/A" AND studentId is "N/A" or empty, reject as corrupt placeholder
  if (
    (!studentName || studentName === 'Student' || studentName === 'N/A') &&
    (!studentId || studentId === 'N/A')
  ) {
    // If it's a legitimate request with a valid tracking number (e.g. REQ-2026-... or RQ-...), it is legitimate
    const isRealReq = Boolean(
      item.tracking_number &&
      (/^REQ-\d{4}-\d+$/i.test(item.tracking_number) || /^RQ-\d+/i.test(item.tracking_number))
    );
    if (!isRealReq) {
      return false;
    }
  }

  // If document type is generic fallback "Document Request" without credential_type or price info
  const docType = String(item.document_type || item.credential_name || '').trim();
  if (
    docType === 'Document Request' &&
    !item.credential_type &&
    !item.credential_type_details
  ) {
    return false;
  }

  return true;
}

/**
 * Safely parse a timestamp (milliseconds) from any request object.
 */
export function getRequestTimestamp(r) {
  if (!r) return 0;
  if (r.created_at) {
    const t = new Date(r.created_at).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const dStr = r.request_date || r.date;
  if (dStr && dStr !== 'N/A') {
    const t = new Date(dStr).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

/**
 * Standard comparator: Sort requests strictly from newest to oldest.
 */
export function sortRequestsNewestFirst(a, b) {
  const timeA = getRequestTimestamp(a);
  const timeB = getRequestTimestamp(b);
  if (timeA !== timeB) {
    return timeB - timeA; // newest (largest epoch timestamp) first
  }
  const idA = Number(a?.rawId ?? a?.id);
  const idB = Number(b?.rawId ?? b?.id);
  if (!isNaN(idA) && !isNaN(idB) && idA !== idB) {
    return idB - idA;
  }
  return String(b?.tracking_number || b?.id || '').localeCompare(String(a?.tracking_number || a?.id || ''));
}

/**
 * Resolves the true human-readable document name for a request.
 * Prevents generic fallbacks (e.g. 'CAR') from masking specific requests like GPA,
 * Earned Units, Endorsement, Subjects w/ grades, or custom credentials.
 */
export function resolveRequestDocType(r, cred = null) {
  if (!r) return 'Document Request';

  // 1. Check if remarks contain an explicit document tag, e.g. "[Certification - GPA]"
  const remarks = String(r.remarks || r.purpose || '').trim();
  const bracketMatch = remarks.match(/\[(.*?)\]/);
  if (bracketMatch && bracketMatch[1] && bracketMatch[1].trim()) {
    return bracketMatch[1].trim();
  }

  // 2. Check for specific keywords in remarks that indicate exact certification sub-document
  const remLower = remarks.toLowerCase();
  if (remLower.includes('gpa')) return 'Certification - GPA';
  if (remLower.includes('earned unit') || remLower.includes('earned units')) return 'Certification - Earned Units';
  if (remLower.includes('endorsement')) return 'Certification - Endorsement';
  if (remLower.includes('subjects w/ grades') || remLower.includes('subject w/ grade')) return 'Certification - Subjects w/ grades';
  if (remLower.includes('authentication') || remLower.includes('auth')) return 'Authentication';

  // 3. If r.document_type is explicitly set and not a placeholder or default 'CAR' when remarks suggest otherwise
  if (r.document_type && r.document_type !== 'Document' && r.document_type !== 'Document Request') {
    return r.document_type;
  }

  // 4. Credential type details object
  if (r.credential_type_details?.name) {
    return r.credential_type_details.name;
  }

  // 5. Matched CredentialType model
  if (cred?.name) {
    return cred.name;
  }

  // 6. Standard USTP fallbacks for DB ids 1 to 5
  const credTypeFallbacks = {
    1: 'Transcript of records (TOR)',
    2: 'Honorable Dismissal',
    3: 'Evaluation',
    4: 'CAR',
    5: 'Officially enrolled',
  };
  const cId = r.credential_type;
  return credTypeFallbacks[cId] || credTypeFallbacks[Number(cId)] || 'Document Request';
}

/**
 * Permanently purge corrupt, blank, or placeholder requests from localStorage.
 */
export function purgeCorruptRequests() {
  if (typeof window === 'undefined') return;
  try {
    const keys = [STORAGE_KEY, STUDENT_REQUESTS_KEY, 'regquest_stored_requests'];
    let changed = false;

    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const cleaned = list.filter((item) => {
            if (!isValidRequest(item)) return false;
            // Malformed records without a real tracking number (displayed as REQ-0000xx) are removed permanently
            if (!String(item.tracking_number || '').trim()) return false;
            const sName = String(item.student_name || item.student || '').trim();
            const sId = String(item.student_id || item.studentId || '').trim();
            const date = item.created_at || item.request_date || item.date;
            if (!date || date === 'N/A') return false;
            if ((!sName || sName === 'Student' || sName === 'N/A') && (!sId || sId === 'N/A')) {
              const isBackend = item.tracking_number && /^REQ-\d{4}-\d+$/i.test(item.tracking_number);
              if (!isBackend) return false;
            }
            return true;
          });

          if (cleaned.length !== list.length) {
            localStorage.setItem(key, JSON.stringify(cleaned));
            changed = true;
          }
        }
      } catch {}
    });

    if (changed) {
      window.dispatchEvent(new CustomEvent('regquest_requests_updated'));
    }
  } catch {}
}

// Auto-run purge on module initialization
if (typeof window !== 'undefined') {
  purgeCorruptRequests();
}

/**
 * Retrieve stored/submitted requests across student, staff, and admin.
 */
export function getStoredRequests() {
  try {
    purgeCorruptRequests();

    const primary = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const student = JSON.parse(localStorage.getItem(STUDENT_REQUESTS_KEY) || '[]');
    const legacy = JSON.parse(localStorage.getItem('regquest_stored_requests') || '[]');

    const map = new Map();
    [...primary, ...student, ...legacy].forEach((item) => {
      if (!isValidRequest(item)) return;
      const key = item.tracking_number || item.trackingId || item.id;
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    });

    // Clean up any corrupt, dummy, or invalid items from localStorage permanently
    const cleanPrimary = primary.filter(isValidRequest);
    if (cleanPrimary.length !== primary.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanPrimary));
    }
    const cleanStudent = student.filter(isValidRequest);
    if (cleanStudent.length !== student.length) {
      localStorage.setItem(STUDENT_REQUESTS_KEY, JSON.stringify(cleanStudent));
    }
    const cleanLegacy = legacy.filter(isValidRequest);
    if (cleanLegacy.length !== legacy.length) {
      localStorage.setItem('regquest_stored_requests', JSON.stringify(cleanLegacy));
    }

    return Array.from(map.values()).sort(sortRequestsNewestFirst);
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

    if (requestItem.clearance_preview) {
      const meta = {
        isPdf: Boolean(requestItem.clearance_is_pdf),
        fileName: requestItem.clearance_file_name || (requestItem.clearance_is_pdf ? 'Student_Clearance.pdf' : 'Student_Clearance.jpg'),
      };
      saveClearanceAttachment(key, requestItem.clearance_preview, meta);
      if (requestItem.student_id) {
        saveClearanceAttachment(requestItem.student_id, requestItem.clearance_preview, meta);
      }
      if (requestItem.user) {
        saveClearanceAttachment(String(requestItem.user), requestItem.clearance_preview, meta);
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem(STUDENT_REQUESTS_KEY, JSON.stringify(updated));
      localStorage.setItem('regquest_stored_requests', JSON.stringify(updated));
    } catch (quotaErr) {
      console.warn('LocalStorage quota reached, saving trimmed request without bulky base64:', quotaErr);
      const trimmed = updated.map((item) => ({
        ...item,
        clearance_preview: item.clearance_preview?.length > 10000 ? null : item.clearance_preview,
        photo_preview: item.photo_preview?.length > 10000 ? null : item.photo_preview,
      }));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        localStorage.setItem(STUDENT_REQUESTS_KEY, JSON.stringify(trimmed));
        localStorage.setItem('regquest_stored_requests', JSON.stringify(trimmed));
      } catch {}
    }

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
      if (requestsBroadcastChannel) {
        try {
          requestsBroadcastChannel.postMessage({ type: 'REFRESH_REQUESTS', payload: requestItem });
        } catch {}
      }
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
export function updateStoredRequest(idOrTracking, patch, options = {}) {
  try {
    const existing = getStoredRequests();
    let targetMatched = null;
    let previousStatus = null;

    const candidateIds = [
      idOrTracking,
      patch?.id,
      patch?.rawId,
      patch?.tracking_number,
      patch?.trackingId,
      options?.fallbackItem?.id,
      options?.fallbackItem?.rawId,
      options?.fallbackItem?.tracking_number,
      options?.fallbackItem?.trackingId,
    ]
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
      .map((v) => String(v).trim());

    const updated = existing.map((item) => {
      const itemKeys = [item.id, item.rawId, item.tracking_number, item.trackingId]
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
        .map((v) => String(v).trim());

      const match = candidateIds.some((cid) => itemKeys.includes(cid));
      if (match) {
        previousStatus = item.status;
        targetMatched = {
          ...item,
          ...patch,
          updated_at: new Date().toISOString(),
        };
        return targetMatched;
      }
      return item;
    });

    // If the request originated from the backend API and was not in localStorage yet,
    // upsert it so status, clearance verification, and payment confirmation persist locally!
    if (!targetMatched && (options.fallbackItem || patch?.tracking_number || String(idOrTracking || '').startsWith('REQ-'))) {
      const base = options.fallbackItem || {};
      previousStatus = base.status || 'Pending';
      const resolvedTracking =
        patch?.tracking_number ||
        base.tracking_number ||
        base.trackingId ||
        (String(idOrTracking || '').startsWith('REQ-') ? String(idOrTracking) : String(base.id || idOrTracking));

      targetMatched = {
        ...base,
        ...patch,
        id: base.id || idOrTracking,
        rawId: base.rawId || base.id || idOrTracking,
        tracking_number: resolvedTracking,
        created_at: base.created_at || base.request_date || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // Avoid storing circular `raw` reference
      delete targetMatched.raw;
      updated.unshift(targetMatched);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem(STUDENT_REQUESTS_KEY, JSON.stringify(updated));
      localStorage.setItem('regquest_stored_requests', JSON.stringify(updated));
    } catch (quotaErr) {
      console.warn('LocalStorage quota reached on update, saving trimmed request:', quotaErr);
      const trimmed = updated.map((item) => ({
        ...item,
        clearance_preview: item.clearance_preview?.length > 10000 ? null : item.clearance_preview,
        photo_preview: item.photo_preview?.length > 10000 ? null : item.photo_preview,
        receipt_image: item.receipt_image?.length > 10000 ? null : item.receipt_image,
      }));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        localStorage.setItem(STUDENT_REQUESTS_KEY, JSON.stringify(trimmed));
        localStorage.setItem('regquest_stored_requests', JSON.stringify(trimmed));
      } catch {}
    }

    // Exactly ONE notification per real status change (sent to the student).
    // Callers that send their own tailored message pass { silentNotify: true }.
    const statusChanged =
      patch.status &&
      targetMatched &&
      String(previousStatus || '').trim().toLowerCase() !== String(patch.status).trim().toLowerCase();

    if (statusChanged && !options.silentNotify) {
      const trackingCode = targetMatched.tracking_number || targetMatched.trackingId || targetMatched.id;
      const docTitle = targetMatched.document_type || 'Document';

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
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('regquest_requests_updated', { detail: { idOrTracking, patch } })
      );
      if (requestsBroadcastChannel) {
        try {
          requestsBroadcastChannel.postMessage({ type: 'REFRESH_REQUESTS', payload: { idOrTracking, patch } });
        } catch {}
      }
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
      const rawList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      backendResults = rawList.map((b) => ({
        ...b,
        document_type: b.document_type || resolveRequestDocType(b),
      }));
    } catch (err) {
      console.warn('requestsApi.list backend returned error, using local requests:', err);
    }

    const localRequests = getStoredRequests();
    if (!localRequests.length) {
      return backendResults.filter(isValidRequest).sort(sortRequestsNewestFirst);
    }

    const combined = [...backendResults];
    localRequests.forEach((loc) => {
      const locKeys = [loc.tracking_number, loc.trackingId, loc.id, loc.rawId]
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
        .map((v) => String(v).trim());

      const index = combined.findIndex((c) => {
        const cKeys = [c.tracking_number, c.trackingId, c.id, c.rawId]
          .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
          .map((v) => String(v).trim());
        return locKeys.some((k) => cKeys.includes(k));
      });

      if (index === -1) {
        combined.unshift(loc);
      } else {
        const backendItem = combined[index];
        const locStatusUpper = String(loc.status || '').trim().toUpperCase();
        // Always prefer local status if locally updated (or non-pending), since backend transitions may lag or fail
        const preferredStatus =
          (loc.updated_at && loc.status) || (loc.status && locStatusUpper !== 'PENDING')
            ? loc.status
            : (backendItem.status && String(backendItem.status).toUpperCase() !== 'PENDING'
                ? backendItem.status
                : (loc.status || backendItem.status));

        combined[index] = {
          ...backendItem,
          ...loc,
          id: backendItem.id || loc.id,
          rawId: backendItem.id || loc.rawId || loc.id,
          tracking_number: backendItem.tracking_number || loc.tracking_number || loc.id,
          student_name: loc.student_name || backendItem.student_name,
          student_id: loc.student_id || backendItem.student_id,
          document_type: loc.document_type || resolveRequestDocType(backendItem) || backendItem.document_type,
          copies: loc.copies || backendItem.copies || '1 copy',
          amount: loc.amount || loc.assessed_amount || backendItem.amount,
          assessed_amount: loc.assessed_amount || loc.amount || backendItem.assessed_amount || null,
          price: loc.price || backendItem.price,
          date_of_release: loc.date_of_release || loc.release_date || backendItem.date_of_release,
          release_date: loc.release_date || loc.date_of_release || backendItem.release_date,
          verified_by_name: loc.verified_by_name || backendItem.verified_by_name || null,
          clearance_preview: loc.clearance_preview || backendItem.clearance_preview,
          clearance_id: loc.clearance_id || backendItem.clearance_id || null,
          clearance_is_pdf: loc.clearance_is_pdf ?? backendItem.clearance_is_pdf ?? false,
          clearance_file_name: loc.clearance_file_name || backendItem.clearance_file_name || null,
          clearance_status: loc.clearance_status || backendItem.clearance_status || null,
          is_confirmed: Boolean(loc.is_confirmed || backendItem.is_confirmed),
          confirmed_for_payment: Boolean(loc.confirmed_for_payment || backendItem.confirmed_for_payment),
          payment_status: loc.payment_status || backendItem.payment_status || null,
          payment_proof: loc.payment_proof || backendItem.payment_proof || null,
          or_number: loc.or_number || backendItem.or_number || '',
          receipt_image: loc.receipt_image || backendItem.receipt_image || null,
          photo_preview: loc.photo_preview || backendItem.photo_preview,
          purpose: loc.purpose || backendItem.remarks,
          status: preferredStatus,
          remarks: loc.remarks || backendItem.remarks,
          notes: loc.notes || loc.remarks || backendItem.remarks,
        };
      }
    });

    return combined
      .filter(isValidRequest)
      .map((item) => {
        let enriched = { ...item };
        if (!enriched.clearance_preview || (!enriched.clearance_preview.startsWith('data:') && !enriched.clearance_preview.startsWith('blob:'))) {
          const clRec = getClearanceAttachment([
            enriched.tracking_number,
            enriched.id,
            enriched.rawId,
            enriched.student_id,
            enriched.user,
          ]);
          if (clRec?.dataUrl) {
            enriched.clearance_preview = clRec.dataUrl;
            enriched.clearance_is_pdf = Boolean(clRec.meta?.isPdf || clRec.dataUrl.startsWith('data:application/pdf'));
            enriched.clearance_file_name = clRec.meta?.fileName || enriched.clearance_file_name || 'Clearance Document';
            enriched.clearance_status = enriched.clearance_status || 'PENDING';
          }
        }

        const payProof = getStoredPaymentProof([
          enriched.tracking_number,
          enriched.id,
          enriched.rawId,
        ]);
        if (payProof) {
          enriched.payment_proof = payProof;
          enriched.payment_status = enriched.payment_status || payProof.status;
          enriched.or_number = enriched.or_number || payProof.receiptReferenceNumber;
          enriched.receipt_image = enriched.receipt_image || payProof.receiptImage;
          enriched.payment_submission_type = enriched.payment_submission_type || payProof.submissionType;
        }

        return enriched;
      })
      .sort(sortRequestsNewestFirst);
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
    return resData || { id, ...payload };
  },

  /**
   * Fetch all credential types.
   */
  getCredentialTypes: async () => {
    const response = await apiClient.get('/api/credential-types/');
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  /**
   * ML Turnaround Prediction: Predict estimated turnaround duration for a credential request.
   * @param {Object} [params] - { credentialType, purpose, dateRequested, numDocuments }
   * @returns {Promise<Object>}
   */
  predictTurnaround: async (params = {}) => {
    const response = await apiClient.get('/api/credentials/predict-turnaround/', {
      params: {
        credential_type: params.credentialType || params.credential_type || 'TOR',
        purpose: params.purpose || 'Employment',
        date_requested: params.dateRequested || params.date_requested,
        num_documents: params.numDocuments || params.num_documents || 1,
      },
    });
    return response.data;
  },

  /**
   * ML Demand Forecasting: Get daily incoming request forecast for upcoming operating days.
   * @param {Object} [params] - { startDate, operatingDays }
   * @returns {Promise<Object>}
   */
  getDailyForecast: async (params = {}) => {
    const response = await apiClient.get('/api/credentials/forecast/daily/', {
      params: {
        start_date: params.startDate || params.start_date,
        operating_days: params.operatingDays || params.operating_days || 5,
      },
    });
    return response.data;
  },

  /**
   * ML Workload Forecasting: Get monthly workload volume forecast and 4-tier classification.
   * @param {Object} [params] - { targetMonth }
   * @returns {Promise<Object>}
   */
  getMonthlyWorkload: async (params = {}) => {
    const response = await apiClient.get('/api/credentials/forecast/monthly-workload/', {
      params: {
        target_month: params.targetMonth || params.target_month,
      },
    });
    return response.data;
  },

  /**
   * ML Microservice Health Check: Inspect ML service availability and loaded models.
   * @returns {Promise<Object>}
   */
  getMLHealth: async () => {
    const response = await apiClient.get('/api/credentials/ml-health/');
    return response.data;
  },
};

export default requestsApi;

/**
 * Checks if a request document has been confirmed by staff/admin or is ready for payment.
 * Returns true if status is "Pending Payment" / "For Payment" / "Cleared for Payment"
 * or subsequent stages (For Processing, Processing, Releasing, Claimed).
 */
export function isConfirmedForPayment(req) {
  if (!req) return false;
  const s = String(req.status || '').trim().toUpperCase();
  const rawStatus = String(req.rawStatus || req.raw_status || '').trim().toUpperCase();
  const paymentStatus = String(req.payment_status || '').trim().toUpperCase();

  // If status is "Pending Payment" / "For Payment" / "Cleared for Payment"
  if (
    s === 'PENDING PAYMENT' ||
    s === 'PENDING_PAYMENT' ||
    s === 'PAYMENT_PENDING' ||
    s === 'PAYMENT PENDING' ||
    s === 'FOR PAYMENT' ||
    s === 'FOR_PAYMENT' ||
    s === 'CLEARED FOR PAYMENT' ||
    rawStatus === 'PAYMENT_PENDING' ||
    rawStatus === 'CLEARED FOR PAYMENT'
  ) {
    return true;
  }

  // If payment has already been submitted or verified
  if (
    paymentStatus === 'VERIFIED' ||
    paymentStatus === 'PAYMENT_SUBMITTED' ||
    s === 'FOR PROCESSING' ||
    s === 'FOR_PROCESSING' ||
    s === 'PROCESSING' ||
    s === 'RELEASING' ||
    s === 'FOR RELEASE' ||
    s === 'READY_FOR_RELEASE' ||
    s === 'CLAIMED' ||
    s === 'RELEASED' ||
    rawStatus === 'PAYMENT_VERIFIED'
  ) {
    return true;
  }

  if (req.confirmed_for_payment || req.is_confirmed || (req.assessed_by && s !== 'PENDING')) {
    return true;
  }

  return false;
}
