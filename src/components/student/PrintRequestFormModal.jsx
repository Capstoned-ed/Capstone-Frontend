import React, { useRef, useState, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../hooks/useAuth';
import USTPRequestFormDocument from './USTPRequestFormDocument';
import '../../styles/student/DownloadRequestFormPage.css';

/**
 * PrintRequestFormModal
 * Staff modal for previewing and printing/downloading the student's official updated form.
 * 
 * Uses the exact same shared USTPRequestFormDocument component and DownloadRequestFormPage.css
 * so that the staff preview is 100% identical in appearance, font, checkboxes, and layout
 * to what the student sees on their dedicated download page.
 */
export default function PrintRequestFormModal({
  isOpen,
  onClose,
  requestData = {},
}) {
  const { user } = useAuth();
  const formRef = useRef(null);
  const downloadingRef = useRef(false);
  const [downloading, setDownloading] = useState(false);

  const trackingCode =
    requestData?.tracking_number ||
    requestData?.trackingId ||
    requestData?.id ||
    'REQ-USTP';

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Export strictly 1 page PDF on Philippine Long Bond Paper (8.5in x 13in / Folio)
  const handleDownloadPdf = useCallback(async () => {
    if (downloadingRef.current) return;
    const element = formRef.current || document.querySelector('.ustp-long-bondpaper');
    if (!element) return;

    downloadingRef.current = true;
    setDownloading(true);

    try {
      element.classList.add('pdf-export-mode');

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      await new Promise((resolve) => setTimeout(resolve, 60));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 816, // 8.5in at 96 DPI
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [8.5, 13],
        compress: true,
      });

      const pageWidth = 8.5;
      const pageHeight = 13.0;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));

      const safeTracking = trackingCode || 'RQ';
      pdf.save(`USTP_Request_Form_${safeTracking}.pdf`);
    } catch (err) {
      console.error('Direct PDF export error, falling back to browser print:', err);
      const originalTitle = document.title;
      document.title = ' ';
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    } finally {
      if (element) {
        element.classList.remove('pdf-export-mode');
      }
      downloadingRef.current = false;
      setDownloading(false);
    }
  }, [trackingCode]);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-[#525659] rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-600 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:max-h-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Toolbar (Matching Student Page Colors & Controls) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/20 bg-[#0B0B36] text-white shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold m-0 text-white flex items-center gap-2">
              <span>Official Request Form Preview</span>
              <span className="font-mono text-xs font-semibold bg-white/20 px-2 py-0.5 rounded border border-white/30 text-amber-200">
                {trackingCode}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-3.5 py-1.5 bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0B0B36] font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              title="Download official PDF (Long Bond Paper)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{downloading ? 'Downloading...' : 'Download Form (PDF)'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-lg border border-white/30 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Print directly"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
              title="Close preview"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Document Container (renders identical PDF reader workspace view) */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 flex justify-center bg-[#525659] print:p-0 print:bg-white print:overflow-visible">
          <USTPRequestFormDocument
            ref={formRef}
            requestData={requestData}
            user={user}
          />
        </div>
      </div>
    </div>
  );
}
