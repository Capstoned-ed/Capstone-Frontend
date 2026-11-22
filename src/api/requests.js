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

  // 2. Direct authoritative ID match (Incognito-safe, works even when localStorage is empty)
  const rawAssignedId = request.assigned_to ?? request.raw?.assigned_to ?? null;
  const currentIds = [currentUser.id, currentUser.userId]
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
    .map((v) => String(v).trim());
  if (rawAssignedId !== null && rawAssignedId !== undefined && String(rawAssignedId).trim() !== '') {
    if (currentIds.includes(String(rawAssignedId).trim())) {
      return true;
    }
  }

  // 3. Check if explicitly claimed by this specific user in local storage
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

  // 1. If structured multi-document items are present, list all document names
  const rawDocItems = Array.isArray(r.document_items) && r.document_items.length > 0
    ? r.document_items
    : Array.isArray(r.doc_details) && r.doc_details.length > 0
      ? r.doc_details
      : null;
  if (rawDocItems && rawDocItems.length > 1) {
    const names = rawDocItems
      .map((it) => String(it?.name || it?.title || it?.document_type || '').trim())
      .filter(Boolean);
    if (names.length > 0) {
      return names.join(', ');
    }
  }

  // 2. If r.document_type is explicitly set to a valid document name, prioritize it directly!
  if (!isInvalidDocName(r.document_type)) {
    return r.document_type;
  }

  // 3. Check if remarks contain an explicit document tag, e.g. "[Evaluation & TOR]" or "[Certification - GPA]"
  // (strip structured [Items:[...]] first so nested JSON brackets never interfere)
  const remarks = String(r.remarks || r.purpose || '')
    .replace(/\[Items:\[[\s\S]*?\]\]/gi, '')
    .trim();
  const bracketMatches = remarks.match(/\[[^\]]+\]/g) || [];
  for (const tag of bracketMatches) {
    const candidate = tag.slice(1, -1).trim();
    const candLower = candidate.toLowerCase();
    if (
      candidate &&
      !isInvalidDocName(candidate) &&
      !candLower.startsWith('copies:') &&
      !candLower.startsWith('total:') &&
      !candLower.startsWith('items:') &&
      !candLower.startsWith('assigned') &&
      !candLower.includes('staff') &&
      !candLower.includes('walk-in') &&
      !candLower.includes('ftf')
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

    // 2. Notification for Staff & Registrar (Operational queue alert; Admin excluded)
    saveStoredNotification({
      event_type: 'REQUEST_CREATED',
      message: `Incoming Request: ${studentName} (${requestItem.student_id || 'Student'}) requested ${docTitle} (${trackingCode}).`,
      related_object_type: 'CredentialRequest',
      related_object_id: trackingCode,
      target_roles: ['staff', 'registrar'],
      target_role: 'staff',
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
const RELEASE_DATES_KEY = 'regquest_release_dates';

export function extractReleaseDateFromRemarks(remarks) {
  if (!remarks) return null;
  const matches = [...String(remarks).matchAll(/Date of release:\s*(\d{4}-\d{2}-\d{2})/gi)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1] || null;
}

export function getReleaseDateOverride(req) {
  if (!req || typeof window === 'undefined') return null;
  try {
    const map = JSON.parse(localStorage.getItem(RELEASE_DATES_KEY) || '{}');
    const keys = [req.rawId, req.id, req.tracking_number, req.trackingId]
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
      .map((v) => String(v).trim());
    for (const k of keys) {
      if (map[k]) return map[k];
    }
  } catch {}
  return null;
}

export function saveReleaseDateOverride(ids, releaseDate) {
  if (!releaseDate || typeof window === 'undefined') return;
  try {
    const map = JSON.parse(localStorage.getItem(RELEASE_DATES_KEY) || '{}');
    const cleanDate = String(releaseDate).trim();
    const list = Array.isArray(ids) ? ids : [ids];
    list
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
      .forEach((v) => {
        map[String(v).trim()] = cleanDate;
      });
    localStorage.setItem(RELEASE_DATES_KEY, JSON.stringify(map));
  } catch {}
}

export function mergeReleaseDateIntoRemarks(requestOrItem, releaseDate, note = '') {
  const baseRemarks = preserveDocTagInRemarks(requestOrItem, note || '');
  if (!releaseDate) return baseRemarks;
  const cleanDate = String(releaseDate).trim();
  const withoutOldRelease = baseRemarks
    .replace(/Date of release:\s*\d{4}-\d{2}-\d{2}\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const releaseTag = `Date of release: ${cleanDate}.`;
  return withoutOldRelease ? `${withoutOldRelease} ${releaseTag}` : releaseTag;
}

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

    const nextReleaseDate = patch?.date_of_release || patch?.release_date;
    if (nextReleaseDate) {
      saveReleaseDateOverride(candidateIds, nextReleaseDate);
    }

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

/**
 * Extract the full structured list of requested document items (supporting multi-document requests).
 * Always returns an array of { credential_type_id, code, name, copies, unit_price, subtotal }.
 */
export function extractDocumentItems(req, credTypes = []) {
  if (!req || typeof req !== 'object') return [];
  const types = Array.isArray(credTypes) ? credTypes : [];

  const findCredMatch = (idOrCodeOrName) => {
    if (!idOrCodeOrName) return null;
    const str = String(idOrCodeOrName).trim().toLowerCase();
    return (
      types.find(
        (t) =>
          String(t.id) === String(idOrCodeOrName) ||
          (t.code && String(t.code).toLowerCase() === str) ||
          (t.name && String(t.name).toLowerCase() === str)
      ) ||
      types.find(
        (t) => t.name && (t.name.toLowerCase().includes(str) || str.includes(t.name.toLowerCase()))
      ) ||
      null
    );
  };

  const normalizeItem = (raw) => {
    const rawName = String(raw?.name || raw?.title || raw?.document_type || '').trim();
    const matched =
      findCredMatch(raw?.credential_type_id ?? raw?.id) ||
      findCredMatch(raw?.code) ||
      findCredMatch(rawName);
    const copies = Math.max(1, parseInt(raw?.copies ?? raw?.quantity ?? 1, 10) || 1);
    const rawPrice = parseFloat(String(raw?.unit_price ?? raw?.unitPrice ?? '').replace(/[^0-9.]/g, ''));
    const dbPrice = matched ? parseFloat(String(matched.price ?? '').replace(/[^0-9.]/g, '')) : NaN;
    const unitPrice = Number.isFinite(rawPrice) && rawPrice > 0
      ? rawPrice
      : Number.isFinite(dbPrice) && dbPrice > 0
        ? dbPrice
        : 0;
    const name = rawName || matched?.name || 'Document Request';
    return {
      credential_type_id: raw?.credential_type_id ?? raw?.id ?? matched?.id ?? null,
      code: raw?.code || matched?.code || '',
      name,
      title: name,
      copies,
      unit_price: unitPrice,
      subtotal: Number((unitPrice * copies).toFixed(2)),
    };
  };

  // 1. Structured document_items / doc_details array directly on the request
  const explicitArrays = [req.document_items, req.doc_details, req.items];
  for (const arr of explicitArrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map(normalizeItem);
    }
  }

  // 2. Structured [Items:[...]] JSON embedded in remarks
  const remarks = String(req.remarks || req.notes || '');
  const itemsMatch = remarks.match(/\[Items:(\[[\s\S]*?\])\]/i);
  if (itemsMatch && itemsMatch[1]) {
    try {
      const parsed = JSON.parse(itemsMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeItem);
      }
    } catch {}
  }

  // 3. Multi-doc breakdown inside [Copies: N | DocA: 2, DocB: 1]
  const multiMatch = remarks.match(/\[Copies:\s*\d+\s*\|\s*([^\]]+)\]/i);
  if (multiMatch && multiMatch[1]) {
    const parsedItems = multiMatch[1]
      .split(',')
      .map((part) => part.trim())
      .map((part) => {
        const m = part.match(/^(.+?):\s*(\d+)$/);
        if (!m) return null;
        return normalizeItem({ name: m[1].trim(), copies: parseInt(m[2], 10) || 1 });
      })
      .filter(Boolean);
    if (parsedItems.length > 0) return parsedItems;
  }

  // 4. Single-document fallback from primary credential_type
  const matchedPrimary =
    findCredMatch(req.credential_type) ||
    findCredMatch(req.credential_code) ||
    findCredMatch(req.credential_name || req.document_type);
  const copies = extractRequestedCopies(req);
  const primaryPrice = matchedPrimary
    ? parseFloat(String(matchedPrimary.price ?? '').replace(/[^0-9.]/g, ''))
    : parseFloat(String(req.credential_type_details?.price ?? req.price ?? '').replace(/[^0-9.]/g, ''));
  const unitPrice = Number.isFinite(primaryPrice) && primaryPrice > 0 ? primaryPrice : 0;
  const name = matchedPrimary?.name || req.credential_name || resolveRequestDocType(req, matchedPrimary);

  return [
    {
      credential_type_id: matchedPrimary?.id ?? req.credential_type ?? null,
      code: matchedPrimary?.code || req.credential_code || '',
      name,
      title: name,
      copies,
      unit_price: unitPrice,
      subtotal: Number((unitPrice * copies).toFixed(2)),
    },
  ];
}

/**
 * Compute exact numeric total_amount across all requested documents × copies.
 */
export function extractTotalAmount(req, credTypes = []) {
  if (!req || typeof req !== 'object') return 0;

  const parseNum = (val) => {
    if (val === undefined || val === null || val === '') return NaN;
    const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };

  // 1. Authoritative backend total_amount / assessed_amount
  const explicitTotal = parseNum(req.total_amount);
  if (Number.isFinite(explicitTotal)) return Number(explicitTotal.toFixed(2));

  // 2. Sum from structured document_items (unit_price * copies)
  const items = extractDocumentItems(req, credTypes);
  const itemsSum = items.reduce((acc, it) => acc + (Number(it.unit_price) || 0) * (Number(it.copies) || 1), 0);
  if (itemsSum > 0) return Number(itemsSum.toFixed(2));

  // 3. Fallback to assessed_amount / amount / price / [Total: X] tag
  const assessed = parseNum(req.assessed_amount) || parseNum(req.amount) || parseNum(req.price);
  if (Number.isFinite(assessed)) return Number(assessed.toFixed(2));

  const remarks = String(req.remarks || '');
  const totalTag = remarks.match(/\[Total:\s*([\d.]+)\]/i);
  if (totalTag && totalTag[1]) {
    const tagged = parseNum(totalTag[1]);
    if (Number.isFinite(tagged)) return Number(tagged.toFixed(2));
  }

  return 0;
}

/**
 * Extract the actual requested copy count (positive integer) from a CredentialRequest object.
 */
export function extractRequestedCopies(req) {
  if (!req || typeof req !== 'object') return 1;

  // 1. Check per-item arrays (document_items / doc_details / items)
  const itemArrays = [req.document_items, req.doc_details, req.items];
  for (const arr of itemArrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      const sum = arr.reduce((acc, it) => {
        const n = parseInt(it?.copies ?? it?.quantity ?? 1, 10);
        return acc + (Number.isFinite(n) && n > 0 ? n : 1);
      }, 0);
      if (sum > 0) return sum;
    }
  }

  // 2. Check explicit numeric fields (total_copies, copies, quantity)
  for (const field of [req.total_copies, req.copies, req.quantity]) {
    if (field !== undefined && field !== null && field !== '') {
      const parsed = typeof field === 'number' ? field : parseInt(String(field).trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  // 3. Fallback: parse [Copies: N] tag from remarks
  const remarks = String(req.remarks || req.notes || '');
  const match = remarks.match(/\[Copies:\s*(\d+)/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 1;
}

/**
 * Pick the most recently uploaded Payment record from a request's payments array.
 */
export function getLatestPaymentRecord(payments) {
  if (!Array.isArray(payments) || payments.length === 0) return null;
  const sorted = [...payments].sort((a, b) => {
    const ta = new Date(a?.uploaded_at || a?.created_at || 0).getTime() || 0;
    const tb = new Date(b?.uploaded_at || b?.created_at || 0).getTime() || 0;
    if (ta !== tb) return ta - tb;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
  return sorted[sorted.length - 1] || null;
}

function normalizeBackendRequest(b) {
  if (!b || typeof b !== 'object') return b;
  const latestBackendPayment = getLatestPaymentRecord(b.payments);
  const resolvedItems = extractDocumentItems(b);
  const resolvedCopies = extractRequestedCopies({ ...b, document_items: resolvedItems });
  const resolvedTotalNum = extractTotalAmount({ ...b, document_items: resolvedItems });
  const formattedTotal = resolvedTotalNum > 0 ? resolvedTotalNum.toFixed(2) : (b.total_amount || b.assessed_amount || '');
  const normalizedPaymentStatus =
    b.payment_status && b.payment_status !== 'NOT_SUBMITTED'
      ? b.payment_status
      : latestBackendPayment?.status === 'PENDING'
      ? 'PAYMENT_SUBMITTED'
      : latestBackendPayment?.status || b.payment_status || null;

  const isPrePayment = [
    'PENDING',
    'SUBMITTED',
    'PENDING_PAYMENT',
    'FOR_PAYMENT',
    'PAYMENT_PENDING',
    'REQUIREMENTS_VERIFICATION',
    'FOR_VERIFICATION',
    'FOR VERIFICATION',
  ].includes(String(b.status || '').toUpperCase());

  const parsedReleaseDate = isPrePayment ? null : extractReleaseDateFromRemarks(b.remarks || b.notes);
  const overrideReleaseDate = isPrePayment ? null : getReleaseDateOverride(b);
  const resolvedReleaseDate =
    isPrePayment ? null : (b.release_date || b.date_of_release || overrideReleaseDate || parsedReleaseDate || null);

  return {
    ...b,
    document_items: resolvedItems,
    doc_details: resolvedItems,
    copies: resolvedCopies,
    total_copies: resolvedCopies,
    total_amount: formattedTotal,
    assessed_amount: formattedTotal || latestBackendPayment?.amount || b.assessed_amount,
    date_of_release: resolvedReleaseDate,
    release_date: resolvedReleaseDate,
    document_type:
      resolvedItems.length > 1
        ? resolvedItems.map((it) => it.name).join(', ')
        : b.document_type || resolveRequestDocType(b),
    payment_status: normalizedPaymentStatus,
    or_number: b.or_number || latestBackendPayment?.receipt_reference_number || '',
    receipt_reference_number:
      b.receipt_reference_number ||
      b.or_number ||
      latestBackendPayment?.receipt_reference_number ||
      '',
    receipt_image: b.receipt_image || latestBackendPayment?.receipt_image || null,
    payment_proof:
      b.payment_proof ||
      (latestBackendPayment
        ? {
            id: latestBackendPayment.id,
            requestId: b.id,
            trackingNumber: b.tracking_number,
            amount: latestBackendPayment.amount,
            receiptReferenceNumber: latestBackendPayment.receipt_reference_number,
            receiptImage: latestBackendPayment.receipt_image,
            status: latestBackendPayment.status,
            remarks: latestBackendPayment.remarks,
            uploadedAt: latestBackendPayment.uploaded_at,
          }
        : null),
  };
}

export const requestsApi = {
  /**
   * Fetch list of all credential requests directly from Django REST API.
   * Completely live and never relies on localStorage caching.
   */
  list: async (params = {}, user = null) => {
    let backendResults = [];
    try {
      const requestParams = { page_size: 1000, ...params };
      const response = await apiClient.get('/api/requests/', { params: requestParams });
      const rawList = Array.isArray(response.data) ? [...response.data] : [...(response.data?.results || [])];

      // Follow DRF pagination if the backend returns paginated pages so older RELEASED requests are never dropped
      let nextUrl = !Array.isArray(response.data) ? response.data?.next : null;
      let pageGuard = 0;
      while (nextUrl && pageGuard < 20) {
        pageGuard += 1;
        try {
          const nextRes = await apiClient.get(nextUrl);
          const nextItems = Array.isArray(nextRes.data) ? nextRes.data : (nextRes.data?.results || []);
          rawList.push(...nextItems);
          nextUrl = !Array.isArray(nextRes.data) ? nextRes.data?.next : null;
        } catch {
          break;
        }
      }

      backendResults = rawList.map(normalizeBackendRequest);
    } catch (err) {
      console.warn('requestsApi.list backend returned error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
    }

    return backendResults
      .filter(isValidRequest)
      .sort(sortRequestsNewestFirst);
  },

  /**
   * Fetch single request details by ID (always normalized with latest payment & copies)
   */
  get: async (id) => {
    const response = await apiClient.get(`/api/requests/${id}/`);
    return normalizeBackendRequest(response.data);
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
      const resolveTransitionStatus = (rawStatus) => {
        if (!rawStatus) return rawStatus;
        const upper = String(rawStatus).trim().toUpperCase();
        if (upper === 'PENDING_REGISTRAR_APPROVAL' || upper === 'PENDING REGISTRAR APPROVAL') {
          return 'PENDING_REGISTRAR_APPROVAL';
        }
        if (upper === 'APPROVED / READY FOR RELEASE' || upper === 'APPROVED') {
          return REQUEST_STATUS.READY_FOR_RELEASE;
        }
        if (upper === 'RELEASED / COMPLETED') {
          return REQUEST_STATUS.RELEASED;
        }
        if (upper === 'RETURNED TO STAFF / FOR PROCESSING') {
          return REQUEST_STATUS.PAYMENT_VERIFIED;
        }
        return normalizeToBackendStatus(rawStatus);
      };
      const cleanPayload = payload
        ? {
            ...payload,
            status: payload.status ? resolveTransitionStatus(payload.status) : payload.status,
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
  isClaimedStatus,
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

  const rawStatus = String(req.rawStatus || req.status || '').trim().toUpperCase();
  const statusNorm = normalizeToBackendStatus(req.status);

  // Terminal statuses that belong strictly in History
  if (
    rawStatus === 'CLAIMED' ||
    rawStatus === 'COMPLETED' ||
    statusNorm === REQUEST_STATUS.REJECTED ||
    statusNorm === REQUEST_STATUS.REQUIREMENTS_REJECTED ||
    statusNorm === REQUEST_STATUS.CANCELLED
  ) {
    return true;
  }

  // Active (non-terminal) statuses must remain in Active Requests (even if RELEASED or READY_FOR_RELEASE)
  if (
    rawStatus === 'RELEASED' ||
    rawStatus === 'READY_FOR_RELEASE' ||
    rawStatus === 'FOR_RELEASE' ||
    rawStatus === 'RELEASING' ||
    statusNorm === REQUEST_STATUS.READY_FOR_RELEASE ||
    statusNorm === REQUEST_STATUS.RELEASED
  ) {
    // Only archived if explicitly flagged in archivedMap
    const map = archivedMap || getArchivedRequestsMap();
    const keys = [req.id, req.rawId, req.tracking_number, req.trackingId]
      .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
      .map((k) => String(k).trim());
    return keys.some((k) => Boolean(map[k]));
  }

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

  const existingRemarks =
    typeof requestOrRemarks === 'string'
      ? requestOrRemarks
      : String(requestOrRemarks?.remarks || requestOrRemarks?.purpose || '');

  // Preserve [Copies: ...], [Total: ...], and [Items:[...]] metadata tags
  const metadataTags = [];
  if (!/\[Copies:\s*\d+/i.test(rawNew)) {
    const copiesMatch = existingRemarks.match(/(\[Copies:[^\]]+\])/i);
    if (copiesMatch && copiesMatch[1]) {
      metadataTags.push(copiesMatch[1]);
    } else if (requestOrRemarks && typeof requestOrRemarks === 'object') {
      const c = extractRequestedCopies(requestOrRemarks);
      if (c > 1) metadataTags.push(`[Copies: ${c}]`);
    }
  }
  if (!/\[Total:\s*[\d.]+/i.test(rawNew)) {
    const totalMatch = existingRemarks.match(/(\[Total:[^\]]+\])/i);
    if (totalMatch && totalMatch[1]) {
      metadataTags.push(totalMatch[1]);
    }
  }
  if (!/\[Items:\[/i.test(rawNew)) {
    const itemsMatch = existingRemarks.match(/(\[Items:\[[\s\S]*?\]\])/i);
    if (itemsMatch && itemsMatch[1]) {
      metadataTags.push(itemsMatch[1]);
    }
  }

  if (rawNew.startsWith('[')) {
    return [rawNew, ...metadataTags].filter(Boolean).join(' ').trim();
  }

  let docTag = '';
  const match = existingRemarks.trim().match(/^(\[[^\]]+\])/);
  if (match && match[1]) {
    const tagLower = match[1].toLowerCase();
    if (
      !tagLower.startsWith('[copies:') &&
      !tagLower.startsWith('[total:') &&
      !tagLower.startsWith('[items:') &&
      !tagLower.includes('staff') &&
      !tagLower.includes('walk-in') &&
      !tagLower.includes('ftf')
    ) {
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

  const parts = [docTag, rawNew, ...metadataTags].filter(Boolean);
  return parts.join(' ').trim();
}

/**
 * Strips all internal metadata tags ([Copies: ...], [Total: ...], [Items: [...]],
 * [Assigned to: ...], [Status: ...]) and trailing/leading delimiter artifacts
 * from remarks or notes strings so user-facing interfaces ONLY display the clean,
 * human-readable message.
 *
 * Example:
 * Input: "Request requirements incomplete or rejected. [Copies: 3 | TOR: 2, HD: 1] [Total:330.00] [Items: [{"credential_type_id":1,...}]]"
 * Output: "Request requirements incomplete or rejected."
 */
export function sanitizeRemarks(rawRemarks) {
  if (!rawRemarks) return '';
  let str = String(rawRemarks);

  // 1. Strip [Items: ... ] using bracket balancing to handle arbitrarily nested JSON arrays/objects
  let itemsIndex = str.search(/\[Items:\s*/i);
  while (itemsIndex !== -1) {
    let depth = 0;
    let endIndex = -1;
    for (let i = itemsIndex; i < str.length; i++) {
      if (str[i] === '[') depth++;
      else if (str[i] === ']') {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }
    if (endIndex !== -1) {
      str = str.slice(0, itemsIndex) + str.slice(endIndex + 1);
    } else {
      const nextBracket = str.indexOf(']', itemsIndex);
      if (nextBracket !== -1) {
        str = str.slice(0, itemsIndex) + str.slice(nextBracket + 1);
      } else {
        str = str.slice(0, itemsIndex);
      }
    }
    itemsIndex = str.search(/\[Items:\s*/i);
  }

  // 2. Strip standard metadata tags: [Copies: ...], [Total: ...], [Assigned to: ...], [Status: ...]
  str = str.replace(/\[Copies:[^\]]*\]/gi, '');
  str = str.replace(/\[Total:[^\]]*\]/gi, '');
  str = str.replace(/\[Assigned(?:\s+to)?:\s*[^\]]*\]/gi, '');
  str = str.replace(/\[Status:[^\]]*\]/gi, '');

  // 3. Strip any generic [Key: Value] metadata brackets
  str = str.replace(/\[[A-Za-z0-9_\s]+:\s*[^\]]*\]/g, '');

  // 4. Clean up loose delimiter artifacts, e.g. " | " or double delimiters
  str = str
    .split('|')
    .map((chunk) => chunk.trim())
    .filter((chunk) => {
      const stripped = chunk.replace(/^\[.*?\]$/, '').trim();
      return stripped.length > 0;
    })
    .join(' | ')
    .trim();

  // 5. Normalize spaces and strip leading/trailing separators
  str = str.replace(/\s+/g, ' ').replace(/^[\s|,-]+|[\s|,-]+$/g, '').trim();
  return str;
}

/**
 * Strips all internal metadata and document tags for a clean purpose string.
 */
export function formatCleanPurpose(text) {
  if (!text) return 'For Personal File / Employment';
  const withoutStaffNote = String(text).replace(/\|\s*Note:[\s\S]*$/i, '').trim();
  const sanitized = sanitizeRemarks(withoutStaffNote);
  const cleaned = sanitized
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\[.*?\]/g, '')
    .replace(/Clearance verified by[^.]*\./gi, '')
    .replace(/Assessed amount:[^.]*\./gi, '')
    .replace(/Date of release:[^.]*\./gi, '')
    .replace(/(?:Official receipt|Payment order|Payment)[^.]*(?:verified|confirmed|rejected)[^.]*\./gi, '')
    .replace(/Document claimed by student[^.]*\./gi, '')
    .replace(/\|+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'For Personal File / Employment';
}

/**
 * Merges a staff processing note into remarks using `| Note: ...` without
 * overwriting the student's original purpose or internal metadata tags.
 */
export function mergeStaffNoteIntoRemarks(requestOrRemarks, staffNote = '') {
  const existingRemarks =
    typeof requestOrRemarks === 'string'
      ? requestOrRemarks
      : String(requestOrRemarks?.remarks || requestOrRemarks?.purpose || '');

  const cleanBase = sanitizeRemarks(
    existingRemarks.replace(/\|\s*Note:[\s\S]*$/i, '')
  )
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();

  const trimmedNote = String(staffNote || '').trim();
  const combined = trimmedNote
    ? cleanBase
      ? `${cleanBase} | Note: ${trimmedNote}`
      : `| Note: ${trimmedNote}`
    : cleanBase;

  return preserveDocTagInRemarks(requestOrRemarks, combined);
}

/**
 * Extracts human-readable staff/registrar remark from a request object,
 * strictly ignoring the student's initial purpose and document type tags.
 */
export function extractStaffRemark(req) {
  if (!req || typeof req !== 'object') return '';

  const directNote = String(req.staff_notes || req.notes || '').trim();
  if (directNote) {
    const cleanedDirect = sanitizeRemarks(directNote);
    if (cleanedDirect && cleanedDirect !== formatCleanPurpose(req.purpose || '')) {
      return cleanedDirect;
    }
  }

  const rawRemarks = String(req.remarks || '').trim();
  if (!rawRemarks) return '';

  const noteMatch = rawRemarks.match(/\|\s*Note:\s*(.+)$/i);
  if (noteMatch && noteMatch[1]) {
    const cleaned = sanitizeRemarks(noteMatch[1]);
    if (cleaned) return cleaned;
  }

  return '';
}

const DOC_CODE_RULES = [
  { match: (s) => /transcript|tor/i.test(s), code: '1', dbCode: 'TOR' },
  { match: (s) => /honorable|dismissal|\bhd\b/i.test(s), code: '2', dbCode: 'HD' },
  { match: (s) => /evaluation|\beval\b/i.test(s), code: '5', dbCode: 'EVAL' },
  { match: (s) => /authentication|\bauth\b/i.test(s), code: '10', dbCode: 'AUTH' },
  { match: (s) => /\bcar\b/i.test(s), code: '4f', dbCode: 'CAR' },
  { match: (s) => /\bgpa\b/i.test(s), code: '4b', dbCode: 'GPA' },
  { match: (s) => /officially\s*enrolled|enrolled|\bcoe\b/i.test(s), code: '4a', dbCode: 'COE' },
  { match: (s) => /earned\s*units|earned|\bunits\b/i.test(s), code: '4d', dbCode: 'UNITS' },
  { match: (s) => /endorsement|\bendorse\b/i.test(s), code: '4m', dbCode: 'ENDORSE' },
  { match: (s) => /grades|subject/i.test(s), code: '4g', dbCode: 'GRADES' },
  { match: (s) => /cert/i.test(s), code: '4', dbCode: 'CERT' },
];

export function resolveDocCodes(docNames = [], credentialTypes = []) {
  const list = Array.isArray(docNames) ? docNames : [docNames];
  const liveTypes = Array.isArray(credentialTypes) ? credentialTypes : [];
  const codes = [];

  list.forEach((name) => {
    if (!name) return;
    const str = String(name).trim();
    const lower = str.toLowerCase();

    // 1. Prioritize exact or code match against live DB CredentialType records
    let liveMatch = liveTypes.find(
      (t) =>
        (t.name && t.name.toLowerCase() === lower) ||
        (t.code && t.code.toLowerCase() === lower)
    );

    if (!liveMatch && liveTypes.length > 0) {
      for (const rule of DOC_CODE_RULES) {
        if (rule.match(str)) {
          liveMatch = liveTypes.find(
            (t) =>
              (t.code && t.code.toUpperCase() === rule.dbCode) ||
              (t.name && rule.match(t.name))
          );
          if (liveMatch) break;
        }
      }
    }

    if (liveMatch) {
      const liveCode = String(liveMatch.doc_code || liveMatch.code || '').trim();
      if (liveCode && !codes.includes(liveCode)) {
        codes.push(liveCode);
      }
      return;
    }

    // 2. Offline fallback rules only if live DB catalog was unavailable
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

