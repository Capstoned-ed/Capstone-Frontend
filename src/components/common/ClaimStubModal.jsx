import React, { useRef, useState } from 'react';
import useToast from '../../hooks/useToast';
import '../../styles/student/TrackStatusPage.css';

/**
 * Reusable official USTP Claim Stub Modal.
 * Matches the official USTP Claim Stub paper format.
 * Supports crisp PDF download (via html2pdf.js) and standard printing.
 */
export default function ClaimStubModal({
  isOpen,
  onClose,
  claimStubDetails,
  trackingNumber = '',
  onPrint = null,
}) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const claimStubRef = useRef(null);

  if (!isOpen || !claimStubDetails) return null;

  const handleDownloadPdf = async () => {
    const element = claimStubRef.current;
    if (!element || downloading) return;
    setDownloading(true);
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;
      const safeTracking = trackingNumber || 'DOC';
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `USTP_Claim_Stub_${safeTracking}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      };
      await html2pdf().set(opt).from(element).save();
      toast.success('Claim Stub downloaded successfully!');
    } catch (err) {
      console.error('Failed to generate Claim Stub PDF:', err);
      toast.error('Could not download PDF. You can use the Print button instead.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (typeof onPrint === 'function') {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div
      className="claim-stub-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="claim-stub-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Official Claim Stub"
      >
        {/* Modal Controls (Hidden in Print) */}
        <div className="claim-stub-modal-header claim-stub-no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Document Claim Stub
            </span>
            {trackingNumber && (
              <span className="text-xs text-slate-400 font-medium">
                • {trackingNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="claim-stub-download-btn"
              title="Download Claim Stub as PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{downloading ? 'Downloading...' : 'Download'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="claim-stub-print-btn"
              title="Print Claim Stub"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM7 9V5a2 2 0 012-2h6a2 2 0 012 2v4" />
              </svg>
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="claim-stub-close-btn"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Physical Claim Stub Slip matching uploaded image */}
        <div ref={claimStubRef} className="claim-stub-paper claim-stub-print-area">
          <h2 className="claim-stub-title">CLAIM STUB</h2>

          <div className="claim-stub-notice-row">
            <span className="claim-stub-notice-text">
              <u>Notice: Please be informed that <strong>RELEASING TIME</strong> is from</u>
            </span>
            <span className="claim-stub-notice-box">
              <strong>3:00 to 5:00</strong> in the afternoon.
            </span>
          </div>

          {/* Row 1: NAME & DATE OF REQUEST */}
          <div className="claim-stub-fields-row row-1">
            <div className="claim-stub-field name-field">
              <span className="claim-stub-label">NAME:</span>
              <span className="claim-stub-underline">{claimStubDetails.studentName || '—'}</span>
            </div>
            <div className="claim-stub-field date-field">
              <span className="claim-stub-label">DATE OF REQUEST:</span>
              <span className="claim-stub-underline">{claimStubDetails.dateOfRequest || '—'}</span>
            </div>
          </div>

          {/* Row 2: COURSE & O.R. NO. */}
          <div className="claim-stub-fields-row row-course">
            <div className="claim-stub-field course-field">
              <span className="claim-stub-label">COURSE:</span>
              <span className="claim-stub-underline">{claimStubDetails.course || '—'}</span>
            </div>
            {claimStubDetails.orNumber ? (
              <div className="claim-stub-field date-field">
                <span className="claim-stub-label">O.R. NO.:</span>
                <span className="claim-stub-underline font-mono">{claimStubDetails.orNumber}</span>
              </div>
            ) : (
              <div className="claim-stub-field spacer-field hidden sm:block" />
            )}
          </div>

          {/* Row 3: CREDENTIAL REQUESTED & DATE OF RELEASE */}
          <div className="claim-stub-fields-row row-2">
            <div className="claim-stub-field cred-field">
              <span className="claim-stub-label">CREDENTIAL REQUESTED:</span>
              <span className="claim-stub-underline">{claimStubDetails.credentialRequested || '—'}</span>
            </div>
            <div className="claim-stub-field release-field">
              <span className="claim-stub-label">DATE OF RELEASE:</span>
              <span className="claim-stub-underline">{claimStubDetails.dateOfRelease || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

