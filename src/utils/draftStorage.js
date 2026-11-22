/**
 * draftStorage.js
 * Persistent draft storage for uploaded clearance & photo files in IndexedDB.
 * Survives page reloads, tab navigation, and avoids sessionStorage 5MB quota exhaustion.
 */

const DB_NAME = 'regquest_draft_db';
const DB_VERSION = 1;
const STORE_NAME = 'draft_files';

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
      console.warn('IndexedDB open error:', request.error);
      resolve(null);
    };
  });
}

/**
 * Convert a Base64 data URL to a standard browser File object.
 */
export function dataURLtoFile(dataurl, filename = 'document') {
  if (!dataurl || typeof dataurl !== 'string' || !dataurl.includes(',')) return null;
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (err) {
    console.warn('Failed to convert dataURL to File:', err);
    return null;
  }
}

/**
 * Save an uploaded draft file (data URL + metadata) to IndexedDB.
 */
export async function saveDraftFile(userId, fileKey, filePayload) {
  if (!userId || !fileKey) return;
  const db = await openDB();
  if (!db) {
    // Fallback to sessionStorage if IndexedDB is not available
    try {
      sessionStorage.setItem(`regquest_file_${userId}_${fileKey}`, JSON.stringify(filePayload));
    } catch {}
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: `${userId}_${fileKey}`,
        userId,
        fileKey,
        ...filePayload,
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      console.warn('Error saving draft file to IndexedDB:', e);
      resolve(false);
    }
  });
}

/**
 * Retrieve a draft file (data URL + metadata) from IndexedDB.
 */
export async function getDraftFile(userId, fileKey) {
  if (!userId || !fileKey) return null;
  const db = await openDB();
  if (!db) {
    try {
      const item = sessionStorage.getItem(`regquest_file_${userId}_${fileKey}`);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`${userId}_${fileKey}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      console.warn('Error reading draft file from IndexedDB:', e);
      resolve(null);
    }
  });
}

/**
 * Delete a specific draft file or all draft files for a given user.
 */
export async function clearDraftFiles(userId, fileKey = null) {
  if (!userId) return;
  // Clear any fallback sessionStorage items
  try {
    if (fileKey) {
      sessionStorage.removeItem(`regquest_file_${userId}_${fileKey}`);
    } else {
      sessionStorage.removeItem(`regquest_file_${userId}_clearance`);
      sessionStorage.removeItem(`regquest_file_${userId}_photo`);
    }
  } catch {}

  const db = await openDB();
  if (!db) return;
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
            if (cursor.value.userId === userId) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      console.warn('Error clearing draft files from IndexedDB:', e);
      resolve(false);
    }
  });
}
