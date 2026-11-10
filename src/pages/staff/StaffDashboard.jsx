import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import ustpBuilding from '../../assets/USTP.png';
import requestsApi, {
  getStoredRequests,
  updateStoredRequest,
  isValidRequest,
  logProcessedAction,
  sortRequestsNewestFirst,
  resolveRequestDocType,
  getStaffAssignments,
  saveStaffAssignments,
  isRequestAssignedToUser,
  getStaffAssignmentTimestamps,
  recordStaffAssignmentTimestamp,
  getArchivedRequestsMap,
  setRequestArchived,
  isRequestArchived,
} from '../../api/requests';
import { useAuth } from '../../hooks/useAuth';
import usersApi from '../../api/users';
import clearancesApi from '../../api/clearances';
import ProcessRequestModal from '../../components/admin/ProcessRequestModal';
import { StaffRequestsTable } from '../../components/staff';
import useToast from '../../hooks/useToast';
import '../../styles/staff/StaffDashboard.css';
import '../../styles/staff/StaffRequestsPage.css';
function calculateReleaseDate(createdAt, processingDays = 5) {
  if (!createdAt) return 'N/A';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return 'N/A';
  d.setDate(d.getDate() + (Number(processingDays) || 5));
  return d.toISOString().split('T')[0];
}

