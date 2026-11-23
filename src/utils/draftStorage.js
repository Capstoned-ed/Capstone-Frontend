/**
 * draftStorage.js
 * Persistent draft storage for uploaded clearance & photo files in IndexedDB.
 * Survives page reloads, tab navigation, and avoids sessionStorage 5MB quota exhaustion.
 *
 * Security Hardening:
 * 1. Strict MIME-type allowlist (image/jpeg, image/png, image/webp, application/pdf).
 * 2. Strict file size cap (max 10MB) before storage or reconstruction.
 * 3. Sanitized filename characters to prevent path traversal/injection.
 * 4. Complete wipe of IndexedDB records and storage keys on user logout.
 */

const DB_NAME = 'regquest_draft_db';
const DB_VERSION = 1;
const STORE_NAME = 'draft_files';

export const ALLOWED_DRAFT_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const MAX_DRAFT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Validates whether a given MIME type is strictly allowed.
 */
export function isAllowedMimeType(mime) {
  if (!mime || typeof mime !== 'string') return false;
  return ALLOWED_DRAFT_MIME_TYPES.includes(mime.trim().toLowerCase());
}

/**
 * Extracts the MIME type from a Base64 data URL.
 */
export function extractDataUrlMime(dataurl) {
  if (!dataurl || typeof dataurl !== 'string' || !dataurl.startsWith('data:')) return null;
  const match = dataurl.slice(0, 100).match(/^data:([^;]+);/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Estimates byte size of a Base64 data URL without full memory decode.
 */
export function estimateDataUrlSize(dataurl) {
  if (!dataurl || typeof dataurl !== 'string') return 0;
  const commaIdx = dataurl.indexOf(',');
  if (commaIdx === -1) return 0;
  const b64 = dataurl.slice(commaIdx + 1);
  return Math.round((b64.length * 3) / 4);
}

function openDB() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[draftStorage] IndexedDB open error:', request.error);
      resolve(null);
    };
  });
}

/**
 * Convert a Base64 data URL to a standard browser File object with strict MIME & size validation.
 */
export function dataURLtoFile(dataurl, filename = 'document') {
  if (!dataurl || typeof dataurl !== 'string' || !dataurl.includes(',')) return null;

  const mime = extractDataUrlMime(dataurl) || 'application/octet-stream';
  if (!isAllowedMimeType(mime)) {
    console.warn(`[draftStorage] Disallowed MIME type rejected: "${mime}".`);
    return null;
  }

  const estSize = estimateDataUrlSize(dataurl);
  if (estSize > MAX_DRAFT_FILE_SIZE_BYTES) {
    console.warn(`[draftStorage] Draft file size (${estSize} bytes) exceeds 10MB limit.`);
    return null;
  }

  try {
    const arr = dataurl.split(',');
    const bstr = atob(arr[1]);
    let n = bstr.length;
    if (n > MAX_DRAFT_FILE_SIZE_BYTES) {
      console.warn('[draftStorage] Decoded file length exceeds 10MB limit.');
      return null;
    }
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const safeFilename = String(filename || 'document')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
    return new File([u8arr], safeFilename, { type: mime });
  } catch (err) {
    console.warn('[draftStorage] Failed to convert dataURL to File:', err);
    return null;
  }
}

/**
 * Save an uploaded draft file (data URL + metadata) to IndexedDB with strict MIME & size validation.
 */
export async function saveDraftFile(userId, fileKey, filePayload) {
  if (!userId || !fileKey || !filePayload) return false;

  const dataUrl = filePayload.fileDataUrl;
  if (!dataUrl || typeof dataUrl !== 'string') return false;

  const mime = extractDataUrlMime(dataUrl) || (filePayload.type ? String(filePayload.type).toLowerCase() : null);
  if (!isAllowedMimeType(mime)) {
    console.warn(`[draftStorage] saveDraftFile: Rejected disallowed MIME type "${mime}".`);
    return false;
  }

  const estSize = estimateDataUrlSize(dataUrl);
  if (estSize > MAX_DRAFT_FILE_SIZE_BYTES) {
    console.warn(`[draftStorage] saveDraftFile: File size (${estSize} bytes) exceeds 10MB limit.`);
    return false;
  }

  const safeFilename = filePayload.name
    ? String(filePayload.name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    : `${fileKey}_draft`;

  const sanitizedPayload = {
    ...filePayload,
    name: safeFilename,
    type: mime,
    size: estSize,
  };

  const db = await openDB();
  if (!db) {
    try {
      sessionStorage.setItem(`regquest_file_${userId}_${fileKey}`, JSON.stringify(sanitizedPayload));
      return true;
    } catch {
      return false;
    }
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: `${userId}_${fileKey}`,
        userId: String(userId),
        fileKey: String(fileKey),
        ...sanitizedPayload,
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      console.warn('[draftStorage] Error saving draft file to IndexedDB:', e);
      resolve(false);
    }
  });
}

/**
 * Retrieve a draft file (data URL + metadata) from IndexedDB with validation.
 */
