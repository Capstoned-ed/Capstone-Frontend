import React, { useState, useEffect, useMemo } from 'react';
import useToast from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import requestsApi, { updateStoredRequest, logProcessedAction, setRequestArchived, recordRequestActivityTimestamp } from '../../api/requests';
import clearancesApi, { resolveClearancePreview } from '../../api/clearances';
import { saveStoredNotification } from '../../api/notifications';
import { getStoredPaymentProof, verifyStoredPaymentProof } from '../../api/payments';
import PrintRequestFormModal from '../student/PrintRequestFormModal';
import ClaimStubModal from '../common/ClaimStubModal';

export default function ProcessRequestModal({
  isOpen,
  onClose,
  requestItem,
  onUpdated,
}) {
  const { user } = useAuth();
  const BACKEND_STATUS_MAP = {
    'Pending': 'PENDING',
    'For Payment': 'PAYMENT_PENDING',
    'Pending Payment': 'PAYMENT_PENDING',
    'Payment Pending': 'PAYMENT_PENDING',
    'For Processing': 'PAYMENT_VERIFIED',
    'Processing': 'PROCESSING',
    'Releasing': 'READY_FOR_RELEASE',
    'For release': 'READY_FOR_RELEASE',
    'Claimed': 'RELEASED',
    'On Hold': 'REQUIREMENTS_VERIFICATION',
  };

  const toast = useToast();
  const [newStatus, setNewStatus] = useState(() => requestItem?.status || 'Pending');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInlineClearance, setShowInlineClearance] = useState(false);
  const [clearanceDoc, setClearanceDoc] = useState(null);
  const [loadingClearance, setLoadingClearance] = useState(false);
  const [clearanceStatus, setClearanceStatus] = useState(() => {
    const raw = requestItem?.clearance_status;
    if (raw === 'VERIFIED' || raw === 'APPROVED') return 'VERIFIED';
    if (raw === 'REJECTED' || raw === 'NOT_VERIFIED') return 'REJECTED';
    return requestItem?.clearance_preview || requestItem?.clearance_id ? 'PENDING' : 'NOT_ATTACHED';
  });

  // Payment Assessment Fields (matching staff modal)
  const defaultStaffName = user?.full_name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username) || 'Admin';
  const [assessedAmount, setAssessedAmount] = useState('₱100.00');
  const [dateOfRelease, setDateOfRelease] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [verifiedByName, setVerifiedByName] = useState(defaultStaffName);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showClaimStubModal, setShowClaimStubModal] = useState(false);
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(() => {
    const s = String(requestItem?.status || '').toUpperCase();
    return Boolean(
      requestItem?.is_confirmed ||
      requestItem?.confirmed_for_payment ||
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

  // Payment Proof States
  const [paymentProof, setPaymentProof] = useState(null);
  const [walkinOrNumber, setWalkinOrNumber] = useState('');
  const [showInlineReceipt, setShowInlineReceipt] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(() => {
    const s = String(requestItem?.status || '').toUpperCase();
    const isPastPayment =
      s === 'FOR PROCESSING' ||
      s === 'FOR_PROCESSING' ||
      s === 'PROCESSING' ||
      s === 'RELEASING' ||
      s === 'READY_FOR_RELEASE' ||
      s === 'CLAIMED' ||
      s === 'RELEASED';
    if (requestItem?.payment_status === 'VERIFIED' || (isPastPayment && requestItem?.or_number)) {
      return 'VERIFIED';
    }
    if (requestItem?.payment_status === 'REJECTED') {
      return 'REJECTED';
    }
    if (requestItem?.receipt_image || requestItem?.or_number || requestItem?.payment_status === 'PAYMENT_SUBMITTED') {
      return 'PENDING';
    }
    return 'NOT_SUBMITTED';
  });
  const [localStatus, setLocalStatus] = useState(() => requestItem?.status || 'Pending');

  const activeReceiptImage =
    paymentProof?.receiptImage ||
    paymentProof?.receiptDataUrl ||
    requestItem?.receipt_image ||
    null;

  const hasReceiptUploaded = Boolean(activeReceiptImage);

  const activeOrNumber = (
    walkinOrNumber.trim() ||
    paymentProof?.receiptReferenceNumber ||
    requestItem?.or_number ||
    ''
  );

  const hasOrNumber = Boolean(activeOrNumber);

  const canConfirmPayment = Boolean(hasReceiptUploaded && hasOrNumber);

  const normalizeStatus = (val) => {
    if (val === 'For Payment' || val === 'FOR PAYMENT' || val === 'FOR_PAYMENT') return 'Pending Payment';
    return val;
  };

  useEffect(() => {
    if (newStatus) setLocalStatus(normalizeStatus(newStatus));
  }, [newStatus]);

  const claimStubDetails = useMemo(() => {
    if (!requestItem) return null;
    const reqDateFormatted = requestItem.request_date || (requestItem.created_at ? new Date(requestItem.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
    const relDateFormatted = dateOfRelease || requestItem.date_of_release || requestItem.release_date || '—';
    return {
      studentName: requestItem.student_name,
      course: requestItem.course || requestItem.program || '—',
      dateOfRequest: reqDateFormatted,
      credentialRequested: `${requestItem.document_type || 'Document'} (${requestItem.copies || 1} ${requestItem.copies > 1 ? 'copies' : 'copy'})`,
      dateOfRelease: relDateFormatted,
    };
  }, [requestItem, dateOfRelease]);

  const handleManualStatusChange = (val) => {
    const cleanVal = normalizeStatus(val);
    setLocalStatus(cleanVal);
    setNewStatus(cleanVal);
  };

  const statusOptions = useMemo(() => {
    const base = [
      'Pending',
      'Pending Payment',
      'For Processing',
      'Processing',
      'Releasing',
      'Claimed',
      'On Hold',
      'Rejected',
    ];
    const currentVal = normalizeStatus(localStatus || newStatus);
    if (currentVal && !base.includes(currentVal)) base.push(currentVal);
    return base;
  }, [localStatus, newStatus]);

  useEffect(() => {
    let ignore = false;
    let cleanupFn = null;

    if (!requestItem) return;

    setNotes('');
    const rawClearance = requestItem?.clearance_status;
    if (rawClearance === 'VERIFIED' || rawClearance === 'APPROVED') {
      setClearanceStatus('VERIFIED');
    } else if (rawClearance === 'REJECTED' || rawClearance === 'NOT_VERIFIED') {
      setClearanceStatus('REJECTED');
    } else {
      setClearanceStatus(
        requestItem?.clearance_preview || requestItem?.clearance_id ? 'PENDING' : 'NOT_ATTACHED'
      );
    }
    setLocalStatus(requestItem?.status || 'Pending');
    setNewStatus(requestItem?.status || 'Pending');

    const baseAmt = requestItem.assessed_amount || requestItem.amount || requestItem.price || '₱100.00';
    setAssessedAmount(
      typeof baseAmt === 'number'
        ? `₱${baseAmt.toFixed(2)}`
        : String(baseAmt).startsWith('₱') || String(baseAmt).startsWith('P')
        ? String(baseAmt)
        : `₱${baseAmt}`
    );

    if (requestItem.date_of_release || requestItem.release_date) {
      setDateOfRelease(requestItem.date_of_release || requestItem.release_date);
    }
    if (requestItem.verified_by_name) {
      setVerifiedByName(requestItem.verified_by_name);
    }

    const s = String(requestItem.status || '').toUpperCase();
    setIsOrderConfirmed(
      Boolean(
        requestItem.is_confirmed ||
        requestItem.confirmed_for_payment ||
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
          const currentClearance = requestItem?.clearance_status || rawClearance;
          setClearanceStatus((prev) => {
            if (prev === 'VERIFIED' || prev === 'REJECTED') return prev;
            if (currentClearance === 'VERIFIED' || currentClearance === 'APPROVED') return 'VERIFIED';
            if (currentClearance === 'REJECTED' || currentClearance === 'NOT_VERIFIED') return 'REJECTED';
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
    setClearanceStatus(statusToSet);
    requestItem.clearance_status = statusToSet;
    const targetId = requestItem.id || requestItem.rawId;

    if (requestItem.clearance_id) {
      try {
        await clearancesApi.review(requestItem.clearance_id, {
          status: statusToSet === 'VERIFIED' ? 'APPROVED' : statusToSet === 'PENDING' ? 'PENDING' : 'REJECTED',
          remarks: notes || '',
        });
      } catch (err) {
        console.warn('Backend review clearance notice:', err);
      }
    }

    const nowTime = Date.now();
    const nowIso = new Date(nowTime).toISOString();
    recordRequestActivityTimestamp(requestItem, nowTime);
    updateStoredRequest(
      targetId,
      { clearance_status: statusToSet, updated_at: nowIso },
      { fallbackItem: requestItem, silentNotify: true }
    );

    if (onUpdated) {
      onUpdated({
        ...requestItem,
        clearance_status: statusToSet,
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
    if (clearanceStatus !== 'VERIFIED' && clearanceStatus !== 'APPROVED') {
      toast.warning('Please verify the student clearance first before confirming the request.');
      return;
    }

    const targetId = requestItem.id || requestItem.rawId;
    const trackingCode = requestItem.tracking_number || requestItem.trackingId || requestItem.id;
    const docName = requestItem.document_type || 'Requested Credential';
    const cleanAmount = assessedAmount.trim() || '₱100.00';

    const nowTime = Date.now();
    const nowIso = new Date(nowTime).toISOString();
    recordRequestActivityTimestamp(requestItem, nowTime);

    const patch = {
      status: 'Pending Payment',
      rawStatus: 'PAYMENT_PENDING',
      batch_status: 'Pending Payment',
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
      updated_at: nowIso,
    };

    requestItem.status = 'Pending Payment';
    requestItem.rawStatus = 'PAYMENT_PENDING';
    requestItem.batch_status = 'Pending Payment';
    requestItem.clearance_status = 'VERIFIED';
    requestItem.assessed_amount = cleanAmount;
    requestItem.amount = cleanAmount;
    requestItem.date_of_release = dateOfRelease;
    requestItem.release_date = dateOfRelease;
    requestItem.verified_by_name = verifiedByName || defaultStaffName;
    requestItem.is_confirmed = true;
    requestItem.confirmed_for_payment = true;

    updateStoredRequest(targetId, patch, { fallbackItem: requestItem, silentNotify: true });

    handleManualStatusChange('Pending Payment');
    setIsOrderConfirmed(true);

    if (requestItem.rawId && typeof requestItem.rawId === 'number') {
      try {
        await requestsApi.transition(requestItem.rawId, {
          status: 'PAYMENT_PENDING',
          remarks: `Clearance verified by ${verifiedByName}. Assessed amount: ${cleanAmount}. Date of release: ${dateOfRelease}.`,
        });
      } catch (apiErr) {
        console.warn('Backend transition notice:', apiErr);
      }
    }

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

    toast.success(`Request confirmed! Status updated to "Pending Payment". Student notified to pay ${cleanAmount}.`);
  };

  const handleRejectRequest = async () => {
    const targetId = requestItem.id || requestItem.rawId;
    const trackingCode = requestItem.tracking_number || requestItem.trackingId || requestItem.id;
    const reason = notes.trim() || 'Request requirements incomplete or rejected.';

    try {
      setLoading(true);
      if (typeof targetId === 'number') {
        await requestsApi.transition(targetId, {
          status: 'REJECTED',
          remarks: reason,
        }).catch(() => {});
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
        user: requestItem.user || requestItem.student_id,
        title: 'Request Rejected',
        message: `Your request ${trackingCode} for ${requestItem.document_type || 'credential'} was rejected. Reason: ${reason}`,
        type: 'error',
        tracking_number: trackingCode,
      });

      handleManualStatusChange('Rejected');
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
      toast.error('Failed to reject request.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (actionToSet = 'VERIFIED') => {
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
      handleManualStatusChange('Pending Payment');
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

    if (isVerified && (!hasReceiptUploaded || !hasOrNumber)) {
      toast.warning('Cannot confirm payment: Official receipt upload and O.R. Number are required.');
      return;
    }

    const finalOrNumber = activeOrNumber;

    verifyStoredPaymentProof(
      [requestItem.tracking_number, requestItem.id, requestItem.rawId],
      {
        action: isVerified ? 'VERIFY' : 'REJECT',
        remarks: notes || (isVerified ? 'Payment verified by Admin' : 'Receipt rejected'),
      }
    );

    setPaymentStatus(isVerified ? 'VERIFIED' : 'REJECTED');
    const updatedStatus = isVerified ? 'For Processing' : 'Pending Payment';
    handleManualStatusChange(updatedStatus);

    const nowTime = Date.now();
    const nowIso = new Date(nowTime).toISOString();
    recordRequestActivityTimestamp(requestItem, nowTime);

    const paymentPatch = {
      status: updatedStatus,
      rawStatus: isVerified ? 'PAYMENT_VERIFIED' : 'PAYMENT_PENDING',
      batch_status: updatedStatus,
      payment_status: isVerified ? 'VERIFIED' : 'REJECTED',
      or_number: finalOrNumber,
      receipt_reference_number: finalOrNumber,
      receipt_image: activeReceiptImage,
      payment_date: new Date().toISOString().split('T')[0],
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

    if (requestItem.rawId && typeof requestItem.rawId === 'number') {
      try {
        await requestsApi.transition(requestItem.rawId, {
          status: isVerified ? 'PAYMENT_VERIFIED' : 'PAYMENT_PENDING',
          remarks: isVerified
            ? `Official Receipt verified (OR: ${finalOrNumber}). Verified by ${user?.username || 'Admin'}.`
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
      actorRole: user?.role || 'admin',
      targetName: requestItem.student_name,
      targetId: requestItem.student_id || trackingCode,
      trackingNumber: trackingCode,
      documentType: requestItem.document_type,
      action: isVerified ? `Verified Official Receipt (OR: ${finalOrNumber})` : 'Payment Rejected',
      status: updatedStatus,
    });

    if (isVerified) {
      saveStoredNotification({
        event_type: 'PAYMENT_VERIFIED',
        message: `Your payment (OR: ${finalOrNumber}) for request ${trackingCode} has been verified by the Registrar. Your request status is now For Processing.`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_role: 'student',
        target_roles: ['student'],
        target_user_id: requestItem.user || null,
        target_username: requestItem.student_name || null,
        target_student_id: requestItem.student_id || null,
      });
      toast.success(`Payment verified (OR: ${finalOrNumber})! Status updated to For Processing.`);
    } else {
      toast.warning('Payment proof rejected. Request remains For Payment.');
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

  const handleOpenReceipt = (receiptUrl) => {
    try {
      const activeUrl = receiptUrl || activeReceiptImage;
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
      window.open(activeUrl, '_blank');
    } catch (err) {
      console.warn('Failed to open receipt:', err);
      toast.error('Unable to open receipt file.');
    }
  };

  if (!isOpen || !requestItem) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const targetId = requestItem.rawId || requestItem.id;
      if (requestItem.rawId && typeof requestItem.rawId === 'number') {
        const backendStatus = BACKEND_STATUS_MAP[localStatus] || localStatus;
        try {
          await requestsApi.transition(requestItem.rawId, {
            status: backendStatus,
            remarks: notes || requestItem.remarks || '',
          });
        } catch (apiErr) {
          console.warn('Backend transition notice:', apiErr);
        }
      }

      const nowTime = Date.now();
      const nowIso = new Date(nowTime).toISOString();
      recordRequestActivityTimestamp(requestItem, nowTime);

      const finalPatch = {
        status: localStatus,
        remarks: notes.trim() ? notes.trim() : (requestItem.remarks || ''),
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

      toast.success(`Request ${requestItem.tracking_number || requestItem.id} updated to ${localStatus}.`);

      if (onUpdated) {
        onUpdated({
          ...requestItem,
          ...finalPatch,
        });
      }
      onClose();
    } catch (err) {
      console.error('Failed to transition request:', err);
      const detail = err.response?.data?.detail || err.response?.data?.message || err.message || 'Status transition failed.';
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
    const targetId = requestItem.id || requestItem.rawId;
    const trackingCode = requestItem.tracking_number || requestItem.trackingId || requestItem.id;

    try {
      setLoading(true);
      if (typeof targetId === 'number') {
        await requestsApi.transition(targetId, {
          status: 'RELEASED',
          remarks: notes || 'Document claimed by student at registrar window.',
        }).catch(() => {});
      }

      const claimPatch = {
        status: 'Claimed',
        rawStatus: 'RELEASED',
        batch_status: 'Claimed',
        remarks: notes || requestItem.remarks || 'Document claimed by student.',
        is_archived: true,
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

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase().replace(/[_ ]/g, '-');
    const map = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'for-payment': 'bg-amber-100 text-amber-900 border-amber-300',
      'pending-payment': 'bg-amber-100 text-amber-900 border-amber-300',
      'payment-pending': 'bg-amber-100 text-amber-900 border-amber-300',
      'for-processing': 'bg-blue-100 text-blue-900 border-blue-200',
      'processing': 'bg-sky-100 text-sky-900 border-sky-200',
      'releasing': 'bg-violet-100 text-violet-900 border-violet-200',
      'for-release': 'bg-violet-100 text-violet-900 border-violet-200',
      'claimed': 'bg-emerald-100 text-emerald-900 border-emerald-200',
      'on-hold': 'bg-orange-100 text-orange-900 border-orange-200',
    };
    const cls = map[s] || 'bg-slate-100 text-slate-700 border-slate-200';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>
        {status || 'Pending'}
      </span>
    );
  };

  const currentDisplayStatus = localStatus || newStatus || requestItem.status || 'Pending';

  return (
    <>
      <div className="staff-process-backdrop" onClick={onClose}>
        <div className="staff-process-dialog max-w-3xl" onClick={(e) => e.stopPropagation()}>
          {/* Sticky Header */}
          <div className="staff-process-header">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="staff-process-title">Process Credential Request</h2>
                <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {requestItem.tracking_number || requestItem.id}
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
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    1. Request Summary
                  </span>
                  <div>{getStatusBadge(currentDisplayStatus)}</div>
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
                      {requestItem.document_type || 'N/A'}
                    </div>
                  </div>
                  <div className="staff-field-group">
                    <span className="staff-field-label">Copies</span>
                    <div className="staff-field-pill">
                      {String(requestItem.copies ?? '').replace(' copies', '').replace(' copy', '') || '1'} copy
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="staff-field-label">Purpose</span>
                  <div className="staff-field-box text-xs">
                    {requestItem.purpose || requestItem.remarks || 'For Personal File / Employment'}
                  </div>
                </div>
              </div>

              {/* Box 2: Student Clearance */}
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
                    <div className="flex items-center gap-3">
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
                      <div className="flex items-center gap-2 shrink-0">
                        {clearanceStatus === 'VERIFIED' || clearanceStatus === 'APPROVED' ? (
                          <>
                            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Clearance Verified</span>
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
                    <input
                      type="text"
                      value={assessedAmount}
                      onChange={(e) => setAssessedAmount(e.target.value)}
                      placeholder="e.g. ₱100.00"
                      className="w-full px-3 py-2 text-sm font-bold text-indigo-950 border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Release Date *</label>
                    <input
                      type="date"
                      value={dateOfRelease}
                      onChange={(e) => setDateOfRelease(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Verified by *</label>
                    <input
                      type="text"
                      value={verifiedByName}
                      onChange={(e) => setVerifiedByName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Approved by</label>
                    <div className="px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold">
                      Jonalin T. Lagrada, MPSM
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {isOrderConfirmed && (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Request Confirmed (Pending Payment)</span>
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
                    {localStatus === 'Rejected' || requestItem?.status === 'Rejected' ? (
                      <div className="px-3.5 py-2 bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs">
                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Request Rejected</span>
                      </div>
                    ) : isOrderConfirmed ? (
                      <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Request Confirmed</span>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleRejectRequest}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                          title="Reject this request"
                        >
                          <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Reject Request</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmAssessmentAndIssuePayment}
                          className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>Confirm Request & Order of Payment</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Box 4: Payment Verification */}
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
                {hasReceiptUploaded || paymentProof || requestItem.or_number ? (
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
                        <span className="text-xs font-bold text-slate-900 block truncate">Official Receipt</span>
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

              {/* Manual Status Override */}
              <div className="staff-form-group pt-2">
                <label className="staff-form-label">Manual Status Override</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={localStatus || newStatus || 'Pending'}
                    onChange={(e) => handleManualStatusChange(e.target.value)}
                    className="staff-select-input"
                  >
                    {statusOptions.map((st) => (
                      <option key={st} value={st}>{st}</option>
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

                {/* If already Claimed, offer Done */}
                {(localStatus === 'Claimed' || requestItem?.status === 'Claimed') && (
                  <button
                    type="button"
                    onClick={handleMoveToHistory}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                    title="Document claimed: Mark as Done and move to Request History"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Done</span>
                  </button>
                )}

                {/* If Releasing / For release, offer quick Mark Claimed & Done */}
                {(localStatus === 'Releasing' || localStatus === 'For release' || requestItem?.status === 'Releasing' || requestItem?.status === 'For release') && (
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

                {/* Print Claim Stub button (available once payment is confirmed / for processing / releasing / claimed) */}
                {(paymentStatus === 'VERIFIED' || isOrderConfirmed || localStatus === 'For Processing' || localStatus === 'Releasing' || localStatus === 'Claimed') && (
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

              <button
                type="submit"
                disabled={loading}
                className="staff-btn-update"
              >
                {loading ? 'Updating...' : 'Update Status'}
              </button>
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
