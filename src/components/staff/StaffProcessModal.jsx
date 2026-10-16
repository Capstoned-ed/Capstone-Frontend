import React from 'react';

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
  if (!selectedRequest) return null;

  return (
    <div className="staff-process-card">
      <div>
        <h2 className="staff-process-title">Process Request</h2>
        <p className="staff-process-sub">
          {selectedRequest.tracking_number || selectedRequest.id} Update status and Add notes
        </p>
      </div>

      {/* Details Box */}
      <div className="staff-process-box">
        {/* Row 1: Student Name & Student ID */}
        <div className="staff-process-grid-2">
          <div className="staff-field-group">
            <span className="staff-field-label">Student Name</span>
            <div className="staff-field-pill">{selectedRequest.student_name}</div>
          </div>

          <div className="staff-field-group">
            <span className="staff-field-label">Student ID</span>
            <div className="staff-field-pill">{selectedRequest.student_id}</div>
          </div>
        </div>

        {/* Row 2: Document Type & Copies */}
        <div className="staff-process-grid-2">
          <div className="staff-field-group">
            <span className="staff-field-label">Document Type</span>
            <div className="staff-field-pill">{selectedRequest.document_type}</div>
          </div>

          <div className="staff-field-group">
            <span className="staff-field-label">Copies</span>
            <div className="staff-field-pill">
              {selectedRequest.copies?.replace(' copies', '').replace(' copy', '') || '1'}
            </div>
          </div>
        </div>

        {/* Row 3: Purpose & Amount & Status */}
        <div className="staff-process-grid-2">
          <div className="staff-field-group">
            <span className="staff-field-label">Purpose</span>
            <div className="staff-field-box">
              {selectedRequest.purpose || selectedRequest.remarks || 'No remarks provided'}
            </div>
          </div>

          <div className="space-y-4">
            <div className="staff-field-group">
              <span className="staff-field-label">Amount</span>
              <div className="staff-field-pill">{selectedRequest.amount}</div>
            </div>

            <div className="staff-field-group">
              <span className="staff-field-label">Current Status</span>
              <div>{getStatusBadge ? getStatusBadge(selectedRequest.status) : selectedRequest.status}</div>
            </div>
          </div>
        </div>

        {/* Attached Student Documents (Clearance / Photo) */}
        {(selectedRequest.clearance_preview || selectedRequest.photo_preview) && (
          <div className="pt-3 border-t border-slate-200">
            <span className="staff-field-label block mb-2 font-bold text-slate-700">
              Attached Student Uploads
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedRequest.clearance_preview && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3">
                  <img
                    src={selectedRequest.clearance_preview}
                    alt="Attached Clearance Form"
                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-900">Clearance Form</span>
                    <span className="text-[11px] text-emerald-700 font-semibold mt-0.5">✓ Uploaded by Student</span>
                    <a
                      href={selectedRequest.clearance_preview}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-600 hover:underline font-semibold mt-1"
                    >
                      View Full Image
                    </a>
                  </div>
                </div>
              )}

              {selectedRequest.photo_preview && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3">
                  <img
                    src={selectedRequest.photo_preview}
                    alt="Attached 2x2 Photo"
                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-900">Passport / 2x2 Photo</span>
                    <span className="text-[11px] text-emerald-700 font-semibold mt-0.5">✓ Uploaded by Student</span>
                    <a
                      href={selectedRequest.photo_preview}
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
      <form onSubmit={onUpdateStatus} className="space-y-4">
        <div className="staff-form-group">
          <label className="staff-form-label">Update Status</label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="staff-select-input"
          >
            {requestStatuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="staff-form-group">
          <label className="staff-form-label">Notes (Optional)</label>
          <input
            type="text"
            placeholder="Add optional notes or processing remarks..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="staff-notes-input"
          />
        </div>

        {/* Footer Buttons: Back & Update */}
        <div className="staff-process-footer">
          <button
            type="button"
            onClick={onBackToList}
            disabled={updating}
            className="staff-btn-back"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>

          <button
            type="submit"
            disabled={updating}
            className="staff-btn-update"
          >
            {updating ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </div>
  );
}
