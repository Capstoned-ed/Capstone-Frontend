import { useState, useEffect, useCallback } from 'react';
import requestsApi, {
  isValidRequest,
  isRequestAssignedToUser,
  extractDocumentItems,
} from '../api/requests';
import usersApi from '../api/users';
import { ROLES } from '../constants/roles';
import { useAuth } from './useAuth';

const DASHBOARD_SERIES_PALETTE = [
  '#001FD1',
  '#EAB308',
  '#F97316',
  '#10B981',
  '#7088FF',
  '#8B5CF6',
  '#06B6D4',
  '#EF4444',
  '#EC4899',
  '#14B8A6',
  '#6366F1',
  '#84CC16',
];

function toSeriesKey(label) {
  return String(label || 'other')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'other';
}

function toShortSeriesLabel(label) {
  const s = String(label || '').trim();
  if (/transcript/i.test(s)) return 'TOR';
  if (/honorable|dismissal/i.test(s)) return 'Dismissal';
  if (/evaluation/i.test(s)) return 'Evaluation';
  if (/authentication/i.test(s)) return 'Auth';
  if (/officially\s*enrolled/i.test(s)) return 'Enrolled';
  if (s.length > 18) return `${s.slice(0, 16)}…`;
  return s;
}

function isCompletedRequest(r) {
  if (!r) return false;
  const s = (r.status || '').toUpperCase().trim();
  const raw = (r.rawStatus || '').toUpperCase().trim();
  return (
    s === 'RELEASED' ||
    raw === 'RELEASED' ||
    s.includes('CLAIM') ||
    s === 'COMPLETED' ||
    s === 'DONE'
  );
}

function isForProcessingRequest(r) {
  if (!r) return false;
  const s = (r.status || '').toUpperCase().trim();
  return (
    s === 'FOR PROCESSING' ||
    s === 'FOR_PROCESSING' ||
    s === 'PAYMENT_VERIFIED' ||
    s === 'PAYMENT VERIFIED'
  );
}

function isProcessingRequest(r) {
  if (!r) return false;
  if (isForProcessingRequest(r)) return false;
  const s = (r.status || '').toUpperCase().trim();
  return (
    s === 'PROCESSING' ||
    s.includes('PREPARATION') ||
    s.includes('RELEASE') ||
    s.includes('PICKUP') ||
    s.includes('READY')
  );
}

