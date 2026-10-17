import React, { useState, useEffect, useCallback } from 'react';
import requestsApi, { getStoredRequests } from '../../api/requests';
import usersApi from '../../api/users';
import clearancesApi from '../../api/clearances';
import ProcessCalendarCard from '../../components/calendar/ProcessCalendarCard';
import '../../styles/staff/ProcessingCalendar.css';

// Helper to safely convert an ISO string, Date object, or date string into local YYYY-MM-DD
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

function addDaysToDateStr(dateStr, numDays) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + numDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

function calculateReleaseDate(createdAt, processingDays = 5) {
  if (!createdAt) return 'N/A';
  const reqDate = toLocalDateStr(createdAt);
  if (!reqDate) return 'N/A';
  return addDaysToDateStr(reqDate, Number(processingDays) || 5);
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

export default function ProcessingCalendarPage() {
  const [requestsList, setRequestsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Comprehensive Data Fetcher
  const loadData = useCallback(async () => {
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
        const enriched = combinedRaw.map((r, idx) => {
          const userObj = userMap.get(r.user) || userMap.get(r.student_id);
          const cred = credMap.get(r.credential_type) || credMap.get(r.credential);
          const p = profiles[r.user] || profiles[r.student_id] || (userObj ? profiles[userObj.id] : null) || {};

          const studentName =
            p.full_name ||
            (userObj ? [userObj.first_name, userObj.last_name].filter(Boolean).join(' ') : null) ||
            r.student_name ||
            `Student #${r.user || idx + 1}`;

          const studentId = p.student_id || r.student_id || userObj?.username || userObj?.student_id || '—';
          const docType = r.document_type || cred?.name || r.credential_name || 'Document Request';
          const copiesNum = parseInt(r.copies) || 1;
          const reqDate = toLocalDateStr(r.created_at) || toLocalDateStr(r.request_date) || toLocalDateStr(new Date());
          const relDate = r.release_date ? toLocalDateStr(r.release_date) : calculateReleaseDate(reqDate, cred?.processing_days);

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
      console.warn('Calendar page data load notice:', err);
      setRequestsList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleSync = () => {
      loadData();
    };

    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_profile_updated', handleSync);
    return () => {
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_profile_updated', handleSync);
    };
  }, [loadData]);

  if (loading) {
    return (
      <div className="processing-calendar-loading">
        <div className="calendar-loading-inner">
          <div className="calendar-spinner" />
          <p className="calendar-loading-text">Loading processing calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="processing-calendar-page">
      {/* Reusable ProcessCalendarCard matching reference photo */}
      <ProcessCalendarCard
        requests={requestsList}
        showActiveBatches={true}
      />
    </div>
  );
}
