import React, { useState, useEffect, useMemo } from 'react';
import useToast from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../api/client';
import requestsApi, {
  updateStoredRequest,
  logProcessedAction,
  setRequestArchived,
  recordRequestActivityTimestamp,
  preserveDocTagInRemarks,
  mergeStaffNoteIntoRemarks,
  getLatestPaymentRecord,
  extractDocumentItems,
  extractTotalAmount,
  extractRequestedCopies,
  formatCleanPurpose,
  sanitizeRemarks,
  extractStaffRemark,
} from '../../api/requests';
import clearancesApi, { resolveClearancePreview } from '../../api/clearances';
import settingsApi from '../../api/settings';
import { saveStoredNotification } from '../../api/notifications';
import paymentsApi, { getStoredPaymentProof, verifyStoredPaymentProof } from '../../api/payments';
import {
  REQUEST_STATUS,
  normalizeToBackendStatus,
  formatStatusDisplay,
  STATUS_CONFIG,
  BACKEND_STATUS_MAP,
  isClaimedStatus,
} from '../../constants/workflowStatuses';
import PrintRequestFormModal from '../student/PrintRequestFormModal';
import ClaimStubModal from '../common/ClaimStubModal';
import CustomSelectDropdown from '../common/CustomSelectDropdown';
import CompactDatePicker from '../common/CompactDatePicker';

function resolveModalTargetBackendStatus(label) {
  if (!label) return '';
  const clean = String(label).trim();
  const upper = clean.toUpperCase();
  if (upper === 'PENDING REGISTRAR APPROVAL' || upper === 'PENDING_REGISTRAR_APPROVAL') {
    return 'PENDING_REGISTRAR_APPROVAL';
  }
  if (upper === 'APPROVED / READY FOR RELEASE' || upper === 'APPROVED' || upper === 'READY FOR RELEASE') {
    return REQUEST_STATUS.READY_FOR_RELEASE;
  }
  if (upper === 'RELEASED / COMPLETED' || upper === 'RELEASED') {
    return REQUEST_STATUS.RELEASED;
  }
  if (
    upper === 'RETURNED TO STAFF / FOR PROCESSING' ||
    upper === 'RETURNED TO STAFF / PROCESSING' ||
    upper === 'RETURNED TO STAFF'
  ) {
    return REQUEST_STATUS.PAYMENT_VERIFIED;
  }
  return BACKEND_STATUS_MAP[clean] || normalizeToBackendStatus(clean);
}