// Safely convert an ISO string, Date object, or date string into local YYYY-MM-DD
function toLocalDateStr(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return typeof val === 'string' ? val.split('T')[0] : '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

// Dynamically map each request to its corresponding document type key
function getDocTypeKey(req, credTypes = []) {
  const credId = req.credential_type || req.credential;
  const cred = credTypes.find(
    (c) => c.id === credId || c.code === credId || String(c.id) === String(credId)
  );
  const code = (cred?.code || req.document_type || req.credential_name || '').toUpperCase();
  const name = (cred?.name || req.document_type || req.credential_name || '').toUpperCase();

  if (code === 'TOR' || code.includes('TOR') || name.includes('TRANSCRIPT')) return 'transcript';
  if (code === 'HD' || code.includes('HD') || name.includes('HONORABLE') || name.includes('DISMISSAL')) return 'dismissal';
  if (code === 'EVAL' || code.includes('EVAL') || name.includes('EVALUATION')) return 'evaluation';
  if (code === 'CAR' || code.includes('CAR') || name.includes('CERTIFICATE OF ACADEMIC')) return 'car';
  if (
    code === 'COE' ||
    code.includes('COE') ||
    code.includes('ENR') ||
    name.includes('ENROLL') ||
    name.includes('OFFICIALLY')
  ) {
    return 'enrolled';
  }

  return 'transcript';
}

export default function useDashboardData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusDistribution, setStatusDistribution] = useState([]);
  const [staffMetrics, setStaffMetrics] = useState([]);
  const [dailyVolume, setDailyVolume] = useState([]);
  const [monthlyVolume, setMonthlyVolume] = useState([]);
  const [volumeSeries, setVolumeSeries] = useState([]);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const refetch = useCallback(() => {
    setLoading(true);
    setReloadTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!user) return;
    let ignore = false;

    async function loadDashboardData() {
      try {
        setError(null);
        const [requestsRes, typesRes, usersRes] = await Promise.all([
          requestsApi.list().catch((err) => {
            console.warn('Dashboard requestsApi.list error:', err);
            return [];
          }),
          requestsApi.getCredentialTypes().catch((err) => {
            console.warn('Dashboard getCredentialTypes error:', err);
            return [];
          }),
          usersApi.getStaffDirectory().catch((err) => {
            console.warn('Dashboard getStaffDirectory error:', err);
            return [];
          }),
        ]);

        if (ignore) return;

        const backendList = Array.isArray(requestsRes) ? requestsRes : requestsRes?.results || [];
        const types = Array.isArray(typesRes) ? typesRes : typesRes?.results || [];
        const users = Array.isArray(usersRes) ? usersRes : usersRes?.results || [];

        // Use live backend requests directly
        const requests = backendList.filter(isValidRequest);

        // -------------------------------------------------------------
        // 1. Compute Dynamic Status Distribution
        // -------------------------------------------------------------
        const validRequests = requests.filter((r) => Boolean(String(r.tracking_number || r.id || '').trim()));
        const totalRequests = validRequests.length;
        const statusCounts = {
          'Pending': 0,
          'For Payment': 0,
          'For Processing': 0,
          'Processing': 0,
          'For release': 0,
          'Claimed': 0,
          'On Hold': 0,
        };

        validRequests.forEach((req) => {
          const s = (req.status || '').toUpperCase().trim();
          if (isCompletedRequest(req)) {
            statusCounts['Claimed']++;
          } else if (s === 'PENDING' || s === 'PENDONG' || s === 'RECEIVED' || s === 'REQUEST SUBMITTED') {
            statusCounts['Pending']++;
          } else if (
            s === 'FOR PAYMENT' ||
            s === 'FOR_PAYMENT' ||
            s === 'PAYMENT_PENDING' ||
            s === 'PAYMENT PENDING' ||
            s === 'PENDING PAYMENT' ||
            s === 'PENDING_PAYMENT' ||
            s === 'CLEARED FOR PAYMENT'
          ) {
            statusCounts['For Payment']++;
          } else if (
            s === 'FOR PROCESSING' ||
            s === 'FOR_PROCESSING' ||
            s === 'PAYMENT_VERIFIED' ||
            s === 'PAYMENT VERIFIED'
          ) {
            statusCounts['For Processing']++;
          } else if (s === 'PROCESSING' || s === 'DOCUMENT_PREPARATION' || s === 'DOCUMENT PREPARATION') {
            statusCounts['Processing']++;
          } else if (
            s === 'READY_FOR_RELEASE' ||
            s === 'READY FOR RELEASE' ||
            s === 'READY_FOR_PICKUP' ||
            s === 'READY FOR PICKUP' ||
            s === 'FOR_RELEASE' ||
            s === 'FOR RELEASE' ||
            s === 'RELEASING'
          ) {
            statusCounts['For release']++;
          } else if (
            s === 'REQUIREMENTS_VERIFICATION' ||
            s === 'CLEARANCE_VERIFIED' ||
            s === 'ON HOLD' ||
            s === 'ON_HOLD' ||
            s === 'HOLD' ||
            s === 'CANCELLED' ||
            s === 'REJECTED' ||
            s === 'REQUIREMENTS_REJECTED'
          ) {
            statusCounts['On Hold']++;
          } else {
            statusCounts['Pending']++;
          }
        });

        const computedStatusDistribution = Object.entries(statusCounts).map(([label, count]) => ({
          label,
          count,
          percentage: totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0,
        }));
        setStatusDistribution(computedStatusDistribution);

        // -------------------------------------------------------------
        // 2. Compute Dynamic Staff Performance Metrics (strictly STAFF role, sorted descending)
        // -------------------------------------------------------------
        const staffUsers = users.filter((u) => {
          const r = String(u.role || '').toLowerCase();
          return r === ROLES.STAFF || r === 'staff';
        });

        const computedStaffMetrics = staffUsers.map((staff) => {
          const displayName = staff.first_name && staff.last_name
            ? `${staff.first_name} ${staff.last_name}`
            : staff.full_name || staff.first_name || staff.username;

          // Match strictly against live PostgreSQL assigned_to / assigned_staff (zero localStorage dependency)
          const staffReqs = validRequests.filter((r) =>
            isRequestAssignedToUser(r, staff, {}, users)
          );

          const completedReqs = staffReqs.filter((r) => isCompletedRequest(r));
          const staffCompleted = completedReqs.length;
          const remainingReqs = staffReqs.filter((r) => !isCompletedRequest(r));
          const staffForProcessing = remainingReqs.filter((r) => isForProcessingRequest(r)).length;
          const staffProcessing = remainingReqs.filter((r) => isProcessingRequest(r)).length;
          const staffPending = remainingReqs.filter(
            (r) => !isForProcessingRequest(r) && !isProcessingRequest(r)
          ).length;

          return {
            name: displayName,
            completed: staffCompleted,
            forProcessing: staffForProcessing,
            processing: staffProcessing,
            pending: staffPending,
          };
        }).sort((a, b) => {
          // Sort descending: highest completed first, then highest total workload
          if (b.completed !== a.completed) {
            return b.completed - a.completed;
          }
          const bTotal = b.completed + b.forProcessing + b.processing + b.pending;
          const aTotal = a.completed + a.forProcessing + a.processing + a.pending;
          return bTotal - aTotal;
        });

        setStaffMetrics(computedStaffMetrics);

        // -------------------------------------------------------------
        // 3. Compute Dynamic Request Volume (Daily & Monthly) across ALL requested document items
        // -------------------------------------------------------------
        const seriesMap = new Map();
        const getReqDocEntries = (r) => {
          const items = extractDocumentItems(r, types);
          return items.map((it) => {
            const label = String(it.name || 'Other Document').trim();
            const key = toSeriesKey(label);
            if (!seriesMap.has(key)) {
              seriesMap.set(key, {
                key,
                label,
                shortLabel: toShortSeriesLabel(label),
                color: DASHBOARD_SERIES_PALETTE[seriesMap.size % DASHBOARD_SERIES_PALETTE.length],
              });
            }
            return { key, copies: Math.max(1, parseInt(it.copies ?? 1, 10) || 1) };
          });
        };

        // Pre-discover all document series from live requests
        requests.forEach((r) => getReqDocEntries(r));
        const discoveredSeries = Array.from(seriesMap.values());
        setVolumeSeries(discoveredSeries);

        const now = new Date();
        const currentYear = now.getFullYear();

        // Monthly: Jan through Dec of current year (or latest request year if current year has 0)
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const buildMonthly = (targetYear) => {
          const monthsData = monthLabels.map((label) => ({ label, counts: {}, totalLine: 0 }));
          requests.forEach((r) => {
            const reqDateStr = toLocalDateStr(r.created_at || r.request_date);
            if (!reqDateStr) return;
            const [y, m] = reqDateStr.split('-').map(Number);
            if (y === targetYear && m >= 1 && m <= 12) {
              const monthIdx = m - 1;
              getReqDocEntries(r).forEach(({ key, copies }) => {
                monthsData[monthIdx].counts[key] = (monthsData[monthIdx].counts[key] || 0) + copies;
                monthsData[monthIdx][key] = monthsData[monthIdx].counts[key];
                monthsData[monthIdx].totalLine += copies;
              });
            }
          });
          return monthsData;
        };

        let computedMonthlyVolume = buildMonthly(currentYear);
        if (!computedMonthlyVolume.some((m) => m.totalLine > 0) && requests.length > 0) {
          let latestYear = currentYear;
          let latestTs = 0;
          requests.forEach((r) => {
            const ds = toLocalDateStr(r.created_at || r.request_date);
            if (ds) {
              const ts = new Date(`${ds}T12:00:00`).getTime();
              if (!isNaN(ts) && ts > latestTs) {
                latestTs = ts;
                latestYear = Number(ds.split('-')[0]) || currentYear;
              }
            }
          });
          computedMonthlyVolume = buildMonthly(latestYear);
        }
        setMonthlyVolume(computedMonthlyVolume);

        // Daily: Mon through Sun of the current week (or latest request week if current week has 0)
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const buildDaily = (anchorDate) => {
          const dayOfWeek = (anchorDate.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
          const monday = new Date(anchorDate);
          monday.setDate(anchorDate.getDate() - dayOfWeek);
          monday.setHours(0, 0, 0, 0);

          const daysData = dayLabels.map((label, idx) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + idx);
            return { label, dateStr: toLocalDateStr(d), counts: {}, totalLine: 0 };
          });

          const dateIndexMap = {};
          daysData.forEach((item, idx) => {
            dateIndexMap[item.dateStr] = idx;
          });

          requests.forEach((r) => {
            const reqDateStr = toLocalDateStr(r.created_at || r.request_date);
            if (reqDateStr && dateIndexMap[reqDateStr] !== undefined) {
              const idx = dateIndexMap[reqDateStr];
              getReqDocEntries(r).forEach(({ key, copies }) => {
                daysData[idx].counts[key] = (daysData[idx].counts[key] || 0) + copies;
                daysData[idx][key] = daysData[idx].counts[key];
                daysData[idx].totalLine += copies;
              });
            }
          });
          return daysData;
        };

        let computedDailyVolume = buildDaily(now);
        if (!computedDailyVolume.some((d) => d.totalLine > 0) && requests.length > 0) {
          let latestTs = 0;
          requests.forEach((r) => {
            const ds = toLocalDateStr(r.created_at || r.request_date);
            if (ds) {
              const ts = new Date(`${ds}T12:00:00`).getTime();
              if (!isNaN(ts) && ts > latestTs) latestTs = ts;
            }
          });
          if (latestTs > 0) {
            computedDailyVolume = buildDaily(new Date(latestTs));
          }
        }
        setDailyVolume(computedDailyVolume);

        setLoading(false);
      } catch (err) {
        if (ignore) return;
        console.error('Failed to load dashboard dynamic analytics:', err);
        setError('Unable to load dynamic dashboard analytics.');
        setLoading(false);
      }
    }

    loadDashboardData();

    const handleSync = () => {
      loadDashboardData();
    };
    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_users_updated', handleSync);
    window.addEventListener('regquest_assignments_updated', handleSync);
    window.addEventListener('regquest_archived_updated', handleSync);
    window.addEventListener('regquest_staff_assignments_updated', handleSync);

    return () => {
      ignore = true;
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_users_updated', handleSync);
      window.removeEventListener('regquest_assignments_updated', handleSync);
      window.removeEventListener('regquest_archived_updated', handleSync);
      window.removeEventListener('regquest_staff_assignments_updated', handleSync);
    };
  }, [reloadTrigger, user?.id, user?.role]);

  return {
    loading,
    error,
    refetch,
    statusDistribution,
    staffMetrics,
    dailyVolume,
    monthlyVolume,
    volumeSeries,
  };
}
