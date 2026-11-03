import apiClient from './client';
import { saveStoredNotification } from './notifications';

export const PAYMENTS_STORAGE_PREFIX = 'regquest_payment_';

/**
 * Payments API Service
 * Interacts with /api/payments/ endpoints and manages client-side payment state.
 */
export const paymentsApi = {
  /**
   * Submit an Over-The-Counter (OTC) payment receipt for a credential request.
   * @param {Object} params
   * @param {string|number} params.requestId - Backend UUID or ID of the CredentialRequest
   * @param {number|string} params.amount - Amount paid at cashier
   * @param {File} [params.receiptImage] - Image file of the official receipt
   * @param {string} [params.receiptReferenceNumber] - Official Receipt (OR) Number
   * @param {string} [params.trackingNumber] - Tracking number for cross-referencing
   * @param {string} [params.receiptDataUrl] - Base64 preview for client display
   * @param {string} [params.submissionType] - 'ONLINE' (uploaded receipt) or 'PERSONAL' (physical cashier OR submission)
   */
  async submit({
    requestId,
    amount,
    receiptImage = null,
    receiptReferenceNumber = '',
    trackingNumber = '',
    receiptDataUrl = null,
    submissionType = 'ONLINE',
    studentName = 'Student',
    studentId = '',
    userId = null,
  }) {
    let backendResult = null;

    // Clean amount value
    const numericAmount = parseFloat(String(amount).replace(/[^0-9.]/g, '')) || 100.0;

    // Try submitting to backend API if requestId is UUID and receiptImage exists
    if (requestId && receiptImage instanceof File) {
      try {
        const formData = new FormData();
        formData.append('request', requestId);
        formData.append('amount', numericAmount.toFixed(2));
        formData.append('receipt_image', receiptImage);
        if (receiptReferenceNumber) {
          formData.append('receipt_reference_number', receiptReferenceNumber);
        }

        const response = await apiClient.post('/api/payments/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        backendResult = response.data;
      } catch (err) {
        console.warn('Backend payment submission notice:', err);
      }
    }

    // Prepare complete payment proof record
    const paymentRecord = {
      id: backendResult?.id || `PAY-${Date.now()}`,
      requestId: requestId,
      trackingNumber: trackingNumber || requestId,
      amount: `₱${numericAmount.toFixed(2)}`,
      numericAmount,
      receiptReferenceNumber: receiptReferenceNumber || 'Submitted at Window',
      receiptImage: receiptDataUrl || backendResult?.receipt_image || null,
      submissionType,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
      studentName,
      studentId,
      userId,
    };

    // Save proof across tracking number, request ID, student ID
    saveStoredPaymentProof(trackingNumber || requestId, paymentRecord);
    if (requestId) saveStoredPaymentProof(String(requestId), paymentRecord);
    if (studentId) saveStoredPaymentProof(studentId, paymentRecord);

    // Notify Staff & Admin that student has submitted proof of payment
    saveStoredNotification({
      event_type: 'PAYMENT_SUBMITTED',
      message: `Proof of Payment: ${studentName} (${studentId || trackingNumber}) submitted Official Receipt ${receiptReferenceNumber || ''} (₱${numericAmount.toFixed(2)}) for request ${trackingNumber}.`,
      related_object_type: 'Payment',
      related_object_id: trackingNumber || requestId,
      target_roles: ['staff', 'admin', 'registrar'],
      target_role: 'staff',
    });

    // Notify Student confirming submission
    saveStoredNotification({
      event_type: 'PAYMENT_SUBMITTED',
      message: `Your proof of payment (${receiptReferenceNumber || 'Official Receipt'}) for request ${trackingNumber} has been received and is pending Registrar verification.`,
      related_object_type: 'Payment',
      related_object_id: trackingNumber || requestId,
      target_roles: ['student'],
      target_role: 'student',
      target_user_id: userId,
      target_student_id: studentId,
      target_username: studentName,
    });

    return paymentRecord;
  },

  /**
   * List payments
   */
  async list(params = {}) {
    try {
      const response = await apiClient.get('/api/payments/', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.results || []);
    } catch {
      return [];
    }
  },

  /**
   * Verify or Reject an OTC payment (Staff/Admin)
   */
  async verify(paymentId, { action = 'VERIFY', remarks = '' }) {
    try {
      const response = await apiClient.patch(`/api/payments/${paymentId}/verify/`, {
        action,
        remarks,
      });
      return response.data;
    } catch (err) {
      console.warn('Backend payment verify notice:', err);
      return { status: action === 'VERIFY' ? 'VERIFIED' : 'REJECTED', remarks };
    }
  },
};

/**
 * Save payment proof safely into client storage
 */
export function saveStoredPaymentProof(identifier, paymentData) {
  if (!identifier || !paymentData) return;

  try {
    sessionStorage.setItem(`${PAYMENTS_STORAGE_PREFIX}${identifier}`, JSON.stringify(paymentData));
  } catch {}

  try {
    localStorage.setItem(`${PAYMENTS_STORAGE_PREFIX}${identifier}`, JSON.stringify(paymentData));
    localStorage.setItem('regquest_latest_payment_proof', JSON.stringify(paymentData));
  } catch (err) {
    // If quota exceeded, clean up old payment records
    try {
      const keysToClean = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PAYMENTS_STORAGE_PREFIX) && k !== `${PAYMENTS_STORAGE_PREFIX}${identifier}`) {
          keysToClean.push(k);
        }
      }
      keysToClean.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(`${PAYMENTS_STORAGE_PREFIX}${identifier}`, JSON.stringify(paymentData));
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('regquest_payment_updated', {
        detail: { identifier, paymentData },
      })
    );
  }
}

/**
 * Retrieve saved payment proof by candidate identifiers
 */
export function getStoredPaymentProof(candidateKeys = []) {
  const keys = Array.isArray(candidateKeys) ? candidateKeys : [candidateKeys];

  for (const k of keys) {
    if (!k) continue;
    try {
      const sVal = sessionStorage.getItem(`${PAYMENTS_STORAGE_PREFIX}${k}`);
      if (sVal) return JSON.parse(sVal);
    } catch {}

    try {
      const lVal = localStorage.getItem(`${PAYMENTS_STORAGE_PREFIX}${k}`);
      if (lVal) return JSON.parse(lVal);
    } catch {}
  }

  return null;
}

/**
 * Verify or Reject stored payment proof in client storage
 */
export function verifyStoredPaymentProof(candidateKeys = [], { action = 'VERIFY', remarks = '' } = {}) {
  const existing = getStoredPaymentProof(candidateKeys);
  if (!existing) return null;

  const updated = {
    ...existing,
    status: action === 'VERIFY' ? 'VERIFIED' : 'REJECTED',
    remarks: remarks || existing.remarks || '',
    verifiedAt: new Date().toISOString(),
  };

  const keys = Array.isArray(candidateKeys) ? candidateKeys : [candidateKeys];
  keys.forEach((k) => {
    if (k) saveStoredPaymentProof(k, updated);
  });
  if (existing.trackingNumber) saveStoredPaymentProof(existing.trackingNumber, updated);
  if (existing.requestId) saveStoredPaymentProof(String(existing.requestId), updated);

  return updated;
}

export default paymentsApi;
