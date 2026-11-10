import React, { useState, useEffect, useMemo } from 'react';
import requestsApi, { isValidRequest, sortRequestsNewestFirst, resolveRequestDocType, updateStoredRequest, logProcessedAction, getStaffAssignments, saveStaffAssignments, getStaffAssignmentTimestamps, recordStaffAssignmentTimestamp, getRequestActivityTimestamps, recordRequestActivityTimestamp, ASSIGNMENTS_KEY, setRequestArchived, getArchivedRequestsMap, isRequestArchived } from '../../api/requests';
import { saveStoredNotification } from '../../api/notifications';
import { useAuth } from '../../hooks/useAuth';
import usersApi from '../../api/users';
import clearancesApi, { getClearanceAttachment } from '../../api/clearances';
import ProcessRequestModal from '../../components/admin/ProcessRequestModal';
import { StaffRequestsTable } from '../../components/staff';
import useToast from '../../hooks/useToast';
import '../../styles/admin/AdminRequestsPage.css';
import '../../styles/staff/StaffRequestsPage.css';

const isClaimedStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  return s === 'claimed' || s.includes('claim');
};

function loadStoredAssignments() {
  return getStaffAssignments();
}

function saveStoredAssignments(map) {
  saveStaffAssignments(map);
}

function calculateReleaseDate(createdAt, processingDays = 5) {
  if (!createdAt) return 'N/A';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return 'N/A';
  d.setDate(d.getDate() + (Number(processingDays) || 5));
  return d.toISOString().split('T')[0];
}

const REQUEST_STATUSES = [
  'Pending',
  'Pending Payment',
  'For Processing',
  'Processing',
  'Releasing',
  'Claimed',
  'Rejected',
];

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
      return 'On Hold';
    case 'CANCELLED':
    case 'REJECTED':
      return 'Rejected';
    default:
      return s;
  }
}

