import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import requestsApi, { isValidRequest, sortRequestsNewestFirst, resolveRequestDocType, updateStoredRequest, logProcessedAction, getStaffAssignments, saveStaffAssignments, getStaffAssignmentTimestamps, recordStaffAssignmentTimestamp, getRequestActivityTimestamps, recordRequestActivityTimestamp, ASSIGNMENTS_KEY, setRequestArchived, getArchivedRequestsMap, isRequestArchived, preserveDocTagInRemarks, mergeReleaseDateIntoRemarks, formatCleanPurpose } from '../../api/requests';
import { useAuth } from '../../hooks/useAuth';
import usersApi from '../../api/users';
import clearancesApi, { getClearanceAttachment } from '../../api/clearances';
import ProcessRequestModal from '../../components/admin/ProcessRequestModal';
import BatchUpdateModal from '../../components/common/BatchUpdateModal';
import TablePagination from '../../components/common/TablePagination';
import ExpandableDocList from '../../components/common/ExpandableDocList';
import ExpandableRequestId from '../../components/common/ExpandableRequestId';
import { StaffRequestsTable } from '../../components/staff';
import useToast from '../../hooks/useToast';
import {
  REQUEST_STATUS,
  REQUEST_STATUSES,
  BACKEND_STATUS_MAP,
  normalizeToBackendStatus,
  formatStatusDisplay,
  isClaimedStatus,
  isUnverifiedStatus,
  isVerifiedStatus,
} from '../../constants/workflowStatuses';
import '../../styles/admin/AdminRequestsPage.css';
import '../../styles/staff/StaffRequestsPage.css';

function loadStoredAssignments() {
  return getStaffAssignments();
}

function saveStoredAssignments(map) {
  saveStaffAssignments(map);
}

