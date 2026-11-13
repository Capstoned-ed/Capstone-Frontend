import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import ustpBuilding from '../../assets/USTP.png';
import PredictedInsightCard from '../../components/admin/PredictedInsightCard';
import RequestVolumeCard from '../../components/admin/RequestVolumeCard';
import useDashboardData from '../../hooks/useDashboardData';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import requestsApi, {
  isValidRequest,
  sortRequestsNewestFirst,
  resolveRequestDocType,
  setRequestArchived,
  getArchivedRequestsMap,
  isRequestArchived,
  logProcessedAction,
} from '../../api/requests';
import usersApi from '../../api/users';
import clearancesApi, { getClearanceAttachment } from '../../api/clearances';
import ProcessRequestModal from '../../components/admin/ProcessRequestModal';
import '../../styles/admin/AdminDashboard.css';
import '../../styles/admin/AdminRequestsPage.css';
import '../../styles/staff/StaffRequestsPage.css';

const isClaimedStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  return s === 'claimed' || s.includes('claim');
};

function calculateReleaseDate(createdAt, processingDays = 5) {
  if (!createdAt) return 'N/A';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return 'N/A';
  d.setDate(d.getDate() + (Number(processingDays) || 5));
  return d.toISOString().split('T')[0];
}

function formatCopies(rawCopies, fallback = 1) {
  if (!rawCopies) {
    const fb = Number(fallback) || 1;
    return `${fb} ${fb > 1 ? 'copies' : 'copy'}`;
  }
  const s = String(rawCopies).trim();
  if (/^\d+\s*cop(y|ies)$/i.test(s)) {
    return s;
  }
  const parsed = parseInt(s, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return '1 copy';
  }
  return `${parsed} ${parsed > 1 ? 'copies' : 'copy'}`;
}

function formatStatusDisplay(rawStatus) {
  if (!rawStatus) return 'Pending';
  const s = String(rawStatus).trim();
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
      return 'On Hold';
    case 'CANCELLED':
    case 'REJECTED':
      return 'Rejected';
    default:
      return s;
  }
}

function getStatusBadge(status) {
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
      return <span className="status-pill pending">{s || 'Pending'}</span>;
  }
}

