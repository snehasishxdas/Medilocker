/**
 * MediLocker Offline-First Edge Database (IndexedDB)
 * - Complete offline persistence for rural hospital OPDs
 * - Background SyncQueue replay upon reconnection
 * - Zero external library dependency
 */

class EdgeDatabase {
  constructor() {
    this.dbName = 'medilocker_edge_vault';
    this.dbVersion = 1;
    this.db = null;
    this.initPromise = this.init();

    // Auto-replay sync queue whenever network is restored
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('⚡ [MediLocker Edge DB] Network connection detected. Processing SyncQueue...');
        this.replaySyncQueue();
      });
    }
  }

  async init() {
    if (typeof window === 'undefined' || !window.indexedDB) return null;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('vault_records')) {
          db.createObjectStore('vault_records', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('vault_todos')) {
          db.createObjectStore('vault_todos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('vault_supplies')) {
          db.createObjectStore('vault_supplies', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('kiosk_intakes')) {
          db.createObjectStore('kiosk_intakes', { keyPath: 'ticketNumber' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('[MediLocker Edge DB] Initialization error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  async getDb() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  async put(storeName, data) {
    const db = await this.getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    const db = await this.getDb();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    const db = await this.getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Queue mutating operation when offline
   */
  async queueSync(endpoint, method, payload) {
    return this.put('sync_queue', {
      endpoint,
      method,
      payload,
      queuedAt: new Date().toISOString(),
    });
  }

  /**
   * Replay all pending offline operations
   */
  async replaySyncQueue() {
    const items = await this.getAll('sync_queue');
    if (!items || items.length === 0) return;

    console.log(`[MediLocker Edge DB] Replaying ${items.length} queued offline actions...`);

    for (const item of items) {
      try {
        const token = localStorage.getItem('medilockerToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const base = (window.MEDILOCKER_API_BASE || '').replace(/\/+$/, '');
        const res = await fetch(`${base}${item.endpoint.startsWith('/') ? item.endpoint : '/' + item.endpoint}`, {
          method: item.method,
          headers,
          body: item.payload ? JSON.stringify(item.payload) : undefined,
        });

        if (res.ok) {
          await this.delete('sync_queue', item.id);
          console.log(`[MediLocker Edge DB] Replayed sync item: ${item.method} ${item.endpoint}`);
        }
      } catch (err) {
        console.warn(`[MediLocker Edge DB] Sync retry failed for ${item.endpoint}:`, err);
        break; // Network dropped again, wait for next online event
      }
    }
  }
}

export const db = new EdgeDatabase();
