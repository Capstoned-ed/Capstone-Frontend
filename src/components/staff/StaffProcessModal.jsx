import React, { useState, useEffect, useMemo } from 'react';
import clearancesApi, { resolveClearancePreview } from '../../api/clearances';
import { getStoredPaymentProof } from '../../api/payments';
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
  requestStatuses = [],
  getStatusBadge,
}) {
  const toast = useToast();
  const [showInlineClearance, setShowInlineClearance] = useState(false);
  const [clearanceDoc, setClearanceDoc] = useState(null);
  const [loadingClearance, setLoadingClearance] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showInlineReceipt, setShowInlineReceipt] = useState(false);

  const trackingCode =
    selectedRequest?.tracking_number || selectedRequest?.trackingId || selectedRequest?.id;

  const paymentProof = useMemo(() => {
    if (!selectedRequest) return null;
    return (
      selectedRequest?.payment_proof ||
      getStoredPaymentProof([
        trackingCode,
        selectedRequest?.id,
        selectedRequest?.rawId,
      ])
    );
  }, [selectedRequest, trackingCode]);

  const activeReceiptImage =
    paymentProof?.receiptImage ||
    paymentProof?.receiptDataUrl ||
    selectedRequest?.receipt_image ||
    null;

  const hasReceiptUploaded = Boolean(activeReceiptImage);

  const activeOrNumber =
    paymentProof?.receiptReferenceNumber ||
    selectedRequest?.or_number ||
    '';

  const assessedAmount = useMemo(() => {
    if (!selectedRequest) return '₱100.00';
    const baseAmt =
      selectedRequest.assessed_amount ||
      selectedRequest.amount ||
      selectedRequest.price ||
      '₱100.00';
    return typeof baseAmt === 'number'
      ? `₱${baseAmt.toFixed(2)}`
      : String(baseAmt).startsWith('₱') || String(baseAmt).startsWith('P')
      ? String(baseAmt)
      : `₱${baseAmt}`;
  }, [selectedRequest]);

  const dateOfRelease =
    selectedRequest?.date_of_release ||
    selectedRequest?.release_date ||
    'N/A';

  const normalizeStatus = (val) => (val === 'For Payment' || val === 'FOR PAYMENT' ? 'Pending Payment' : val);
  const [localStatus, setLocalStatus] = useState(() =>
    normalizeStatus(newStatus || selectedRequest?.status || 'For Processing')
  );

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

  // Staff status options focused on processing approved requests, preparing documents & releasing
  const statusOptions = useMemo(() => {
    const defaultStatuses = [
      'For Processing',
      'Processing',
      'Releasing',
      'Claimed',
    ];
    const base = (
      Array.isArray(requestStatuses) && requestStatuses.length > 0
        ? [...requestStatuses]
        : defaultStatuses
    ).filter((st) => st !== 'Pending Payment');

    const currentVal = normalizeStatus(localStatus || newStatus);
    if (currentVal && !base.includes(currentVal)) {
      base.unshift(currentVal);
    }

    return base;
  }, [requestStatuses, localStatus, newStatus]);

  useEffect(() => {
    if (!selectedRequest) return;

    let ignore = false;
    let cleanupFn = null;

    async function loadClearance() {
      setLoadingClearance(true);
      try {
        const resolved = await resolveClearancePreview(selectedRequest);
        if (!ignore && resolved) {
          setClearanceDoc(resolved);
          if (resolved.cleanup) cleanupFn = resolved.cleanup;
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
  const rawClearance = selectedRequest?.clearance_status;
  const isClearanceApproved = rawClearance === 'VERIFIED' || rawClearance === 'APPROVED';
  const isClearanceRejected = rawClearance === 'REJECTED' || rawClearance === 'NOT_VERIFIED';

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
              <p className="text-xs text-slate-500 mt-0.5">
                Process approved request, prepare document, and update request status
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="px-3 py-1.5 bg-[#0B0B36] hover:bg-[#1E1E6B] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Prepare & print official credential request form"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Prepare / Print Form</span>
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
                    1. Request &amp; Document Details
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
                    <span className="staff-field-label">Document to Prepare</span>
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

                <div className="staff-process-grid-2 mt-3">
                  <div className="staff-field-group">
                    <span className="staff-field-label">Assessed Fee / O.R. No.</span>
                    <div className="staff-field-pill font-semibold">
                      {assessedAmount} {activeOrNumber ? `• OR: ${activeOrNumber}` : ''}
                    </div>
                  </div>

                  <div className="staff-field-group">
                    <span className="staff-field-label">Target Release Date</span>
                    <div className="staff-field-pill font-semibold">{dateOfRelease}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="staff-field-label">Purpose</span>
                  <div className="staff-field-box text-xs">
                    {selectedRequest.purpose || selectedRequest.remarks || 'For Personal File / Employment'}
                  </div>
                </div>
              </div>

              {/* Box 2: Registrar Review Status & Attachments (View-Only for Staff) */}
              <div className="staff-process-box">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>2. Registrar Approval &amp; Supporting Documents (View Only)</span>
                  </span>
                  {isClearanceApproved ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Approved by Registrar
                    </span>
                  ) : isClearanceRejected ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      Rejected by Registrar
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Reviewed by Registrar
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {/* Clearance Attachment Preview */}
                  {loadingClearance ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                      Loading clearance attachment...
                    </div>
                  ) : clearanceDoc || selectedRequest.clearance_preview || selectedRequest.clearance_id ? (
                    <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          Clearance: {clearanceDoc?.fileName || selectedRequest.clearance_file_name || 'Certificate_of_Clearance.pdf'}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowInlineClearance((p) => !p)}
                            className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer"
                          >
                            {showInlineClearance ? 'Hide' : 'Preview'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenClearance(
                                selectedRequest.clearance_id,
                                clearanceDoc?.url || selectedRequest.clearance_preview
                              )
                            }
                            className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer"
                          >
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
                              className="w-full h-64 rounded-lg border border-slate-300 bg-white"
                            />
                          ) : (
                            <div className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-2 flex items-center justify-center">
                              <img
                                src={clearanceDoc?.url || selectedRequest.clearance_preview}
                                alt="Clearance Full View"
                                className="max-h-64 object-contain rounded"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                      No clearance file attached.
                    </div>
                  )}

                  {/* Official Receipt Preview */}
                  {hasReceiptUploaded && (
                    <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          Official Receipt {activeOrNumber ? `(OR: ${activeOrNumber})` : ''}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowInlineReceipt((p) => !p)}
                            className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer"
                          >
                            {showInlineReceipt ? 'Hide' : 'Preview'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(activeReceiptImage)}
                            className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer"
                          >
                            Open in Tab
                          </button>
                        </div>
                      </div>
                      {showInlineReceipt && (
                        <div className="pt-2 border-t border-slate-200">
                          <div className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-2 flex items-center justify-center">
                            <img
                              src={activeReceiptImage}
                              alt="Official Receipt"
                              className="max-h-56 object-contain rounded"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 3: Document Processing & Status Update */}
              <div className="staff-process-box border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2 mb-3">
                  <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                    3. Process Document &amp; Update Request Status
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Request Status
                    </label>
                    <select
                      value={localStatus || newStatus || 'For Processing'}
                      onChange={(e) => handleManualStatusChange(e.target.value)}
                      className="staff-select-input"
                    >
                      {statusOptions.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Processing Remarks / Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Document preparation / release notes (optional)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="staff-notes-input"
                    />
                  </div>
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
        }}
      />
    </>
  );
}
