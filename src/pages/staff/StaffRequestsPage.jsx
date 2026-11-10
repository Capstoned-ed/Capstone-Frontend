import React, { useState, useEffect, useMemo } from 'react';
import requestsApi, {
  updateStoredRequest,
  isValidRequest,
  logProcessedAction,
  getRequestTimestamp,
  getRequestActivityTimestamps,
  recordRequestActivityTimestamp,
  sortRequestsNewestFirst,
  resolveRequestDocType,
  getStaffAssignments,
  isRequestAssignedToUser,
  getStaffAssignmentTimestamps,
  recordStaffAssignmentTimestamp,
  getArchivedRequestsMap,
  setRequestArchived,
  isRequestArchived,
  ASSIGNMENTS_KEY,
  ASSIGNMENT_TIMESTAMPS_KEY,
} from '../../api/requests';
import { useAuth } from '../../hooks/useAuth';
import usersApi from '../../api/users';
import clearancesApi, { getClearanceAttachment } from '../../api/clearances';
import useToast from '../../hooks/useToast';
import ProcessRequestModal from '../../components/admin/ProcessRequestModal';
import BatchUpdateModal from '../../components/common/BatchUpdateModal';
import { StaffRequestsTable, StaffSearchFilter } from '../../components/staff';
import '../../styles/staff/StaffRequestsPage.css';

const REQUEST_STATUSES = [
  'Pending',
  'Pending Payment',
  'For Processing',
  'Processing',
  'Releasing',
  'Claimed',
  'On Hold',
];

const BACKEND_STATUS_MAP = {
  'Pending': 'PENDING',
  'Pending Payment': 'PAYMENT_PENDING',
  'For Payment': 'PAYMENT_PENDING',
  'Payment Pending': 'PAYMENT_PENDING',
  'For Processing': 'PAYMENT_VERIFIED',
  'Processing': 'PROCESSING',
  'Releasing': 'READY_FOR_RELEASE',
  'For release': 'READY_FOR_RELEASE',
  'Claimed': 'RELEASED',
  'On Hold': 'REQUIREMENTS_VERIFICATION',
};

function calculateReleaseDate(createdAt, processingDays = 5) {
  if (!createdAt) return 'N/A';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return 'N/A';
  d.setDate(d.getDate() + (Number(processingDays) || 5));
  return d.toISOString().split('T')[0];
}

function formatStatusDisplay(rawStatus) {
  if (!rawStatus) return 'Pending';
  const s = rawStatus.trim();
  if (s === 'For Payment' || s === 'FOR PAYMENT' || s === 'FOR_PAYMENT') return 'Pending Payment';
  if (REQUEST_STATUSES.includes(s)) return s;

  const upper = s.toUpperCase();
  switch (upper) {
    case 'PENDING':
    case 'PENDONG':
    case 'RECEIVED':
    case 'REQUEST SUBMITTED':
      return 'Pending';
    case 'FOR_PAYMENT':
    case 'FOR PAYMENT':
    case 'PAYMENT_PENDING':
    case 'PAYMENT PENDING':
    case 'PENDING_PAYMENT':
    case 'PENDING PAYMENT':
    case 'CLEARED FOR PAYMENT':
      return 'Pending Payment';
    case 'PAYMENT_VERIFIED':
    case 'PAYMENT VERIFIED':
    case 'FOR_PROCESSING':
    case 'FOR PROCESSING':
      return 'For Processing';
    case 'PROCESSING':
    case 'DOCUMENT_PREPARATION':
    case 'DOCUMENT PREPARATION':
      return 'Processing';
    case 'READY_FOR_RELEASE':
    case 'READY FOR RELEASE':
    case 'READY_FOR_PICKUP':
    case 'READY FOR PICKUP':
    case 'FOR_RELEASE':
    case 'FOR RELEASE':
    case 'RELEASING':
      return 'Releasing';
    case 'RELEASED':
    case 'CLAIMED':
    case 'CLAIMED / RELEASED':
    case 'CLAIMED/RELEASED':
      return 'Claimed';
    case 'ON HOLD':
    case 'ON_HOLD':
    case 'HOLD':
    case 'REQUIREMENTS_VERIFICATION':
    case 'CLEARANCE_VERIFIED':
    case 'CANCELLED':
    case 'REJECTED':
      return 'On Hold';
    default:
      return s;
  }
}

function getStatusBadge(status) {
  const norm = String(status || '').trim();
  switch (norm) {
    case 'Pending':
    case 'PENDING':
      return <span className="status-badge pending">Pending</span>;
    case 'For Payment':
    case 'FOR PAYMENT':
    case 'FOR_PAYMENT':
    case 'Pending Payment':
    case 'PAYMENT_PENDING':
    case 'Payment Pending':
      return <span className="status-badge payment-pending">Pending Payment</span>;
    case 'For Processing':
    case 'FOR_PROCESSING':
    case 'PAYMENT_VERIFIED':
      return <span className="status-badge for-processing">For Processing</span>;
    case 'Processing':
    case 'PROCESSING':
      return <span className="status-badge processing">Processing</span>;
    case 'Releasing':
    case 'RELEASING':
    case 'For release':
    case 'READY_FOR_RELEASE':
      return <span className="status-badge releasing">Releasing</span>;
    case 'Claimed':
    case 'RELEASED':
      return <span className="status-badge claimed">Claimed</span>;
    default:
      return <span className="status-badge on-hold">{norm || 'On Hold'}</span>;
  }
}

