import React, { useState, useEffect, useMemo } from 'react';
import requestsApi, { isDummyStudentRequest } from '../../api/requests';
import usersApi from '../../api/users';
import clearancesApi from '../../api/clearances';
import ProcessRequestModal from '../../components/admin/ProcessRequestModal';
import useToast from '../../hooks/useToast';
import '../../styles/admin/AdminRequestsPage.css';

const ASSIGNMENTS_KEY = 'regquest_staff_assignments';

function loadStoredAssignments() {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredAssignments(map) {
  try {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save staff assignments to localStorage:', err);
  }
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
  'Processing',
  'For release',
  'Claimed',
  'On Hold',
];

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

export default function AdminRequestsPage() {
  const toast = useToast();

  // Dynamic Data States
  const [rawRequests, setRawRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [credentialTypes, setCredentialTypes] = useState([]);
  const [assignments, setAssignments] = useState(loadStoredAssignments);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [selectedBatch, setSelectedBatch] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [clearances, setClearances] = useState([]);

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
          // If role doesn't have permission to /api/users/
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

  // Available staff members for assignment
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

  // Quick clearance lookup map
  const clearanceMap = useMemo(() => {
    const map = new Map();
    clearances.forEach((c) => {
      const uId = typeof c.user === 'object' ? c.user?.id : c.user;
      if (uId) map.set(uId, c);
      if (c.student_id) map.set(c.student_id, c);
      if (c.username) map.set(c.username, c);
      if (c.user_details?.username) map.set(c.user_details.username, c);
      if (c.user_details?.student_id) map.set(c.user_details.student_id, c);
    });
    return map;
  }, [clearances]);

  // Transform raw backend requests into display-ready items
  const requests = useMemo(() => {
    return rawRequests
      .filter((r) => !isDummyStudentRequest(r))
      .map((r, idx) => {
      const user = userMap.get(r.user);
      const cred = credTypeMap.get(r.credential_type);

      // Check stored request cache for clearance preview
      let cachedClearancePreview = null;
      let cachedClearanceFileName = null;
      let cachedClearanceIsPdf = false;
      try {
        const storedList = JSON.parse(localStorage.getItem('regquest_stored_requests') || '[]');
        const matchedStored = storedList.find(
          (s) =>
            s.id === r.id ||
            s.id === r.tracking_number ||
            s.tracking_number === r.tracking_number ||
            s.rawId === r.id
        );
        if (matchedStored?.clearance_preview) {
          cachedClearancePreview = matchedStored.clearance_preview;
          cachedClearanceFileName = matchedStored.clearance_file_name;
          cachedClearanceIsPdf = matchedStored.clearance_is_pdf;
        }
      } catch {}

      const userClearance =
        clearanceMap.get(r.user) ||
        clearanceMap.get(r.student_id) ||
        (user ? clearanceMap.get(user.id) : null) ||
        (user ? clearanceMap.get(user.student_id) : null) ||
        (user ? clearanceMap.get(user.username) : null);

      const effectiveClearancePreview =
        r.clearance_preview ||
        cachedClearancePreview ||
        userClearance?.file ||
        null;

      // Check cached student profile
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
        (user?.username === '2023301564' || r.student_id === '2023301564' || r.student_name === '2023301564')
          ? 'Daisy Traya'
          : null;

      // If r.student_name is valid and NOT an ID number or username, use it.
      // Otherwise, prefer actual user first/last name, profileName, or fallbackKnownName.
      const isStudentNameId =
        !r.student_name ||
        /^\d{6,}$/.test(r.student_name) ||
        r.student_name === r.student_id ||
        (user && r.student_name === user.username);

      const studentName = !isStudentNameId
        ? r.student_name
        : (userFullName || profileName || fallbackKnownName || r.student_name || user?.username || 'Student');

      const studentId =
        (r.student_id && /^\d+$/.test(r.student_id))
          ? r.student_id
          : profileStudentId || user?.student_id || user?.username || r.student_id || 'N/A';
      const documentType = r.document_type || cred?.name || r.credential_type_details?.name || 'Document Request';
      const amount =
        r.amount ||
        (cred?.price ? `P${parseFloat(cred.price).toFixed(0)}` : 'P0');

      const requestDate = r.request_date || (r.created_at ? r.created_at.split('T')[0] : 'N/A');
      const releaseDate = r.release_date || calculateReleaseDate(r.created_at, cred?.processing_days);

      // Derive batch identifier from created_at (e.g., "BATCH-2026-10")
      let batchId = r.batchId || 'BATCH-000001';
      if (r.created_at) {
        const d = new Date(r.created_at);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          batchId = `BATCH-${year}${month}`;
        }
      }

      const assignedStaff = assignments[r.id] || assignments[r.tracking_number] || assignments[r.rawId] || '';

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
        batch_status: formatStatusDisplay(r.status),
        assigned_staff: assignedStaff,
        request_date: requestDate,
        release_date: releaseDate,
        amount,
        purpose: r.purpose || r.remarks || 'Official Academic Credential Request',
        remarks: r.remarks || '',
        batchId,
        clearance_preview: effectiveClearancePreview,
        clearance_id: r.clearance_id || userClearance?.id || null,
        clearance_status: userClearance?.status || (effectiveClearancePreview ? 'ATTACHED' : null),
        clearance_file_name: r.clearance_file_name || cachedClearanceFileName || (userClearance?.file ? 'Clearance Document' : null),
        clearance_is_pdf: r.clearance_is_pdf || cachedClearanceIsPdf || false,
        photo_preview: r.photo_preview || null,
      };
    });
  }, [rawRequests, userMap, credTypeMap, clearanceMap, assignments]);

  // Dynamic Batch Options derived from requests
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

  // Filter requests according to selected batch for assignment section
  const batchRequests = useMemo(() => {
    if (selectedBatch === 'ALL') {
      return requests;
    }
    return requests.filter((r) => r.batchId === selectedBatch);
  }, [requests, selectedBatch]);

  // Handle staff assignment change
  const handleAssignStaff = (requestId, rawId, staffName) => {
    setAssignments((prev) => {
      const updated = { ...prev };
      if (staffName) {
        updated[rawId] = staffName;
        if (requestId !== rawId) updated[requestId] = staffName;
      } else {
        delete updated[rawId];
        delete updated[requestId];
      }
      saveStoredAssignments(updated);
      return updated;
    });

    if (staffName) {
      toast.success(`Assigned ${staffName} to ${requestId}`);
    } else {
      toast.info(`Unassigned staff from ${requestId}`);
    }
  };

  // Handle request status update from modal
  const handleRequestUpdated = (updatedReq) => {
    setRawRequests((prev) =>
      prev.map((r) =>
        r.id === updatedReq.rawId || r.id === updatedReq.id
          ? { ...r, status: updatedReq.status, remarks: updatedReq.remarks }
          : r
      )
    );
  };

  const handleOpenProcess = (req) => {
    setSelectedRequest(req);
    setProcessModalOpen(true);
  };

  // Metrics calculations for the selected batch
  const totalRequests = batchRequests.length;
  const assignedCount = batchRequests.filter((r) => Boolean(r.assigned_staff)).length;
  const unassignedCount = totalRequests - assignedCount;

  // Dynamic Staff Workload computation
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

  // Filtered requests for the lower table
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

  return (
    <div className="admin-req-container">
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
            <p className="batch-subtitle">Assign staff members to process document requests</p>
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

        {/* 3 Metric Blocks */}
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

      {/* ------------------------------------------------------------------
          3. Third Card: Requests Assignment
          ------------------------------------------------------------------ */}
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    Loading requests from server...
                  </td>
                </tr>
              ) : batchRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    {requests.length === 0
                      ? 'No student requests have been submitted yet.'
                      : 'No requests found in this batch.'}
                  </td>
                </tr>
              ) : (
                batchRequests.map((item) => (
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          4. Search & Filter Bar (Middle Section)
          ------------------------------------------------------------------ */}
      <div className="req-search-card">
        <h4 className="req-search-title">Search</h4>
        <div className="req-search-controls">
          {/* Search Input */}
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

          {/* Document Type Dropdown */}
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

          {/* All Statuses Dropdown */}
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

      {/* ------------------------------------------------------------------
          5. Fourth Card: Requests Table ("Latest document requests from students")
          ------------------------------------------------------------------ */}
      <div className="requests-list-card">
        <div className="requests-list-header">
          <h3 className="requests-list-title">Requests</h3>
          <p className="requests-list-subtitle">Latest document requests from students</p>
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
                <th className="text-right">Actions</th>
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
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    {requests.length === 0
                      ? 'No student requests have been submitted yet.'
                      : 'No requests found matching your filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((item) => (
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
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenProcess(item)}
                        className="btn-view-req"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="3" strokeWidth={2} />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
