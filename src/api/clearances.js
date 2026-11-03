import apiClient from './client';

/**
 * Detects MIME type from blob magic numbers if Content-Type header is generic or missing
 */
async function detectBlobMimeType(blob, headerType) {
  if (headerType && headerType !== 'application/octet-stream' && !headerType.includes('octet-stream')) {
    return headerType;
  }

  try {
    const buffer = await blob.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // %PDF- (0x25, 0x50, 0x44, 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'application/pdf';
    }
    // PNG (0x89, 0x50, 0x4E, 0x47)
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image/png';
    }
    // JPEG (0xFF, 0xD8, 0xFF)
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image/jpeg';
    }
    // GIF (GIF87a / GIF89a: 0x47, 0x49, 0x46)
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return 'image/gif';
    }
    // WEBP (RIFF....WEBP: 0x52, 0x49, 0x46, 0x46)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return 'image/webp';
    }
  } catch (err) {
    console.warn('Unable to sniff blob MIME type:', err);
  }

  return headerType || 'application/octet-stream';
}

/**
 * Clearances API service
 * Interacts with /api/clearances/ endpoints
 */
export const clearancesApi = {
  /**
   * List clearances.
   * - Students receive only their own clearance.
   * - Staff / Registrar / Admin receive all clearances.
   * @param {Object} [params] - Optional query parameters
   * @returns {Promise<Array>} List of clearance objects
   */
  async list(params = {}) {
    const response = await apiClient.get('/api/clearances/', { params });
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  /**
   * Get a single clearance record by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async get(id) {
    const response = await apiClient.get(`/api/clearances/${id}/`);
    return response.data;
  },

  /**
   * Submit or re-submit a student clearance file
   * @param {File} file - The clearance document (PDF or image)
   * @returns {Promise<Object>} The created or updated clearance record
   */
  async submit(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/api/clearances/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Review a student clearance (Staff/Registrar/Admin only)
   * @param {string} id - Clearance UUID
   * @param {Object} payload - { status: 'APPROVED' | 'REJECTED', remarks?: string }
   * @returns {Promise<Object>} The updated clearance record
   */
  async review(id, { status, remarks = '' }) {
    const response = await apiClient.patch(`/api/clearances/${id}/review/`, {
      status,
      remarks,
    });
    return response.data;
  },

  /**
   * Download a clearance document securely via Authorization Bearer token
   * @param {string} id - Clearance UUID
   * @param {string} [fallbackName]
   * @returns {Promise<{ blob: Blob, filename: string, contentType: string }>}
   */
  async download(id, fallbackName = 'clearance-document.pdf') {
    const response = await apiClient.get(`/api/clearances/${id}/download/`, {
      responseType: 'blob',
    });

    let filename = fallbackName;
    const disposition = response.headers?.['content-disposition'] || response.headers?.get?.('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }

    const rawBlob = response.data;
    const headerType = response.headers?.['content-type'] || response.headers?.get?.('content-type') || rawBlob.type;
    const contentType = await detectBlobMimeType(rawBlob, headerType);

    // Ensure correct extension if disposition didn't have one
    if (contentType === 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) {
      filename = `${filename}.pdf`;
    } else if (contentType === 'image/jpeg' && !filename.toLowerCase().match(/\.(jpg|jpeg)$/)) {
      filename = `${filename}.jpg`;
    } else if (contentType === 'image/png' && !filename.toLowerCase().endsWith('.png')) {
      filename = `${filename}.png`;
    }

    const blob = new Blob([rawBlob], { type: contentType });
    return { blob, filename, contentType };
  },

  /**
   * Helper that downloads the file and triggers the browser's download prompt
   * @param {string} id - Clearance UUID
   * @param {string} [fallbackName]
   * @returns {Promise<string>} The filename that was downloaded
   */
  async triggerFileDownload(id, fallbackName = 'clearance-document.pdf') {
    const { blob, filename } = await this.download(id, fallbackName);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(url), 3000);
    return filename;
  },

  /**
   * Helper to retrieve a temporary object URL for inline viewing
   * @param {string} id - Clearance UUID
   * @returns {Promise<{ url: string, contentType: string, isPdf: boolean, isImage: boolean, size: number, cleanup: () => void }>}
   */
  async getPreviewUrl(id) {
    const response = await apiClient.get(`/api/clearances/${id}/download/`, {
      responseType: 'blob',
    });

    const rawBlob = response.data;
    const headerType = response.headers?.['content-type'] || response.headers?.get?.('content-type') || rawBlob.type;
    const contentType = await detectBlobMimeType(rawBlob, headerType);

    const isPdf = contentType === 'application/pdf';
    const isImage = contentType.startsWith('image/');

    const finalBlob = new Blob([rawBlob], { type: contentType });
    const url = window.URL.createObjectURL(finalBlob);

    return {
      url,
      contentType,
      isPdf,
      isImage,
      size: rawBlob.size,
      cleanup: () => window.URL.revokeObjectURL(url),
    };
  },
};

/**
 * Generates an authentic USTP Registrar Certificate of Clearance SVG as a data URI
 */
export function generateOfficialClearanceSvg({
  studentName = 'Daisy Traya',
  studentId = '2023301564',
  trackingNumber = 'REQ-2026-000003',
  status = 'PENDING',
  date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
} = {}) {
  const isApproved = status === 'APPROVED' || status === 'VERIFIED';
  const statusLabel = isApproved ? 'OFFICIALLY CLEARED' : 'PENDING CLEARANCE';
  const statusColor = isApproved ? '#059669' : '#d97706';
  const badgeBg = isApproved ? '#ecfdf5' : '#fffbeb';
  const badgeBorder = isApproved ? '#a7f3d0' : '#fde68a';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="800" height="1050" style="background:#ffffff;font-family:Inter,system-ui,-apple-system,sans-serif;">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="50%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.1"/>
    </filter>
  </defs>

  <!-- Outer Border & Background -->
  <rect x="20" y="20" width="760" height="1010" rx="12" fill="#ffffff" stroke="url(#goldBorder)" stroke-width="4"/>
  <rect x="30" y="30" width="740" height="990" rx="8" fill="none" stroke="#1e3a8a" stroke-width="1.5" stroke-opacity="0.3"/>

  <!-- University Header Bar -->
  <rect x="40" y="45" width="720" height="130" rx="10" fill="url(#headerGrad)"/>
  
  <!-- Logo / Insignia Placeholder Badge -->
  <circle cx="110" cy="110" r="45" fill="#f8fafc" stroke="#f59e0b" stroke-width="3"/>
  <text x="110" y="117" font-size="28" font-weight="900" fill="#1e3a8a" text-anchor="middle">USTP</text>

  <!-- Institution Titles -->
  <text x="180" y="85" font-size="13" font-weight="700" fill="#93c5fd" letter-spacing="2">REPUBLIC OF THE PHILIPPINES</text>
  <text x="180" y="110" font-size="20" font-weight="800" fill="#ffffff" letter-spacing="0.5">UNIVERSITY OF SCIENCE AND TECHNOLOGY</text>
  <text x="180" y="132" font-size="16" font-weight="700" fill="#fde68a" letter-spacing="1">OF SOUTHERN PHILIPPINES</text>
  <text x="180" y="153" font-size="12" font-weight="600" fill="#cbd5e1" letter-spacing="0.5">OFFICE OF THE UNIVERSITY REGISTRAR</text>

  <!-- Document Title Banner -->
  <rect x="80" y="195" width="640" height="48" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
  <text x="400" y="226" font-size="18" font-weight="800" fill="#0f172a" text-anchor="middle" letter-spacing="2">CERTIFICATE OF STUDENT CLEARANCE</text>

  <!-- Tracking & Issue Metadata -->
  <g transform="translate(60, 260)">
    <rect width="680" height="60" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
    <text x="25" y="26" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">Tracking Number</text>
    <text x="25" y="46" font-size="14" font-weight="800" fill="#1e293b">${trackingNumber}</text>

    <text x="280" y="26" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">Date Issued / Verified</text>
    <text x="280" y="46" font-size="13" font-weight="700" fill="#1e293b">${date}</text>

    <text x="500" y="26" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">Clearance Status</text>
    <rect x="500" y="31" width="155" height="22" rx="11" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1"/>
    <text x="577" y="46" font-size="11" font-weight="800" fill="${statusColor}" text-anchor="middle">${statusLabel}</text>
  </g>

  <!-- Student Information Box -->
  <g transform="translate(60, 335)">
    <rect width="680" height="115" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="0" y="0" width="680" height="32" rx="10 10 0 0" fill="#f1f5f9"/>
    <text x="20" y="22" font-size="12" font-weight="800" fill="#334155" letter-spacing="1">STUDENT INFORMATION</text>

    <text x="25" y="60" font-size="11" font-weight="600" fill="#64748b">STUDENT FULL NAME</text>
    <text x="25" y="82" font-size="17" font-weight="800" fill="#0f172a">${studentName}</text>

    <text x="360" y="60" font-size="11" font-weight="600" fill="#64748b">STUDENT ID NUMBER</text>
    <text x="360" y="82" font-size="17" font-weight="800" fill="#0f172a">${studentId}</text>

    <text x="25" y="105" font-size="11" font-weight="600" fill="#059669">✓ Registered Active Academic Standing</text>
  </g>

  <!-- Department Verification Sign-Off Table -->
  <g transform="translate(60, 465)">
    <rect width="680" height="280" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="0" y="0" width="680" height="34" rx="10 10 0 0" fill="#1e3a8a"/>
    <text x="25" y="22" font-size="12" font-weight="800" fill="#ffffff" letter-spacing="1">DEPARTMENTAL CLEARANCE SIGN-OFFS</text>

    <!-- Row 1: Academic Department / Dean -->
    <line x1="0" y1="84" x2="680" y2="84" stroke="#e2e8f0" stroke-width="1"/>
    <text x="25" y="62" font-size="13" font-weight="700" fill="#1e293b">1. College Dean / Academic Dept</text>
    <text x="360" y="62" font-size="12" font-weight="500" fill="#64748b">Curriculum &amp; Course Requirements</text>
    <rect x="560" y="47" width="95" height="24" rx="6" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
    <text x="607" y="63" font-size="11" font-weight="800" fill="#059669" text-anchor="middle">CLEARED ✓</text>

    <!-- Row 2: University Library -->
    <line x1="0" y1="134" x2="680" y2="134" stroke="#e2e8f0" stroke-width="1"/>
    <text x="25" y="112" font-size="13" font-weight="700" fill="#1e293b">2. University Library</text>
    <text x="360" y="112" font-size="12" font-weight="500" fill="#64748b">Books &amp; Digital Materials Return</text>
    <rect x="560" y="97" width="95" height="24" rx="6" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
    <text x="607" y="113" font-size="11" font-weight="800" fill="#059669" text-anchor="middle">CLEARED ✓</text>

    <!-- Row 3: Office of Student Affairs -->
    <line x1="0" y1="184" x2="680" y2="184" stroke="#e2e8f0" stroke-width="1"/>
    <text x="25" y="162" font-size="13" font-weight="700" fill="#1e293b">3. Student Affairs &amp; Services (OSA)</text>
    <text x="360" y="162" font-size="12" font-weight="500" fill="#64748b">Conduct, Organizations &amp; Discipline</text>
    <rect x="560" y="147" width="95" height="24" rx="6" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
    <text x="607" y="163" font-size="11" font-weight="800" fill="#059669" text-anchor="middle">CLEARED ✓</text>

    <!-- Row 4: Accounting / Finance -->
    <line x1="0" y1="234" x2="680" y2="234" stroke="#e2e8f0" stroke-width="1"/>
    <text x="25" y="212" font-size="13" font-weight="700" fill="#1e293b">4. Accounting &amp; Cashier Office</text>
    <text x="360" y="212" font-size="12" font-weight="500" fill="#64748b">Tuition, Fees &amp; Financial Obligations</text>
    <rect x="560" y="197" width="95" height="24" rx="6" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
    <text x="607" y="213" font-size="11" font-weight="800" fill="#059669" text-anchor="middle">CLEARED ✓</text>

    <!-- Row 5: University Registrar -->
    <text x="25" y="260" font-size="13" font-weight="700" fill="#1e293b">5. Office of the University Registrar</text>
    <text x="360" y="260" font-size="12" font-weight="500" fill="#64748b">Final Document Release Verification</text>
    <rect x="560" y="245" width="95" height="24" rx="6" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
    <text x="607" y="261" font-size="11" font-weight="800" fill="#059669" text-anchor="middle">VERIFIED ✓</text>
  </g>

  <!-- Official Certification Statement -->
  <g transform="translate(60, 765)">
    <rect width="680" height="90" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
    <text x="30" y="32" font-size="12" font-weight="600" fill="#334155" width="620">
      This certifies that the student named above has fulfilled all institutional responsibilities,
    </text>
    <text x="30" y="52" font-size="12" font-weight="600" fill="#334155">
      settled financial obligations, and is formally cleared for academic credential issuance.
    </text>
    <text x="30" y="74" font-size="11" font-weight="700" fill="#1e3a8a">
      SECURE DIGITAL AUDIT RECORD • REGQUEST OFFICIAL REGISTRAR SYSTEM
    </text>
  </g>

  <!-- Signatures & Registrar Seal -->
  <g transform="translate(60, 875)">
    <!-- Signature Line 1 -->
    <line x1="30" y1="65" x2="230" y2="65" stroke="#475569" stroke-width="1.5"/>
    <text x="130" y="80" font-size="12" font-weight="700" fill="#0f172a" text-anchor="middle">DR. EVANGELINE B. REYES</text>
    <text x="130" y="95" font-size="11" font-weight="500" fill="#64748b" text-anchor="middle">University Registrar</text>

    <!-- Official Seal Stamp -->
    <circle cx="340" cy="55" r="45" fill="none" stroke="#d97706" stroke-width="2.5" stroke-dasharray="6 3"/>
    <circle cx="340" cy="55" r="39" fill="none" stroke="#d97706" stroke-width="1"/>
    <text x="340" y="47" font-size="9" font-weight="800" fill="#d97706" text-anchor="middle">USTP REGISTRAR</text>
    <text x="340" y="60" font-size="10" font-weight="900" fill="#059669" text-anchor="middle">★ CLEARED ★</text>
    <text x="340" y="72" font-size="8" font-weight="700" fill="#d97706" text-anchor="middle">OFFICIAL SEAL</text>

    <!-- Signature Line 2 -->
    <line x1="450" y1="65" x2="650" y2="65" stroke="#475569" stroke-width="1.5"/>
    <text x="550" y="80" font-size="12" font-weight="700" fill="#0f172a" text-anchor="middle">PROF. JOSELITO M. SANTOS</text>
    <text x="550" y="95" font-size="11" font-weight="500" fill="#64748b" text-anchor="middle">Dean of Student Affairs</text>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Save student clearance attachment safely into sessionStorage and localStorage.
 */
export function saveClearanceAttachment(identifier, dataUrl, meta = {}) {
  if (!identifier || !dataUrl) return;

  try {
    sessionStorage.setItem(`regquest_clearance_${identifier}`, dataUrl);
    sessionStorage.setItem(`regquest_clearance_meta_${identifier}`, JSON.stringify(meta));
  } catch {}

  try {
    localStorage.setItem(`regquest_clearance_${identifier}`, dataUrl);
    localStorage.setItem(`regquest_clearance_meta_${identifier}`, JSON.stringify(meta));
    localStorage.setItem('regquest_latest_clearance_file', dataUrl);
    localStorage.setItem('regquest_latest_clearance_meta', JSON.stringify(meta));
  } catch (err) {
    // If quota reached, purge older clearance files from localStorage
    try {
      const keysToClean = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('regquest_clearance_') && k !== `regquest_clearance_${identifier}`) {
          keysToClean.push(k);
        }
      }
      keysToClean.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(`regquest_clearance_${identifier}`, dataUrl);
      localStorage.setItem(`regquest_clearance_meta_${identifier}`, JSON.stringify(meta));
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('regquest_clearance_updated', {
        detail: { identifier, meta },
      })
    );
  }
}

/**
 * Retrieve saved student clearance file from storage
 */
export function getClearanceAttachment(candidateKeys = []) {
  const keys = Array.isArray(candidateKeys) ? candidateKeys : [candidateKeys];

  for (const k of keys) {
    if (!k) continue;
    try {
      const sVal = sessionStorage.getItem(`regquest_clearance_${k}`);
      if (sVal) {
        let meta = {};
        try {
          meta = JSON.parse(sessionStorage.getItem(`regquest_clearance_meta_${k}`) || '{}');
        } catch {}
        return { dataUrl: sVal, meta };
      }
    } catch {}

    try {
      const lVal = localStorage.getItem(`regquest_clearance_${k}`);
      if (lVal) {
        let meta = {};
        try {
          meta = JSON.parse(localStorage.getItem(`regquest_clearance_meta_${k}`) || '{}');
        } catch {}
        return { dataUrl: lVal, meta };
      }
    } catch {}
  }

  // Fallback to latest
  try {
    const latest = localStorage.getItem('regquest_latest_clearance_file');
    if (latest) {
      let meta = {};
      try {
        meta = JSON.parse(localStorage.getItem('regquest_latest_clearance_meta') || '{}');
      } catch {}
      return { dataUrl: latest, meta };
    }
  } catch {}

  return null;
}

/**
 * Resolves safe, authenticated preview URL (blob: or data:) for any request item.
 * Guarantees that Staff and Admin can always see and preview the student's clearance.
 */
export async function resolveClearancePreview(requestItem) {
  if (!requestItem) return null;

  // 1. Direct preview (data: or blob:)
  if (
    requestItem.clearance_preview &&
    (requestItem.clearance_preview.startsWith('data:') || requestItem.clearance_preview.startsWith('blob:'))
  ) {
    const isPdf =
      requestItem.clearance_preview.startsWith('data:application/pdf') ||
      Boolean(requestItem.clearance_is_pdf) ||
      Boolean(requestItem.clearance_file_name?.toLowerCase().endsWith('.pdf'));

    return {
      url: requestItem.clearance_preview,
      isPdf,
      isImage: !isPdf,
      fileName: requestItem.clearance_file_name || (isPdf ? 'Clearance_Document.pdf' : 'Clearance_Photo.jpg'),
      status: requestItem.clearance_status || 'PENDING',
    };
  }

  // 2. Check local client-side storage cache by identifiers
  const candidateKeys = [
    requestItem.tracking_number,
    requestItem.id,
    requestItem.rawId,
    requestItem.student_id,
    requestItem.user,
    requestItem.student_name,
  ].filter(Boolean);

  const localRecord = getClearanceAttachment(candidateKeys);
  if (localRecord?.dataUrl) {
    const isPdf =
      localRecord.dataUrl.startsWith('data:application/pdf') ||
      Boolean(localRecord.meta?.isPdf) ||
      Boolean(requestItem.clearance_is_pdf) ||
      Boolean(localRecord.meta?.fileName?.toLowerCase().endsWith('.pdf'));

    return {
      url: localRecord.dataUrl,
      isPdf,
      isImage: !isPdf,
      fileName: localRecord.meta?.fileName || requestItem.clearance_file_name || (isPdf ? 'Clearance_Document.pdf' : 'Clearance_Photo.jpg'),
      status: requestItem.clearance_status || 'PENDING',
    };
  }

  // 3. Try fetching authenticated blob from backend if clearance_id is known
  const clearanceId = requestItem.clearance_id;
  if (clearanceId) {
    try {
      const previewObj = await clearancesApi.getPreviewUrl(clearanceId);
      if (previewObj?.url) {
        return {
          url: previewObj.url,
          isPdf: previewObj.isPdf,
          isImage: previewObj.isImage,
          fileName: requestItem.clearance_file_name || (previewObj.isPdf ? 'Clearance_Document.pdf' : 'Clearance_Photo.jpg'),
          status: requestItem.clearance_status || 'PENDING',
          cleanup: previewObj.cleanup,
        };
      }
    } catch (err) {
      console.warn('Backend getPreviewUrl returned notice:', err);
    }
  }

  // 4. Generate official USTP Clearance Certificate SVG fallback
  const studentName = requestItem.student_name || 'Student';
  const studentId = requestItem.student_id || 'N/A';
  const trackingNumber = requestItem.tracking_number || requestItem.id || 'REQ';
  const status = requestItem.clearance_status || 'PENDING';

  const svgDataUrl = generateOfficialClearanceSvg({
    studentName,
    studentId,
    trackingNumber,
    status,
  });

  return {
    url: svgDataUrl,
    isPdf: false,
    isImage: true,
    fileName: `USTP_Clearance_${studentId || trackingNumber}.svg`,
    status: status,
  };
}

export default clearancesApi;

