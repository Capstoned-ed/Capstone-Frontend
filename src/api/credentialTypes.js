import apiClient from './client';

const OVERRIDES_KEY = 'regquest_credential_types_overrides';
const CUSTOM_KEY = 'regquest_custom_credential_types';

export const REQUEST_FORM_CREDENTIAL_TYPES = [
  {
    id: 3,
    code: 'EVAL',
    name: 'Evaluation',
    description: 'Curriculum evaluation of academic credits and standing.',
    price: '50.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 2,
    code: 'HD',
    name: 'Honorable Dismissal',
    description: 'Certificate of honorable dismissal and transfer credentials.',
    price: '100.00',
    processing_days: 5,
    is_active: true,
  },
  {
    id: 1,
    code: 'TOR',
    name: 'Transcript of Records (TOR)',
    description: 'Official academic record of courses taken and grades earned.',
    price: '125.00',
    processing_days: 7,
    is_active: true,
  },
  {
    id: 101,
    code: 'AUTH',
    name: 'Authentication',
    description: 'Official verification and certified authentication of university records.',
    price: '5.00',
    processing_days: 2,
    is_active: true,
  },
  {
    id: 102,
    code: 'CERT',
    name: 'Certification',
    description: 'Official university certification for academic or professional use.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 4,
    code: 'CAR',
    name: 'Certification - CAR',
    description: 'Cumulative Academic Record summarizing your complete academic history.',
    price: '80.00',
    processing_days: 5,
    is_active: true,
  },
  {
    id: 5,
    code: 'COE',
    name: 'Certification - Officially enrolled',
    description: 'Certificate verifying active enrollment and academic load for the current semester.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 103,
    code: 'GPA',
    name: 'Certification - GPA',
    description: 'Official certification of your overall Grade Point Average and academic standing.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 104,
    code: 'UNITS',
    name: 'Certification - Earned Units',
    description: 'Official certification of academic units completed toward your degree.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 105,
    code: 'ENDORSE',
    name: 'Certification - Endorsement',
    description: 'Official university letter of endorsement for employment, OJT, or scholarships.',
    price: '80.00',
    processing_days: 3,
    is_active: true,
  },
  {
    id: 106,
    code: 'GRADES',
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

function mergeCredentialCatalog(backendList = []) {
  const overrides = getOverrides();
  const customList = getCustomTypes();
  const matchedBackendIds = new Set();

  const mergedStandard = REQUEST_FORM_CREDENTIAL_TYPES.map((def) => {
    const backendItem = matchBackendRecord(def, backendList);
    if (backendItem?.id !== undefined) {
      matchedBackendIds.add(String(backendItem.id));
    }
    const id = backendItem?.id ?? def.id;
    const localPatch = overrides[String(id)] || overrides[String(def.id)] || {};

    return {
      ...def,
      id,
      is_active: backendItem?.is_active ?? def.is_active,
      ...localPatch,
    };
  });

  const extraBackend = backendList
    .filter((b) => !matchedBackendIds.has(String(b.id)))
    .map((b) => ({
      ...b,
      ...(overrides[String(b.id)] || {}),
    }));

  const extraCustom = customList
    .filter(
      (c) =>
        !mergedStandard.some((m) => String(m.id) === String(c.id) || m.code === c.code) &&
        !extraBackend.some((b) => String(b.id) === String(c.id) || b.code === c.code)
    )
    .map((c) => ({
      ...c,
      ...(overrides[String(c.id)] || {}),
    }));

  return [...extraCustom, ...mergedStandard, ...extraBackend];
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
      const overrides = getOverrides();
      return { ...response.data, ...(overrides[String(id)] || {}) };
    } catch {
      const all = await this.list();
      return all.find((t) => String(t.id) === String(id)) || null;
    }
  },

  async create(data) {
    try {
      const response = await apiClient.post('/api/credential-types/', data);
      saveOverride(response.data.id, response.data);
      return response.data;
    } catch {
      const created = {
        id: Date.now(),
        code: data.code,
        name: data.name,
        description: data.description || '',
        price: data.price,
        processing_days: data.processing_days || 3,
        is_active: data.is_active ?? true,
      };
      saveCustomType(created);
      return created;
    }
  },

  async update(id, updates) {
    saveOverride(id, updates);
    try {
      const response = await apiClient.patch(`/api/credential-types/${id}/`, updates);
      return { ...response.data, ...updates };
    } catch {
      const all = await this.list();
      const existing = all.find((t) => String(t.id) === String(id)) || { id };
      return { ...existing, ...updates };
    }
  },

  async deactivate(id) {
    saveOverride(id, { is_active: false });
    try {
      const response = await apiClient.delete(`/api/credential-types/${id}/`);
      return response.data;
    } catch {
      return { id, is_active: false };
    }
  },
};

export default credentialTypesApi;
