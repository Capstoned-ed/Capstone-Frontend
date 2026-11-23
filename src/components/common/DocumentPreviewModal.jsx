import React, { useEffect } from 'react';

/**
 * DocumentPreviewModal
 * Safe, in-page responsive preview modal for attached clearance documents and photos.
 * Replaces external / new-tab `blob:` navigation which triggers mobile browser Out-Of-Memory crashes.
 *
 * @param {boolean} isOpen - Whether modal is visible
 * @param {Function} onClose - Callback when modal is closed
 * @param {string} title - Header title (e.g. 'Clearance Document Preview')
 * @param {string} src - Data URL, Blob URL, or secure remote URL of document
 * @param {string} fileName - File name to display and use for download
 * @param {boolean} [isPdf] - Explicit PDF flag (inferred from fileName/src if omitted)
 */
export default function DocumentPreviewModal({
  isOpen,
  onClose,
  title = 'Document Preview',
  src,
  fileName = '',
  isPdf = false,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  const resolvedIsPdf =
    Boolean(isPdf) ||
    String(fileName || '').toLowerCase().endsWith('.pdf') ||
    String(src || '').startsWith('data:application/pdf');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs transition-opacity animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <span className="text-xl shrink-0" aria-hidden="true">
              {resolvedIsPdf ? '📄' : '🖼️'}
            </span>
            <div className="min-w-0">
              <h3
                id="preview-modal-title"
                className="text-sm font-bold text-slate-800 truncate leading-snug"
              >
                {title}
              </h3>
              {fileName && (
                <p className="text-xs text-slate-500 truncate leading-none mt-0.5">
                  {fileName}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 active:scale-95 transition shrink-0"
            aria-label="Close preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/5 min-h-[220px]">
          {resolvedIsPdf ? (
            <div className="p-6 flex flex-col items-center justify-center text-center space-y-4 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-3xl shadow-xs">
                📄
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 text-sm sm:text-base">
                  {fileName || 'Attached PDF Document'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  PDF document attached successfully.
                </p>
              </div>
              <a
                href={src}
                download={fileName || 'Clearance_Document.pdf'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1e3a8a] text-white shadow-xs hover:bg-[#172554] active:scale-95 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </a>
            </div>
          ) : (
            <img
              src={src}
              alt={title || 'Document preview'}
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-sm border border-slate-200/60"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 active:scale-95 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