export default function RegistrarDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const {
    loading,
    statusDistribution,
    staffMetrics,
    dailyVolume,
    monthlyVolume,
  } = useDashboardData();

  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processModalOpen, setProcessModalOpen] = useState(false);
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
    setRequestArchived(reqId, true, user, { fallbackItem: item });
    setArchivedMap(getArchivedRequestsMap());
    logProcessedAction({
      actor: user?.username,
      actorName: user?.full_name || user?.username,
      actorId: user?.id,
      actorRole: user?.role || 'registrar',
      targetName: item.student_name,
      targetId: item.student_id || reqId,
      trackingNumber: item.tracking_number || reqId,
      documentType: item.document_type,
      action: 'Document claimed by student: Moved to History',
      status: 'Claimed',
    });
    toast.success(`Request ${item.id || reqId} marked as Done and moved to Request History.`);
  };

  const activeRequests = useMemo(() => {
    return requests.filter((r) => !isRequestArchived(r, archivedMap));
  }, [requests, archivedMap]);

  const handleOpenProcess = (req) => {
    setSelectedRequest(req);
    setProcessModalOpen(true);
  };

  const handleRequestUpdated = (updatedReq) => {
    setArchivedMap(getArchivedRequestsMap());
    setRequests((prev) =>
      prev.map((r) =>
        String(r.rawId || r.id) === String(updatedReq.rawId || updatedReq.id) ||
        String(r.tracking_number) === String(updatedReq.tracking_number || updatedReq.id)
          ? {
              ...r,
              ...updatedReq,
              status: formatStatusDisplay(updatedReq.status),
            }
          : r
      )
    );
  };

  useEffect(() => {
    let ignore = false;
    async function loadRequests() {
      try {
        const [requestsRes, credTypesRes, usersRes, clearancesRes] = await Promise.all([
          requestsApi.list().catch(() => []),
          requestsApi.getCredentialTypes().catch(() => []),
          usersApi.list().catch(() => []),
          clearancesApi.list().catch(() => []),
        ]);

        if (ignore) return;

        const rawList = Array.isArray(requestsRes) ? requestsRes : requestsRes?.results || [];
        const credList = Array.isArray(credTypesRes) ? credTypesRes : credTypesRes?.results || [];
        const userList = Array.isArray(usersRes) ? usersRes : usersRes?.results || [];
        const clearanceList = Array.isArray(clearancesRes) ? clearancesRes : clearancesRes?.results || [];

        const userMap = new Map();
        userList.forEach((u) => userMap.set(u.id, u));

        const credMap = new Map();
        credList.forEach((c) => credMap.set(c.id, c));

        const clearanceMap = new Map();
        clearanceList.forEach((c) => {
          const uId = typeof c.user === 'object' ? c.user?.id : c.user;
          if (uId) {
            clearanceMap.set(uId, c);
            clearanceMap.set(String(uId), c);
          }
          if (c.student_id) clearanceMap.set(c.student_id, c);
          if (c.username) clearanceMap.set(c.username, c);
          if (c.id) clearanceMap.set(c.id, c);
        });

        const parsed = rawList
          .filter(isValidRequest)
          .map((r) => {
            const user = userMap.get(r.user);
            const studentUser = typeof r.student === 'object' && r.student !== null
              ? r.student
              : user;

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

            const studentName =
              r.student_name ||
              r.student_full_name ||
              studentUser?.full_name ||
              (studentUser?.first_name ? `${studentUser.first_name} ${studentUser.last_name || ''}`.trim() : null) ||
              'Student';

            const studentId =
              r.student_id ||
              r.student_id_number ||
              studentUser?.student_id ||
              studentUser?.id_number ||
              studentUser?.username ||
              'N/A';

            const credType =
              r.credential_type_details ||
              (r.credential_type ? credMap.get(r.credential_type) : null);

            const docName = resolveRequestDocType(r, credType);

            const copiesStr = formatCopies(r.copies || r.number_of_copies);
            const requestDate = r.request_date || (r.created_at ? r.created_at.split('T')[0] : 'N/A');
            const releaseDate =
              r.date_of_release ||
              r.release_date ||
              calculateReleaseDate(r.created_at, credType?.processing_days || 5);

            const effectiveRawStatus =
              matchedStored?.status && String(matchedStored.status).toUpperCase() !== 'PENDING'
                ? matchedStored.status
                : r.status;

            return {
              rawId: r.id,
              id: r.tracking_number || (r.id ? `REQ-${r.id}` : 'N/A'),
              tracking_number: r.tracking_number || (r.id ? `REQ-${r.id}` : 'N/A'),
              user: r.user,
              student_name: studentName,
              student_id: studentId,
              document_type: docName,
              copies: copiesStr,
              status: formatStatusDisplay(effectiveRawStatus),
              rawStatus: effectiveRawStatus,
              batch_status: formatStatusDisplay(effectiveRawStatus),
              request_date: requestDate,
              release_date: releaseDate,
              date_of_release: releaseDate,
              amount: r.amount || credType?.fee || '100.00',
              assessed_amount: matchedStored?.assessed_amount || r.assessed_amount || r.amount || '100.00',
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
              created_at: r.created_at,
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

        setRequests(parsed);
      } catch (err) {
        console.error('Failed to load registrar dashboard requests:', err);
      } finally {
        if (!ignore) {
          setRequestsLoading(false);
        }
      }
    }

    loadRequests();

    const handleSync = () => {
      loadRequests();
    };
    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_assignments_updated', handleSync);
    window.addEventListener('regquest_activity_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      ignore = true;
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_assignments_updated', handleSync);
      window.removeEventListener('regquest_activity_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  return (
    <div className="admin-dashboard-wrapper">
      {/* Top Banner with USTP Building & Gradient Overlay */}
      <div className="admin-banner">
        {/* USTP Building architectural overlay on the right */}
        <div className="admin-banner-overlay">
          <img
            src={ustpBuilding}
            alt="USTP Architecture"
            className="admin-banner-img"
          />
          {/* Soft fading gradient over the image */}
          <div className="admin-banner-fade" />
        </div>

        {/* Banner Text Content */}
        <div className="admin-banner-content">
          <h1 className="admin-banner-title">
            Registrar{' '}
            <span className="admin-banner-title-highlight">Dashboard</span>
          </h1>
          <p className="admin-banner-subtitle">
            Manage requests, approvals, and operations
          </p>
        </div>
      </div>

      {/* Main Dashboard Content Stream */}
      <div className="admin-dashboard-content">
        {/* Section 1: Predicted Insight this week */}
        <PredictedInsightCard />

        {/* Section 2: Request Logs & Reports */}
        <section id="reports" className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">
              Request Logs &amp; Reports
            </h2>
            <p className="admin-section-subtitle">
              Transaction logs and historical analysis
            </p>
          </div>

          <div className="admin-reports-grid">
            {/* Status Distribution Card */}
            <div className="admin-card">
              <div>
                <div className="admin-card-header">
                  <svg className="admin-card-header-icon" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <h3 className="admin-card-title">
                    Status Distribution
                  </h3>
                </div>

                {loading ? (
                  <div className="space-y-4 py-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <div className="h-3.5 admin-skeleton-pulse w-32" />
                          <div className="h-3 admin-skeleton-pulse w-14" />
                        </div>
                        <div className="h-2 admin-skeleton-pulse w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : statusDistribution.length === 0 ? (
                  <div className="admin-card-empty">
                    No status distribution records available.
                  </div>
                ) : (
                  <div className="status-dist-list">
                    {statusDistribution.map((item) => (
                      <div key={item.label} className="status-dist-item">
                        <div className="status-dist-info">
                          <span>{item.label}</span>
                          <span className="status-dist-meta">
                            {item.count} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="status-dist-track">
                          <div
                            className="status-dist-fill"
                            style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Staff Performance Metrics Card */}
            <div className="admin-card">
              <div>
                <div className="admin-card-header-stacked">
                  <h3 className="admin-card-title">
                    Staff Performance Metrics
                  </h3>
                  <p className="admin-card-subtitle">
                    Productivity analysis
                  </p>
                </div>

                {loading ? (
                  <div className="space-y-3 py-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="admin-skeleton-row">
                        <div className="h-4 admin-skeleton-pulse w-28" />
                        <div className="h-4 admin-skeleton-pulse w-10" />
                        <div className="h-4 admin-skeleton-pulse w-10" />
                        <div className="h-4 admin-skeleton-pulse w-16" />
                      </div>
                    ))}
                  </div>
                ) : staffMetrics.length === 0 ? (
                  <div className="admin-card-empty">
                    No active staff performance metrics found.
                  </div>
                ) : (
                  <div className="staff-table-scroll">
                    <table className="staff-table">
                      <thead>
                        <tr className="staff-table-head-row">
                          <th className="staff-table-th left">Staff Members</th>
                          <th className="staff-table-th center">Completed</th>
                          <th className="staff-table-th center">For Processing</th>
                          <th className="staff-table-th center">Processing</th>
                          <th className="staff-table-th center">Pending</th>
                        </tr>
                      </thead>
                      <tbody className="staff-table-tbody">
                        {staffMetrics.map((staff) => (
                          <tr key={staff.name} className="staff-table-row">
                            <td className="staff-table-name">
                              {staff.name}
                            </td>
                            <td className="staff-table-completed">
                              {staff.completed}
                            </td>
                            <td className="staff-table-pending">
                              {staff.forProcessing ?? 0}
                            </td>
                            <td className="staff-table-pending">
                              {staff.processing ?? 0}
                            </td>
                            <td className="staff-table-pending">
                              {staff.pending}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Request Volume */}
        <section id="volume">
          <RequestVolumeCard
            dailyData={dailyVolume}
            monthlyData={monthlyVolume}
            loading={loading}
            viewMoreRoute={ROUTES.REGISTRAR.ANALYTICS}
          />
        </section>

        {/* Section 4: Requests Card (Latest 5 Requests with "See More" leading to Batch Staff Assignment) */}
        <section id="requests" className="admin-section">
          <div className="requests-list-card">
            <div className="requests-list-header">
              <h3 className="requests-list-title">Requests</h3>
              <p className="requests-list-subtitle">
                Review and manage latest document requests from students
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
                  {requestsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                        Loading requests...
                      </td>
                    </tr>
                  ) : activeRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                        No active student requests found.
                      </td>
                    </tr>
                  ) : (
                    activeRequests.slice(0, 5).map((item) => (
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
                            <button
                              type="button"
                              onClick={() => handleOpenProcess(item)}
                              className="btn-view-req"
                              title="View Request Details"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="3" strokeWidth={2} />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
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

            {!requestsLoading && activeRequests.length > 5 && (
              <div className="table-see-more-wrap">
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.REGISTRAR.REQUESTS)}
                  className="table-see-more-btn"
                >
                  <span>See More</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Process/View Request Modal identical to requests view */}
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
