import React, { useState } from 'react';
import useToast from '../../hooks/useToast';
import requestsApi, { updateStoredRequest } from '../../api/requests';
import clearancesApi from '../../api/clearances';
import { saveStoredNotification } from '../../api/notifications';

export default function ProcessRequestModal({
  isOpen,
  onClose,
  requestItem,
  onUpdated,
}) {
  const BACKEND_STATUS_MAP = {
    'Pending': 'PENDING',
    'Pendong': 'PENDING',
    'Processing': 'PROCESSING',
    'For release': 'READY_FOR_RELEASE',
    'Claimed': 'RELEASED',
    'On Hold': 'REQUIREMENTS_VERIFICATION',
  };

  const toast = useToast();
  const [newStatus, setNewStatus] = useState(() => requestItem?.status || 'Pending');
  const [notes, setNotes] = useState(''); // Empty at first open as explicitly requested
  const [loading, setLoading] = useState(false);
  const [showInlineClearance, setShowInlineClearance] = useState(false);
  const [clearanceStatus, setClearanceStatus] = useState(() => {
    if (requestItem?.clearance_status) return requestItem.clearance_status;
    return requestItem?.clearance_preview ? 'PENDING' : 'NOT_ATTACHED';
  });

  // Ensure notes start completely empty and clearance status syncs when a new request is opened
  React.useEffect(() => {
    setNotes('');
    setClearanceStatus(requestItem?.clearance_status || (requestItem?.clearance_preview ? 'PENDING' : 'NOT_ATTACHED'));
  }, [requestItem]);

  const handleVerifyClearance = async (statusToSet) => {
    setClearanceStatus(statusToSet);
    const targetId = requestItem.id || requestItem.rawId;

    if (requestItem.clearance_id) {
      try {
        await clearancesApi.review(requestItem.clearance_id, {
          status: statusToSet === 'VERIFIED' ? 'APPROVED' : 'REJECTED',
          remarks: notes || '',
        });
      } catch (err) {
        console.warn('Backend review clearance notice:', err);
      }
    }

    updateStoredRequest(targetId, {
      clearance_status: statusToSet,
    });

    if (statusToSet === 'VERIFIED') {
      toast.success('Clearance marked as Verified.');
    } else {
      toast.warning('Clearance marked as Not Cleared / Rejected.');
    }
  };

  const handleOpenClearance = async (clearanceId, directPreview) => {
    try {
      if (directPreview) {
        if (directPreview.startsWith('http://') || directPreview.startsWith('https://') || directPreview.startsWith('blob:')) {
          window.open(directPreview, '_blank');
          return;
        }
        if (directPreview.startsWith('data:')) {
          const parts = directPreview.split(',');
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
      }

      if (clearanceId) {
        toast.info('Fetching clearance document...');
        const { url } = await clearancesApi.getPreviewUrl(clearanceId);
        window.open(url, '_blank');
        return;
      }
      toast.warning('No clearance document URL found.');
    } catch (err) {
      console.warn('Failed to open clearance preview:', err);
      toast.error('Unable to open clearance file.');
    }
  };

  if (!isOpen || !requestItem) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const targetId = requestItem.rawId || requestItem.id;
      if (requestItem.rawId && typeof requestItem.rawId === 'number') {
        const backendStatus = BACKEND_STATUS_MAP[newStatus] || newStatus;
        try {
          await requestsApi.transition(requestItem.rawId, {
            status: backendStatus,
            remarks: notes || requestItem.remarks || '',
          });
        } catch (apiErr) {
          console.warn('Backend transition notice:', apiErr);
        }
      }

      // Update in stored requests
      updateStoredRequest(requestItem.id || targetId, {
        status: newStatus,
        remarks: notes.trim() ? notes.trim() : (requestItem.remarks || ''),
        clearance_status: clearanceStatus,
      });

      // Notify the student that their request status has been updated
      saveStoredNotification({
        event_type: 'REQUEST_STATUS_CHANGED',
        message: `Your request (${requestItem.tracking_number || requestItem.id}) status changed to ${newStatus}.`,
        related_object_type: 'CredentialRequest',
        related_object_id: requestItem.tracking_number || requestItem.id,
        target_user_id: requestItem.user || null,
        target_username: requestItem.student_name || null,
        target_student_id: requestItem.student_id || null,
      });

      // Notify Admin and Staff that the request status was updated
      saveStoredNotification({
        event_type: 'REQUEST_STATUS_CHANGED',
        message: `Request ${requestItem.tracking_number || requestItem.id} (${requestItem.student_name || 'Student'}) status was updated to ${newStatus}.`,
        related_object_type: 'CredentialRequest',
        related_object_id: requestItem.tracking_number || requestItem.id,
        target_roles: ['admin', 'staff', 'registrar'],
      });

      toast.success(`Request ${requestItem.tracking_number || requestItem.id} updated to ${newStatus}.`);

      if (onUpdated) {
        onUpdated({
          ...requestItem,
          status: newStatus,
          remarks: notes.trim() ? notes.trim() : (requestItem.remarks || ''),
          clearance_status: clearanceStatus,
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

  const getStatusClass = (status) => {
    switch (status) {
      case 'Pending':
      case 'Pendong':
      case 'PENDING':
      case 'Request Submitted':
        return 'status-pill pending';
      case 'Processing':
      case 'PROCESSING':
      case 'Document Preparation':
        return 'status-pill processing';
      case 'For release':
      case 'READY_FOR_RELEASE':
      case 'Ready for Pickup':
        return 'status-pill for-release';
      case 'Claimed':
      case 'RELEASED':
      case 'Claimed / Released':
        return 'status-pill claimed';
      case 'On Hold':
      case 'on Hold':
      case 'REQUIREMENTS_VERIFICATION':
      case 'CLEARANCE_VERIFIED':
      case 'Cancelled':
      case 'CANCELLED':
        return 'status-pill on-hold';
      default:
        return 'status-pill pending';
    }
  };

  return (
    <div className="process-modal-backdrop" onClick={onClose}>
      <div className="process-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Sticky Header with Title and Close Button */}
        <div className="process-modal-header">
          <div>
            <h3 className="process-modal-title">Process Request</h3>
            <p className="process-modal-sub">
              {requestItem.tracking_number || requestItem.id} Update status and Add notes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="process-modal-close-btn"
            title="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form wrapping scrollable body and sticky footer */}
        <form onSubmit={handleUpdate} className="process-modal-form">
          {/* Scrollable Body */}
          <div className="process-modal-scroll-body">
            {/* Details Card */}
            <div className="process-details-box">
              {/* Row 1: Student Name & Student ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="process-field-group">
                  <span className="process-field-label">Student Name</span>
                  <div className="process-field-value">
                    {requestItem.student_name || 'N/A'}
                  </div>
                </div>

                <div className="process-field-group">
                  <span className="process-field-label">Student ID</span>
                  <div className="process-field-value">
                    {requestItem.student_id || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Row 2: Document Type & Copies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="process-field-group">
                  <span className="process-field-label">Document Type</span>
                  <div className="process-field-value">
                    {requestItem.document_type || 'N/A'}
                  </div>
                </div>

                <div className="process-field-group">
                  <span className="process-field-label">Copies</span>
                  <div className="process-field-value">
                    {requestItem.copies || '1 copy'}
                  </div>
                </div>
              </div>

              {/* Row 3: Purpose & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="process-field-group">
                  <span className="process-field-label">Purpose</span>
                  <div className="process-field-value min-h-[3rem]">
                    {requestItem.purpose || requestItem.remarks || 'No remarks provided'}
                  </div>
                </div>

                <div className="process-field-group">
                  <span className="process-field-label">Amount</span>
                  <div className="process-field-value">
                    {requestItem.amount || 'P0.00'}
                  </div>
                </div>
              </div>

              {/* Row 4: Current Status */}
              <div className="process-field-group">
                <span className="process-field-label">Current Status</span>
                <div>
                  <span className={getStatusClass(requestItem.status)}>
                    {requestItem.status || 'Pending'}
                  </span>
                </div>
              </div>

              {/* Attached Student Documents (Clearance / Photo) */}
              <div className="pt-3 border-t border-slate-200">
                <span className="process-field-label block mb-2 font-bold text-slate-700">
                  Student Verification &amp; Clearance
                </span>
                
                {requestItem.clearance_preview || requestItem.clearance_id ? (
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                    {/* Top: Attached Photo / Document and Details */}
                    <div className="flex items-center gap-3.5">
                      {requestItem.clearance_preview?.startsWith('data:application/pdf') || requestItem.clearance_is_pdf ? (
                        <div className="w-14 h-14 rounded-xl bg-red-100 text-red-700 flex flex-col items-center justify-center font-bold text-xs shrink-0 border border-red-200 shadow-xs">
                          <span className="text-lg">📄</span>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold">PDF</span>
                        </div>
                      ) : requestItem.clearance_preview ? (
                        <img
                          src={requestItem.clearance_preview}
                          alt="Clearance Preview"
                          className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
                          📄
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {requestItem.clearance_file_name || 'Student Clearance Form'}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          {clearanceStatus === 'VERIFIED' || clearanceStatus === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span>✅</span>
                              <span>Clearance Verified</span>
                            </span>
                          ) : clearanceStatus === 'REJECTED' || clearanceStatus === 'NOT_VERIFIED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <span>❌</span>
                              <span>Not Cleared / Rejected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <span>⏳</span>
                              <span>Pending Verification</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Row - Placed BELOW the attached photo */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVerifyClearance('VERIFIED')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                          clearanceStatus === 'VERIFIED' || clearanceStatus === 'APPROVED'
                            ? 'bg-emerald-700 text-white ring-2 ring-emerald-500/20'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                        }`}
                        title="Mark student clearance as verified"
                      >
                        <span>✓</span>
                        <span>Verify Clearance</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyClearance('REJECTED')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                          clearanceStatus === 'REJECTED' || clearanceStatus === 'NOT_VERIFIED'
                            ? 'bg-rose-700 text-white ring-2 ring-rose-500/20'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                        }`}
                        title="Mark student clearance as not cleared"
                      >
                        <span>✕</span>
                        <span>Not Cleared</span>
                      </button>

                      {requestItem.clearance_preview && (
                        <button
                          type="button"
                          onClick={() => setShowInlineClearance((prev) => !prev)}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>{showInlineClearance ? 'Hide Preview' : 'Preview Document'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenClearance(requestItem.clearance_id, requestItem.clearance_preview)}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-all cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <span>Open in Tab</span>
                        <span>↗</span>
                      </button>
                    </div>

                    {/* Inline Preview Drawer */}
                    {showInlineClearance && requestItem.clearance_preview && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {requestItem.clearance_preview.startsWith('data:application/pdf') || requestItem.clearance_is_pdf ? (
                          <iframe
                            src={requestItem.clearance_preview}
                            title="Clearance Document"
                            className="w-full h-80 rounded-lg border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-2 flex items-center justify-center">
                            <img
                              src={requestItem.clearance_preview}
                              alt="Clearance Form Full View"
                              className="max-h-72 object-contain rounded"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span>ℹ️</span>
                      <span>No clearance document attached with this request.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVerifyClearance('VERIFIED')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                          clearanceStatus === 'VERIFIED' || clearanceStatus === 'APPROVED'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                        }`}
                      >
                        <span>✓</span>
                        <span>Verify</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyClearance('REJECTED')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                          clearanceStatus === 'REJECTED' || clearanceStatus === 'NOT_VERIFIED'
                            ? 'bg-rose-700 text-white'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                        }`}
                      >
                        <span>✕</span>
                        <span>Not Cleared</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Passport / 2x2 Photo if student uploaded */}
                {requestItem.photo_preview && (
                  <div className="mt-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={requestItem.photo_preview}
                        alt="Attached 2x2 Photo"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0 shadow-xs"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-900">Passport / 2x2 Photo</span>
                        <span className="text-[11px] text-emerald-700 font-semibold mt-0.5">✓ Uploaded by Student</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenClearance(null, requestItem.photo_preview)}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>View Full Photo</span>
                        <span>↗</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Form Controls */}
            <div className="process-form-body">
              {/* Update Status Dropdown */}
              <div>
                <label className="process-label">Update Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="process-select"
                >
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="For release">For release</option>
                  <option value="Claimed">Claimed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="process-label">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Add optional notes or processing remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="process-select"
                />
              </div>
            </div>
          </div>

          {/* Sticky Footer Actions */}
          <div className="process-modal-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-process-back"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Close</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn-process-update"
            >
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
