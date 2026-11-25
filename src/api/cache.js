import { jwtDecode } from 'jwt-decode';

/**
 * Returns the current authenticated user's ID and role as a scope string.
 * Used to isolate in-memory cache and in-flight requests strictly per user & role.
 */
export function getAuthScope() {
  if (typeof window === 'undefined') return 'anon';
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return 'anon';
    const decoded = jwtDecode(token);
    const uid = decoded.user_id || decoded.id || 'anon';
    const role = String(decoded.role || '').toLowerCase();
    return `${uid}:${role}`;
  } catch {
    return 'anon';
  }
}

/**
 * Validates whether a response is a genuine successful backend payload
 * and NOT an error, empty fallback, or service unavailable object.
 */
export function isNonFallbackSuccessResponse(response, url = '') {
  if (!response) return false;

  const status = Number(response.status);
  if (isNaN(status) || status < 200 || status >= 300) {
    return false;
  }

  const data = response.data !== undefined ? response.data : response;
  if (data === null || data === undefined) {
    return false;
  }

  // Check object payloads for error / fallback flags
  if (typeof data === 'object') {
    if (data.status === 'error' || data.status === 'failed') {
      return false;
    }
    if (typeof data.detail === 'string') {
      const lower = data.detail.toLowerCase();
      if (
        lower.includes('unavailable') ||
        lower.includes('error') ||
        lower.includes('not found') ||
        lower.includes('permission') ||
        lower.includes('unauthorized') ||
        lower.includes('authentication')
      ) {
        return false;
      }
    }
    if (data.error || data.errors) {
      return false;
    }

    // Specific ML Forecast validation: daily forecast must have status === 'success' and non-empty forecast array
    const requestUrl = String(url || response.config?.url || '');
    if (requestUrl.includes('/forecast/daily')) {
      if (data.status !== 'success' || !Array.isArray(data.forecast) || data.forecast.length === 0) {
        return false;
      }
    }
    if (requestUrl.includes('/forecast/monthly-workload')) {
      if (data.status !== 'success') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Lightweight in-memory Stale-While-Revalidate (SWR) cache & in-flight request deduplicator.
 * - Enforces strict per-user/role key scoping to prevent cross-account/cross-role cache leaks.
 * - Disallows caching error, unauthorized, or empty-fallback responses.
 * - Deduplicates simultaneous identical API calls so only 1 network request is dispatched.
 */
class ApiCache {
  constructor() {
    this.cache = new Map();
    this.inFlight = new Map();
  }

  generateKey(method, url, params, scope = null) {
    const authScope = scope || getAuthScope();
    const cleanMethod = String(method || 'GET').toUpperCase();
    let cleanUrl = String(url || '');
    let paramStr = '';
    if (params) {
      if (typeof params === 'string') {
        paramStr = params;
      } else if (params instanceof URLSearchParams) {
        paramStr = params.toString();
      } else if (typeof params === 'object') {
        const sortedKeys = Object.keys(params).sort();
        paramStr = sortedKeys
          .filter((k) => params[k] !== undefined && params[k] !== null)
          .map((k) => `${k}=${params[k]}`)
          .join('&');
      }
    }
    return `${authScope}:${cleanMethod}:${cleanUrl}${paramStr ? `?${paramStr}` : ''}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  getEntry(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(key, data, ttlMs = 5 * 60 * 1000) {
    if (data === undefined || data === null) {
      this.cache.delete(key);
      return;
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  invalidate(urlPattern) {
    if (!urlPattern) {
      this.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(urlPattern)) {
        this.cache.delete(key);
      }
    }
    for (const key of this.inFlight.keys()) {
      if (key.includes(urlPattern)) {
        this.inFlight.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.inFlight.clear();
  }

  deduplicate(key, fetcher) {
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }
    const promise = (async () => {
      try {
        const res = await fetcher();
        return res;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return promise;
  }
}

export const apiCache = new ApiCache();
export default apiCache;
