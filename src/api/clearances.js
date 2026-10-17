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

export default clearancesApi;
