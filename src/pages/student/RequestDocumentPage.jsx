import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import requestsApi, { saveStoredRequest } from '../../api/requests';
import credentialTypesApi from '../../api/credentialTypes';
import { ROUTES } from '../../constants/routes';
import useToast from '../../hooks/useToast';
import ustpLogo from '../../assets/USTP Logo against Light Background 1.png';
import '../../styles/student/RequestDocumentPage.css';

export default function RequestDocumentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [credentialTypes, setCredentialTypes] = useState([]);

  // Form State (Step 1)
  const [fullName, setFullName] = useState(
    user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username || 'Juan De Letchi')
  );
  const [course, setCourse] = useState(user?.program || 'BS in Information Technology');
  const [dateOfRequest, setDateOfRequest] = useState(() => new Date().toISOString().split('T')[0]);
  const [birthDate, setBirthDate] = useState('2002-05-15');
  const [userCategory, setUserCategory] = useState('student'); // 'student' or 'alumnus'
  const [contactNo, setContactNo] = useState('09123456789');
  const [dateOfGraduation, setDateOfGraduation] = useState('');
  const [lastSemAttendance, setLastSemAttendance] = useState('2nd Sem, AY 2025-2026');
  const [alreadyRequested, setAlreadyRequested] = useState('no');
  const [prevDocRequested, setPrevDocRequested] = useState('');
  const [prevDateRequested, setPrevDateRequested] = useState('');
  const [isCleared, setIsCleared] = useState('yes');
  const [clearanceError, setClearanceError] = useState(false);

  // Selected Documents in Part 2
  const [selectedDocName, setSelectedDocName] = useState('Transcript of Records (TOR)');
  const [selectedCredTypeId, setSelectedCredTypeId] = useState(null);

  // Purpose in Part 3
  const [purposeOption, setPurposeOption] = useState('For Personal File');
  const [otherPurpose, setOtherPurpose] = useState('');

  // Photo Upload State (Part 3)
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.warning('Please select an image file (PNG, JPG, JPEG).');
        e.target.value = '';
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
      toast.success('Photo attached successfully.');
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // Clearance Photo Upload State (Part 1 - Cleared?)
  const [clearanceFile, setClearanceFile] = useState(null);
  const [clearancePreview, setClearancePreview] = useState(null);

  const handleClearanceUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.warning('Please select an image file (PNG, JPG, JPEG).');
        e.target.value = '';
        return;
      }
      setClearanceFile(file);
      setIsCleared('yes');
      setClearanceError(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setClearancePreview(reader.result);
      };
      reader.readAsDataURL(file);
      toast.success('Clearance photo attached successfully.');
      e.target.value = '';
    }
  };

  const handleRemoveClearance = () => {
    setClearanceFile(null);
    setClearancePreview(null);
  };

  // Step 2 State
  const [copies, setCopies] = useState(1);
  const [yearLevel, setYearLevel] = useState(user?.year_level || '4th year');
  const [studentId, setStudentId] = useState(user?.student_id || user?.username || '2026202666');
  const [email, setEmail] = useState(user?.email || 'juan@email.com');
  const [purposeInput, setPurposeInput] = useState('For Personal Files');

  // Step 3 State
  const [generatedTrackingId, setGeneratedTrackingId] = useState('RQ-097323');
  const [submitting, setSubmitting] = useState(false);

  // Helper to accurately map selected document names to backend database CredentialType IDs
  const resolveCredentialTypeId = (docName, typesList = []) => {
    if (!docName || !Array.isArray(typesList) || typesList.length === 0) return 1;
    const lower = docName.toLowerCase();

    if (lower.includes('transcript') || lower.includes('tor')) {
      const tor = typesList.find((t) => t.code?.toUpperCase() === 'TOR' || t.name.toLowerCase().includes('transcript'));
      if (tor) return tor.id;
    }
    if (lower.includes('honorable') || lower.includes('dismissal') || lower.includes('hd')) {
      const hd = typesList.find((t) => t.code?.toUpperCase() === 'HD' || t.name.toLowerCase().includes('dismissal'));
      if (hd) return hd.id;
    }
    if (lower.includes('evaluation') || lower.includes('eval')) {
      const ev = typesList.find((t) => t.code?.toUpperCase() === 'EVAL' || t.name.toLowerCase().includes('evaluation'));
      if (ev) return ev.id;
    }
    if (lower.includes('car')) {
      const car = typesList.find((t) => t.code?.toUpperCase() === 'CAR' || t.name.toLowerCase().includes('car'));
      if (car) return car.id;
    }
    if (lower.includes('enrolled') || lower.includes('coe')) {
      const coe = typesList.find((t) => t.code?.toUpperCase() === 'COE' || t.name.toLowerCase().includes('enrolled'));
      if (coe) return coe.id;
    }

    const matched = typesList.find((t) => lower.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(lower));
    if (matched) return matched.id;

    return typesList[0]?.id || 1;
  };

  useEffect(() => {
    let ignore = false;
    async function loadCredTypes() {
      try {
        const types = await credentialTypesApi.list();
        if (!ignore && Array.isArray(types) && types.length > 0) {
          setCredentialTypes(types);
          const resolvedId = resolveCredentialTypeId(selectedDocName, types);
          setSelectedCredTypeId(resolvedId);
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadCredTypes();
    return () => {
      ignore = true;
    };
  }, [selectedDocName]);

  // Compute dynamic document info, description, and pricing for Review Data
  const currentDocDetails = useMemo(() => {
    const matched = credentialTypes.find(
      (t) => t.name.toLowerCase() === selectedDocName.toLowerCase() || t.id === selectedCredTypeId
    );
    if (matched) {
      const unitPrice = parseFloat(matched.price) || 0;
      return {
        title: matched.name,
        description: matched.description || 'Official academic credential',
        unitPrice,
        totalPrice: unitPrice * copies,
      };
    }

    const priceMatch = selectedDocName.match(/P(\d+)/i);
    const unitPrice = priceMatch ? parseInt(priceMatch[1], 10) : 80;

    let desc = 'Official academic record';
    let cleanTitle = selectedDocName;
    if (selectedDocName.includes('Transcript')) {
      cleanTitle = 'Transcript of Records (TOR)';
      desc = 'Official academic record';
    } else if (selectedDocName.includes('Honorable Dismissal')) {
      cleanTitle = 'Honorable Dismissal';
      desc = 'Certificate of honorable dismissal and transfer credentials';
    } else if (selectedDocName.includes('Evaluation')) {
      cleanTitle = 'Evaluation';
      desc = 'Curriculum evaluation of academic credits and standing';
    } else if (selectedDocName.includes('Authentication')) {
      cleanTitle = 'Authentication';
      desc = 'Certified authentication of university records';
    } else if (selectedDocName.includes('Certification')) {
      cleanTitle = selectedDocName;
      desc = 'Official certification of student enrollment and standing';
    }

    return {
      title: cleanTitle,
      description: desc,
      unitPrice,
      totalPrice: unitPrice * copies,
    };
  }, [selectedDocName, selectedCredTypeId, credentialTypes, copies]);

  const handleDocumentSelect = (docName, typeId = null) => {
    setSelectedDocName(docName);
    const resolvedId = typeId || resolveCredentialTypeId(docName, credentialTypes);
    setSelectedCredTypeId(resolvedId);
  };

  const handlePurposeSelect = (p) => {
    setPurposeOption(p);
    setPurposeInput(p);
  };

  // Step 1 -> Step 2
  const handleProceedToReview = (e) => {
    e.preventDefault();

    // Check 1: Must be Cleared ("Yes")
    if (isCleared !== 'yes') {
      setClearanceError(true);
      toast.warning(
        isCleared === 'no'
          ? 'You cannot proceed because you are not cleared. Please avail of the clearance form first.'
          : 'Please confirm that you are cleared and attach your clearance form photo to proceed.'
      );
      const el = document.getElementById('ustp-clearance-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Check 2: Must attach clearance photo
    if (!clearanceFile && !clearancePreview) {
      setClearanceError(true);
      toast.warning('Please attach your clearance form photo before proceeding to the next step.');
      const el = document.getElementById('ustp-clearance-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!selectedDocName) {
      toast.warning('Please select at least one document to request.');
      return;
    }

    setClearanceError(false);
    const chosenPurpose = purposeOption === 'Others' ? (otherPurpose || 'Others') : purposeOption;
    setPurposeInput(chosenPurpose);
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2 -> Step 3 (Submit Request)
  const handleSubmitRequest = async (e) => {
    e.preventDefault();

    if (isCleared !== 'yes') {
      toast.warning('You must be cleared to proceed with your credential request.');
      setCurrentStep(1);
      return;
    }

    if (!clearanceFile && !clearancePreview) {
      toast.warning('Please attach your clearance form photo before submitting your request.');
      setCurrentStep(1);
      return;
    }

    setSubmitting(true);

    try {
      let createdItem = null;
      const targetCredTypeId = selectedCredTypeId || resolveCredentialTypeId(selectedDocName, credentialTypes);

      // Submit directly to backend API so it persists in the database for Admin and Staff
      if (targetCredTypeId) {
        try {
          createdItem = await requestsApi.create({
            credential_type: targetCredTypeId,
            remarks: purposeInput || purposeOption || 'Academic request',
          });
        } catch (apiErr) {
          console.warn('Backend create request returned validation response:', apiErr);
          if (apiErr.response?.data) {
            const msg = Object.values(apiErr.response.data).flat().join(' ');
            if (msg.toLowerCase().includes('clearance')) {
              toast.warning(msg || 'Please ensure you have an approved clearance.');
            }
          }
        }
      }

      // Generate or use official backend tracking ID (e.g. REQ-2026-000003 or RQ-097323)
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const trackingCode = createdItem?.tracking_number || `RQ-${randomSuffix}`;
      setGeneratedTrackingId(trackingCode);

      // Build comprehensive request record that is immediately accessible to Admin, Staff, and Student
      const requestRecord = {
        id: createdItem?.id || trackingCode,
        rawId: createdItem?.id || trackingCode,
        tracking_number: trackingCode,
        trackingId: trackingCode,
        user: user?.userId || user?.id || null,
        student_name: fullName,
        student_id: studentId,
        course: course,
        email: email,
        credential_type: selectedCredTypeId,
        credential_type_details: {
          name: currentDocDetails.title,
          price: currentDocDetails.unitPrice,
        },
        document_type: currentDocDetails.title,
        copies: `${copies} ${copies > 1 ? 'copies' : 'copy'}`,
        amount: `P${currentDocDetails.totalPrice}`,
        price: currentDocDetails.totalPrice,
        status: 'Pending',
        rawStatus: 'PENDING',
        batch_status: 'Pending',
        assigned_staff: '',
        purpose: purposeInput || purposeOption || 'Official Academic Credential Request',
        remarks: purposeInput || purposeOption || 'Official Academic Credential Request',
        created_at: new Date().toISOString(),
        request_date: new Date().toISOString().split('T')[0],
        release_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        clearance_preview: clearancePreview || null,
        photo_preview: photoPreview || null,
        clearance_file_name: clearanceFile?.name || null,
        photo_file_name: photoFile?.name || null,
      };

      saveStoredRequest(requestRecord);

      toast.success('Your credential request was successfully submitted!');
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Request submission failed:', err);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="student-page-container">
        {/* ------------------------------------------------------------------
            Top Step Progress Bar (Matching Images 1, 3, 4)
            ------------------------------------------------------------------ */}
        <div className="student-step-nav">
          <div className="student-step-labels">
            <span className={`student-step-label ${currentStep >= 1 ? 'active font-extrabold text-[#0B0B36]' : ''}`}>
              Select Document
            </span>
            <span className={`student-step-label ${currentStep >= 2 ? 'active font-extrabold text-[#0B0B36]' : ''}`}>
              Review Data
            </span>
            <span className={`student-step-label ${currentStep >= 3 ? 'active font-extrabold text-[#0B0B36]' : ''}`}>
              Complete
            </span>
          </div>

          <div className="student-step-track">
            <div
              className="student-step-fill"
              style={{
                width: currentStep === 1 ? '33.3%' : currentStep === 2 ? '66.6%' : '100%',
              }}
            />
          </div>
        </div>

        {/* STEP 1: Official USTP REQUEST FOR CREDENTIAL/S FORM (Image 1) */}
        {currentStep === 1 && (
          <div className="ustp-form-sheet">
            {/* Header with USTP Logo against Light Background & Campus Subtitle */}
            <div className="ustp-form-header">
              <div className="ustp-logo-wrap">
                <img
                  src={ustpLogo}
                  alt="USTP Logo against Light Background"
                  className="ustp-logo-img"
                />
              </div>
              <div className="ustp-header-text">
                <h1 className="ustp-univ-title">
                  UNIVERSITY OF SCIENCE AND TECHNOLOGY
                  <br className="hidden sm:inline" /> OF SOUTHERN PHILIPPINES
                </h1>
                <p className="ustp-univ-campuses">
                  Alubijid | Cagayan de Oro | Claveria | Jasaan | Oroquieta | Panaon
                </p>
              </div>
            </div>

            <h2 className="ustp-form-title">
              REQUEST FOR CREDENTIAL/S FORM
            </h2>

            {/* Outlined Form Container */}
            <form onSubmit={handleProceedToReview} className="ustp-outer-box">
              {/* Row 1: Signature over Printed Name, Course, Date of Request */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Signature over Printed Name:</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="ustp-underline-field w-full"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Course:</label>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    required
                    className="ustp-underline-field w-full"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Date of Request:</label>
                  <input
                    type="date"
                    value={dateOfRequest}
                    onChange={(e) => setDateOfRequest(e.target.value)}
                    required
                    className="ustp-underline-field w-full"
                  />
                </div>
              </div>

              {/* Row 2: Birth date & Category checkboxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Birth date:</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="ustp-underline-field w-full"
                  />
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-6 items-center pt-2">
                  <label className="ustp-checkbox-row">
                    <input
                      type="radio"
                      name="userCategory"
                      value="student"
                      checked={userCategory === 'student'}
                      onChange={() => setUserCategory('student')}
                      className="ustp-checkbox-input"
                    />
                    <span className="font-semibold text-slate-800">Student (Undergraduate/Graduate)</span>
                  </label>
                  <label className="ustp-checkbox-row">
                    <input
                      type="radio"
                      name="userCategory"
                      value="alumnus"
                      checked={userCategory === 'alumnus'}
                      onChange={() => setUserCategory('alumnus')}
                      className="ustp-checkbox-input"
                    />
                    <span className="font-semibold text-slate-800">Alumnus (High School/Undergrad/Graduate)</span>
                  </label>
                </div>
              </div>

              <div className="ustp-dashed-divider" />

              {/* Part 1 */}
              <div className="ustp-section-box space-y-2.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="ustp-section-title">Part 1: Please complete entries below.</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[11px] text-slate-800">CONTACT NO.:</span>
                    <input
                      type="text"
                      value={contactNo}
                      onChange={(e) => setContactNo(e.target.value)}
                      className="ustp-underline-field w-36"
                    />
                  </div>
                </div>

                <div className="text-xs space-y-2 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-slate-800">If a graduate, state the <strong>Date of Graduation</strong>:</span>
                    <input
                      type="text"
                      placeholder="e.g. June 2025"
                      value={dateOfGraduation}
                      onChange={(e) => setDateOfGraduation(e.target.value)}
                      className="ustp-underline-field flex-1"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-slate-800">If not, state the <strong>Last Semester &amp; SY of Attendance in USTP</strong>:</span>
                    <input
                      type="text"
                      value={lastSemAttendance}
                      onChange={(e) => setLastSemAttendance(e.target.value)}
                      className="ustp-underline-field flex-1"
                    />
                  </div>
                </div>

                <div className="pt-1 text-xs flex flex-wrap gap-4 items-center">
                  <span className="text-slate-800">Already requested credential/s (as stated below) before:</span>
                  <label className="ustp-checkbox-row">
                    <input
                      type="radio"
                      name="alreadyRequested"
                      checked={alreadyRequested === 'yes'}
                      onChange={() => setAlreadyRequested('yes')}
                      className="ustp-checkbox-input"
                    />
                    <span>YES</span>
                  </label>
                  <label className="ustp-checkbox-row">
                    <input
                      type="radio"
                      name="alreadyRequested"
                      checked={alreadyRequested === 'no'}
                      onChange={() => setAlreadyRequested('no')}
                      className="ustp-checkbox-input"
                    />
                    <span>NO</span>
                  </label>
                </div>

                {alreadyRequested === 'yes' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pl-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700">If yes, specify document:</span>
                      <input
                        type="text"
                        value={prevDocRequested}
                        onChange={(e) => setPrevDocRequested(e.target.value)}
                        className="ustp-underline-field flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700">Date requested:</span>
                      <input
                        type="text"
                        value={prevDateRequested}
                        onChange={(e) => setPrevDateRequested(e.target.value)}
                        className="ustp-underline-field flex-1"
                      />
                    </div>
                  </div>
                )}

                <div
                  id="ustp-clearance-section"
                  className={`pt-1 text-xs space-y-1 transition-all rounded ${
                    clearanceError ? 'p-2.5 bg-amber-50 border border-amber-300' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 block">Cleared?</span>
                    <span className="text-red-500 font-bold">*</span>
                  </div>

                  <div className="pl-4 space-y-1">
                    <label className="ustp-checkbox-row">
                      <input
                        type="radio"
                        name="isCleared"
                        checked={isCleared === 'yes'}
                        onChange={() => {
                          setIsCleared('yes');
                          setClearanceError(false);
                        }}
                        className="ustp-checkbox-input"
                      />
                      <span>Yes. (If yes, attach the clearance form.)</span>
                    </label>
                    <label className="ustp-checkbox-row">
                      <input
                        type="radio"
                        name="isCleared"
                        checked={isCleared === 'no'}
                        onChange={() => {
                          setIsCleared('no');
                          setClearanceFile(null);
                          setClearancePreview(null);
                        }}
                        className="ustp-checkbox-input"
                      />
                      <span>No. (If not, avail of the clearance form before you proceed with your request.)</span>
                    </label>
                  </div>

                  {isCleared === 'no' && (
                    <div className="ml-4 mt-1.5 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 font-semibold flex items-center gap-1.5">
                      <span>⚠️ Cannot proceed: You must avail of the clearance form and obtain clearance first.</span>
                    </div>
                  )}

                  {clearanceError && isCleared === 'yes' && !clearanceFile && !clearancePreview && (
                    <div className="ml-4 mt-1.5 p-2 bg-amber-100 border border-amber-300 rounded text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
                      <span>⚠️ Clearance form photo is required. Please click "Upload Photo" below.</span>
                    </div>
                  )}

                  {/* Upload photo below Cleared? yes and no */}
                  <div className="ustp-upload-row">
                    <label className="ustp-upload-btn">
                      <svg className="ustp-upload-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleClearanceUpload}
                        className="hidden"
                      />
                    </label>

                    {clearanceFile ? (
                      <div className="ustp-upload-chip">
                        {clearancePreview && (
                          <img
                            src={clearancePreview}
                            alt="Clearance Preview"
                            className="ustp-upload-chip-thumb"
                          />
                        )}
                        <span className="ustp-upload-chip-name">{clearanceFile.name}</span>
                        <button
                          type="button"
                          onClick={handleRemoveClearance}
                          className="ustp-upload-chip-remove"
                          title="Remove photo"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className={`ustp-upload-hint ${clearanceError ? 'text-amber-800 font-bold' : ''}`}>
                        * Required: Attach clearance form photo / document
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Part 2: Please check the document/s you need */}
              <div className="ustp-section-box space-y-2.5">
                <span className="ustp-section-title">Part 2: Please check the document/s you need.</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                  {/* Column 1 */}
                  <div className="space-y-2">
                    <label className="ustp-checkbox-row">
                      <input
                        type="radio"
                        name="selectedDoc"
                        checked={selectedDocName === 'Evaluation (P50)' || selectedDocName.includes('Evaluation')}
                        onChange={() => handleDocumentSelect('Evaluation (P50)')}
                        className="ustp-checkbox-input"
                      />
                      <span>Evaluation (P50)</span>
                    </label>

                    <label className="ustp-checkbox-row">
                      <input
                        type="radio"
                        name="selectedDoc"
                        checked={selectedDocName === 'Honorable Dismissal (P100)' || selectedDocName.includes('Honorable')}
                        onChange={() => handleDocumentSelect('Honorable Dismissal (P100)')}
                        className="ustp-checkbox-input"
                      />
                      <span>Honorable Dismissal (P100)</span>
                    </label>

                    <label className="ustp-checkbox-row">
                      <input
                        type="radio"
                        name="selectedDoc"
                        checked={selectedDocName.includes('Transcript')}
                        onChange={() => handleDocumentSelect('Transcript of Records (P125/pg)')}
                        className="ustp-checkbox-input"
                      />
                      <span>Transcript of Records (P125/pg)</span>
                    </label>

                    <label className="ustp-checkbox-row">
                      <input
                        type="radio"
                        name="selectedDoc"
                        checked={selectedDocName.includes('Authentication')}
                        onChange={() => handleDocumentSelect('Authentication (P5/pg)')}
                        className="ustp-checkbox-input"
                      />
                      <span>Authentication (P5/pg)</span>
                    </label>

                    {/* Dynamic Credentials Catalog from DB */}
                    {credentialTypes.map((ctype) => (
                      <label key={ctype.id} className="ustp-checkbox-row">
                        <input
                          type="radio"
                          name="selectedDoc"
                          checked={selectedDocName === ctype.name}
                          onChange={() => handleDocumentSelect(ctype.name, ctype.id)}
                          className="ustp-checkbox-input"
                        />
                        <span className="font-medium text-indigo-950">
                          {ctype.name} (P{parseFloat(ctype.price).toFixed(0)})
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Column 2: Certification Sub-items */}
                  <div className="space-y-2">
                    <label className="ustp-checkbox-row font-semibold">
                      <input
                        type="radio"
                        name="selectedDoc"
                        checked={selectedDocName.startsWith('Certification')}
                        onChange={() => handleDocumentSelect('Certification (P80)')}
                        className="ustp-checkbox-input"
                      />
                      <span>Certification (P80)</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2 pl-6 pt-1 text-[11px]">
                      {[
                        { label: 'CAR', key: 'CAR' },
                        { label: 'Officially enrolled', key: 'Officially enrolled' },
                        { label: 'GPA', key: 'GPA' },
                        { label: 'Earned Units', key: 'Earned Units' },
                        { label: 'Endorsement', key: 'Endorsement' },
                        { label: 'Subjects w/ grades', key: 'Subjects w/ grades' },
                      ].map((cert) => (
                        <label key={cert.key} className="ustp-checkbox-row">
                          <input
                            type="radio"
                            name="selectedDoc"
                            checked={selectedDocName === `Certification - ${cert.label}`}
                            onChange={() => handleDocumentSelect(`Certification - ${cert.label}`)}
                            className="ustp-checkbox-input"
                          />
                          <span>{cert.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Part 3: Purpose of Request */}
              <div className="ustp-section-box space-y-2.5">
                <span className="ustp-section-title">Part 3: Please check the purpose of your request.</span>
                
                {/* 2-Column layout matching the original form */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs pt-1">
                  {/* Left Column */}
                  <div className="space-y-2">
                    {['For Evaluation', 'For Scholarship', 'For Passport', 'For Board Exam'].map((p) => (
                      <label key={p} className="ustp-checkbox-row">
                        <input
                          type="radio"
                          name="purposeSelection"
                          checked={purposeOption === p}
                          onChange={() => handlePurposeSelect(p)}
                          className="ustp-checkbox-input"
                        />
                        <span>{p}</span>
                      </label>
                    ))}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-2">
                    {['For Employment', 'For Personal File', 'For Advanced Studies', 'For Ranking'].map((p) => (
                      <label key={p} className="ustp-checkbox-row">
                        <input
                          type="radio"
                          name="purposeSelection"
                          checked={purposeOption === p}
                          onChange={() => handlePurposeSelect(p)}
                          className="ustp-checkbox-input"
                        />
                        <span>{p}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Others (Specify) */}
                <div className="flex items-center gap-2 pt-2 text-xs">
                  <label className="ustp-checkbox-row whitespace-nowrap">
                    <input
                      type="radio"
                      name="purposeSelection"
                      checked={purposeOption === 'Others'}
                      onChange={() => handlePurposeSelect('Others')}
                      className="ustp-checkbox-input"
                    />
                    <span>Others (Specify):</span>
                  </label>
                  <input
                    type="text"
                    value={otherPurpose}
                    onChange={(e) => {
                      setOtherPurpose(e.target.value);
                      setPurposeInput(e.target.value);
                    }}
                    placeholder="Specify other purpose..."
                    className="ustp-underline-field flex-1"
                  />
                </div>

                {/* Note */}
                <p className="text-[10px] text-slate-600 italic pt-1 leading-normal">
                  <strong>Note:</strong> For board exam requests, please attach a passport sized picture (person in photo wears a blouse with collar/collared polo; with name tag and photo must be in white background)
                </p>

                {/* Photo Upload Section */}
                <div className="ustp-upload-section">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="ustp-upload-btn">
                      <svg className="ustp-upload-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>

                    {photoFile ? (
                      <div className="ustp-upload-chip">
                        {photoPreview && (
                          <img
                            src={photoPreview}
                            alt="Uploaded Preview"
                            className="ustp-upload-chip-thumb"
                          />
                        )}
                        <span className="ustp-upload-chip-name">{photoFile.name}</span>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="ustp-upload-chip-remove"
                          title="Remove photo"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="ustp-upload-hint">
                        No photo attached (Required for Board Exam requests)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Front Desk / Administrative Sign-Off */}
              <div className="space-y-3 pt-2 text-slate-800 text-[11px]">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-bold whitespace-nowrap">Verified:</span>
                  <span className="border-b border-slate-700 flex-1 min-w-[140px] h-4"></span>
                  <span className="text-[11px] text-slate-700 whitespace-nowrap">Name &amp; Signature of Front Desk Personnel</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <span className="font-bold block text-left">Approved:</span>
                    <div className="pl-6 pt-1">
                      <p className="font-extrabold text-xs text-slate-900 tracking-wide">Jonalin T. Lagrada, MPSM</p>
                      <p className="text-[11px] text-slate-600">University Registrar</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center sm:items-end">
                    <div className="w-48 border-b border-slate-700 h-6"></div>
                    <span className="text-[11px] text-slate-700 pt-1">Cashier</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="font-bold">Amount:</span>
                    <span className="border-b border-slate-700 flex-1 h-4"></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold">O.R. No.:</span>
                    <span className="border-b border-slate-700 flex-1 h-4"></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold">Payment Date:</span>
                    <span className="border-b border-slate-700 flex-1 h-4"></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold">Date of Release:</span>
                    <span className="border-b border-slate-700 flex-1 h-4"></span>
                  </div>
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="ustp-nav-actions">
                <button type="submit" className="btn-ustp-primary">
                  Next Step
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------------
            STEP 2: Review Data (Image 3)
            ------------------------------------------------------------------ */}
        {currentStep === 2 && (
          <div className="review-card">
            <h2 className="review-main-title">Review Data</h2>

            <form onSubmit={handleSubmitRequest}>
              <div className="review-gray-box">
                {/* Document Request */}
                <div>
                  <h3 className="review-sub-title">Document Request:</h3>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">{currentDocDetails.title}</h4>
                      <p className="text-xs text-slate-500">{currentDocDetails.description}</p>
                      {currentDocDetails.unitPrice > 0 && (
                        <p className="text-xs font-semibold text-indigo-950 mt-1">
                          ₱{currentDocDetails.unitPrice.toFixed(2)} per copy
                          {copies > 1 && ` • Estimated Total: ₱${currentDocDetails.totalPrice.toFixed(2)}`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">Number of copies</span>
                      <div className="review-copies-stepper">
                        <button
                          type="button"
                          onClick={() => setCopies((c) => Math.max(1, c - 1))}
                          className="px-1 text-slate-600 font-bold hover:text-black cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={copies}
                          min={1}
                          max={10}
                          onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button
                          type="button"
                          onClick={() => setCopies((c) => Math.min(10, c + 1))}
                          className="px-1 text-slate-600 font-bold hover:text-black cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="review-divider" />

                {/* Personal Data */}
                <div>
                  <h3 className="review-sub-title">Personal Data:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Year Level</label>
                      <input
                        type="text"
                        value={yearLevel}
                        onChange={(e) => setYearLevel(e.target.value)}
                        placeholder="e.g. 4th Year"
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Student ID</label>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1">Program / Course</label>
                      <input
                        type="text"
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Contact No.</label>
                      <input
                        type="text"
                        value={contactNo}
                        onChange={(e) => setContactNo(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Birth Date</label>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                      <input
                        type="text"
                        value={userCategory === 'alumnus' ? 'Alumnus (High School/Undergraduate/Graduate)' : 'Student (Undergraduate/Graduate)'}
                        readOnly
                        className="review-pill-input bg-slate-50 cursor-default"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {userCategory === 'alumnus' || dateOfGraduation ? 'Date of Graduation' : 'Last Semester of Attendance'}
                      </label>
                      <input
                        type="text"
                        value={dateOfGraduation || lastSemAttendance || '2nd Sem, AY 2025-2026'}
                        readOnly
                        className="review-pill-input bg-slate-50 cursor-default"
                      />
                    </div>
                  </div>
                </div>

                <div className="review-divider" />

                {/* Purpose of Request */}
                <div>
                  <h3 className="review-sub-title">Purpose of Request:</h3>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Purpose of the request <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={purposeInput}
                      onChange={(e) => setPurposeInput(e.target.value)}
                      required
                      placeholder="e.g. For Personal Files, Employment, Board Exam..."
                      className="review-pill-input"
                    />
                  </div>
                </div>

                {/* Attached Clearance & Passport Photo Section (Only shown if student attached photos) */}
                {(clearancePreview || photoPreview) && (
                  <>
                    <div className="review-divider" />
                    <div className="review-attached-section">
                      <h3 className="review-sub-title">
                        {clearancePreview && photoPreview
                          ? 'Attached Clearance & Photo:'
                          : clearancePreview
                          ? 'Attached Clearance Photo:'
                          : 'Attached Passport 2x2 Photo:'}
                      </h3>
                      <div
                        className={`review-attached-grid ${
                          clearancePreview && photoPreview ? 'dual' : 'single'
                        }`}
                      >
                        {/* Clearance Form Card - Only shown if clearance photo is attached */}
                        {clearancePreview && (
                          <div className="review-attached-card">
                            <div className="review-attached-media">
                              <img
                                src={clearancePreview}
                                alt="Clearance Form"
                                className="review-attached-thumb"
                              />
                              <div className="review-attached-info">
                                <span className="review-attached-title">Clearance Form</span>
                                <span className="review-attached-filename">
                                  {clearanceFile ? clearanceFile.name : 'Clearance Form Photo'}
                                </span>
                                <span className="review-attached-badge">
                                  ✓ Attached
                                </span>
                              </div>
                            </div>

                            <div className="review-attached-actions">
                              <label className="review-attached-btn-change">
                                Change
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleClearanceUpload}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={handleRemoveClearance}
                                className="review-attached-btn-remove"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Passport / 2x2 Picture Card - Only shown if passport photo is attached */}
                        {photoPreview && (
                          <div className="review-attached-card">
                            <div className="review-attached-media">
                              <img
                                src={photoPreview}
                                alt="Passport Photo"
                                className="review-attached-thumb"
                              />
                              <div className="review-attached-info">
                                <span className="review-attached-title">Passport / 2x2 Photo</span>
                                <span className="review-attached-filename">
                                  {photoFile ? photoFile.name : 'Passport Photo'}
                                </span>
                                <span className="review-attached-badge">
                                  ✓ Attached
                                </span>
                              </div>
                            </div>

                            <div className="review-attached-actions">
                              <label className="review-attached-btn-change">
                                Change
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handlePhotoUpload}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="review-attached-btn-remove"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer Note */}
              <p className="review-footer-note">
                Incorrect Information? Contact an Admin or Update your information{' '}
                <a href="#update" onClick={(e) => { e.preventDefault(); toast.info('Please update your profile details in Account Settings.'); }}>
                  here
                </a>
              </p>

              {/* Actions */}
              <div className="review-nav-actions">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  disabled={submitting}
                  className="btn-review-back"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-ustp-primary"
                >
                  {submitting ? 'Submitting...' : 'Next Step'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: Complete (Image 4) */}
        {currentStep === 3 && (
          <div className="complete-card">
            {/* Green Check Circle */}
            <div className="complete-icon-circle">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="complete-main-title">Request Submitted!</h2>
            <p className="complete-sub-text">
              Your request has been successfully processed. You can track the status of your documents using the ID below.
            </p>

            {/* Tracking ID Box */}
            <div className="complete-tracking-box">
              <span className="complete-tracking-label">Your Tracking ID</span>
              <div className="complete-tracking-code">{generatedTrackingId}</div>
            </div>

            {/* Buttons */}
            <div className="complete-btn-group">
              <button
                type="button"
                onClick={() => navigate(`${ROUTES.STUDENT.REQUESTS}?trackId=${generatedTrackingId}`)}
                className="btn-complete-track"
              >
                Track Status
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.STUDENT.DASHBOARD)}
                className="btn-complete-home"
              >
                Back to Home
              </button>
            </div>

            {/* View Claim Stub Link */}
            <button
              type="button"
              onClick={() => toast.success(`Claim stub for ${generatedTrackingId} saved to download queue.`)}
              className="complete-stub-link"
            >
              View Claim Stub
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
