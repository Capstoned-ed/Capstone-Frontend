import React, { useState } from 'react';
import useToast from '../../hooks/useToast';
import requestsApi, { updateStoredRequest } from '../../api/requests';

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
  const [notes, setNotes] = useState(() => requestItem?.remarks || '');
  const [loading, setLoading] = useState(false);

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
        remarks: notes || requestItem.remarks,
      });

      toast.success(`Request ${requestItem.tracking_number || requestItem.id} updated to ${newStatus}.`);

      if (onUpdated) {
        onUpdated({
          ...requestItem,
          status: newStatus,
          remarks: notes || requestItem.remarks,
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
    <div className="process-modal-backdrop">
      <div className="process-modal-dialog">
        {/* Header */}
        <div className="process-modal-header">
          <h3 className="process-modal-title">Process Request</h3>
          <p className="process-modal-sub">
            {requestItem.tracking_number || requestItem.id} Update status and Add notes
          </p>
        </div>

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
          {(requestItem.clearance_preview || requestItem.photo_preview) && (
            <div className="pt-3 border-t border-slate-200">
              <span className="process-field-label block mb-2 font-bold text-slate-700">
                Attached Student Uploads
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {requestItem.clearance_preview && (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3">
                    <img
                      src={requestItem.clearance_preview}
                      alt="Attached Clearance Form"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-900">Clearance Form</span>
                      <span className="text-[11px] text-emerald-700 font-semibold mt-0.5">✓ Uploaded by Student</span>
                      <a
                        href={requestItem.clearance_preview}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-indigo-600 hover:underline font-semibold mt-1"
                      >
                        View Full Image
                      </a>
                    </div>
                  </div>
                )}

                {requestItem.photo_preview && (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3">
                    <img
                      src={requestItem.photo_preview}
                      alt="Attached 2x2 Photo"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-900">Passport / 2x2 Photo</span>
                      <span className="text-[11px] text-emerald-700 font-semibold mt-0.5">✓ Uploaded by Student</span>
                      <a
                        href={requestItem.photo_preview}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-indigo-600 hover:underline font-semibold mt-1"
                      >
                        View Full Image
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form Controls */}
        <form onSubmit={handleUpdate}>
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

          {/* Footer Actions */}
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
              <span>Back</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn-process-update"
            >
              {loading ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
