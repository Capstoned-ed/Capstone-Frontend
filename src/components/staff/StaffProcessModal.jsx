import React, { useState, useEffect, useMemo } from 'react';
import clearancesApi, { resolveClearancePreview } from '../../api/clearances';
import requestsApi, { updateStoredRequest, logProcessedAction } from '../../api/requests';
import { saveStoredNotification } from '../../api/notifications';
import { getStoredPaymentProof, verifyStoredPaymentProof } from '../../api/payments';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import PrintRequestFormModal from '../student/PrintRequestFormModal';

export default function StaffProcessModal({
  selectedRequest,
  newStatus,
  setNewStatus,
  notes,
  setNotes,
  updating,
  onUpdateStatus,
  onBackToList,
  onRequestUpdated,
  requestStatuses = [],
  getStatusBadge,
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [showInlineClearance, setShowInlineClearance] = useState(false);
  const [clearanceDoc, setClearanceDoc] = useState(null);
  const [loadingClearance, setLoadingClearance] = useState(false);
  const [clearanceStatus, setClearanceStatus] = useState(() => {
    const raw = selectedRequest?.clearance_status;
    if (raw === 'VERIFIED' || raw === 'APPROVED') return 'VERIFIED';
    if (raw === 'REJECTED' || raw === 'NOT_VERIFIED') return 'REJECTED';
    return selectedRequest?.clearance_preview || selectedRequest?.clearance_id ? 'PENDING' : 'NOT_ATTACHED';
  });

  // Payment Assessment Fields (Step 2)
  const defaultStaffName = user?.full_name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username) || 'Front Desk Personnel';
  const [assessedAmount, setAssessedAmount] = useState('₱100.00');
  const [dateOfRelease, setDateOfRelease] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [verifiedByName, setVerifiedByName] = useState(defaultStaffName);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(() => {
    const s = String(selectedRequest?.status || '').toUpperCase();
    return Boolean(
      selectedRequest?.is_confirmed ||
      selectedRequest?.confirmed_for_payment ||
      s === 'FOR PAYMENT' ||
      s === 'FOR_PAYMENT' ||
      s === 'PAYMENT_PENDING' ||
      s === 'PENDING PAYMENT' ||
      s === 'FOR PROCESSING' ||
      s === 'PROCESSING' ||
      s === 'RELEASING' ||
      s === 'CLAIMED'
    );
  });

  // Payment Proof States (Step 6)
  const [paymentProof, setPaymentProof] = useState(null);
  const [walkinOrNumber, setWalkinOrNumber] = useState('');
  const [showInlineReceipt, setShowInlineReceipt] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(() => {
    const s = String(selectedRequest?.status || '').toUpperCase();
    const isPastPayment =
      s === 'FOR PROCESSING' ||
      s === 'FOR_PROCESSING' ||
      s === 'PROCESSING' ||
      s === 'RELEASING' ||
      s === 'READY_FOR_RELEASE' ||
      s === 'CLAIMED' ||
      s === 'RELEASED';
    if (selectedRequest?.payment_status === 'VERIFIED' || (isPastPayment && selectedRequest?.or_number)) {
      return 'VERIFIED';
    }
    if (selectedRequest?.payment_status === 'REJECTED') {
      return 'REJECTED';
    }
    if (selectedRequest?.receipt_image || selectedRequest?.or_number || selectedRequest?.payment_status === 'PAYMENT_SUBMITTED') {
      return 'PENDING';
    }
    return 'NOT_SUBMITTED';
  });
  const [isPhysicalSubmission, setIsPhysicalSubmission] = useState(false);

  const activeReceiptImage =
    paymentProof?.receiptImage ||
    paymentProof?.receiptDataUrl ||
    selectedRequest?.receipt_image ||
    null;

  const hasReceiptUploaded = Boolean(activeReceiptImage);

  const activeOrNumber = (
    walkinOrNumber.trim() ||
    paymentProof?.receiptReferenceNumber ||
    selectedRequest?.or_number ||
    ''
  );

  const hasOrNumber = Boolean(activeOrNumber);

  const canConfirmPayment = Boolean(hasReceiptUploaded && hasOrNumber);

  // Local status tracker to guarantee immediate visual sync of the "Manual Status Override" dropdown
  const normalizeStatus = (val) => (val === 'Pending Payment' ? 'For Payment' : val);
  const [localStatus, setLocalStatus] = useState(() => normalizeStatus(newStatus || selectedRequest?.status || 'Pending'));

  useEffect(() => {
    if (newStatus) {
      setLocalStatus(normalizeStatus(newStatus));
    }
  }, [newStatus]);

  const handleManualStatusChange = (val) => {
    const cleanVal = normalizeStatus(val);
    setLocalStatus(cleanVal);
    if (setNewStatus) setNewStatus(cleanVal);
  };

  // Status options for Manual Status Override dropdown - guarantees 'For Payment' is ALWAYS present
  const statusOptions = useMemo(() => {
    const defaultStatuses = [
      'Pending',
      'For Payment',
      'For Processing',
      'Processing',
      'Releasing',
      'Claimed',
    ];
    const base = (Array.isArray(requestStatuses) && requestStatuses.length > 0
      ? [...requestStatuses]
      : defaultStatuses
    ).filter((st) => st !== 'Pending Payment');

    if (!base.includes('For Payment')) {
      const pendingIdx = base.indexOf('Pending');
      if (pendingIdx !== -1) {
        base.splice(pendingIdx + 1, 0, 'For Payment');
      } else {
        base.unshift('For Payment');
      }
    }

    const currentVal = normalizeStatus(localStatus || newStatus);
    if (currentVal && !base.includes(currentVal)) {
      base.push(currentVal);
    }

    return base;
  }, [requestStatuses, localStatus, newStatus]);

  useEffect(() => {
    if (!selectedRequest) return;

    let ignore = false;
    let cleanupFn = null;

    const rawClearance = selectedRequest?.clearance_status;
    if (rawClearance === 'VERIFIED' || rawClearance === 'APPROVED') {
      setClearanceStatus('VERIFIED');
    } else if (rawClearance === 'REJECTED' || rawClearance === 'NOT_VERIFIED') {
      setClearanceStatus('REJECTED');
    } else {
      setClearanceStatus(
        selectedRequest?.clearance_preview || selectedRequest?.clearance_id ? 'PENDING' : 'NOT_ATTACHED'
      );
    }

    // Initial assessment amounts
    const baseAmt = selectedRequest.assessed_amount || selectedRequest.amount || selectedRequest.price || '₱100.00';
    setAssessedAmount(
      typeof baseAmt === 'number' ? `₱${baseAmt.toFixed(2)}` : String(baseAmt).startsWith('₱') || String(baseAmt).startsWith('P') ? String(baseAmt) : `₱${baseAmt}`
    );

    if (selectedRequest.date_of_release || selectedRequest.release_date) {
      setDateOfRelease(selectedRequest.date_of_release || selectedRequest.release_date);
    }
    if (selectedRequest.verified_by_name) {
      setVerifiedByName(selectedRequest.verified_by_name);
    }

    const s = String(selectedRequest.status || '').toUpperCase();
    setIsOrderConfirmed(
      Boolean(
        selectedRequest.is_confirmed ||
        selectedRequest.confirmed_for_payment ||
        s === 'FOR PAYMENT' ||
        s === 'FOR_PAYMENT' ||
        s === 'PAYMENT_PENDING' ||
        s === 'PENDING PAYMENT' ||
        s === 'FOR PROCESSING' ||
        s === 'PROCESSING' ||
        s === 'RELEASING' ||
        s === 'CLAIMED'
      )
    );

    // Proof of payment must strictly match THIS request (by tracking_number, id, or rawId)
    // NEVER fall back to student_id or other requests' proofs!
    const trackingCode = selectedRequest?.tracking_number || selectedRequest?.trackingId || selectedRequest?.id;
    const proof =
      selectedRequest?.payment_proof ||
      getStoredPaymentProof([
        trackingCode,
        selectedRequest?.id,
        selectedRequest?.rawId,
      ]);
    setPaymentProof(proof);

    // Determine payment status strictly for THIS request:
    // It is ONLY verified if staff/admin verified it for THIS request (or request has advanced to processing)
    const isPastPayment =
      s === 'FOR PROCESSING' ||
      s === 'FOR_PROCESSING' ||
      s === 'PROCESSING' ||
      s === 'RELEASING' ||
      s === 'READY_FOR_RELEASE' ||
      s === 'CLAIMED' ||
      s === 'RELEASED';

    let initialPayStatus = 'NOT_SUBMITTED';
    if (selectedRequest?.payment_status === 'VERIFIED' || (isPastPayment && (selectedRequest?.or_number || proof?.status === 'VERIFIED'))) {
      initialPayStatus = 'VERIFIED';
    } else if (selectedRequest?.payment_status === 'REJECTED' || proof?.status === 'REJECTED') {
      initialPayStatus = 'REJECTED';
    } else if (proof || selectedRequest?.receipt_image || selectedRequest?.or_number || selectedRequest?.payment_status === 'PAYMENT_SUBMITTED') {
      initialPayStatus = 'PENDING';
    }
    setPaymentStatus(initialPayStatus);
    setWalkinOrNumber(selectedRequest?.or_number || proof?.receiptReferenceNumber || '');
    setIsPhysicalSubmission(proof?.submissionType === 'PERSONAL' || selectedRequest?.payment_submission_type === 'PERSONAL');

    async function loadClearance() {
      setLoadingClearance(true);
      try {
        const resolved = await resolveClearancePreview(selectedRequest);
        if (!ignore && resolved) {
          setClearanceDoc(resolved);
          if (resolved.cleanup) cleanupFn = resolved.cleanup;
          // Keep verified/rejected if explicitly marked, otherwise set to PENDING when document exists
          const currentClearance = selectedRequest?.clearance_status || rawClearance;
          setClearanceStatus((prev) => {
            if (prev === 'VERIFIED' || prev === 'REJECTED') return prev;
            if (currentClearance === 'VERIFIED' || currentClearance === 'APPROVED') return 'VERIFIED';
            if (currentClearance === 'REJECTED' || currentClearance === 'NOT_VERIFIED') return 'REJECTED';
            return 'PENDING';
          });
        }
      } catch (err) {
        console.warn('Failed to resolve clearance preview:', err);
      } finally {
        if (!ignore) setLoadingClearance(false);
      }
    }

    loadClearance();

    return () => {
      ignore = true;
      if (cleanupFn) cleanupFn();
    };
  }, [selectedRequest]);

  // Step 2 Action: Mark Clearance Valid or Invalid
  const handleVerifyClearance = async (statusToSet) => {
    setClearanceStatus(statusToSet);
    selectedRequest.clearance_status = statusToSet;
    const targetId = selectedRequest.id || selectedRequest.rawId;

    if (selectedRequest.clearance_id) {
      try {
        await clearancesApi.review(selectedRequest.clearance_id, {
          status: statusToSet === 'VERIFIED' ? 'APPROVED' : statusToSet === 'PENDING' ? 'PENDING' : 'REJECTED',
          remarks: notes || '',
        });
      } catch (err) {
        console.warn('Backend review clearance notice:', err);
      }
    }

    updateStoredRequest(
      targetId,
      {
        clearance_status: statusToSet,
      },
      { fallbackItem: selectedRequest, silentNotify: true }
    );

    if (onRequestUpdated) {
      onRequestUpdated({
        ...selectedRequest,
        clearance_status: statusToSet,
      });
    }

    if (statusToSet === 'VERIFIED') {
      toast.success('Clearance verified successfully. Now complete the payment assessment below.');
    } else if (statusToSet === 'PENDING') {
      toast.info('Clearance verification reset to pending.');
    } else {
      toast.warning('Clearance marked as Not Cleared / Rejected.');
    }
  };

  // Step 2 & 3 Action: Confirm Request, Calculate Payment, Generate Updated Form -> Status: For Payment
  const handleConfirmAssessmentAndIssuePayment = async () => {
    if (clearanceStatus !== 'VERIFIED' && clearanceStatus !== 'APPROVED') {
      toast.warning('Please verify the student clearance first before confirming the request.');
      return;
    }

    const targetId = selectedRequest.id || selectedRequest.rawId;
    const trackingCode = selectedRequest.tracking_number || selectedRequest.trackingId || selectedRequest.id;
    const docName = selectedRequest.document_type || 'Requested Credential';
    const cleanAmount = assessedAmount.trim() || '₱100.00';

    const patch = {
      status: 'For Payment',
      rawStatus: 'PAYMENT_PENDING',
      batch_status: 'For Payment',
      clearance_status: 'VERIFIED',
      assessed_amount: cleanAmount,
      amount: cleanAmount,
      date_of_release: dateOfRelease,
      release_date: dateOfRelease,
      verified_by_name: verifiedByName || defaultStaffName,
      or_number: '', // Blank until payment
      payment_date: '', // Blank until payment
      is_confirmed: true,
      confirmed_for_payment: true,
    };

    // Update selectedRequest locally so modal and badges immediately reflect "For Payment"
    selectedRequest.status = 'For Payment';
    selectedRequest.rawStatus = 'PAYMENT_PENDING';
    selectedRequest.batch_status = 'For Payment';
    selectedRequest.clearance_status = 'VERIFIED';
    selectedRequest.is_confirmed = true;
    selectedRequest.confirmed_for_payment = true;
    selectedRequest.assessed_amount = cleanAmount;
    selectedRequest.amount = cleanAmount;
    selectedRequest.date_of_release = dateOfRelease;
    selectedRequest.release_date = dateOfRelease;
    selectedRequest.verified_by_name = verifiedByName || defaultStaffName;

    updateStoredRequest(targetId, patch, { fallbackItem: selectedRequest, silentNotify: true });

    handleManualStatusChange('For Payment');
    setIsOrderConfirmed(true);

    // Attempt backend sync
    if (selectedRequest.rawId && typeof selectedRequest.rawId === 'number') {
      try {
        await requestsApi.transition(selectedRequest.rawId, {
          status: 'PAYMENT_PENDING',
          remarks: `Clearance verified by ${verifiedByName}. Assessed amount: ${cleanAmount}. Date of release: ${dateOfRelease}.`,
        });
      } catch (apiErr) {
        console.warn('Backend transition notice:', apiErr);
      }
    }

    // Step 4: Automatically notify the student that request is ready for payment
    saveStoredNotification({
      event_type: 'PAYMENT_PENDING',
      title: 'Your Request Is Ready for Payment',
      message: `Your credential request has been reviewed and confirmed. The status is now "For Payment".\n\n• Request Number: ${trackingCode}\n• Requested Document: ${docName}\n• Total Amount: ${cleanAmount}\n\nPlease download and print your official request form and proceed with payment.\n\nAfter payment, attach your Official Receipt (OR) in the Payments page.`,
      related_object_type: 'CredentialRequest',
      related_object_id: trackingCode,
      target_role: 'student',
      target_roles: ['student'],
      target_user_id: selectedRequest.user || null,
      target_username: selectedRequest.student_id || selectedRequest.student_name || null,
      target_student_id: selectedRequest.student_id || null,
    });

    logProcessedAction({
      actor: user?.username,
      actorName: user?.full_name || user?.username,
      actorId: user?.id,
      actorRole: user?.role || 'staff',
      targetName: selectedRequest.student_name,
      targetId: selectedRequest.student_id || trackingCode,
      trackingNumber: trackingCode,
      documentType: docName,
      action: `Assessed payment (${cleanAmount}) & confirmed request`,
      status: 'For Payment',
    });

    if (onRequestUpdated) {
      onRequestUpdated({
        ...selectedRequest,
        ...patch,
      });
    }

    toast.success(`Request confirmed! Status automatically updated to "For Payment". Student notified to pay ${cleanAmount}.`);
  };

  // Step 6 Action: Verify Official Receipt (Online or Physical) -> Status: For Processing
  const handleVerifyPayment = async (actionToSet = 'VERIFIED') => {
    const targetId = selectedRequest.id || selectedRequest.rawId;
    const trackingCode = selectedRequest.tracking_number || selectedRequest.id;

    if (actionToSet === 'PENDING') {
      setPaymentStatus('PENDING');
      selectedRequest.status = 'For Payment';
      selectedRequest.rawStatus = 'PAYMENT_PENDING';
      selectedRequest.batch_status = 'For Payment';
      selectedRequest.payment_status = 'PENDING';
      updateStoredRequest(
        targetId,
        {
          payment_status: 'PENDING',
          status: 'For Payment',
          rawStatus: 'PAYMENT_PENDING',
        },
        { fallbackItem: selectedRequest, silentNotify: true }
      );
      handleManualStatusChange('For Payment');
      if (onRequestUpdated) {
        onRequestUpdated({
          ...selectedRequest,
          status: 'For Payment',
          rawStatus: 'PAYMENT_PENDING',
          batch_status: 'For Payment',
          payment_status: 'PENDING',
        });
      }
      toast.info('Payment verification reset to pending.');
      return;
    }

    const isVerified = actionToSet === 'VERIFIED';

    if (isVerified && (!hasReceiptUploaded || !hasOrNumber)) {
      toast.warning('Cannot confirm payment: Official receipt upload and O.R. Number are required.');
      return;
    }

    const finalOrNumber = activeOrNumber;

    verifyStoredPaymentProof(
      [selectedRequest.tracking_number, selectedRequest.id, selectedRequest.rawId],
      {
        action: isVerified ? 'VERIFY' : 'REJECT',
        remarks: notes || (isVerified ? 'Payment verified by Staff' : 'Receipt rejected'),
      }
    );

    setPaymentStatus(isVerified ? 'VERIFIED' : 'REJECTED');
    const updatedStatus = isVerified ? 'For Processing' : 'For Payment';
    handleManualStatusChange(updatedStatus);

    const paymentPatch = {
      status: updatedStatus,
      rawStatus: isVerified ? 'PAYMENT_VERIFIED' : 'PAYMENT_PENDING',
      batch_status: updatedStatus,
      payment_status: isVerified ? 'VERIFIED' : 'REJECTED',
      or_number: finalOrNumber,
      receipt_reference_number: finalOrNumber,
      receipt_image: activeReceiptImage,
      payment_date: new Date().toISOString().split('T')[0],
    };

    selectedRequest.status = updatedStatus;
    selectedRequest.rawStatus = isVerified ? 'PAYMENT_VERIFIED' : 'PAYMENT_PENDING';
    selectedRequest.batch_status = updatedStatus;
    selectedRequest.payment_status = isVerified ? 'VERIFIED' : 'REJECTED';
    selectedRequest.or_number = finalOrNumber;

    updateStoredRequest(targetId, paymentPatch, { fallbackItem: selectedRequest, silentNotify: true });

    if (onRequestUpdated) {
      onRequestUpdated({
        ...selectedRequest,
        ...paymentPatch,
      });
    }

    if (selectedRequest.rawId && typeof selectedRequest.rawId === 'number') {
      try {
        await requestsApi.transition(selectedRequest.rawId, {
          status: isVerified ? 'PAYMENT_VERIFIED' : 'PAYMENT_PENDING',
          remarks: isVerified
            ? `Official Receipt verified (OR: ${finalOrNumber}). Verified by ${user?.username || 'Staff'}.`
            : 'Payment proof rejected.',
        });
      } catch (apiErr) {
        console.warn('Backend transition payment notice:', apiErr);
      }
    }

    logProcessedAction({
      actor: user?.username,
      actorName: user?.full_name || user?.username,
      actorId: user?.id,
      actorRole: user?.role || 'staff',
      targetName: selectedRequest.student_name,
      targetId: selectedRequest.student_id || trackingCode,
      trackingNumber: trackingCode,
      documentType: selectedRequest.document_type,
      action: isVerified ? `Verified Official Receipt (OR: ${finalOrNumber})` : 'Payment Rejected',
      status: updatedStatus,
    });

    if (isVerified) {
      saveStoredNotification({
        event_type: 'PAYMENT_VERIFIED',
        message: `Your payment (OR: ${finalOrNumber}) for request ${trackingCode} has been verified by the Registrar Staff. Your request status is now For Processing.`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_role: 'student',
        target_roles: ['student'],
        target_user_id: selectedRequest.user || null,
        target_username: selectedRequest.student_name || null,
        target_student_id: selectedRequest.student_id || null,
      });

      toast.success(`Payment verified (OR: ${finalOrNumber})! Status updated to For Processing.`);
    } else {
      toast.warning('Payment proof rejected. Request remains For Payment.');
    }
  };

  // Helper for opening clearance preview
  const handleOpenClearance = async (clearanceId, directPreview) => {
    try {
      const activeUrl = clearanceDoc?.url || directPreview;
      if (activeUrl) {
        if (activeUrl.startsWith('data:')) {
          const parts = activeUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const binary = atob(parts[1]);
          const array = [];
          for (let i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
          }
          const blob = new Blob([new Uint8Array(array)], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
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

  // Helper for opening payment receipt preview in a new tab
  const handleOpenReceipt = (directUrl) => {
    try {
      const activeUrl = directUrl || activeReceiptImage;
      if (!activeUrl) {
        toast.warning('No receipt image available to open.');
        return;
      }
      if (activeUrl.startsWith('data:')) {
        const parts = activeUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const binary = atob(parts[1]);
        const array = [];
        for (let i = 0; i < binary.length; i++) {
          array.push(binary.charCodeAt(i));
        }
        const blob = new Blob([new Uint8Array(array)], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        return;
      }
      window.open(activeUrl, '_blank');
    } catch (err) {
      console.warn('Failed to open receipt:', err);
      toast.error('Unable to open receipt file.');
    }
  };

  if (!selectedRequest) return null;

  const currentDisplayStatus = localStatus || newStatus || selectedRequest.status || 'Pending';

  return (
    <>
      <div className="staff-process-backdrop" onClick={onBackToList}>
        <div className="staff-process-dialog max-w-3xl" onClick={(e) => e.stopPropagation()}>
          {/* Sticky Header with Title and Close Button */}
          <div className="staff-process-header">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="staff-process-title">Process Credential Request</h2>
                <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {selectedRequest.tracking_number || selectedRequest.id}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="px-3 py-1.5 bg-[#0B0B36] hover:bg-[#1E1E6B] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="View & print official updated request form"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print Form</span>
              </button>
              <button
                type="button"
                onClick={onBackToList}
                className="staff-process-close-btn"
                title="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form wrapping scrollable body and sticky footer */}
          <form
            onSubmit={(e) => {
              if (e && typeof e.preventDefault === 'function') {
                e.preventDefault();
              }
              if (selectedRequest) {
                const effectiveStatus = localStatus || newStatus || selectedRequest.status || 'Pending';
                selectedRequest.status = effectiveStatus;
                selectedRequest.clearance_status = clearanceStatus;
                selectedRequest.assessed_amount = assessedAmount;
                selectedRequest.amount = assessedAmount;
                selectedRequest.date_of_release = dateOfRelease;
                selectedRequest.release_date = dateOfRelease;
                selectedRequest.verified_by_name = verifiedByName;
                selectedRequest.is_confirmed = isOrderConfirmed;
                selectedRequest.confirmed_for_payment = isOrderConfirmed;
                selectedRequest.payment_status = paymentStatus;
                if (activeOrNumber) {
                  selectedRequest.or_number = activeOrNumber;
                }
              }
              if (onUpdateStatus) {
                onUpdateStatus(e);
              }
            }}
            className="staff-process-form"
          >
            <div className="staff-process-body space-y-4">
              
              {/* Box 1: Student Information & Document Request Details */}
              <div className="staff-process-box">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    1. Request Summary
                  </span>
                  <div>{getStatusBadge ? getStatusBadge(currentDisplayStatus) : currentDisplayStatus}</div>
                </div>

                <div className="staff-process-grid-2">
                  <div className="staff-field-group">
                    <span className="staff-field-label">Student Name</span>
                    <div className="staff-field-pill font-bold">{selectedRequest.student_name}</div>
                  </div>

                  <div className="staff-field-group">
                    <span className="staff-field-label">Student ID</span>
                    <div className="staff-field-pill font-mono">{selectedRequest.student_id}</div>
                  </div>
                </div>

                <div className="staff-process-grid-2 mt-3">
                  <div className="staff-field-group">
                    <span className="staff-field-label">Document</span>
                    <div className="staff-field-pill font-semibold text-indigo-950">
                      {selectedRequest.document_type}
                    </div>
                  </div>

                  <div className="staff-field-group">
                    <span className="staff-field-label">Copies</span>
                    <div className="staff-field-pill">
                      {String(selectedRequest.copies ?? '').replace(' copies', '').replace(' copy', '') || '1'} copy
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="staff-field-label">Purpose</span>
                  <div className="staff-field-box text-xs">
                    {selectedRequest.purpose || selectedRequest.remarks || 'For Personal File / Employment'}
                  </div>
                </div>
              </div>

              {/* Box 2: Clearance Verification (Step 2.1 - 2.3) */}
              <div className="staff-process-box">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
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
                ) : clearanceDoc || selectedRequest.clearance_preview || selectedRequest.clearance_id ? (
                  <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      {clearanceDoc?.isPdf || selectedRequest.clearance_is_pdf ? (
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
                          src={clearanceDoc?.url || selectedRequest.clearance_preview}
                          alt="Clearance"
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer"
                          onClick={() => setShowInlineClearance((p) => !p)}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {clearanceDoc?.fileName || selectedRequest.clearance_file_name || 'Certificate_of_Clearance.pdf'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {clearanceStatus === 'VERIFIED' || clearanceStatus === 'APPROVED' ? (
                          <>
                            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Clearance Verified
                            </div>
                            <button
                              type="button"
                              onClick={() => handleVerifyClearance('PENDING')}
                              className="px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-rose-200"
                              title="Undo clearance verification"
                            >
                              Undo
                            </button>
                          </>
                        ) : clearanceStatus === 'REJECTED' ? (
                          <>
                            <div className="px-3 py-1.5 bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs rounded-lg flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Clearance Rejected
                            </div>
                            <button
                              type="button"
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
                          onClick={() => handleOpenClearance(selectedRequest.clearance_id, clearanceDoc?.url || selectedRequest.clearance_preview)}
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
                        {clearanceDoc?.isPdf || selectedRequest.clearance_is_pdf ? (
                          <iframe
                            src={clearanceDoc?.url || selectedRequest.clearance_preview}
                            title="Clearance Document"
                            className="w-full h-72 rounded-lg border border-slate-300 bg-white"
                          />
                        ) : (
                          <div className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-2 flex items-center justify-center">
                            <img
                              src={clearanceDoc?.url || selectedRequest.clearance_preview}
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
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Clearance Verified</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleVerifyClearance('PENDING')}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                        >
                          Undo
                        </button>
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
              </div>

              {/* Box 3: Payment Assessment Section (Step 2.4 - 2.6 & Step 3) */}
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
                    <label className="block font-bold text-slate-700 mb-1">
                      Payment Amount *
                    </label>
                    <input
                      type="text"
                      value={assessedAmount}
                      onChange={(e) => setAssessedAmount(e.target.value)}
                      placeholder="e.g. ₱100.00"
                      className="w-full px-3 py-2 text-sm font-bold text-indigo-950 border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Release Date *
                    </label>
                    <input
                      type="date"
                      value={dateOfRelease}
                      onChange={(e) => setDateOfRelease(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Verified by *
                    </label>
                    <input
                      type="text"
                      value={verifiedByName}
                      onChange={(e) => setVerifiedByName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 mb-1">
                      Approved by
                    </label>
                    <div className="px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold">
                      Jonalin T. Lagrada, MPSM
                    </div>
                  </div>
                </div>

                {/* Confirm Request Action Button */}
                <div className="mt-3.5 pt-3 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {isOrderConfirmed && (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Request Confirmed (For Payment)</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPrintModalOpen(true)}
                      className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Preview Form</span>
                    </button>
                    {isOrderConfirmed ? (
                      <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Request Confirmed</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfirmAssessmentAndIssuePayment}
                        className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Confirm Request &amp; Order of Payment</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Box 4: Official Receipt Verification (Step 6) */}
              <div className="staff-process-box">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
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
                  ) : paymentProof || selectedRequest.or_number ? (
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
                {hasReceiptUploaded || paymentProof || selectedRequest.or_number ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      {hasReceiptUploaded ? (
                        <img
                          src={activeReceiptImage}
                          alt="Official Receipt"
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer"
                          onClick={() => setShowInlineReceipt((p) => !p)}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-lg shrink-0">
                          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4m-7 9l3-1.5 3 1.5 3-1.5 3 1.5V4l-3 1.5L14 4l-3 1.5L8 4 5 5.5v16.5l3-1.5z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          Official Receipt
                        </span>
                        <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap gap-2">
                          <span>Amount: <strong className="text-indigo-900">{paymentProof?.amount || assessedAmount}</strong></span>
                          <span>•</span>
                          <span>Reference: <strong className="font-mono text-slate-800">{activeOrNumber || 'N/A'}</strong></span>
                        </div>
                      </div>
                      {hasReceiptUploaded && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowInlineReceipt((p) => !p)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer"
                          >
                            {showInlineReceipt ? 'Hide' : 'Preview'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(activeReceiptImage)}
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
                        <div className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-2 flex items-center justify-center">
                          <img
                            src={activeReceiptImage}
                            alt="Official Receipt"
                            className="max-h-64 object-contain rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                    No receipt uploaded by student yet.
                  </div>
                )}

                {/* OR Number Input and Verification Action */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="O.R. Number *"
                      value={walkinOrNumber}
                      onChange={(e) => setWalkinOrNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 font-mono font-bold"
                    />
                  </div>

                  {paymentStatus === 'VERIFIED' ? (
                    <div className="flex items-center gap-2">
                      <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Payment Confirmed</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleVerifyPayment('PENDING')}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-rose-200"
                        title="Change or re-verify payment"
                      >
                        Undo
                      </button>
                    </div>
                  ) : paymentStatus === 'REJECTED' ? (
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs rounded-lg flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Payment Rejected</span>
                      </div>
                      <button
                        type="button"
                        disabled={!canConfirmPayment}
                        onClick={() => handleVerifyPayment('VERIFIED')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          canConfirmPayment
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                            : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                        }`}
                        title={
                          !hasReceiptUploaded && !hasOrNumber
                            ? 'Cannot confirm payment: No receipt uploaded and no O.R. number yet'
                            : !hasReceiptUploaded
                            ? 'Cannot confirm payment: No receipt uploaded yet'
                            : !hasOrNumber
                            ? 'Cannot confirm payment: Please enter the O.R. Number'
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
                        disabled={!canConfirmPayment}
                        onClick={() => handleVerifyPayment('VERIFIED')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          canConfirmPayment
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                            : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                        }`}
                        title={
                          !hasReceiptUploaded && !hasOrNumber
                            ? 'Cannot confirm payment: No receipt uploaded and no O.R. number yet'
                            : !hasReceiptUploaded
                            ? 'Cannot confirm payment: No receipt uploaded yet'
                            : !hasOrNumber
                            ? 'Cannot confirm payment: Please enter the O.R. Number'
                            : 'Confirm and verify payment'
                        }
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Confirm Payment</span>
                      </button>

                      <button
                        type="button"
                        disabled={!hasReceiptUploaded && !paymentProof}
                        onClick={() => handleVerifyPayment('REJECTED')}
                        className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                          hasReceiptUploaded || paymentProof
                            ? 'cursor-pointer bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                            : 'cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                        title={!hasReceiptUploaded && !paymentProof ? 'No payment submission to reject' : 'Reject payment proof'}
                      >
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Standard Dropdown Override (if custom override is needed) */}
              <div className="staff-form-group pt-2">
                <label className="staff-form-label">Manual Status Override</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={localStatus || newStatus || 'Pending'}
                    onChange={(e) => handleManualStatusChange(e.target.value)}
                    className="staff-select-input"
                  >
                    {statusOptions.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Staff remarks / notes (optional)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="staff-notes-input"
                  />
                </div>
              </div>

            </div>

            {/* Sticky Footer */}
            <div className="staff-process-footer">
              <button
                type="button"
                onClick={onBackToList}
                disabled={updating}
                className="staff-btn-back"
              >
                <span>Close</span>
              </button>

              <button
                type="submit"
                disabled={updating}
                className="staff-btn-update"
              >
                {updating ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Printable / Downloadable Updated Request Form Modal */}
      <PrintRequestFormModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        requestData={{
          ...selectedRequest,
          assessed_amount: assessedAmount,
          amount: assessedAmount,
          date_of_release: dateOfRelease,
          verified_by_name: verifiedByName,
        }}
      />
    </>
  );
}
