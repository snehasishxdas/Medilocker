/**
 * MediLocker Reactive State Store
 * - 0ms perceived latency via optimistic UI updates
 * - Instant persistent hydration from cache / localStorage
 * - Microtask-batched pub/sub notifications to prevent UI thrashing
 * - Automatic synchronization with ApiClient SWR updates
 */

import { db } from './db.js';

class StateStore {
  constructor() {
    this.state = {
      user: this.loadPersisted('user', null),
      records: this.loadPersisted('records', []),
      timeline: this.loadPersisted('timeline', []),
      todos: this.loadPersisted('todos', []),
      inventory: this.loadPersisted('inventory', []),
      vitals: {},
      feelingLogs: [],
      kioskQueue: [],
      activeDialect: 'Hindi / Bhojpuri',
    };
    this.subscribers = new Map(); // key -> Set of callbacks
    this.pendingNotifications = new Set();
    this.isFlushing = false;

    // Listen to background SWR updates from ApiClient
    if (typeof window !== 'undefined') {
      window.addEventListener('medilocker:swr-update', (e) => {
        this.handleSwrUpdate(e.detail);
      });
    }
  }

  loadPersisted(key, defaultVal) {
    try {
      const raw = localStorage.getItem(`medilocker_store_${key}`);
      return raw ? JSON.parse(raw) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  savePersisted(key, value) {
    try {
      if (['user', 'records', 'timeline', 'todos', 'inventory'].includes(key)) {
        localStorage.setItem(`medilocker_store_${key}`, JSON.stringify(value));
      }
    } catch (_) {}
  }

  get(key) {
    return this.state[key];
  }

  set(key, value, notify = true) {
    // Diff check to avoid redundant re-renders
    const currentStr = JSON.stringify(this.state[key]);
    const nextStr = JSON.stringify(value);
    if (currentStr === nextStr) return;

    this.state[key] = value;
    this.savePersisted(key, value);

    if (notify) {
      this.queueNotification(key);
    }
  }

  queueNotification(key) {
    this.pendingNotifications.add(key);
    if (!this.isFlushing) {
      this.isFlushing = true;
      queueMicrotask(() => {
        this.flushNotifications();
      });
    }
  }

  flushNotifications() {
    const keysToNotify = Array.from(this.pendingNotifications);
    this.pendingNotifications.clear();
    this.isFlushing = false;

    for (const key of keysToNotify) {
      this.notify(key, this.state[key]);
    }
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);

    // Immediate callback with current state if exists
    if (this.state[key] !== undefined) {
      try {
        callback(this.state[key]);
      } catch (err) {
        console.error(`[MediLocker Store] Subscriber error for ${key}:`, err);
      }
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  notify(key, value) {
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(value);
        } catch (err) {
          console.error(`[MediLocker Store] Notification error for ${key}:`, err);
        }
      });
    }
  }

  /**
   * Optimistic update helper: applies change locally immediately,
   * invokes remote async call, and rolls back if the server fails.
   */
  async optimisticUpdate(key, updaterFn, remotePromiseFn) {
    const previous = JSON.parse(JSON.stringify(this.state[key] ?? null));
    const next = updaterFn(this.state[key]);
    this.set(key, next, true);

    try {
      const result = await remotePromiseFn();
      return result;
    } catch (err) {
      console.warn(`[MediLocker Store] Optimistic update failed on ${key}, rolling back:`, err);
      this.set(key, previous, true);
      throw err;
    }
  }

  handleSwrUpdate(detail) {
    if (!detail) return;
    const { endpoint, data } = detail;
    if (endpoint.includes('/todo/today')) {
      const tasks = data?.data?.tasks || data?.tasks || [];
      this.set('todos', tasks, true);
    } else if (endpoint.includes('/records')) {
      const list = data?.data || data || [];
      this.set('records', list, true);
    } else if (endpoint.includes('/timeline')) {
      const timeline = data?.data?.timeline || data?.timeline || [];
      this.set('timeline', timeline, true);
    } else if (endpoint.includes('/inventory/home-supplies')) {
      const inv = data?.data || data || [];
      this.set('inventory', inv, true);
    }
  }
}

export const store = new StateStore();

