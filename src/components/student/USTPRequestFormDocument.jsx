import React, { forwardRef } from 'react';
import ustpLogo from '../../assets/USTP Logo against Light Background 1.png';
import '../../styles/student/DownloadRequestFormPage.css';

/**
 * Shared USTP Official Credential Request Form Document (Long Bond Paper: 8.5in x 13in)
 * Used by both:
 * 1. Student dedicated download page (DownloadRequestFormPage.jsx)
 * 2. Staff process & preview modal (PrintRequestFormModal.jsx)
 * 
 * Guarantees that staff and student views are 100% identical in every detail.
 */
const USTPRequestFormDocument = forwardRef(function USTPRequestFormDocument(
  { requestData = {}, user = null },
  ref
) {
  // Safe helper to resolve human student name
  const resolveStudentRealName = () => {
    const isIdNumber = (val) => !val || /^\d+$/.test(String(val).trim()) || String(val).trim().length < 2;

    // 1. Direct requestData name
    if (requestData?.student_name && !isIdNumber(requestData.student_name)) {
      return requestData.student_name;
    }
    if (requestData?.student && !isIdNumber(requestData.student)) {
      return requestData.student;
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
        requestData?.user,
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
    return requestData?.student_name || 'Daisy Traya';
  };

  // Resolve form attributes
  const studentName = resolveStudentRealName();
  const studentId = requestData?.student_id || user?.student_id || user?.username || 'N/A';
  const course = requestData?.course || requestData?.program || user?.course || 'BS in Information Technology';
  const documentType = requestData?.document_type || 'Academic Credential';
  const rawAmount = requestData?.assessed_amount || requestData?.amount || '₱100.00';
  const amount =
    typeof rawAmount === 'number'
      ? `₱${rawAmount.toFixed(2)}`
      : String(rawAmount).startsWith('₱') || String(rawAmount).startsWith('P')
      ? String(rawAmount)
      : `₱${rawAmount}`;
  const purpose = requestData?.purpose || requestData?.remarks || 'For Personal File';
  const requestDate =
    requestData?.request_date ||
    (requestData?.created_at ? requestData.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  const birthDate = requestData?.birth_date || '2002-05-15';
  const contactNo = requestData?.contact_no || '09123456789';
  const userCategory = requestData?.user_category || 'student';
  const dateOfGraduation = requestData?.date_of_graduation || '';
  const lastSemAttendance = requestData?.last_sem_attendance || '2nd Sem, AY 2025-2026';
  const verifiedByName = requestData?.verified_by_name || 'Front Desk Personnel';
  const dateOfRelease =
    requestData?.date_of_release ||
    requestData?.release_date ||
    new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const orNumber = requestData?.or_number || requestData?.receiptReferenceNumber || '';
  const paymentDate = requestData?.payment_date || '';

  // Matching helpers for Part 2 document type checkboxes
  const docLower = (documentType || '').toLowerCase();

  const isEvalSelected = docLower.includes('evaluation') || docLower === 'eval';
  const isHdSelected = docLower.includes('honorable') || docLower.includes('dismissal') || docLower === 'hd';
  const isTorSelected = docLower.includes('transcript') || docLower.includes('tor');
  const isAuthSelected = docLower.includes('authentication') || docLower === 'auth';

  // Sub-items for Certification
  const isCarSelected =
    docLower === 'car' ||
    docLower.includes('- car') ||
    docLower.includes(' car') ||
    docLower.endsWith('car') ||
    docLower.includes('(car)');
  const isEnrolledSelected =
    docLower.includes('officially enrolled') || docLower.includes('enrolled') || docLower === 'coe';
  const isGpaSelected = docLower.includes('gpa');
  const isUnitsSelected = docLower.includes('earned') || docLower.includes('unit');
  const isEndorsementSelected = docLower.includes('endorsement');
  const isGradesSelected = docLower.includes('subject') || docLower.includes('grade');

  const isCertSubSelected =
    isCarSelected || isEnrolledSelected || isGpaSelected || isUnitsSelected || isEndorsementSelected || isGradesSelected;
  const isCertSelected = docLower.includes('cert') || isCertSubSelected;

  const isKnownDoc = isEvalSelected || isHdSelected || isTorSelected || isAuthSelected || isCertSelected;
  const isOtherDoc =
    !isKnownDoc &&
    Boolean(documentType) &&
    docLower !== 'academic credential' &&
    docLower !== 'credential' &&
    docLower !== 'credentials';

  // Matching helper for purpose checkboxes
  const purpLower = (purpose || '').toLowerCase();
  const isPurpMatch = (term) => purpLower.includes(term.toLowerCase());

  return (
    <div ref={ref} className="ustp-long-bondpaper">
      {/* Top Header & Applicant Details Section */}
      <div className="ustp-top-header-block">
        {/* 1. Header (Logo on Left, Center University Info - NO document code box) */}
        <div className="ustp-form-header-row">
          <div className="ustp-header-logo-left">
            <img src={ustpLogo} alt="USTP Seal" className="ustp-header-logo-img" />
          </div>
          <div className="ustp-header-center-text">
            <h2 className="ustp-header-univ-name">
              UNIVERSITY OF SCIENCE AND TECHNOLOGY
              <br />
              OF SOUTHERN PHILIPPINES
            </h2>
            <p className="ustp-header-campuses">
              Alubijid | Cagayan de Oro | Claveria | Jasaan | Oroquieta | Panaon
            </p>
          </div>
        </div>

        {/* 2. Main Title Bar */}
        <div className="ustp-main-title-bar">
          REQUEST FOR CREDENTIAL/S FORM
        </div>
      </div>

      {/* THE BIG OUTER BOX (wraps everything from applicant details to the bottom receipt) */}
      <div className="ustp-form-outer-box">
        {/* 3. Applicant General Details Rows */}
        <div className="ustp-row-details">
          <div className="ustp-detail-item" style={{ flex: '1.4' }}>
            <span className="ustp-detail-lbl">Signature over Printed Name:</span>
            <span className="ustp-detail-underline">{studentName}</span>
          </div>
          <div className="ustp-detail-item" style={{ flex: '1.2' }}>
            <span className="ustp-detail-lbl">Course:</span>
            <span className="ustp-detail-underline">{course}</span>
          </div>
          <div className="ustp-detail-item" style={{ flex: '1.1' }}>
            <span className="ustp-detail-lbl">Date of Request:</span>
            <span className="ustp-detail-underline">{requestDate}</span>
          </div>
        </div>

        <div className="ustp-row-details">
          <div className="ustp-detail-item" style={{ flex: '1.3' }}>
            <span className="ustp-detail-lbl">Birth date:</span>
            <span className="ustp-detail-underline">{birthDate}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '2.2' }}>
            <span className="ustp-checkbox-label">
              <span className="ustp-box-check">{userCategory === 'student' ? '✓' : ''}</span>
              <span>Student (Undergrad/Graduate)</span>
            </span>
            <span className="ustp-checkbox-label">
              <span className="ustp-box-check">{userCategory === 'alumnus' ? '✓' : ''}</span>
              <span>Alumnus (High School/Undergrad/Graduate)</span>
            </span>
          </div>
        </div>

        {/* 4. Reminder Box (Bordered) */}
        <div className="ustp-bordered-box ustp-reminder-box">
          <div className="ustp-reminder-title">Reminder:</div>
          <div className="ustp-reminder-text">
            A. If requested by the person himself/herself named in the document, a <strong>valid Identification (ID) card</strong> must be presented.
          </div>
          <div className="ustp-reminder-text" style={{ marginTop: '1px' }}>
            B. If requested by an authorized person, the following items must be presented:
          </div>
          <div className="ustp-reminder-list">
            <div className="ustp-reminder-list-item">
              <span className="ustp-box-check"></span>
              <span>Authorization letter (Duly notarized authorization);</span>
            </div>
            <div className="ustp-reminder-list-item">
              <span className="ustp-box-check"></span>
              <span>Photocopy of valid Identification (ID) cards of the authorizing person (owner); and</span>
            </div>
            <div className="ustp-reminder-list-item">
              <span className="ustp-box-check"></span>
              <span>Photocopy of valid Identification (ID) card of the authorized person.</span>
            </div>
          </div>
        </div>

        {/* 5. Part 1 Box (Bordered) */}
        <div className="ustp-bordered-box ustp-part1-box">
          <div className="ustp-part1-header">
            <span className="ustp-part-title-text">Part 1: Please complete entries below.</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
              <span style={{ fontWeight: '700', paddingBottom: '2px', lineHeight: '1.25' }}>CONTACT NO.:</span>
              <span className="ustp-field-underline" style={{ minWidth: '130px', fontWeight: '700' }}>
                {contactNo}
              </span>
            </div>
          </div>

          <div className="ustp-line-entry">
            <span style={{ paddingBottom: '2px', lineHeight: '1.25' }}>
              If a graduate, state the <strong>Date of Graduation</strong>:
            </span>
            <span className="ustp-field-underline" style={{ flex: 1, fontWeight: '700' }}>
              {dateOfGraduation || 'N/A (Enrolled)'}
            </span>
          </div>

          <div className="ustp-line-entry">
            <span style={{ paddingBottom: '2px', lineHeight: '1.25' }}>
              If not, state the <strong>Last Semester &amp; SY of Attendance in USTP</strong>:
            </span>
            <span className="ustp-field-underline" style={{ flex: 1, fontWeight: '700' }}>
              {lastSemAttendance}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '2px 0' }}>
            <span>Already requested credential/s (as stated below) before:</span>
            <span className="ustp-checkbox-label">
              <span className="ustp-box-check"></span>
              <span>YES</span>
            </span>
            <span className="ustp-checkbox-label">
              <span className="ustp-box-check">✓</span>
              <span>NO</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginLeft: 'auto' }}>
              <span style={{ paddingBottom: '2px', lineHeight: '1.25' }}>Date requested:</span>
              <span className="ustp-field-underline" style={{ minWidth: '90px' }}>&nbsp;</span>
            </div>
          </div>

          <div className="ustp-line-entry">
            <span style={{ paddingBottom: '2px', lineHeight: '1.25' }}>If yes, please specify the document requested:</span>
            <span className="ustp-field-underline" style={{ flex: 1 }}>&nbsp;</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginTop: '2px' }}>
            <span style={{ fontWeight: '700' }}>Cleared?</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span className="ustp-checkbox-label">
                <span className="ustp-box-check">✓</span>
                <span>Yes. (If yes, attach the clearance form.)</span>
              </span>
              <span className="ustp-checkbox-label">
                <span className="ustp-box-check"></span>
                <span>No. (If not, avail of the clearance form before you proceed with your request.)</span>
              </span>
            </div>
          </div>
        </div>

        {/* 6. Part 2 Box: Document Checklist */}
        <div className="ustp-bordered-box ustp-part2-box">
          <div className="ustp-part-title-text" style={{ marginBottom: '3px' }}>
            Part 2: Please check the document/s you need.
          </div>

          <div className="ustp-part2-grid">
            {/* Column 1 */}
            <div className="ustp-doc-col">
              <div className={`ustp-doc-label ${isEvalSelected ? 'selected' : ''}`}>
                <span className="ustp-box-check">{isEvalSelected ? '✓' : ''}</span>
                <span>Evaluation (P50)</span>
              </div>

              <div className={`ustp-doc-label ${isHdSelected ? 'selected' : ''}`}>
                <span className="ustp-box-check">{isHdSelected ? '✓' : ''}</span>
                <span>Honorable Dismissal (P100)</span>
              </div>

              <div className={`ustp-doc-label ${isTorSelected ? 'selected' : ''}`}>
                <span className="ustp-box-check">{isTorSelected ? '✓' : ''}</span>
                <span>Transcript of Records (P125/pg)</span>
              </div>

              <div className={`ustp-doc-label ${isAuthSelected ? 'selected' : ''}`}>
                <span className="ustp-box-check">{isAuthSelected ? '✓' : ''}</span>
                <span>Authentication (P5/pg)</span>
              </div>

              {isOtherDoc ? (
                <div className="ustp-doc-label selected">
                  <span className="ustp-box-check">✓</span>
                  <span className="ustp-dynamic-cred-name">
                    {documentType} {rawAmount ? `(${amount})` : ''}
                  </span>
                </div>
              ) : (
                <div className="ustp-doc-label">
                  <span className="ustp-box-check"></span>
                  <span style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', flex: 1 }}>
                    <span style={{ paddingBottom: '2px', lineHeight: '1.25' }}>Others:</span>
                    <span className="ustp-field-underline" style={{ flex: 1 }}>&nbsp;</span>
                  </span>
                </div>
              )}
            </div>

            {/* Column 2: Certification and Sub-items */}
            <div className="ustp-doc-col">
              <div className={`ustp-doc-label ${isCertSelected ? 'selected' : ''}`}>
                <span className="ustp-box-check">{isCertSelected ? '✓' : ''}</span>
                <span style={{ fontWeight: '700' }}>Certification (P80)</span>
              </div>

              <div className="ustp-cert-subgrid">
                {[
                  { label: 'CAR', checked: isCarSelected },
                  { label: 'Officially enrolled', checked: isEnrolledSelected },
                  { label: 'GPA', checked: isGpaSelected },
                  { label: 'Earned Units', checked: isUnitsSelected },
                  { label: 'Endorsement', checked: isEndorsementSelected },
                  { label: 'Subjects w/ grades', checked: isGradesSelected },
                ].map((cert) => (
                  <div
                    key={cert.label}
                    className={`ustp-cert-subitem ${cert.checked ? 'selected' : ''}`}
                  >
                    <span className="ustp-box-check">{cert.checked ? '✓' : ''}</span>
                    <span>{cert.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 7. Part 3 Box: Purpose of Request */}
        <div className="ustp-bordered-box ustp-part3-box">
          <div className="ustp-part-title-text">
            Part 3: Please check the purpose of your request.
          </div>

          <div className="ustp-part3-grid">
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="ustp-checkbox-label">
                <span className="ustp-purpose-underline">
                  {isPurpMatch('evaluation') ? '✓' : ''}
                </span>
                <span>For Evaluation</span>
              </span>
              <span className="ustp-checkbox-label">
                <span className="ustp-purpose-underline">
                  {isPurpMatch('scholarship') ? '✓' : ''}
                </span>
                <span>For Scholarship</span>
              </span>
              <span className="ustp-checkbox-label">
                <span className="ustp-purpose-underline">
                  {isPurpMatch('passport') ? '✓' : ''}
                </span>
                <span>For Passport</span>
              </span>
              <span className="ustp-checkbox-label">
                <span className="ustp-purpose-underline">
                  {isPurpMatch('board') ? '✓' : ''}
                </span>
                <span>For Board Exam</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px' }}>
                <span className="ustp-checkbox-label">
                  <span className="ustp-purpose-underline">
                    {!isPurpMatch('evaluation') &&
                    !isPurpMatch('scholarship') &&
                    !isPurpMatch('passport') &&
                    !isPurpMatch('board') &&
                    !isPurpMatch('employment') &&
                    !isPurpMatch('personal') &&
                    !isPurpMatch('advanced') &&
                    !isPurpMatch('ranking')
                      ? '✓'
                      : ''}
                  </span>
                  <span>Others (Specify)</span>
                </span>
                <span className="ustp-field-underline" style={{ flex: 1, fontWeight: '700' }}>
                  {!isPurpMatch('evaluation') &&
                  !isPurpMatch('scholarship') &&
                  !isPurpMatch('passport') &&
                  !isPurpMatch('board') &&
                  !isPurpMatch('employment') &&
                  !isPurpMatch('personal') &&
                  !isPurpMatch('advanced') &&
                  !isPurpMatch('ranking')
                    ? purpose
                    : '\u00A0'}
                </span>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="ustp-checkbox-label">
                <span className="ustp-purpose-underline">
                  {isPurpMatch('employment') ? '✓' : ''}
                </span>
                <span>For Employment</span>
              </span>
              <span className="ustp-checkbox-label">
                <span className="ustp-purpose-underline">
                  {isPurpMatch('personal') || (!purpLower && !isPurpMatch('evaluation') && !isPurpMatch('scholarship'))
                    ? '✓'
                    : ''}
                </span>
                <span>For Personal File</span>
              </span>
              <span className="ustp-checkbox-label">
                <span className="ustp-purpose-underline">
                  {isPurpMatch('advanced') ? '✓' : ''}
                </span>
                <span>For Advanced Studies</span>
              </span>
              <span className="ustp-checkbox-label">
                <span className="ustp-purpose-underline">
                  {isPurpMatch('ranking') ? '✓' : ''}
                </span>
                <span>For Ranking</span>
              </span>
            </div>
          </div>

          <div className="ustp-part3-note">
            <strong>Note:</strong> For board exam requests, please attach a passport sized picture (person in photo wears a blouse with collar/collared polo; with name tag and photo must be in white background)
          </div>
        </div>

        {/* 8. Administrative Sign-Off & Cashier Section */}
        <div className="ustp-signoff-section">
          <div className="ustp-signoff-top-grid">
            {/* Verified by Front Desk */}
            <div className="ustp-sign-col">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                <span style={{ fontWeight: '700', paddingBottom: '2px', lineHeight: '1.25' }}>Verified:</span>
                <div className="ustp-sign-line-text" style={{ flex: 1 }}>
                  {verifiedByName}
                </div>
              </div>
              <div className="ustp-sign-subcaption">
                Name &amp; Signature of Front Desk Personnel
              </div>
            </div>

            {/* Approved by Registrar */}
            <div className="ustp-sign-col">
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontWeight: '700', fontSize: '9.5px', display: 'block', marginBottom: '1px' }}>
                  Approved:
                </span>
                <div className="ustp-sign-line-text" style={{ textAlign: 'center' }}>
                  Jonalin T. Lagrada, MPSM
                </div>
                <div className="ustp-sign-subcaption">
                  University Registrar
                </div>
              </div>
            </div>

            {/* Cashier */}
            <div className="ustp-sign-col">
              <div style={{ marginTop: '11px' }}>
                <div className="ustp-sign-line-text" style={{ textAlign: 'center' }}>&nbsp;</div>
                <div className="ustp-sign-subcaption">
                  Cashier
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Receipt & Release Row */}
          <div className="ustp-receipt-bottom-grid">
            <div className="ustp-receipt-cell">
              <span className="ustp-receipt-label">Amount:</span>
              <span className="ustp-receipt-value" style={{ fontWeight: '900' }}>
                {amount}
              </span>
            </div>
            <div className="ustp-receipt-cell">
              <span className="ustp-receipt-label">O.R. No.:</span>
              <span className="ustp-receipt-value" style={{ fontFamily: 'monospace', fontWeight: '700' }}>
                {orNumber || '\u00A0'}
              </span>
            </div>
            <div className="ustp-receipt-cell">
              <span className="ustp-receipt-label">Payment Date:</span>
              <span className="ustp-receipt-value">
                {paymentDate || '\u00A0'}
              </span>
            </div>
            <div className="ustp-receipt-cell">
              <span className="ustp-receipt-label">Date of Release:</span>
              <span className="ustp-receipt-value" style={{ fontWeight: '700' }}>
                {dateOfRelease || '\u00A0'}
              </span>
            </div>
          </div>
        </div>
      </div> {/* Closes ustp-form-outer-box */}
    </div>
  );
});

export default USTPRequestFormDocument;

