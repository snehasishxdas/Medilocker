/**
 * MediLocker Core Resilient API Client
 * - Dynamic URL resolution (no dead Render fallback)
 * - Stale-While-Revalidate (SWR) Client Caching (0ms perceived latency)
 * - In-flight request deduplication (SingleFlight pattern)
 * - Automatic mutation-driven cache invalidation
 * - Transparent offline queue interception
 */

import { db } from './db.js';

class ApiClient {
  constructor() {
    this.tokenKey = 'medilockerToken';
    this.sessionKey = 'medilockerSession';
    this.swrCache = new Map(); // key -> { data, timestamp, ttl, swrGrace, etag }
    this.inflight = new Map(); // key -> Promise<any>
  }

  getToken() {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  getBaseUrl() {
    if (window.MEDILOCKER_API_BASE) {
      return window.MEDILOCKER_API_BASE.replace(/\/+$/, '');
    }
    const saved = localStorage.getItem('medilockerBackendUrl');
    if (saved) {
      return saved.replace(/\/+$/, '');
    }
    // If running on localhost or 127.0.0.1, use relative URL (Vite proxy forwards /api to backend :5000)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return '';
    }
    // If accessed via LAN IP or domain, default to current origin (or port 5000 if frontend on 3000)
    if (location.port === '3000') {
      return `${location.protocol}//${location.hostname}:5000`;
    }
    return '';
  }

  formatUrl(endpoint) {
    const base = this.getBaseUrl();
    const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${clean}`;
  }

  /**
   * Invalidate client-side SWR cache by prefix or keyword
   */
  invalidate(prefix) {
    let count = 0;
    for (const key of this.swrCache.keys()) {
      if (!prefix || key.includes(prefix)) {
        this.swrCache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      console.log(`[MediLocker API Cache] Purged ${count} cached entries matching "${prefix || 'all'}"`);
    }
    // Notify window for reactive UI refreshes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('medilocker:cache-invalidated', { detail: { prefix } }));
    }
  }

  clearCache() {
    this.swrCache.clear();
    this.inflight.clear();
  }

  /**
   * Universal fetch with timeout and retry
   */
  async request(endpoint, options = {}, retries = 1) {
    const url = this.formatUrl(endpoint);
    const token = this.getToken();

    const headers = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type if body is FormData
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Check offline status for mutating requests
    const method = (options.method || 'GET').toUpperCase();
    if (!navigator.onLine && method !== 'GET') {
      console.warn(`[MediLocker API] Device is offline. Queuing ${method} ${endpoint} in IndexedDB.`);
      await db.queueSync(endpoint, method, options.body ? JSON.parse(options.body) : null);
      return {
        ok: true,
        offlineQueued: true,
        data: { message: 'Action saved locally in offline vault. Will sync automatically when reconnected.' },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/signup')) {
          localStorage.removeItem(this.tokenKey);
          localStorage.removeItem(this.sessionKey);
          if (!location.pathname.includes('login.html') && !location.pathname.includes('kiosk.html')) {
            console.warn('[MediLocker API] Session expired. Redirecting to login.');
            location.href = 'login.html';
          }
        }
      }

      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = typeof data === 'object' ? data.error || data.message || 'Request failed' : data;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      clearTimeout(timeout);
      if (retries > 0 && err.name !== 'AbortError' && method === 'GET') {
        console.warn(`[MediLocker API] Retrying ${endpoint} (${retries} attempts remaining)...`);
        await new Promise((r) => setTimeout(r, 600));
        return this.request(endpoint, options, retries - 1);
      }
      throw err;
    }
  }

  /**
   * SWR-enabled GET:
   * 1. Returns fresh cached data immediately (0ms)
   * 2. If stale within grace window, returns stale data immediately & revalidates in background
   * 3. Coalesces concurrent calls into 1 single HTTP request
   */
  async get(endpoint, options = {}) {
    const useCache = options.cache !== false;
    const ttl = options.ttl || 60000; // 60 seconds fresh TTL
    const swrGrace = options.swrGrace || 180000; // 3 minutes grace
    const cacheKey = `GET:${endpoint}`;
    const now = Date.now();

    if (useCache) {
      const cached = this.swrCache.get(cacheKey);
      if (cached) {
        const age = now - cached.timestamp;
        if (age < cached.ttl) {
          // 0ms Fresh Cache Hit
          return cached.data;
        } else if (age < cached.ttl + cached.swrGrace) {
          // SWR Hit: return stale data immediately (0ms) and revalidate quietly
          this.revalidateInBackground(endpoint, options, cacheKey, ttl, swrGrace);
          return cached.data;
        }
      }
    }

    // In-flight deduplication
    if (this.inflight.has(cacheKey)) {
      return this.inflight.get(cacheKey);
    }

    const promise = (async () => {
      try {
        const data = await this.request(endpoint, { ...options, method: 'GET' });
        if (useCache) {
          this.swrCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
            ttl,
            swrGrace,
          });
        }
        return data;
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, promise);
    return promise;
  }

  revalidateInBackground(endpoint, options, cacheKey, ttl, swrGrace) {
    if (this.inflight.has(cacheKey)) return;

    const promise = (async () => {
      try {
        const fresh = await this.request(endpoint, { ...options, method: 'GET' });
        const old = this.swrCache.get(cacheKey);
        this.swrCache.set(cacheKey, {
          data: fresh,
          timestamp: Date.now(),
          ttl,
          swrGrace,
        });

        // If data actually changed, dispatch update event
        if (JSON.stringify(old?.data) !== JSON.stringify(fresh)) {
          window.dispatchEvent(
            new CustomEvent('medilocker:swr-update', {
              detail: { endpoint, data: fresh },
            })
          );
        }
      } catch (err) {
        console.warn(`[MediLocker SWR] Background revalidation failed for ${endpoint}:`, err);
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, promise);
  }

  /**
   * Mutating calls with automated cross-module cache invalidation
   */
  async post(endpoint, body, options = {}) {
    const res = await this.request(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
    this.handleMutationInvalidation(endpoint);
    return res;
  }

  async put(endpoint, body, options = {}) {
    const res = await this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
    this.handleMutationInvalidation(endpoint);
    return res;
  }

  async patch(endpoint, body, options = {}) {
    const res = await this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
    this.handleMutationInvalidation(endpoint);
    return res;
  }

  async delete(endpoint, options = {}) {
    const res = await this.request(endpoint, { ...options, method: 'DELETE' });
    this.handleMutationInvalidation(endpoint);
    return res;
  }

  handleMutationInvalidation(endpoint) {
    if (endpoint.includes('/records') || endpoint.includes('/timeline')) {
      this.invalidate('/records');
      this.invalidate('/timeline');
      this.invalidate('/todo');
      this.invalidate('/vaidya');
    } else if (endpoint.includes('/todo')) {
      this.invalidate('/todo');
      this.invalidate('/timeline');
    } else if (endpoint.includes('/inventory')) {
      this.invalidate('/inventory');
    } else if (endpoint.includes('/auth')) {
      this.invalidate('/auth/me');
    }
  }
}

export const api = new ApiClient();

