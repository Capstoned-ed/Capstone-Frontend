import apiClient from './client';

const OVERRIDES_KEY = 'regquest_credential_types_overrides';
const CUSTOM_KEY = 'regquest_custom_credential_types';

export const REQUEST_FORM_CREDENTIAL_TYPES = [
  {
    id: 3,
    code: 'EVAL',
    doc_code: '5',
    name: 'Evaluation',
    description: 'Curriculum evaluation of academic credits and standing.',
    price: '50.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 2,
    code: 'HD',
    doc_code: '2',
    name: 'Honorable Dismissal',
    description: 'Certificate of honorable dismissal and transfer credentials.',
    price: '100.00',
    processing_days: 5,
    is_active: true,
  },
  {
    id: 1,
    code: 'TOR',
    doc_code: '1',
    name: 'Transcript of Records (TOR)',
    description: 'Official academic record of courses taken and grades earned.',
    price: '125.00',
    processing_days: 7,
    is_active: true,
  },
  {
    id: 101,
    code: 'AUTH',
    doc_code: '10',
    name: 'Authentication',
    description: 'Official verification and certified authentication of university records.',
    price: '5.00',
    processing_days: 2,
    is_active: true,
  },
  {
    id: 4,
    code: 'CAR',
    doc_code: '4f',
    name: 'Certification - CAR',
    description: 'Cumulative Academic Record summarizing your complete academic history.',
    price: '80.00',
    processing_days: 5,
    is_active: true,
  },
  {
    id: 5,
    code: 'COE',
    doc_code: '4a',
    name: 'Certification - Officially enrolled',
    description: 'Certificate verifying active enrollment and academic load for the current semester.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 103,
    code: 'GPA',
    doc_code: '4b',
    name: 'Certification - GPA',
    description: 'Official certification of your overall Grade Point Average and academic standing.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 104,
    code: 'UNITS',
    doc_code: '4d',
    name: 'Certification - Earned Units',
    description: 'Official certification of academic units completed toward your degree.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 105,
    code: 'ENDORSE',
    doc_code: '4m',
    name: 'Certification - Endorsement',
    description: 'Official university letter of endorsement for employment, OJT, or scholarships.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 106,
    code: 'GRADES',
    doc_code: '4g',
    name: 'Certification - Subjects w/ grades',
    description: 'Official certification of enrolled courses and corresponding grades earned.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
];

function getOverrides() {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveOverride(id, patch) {
  try {
    const map = getOverrides();
    map[String(id)] = { ...(map[String(id)] || {}), ...patch };
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
  } catch {}
}

function getCustomTypes() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveCustomType(item) {
  try {
    const list = getCustomTypes().filter((t) => String(t.id) !== String(item.id));
    localStorage.setItem(CUSTOM_KEY, JSON.stringify([item, ...list]));
  } catch {}
}

function matchBackendRecord(def, backendList) {
  const defCode = def.code.toUpperCase();
  const byId = backendList.find((b) => Number(b.id) === Number(def.id) && Number(def.id) < 100);
  if (byId) return byId;

  return backendList.find((b) => {
    const bCode = String(b.code || '').toUpperCase();
    const bName = String(b.name || '').toLowerCase();
    if (bCode === defCode) return true;
    if (defCode === 'TOR' && bName.includes('transcript')) return true;
    if (defCode === 'HD' && (bName.includes('honorable') || bName.includes('dismissal'))) return true;
    if (defCode === 'EVAL' && bName.includes('evaluation')) return true;
    if (defCode === 'CAR' && (bName === 'car' || bName.includes('- car'))) return true;
    if (defCode === 'COE' && bName.includes('enrolled')) return true;
    if (defCode === 'AUTH' && bName.includes('authentication')) return true;
    if (defCode === 'GPA' && bName.includes('gpa')) return true;
    if (defCode === 'UNITS' && bName.includes('earned unit')) return true;
    if (defCode === 'ENDORSE' && bName.includes('endorsement')) return true;
    if (defCode === 'GRADES' && bName.includes('subjects w/ grades')) return true;
    return false;
  });
}

export function compareCredentialCodes(a, b) {
  const codeA = String(a?.doc_code || a?.code || '').trim();
  const codeB = String(b?.doc_code || b?.code || '').trim();
  const isPureNumA = /^\d+$/.test(codeA);
  const isPureNumB = /^\d+$/.test(codeB);

  if (isPureNumA && !isPureNumB) return -1;
  if (!isPureNumA && isPureNumB) return 1;
  return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
}

function mergeCredentialCatalog(backendList = []) {
  const isStandaloneCertification = (item) => {
    const codeUpper = String(item?.code || '').trim().toUpperCase();
    const nameLower = String(item?.name || '').trim().toLowerCase();
    return codeUpper === 'CERT' || nameLower === 'certification';
  };

  // Authoritative mode: when the Django CredentialType DB returns records,
  // use them directly without overwriting codes, prices, or processing_days
  // with hardcoded defaults or stale localStorage overrides.
  if (Array.isArray(backendList) && backendList.length > 0) {
    return backendList
      .filter((b) => b && !isStandaloneCertification(b))
      .map((b) => ({
        ...b,
        doc_code: b.doc_code || b.code || '',
      }))
      .sort(compareCredentialCodes);
  }

  // Offline / unreachable fallback only
  return [...REQUEST_FORM_CREDENTIAL_TYPES].sort(compareCredentialCodes);
}

export const VOLUME_CREDENTIAL_SERIES = [
  { key: 'transcript', label: 'Transcript of Records', shortLabel: 'TOR', color: '#001FD1' },
  { key: 'dismissal', label: 'Honorable Dismissal', shortLabel: 'Dismissal', color: '#EAB308' },
  { key: 'evaluation', label: 'Evaluation', shortLabel: 'Evaluation', color: '#F97316' },
  { key: 'authentication', label: 'Authentication', shortLabel: 'Auth', color: '#10B981' },
  { key: 'enrolled', label: 'Officially Enrolled', shortLabel: 'Enrolled', color: '#7088FF' },
  { key: 'gpa', label: 'Certification - GPA', shortLabel: 'GPA', color: '#8B5CF6' },
  { key: 'units', label: 'Certification - Earned Units', shortLabel: 'Units', color: '#06B6D4' },
  { key: 'car', label: 'CAR', shortLabel: 'CAR', color: '#FF0000' },
  { key: 'grades', label: 'Certification - Subjects w/ Grades', shortLabel: 'Grades', color: '#EC4899' },
  { key: 'endorsement', label: 'Certification - Endorsement', shortLabel: 'Endorse', color: '#14B8A6' },
];

export function getVolumeDocKey(req, credTypes = []) {
  const credId = req?.credential_type || req?.credential;
  const cred = credTypes.find(
    (c) => c.id === credId || c.code === credId || String(c.id) === String(credId)
  );
  const code = String(cred?.code || req?.document_type || req?.credential_name || '').toUpperCase();
  const docCode = String(cred?.doc_code || '').toUpperCase();
  const name = String(cred?.name || req?.document_type || req?.credential_name || '').toUpperCase();

  if (code === 'TOR' || docCode === '1' || code.includes('TOR') || name.includes('TRANSCRIPT')) return 'transcript';
  if (code === 'HD' || docCode === '2' || code.includes('HD') || name.includes('HONORABLE') || name.includes('DISMISSAL')) return 'dismissal';
  if (code === 'EVAL' || docCode === '5' || code.includes('EVAL') || name.includes('EVALUATION')) return 'evaluation';
  if (code === 'AUTH' || docCode === '10' || code.includes('AUTH') || name.includes('AUTHENTICATION')) return 'authentication';
  if (code === 'COE' || docCode === '4A' || code.includes('COE') || code.includes('ENR') || name.includes('ENROLL') || name.includes('OFFICIALLY')) return 'enrolled';
  if (code === 'GPA' || docCode === '4B' || name.includes('GPA')) return 'gpa';
  if (code === 'UNITS' || docCode === '4D' || name.includes('EARNED UNIT') || name.includes('UNITS')) return 'units';
  if (code === 'CAR' || docCode === '4F' || code.includes('CAR') || name.includes('CUMULATIVE ACADEMIC') || name.includes('CERTIFICATE OF ACADEMIC')) return 'car';
  if (code === 'GRADES' || docCode === '4G' || name.includes('GRADES')) return 'grades';
  if (code === 'ENDORSE' || docCode === '4M' || name.includes('ENDORSE')) return 'endorsement';

  return 'transcript';
}

export function createEmptyVolumeBucket(extra = {}) {
  const bucket = { ...extra, totalLine: 0 };
  VOLUME_CREDENTIAL_SERIES.forEach((s) => {
    bucket[s.key] = 0;
  });
  return bucket;
}

export function sumVolumeBucket(bucket) {
  return VOLUME_CREDENTIAL_SERIES.reduce((sum, s) => sum + (bucket[s.key] || 0), 0);
}

export const credentialTypesApi = {
  async list(params = {}) {
    let backendData = [];
    try {
      const response = await apiClient.get('/api/credential-types/', { params });
      backendData = Array.isArray(response.data) ? response.data : (response.data?.results || []);
    } catch {
      backendData = [];
    }
    return mergeCredentialCatalog(backendData);
  },

  async get(id) {
    try {
      const response = await apiClient.get(`/api/credential-types/${id}/`);
      return response.data;
    } catch {
      const all = await this.list();
      return all.find((t) => String(t.id) === String(id)) || null;
    }
  },

  async create(data) {
    const response = await apiClient.post('/api/credential-types/', data);
    try {
      localStorage.removeItem(OVERRIDES_KEY);
      localStorage.removeItem(CUSTOM_KEY);
    } catch {}
    return response.data;
  },

  async update(id, updates) {
    const response = await apiClient.patch(`/api/credential-types/${id}/`, updates);
    try {
      localStorage.removeItem(OVERRIDES_KEY);
    } catch {}
    return response.data;
  },

  async deactivate(id) {
    const response = await apiClient.delete(`/api/credential-types/${id}/`);
    try {
      localStorage.removeItem(OVERRIDES_KEY);
    } catch {}
    return response.data;
  },
};

export default credentialTypesApi;
