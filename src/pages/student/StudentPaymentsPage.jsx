import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import requestsApi, { resolveRequestDocType, isConfirmedForPayment } from '../../api/requests';
import paymentsApi, { getStoredPaymentProof } from '../../api/payments';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import useToast from '../../hooks/useToast';
import PaymentUploadModal from '../../components/student/PaymentUploadModal';
import '../../styles/student/StudentPaymentsPage.css';

const PAYMENT_ARCHIVED_KEY = 'regquest_archived_payments';

function getArchivedPaymentsMap() {
  try {
    return JSON.parse(localStorage.getItem(PAYMENT_ARCHIVED_KEY) || '{}');
  } catch {
    return {};
  }
}

function isPaymentArchived(req, map = null) {
  if (!req) return false;
  const aMap = map || getArchivedPaymentsMap();
  const keys = [req.id, req.rawId, req.tracking_number, req.trackingId]
    .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
    .map((k) => String(k).trim());
  return keys.some((k) => Boolean(aMap[k]));
}

function setPaymentArchived(req, isArchived = true) {
  try {
    const aMap = getArchivedPaymentsMap();
    const keys = [req.id, req.rawId, req.tracking_number, req.trackingId]
      .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
      .map((k) => String(k).trim());

    if (isArchived) {
      const info = {
        archived_at: new Date().toISOString(),
        tracking_number: req.tracking_number || req.trackingId || req.id,
      };
      keys.forEach((k) => {
        aMap[k] = info;
      });
    } else {
      keys.forEach((k) => {
        delete aMap[k];
      });
    }

    localStorage.setItem(PAYMENT_ARCHIVED_KEY, JSON.stringify(aMap));
    window.dispatchEvent(new Event('regquest_payments_archived_updated'));
    return true;
  } catch (err) {
    console.error('Failed to setPaymentArchived:', err);
    return false;
  }
}

