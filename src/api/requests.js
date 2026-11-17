import { jwtDecode } from 'jwt-decode';
import apiClient from './client';
import credentialTypesApi from './credentialTypes';
import { saveStoredNotification } from './notifications';
import { saveClearanceAttachment, getClearanceAttachment } from './clearances';
import { getStoredPaymentProof } from './payments';
import {
  REQUEST_STATUS,
  normalizeToBackendStatus,
  BACKEND_STATUS_MAP,
  formatStatusDisplay,
  isClaimedStatus,
} from '../constants/workflowStatuses';

export {
  REQUEST_STATUS,
  normalizeToBackendStatus,
  BACKEND_STATUS_MAP,
  formatStatusDisplay,
  isClaimedStatus,
};

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

export function getRequestsStorageKey(user = null) {
  const uid = getActiveUserId(user);
  return uid !== 'anon' ? `requests_${uid}` : 'regquest_submitted_requests';
}

export const STORAGE_KEY = 'regquest_submitted_requests';
export const STUDENT_REQUESTS_KEY = 'student_my_requests';
export const PROCESSED_ACTIONS_KEY = 'regquest_processed_actions';
export const ASSIGNMENTS_KEY = 'regquest_staff_assignments';
export const ASSIGNMENT_TIMESTAMPS_KEY = 'regquest_staff_assignment_timestamps';

export function getStaffAssignments() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStaffAssignments(map) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('regquest_assignments_updated'));
    window.dispatchEvent(new Event('regquest_requests_updated'));
  } catch (err) {
    console.error('Failed to save staff assignments to localStorage:', err);
  }
}

export const ACTIVITY_TIMESTAMPS_KEY = 'regquest_activity_timestamps';

export function getRequestActivityTimestamps() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACTIVITY_TIMESTAMPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordRequestActivityTimestamp(idOrItem, timestamp = Date.now()) {
  if (typeof window === 'undefined' || !idOrItem) return;
  try {
    const map = getRequestActivityTimestamps();
    const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    if (isNaN(ts) || ts <= 0) return;

    const keys = [];
    if (typeof idOrItem === 'object') {
      keys.push(idOrItem.id, idOrItem.rawId, idOrItem.tracking_number, idOrItem.trackingId);
    } else {
      keys.push(idOrItem);
    }

    keys.filter(Boolean).forEach((k) => {
      map[String(k).trim()] = ts;
    });

    localStorage.setItem(ACTIVITY_TIMESTAMPS_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('regquest_activity_updated'));
  } catch (err) {
    console.warn('Failed to record request activity timestamp:', err);
  }
}

export function getStaffAssignmentTimestamps() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ASSIGNMENT_TIMESTAMPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordStaffAssignmentTimestamp(idOrItem, timestamp = Date.now()) {
  if (typeof window === 'undefined' || !idOrItem) return;
  try {
    const map = getStaffAssignmentTimestamps();
    const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    if (isNaN(ts) || ts <= 0) return;

    const keys = [];
    if (typeof idOrItem === 'object') {
      keys.push(idOrItem.id, idOrItem.rawId, idOrItem.tracking_number, idOrItem.trackingId);
    } else {
      keys.push(idOrItem);
    }

    keys.filter(Boolean).forEach((k) => {
      map[String(k).trim()] = ts;
    });

    localStorage.setItem(ASSIGNMENT_TIMESTAMPS_KEY, JSON.stringify(map));
    recordRequestActivityTimestamp(idOrItem, ts);
    window.dispatchEvent(new Event('regquest_assignments_updated'));
  } catch (err) {
    console.warn('Failed to record staff assignment timestamp:', err);
  }
}

