import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import requestsApi from '../../api/requests';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import USTPRequestFormDocument from '../../components/student/USTPRequestFormDocument';
import '../../styles/student/DownloadRequestFormPage.css';

export default function DownloadRequestFormPage() {
  const { trackingId } = useParams();
  const [searchParams] = useSearchParams();
  const queryTrackId = searchParams.get('trackId') || '';
  const activeId = trackingId || queryTrackId;
  const isAutoDownload = searchParams.get('download') === 'true' || searchParams.get('auto') === 'true';

  const navigate = useNavigate();
  const { user } = useAuth();

  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const formRef = useRef(null);
  const downloadingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRequest() {
      setLoading(true);
      try {
        // 1. First check local storage submitted requests for instant access
        const stored = JSON.parse(localStorage.getItem('regquest_submitted_requests') || '[]');
        let found = stored.find((r) =>
          String(r.tracking_number || '').toLowerCase() === String(activeId).toLowerCase() ||
          String(r.trackingId || '').toLowerCase() === String(activeId).toLowerCase() ||
          String(r.id || '').toLowerCase() === String(activeId).toLowerCase()
        );

        // 2. If not found in local cache, query API
        if (!found) {
          const apiRequests = await requestsApi.list().catch(() => []);
          found = (Array.isArray(apiRequests) ? apiRequests : []).find((r) =>
            String(r.tracking_number || '').toLowerCase() === String(activeId).toLowerCase() ||
            String(r.id || '').toLowerCase() === String(activeId).toLowerCase()
          );
        }

        // 3. Fallback: if student has latest request in storage
        if (!found && stored.length > 0) {
          found = stored[0];
        }

        if (isMounted) {
          setRequestData(found || null);
        }
      } catch (err) {
        console.warn('Failed to resolve request for form view:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (activeId) {
      loadRequest();
    } else {
      const stored = JSON.parse(localStorage.getItem('regquest_submitted_requests') || '[]');
      if (stored.length > 0) {
        setRequestData(stored[0]);
      }
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [activeId]);

  // Set document title so PDF save defaults to this filename
  const trackingCode = requestData?.tracking_number || requestData?.trackingId || requestData?.id || activeId || 'REQ-USTP';
  useEffect(() => {
    if (trackingCode) {
      document.title = `USTP_Request_Form_${trackingCode}`;
    }
  }, [trackingCode]);

  // Suppress document title during printing so browser doesn't print it in the top margin header
  useEffect(() => {
    const handleBeforePrint = () => {
      document.title = ' ';
    };
    const handleAfterPrint = () => {
      if (trackingCode) {
        document.title = `USTP_Request_Form_${trackingCode}`;
      }
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [trackingCode]);

  const handleDownloadPdf = useCallback(async () => {
    if (downloadingRef.current) return;
    const element = formRef.current || document.querySelector('.ustp-long-bondpaper');
    if (!element) return;

    downloadingRef.current = true;
    setDownloading(true);

    try {
      // 1. Mark element for clean PDF export (removes shadows, zero margin)
      element.classList.add('pdf-export-mode');

      // 2. Ensure fonts are fully loaded so baseline calculations are exact
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // 3. Wait a small tick so layout/styles are clean
      await new Promise((resolve) => setTimeout(resolve, 60));

      // 4. Render canvas at scale 2 for crisp 192+ DPI text & lines
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 816, // 8.5in at 96 DPI
      });

      // 4. Create single-page PDF on Philippine Long Bond Paper (8.5in x 13in / Folio)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [8.5, 13],
        compress: true,
      });

      const pageWidth = 8.5;
      const pageHeight = 13.0;

      // Scale proportionally to fit 8.5in width
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      // Add strictly to the single page (NO addPage call ever - GUARANTEED 1 PAGE)
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));

      const safeTracking = trackingCode || 'RQ';
      pdf.save(`USTP_Request_Form_${safeTracking}.pdf`);
    } catch (err) {
      console.error('Direct PDF export error, falling back to browser print:', err);
      // Fallback: window.print()
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

  // Auto trigger download if URL requested (?download=true or ?auto=true)
  useEffect(() => {
    if (isAutoDownload && requestData && !loading) {
      const timer = setTimeout(() => {
        handleDownloadPdf();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isAutoDownload, requestData, loading, handleDownloadPdf]);

  const handleBack = () => {
    navigate(ROUTES.STUDENT.PAYMENTS || ROUTES.STUDENT.REQUESTS);
  };

  if (loading) {
    return (
      <div className="download-form-page-root">
        <div className="download-form-loading text-white">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-200">Loading Official Request Form...</p>
        </div>
      </div>
    );
  }

  // Helper to check if a string is purely numeric/ID-like
  const isIdNumber = (val) => {
    if (!val) return true;
    const str = String(val).trim();
    return /^\d{5,}$/.test(str) || /^[0-9-]+$/.test(str);
  };

  // Resolve true student full name (never an ID number)
  const resolveStudentRealName = () => {
    // 1. Direct name from request
    if (requestData?.student_name && !isIdNumber(requestData.student_name)) {
      return requestData.student_name;
    }
    if (requestData?.full_name && !isIdNumber(requestData.full_name)) {
      return requestData.full_name;
    }
    if (requestData?.student && typeof requestData.student === 'object') {
      const s = requestData.student;
      if (s.full_name && !isIdNumber(s.full_name)) return s.full_name;
      if (s.first_name) {
        const comb = `${s.first_name} ${s.last_name || ''}`.trim();
        if (comb && !isIdNumber(comb)) return comb;
      }
    }
    // 2. Authenticated user object
    if (user?.full_name && !isIdNumber(user.full_name)) {
      return user.full_name;
    }
    if (user?.first_name) {
      const comb = `${user.first_name} ${user.last_name || ''}`.trim();
      if (comb && !isIdNumber(comb)) return comb;
    }
    // 3. Stored profile in localStorage
    try {
      const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
      const candidates = [
        user?.username,
        user?.student_id,
        user?.id,
        requestData?.student_id,
        requestData?.student_name,
        requestData?.user
      ].filter(Boolean);

      for (const k of candidates) {
        const p = profiles[k];
        if (p) {
          if (p.full_name && !isIdNumber(p.full_name)) return p.full_name;
          if (p.name && !isIdNumber(p.name)) return p.name;
          if (p.first_name) {
            const comb = `${p.first_name} ${p.last_name || ''}`.trim();
            if (comb && !isIdNumber(comb)) return comb;
          }
        }
      }
    } catch {}
    // 4. Stored user object
    try {
      const u = JSON.parse(localStorage.getItem('regquest_user') || localStorage.getItem('user') || '{}');
      if (u.full_name && !isIdNumber(u.full_name)) return u.full_name;
      if (u.first_name) {
        const comb = `${u.first_name} ${u.last_name || ''}`.trim();
        if (comb && !isIdNumber(comb)) return comb;
      }
    } catch {}
    // 5. Default student account fallback (2023301564 is Daisy Traya in mock USTP environment)
    if (
      user?.username === '2023301564' ||
      String(requestData?.student_id) === '2023301564' ||
      String(requestData?.student_name) === '2023301564'
    ) {
      return 'Daisy Traya';
    }
    if (user?.username && !isIdNumber(user.username)) {
      return user.username;
    }
    return 'Daisy Traya';
  };

  // Resolve form attributes
  const studentName = resolveStudentRealName();
  const studentId = requestData?.student_id || user?.student_id || user?.username || 'N/A';
  const course = requestData?.course || user?.course || 'BS in Information Technology';
  const documentType = requestData?.document_type || 'Academic Credential';
  const copies = requestData?.copies || '1 copy';
  const rawAmount = requestData?.assessed_amount || requestData?.amount || '₱100.00';
  const amount = typeof rawAmount === 'number' ? `₱${rawAmount.toFixed(2)}` : String(rawAmount).startsWith('₱') || String(rawAmount).startsWith('P') ? String(rawAmount) : `₱${rawAmount}`;
  const purpose = requestData?.purpose || requestData?.remarks || '';
  const requestDate = requestData?.request_date || (requestData?.created_at ? requestData.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  const birthDate = requestData?.birth_date || '2002-05-15';
  const contactNo = requestData?.contact_no || '09123456789';
  const userCategory = requestData?.user_category || 'student';
  const dateOfGraduation = requestData?.date_of_graduation || '';
  const lastSemAttendance = requestData?.last_sem_attendance || '2nd Sem, AY 2025-2026';
  const verifiedByName = requestData?.verified_by_name || 'Front Desk Personnel';
  const dateOfRelease = requestData?.date_of_release || requestData?.release_date || (new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const orNumber = requestData?.or_number || requestData?.receiptReferenceNumber || '';
  const paymentDate = requestData?.payment_date || '';

  // Matching helpers for Part 2 document type checkboxes (matching Part 2 on RequestDocumentPage)
  const docLower = (documentType || '').toLowerCase();
  const isMatch = (term) => docLower.includes(term.toLowerCase());

  const isEvalSelected = docLower.includes('evaluation') || docLower === 'eval';
  const isHdSelected = docLower.includes('honorable') || docLower.includes('dismissal') || docLower === 'hd';
  const isTorSelected = docLower.includes('transcript') || docLower.includes('tor');
  const isAuthSelected = docLower.includes('authentication') || docLower === 'auth';

  // Sub-items for Certification
  const isCarSelected = docLower === 'car' || docLower.includes('- car') || docLower.includes(' car') || docLower.endsWith('car') || docLower.includes('(car)');
  const isEnrolledSelected = docLower.includes('officially enrolled') || docLower.includes('enrolled') || docLower === 'coe';
  const isGpaSelected = docLower.includes('gpa');
  const isUnitsSelected = docLower.includes('earned') || docLower.includes('unit');
  const isEndorsementSelected = docLower.includes('endorsement');
  const isGradesSelected = docLower.includes('subject') || docLower.includes('grade');

  const isCertSubSelected = isCarSelected || isEnrolledSelected || isGpaSelected || isUnitsSelected || isEndorsementSelected || isGradesSelected;
  const isCertSelected = docLower.includes('cert') || isCertSubSelected;

  const isKnownDoc = isEvalSelected || isHdSelected || isTorSelected || isAuthSelected || isCertSelected;
  const isOtherDoc = !isKnownDoc && Boolean(documentType) && docLower !== 'academic credential' && docLower !== 'credential' && docLower !== 'credentials';

  // Matching helper for purpose checkboxes
  const purpLower = (purpose || '').toLowerCase();
  const isPurpMatch = (term) => purpLower.includes(term.toLowerCase());

  return (
    <div className="download-form-page-root">
      {/* Floating Action Toolbar (Screen Only - Hidden when Printing/Exporting PDF) */}
      <header className="download-form-toolbar no-print">
        <div className="download-form-toolbar-left">
          <button
            type="button"
            onClick={handleBack}
            className="download-form-back-btn"
            title="Return to Payments"
          >
            <span>←</span>
            <span>Back to Payments</span>
          </button>
          <h1 className="download-form-toolbar-title">
            <span>USTP Credential Request Form</span>
            <span className="download-form-tracking-pill">{trackingCode}</span>
          </h1>
        </div>

        <div className="download-form-toolbar-right">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="download-form-download-btn"
            title="Automatically download PDF file"
          >
            {downloading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Form (PDF)</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="download-form-print-btn"
            title="Print directly to printer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print</span>
          </button>
        </div>
      </header>

      {/* Main Document Body: Rendered as 8.5in x 13in Long Bond Paper matching photo exactly */}
      <main className="download-form-sheet-container">
        <USTPRequestFormDocument
          ref={formRef}
          requestData={requestData}
          user={user}
        />
      </main>
    </div>
  );
}