export default function StaffRequestsPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [rawRequests, setRawRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [credentialTypes, setCredentialTypes] = useState([]);
  const [clearances, setClearances] = useState([]);
  const [assignments, setAssignments] = useState(getStaffAssignments);
  const [assignmentTimestamps, setAssignmentTimestamps] = useState(getStaffAssignmentTimestamps);
  const [activityTimestamps, setActivityTimestamps] = useState(getRequestActivityTimestamps);
  const [archivedMap, setArchivedMap] = useState(getArchivedRequestsMap);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newStatus, setNewStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  const handleToggleSelect = (rawOrId) => {
    const key = String(rawOrId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (items) => {
    if (!items || items.length === 0) return;
    const allSelected = items.every((i) =>
      selectedIds.has(String(i.id)) ||
      selectedIds.has(String(i.rawId)) ||
      (i.tracking_number && selectedIds.has(String(i.tracking_number)))
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      items.forEach((i) => {
        const key = String(i.rawId || i.id);
        const idKey = String(i.id);
        const trackKey = i.tracking_number ? String(i.tracking_number) : null;
        if (allSelected) {
          next.delete(key);
          next.delete(idKey);
          if (trackKey) next.delete(trackKey);
        } else {
          next.add(key);
        }
      });
      return next;
    });
  };

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [requestsRes, credTypesRes, clearancesRes] = await Promise.all([
          requestsApi.list().catch((err) => {
            console.error('Failed requestsApi.list:', err);
            return [];
          }),
          requestsApi.getCredentialTypes().catch((err) => {
            console.error('Failed getCredentialTypes:', err);
            return [];
          }),
          clearancesApi.list().catch((err) => {
            console.error('Failed clearancesApi.list:', err);
            return [];
          }),
        ]);

        let usersRes = [];
        try {
          usersRes = await usersApi.list();
          if (Array.isArray(usersRes) && usersRes.length > 0) {
            localStorage.setItem('regquest_users_cache', JSON.stringify(usersRes));
          }
        } catch {
          try {
            usersRes = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
          } catch {
            usersRes = [];
          }
        }

        if (!ignore) {
          setRawRequests(Array.isArray(requestsRes) ? requestsRes : []);
          setUsers(Array.isArray(usersRes) ? usersRes : []);
          setCredentialTypes(Array.isArray(credTypesRes) ? credTypesRes : []);
          setClearances(Array.isArray(clearancesRes) ? clearancesRes : []);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load staff requests data:', err);
          setError('Unable to load document requests from server.');
          setLoading(false);
        }
      }
    }
    loadData();

    const handleSync = () => {
      loadData();
    };
    const handleAssignmentsSync = () => {
      setAssignments(getStaffAssignments());
      setAssignmentTimestamps(getStaffAssignmentTimestamps());
    };
    const handleActivitySync = () => {
      setActivityTimestamps(getRequestActivityTimestamps());
    };
    const handleArchivedSync = () => {
      setArchivedMap(getArchivedRequestsMap());
    };

    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_assignments_updated', handleAssignmentsSync);
    window.addEventListener('regquest_activity_updated', handleActivitySync);
    window.addEventListener('regquest_archived_updated', handleArchivedSync);
    window.addEventListener('storage', handleAssignmentsSync);
    window.addEventListener('storage', handleActivitySync);
    window.addEventListener('storage', handleArchivedSync);

    return () => {
      ignore = true;
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_assignments_updated', handleAssignmentsSync);
      window.removeEventListener('regquest_activity_updated', handleActivitySync);
      window.removeEventListener('regquest_archived_updated', handleArchivedSync);
      window.removeEventListener('storage', handleAssignmentsSync);
      window.removeEventListener('storage', handleActivitySync);
      window.removeEventListener('storage', handleArchivedSync);
    };
  }, []);

  const userMap = useMemo(() => {
    const map = new Map();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const credTypeMap = useMemo(() => {
    const map = new Map();
    credentialTypes.forEach((c) => map.set(c.id, c));
    return map;
  }, [credentialTypes]);

  const clearanceMap = useMemo(() => {
    const map = new Map();
    clearances.forEach((c) => {
      const uId = typeof c.user === 'object' ? c.user?.id : c.user;
      if (uId) {
        map.set(uId, c);
        map.set(String(uId), c);
      }
      if (c.student_id) map.set(c.student_id, c);
      if (c.username) map.set(c.username, c);
      if (c.user_details?.username) map.set(c.user_details.username, c);
      if (c.user_details?.student_id) map.set(c.user_details.student_id, c);
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [clearances]);

  const requests = useMemo(() => {
    let built = rawRequests
      .filter(isValidRequest)
      .filter((r) => Boolean(String(r.tracking_number || '').trim()))
      .map((r, idx) => {
      const user = userMap.get(r.user);
      const cred = credTypeMap.get(r.credential_type);

      let cachedClearancePreview = null;
      let cachedClearanceFileName = null;
      let cachedClearanceIsPdf = false;
      let matchedStored = null;
      try {
        const storedList = JSON.parse(localStorage.getItem('regquest_stored_requests') || '[]');
        matchedStored = storedList.find(
          (s) =>
            String(s.id) === String(r.id) ||
            String(s.id) === String(r.rawId) ||
            String(s.id) === String(r.tracking_number) ||
            String(s.tracking_number) === String(r.tracking_number) ||
            String(s.tracking_number) === String(r.id) ||
            String(s.rawId) === String(r.id) ||
            String(s.rawId) === String(r.rawId)
        );
        if (matchedStored?.clearance_preview) {
          cachedClearancePreview = matchedStored.clearance_preview;
          cachedClearanceFileName = matchedStored.clearance_file_name;
          cachedClearanceIsPdf = matchedStored.clearance_is_pdf;
        }
      } catch {}

      const localClearance = getClearanceAttachment([
        r.tracking_number,
        r.id,
        r.rawId,
        r.student_id,
        r.user,
        String(r.user),
      ]);

      const userClearance =
        clearanceMap.get(r.user) ||
        clearanceMap.get(String(r.user)) ||
        clearanceMap.get(r.student_id) ||
        (user ? clearanceMap.get(user.id) : null) ||
        (user ? clearanceMap.get(String(user.id)) : null) ||
        (user ? clearanceMap.get(user.student_id) : null) ||
        (user ? clearanceMap.get(user.username) : null);

      const effectiveClearancePreview =
        r.clearance_preview ||
        localClearance?.dataUrl ||
        cachedClearancePreview ||
        userClearance?.file ||
        null;

      const effectiveClearanceIsPdf =
        Boolean(r.clearance_is_pdf) ||
        Boolean(localClearance?.meta?.isPdf) ||
        Boolean(localClearance?.dataUrl?.startsWith('data:application/pdf')) ||
        Boolean(cachedClearanceIsPdf) ||
        Boolean(r.clearance_file_name?.toLowerCase().endsWith('.pdf'));

      const effectiveClearanceFileName =
        r.clearance_file_name ||
        localClearance?.meta?.fileName ||
        cachedClearanceFileName ||
        (userClearance?.file ? 'Clearance Document' : null);

      let profileName = null;
      let profileStudentId = null;
      try {
        const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
        const p =
          profiles[r.user] ||
          profiles[r.student_id] ||
          (user ? profiles[user.id] : null) ||
          (user ? profiles[user.username] : null);
        if (p) {
          profileName = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ');
          profileStudentId = p.student_id || p.username;
        }
      } catch {}

      const userFullName = user
        ? [user.first_name, user.last_name].filter(Boolean).join(' ')
        : '';

      const fallbackKnownName =
        (user?.username === '2023301564' || r.student_id === '2023301564' || r.student_name === '2023301564' || r.user === 11 || String(r.user) === '11')
          ? 'Daisy Traya'
          : (user?.username === 'Love' || r.student_name === 'Love' || r.user === 2 || String(r.user) === '2')
          ? 'Love'
          : null;

      const isStudentNameId =
        !r.student_name ||
        r.student_name === 'Student' ||
        /^\d{6,}$/.test(r.student_name) ||
        r.student_name === r.student_id ||
        (user && r.student_name === user.username);

      const studentName = !isStudentNameId
        ? r.student_name
        : (userFullName || profileName || fallbackKnownName || (user?.username && !/^\d{6,}$/.test(user.username) ? user.username : null) || r.student_name || (r.student_id ? `Student (${r.student_id})` : 'Student'));

      const studentId =
        (r.student_id && /^\d+$/.test(r.student_id))
          ? r.student_id
          : profileStudentId || user?.student_id || user?.username || (r.user === 11 || String(r.user) === '11' ? '2023301564' : null) || (r.user === 2 || String(r.user) === '2' ? '20231029' : null) || (r.user ? String(r.user) : 'N/A');

      const documentType = resolveRequestDocType(r, cred);

      const amount =
        matchedStored?.assessed_amount ||
        matchedStored?.amount ||
        r.assessed_amount ||
        r.amount ||
        (cred?.price ? `P${parseFloat(cred.price).toFixed(0)}` : 'P0');

      const requestDate = r.request_date || (r.created_at ? r.created_at.split('T')[0] : 'N/A');
      const releaseDate =
        matchedStored?.date_of_release ||
        matchedStored?.release_date ||
        r.date_of_release ||
        r.release_date ||
        calculateReleaseDate(r.created_at, cred?.processing_days);

      let claimedMap = {};
      try {
        claimedMap = JSON.parse(localStorage.getItem('regquest_claimed_requests') || '{}');
      } catch {}

      const myIdKeys = [
        user?.username,
        user?.full_name,
        user?.id,
        user?.userId,
        [user?.first_name, user?.last_name].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase());

      const rKeys = [
        r.id !== undefined && r.id !== null ? String(r.id) : null,
        r.rawId !== undefined && r.rawId !== null ? String(r.rawId) : null,
        r.tracking_number !== undefined && r.tracking_number !== null ? String(r.tracking_number) : null,
      ].filter(Boolean);

      const isClaimedByMe = rKeys.some((k) => {
        const claimVal = claimedMap[k];
        if (claimVal) {
          const cStr = String(claimVal).trim().toLowerCase();
          if (cStr === 'true' || cStr === '1' || cStr === 'claimed' || myIdKeys.includes(cStr)) {
            return true;
          }
        }
        const assignVal = assignments[k];
        if (assignVal) {
          const aStr = String(assignVal).trim().toLowerCase();
          if (
            myIdKeys.includes(aStr) ||
            (aStr && myIdKeys.some((m) => m && m.length >= 4 && (aStr.includes(m) || m.includes(aStr))))
          ) {
            return true;
          }
        }
        return false;
      });

      // When Registrar assigns staff, registrar verified all -> 'For Processing'
      // When Staff claims/assigns to self, staff must verify all -> 'Pending'
      const assignedByRegistrarStatus =
        assignments[`status_${r.id}`] ||
        assignments[`status_${String(r.id)}`] ||
        assignments[`status_${r.rawId}`] ||
        assignments[`status_${String(r.rawId)}`] ||
        assignments[`status_${r.tracking_number}`] ||
        assignments[`status_${String(r.tracking_number)}`];

      const effectiveRawStatus =
        assignedByRegistrarStatus ||
        (matchedStored?.status && String(matchedStored.status).toUpperCase() !== 'PENDING'
          ? matchedStored.status
          : r.status || 'Pending');

      return {
        rawId: r.rawId || r.id,
        id: r.tracking_number || r.id,
        tracking_number: r.tracking_number || r.id,
        user: r.user,
        student_name: studentName,
        student_id: studentId,
        document_type: documentType,
        copies: r.copies || '1 copy',
        status: formatStatusDisplay(effectiveRawStatus),
        created_at: r.created_at,
        request_date: requestDate,
        release_date: releaseDate,
        date_of_release: releaseDate,
        amount,
        assessed_amount: matchedStored?.assessed_amount || r.assessed_amount || amount,
        verified_by_name: matchedStored?.verified_by_name || r.verified_by_name || null,
        purpose: r.purpose || r.remarks || 'Official Academic Credential Request',
        remarks: matchedStored?.remarks || r.remarks || '',
        clearance_preview: effectiveClearancePreview,
        clearance_id: r.clearance_id || userClearance?.id || null,
        clearance_status:
          matchedStored?.clearance_status ||
          r.clearance_status ||
          (effectiveClearancePreview ? 'PENDING' : null),
        clearance_file_name: effectiveClearanceFileName,
        clearance_is_pdf: effectiveClearanceIsPdf,
        photo_preview: r.photo_preview || null,
        payment_status: matchedStored?.payment_status || r.payment_status || null,
        payment_proof: matchedStored?.payment_proof || r.payment_proof || null,
        or_number: matchedStored?.or_number || r.or_number || '',
        receipt_image: matchedStored?.receipt_image || r.receipt_image || null,
        is_confirmed: Boolean(matchedStored?.is_confirmed || r.is_confirmed),
        confirmed_for_payment: Boolean(matchedStored?.confirmed_for_payment || r.confirmed_for_payment),
        assigned_staff:
          assignments[r.id] ||
          assignments[String(r.id)] ||
          assignments[r.tracking_number] ||
          assignments[String(r.tracking_number)] ||
          assignments[r.rawId] ||
          assignments[String(r.rawId)] ||
          (isClaimedByMe ? (user?.full_name || user?.username || '') : '') ||
          matchedStored?.assigned_staff ||
          r.assigned_staff ||
          '',
        assigned_at:
          assignmentTimestamps[String(r.id)] ||
          assignmentTimestamps[String(r.tracking_number)] ||
          assignmentTimestamps[String(r.rawId)] ||
          (typeof window !== 'undefined' && getStaffAssignmentTimestamps()[String(r.id)]) ||
          (typeof window !== 'undefined' && getStaffAssignmentTimestamps()[String(r.tracking_number)]) ||
          (typeof window !== 'undefined' && getStaffAssignmentTimestamps()[String(r.rawId)]) ||
          (r.assigned_at ? new Date(r.assigned_at).getTime() : 0) ||
          (matchedStored?.assigned_at ? new Date(matchedStored.assigned_at).getTime() : 0) ||
          (r.accepted_at ? new Date(r.accepted_at).getTime() : 0) ||
          (matchedStored?.accepted_at ? new Date(matchedStored.accepted_at).getTime() : 0) ||
          0,
        updated_at:
          matchedStored?.updated_at ||
          matchedStored?.updatedAt ||
          r.updated_at ||
          r.updatedAt ||
          null,
      };
    })
    .filter((r) => {
      const sName = String(r.student_name || '').toLowerCase();
      const sId = String(r.student_id || '').toLowerCase();
      if (/^student\s*#?\s*[1-4]$/i.test(sName) || /^student\s*#?\s*[1-4]$/i.test(sId)) {
        return false;
      }
      if (r.id || r.tracking_number) {
        return true;
      }
      if (
        (r.student_name === 'Student' || r.student_name === 'N/A' || !r.student_name) &&
        (r.student_id === 'N/A' || !r.student_id)
      ) {
        return false;
      }
      if (r.request_date === 'N/A' && r.release_date === 'N/A') {
        return false;
      }
      return true;
    });

    return built.sort(sortRequestsNewestFirst);
  }, [rawRequests, userMap, credTypeMap, clearanceMap, assignments, assignmentTimestamps]);

  const allFilteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.student_name.toLowerCase().includes(q) ||
        r.student_id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (docTypeFilter) {
        const filterLow = docTypeFilter.toLowerCase();
        const docLow = (r.document_type || '').toLowerCase();
        if (!docLow.includes(filterLow) && !filterLow.includes(docLow)) {
          return false;
        }
      }

      if (statusFilter && r.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      return true;
    }).sort(sortRequestsNewestFirst);
  }, [requests, searchQuery, docTypeFilter, statusFilter]);

  // Active requests (not yet moved to History)
  const activeFilteredRequests = useMemo(() => {
    return allFilteredRequests.filter((r) => !isRequestArchived(r, archivedMap));
  }, [allFilteredRequests, archivedMap]);

  // Request History (documents claimed by students and archived)
  const historyRequests = useMemo(() => {
    return allFilteredRequests
      .filter((r) => isRequestArchived(r, archivedMap))
      .sort((a, b) => {
        const timeA = archivedMap[a.id]?.archived_at || archivedMap[a.rawId]?.archived_at || a.created_at || 0;
        const timeB = archivedMap[b.id]?.archived_at || archivedMap[b.rawId]?.archived_at || b.created_at || 0;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });
  }, [allFilteredRequests, archivedMap]);

  // Card 1: Requests assigned to this staff member (from Active queue)
  // Sorted by: MOST RECENTLY UPDATED / ACCEPTED / ASSIGNED AT THE VERY TOP!
  const assignedRequests = useMemo(() => {
    return activeFilteredRequests
      .filter((r) => isRequestAssignedToUser(r, user, assignments, users))
      .sort(sortRequestsNewestFirst);
  }, [activeFilteredRequests, user, assignments, users, activityTimestamps]);

  // Card 2: All unassigned requests (from Active queue)
  const unassignedRequests = useMemo(() => {
    return activeFilteredRequests
      .filter((r) => {
        const isAssigned = isRequestAssignedToUser(r, user, assignments, users);
        const hasStaff = Boolean(r.assigned_staff && r.assigned_staff.trim() !== '' && r.assigned_staff.toLowerCase() !== 'unassigned');
        return !isAssigned && !hasStaff;
      })
      .sort(sortRequestsNewestFirst);
  }, [activeFilteredRequests, user, assignments, users, activityTimestamps]);

  // Handlers for Archiving (Move to History) and Restoring
  const handleArchiveRequest = (item) => {
    if (!item) return;
    const reqId = item.id || item.rawId || item.tracking_number;
    setRequestArchived(reqId, true, user, { fallbackItem: item });
    setArchivedMap(getArchivedRequestsMap());

    logProcessedAction({
      actor: user?.username,
      actorName: user?.full_name || user?.username,
      actorId: user?.id,
      actorRole: user?.role || 'staff',
      targetName: item.student_name,
      targetId: item.student_id || reqId,
      trackingNumber: item.tracking_number || reqId,
      documentType: item.document_type,
      action: 'Document claimed by student: Moved to History',
      status: 'Claimed',
    });

    toast.success(`Request ${item.id || reqId} marked as Done and moved to Request History.`);
  };

  const handleRestoreRequest = (item) => {
    if (!item) return;
    const reqId = item.id || item.rawId || item.tracking_number;
    setRequestArchived(reqId, false, user, { fallbackItem: item });
    setArchivedMap(getArchivedRequestsMap());

    logProcessedAction({
      actor: user?.username,
      actorName: user?.full_name || user?.username,
      actorId: user?.id,
      actorRole: user?.role || 'staff',
      targetName: item.student_name,
      targetId: item.student_id || reqId,
      trackingNumber: item.tracking_number || reqId,
      documentType: item.document_type,
      action: 'Restored request from History to Active Queue',
      status: item.status || 'Pending',
    });

    toast.success(`Request ${item.id} restored to Active Queue.`);
  };

  const selectedRequestsList = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return requests.filter((r) =>
      selectedIds.has(String(r.id)) ||
      selectedIds.has(String(r.rawId)) ||
      (r.tracking_number && selectedIds.has(String(r.tracking_number)))
    );
  }, [requests, selectedIds]);

  const handleBatchUpdate = async ({ newStatus: statusToSet, releasingDate, note }) => {
    if (selectedRequestsList.length === 0) return;

    const nowTime = Date.now();
    const nowIso = new Date(nowTime).toISOString();

    for (const item of selectedRequestsList) {
      const targetId = item.rawId || item.id;
      const trackingNo = item.tracking_number || item.id;

      const patch = {
        updated_at: nowIso,
      };

      if (statusToSet) {
        patch.status = statusToSet;
      }

      if (releasingDate) {
        patch.date_of_release = releasingDate;
        patch.release_date = releasingDate;
      }

      if (note && note.trim()) {
        const existingRemarks = item.remarks || '';
        patch.remarks = existingRemarks
          ? `${existingRemarks} | Note: ${note.trim()}`
          : note.trim();
        patch.notes = patch.remarks;
      }

      // Update in localStorage
      updateStoredRequest(trackingNo || item.id || targetId, patch, {
        fallbackItem: { ...item, ...patch },
      });

      // Record activity
      recordRequestActivityTimestamp(trackingNo || item.id || targetId, nowTime);

      // Log processed action
      logProcessedAction({
        actor: user?.username || 'staff',
        actorName: user?.full_name || user?.username || 'Staff',
        actorId: user?.id,
        actorRole: user?.role || 'staff',
        targetName: item.student_name,
        targetId: item.student_id || trackingNo,
        trackingNumber: trackingNo,
        documentType: item.document_type,
        action: `Batch updated: ${statusToSet ? `Status -> ${statusToSet}; ` : ''}${releasingDate ? `Release Date -> ${releasingDate}; ` : ''}${note ? `Note -> ${note}` : ''}`.trim(),
        status: statusToSet || item.status,
      });

      // Backend API transition if applicable and numeric
      if (statusToSet && targetId && !isNaN(Number(targetId))) {
        requestsApi.transition(Number(targetId), {
          status: statusToSet,
          remarks: note || `Batch updated by staff`,
        }).catch(() => {});
      }
    }

    // Update in-memory state
    setRawRequests((prev) =>
      prev.map((r) => {
        const isMatch =
          selectedIds.has(String(r.id)) ||
          selectedIds.has(String(r.rawId)) ||
          (r.tracking_number && selectedIds.has(String(r.tracking_number)));
        if (!isMatch) return r;

        const updated = {
          ...r,
          updated_at: nowIso,
        };
        if (statusToSet) updated.status = statusToSet;
        if (releasingDate) {
          updated.release_date = releasingDate;
          updated.date_of_release = releasingDate;
        }
        if (note && note.trim()) {
          updated.remarks = r.remarks ? `${r.remarks} | Note: ${note.trim()}` : note.trim();
          updated.notes = updated.remarks;
        }
        return updated;
      })
    );

    setActivityTimestamps(getRequestActivityTimestamps());
    window.dispatchEvent(new Event('regquest_requests_updated'));
    toast.success(`Successfully updated ${selectedRequestsList.length} requests!`);
    setSelectedIds(new Set());
    setBatchModalOpen(false);
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').trim();
    switch (s) {
      case 'Pending':
      case 'PENDING':
      case 'Pendong':
        return <span className="status-pill pending">Pending</span>;
      case 'For Payment':
      case 'FOR PAYMENT':
      case 'FOR_PAYMENT':
      case 'Pending Payment':
      case 'PAYMENT_PENDING':
      case 'Payment Pending':
        return <span className="status-pill for-payment">Pending Payment</span>;
      case 'For Processing':
      case 'FOR_PROCESSING':
      case 'PAYMENT_VERIFIED':
        return <span className="status-pill for-processing">For Processing</span>;
      case 'Processing':
      case 'PROCESSING':
        return <span className="status-pill processing">Processing</span>;
      case 'For release':
      case 'For Release':
      case 'Releasing':
      case 'RELEASING':
      case 'READY_FOR_RELEASE':
        return <span className="status-pill for-release">For release</span>;
      case 'Claimed':
      case 'RELEASED':
        return <span className="status-pill claimed">Claimed</span>;
      case 'On Hold':
      case 'on Hold':
      case 'ON_HOLD':
        return <span className="status-pill on-hold">On Hold</span>;
      default:
        return <span className="status-pill pending">{s}</span>;
    }
  };

  const handleOpenProcess = (req) => {
    setSelectedRequest(req);
    setNewStatus(formatStatusDisplay(req.status) || 'Pending');
    setNotes('');
  };

  const handleClaimAndProcess = (item, options = {}) => {
    if (!item) return;

    const reqId = item.id;
    const rawId = item.rawId || item.id;
    const trackingNo = item.tracking_number || item.id;
    const displayId = trackingNo || reqId || rawId || 'Request';

    // 1. Fire toast immediately if not already fired by caller
    if (!options?.skipToast) {
      toast.success(`Now processing Request ${displayId}! Successfully assigned to you and ready for processing.`);
    }

    try {
      const staffName =
        user?.full_name ||
        [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
        user?.username ||
        'Staff';

      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      // 2. Record in claimed map for robust assignment tracking
      const claimedMap = JSON.parse(localStorage.getItem('regquest_claimed_requests') || '{}');
      if (rawId) claimedMap[String(rawId)] = user?.username || user?.full_name || 'claimed';
      if (reqId) claimedMap[String(reqId)] = user?.username || user?.full_name || 'claimed';
      if (trackingNo) claimedMap[String(trackingNo)] = user?.username || user?.full_name || 'claimed';
      localStorage.setItem('regquest_claimed_requests', JSON.stringify(claimedMap));

      // 3. Record assignment & acceptance timestamp
      const tsMap = getStaffAssignmentTimestamps();
      if (reqId) tsMap[String(reqId)] = now;
      if (rawId) tsMap[String(rawId)] = now;
      if (trackingNo) tsMap[String(trackingNo)] = now;
      localStorage.setItem(ASSIGNMENT_TIMESTAMPS_KEY, JSON.stringify(tsMap));
      setAssignmentTimestamps((prev) => ({
        ...prev,
        [String(reqId)]: now,
        [String(rawId)]: now,
        [String(trackingNo)]: now,
      }));

      // 4. Update assignments map across all identifier keys
      const updated = { ...assignments };
      if (rawId) {
        updated[rawId] = staffName;
        updated[String(rawId)] = staffName;
      }
      if (reqId) {
        updated[reqId] = staffName;
        updated[String(reqId)] = staffName;
      }
      if (trackingNo) {
        updated[trackingNo] = staffName;
        updated[String(trackingNo)] = staffName;
      }
      setAssignments(updated);
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(updated));

      // 5. Update status and stored request
      const currentStatus = item.status || 'Pending';
      const updatedItem = {
        ...item,
        assigned_staff: staffName,
        assigned_at: nowIso,
        accepted_at: nowIso,
        updated_at: nowIso,
        status: currentStatus,
        rawStatus: currentStatus === 'Pending' ? 'PENDING' : (item.rawStatus || 'PENDING'),
      };

      updateStoredRequest(
        trackingNo || reqId || rawId,
        {
          assigned_staff: staffName,
          assigned_at: nowIso,
          accepted_at: nowIso,
          updated_at: nowIso,
          status: currentStatus,
        },
        {
          fallbackItem: updatedItem,
        }
      );

      // 6. Update raw requests state immediately
      setRawRequests((prev) =>
        prev.map((r) => {
          const matches =
            String(r.id) === String(rawId) ||
            String(r.id) === String(reqId) ||
            String(r.rawId) === String(rawId) ||
            String(r.tracking_number) === String(trackingNo) ||
            String(r.tracking_number) === String(reqId);
          return matches
            ? {
                ...r,
                assigned_staff: staffName,
                assigned_at: now,
                accepted_at: now,
                updated_at: nowIso,
                status: currentStatus,
              }
            : r;
        })
      );

      // 7. Log audit action
      logProcessedAction({
        actor: user?.username || 'staff',
        actorName: staffName,
        actorId: user?.id,
        actorRole: user?.role || 'staff',
        targetName: item.student_name,
        targetId: item.student_id || trackingNo,
        trackingNumber: trackingNo,
        documentType: item.document_type,
        action: 'Claimed request for staff verification & processing',
        status: currentStatus,
      });

      // 8. Safely notify other listeners
      recordRequestActivityTimestamp(trackingNo || reqId || rawId, now);
      window.dispatchEvent(new Event('regquest_assignments_updated'));
      window.dispatchEvent(new Event('regquest_requests_updated'));
    } catch (err) {
      console.warn('Error during claim processing:', err);
    }
  };

  const handleRequestUpdated = (updatedReq) => {
    const nowTime = Date.now();
    const nowIso = new Date(nowTime).toISOString();
    recordRequestActivityTimestamp(updatedReq, nowTime);
    setActivityTimestamps(getRequestActivityTimestamps());
    setRawRequests((prev) =>
      prev.map((r) =>
        String(r.id) === String(updatedReq.rawId) ||
        String(r.id) === String(updatedReq.id) ||
        String(r.rawId) === String(updatedReq.rawId) ||
        String(r.tracking_number) === String(updatedReq.id) ||
        String(r.tracking_number) === String(updatedReq.tracking_number)
          ? {
              ...r,
              ...updatedReq,
              updated_at: updatedReq.updated_at || nowIso,
              status: updatedReq.status || r.status,
              assigned_staff: updatedReq.assigned_staff || r.assigned_staff,
              assigned_at: updatedReq.assigned_at || r.assigned_at,
              accepted_at: updatedReq.accepted_at || r.accepted_at,
              remarks: updatedReq.remarks ?? r.remarks,
              payment_status: updatedReq.payment_status ?? r.payment_status,
              or_number: updatedReq.or_number ?? r.or_number,
              clearance_status: updatedReq.clearance_status ?? r.clearance_status,
              is_confirmed: updatedReq.is_confirmed ?? r.is_confirmed,
              confirmed_for_payment: updatedReq.confirmed_for_payment ?? r.confirmed_for_payment,
              assessed_amount: updatedReq.assessed_amount ?? r.assessed_amount,
              amount: updatedReq.amount ?? updatedReq.assessed_amount ?? r.amount,
              release_date: updatedReq.release_date ?? updatedReq.date_of_release ?? r.release_date,
              date_of_release: updatedReq.date_of_release ?? updatedReq.release_date ?? r.date_of_release,
              verified_by_name: updatedReq.verified_by_name ?? r.verified_by_name,
            }
          : r
      )
    );
  };

  const handleBackToList = () => {
    if (selectedRequest) {
      handleRequestUpdated(selectedRequest);
    }
    setSelectedRequest(null);
  };

  const handleUpdateStatus = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!selectedRequest) return;

    setUpdating(true);
    const targetId = selectedRequest.rawId || selectedRequest.id;
    const trackingNo = selectedRequest.tracking_number || selectedRequest.id;
    const effectiveStatus =
      selectedRequest.status &&
      String(selectedRequest.status).toLowerCase() !== 'pending' &&
      String(newStatus).toLowerCase() === 'pending'
        ? selectedRequest.status
        : newStatus;

    const staffName =
      selectedRequest.assigned_staff ||
      user?.full_name ||
      [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
      user?.username ||
      'Staff';

    const nowIso = new Date().toISOString();

    const fullPatch = {
      status: effectiveStatus,
      assigned_staff: staffName,
      assigned_at: selectedRequest.assigned_at,
      accepted_at: selectedRequest.accepted_at,
      updated_at: nowIso,
      remarks: notes || selectedRequest.remarks || '',
      clearance_status: selectedRequest.clearance_status,
      assessed_amount: selectedRequest.assessed_amount,
      amount: selectedRequest.amount || selectedRequest.assessed_amount,
      date_of_release: selectedRequest.date_of_release || selectedRequest.release_date,
      release_date: selectedRequest.release_date || selectedRequest.date_of_release,
      verified_by_name: selectedRequest.verified_by_name,
      is_confirmed: selectedRequest.is_confirmed,
      confirmed_for_payment: selectedRequest.confirmed_for_payment,
      payment_status: selectedRequest.payment_status,
      or_number: selectedRequest.or_number,
    };

    try {
      if (selectedRequest.rawId && typeof selectedRequest.rawId === 'number') {
        const backendStatus = BACKEND_STATUS_MAP[effectiveStatus] || effectiveStatus;
        try {
          await requestsApi.transition(selectedRequest.rawId, {
            status: backendStatus,
            remarks: notes || selectedRequest.remarks || '',
          });
        } catch (apiErr) {
          console.warn('Backend transition notice:', apiErr);
        }
      }

      // Sync assignment map as well
      if (staffName) {
        const updatedAssignments = { ...assignments };
        if (targetId) {
          updatedAssignments[targetId] = staffName;
          updatedAssignments[String(targetId)] = staffName;
        }
        if (trackingNo) {
          updatedAssignments[trackingNo] = staffName;
          updatedAssignments[String(trackingNo)] = staffName;
        }
        setAssignments(updatedAssignments);
        saveStaffAssignments(updatedAssignments);
      }

      updateStoredRequest(trackingNo || selectedRequest.id || targetId, fullPatch, {
        fallbackItem: { ...selectedRequest, ...fullPatch, updated_at: nowIso },
      });

      logProcessedAction({
        actor: user?.username,
        actorName: user?.full_name || user?.username,
        actorId: user?.id,
        actorRole: user?.role || 'staff',
        targetName: selectedRequest.student_name,
        targetId: selectedRequest.student_id || selectedRequest.tracking_number,
        trackingNumber: trackingNo,
        documentType: selectedRequest.document_type,
        action: `Status updated to ${effectiveStatus}`,
        status: effectiveStatus,
      });

      toast.success(`Request ${trackingNo} updated to ${effectiveStatus}.`);

      setRawRequests((prev) =>
        prev.map((r) =>
          String(r.id) === String(targetId) ||
          String(r.rawId) === String(targetId) ||
          String(r.tracking_number) === String(trackingNo) ||
          String(r.id) === String(selectedRequest.id)
            ? { ...r, ...fullPatch, updated_at: nowIso }
            : r
        )
      );

      setSelectedRequest(null);
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update request status.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="staff-req-container space-y-6">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Process Requests</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Review, verify, and process credential requests in your queue
          </p>
        </div>
      </div>

      <StaffSearchFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        docTypeFilter={docTypeFilter}
        setDocTypeFilter={setDocTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        credentialTypes={credentialTypes}
        requestStatuses={REQUEST_STATUSES}
      />

      {/* Queue View Tabs: Active Processing vs Request History */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[#0B0B36] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Active Requests</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {assignedRequests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#0B0B36] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Request History</span>
        </button>
      </div>

      {activeTab === 'active' ? (
        <>
          {/* Card 1: My Assigned Requests */}
          <StaffRequestsTable
            title="My Assigned Requests"
            subtitle="Requests assigned to you that are ready for processing"
            badgeCount={assignedRequests.length}
            loading={loading}
            error={error}
            filteredRequests={assignedRequests}
            totalRequestsCount={assignedRequests.length}
            getStatusBadge={getStatusBadge}
            onOpenProcess={handleOpenProcess}
            actionType="view"
            onArchive={handleArchiveRequest}
            emptyMessage="No requests currently assigned to you for processing."
            enableSelection={true}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={() => handleToggleSelectAll(assignedRequests.slice(0, 10))}
          />

          {/* Card 2: Unassigned Requests Queue */}
          <StaffRequestsTable
            title="Unassigned Requests Queue"
            subtitle="Incoming requests waiting to be claimed and processed"
            badgeCount={unassignedRequests.length}
            loading={loading}
            error={error}
            filteredRequests={unassignedRequests}
            totalRequestsCount={unassignedRequests.length}
            getStatusBadge={getStatusBadge}
            onOpenProcess={handleOpenProcess}
            actionType="claim"
            onAction={handleClaimAndProcess}
            emptyMessage="No unassigned requests found in queue."
            enableSelection={true}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={() => handleToggleSelectAll(unassignedRequests.slice(0, 10))}
          />
        </>
      ) : (
        /* Card 3: Completed & Claimed Requests History */
        <StaffRequestsTable
          title="Completed & Claimed Requests History"
          subtitle="Document requests that have been claimed by students and archived from active queue"
          loading={loading}
          error={error}
          filteredRequests={historyRequests}
          totalRequestsCount={historyRequests.length}
          getStatusBadge={getStatusBadge}
          onOpenProcess={handleOpenProcess}
          actionType="history"
          onRestore={handleRestoreRequest}
          emptyMessage="No claimed document requests in history yet."
          enableSelection={true}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={() => handleToggleSelectAll(historyRequests.slice(0, 10))}
        />
      )}

      {selectedRequest && (
        <ProcessRequestModal
          isOpen={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          requestItem={selectedRequest}
          onUpdated={handleRequestUpdated}
        />
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0B0B36] text-white px-5 py-3 rounded-2xl shadow-2xl border border-indigo-700/60 flex items-center gap-4 flex-wrap animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white/20 text-white font-black text-xs flex items-center justify-center">
              {selectedRequestsList.length}
            </span>
            <span className="text-xs sm:text-sm font-bold tracking-tight">
              {selectedRequestsList.length === 1 ? '1 request selected' : `${selectedRequestsList.length} requests selected`}
            </span>
          </div>

          <div className="h-4 w-px bg-white/20 hidden sm:block" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBatchModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Update Status & Releasing Date</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      <BatchUpdateModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        selectedRequests={selectedRequestsList}
        onConfirm={handleBatchUpdate}
      />
    </div>
  );
}
