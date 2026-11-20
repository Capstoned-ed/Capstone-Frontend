import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import useToast from '../../hooks/useToast';
import '../../styles/student/TrackStatusPage.css';

/**
 * Reusable official USTP Claim Stub Modal.
 * Matches the official USTP Claim Stub paper format.
 * Supports crisp PDF download and standard printing.
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

  const normalizeClaimCourse = (rawCourse, trackNo) => {
    const shortToBs = {
      IT: 'BSIT',
      CS: 'BSCS',
      TCM: 'BSTCM',
      DS: 'BSDS',
      CE: 'BSCE',
      CPE: 'BSCpE',
      EE: 'BSEE',
      GE: 'BSGE',
      ME: 'BSME',
      ARCH: 'BS Arch',
      AM: 'BSAM',
      AP: 'BSAP',
      CHEM: 'BSChem',
      ES: 'BSES',
      FT: 'BSFT',
    };
    const clean = String(rawCourse || '').trim();
    if (clean && clean !== '—') {
      const upper = clean.toUpperCase();
      if (shortToBs[upper]) return shortToBs[upper];
      return clean;
    }
    const tCode = String(trackNo || '').trim();
    const prefixMatch = tCode.match(/^([A-Za-z][A-Za-z\s-]{0,12}?)-\d{2}-\d{2}-/);
    if (prefixMatch && prefixMatch[1]) {
      const p = prefixMatch[1].trim();
      const pUpper = p.toUpperCase();
      if (shortToBs[pUpper]) return shortToBs[pUpper];
      if (!['REQ', 'RQ'].includes(pUpper)) return p;
    }
    return '—';
  };

  const displayCourse = normalizeClaimCourse(
    claimStubDetails.course,
    trackingNumber || claimStubDetails.tracking_number || claimStubDetails.id
  );

  const handleDownloadPdf = async () => {
    const element = claimStubRef.current;
    if (!element || downloading) return;
    setDownloading(true);
    const safeRef = trackingNumber || claimStubDetails?.tracking_number || claimStubDetails?.id || 'DOC';
    const filename = `Claim-Stub-${safeRef}.pdf`;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      const finalHeight = Math.min(pdfHeight, pdf.internal.pageSize.getHeight());
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, finalHeight);
      pdf.save(filename);
      toast.success('Claim Stub downloaded successfully!');
    } catch (err) {
      console.error('Failed to generate Claim Stub PDF:', err);
      try {
        const canvasFallback = await html2canvas(element, { scale: 2, logging: false });
        const link = document.createElement('a');
        link.download = filename.replace('.pdf', '.png');
        link.href = canvasFallback.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Claim Stub downloaded as PNG!');
      } catch (fallbackErr) {
        toast.error('Could not download file. You can use the Print button instead.');
      }
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
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 min-w-0">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Document Claim Stub
            </span>
            {trackingNumber && (
              <span className="text-xs text-slate-400 font-medium break-all">
                • {trackingNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="claim-stub-download-btn"
              title="Download Claim Stub as PDF"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM7 9V5a2 2 0 012-2h6a2 2 0 012 2v4" />
              </svg>
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="claim-stub-close-btn shrink-0"
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

          {/* Row 2: COURSE & DATE OF RELEASE */}
          <div className="claim-stub-fields-row row-course">
            <div className="claim-stub-field course-field">
              <span className="claim-stub-label">COURSE:</span>
              <span className="claim-stub-underline">{displayCourse}</span>
            </div>
            <div className="claim-stub-field release-field">
              <span className="claim-stub-label">DATE OF RELEASE:</span>
              <span className="claim-stub-underline">{claimStubDetails.dateOfRelease || '—'}</span>
            </div>
          </div>

          {/* Row 3: CREDENTIAL REQUESTED */}
          <div className="claim-stub-fields-row">
            <div className="claim-stub-field cred-field">
              <span className="claim-stub-label">CREDENTIAL REQUESTED:</span>
              <span className="claim-stub-underline">{claimStubDetails.credentialRequested || '—'}</span>
            </div>
          </div>

          {/* Bottom Row: Note + Assessed by & O.R. No. */}
          <div className="mt-4 pt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <p className="text-[11px] italic font-semibold text-slate-800 leading-snug max-w-md m-0">
              Note: This stub should be presented upon claiming records. If lost, a valid Identification (ID) card must be presented.
            </p>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 shrink-0">
              <div className="claim-stub-field min-w-[140px]">
                <span className="claim-stub-label">Assessed by:</span>
                <span className="claim-stub-underline">{claimStubDetails.assessedBy || '—'}</span>
              </div>
              <div className="claim-stub-field min-w-[120px]">
                <span className="claim-stub-label">O.R. No:</span>
                <span className="claim-stub-underline font-mono">{claimStubDetails.orNumber || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