export default function ProcessRequestModal({
  isOpen,
  onClose,
  requestItem,
  onUpdated,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [newStatus, setNewStatus] = useState(() => requestItem?.status || 'Pending');
  const [notes, setNotes] = useState('');
  const [initialStaffNote, setInitialStaffNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingAssessment, setConfirmingAssessment] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [showInlineClearance, setShowInlineClearance] = useState(false);
  const [clearanceDoc, setClearanceDoc] = useState(null);
  const [loadingClearance, setLoadingClearance] = useState(false);
  const resolveInitialClearanceStatus = (item) => {
    const raw = item?.clearance_status;
    if (raw === 'VERIFIED' || raw === 'APPROVED') return 'VERIFIED';
    if (raw === 'REJECTED' || raw === 'NOT_VERIFIED') return 'REJECTED';
    if (raw === 'PENDING') return 'PENDING';
    const st = String(item?.status || '').trim().toUpperCase();
    const isPastPending = Boolean(
      item?.is_confirmed ||
      item?.confirmed_for_payment ||
      [
        'REQUIREMENTS_VERIFICATION',
        'PAYMENT_PENDING',
        'PENDING PAYMENT',
        'FOR PAYMENT',
        'FOR_PAYMENT',
        'FOR_VERIFICATION',
        'FOR VERIFICATION',
        'PAYMENT_VERIFIED',
        'FOR PROCESSING',
        'FOR_PROCESSING',
        'PROCESSING',
        'READY_FOR_RELEASE',
        'RELEASING',
        'FOR RELEASE',
        'RELEASED',
        'CLAIMED',
      ].includes(st)
    );
    if (isPastPending) return 'VERIFIED';
    return item?.clearance_preview || item?.clearance_id ? 'PENDING' : 'NOT_ATTACHED';
  };

  const [clearanceStatus, setClearanceStatus] = useState(() =>
    resolveInitialClearanceStatus(requestItem)
  );
  const [reviewingClearance, setReviewingClearance] = useState(false);

  // Payment Assessment Fields (matching staff modal)
  const defaultStaffName = user?.full_name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username) || 'Admin';
  const [assessedAmount, setAssessedAmount] = useState(() => {
    const computed = extractTotalAmount(requestItem);
    if (computed > 0) return computed.toFixed(2);
    const baseAmt =
      requestItem?.total_amount ||
      requestItem?.assessed_amount ||
      requestItem?.amount ||
      requestItem?.price ||
      100;
    const cleanAmt = String(baseAmt).replace(/[^0-9.]/g, '');
    return cleanAmt || '100.00';
  });
  const [dateOfRelease, setDateOfRelease] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [turnaroundHint, setTurnaroundHint] = useState('');
  const [verifiedByName, setVerifiedByName] = useState(defaultStaffName);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showClaimStubModal, setShowClaimStubModal] = useState(false);
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(() => {
    const s = String(requestItem?.status || '').toUpperCase();
    const p = normalizeToBackendStatus(requestItem?.status);
    return Boolean(
      requestItem?.is_confirmed ||
      requestItem?.confirmed_for_payment ||
      [
        REQUEST_STATUS.PAYMENT_PENDING,
        REQUEST_STATUS.FOR_VERIFICATION,
        REQUEST_STATUS.PAYMENT_VERIFIED,
        REQUEST_STATUS.PROCESSING,
        REQUEST_STATUS.READY_FOR_RELEASE,
        REQUEST_STATUS.RELEASED,
        REQUEST_STATUS.REJECTED,
        REQUEST_STATUS.REQUIREMENTS_REJECTED,
        REQUEST_STATUS.CANCELLED,
      ].includes(p) ||
      [
        'FOR PAYMENT',
        'FOR_PAYMENT',
        'PAYMENT_PENDING',
        'PENDING PAYMENT',
        'FOR VERIFICATION',
        'FOR_VERIFICATION',
        'PAYMENT_VERIFIED',
        'FOR PROCESSING',
        'FOR_PROCESSING',
        'PROCESSING',
        'READY_FOR_RELEASE',
        'FOR RELEASE',
        'RELEASED',
        'RELEASING',
        'CLAIMED',
        'REJECTED',
        'REQUIREMENTS_REJECTED',
      ].includes(s)
    );
  });

  // Live refreshed request detail (prevents stale receipt/payment state when modal opens)
  const [liveRequestDetail, setLiveRequestDetail] = useState(null);
  const [livePayments, setLivePayments] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLiveRequestDetail(null);
    setLivePayments(null);

    if (!isOpen || !requestItem) return;

    const targetRawId = requestItem.rawId || requestItem.id;
    const isBackendId = Boolean(targetRawId) && !String(targetRawId).startsWith('fallback_');
    if (!isBackendId) return;

    (async () => {
      try {
        const fresh = await requestsApi.get(targetRawId);
        if (ignore || !fresh) return;
        setLiveRequestDetail(fresh);
        if (Array.isArray(fresh.payments) && fresh.payments.length > 0) {
          setLivePayments(fresh.payments);
        } else {
          // Fallback query strictly filtered to this exact request UUID
          const payList = await paymentsApi.list({ request: targetRawId }).catch(() => []);
          const matchedPays = (Array.isArray(payList) ? payList : []).filter(
            (p) => String(p.request) === String(targetRawId) || String(p.request?.id) === String(targetRawId)
          );
          if (!ignore && matchedPays.length > 0) {
            setLivePayments(matchedPays);
          }
        }
      } catch (err) {
        console.warn('Live request detail refresh notice:', err);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [isOpen, requestItem?.id, requestItem?.rawId]);

  // Payment Proof States (always pick newest uploaded payment record)
  const effectivePayments = livePayments || liveRequestDetail?.payments || requestItem?.payments || [];
  const latestPayment = useMemo(
    () => getLatestPaymentRecord(effectivePayments),
    [effectivePayments]
  );

  const [paymentProof, setPaymentProof] = useState(null);
  const [walkinOrNumber, setWalkinOrNumber] = useState('');
  const [showInlineReceipt, setShowInlineReceipt] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(() => {
    const s = String(requestItem?.status || '').toUpperCase();
    const initialLatest = getLatestPaymentRecord(requestItem?.payments);
    const isPastPayment =
      s === 'FOR PROCESSING' ||
      s === 'FOR_PROCESSING' ||
      s === 'PROCESSING' ||
      s === 'RELEASING' ||
      s === 'READY_FOR_RELEASE' ||
      s === 'CLAIMED' ||
      s === 'RELEASED';
    if (
      requestItem?.payment_status === 'VERIFIED' ||
      initialLatest?.status === 'VERIFIED' ||
      (isPastPayment && (requestItem?.or_number || initialLatest?.receipt_reference_number))
    ) {
      return 'VERIFIED';
    }
    if (requestItem?.payment_status === 'REJECTED' || initialLatest?.status === 'REJECTED') {
      return 'REJECTED';
    }
    if (
      requestItem?.receipt_image ||
      requestItem?.or_number ||
      initialLatest?.receipt_image ||
      initialLatest?.receipt_reference_number ||
      requestItem?.payment_status === 'PAYMENT_SUBMITTED'
    ) {
      return 'PENDING';
    }
    return 'NOT_SUBMITTED';
  });
  const [localStatus, setLocalStatus] = useState(() => requestItem?.status || 'Pending');

  // Sync live refreshed payment status & OR number into local state when detail fetch completes
  useEffect(() => {
    if (!liveRequestDetail && !latestPayment) return;
    if (latestPayment?.receipt_reference_number && !walkinOrNumber) {
      setWalkinOrNumber(latestPayment.receipt_reference_number);
    } else if (liveRequestDetail?.or_number && !walkinOrNumber) {
      setWalkinOrNumber(liveRequestDetail.or_number);
    }
    if (latestPayment?.status === 'VERIFIED' || liveRequestDetail?.payment_status === 'VERIFIED') {
      setPaymentStatus('VERIFIED');
    } else if (latestPayment?.status === 'REJECTED') {
      setPaymentStatus('REJECTED');
    } else if (latestPayment?.receipt_image || latestPayment?.receipt_reference_number || liveRequestDetail?.receipt_image) {
      setPaymentStatus((prev) => (prev === 'VERIFIED' ? prev : 'PENDING'));
    }
  }, [liveRequestDetail, latestPayment]);

  const activeReceiptImage =
    latestPayment?.receipt_image ||
    liveRequestDetail?.receipt_image ||
    requestItem?.receipt_image ||
    paymentProof?.receiptImage ||
    paymentProof?.receiptDataUrl ||
    null;

  const [receiptBlobUrl, setReceiptBlobUrl] = useState(null);
  const [loadingReceiptBlob, setLoadingReceiptBlob] = useState(false);
  const [receiptIsPdf, setReceiptIsPdf] = useState(false);
  const isDirectInlineUrl = Boolean(
    activeReceiptImage &&
      (activeReceiptImage.startsWith('data:') || activeReceiptImage.startsWith('blob:'))
  );
  // NEVER pass an unauthenticated API URL directly into <img src> — only render blob:/data: URLs
  const displayReceiptImage = isDirectInlineUrl ? activeReceiptImage : receiptBlobUrl;

  useEffect(() => {
    let ignore = false;
    let objectUrl = null;

    if (!isOpen || !activeReceiptImage) {
      setReceiptBlobUrl(null);
      setLoadingReceiptBlob(false);
      setReceiptIsPdf(false);
      return;
    }

    if (activeReceiptImage.startsWith('data:') || activeReceiptImage.startsWith('blob:')) {
      setReceiptBlobUrl(null);
      setLoadingReceiptBlob(false);
      setReceiptIsPdf(activeReceiptImage.startsWith('data:application/pdf'));
      return;
    }

    setLoadingReceiptBlob(true);
    setReceiptBlobUrl(null);
    (async () => {
      try {
        const res = await apiClient.get(activeReceiptImage, { responseType: 'blob' });
        if (!ignore && res?.data) {
          const contentType = String(res.data.type || res.headers?.['content-type'] || '').toLowerCase();
          setReceiptIsPdf(contentType.includes('pdf'));
          objectUrl = URL.createObjectURL(res.data);
          setReceiptBlobUrl(objectUrl);
        }
      } catch (err) {
        console.warn('Failed to load authenticated receipt preview:', err);
        if (!ignore) setReceiptBlobUrl(null);
      } finally {
        if (!ignore) setLoadingReceiptBlob(false);
      }
    })();

    return () => {
      ignore = true;
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch {}
      }
    };
  }, [isOpen, activeReceiptImage]);

  const hasReceiptUploaded = Boolean(activeReceiptImage);

  const activeOrNumber = (
    walkinOrNumber.trim() ||
    paymentProof?.receiptReferenceNumber ||
    requestItem?.or_number ||
    requestItem?.receipt_reference_number ||
    latestPayment?.receipt_reference_number ||
    ''
  );

  const hasOrNumber = Boolean(activeOrNumber);

  const canConfirmPayment = Boolean(hasOrNumber || hasReceiptUploaded);

  const userRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = userRole === 'ADMIN';

  const [persistedStatus, setPersistedStatus] = useState(() => requestItem?.status || 'PENDING');
  useEffect(() => {
    if (requestItem?.status) {
      setPersistedStatus(requestItem.status);
    }
  }, [requestItem?.id, requestItem?.rawId, requestItem?.status]);

  const [autoApproveEnabled, setAutoApproveEnabled] = useState(true);
  const [activeSignatoryName, setActiveSignatoryName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    settingsApi
      .getRegistrarApproval()
      .then((data) => {
        if (ignore || !data) return;
        setAutoApproveEnabled(Boolean(data.auto_approve_requests ?? true));
        const sig =
          data.active_registrar_name ||
          data.signatory_name ||
          data.default_signatory_name ||
          '';
        if (sig) setActiveSignatoryName(sig);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  const persistedBackendStatus = normalizeToBackendStatus(persistedStatus || requestItem?.status);
  const isPersistedReadyForRelease = persistedBackendStatus === REQUEST_STATUS.READY_FOR_RELEASE;
  const isPersistedReleased = persistedBackendStatus === REQUEST_STATUS.RELEASED;
  const isPersistedClaimed = isClaimedStatus(persistedBackendStatus) || isClaimedStatus(requestItem?.status);
  const isPersistedRejected = persistedBackendStatus === REQUEST_STATUS.REJECTED;
  const isPersistedRequirementsRejected = persistedBackendStatus === REQUEST_STATUS.REQUIREMENTS_REJECTED;
  const isPersistedCancelled = persistedBackendStatus === REQUEST_STATUS.CANCELLED;
  const isPersistedTerminal = isPersistedClaimed || isPersistedRejected || isPersistedRequirementsRejected || isPersistedCancelled;

  const isBeyondPending = [
    REQUEST_STATUS.PAYMENT_PENDING,
    REQUEST_STATUS.FOR_VERIFICATION,
    REQUEST_STATUS.PAYMENT_VERIFIED,
    REQUEST_STATUS.PROCESSING,
    REQUEST_STATUS.READY_FOR_RELEASE,
    REQUEST_STATUS.RELEASED,
    REQUEST_STATUS.REJECTED,
    REQUEST_STATUS.REQUIREMENTS_REJECTED,
    REQUEST_STATUS.CANCELLED,
  ].includes(persistedBackendStatus) || (
    persistedBackendStatus !== REQUEST_STATUS.PENDING &&
    persistedBackendStatus !== REQUEST_STATUS.REQUIREMENTS_VERIFICATION
  );

  const isAssessmentLocked = Boolean(
    isBeyondPending || isOrderConfirmed || isPersistedTerminal || isAdmin
  );

  const isAlreadyPastPayment = [
    REQUEST_STATUS.PAYMENT_VERIFIED,
    REQUEST_STATUS.PROCESSING,
    REQUEST_STATUS.READY_FOR_RELEASE,
    REQUEST_STATUS.RELEASED,
  ].includes(persistedBackendStatus);

  const isPaymentVerifiedOrBeyond =
    isAlreadyPastPayment ||
    paymentStatus === 'VERIFIED' ||
    Boolean(requestItem?.payment_status === 'VERIFIED');

  const isPaymentLocked = Boolean(
    isPaymentVerifiedOrBeyond || isPersistedTerminal || isAdmin
  );

  const isClearanceVerified = Boolean(
    clearanceStatus === 'VERIFIED' ||
    clearanceStatus === 'APPROVED' ||
    requestItem?.clearance_status === 'VERIFIED' ||
    requestItem?.clearance_status === 'APPROVED' ||
    isAlreadyPastPayment
  );

  const isPaymentVerified = Boolean(
    paymentStatus === 'VERIFIED' ||
    requestItem?.payment_status === 'VERIFIED' ||
    isAlreadyPastPayment
  );

  const [localIsApproved, setLocalIsApproved] = useState(() => Boolean(requestItem?.is_approved));
  const [localIsAutoApproved, setLocalIsAutoApproved] = useState(() => Boolean(requestItem?.is_auto_approved));
  const [localApprovedByName, setLocalApprovedByName] = useState(() => requestItem?.approved_by_name || '');

  useEffect(() => {
    setLocalIsApproved(Boolean(requestItem?.is_approved));
    setLocalIsAutoApproved(Boolean(requestItem?.is_auto_approved));
    setLocalApprovedByName(requestItem?.approved_by_name || '');
  }, [requestItem?.is_approved, requestItem?.is_auto_approved, requestItem?.approved_by_name]);

  const isApproved = localIsApproved;
  const isAutoApproved = localIsAutoApproved;
  const approvedByName = localApprovedByName;
  const isRegistrarOrAdmin =
    String(user?.role || '').toLowerCase() === 'registrar' ||
    String(user?.role || '').toLowerCase() === 'admin';

  // Enforce OFF Mode: when Auto-Approve is OFF and request is not yet approved by Registrar,
  // Staff cannot confirm/bypass Registrar approval until Registrar approves first.
  const isWaitingForRegistrarApproval = Boolean(
    !autoApproveEnabled && !isApproved && !isRegistrarOrAdmin
  );

  const canOverrideStatus = Boolean(
    !isAdmin &&
    isClearanceVerified &&
    !isPersistedTerminal &&
    !isWaitingForRegistrarApproval
  );

  const isStatusChanged = Boolean(
    localStatus &&
    resolveModalTargetBackendStatus(localStatus) !== persistedBackendStatus
  );

  const canEditRemarks = Boolean(!isAdmin && !isPersistedTerminal);

  const hasUnsavedNotes = Boolean(notes && notes.trim().length > 0);

  const isStaffPaymentConfirmationStep = Boolean(
    userRole === 'STAFF' &&
    persistedBackendStatus === REQUEST_STATUS.PAYMENT_PENDING &&
    !isStatusChanged &&
    !hasUnsavedNotes
  );

  const canSubmitUpdate = Boolean(
    (isStatusChanged ? canOverrideStatus : (canEditRemarks && hasUnsavedNotes)) &&
    !loading
  );

  const normalizeStatus = (val) => {
    if (val === 'For Payment' || val === 'FOR PAYMENT' || val === 'FOR_PAYMENT') return 'Pending Payment';
    if (val === 'For Processing' || val === 'FOR PROCESSING' || val === 'FOR_PROCESSING') return 'Processing';
    return val;
  };

  const setStatusDirectly = (val) => {
    const cleanVal = normalizeStatus(val);
    setLocalStatus(cleanVal);
    setNewStatus(cleanVal);
  };

  const handleManualStatusChange = (val) => {
    if (isAdmin) {
      toast.warning('View Only (Admin): Admins have read-only access to request processing.');
      return;
    }
    if (!canOverrideStatus) {
      if (isPersistedTerminal && !isAdmin) {
        toast.warning('Cannot change status: This request is already completed or closed.');
      } else if (!isClearanceVerified) {
        toast.warning('Cannot change status: Please verify student clearance first.');
      } else if (isWaitingForRegistrarApproval) {
        toast.warning('Waiting for Registrar Approval before Staff can advance this request.');
      }
      return;
    }
    setStatusDirectly(val);
  };

  useEffect(() => {
    if (newStatus) setLocalStatus(normalizeStatus(newStatus));
  }, [newStatus]);

  const [approvingRequest, setApprovingRequest] = useState(false);

  const handleApproveRequest = async () => {
    if (isAdmin) {
      toast.warning('View Only (Admin): Admins cannot approve requests.');
      return;
    }
    if (approvingRequest) return;
    const targetRawId = requestItem.rawId || requestItem.id;
    setApprovingRequest(true);
    try {
      const fallbackApproverName =
        user?.full_name ||
        `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
        user?.username ||
        'Registrar';

      let approveRes = null;
      if (targetRawId && !String(targetRawId).startsWith('fallback_')) {
        approveRes = await requestsApi.approve(targetRawId);
      }
      const approverName = approveRes?.approved_by_name || fallbackApproverName;
      requestItem.is_approved = true;
      requestItem.is_auto_approved = false;
      requestItem.approved_by_name = approverName;
      setLocalIsApproved(true);
      setLocalIsAutoApproved(false);
      setLocalApprovedByName(approverName);
      updateStoredRequest(
        requestItem.id || targetRawId,
        {
          is_approved: true,
          is_auto_approved: false,
          approved_by_name: approverName,
        },
        { fallbackItem: requestItem }
      );
      toast.success(`Request approved by ${approverName}!`);
      if (typeof onUpdated === 'function') {
        onUpdated({
          ...requestItem,
          is_approved: true,
          is_auto_approved: false,
          approved_by_name: approverName,
        });
      }
    } catch (err) {
      console.error('Failed to approve request:', err);
      toast.error('Failed to approve request. Please try again.');
    } finally {
      setApprovingRequest(false);
    }
  };

  const claimStubDetails = useMemo(() => {
    if (!requestItem) return null;
    const reqDateFormatted = requestItem.request_date || (requestItem.created_at ? new Date(requestItem.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
    const relDateFormatted = dateOfRelease || requestItem.date_of_release || requestItem.release_date || '—';
    const resolvedStudentName = requestItem.student_name || requestItem.user_full_name || requestItem.student_id || 'Student';
    const reqPayments = requestItem.payments || [];
    const orNum =
      activeOrNumber ||
      requestItem.or_number ||
      requestItem.receipt_reference_number ||
      (Array.isArray(reqPayments) && reqPayments[0]?.receipt_reference_number) ||
      '';
    const assessedBy =
      verifiedByName ||
      requestItem.verified_by_name ||
      requestItem.assessed_by_name ||
      requestItem.assigned_staff ||
      '';
    return {
      studentName: resolvedStudentName,
      course: requestItem.course || requestItem.program || '—',
      dateOfRequest: reqDateFormatted,
      credentialRequested: `${requestItem.document_type || 'Document'} (${requestItem.copies || 1} ${requestItem.copies > 1 ? 'copies' : 'copy'})`,
      dateOfRelease: relDateFormatted,
      orNumber: orNum,
      assessedBy,
      approvedByName: approvedByName || 'University Registrar',
    };
  }, [requestItem, dateOfRelease, activeOrNumber, approvedByName, verifiedByName]);

  const statusOptions = useMemo(() => {
    const role = String(user?.role || '').trim().toUpperCase();
    const effectiveStatus = persistedStatus || requestItem?.status;
    const currentPersisted = normalizeToBackendStatus(effectiveStatus);
    const currentDisplay = formatStatusDisplay(effectiveStatus, { useReleasing: true });

    let nextTransitions = [];

    if (role === 'ADMIN') {
      // Admin has strictly read-only access to request status processing
      nextTransitions = [];
    } else if (role === 'REGISTRAR') {
      // Registrar-specific approval & oversight transitions (never Staff's Pending Payment)
      switch (currentPersisted) {
        case REQUEST_STATUS.PENDING:
        case REQUEST_STATUS.REQUIREMENTS_VERIFICATION:
        case REQUEST_STATUS.PAYMENT_PENDING:
        case REQUEST_STATUS.FOR_VERIFICATION:
          nextTransitions = [
            'Approved / Ready for Release',
            'Returned to Staff / Processing',
            'Rejected',
          ];
          break;
        case REQUEST_STATUS.PAYMENT_VERIFIED:
        case REQUEST_STATUS.PROCESSING:
          nextTransitions = [
            'Approved / Ready for Release',
            'Released / Completed',
            'Returned to Staff / Processing',
            'Rejected',
          ];
          break;
        case REQUEST_STATUS.READY_FOR_RELEASE:
          nextTransitions = [
            'Released / Completed',
            'Returned to Staff / Processing',
            'Rejected',
          ];
          break;
        default:
          nextTransitions = [];
      }
    } else {
      // Role: STAFF — valid Staff transitions only (never re-offering Pending Payment when already PAYMENT_PENDING)
      if (isWaitingForRegistrarApproval) {
        nextTransitions = [];
      } else {
        switch (currentPersisted) {
          case REQUEST_STATUS.PENDING:
            nextTransitions = ['On Hold', 'Rejected'];
            break;
          case REQUEST_STATUS.REQUIREMENTS_VERIFICATION:
            nextTransitions = ['Pending', 'Pending Payment', 'Rejected'];
            break;
          case REQUEST_STATUS.PAYMENT_PENDING:
            nextTransitions = ['For Verification', 'Processing', 'Rejected'];
            break;
          case REQUEST_STATUS.FOR_VERIFICATION:
            nextTransitions = ['Processing', 'Rejected'];
            break;
          case REQUEST_STATUS.PAYMENT_VERIFIED:
            nextTransitions = autoApproveEnabled
              ? ['Processing', 'Ready for Release']
              : ['Processing', 'Pending Registrar Approval'];
            break;
          case REQUEST_STATUS.PROCESSING:
            nextTransitions = autoApproveEnabled
              ? ['Ready for Release']
              : ['Pending Registrar Approval'];
            break;
          case REQUEST_STATUS.READY_FOR_RELEASE:
            nextTransitions = ['Claimed'];
            break;
          default:
            nextTransitions = [];
        }
      }
    }

    const uniqueNext = Array.from(new Set(nextTransitions)).filter(
      (label) => resolveModalTargetBackendStatus(label) !== currentPersisted
    );

    const options = [
      {
        value: currentDisplay,
        label: `Current: ${currentDisplay}`,
        disabled: true,
      },
      ...uniqueNext.map((label) => ({
        value: label,
        label,
        disabled: false,
      })),
    ];

    return options;
  }, [persistedStatus, requestItem?.status, user?.role, isWaitingForRegistrarApproval, autoApproveEnabled]);

  useEffect(() => {
    let ignore = false;
    let cleanupFn = null;

    if (!requestItem) return;

    const loadedNote = extractStaffRemark(requestItem);
    setNotes(loadedNote);
    setInitialStaffNote(loadedNote);
    setClearanceStatus(resolveInitialClearanceStatus(requestItem));
    setLocalStatus(requestItem?.status || 'Pending');
    setNewStatus(requestItem?.status || 'Pending');

    const computedAmt = extractTotalAmount(requestItem);
    if (computedAmt > 0) {
      setAssessedAmount(computedAmt.toFixed(2));
    } else {
      const baseAmt = requestItem.total_amount || requestItem.assessed_amount || requestItem.amount || requestItem.price || 100;
      const cleanAmt = String(baseAmt).replace(/[^0-9.]/g, '');
      setAssessedAmount(cleanAmt || '100.00');
    }

    if (requestItem.date_of_release || requestItem.release_date) {
      setDateOfRelease(requestItem.date_of_release || requestItem.release_date);
      setTurnaroundHint('');
    } else {
      // Prefill estimated release date using ML Turnaround Prediction (with safe fallback to CredentialType.processing_days)
      const credCode =
        requestItem.credential_type_details?.code ||
        requestItem.credential_code ||
        requestItem.document_type ||
        'TOR';
      const reqDate = requestItem.created_at
        ? String(requestItem.created_at).substring(0, 10)
        : undefined;
      const fallbackDays = Number(
        requestItem.credential_type_details?.processing_days ||
        requestItem.processing_days ||
        5
      );

      const addBusinessDays = (startIso, days) => {
        const d = startIso ? new Date(startIso) : new Date();
        const safeBase = isNaN(d.getTime()) ? new Date() : d;
        const target = Math.max(1, Math.ceil(Number(days) || 3));
        let added = 0;
        while (added < target) {
          safeBase.setDate(safeBase.getDate() + 1);
          const wd = safeBase.getDay();
          if (wd !== 0 && wd !== 6) added += 1;
        }
        return safeBase.toISOString().split('T')[0];
      };

      setDateOfRelease(addBusinessDays(reqDate, fallbackDays));
      setTurnaroundHint(`Catalog est: ${fallbackDays} operating days`);

      requestsApi
        .predictTurnaround({
          credentialType: credCode,
          dateRequested: reqDate,
          purpose: requestItem.purpose || 'Employment',
          numDocuments: Number(requestItem.copies) || 1,
        })
        .then((res) => {
          if (ignore || !res) return;
          const predDays = res.predicted_processing_time;
          if (res.estimated_completion_date) {
            setDateOfRelease(String(res.estimated_completion_date).substring(0, 10));
          } else if (predDays) {
            setDateOfRelease(addBusinessDays(reqDate, predDays));
          }
          if (predDays) {
            const label = res.is_fallback ? 'Catalog est' : 'ML est';
            setTurnaroundHint(`${label}: ~${predDays} operating days`);
          }
        })
        .catch(() => {
          // Graceful fallback already applied via CredentialType.processing_days
        });
    }
    if (requestItem.verified_by_name) {
      setVerifiedByName(requestItem.verified_by_name);
    }

    const s = String(requestItem.status || '').toUpperCase();
    const p = normalizeToBackendStatus(requestItem.status);
    setIsOrderConfirmed(
      Boolean(
        requestItem.is_confirmed ||
        requestItem.confirmed_for_payment ||
        [
          REQUEST_STATUS.PAYMENT_PENDING,
          REQUEST_STATUS.FOR_VERIFICATION,
          REQUEST_STATUS.PAYMENT_VERIFIED,
          REQUEST_STATUS.PROCESSING,
          REQUEST_STATUS.READY_FOR_RELEASE,
          REQUEST_STATUS.RELEASED,
          REQUEST_STATUS.REJECTED,
          REQUEST_STATUS.REQUIREMENTS_REJECTED,
          REQUEST_STATUS.CANCELLED,
        ].includes(p) ||
        [
          'FOR PAYMENT',
          'FOR_PAYMENT',
          'PAYMENT_PENDING',
          'PENDING PAYMENT',
          'FOR VERIFICATION',
          'FOR_VERIFICATION',
          'PAYMENT_VERIFIED',
          'FOR PROCESSING',
          'FOR_PROCESSING',
          'PROCESSING',
          'READY_FOR_RELEASE',
          'FOR RELEASE',
          'RELEASED',
          'RELEASING',
          'CLAIMED',
          'REJECTED',
          'REQUIREMENTS_REJECTED',
        ].includes(s)
      )
    );

    // Proof of payment strictly for THIS request (by tracking_number, id, rawId)
    const trackingCode = requestItem?.tracking_number || requestItem?.trackingId || requestItem?.id;
    const proof =
      requestItem?.payment_proof ||
      getStoredPaymentProof([
        trackingCode,
        requestItem?.id,
        requestItem?.rawId,
      ]);
    setPaymentProof(proof);

    const isPastPayment =
      s === 'FOR PROCESSING' ||
      s === 'FOR_PROCESSING' ||
      s === 'PROCESSING' ||
      s === 'RELEASING' ||
      s === 'READY_FOR_RELEASE' ||
      s === 'CLAIMED' ||
      s === 'RELEASED';

    let initialPayStatus = 'NOT_SUBMITTED';
    if (requestItem?.payment_status === 'VERIFIED' || (isPastPayment && (requestItem?.or_number || proof?.status === 'VERIFIED'))) {
      initialPayStatus = 'VERIFIED';
    } else if (requestItem?.payment_status === 'REJECTED' || proof?.status === 'REJECTED') {
      initialPayStatus = 'REJECTED';
    } else if (proof || requestItem?.receipt_image || requestItem?.or_number || requestItem?.payment_status === 'PAYMENT_SUBMITTED') {
      initialPayStatus = 'PENDING';
    }
    setPaymentStatus(initialPayStatus);
    setWalkinOrNumber(requestItem?.or_number || proof?.receiptReferenceNumber || '');

    async function loadClearance() {
      setLoadingClearance(true);
      try {
        const resolved = await resolveClearancePreview(requestItem);
        if (!ignore && resolved) {
          setClearanceDoc(resolved);
          if (resolved.cleanup) cleanupFn = resolved.cleanup;
          const fallbackStatus = resolveInitialClearanceStatus(requestItem);
          setClearanceStatus((prev) => {
            if (prev === 'VERIFIED' || prev === 'REJECTED') return prev;
            if (fallbackStatus === 'VERIFIED' || fallbackStatus === 'REJECTED') return fallbackStatus;
            return 'PENDING';
          });
        }
      } catch (err) {
        console.warn('Failed to resolve clearance preview in admin modal:', err);
      } finally {
        if (!ignore) setLoadingClearance(false);
      }
    }

    loadClearance();

    return () => {
      ignore = true;
      if (cleanupFn) cleanupFn();
    };
  }, [requestItem]);

  const handleVerifyClearance = async (statusToSet) => {
    if (isAdmin) {
      toast.warning('View Only (Admin): Admins have read-only access to clearance verification.');
      return;
    }
    const previousStatus = clearanceStatus;
    setReviewingClearance(true);
    setClearanceStatus(statusToSet);
    requestItem.clearance_status = statusToSet;
    const targetId = requestItem.id || requestItem.rawId;

    let clrId = requestItem.clearance_id;
    if (!clrId) {
      try {
        const clrList = await clearancesApi.list();
        const found = clrList.find(
          (c) =>
            c.user === requestItem.user ||
            c.user?.id === requestItem.user ||
            c.user?.username === requestItem.student_id
        );
        if (found) {
          clrId = found.id;
          requestItem.clearance_id = found.id;
        }
      } catch (e) {
        console.warn('Could not list clearances to find clearance_id:', e);
      }
    }

    if (clrId) {
      try {
        const reviewStatus =
          statusToSet === 'VERIFIED' ? 'APPROVED' : statusToSet === 'PENDING' ? 'PENDING' : 'REJECTED';
        const reviewRemarks =
          notes.trim() || (statusToSet === 'REJECTED' ? 'Clearance rejected by staff.' : '');
        await clearancesApi.review(clrId, {
          status: reviewStatus,
          remarks: reviewRemarks,
        });
      } catch (err) {
        console.error('Backend review clearance failed:', err);
        const errMsg =
          err.response?.data?.detail ||
          err.response?.data?.remarks?.[0] ||
          err.response?.data?.status?.[0] ||
          (typeof err.response?.data === 'string' ? err.response.data : null) ||
          (err.response?.data ? JSON.stringify(err.response.data) : null) ||
          err.message ||
          'Failed to update clearance verification on the server.';
        toast.error(errMsg);
        setClearanceStatus(previousStatus);
        requestItem.clearance_status = previousStatus;
        setReviewingClearance(false);
        return;
      }
    }

    setReviewingClearance(false);

    let clearedRemarkPatch = {};
    if (statusToSet === 'VERIFIED') {
      const hadPendingRemark = Boolean(extractStaffRemark(requestItem) || notes.trim());
      const cleanedRemarks = mergeStaffNoteIntoRemarks(requestItem, '');
      requestItem.remarks = cleanedRemarks;
      requestItem.notes = '';
      requestItem.staff_notes = '';
      setNotes('');
      setInitialStaffNote('');
      clearedRemarkPatch = { remarks: cleanedRemarks, notes: '', staff_notes: '' };

      const targetRawId = requestItem.rawId || requestItem.id;
      const isBackendId = Boolean(targetRawId) && !String(targetRawId).startsWith('fallback_');
      if (isBackendId && hadPendingRemark) {
        await requestsApi.transition(
          targetRawId,
          { status: persistedBackendStatus, remarks: cleanedRemarks },
          { throwOnError: false }
        );
      }
    }

    const nowTime = Date.now();
    const nowIso = new Date(nowTime).toISOString();
    recordRequestActivityTimestamp(requestItem, nowTime);
    updateStoredRequest(
      targetId,
      { clearance_status: statusToSet, ...clearedRemarkPatch, updated_at: nowIso },
      { fallbackItem: requestItem, silentNotify: true }
    );

    if (onUpdated) {
      onUpdated({
        ...requestItem,
        clearance_status: statusToSet,
        ...clearedRemarkPatch,
        updated_at: nowIso,
      });
    }

    if (statusToSet === 'VERIFIED') {
      toast.success('Clearance verified successfully. Now complete the payment assessment below.');
    } else if (statusToSet === 'PENDING') {
      toast.info('Clearance verification reset to pending.');
    } else {
      toast.warning('Clearance marked as Not Cleared / Rejected.');
    }

    logProcessedAction({
      actor: user?.username,
      actorName: user?.full_name || user?.username,
      actorId: user?.id,
      actorRole: user?.role || 'admin',
      targetName: requestItem.student_name,
      targetId: requestItem.student_id || requestItem.tracking_number,
      trackingNumber: requestItem.tracking_number || requestItem.id,
      documentType: requestItem.document_type,
      action: `Clearance marked as ${statusToSet === 'VERIFIED' ? 'Verified' : statusToSet === 'PENDING' ? 'Pending' : 'Not Cleared / Rejected'}`,
      status: localStatus,
    });
  };

  const handleConfirmAssessmentAndIssuePayment = async () => {
    if (isAdmin) {
      toast.warning('View Only (Admin): Admins cannot confirm payment orders.');
      return;
    }
    if (isAssessmentLocked) {
      toast.warning('Payment assessment is already locked for this request.');
      return;
    }
    if (confirmingAssessment) return;
    if (!isClearanceVerified) {
      toast.warning('Please verify the student clearance first before confirming the request.');
      return;
    }
    if (isWaitingForRegistrarApproval) {
      toast.warning('Waiting for Registrar Approval: Auto-Approve is OFF. A Registrar must approve this request before Staff can confirm it.');
      return;
    }

    setConfirmingAssessment(true);
    try {
      const targetId = requestItem.id || requestItem.rawId;
      const trackingCode = requestItem.tracking_number || requestItem.trackingId || requestItem.id;
      const docName = requestItem.document_type || 'Requested Credential';
      const rawNum = parseFloat(String(assessedAmount).replace(/[^0-9.]/g, '')) || 100.0;
      const cleanAmount = rawNum.toFixed(2);

      const nowTime = Date.now();
      const nowIso = new Date(nowTime).toISOString();
      recordRequestActivityTimestamp(requestItem, nowTime);

      const targetRawId = requestItem.rawId || requestItem.id;
      const isBackendId = Boolean(targetRawId) && !String(targetRawId).startsWith('fallback_');
      let transitionRes = null;

      if (isBackendId) {
        const opRemarks = mergeStaffNoteIntoRemarks(requestItem, '');
        try {
          transitionRes = await requestsApi.transition(
            targetRawId,
            {
              status: 'PAYMENT_PENDING',
              remarks: opRemarks,
            },
            { throwOnError: true }
          );
        } catch (apiErr) {
          try {
            await requestsApi.transition(
              targetRawId,
              { status: 'REQUIREMENTS_VERIFICATION', remarks: opRemarks },
              { throwOnError: true }
            );
          } catch {}
          try {
            transitionRes = await requestsApi.transition(
              targetRawId,
              { status: 'PAYMENT_PENDING', remarks: opRemarks },
              { throwOnError: true }
            );
          } catch (err2) {
            console.warn('Backend transition notice:', apiErr, err2);
          }
        }
      }

      const persistedNextStatus = transitionRes?.status || 'PAYMENT_PENDING';
      const displayNextStatus = formatStatusDisplay(persistedNextStatus, { useReleasing: true }) || 'Pending Payment';

      // Immediately sync Registrar Auto-Approval signatory state from backend response (or active settings)
      const resolvedIsApproved = Boolean(
        transitionRes?.is_approved ?? (autoApproveEnabled ? true : localIsApproved)
      );
      const resolvedIsAutoApproved = Boolean(
        transitionRes?.is_auto_approved ?? (autoApproveEnabled && resolvedIsApproved)
      );
      const resolvedApprovedByName =
        transitionRes?.approved_by_name ||
        (resolvedIsApproved ? (localApprovedByName || activeSignatoryName || 'University Registrar') : '');

      const patch = {
        status: displayNextStatus,
        rawStatus: persistedNextStatus,
        batch_status: displayNextStatus,
        clearance_status: 'VERIFIED',
        assessed_amount: cleanAmount,
        amount: cleanAmount,
        date_of_release: dateOfRelease,
        release_date: dateOfRelease,
        verified_by_name: verifiedByName || defaultStaffName,
        or_number: '',
        payment_date: '',
        is_confirmed: true,
        confirmed_for_payment: true,
        is_approved: resolvedIsApproved,
        is_auto_approved: resolvedIsAutoApproved,
        approved_by_name: resolvedApprovedByName,
        notes: '',
        staff_notes: '',
        updated_at: nowIso,
      };
      setNotes('');
      setInitialStaffNote('');

      requestItem.status = persistedNextStatus;
      requestItem.rawStatus = persistedNextStatus;
      requestItem.batch_status = displayNextStatus;
      requestItem.clearance_status = 'VERIFIED';
      requestItem.assessed_amount = cleanAmount;
      requestItem.amount = cleanAmount;
      requestItem.date_of_release = dateOfRelease;
      requestItem.release_date = dateOfRelease;
      requestItem.verified_by_name = verifiedByName || defaultStaffName;
      requestItem.is_confirmed = true;
      requestItem.confirmed_for_payment = true;
      requestItem.is_approved = resolvedIsApproved;
      requestItem.is_auto_approved = resolvedIsAutoApproved;
      requestItem.approved_by_name = resolvedApprovedByName;

      updateStoredRequest(targetId, patch, { fallbackItem: requestItem, silentNotify: true });

      setPersistedStatus(persistedNextStatus);
      setStatusDirectly(displayNextStatus);
      setIsOrderConfirmed(true);
      setLocalIsApproved(resolvedIsApproved);
      setLocalIsAutoApproved(resolvedIsAutoApproved);
      setLocalApprovedByName(resolvedApprovedByName);

      saveStoredNotification({
        event_type: 'PAYMENT_PENDING',
        title: 'Your Request Is Ready for Payment',
        message: `Your credential request has been reviewed and confirmed. The status is now "For Payment".\n\n• Request Number: ${trackingCode}\n• Requested Document: ${docName}\n• Total Amount: ${cleanAmount}\n\nPlease download and print your official request form and proceed with payment.\n\nAfter payment, attach your Official Receipt (OR) in the Payments page.`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_role: 'student',
        target_roles: ['student'],
        target_user_id: requestItem.user || null,
        target_username: requestItem.student_id || requestItem.student_name || null,
        target_student_id: requestItem.student_id || null,
      });

      logProcessedAction({
        actor: user?.username,
        actorName: user?.full_name || user?.username,
        actorId: user?.id,
        actorRole: user?.role || 'admin',
        targetName: requestItem.student_name,
        targetId: requestItem.student_id || trackingCode,
        trackingNumber: trackingCode,
        documentType: docName,
        action: `Assessed payment (${cleanAmount}) & confirmed request`,
        status: 'Pending Payment',
      });

      if (onUpdated) {
        onUpdated({
          ...requestItem,
          ...patch,
        });
      }

      toast.success(`Request confirmed! Status updated to "Pending Payment". Student notified to pay ₱${cleanAmount}.`);
    } finally {
      setConfirmingAssessment(false);
    }
  };

  const handleRejectRequest = async () => {
    if (isAdmin) {
      toast.warning('View Only (Admin): Admins cannot reject requests.');
      return;
    }
    if (isAssessmentLocked) {
      toast.warning('Payment assessment is already locked for this request.');
      return;
    }
    const targetId = requestItem.id || requestItem.rawId;
    const trackingCode = requestItem.tracking_number || requestItem.trackingId || requestItem.id;
    const reason = notes.trim() || 'Request requirements incomplete or rejected.';

    try {
      setLoading(true);
      if (targetId && !String(targetId).startsWith('fallback_')) {
        await requestsApi.transition(targetId, {
          status: 'REJECTED',
          remarks: reason,
        });
      }

      const nowTime = Date.now();
      const nowIso = new Date(nowTime).toISOString();
      recordRequestActivityTimestamp(requestItem, nowTime);

      const rejectPatch = {
        status: 'Rejected',
        rawStatus: 'REJECTED',
        batch_status: 'Rejected',
        remarks: reason,
        rejected_by: user?.full_name || user?.username || 'Staff/Registrar',
        rejected_at: nowIso,
        updated_at: nowIso,
      };

      updateStoredRequest(targetId, rejectPatch, { fallbackItem: requestItem });

      logProcessedAction({
        actor: user?.username,
        actorName: user?.full_name || user?.username,
        actorId: user?.id,
        actorRole: user?.role || 'staff',
        targetName: requestItem.student_name,
        targetId: requestItem.student_id || trackingCode,
        trackingNumber: trackingCode,
        documentType: requestItem.document_type,
        action: `Request rejected: ${reason}`,
        status: 'Rejected',
      });

      saveStoredNotification({
        event_type: 'REQUEST_STATUS_CHANGED',
        title: 'Request Rejected',
        message: `Your request ${trackingCode} for ${requestItem.document_type || 'credential'} was rejected. Reason: ${reason}`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_role: 'student',
        target_roles: ['student'],
        target_user_id: requestItem.user || null,
        target_username: requestItem.student_id || requestItem.student_name || null,
        target_student_id: requestItem.student_id || null,
      });

      setStatusDirectly('Rejected');
      if (onUpdated) {
        onUpdated({
          ...requestItem,
          ...rejectPatch,
        });
      }

      toast.error(`Request ${trackingCode} marked as Rejected.`);
      onClose();
    } catch (err) {
      console.warn('Reject error:', err);
      const data = err.response?.data;
      let detail = 'Failed to reject request.';
      if (typeof data === 'string') detail = data;
      else if (data?.detail) detail = data.detail;
      else if (typeof data === 'object' && data !== null) {
        detail = Object.entries(data)
          .map(([k, v]) => `${k !== 'non_field_errors' ? `${k}: ` : ''}${Array.isArray(v) ? v.join(' ') : v}`)
          .join(' | ');
      } else if (err.message) {
        detail = err.message;
      }
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (actionToSet = 'VERIFIED') => {
    if (isAdmin) {
      toast.warning('View Only (Admin): Admins cannot verify payment.');
      return;
    }
    if (isPaymentLocked && actionToSet !== 'VERIFIED') {
      toast.warning('Payment verification is locked for this request.');
      return;
    }
    if (isPersistedTerminal) {
      toast.warning('Cannot modify payment for a completed or terminal request.');
      return;
    }
    if (verifyingPayment) return;
    const targetId = requestItem.id || requestItem.rawId;
    const trackingCode = requestItem.tracking_number || requestItem.id;

    if (actionToSet === 'PENDING') {
      const nowIso = new Date().toISOString();
      setPaymentStatus('PENDING');
      requestItem.status = 'Pending Payment';
      requestItem.rawStatus = 'PAYMENT_PENDING';
      requestItem.batch_status = 'Pending Payment';
      requestItem.payment_status = 'PENDING';
      requestItem.updated_at = nowIso;
      updateStoredRequest(
        targetId,
        {
          payment_status: 'PENDING',
          status: 'Pending Payment',
          rawStatus: 'PAYMENT_PENDING',
          updated_at: nowIso,
        },
        { fallbackItem: requestItem, silentNotify: true }
      );
      setPersistedStatus('PAYMENT_PENDING');
      setStatusDirectly('Pending Payment');
      if (onUpdated) {
        onUpdated({
          ...requestItem,
          status: 'Pending Payment',
          rawStatus: 'PAYMENT_PENDING',
          batch_status: 'Pending Payment',
          payment_status: 'PENDING',
          updated_at: nowIso,
        });
      }
      toast.info('Payment verification reset to pending.');
      return;
    }

    const isVerified = actionToSet === 'VERIFIED';

    if (isVerified && (!hasReceiptUploaded && !hasOrNumber)) {
      toast.warning('Cannot confirm payment: Official receipt upload or O.R. Number is required.');
      return;
    }

    setVerifyingPayment(true);
    try {
      const finalOrNumber = activeOrNumber || 'Paid at USTP Cashier (FTF)';

      const defaultConfirmNote = notes.trim() || 'Payment order confirmed by staff';

      verifyStoredPaymentProof(
        [requestItem.tracking_number, requestItem.id, requestItem.rawId],
        {
          action: isVerified ? 'VERIFY' : 'REJECT',
          remarks: isVerified ? defaultConfirmNote : (notes.trim() || 'Receipt rejected'),
        }
      );

      setPaymentStatus(isVerified ? 'VERIFIED' : 'REJECTED');
      const updatedStatus = isVerified ? 'Processing' : 'Pending Payment';
      setPersistedStatus(isVerified ? 'PAYMENT_VERIFIED' : 'PAYMENT_PENDING');
      setStatusDirectly(updatedStatus);

      const nowTime = Date.now();
      const nowIso = new Date(nowTime).toISOString();
      recordRequestActivityTimestamp(requestItem, nowTime);

      const targetRawId = requestItem.rawId || requestItem.id;
      const isBackendId = Boolean(targetRawId) && !String(targetRawId).startsWith('fallback_');
      if (isBackendId) {
        const payRemarks = !isVerified && notes.trim()
          ? mergeStaffNoteIntoRemarks(requestItem, notes.trim())
          : mergeStaffNoteIntoRemarks(requestItem, '');
        // Also verify/reject the backend Payment record itself if present
        if (latestPayment?.id && !String(latestPayment.id).startsWith('PAY-')) {
          try {
            await paymentsApi.verify(latestPayment.id, {
              action: isVerified ? 'VERIFY' : 'REJECT',
              remarks: payRemarks,
            });
          } catch (payVerifyErr) {
            console.warn('Backend payment record verify notice:', payVerifyErr);
          }
        }
        const targetPayStatus = isVerified ? 'PAYMENT_VERIFIED' : 'PAYMENT_PENDING';
        try {
          await requestsApi.transition(
            targetRawId,
            {
              status: targetPayStatus,
              remarks: payRemarks,
            },
            { throwOnError: true }
          );
        } catch (apiErr) {
          if (isVerified) {
            for (const step of ['REQUIREMENTS_VERIFICATION', 'PAYMENT_PENDING', 'PAYMENT_VERIFIED']) {
              try {
                await requestsApi.transition(
                  targetRawId,
                  { status: step, remarks: payRemarks },
                  { throwOnError: true }
                );
              } catch {}
            }
          } else {
            console.warn('Backend transition payment notice:', apiErr);
          }
        }
      }

      if (isVerified) {
        const cleanedRemarks = mergeStaffNoteIntoRemarks(requestItem, '');
        requestItem.remarks = cleanedRemarks;
        requestItem.notes = '';
        requestItem.staff_notes = '';
        setNotes('');
        setInitialStaffNote('');
      }

      const paymentPatch = {
        status: updatedStatus,
        rawStatus: isVerified ? 'PAYMENT_VERIFIED' : 'PAYMENT_PENDING',
        batch_status: updatedStatus,
        payment_status: isVerified ? 'VERIFIED' : 'REJECTED',
        or_number: finalOrNumber,
        receipt_reference_number: finalOrNumber,
        receipt_image: activeReceiptImage,
        payment_date: new Date().toISOString().split('T')[0],
        ...(isVerified ? { remarks: requestItem.remarks, notes: '', staff_notes: '' } : {}),
        updated_at: nowIso,
      };

      requestItem.status = updatedStatus;
      requestItem.rawStatus = isVerified ? 'PAYMENT_VERIFIED' : 'PAYMENT_PENDING';
      requestItem.batch_status = updatedStatus;
      requestItem.payment_status = isVerified ? 'VERIFIED' : 'REJECTED';
      requestItem.or_number = finalOrNumber;
      requestItem.updated_at = nowIso;

      updateStoredRequest(targetId, paymentPatch, { fallbackItem: requestItem, silentNotify: true });

      if (onUpdated) {
        onUpdated({
          ...requestItem,
          ...paymentPatch,
        });
      }

      logProcessedAction({
        actor: user?.username,
        actorName: user?.full_name || user?.username,
        actorId: user?.id,
        actorRole: user?.role || 'staff',
        targetName: requestItem.student_name,
        targetId: requestItem.student_id || trackingCode,
        trackingNumber: trackingCode,
        documentType: requestItem.document_type,
        action: isVerified ? `Payment order confirmed (OR: ${finalOrNumber})` : 'Payment Rejected',
        status: updatedStatus,
      });

      if (isVerified) {
        saveStoredNotification({
          event_type: 'PAYMENT_VERIFIED',
          message: `Your payment (OR: ${finalOrNumber}) for request ${trackingCode} has been verified by the Registrar. Your request status is now Processing.`,
          related_object_type: 'CredentialRequest',
          related_object_id: trackingCode,
          target_role: 'student',
          target_roles: ['student'],
          target_user_id: requestItem.user || null,
          target_username: requestItem.student_name || null,
          target_student_id: requestItem.student_id || null,
        });
        toast.success('Payment confirmed! Status updated to "Processing".');
        onClose();
      } else {
        toast.warning('Payment proof rejected. Request remains For Payment.');
      }
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleOpenClearance = async (clearanceId, directPreview) => {
    try {
      const activeUrl = clearanceDoc?.url || directPreview;
      if (activeUrl) {
        if (activeUrl.startsWith('data:')) {
          const parts = activeUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const binary = atob(parts[1]);
          const array = [];
          for (let i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
          const blob = new Blob([new Uint8Array(array)], { type: mime });
          window.open(URL.createObjectURL(blob), '_blank');
          return;
        }
        if (activeUrl.startsWith('blob:')) {
          window.open(activeUrl, '_blank');
          return;
        }
      }
      if (clearanceId) {
        toast.info('Fetching clearance document...');
        const { url } = await clearancesApi.getPreviewUrl(clearanceId);
        window.open(url, '_blank');
        return;
      }
      if (clearanceDoc?.url) {
        window.open(clearanceDoc.url, '_blank');
        return;
      }
      toast.warning('No clearance document URL found.');
    } catch (err) {
      console.warn('Failed to open clearance preview:', err);
      toast.error('Unable to open clearance file.');
    }
  };

  const handleOpenReceipt = async (receiptUrl) => {
    try {
      const activeUrl = receiptUrl || displayReceiptImage;
      if (!activeUrl) {
        toast.warning('No receipt image available to open.');
        return;
      }
      if (activeUrl.startsWith('data:')) {
        const parts = activeUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const binary = atob(parts[1]);
        const array = [];
        for (let i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
        const blob = new Blob([new Uint8Array(array)], { type: mime });
        window.open(URL.createObjectURL(blob), '_blank');
        return;
      }
      if (activeUrl.startsWith('blob:')) {
        window.open(activeUrl, '_blank');
        return;
      }
      if (activeUrl.startsWith('http') || activeUrl.startsWith('/')) {
        const res = await apiClient.get(activeUrl, { responseType: 'blob' });
        const blobUrl = URL.createObjectURL(res.data);
        window.open(blobUrl, '_blank');
        return;
      }
      window.open(activeUrl, '_blank');
    } catch (err) {
      console.warn('Failed to open receipt:', err);
      toast.error('Unable to open receipt file.');
    }
  };

  if (!isOpen || !requestItem) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (isAdmin) {
      toast.warning('View Only (Admin): Admins have read-only access to request processing.');
      return;
    }
    if (!canSubmitUpdate) {
      if (isWaitingForRegistrarApproval) {
        toast.warning('Waiting for Registrar Approval before Staff can update this request.');
      } else if (!isClearanceVerified) {
        toast.warning('Manual status override is locked: Please verify student clearance first.');
      } else if (!isStatusChanged && !hasUnsavedNotes) {
        toast.info(`Status is already set to ${localStatus || 'this status'}. Change status or add remarks to update.`);
      }
      return;
    }

    setLoading(true);

    try {
      const targetId = requestItem.rawId || requestItem.id;
      const targetRawId = requestItem.rawId || requestItem.id;
      const isBackendId = Boolean(targetRawId) && !String(targetRawId).startsWith('fallback_');
      let finalResolvedStatus = localStatus;
      let finalResolvedRawStatus = resolveModalTargetBackendStatus(localStatus);
      if (isBackendId) {
        let backendStatus = resolveModalTargetBackendStatus(localStatus);
        // When Staff advances a PROCESSING request to Ready for Release while
        // Registrar Auto-Approve is ON, submit via PENDING_REGISTRAR_APPROVAL so
        // the backend enforces the persisted Registrar Auto-Approve bypass gate.
        if (
          userRole === 'STAFF' &&
          persistedBackendStatus === REQUEST_STATUS.PROCESSING &&
          backendStatus === REQUEST_STATUS.READY_FOR_RELEASE &&
          autoApproveEnabled
        ) {
          backendStatus = 'PENDING_REGISTRAR_APPROVAL';
        }
        const trimmedNotes = notes.trim();
        const isOldUnchangedNote =
          isStatusChanged && trimmedNotes === initialStaffNote.trim();
        const effectiveNoteForTransition = isOldUnchangedNote ? '' : trimmedNotes;
        const transitionRemarks = isStatusChanged
          ? mergeStaffNoteIntoRemarks(requestItem, effectiveNoteForTransition)
          : trimmedNotes
          ? mergeStaffNoteIntoRemarks(requestItem, trimmedNotes)
          : preserveDocTagInRemarks(requestItem, requestItem.remarks || '');
        let updatedBackend = null;
        try {
          // If Registrar selects "Approved / Ready for Release" on an unapproved request,
          // record formal Registrar approval before transitioning to READY_FOR_RELEASE.
          if (
            userRole === 'REGISTRAR' &&
            backendStatus === REQUEST_STATUS.READY_FOR_RELEASE &&
            !isApproved
          ) {
            await requestsApi.approve(targetRawId);
          }
          updatedBackend = await requestsApi.transition(
            targetRawId,
            {
              status: backendStatus,
              remarks: transitionRemarks,
            },
            { throwOnError: true }
          );
        } catch (apiErr) {
          console.error('Backend status transition failed:', apiErr);
          const errMsg =
            apiErr.response?.data?.detail ||
            (typeof apiErr.response?.data === 'string' ? apiErr.response.data : null) ||
            apiErr.response?.data?.non_field_errors?.[0] ||
            apiErr.response?.data?.status?.[0] ||
            (apiErr.response?.data ? JSON.stringify(apiErr.response.data) : null) ||
            apiErr.message ||
            'Failed to update status on server.';
          toast.error(errMsg);
          // Revert uncommitted selection back to persisted backend status!
          const safePersisted = formatStatusDisplay(persistedStatus || requestItem?.status, { useReleasing: true });
          setLocalStatus(safePersisted);
          setNewStatus(safePersisted);
          setLoading(false);
          return;
        }

        if (updatedBackend?.status) {
          finalResolvedRawStatus = updatedBackend.status;
          finalResolvedStatus = formatStatusDisplay(updatedBackend.status, { useReleasing: true });
          requestItem.status = updatedBackend.status;
          requestItem.remarks = updatedBackend.remarks || transitionRemarks;
          setPersistedStatus(updatedBackend.status);
          if (updatedBackend.is_approved !== undefined) {
            setLocalIsApproved(Boolean(updatedBackend.is_approved));
            requestItem.is_approved = Boolean(updatedBackend.is_approved);
          }
          if (updatedBackend.is_auto_approved !== undefined) {
            setLocalIsAutoApproved(Boolean(updatedBackend.is_auto_approved));
            requestItem.is_auto_approved = Boolean(updatedBackend.is_auto_approved);
          }
          if (updatedBackend.approved_by_name) {
            setLocalApprovedByName(updatedBackend.approved_by_name);
            requestItem.approved_by_name = updatedBackend.approved_by_name;
          }
        }
      }

      const nowTime = Date.now();
      const nowIso = new Date(nowTime).toISOString();
      recordRequestActivityTimestamp(requestItem, nowTime);

      const trimmedNotesAfter = notes.trim();
      const clearedOnStatusChange =
        isStatusChanged && trimmedNotesAfter === initialStaffNote.trim();
      const nextStaffNote = clearedOnStatusChange ? '' : trimmedNotesAfter;
      if (clearedOnStatusChange) {
        setNotes('');
        setInitialStaffNote('');
      } else if (!isStatusChanged && trimmedNotesAfter) {
        setInitialStaffNote(trimmedNotesAfter);
      }

      const finalPatch = {
        status: finalResolvedStatus,
        rawStatus: finalResolvedRawStatus,
        remarks: requestItem.remarks || '',
        notes: nextStaffNote,
        staff_notes: nextStaffNote,
        clearance_status: clearanceStatus,
        assessed_amount: assessedAmount,
        amount: assessedAmount,
        date_of_release: dateOfRelease,
        release_date: dateOfRelease,
        verified_by_name: verifiedByName,
        is_confirmed: isOrderConfirmed,
        confirmed_for_payment: isOrderConfirmed,
        payment_status: paymentStatus,
        or_number: activeOrNumber || requestItem.or_number || '',
        updated_at: nowIso,
      };

      updateStoredRequest(requestItem.id || targetId, finalPatch, {
        fallbackItem: { ...requestItem, ...finalPatch, updated_at: nowIso },
      });

      logProcessedAction({
        actor: user?.username,
        actorName: user?.full_name || user?.username,
        actorId: user?.id,
        actorRole: user?.role || 'admin',
        targetName: requestItem.student_name,
        targetId: requestItem.student_id || requestItem.tracking_number,
        trackingNumber: requestItem.tracking_number || requestItem.id,
        documentType: requestItem.document_type,
        action: `Status updated to ${localStatus}`,
        status: localStatus,
      });

      toast.success(
        !isStatusChanged && hasUnsavedNotes
          ? `Remarks saved for request ${requestItem.tracking_number || requestItem.id}.`
          : `Request ${requestItem.tracking_number || requestItem.id} updated to ${localStatus}.`
      );

      if (onUpdated) {
        onUpdated({
          ...requestItem,
          ...finalPatch,
        });
      }
      onClose();
    } catch (err) {
      console.error('Failed to transition request:', err);
      const data = err.response?.data;
      let detail = 'Status transition failed.';
      if (typeof data === 'string') {
        detail = data;
      } else if (data?.detail) {
        detail = data.detail;
      } else if (data?.message) {
        detail = data.message;
      } else if (typeof data === 'object' && data !== null) {
        detail = Object.entries(data)
          .map(([k, v]) => `${k !== 'non_field_errors' ? `${k}: ` : ''}${Array.isArray(v) ? v.join(' ') : v}`)
          .join(' | ');
      } else if (err.message) {
        detail = err.message;
      }
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToHistory = () => {
    const targetId = requestItem.id || requestItem.rawId || requestItem.tracking_number;
    setRequestArchived(targetId, true, user, { fallbackItem: requestItem });
    logProcessedAction({
      actor: user?.username,
      actorName: user?.full_name || user?.username,
      actorId: user?.id,
      actorRole: user?.role || 'staff',
      targetName: requestItem.student_name,
      targetId: requestItem.student_id || targetId,
      trackingNumber: requestItem.tracking_number || targetId,
      documentType: requestItem.document_type,
      action: 'Document claimed by student: Moved request to History',
      status: 'Claimed',
    });
    if (onUpdated) {
      onUpdated({ ...requestItem, is_archived: true, status: 'Claimed' });
    }
    toast.success(`Request ${requestItem.tracking_number || targetId} marked as Done and moved to Request History.`);
    onClose();
  };

  const handleClaimAndMoveToHistory = async () => {
    const targetRawId = requestItem.rawId || requestItem.raw?.id || requestItem.id;
    const targetId = requestItem.id || targetRawId;
    const trackingCode = requestItem.tracking_number || requestItem.trackingId || requestItem.id;

    try {
      setLoading(true);
      if (targetRawId && !String(targetRawId).startsWith('fallback_')) {
        await requestsApi.transition(
          targetRawId,
          {
            status: 'RELEASED',
            remarks: notes.trim()
              ? mergeStaffNoteIntoRemarks(requestItem, notes.trim())
              : preserveDocTagInRemarks(requestItem, requestItem.remarks || ''),
          },
          { throwOnError: true }
        );
      }

      const claimPatch = {
        status: 'Claimed',
        rawStatus: 'RELEASED',
        batch_status: 'Claimed',
        remarks: notes || requestItem.remarks || 'Document claimed by student.',
        is_archived: true,
        in_process_queue: false,
        archived_at: new Date().toISOString(),
        archived_by: user?.full_name || user?.username || 'Staff',
      };

      updateStoredRequest(targetId, claimPatch, { fallbackItem: requestItem });
      setRequestArchived(targetId, true, user, { fallbackItem: requestItem });

      logProcessedAction({
        actor: user?.username,
        actorName: user?.full_name || user?.username,
        actorId: user?.id,
        actorRole: user?.role || 'staff',
        targetName: requestItem.student_name,
        targetId: requestItem.student_id || trackingCode,
        trackingNumber: trackingCode,
        documentType: requestItem.document_type,
        action: 'Marked Claimed & moved to History',
        status: 'Claimed',
      });

      saveStoredNotification({
        event_type: 'DOCUMENT_CLAIMED',
        title: 'Document Claimed Successfully',
        message: `Your requested credential (${requestItem.document_type}) has been officially claimed and released. Thank you!`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_role: 'student',
        target_roles: ['student'],
        target_user_id: requestItem.user || null,
        target_username: requestItem.student_id || requestItem.student_name || null,
        target_student_id: requestItem.student_id || null,
      });

      if (onUpdated) {
        onUpdated({ ...requestItem, ...claimPatch });
      }

      toast.success(`Request ${trackingCode} marked as Claimed & Done (moved to Request History)!`);
      onClose();
    } catch (err) {
      console.error('Failed to claim and archive:', err);
      toast.error('Failed to process request release.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRestore = async () => {
    const targetId = requestItem.rawId || requestItem.id;
    const trackingCode = requestItem.tracking_number || requestItem.trackingId || targetId;
    try {
      setLoading(true);
      const restored = await requestsApi.restore(targetId, {
        remarks: notes || `Restored to active queue by Admin ${user?.username || ''}`,
      });
      const restoredStatus = restored?.status || 'Pending';
      const patch = {
        ...requestItem,
        status: restoredStatus,
        rawStatus: restoredStatus,
        is_archived: false,
        in_process_queue: true,
      };
      setLocalStatus(formatStatusDisplay(restoredStatus, { useReleasing: true }));
      setNewStatus(formatStatusDisplay(restoredStatus, { useReleasing: true }));
      requestItem.status = restoredStatus;
      requestItem.in_process_queue = true;
      if (onUpdated) {
        onUpdated(patch);
      }
      toast.success(`Request ${trackingCode} restored to Active Queue (${formatStatusDisplay(restoredStatus)})!`);
    } catch (err) {
      console.error('Failed to restore request:', err);
      const msg = err.response?.data?.detail || 'Failed to restore request.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase().replace(/[_ ]/g, '-');
    const map = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'for-payment': 'bg-amber-100 text-amber-900 border-amber-300',
      'pending-payment': 'bg-amber-100 text-amber-900 border-amber-300',
      'payment-pending': 'bg-amber-100 text-amber-900 border-amber-300',
      'for-processing': 'bg-blue-100 text-blue-900 border-blue-200',
      'payment-verified': 'bg-blue-100 text-blue-900 border-blue-200',
      'processing': 'bg-sky-100 text-sky-900 border-sky-200',
      'releasing': 'bg-violet-100 text-violet-900 border-violet-200',
      'ready-for-release': 'bg-violet-100 text-violet-900 border-violet-200',
      'for-release': 'bg-violet-100 text-violet-900 border-violet-200',
      'claimed': 'bg-emerald-100 text-emerald-900 border-emerald-200',
      'released': 'bg-emerald-100 text-emerald-900 border-emerald-200',
      'on-hold': 'bg-orange-100 text-orange-900 border-orange-200',
      'requirements-verification': 'bg-orange-100 text-orange-900 border-orange-200',
      'rejected': 'bg-rose-100 text-rose-800 border-rose-300',
      'cancelled': 'bg-slate-100 text-slate-700 border-slate-200',
    };
    const cls = map[s] || 'bg-slate-100 text-slate-700 border-slate-200';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>
        {formatStatusDisplay(status, { useReleasing: true })}
      </span>
    );
  };

  const currentDisplayStatus = localStatus || newStatus || requestItem.status || 'Pending';

  return (
    <>
      <div className="staff-process-backdrop" onClick={onClose}>
        <div className="staff-process-dialog max-w-3xl" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          {/* Sticky Header */}
          <div className="staff-process-header flex-wrap gap-2.5 sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="staff-process-title">Process Credential Request</h2>
                <span className="text-[11px] sm:text-xs font-mono font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 whitespace-nowrap">
                  {requestItem.tracking_number || requestItem.id}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#0B0B36] hover:bg-[#1E1E6B] text-white text-[11px] sm:text-xs font-bold rounded-lg transition-colors flex items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                title="View & print official updated request form"
              >
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print Form</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="staff-process-close-btn"
                title="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleUpdate} className="staff-process-form">
            <div className="staff-process-body space-y-4">

              {/* Box 1: Request Summary */}
              <div className="staff-process-box">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-3">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    1. Request Summary
                  </span>
                  <div>{getStatusBadge(requestItem?.status)}</div>
                </div>

                <div className="staff-process-grid-2">
                  <div className="staff-field-group">
                    <span className="staff-field-label">Student Name</span>
                    <div className="staff-field-pill font-bold">{requestItem.student_name || 'N/A'}</div>
                  </div>
                  <div className="staff-field-group">
                    <span className="staff-field-label">Student ID</span>
                    <div className="staff-field-pill font-mono">{requestItem.student_id || 'N/A'}</div>
                  </div>
                </div>

                <div className="staff-process-grid-2 mt-3">
                  <div className="staff-field-group">
                    <span className="staff-field-label">Document</span>
                    <div className="staff-field-pill font-semibold text-indigo-950">
                      {(() => {
                        const items = extractDocumentItems(liveRequestDetail || requestItem);
                        if (items.length > 1) {
                          return items.map((it) => `${it.name} (${it.copies})`).join(', ');
                        }
                        return requestItem.document_type || items[0]?.name || 'N/A';
                      })()}
                    </div>
                  </div>
                  <div className="staff-field-group">
                    <span className="staff-field-label">Copies</span>
                    <div className="staff-field-pill">
                      {(() => {
                        const c = extractRequestedCopies(liveRequestDetail || requestItem);
                        return `${c} ${c === 1 ? 'copy' : 'copies'}`;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="staff-field-label">Purpose</span>
                  <div className="staff-field-box text-xs">
                    {formatCleanPurpose(requestItem.purpose || requestItem.remarks)}
                  </div>
                </div>

                {(isPersistedRejected || isPersistedRequirementsRejected || Boolean(requestItem?.remarks && sanitizeRemarks(requestItem.remarks))) && (
                  <div className="mt-3">
                    <span className="staff-field-label">
                      {isPersistedRejected || isPersistedRequirementsRejected ? 'Rejection Reason / Remarks' : 'Remarks / Notes'}
                    </span>
                    <div className={`staff-field-box text-xs ${
                      isPersistedRejected || isPersistedRequirementsRejected ? 'bg-rose-50 text-rose-800 border-rose-200' : ''
                    }`}>
                      {extractStaffRemark(requestItem) || (isPersistedRejected ? 'Request requirements incomplete or rejected.' : '—')}
                    </div>
                  </div>
                )}
              </div>

              {/* Box 2: Student Clearance */}
              <div className="staff-process-box">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-3">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>2. Student Clearance</span>
                  </span>
                  {clearanceStatus === 'VERIFIED' || clearanceStatus === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <svg className="w-3 h-3 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Verified</span>
                    </span>
                  ) : clearanceStatus === 'REJECTED' || clearanceStatus === 'NOT_VERIFIED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <svg className="w-3 h-3 text-rose-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Not Cleared</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <svg className="w-3 h-3 text-amber-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Pending Verification</span>
                    </span>
                  )}
                </div>

                {loadingClearance ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-500">
                    <svg className="w-4 h-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Loading clearance...</span>
                  </div>
                ) : clearanceDoc || requestItem.clearance_preview || requestItem.clearance_id ? (
                  <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {clearanceDoc?.isPdf || requestItem.clearance_is_pdf ? (
                          <div
                            className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex flex-col items-center justify-center font-bold text-xs shrink-0 border border-red-200 cursor-pointer"
                            onClick={() => setShowInlineClearance((p) => !p)}
                          >
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[8px] uppercase font-bold tracking-tight">PDF</span>
                          </div>
                        ) : (
                          <img
                            src={clearanceDoc?.url || requestItem.clearance_preview}
                            alt="Clearance"
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer"
                            onClick={() => setShowInlineClearance((p) => !p)}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {clearanceDoc?.fileName || requestItem.clearance_file_name || 'Certificate_of_Clearance.pdf'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0">
                        {reviewingClearance ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold text-xs rounded-lg">
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Reviewing...</span>
                          </div>
                        ) : clearanceStatus === 'VERIFIED' || clearanceStatus === 'APPROVED' ? (
                          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Clearance Verified</span>
                          </div>
                        ) : clearanceStatus === 'REJECTED' || clearanceStatus === 'NOT_VERIFIED' ? (
                          <>
                            <div className="px-3 py-1.5 bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs rounded-lg flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span>Clearance Rejected</span>
                            </div>
                            <button
                              type="button"
                              disabled={reviewingClearance}
                              onClick={() => handleVerifyClearance('PENDING')}
                              className="px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-indigo-200"
                              title="Re-review clearance"
                            >
                              Re-review
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={reviewingClearance}
                              onClick={() => handleVerifyClearance('VERIFIED')}
                              className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Verify</span>
                            </button>
                            <button
                              type="button"
                              disabled={reviewingClearance}
                              onClick={() => handleVerifyClearance('REJECTED')}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300"
                              title="Reject clearance"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowInlineClearance((p) => !p)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer"
                        >
                          {showInlineClearance ? 'Hide' : 'Preview'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenClearance(requestItem.clearance_id, clearanceDoc?.url || requestItem.clearance_preview)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer flex items-center gap-1"
                          title="Open clearance document in a new tab"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open in Tab
                        </button>
                      </div>
                    </div>

                    {showInlineClearance && (
                      <div className="pt-2 border-t border-slate-200">
                        {clearanceDoc?.isPdf || requestItem.clearance_is_pdf ? (
                          <iframe
                            src={clearanceDoc?.url || requestItem.clearance_preview}
                            title="Clearance Document"
                            className="w-full h-72 rounded-lg border border-slate-300 bg-white"
                          />
                        ) : (
                          <div className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-2 flex items-center justify-center">
                            <img
                              src={clearanceDoc?.url || requestItem.clearance_preview}
                              alt="Clearance Full View"
                              className="max-h-72 object-contain rounded"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-600">No clearance attached.</span>
                    {clearanceStatus === 'VERIFIED' || clearanceStatus === 'APPROVED' ? (
                      <div className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Clearance Verified</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleVerifyClearance('VERIFIED')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                      >
                        Mark Cleared
                      </button>
                    )}
                  </div>
                )}

                {/* Passport / 2×2 Photo */}
                {requestItem.photo_preview && (
                  <div className="mt-2 p-3 bg-slate-50/70 border border-slate-200 rounded-xl flex items-center gap-3">
                    <img
                      src={requestItem.photo_preview}
                      alt="Attached 2x2 Photo"
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-900 block">Passport / 2×2 Photo</span>
                      <span className="text-[11px] text-emerald-700 font-semibold">Uploaded by Student</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenClearance(null, requestItem.photo_preview)}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open in Tab
                    </button>
                  </div>
                )}
              </div>

              {/* Box 3: Payment Assessment */}
              <div className="staff-process-box border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2 mb-3">
                  <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="2" y1="10" x2="22" y2="10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>3. Payment Assessment</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Payment Amount *</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-sm font-bold text-slate-500 select-none">₱</span>
                      <input
                        type="text"
                        value={assessedAmount}
                        disabled={isAssessmentLocked}
                        readOnly={isAssessmentLocked}
                        tabIndex={isAssessmentLocked ? -1 : undefined}
                        aria-disabled={isAssessmentLocked ? 'true' : undefined}
                        onChange={(e) => {
                          if (isAssessmentLocked) return;
                          const clean = e.target.value.replace(/[^0-9.]/g, '');
                          setAssessedAmount(clean);
                        }}
                        placeholder="100.00"
                        className={`w-full pl-8 pr-3 py-2 text-sm font-bold text-indigo-950 border rounded-lg focus:outline-none ${
                          isAssessmentLocked
                            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed select-text'
                            : 'border-indigo-200 focus:border-indigo-600 bg-white'
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Release Date *</label>
                    <CompactDatePicker
                      value={dateOfRelease}
                      disabled={isAssessmentLocked}
                      readOnly={isAssessmentLocked}
                      onChange={(val) => {
                        if (isAssessmentLocked) return;
                        setDateOfRelease(val);
                        setTurnaroundHint('');
                      }}
                      className={`px-3 py-2 text-xs border rounded-lg focus:outline-none ${
                        isAssessmentLocked
                          ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                          : 'border-slate-300 focus:border-indigo-600 bg-white'
                      }`}
                    />
                    {turnaroundHint && (
                      <p className="text-[10px] text-slate-500 mt-1">{turnaroundHint}</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Verified by *</label>
                    <input
                      type="text"
                      value={verifiedByName}
                      disabled={isAssessmentLocked}
                      readOnly={isAssessmentLocked}
                      tabIndex={isAssessmentLocked ? -1 : undefined}
                      aria-disabled={isAssessmentLocked ? 'true' : undefined}
                      onChange={(e) => {
                        if (isAssessmentLocked) return;
                        setVerifiedByName(e.target.value);
                      }}
                      className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none ${
                        isAssessmentLocked
                          ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                          : 'border-slate-300 focus:border-indigo-600 bg-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Approved by</label>
                    {isApproved ? (
                      <div
                        data-testid="approved-by-display"
                        className="px-3 py-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold rounded-lg flex items-center justify-between shadow-2xs"
                      >
                        <span className="truncate" title={approvedByName}>
                          {isAutoApproved
                            ? `Auto-Approved (${approvedByName || 'University Registrar'})`
                            : (approvedByName || 'University Registrar')}
                        </span>
                        <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-extrabold px-1.5 py-0.5 rounded shrink-0 ml-1">
                          Approved
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <div
                          data-testid="approved-by-display"
                          className="px-3 py-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 font-semibold rounded-lg flex-1 min-w-[180px]"
                        >
                          Pending Registrar Approval
                        </div>
                        {isRegistrarOrAdmin && (
                          <button
                            type="button"
                            data-testid="approve-request-btn"
                            disabled={approvingRequest || isPersistedTerminal || isAdmin}
                            aria-disabled={approvingRequest || isPersistedTerminal || isAdmin ? 'true' : undefined}
                            tabIndex={approvingRequest || isPersistedTerminal || isAdmin ? -1 : undefined}
                            onClick={handleApproveRequest}
                            className={`px-3 py-2 font-bold text-xs rounded-lg shadow-sm transition-all whitespace-nowrap ${
                              isAdmin || approvingRequest || isPersistedTerminal
                                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                                : 'bg-indigo-900 hover:bg-indigo-950 text-white cursor-pointer'
                            }`}
                            title={
                              isAdmin
                                ? 'View Only (Admin): Admins cannot approve requests'
                                : 'Approve this credential request'
                            }
                          >
                            {approvingRequest ? 'Approving...' : 'Approve Request'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {isPersistedRejected ? (
                      <span className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Request Rejected</span>
                      </span>
                    ) : isOrderConfirmed ? (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Request Confirmed (Pending Payment)</span>
                      </span>
                    ) : !isClearanceVerified ? (
                      <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Verify clearance above to unlock confirmation</span>
                      </span>
                    ) : isWaitingForRegistrarApproval ? (
                      <span
                        data-testid="waiting-registrar-approval-notice"
                        className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Waiting for Registrar Approval</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setIsPrintModalOpen(true)}
                        className="flex-1 sm:flex-initial min-w-0 justify-center px-2 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-[11px] sm:text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap"
                      >
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Preview Form</span>
                      </button>
                      {isPersistedRejected || isPersistedRequirementsRejected ? (
                        <div className="flex-1 sm:flex-initial min-w-0 justify-center px-2 sm:px-3.5 py-1.5 sm:py-2 bg-rose-50 border border-rose-300 text-rose-800 font-bold text-[11px] sm:text-xs rounded-xl flex items-center gap-1 sm:gap-1.5 shadow-2xs whitespace-nowrap">
                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Request Rejected</span>
                        </div>
                      ) : isAssessmentLocked ? (
                        <div className="flex-1 sm:flex-initial min-w-0 justify-center px-2 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-[11px] sm:text-xs rounded-xl flex items-center gap-1 sm:gap-1.5 shadow-2xs whitespace-nowrap">
                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Order of Payment Issued</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isAssessmentLocked}
                          aria-disabled={isAssessmentLocked ? 'true' : undefined}
                          tabIndex={isAssessmentLocked ? -1 : undefined}
                          onClick={handleRejectRequest}
                          className={`flex-1 sm:flex-initial min-w-0 justify-center px-2 sm:px-3.5 py-1.5 sm:py-2 font-bold text-[11px] sm:text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                            isAssessmentLocked
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none pointer-events-none opacity-50'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 cursor-pointer'
                          }`}
                          title={isAdmin ? 'View Only (Admin): Admins cannot reject requests' : 'Reject this request'}
                        >
                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Reject Request</span>
                        </button>
                      )}
                    </div>
                    {!isPersistedRejected && !isPersistedRequirementsRejected && !isAssessmentLocked && (
                      <button
                        type="button"
                        disabled={!isClearanceVerified || confirmingAssessment || isWaitingForRegistrarApproval || isAssessmentLocked}
                        aria-disabled={!isClearanceVerified || confirmingAssessment || isWaitingForRegistrarApproval || isAssessmentLocked ? 'true' : undefined}
                        tabIndex={!isClearanceVerified || confirmingAssessment || isWaitingForRegistrarApproval || isAssessmentLocked ? -1 : undefined}
                        onClick={handleConfirmAssessmentAndIssuePayment}
                        className={`w-full sm:w-auto justify-center px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                          isClearanceVerified && !confirmingAssessment && !isWaitingForRegistrarApproval && !isAssessmentLocked
                            ? 'bg-indigo-900 hover:bg-indigo-950 text-white shadow-md cursor-pointer'
                            : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none pointer-events-none opacity-50'
                        }`}
                        title={
                          isAdmin
                            ? 'View Only (Admin): Admins cannot confirm payment orders'
                            : !isClearanceVerified
                            ? 'Please verify student clearance first before confirming the request.'
                            : isWaitingForRegistrarApproval
                            ? 'Waiting for Registrar Approval: Auto-Approve is OFF. A Registrar must approve first.'
                            : 'Confirm request and order of payment'
                        }
                      >
                        <span>Confirm Request & Order of Payment</span>
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Box 4: Payment Verification */}
              <div className="staff-process-box">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-3">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4m-7 9l3-1.5 3 1.5 3-1.5 3 1.5V4l-3 1.5L14 4l-3 1.5L8 4 5 5.5v16.5l3-1.5z" />
                    </svg>
                    <span>4. Payment Verification</span>
                  </span>
                  {paymentStatus === 'VERIFIED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <svg className="w-3 h-3 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Verified</span>
                    </span>
                  ) : paymentProof || requestItem.or_number ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <svg className="w-3 h-3 text-amber-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Pending Verification</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Awaiting Payment
                    </span>
                  )}
                </div>

                {/* Online Upload Proof, Local Attach, or Notice */}
                {hasReceiptUploaded || paymentProof || activeOrNumber || requestItem.or_number ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3" data-testid="payment-receipt-box">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {hasReceiptUploaded ? (
                          loadingReceiptBlob ? (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : receiptIsPdf || !displayReceiptImage ? (
                            <div
                              onClick={() => setShowInlineReceipt((p) => !p)}
                              className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-[10px] shrink-0 cursor-pointer"
                            >
                              {receiptIsPdf ? 'PDF' : 'FILE'}
                            </div>
                          ) : (
                            <img
                              src={displayReceiptImage}
                              alt="Official Receipt"
                              data-testid="receipt-thumbnail-img"
                              className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer"
                              onClick={() => setShowInlineReceipt((p) => !p)}
                            />
                          )
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-lg shrink-0">
                            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4m-7 9l3-1.5 3 1.5 3-1.5 3 1.5V4l-3 1.5L14 4l-3 1.5L8 4 5 5.5v16.5l3-1.5z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-slate-900 block truncate">Official Receipt</span>
                          <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap gap-2">
                            <span>Amount: <strong className="text-indigo-900">{latestPayment?.amount || paymentProof?.amount || assessedAmount}</strong></span>
                            <span>•</span>
                            <span>Reference: <strong className="font-mono text-slate-800">{activeOrNumber || 'N/A'}</strong></span>
                          </div>
                        </div>
                      </div>
                      {hasReceiptUploaded && (
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowInlineReceipt((p) => !p)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer"
                          >
                            {showInlineReceipt ? 'Hide' : 'Preview'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(displayReceiptImage || activeReceiptImage)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer flex items-center gap-1"
                            title="Open official receipt in a new tab"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open in Tab
                          </button>
                        </div>
                      )}
                    </div>

                    {showInlineReceipt && hasReceiptUploaded && (
                      <div className="pt-2 border-t border-slate-200">
                        {loadingReceiptBlob ? (
                          <div className="h-40 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                            Loading receipt preview...
                          </div>
                        ) : receiptIsPdf && displayReceiptImage ? (
                          <iframe
                            src={displayReceiptImage}
                            title="Official Receipt PDF"
                            className="w-full h-72 rounded-lg border border-slate-300 bg-white"
                          />
                        ) : displayReceiptImage ? (
                          <div className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-2 flex items-center justify-center">
                            <img
                              src={displayReceiptImage}
                              alt="Official Receipt"
                              data-testid="receipt-full-img"
                              className="max-h-64 object-contain rounded"
                            />
                          </div>
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-500">
                            Receipt preview unavailable. Click "Open in Tab" to view.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                    No receipt uploaded by student yet.
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="O.R. Number *"
                      value={walkinOrNumber}
                      onChange={(e) => {
                        if (isAdmin || paymentStatus === 'VERIFIED' || isPersistedTerminal || isPaymentLocked) return;
                        setWalkinOrNumber(e.target.value);
                      }}
                      disabled={isAdmin || paymentStatus === 'VERIFIED' || isPersistedTerminal || isPaymentLocked}
                      readOnly={isAdmin || paymentStatus === 'VERIFIED' || isPersistedTerminal || isPaymentLocked}
                      tabIndex={isAdmin || paymentStatus === 'VERIFIED' || isPersistedTerminal || isPaymentLocked ? -1 : undefined}
                      aria-disabled={isAdmin || paymentStatus === 'VERIFIED' || isPersistedTerminal || isPaymentLocked ? 'true' : undefined}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 font-mono font-bold"
                    />
                  </div>
                  {paymentStatus === 'VERIFIED' ? (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Payment Confirmed</span>
                      </div>
                      {!isPaymentLocked && (
                        <button
                          type="button"
                          onClick={() => handleVerifyPayment('PENDING')}
                          disabled={isAdmin || isPersistedTerminal || isPaymentLocked}
                          aria-disabled={isAdmin || isPersistedTerminal || isPaymentLocked ? 'true' : undefined}
                          tabIndex={isAdmin || isPersistedTerminal || isPaymentLocked ? -1 : undefined}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors border text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer border-transparent hover:border-rose-200"
                          title="Change or re-verify payment"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  ) : paymentStatus === 'REJECTED' ? (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <div className="px-3 py-1.5 bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs rounded-lg flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Payment Rejected</span>
                      </div>
                      <button
                        type="button"
                        disabled={!canConfirmPayment || isAdmin || isPersistedTerminal || isPaymentLocked}
                        aria-disabled={!canConfirmPayment || isAdmin || isPersistedTerminal || isPaymentLocked ? 'true' : undefined}
                        tabIndex={!canConfirmPayment || isAdmin || isPersistedTerminal || isPaymentLocked ? -1 : undefined}
                        onClick={() => handleVerifyPayment('VERIFIED')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          canConfirmPayment && !isAdmin && !isPersistedTerminal && !isPaymentLocked
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                            : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                        }`}
                        title={
                          isAdmin
                            ? 'View Only (Admin)'
                            : isPaymentLocked
                            ? 'Payment is locked'
                            : !hasReceiptUploaded && !hasOrNumber
                            ? 'Cannot confirm payment: Please enter the O.R. Number or upload receipt'
                            : 'Confirm and verify payment'
                        }
                      >
                        Confirm Payment
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        data-testid="confirm-payment-order-btn"
                        disabled={!canConfirmPayment || verifyingPayment || isAdmin || isPersistedTerminal || isPaymentLocked}
                        aria-disabled={!canConfirmPayment || verifyingPayment || isAdmin || isPersistedTerminal || isPaymentLocked ? 'true' : undefined}
                        tabIndex={!canConfirmPayment || verifyingPayment || isAdmin || isPersistedTerminal || isPaymentLocked ? -1 : undefined}
                        onClick={() => handleVerifyPayment('VERIFIED')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          canConfirmPayment && !verifyingPayment && !isAdmin && !isPersistedTerminal && !isPaymentLocked
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                            : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                        }`}
                        title={
                          isAdmin
                            ? 'View Only (Admin): Admins cannot confirm payment orders'
                            : isPaymentLocked
                            ? 'Payment verification locked'
                            : !hasReceiptUploaded && !hasOrNumber
                            ? 'Cannot confirm payment: Please enter the O.R. Number or upload receipt'
                            : 'Confirm payment order and move to processing'
                        }
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>
                          {verifyingPayment
                            ? 'Confirming...'
                            : persistedBackendStatus === REQUEST_STATUS.PAYMENT_PENDING
                            ? 'Confirm Payment Order'
                            : 'Confirm Payment'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={(!hasReceiptUploaded && !paymentProof) || verifyingPayment || isAdmin || isPersistedTerminal || isPaymentLocked}
                        aria-disabled={(!hasReceiptUploaded && !paymentProof) || verifyingPayment || isAdmin || isPersistedTerminal || isPaymentLocked ? 'true' : undefined}
                        tabIndex={(!hasReceiptUploaded && !paymentProof) || verifyingPayment || isAdmin || isPersistedTerminal || isPaymentLocked ? -1 : undefined}
                        onClick={() => handleVerifyPayment('REJECTED')}
                        className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                          (hasReceiptUploaded || paymentProof) && !verifyingPayment && !isAdmin && !isPersistedTerminal && !isPaymentLocked
                            ? 'cursor-pointer bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                            : 'cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                        title={
                          isAdmin
                            ? 'View Only (Admin): Admins cannot reject payments'
                            : isPaymentLocked
                            ? 'Payment is locked'
                            : !hasReceiptUploaded && !paymentProof
                            ? 'No payment submission to reject'
                            : 'Reject payment proof'
                        }
                      >
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Manual Status Override */}
              <div className="staff-form-group pt-2">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="staff-form-label mb-0">Manual Status Override</label>
                  {!canOverrideStatus && (
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 shadow-2xs">
                      <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>
                        {isPersistedTerminal && !isAdmin
                          ? 'Locked: Request completed'
                          : isWaitingForRegistrarApproval
                          ? 'Locked: Waiting for Registrar Approval'
                          : 'Locked: Clearance not yet verified'}
                      </span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CustomSelectDropdown
                    value={localStatus || newStatus || 'Pending'}
                    onChange={handleManualStatusChange}
                    disabled={!canOverrideStatus}
                    options={statusOptions}
                    buttonClassName={`staff-select-input ${
                      !canOverrideStatus
                        ? 'opacity-60 bg-slate-100 cursor-not-allowed border-slate-300 text-slate-500'
                        : ''
                    }`}
                    title={
                      isPersistedTerminal && !isAdmin
                        ? 'Manual status override is locked: Request is already completed.'
                        : isWaitingForRegistrarApproval
                        ? 'Manual status override is locked: Waiting for Registrar Approval.'
                        : !isClearanceVerified
                        ? 'Manual status override is locked: Please verify student clearance first.'
                        : 'Select status to override'
                    }
                  />
                  <input
                    type="text"
                    placeholder="Staff remarks / notes (optional)..."
                    value={notes}
                    onChange={(e) => {
                      if (!canEditRemarks) return;
                      setNotes(e.target.value);
                    }}
                    disabled={!canEditRemarks}
                    readOnly={!canEditRemarks}
                    tabIndex={!canEditRemarks ? -1 : undefined}
                    aria-disabled={!canEditRemarks ? 'true' : undefined}
                    className={`staff-notes-input ${
                      !canEditRemarks
                        ? 'opacity-60 bg-slate-100 cursor-not-allowed border-slate-300 text-slate-500'
                        : ''
                    }`}
                  />
                </div>
                {!canOverrideStatus && (
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>
                      {isPersistedTerminal && !isAdmin
                        ? 'Manual status override is locked for completed requests.'
                        : isWaitingForRegistrarApproval
                        ? 'Manual status override is locked until the Registrar approves this request.'
                        : 'Manual status override cannot be changed until clearance is verified.'}
                    </span>
                  </p>
                )}
              </div>

            </div>

            {/* Sticky Footer */}
            <div className="staff-process-footer flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="staff-btn-back"
                >
                  <span>Close</span>
                </button>

                {/* If already Claimed / Released, show status */}
                {isPersistedReleased && (
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Document Claimed & Released</span>
                  </span>
                )}

                {/* Admin Restore Button for Terminal State Requests */}
                {isPersistedTerminal && isAdmin && (
                  <button
                    type="button"
                    onClick={handleAdminRestore}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                    title="Restore request back to active processing queue"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Restore Request</span>
                  </button>
                )}

                {/* Claimed & Done: ONLY when persisted backend status is READY_FOR_RELEASE, payment verified, and registrar approved */}
                {isPersistedReadyForRelease && isPaymentVerified && isApproved && (
                  <button
                    type="button"
                    onClick={handleClaimAndMoveToHistory}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                    title="Mark document as claimed by student and complete as Done"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Claimed & Done</span>
                  </button>
                )}

                {/* Print Claim Stub: ONLY when persisted backend status is READY_FOR_RELEASE (and payment verified) OR already released */}
                {(isPersistedReadyForRelease || isPersistedReleased) && isPaymentVerified && (
                  <button
                    type="button"
                    onClick={() => setShowClaimStubModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all cursor-pointer"
                    title="Print or download official Claim Stub slip for the student"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM7 9V5a2 2 0 012-2h6a2 2 0 012 2v4" />
                    </svg>
                    <span>Print Claim Stub</span>
                  </button>
                )}
              </div>

              {!isAdmin && !isStaffPaymentConfirmationStep && (
                <button
                  type="submit"
                  disabled={!canSubmitUpdate || isPersistedTerminal}
                  className={`staff-btn-update ${
                    !canSubmitUpdate || isPersistedTerminal
                      ? 'opacity-40 cursor-not-allowed bg-slate-400 hover:bg-slate-400 text-white'
                      : ''
                  }`}
                  title={
                    isPersistedTerminal
                      ? 'This request is completed or closed. Further edits are disabled.'
                      : !isStatusChanged && hasUnsavedNotes && canEditRemarks
                      ? 'Save remarks / notes'
                      : !canOverrideStatus && isStatusChanged
                      ? 'Manual status override is locked: Verify clearance first'
                      : !isStatusChanged && !hasUnsavedNotes
                      ? 'Change the status or enter remarks/notes to update.'
                      : 'Update request status'
                  }
                >
                  {loading
                    ? 'Updating...'
                    : !isStatusChanged && hasUnsavedNotes
                    ? 'Save Remarks'
                    : 'Update Status'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Print Request Form Modal */}
      <PrintRequestFormModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        requestData={{
          ...requestItem,
          assessed_amount: assessedAmount,
          amount: assessedAmount,
          date_of_release: dateOfRelease,
          verified_by_name: verifiedByName,
          approved_by_name: approvedByName,
        }}
      />

      {/* Official Claim Stub Modal (issued once payment is settled) */}
      {showClaimStubModal && (
        <ClaimStubModal
          isOpen={showClaimStubModal}
          onClose={() => setShowClaimStubModal(false)}
          claimStubDetails={claimStubDetails}
          trackingNumber={requestItem?.tracking_number || requestItem?.id}
        />
      )}
    </>
  );
}
