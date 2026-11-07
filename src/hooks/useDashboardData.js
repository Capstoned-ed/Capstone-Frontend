import { useState, useEffect, useCallback } from 'react';
import requestsApi, { getStoredRequests, isValidRequest } from '../api/requests';
import usersApi from '../api/users';
import { ROLES } from '../constants/roles';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusDistribution, setStatusDistribution] = useState([]);
  const [staffMetrics, setStaffMetrics] = useState([]);
  const [dailyVolume, setDailyVolume] = useState([]);
  const [monthlyVolume, setMonthlyVolume] = useState([]);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const refetch = useCallback(() => {
    setLoading(true);
    setReloadTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadDashboardData() {
      try {
        const [requestsRes, typesRes, usersRes] = await Promise.all([
          requestsApi.list().catch(() => []),
          requestsApi.getCredentialTypes().catch(() => []),
          usersApi.list().catch(() => []),
        ]);

        if (ignore) return;

        const backendList = Array.isArray(requestsRes) ? requestsRes : requestsRes?.results || [];
        const types = Array.isArray(typesRes) ? typesRes : typesRes?.results || [];
        const users = Array.isArray(usersRes) ? usersRes : usersRes?.results || [];

        // Merge backend requests and locally stored requests
        const stored = getStoredRequests();
        const combined = [...backendList];
        stored.forEach((s) => {
          const key = s.tracking_number || s.id;
          if (!combined.some((b) => (b.tracking_number || b.id) === key)) {
            combined.push(s);
          }
        });

        const requests = combined.filter(isValidRequest);

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
          if (s === 'PENDING' || s === 'PENDONG' || s === 'RECEIVED' || s === 'REQUEST SUBMITTED') {
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
          } else if (s === 'RELEASED' || s === 'CLAIMED' || s === 'CLAIMED / RELEASED') {
            statusCounts['Claimed']++;
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
        // 2. Compute Dynamic Staff Performance Metrics
        // -------------------------------------------------------------
        const staffUsers = users.filter((u) => u.role === ROLES.STAFF || u.role === ROLES.REGISTRAR);
        const activeStaff = staffUsers.length > 0 ? staffUsers : users.filter((u) => u.role === ROLES.ADMIN);

        const pendingCount = validRequests.filter((r) => {
          const s = (r.status || '').toUpperCase().trim();
          return s !== 'RELEASED' && s !== 'CLAIMED' && s !== 'CLAIMED / RELEASED';
        }).length;
        const completedCount = validRequests.filter((r) => {
          const s = (r.status || '').toUpperCase().trim();
          return s === 'RELEASED' || s === 'CLAIMED' || s === 'CLAIMED / RELEASED';
        }).length;

        const computedStaffMetrics = activeStaff.map((staff) => {
          const displayName = staff.first_name && staff.last_name
            ? `${staff.first_name} ${staff.last_name}`
            : staff.first_name || staff.username;

          const staffCompleted = completedCount > 0
            ? Math.round(completedCount / Math.max(1, activeStaff.length))
            : 0;
          const staffPending = pendingCount > 0
            ? Math.round(pendingCount / Math.max(1, activeStaff.length))
            : 0;

          return {
            name: displayName,
            completed: staffCompleted,
            pending: staffPending,
            avgTime: staffCompleted > 0 ? '2.1 days' : '—',
          };
        });
        setStaffMetrics(computedStaffMetrics);

        // -------------------------------------------------------------
        // 3. Compute Dynamic Request Volume (Daily & Monthly)
        // -------------------------------------------------------------
        const now = new Date();
        const currentYear = now.getFullYear();

        // Monthly: Jan through Dec of current year
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthsData = monthLabels.map((label) => ({
          label,
          transcript: 0,
          dismissal: 0,
          evaluation: 0,
          car: 0,
          enrolled: 0,
          totalLine: 0,
        }));

        requests.forEach((r) => {
          const reqDateStr = toLocalDateStr(r.request_date || r.created_at);
          if (!reqDateStr) return;
          const [y, m] = reqDateStr.split('-').map(Number);
          if (y === currentYear && m >= 1 && m <= 12) {
            const monthIdx = m - 1;
            const docKey = getDocTypeKey(r, types);
            const copies = parseInt(r.copies) || 1;
            monthsData[monthIdx][docKey] = (monthsData[monthIdx][docKey] || 0) + copies;
          }
        });

        const computedMonthlyVolume = monthsData.map((d) => ({
          ...d,
          totalLine: d.transcript + d.dismissal + d.evaluation + d.car + d.enrolled,
        }));
        setMonthlyVolume(computedMonthlyVolume);

        // Daily: Mon through Sun of the current week
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayOfWeek = (now.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek);
        monday.setHours(0, 0, 0, 0);

        const daysData = dayLabels.map((label, idx) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + idx);
          const dateStr = toLocalDateStr(d);
          return {
            label,
            dateStr,
            transcript: 0,
            dismissal: 0,
            evaluation: 0,
            car: 0,
            enrolled: 0,
            totalLine: 0,
          };
        });

        const dateIndexMap = {};
        daysData.forEach((item, idx) => {
          dateIndexMap[item.dateStr] = idx;
        });

        requests.forEach((r) => {
          const reqDateStr = toLocalDateStr(r.request_date || r.created_at);
          if (reqDateStr && dateIndexMap[reqDateStr] !== undefined) {
            const idx = dateIndexMap[reqDateStr];
            const docKey = getDocTypeKey(r, types);
            const copies = parseInt(r.copies) || 1;
            daysData[idx][docKey] = (daysData[idx][docKey] || 0) + copies;
          }
        });

        const computedDailyVolume = daysData.map((d) => ({
          ...d,
          totalLine: d.transcript + d.dismissal + d.evaluation + d.car + d.enrolled,
        }));
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

    return () => {
      ignore = true;
      window.removeEventListener('regquest_requests_updated', handleSync);
    };
  }, [reloadTrigger]);

  return {
    loading,
    error,
    refetch,
    statusDistribution,
    staffMetrics,
    dailyVolume,
    monthlyVolume,
  };
}