function formatStatusDisplay(rawStatus) {
  if (!rawStatus) return 'Pending';
  const s = rawStatus.trim().toUpperCase();
  switch (s) {
    case 'PENDING':
    case 'RECEIVED':
    case 'REQUEST SUBMITTED':
      return 'Pending';
    case 'FOR_PAYMENT':
    case 'FOR PAYMENT':
    case 'PAYMENT_PENDING':
    case 'PAYMENT PENDING':
    case 'PENDING_PAYMENT':
    case 'PENDING PAYMENT':
      return 'Pending Payment';
    case 'PAYMENT_VERIFIED':
    case 'PAYMENT VERIFIED':
    case 'FOR_PROCESSING':
    case 'FOR PROCESSING':
      return 'For Processing';
    case 'PROCESSING':
    case 'DOCUMENT PREPARATION':
    case 'RELEASE SCHEDULE CONFIRMED':
      return 'Processing';
    case 'READY_FOR_RELEASE':
    case 'READY FOR RELEASE':
    case 'READY_FOR_PICKUP':
    case 'READY FOR PICKUP':
    case 'FOR_RELEASE':
    case 'FOR RELEASE':
      return 'For Release';
    case 'RELEASED':
    case 'CLAIMED':
    case 'CLAIMED / RELEASED':
      return 'Claimed';
    case 'ON HOLD':
    case 'REQUIREMENTS_VERIFICATION':
      return 'On Hold';
    default:
      if (s === 'FOR RELEASE' || s === 'FOR_RELEASE') return 'For Release';
      return rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
  }
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [requestsList, setRequestsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [assignments, setAssignments] = useState(getStaffAssignments);
  const [assignmentTimestamps, setAssignmentTimestamps] = useState(getStaffAssignmentTimestamps);
  const [archivedMap, setArchivedMap] = useState(getArchivedRequestsMap);
  const [loading, setLoading] = useState(true);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  const [modalRequest, setModalRequest] = useState(null);

  const today = useMemo(() => new Date(), []);
  const todayFormatted = useMemo(() => {
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [today]);

  const formatLocalDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  };

  const todayDateStr = useMemo(() => formatLocalDate(today), [today]);

  const selectedDateFormatted = useMemo(() => {
    if (!selectedCalendarDate) return '';
    try {
      const [y, m, d] = selectedCalendarDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return selectedCalendarDate;
    }
  }, [selectedCalendarDate]);

  const loadDashboardData = useCallback(async () => {
    try {
      const [backendRequests, credTypesRes, usersRes, clearancesRes] = await Promise.all([
        requestsApi.list().catch(() => []),
        requestsApi.getCredentialTypes().catch(() => []),
        usersApi.list().catch(() => []),
        clearancesApi.list().catch(() => []),
      ]);

      const stored = getStoredRequests();
      const combinedRaw = [...backendRequests];

      stored.forEach((s) => {
        const sKeys = [s.tracking_number, s.trackingId, s.id, s.rawId]
          .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
          .map((v) => String(v).trim());

        const existingIdx = combinedRaw.findIndex((b) => {
          const bKeys = [b.tracking_number, b.trackingId, b.id, b.rawId]
            .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
            .map((v) => String(v).trim());
          return sKeys.some((k) => bKeys.includes(k));
        });

        if (existingIdx === -1) {
          combinedRaw.push(s);
        } else {
          const prev = combinedRaw[existingIdx];
          const sStatusUpper = String(s.status || '').trim().toUpperCase();
          combinedRaw[existingIdx] = {
            ...prev,
            ...s,
            status:
              (s.updated_at && s.status) || (s.status && sStatusUpper !== 'PENDING')
                ? s.status
                : prev.status || s.status,
          };
        }
      });

      const userMap = new Map();
      if (Array.isArray(usersRes)) {
        setUsersList(usersRes);
        usersRes.forEach((u) => {
          if (u.id) userMap.set(u.id, u);
          if (u.username) userMap.set(u.username, u);
        });
      }

      const credMap = new Map();
      if (Array.isArray(credTypesRes)) {
        credTypesRes.forEach((c) => {
          if (c.id) credMap.set(c.id, c);
        });
      }

      let profiles = {};
      try {
        profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
      } catch {}

      if (combinedRaw.length > 0) {
        let enriched = combinedRaw
          .filter(isValidRequest)
          .filter((r) => Boolean(String(r.tracking_number || '').trim()))
          .map((r, idx) => {
          const userObj = userMap.get(r.user) || userMap.get(r.student_id);
          const cred = credMap.get(r.credential_type) || credMap.get(r.credential);
          const p = profiles[r.user] || profiles[r.student_id] || (userObj ? profiles[userObj.id] : null) || {};

          const fallbackKnownName =
            (r.student_id === '2023301564' || r.student_name === '2023301564' || r.user === 11 || String(r.user) === '11')
              ? 'Daisy Traya'
              : (r.user === 2 || String(r.user) === '2' || r.student_name === 'Love')
              ? 'Love'
              : null;

          const studentName =
            (r.student_name && r.student_name !== 'Student' && !/^\d{6,}$/.test(r.student_name))
              ? r.student_name
              : p.full_name ||
                (userObj ? [userObj.first_name, userObj.last_name].filter(Boolean).join(' ') : null) ||
                fallbackKnownName ||
                (userObj?.username && !/^\d{6,}$/.test(userObj.username) ? userObj.username : null) ||
                r.student_name ||
                'Student';

          const studentId =
            (r.student_id && /^\d+$/.test(r.student_id))
              ? r.student_id
              : p.student_id ||
                userObj?.student_id ||
                userObj?.username ||
                (r.user === 11 || String(r.user) === '11' ? '2023301564' : null) ||
                (r.user === 2 || String(r.user) === '2' ? '20231029' : null) ||
                r.student_id ||
                '—';

          const docType = resolveRequestDocType(r, cred);

          const copiesNum = parseInt(r.copies) || 1;
          const reqDate = r.created_at ? r.created_at.split('T')[0] : r.request_date || new Date().toISOString().split('T')[0];
          const relDate = r.release_date || calculateReleaseDate(r.created_at, cred?.processing_days);

          return {
            id: r.id || idx + 1,
            rawId: r.id || r.rawId || idx + 1,
            tracking_number: r.tracking_number || `REQ-${String(r.id || idx + 1).padStart(6, '0')}`,
            student_name: studentName,
            student_id: studentId,
            document_type: docType,
            copies: copiesNum,
            status: formatStatusDisplay(r.status),
            rawStatus: r.status,
            created_at: r.created_at,
            request_date: reqDate,
            release_date: relDate,
            notes: r.notes || r.remarks || '',
            clearance_preview: r.clearance_preview || null,
            clearance_id: r.clearance_id || null,
            clearance_status: r.clearance_status || (r.clearance_preview ? 'PENDING' : null),
            payment_status: r.payment_status || null,
            payment_proof: r.payment_proof || null,
            or_number: r.or_number || '',
            receipt_image: r.receipt_image || null,
            is_confirmed: r.is_confirmed ?? false,
            confirmed_for_payment: r.confirmed_for_payment ?? false,
            assessed_amount: r.assessed_amount || null,
            amount: r.amount || r.assessed_amount || '',
            purpose: r.purpose || r.remarks || '',
            remarks: r.remarks || '',
            user: r.user,
            assigned_staff: r.assigned_staff || null,
            assigned_at: r.assigned_at || null,
            accepted_at: r.accepted_at || null,
            photo_preview: r.photo_preview || null,
            raw: r,
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
            (r.student_id === 'N/A' || r.student_id === '—' || !r.student_id)
          ) {
            return false;
          }
          return true;
        })
        .sort(sortRequestsNewestFirst);

        setRequestsList(enriched);
      } else {
        setRequestsList([]);
      }
    } catch (err) {
      console.warn('Dashboard data load notice:', err);
      setRequestsList([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboardData();

    const handleSync = () => {
      loadDashboardData();
    };
    const handleAssignmentsSync = () => {
      setAssignments(getStaffAssignments());
      setAssignmentTimestamps(getStaffAssignmentTimestamps());
    };
    const handleArchivedSync = () => {
      setArchivedMap(getArchivedRequestsMap());
    };

    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_profile_updated', handleSync);
    window.addEventListener('regquest_assignments_updated', handleAssignmentsSync);
    window.addEventListener('regquest_archived_updated', handleArchivedSync);
    window.addEventListener('storage', handleAssignmentsSync);
    window.addEventListener('storage', handleArchivedSync);
    return () => {
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_profile_updated', handleSync);
      window.removeEventListener('regquest_assignments_updated', handleAssignmentsSync);
      window.removeEventListener('regquest_archived_updated', handleArchivedSync);
      window.removeEventListener('storage', handleAssignmentsSync);
      window.removeEventListener('storage', handleArchivedSync);
    };
  }, [loadDashboardData]);

  // Card 1: Requests assigned to this staff member (excluding archived history)
  // Sorted by: MOST RECENTLY ACCEPTED / ASSIGNED AT THE VERY TOP (REGARDLESS OF REQUEST DATE)!
  const assignedRequests = useMemo(() => {
    const list = selectedCalendarDate
      ? requestsList.filter((r) => {
          if (r.request_date === selectedCalendarDate) return true;
          if (r.release_date === selectedCalendarDate) return true;
          if (r.request_date < selectedCalendarDate && r.release_date > selectedCalendarDate) return true;
          return false;
        })
      : requestsList;

    return list
      .filter((r) => !isRequestArchived(r, archivedMap))
      .filter((r) => isRequestAssignedToUser(r, user, assignments, usersList))
      .sort((a, b) => {
        const getAssignTime = (item) => {
          const keys = [item.tracking_number, item.id, item.rawId].filter(Boolean).map(String);
          for (const k of keys) {
            if (assignmentTimestamps[k]) return Number(assignmentTimestamps[k]);
          }
          if (item.assigned_at) return Number(item.assigned_at) || new Date(item.assigned_at).getTime() || 0;
          if (item.accepted_at) return Number(item.accepted_at) || new Date(item.accepted_at).getTime() || 0;
          return 0;
        };

        const timeA = Math.max(getAssignTime(a), getRequestTimestamp(a));
        const timeB = Math.max(getAssignTime(b), getRequestTimestamp(b));

        if (timeA !== timeB) {
          return timeB - timeA; // Newly updated or assigned ALWAYS AT THE VERY TOP!
        }

        return sortRequestsNewestFirst(a, b);
      });
  }, [requestsList, selectedCalendarDate, user, assignments, usersList, assignmentTimestamps, archivedMap]);

  const handleArchiveRequest = useCallback((item) => {
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

    toast.success(`Request ${item.id} moved to History.`);
  }, [user, toast]);

  const targetRequestsForMetrics = useMemo(() => {
    return user?.role === 'staff' ? assignedRequests : requestsList;
  }, [user, assignedRequests, requestsList]);

  // All requests assigned to this user (or all requests for admin/master) - UNFILTERED by selected calendar date
  const allUserRequests = useMemo(() => {
    return user?.role === 'staff'
      ? requestsList.filter((r) => isRequestAssignedToUser(r, user, assignments, usersList))
      : requestsList;
  }, [user, requestsList, assignments, usersList]);

  const metrics = useMemo(() => {
    const total = targetRequestsForMetrics.length;
    const pending = targetRequestsForMetrics.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('pending') || s.includes('received');
    }).length;
    const processing = targetRequestsForMetrics.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('processing') || s.includes('preparation');
    }).length;
    const onHold = targetRequestsForMetrics.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('hold') || s.includes('verification');
    }).length;
    const forRelease = targetRequestsForMetrics.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('release') || s.includes('pickup') || s.includes('ready');
    }).length;
    const completed = targetRequestsForMetrics.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('claimed') || s === 'completed';
    }).length;

    return { total, pending, processing, onHold, forRelease, completed };
  }, [targetRequestsForMetrics]);

  const batchSchedule = useMemo(() => {
    const batchesByDate = {};
    allUserRequests.forEach((r) => {
      const dateKey = r.request_date || (r.created_at ? r.created_at.split('T')[0] : null);
      if (!dateKey) return;
      if (!batchesByDate[dateKey]) {
        batchesByDate[dateKey] = [];
      }
      batchesByDate[dateKey].push(r);
    });

    const newRequestsCountMap = {};
    const dailyProcessingMap = {};
    const releaseBatchesMap = {};
    const dailyScheduledDocsMap = {};

    const addDays = (dateStr, numDays) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + numDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    };

    const daysBetween = (startStr, endStr) => {
      const [y1, m1, d1] = startStr.split('-').map(Number);
      const [y2, m2, d2] = endStr.split('-').map(Number);
      const t1 = new Date(y1, m1 - 1, d1).getTime();
      const t2 = new Date(y2, m2 - 1, d2).getTime();
      return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
    };

    Object.entries(batchesByDate).forEach(([reqDate, reqs]) => {
      const totalInBatch = reqs.length;
      newRequestsCountMap[reqDate] = (newRequestsCountMap[reqDate] || 0) + totalInBatch;

      const firstWithRelDate = reqs.find((r) => r.release_date && r.release_date > reqDate);
      const releaseDate = firstWithRelDate ? firstWithRelDate.release_date : addDays(reqDate, 5);

      const diffDays = daysBetween(reqDate, releaseDate);
      const numProcessingDays = Math.max(1, diffDays - 1);

      const baseQuota = Math.floor(totalInBatch / numProcessingDays);
      const remainder = totalInBatch % numProcessingDays;

      let assignedIndex = 0;
      for (let i = 0; i < numProcessingDays; i++) {
        const procDate = addDays(reqDate, i + 1);
        const dailyQuota = baseQuota + (i < remainder ? 1 : 0);

        const dayReqs = reqs.slice(assignedIndex, assignedIndex + dailyQuota);
        assignedIndex += dailyQuota;

        const dayTotalDocs = dayReqs.reduce((acc, r) => acc + (parseInt(r.copies) || 1), 0);
        dailyProcessingMap[procDate] = (dailyProcessingMap[procDate] || 0) + dayTotalDocs;

        if (!dailyScheduledDocsMap[procDate]) {
          dailyScheduledDocsMap[procDate] = {
            requests: [],
            docCounts: {},
            totalDocs: 0,
          };
        }

        dayReqs.forEach((r) => {
          dailyScheduledDocsMap[procDate].requests.push(r);
          const type = r.document_type || 'Document Request';
          const copies = parseInt(r.copies) || 1;
          dailyScheduledDocsMap[procDate].docCounts[type] =
            (dailyScheduledDocsMap[procDate].docCounts[type] || 0) + copies;
          dailyScheduledDocsMap[procDate].totalDocs += copies;
        });
      }

      const processedCount = reqs.filter((r) => {
        const s = (r.status || '').toLowerCase();
        return s.includes('release') || s.includes('pickup') || s.includes('ready') || s.includes('claim');
      }).length;

      if (!releaseBatchesMap[releaseDate]) {
        releaseBatchesMap[releaseDate] = [];
      }
      releaseBatchesMap[releaseDate].push({
        requestDate: reqDate,
        totalRequests: totalInBatch,
        processedCount,
        requests: reqs,
      });
    });

    return {
      newRequestsCountMap,
      dailyProcessingMap,
      releaseBatchesMap,
      dailyScheduledDocsMap,
    };
  }, [allUserRequests]);

  const targetedSection = useMemo(() => {
    const activeDateStr = selectedCalendarDate || todayDateStr;
    const scheduled = batchSchedule.dailyScheduledDocsMap[activeDateStr];

    if (!scheduled || scheduled.totalDocs === 0) {
      return {
        totalDocuments: 0,
        cards: [],
        topDocName: 'None',
        activeDateStr,
        isToday: activeDateStr === todayDateStr,
      };
    }

    const sortedDocTypes = Object.entries(scheduled.docCounts).sort((a, b) => b[1] - a[1]);

    const cards = sortedDocTypes.map(([docName, count]) => ({
      name: docName,
      count,
    }));

    return {
      totalDocuments: scheduled.totalDocs,
      cards,
      topDocName: cards[0]?.name || 'None',
      activeDateStr,
      isToday: activeDateStr === todayDateStr,
    };
  }, [selectedCalendarDate, todayDateStr, batchSchedule]);

  const currentWeekDays = useMemo(() => {
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setDate(baseDate.getDate() + (currentWeekOffset * 7));

    const dayOfWeek = baseDate.getDay();
    const sunday = new Date(baseDate);
    sunday.setDate(baseDate.getDate() - dayOfWeek);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames.map((name, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);

      const dateStr = formatLocalDate(d);

      const newReqs = batchSchedule.newRequestsCountMap[dateStr] || 0;
      const proc = batchSchedule.dailyProcessingMap[dateStr] || 0;
      const releasingBatches = batchSchedule.releaseBatchesMap[dateStr] || [];
      const isReleaseDate = releasingBatches.length > 0;
      const releases = releasingBatches.reduce((sum, b) => sum + b.totalRequests, 0);

      let relTargetStr = '';
      let comp = null;

      if (isReleaseDate) {
        const primaryBatch = releasingBatches[0];
        const [y, m, dayNum] = primaryBatch.requestDate.split('-').map(Number);
        const originDate = new Date(y, m - 1, dayNum);
        relTargetStr = originDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        const totalReqs = releasingBatches.reduce((sum, b) => sum + b.totalRequests, 0);
        const totalProc = releasingBatches.reduce((sum, b) => sum + b.processedCount, 0);
        comp = totalReqs > 0 ? Math.round((totalProc / totalReqs) * 100) : 100;
      }

      const hasActiveWork = newReqs > 0 || proc > 0 || isReleaseDate;

      return {
        dayName: name,
        dayNumber: d.getDate(),
        dateStr,
        dateObj: d,
        isToday: d.toDateString() === now.toDateString(),
        hasActiveWork,
        isReleaseDate,
        relTargetStr,
        newReqs,
        proc,
        releases,
        comp,
      };
    });
  }, [batchSchedule, currentWeekOffset]);

  const calendarHeaderLabel = useMemo(() => {
    if (currentWeekDays.length === 0) return { monthYear: 'Calendar', range: '' };
    const first = currentWeekDays[0].dateObj;
    const last = currentWeekDays[6].dateObj;
    const monthYear = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const range = `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return { monthYear, range };
  }, [currentWeekDays]);

  const fullMonthWeeks = useMemo(() => {
    if (!isCalendarExpanded || currentWeekDays.length === 0) return [];
    const now = new Date();
    const activeMidDate = currentWeekDays[3].dateObj;
    const year = activeMidDate.getFullYear();
    const month = activeMidDate.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const startGridDate = new Date(firstOfMonth);
    startGridDate.setDate(firstOfMonth.getDate() - startOffset);

    const weeks = [];
    for (let w = 0; w < 5; w++) {
      const week = [];
      for (let dIdx = 0; dIdx < 7; dIdx++) {
        const day = new Date(startGridDate);
        day.setDate(startGridDate.getDate() + (w * 7 + dIdx));

        const dateStr = formatLocalDate(day);
        const isCurrentMonth = day.getMonth() === month;

        const newReqs = batchSchedule.newRequestsCountMap[dateStr] || 0;
        const proc = batchSchedule.dailyProcessingMap[dateStr] || 0;
        const releasingBatches = batchSchedule.releaseBatchesMap[dateStr] || [];
        const isReleaseDate = releasingBatches.length > 0;
        const releases = releasingBatches.reduce((sum, b) => sum + b.totalRequests, 0);

        let comp = null;
        if (isReleaseDate) {
          const totalReqs = releasingBatches.reduce((sum, b) => sum + b.totalRequests, 0);
          const totalProc = releasingBatches.reduce((sum, b) => sum + b.processedCount, 0);
          comp = totalReqs > 0 ? Math.round((totalProc / totalReqs) * 100) : 100;
        }

        const hasWork = newReqs > 0 || proc > 0 || isReleaseDate;

        week.push({
          dayNumber: day.getDate(),
          dateStr,
          isCurrentMonth,
          isToday: day.toDateString() === now.toDateString(),
          hasWork,
          isReleaseDate,
          newReqs,
          releases,
          proc,
          comp,
        });
      }
      weeks.push(week);
    }
    return weeks;
  }, [isCalendarExpanded, currentWeekDays, batchSchedule]);

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
    setModalRequest(req);
  };

  const handleCloseRequestModal = () => {
    setModalRequest(null);
  };



  return (
    <div className="staff-dash-page">
      <section className="staff-dash-hero">
        <div className="staff-dash-hero-bg">
          <img
            src={ustpBuilding}
            alt="USTP Campus Building"
            className="staff-dash-hero-img"
          />
          <div className="staff-dash-hero-grad-r" />
          <div className="staff-dash-hero-grad-t" />
        </div>

        <div className="staff-dash-hero-content">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="staff-dash-hero-title">
                Registrar Staff
              </h1>
              <p className="staff-dash-hero-subtitle">
                Dashboard
              </p>
              <p className="staff-dash-hero-desc">
                Manage and process student document requests
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="staff-dash-main">
        <div className="staff-dash-targeted-card">
          <div className="staff-dash-targeted-header">
            <div className="staff-dash-targeted-icon">
              <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM7 9V5a2 2 0 012-2h6a2 2 0 012 2v4" />
              </svg>
            </div>
            <div>
              <p className="staff-dash-targeted-date">
                {targetedSection.isToday ? todayFormatted : (selectedDateFormatted || selectedCalendarDate)}
              </p>
              <h2 className="staff-dash-targeted-title">
                {targetedSection.totalDocuments} {targetedSection.totalDocuments === 1 ? 'Document' : 'Documents'}
              </h2>
              <p className="staff-dash-targeted-sub">
                {targetedSection.isToday
                  ? 'Targeted for completion today'
                  : 'Targeted for completion on this day'}
              </p>
            </div>
          </div>

          {targetedSection.cards.length > 0 ? (
            <div className="staff-dash-targeted-grid">
              {targetedSection.cards.map((card, idx) => (
                <div key={idx} className="staff-dash-doc-card">
                  <div className="staff-dash-doc-card-top">
                    <span className="staff-dash-doc-name" title={card.name}>
                      {card.name}
                    </span>
                  </div>
                  <p className="staff-dash-doc-count">{card.count}</p>
                  <p className="staff-dash-doc-unit">
                    {card.count > 1 ? 'copies' : 'copy'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="staff-dash-targeted-empty">
              {targetedSection.isToday
                ? 'No document requests scheduled for processing today based on the calendar.'
                : 'No document requests scheduled for processing on this day based on the calendar.'}
            </div>
          )}
        </div>

        <div className="staff-dash-metrics-grid">
          <div className="staff-dash-metric-card">
            <div className="staff-dash-metric-top">
              <span className="staff-dash-metric-label">
                {user?.role === 'staff' ? 'My Assigned Requests' : 'Total Requests'}
              </span>
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="staff-dash-metric-val">{metrics.total}</p>
            <p className="staff-dash-metric-sub">{user?.role === 'staff' ? 'Assigned to Me' : 'All Time'}</p>
          </div>

          <div className="staff-dash-metric-card pending">
            <div className="staff-dash-metric-top">
              <span className="staff-dash-metric-label">Pending</span>
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="staff-dash-metric-val">{metrics.pending}</p>
            <p className="staff-dash-metric-sub">Need Attention</p>
          </div>

          <div className="staff-dash-metric-card processing">
            <div className="staff-dash-metric-top">
              <span className="staff-dash-metric-label">Processing</span>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="staff-dash-metric-val">{metrics.processing}</p>
            <p className="staff-dash-metric-sub">In progress</p>
          </div>

          <div className="staff-dash-metric-card on-hold">
            <div className="staff-dash-metric-top">
              <span className="staff-dash-metric-label">On Hold</span>
              <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="10" y1="15" x2="10" y2="9" />
                <line x1="14" y1="15" x2="14" y2="9" />
              </svg>
            </div>
            <p className="staff-dash-metric-val">{metrics.onHold}</p>
            <p className="staff-dash-metric-sub">Awaiting Action</p>
          </div>

          <div className="staff-dash-metric-card for-release">
            <div className="staff-dash-metric-top">
              <span className="staff-dash-metric-label">For Release</span>
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="staff-dash-metric-val">{metrics.forRelease}</p>
            <p className="staff-dash-metric-sub">Ready for Pickup</p>
          </div>

          <div className="staff-dash-metric-card completed">
            <div className="staff-dash-metric-top">
              <span className="staff-dash-metric-label">Completed Today</span>
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="staff-dash-metric-val">{metrics.completed}</p>
            <p className="staff-dash-metric-sub">Released</p>
          </div>
        </div>

        <div className="staff-dash-insight-card">
          <div className="staff-dash-insight-header">
            <div className="staff-dash-insight-icon">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04zm5 0A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z" />
              </svg>
            </div>
            <h3 className="staff-dash-insight-title">Predicted Insight this week</h3>
          </div>

          <div className="staff-dash-insight-body">
            {metrics.total > 0 ? (
              <>
                <p className="staff-dash-insight-item">
                  <span className="text-white text-base leading-none">•</span>
                  <span>
                    Current registrar workload: <strong className="font-bold text-white">{metrics.total} total {metrics.total === 1 ? 'request' : 'requests'}</strong> ({metrics.pending} pending, {metrics.processing} in progress).
                  </span>
                </p>
                {targetedSection.cards.length > 0 && (
                  <p className="staff-dash-insight-item">
                    <span className="text-white text-base leading-none">•</span>
                    <span>
                      Primary requested document: <strong className="font-bold text-white">{targetedSection.topDocName}</strong> ({targetedSection.cards[0].count} {targetedSection.cards[0].count === 1 ? 'copy' : 'copies'} requested).
                    </span>
                  </p>
                )}
                <p className="staff-dash-insight-item">
                  <span className="text-white text-base leading-none">•</span>
                  <span>
                    Ready for collection: <strong className="font-bold text-white">{metrics.forRelease} {metrics.forRelease === 1 ? 'document' : 'documents'}</strong> ready for release.
                  </span>
                </p>
              </>
            ) : (
              <p className="staff-dash-insight-item">
                <span className="text-white text-base leading-none">•</span>
                <span>
                  No document requests currently in the pipeline. New student submissions will appear here automatically.
                </span>
              </p>
            )}
          </div>
        </div>

        <div id="calendar" className="staff-dash-calendar-card">
          <div className="staff-dash-calendar-top">
            <div className="staff-dash-calendar-title-wrap">
              <div className="staff-dash-calendar-icon">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                  <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                  <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="staff-dash-calendar-range-badge">
                    {calendarHeaderLabel.range}
                  </span>
                  {selectedCalendarDate && (
                    <span className="staff-dash-calendar-selected-badge">
                      <span>Selected: {selectedCalendarDate}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCalendarDate(null);
                        }}
                        className="hover:text-red-700 font-black cursor-pointer ml-1"
                        title="Clear filter"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>
                <h3 className="staff-dash-calendar-heading">Calendar & Schedule</h3>
              </div>
            </div>

            <div className="staff-dash-calendar-nav">
              <button
                type="button"
                onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
                className="staff-dash-nav-btn"
                title="Previous Week"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentWeekOffset(0);
                  setSelectedCalendarDate(null);
                }}
                className={`staff-dash-today-btn ${currentWeekOffset === 0 ? 'active' : ''}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
                className="staff-dash-nav-btn"
                title="Next Week"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="staff-dash-calendar-grid-box">
            <div className="staff-dash-calendar-weekdays">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                <div key={day} className="staff-dash-calendar-weekday">
                  {day}
                </div>
              ))}
            </div>

            <div className="staff-dash-calendar-days">
              {currentWeekDays.map((d) => {
                const isSelected = selectedCalendarDate === d.dateStr;
                return (
                  <div
                    key={d.dateStr}
                    onClick={() => setSelectedCalendarDate((prev) => (prev === d.dateStr ? null : d.dateStr))}
                    className={`staff-dash-calendar-day ${
                      isSelected ? 'selected' : d.isToday ? 'today' : ''
                    }`}
                  >
                    {d.hasActiveWork ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-lg ${
                              isSelected
                                ? 'font-black text-[#000080]'
                                : d.isToday
                                ? 'font-black text-blue-800'
                                : 'font-bold text-slate-800'
                            }`}
                          >
                            {d.dayNumber}
                          </span>
                          {d.isReleaseDate && d.comp !== null && (
                            <span
                              className={`text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                d.comp >= 100 ? 'bg-[#00D02A]' : 'bg-[#F59E0B]'
                              }`}
                            >
                              {d.comp}%
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-[9px] sm:text-[10px]">
                          {d.isReleaseDate && (
                            <div
                              className="bg-[#DCFCE7] text-[#15803D] p-1 rounded font-medium truncate"
                              title={`Release document from: ${d.relTargetStr}`}
                            >
                              Release document from: {d.relTargetStr}
                            </div>
                          )}
                          {d.proc > 0 && (
                            <div className="bg-[#E0F2FE] text-[#0369A1] p-1 rounded font-medium flex justify-between">
                              <span>Process document:</span>
                              <strong className="font-bold">{d.proc}</strong>
                            </div>
                          )}
                          {d.newReqs > 0 && (
                            <div className="bg-[#FEF9C3] text-[#854D0E] p-1 rounded font-medium flex justify-between">
                              <span>New requests:</span>
                              <strong className="font-bold">{d.newReqs}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-1 font-bold text-slate-800 text-lg flex items-center justify-between">
                        <span className={d.isToday ? 'text-blue-800 font-black' : ''}>{d.dayNumber}</span>
                        {d.isToday && (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-1 rounded">
                            Today
                          </span>
                        )}
                      </div>
                    )}

                    {d.isReleaseDate && d.comp !== null && (
                      <div
                        className={`w-full h-1 rounded-full mt-2 ${
                          d.comp >= 100 ? 'bg-[#00D02A]' : 'bg-[#F59E0B]'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {isCalendarExpanded && (
              <div className="border-t border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#0A0A7C] uppercase tracking-wider">
                    Full Month Schedule ({calendarHeaderLabel.monthYear})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Click any date to inspect requests
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {fullMonthWeeks.map((week) =>
                    week.map((day) => {
                      const isSel = selectedCalendarDate === day.dateStr;
                      return (
                        <div
                          key={`month-day-${day.dateStr}`}
                          onClick={() => setSelectedCalendarDate((prev) => (prev === day.dateStr ? null : day.dateStr))}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                            isSel
                              ? 'bg-blue-100 border-[#000080] ring-1 ring-[#000080]'
                              : day.isToday
                              ? 'bg-blue-50 border-blue-300 font-bold'
                              : day.isCurrentMonth
                              ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                              : 'bg-slate-100/60 border-slate-200/50 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs ${
                                day.isCurrentMonth
                                  ? day.isToday
                                    ? 'font-black text-blue-800'
                                    : 'font-bold text-slate-800'
                                  : 'text-slate-400'
                              }`}
                            >
                              {day.dayNumber}
                            </span>
                            {day.hasWork && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Has document activity" />
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
                            {day.newReqs > 0 && (
                              <span className="bg-amber-100 text-amber-800 px-1 rounded font-semibold">
                                +{day.newReqs} new
                              </span>
                            )}
                            {day.proc > 0 && (
                              <span className="bg-blue-100 text-blue-800 px-1 rounded font-semibold">
                                {day.proc} proc
                              </span>
                            )}
                            {day.isReleaseDate && day.comp !== null && (
                              <span
                                className={`px-1 rounded font-semibold text-white ${
                                  day.comp >= 100 ? 'bg-[#00D02A]' : 'bg-[#F59E0B]'
                                }`}
                              >
                                {day.comp}% rel
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="staff-dash-calendar-more-wrap">
            <button
              type="button"
              onClick={() => navigate(ROUTES.STAFF.CALENDAR)}
              className="staff-dash-calendar-more-btn"
            >
              <span>View Full Month</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              {selectedCalendarDate && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-900 font-semibold">
                  <span>Filtered by Date: {selectedCalendarDate}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDate(null)}
                    className="hover:text-red-600 font-black cursor-pointer text-sm leading-none"
                    title="Clear filter"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.STAFF.REQUESTS)}
              className="staff-dash-btn-view-all ml-auto"
            >
              Go to Process Requests
            </button>
          </div>

          {/* My Assigned Requests */}
          <StaffRequestsTable
            title="My Assigned Requests"
            subtitle={
              selectedCalendarDate
                ? `Showing requests assigned to you matching ${selectedCalendarDate} (${assignedRequests.length} found)`
                : 'Requests assigned to you that are ready for processing'
            }
            badgeCount={assignedRequests.length}
            loading={loading}
            filteredRequests={assignedRequests}
            totalRequestsCount={assignedRequests.length}
            getStatusBadge={getStatusBadge}
            onOpenProcess={handleOpenProcess}
            actionType="view"
            onArchive={handleArchiveRequest}
            emptyMessage={
              selectedCalendarDate
                ? `No assigned requests found for ${selectedCalendarDate}.`
                : 'No requests currently assigned to you for processing.'
            }
          />
        </div>
      </div>

      {modalRequest && (
        <ProcessRequestModal
          isOpen={Boolean(modalRequest)}
          onClose={handleCloseRequestModal}
          requestItem={modalRequest}
          onUpdated={(updatedReq) => {
            setRequestsList((prev) =>
              prev.map((item) =>
                item.id === updatedReq.id || item.tracking_number === updatedReq.tracking_number || item.tracking_number === updatedReq.id
                  ? { ...item, ...updatedReq, status: formatStatusDisplay(updatedReq.status), raw: item.raw }
                  : item
              )
            );
          }}
        />
      )}
    </div>
  );
}
