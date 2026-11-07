import React, { useState, useEffect, useMemo } from 'react';
import requestsApi, { updateStoredRequest, isValidRequest, logProcessedAction, sortRequestsNewestFirst, resolveRequestDocType, getStaffAssignments, isRequestAssignedToUser } from '../../api/requests';
import { useAuth } from '../../hooks/useAuth';
import usersApi from '../../api/users';
import clearancesApi, { getClearanceAttachment } from '../../api/clearances';
import useToast from '../../hooks/useToast';
import ProcessRequestModal from '../../components/admin/ProcessRequestModal';
import { StaffRequestsTable, StaffSearchFilter } from '../../components/staff';
import '../../styles/staff/StaffRequestsPage.css';

const REQUEST_STATUSES = [
  'Pending',
  'For Payment',
  'For Processing',
  'Processing',
  'Releasing',
  'Claimed',
];

const BACKEND_STATUS_MAP = {
  'Pending': 'PENDING',
  'For Payment': 'PAYMENT_PENDING',
  'Pending Payment': 'PAYMENT_PENDING',
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
      return 'For Payment';
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
      return <span className="status-badge payment-pending">For Payment</span>;
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newStatus, setNewStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

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
    };
    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_assignments_updated', handleAssignmentsSync);
    window.addEventListener('storage', handleAssignmentsSync);

    return () => {
      ignore = true;
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_assignments_updated', handleAssignmentsSync);
      window.removeEventListener('storage', handleAssignmentsSync);
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

      const effectiveRawStatus =
        matchedStored?.status && String(matchedStored.status).toUpperCase() !== 'PENDING'
          ? matchedStored.status
          : r.status;

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
          matchedStored?.assigned_staff ||
          r.assigned_staff ||
          '',
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

    if (user?.role === 'staff') {
      built = built.filter((r) => isRequestAssignedToUser(r, user, assignments, users));
    }

    return built.sort(sortRequestsNewestFirst);
  }, [rawRequests, userMap, credTypeMap, clearanceMap, assignments, user, users]);

  const filteredRequests = useMemo(() => {
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
        return <span className="status-pill for-payment">For Payment</span>;
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

  const handleRequestUpdated = (updatedReq) => {
    setRawRequests((prev) =>
      prev.map((r) =>
        String(r.id) === String(updatedReq.rawId) ||
        String(r.id) === String(updatedReq.id) ||
        String(r.tracking_number) === String(updatedReq.id) ||
        String(r.tracking_number) === String(updatedReq.tracking_number)
          ? {
              ...r,
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
    const effectiveStatus =
      selectedRequest.status &&
      String(selectedRequest.status).toLowerCase() !== 'pending' &&
      String(newStatus).toLowerCase() === 'pending'
        ? selectedRequest.status
        : newStatus;

    const fullPatch = {
      status: effectiveStatus,
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

      updateStoredRequest(selectedRequest.id || targetId, fullPatch, {
        fallbackItem: selectedRequest,
      });

      logProcessedAction({
        actor: user?.username,
        actorName: user?.full_name || user?.username,
        actorId: user?.id,
        actorRole: user?.role || 'staff',
        targetName: selectedRequest.student_name,
        targetId: selectedRequest.student_id || selectedRequest.tracking_number,
        trackingNumber: selectedRequest.tracking_number || selectedRequest.id,
        documentType: selectedRequest.document_type,
        action: `Status updated to ${effectiveStatus}`,
        status: effectiveStatus,
      });

      toast.success(`Request ${selectedRequest.tracking_number || selectedRequest.id} updated to ${effectiveStatus}.`);

      setRawRequests((prev) =>
        prev.map((r) =>
          String(r.id) === String(targetId) ||
          String(r.tracking_number) === String(selectedRequest.id) ||
          String(r.id) === String(selectedRequest.id)
            ? { ...r, ...fullPatch }
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
    <div className="staff-req-container">
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

      <StaffRequestsTable
        loading={loading}
        error={error}
        filteredRequests={filteredRequests}
        totalRequestsCount={requests.length}
        getStatusBadge={getStatusBadge}
        onOpenProcess={handleOpenProcess}
      />

      {selectedRequest && (
        <ProcessRequestModal
          isOpen={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          requestItem={selectedRequest}
          onUpdated={handleRequestUpdated}
        />
      )}
    </div>
  );
}
