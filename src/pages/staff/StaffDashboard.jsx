import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import ustpBuilding from '../../assets/USTP.png';
import requestsApi, { getStoredRequests, updateStoredRequest, isValidRequest } from '../../api/requests';
import usersApi from '../../api/users';
import clearancesApi from '../../api/clearances';
import { StaffProcessModal } from '../../components/staff';
import useToast from '../../hooks/useToast';

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

  const [requestsList, setRequestsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  // Modal State for StaffProcessModal
  const [modalRequest, setModalRequest] = useState(null);
  const [modalStatus, setModalStatus] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalUpdating, setModalUpdating] = useState(false);

  // Dynamic Date calculations
  const today = useMemo(() => new Date(), []);
  const todayFormatted = useMemo(() => {
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [today]);

  // Comprehensive Data Fetcher
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

      // Merge stored localStorage requests
      stored.forEach((s) => {
        const key = s.tracking_number || s.id;
        if (!combinedRaw.some((b) => (b.tracking_number || b.id) === key)) {
          combinedRaw.push(s);
        }
      });

      // Maps for enrichment
      const userMap = new Map();
      if (Array.isArray(usersRes)) {
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
        const enriched = combinedRaw
          .filter(isValidRequest)
          .map((r, idx) => {
          const userObj = userMap.get(r.user) || userMap.get(r.student_id);
          const cred = credMap.get(r.credential_type) || credMap.get(r.credential);
          const p = profiles[r.user] || profiles[r.student_id] || (userObj ? profiles[userObj.id] : null) || {};

          const studentName =
            p.full_name ||
            (userObj ? [userObj.first_name, userObj.last_name].filter(Boolean).join(' ') : null) ||
            r.student_name ||
            userObj?.username ||
            'Student';

          const studentId = p.student_id || r.student_id || userObj?.username || userObj?.student_id || '—';
          const docType = r.document_type || cred?.name || r.credential_name || 'Document Request';
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
            request_date: reqDate,
            release_date: relDate,
            notes: r.notes || r.remarks || '',
            clearance_preview: r.clearance_preview || null,
            clearance_id: r.clearance_id || null,
            raw: r,
          };
        });

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
  }, []);

  // Listen for real-time request updates across tabs or components
  useEffect(() => {
    loadDashboardData();

    const handleSync = () => {
      loadDashboardData();
    };

    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_profile_updated', handleSync);
    return () => {
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_profile_updated', handleSync);
    };
  }, [loadDashboardData]);

  // 1. Dynamic Key Metrics
  const metrics = useMemo(() => {
    const total = requestsList.length;
    const pending = requestsList.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('pending') || s.includes('received');
    }).length;
    const processing = requestsList.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('processing') || s.includes('preparation');
    }).length;
    const onHold = requestsList.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('hold') || s.includes('verification');
    }).length;
    const forRelease = requestsList.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('release') || s.includes('pickup') || s.includes('ready');
    }).length;
    const completed = requestsList.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('claimed') || s === 'completed';
    }).length;

    return { total, pending, processing, onHold, forRelease, completed };
  }, [requestsList]);

  // 2. Dynamic Targeted for Completion Today & Top Categories
  const targetedSection = useMemo(() => {
    // Only count active requests targeted for completion today (Pending & Processing)
    const activeRequests = requestsList.filter(
      (r) => r.status === 'Pending' || r.status === 'Processing'
    );
    const totalCopies = activeRequests.reduce((acc, r) => acc + (parseInt(r.copies) || 1), 0);

    // Group copies by document type
    const docCounts = {};
    activeRequests.forEach((r) => {
      const type = r.document_type || 'Document Request';
      docCounts[type] = (docCounts[type] || 0) + (parseInt(r.copies) || 1);
    });

    const sortedDocTypes = Object.entries(docCounts).sort((a, b) => b[1] - a[1]);

    // ONLY include documents that actually have requests!
    const cards = sortedDocTypes.map(([docName, count]) => ({
      name: docName,
      count,
      priority: count >= 3 ? 'High' : 'Medium',
    }));

    return {
      totalDocuments: totalCopies,
      cards,
      topDocName: cards[0]?.name || 'None',
    };
  }, [requestsList]);

  // 3. Dynamic Weekly Schedule & Calendar Data using Batch Processing Model
  // - Requests submitted on the same date are grouped into one batch
  // - Processing starts tomorrow and is divided across scheduled processing days
  // - Expected release date is reserved for releasing documents only (0 processing)
  // - Completion percentage is only displayed on the expected release date of the batch
  const batchSchedule = useMemo(() => {
    const batchesByDate = {};
    requestsList.forEach((r) => {
      const dateKey = r.request_date || (r.created_at ? r.created_at.split('T')[0] : null);
      if (!dateKey) return;
      if (!batchesByDate[dateKey]) {
        batchesByDate[dateKey] = [];
      }
      batchesByDate[dateKey].push(r);
    });

    const newRequestsCountMap = {}; // dateStr -> new requests submitted
    const dailyProcessingMap = {};  // dateStr -> requests scheduled for processing
    const releaseBatchesMap = {};   // dateStr -> array of batches releasing on this date

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

      // Batch release date: from requests or reqDate + 5 days
      const firstWithRelDate = reqs.find((r) => r.release_date && r.release_date > reqDate);
      const releaseDate = firstWithRelDate ? firstWithRelDate.release_date : addDays(reqDate, 5);

      // Processing days are the days strictly between reqDate and releaseDate
      const diffDays = daysBetween(reqDate, releaseDate);
      const numProcessingDays = Math.max(1, diffDays - 1);

      // Divide requests across scheduled processing days
      const baseQuota = Math.floor(totalInBatch / numProcessingDays);
      const remainder = totalInBatch % numProcessingDays;

      for (let i = 0; i < numProcessingDays; i++) {
        const procDate = addDays(reqDate, i + 1);
        const dailyQuota = baseQuota + (i < remainder ? 1 : 0);
        dailyProcessingMap[procDate] = (dailyProcessingMap[procDate] || 0) + dailyQuota;
      }

      // Batch completion: how many requests in this batch have already been processed
      // (status is 'For Release', 'Claimed', or 'Released')
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
    };
  }, [requestsList]);

  // Dynamic Weekly Schedule & Calendar Data
  const currentWeekDays = useMemo(() => {
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setDate(baseDate.getDate() + (currentWeekOffset * 7));

    const dayOfWeek = baseDate.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const sunday = new Date(baseDate);
    sunday.setDate(baseDate.getDate() - dayOfWeek);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames.map((name, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);

      const dateStr = d.toISOString().split('T')[0];

      // 1. New requests submitted today
      const newReqs = batchSchedule.newRequestsCountMap[dateStr] || 0;

      // 2. Scheduled requests to process today (divided from previous batches, 0 on release date)
      const proc = batchSchedule.dailyProcessingMap[dateStr] || 0;

      // 3. Batches scheduled for release today
      const releasingBatches = batchSchedule.releaseBatchesMap[dateStr] || [];
      const isReleaseDate = releasingBatches.length > 0;
      const releases = releasingBatches.reduce((sum, b) => sum + b.totalRequests, 0);

      // Target release reference date string (only on release date)
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

        // Overall completion progress of the batch
        const totalReqs = releasingBatches.reduce((sum, b) => sum + b.totalRequests, 0);
        const totalProc = releasingBatches.reduce((sum, b) => sum + b.processedCount, 0);
        comp = totalReqs > 0 ? Math.round((totalProc / totalReqs) * 100) : 100;
      }

      // Has active work if requests exist on this day
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

  // Calendar Header Info (Month, Year, and Date Range)
  const calendarHeaderLabel = useMemo(() => {
    if (currentWeekDays.length === 0) return { monthYear: 'Calendar', range: '' };
    const first = currentWeekDays[0].dateObj;
    const last = currentWeekDays[6].dateObj;
    const monthYear = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const range = `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return { monthYear, range };
  }, [currentWeekDays]);

  // Dynamic Full Month Grid (When View All is expanded)
  const fullMonthWeeks = useMemo(() => {
    if (!isCalendarExpanded || currentWeekDays.length === 0) return [];
    const now = new Date();
    const activeMidDate = currentWeekDays[3].dateObj;
    const year = activeMidDate.getFullYear();
    const month = activeMidDate.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sun
    const startGridDate = new Date(firstOfMonth);
    startGridDate.setDate(firstOfMonth.getDate() - startOffset);

    const weeks = [];
    for (let w = 0; w < 5; w++) {
      const week = [];
      for (let dIdx = 0; dIdx < 7; dIdx++) {
        const day = new Date(startGridDate);
        day.setDate(startGridDate.getDate() + (w * 7 + dIdx));

        const dateStr = day.toISOString().split('T')[0];
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

  // Dynamic filtered requests when a calendar day is clicked
  const displayedRequests = useMemo(() => {
    if (!selectedCalendarDate) return requestsList;
    const matched = requestsList.filter((r) => {
      if (r.request_date === selectedCalendarDate) return true;
      if (r.release_date === selectedCalendarDate) return true;
      if (r.request_date < selectedCalendarDate && r.release_date > selectedCalendarDate) return true;
      return false;
    });
    return matched.length > 0 ? matched : [];
  }, [requestsList, selectedCalendarDate]);

  // Status Badge Helper matching UI design
  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase().trim();
    if (s.includes('pending')) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF9C3] text-[#854D0E] shadow-2xs">
          Pending
        </span>
      );
    }
    if (s.includes('release') || s.includes('pickup') || s.includes('ready')) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] shadow-2xs">
          For Release
        </span>
      );
    }
    if (s.includes('processing')) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#E0F2FE] text-[#0369A1] shadow-2xs">
          Processing
        </span>
      );
    }
    if (s.includes('claimed')) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#BBF7D0] text-[#15803D] shadow-2xs">
          Claimed
        </span>
      );
    }
    if (s.includes('hold')) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#FFE4E6] text-[#BE123C] shadow-2xs">
          On Hold
        </span>
      );
    }
    return (
      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  };

  // Open Request in Modal
  const handleOpenRequestModal = (req) => {
    setModalRequest(req);
    const currentStatus = req.status || 'Pending';
    const normalizedStatus =
      currentStatus.toLowerCase().includes('release') || currentStatus.toLowerCase().includes('pickup')
        ? 'For Release'
        : currentStatus;
    setModalStatus(normalizedStatus);
    setModalNotes(req.notes || '');
  };

  // Close Request Modal
  const handleCloseRequestModal = () => {
    setModalRequest(null);
    setModalStatus('');
    setModalNotes('');
  };

  // Save Status Update in Modal
  const handleSaveStatus = async (statusOverride) => {
    if (!modalRequest) return;
    const finalStatus = (typeof statusOverride === 'string' ? statusOverride : modalStatus) || 'Pending';
    setModalUpdating(true);
    const targetId = modalRequest.rawId || modalRequest.id;

    const backendStatusMap = {
      'Pending': 'PENDING',
      'Processing': 'PROCESSING',
      'For Release': 'READY_FOR_RELEASE',
      'For release': 'READY_FOR_RELEASE',
      'Claimed': 'RELEASED',
      'On Hold': 'REQUIREMENTS_VERIFICATION',
    };

    try {
      // 1. Backend update if numeric backend id
      if (typeof targetId === 'number') {
        const backendStatus = backendStatusMap[finalStatus] || finalStatus.toUpperCase().replace(/\s+/g, '_');
        await requestsApi.transition(targetId, {
          status: backendStatus,
          remarks: modalNotes || '',
        }).catch(() => {});
      }

      // 2. Local storage persistence & notifications
      updateStoredRequest(modalRequest.id || targetId, {
        status: finalStatus,
        notes: modalNotes,
        remarks: modalNotes,
      });

      // 3. Immediately update local state
      setRequestsList((prev) =>
        prev.map((item) =>
          item.id === modalRequest.id || item.tracking_number === modalRequest.tracking_number
            ? { ...item, status: formatStatusDisplay(finalStatus), notes: modalNotes }
            : item
        )
      );

      toast.success(`Request ${modalRequest.tracking_number} updated to ${formatStatusDisplay(finalStatus)}!`);
      handleCloseRequestModal();
    } catch (err) {
      console.warn('Status update notice:', err);
      toast.error('Failed to update request status.');
    } finally {
      setModalUpdating(false);
    }
  };

  return (
    <div className="bg-[#F4F5F8] min-h-screen">
      {/* 1. Full-Width Hero Banner */}
      <section className="relative bg-[#0B0B36] text-white overflow-hidden py-10 px-6 sm:px-10 lg:px-12 select-none">
        {/* USTP Building Background Texture with Smooth Gradients */}
        <div className="absolute right-0 top-0 bottom-0 w-2/5 sm:w-1/2 opacity-30 pointer-events-none overflow-hidden">
          <img
            src={ustpBuilding}
            alt="USTP Campus Building"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0B36] via-[#0B0B36]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B36] via-transparent to-[#0B0B36]/60" />
        </div>

        {/* Hero Title & Subtitle */}
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Registrar Staff
          </h1>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#F5B014] mt-1 tracking-tight">
            Dashboard
          </p>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 font-normal leading-relaxed">
            Manage and process student document requests
          </p>
        </div>
      </section>

      {/* 2. Main Dashboard Content Area */}
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-7">
        {/* Section 1: Targeted for Completion Today */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM7 9V5a2 2 0 012-2h6a2 2 0 012 2v4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">{todayFormatted}</p>
              <h2 className="text-xl font-bold text-slate-900 leading-snug">
                {targetedSection.totalDocuments} {targetedSection.totalDocuments === 1 ? 'Document' : 'Documents'}
              </h2>
              <p className="text-xs text-slate-400 font-normal">Targeted for completion today</p>
            </div>
          </div>

          {/* Document Type Subcards */}
          {targetedSection.cards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {targetedSection.cards.map((card, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 truncate" title={card.name}>
                      {card.name}
                    </span>
                    <span
                      className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        card.priority === 'High' ? 'bg-[#E60000]' : 'bg-[#FF6B00]'
                      }`}
                    >
                      {card.priority}
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 mt-2">{card.count}</p>
                  <p className="text-xs text-slate-400 font-normal">
                    {card.count > 1 ? 'copies' : 'copy'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-500 text-xs text-center font-medium">
              No active document requests targeted for today.
            </div>
          )}
        </div>

        {/* Section 2: 6 Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {/* Total Requests */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Total Requests</span>
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.total}</p>
            <p className="text-xs text-slate-400 mt-1">All Time</p>
          </div>

          {/* Pending */}
          <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-orange-400 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Pending</span>
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.pending}</p>
            <p className="text-xs text-slate-400 mt-1">Need Attention</p>
          </div>

          {/* Processing */}
          <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-blue-500 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Processing</span>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.processing}</p>
            <p className="text-xs text-slate-400 mt-1">In progress</p>
          </div>

          {/* On Hold */}
          <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-rose-500 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">On Hold</span>
              <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="10" y1="15" x2="10" y2="9" />
                <line x1="14" y1="15" x2="14" y2="9" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.onHold}</p>
            <p className="text-xs text-slate-400 mt-1">Requires Review</p>
          </div>

          {/* For Release */}
          <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-emerald-500 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">For Release</span>
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.forRelease}</p>
            <p className="text-xs text-slate-400 mt-1">Ready for Pickup</p>
          </div>

          {/* Completed Today */}
          <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-teal-600 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Completed Today</span>
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.completed}</p>
            <p className="text-xs text-slate-400 mt-1">Released</p>
          </div>
        </div>

        {/* Section 3: Predicted Insight this week */}
        <div className="bg-[#DDE3FF] rounded-2xl p-6 border border-[#C5D0FF] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#BAC7FF] flex items-center justify-center text-[#2A3CB8] shrink-0 shadow-2xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04zm5 0A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0A0A7C]">Predicted Insight this week</h3>
          </div>

          <div className="bg-[#7084D8]/85 rounded-xl p-5 text-white shadow-xs mt-3.5 space-y-2 text-xs sm:text-sm font-normal">
            {metrics.total > 0 ? (
              <>
                <p className="flex items-start gap-2">
                  <span className="text-white text-base leading-none">•</span>
                  <span>
                    Current registrar workload: <strong className="font-bold text-white">{metrics.total} total {metrics.total === 1 ? 'request' : 'requests'}</strong> ({metrics.pending} pending review, {metrics.processing} in progress).
                  </span>
                </p>
                {targetedSection.cards.length > 0 && (
                  <p className="flex items-start gap-2">
                    <span className="text-white text-base leading-none">•</span>
                    <span>
                      Primary requested document: <strong className="font-bold text-white">{targetedSection.topDocName}</strong> ({targetedSection.cards[0].count} {targetedSection.cards[0].count === 1 ? 'copy' : 'copies'} requested).
                    </span>
                  </p>
                )}
                <p className="flex items-start gap-2">
                  <span className="text-white text-base leading-none">•</span>
                  <span>
                    Ready for collection: <strong className="font-bold text-white">{metrics.forRelease} {metrics.forRelease === 1 ? 'document' : 'documents'}</strong> ready for release.
                  </span>
                </p>
              </>
            ) : (
              <p className="flex items-start gap-2">
                <span className="text-white text-base leading-none">•</span>
                <span>
                  No document requests currently in the pipeline. New student submissions will appear here automatically.
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Section 4: Calendar (Weekly Schedule) */}
        <div id="calendar" className="bg-[#EAF0FE] rounded-2xl p-6 border border-[#D5E0FA] shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                  <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                  <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full">
                    {calendarHeaderLabel.range}
                  </span>
                  {selectedCalendarDate && (
                    <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
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
                <h3 className="text-xl font-bold text-slate-900 mt-1">Calendar & Schedule</h3>
              </div>
            </div>

            {/* Navigation buttons: Previous week, Today, Next week */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer active:scale-95"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 ${
                  currentWeekOffset === 0
                    ? 'bg-[#000080] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer active:scale-95"
                title="Next Week"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* 7-Day Calendar Grid */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs mt-5">
            {/* Calendar Table Header */}
            <div className="grid grid-cols-7 bg-[#C7D7FE] border-b border-slate-200 text-center">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                <div key={day} className="py-2.5 font-bold text-xs text-[#0A0A7C] border-r last:border-r-0 border-slate-300/60 truncate px-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-slate-200 min-h-[175px]">
              {currentWeekDays.map((d) => {
                const isSelected = selectedCalendarDate === d.dateStr;
                return (
                  <div
                    key={d.dateStr}
                    onClick={() => setSelectedCalendarDate((prev) => (prev === d.dateStr ? null : d.dateStr))}
                    className={`p-2 sm:p-2.5 flex flex-col justify-between cursor-pointer transition-all hover:bg-blue-50/50 select-none ${
                      isSelected
                        ? 'bg-blue-100/60 ring-2 ring-inset ring-[#000080]'
                        : d.isToday
                        ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-400/50'
                        : ''
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
                          {/* Completion percentage is only displayed on the expected release date of the batch */}
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
                          {/* Expected release date is reserved for releasing documents only */}
                          {d.isReleaseDate && (
                            <div
                              className="bg-[#DCFCE7] text-[#15803D] p-1 rounded font-medium truncate"
                              title={`Release document from: ${d.relTargetStr}`}
                            >
                              Release document from: {d.relTargetStr}
                            </div>
                          )}
                          {/* Scheduled processing requests divided across processing days */}
                          {d.proc > 0 && (
                            <div className="bg-[#E0F2FE] text-[#0369A1] p-1 rounded font-medium flex justify-between">
                              <span>Process document:</span>
                              <strong className="font-bold">{d.proc}</strong>
                            </div>
                          )}
                          {/* New requests received today */}
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

                    {/* Completion bar is only visible on the batch's expected release date */}
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

            {/* Dynamic Full Month Grid when expanded */}
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
                  {fullMonthWeeks.map((week, wIdx) =>
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
                              ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-2xs'
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

          {/* Toggle View All button */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
              className="text-[#0A0A7C] font-bold text-sm flex items-center gap-1 hover:underline cursor-pointer transition-all"
            >
              <span>{isCalendarExpanded ? 'Show Current Week' : 'View Full Month'}</span>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${isCalendarExpanded ? 'rotate-180' : ''}`}
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

        {/* Section 5: Requests Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900">Requests</h3>
                {selectedCalendarDate && (
                  <span className="text-xs bg-blue-100 text-[#000080] px-2.5 py-0.5 rounded-full font-bold">
                    Filtered: {selectedCalendarDate}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedCalendarDate
                  ? `Showing requests matching ${selectedCalendarDate} (${displayedRequests.length} found)`
                  : 'Latest document requests from students'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedCalendarDate && (
                <button
                  type="button"
                  onClick={() => setSelectedCalendarDate(null)}
                  className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear Filter
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate(ROUTES.STAFF.REQUESTS)}
                className="px-5 py-2 rounded-lg bg-[#000080] hover:bg-[#000066] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                View All
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Request Date</th>
                  <th className="py-3 px-4">Release Date</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedRequests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 text-xs font-medium">
                      No document requests found.
                    </td>
                  </tr>
                ) : (
                  displayedRequests.slice(0, 5).map((req) => (
                    <tr key={req.id || req.tracking_number} className="hover:bg-slate-50/70 transition-colors">
                      {/* Request ID */}
                      <td className="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {req.tracking_number}
                      </td>

                      {/* Student */}
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-900 leading-tight">{req.student_name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{req.student_id}</p>
                      </td>

                      {/* Document Type */}
                      <td className="py-4 px-4">
                        <p className="text-slate-800 font-medium">{req.document_type}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {req.copies} {req.copies > 1 ? 'copies' : 'copy'}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {getStatusBadge(req.status)}
                      </td>

                      {/* Request Date */}
                      <td className="py-4 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {req.request_date}
                      </td>

                      {/* Release Date */}
                      <td className="py-4 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {req.release_date}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenRequestModal(req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
      </div>

      {/* Staff Process Modal for inspecting request details & updating status */}
      {modalRequest && (
        <StaffProcessModal
          selectedRequest={modalRequest.raw || modalRequest}
          newStatus={modalStatus}
          setNewStatus={setModalStatus}
          notes={modalNotes}
          setNotes={setModalNotes}
          updating={modalUpdating}
          onUpdateStatus={handleSaveStatus}
          onBackToList={handleCloseRequestModal}
          requestStatuses={['Pending', 'Processing', 'For Release', 'Claimed', 'On Hold']}
          getStatusBadge={getStatusBadge}
        />
      )}
    </div>
  );
}
