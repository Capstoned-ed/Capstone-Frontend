import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import requestsApi, { saveStoredRequest } from '../../api/requests';
import { saveStoredNotification } from '../../api/notifications';
import credentialTypesApi from '../../api/credentialTypes';
import clearancesApi, { saveClearanceAttachment } from '../../api/clearances';
import { ROUTES } from '../../constants/routes';
import useToast from '../../hooks/useToast';
import ustpLogo from '../../assets/USTP Logo against Light Background 1.png';
import '../../styles/student/RequestDocumentPage.css';

export default function RequestDocumentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const docQuery = searchParams.get('doc') || searchParams.get('type') || searchParams.get('credential');

  const [currentStep, setCurrentStep] = useState(1);
  const [credentialTypes, setCredentialTypes] = useState([]);

  const resolveStudentName = (u) => {
    if (u?.full_name) return u.full_name;
    if (u?.first_name) return `${u.first_name} ${u.last_name || ''}`.trim();
    try {
      const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
      const p = profiles[u?.username] || profiles[u?.userId] || profiles[u?.id];
      if (p?.full_name) return p.full_name;
      if (p?.first_name) return `${p.first_name} ${p.last_name || ''}`.trim();
    } catch {}
    if (u?.username === '2023301564') return 'Daisy Traya';
    if (u?.username && !/^\d{6,}$/.test(u.username)) return u.username;
    return 'Juan Dela Cruz';
  };

  const resolveStudentEmail = (u) => {
    if (u?.email) return u.email;
    try {
      const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
      const p = profiles[u?.username] || profiles[u?.userId] || profiles[u?.id];
      if (p?.email) return p.email;
      const usersCache = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
      const match = usersCache.find((x) => x.username && x.username.toLowerCase() === (u?.username || '').toLowerCase());
      if (match?.email) return match.email;
    } catch {}
    if (u?.username === '2023301564') return 'daisy.traya@ustp.edu.ph';
    return '';
  };

  // Form State (Step 1)
  const [fullName, setFullName] = useState(() => resolveStudentName(user));
  const [course, setCourse] = useState(user?.program || 'BS in Information Technology');

  useEffect(() => {
    const resolved = resolveStudentName(user);
    if (resolved && resolved !== 'Juan Dela Cruz') {
      setFullName(resolved);
    }
    if (user?.program) {
      setCourse(user.program);
    }
  }, [user]);
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

  // Selected Documents in Part 2 (empty on initial open)
  const [selectedDocName, setSelectedDocName] = useState('');
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

  // Clearance Attachment State (Part 1 - Cleared?)
  const [clearanceFile, setClearanceFile] = useState(null);
  const [clearancePreview, setClearancePreview] = useState(null);
  const [clearanceIsPdf, setClearanceIsPdf] = useState(false);

  const handleClearanceUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const isImg = file.type.startsWith('image/');
      const isDoc = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!isImg && !isDoc) {
        toast.warning('Please select a PDF document or image file (PNG, JPG, JPEG).');
        e.target.value = '';
        return;
      }

      setClearanceFile(file);
      setClearanceIsPdf(isDoc);
      setIsCleared('yes');
      setClearanceError(false);

      const reader = new FileReader();
      reader.onloadend = () => {
        const previewUrl = reader.result;
        setClearancePreview(previewUrl);
        saveClearanceAttachment('current_student_preview', previewUrl, {
          isPdf: isDoc,
          fileName: file.name,
        });
        if (studentId) {
          saveClearanceAttachment(studentId, previewUrl, {
            isPdf: isDoc,
            fileName: file.name,
          });
        }
      };
      reader.readAsDataURL(file);
      toast.success(`Clearance ${isDoc ? 'PDF' : 'file'} attached successfully.`);
      e.target.value = '';
    }
  };

  const handleRemoveClearance = () => {
    setClearanceFile(null);
    setClearancePreview(null);
    setClearanceIsPdf(false);
  };

  // Step 2 State
  const [copies, setCopies] = useState(1);
  const [yearLevel, setYearLevel] = useState(user?.year_level || '4th year');
  const [studentId, setStudentId] = useState(user?.student_id || user?.username || '2026202666');
  const [email, setEmail] = useState(() => resolveStudentEmail(user));

  useEffect(() => {
    const resolvedEmail = resolveStudentEmail(user);
    if (resolvedEmail) {
      setEmail(resolvedEmail);
    }
  }, [user]);
  const [purposeInput, setPurposeInput] = useState('For Personal Files');

  // Step 3 State
  const [generatedTrackingId, setGeneratedTrackingId] = useState('RQ-097323');
  const [submitting, setSubmitting] = useState(false);

  // Helper to accurately map selected document names to backend database CredentialType IDs
  const resolveCredentialTypeId = (docName, typesList = []) => {
    if (!docName || !Array.isArray(typesList) || typesList.length === 0) return 1;
    const lower = docName.toLowerCase();

    // 1. Exact match by name or code if DB has it
    const exact = typesList.find(
      (t) => (t.name && t.name.toLowerCase() === lower) || (t.code && t.code.toLowerCase() === lower)
    );
    if (exact) return exact.id;

    // 2. Standard categories
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
    if (lower === 'car' || lower === 'certification - car' || lower.includes('- car')) {
      const car = typesList.find((t) => t.code?.toUpperCase() === 'CAR' || t.name.toLowerCase().includes('car'));
      if (car) return car.id;
    }
    if (lower.includes('enrolled') || lower.includes('coe')) {
      const coe = typesList.find((t) => t.code?.toUpperCase() === 'COE' || t.name.toLowerCase().includes('enrolled'));
      if (coe) return coe.id;
    }

    // 3. For any other Certification options (GPA, Earned Units, Endorsement, Subjects w/ grades, General Certification)
    // Map to a valid DB credential type (CAR / id: 4 or COE / id: 5) so the backend accepts the foreign key
    if (lower.includes('cert') || lower.includes('gpa') || lower.includes('unit') || lower.includes('endorsement') || lower.includes('grade') || lower.includes('auth')) {
      const certType = typesList.find((t) => t.code?.toUpperCase() === 'CAR' || t.code?.toUpperCase() === 'COE' || t.name.toLowerCase().includes('car') || t.name.toLowerCase().includes('enrolled'));
      if (certType) return certType.id;
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
          if (selectedDocName) {
            const resolvedId = resolveCredentialTypeId(selectedDocName, types);
            setSelectedCredTypeId(resolvedId);
          }
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
    if (!selectedDocName) {
      return {
        title: 'No document selected',
        description: 'Please select a document in Part 2 below.',
        unitPrice: 0,
        totalPrice: 0,
      };
    }

    let cleanTitle = selectedDocName;
    let desc = 'Official academic credential';
    let unitPrice = 80;

    const lower = selectedDocName.toLowerCase();
    if (lower.includes('transcript') || lower.includes('tor')) {
      cleanTitle = 'Transcript of Records (TOR)';
      desc = 'Official academic record of courses taken and grades earned.';
      unitPrice = 125;
    } else if (lower.includes('honorable') || lower.includes('dismissal') || lower.includes('hd')) {
      cleanTitle = 'Honorable Dismissal';
      desc = 'Certificate of honorable dismissal and transfer credentials.';
      unitPrice = 100;
    } else if (lower.includes('evaluation') || lower.includes('eval')) {
      cleanTitle = 'Evaluation';
      desc = 'Curriculum evaluation of academic credits and standing.';
      unitPrice = 50;
    } else if (lower.includes('authentication') || lower.includes('auth')) {
      cleanTitle = 'Authentication';
      desc = 'Official verification and certified authentication of university records.';
      unitPrice = 5;
    } else if (lower.includes('gpa')) {
      cleanTitle = 'Certification - GPA';
      desc = 'Official certification of your overall Grade Point Average and academic standing.';
      unitPrice = 80;
    } else if (lower.includes('earned') || lower.includes('unit')) {
      cleanTitle = 'Certification - Earned Units';
      desc = 'Official certification of academic units completed toward your degree.';
      unitPrice = 80;
    } else if (lower.includes('endorsement')) {
      cleanTitle = 'Certification - Endorsement';
      desc = 'Official university letter of endorsement for employment, OJT, or scholarships.';
      unitPrice = 80;
    } else if (lower.includes('subject') || lower.includes('grade')) {
      cleanTitle = 'Certification - Subjects w/ grades';
      desc = 'Official certification of enrolled courses and corresponding grades earned.';
      unitPrice = 80;
    } else if (lower.includes('enrolled') || lower.includes('coe')) {
      cleanTitle = 'Certification - Officially enrolled';
      desc = 'Certificate verifying active enrollment and academic load for the current semester.';
      unitPrice = 50;
    } else if (lower === 'car' || lower === 'certification - car' || lower.includes('- car')) {
      cleanTitle = 'Certification - CAR';
      desc = 'Cumulative Academic Record summarizing your complete academic history.';
      unitPrice = 75;
    } else if (lower.startsWith('cert')) {
      cleanTitle = 'Certification (P80)';
      desc = 'Official university certification for academic or professional use.';
      unitPrice = 80;
    }

    // Check if an exact DB credential type exists matching the chosen name
    const exactDb = credentialTypes.find((t) => t.name.toLowerCase() === selectedDocName.toLowerCase());
    if (exactDb) {
      cleanTitle = exactDb.name;
      if (exactDb.description) desc = exactDb.description;
      if (exactDb.price) unitPrice = parseFloat(exactDb.price) || unitPrice;
    } else {
      // If user selected a custom DB credential (not one of the certification sub-options)
      const typeMatch = credentialTypes.find((t) => selectedCredTypeId && t.id === selectedCredTypeId);
      if (typeMatch && !selectedDocName.includes('Certification - ') && !lower.includes('gpa') && !lower.includes('unit') && !lower.includes('endorsement') && !lower.includes('subject')) {
        cleanTitle = typeMatch.name;
        if (typeMatch.description) desc = typeMatch.description;
        if (typeMatch.price) unitPrice = parseFloat(typeMatch.price) || unitPrice;
      }
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

  // Automatically select document in Part 2 when navigated from Available Credentials
  useEffect(() => {
    if (docQuery) {
      const lower = docQuery.toLowerCase().trim();
      let matchedDoc = null;
      let matchedTypeId = null;

      if (lower.includes('transcript') || lower === 'tor') {
        matchedDoc = 'Transcript of Records (P125/pg)';
      } else if (lower.includes('honorable') || lower.includes('dismissal') || lower === 'hd') {
        matchedDoc = 'Honorable Dismissal (P100)';
      } else if (lower.includes('authentication') || lower === 'auth') {
        matchedDoc = 'Authentication (P5/pg)';
      } else if (lower.includes('evaluation') || lower === 'eval') {
        matchedDoc = 'Evaluation (P50)';
      } else if (lower.includes('gpa')) {
        matchedDoc = 'Certification - GPA';
      } else if (lower.includes('endorsement')) {
        matchedDoc = 'Certification - Endorsement';
      } else if (lower.includes('enrolled') || lower === 'coe') {
        matchedDoc = 'Certification - Officially enrolled';
      } else if (lower.includes('earned') || lower.includes('unit')) {
        matchedDoc = 'Certification - Earned Units';
      } else if (lower.includes('subject') || lower.includes('grade')) {
        matchedDoc = 'Certification - Subjects w/ grades';
      } else if (lower.includes('car')) {
        matchedDoc = 'Certification - CAR';
      } else if (lower.startsWith('cert')) {
        matchedDoc = 'Certification (P80)';
      } else {
        const dyn = credentialTypes.find(
          (c) => String(c.id) === lower || c.name.toLowerCase().includes(lower) || c.code?.toLowerCase() === lower
        );
        if (dyn) {
          matchedDoc = dyn.name;
          matchedTypeId = dyn.id;
        } else {
          matchedDoc = docQuery;
        }
      }

      if (matchedDoc) {
        handleDocumentSelect(matchedDoc, matchedTypeId);
        setCurrentStep(1);

        // Smoothly scroll down to Part 2 so the student sees their chosen document
        const scrollPart2 = () => {
          const part2El = document.getElementById('ustp-part-2-section');
          if (part2El) {
            part2El.scrollIntoView({ behavior: 'smooth', block: 'center' });
            part2El.classList.add('ustp-part2-highlight');
            setTimeout(() => {
              part2El.classList.remove('ustp-part2-highlight');
            }, 1800);
          }
        };

        const t1 = setTimeout(scrollPart2, 150);
        const t2 = setTimeout(scrollPart2, 450);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      }
    }
  }, [docQuery, credentialTypes]);

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
      toast.warning('Please check the document you need in Part 2 before proceeding.');
      const el = document.getElementById('ustp-part-2-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      toast.warning('Please attach your clearance document before submitting your request.');
      setCurrentStep(1);
      return;
    }

    setSubmitting(true);

    try {
      let createdItem = null;
      let backendClearanceId = null;

      // Submit clearance file to backend clearance API if available
      if (clearanceFile) {
        try {
          const clRes = await clearancesApi.submit(clearanceFile);
          if (clRes?.id) backendClearanceId = clRes.id;
        } catch (clErr) {
          console.warn('Backend clearance upload notice (may already be cleared):', clErr);
          try {
            const myClearances = await clearancesApi.list();
            if (Array.isArray(myClearances) && myClearances.length > 0) {
              backendClearanceId = myClearances[0]?.id;
            }
          } catch {}
        }
      } else {
        try {
          const myClearances = await clearancesApi.list();
          if (Array.isArray(myClearances) && myClearances.length > 0) {
            backendClearanceId = myClearances[0]?.id;
          }
        } catch {}
      }

      const targetCredTypeId = selectedCredTypeId || resolveCredentialTypeId(selectedDocName, credentialTypes);
      const exactDocTitle = currentDocDetails.title || selectedDocName || 'Document Request';
      const cleanPurpose = purposeInput || purposeOption || 'Official Academic Credential Request';
      const formattedRemarks = `[${exactDocTitle}] ${cleanPurpose}`;

      // Submit directly to backend API so it persists in the database for Admin and Staff
      if (targetCredTypeId) {
        try {
          createdItem = await requestsApi.create({
            credential_type: targetCredTypeId,
            remarks: formattedRemarks,
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
        credential_type: targetCredTypeId,
        credential_type_details: {
          name: exactDocTitle,
          price: currentDocDetails.unitPrice,
        },
        document_type: exactDocTitle,
        copies: `${copies} ${copies > 1 ? 'copies' : 'copy'}`,
        amount: `P${currentDocDetails.totalPrice}`,
        price: currentDocDetails.totalPrice,
        status: 'Pending',
        rawStatus: 'PENDING',
        batch_status: 'Pending',
        assigned_staff: '',
        purpose: cleanPurpose,
        remarks: formattedRemarks,
        created_at: new Date().toISOString(),
        request_date: new Date().toISOString().split('T')[0],
        release_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        clearance_preview: clearancePreview || null,
        clearance_id: backendClearanceId || null,
        clearance_is_pdf: clearanceIsPdf || false,
        photo_preview: photoPreview || null,
        clearance_file_name: clearanceFile?.name || null,
        photo_file_name: photoFile?.name || null,
      };

      saveStoredRequest(requestRecord);

      // Cache student profile so Staff and Admin can resolve student details
      try {
        const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
        const pObj = {
          full_name: fullName,
          first_name: fullName.split(' ')[0] || fullName,
          last_name: fullName.split(' ').slice(1).join(' ') || '',
          student_id: studentId,
          course: course,
          email: email,
        };
        if (studentId) profiles[studentId] = pObj;
        if (user?.id) profiles[String(user.id)] = pObj;
        if (user?.username) profiles[user.username] = pObj;
        localStorage.setItem('regquest_student_profiles', JSON.stringify(profiles));
      } catch {}

      if (clearancePreview) {
        const clMeta = {
          isPdf: clearanceIsPdf,
          fileName: clearanceFile?.name || (clearanceIsPdf ? 'Student_Clearance.pdf' : 'Student_Clearance.jpg'),
        };
        saveClearanceAttachment(trackingCode, clearancePreview, clMeta);
        if (studentId) {
          saveClearanceAttachment(studentId, clearancePreview, clMeta);
        }
        if (user?.id) {
          saveClearanceAttachment(String(user.id), clearancePreview, clMeta);
        }
        if (user?.userId) {
          saveClearanceAttachment(String(user.userId), clearancePreview, clMeta);
        }
      }

      // Create notification for student that document request has been created
      saveStoredNotification({
        event_type: 'REQUEST_CREATED',
        message: `Your credential request (${trackingCode}) for ${currentDocDetails.title} has been created.`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_role: 'student',
        target_roles: ['student'],
        target_user_id: user?.userId || user?.id || null,
        target_username: user?.username || fullName,
        target_student_id: studentId || null,
      });

      // Create notification for Admin and Staff
      saveStoredNotification({
        event_type: 'REQUEST_CREATED',
        message: `New credential request submitted by ${fullName} (${studentId || 'Student'}): ${currentDocDetails.title} (${trackingCode}).`,
        related_object_type: 'CredentialRequest',
        related_object_id: trackingCode,
        target_role: 'staff',
        target_roles: ['admin', 'staff', 'registrar'],
      });

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
    <div className="student-page-wrapper">
      <div className="student-page-container">
        <div className="student-step-nav">
          <div className="student-step-labels">
            <span className={`student-step-label ${currentStep >= 1 ? 'active-step' : ''}`}>
              Select Document
            </span>
            <span className={`student-step-label ${currentStep >= 2 ? 'active-step' : ''}`}>
              Review Data
            </span>
            <span className={`student-step-label ${currentStep >= 3 ? 'active-step' : ''}`}>
              Complete
            </span>
          </div>

          <div className="student-step-track">
            <div className={`student-step-fill step-${currentStep}`} />
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
                  <br className="ustp-univ-br" /> OF SOUTHERN PHILIPPINES
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
              <div className="ustp-form-row-3">
                <div className="ustp-field-wrap">
                  <label className="ustp-field-label">Signature over Printed Name:</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="ustp-underline-field ustp-flex-1"
                  />
                </div>
                <div className="ustp-field-wrap">
                  <label className="ustp-field-label">Course:</label>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    required
                    className="ustp-underline-field ustp-flex-1"
                  />
                </div>
                <div className="ustp-field-wrap">
                  <label className="ustp-field-label">Date of Request:</label>
                  <input
                    type="date"
                    value={dateOfRequest}
                    onChange={(e) => setDateOfRequest(e.target.value)}
                    required
                    className="ustp-underline-field ustp-flex-1"
                  />
                </div>
              </div>

              {/* Row 2: Birth date & Category checkboxes */}
              <div className="ustp-form-row-2-items">
                <div className="ustp-field-wrap">
                  <label className="ustp-field-label">Birth date:</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="ustp-underline-field ustp-flex-1"
                  />
                </div>
                <div className="ustp-category-radios">
                  <label className="ustp-checkbox-row">
                    <input
                      type="radio"
                      name="userCategory"
                      value="student"
                      checked={userCategory === 'student'}
                      onChange={() => setUserCategory('student')}
                      className="ustp-checkbox-input"
                    />
                    <span className="ustp-category-text">Student (Undergraduate/Graduate)</span>
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
                    <span className="ustp-category-text">Alumnus (High School/Undergrad/Graduate)</span>
                  </label>
                </div>
              </div>

              <div className="ustp-dashed-divider" />

              {/* Part 1 */}
              <div className="ustp-section-box">
                <div className="ustp-part-header">
                  <span className="ustp-section-title">Part 1: Please complete entries below.</span>
                  <div className="ustp-contact-wrap">
                    <span className="ustp-contact-label">CONTACT NO.:</span>
                    <input
                      type="text"
                      value={contactNo}
                      onChange={(e) => setContactNo(e.target.value)}
                      className="ustp-underline-field ustp-contact-input"
                    />
                  </div>
                </div>

                <div className="ustp-part1-entries">
                  <div className="ustp-part1-row">
                    <span className="ustp-part1-text">If a graduate, state the <strong>Date of Graduation</strong>:</span>
                    <input
                      type="text"
                      placeholder="e.g. June 2025"
                      value={dateOfGraduation}
                      onChange={(e) => setDateOfGraduation(e.target.value)}
                      className="ustp-underline-field ustp-flex-1"
                    />
                  </div>
                  <div className="ustp-part1-row">
                    <span className="ustp-part1-text">If not, state the <strong>Last Semester &amp; SY of Attendance in USTP</strong>:</span>
                    <input
                      type="text"
                      value={lastSemAttendance}
                      onChange={(e) => setLastSemAttendance(e.target.value)}
                      className="ustp-underline-field ustp-flex-1"
                    />
                  </div>
                </div>

                <div className="ustp-part1-prev-wrap">
                  <span className="ustp-part1-text">Already requested credential/s (as stated below) before:</span>
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
                  <div className="ustp-part1-prev-details">
                    <div className="ustp-prev-item">
                      <span>If yes, specify document:</span>
                      <input
                        type="text"
                        value={prevDocRequested}
                        onChange={(e) => setPrevDocRequested(e.target.value)}
                        className="ustp-underline-field ustp-flex-1"
                      />
                    </div>
                    <div className="ustp-prev-item">
                      <span>Date requested:</span>
                      <input
                        type="text"
                        value={prevDateRequested}
                        onChange={(e) => setPrevDateRequested(e.target.value)}
                        className="ustp-underline-field ustp-flex-1"
                      />
                    </div>
                  </div>
                )}

                <div
                  id="ustp-clearance-section"
                  className={`ustp-clearance-section ${clearanceError ? 'has-error' : ''}`}
                >
                  <div className="ustp-clearance-header">
                    <span className="ustp-clearance-heading">Cleared?</span>
                    <span className="ustp-req-star">*</span>
                  </div>

                  <div className="ustp-clearance-radios">
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
                      <span>Yes. (If yes, attach clearance here.)</span>
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
                          setClearanceIsPdf(false);
                        }}
                        className="ustp-checkbox-input"
                      />
                      <span>No. (If not, avail of the clearance form before you proceed with your request.)</span>
                    </label>
                  </div>

                  {isCleared === 'no' && (
                    <div className="ustp-alert-banner danger">
                      <span>⚠️ Cannot proceed: You must avail of the clearance form and obtain clearance first.</span>
                    </div>
                  )}

                  {clearanceError && isCleared === 'yes' && !clearanceFile && !clearancePreview && (
                    <div className="ustp-alert-banner warning">
                      <span>⚠️ Clearance document is required. Please click "Attach clearance here" below.</span>
                    </div>
                  )}

                  {/* "Attach clearance here" on the Cleared? question */}
                  {isCleared === 'yes' && (
                    <div className="ustp-clearance-attachment-box">
                      {clearanceFile || clearancePreview ? (
                        <div className="ustp-attached-card">
                          {/* Top: Attached Photo / Document Preview */}
                          <div className="ustp-attached-media">
                            {clearanceIsPdf || clearanceFile?.name?.toLowerCase().endsWith('.pdf') ? (
                              <div className="ustp-pdf-badge">
                                <span className="ustp-pdf-icon">📄</span>
                                <span>PDF</span>
                              </div>
                            ) : clearancePreview ? (
                              <img
                                src={clearancePreview}
                                alt="Clearance Preview"
                                className="ustp-img-preview"
                              />
                            ) : (
                              <div className="ustp-pdf-badge">
                                <span>📄</span>
                              </div>
                            )}
                            <div className="ustp-attached-text">
                              <span className="ustp-attached-filename">
                                {clearanceFile?.name || 'Clearance Document'}
                              </span>
                              <span className="ustp-attached-status">
                                <span>✓ Attached Photo / Document</span>
                                {clearancePreview && (
                                  <a
                                    href={clearancePreview}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ustp-preview-link"
                                  >
                                    (Preview)
                                  </a>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons Row */}
                          <div className="ustp-attached-actions">
                            <label className="ustp-btn-change">
                              <span>Change Photo / File</span>
                              <input
                                type="file"
                                accept="application/pdf,image/png,image/jpeg,image/jpg"
                                onChange={handleClearanceUpload}
                                className="ustp-file-input-hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={handleRemoveClearance}
                              className="ustp-btn-remove"
                              title="Remove clearance document"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="ustp-upload-trigger-wrap">
                          <label className="ustp-attach-clearance-btn">
                            <svg className="ustp-attach-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span>Attach clearance here</span>
                            <input
                              type="file"
                              accept="application/pdf,image/png,image/jpeg,image/jpg"
                              onChange={handleClearanceUpload}
                              className="ustp-file-input-hidden"
                            />
                          </label>
                          <span className={`ustp-attach-hint ${clearanceError ? 'error' : ''}`}>
                            * Attach clearance PDF or image here (Required)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Part 2: Please check the document/s you need */}
              <div id="ustp-part-2-section" className="ustp-part2-box">
                <span className="ustp-section-title">Part 2: Please check the document/s you need.</span>
                <div className="ustp-part2-grid">
                  {/* Column 1 */}
                  <div className="ustp-doc-col">
                    {/* Evaluation */}
                    {(() => {
                      const isSelected = Boolean(selectedDocName) && (selectedDocName === 'Evaluation (P50)' || selectedDocName.toLowerCase().includes('evaluation') || selectedDocName.toLowerCase() === 'eval');
                      return (
                        <label className={`ustp-doc-label ${isSelected ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="selectedDoc"
                            checked={isSelected}
                            onChange={() => handleDocumentSelect('Evaluation (P50)')}
                            className="ustp-checkbox-input"
                          />
                          <span>Evaluation (P50)</span>
                        </label>
                      );
                    })()}

                    {/* Honorable Dismissal */}
                    {(() => {
                      const isSelected = Boolean(selectedDocName) && (selectedDocName === 'Honorable Dismissal (P100)' || selectedDocName.toLowerCase().includes('honorable') || selectedDocName.toLowerCase().includes('dismissal') || selectedDocName.toLowerCase() === 'hd');
                      return (
                        <label className={`ustp-doc-label ${isSelected ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="selectedDoc"
                            checked={isSelected}
                            onChange={() => handleDocumentSelect('Honorable Dismissal (P100)')}
                            className="ustp-checkbox-input"
                          />
                          <span>Honorable Dismissal (P100)</span>
                        </label>
                      );
                    })()}

                    {/* Transcript of Records */}
                    {(() => {
                      const isSelected = Boolean(selectedDocName) && (selectedDocName.toLowerCase().includes('transcript') || selectedDocName.toLowerCase().includes('tor'));
                      return (
                        <label className={`ustp-doc-label ${isSelected ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="selectedDoc"
                            checked={isSelected}
                            onChange={() => handleDocumentSelect('Transcript of Records (P125/pg)')}
                            className="ustp-checkbox-input"
                          />
                          <span>Transcript of Records (P125/pg)</span>
                        </label>
                      );
                    })()}

                    {/* Authentication */}
                    {(() => {
                      const isSelected = Boolean(selectedDocName) && (selectedDocName.toLowerCase().includes('authentication') || selectedDocName.toLowerCase().includes('auth'));
                      return (
                        <label className={`ustp-doc-label ${isSelected ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="selectedDoc"
                            checked={isSelected}
                            onChange={() => handleDocumentSelect('Authentication (P5/pg)')}
                            className="ustp-checkbox-input"
                          />
                          <span>Authentication (P5/pg)</span>
                        </label>
                      );
                    })()}

                    {/* Extra Dynamic Credentials from Database */}
                    {credentialTypes
                      .filter((ctype) => {
                        const n = (ctype.name || '').toLowerCase();
                        const c = (ctype.code || '').toLowerCase();
                        return (
                          !n.includes('transcript') &&
                          !n.includes('tor') &&
                          !n.includes('honorable') &&
                          !n.includes('dismissal') &&
                          !n.includes('evaluation') &&
                          !n.includes('authentication') &&
                          !n.includes('certification') &&
                          !n.includes('car') &&
                          !n.includes('enrolled') &&
                          !n.includes('gpa') &&
                          !n.includes('earned unit') &&
                          !n.includes('endorsement') &&
                          !n.includes('subjects w/ grades') &&
                          c !== 'tor' &&
                          c !== 'hd' &&
                          c !== 'eval' &&
                          c !== 'auth' &&
                          c !== 'cert' &&
                          c !== 'car' &&
                          c !== 'coe' &&
                          c !== 'gpa' &&
                          c !== 'units' &&
                          c !== 'endorse' &&
                          c !== 'grades'
                        );
                      })
                      .map((ctype) => {
                        const isSelected = Boolean(selectedDocName) && (selectedDocName === ctype.name || (selectedCredTypeId && selectedCredTypeId === ctype.id));
                        return (
                          <label
                            key={ctype.id}
                            className={`ustp-doc-label ${isSelected ? 'selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="selectedDoc"
                              checked={isSelected}
                              onChange={() => handleDocumentSelect(ctype.name, ctype.id)}
                              className="ustp-checkbox-input"
                            />
                            <span className="ustp-dynamic-cred-name">
                              {ctype.name} (P{parseFloat(ctype.price).toFixed(0)})
                            </span>
                          </label>
                        );
                      })}
                  </div>

                  {/* Column 2: Certification and Sub-items */}
                  <div className="ustp-doc-col">
                    {/* General Certification */}
                    {(() => {
                      const isCertGeneralSelected = Boolean(selectedDocName) && (selectedDocName === 'Certification (P80)' || selectedDocName === 'Certification');
                      return (
                        <label className={`ustp-doc-label ${isCertGeneralSelected ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="selectedDoc"
                            checked={isCertGeneralSelected}
                            onChange={() => handleDocumentSelect('Certification (P80)')}
                            className="ustp-checkbox-input"
                          />
                          <span>Certification (P80)</span>
                        </label>
                      );
                    })()}

                    {/* Specific Certification Sub-options */}
                    <div className="ustp-cert-subgrid">
                      {[
                        { label: 'CAR', key: 'CAR' },
                        { label: 'Officially enrolled', key: 'Officially enrolled' },
                        { label: 'GPA', key: 'GPA' },
                        { label: 'Earned Units', key: 'Earned Units' },
                        { label: 'Endorsement', key: 'Endorsement' },
                        { label: 'Subjects w/ grades', key: 'Subjects w/ grades' },
                      ].map((cert) => {
                        const lower = (selectedDocName || '').toLowerCase();
                        const isSubSelected = Boolean(selectedDocName) && (
                          selectedDocName === `Certification - ${cert.label}` ||
                          selectedDocName === cert.label ||
                          (cert.label === 'CAR' && (selectedDocName === 'CAR' || lower === 'car' || lower.includes('- car'))) ||
                          (cert.label === 'Officially enrolled' && (lower.includes('enrolled') || lower === 'coe')) ||
                          (cert.label === 'GPA' && lower.includes('gpa')) ||
                          (cert.label === 'Endorsement' && lower.includes('endorsement')) ||
                          (cert.label === 'Earned Units' && (lower.includes('earned') || lower.includes('unit'))) ||
                          (cert.label === 'Subjects w/ grades' && (lower.includes('subject') || lower.includes('grade')))
                        );

                        return (
                          <label
                            key={cert.key}
                            className={`ustp-cert-subitem ${isSubSelected ? 'selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="selectedDoc"
                              checked={isSubSelected}
                              onChange={() => handleDocumentSelect(`Certification - ${cert.label}`)}
                              className="ustp-checkbox-input"
                            />
                            <span>{cert.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Part 3: Purpose of Request */}
              <div className="ustp-section-box">
                <span className="ustp-section-title">Part 3: Please check the purpose of your request.</span>
                
                {/* 2-Column layout matching the original form */}
                <div className="ustp-purpose-grid">
                  {/* Left Column */}
                  <div className="ustp-purpose-col">
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
                  <div className="ustp-purpose-col">
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
                <div className="ustp-purpose-other-row">
                  <label className="ustp-checkbox-row">
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
                    className="ustp-underline-field ustp-flex-1"
                  />
                </div>

                {/* Note */}
                <p className="ustp-purpose-note">
                  <strong>Note:</strong> For board exam requests, please attach a passport sized picture (person in photo wears a blouse with collar/collared polo; with name tag and photo must be in white background)
                </p>

                {/* Photo Upload Section */}
                <div className="ustp-upload-section">
                  {photoFile ? (
                    <div className="ustp-photo-attached-card">
                      <div className="ustp-attached-media">
                        {photoPreview && (
                          <img
                            src={photoPreview}
                            alt="Uploaded Preview"
                            className="ustp-img-preview"
                          />
                        )}
                        <div className="ustp-attached-text">
                          <span className="ustp-attached-filename">
                            {photoFile.name}
                          </span>
                          <span className="ustp-attached-status">
                            ✓ Attached 2x2 / Passport Photo
                          </span>
                        </div>
                      </div>

                      <div className="ustp-attached-actions">
                        <label className="ustp-btn-change">
                          <span>Change Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="ustp-file-input-hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="ustp-btn-remove"
                          title="Remove photo"
                        >
                          Remove Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ustp-upload-trigger-wrap">
                      <label className="ustp-upload-btn">
                        <svg className="ustp-upload-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Upload Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="ustp-file-input-hidden"
                        />
                      </label>
                      <span className="ustp-upload-hint">
                        No photo attached (Required for Board Exam requests)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Front Desk / Administrative Sign-Off */}
              <div className="ustp-signoff-section">
                <div className="ustp-signoff-verified-row">
                  <span className="ustp-signoff-label">Verified:</span>
                  <span className="ustp-signoff-underline"></span>
                  <span className="ustp-signoff-subtext">Name &amp; Signature of Front Desk Personnel</span>
                </div>

                <div className="ustp-signoff-officials-grid">
                  <div className="ustp-signoff-approved">
                    <span className="ustp-signoff-label">Approved:</span>
                    <div className="ustp-registrar-name">
                      <p className="ustp-registrar-title">Jonalin T. Lagrada, MPSM</p>
                      <p className="ustp-registrar-role">University Registrar</p>
                    </div>
                  </div>
                  <div className="ustp-signoff-cashier">
                    <div className="ustp-cashier-line"></div>
                    <span className="ustp-signoff-subtext">Cashier</span>
                  </div>
                </div>

                <div className="ustp-receipt-row">
                  <div className="ustp-receipt-field">
                    <span className="ustp-receipt-label">Amount:</span>
                    <span className="ustp-receipt-line"></span>
                  </div>
                  <div className="ustp-receipt-field">
                    <span className="ustp-receipt-label">O.R. No.:</span>
                    <span className="ustp-receipt-line"></span>
                  </div>
                  <div className="ustp-receipt-field">
                    <span className="ustp-receipt-label">Payment Date:</span>
                    <span className="ustp-receipt-line"></span>
                  </div>
                  <div className="ustp-receipt-field">
                    <span className="ustp-receipt-label">Date of Release:</span>
                    <span className="ustp-receipt-line"></span>
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

        {/* STEP 2: Review Data (Image 3) */}
        {currentStep === 2 && (
          <div className="review-card">
            <h2 className="review-main-title">Review Data</h2>

            <form onSubmit={handleSubmitRequest}>
              <div className="review-gray-box">
                {/* Document Request */}
                <div>
                  <h3 className="review-sub-title">Document Request:</h3>
                  <div className="review-doc-header">
                    <div>
                      <h4 className="review-doc-name">{currentDocDetails.title}</h4>
                      <p className="review-doc-sub">{currentDocDetails.description}</p>
                      {currentDocDetails.unitPrice > 0 && (
                        <p className="review-doc-pricing">
                          ₱{currentDocDetails.unitPrice.toFixed(2)} per copy
                          {copies > 1 && ` • Estimated Total: ₱${currentDocDetails.totalPrice.toFixed(2)}`}
                        </p>
                      )}
                    </div>

                    <div className="review-copies-control">
                      <span className="review-copies-label">Number of copies</span>
                      <div className="review-copies-stepper">
                        <button
                          type="button"
                          onClick={() => setCopies((c) => Math.max(1, c - 1))}
                          className="review-stepper-btn"
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
                          className="review-stepper-btn"
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
                  <div className="review-fields-grid">
                    <div>
                      <label className="review-input-label">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="review-input-label">Year Level</label>
                      <input
                        type="text"
                        value={yearLevel}
                        onChange={(e) => setYearLevel(e.target.value)}
                        placeholder="e.g. 4th Year"
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="review-input-label">Student ID</label>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="review-input-label">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div className="review-field-span-2">
                      <label className="review-input-label">Program / Course</label>
                      <input
                        type="text"
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="review-input-label">Contact No.</label>
                      <input
                        type="text"
                        value={contactNo}
                        onChange={(e) => setContactNo(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="review-input-label">Birth Date</label>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="review-pill-input"
                      />
                    </div>

                    <div>
                      <label className="review-input-label">Category</label>
                      <input
                        type="text"
                        value={userCategory === 'alumnus' ? 'Alumnus (High School/Undergraduate/Graduate)' : 'Student (Undergraduate/Graduate)'}
                        readOnly
                        className="review-pill-input readonly"
                      />
                    </div>

                    <div>
                      <label className="review-input-label">
                        {userCategory === 'alumnus' || dateOfGraduation ? 'Date of Graduation' : 'Last Semester of Attendance'}
                      </label>
                      <input
                        type="text"
                        value={dateOfGraduation || lastSemAttendance || '2nd Sem, AY 2025-2026'}
                        readOnly
                        className="review-pill-input readonly"
                      />
                    </div>
                  </div>
                </div>

                <div className="review-divider" />

                {/* Purpose of Request */}
                <div>
                  <h3 className="review-sub-title">Purpose of Request:</h3>
                  <div>
                    <label className="review-input-label">
                      Purpose of the request <span className="review-req-star">*</span>
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
                        {/* Clearance Form Card - Only shown if clearance document is attached */}
                        {clearancePreview && (
                          <div className="review-attached-card">
                            <div className="review-attached-media">
                              {clearanceIsPdf || clearanceFile?.name?.toLowerCase().endsWith('.pdf') ? (
                                <div className="review-pdf-badge">
                                  <span className="review-pdf-icon">📄</span>
                                  <span>PDF</span>
                                </div>
                              ) : (
                                <img
                                  src={clearancePreview}
                                  alt="Clearance Form"
                                  className="review-attached-thumb"
                                />
                              )}
                              <div className="review-attached-info">
                                <span className="review-attached-title">Clearance Document</span>
                                <span className="review-attached-filename">
                                  {clearanceFile ? clearanceFile.name : 'Attached Clearance'}
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
                                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                                  onChange={handleClearanceUpload}
                                  className="ustp-file-input-hidden"
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
                                  className="ustp-file-input-hidden"
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
              <svg className="complete-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