function CustomSelectDropdown({
  value,
  options,
  onChange,
  buttonClassName = 'req-dropdown-field',
  wrapperClassName = 'w-full',
  placeholder = 'Select...',
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value ?? ''));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div ref={containerRef} className={`relative ${wrapperClassName}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${buttonClassName} w-full flex items-center justify-between gap-2 text-left cursor-pointer`}
      >
        <span className="truncate min-w-0">{displayLabel}</span>
        <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg z-40 py-1">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value ?? '');
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (String(opt.value) !== String(value ?? '')) {
                    onChange(opt.value);
                  }
                }}
                className={`w-full text-left px-3 py-1.5 text-xs whitespace-normal break-words leading-snug transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#0B0B36] text-white font-semibold'
                    : 'text-slate-700 hover:bg-[#0B0B36]/10 hover:text-[#0B0B36]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StaffAssignDropdown({
  value,
  staffMembers = [],
  onChange,
  disabled = false,
  disabledTooltip = '',
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  if (disabled) {
    return (
      <div
        className="relative w-[155px] sm:w-[180px]"
        title={disabledTooltip || 'Verify clearance & payment first before assigning staff'}
      >
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={disabledTooltip || 'Verify clearance & payment first before assigning staff'}
          className="staff-select-dropdown w-full flex items-center justify-between gap-2 text-left opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400 select-none shadow-none"
        >
          <span className="truncate">{value || '-- Unassigned --'}</span>
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </button>
      </div>
    );
  }

  // Options always include unassigned ('') plus all available staff members
  const options = [''];
  if (value && !staffMembers.some((s) => s.name === value || s.username === value)) {
    options.push(value);
  }
  staffMembers.forEach((s) => {
    if (s.name && !options.includes(s.name)) {
      options.push(s.name);
    }
  });

  return (
    <div ref={containerRef} className="relative w-[105px] sm:w-[115px]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Assign or reassign staff"
        className="staff-select-dropdown w-full flex items-center justify-between gap-1 text-left cursor-pointer !px-2 !py-1 !text-xs"
      >
        <span className="truncate">{value || '-- Unassigned --'}</span>
        <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[160px] w-max max-w-[220px] max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg z-40 py-1">
          {options.map((opt) => {
            const isSelected = (value || '') === opt;
            return (
              <button
                key={opt || '__unassigned__'}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (opt !== (value || '')) {
                    onChange(opt);
                  }
                }}
                className={`w-full text-left px-3 py-1.5 text-xs truncate transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#0B0B36] text-white font-semibold'
                    : 'text-slate-700 hover:bg-[#0B0B36]/10 hover:text-[#0B0B36]'
                }`}
              >
                {opt || '-- Unassigned --'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function calculateReleaseDate(createdAt, processingDays = 5) {
  if (!createdAt) return 'N/A';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return 'N/A';
  d.setDate(d.getDate() + (Number(processingDays) || 5));
  return d.toISOString().split('T')[0];
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
  const [verificationSearch, setVerificationSearch] = useState('');
  const [verificationDocType, setVerificationDocType] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [assignmentHistorySearch, setAssignmentHistorySearch] = useState('');
  const [assignmentHistoryDocType, setAssignmentHistoryDocType] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [clearances, setClearances] = useState([]);
  const [batchPage, setBatchPage] = useState(1);
  const BATCH_PAGE_SIZE = 10;
  const [staffWorkloadPage, setStaffWorkloadPage] = useState(1);
  const STAFF_WORKLOAD_PAGE_SIZE = 6;
  const staffWorkloadGridRef = useRef(null);
  const [lockedStaffGridHeight, setLockedStaffGridHeight] = useState(null);
  const batchTableRef = useRef(null);
  const [lockedBatchTableHeight, setLockedBatchTableHeight] = useState(null);
  const [historyBatchPage, setHistoryBatchPage] = useState(1);
  const historyBatchTableRef = useRef(null);
  const [lockedHistoryBatchHeight, setLockedHistoryBatchHeight] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [archivedMap, setArchivedMap] = useState(() => getArchivedRequestsMap());

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  const loggedInRegistrarName = useMemo(() => {
    if (!currentUser) return '';
    const isReg = String(currentUser.role || '').trim().toLowerCase() === 'registrar';
    if (!isReg) return '';
    return (
      [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ').trim() ||
      currentUser.full_name ||
      currentUser.username ||
      ''
    );
  }, [currentUser]);


  const isUnverified = (item) => {
    if (!item) return false;
    if (isRequestArchived(item, archivedMap)) return false;
    return isUnverifiedStatus(item);
  };

  const handleToggleSelect = (rawOrId, item) => {
    if (item && isUnverified(item)) {
      toast.error('Verify clearance & payment first before assigning staff.');
      return;
    }
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
    const selectable = items.filter((i) => !isUnverified(i));
    if (selectable.length === 0) return;
    const allSelected = selectable.every((i) =>
      selectedIds.has(String(i.id)) ||
      selectedIds.has(String(i.rawId)) ||
      (i.tracking_number && selectedIds.has(String(i.tracking_number)))
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      selectable.forEach((i) => {
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

  const isItemSelected = (item) => {
    return Boolean(
      selectedIds.has(String(item.rawId)) ||
      selectedIds.has(String(item.id)) ||
      (item.tracking_number && selectedIds.has(String(item.tracking_number)))
    );
  };

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

  const handleRestoreRequest = async (item) => {
    if (!item) return;
    if (String(currentUser?.role || '').toUpperCase() !== 'ADMIN') {
      toast.error('Only administrators can restore or reopen requests.');
      return;
    }
    const reqId = item.id || item.rawId || item.tracking_number;
    try {
      const restored = await requestsApi.restore(item.id || item.rawId);
      setRequestArchived(reqId, false, currentUser, { fallbackItem: item });
      setArchivedMap(getArchivedRequestsMap());

      updateStoredRequest(reqId, {
        status: restored?.status || 'Pending',
        rawStatus: restored?.status || 'PENDING',
        is_archived: false,
        in_process_queue: true,
      });

      logProcessedAction({
        actor: currentUser?.username,
        actorName: currentUser?.full_name || currentUser?.username,
        actorId: currentUser?.id,
        actorRole: 'admin',
        targetName: item.student_name,
        targetId: item.student_id || reqId,
        trackingNumber: item.tracking_number || reqId,
        documentType: item.document_type,
        action: `Restored request from History to Active Queue (${restored?.status || 'Active'})`,
        status: restored?.status || 'Claimed',
      });

      if (typeof loadData === 'function') {
        await loadData();
      }
      toast.success(`Request ${item.id || reqId} restored to Active Queue (${formatStatusDisplay(restored?.status)}).`);
    } catch (err) {
      console.error('Failed to restore request:', err);
      const msg = err.response?.data?.detail || 'Failed to restore request.';
      toast.error(msg);
    }
  };

  const loadData = useCallback(async () => {
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
        usersRes = await usersApi.getStaffUsers();
        if (!usersRes || usersRes.length === 0) {
          usersRes = await usersApi.getStaffDirectory();
        }
      } catch {
        try {
          usersRes = await usersApi.getStaffDirectory();
        } catch {
          usersRes = [];
        }
      }

      setRawRequests(Array.isArray(requestsRes) ? requestsRes : []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setCredentialTypes(Array.isArray(credTypesRes) ? credTypesRes : []);
      setClearances(Array.isArray(clearancesRes) ? clearancesRes : []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load requests data:', err);
      setError('Unable to load document requests from server.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_assignments_updated', handleAssignmentsSync);
      window.removeEventListener('regquest_activity_updated', handleActivitySync);
      window.removeEventListener('storage', handleAssignmentsSync);
      window.removeEventListener('storage', handleActivitySync);
    };
  }, [loadData]);

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
    const list = users
      .filter((u) => {
        const r = String(u.role || '').toLowerCase();
        return (r === 'staff' || r === 'registrar_staff' || r === 'registrar staff') && u.is_active !== false;
      })
      .map((u) => {
        const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
        return {
          id: u.id,
          name: fullName || u.full_name || u.username,
          role: 'Registrar staff',
          username: u.username,
        };
      });

    if (list.length > 0) return list;

    // Fallback: Ensure active staff options are available even if network is offline/slow
    return [
      { id: 'staff-1', name: 'Maria Santos', role: 'Registrar staff', username: 'maria_santos' },
      { id: 'staff-2', name: 'Daisy Staff', role: 'Registrar staff', username: 'daisy_staff' },
      { id: 'staff-3', name: 'Staff User', role: 'Registrar staff', username: 'staff' },
    ];
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

        const isPrePayment = [
          'PENDING',
          'SUBMITTED',
          'PENDING_PAYMENT',
          'FOR_PAYMENT',
          'PAYMENT_PENDING',
          'REQUIREMENTS_VERIFICATION',
          'FOR_VERIFICATION',
          'FOR VERIFICATION',
        ].includes(String(r.status || '').toUpperCase());

        const requestDate = r.request_date || (r.created_at ? r.created_at.split('T')[0] : 'N/A');
        const releaseDate = isPrePayment
          ? 'Pending Payment'
          : (matchedStored?.date_of_release ||
             matchedStored?.release_date ||
             r.date_of_release ||
             r.release_date ||
             calculateReleaseDate(r.created_at, cred?.processing_days));

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

        let claimedStaff = '';
        try {
          const claimedMap = JSON.parse(localStorage.getItem('regquest_claimed_requests') || '{}');
          const cVal =
            claimedMap[String(r.id)] ||
            claimedMap[String(r.tracking_number)] ||
            claimedMap[String(r.rawId)] ||
            '';
          if (cVal && cVal !== 'claimed' && cVal !== 'true' && cVal !== '1') {
            claimedStaff = cVal;
          }
        } catch {}

        const rawAssignedStaff =
          assignments[r.id] ||
          assignments[String(r.id)] ||
          assignments[r.tracking_number] ||
          assignments[String(r.tracking_number)] ||
          assignments[r.rawId] ||
          assignments[String(r.rawId)] ||
          r.assigned_staff ||
          matchedStored?.assigned_staff ||
          claimedStaff ||
          '';

        let assignedStaff = rawAssignedStaff;
        if (rawAssignedStaff) {
          const matchedMember = staffMembers.find(
            (s) =>
              s.username === rawAssignedStaff ||
              String(s.id) === String(rawAssignedStaff) ||
              s.name.toLowerCase() === String(rawAssignedStaff).toLowerCase()
          );
          if (matchedMember) {
            assignedStaff = matchedMember.name;
          } else {
            const userObj = userMap.get(rawAssignedStaff) || userMap.get(Number(rawAssignedStaff));
            if (userObj) {
              const uName = [userObj.first_name, userObj.last_name].filter(Boolean).join(' ').trim();
              if (uName) assignedStaff = uName;
            }
          }
        }

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
          purpose: formatCleanPurpose(r.purpose || r.remarks),
          remarks: matchedStored?.remarks || r.remarks || '',
          batchId,
          clearance_preview: effectiveClearancePreview,
          clearance_id: r.clearance_id || userClearance?.id || null,
          clearance_status:
            r.clearance_status ||
            matchedStored?.clearance_status ||
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
          is_approved: Boolean(matchedStored?.is_approved !== undefined ? matchedStored.is_approved : r.is_approved),
          is_auto_approved: Boolean(matchedStored?.is_auto_approved !== undefined ? matchedStored.is_auto_approved : r.is_auto_approved),
          approved_by_name: matchedStored?.approved_by_name || r.approved_by_name || '',
          approved_at: matchedStored?.approved_at || r.approved_at || null,
          payments: r.payments || matchedStored?.payments || [],
          raw: r,
        };
      })
      .filter((r) => {
        const sName = String(r.student_name || '').toLowerCase();
        const sId = String(r.student_id || '').toLowerCase();
        if (/^student\s*#?\s*[1-4]$/i.test(sName) || /^student\s*#?\s*[1-4]$/i.test(sId)) {
          return false;
        }
        return true;
      })
      .sort(sortRequestsNewestFirst);
  }, [rawRequests, userMap, staffMembers, credTypeMap, clearanceMap, assignments, activityTimestamps, assignmentTimestamps]);

  // Handle notification navigation: auto-select request if trackId in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('trackId') || params.get('reqId');
    if (trackId && requests.length > 0) {
      const found = requests.find(
        (r) =>
          String(r.tracking_number || '').toUpperCase() === String(trackId).toUpperCase() ||
          String(r.id || '').toUpperCase() === String(trackId).toUpperCase() ||
          String(r.rawId || '').toUpperCase() === String(trackId).toUpperCase()
      );
      if (found) {
        setSelectedRequest(found);
        setProcessModalOpen(true);
      }
    }
  }, [requests]);

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
    let activeReqs = requests.filter((r) => !isRequestArchived(r, archivedMap));
    if (selectedBatch !== 'ALL') {
      activeReqs = activeReqs.filter((r) => r.batchId === selectedBatch);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      activeReqs = activeReqs.filter(
        (r) =>
          (r.id && r.id.toLowerCase().includes(q)) ||
          (r.tracking_number && r.tracking_number.toLowerCase().includes(q)) ||
          (r.student_name && r.student_name.toLowerCase().includes(q)) ||
          (r.student_id && r.student_id.toLowerCase().includes(q)) ||
          (r.document_type && r.document_type.toLowerCase().includes(q))
      );
    }
    if (docTypeFilter) {
      const filterLow = docTypeFilter.toLowerCase();
      activeReqs = activeReqs.filter((r) => {
        const docLow = (r.document_type || '').toLowerCase();
        return docLow.includes(filterLow) || filterLow.includes(docLow);
      });
    }
    if (statusFilter) {
      activeReqs = activeReqs.filter((r) => {
        const itemStatus = (r.batch_status || r.status || '').toLowerCase();
        return itemStatus === statusFilter.toLowerCase();
      });
    }
    return activeReqs.sort(sortRequestsNewestFirst);
  }, [requests, selectedBatch, archivedMap, searchQuery, docTypeFilter, statusFilter, activityTimestamps, assignmentTimestamps, assignments]);

  useEffect(() => {
    setBatchPage(1);
  }, [selectedBatch, searchQuery, docTypeFilter, statusFilter]);

  const totalBatchPages = Math.max(1, Math.ceil(batchRequests.length / BATCH_PAGE_SIZE));
  const safeBatchPage = Math.min(batchPage, totalBatchPages);
  const paginatedBatchRequests = batchRequests.slice(
    (safeBatchPage - 1) * BATCH_PAGE_SIZE,
    safeBatchPage * BATCH_PAGE_SIZE
  );

  const unverifiedRequests = useMemo(() => {
    let unv = requests.filter((r) => isUnverified(r));
    if (selectedBatch !== 'ALL') {
      unv = unv.filter((r) => r.batchId === selectedBatch);
    }
    if (verificationSearch.trim()) {
      const q = verificationSearch.toLowerCase().trim();
      unv = unv.filter(
        (r) =>
          (r.id && r.id.toLowerCase().includes(q)) ||
          (r.tracking_number && r.tracking_number.toLowerCase().includes(q)) ||
          (r.student_name && r.student_name.toLowerCase().includes(q)) ||
          (r.student_id && r.student_id.toLowerCase().includes(q)) ||
          (r.document_type && r.document_type.toLowerCase().includes(q)) ||
          (r.batch_status && r.batch_status.toLowerCase().includes(q)) ||
          (r.status && r.status.toLowerCase().includes(q))
      );
    }
    if (verificationDocType) {
      const filterLow = verificationDocType.toLowerCase();
      unv = unv.filter((r) => {
        const docLow = (r.document_type || '').toLowerCase();
        return docLow.includes(filterLow) || filterLow.includes(docLow);
      });
    }
    if (verificationStatus) {
      unv = unv.filter((r) => {
        const itemStatus = (r.batch_status || r.status || '').toLowerCase();
        return itemStatus === verificationStatus.toLowerCase();
      });
    }
    return unv.sort(sortRequestsNewestFirst);
  }, [requests, selectedBatch, archivedMap, verificationSearch, verificationDocType, verificationStatus]);

  const [verificationPage, setVerificationPage] = useState(1);
  const VERIFICATION_PAGE_SIZE = 5;

  useEffect(() => {
    setVerificationPage(1);
  }, [selectedBatch, verificationSearch, verificationDocType, verificationStatus]);

  const totalVerificationPages = Math.max(1, Math.ceil(unverifiedRequests.length / VERIFICATION_PAGE_SIZE));
  const safeVerificationPage = Math.min(verificationPage, totalVerificationPages);
  const paginatedVerificationRequests = unverifiedRequests.slice(
    (safeVerificationPage - 1) * VERIFICATION_PAGE_SIZE,
    safeVerificationPage * VERIFICATION_PAGE_SIZE
  );

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

  const handleAssignStaff = async (requestId, rawId, staffName) => {
    const targetItem = requests.find(
      (r) =>
        String(r.id) === String(requestId) ||
        String(r.rawId) === String(rawId) ||
        String(r.tracking_number) === String(requestId) ||
        String(r.tracking_number) === String(rawId)
    );
    if (staffName && isUnverified(targetItem)) {
      toast.error('Verify clearance & payment first before assigning staff.');
      return;
    }

    setAssignments((prev) => {
      const updated = { ...prev };
      if (staffName) {
        updated[rawId] = staffName;
        updated[String(rawId)] = staffName;
        if (requestId !== rawId) {
          updated[requestId] = staffName;
          updated[String(requestId)] = staffName;
        }
      } else {
        delete updated[rawId];
        delete updated[String(rawId)];
        delete updated[requestId];
        delete updated[String(requestId)];
      }
      // Clean up legacy status_ overrides
      delete updated[`status_${rawId}`];
      delete updated[`status_${String(rawId)}`];
      delete updated[`status_${requestId}`];
      delete updated[`status_${String(requestId)}`];
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
            ? { ...r, assigned_staff: staffName, assigned_at: now, updated_at: nowIso }
            : r
        )
      );

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

      // Backend API assign endpoint to persist directly in PostgreSQL DB
      const targetBackendId = rawId || requestId;
      if (targetBackendId && !String(targetBackendId).startsWith('TRK-')) {
        const currentReq = rawRequests.find(
          (r) => String(r.id) === String(rawId) || String(r.id) === String(requestId) || String(r.tracking_number) === String(requestId)
        );
        const currentStatus = currentReq?.status ? normalizeToBackendStatus(currentReq.status) : 'PENDING';
        const currentRemarks = currentReq?.remarks || '';
        const cleanRemarks = currentRemarks.replace(/\[Assigned(?:\s+to)?:\s*[^\]]+\]/gi, '').trim();
        const updatedRemarks = cleanRemarks
          ? `${cleanRemarks} | [Assigned to: ${staffName}]`
          : `[Assigned to: ${staffName}]`;

        const staffIdentifier = targetStaff?.username || targetStaff?.id || staffName;
        try {
          await requestsApi.assign(targetBackendId, {
            assigned_staff: staffIdentifier,
            in_process_queue: true,
            remarks: updatedRemarks,
          });
        } catch {
          await requestsApi.transition(targetBackendId, {
            status: currentStatus,
            remarks: updatedRemarks,
            assigned_staff: staffIdentifier,
            in_process_queue: true,
          }, { throwOnError: false }).catch(() => {});
        }
      }

      toast.success(`Assigned ${staffName} to ${requestId}`);

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

      window.dispatchEvent(new Event('regquest_assignments_updated'));
      window.dispatchEvent(new Event('regquest_requests_updated'));
      await loadData();
    } else {
      const targetBackendId = rawId || requestId;
      if (targetBackendId && !String(targetBackendId).startsWith('TRK-')) {
        try {
          await requestsApi.assign(targetBackendId, {
            assigned_staff: null,
            in_process_queue: false,
          });
        } catch (err) {
          console.error('Failed to unassign staff on backend:', err);
        }
      }
      setRawRequests((prev) =>
        prev.map((r) =>
          String(r.id) === String(rawId) ||
          String(r.id) === String(requestId) ||
          String(r.rawId) === String(rawId) ||
          String(r.tracking_number) === String(requestId)
            ? { ...r, assigned_staff: null, assigned_at: null, updated_at: nowIso }
            : r
        )
      );
      toast.info(`Unassigned staff from ${requestId}`);
      window.dispatchEvent(new Event('regquest_assignments_updated'));
      window.dispatchEvent(new Event('regquest_requests_updated'));
      await loadData();
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
              rawStatus: updatedReq.rawStatus || updatedReq.status,
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
    loadData();
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

  const totalStaffWorkloadPages = Math.max(1, Math.ceil(staffWorkload.length / STAFF_WORKLOAD_PAGE_SIZE));
  const safeStaffWorkloadPage = Math.min(staffWorkloadPage, totalStaffWorkloadPages);
  const paginatedStaffWorkload = staffWorkload.slice(
    (safeStaffWorkloadPage - 1) * STAFF_WORKLOAD_PAGE_SIZE,
    safeStaffWorkloadPage * STAFF_WORKLOAD_PAGE_SIZE
  );

  useEffect(() => {
    const measureHeight = () => {
      if (
        totalStaffWorkloadPages > 1 &&
        paginatedStaffWorkload.length === STAFF_WORKLOAD_PAGE_SIZE &&
        staffWorkloadGridRef.current
      ) {
        setLockedStaffGridHeight(null);
        requestAnimationFrame(() => {
          if (staffWorkloadGridRef.current) {
            setLockedStaffGridHeight(staffWorkloadGridRef.current.offsetHeight);
          }
        });
      }
    };

    measureHeight();
    window.addEventListener('resize', measureHeight);
    return () => window.removeEventListener('resize', measureHeight);
  }, [totalStaffWorkloadPages, paginatedStaffWorkload.length]);

  useEffect(() => {
    if (
      totalBatchPages > 1 &&
      paginatedBatchRequests.length === BATCH_PAGE_SIZE &&
      batchTableRef.current
    ) {
      setLockedBatchTableHeight(batchTableRef.current.offsetHeight);
    }
  }, [totalBatchPages, paginatedBatchRequests.length]);

  const totalHistoryBatchPages = Math.max(1, Math.ceil(historyBatchRequests.length / BATCH_PAGE_SIZE));
  const safeHistoryBatchPage = Math.min(historyBatchPage, totalHistoryBatchPages);
  const paginatedHistoryBatchRequests = historyBatchRequests.slice(
    (safeHistoryBatchPage - 1) * BATCH_PAGE_SIZE,
    safeHistoryBatchPage * BATCH_PAGE_SIZE
  );

  useEffect(() => {
    if (
      totalHistoryBatchPages > 1 &&
      paginatedHistoryBatchRequests.length === BATCH_PAGE_SIZE &&
      historyBatchTableRef.current
    ) {
      setLockedHistoryBatchHeight(historyBatchTableRef.current.offsetHeight);
    }
  }, [totalHistoryBatchPages, paginatedHistoryBatchRequests.length]);

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

  const selectedRequestsList = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return requests
      .filter((r) => !isUnverified(r))
      .filter((r) =>
        selectedIds.has(String(r.id)) ||
        selectedIds.has(String(r.rawId)) ||
        (r.tracking_number && selectedIds.has(String(r.tracking_number)))
      );
  }, [requests, selectedIds, archivedMap]);

  const handleBatchUpdate = async ({ newStatus, releasingDate, note }) => {
    if (selectedRequestsList.length === 0) return;

    const nowTime = Date.now();
    const nowIso = new Date(nowTime).toISOString();

    for (const item of selectedRequestsList) {
      const targetId = item.rawId || item.id;
      const trackingNo = item.tracking_number || item.id;

      const patch = {
        updated_at: nowIso,
      };

      if (newStatus) {
        patch.status = newStatus;
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
        actor: currentUser?.username || 'registrar',
        actorName: currentUser?.full_name || currentUser?.username || 'Registrar',
        actorId: currentUser?.id,
        actorRole: currentUser?.role || 'registrar',
        targetName: item.student_name,
        targetId: item.student_id || trackingNo,
        trackingNumber: trackingNo,
        documentType: item.document_type,
        action: `Batch updated: ${newStatus ? `Status -> ${newStatus}; ` : ''}${releasingDate ? `Release Date -> ${releasingDate}; ` : ''}${note ? `Note -> ${note}` : ''}`.trim(),
        status: newStatus || item.status,
      });

      // Backend API transition if applicable
      if (newStatus && targetId && !String(targetId).startsWith('fallback_')) {
        const batchRemarks = releasingDate
          ? mergeReleaseDateIntoRemarks(item, releasingDate, note || 'Batch updated by registrar')
          : preserveDocTagInRemarks(item, note || 'Batch updated by registrar');
        await requestsApi.transition(
          targetId,
          {
            status: newStatus,
            remarks: batchRemarks,
          },
          { throwOnError: false }
        );
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
        if (newStatus) updated.status = newStatus;
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
      case 'For Verification':
      case 'FOR VERIFICATION':
      case 'FOR_VERIFICATION':
        return <span className="status-pill for-verification bg-indigo-100 text-indigo-900 border border-indigo-200">For Verification</span>;
      case 'For Processing':
      case 'FOR_PROCESSING':
      case 'PAYMENT_VERIFIED':
      case 'Processing':
      case 'PROCESSING':
        return <span className="status-pill processing">Processing</span>;
      case 'For release':
      case 'For Release':
      case 'Releasing':
      case 'RELEASING':
      case 'READY_FOR_RELEASE':
        return <span className="status-pill for-release">For Release</span>;
      case 'Released':
      case 'RELEASED':
        return <span className="status-pill for-release">Released</span>;
      case 'Claimed':
      case 'CLAIMED':
      case 'Completed':
      case 'COMPLETED':
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
      <div className="flex items-center justify-end gap-2 -mb-1">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[#0B0B36] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Active Requests</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#0B0B36] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
              <CustomSelectDropdown
                value={selectedBatch}
                onChange={setSelectedBatch}
                buttonClassName="batch-select-input"
                wrapperClassName="flex-1 min-w-0 sm:flex-initial sm:min-w-[165px]"
                options={batchOptions.map((b) => ({ value: b.id, label: b.label }))}
              />
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

      <div className="staff-workload-card" style={{ overflowAnchor: 'none' }}>
        <div className="staff-workload-header">
          <svg className="w-5 h-5 text-indigo-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="staff-workload-title">Batch staff Assignment</h3>
        </div>

        <div
          ref={staffWorkloadGridRef}
          className="staff-workload-grid"
        >
          {staffWorkload.length === 0 ? (
            <div className="py-4 text-sm text-slate-500">
              No registrar staff members found. Add staff users in User Management.
            </div>
          ) : (
            paginatedStaffWorkload.map((staff) => (
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
        {!loading && (
          <TablePagination
            currentPage={safeStaffWorkloadPage}
            totalItems={staffWorkload.length}
            pageSize={STAFF_WORKLOAD_PAGE_SIZE}
            onPageChange={setStaffWorkloadPage}
            accentColor="blue"
          />
        )}
      </div>

      {/* Primary Top Table: Pending Verification Queue */}
      <div className="assign-table-card mb-6" style={{ overflowAnchor: 'none' }}>
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 mb-3 border-b border-slate-100">
          <div>
            <h3 className="assign-table-title !mb-0 text-slate-900 font-bold">
              Pending Verification Queue (Clearance &amp; Payment)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review clearance and verify cashier payments to advance requests into processing.
            </p>
          </div>
        </div>

        <div className="req-search-controls mb-4">
          <div className="req-input-wrap">
            <svg className="req-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by ID, Student Name, Student ID, or Document"
              value={verificationSearch}
              onChange={(e) => setVerificationSearch(e.target.value)}
              className="req-search-field"
            />
          </div>

          <div className="req-input-wrap">
            <svg className="req-input-icon z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <CustomSelectDropdown
              value={verificationDocType}
              onChange={setVerificationDocType}
              buttonClassName="req-dropdown-field"
              options={[
                { value: '', label: 'All Document Types' },
                ...credentialTypes.map((ct) => ({ value: ct.name, label: ct.name })),
              ]}
            />
          </div>

          <div className="req-input-wrap">
            <svg className="req-input-icon z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <CustomSelectDropdown
              value={verificationStatus}
              onChange={setVerificationStatus}
              buttonClassName="req-dropdown-field"
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Pending Payment', label: 'Pending Payment' },
                { value: 'For Verification', label: 'For Verification' },
              ]}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="custom-data-table compact-assign-table">
            <thead>
              <tr>
                <th className="whitespace-nowrap">REQUEST ID</th>
                <th className="min-w-[140px]">STUDENT</th>
                <th className="min-w-[190px] max-w-[260px]">DOCUMENT TYPE</th>
                <th className="whitespace-nowrap">STATUS</th>
                <th className="whitespace-nowrap">DATE SUBMITTED</th>
                <th className="text-center whitespace-nowrap">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    Loading pending verifications...
                  </td>
                </tr>
              ) : unverifiedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                    {verificationSearch || verificationDocType || verificationStatus ? (
                      'No pending verifications match your search or filter.'
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="font-bold text-slate-800 text-sm">All requests are verified!</span>
                        <span className="text-xs text-slate-400">
                          There are currently no requests awaiting clearance or payment verification.
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedVerificationRequests.map((item) => (
                  <tr key={`verify-${item.rawId || item.id}`}>
                    <td className="req-id-text">
                      <ExpandableRequestId id={item.id} />
                    </td>
                    <td>
                      <div className="student-name-text">{item.student_name}</div>
                      <div className="student-id-sub">{item.student_id}</div>
                    </td>
                    <td>
                      <div className="doc-name-text">
                        <ExpandableDocList text={item.document_type} maxItems={1} />
                      </div>
                      <div className="doc-copies-sub">{item.copies}</div>
                    </td>
                    <td>{getStatusBadge(item.batch_status || item.status)}</td>
                    <td className="font-semibold text-slate-800 whitespace-nowrap text-xs sm:text-sm">
                      {item.request_date && item.request_date !== 'N/A'
                        ? item.request_date
                        : (item.created_at ? item.created_at.split('T')[0] : 'N/A')}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenProcess(item)}
                        className="staff-btn-view"
                        title="Verify clearance & payment"
                        aria-label="Verify clearance & payment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && unverifiedRequests.length > VERIFICATION_PAGE_SIZE && (
          <TablePagination
            currentPage={safeVerificationPage}
            totalItems={unverifiedRequests.length}
            pageSize={VERIFICATION_PAGE_SIZE}
            onPageChange={setVerificationPage}
            accentColor="blue"
          />
        )}
      </div>

      <div className="assign-table-card" style={{ overflowAnchor: 'none' }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="assign-table-title !mb-0">
            Requests Assignment - {selectedBatch === 'ALL' ? 'All Batches' : selectedBatch}
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode((prev) => !prev);
                if (isSelectionMode) setSelectedIds(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isSelectionMode
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : 'bg-indigo-50 text-indigo-950 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              {isSelectionMode ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel Selection</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Select Multiple</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="req-search-controls mb-4">
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
            <svg className="req-input-icon z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <CustomSelectDropdown
              value={docTypeFilter}
              onChange={setDocTypeFilter}
              buttonClassName="req-dropdown-field"
              options={[
                { value: '', label: 'Document Type' },
                ...credentialTypes.map((ct) => ({ value: ct.name, label: ct.name })),
              ]}
            />
          </div>

          {activeTab !== 'history' && (
            <div className="req-input-wrap">
              <svg className="req-input-icon z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <CustomSelectDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                buttonClassName="req-dropdown-field"
                options={[
                  { value: '', label: 'All Statuses' },
                  ...REQUEST_STATUSES.filter((st) => st !== 'Claimed').map((st) => ({ value: st, label: st })),
                ]}
              />
            </div>
          )}
        </div>

        <div
          ref={batchTableRef}
          className="table-responsive"
        >
          <table className="custom-data-table compact-assign-table">
            <thead>
              <tr>
                {isSelectionMode && (
                  <th className="w-9 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedBatchRequests.some((item) => !isUnverified(item)) &&
                        paginatedBatchRequests
                          .filter((item) => !isUnverified(item))
                          .every((item) => isItemSelected(item))
                      }
                      onChange={() =>
                        handleToggleSelectAll(paginatedBatchRequests)
                      }
                      disabled={!paginatedBatchRequests.some((item) => !isUnverified(item))}
                      className="w-4 h-4 rounded text-indigo-900 border-slate-300 focus:ring-indigo-950 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Select all verified requests"
                    />
                  </th>
                )}
                <th className="whitespace-nowrap">Request ID</th>
                <th className="min-w-[110px]">Student</th>
                <th className="min-w-[140px] max-w-[200px]">Document Type</th>
                <th className="whitespace-nowrap">Status</th>
                <th className="whitespace-nowrap">Release Date</th>
                <th className="text-center whitespace-nowrap">View / Action</th>
                <th className="w-[115px] whitespace-nowrap">Assigned Staff</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isSelectionMode ? 8 : 7} className="py-8 text-center text-sm text-slate-400">
                    Loading requests from server...
                  </td>
                </tr>
              ) : batchRequests.length === 0 ? (
                <tr>
                  <td colSpan={isSelectionMode ? 8 : 7} className="py-8 text-center text-sm text-slate-400">
                    {requests.length === 0
                      ? 'No student requests have been submitted yet.'
                      : 'No requests found in this batch.'}
                  </td>
                </tr>
              ) : (
                paginatedBatchRequests.map((item) => {
                  const itemUnverified = isUnverified(item);
                  return (
                    <tr key={item.rawId || item.id} className={isItemSelected(item) && isSelectionMode ? 'bg-indigo-50/50' : ''}>
                      {isSelectionMode && (
                        <td className="w-10 px-3 text-center">
                          {itemUnverified ? (
                            <span title="Verify clearance & payment first before assigning staff">
                              <input
                                type="checkbox"
                                disabled
                                className="w-4 h-4 rounded text-slate-300 border-slate-200 bg-slate-100 cursor-not-allowed opacity-50"
                              />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isItemSelected(item)}
                              onChange={() => handleToggleSelect(item.rawId || item.id, item)}
                              className="w-4 h-4 rounded text-indigo-900 border-slate-300 focus:ring-indigo-950 cursor-pointer"
                            />
                          )}
                        </td>
                      )}
                      <td className="req-id-text">
                        <ExpandableRequestId id={item.id} />
                      </td>
                      <td>
                        <div className="student-name-text">{item.student_name}</div>
                        <div className="student-id-sub">{item.student_id}</div>
                      </td>
                      <td>
                        <div className="doc-name-text">
                          <ExpandableDocList text={item.document_type} maxItems={1} />
                        </div>
                        <div className="doc-copies-sub">{item.copies}</div>
                      </td>
                      <td>{getStatusBadge(item.batch_status || item.status)}</td>
                      <td className="font-semibold text-slate-800 whitespace-nowrap">
                        {item.release_date || item.date_of_release || '—'}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenProcess(item)}
                            className="staff-btn-view"
                            title="View request details"
                            aria-label="View request details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="3" strokeWidth={2} />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Done</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <StaffAssignDropdown
                          value={item.assigned_staff || ''}
                          staffMembers={staffMembers}
                          disabled={itemUnverified}
                          disabledTooltip="Verify clearance & payment first before assigning staff"
                          onChange={(nextStaff) => handleAssignStaff(item.id, item.rawId, nextStaff)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && (
          <TablePagination
            currentPage={safeBatchPage}
            totalItems={batchRequests.length}
            pageSize={BATCH_PAGE_SIZE}
            onPageChange={setBatchPage}
            accentColor="blue"
          />
        )}
      </div>
        </>
      ) : (
        <>
          <div className="assign-table-card" style={{ overflowAnchor: 'none' }}>
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 mb-3 border-b border-slate-100">
              <div>
                <h3 className="assign-table-title !mb-0.5">
                  Requests Assignment History - {selectedBatch === 'ALL' ? 'All Batches' : selectedBatch}
                </h3>
                <p className="text-xs text-slate-500">
                  Archived and completed request assignments showing assigned staff members and release details
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectionMode((prev) => !prev);
                    if (isSelectionMode) setSelectedIds(new Set());
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelectionMode
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      : 'bg-indigo-50 text-indigo-950 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  {isSelectionMode ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Cancel Selection</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span>Select Multiple</span>
                    </>
                  )}
                </button>
                <div className="batch-select-row !mt-0">
                  <span className="batch-select-label">Select Batch:</span>
                  <CustomSelectDropdown
                    value={selectedBatch}
                    onChange={setSelectedBatch}
                    buttonClassName="batch-select-input"
                    wrapperClassName="flex-1 min-w-0 sm:flex-initial sm:min-w-[165px]"
                    options={batchOptions.map((b) => ({ value: b.id, label: b.label }))}
                  />
                </div>
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
                <svg className="req-input-icon z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <CustomSelectDropdown
                  value={assignmentHistoryDocType}
                  onChange={setAssignmentHistoryDocType}
                  buttonClassName="req-dropdown-field"
                  options={[
                    { value: '', label: 'All Document Types' },
                    ...credentialTypes.map((ct) => ({ value: ct.name, label: ct.name })),
                  ]}
                />
              </div>
            </div>

            <div
              ref={historyBatchTableRef}
              className="table-responsive"
            >
              <table className="custom-data-table compact-assign-table">
                <thead>
                  <tr>
                    {isSelectionMode && (
                      <th className="w-10 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={
                            paginatedHistoryBatchRequests.length > 0 &&
                            paginatedHistoryBatchRequests.every((item) => isItemSelected(item))
                          }
                          onChange={() =>
                            handleToggleSelectAll(paginatedHistoryBatchRequests)
                          }
                          className="w-4 h-4 rounded text-indigo-900 border-slate-300 focus:ring-indigo-950 cursor-pointer"
                          title="Select all"
                        />
                      </th>
                    )}
                    <th>Request ID</th>
                    <th>Student</th>
                    <th>Document Type</th>
                    <th>Status</th>
                    <th className="text-center whitespace-nowrap">View / Action</th>
                    <th>Assigned Staff</th>
                    <th>Assignment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isSelectionMode ? 8 : 7} className="py-8 text-center text-sm text-slate-400">
                        Loading requests from server...
                      </td>
                    </tr>
                  ) : historyBatchRequests.length === 0 ? (
                    <tr>
                      <td colSpan={isSelectionMode ? 8 : 7} className="py-8 text-center text-sm text-slate-400">
                        {assignmentHistorySearch || assignmentHistoryDocType
                          ? 'No matching archived assignments found.'
                          : historyTotalCount === 0
                          ? 'No requests assignment history yet.'
                          : 'No archived requests found in this batch.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedHistoryBatchRequests.map((item) => (
                      <tr key={item.rawId || item.id} className={isItemSelected(item) && isSelectionMode ? 'bg-indigo-50/50' : ''}>
                        {isSelectionMode && (
                          <td className="w-10 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isItemSelected(item)}
                              onChange={() => handleToggleSelect(item.rawId || item.id)}
                              className="w-4 h-4 rounded text-indigo-900 border-slate-300 focus:ring-indigo-950 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="req-id-text">
                      <ExpandableRequestId id={item.id} />
                    </td>
                        <td>
                          <div className="student-name-text">{item.student_name}</div>
                          <div className="student-id-sub">{item.student_id}</div>
                        </td>
                        <td>
                          <div className="doc-name-text">
                        <ExpandableDocList text={item.document_type} maxItems={1} />
                      </div>
                          <div className="doc-copies-sub">{item.copies}</div>
                        </td>
                        <td>{getStatusBadge(item.batch_status || item.status)}</td>
                        <td className="text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenProcess(item)}
                              className="staff-btn-view"
                              title="View request details"
                              aria-label="View request details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="3" strokeWidth={2} />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {String(currentUser?.role || '').toUpperCase() === 'ADMIN' && (
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
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="font-semibold text-slate-800 text-sm">
                            {item.assigned_staff || item.verified_by_name || item.processed_by || item.archived_by || (
                              <span className="text-slate-400 italic font-normal text-xs">Unassigned</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {(() => {
                            const norm = normalizeToBackendStatus(item.batch_status || item.status);
                            const isRej = norm === REQUEST_STATUS.REJECTED || norm === REQUEST_STATUS.REQUIREMENTS_REJECTED;
                            const isCanc = norm === REQUEST_STATUS.CANCELLED;
                            if (isRej) {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>Rejected</span>
                                </span>
                              );
                            }
                            if (isCanc) {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>Cancelled</span>
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Completed</span>
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && (
              <TablePagination
                currentPage={safeHistoryBatchPage}
                totalItems={historyBatchRequests.length}
                pageSize={BATCH_PAGE_SIZE}
                onPageChange={setHistoryBatchPage}
                accentColor="blue"
              />
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
            onRestore={String(currentUser?.role || '').toUpperCase() === 'ADMIN' ? handleRestoreRequest : null}
            showAssignedStaff={true}
            emptyMessage="No claimed document requests in history yet."
            enableSelection={true}
            isSelectionMode={isSelectionMode}
            onToggleSelectionMode={() => {
              setIsSelectionMode((p) => !p);
              if (isSelectionMode) setSelectedIds(new Set());
            }}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={() => handleToggleSelectAll(historyRequests.slice(0, 10))}
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
                  <svg className="req-input-icon z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <CustomSelectDropdown
                    value={docTypeFilter}
                    onChange={setDocTypeFilter}
                    buttonClassName="req-dropdown-field"
                    options={[
                      { value: '', label: 'All Document Types' },
                      ...credentialTypes.map((ct) => ({ value: ct.name, label: ct.name })),
                    ]}
                  />
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
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
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
