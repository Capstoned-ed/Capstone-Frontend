import apiClient from './client';

// Clean up legacy keys that were mistakenly saved by student ID or user ID
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PAYMENTS_STORAGE_PREFIX)) {
        const suffix = k.replace(PAYMENTS_STORAGE_PREFIX, '');
        // If suffix is purely numeric (student ID / user ID), purge it so it doesn't cross-contaminate requests
        if (/^\d{5,12}$/.test(suffix)) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => {
      localStorage.removeItem(k);
      try { sessionStorage.removeItem(k); } catch {}
    });
    localStorage.removeItem('regquest_latest_payment_proof');
  } catch {}
}

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

    // Clean amount value strictly (never silently fall back to 100.0 if invalid)
    const rawAmountStr = String(amount ?? '').replace(/[^0-9.]/g, '');
    const parsedAmount = parseFloat(rawAmountStr);
    const numericAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
    const isBackendId = Boolean(requestId) && !String(requestId).startsWith('fallback_');

    if (isBackendId && numericAmount <= 0) {
      throw new Error('Unable to determine the required payment amount for this request.');
    }

    // Submit strictly bound to the exact CredentialRequest UUID on backend
    if (isBackendId && receiptImage instanceof File) {
      const formData = new FormData();
      formData.append('request', String(requestId).trim());
      formData.append('amount', numericAmount.toFixed(2));
      formData.append('receipt_image', receiptImage);
      if (receiptReferenceNumber) {
        formData.append('receipt_reference_number', String(receiptReferenceNumber).trim());
      }

      const response = await apiClient.post('/api/payments/', formData, {
        headers: {
          'Content-Type': undefined,
        },
      });
      backendResult = response.data;
    }

    // Prepare complete payment proof record
    const paymentRecord = {
      id: backendResult?.id || `PAY-${Date.now()}`,
      requestId: String(requestId),
      trackingNumber: trackingNumber || String(requestId),
      amount: `₱${numericAmount.toFixed(2)}`,
      numericAmount,
      receiptReferenceNumber:
        backendResult?.receipt_reference_number ||
        receiptReferenceNumber ||
        'Submitted at Window',
      receiptImage: backendResult?.receipt_image || receiptDataUrl || null,
      receiptDataUrl: receiptDataUrl || null,
      submissionType,
      status: backendResult?.status || 'PENDING',
      submittedAt: backendResult?.uploaded_at || new Date().toISOString(),
      studentName,
      studentId,
      userId,
    };

    // Save proof ONLY for this specific request's tracking number and request ID!
    // NEVER save by studentId or userId to avoid cross-attaching receipts to other requests.
    if (trackingNumber) {
      saveStoredPaymentProof(trackingNumber, paymentRecord);
    }
    if (requestId && String(requestId) !== String(trackingNumber)) {
      saveStoredPaymentProof(String(requestId), paymentRecord);
    }

    // Dispatch request update event & cross-tab broadcast so Student & Staff views refetch live data
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('regquest_requests_updated', { detail: paymentRecord }));
      if ('BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('regquest_realtime_requests');
          bc.postMessage({ type: 'REFRESH_REQUESTS', payload: paymentRecord });
          bc.close();
        } catch {}
      }
    }

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
 * Save payment proof safely into sessionStorage for in-tab preview only.
 * NEVER persists large base64 payloads to localStorage to prevent QuotaExceededError.
 */
export function saveStoredPaymentProof(identifier, paymentData) {
  if (!identifier || !paymentData) return;

  try {
    sessionStorage.setItem(`${PAYMENTS_STORAGE_PREFIX}${identifier}`, JSON.stringify(paymentData));
  } catch {}

  // Clean any old base64 payment proof records from localStorage to free quota
  try {
    localStorage.removeItem(`${PAYMENTS_STORAGE_PREFIX}${identifier}`);
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('regquest_payment_updated', {
        detail: { identifier, paymentData },
      })
    );
  }
}

/**
 * Retrieve saved payment proof by candidate identifiers.
 * Strictly verifies that the stored record's trackingNumber or requestId matches one of the candidateKeys.
 */
export function getStoredPaymentProof(candidateKeys = []) {
  const keys = (Array.isArray(candidateKeys) ? candidateKeys : [candidateKeys])
    .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
    .map((k) => String(k).trim());

  if (keys.length === 0) return null;

  const cleanTargetKeys = keys.map((k) => k.toUpperCase());

  for (const k of keys) {
    let raw = null;
    try {
      raw = sessionStorage.getItem(`${PAYMENTS_STORAGE_PREFIX}${k}`);
    } catch {}

    if (!raw) {
      try {
        raw = localStorage.getItem(`${PAYMENTS_STORAGE_PREFIX}${k}`);
      } catch {}
    }

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed) {
          // STRICT VALIDATION: Ensure this payment record actually belongs to this specific request!
          const recordTracking = String(parsed.trackingNumber || '').trim().toUpperCase();
          const recordReqId = String(parsed.requestId || '').trim().toUpperCase();
          const recordId = String(parsed.id || '').trim().toUpperCase();

          const belongsToThisRequest = cleanTargetKeys.some(
            (target) => target === recordTracking || target === recordReqId || target === recordId
          );

          if (belongsToThisRequest) {
            return parsed;
          }
        }
      } catch {}
    }
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
