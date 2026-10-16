import React, { useState, useEffect, useMemo } from 'react';
import requestsApi, { updateStoredRequest } from '../../api/requests';
import usersApi from '../../api/users';
import useToast from '../../hooks/useToast';
import { StaffProcessModal, StaffRequestsTable, StaffSearchFilter } from '../../components/staff';
import '../../styles/staff/StaffRequestsPage.css';

const REQUEST_STATUSES = [
  'Pending',
  'Processing',
  'For release',
  'Claimed',
  'On Hold',
];

const BACKEND_STATUS_MAP = {
  'Pending': 'PENDING',
  'Pendong': 'PENDING',
  'Processing': 'PROCESSING',
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
    case 'PROCESSING':
    case 'DOCUMENT_PREPARATION':
    case 'DOCUMENT PREPARATION':
    case 'RELEASE_SCHEDULE_CONFIRMED':
    case 'SCHEDULE_CONFIRMED':
    case 'RELEASE SCHEDULE CONFIRMED':
      return 'Processing';
    case 'READY_FOR_RELEASE':
    case 'READY FOR RELEASE':
    case 'READY_FOR_PICKUP':
    case 'READY FOR PICKUP':
    case 'FOR_RELEASE':
    case 'FOR RELEASE':
      return 'For release';
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
    case 'PAYMENT_PENDING':
    case 'PAYMENT_VERIFIED':
    case 'CANCELLED':
    case 'REJECTED':
      return 'On Hold';
    default:
      return s;
  }
}

export default function StaffRequestsPage() {
  const toast = useToast();

  // Dynamic API State
  const [rawRequests, setRawRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [credentialTypes, setCredentialTypes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Request for Process View (Photo 2)
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newStatus, setNewStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [requestsRes, credTypesRes] = await Promise.all([
          requestsApi.list().catch((err) => {
            console.error('Failed requestsApi.list:', err);
            return [];
          }),
          requestsApi.getCredentialTypes().catch((err) => {
            console.error('Failed getCredentialTypes:', err);
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
          // Staff role does not have admin permissions to /api/users/, use cached users
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
    window.addEventListener('regquest_requests_updated', handleSync);

    return () => {
      ignore = true;
      window.removeEventListener('regquest_requests_updated', handleSync);
    };
  }, []);

  // Derived Lookup Maps
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

  // Formatted requests
  const requests = useMemo(() => {
    return rawRequests.map((r, idx) => {
      const user = userMap.get(r.user);
      const cred = credTypeMap.get(r.credential_type);
      const studentName =
        r.student_name ||
        (user
          ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
          : `Student #${r.user || idx + 1}`);
      const studentId = r.student_id || user?.student_id || user?.username || 'N/A';
      const documentType = r.document_type || cred?.name || r.credential_type_details?.name || 'Document Request';
      const amount =
        r.amount ||
        (cred?.price ? `P${parseFloat(cred.price).toFixed(0)}` : 'P0');

      const requestDate = r.request_date || (r.created_at ? r.created_at.split('T')[0] : 'N/A');
      const releaseDate = r.release_date || calculateReleaseDate(r.created_at, cred?.processing_days);

      return {
        rawId: r.rawId || r.id,
        id: r.tracking_number || r.id,
        tracking_number: r.tracking_number || r.id,
        student_name: studentName,
        student_id: studentId,
        document_type: documentType,
        copies: r.copies || '1 copy',
        status: formatStatusDisplay(r.status),
        rawStatus: r.status,
        request_date: requestDate,
        release_date: releaseDate,
        amount,
        purpose: r.purpose || r.remarks || 'Official Academic Credential Request',
        remarks: r.remarks || '',
        clearance_preview: r.clearance_preview || null,
        photo_preview: r.photo_preview || null,
      };
    });
  }, [rawRequests, userMap, credTypeMap]);

  // Filtered requests for table
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.student_name.toLowerCase().includes(q) ||
        r.student_id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (docTypeFilter && !r.document_type.toLowerCase().includes(docTypeFilter.toLowerCase())) {
        return false;
      }

      if (statusFilter && r.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [requests, searchQuery, docTypeFilter, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
      case 'Pendong':
        return <span className="status-pill pending">Pending</span>;
      case 'Processing':
        return <span className="status-pill processing">Processing</span>;
      case 'For release':
        return <span className="status-pill for-release">For release</span>;
      case 'Claimed':
        return <span className="status-pill claimed">Claimed</span>;
      case 'On Hold':
      case 'on Hold':
        return <span className="status-pill on-hold">On Hold</span>;
      default:
        return <span className="status-pill pending">{status}</span>;
    }
  };

  // Open Process View (Photo 2)
  const handleOpenProcess = (req) => {
    setSelectedRequest(req);
    setNewStatus(req.status || 'Pending');
    setNotes(req.remarks || '');
  };

  // Back to Requests Table (Photo 1)
  const handleBackToList = () => {
    setSelectedRequest(null);
  };

  // Handle Status Update Submit
  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setUpdating(true);
    const targetId = selectedRequest.rawId || selectedRequest.id;

    try {
      if (selectedRequest.rawId && typeof selectedRequest.rawId === 'number') {
        const backendStatus = BACKEND_STATUS_MAP[newStatus] || newStatus;
        try {
          await requestsApi.transition(selectedRequest.rawId, {
            status: backendStatus,
            remarks: notes || selectedRequest.remarks || '',
          });
        } catch (apiErr) {
          console.warn('Backend transition notice:', apiErr);
        }
      }

      // Update in stored requests
      updateStoredRequest(selectedRequest.id || targetId, {
        status: newStatus,
        remarks: notes,
      });

      toast.success(`Request ${selectedRequest.tracking_number || selectedRequest.id} updated to ${newStatus}.`);

      // Update state locally
      setRawRequests((prev) =>
        prev.map((r) =>
          r.id === targetId || r.tracking_number === selectedRequest.id || r.id === selectedRequest.id
            ? { ...r, status: newStatus, remarks: notes }
            : r
        )
      );

      // Return to list view
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
      {/* ------------------------------------------------------------------
          PHOTO 2 VIEW: Process Request View
          ------------------------------------------------------------------ */}
      {selectedRequest ? (
        <StaffProcessModal
          selectedRequest={selectedRequest}
          newStatus={newStatus}
          setNewStatus={setNewStatus}
          notes={notes}
          setNotes={setNotes}
          updating={updating}
          onUpdateStatus={handleUpdateStatus}
          onBackToList={handleBackToList}
          requestStatuses={REQUEST_STATUSES}
          getStatusBadge={getStatusBadge}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
