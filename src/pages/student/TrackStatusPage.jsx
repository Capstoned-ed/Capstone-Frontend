import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import requestsApi, { resolveRequestDocType } from '../../api/requests';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import useToast from '../../hooks/useToast';
import '../../styles/student/TrackStatusPage.css';

const DEFAULT_TIMELINE_STEPS = [
  { id: 'pending', name: 'Pending', label: 'Review & Clearance Verification' },
  { id: 'pending_payment', name: 'For Payment', label: 'Pay at Cashier & Submit OR' },
  { id: 'for_processing', name: 'For Processing', label: 'Payment Verified by Staff' },
  { id: 'processing', name: 'Processing', label: 'Document Preparation & Printing' },
  { id: 'releasing', name: 'Releasing', label: 'Ready for Claiming' },
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
    case 'FOR_PAYMENT':
    case 'FOR PAYMENT':
    case 'PAYMENT_PENDING':
    case 'PAYMENT PENDING':
    case 'PENDING_PAYMENT':
    case 'PENDING PAYMENT':
    case 'CLEARED FOR PAYMENT':
      return 'For Payment';
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
      return 'Releasing';
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

  // Student's Requests List (filtered for this student, sorted strictly from OLDEST to NEWEST)
  const studentRequests = useMemo(() => {
    const currentUserId = user?.userId || user?.id;
    const currentStudentId = user?.student_id || user?.username;

    const list = rawRequests.filter((r) => {
      if (!currentUserId && !currentStudentId) return true;
      if (r.user && currentUserId && String(r.user) === String(currentUserId)) return true;
      if (r.student_id && currentStudentId && String(r.student_id) === String(currentStudentId)) return true;
      if (r.student_name && user?.username && r.student_name.toLowerCase().includes(user.username.toLowerCase())) return true;
      if (r.student_name && user?.full_name && r.student_name.toLowerCase().includes(user.full_name.toLowerCase())) return true;
      if (r.student_name && user?.first_name && r.student_name.toLowerCase().includes(user.first_name.toLowerCase())) return true;
      return false;
    });

    const targetList = list.length > 0 ? list : rawRequests;

    // Sort strictly from oldest to newest (ascending date)
    return [...targetList].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dateA && dateB && dateA !== dateB) {
        return dateA - dateB;
      }
      const numA = parseInt(String(a.tracking_number || a.id).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.tracking_number || b.id).replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [rawRequests, user]);

  // Determine active tracking ID:
  // 1. Search input / url query if present
  // 2. Or default to the student's request
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

  // Step Index for 5-Step Timeline (0 to 4)
  const currentStepIndex = useMemo(() => {
    switch (displayStatus) {
      case 'Claimed':
      case 'Released':
        return 5;
      case 'Releasing':
      case 'For release':
        return 4;
      case 'Processing':
        return 3;
      case 'For Processing':
        return 2;
      case 'Pending Payment':
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

        {/* Submitted Requests Card (Oldest to Newest, Single-Row Items, Max 3 Visible with Scroll) */}
        {studentRequests.length > 0 && (
          <div className="track-selector-card">
            <div className="track-selector-card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0B0B36]/10 text-[#0B0B36] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 leading-tight">
                    Select a Request to Track
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Showing {studentRequests.length} {studentRequests.length === 1 ? 'request' : 'requests'} • Oldest to Newest
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="track-copy-btn"
                title="Refresh live status from registrar"
              >
                {refreshing ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>

            {/* Single column, 1 item per line (NO DOUBLE LINE), limited to 3 items with vertical scroll */}
            <div className="track-selector-list-scroll">
              {studentRequests.map((req) => {
                const code = req.tracking_number || req.trackingId || String(req.id);
                const isActive = activeTrackingId.toUpperCase() === code.toUpperCase();
                const cred = credTypeMap.get(req.credential_type);
                const docTitle = resolveRequestDocType(req, cred);
                const status = formatStatusDisplay(req.status);

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleSelectRequest(req)}
                    className={`track-selector-row-item ${isActive ? 'active' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                      <span className="track-row-dot" />
                      <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-900 shrink-0">
                        {code}
                      </span>
                      <span className="text-xs text-slate-500 truncate max-w-[160px] sm:max-w-[280px]">
                        ({docTitle})
                      </span>
                    </div>
                    <span className={`status-pill shrink-0 ${
                      status === 'On Hold'
                        ? 'on-hold'
                        : status === 'Claimed'
                        ? 'claimed'
                        : status === 'Releasing' || status === 'For release'
                        ? 'releasing'
                        : status === 'Processing'
                        ? 'processing'
                        : status === 'For Processing'
                        ? 'for-processing'
                        : status === 'Pending Payment'
                        ? 'payment-pending'
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
                {(() => {
                  const remarks = (matchedRequest?.notes || matchedRequest?.remarks || '').trim();
                  const isInitialStudentPurpose = remarks.startsWith('[') && (remarks.includes(']') || remarks === `[${matchedRequest.document_type}] ${matchedRequest.purpose}`);
                  const hasActualStaffNote = remarks && !isInitialStudentPurpose;

                  return hasActualStaffNote
                    ? `Registrar Note: ${remarks}`
                    : 'Your document request requires additional verification or clearance document before proceeding. Please contact or visit the Registrar Office.';
                })()}
              </p>
            </div>
          </div>
        )}

        {/* Case 1: Matched Request Display - Tracking Status Only */}
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
                      : displayStatus === 'Claimed'
                      ? 'claimed'
                      : displayStatus === 'Releasing'
                      ? 'releasing'
                      : displayStatus === 'Processing'
                      ? 'processing'
                      : displayStatus === 'For Processing'
                      ? 'for-processing'
                      : displayStatus === 'Pending Payment'
                      ? 'payment-pending'
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
                <span className="track-info-val" title={resolveRequestDocType(matchedRequest, matchedCred)}>
                  {resolveRequestDocType(matchedRequest, matchedCred)}
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
                  {matchedRequest.assessed_amount || matchedRequest.amount || (matchedCred?.price ? `₱${parseFloat(matchedCred.price).toFixed(0)}` : '₱100.00')}
                </span>
              </div>
              <div className="track-info-item">
                <span className="track-info-lbl">Date Submitted</span>
                <span className="track-info-val">
                  {matchedRequest.request_date || (matchedRequest.created_at ? matchedRequest.created_at.split('T')[0] : 'N/A')}
                </span>
              </div>
            </div>

            {/* Vertical Status Timeline Only */}
            <div className="track-timeline">
              {DEFAULT_TIMELINE_STEPS.map((step, index) => {
                const isPastOrCurrent = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                let dateText = 'Pending';
                let stepDesc = '';

                if (index === 0) {
                  // Step 0: Pending (Review & Clearance Verification)
                  if (currentStepIndex > 0) {
                    dateText = 'Verified';
                    stepDesc = 'Clearance reviewed and verified by Registrar Staff.';
                  } else {
                    dateText = matchedRequest.created_at
                      ? new Date(matchedRequest.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Submitted';
                    stepDesc = 'Request submitted. Staff is verifying uploaded clearance and calculating payment fee.';
                  }
                } else if (index === 1) {
                  // Step 1: Pending Payment (Pay at Cashier & Submit OR)
                  if (currentStepIndex > 1) {
                    dateText = 'Verified';
                    stepDesc = 'Payment completed at Cashier and Official Receipt submitted.';
                  } else if (isCurrent) {
                    dateText = 'Ready for Payment';
                    stepDesc = 'Clearance verified. Awaiting Cashier payment and payment verification.';
                  } else {
                    dateText = 'Pending Approval';
                    stepDesc = 'Awaiting clearance verification and payment assessment by Staff.';
                  }
                } else if (index === 2) {
                  // Step 2: For Processing (Payment Verified by Staff)
                  if (currentStepIndex > 2) {
                    dateText = 'Verified';
                    stepDesc = 'Official Receipt verified by Staff. Document preparation queued.';
                  } else if (isCurrent) {
                    dateText = 'Payment Verified';
                    stepDesc = 'Staff verified Official Receipt. Request queued for document processing.';
                  } else {
                    dateText = 'Awaiting Payment';
                    stepDesc = 'Staff verification of Official Receipt is strictly required.';
                  }
                } else if (index === 3) {
                  // Step 3: Processing (Document Preparation & Printing)
                  if (currentStepIndex > 3) {
                    dateText = 'Completed';
                    stepDesc = 'Credential document prepared and printed.';
                  } else if (isCurrent) {
                    dateText = isOnHold ? 'On Hold' : 'In Progress';
                    stepDesc = isOnHold
                      ? 'Temporarily on hold for verification.'
                      : 'Staff is currently preparing and printing your credential document.';
                  } else {
                    dateText = 'Queued';
                    stepDesc = 'Document preparation and printing begins once payment is verified.';
                  }
                } else if (index === 4) {
                  // Step 4: Releasing (Ready for Claiming)
                  if (isCurrent) {
                    dateText = 'Ready for Pickup';
                    stepDesc = 'Your credential is ready! You may claim your document at the Registrar window.';
                  } else if (currentStepIndex > 4) {
                    dateText = 'Claimed / Released';
                    stepDesc = 'Document claimed and released to student.';
                  } else {
                    dateText = `Target: ${estimatedCompletion}`;
                    stepDesc = 'Document will be available for pickup once released.';
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