export default function StudentPaymentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [rawRequests, setRawRequests] = useState([]);
  const [credentialTypes, setCredentialTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  // View Mode: 'active' | 'history'
  const [viewMode, setViewMode] = useState('active');
  const [archivedPaymentsMap, setArchivedPaymentsMap] = useState(() => getArchivedPaymentsMap());

  // Filter Tab State: 'ALL' | 'READY_PAYMENT' | 'PENDING_VERIFY' | 'VERIFIED'
  const [activeTab, setActiveTab] = useState('ALL');

  // Modal State for uploading proof of payment
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    const handleSyncPaymentsArchived = () => {
      setArchivedPaymentsMap(getArchivedPaymentsMap());
    };
    window.addEventListener('regquest_payments_archived_updated', handleSyncPaymentsArchived);
    window.addEventListener('storage', handleSyncPaymentsArchived);
    return () => {
      window.removeEventListener('regquest_payments_archived_updated', handleSyncPaymentsArchived);
      window.removeEventListener('storage', handleSyncPaymentsArchived);
    };
  }, []);

  // Fetch Requests & Credential Types
  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [requestsRes, credRes] = await Promise.all([
        requestsApi.list().catch(() => []),
        requestsApi.getCredentialTypes().catch(() => []),
      ]);
      setRawRequests(Array.isArray(requestsRes) ? requestsRes : []);
      setCredentialTypes(Array.isArray(credRes) ? credRes : []);
    } catch (err) {
      console.warn('Failed to load student payments:', err);
    } finally {
      setLoading(false);
      if (isManual) {
        setRefreshing(false);
        toast.info('Payment records updated with latest records.');
      }
    }
  };

  useEffect(() => {
    fetchData();

    const handleSync = () => {
      fetchData();
    };

    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_payment_updated', handleSync);

    return () => {
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_payment_updated', handleSync);
    };
  }, []);

  // Credential Types Map
  const credTypeMap = useMemo(() => {
    const map = new Map();
    credentialTypes.forEach((c) => map.set(c.id, c));
    return map;
  }, [credentialTypes]);

  // Filter requests for current student
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

    return list.length > 0 ? list : rawRequests;
  }, [rawRequests, user]);

  // ONLY requests where staff or admin has confirmed the request or the status is "for payment"
  const confirmedRequests = useMemo(() => {
    return studentRequests.filter((req) => isConfirmedForPayment(req));
  }, [studentRequests]);

  // Unconfirmed requests (still under initial staff review / clearance verification)
  const pendingReviewRequests = useMemo(() => {
    return studentRequests.filter((req) => !isConfirmedForPayment(req));
  }, [studentRequests]);

  // Request categorization helper for confirmed items
  const categorizeRequest = (req) => {
    const trackingCode = req.tracking_number || req.trackingId || req.id;
    let proof = req.payment_proof;

    // Verify proof on req actually belongs to this specific request
    if (proof) {
      const pTrack = String(proof.trackingNumber || '').trim().toUpperCase();
      const pReqId = String(proof.requestId || '').trim().toUpperCase();
      const thisTrack = String(trackingCode || '').trim().toUpperCase();
      const thisId = String(req.id || req.rawId || '').trim().toUpperCase();
      const matches =
        (pTrack && (pTrack === thisTrack || pTrack === thisId)) ||
        (pReqId && (pReqId === thisTrack || pReqId === thisId));
      if (!matches) {
        proof = null;
      }
    }

    if (!proof) {
      proof = getStoredPaymentProof([trackingCode, req.id, req.rawId]);
    }

    const isPaymentVerified =
      req.payment_status === 'VERIFIED' ||
      proof?.status === 'VERIFIED' ||
      String(req.status || '').toUpperCase() === 'FOR_PROCESSING' ||
      String(req.status || '').toUpperCase() === 'PROCESSING' ||
      String(req.status || '').toUpperCase() === 'READY_FOR_RELEASE' ||
      String(req.status || '').toUpperCase() === 'RELEASED' ||
      String(req.status || '').toUpperCase() === 'CLAIMED';

    const hasProofSubmitted =
      !isPaymentVerified && Boolean(proof);

    const s = String(req.status || '').toUpperCase();
    const isReadyForPayment =
      !isPaymentVerified &&
      !hasProofSubmitted &&
      (s === 'PENDING PAYMENT' ||
        s === 'PENDING_PAYMENT' ||
        s === 'PAYMENT_PENDING' ||
        s === 'FOR PAYMENT' ||
        s === 'FOR_PAYMENT' ||
        s === 'CLEARED FOR PAYMENT');

    return {
      isReadyForPayment,
      hasProofSubmitted,
      isPaymentVerified,
      proof,
    };
  };

  // Split confirmed requests into Active Payments vs Payment History
  const activeConfirmedRequests = useMemo(() => {
    return confirmedRequests.filter((req) => !isPaymentArchived(req, archivedPaymentsMap));
  }, [confirmedRequests, archivedPaymentsMap]);

  const historyConfirmedRequests = useMemo(() => {
    return confirmedRequests.filter((req) => isPaymentArchived(req, archivedPaymentsMap));
  }, [confirmedRequests, archivedPaymentsMap]);

  // Counts for filter tabs (calculated strictly on active confirmed requests)
  const tabCounts = useMemo(() => {
    let readyCount = 0;
    let pendingVerifyCount = 0;
    let verifiedCount = 0;

    activeConfirmedRequests.forEach((req) => {
      const { isReadyForPayment, hasProofSubmitted, isPaymentVerified } = categorizeRequest(req);
      if (isReadyForPayment) readyCount++;
      if (hasProofSubmitted) pendingVerifyCount++;
      if (isPaymentVerified) verifiedCount++;
    });

    return {
      all: activeConfirmedRequests.length,
      readyPayment: readyCount,
      pendingVerify: pendingVerifyCount,
      verified: verifiedCount,
    };
  }, [activeConfirmedRequests]);

  // Filtered requests according to viewMode and activeTab
  const filteredRequests = useMemo(() => {
    if (viewMode === 'history') {
      return historyConfirmedRequests;
    }

    if (activeTab === 'ALL') return activeConfirmedRequests;

    return activeConfirmedRequests.filter((req) => {
      const { isReadyForPayment, hasProofSubmitted, isPaymentVerified } = categorizeRequest(req);
      if (activeTab === 'READY_PAYMENT') return isReadyForPayment;
      if (activeTab === 'PENDING_VERIFY') return hasProofSubmitted;
      if (activeTab === 'VERIFIED') return isPaymentVerified;
      return true;
    });
  }, [viewMode, historyConfirmedRequests, activeConfirmedRequests, activeTab]);

  const handleMarkPaymentDone = (req) => {
    if (!req) return;
    const trackingCode = req.tracking_number || req.trackingId || req.id;
    setPaymentArchived(req, true);
    setArchivedPaymentsMap(getArchivedPaymentsMap());
    toast.success(`Payment for ${trackingCode} marked as Done and moved to Payment History!`);
    setViewMode('history');
  };

  const handleRestorePayment = (req) => {
    if (!req) return;
    const trackingCode = req.tracking_number || req.trackingId || req.id;
    setPaymentArchived(req, false);
    setArchivedPaymentsMap(getArchivedPaymentsMap());
    toast.info(`Payment for ${trackingCode} restored to Active Payments.`);
    setViewMode('active');
  };

  const handleCopy = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    toast.success(`Tracking code ${code} copied!`);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const handleOpenUploadModal = (req) => {
    setSelectedRequest(req);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="student-payments-container">
        {/* Header */}
        <div className="payments-header">
          <div>
            <h1 className="payments-title">
              {viewMode === 'history' ? 'Payment History' : 'Payments & Order of Payment'}
            </h1>
            <p className="payments-subtitle">
              {viewMode === 'history'
                ? 'Review your past verified and completed cashier payments.'
                : 'Download your assessed official request form for Over-The-Counter Cashier payment and attach your Official Receipt (O.R.) proof of payment.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {/* Payment History Button in upper right right beside refresh */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'history' ? 'active' : 'history')}
              className={`payments-history-btn ${viewMode === 'history' ? 'active' : ''}`}
              title={viewMode === 'history' ? 'Switch to Active Payments' : 'View Payment History'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{viewMode === 'history' ? 'Active Payments' : 'Payment History'}</span>
              <span className="payments-history-count">
                {viewMode === 'history' ? activeConfirmedRequests.length : historyConfirmedRequests.length}
              </span>
            </button>

            {/* Refresh Records Button */}
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="payments-refresh-btn"
            >
              {refreshing ? (
                'Refreshing...'
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Records
                </>
              )}
            </button>
          </div>
        </div>

        {/* History Banner (Shown in History View) */}
        {viewMode === 'history' && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50/90 flex items-center justify-between text-xs sm:text-sm text-emerald-950 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Showing <strong>{historyConfirmedRequests.length}</strong> completed and verified payment(s) in your history.</span>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('active')}
              className="text-xs font-bold text-emerald-800 hover:underline cursor-pointer ml-3 shrink-0"
            >
              ← Back to Active Payments
            </button>
          </div>
        )}

        {/* OTC 3-Step Guide Banner (Active View Only) */}
        {viewMode === 'active' && (
          <div className="otc-guide-banner">
            <div className="otc-guide-header">
              <div className="otc-guide-icon">₱</div>
              <div>
                <h2 className="otc-guide-title">How Over-The-Counter (OTC) Payment Works</h2>
                <p className="otc-guide-sub">
                  Once staff or admin confirms your request and assesses the fee:
                </p>
              </div>
            </div>

            <div className="otc-steps-grid">
              <div className="otc-step-item">
                <div className="otc-step-num">1</div>
                <div>
                  <h4 className="otc-step-heading">Download Assessed Form</h4>
                  <p className="otc-step-text">
                    Download and print your official request form showing the fee assessed by Registrar Staff.
                  </p>
                </div>
              </div>

              <div className="otc-step-item">
                <div className="otc-step-num">2</div>
                <div>
                  <h4 className="otc-step-heading">Pay at USTP Cashier</h4>
                  <p className="otc-step-text">
                    Present your printed form at the <strong>USTP Cashier's Office</strong> and pay the assessed amount.
                  </p>
                </div>
              </div>

              <div className="otc-step-item">
                <div className="otc-step-num">3</div>
                <div>
                  <h4 className="otc-step-heading">Attach Receipt Picture</h4>
                  <p className="otc-step-text">
                    Upload a clear photo of your Official Receipt (O.R.) below so Registrar Staff can verify and begin preparing your document.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notice for requests awaiting staff confirmation (Active View Only) */}
        {viewMode === 'active' && pendingReviewRequests.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/80 flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
            <span className="text-base shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                </svg>
              </span>
            <div>
              <h4 className="font-bold text-amber-950">
                {pendingReviewRequests.length} Request(s) Awaiting Staff Confirmation
              </h4>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                Requests currently under review and clearance verification by Registrar Staff or Admin are not yet ready for payment. Once confirmed and assessed (status changes to "For Payment" / "Pending Payment"), they will automatically appear here with the downloadable form and payment attachment options.
              </p>
              <button
                type="button"
                onClick={() => navigate(ROUTES.STUDENT.REQUESTS)}
                className="mt-2 text-xs font-bold text-indigo-900 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Track status of awaiting requests</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter Tabs (Active View Only) */}
        {viewMode === 'active' && (
          <div className="payments-filter-tabs">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`payments-filter-tab ${activeTab === 'ALL' ? 'active' : ''}`}
            >
              <span>All Confirmed Requests</span>
              <span className="payments-tab-count">{tabCounts.all}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('READY_PAYMENT')}
              className={`payments-filter-tab ${activeTab === 'READY_PAYMENT' ? 'active' : ''}`}
            >
              <span>Ready for Payment</span>
              <span className="payments-tab-count">{tabCounts.readyPayment}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PENDING_VERIFY')}
              className={`payments-filter-tab ${activeTab === 'PENDING_VERIFY' ? 'active' : ''}`}
            >
              <span>Pending Verification</span>
              <span className="payments-tab-count">{tabCounts.pendingVerify}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('VERIFIED')}
              className={`payments-filter-tab ${activeTab === 'VERIFIED' ? 'active' : ''}`}
            >
              <span>Payment Verified</span>
              <span className="payments-tab-count">{tabCounts.verified}</span>
            </button>
          </div>
        )}

        {/* Requests List (Confirmed / For Payment Only) */}
        {filteredRequests.length > 0 ? (
          <div className="payments-card-list">
            {filteredRequests.map((req) => {
              const trackingCode = req.tracking_number || req.trackingId || req.id;
              const cred = credTypeMap.get(req.credential_type);
              const docTitle = resolveRequestDocType(req, cred);
              const assessedFee = req.assessed_amount || req.amount || (cred?.price ? `₱${parseFloat(cred.price).toFixed(0)}` : '₱100.00');
              const { isReadyForPayment, hasProofSubmitted, isPaymentVerified, proof } = categorizeRequest(req);

              return (
                <div
                  key={trackingCode}
                  className={`payment-card ${isReadyForPayment ? 'highlight' : ''}`}
                >
                  {/* Card Header */}
                  <div className="payment-card-header">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-extrabold text-slate-900">
                          {trackingCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(trackingCode)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded cursor-pointer"
                          title="Copy tracking code"
                        >
                          {copiedId === trackingCode ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Copied
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <rect x="9" y="9" width="13" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <h3 className="text-base sm:text-lg font-extrabold text-[#0B0B36]">
                        {docTitle}
                      </h3>
                    </div>

                    <div>
                      {isReadyForPayment ? (
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="2" y1="10" x2="22" y2="10" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Ready for Payment
                        </span>
                      ) : hasProofSubmitted ? (
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-300 inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4m-7 9l3-1.5 3 1.5 3-1.5 3 1.5V4l-3 1.5L14 4l-3 1.5L8 4 5 5.5v16.5l3-1.5z" />
                          </svg>
                          Receipt Attached (Pending Verification)
                        </span>
                      ) : isPaymentVerified ? (
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Payment Verified
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Confirmed by Staff
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="payment-card-meta-grid">
                    <div className="payment-meta-item">
                      <span className="payment-meta-lbl">Assessed Fee</span>
                      <span className="payment-meta-val text-[#0B0B36]">{assessedFee}</span>
                    </div>

                    <div className="payment-meta-item">
                      <span className="payment-meta-lbl">Quantity / Copies</span>
                      <span className="payment-meta-val">{req.copies || '1 copy'}</span>
                    </div>

                    <div className="payment-meta-item">
                      <span className="payment-meta-lbl">Date Confirmed</span>
                      <span className="payment-meta-val">
                        {req.request_date || (req.created_at ? req.created_at.split('T')[0] : 'Recently')}
                      </span>
                    </div>

                    <div className="payment-meta-item">
                      <span className="payment-meta-lbl">O.R. Reference</span>
                      <span className="payment-meta-val font-mono">
                        {proof?.receiptReferenceNumber || req.or_number || 'Awaiting Payment'}
                      </span>
                    </div>
                  </div>

                  {/* Proof of Payment Details Banner (if attached) */}
                  {hasProofSubmitted && proof && (
                    <div className="payment-proof-banner">
                      <div className="flex items-center gap-3">
                        {proof.receiptImage && (
                          <img
                            src={proof.receiptImage}
                            alt="Cashier Receipt"
                            className="payment-proof-preview"
                          />
                        )}
                        <div>
                          <h4 className="text-xs font-extrabold text-blue-950">
                            Cashier Receipt Photo Uploaded
                          </h4>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            O.R. No: <strong className="font-mono text-slate-900">{proof.receiptReferenceNumber || 'Receipt'}</strong> • Amount: <strong>{proof.amount || assessedFee}</strong> • Mode: <strong>{proof.submissionType === 'PERSONAL' ? 'Window Submission' : 'Online Upload'}</strong>
                          </p>
                          <p className="text-[11px] text-blue-700 font-bold mt-0.5">
                            Status: Awaiting Registrar Staff review and verification.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenUploadModal(req)}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-950 underline cursor-pointer shrink-0"
                      >
                        Re-upload / Change Photo
                      </button>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="payment-card-actions">
                    {/* Button 1: Download Assessed Form (Only for confirmed / for-payment documents) */}
                    <button
                      type="button"
                      onClick={() => navigate(`/student/form/${trackingCode}?download=true`)}
                      className="payment-btn-primary"
                      title="Download and print official USTP request form with assessed fee"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download Assessed Form ({assessedFee})</span>
                    </button>

                    {/* Button 2: Attach Payment Picture */}
                    <button
                      type="button"
                      onClick={() => handleOpenUploadModal(req)}
                      className="payment-btn-emerald"
                      title="Upload picture of Cashier Official Receipt"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{hasProofSubmitted ? 'Update Receipt Picture' : 'Attach Payment Picture'}</span>
                    </button>

                    {/* Button 3: Track Status Link */}
                    <button
                      type="button"
                      onClick={() => navigate(`${ROUTES.STUDENT.REQUESTS}?trackId=${trackingCode}`)}
                      className="payment-btn-outline"
                      title="View real-time status progression"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                      </svg>
                      <span>Track Status</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="payments-empty-card">
            <div className="payments-empty-icon">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <line x1="2" y1="10" x2="22" y2="10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              {activeTab === 'READY_PAYMENT'
                ? 'No Requests Ready for Payment'
                : activeTab === 'PENDING_VERIFY'
                ? 'No Receipts Awaiting Verification'
                : activeTab === 'VERIFIED'
                ? 'No Verified Payments Yet'
                : 'No Requests Confirmed for Payment Yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
              {pendingReviewRequests.length > 0
                ? `You have ${pendingReviewRequests.length} request(s) awaiting confirmation by the Registrar. Once confirmed by staff or marked "For Payment", your assessed form and receipt attachment will appear here automatically.`
                : 'Document requests only appear here after the Registrar Staff or Admin confirms the request and sets the status to "For Payment".'}
            </p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.STUDENT.REQUESTS)}
              className="payment-btn-primary"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              Track Status of Submitted Requests
            </button>
          </div>
        )}
      </div>

      {/* Payment Upload Modal */}
      <PaymentUploadModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
}