export default function RegistrarRequestsPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isStaff = currentUser?.role === 'staff';

  const [rawRequests, setRawRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [credentialTypes, setCredentialTypes] = useState([]);
  const [assignments, setAssignments] = useState(loadStoredAssignments);
  const [activityTimestamps, setActivityTimestamps] = useState(getRequestActivityTimestamps);
  const [assignmentTimestamps, setAssignmentTimestamps] = useState(getStaffAssignmentTimestamps);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedBatch, setSelectedBatch] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignmentHistorySearch, setAssignmentHistorySearch] = useState('');
  const [assignmentHistoryDocType, setAssignmentHistoryDocType] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [clearances, setClearances] = useState([]);
  const [showAllBatch, setShowAllBatch] = useState(false);
  const [showAllHistoryBatch, setShowAllHistoryBatch] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [archivedMap, setArchivedMap] = useState(() => getArchivedRequestsMap());

  useEffect(() => {
    const handleArchivedUpdate = () => {
      setArchivedMap(getArchivedRequestsMap());
    };
    window.addEventListener('regquest_archived_updated', handleArchivedUpdate);
    window.addEventListener('storage', handleArchivedUpdate);
    return () => {
      window.removeEventListener('regquest_archived_updated', handleArchivedUpdate);
      window.removeEventListener('storage', handleArchivedUpdate);
    };
  }, []);

  const handleArchiveRequest = (item) => {
    if (!item) return;
    const reqId = item.id || item.rawId || item.tracking_number;
    setRequestArchived(reqId, true, currentUser, { fallbackItem: item });
    setArchivedMap(getArchivedRequestsMap());
    logProcessedAction({
      actor: currentUser?.username,
      actorName: currentUser?.full_name || currentUser?.username,
      actorId: currentUser?.id,
      actorRole: currentUser?.role || 'registrar',
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
    setRequestArchived(reqId, false, currentUser, { fallbackItem: item });
    setArchivedMap(getArchivedRequestsMap());
    logProcessedAction({
      actor: currentUser?.username,
      actorName: currentUser?.full_name || currentUser?.username,
      actorId: currentUser?.id,
      actorRole: currentUser?.role || 'registrar',
      targetName: item.student_name,
      targetId: item.student_id || reqId,
      trackingNumber: item.tracking_number || reqId,
      documentType: item.document_type,
      action: 'Restored request from History to Active Queue',
      status: item.status || 'Claimed',
    });
    toast.success(`Request ${item.id || reqId} restored to Active Queue.`);
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
        } catch {}

        if (!ignore) {
          setRawRequests(Array.isArray(requestsRes) ? requestsRes : []);
          setUsers(Array.isArray(usersRes) ? usersRes : []);
          setCredentialTypes(Array.isArray(credTypesRes) ? credTypesRes : []);
          setClearances(Array.isArray(clearancesRes) ? clearancesRes : []);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load requests data:', err);
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
    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_assignments_updated', handleAssignmentsSync);
    window.addEventListener('regquest_activity_updated', handleActivitySync);
    window.addEventListener('storage', handleAssignmentsSync);
    window.addEventListener('storage', handleActivitySync);

    return () => {
      ignore = true;
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_assignments_updated', handleAssignmentsSync);
      window.removeEventListener('regquest_activity_updated', handleActivitySync);
      window.removeEventListener('storage', handleAssignmentsSync);
      window.removeEventListener('storage', handleActivitySync);
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

  const staffMembers = useMemo(() => {
    return users
      .filter((u) => u.role === 'staff' || u.role === 'registrar')
      .map((u) => ({
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username,
        role: u.role === 'registrar' ? 'Registrar' : 'Registrar staff',
        username: u.username,
      }));
  }, [users]);

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
    return rawRequests
      .filter(isValidRequest)
      .filter((r) => Boolean(String(r.tracking_number || '').trim()))
      .map((r) => {
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
              String(s.id) === String(r.tracking_number) ||
              String(s.tracking_number) === String(r.tracking_number) ||
              String(s.rawId) === String(r.id)
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
          user?.username === '2023301564' || r.student_id === '2023301564' || r.student_name === '2023301564' || r.user === 11 || String(r.user) === '11'
            ? 'Daisy Traya'
            : user?.username === 'Love' || r.student_name === 'Love' || r.user === 2 || String(r.user) === '2'
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
          : userFullName || profileName || fallbackKnownName || (user?.username && !/^\d{6,}$/.test(user.username) ? user.username : null) || r.student_name || (r.student_id ? `Student (${r.student_id})` : 'Student');

        const studentId =
          r.student_id && /^\d+$/.test(r.student_id)
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

        const effectiveRawStatus =
          matchedStored?.status && String(matchedStored.status).toUpperCase() !== 'PENDING'
            ? matchedStored.status
            : r.status;

        let batchId = r.batchId || 'BATCH-000001';
        if (r.created_at) {
          const d = new Date(r.created_at);
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            batchId = `BATCH-${year}${month}`;
          }
        }

        const assignedStaff =
          assignments[r.id] ||
          assignments[String(r.id)] ||
          assignments[r.tracking_number] ||
          assignments[String(r.tracking_number)] ||
          assignments[r.rawId] ||
          assignments[String(r.rawId)] ||
          r.assigned_staff ||
          matchedStored?.assigned_staff ||
          '';

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
          rawStatus: effectiveRawStatus,
          batch_status: formatStatusDisplay(effectiveRawStatus),
          assigned_staff: assignedStaff,
          assigned_at:
            assignmentTimestamps[String(r.id)] ||
            assignmentTimestamps[String(r.tracking_number)] ||
            assignmentTimestamps[String(r.rawId)] ||
            r.assigned_at ||
            matchedStored?.assigned_at ||
            null,
          updated_at:
            matchedStored?.updated_at ||
            matchedStored?.updatedAt ||
            r.updated_at ||
            r.updatedAt ||
            null,
          archived_by: archivedMap[r.id]?.archived_by || archivedMap[r.rawId]?.archived_by || r.archived_by || null,
          archived_at: archivedMap[r.id]?.archived_at || archivedMap[r.rawId]?.archived_at || r.archived_at || null,
          created_at: r.created_at,
          request_date: requestDate,
          release_date: releaseDate,
          date_of_release: releaseDate,
          amount,
          assessed_amount: matchedStored?.assessed_amount || r.assessed_amount || amount,
          verified_by_name: matchedStored?.verified_by_name || r.verified_by_name || null,
          purpose: r.purpose || r.remarks || 'Official Academic Credential Request',
          remarks: matchedStored?.remarks || r.remarks || '',
          batchId,
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
      })
      .sort(sortRequestsNewestFirst);
  }, [rawRequests, userMap, credTypeMap, clearanceMap, assignments, activityTimestamps, assignmentTimestamps]);

  const batchOptions = useMemo(() => {
    const batchesMap = new Map();
    requests.forEach((r) => {
      if (!batchesMap.has(r.batchId)) {
        batchesMap.set(r.batchId, r.request_date !== 'N/A' ? `${r.batchId} - ${r.request_date}` : r.batchId);
      }
    });

    const list = [{ id: 'ALL', label: 'All Batches' }];
    batchesMap.forEach((label, id) => {
      list.push({ id, label });
    });
    return list;
  }, [requests]);

  const batchRequests = useMemo(() => {
    const activeReqs = requests.filter((r) => !isRequestArchived(r, archivedMap));
    if (selectedBatch === 'ALL') {
      return [...activeReqs].sort(sortRequestsNewestFirst);
    }
    return activeReqs.filter((r) => r.batchId === selectedBatch).sort(sortRequestsNewestFirst);
  }, [requests, selectedBatch, archivedMap, activityTimestamps, assignmentTimestamps, assignments]);

  const historyBatchRequests = useMemo(() => {
    const histReqs = requests.filter((r) => isRequestArchived(r, archivedMap));
    let filtered = selectedBatch === 'ALL' ? histReqs : histReqs.filter((r) => r.batchId === selectedBatch);

    if (assignmentHistorySearch.trim()) {
      const q = assignmentHistorySearch.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          (r.id && r.id.toLowerCase().includes(q)) ||
          (r.tracking_number && r.tracking_number.toLowerCase().includes(q)) ||
          (r.student_name && r.student_name.toLowerCase().includes(q)) ||
          (r.student_id && r.student_id.toLowerCase().includes(q)) ||
          (r.assigned_staff && r.assigned_staff.toLowerCase().includes(q)) ||
          (r.document_type && r.document_type.toLowerCase().includes(q))
      );
    }

    if (assignmentHistoryDocType) {
      const filterLow = assignmentHistoryDocType.toLowerCase();
      filtered = filtered.filter((r) => {
        const docLow = (r.document_type || '').toLowerCase();
        return docLow.includes(filterLow) || filterLow.includes(docLow);
      });
    }

    return [...filtered].sort((a, b) => {
      const timeA = archivedMap[a.id]?.archived_at || archivedMap[a.rawId]?.archived_at || a.assigned_at || a.created_at || 0;
      const timeB = archivedMap[b.id]?.archived_at || archivedMap[b.rawId]?.archived_at || b.assigned_at || b.created_at || 0;
      return new Date(timeB) - new Date(timeA);
    });
  }, [requests, selectedBatch, archivedMap, assignmentHistorySearch, assignmentHistoryDocType]);

  const handleAssignStaff = (requestId, rawId, staffName) => {
    setAssignments((prev) => {
      const updated = { ...prev };
      if (staffName) {
        updated[rawId] = staffName;
        updated[String(rawId)] = staffName;
        if (requestId !== rawId) {
          updated[requestId] = staffName;
          updated[String(requestId)] = staffName;
        }
        // Registrar verifies all, so assigned request moves to 'For Processing'
        updated[`status_${rawId}`] = 'For Processing';
        updated[`status_${String(rawId)}` ] = 'For Processing';
        updated[`status_${requestId}`] = 'For Processing';
        updated[`status_${String(requestId)}`] = 'For Processing';
      } else {
        delete updated[rawId];
        delete updated[String(rawId)];
        delete updated[requestId];
        delete updated[String(requestId)];
        delete updated[`status_${rawId}`];
        delete updated[`status_${String(rawId)}`];
        delete updated[`status_${requestId}`];
        delete updated[`status_${String(requestId)}`];
      }
      saveStoredAssignments(updated);
      return updated;
    });

    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    try {
      updateStoredRequest(requestId || rawId, {
        assigned_staff: staffName || '',
        assigned_at: staffName ? nowIso : null,
        updated_at: nowIso,
        status: staffName ? 'For Processing' : undefined,
      });
      recordStaffAssignmentTimestamp(requestId, now);
      if (rawId && rawId !== requestId) recordStaffAssignmentTimestamp(rawId, now);
      recordRequestActivityTimestamp(requestId, now);
      if (rawId && rawId !== requestId) recordRequestActivityTimestamp(rawId, now);
      setActivityTimestamps(getRequestActivityTimestamps());
      setAssignmentTimestamps(getStaffAssignmentTimestamps());
    } catch {}

    // Update in-memory state
    if (staffName) {
      setRawRequests((prev) =>
        prev.map((r) =>
          String(r.id) === String(rawId) ||
          String(r.id) === String(requestId) ||
          String(r.rawId) === String(rawId) ||
          String(r.tracking_number) === String(requestId)
            ? { ...r, assigned_staff: staffName, assigned_at: now, updated_at: nowIso, status: 'For Processing' }
            : r
        )
      );

      // Backend API transition if applicable
      if (rawId && !isNaN(Number(rawId))) {
        requestsApi
          .transition(Number(rawId), {
            status: 'PAYMENT_VERIFIED',
            remarks: `Assigned to ${staffName} for processing by registrar`,
          })
          .catch(() => {});
      }
    }

    if (staffName) {
      toast.success(`Assigned ${staffName} to ${requestId}`);

      const targetStaff =
        staffMembers.find(
          (s) =>
            s.name === staffName ||
            s.username === staffName ||
            String(s.id) === String(staffName)
        ) ||
        users.find(
          (u) =>
            u.username === staffName ||
            [u.first_name, u.last_name].filter(Boolean).join(' ') === staffName ||
            String(u.id) === String(staffName)
        );

      const req = requests.find(
        (r) =>
          String(r.id) === String(requestId) ||
          String(r.rawId) === String(rawId) ||
          String(r.tracking_number) === String(requestId) ||
          String(r.tracking_number) === String(rawId)
      );

      const trackingNum = req?.tracking_number || req?.id || requestId;
      const docType = req?.document_type || 'Credential Request';
      const studentName = req?.student_name || 'Student';

      saveStoredNotification({
        event_type: 'REQUEST_ASSIGNED',
        title: 'New Assigned Request',
        message: `New assigned request: You have been assigned to process ${docType} (${trackingNum}) for ${studentName}.`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingNum,
        target_role: 'staff',
        target_roles: ['staff'],
        target_user_id: targetStaff?.id || null,
        target_username: targetStaff?.username || null,
        target_name: staffName,
      });
    } else {
      toast.info(`Unassigned staff from ${requestId}`);
    }
  };

  const handleRequestUpdated = (updatedReq) => {
    const nowTime = Date.now();
    const nowIso = new Date(nowTime).toISOString();
    recordRequestActivityTimestamp(updatedReq, nowTime);
    recordStaffAssignmentTimestamp(updatedReq, nowTime);
    setActivityTimestamps(getRequestActivityTimestamps());
    setAssignmentTimestamps(getStaffAssignmentTimestamps());
    setRawRequests((prev) =>
      prev.map((r) =>
        String(r.id) === String(updatedReq.rawId) ||
        String(r.id) === String(updatedReq.id) ||
        String(r.tracking_number) === String(updatedReq.id) ||
        String(r.tracking_number) === String(updatedReq.tracking_number)
          ? {
              ...r,
              ...updatedReq,
              updated_at: updatedReq.updated_at || nowIso,
              status: updatedReq.status,
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

  const handleOpenProcess = (req) => {
    setSelectedRequest(req);
    setProcessModalOpen(true);
  };

  const totalRequests = batchRequests.length;
  const assignedCount = batchRequests.filter((r) => Boolean(r.assigned_staff)).length;
  const unassignedCount = totalRequests - assignedCount;

  const staffWorkload = useMemo(() => {
    if (staffMembers.length === 0) return [];
    return staffMembers.map((staff) => {
      const count = batchRequests.filter((r) => r.assigned_staff === staff.name).length;
      const percentage = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;
      return {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        count,
        percentage,
      };
    });
  }, [staffMembers, batchRequests, totalRequests]);

  const filteredRequests = useMemo(() => {
    return requests
      .filter((r) => {
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
      })
      .sort(sortRequestsNewestFirst);
  }, [requests, searchQuery, docTypeFilter, statusFilter]);

  const activeFilteredRequests = useMemo(() => {
    return filteredRequests
      .filter((r) => !isRequestArchived(r, archivedMap))
      .sort(sortRequestsNewestFirst);
  }, [filteredRequests, archivedMap, activityTimestamps, assignmentTimestamps, assignments]);

  const historyRequests = useMemo(() => {
    return requests
      .filter((r) => isRequestArchived(r, archivedMap))
      .filter((r) => {
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

        return true;
      })
      .sort((a, b) => {
        const timeA = archivedMap[a.id]?.archived_at || archivedMap[a.rawId]?.archived_at || a.created_at || 0;
        const timeB = archivedMap[b.id]?.archived_at || archivedMap[b.rawId]?.archived_at || b.created_at || 0;
        return new Date(timeB) - new Date(timeA);
      });
  }, [requests, archivedMap, searchQuery, docTypeFilter]);

  const activeTotalCount = useMemo(() => {
    return requests.filter((r) => !isRequestArchived(r, archivedMap)).length;
  }, [requests, archivedMap]);

  const historyTotalCount = useMemo(() => {
    return requests.filter((r) => isRequestArchived(r, archivedMap)).length;
  }, [requests, archivedMap]);

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
      case 'Rejected':
      case 'REJECTED':
        return <span className="status-pill rejected">Rejected</span>;
      default:
        return <span className="status-pill pending">{s}</span>;
    }
  };

  return (
    <div className="admin-req-container">
      {/* Queue View Tabs: Active Requests vs Request History */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[#0B0B36] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Active Requests</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {activeTotalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('history');
            setStatusFilter('');
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
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
          <div className="batch-header-card">
        <div className="batch-title-row">
          <div className="batch-icon-badge">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div className="batch-title-area">
            <h2 className="batch-main-title">Batch staff Assignment</h2>
            <p className="batch-subtitle">
              {isStaff
                ? 'Process approved requests, prepare documents, update request statuses, and manage batches'
                : 'Review & approve/reject credential requests and assign staff members'}
            </p>
            <div className="batch-select-row">
              <span className="batch-select-label">Select Batch:</span>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="batch-select-input"
              >
                {batchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="batch-metrics-group">
          <div className="batch-metric-box blue">
            <span className="batch-metric-lbl">Total Requests</span>
            <span className="batch-metric-val">{totalRequests}</span>
          </div>

          <div className="batch-metric-box green">
            <span className="batch-metric-lbl">Assigned</span>
            <span className="batch-metric-val">{assignedCount}</span>
          </div>

          <div className="batch-metric-box orange">
            <span className="batch-metric-lbl">Unassigned</span>
            <span className="batch-metric-val">{unassignedCount}</span>
          </div>
        </div>
      </div>

      <div className="staff-workload-card">
        <div className="staff-workload-header">
          <svg className="w-5 h-5 text-indigo-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="staff-workload-title">Batch staff Assignment</h3>
        </div>

        <div className="staff-workload-grid">
          {staffWorkload.length === 0 ? (
            <div className="py-4 text-sm text-slate-500">
              No registrar staff members found. Add staff users in User Management.
            </div>
          ) : (
            staffWorkload.map((staff) => (
              <div key={staff.id || staff.name} className="staff-card-item">
                <div className="staff-card-top">
                  <div>
                    <h4 className="staff-card-name">{staff.name}</h4>
                    <div className="staff-card-role">{staff.role}</div>
                  </div>
                  <span className="badge-request-count">
                    {staff.count} {staff.count === 1 ? 'request' : 'requests'}
                  </span>
                </div>
                <div className="staff-progress-track">
                  <div
                    className="staff-progress-fill"
                    style={{ width: `${Math.min(100, staff.percentage)}%` }}
                  />
                </div>
                <span className="staff-progress-text">{staff.percentage}% of batch</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="assign-table-card">
        <h3 className="assign-table-title">
          Requests Assignment - {selectedBatch === 'ALL' ? 'All Batches' : selectedBatch}
        </h3>

        <div className="table-responsive">
          <table className="custom-data-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Student</th>
                <th>Document Type</th>
                <th>Status</th>
                <th>Assigned Staff</th>
                <th>Assignment Status</th>
                <th className="text-right whitespace-nowrap min-w-[170px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    Loading requests from server...
                  </td>
                </tr>
              ) : batchRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    {requests.length === 0
                      ? 'No student requests have been submitted yet.'
                      : 'No requests found in this batch.'}
                  </td>
                </tr>
              ) : (
                (showAllBatch ? batchRequests : batchRequests.slice(0, 10)).map((item) => (
                  <tr key={item.rawId || item.id}>
                    <td className="req-id-text">{item.id}</td>
                    <td>
                      <div className="student-name-text">{item.student_name}</div>
                      <div className="student-id-sub">{item.student_id}</div>
                    </td>
                    <td>
                      <div className="doc-name-text">{item.document_type}</div>
                      <div className="doc-copies-sub">{item.copies}</div>
                    </td>
                    <td>{getStatusBadge(item.batch_status || item.status)}</td>
                    <td>
                      <select
                        value={item.assigned_staff || ''}
                        onChange={(e) => handleAssignStaff(item.id, item.rawId, e.target.value)}
                        className="staff-select-dropdown"
                      >
                        <option value="">-- Unassigned --</option>
                        {staffMembers.map((staff) => (
                          <option key={staff.id || staff.name} value={staff.name}>
                            {staff.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {item.assigned_staff ? (
                        <span className="badge-assigned">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Assigned</span>
                        </span>
                      ) : (
                        <span className="badge-unassigned">
                          <span>Unassigned</span>
                        </span>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2 flex-nowrap whitespace-nowrap">
                        {isClaimedStatus(item.batch_status || item.status) && !isRequestArchived(item, archivedMap) && (
                          <button
                            type="button"
                            onClick={() => handleArchiveRequest(item)}
                            className="staff-btn-archive"
                            title="Document claimed: Mark as Done and move to History"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Done</span>
                          </button>
                        )}
                        {isRequestArchived(item, archivedMap) && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Done</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenProcess(item)}
                          className="staff-btn-view"
                          title="View request details"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="3" strokeWidth={2} />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && batchRequests.length > 10 && (
          <div className="table-see-more-wrap">
            <button
              type="button"
              onClick={() => setShowAllBatch((prev) => !prev)}
              className="table-see-more-btn"
            >
              <span>
                {showAllBatch ? 'See Less' : 'See More'}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${showAllBatch ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="req-search-card">
        <h4 className="req-search-title">Search</h4>
        <div className="req-search-controls">
          <div className="req-input-wrap">
            <svg className="req-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by ID, Student Name, or Student ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="req-search-field"
            />
          </div>

          <div className="req-input-wrap">
            <svg className="req-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="req-dropdown-field"
            >
              <option value="">Document Type</option>
              {credentialTypes.map((ct) => (
                <option key={ct.id} value={ct.name}>
                  {ct.name}
                </option>
              ))}
            </select>
          </div>

          <div className="req-input-wrap">
            <svg className="req-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="req-dropdown-field"
            >
              <option value="">All Statuses</option>
              {REQUEST_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="requests-list-card">
        <div className="requests-list-header">
          <h3 className="requests-list-title">Requests</h3>
          <p className="requests-list-subtitle">
            {isStaff
              ? 'Process approved requests, prepare documents, and update request statuses'
              : 'Review and approve/reject credential requests from students'}
          </p>
        </div>

        <div className="table-responsive">
          <table className="custom-data-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Student</th>
                <th>Document Type</th>
                <th>Status</th>
                <th>Request Date</th>
                <th>Release Date</th>
                <th className="text-right whitespace-nowrap min-w-[170px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    Loading requests from server...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-rose-500">
                    {error}
                  </td>
                </tr>
              ) : activeFilteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    {activeTotalCount === 0
                      ? 'No active student requests in queue.'
                      : 'No active requests found matching your filter criteria.'}
                  </td>
                </tr>
              ) : (
                (showAllRequests ? activeFilteredRequests : activeFilteredRequests.slice(0, 10)).map((item) => (
                  <tr key={item.rawId || item.id}>
                    <td className="req-id-text">{item.id}</td>
                    <td>
                      <div className="student-name-text">{item.student_name}</div>
                      <div className="student-id-sub">{item.student_id}</div>
                    </td>
                    <td>
                      <div className="doc-name-text">{item.document_type}</div>
                      <div className="doc-copies-sub">{item.copies}</div>
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td className="font-semibold text-slate-800">{item.request_date}</td>
                    <td className="font-semibold text-slate-800">{item.release_date}</td>
                    <td className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2 flex-nowrap whitespace-nowrap">
                        {isClaimedStatus(item.status) && !isRequestArchived(item, archivedMap) && (
                          <button
                            type="button"
                            onClick={() => handleArchiveRequest(item)}
                            className="staff-btn-archive"
                            title="Document claimed: Mark as Done and move to History"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Done</span>
                          </button>
                        )}
                        {isRequestArchived(item, archivedMap) && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Done</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenProcess(item)}
                          className="staff-btn-view"
                          title="View request details"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="3" strokeWidth={2} />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && !error && activeFilteredRequests.length > 10 && (
          <div className="table-see-more-wrap">
            <button
              type="button"
              onClick={() => setShowAllRequests((prev) => !prev)}
              className="table-see-more-btn"
            >
              <span>
                {showAllRequests ? 'See Less' : 'See More'}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${showAllRequests ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>
        </>
      ) : (
        <>
          <div className="assign-table-card">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 mb-3 border-b border-slate-100">
              <div>
                <h3 className="assign-table-title !mb-0.5">
                  Requests Assignment History - {selectedBatch === 'ALL' ? 'All Batches' : selectedBatch}
                </h3>
                <p className="text-xs text-slate-500">
                  Archived and completed request assignments showing assigned staff members and release details
                </p>
              </div>
              <div className="batch-select-row !mt-0">
                <span className="batch-select-label">Select Batch:</span>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="batch-select-input"
                >
                  {batchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Controls for Requests Assignment History (replicated from Search History) */}
            <div className="req-search-controls md:!grid-cols-[2.5fr_1fr] mb-4">
              <div className="req-input-wrap">
                <svg className="req-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by ID, Student Name, Student ID, or Assigned Staff"
                  value={assignmentHistorySearch}
                  onChange={(e) => setAssignmentHistorySearch(e.target.value)}
                  className="req-search-field"
                />
              </div>

              <div className="req-input-wrap">
                <svg className="req-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <select
                  value={assignmentHistoryDocType}
                  onChange={(e) => setAssignmentHistoryDocType(e.target.value)}
                  className="req-dropdown-field"
                >
                  <option value="">All Document Types</option>
                  {credentialTypes.map((ct) => (
                    <option key={ct.id} value={ct.name}>
                      {ct.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="custom-data-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Student</th>
                    <th>Document Type</th>
                    <th>Status</th>
                    <th>Assigned Staff</th>
                    <th>Assignment Status</th>
                    <th className="text-right whitespace-nowrap min-w-[170px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                        Loading requests from server...
                      </td>
                    </tr>
                  ) : historyBatchRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                        {assignmentHistorySearch || assignmentHistoryDocType
                          ? 'No matching archived assignments found.'
                          : historyTotalCount === 0
                          ? 'No requests assignment history yet.'
                          : 'No archived requests found in this batch.'}
                      </td>
                    </tr>
                  ) : (
                    (showAllHistoryBatch ? historyBatchRequests : historyBatchRequests.slice(0, 10)).map((item) => (
                      <tr key={item.rawId || item.id}>
                        <td className="req-id-text">{item.id}</td>
                        <td>
                          <div className="student-name-text">{item.student_name}</div>
                          <div className="student-id-sub">{item.student_id}</div>
                        </td>
                        <td>
                          <div className="doc-name-text">{item.document_type}</div>
                          <div className="doc-copies-sub">{item.copies}</div>
                        </td>
                        <td>{getStatusBadge(item.batch_status || item.status)}</td>
                        <td>
                          <div className="font-semibold text-slate-800 text-sm">
                            {item.assigned_staff || item.verified_by_name || item.processed_by || item.archived_by || (
                              <span className="text-slate-400 italic font-normal text-xs">Unassigned</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Completed</span>
                          </span>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2 flex-nowrap whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleRestoreRequest(item)}
                              className="staff-btn-restore"
                              title="Restore back to Active Processing queue"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>Restore</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenProcess(item)}
                              className="staff-btn-view"
                              title="View request details"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="3" strokeWidth={2} />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>View</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && historyBatchRequests.length > 10 && (
              <div className="table-see-more-wrap">
                <button
                  type="button"
                  onClick={() => setShowAllHistoryBatch((prev) => !prev)}
                  className="table-see-more-btn"
                >
                  <span>
                    {showAllHistoryBatch ? 'See Less' : 'See More'}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showAllHistoryBatch ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
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
            showAssignedStaff={true}
            emptyMessage="No claimed document requests in history yet."
            searchControls={
              <div className="req-search-controls md:!grid-cols-[2.5fr_1fr]">
                <div className="req-input-wrap">
                  <svg className="req-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search history by ID, Student Name, or Student ID"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="req-search-field"
                  />
                </div>

                <div className="req-input-wrap">
                  <svg className="req-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <select
                    value={docTypeFilter}
                    onChange={(e) => setDocTypeFilter(e.target.value)}
                    className="req-dropdown-field"
                  >
                    <option value="">All Document Types</option>
                    {credentialTypes.map((ct) => (
                      <option key={ct.id} value={ct.name}>
                        {ct.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            }
          />
        </>
      )}

      <ProcessRequestModal
        key={selectedRequest ? (selectedRequest.rawId || selectedRequest.id) : (processModalOpen ? 'open' : 'closed')}
        isOpen={processModalOpen}
        onClose={() => setProcessModalOpen(false)}
        requestItem={selectedRequest}
        onUpdated={handleRequestUpdated}
      />
    </div>
  );
}