export function isRequestAssignedToUser(request, currentUser, assignmentsMap = null, usersList = []) {
  if (!request || !currentUser) return false;

  const assignments = assignmentsMap || getStaffAssignments();

  const reqKeys = [
    request.id,
    request.tracking_number,
    request.rawId,
    request.trackingId,
    request.raw?.id,
    request.raw?.tracking_number,
    request.raw?.rawId,
  ].filter((v) => v !== undefined && v !== null).map(String);

  // 1. Build list of candidate identifiers for current user
  const candidates = new Set();
  const addCandidate = (val) => {
    if (val !== undefined && val !== null) {
      const s = String(val).trim().toLowerCase();
      if (
        s &&
        s !== 'staff' &&
        s !== 'admin' &&
        s !== 'registrar' &&
        s !== 'user' &&
        s !== 'undefined' &&
        s !== 'null'
      ) {
        candidates.add(s);
      }
    }
  };

  if (currentUser.username) {
    const u = String(currentUser.username).trim().toLowerCase();
    if (u) candidates.add(u);
  }
  if (currentUser.full_name) {
    const f = String(currentUser.full_name).trim().toLowerCase();
    if (f) candidates.add(f);
  }
  const fullNameFromFirstLast = [currentUser.first_name, currentUser.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase();
  if (fullNameFromFirstLast) {
    candidates.add(fullNameFromFirstLast);
  }
  if (currentUser.id !== undefined && currentUser.id !== null) {
    candidates.add(String(currentUser.id).trim().toLowerCase());
  }
  if (currentUser.userId !== undefined && currentUser.userId !== null) {
    candidates.add(String(currentUser.userId).trim().toLowerCase());
  }

  if (Array.isArray(usersList) && usersList.length > 0) {
    const matched = usersList.find(
      (u) =>
        (u.id && String(u.id) === String(currentUser.id || currentUser.userId)) ||
        (u.username &&
          currentUser.username &&
          String(u.username).toLowerCase() === String(currentUser.username).toLowerCase())
    );
    if (matched) {
      if (matched.username) candidates.add(String(matched.username).trim().toLowerCase());
      const mName = [matched.first_name, matched.last_name]
        .filter(Boolean)
        .join(' ')
        .trim()
        .toLowerCase();
      if (mName) candidates.add(mName);
      if (matched.id) candidates.add(String(matched.id).trim().toLowerCase());
    }
  }

  // 2. Check if explicitly claimed by this specific user in local storage
  try {
    const claimedRaw = typeof window !== 'undefined' ? localStorage.getItem('regquest_claimed_requests') : null;
    if (claimedRaw) {
      const claimedMap = JSON.parse(claimedRaw);
      for (const k of reqKeys) {
        if (claimedMap[k]) {
          const val = String(claimedMap[k]).trim().toLowerCase();
          if (candidates.has(val)) {
            return true;
          }
        }
      }
    }
  } catch {}

  // 3. Check assignments mapping (by key)
  let assignedVal = null;
  for (const k of reqKeys) {
    const kStr = String(k).trim();
    if (assignments[kStr] !== undefined && assignments[kStr] !== null && assignments[kStr] !== '') {
      assignedVal = assignments[kStr];
      break;
    }
    if (assignments[k] !== undefined && assignments[k] !== null && assignments[k] !== '') {
      assignedVal = assignments[k];
      break;
    }
  }

  // 4. Fallback to properties on the request itself
  if (assignedVal === null || assignedVal === undefined || assignedVal === '') {
    assignedVal =
      request.assigned_staff ||
      request.assigned_to ||
      request.assignedStaff ||
      request.raw?.assigned_staff ||
      request.raw?.assigned_to ||
      '';
  }

  // 5. Fallback to assigned tag in remarks (e.g. "[Assigned to: Faith]" or "Assigned to: Faith")
  if (assignedVal === null || assignedVal === undefined || assignedVal === '') {
    const rem = String(request.remarks || request.raw?.remarks || request.notes || '');
    const match = rem.match(/\[Assigned(?:\s+to)?:\s*([^\]]+)\]/i) || rem.match(/Assigned(?:\s+to)?:\s*([^|\n\r;]+)/i);
    if (match) {
      assignedVal = match[1].trim();
    }
  }

  if (!assignedVal) return false;

  let assignedStr = '';
  if (typeof assignedVal === 'object') {
    assignedStr = String(assignedVal.name || assignedVal.username || assignedVal.id || '').trim().toLowerCase();
  } else {
    assignedStr = String(assignedVal).trim().toLowerCase();
  }

  if (!assignedStr || assignedStr === 'unassigned' || assignedStr === 'none' || assignedStr === 'null') {
    return false;
  }

  for (const candidate of candidates) {
    if (assignedStr === candidate) return true;
    if (candidate.length >= 3 && (assignedStr.includes(candidate) || candidate.includes(assignedStr))) {
      return true;
    }
  }

  return false;
}

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
      event.key === 'regquest_stored_requests' ||
      event.key === ASSIGNMENTS_KEY
    ) {
      window.dispatchEvent(new CustomEvent('regquest_requests_updated'));
      window.dispatchEvent(new CustomEvent('regquest_assignments_updated'));
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
    // If it's a legitimate request with a valid tracking number, it is legitimate
    const isRealReq = Boolean(
      item.tracking_number &&
      (
        /^[A-Z0-9]+-\d{2}-\d{2}-\d{2}-/i.test(item.tracking_number) ||
        /^REQ-\d{4}-\d+$/i.test(item.tracking_number) ||
        /^RQ-\d+/i.test(item.tracking_number)
      )
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
 * Inspects recorded activity timestamps, recent updates, and creation dates
 * so newly updated or newly created requests sort directly to the very top.
 */
export function getRequestTimestamp(r) {
  if (!r) return 0;

  const keys = [r.tracking_number, r.id, r.rawId, r.trackingId].filter(Boolean).map((k) => String(k).trim());

  const activityMap = getRequestActivityTimestamps();
  let activityTime = 0;
  for (const k of keys) {
    if (activityMap[k]) {
      const num = Number(activityMap[k]);
      if (!isNaN(num) && num > activityTime) {
        activityTime = num;
      }
    }
  }

  const assignTimestamps = getStaffAssignmentTimestamps();
  let assignTime = 0;
  for (const k of keys) {
    if (assignTimestamps[k]) {
      const num = Number(assignTimestamps[k]);
      if (!isNaN(num) && num > assignTime) {
        assignTime = num;
      }
    }
  }

  const candidates = [
    activityTime,
    assignTime,
    r.updated_at,
    r.updatedAt,
    r.last_updated,
    r.assigned_at,
    r.accepted_at,
    r.created_at,
    r.request_date && r.request_date !== 'N/A' ? r.request_date : null,
    r.date && r.date !== 'N/A' ? r.date : null,
  ];

  let maxTime = 0;
  for (const c of candidates) {
    if (!c) continue;
    let t = 0;
    if (typeof c === 'number') {
      t = c;
    } else if (typeof c === 'string' && /^\d{10,}$/.test(c.trim())) {
      t = Number(c.trim());
    } else {
      const parsed = new Date(c).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        t = parsed;
      }
    }
    if (t > maxTime) {
      maxTime = t;
    }
  }

  return maxTime;
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

  const isInvalidDocName = (name) => {
    if (!name) return true;
    const norm = String(name).trim().toLowerCase();
    return (
      norm === '' ||
      norm === 'document' ||
      norm === 'document request' ||
      norm === 'walk-in ftf' ||
      norm === 'walk-in' ||
      norm === 'walkin' ||
      norm === 'ftf'
    );
  };

  // 1. If r.document_type is explicitly set to a valid document name, prioritize it directly!
  if (!isInvalidDocName(r.document_type)) {
    return r.document_type;
  }

  // 2. Check if remarks contain an explicit document tag, e.g. "[Evaluation & TOR]" or "[Certification - GPA]"
  // (prioritize before credential_type_details.name so multi-document or sub-document requests aren't masked by primary cred type)
  const remarks = String(r.remarks || r.purpose || '').trim();
  const bracketMatch = remarks.match(/\[(.*?)\]/);
  if (bracketMatch && bracketMatch[1] && bracketMatch[1].trim()) {
    const candidate = bracketMatch[1].trim();
    if (
      !isInvalidDocName(candidate) &&
      !candidate.toLowerCase().includes('staff') &&
      !candidate.toLowerCase().includes('walk-in') &&
      !candidate.toLowerCase().includes('ftf')
    ) {
      return candidate;
    }
  }

  // 3. Credential type details object
  if (!isInvalidDocName(r.credential_type_details?.name)) {
    return r.credential_type_details.name;
  }

  // 4. Matched CredentialType model from database
  if (!isInvalidDocName(cred?.name)) {
    return cred.name;
  }

  // 5. Check for specific keywords in remarks that indicate exact certification sub-document
  const remLower = remarks.toLowerCase();
  if (remLower.includes('gpa')) return 'Certification - GPA';
  if (remLower.includes('earned unit') || remLower.includes('earned units')) return 'Certification - Earned Units';
  if (remLower.includes('endorsement')) return 'Certification - Endorsement';
  if (remLower.includes('subjects w/ grades') || remLower.includes('subject w/ grade')) return 'Certification - Subjects w/ grades';
  if (remLower.includes('authentication') || /\bauth\b/.test(remLower)) return 'Authentication';
  if (remLower.includes('transcript') || /\btor\b/.test(remLower)) return 'Transcript of Records (TOR)';
  if (remLower.includes('dismissal')) return 'Honorable Dismissal';
  if (remLower.includes('evaluation')) return 'Evaluation';

  // 6. Standard USTP fallbacks for DB ids 1 to 5
  const credTypeFallbacks = {
    1: 'Transcript of Records (TOR)',
    2: 'Honorable Dismissal',
    3: 'Evaluation',
    4: 'CAR',
    5: 'Officially enrolled',
  };
  const cId = r.credential_type;
  return credTypeFallbacks[cId] || credTypeFallbacks[Number(cId)] || 'Document Request';
}

/**
 * Permanently purge stored request arrays, base64 files, and ghost cache from localStorage.
 * Frees storage quota immediately and ensures the application exclusively renders live backend data.
 */
export function purgeCorruptRequests() {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('requests_') ||
        k === STORAGE_KEY ||
        k === STUDENT_REQUESTS_KEY ||
        k === 'regquest_stored_requests' ||
        k.startsWith('regquest_clearance_') ||
        k.startsWith('regquest_latest_clearance_') ||
        k.startsWith('regquest_payment_proof_') ||
        k === 'regquest_users_cache' ||
        k === 'regquest_student_profiles' ||
        k === 'regquest_staff_profiles'
      ) {
        keysToRemove.push(k);
      }
    }
    if (keysToRemove.length > 0) {
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      window.dispatchEvent(new CustomEvent('regquest_requests_updated'));
    }
  } catch (err) {
    console.warn('Failed to purge requests from localStorage:', err);
  }
}

