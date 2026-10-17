import React, { useState, useEffect } from 'react';
import clearancesApi from '../../api/clearances';
import { updateStoredRequest } from '../../api/requests';
import useToast from '../../hooks/useToast';

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
  const [clearanceStatus, setClearanceStatus] = useState(() => {
    if (selectedRequest?.clearance_status) return selectedRequest.clearance_status;
    return selectedRequest?.clearance_preview ? 'PENDING' : 'NOT_ATTACHED';
  });

  useEffect(() => {
    setClearanceStatus(
      selectedRequest?.clearance_status || (selectedRequest?.clearance_preview ? 'PENDING' : 'NOT_ATTACHED')
    );
  }, [selectedRequest]);

  const handleVerifyClearance = async (statusToSet) => {
    setClearanceStatus(statusToSet);
    const targetId = selectedRequest.id || selectedRequest.rawId;

    if (selectedRequest.clearance_id) {
      try {
        await clearancesApi.review(selectedRequest.clearance_id, {
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

  if (!selectedRequest) return null;

  return (
    <div className="staff-process-backdrop" onClick={onBackToList}>
      <div className="staff-process-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Sticky Header with Title and Close Button */}
        <div className="staff-process-header">
          <div>
            <h2 className="staff-process-title">Process Request</h2>
            <p className="staff-process-sub">
              {selectedRequest.tracking_number || selectedRequest.id} Update status and Add notes
            </p>
          </div>
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

        {/* Form wrapping scrollable body and sticky footer */}
        <form onSubmit={onUpdateStatus} className="staff-process-form">
          <div className="staff-process-body">
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
              <div className="pt-3 border-t border-slate-200">
                <span className="staff-field-label block mb-2 font-bold text-slate-700">
                  Student Verification &amp; Clearance
                </span>
                
                {selectedRequest.clearance_preview || selectedRequest.clearance_id ? (
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                    {/* Top: Attached Photo / Document and Details */}
                    <div className="flex items-center gap-3.5">
                      {selectedRequest.clearance_preview?.startsWith('data:application/pdf') || selectedRequest.clearance_is_pdf ? (
                        <div className="w-14 h-14 rounded-xl bg-red-100 text-red-700 flex flex-col items-center justify-center font-bold text-xs shrink-0 border border-red-200 shadow-xs">
                          <span className="text-lg">📄</span>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold">PDF</span>
                        </div>
                      ) : selectedRequest.clearance_preview ? (
                        <img
                          src={selectedRequest.clearance_preview}
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
                          {selectedRequest.clearance_file_name || 'Student Clearance Form'}
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
                        title="Mark clearance as verified"
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
                        title="Mark clearance as not cleared"
                      >
                        <span>✕</span>
                        <span>Not Cleared</span>
                      </button>

                      {selectedRequest.clearance_preview && (
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
                        onClick={() => handleOpenClearance(selectedRequest.clearance_id, selectedRequest.clearance_preview)}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-all cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <span>Open in Tab</span>
                        <span>↗</span>
                      </button>
                    </div>

                    {/* Inline Preview Drawer */}
                    {showInlineClearance && selectedRequest.clearance_preview && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {selectedRequest.clearance_preview.startsWith('data:application/pdf') || selectedRequest.clearance_is_pdf ? (
                          <iframe
                            src={selectedRequest.clearance_preview}
                            title="Clearance Document"
                            className="w-full h-80 rounded-lg border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-2 flex items-center justify-center">
                            <img
                              src={selectedRequest.clearance_preview}
                              alt="Clearance Form Full View"
                              className="max-h-72 object-contain rounded"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2.5">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span>ℹ️</span>
                      <span>No clearance document attached with this request.</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVerifyClearance('VERIFIED')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                          clearanceStatus === 'VERIFIED' || clearanceStatus === 'APPROVED'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                        }`}
                      >
                        <span>✓</span>
                        <span>Verify Clearance</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyClearance('REJECTED')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
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
                {selectedRequest.photo_preview && (
                  <div className="mt-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedRequest.photo_preview}
                        alt="Attached 2x2 Photo"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0 shadow-xs"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-900">Passport / 2x2 Photo</span>
                        <span className="text-[11px] text-emerald-700 font-semibold mt-0.5">✓ Uploaded by Student</span>
                      </div>
                    </div>
                    {/* Button placed below the attached photo */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenClearance(null, selectedRequest.photo_preview)}
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
            <div className="space-y-4">
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
            </div>
          </div>

          {/* Sticky Footer Buttons: Close & Update */}
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
  );
}