export async function getDraftFile(userId, fileKey) {
  if (!userId || !fileKey) return null;
  const db = await openDB();
  let record = null;
  if (!db) {
    try {
      const item = sessionStorage.getItem(`regquest_file_${userId}_${fileKey}`);
      record = item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  } else {
    record = await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(`${userId}_${fileKey}`);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        console.warn('[draftStorage] Error reading draft file from IndexedDB:', e);
        resolve(null);
      }
    });
  }

  if (!record || !record.fileDataUrl) return null;

  // Validate integrity and MIME allowlist upon retrieval
  const mime = extractDataUrlMime(record.fileDataUrl) || record.type;
  if (!isAllowedMimeType(mime)) {
    console.warn(`[draftStorage] Discarded retrieved draft with invalid MIME type: ${mime}`);
    await clearDraftFiles(userId, fileKey);
    return null;
  }

  const estSize = estimateDataUrlSize(record.fileDataUrl);
  if (estSize > MAX_DRAFT_FILE_SIZE_BYTES) {
    console.warn('[draftStorage] Discarded retrieved draft exceeding 10MB limit.');
    await clearDraftFiles(userId, fileKey);
    return null;
  }

  return record;
}

/**
 * Downscale and compress an image file using an offscreen HTML5 canvas.
 * Reduces 6-10MB mobile phone camera photos down to ~250-400KB to prevent mobile Out-of-Memory crashes.
 *
 * @param {File} file - Source File object.
 * @param {Object} [options]
 * @param {number} [options.maxDimension=1600] - Max width or height in pixels.
 * @param {number} [options.quality=0.82] - JPEG/WebP compression quality (0.0 to 1.0).
 * @returns {Promise<File>} Compressed File object.
 */
export async function compressImageFile(file, { maxDimension = 1600, quality = 0.82 } = {}) {
  if (!file || typeof window === 'undefined' || !file.type || !file.type.startsWith('image/')) {
    return file;
  }
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    let objectUrl = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      resolve(file);
      return;
    }

    const img = new Image();

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
        objectUrl = null;
      }
    };

    img.onload = () => {
      try {
        let { width, height } = img;
        const needsDownscale = width > maxDimension || height > maxDimension;

        if (needsDownscale) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        } else if (file.size <= 400 * 1024) {
          // Already within 1600px and lightweight
          cleanup();
          resolve(file);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(file);
          return;
        }

        // Fill white background for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const isWebp = file.type === 'image/webp';
        const targetMime = isWebp ? 'image/webp' : 'image/jpeg';
        const extension = isWebp ? '.webp' : '.jpg';

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              resolve(file);
              return;
            }

            if (blob.size >= file.size && !needsDownscale) {
              resolve(file);
              return;
            }

            const rawBaseName = (file.name || 'document').replace(/\.[^/.]+$/, '');
            const safeBaseName = rawBaseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
            const compressedFilename = `${safeBaseName}${extension}`;

            const compressedFile = new File([blob], compressedFilename, {
              type: targetMime,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          targetMime,
          quality
        );
      } catch (err) {
        cleanup();
        console.warn('[draftStorage] Image compression error, using original file:', err);
        resolve(file);
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Delete a specific draft file or all draft files for a given user.
 */
export async function clearDraftFiles(userId = null, fileKey = null) {
  if (!userId) {
    return clearAllDraftStorage();
  }

  try {
    if (fileKey) {
      sessionStorage.removeItem(`regquest_file_${userId}_${fileKey}`);
      sessionStorage.removeItem(`regquest_draft_${userId}_${fileKey}`);
    } else {
      sessionStorage.removeItem(`regquest_file_${userId}_clearance`);
      sessionStorage.removeItem(`regquest_file_${userId}_photo`);
      sessionStorage.removeItem(`regquest_request_draft_${userId}`);

      // Thoroughly clear any user-scoped draft keys from sessionStorage
      const userPrefixes = [
        `regquest_file_${userId}`,
        `regquest_draft_${userId}`,
        `regquest_request_draft_${userId}`,
      ];
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && userPrefixes.some((p) => k.startsWith(p))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    }
  } catch {}

  const db = await openDB();
  if (!db) return true;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (fileKey) {
        store.delete(`${userId}_${fileKey}`);
      } else {
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (String(cursor.value.userId) === String(userId)) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      console.warn('[draftStorage] Error clearing draft files from IndexedDB:', e);
      resolve(false);
    }
  });
}

/**
 * Purge all draft files from IndexedDB and all draft keys from sessionStorage
 * for a specific user. Call upon successful request submission so subsequent
 * requests start with a fresh, un-prefilled form.
 */
export async function clearDraftStorage(userId) {
  if (!userId) {
    return clearAllDraftStorage();
  }
  return clearDraftFiles(userId);
}

/**
 * Completely wipe all draft files from IndexedDB and all draft keys
 * from localStorage and sessionStorage. Essential on logout so sensitive
 * clearance/ID images never remain on shared or public computers.
 */
export async function clearAllDraftStorage() {
  // 1. Wipe all IndexedDB draft entries
  try {
    const db = await openDB();
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }
  } catch (err) {
    console.warn('[draftStorage] Failed to clear IndexedDB draft store:', err);
  }

  // 2. Wipe all draft keys from sessionStorage and localStorage
  const wipeDraftKeys = (storage) => {
    if (!storage) return;
    try {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (
          k &&
          (k.startsWith('regquest_draft_') ||
           k.startsWith('regquest_request_draft_') ||
           k.startsWith('regquest_file_'))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k));
    } catch {}
  };

  wipeDraftKeys(sessionStorage);
  wipeDraftKeys(localStorage);
}
