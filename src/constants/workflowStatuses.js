// CredentialRequest statuses (strictly matches Django backend models.RequestStatus)
export const REQUEST_STATUS = Object.freeze({
  PENDING: 'PENDING',
  REQUIREMENTS_VERIFICATION: 'REQUIREMENTS_VERIFICATION',
  REQUIREMENTS_REJECTED: 'REQUIREMENTS_REJECTED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  FOR_VERIFICATION: 'FOR_VERIFICATION',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PROCESSING: 'PROCESSING',
  READY_FOR_RELEASE: 'READY_FOR_RELEASE',
  RELEASED: 'RELEASED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

// StudentClearance statuses (matches Django models.ClearanceStatus)
export const CLEARANCE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

// Payment statuses (matches Django models.PaymentStatus)
export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

// Backward-compatible translation map from UI label variants to backend database enum
export const BACKEND_STATUS_MAP = Object.freeze({
  // Pending
  'Pending': REQUEST_STATUS.PENDING,
  'PENDING': REQUEST_STATUS.PENDING,
  'PENDONG': REQUEST_STATUS.PENDING,
  'Received': REQUEST_STATUS.PENDING,
  'Request Submitted': REQUEST_STATUS.PENDING,

  // Payment Pending
  'For Payment': REQUEST_STATUS.PAYMENT_PENDING,
  'FOR PAYMENT': REQUEST_STATUS.PAYMENT_PENDING,
  'FOR_PAYMENT': REQUEST_STATUS.PAYMENT_PENDING,
  'Pending Payment': REQUEST_STATUS.PAYMENT_PENDING,
  'PENDING PAYMENT': REQUEST_STATUS.PAYMENT_PENDING,
  'PENDING_PAYMENT': REQUEST_STATUS.PAYMENT_PENDING,
  'Payment Pending': REQUEST_STATUS.PAYMENT_PENDING,
  'PAYMENT PENDING': REQUEST_STATUS.PAYMENT_PENDING,
  'PAYMENT_PENDING': REQUEST_STATUS.PAYMENT_PENDING,
  'Cleared for Payment': REQUEST_STATUS.PAYMENT_PENDING,
  'CLEARED FOR PAYMENT': REQUEST_STATUS.PAYMENT_PENDING,

  // For Verification
  'For Verification': REQUEST_STATUS.FOR_VERIFICATION,
  'FOR VERIFICATION': REQUEST_STATUS.FOR_VERIFICATION,
  'FOR_VERIFICATION': REQUEST_STATUS.FOR_VERIFICATION,

  // Payment Verified / For Processing
  'For Processing': REQUEST_STATUS.PAYMENT_VERIFIED,
  'FOR PROCESSING': REQUEST_STATUS.PAYMENT_VERIFIED,
  'FOR_PROCESSING': REQUEST_STATUS.PAYMENT_VERIFIED,
  'Payment Verified': REQUEST_STATUS.PAYMENT_VERIFIED,
  'PAYMENT VERIFIED': REQUEST_STATUS.PAYMENT_VERIFIED,
  'PAYMENT_VERIFIED': REQUEST_STATUS.PAYMENT_VERIFIED,

  // Processing
  'Processing': REQUEST_STATUS.PROCESSING,
  'PROCESSING': REQUEST_STATUS.PROCESSING,
  'Document Preparation': REQUEST_STATUS.PROCESSING,
  'DOCUMENT PREPARATION': REQUEST_STATUS.PROCESSING,
  'DOCUMENT_PREPARATION': REQUEST_STATUS.PROCESSING,

  // Ready for Release / Releasing
  'Releasing': REQUEST_STATUS.READY_FOR_RELEASE,
  'RELEASING': REQUEST_STATUS.READY_FOR_RELEASE,
  'For release': REQUEST_STATUS.READY_FOR_RELEASE,
  'FOR RELEASE': REQUEST_STATUS.READY_FOR_RELEASE,
  'FOR_RELEASE': REQUEST_STATUS.READY_FOR_RELEASE,
  'Ready for Pickup': REQUEST_STATUS.READY_FOR_RELEASE,
  'READY FOR PICKUP': REQUEST_STATUS.READY_FOR_RELEASE,
  'READY_FOR_PICKUP': REQUEST_STATUS.READY_FOR_RELEASE,
  'Ready for Release': REQUEST_STATUS.READY_FOR_RELEASE,
  'READY FOR RELEASE': REQUEST_STATUS.READY_FOR_RELEASE,
  'READY_FOR_RELEASE': REQUEST_STATUS.READY_FOR_RELEASE,

  // Released / Claimed
  'Claimed': REQUEST_STATUS.RELEASED,
  'CLAIMED': REQUEST_STATUS.RELEASED,
  'Completed': REQUEST_STATUS.RELEASED,
  'COMPLETED': REQUEST_STATUS.RELEASED,
  'Released': REQUEST_STATUS.RELEASED,
  'RELEASED': REQUEST_STATUS.RELEASED,
  'Claimed / Released': REQUEST_STATUS.RELEASED,
  'CLAIMED / RELEASED': REQUEST_STATUS.RELEASED,
  'Claimed/Released': REQUEST_STATUS.RELEASED,
  'CLAIMED/RELEASED': REQUEST_STATUS.RELEASED,

  // On Hold / Requirements Verification
  'On Hold': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'ON HOLD': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'ON_HOLD': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'Hold': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'HOLD': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'Requirements Verification': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'REQUIREMENTS VERIFICATION': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'REQUIREMENTS_VERIFICATION': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'Clearance Verified': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'CLEARANCE VERIFIED': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,
  'CLEARANCE_VERIFIED': REQUEST_STATUS.REQUIREMENTS_VERIFICATION,

  // Requirements Rejected
  'Requirements Rejected': REQUEST_STATUS.REQUIREMENTS_REJECTED,
  'REQUIREMENTS REJECTED': REQUEST_STATUS.REQUIREMENTS_REJECTED,
  'REQUIREMENTS_REJECTED': REQUEST_STATUS.REQUIREMENTS_REJECTED,

  // Rejected
  'Rejected': REQUEST_STATUS.REJECTED,
  'REJECTED': REQUEST_STATUS.REJECTED,

  // Cancelled
  'Cancelled': REQUEST_STATUS.CANCELLED,
  'CANCELLED': REQUEST_STATUS.CANCELLED,
  'Canceled': REQUEST_STATUS.CANCELLED,
  'CANCELED': REQUEST_STATUS.CANCELLED,
});

/**
 * Normalizes any status input (enum or UI label) to canonical backend REQUEST_STATUS.
 */
export function normalizeToBackendStatus(status) {
  if (!status) return REQUEST_STATUS.PENDING;
  if (BACKEND_STATUS_MAP[status]) return BACKEND_STATUS_MAP[status];
  const s = String(status).trim();
  if (BACKEND_STATUS_MAP[s]) return BACKEND_STATUS_MAP[s];
  const upper = s.toUpperCase().replace(/[-\s/]+/g, '_');
  if (BACKEND_STATUS_MAP[upper]) return BACKEND_STATUS_MAP[upper];
  return REQUEST_STATUS.PENDING;
}

/**
 * Status display configuration for UI presentation, badges, and filters.
 */
export const STATUS_CONFIG = Object.freeze({
  [REQUEST_STATUS.PENDING]: {
    label: 'Pending',
    badgeClass: 'pending',
    badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  [REQUEST_STATUS.REQUIREMENTS_VERIFICATION]: {
    label: 'On Hold',
    detailLabel: 'Requirements Verification',
    badgeClass: 'on-hold',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-200',
  },
  [REQUEST_STATUS.REQUIREMENTS_REJECTED]: {
    label: 'Requirements Rejected',
    detailLabel: 'Requirements Rejected',
    badgeClass: 'rejected',
    badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  [REQUEST_STATUS.PAYMENT_PENDING]: {
    label: 'Pending Payment',
    detailLabel: 'For Payment',
    badgeClass: 'for-payment',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  [REQUEST_STATUS.FOR_VERIFICATION]: {
    label: 'For Verification',
    detailLabel: 'For Verification',
    badgeClass: 'for-verification',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-200',
  },
  [REQUEST_STATUS.PAYMENT_VERIFIED]: {
    label: 'Processing',
    detailLabel: 'Payment Verified',
    badgeClass: 'processing',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  [REQUEST_STATUS.PROCESSING]: {
    label: 'Processing',
    detailLabel: 'Processing',
    badgeClass: 'processing',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  [REQUEST_STATUS.READY_FOR_RELEASE]: {
    label: 'Ready for Pickup',
    detailLabel: 'Releasing',
    badgeClass: 'releasing',
    badgeColor: 'bg-violet-100 text-violet-900 border-violet-200',
  },
  [REQUEST_STATUS.RELEASED]: {
    label: 'Claimed',
    detailLabel: 'Released',
    badgeClass: 'claimed',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  },
  [REQUEST_STATUS.REJECTED]: {
    label: 'Rejected',
    detailLabel: 'Rejected',
    badgeClass: 'rejected',
    badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  [REQUEST_STATUS.CANCELLED]: {
    label: 'Cancelled',
    detailLabel: 'Cancelled',
    badgeClass: 'cancelled',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
});

/**
 * Single Source of Truth for formatting raw request status into human-readable UI label.
 */
export function formatStatusDisplay(rawStatus, options = {}) {
  if (!rawStatus) return 'Pending';
  const norm = normalizeToBackendStatus(rawStatus);
  const cfg = STATUS_CONFIG[norm];
  if (!cfg) return 'Pending';
  if (options.useReleasing && norm === REQUEST_STATUS.READY_FOR_RELEASE) {
    return 'Releasing';
  }
  return cfg.label || 'Pending';
}

/**
 * Checks if a request is in claimed / completed status.
 */
export function isClaimedStatus(status) {
  if (!status) return false;
  const raw = typeof status === 'object' ? (status.batch_status || status.status || status.rawStatus || status.raw_status) : status;
  const s = String(raw || '').trim().toUpperCase();
  return ['CLAIMED', 'COMPLETED'].includes(s) || s.includes('CLAIM');
}

/**
 * Standard list of display status filter options.
 */
export const REQUEST_STATUSES = Object.freeze([
  'Pending',
  'Pending Payment',
  'For Verification',
  'Processing',
  'Releasing',
  'Claimed',
  'On Hold',
  'Rejected',
  'Cancelled',
]);
