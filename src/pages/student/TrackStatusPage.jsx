import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import requestsApi from '../../api/requests';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import useToast from '../../hooks/useToast';
import '../../styles/student/TrackStatusPage.css';

const DEFAULT_TIMELINE_STEPS = [
  { id: 'pending', name: 'Pending', label: 'Request Submitted' },
  { id: 'processing', name: 'Processing', label: 'Document Preparation' },
  { id: 'for_release', name: 'For release', label: 'Ready for Release' },
  { id: 'claimed', name: 'Claimed', label: 'Claimed / Released' },
];

function formatStatusDisplay(rawStatus) {
  if (!rawStatus) return 'Pending';
  const s = rawStatus.trim();
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

function calculateReleaseDate(createdAt, processingDays = 5) {
  if (!createdAt) return 'Pending schedule';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return 'Pending schedule';
  d.setDate(d.getDate() + (Number(processingDays) || 5));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TrackStatusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTrackId = searchParams.get('trackId') || '';

  const [rawRequests, setRawRequests] = useState([]);
  const [credentialTypes, setCredentialTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Search input state
  const [searchInput, setSearchInput] = useState(urlTrackId);

  // Load requests and credential types
  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const [requestsRes, credTypesRes] = await Promise.all([
        requestsApi.list().catch(() => []),
        requestsApi.getCredentialTypes().catch(() => []),
      ]);
      setRawRequests(Array.isArray(requestsRes) ? requestsRes : []);
      setCredentialTypes(Array.isArray(credTypesRes) ? credTypesRes : []);
    } catch (err) {
      console.warn('Failed to fetch requests in TrackStatusPage:', err);
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setRefreshing(false);
        toast.info('Status updated with latest records.');
      }
    }
  };

  useEffect(() => {
    fetchData();

    const handleSync = () => {
      fetchData();
    };
    window.addEventListener('regquest_requests_updated', handleSync);

    return () => {
      window.removeEventListener('regquest_requests_updated', handleSync);
    };
  }, []);

  // Sync search input when urlTrackId changes externally
  useEffect(() => {
    if (urlTrackId) {
      setSearchInput(urlTrackId);
    }
  }, [urlTrackId]);

  // Credential Types Lookup Map
  const credTypeMap = useMemo(() => {
    const map = new Map();
    credentialTypes.forEach((c) => map.set(c.id, c));
    return map;
  }, [credentialTypes]);

  // Student's Requests List (filtered for this student if user information is available)
  const studentRequests = useMemo(() => {
    const currentUserId = user?.userId || user?.id;
    const currentStudentId = user?.student_id || user?.username;

    const list = rawRequests.filter((r) => {
      if (!currentUserId && !currentStudentId) return true;
      if (r.user && currentUserId && String(r.user) === String(currentUserId)) return true;
      if (r.student_id && currentStudentId && String(r.student_id) === String(currentStudentId)) return true;
      if (r.student_name && user?.username && r.student_name.toLowerCase().includes(user.username.toLowerCase())) return true;
      return false;
    });

    // If filtering by logged-in user yields results, return those; otherwise return all available requests for viewing
    return list.length > 0 ? list : rawRequests;
  }, [rawRequests, user]);

  // Determine active tracking ID:
  // 1. Search input / url query if present
  // 2. Or default to the student's most recent request
  const activeTrackingId = useMemo(() => {
    if (searchInput.trim()) return searchInput.trim();
    if (urlTrackId.trim()) return urlTrackId.trim();
    if (studentRequests.length > 0) {
      const first = studentRequests[0];
      return first.tracking_number || first.trackingId || String(first.id);
    }
    return '';
  }, [searchInput, urlTrackId, studentRequests]);

  // Match the active request object
  const matchedRequest = useMemo(() => {
    if (!activeTrackingId) return null;
    const cleanId = activeTrackingId.trim().toUpperCase();

    const found = rawRequests.find((r) => {
      const tNum = (r.tracking_number || '').toUpperCase();
      const tId = (r.trackingId || '').toUpperCase();
      const idStr = String(r.id || '').toUpperCase();
      const rawIdStr = String(r.rawId || '').toUpperCase();
      return tNum === cleanId || tId === cleanId || idStr === cleanId || rawIdStr === cleanId;
    });

    return found || null;
  }, [activeTrackingId, rawRequests]);

  // Credential details for matched request
  const matchedCred = useMemo(() => {
    if (!matchedRequest) return null;
    return credTypeMap.get(matchedRequest.credential_type) || null;
  }, [matchedRequest, credTypeMap]);

  // Normalized Display Status
  const displayStatus = useMemo(() => {
    if (!matchedRequest) return 'Pending';
    return formatStatusDisplay(matchedRequest.status);
  }, [matchedRequest]);

  // Check if request is On Hold
  const isOnHold = useMemo(() => {
    return displayStatus === 'On Hold';
  }, [displayStatus]);

  // Step Index for Timeline (0 to 3)
  const currentStepIndex = useMemo(() => {
    switch (displayStatus) {
      case 'Claimed':
        return 3;
      case 'For release':
        return 2;
      case 'Processing':
        return 1;
      case 'Pending':
      default:
        return 0;
    }
  }, [displayStatus]);

  // Dynamic Estimated Completion Date
  const estimatedCompletion = useMemo(() => {
    if (!matchedRequest) return 'N/A';
    if (matchedRequest.release_date && matchedRequest.release_date !== 'N/A') {
      const d = new Date(matchedRequest.release_date);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return matchedRequest.release_date;
    }
    return calculateReleaseDate(matchedRequest.created_at, matchedCred?.processing_days || 5);
  }, [matchedRequest, matchedCred]);

  // Handle Search Input Change
  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (val.trim()) {
      setSearchParams({ trackId: val.trim() });
    } else {
      setSearchParams({});
    }
  };

  // Handle Pill Click
  const handleSelectRequest = (req) => {
    const code = req.tracking_number || req.trackingId || String(req.id);
    setSearchInput(code);
    setSearchParams({ trackId: code });
  };

  // Clear Search
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchParams({});
  };

  // Copy Tracking ID to clipboard
  const handleCopyTrackingId = () => {
    if (!activeTrackingId) return;
    navigator.clipboard.writeText(activeTrackingId);
    setCopied(true);
    toast.success(`Tracking ID ${activeTrackingId} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="student-page-container">
        {/* Page Title & Subtitle */}
        <div className="track-page-header">
          <h1 className="track-main-title">Track the status of your Request</h1>
          <p className="track-sub-title">
            Enter your tracking ID or select from your submitted requests below to see the current status of your documents.
          </p>
        </div>

        {/* Dynamic Request Selector Pills (if student has requests) */}
        {studentRequests.length > 0 && (
          <div className="track-selector-wrap">
            <div className="track-selector-label">
              <span>Your Submitted Requests ({studentRequests.length})</span>
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="track-copy-btn"
                title="Refresh live status from registrar"
              >
                {refreshing ? 'Refreshing...' : '🔄 Refresh Status'}
              </button>
            </div>
            <div className="track-selector-pills">
              {studentRequests.map((req) => {
                const code = req.tracking_number || req.trackingId || String(req.id);
                const isActive = activeTrackingId.toUpperCase() === code.toUpperCase();
                const cred = credTypeMap.get(req.credential_type);
                const docTitle = req.document_type || cred?.name || req.credential_type_details?.name || 'Document';
                const status = formatStatusDisplay(req.status);

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleSelectRequest(req)}
                    className={`track-selector-pill ${isActive ? 'active' : ''}`}
                  >
                    <span className="track-selector-pill-dot" />
                    <span>{code}</span>
                    <span className="opacity-70 text-xs">({docTitle})</span>
                    <span className={`status-pill ${
                      status === 'On Hold'
                        ? 'on-hold'
                        : status === 'Claimed'
                        ? 'claimed'
                        : status === 'For release'
                        ? 'for-release'
                        : status === 'Processing'
                        ? 'processing'
                        : 'pending'
                    }`}>
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Golden Border Search Bar with Clear Icon */}
        <div className="track-search-container">
          <svg className="w-5 h-5 track-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={handleInputChange}
            placeholder="Search tracking ID (e.g. REQ-2026-000001)"
            className="track-search-input pl-11 pr-11"
            aria-label="Tracking ID"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="track-search-clear-btn"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Conditional On Hold Alert Banner */}
        {matchedRequest && isOnHold && (
          <div className="track-on-hold-banner" role="alert">
            <div className="track-on-hold-icon-box">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="track-on-hold-content">
              <div className="flex items-center gap-2 mb-1">
                <span className="track-on-hold-badge">ON HOLD</span>
                <h4 className="track-on-hold-title">Request is Currently On Hold</h4>
              </div>
              <p className="track-on-hold-desc">
                {matchedRequest?.remarks
                  ? `Registrar Note: ${matchedRequest.remarks}`
                  : 'Your document request requires additional verification or clearance document before proceeding. Please contact or visit the Registrar Office.'}
              </p>
            </div>
          </div>
        )}

        {/* Case 1: Matched Request Display */}
        {matchedRequest ? (
          <div className="track-timeline-card">
            {/* Header Row: Tracking ID on left, Estimate Completion on right */}
            <div className="track-card-header">
              <div>
                <span className="track-card-lbl">Official Tracking ID</span>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                    {matchedRequest.tracking_number || matchedRequest.trackingId || matchedRequest.id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTrackingId}
                    className="track-copy-btn"
                    title="Copy Tracking ID"
                  >
                    {copied ? '✓ Copied' : '📋 Copy'}
                  </button>
                  <span className={`status-pill ${
                    isOnHold
                      ? 'on-hold'
                      : currentStepIndex === 3
                      ? 'claimed'
                      : currentStepIndex === 2
                      ? 'for-release'
                      : currentStepIndex === 1
                      ? 'processing'
                      : 'pending'
                  }`}>
                    {displayStatus}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="track-card-est-title">Estimated Release</div>
                <div className="track-card-est-date">{estimatedCompletion}</div>
              </div>
            </div>

            {/* Dynamic Details Metadata Grid */}
            <div className="track-info-grid">
              <div className="track-info-item">
                <span className="track-info-lbl">Document Requested</span>
                <span className="track-info-val" title={matchedRequest.document_type || matchedCred?.name || 'Document'}>
                  {matchedRequest.document_type || matchedCred?.name || 'Document Request'}
                </span>
              </div>
              <div className="track-info-item">
                <span className="track-info-lbl">Copies / Quantity</span>
                <span className="track-info-val">
                  {matchedRequest.copies || '1 copy'}
                </span>
              </div>
              <div className="track-info-item">
                <span className="track-info-lbl">Amount Due / Paid</span>
                <span className="track-info-val text-[#0B0B36]">
                  {matchedRequest.amount || (matchedCred?.price ? `₱${parseFloat(matchedCred.price).toFixed(0)}` : '₱0')}
                </span>
              </div>
              <div className="track-info-item">
                <span className="track-info-lbl">Date Submitted</span>
                <span className="track-info-val">
                  {matchedRequest.request_date || (matchedRequest.created_at ? matchedRequest.created_at.split('T')[0] : 'N/A')}
                </span>
              </div>
            </div>

            {/* Vertical Timeline */}
            <div className="track-timeline">
              {DEFAULT_TIMELINE_STEPS.map((step, index) => {
                const isPastOrCurrent = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                let dateText = 'Pending';
                let stepDesc = '';

                if (index === 0) {
                  // Step 0: Pending / Submitted
                  dateText = matchedRequest.created_at
                    ? new Date(matchedRequest.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Submitted';
                  stepDesc = 'Request submitted to registrar queue.';
                } else if (index === 1) {
                  // Step 1: Processing
                  if (currentStepIndex > 1) {
                    dateText = 'Completed';
                    stepDesc = 'Documents verified and prepared.';
                  } else if (isCurrent) {
                    dateText = isOnHold ? 'On Hold' : 'In Progress';
                    stepDesc = isOnHold
                      ? 'Temporarily on hold for verification.'
                      : 'Registrar is evaluating records and preparing credentials.';
                  } else {
                    dateText = 'Pending verification';
                    stepDesc = 'Awaiting registrar document preparation.';
                  }
                } else if (index === 2) {
                  // Step 2: For Release
                  if (currentStepIndex > 2) {
                    dateText = 'Completed';
                    stepDesc = 'Confirmed ready for release.';
                  } else if (isCurrent) {
                    dateText = 'Ready for Release';
                    stepDesc = 'Your document is ready for pickup at the Registrar Office.';
                  } else {
                    dateText = `Target: ${estimatedCompletion}`;
                    stepDesc = 'Scheduled release upon preparation.';
                  }
                } else if (index === 3) {
                  // Step 3: Claimed
                  if (isCurrent) {
                    dateText = 'Document Claimed';
                    stepDesc = 'Document received by student.';
                  } else {
                    dateText = 'Pending release';
                    stepDesc = 'Sign claim stub upon physical claiming.';
                  }
                }

                return (
                  <div key={step.id} className="track-step-node">
                    {/* Icon Circle */}
                    <div
                      className={`track-node-icon ${
                        isCurrent && isOnHold
                          ? 'on-hold'
                          : isPastOrCurrent
                          ? 'active'
                          : ''
                      }`}
                    >
                      {isCurrent && isOnHold ? (
                        <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
                        </svg>
                      ) : isPastOrCurrent ? (
                        <div className="w-3 h-3 rounded-full border-2 border-white flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      ) : (
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" strokeWidth={2} />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
                        </svg>
                      )}
                    </div>

                    {/* Node Content */}
                    <div className="track-node-content flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <h3 className={`track-node-title ${isCurrent ? 'text-[#0B0B36]' : 'text-slate-800'}`}>
                          {step.name} <span className="text-xs font-normal text-slate-500 hidden sm:inline">({step.label})</span>
                        </h3>
                        <span
                          className={`text-xs font-bold ${
                            isCurrent && isOnHold
                              ? 'text-amber-700'
                              : isPastOrCurrent
                              ? 'text-[#0B0B36]'
                              : 'text-slate-400'
                          }`}
                        >
                          {dateText}
                        </span>
                      </div>
                      <p className="track-node-desc">
                        {stepDesc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Action Buttons */}
            <div className="mt-8 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTES.STUDENT.NEW_REQUEST)}
                className="track-btn-secondary"
              >
                + Request Another Document
              </button>
              <button
                type="button"
                onClick={() => toast.info(`Claim Stub for ${activeTrackingId} available at Registrar window.`)}
                className="text-xs font-bold text-[#1F1F9B] hover:underline cursor-pointer"
              >
                Print / View Claim Stub
              </button>
            </div>
          </div>
        ) : searchInput.trim() ? (
          /* Case 2: Tracking ID searched but not found */
          <div className="track-empty-card">
            <div className="track-empty-icon">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 4h.01" />
              </svg>
            </div>
            <h3 className="track-empty-title">Tracking ID Not Found</h3>
            <p className="track-empty-desc">
              We couldn't locate any document request matching <strong>"{searchInput}"</strong>. Please verify your tracking number or pick from your active requests above.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClearSearch}
                className="track-btn-secondary"
              >
                Clear Search
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.STUDENT.NEW_REQUEST)}
                className="track-btn-primary"
              >
                Submit New Request
              </button>
            </div>
          </div>
        ) : (
          /* Case 3: Student has no requests yet */
          <div className="track-empty-card">
            <div className="track-empty-icon">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="track-empty-title">No Document Requests Yet</h3>
            <p className="track-empty-desc">
              You haven't submitted any credential requests yet. When you request a document, you can monitor its progress in real-time right here.
            </p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.STUDENT.NEW_REQUEST)}
              className="track-btn-primary"
            >
              + Request Your First Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
