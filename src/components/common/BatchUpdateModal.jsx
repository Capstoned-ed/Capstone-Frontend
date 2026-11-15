import React, { useState } from 'react';

const STATUS_OPTIONS = [
  { value: '', label: '-- No change (Keep current status) --' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Pending Payment', label: 'Pending Payment' },
  { value: 'For Processing', label: 'For Processing' },
  { value: 'Processing', label: 'Processing' },
  { value: 'For release', label: 'For release' },
  { value: 'Claimed', label: 'Claimed' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Rejected', label: 'Rejected' },
];

export default function BatchUpdateModal({
  isOpen,
  onClose,
  selectedRequests = [],
  onConfirm,
}) {
  const [newStatus, setNewStatus] = useState('');
  const [releasingDate, setReleasingDate] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newStatus && !releasingDate && !note.trim()) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm({
        newStatus: newStatus || undefined,
        releasingDate: releasingDate || undefined,
        note: note.trim() || undefined,
      });
      // Reset form
      setNewStatus('');
      setReleasingDate('');
      setNote('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasAnyChange = Boolean(newStatus || releasingDate || note.trim());

  return (
    <div className="staff-process-backdrop" onClick={onClose}>
      <div
        className="staff-process-dialog max-w-lg w-full !p-0 overflow-hidden shadow-2xl rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#0B0B36] to-[#1e1b4b] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                Batch Update Requests
              </h3>
              <p className="text-xs text-slate-300">
                Updating {selectedRequests.length} selected {selectedRequests.length === 1 ? 'request' : 'requests'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Selected Requests Preview Tags */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Selected Requests ({selectedRequests.length})
          </div>
          <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto pr-1">
            {selectedRequests.map((r) => (
              <span
                key={r.rawId || r.id}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-white text-indigo-950 border border-slate-200 shadow-2xs"
                title={`${r.student_name} - ${r.document_type}`}
              >
                <span className="font-mono">{r.id || r.tracking_number}</span>
                <span className="text-slate-400 font-normal">({r.student_name})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Field 1: New Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Update Status
            </label>
            <div className="relative">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-950/20 focus:border-indigo-950 transition-all font-medium text-slate-800"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Select a new status to apply to all selected requests, or keep current.
            </p>
          </div>

          {/* Field 2: Releasing Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Releasing Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={releasingDate}
                onChange={(e) => setReleasingDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-950/20 focus:border-indigo-950 transition-all font-medium text-slate-800"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Set the estimated or scheduled releasing date for these requests.
            </p>
          </div>

          {/* Field 3: Note / Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Note / Remarks
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Ready for pickup at Window 3, verified all clearances..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-950/20 focus:border-indigo-950 transition-all font-medium text-slate-800 placeholder-slate-400"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              This note will be attached to the remarks and history audit logs of each request.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasAnyChange || isSubmitting}
              className={`flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold text-white rounded-xl shadow-sm transition-all cursor-pointer ${
                !hasAnyChange || isSubmitting
                  ? 'bg-slate-300 cursor-not-allowed opacity-70'
                  : 'bg-[#0B0B36] hover:bg-indigo-900 shadow-indigo-950/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Apply to {selectedRequests.length} {selectedRequests.length === 1 ? 'Request' : 'Requests'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

