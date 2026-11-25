/**
 * Lightweight in-memory Stale-While-Revalidate (SWR) cache & in-flight request deduplicator.
 * - Enables 0ms instant page loads when navigating between previously visited views.
 * - Deduplicates simultaneous identical API calls (e.g. multiple components requesting
 *   notifications or credential types on mount) so only 1 network request is dispatched.
 */

class ApiCache {
  constructor() {
    this.cache = new Map();
    this.inFlight = new Map();
  }

  generateKey(method, url, params) {
    const cleanMethod = String(method || 'GET').toUpperCase();
    let paramStr = '';
    if (params) {
      if (typeof params === 'string') {
        paramStr = params;
      } else if (params instanceof URLSearchParams) {
        paramStr = params.toString();
      } else if (typeof params === 'object') {
        const sortedKeys = Object.keys(params).sort();
        paramStr = sortedKeys
          .map((k) => `${k}=${params[k] !== undefined && params[k] !== null ? params[k] : ''}`)
          .join('&');
      }
    }
    return `${cleanMethod}:${url}${paramStr ? `?${paramStr}` : ''}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return entry.data;
  }

  getEntry(key) {
    return this.cache.get(key) || null;
  }

  set(key, data, ttlMs = 5 * 60 * 1000) {
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
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(urlPattern)) {
        this.cache.delete(key);
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