// Auto-run purge on module initialization
if (typeof window !== 'undefined') {
  purgeCorruptRequests();
}

/**
 * Retrieve stored/submitted requests across student, staff, and admin.
 * Returns empty array: all requests are strictly loaded live from Django REST API.
 */
export function getStoredRequests(user = null) {
  purgeCorruptRequests();
  return [];
}

/**
 * Handle a newly submitted request: records activity timestamps, sends user notifications,
 * and broadcasts refresh events across browser contexts without persisting bulky payloads to localStorage.
 */
export function saveStoredRequest(requestItem, user = null) {
  try {
    const candidateIds = [
      requestItem?.id,
      requestItem?.rawId,
      requestItem?.tracking_number,
      requestItem?.trackingId,
    ].filter(Boolean);

    // Always record activity timestamp so this request instantly sorts to the top
    const nowTime = Date.now();
    candidateIds.forEach((cid) => {
      recordRequestActivityTimestamp(cid, nowTime);
    });

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
    return [requestItem];
  } catch (err) {
    console.warn('Failed to save stored request notification:', err);
    return [];
  }
}

/**
 * Handle a request update: records activity timestamp, sends notification for status changes,
 * and broadcasts update event without persisting bulky payloads to localStorage.
 */
export function updateStoredRequest(idOrTracking, patch, options = {}) {
  try {
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

    // Always record activity timestamp so this request instantly sorts to the top
    const nowTime = Date.now();
    candidateIds.forEach((cid) => {
      recordRequestActivityTimestamp(cid, nowTime);
    });

    const targetMatched = options.fallbackItem || patch || {};
    const previousStatus = targetMatched.status || 'Pending';

    // Exactly ONE notification per real status change (sent to the student).
    const statusChanged =
      patch.status &&
      String(previousStatus || '').trim().toLowerCase() !== String(patch.status).trim().toLowerCase();

    if (statusChanged && !options.silentNotify) {
      const trackingCode = targetMatched.tracking_number || targetMatched.trackingId || targetMatched.id || idOrTracking;
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
    return [targetMatched];
  } catch (err) {
    console.warn('Failed to update request notification:', err);
    return [];
  }
}

export const requestsApi = {
  /**
   * Fetch list of all credential requests directly from Django REST API.
   * Completely live and never relies on localStorage caching.
   */
  list: async (params = {}, user = null) => {
    let backendResults = [];
    try {
      const response = await apiClient.get('/api/requests/', { params });
      const rawList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      backendResults = rawList.map((b) => {
        const latestBackendPayment = Array.isArray(b.payments) && b.payments.length > 0 ? b.payments[0] : null;
        return {
          ...b,
          document_type: b.document_type || resolveRequestDocType(b),
          payment_status: b.payment_status || latestBackendPayment?.status || null,
          or_number: b.or_number || latestBackendPayment?.receipt_reference_number || '',
          receipt_image: b.receipt_image || latestBackendPayment?.receipt_image || null,
          payment_proof: b.payment_proof || (latestBackendPayment ? {
            id: latestBackendPayment.id,
            requestId: b.id,
            trackingNumber: b.tracking_number,
            amount: latestBackendPayment.amount,
            receiptReferenceNumber: latestBackendPayment.receipt_reference_number,
            receiptImage: latestBackendPayment.receipt_image,
            status: latestBackendPayment.status,
            remarks: latestBackendPayment.remarks,
          } : null),
        };
      });
    } catch (err) {
      console.warn('requestsApi.list backend returned error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
    }

    return backendResults
      .filter(isValidRequest)
      .map((item) => {
        let enriched = { ...item };
        if (Array.isArray(enriched.payments) && enriched.payments.length > 0) {
          const latestPay = enriched.payments[0];
          if (!enriched.payment_status && latestPay?.status) {
            enriched.payment_status =
              latestPay.status === 'PENDING' ? 'PAYMENT_SUBMITTED' : latestPay.status;
          }
          if (!enriched.or_number && latestPay?.receipt_reference_number) {
            enriched.or_number = latestPay.receipt_reference_number;
          }
          if (!enriched.assessed_amount && latestPay?.amount) {
            enriched.assessed_amount = latestPay.amount;
          }
        }
        return enriched;
      })
      .sort(sortRequestsNewestFirst);
  },

  /**
   * Fetch single request details by ID
   */
  get: async (id) => {
    const response = await apiClient.get(`/api/requests/${id}/`);
    return response.data;
  },

  /**
   * Create a new credential request (for Students).
   */
  create: async (payload) => {
    const response = await apiClient.post('/api/requests/', payload);
    return response.data;
  },

  /**
   * Assign staff member to request and add to processing queue in backend DB
   */
  assign: async (id, payload = {}) => {
    const response = await apiClient.patch(`/api/requests/${id}/assign/`, payload);
    return response.data;
  },

  /**
   * Transition request status (e.g. PAYMENT_VERIFIED -> PROCESSING -> READY_FOR_RELEASE)
   */
  transition: async (id, payload, { throwOnError = true } = {}) => {
    let resData = null;
    try {
      const cleanPayload = payload
        ? {
            ...payload,
            status: payload.status ? normalizeToBackendStatus(payload.status) : payload.status,
          }
        : payload;
      const response = await apiClient.patch(`/api/requests/${id}/transition/`, cleanPayload);
      resData = response.data;
      return resData;
    } catch (apiErr) {
      console.warn('Backend transition notice:', apiErr);
      if (throwOnError) {
        throw apiErr;
      }
    }
    return resData || { id, ...payload };
  },

  /**
   * Restore/reopen an archived, completed, or cancelled request back to active queue.
   */
  restore: async (id, payload = {}, { throwOnError = true } = {}) => {
    let resData = null;
    try {
      const response = await apiClient.post(`/api/requests/${id}/restore/`, payload);
      resData = response.data;
      return resData;
    } catch (apiErr) {
      console.warn('Backend restore notice:', apiErr);
      if (throwOnError) {
        throw apiErr;
      }
    }
    return resData || { id, ...payload };
  },

  /**
   * Reopen request (alias to restore).
   */
  reopen: async (id, payload = {}, { throwOnError = true } = {}) => {
    return requestsApi.restore(id, payload, { throwOnError });
  },

  /**
   * Fetch all credential types.
   */
  getCredentialTypes: async () => {
    return credentialTypesApi.list();
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

  /**
   * Approve a credential request as Registrar or Admin.
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  approve: async (id) => {
    const response = await apiClient.post(`/api/requests/${id}/approve/`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('regquest_requests_updated'));
    }
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
    (Array.isArray(req.payments) && req.payments.some((p) => p?.status === 'VERIFIED' || p?.status === 'PENDING')) ||
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

/**
 * Request History & Archival Management
 * When a document is claimed by the student, staff can remove it from active queue
 * and archive it into the Request History.
 */
export const ARCHIVED_REQUESTS_KEY = 'regquest_archived_requests';

export function getArchivedRequestsMap() {
  try {
    return JSON.parse(localStorage.getItem(ARCHIVED_REQUESTS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function isRequestArchived(req, archivedMap = null) {
  if (!req) return false;
  if (req.is_archived || req.archived_to_history) return true;
  if (normalizeToBackendStatus(req.status) === REQUEST_STATUS.RELEASED) return true;
  const map = archivedMap || getArchivedRequestsMap();
  const keys = [req.id, req.rawId, req.tracking_number, req.trackingId]
    .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
    .map((k) => String(k).trim());
  return keys.some((k) => Boolean(map[k]));
}

export function setRequestArchived(idOrTracking, isArchived = true, user = null, options = {}) {
  try {
    const map = getArchivedRequestsMap();
    const fallback = options?.fallbackItem || {};
    const candidateIds = [
      idOrTracking,
      fallback.id,
      fallback.rawId,
      fallback.tracking_number,
      fallback.trackingId,
    ]
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
      .map((v) => String(v).trim());

    if (isArchived) {
      const info = {
        archived_at: new Date().toISOString(),
        archived_by: user?.full_name || user?.username || 'Staff',
      };
      candidateIds.forEach((k) => {
        map[k] = info;
      });
    } else {
      candidateIds.forEach((k) => {
        delete map[k];
      });
    }

    localStorage.setItem(ARCHIVED_REQUESTS_KEY, JSON.stringify(map));

    // Also update stored request so it persists in the object itself
    updateStoredRequest(idOrTracking, {
      is_archived: isArchived,
      archived_at: isArchived ? new Date().toISOString() : null,
      archived_by: isArchived ? (user?.full_name || user?.username || 'Staff') : null,
    }, options);

    window.dispatchEvent(new Event('regquest_archived_updated'));
    window.dispatchEvent(new Event('regquest_requests_updated'));
    return true;
  } catch (err) {
    console.error('Failed to setRequestArchived:', err);
    return false;
  }
}

export function preserveDocTagInRemarks(requestOrRemarks, newRemarks = '') {
  const rawNew = String(newRemarks || '').trim();
  if (rawNew.startsWith('[')) return rawNew;

  let docTag = '';
  const existingRemarks =
    typeof requestOrRemarks === 'string'
      ? requestOrRemarks
      : String(requestOrRemarks?.remarks || requestOrRemarks?.purpose || '');

  const match = existingRemarks.trim().match(/^(\[[^\]]+\])/);
  if (match && match[1]) {
    const tagLower = match[1].toLowerCase();
    if (!tagLower.includes('staff') && !tagLower.includes('walk-in') && !tagLower.includes('ftf')) {
      docTag = match[1];
    }
  }

  if (!docTag && requestOrRemarks && typeof requestOrRemarks === 'object') {
    const docName = String(requestOrRemarks.document_type || '').trim();
    if (
      docName &&
      !/^(document|document request|walk-in|walkin|ftf)$/i.test(docName)
    ) {
      docTag = `[${docName}]`;
    }
  }

  if (docTag) {
    return rawNew ? `${docTag} ${rawNew}` : docTag;
  }
  return rawNew;
}

const DOC_CODE_RULES = [
  { match: (s) => /transcript|tor/i.test(s), code: '1' },
  { match: (s) => /honorable|dismissal|hd/i.test(s), code: '2' },
  { match: (s) => /evaluation|eval/i.test(s), code: '5' },
  { match: (s) => /authentication|auth/i.test(s), code: '6' },
  { match: (s) => /car/i.test(s), code: '4F' },
  { match: (s) => /gpa/i.test(s), code: '4B' },
  { match: (s) => /officially\s*enrolled|enrolled|coe/i.test(s), code: '4A' },
  { match: (s) => /earned\s*units|earned|units/i.test(s), code: '4D' },
  { match: (s) => /grades|subject/i.test(s), code: '4G' },
  { match: (s) => /cert/i.test(s), code: '4' },
];

export function resolveDocCodes(docNames = []) {
  const list = Array.isArray(docNames) ? docNames : [docNames];
  const codes = [];
  list.forEach((name) => {
    if (!name) return;
    const str = String(name).trim();
    for (const rule of DOC_CODE_RULES) {
      if (rule.match(str)) {
        if (!codes.includes(rule.code)) {
          codes.push(rule.code);
        }
        break;
      }
    }
  });
  return codes.length > 0 ? codes.join('') : '1';
}

export function generateTrackingNumberFallback({
  course = 'IT',
  studentId = '',
  docCode = '1',
  sequence = 1,
} = {}) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}-${mm}-${dd}`;

  const rawId = String(studentId || 'STUDENT').trim();
  const trimmedId = rawId.length > 2 ? rawId.slice(2) : rawId;
  const seqStr = String(sequence || 1).padStart(3, '0');
  const cleanCourse = String(course || 'IT').trim().toUpperCase();

  return `${cleanCourse}-${dateStr}-${trimmedId}-${docCode}-${seqStr}`;
}

