import { logger } from './logger';
import { env } from '../config/env';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;     // Soft TTL: when data is considered stale
  staleUntil: number;    // Hard TTL: when data must be evicted entirely
  etag: string;          // ETag hash for 304 Not Modified responses
}

interface CacheOptions {
  ttlSeconds?: number;       // Soft TTL (default 300s)
  swrGraceSeconds?: number;  // SWR grace window (default 120s)
}

export class CacheService {
  private store: Map<string, CacheEntry> = new Map();
  private redisClient: Redis | null = null;
  private maxEntries = 10000;
  private inflightPromises: Map<string, Promise<any>> = new Map();

  constructor() {
    // Initialize Upstash Redis if credentials exist
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        this.redisClient = new Redis({
          url: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN,
        });
        logger.info('⚡ Upstash Redis remote cache layer initialized successfully.');
      } catch (err: any) {
        logger.warn('Failed to initialize Redis client. Falling back to in-memory cache.', { error: err.message });
      }
    }

    // Periodic sweep of expired items every 60 seconds
    const cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }

  private generateEtag(data: any): string {
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      return `"${crypto.createHash('md5').update(str).digest('hex').slice(0, 16)}"`;
    } catch {
      return `"${Date.now()}"`;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.staleUntil > 0 && entry.staleUntil <= now) {
        this.store.delete(key);
        expiredCount++;
      }
    }
    if (expiredCount > 0) {
      logger.debug(`🧹 Cache cleanup sweep removed ${expiredCount} expired items.`);
    }
  }

  /**
   * Get cached value by key:
   * 1. Check L1 in-memory cache (0ms latency)
   * 2. Fall back to L2 Upstash Redis cloud cache and hydrate L1
   */
  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (entry) {
      if (entry.staleUntil > 0 && entry.staleUntil <= now) {
        this.store.delete(key);
      } else {
        logger.debug(`🎯 L1 In-memory cache HIT: [${key}]`);
        return entry.value as T;
      }
    }

    // Fallback to L2 Upstash Redis
    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get<any>(key);
        if (raw !== null && raw !== undefined) {
          logger.debug(`⚡ L2 Redis remote cache HIT: [${key}]`);
          const val: T = typeof raw === 'string' ? JSON.parse(raw) : raw;
          // Hydrate L1 in-memory for 3 minutes
          const etag = this.generateEtag(val);
          this.store.set(key, {
            value: val,
            expiresAt: now + 180000,
            staleUntil: now + 300000,
            etag,
          });
          return val;
        }
      } catch (err: any) {
        logger.warn(`Redis get error on [${key}]`, { error: err.message });
      }
    }

    return null;
  }

  /**
   * Set cached value with TTL and SWR grace window
   */
  set<T = any>(key: string, value: T, ttlSeconds: number = 300, swrGraceSeconds: number = 120): void {
    // Enforce memory bounds
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    const now = Date.now();
    const expiresAt = ttlSeconds > 0 ? now + ttlSeconds * 1000 : 0;
    const staleUntil = ttlSeconds > 0 ? now + (ttlSeconds + swrGraceSeconds) * 1000 : 0;
    const etag = this.generateEtag(value);

    this.store.set(key, { value, expiresAt, staleUntil, etag });
    logger.debug(`💾 Cache SET: [${key}] (TTL: ${ttlSeconds}s, SWR Grace: ${swrGraceSeconds}s)`);

    // Async sync to Redis
    if (this.redisClient && ttlSeconds > 0) {
      this.redisClient
        .set(key, JSON.stringify(value), { ex: ttlSeconds + swrGraceSeconds })
        .catch((err) => {
          logger.warn(`Redis sync failed for key ${key}`, { error: err.message });
        });
    }
  }

  /**
   * SingleFlight + Stale-While-Revalidate (SWR) Engine:
   * - If fresh in cache: return immediately (0ms)
   * - If stale in cache: return immediately (0ms) and trigger background re-fetch
   * - If cache miss: coalesce concurrent callers onto 1 single in-flight computation
   */
  async fetchOrCompute<T = any>(
    key: string,
    computeFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<{ data: T; isHit: boolean; isStale: boolean; etag: string }> {
    const ttl = options.ttlSeconds ?? 300;
    const swrGrace = options.swrGraceSeconds ?? 120;
    const now = Date.now();

    // 1. Check L1 memory
    const entry = this.store.get(key);
    if (entry) {
      const isFresh = entry.expiresAt === 0 || entry.expiresAt > now;
      const isWithinSWR = entry.staleUntil === 0 || entry.staleUntil > now;

      if (isFresh) {
        return { data: entry.value, isHit: true, isStale: false, etag: entry.etag };
      }

      if (isWithinSWR) {
        // Return stale data immediately (0ms) and recompute asynchronously in background
        logger.debug(`🔄 SWR Hit for [${key}]. Returning stale value and revalidating in background.`);
        this.runBackgroundRecompute(key, computeFn, ttl, swrGrace);
        return { data: entry.value, isHit: true, isStale: true, etag: entry.etag };
      }
    }

    // 2. Check L2 Redis
    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get<any>(key);
        if (raw !== null && raw !== undefined) {
          const val: T = typeof raw === 'string' ? JSON.parse(raw) : raw;
          const etag = this.generateEtag(val);
          this.store.set(key, {
            value: val,
            expiresAt: now + ttl * 1000,
            staleUntil: now + (ttl + swrGrace) * 1000,
            etag,
          });
          return { data: val, isHit: true, isStale: false, etag };
        }
      } catch (err: any) {
        logger.warn(`Redis fetch error on [${key}]`, { error: err.message });
      }
    }

    // 3. Cache Miss: Coalesce in-flight requests (SingleFlight pattern)
    if (this.inflightPromises.has(key)) {
      logger.debug(`🔀 Coalescing concurrent request on [${key}]`);
      const data = await this.inflightPromises.get(key);
      const etag = this.generateEtag(data);
      return { data, isHit: false, isStale: false, etag };
    }

    // Initiate computation
    const computePromise = (async () => {
      try {
        const result = await computeFn();
        this.set(key, result, ttl, swrGrace);
        return result;
      } finally {
        this.inflightPromises.delete(key);
      }
    })();

    this.inflightPromises.set(key, computePromise);
    const data = await computePromise;
    const etag = this.generateEtag(data);
    return { data, isHit: false, isStale: false, etag };
  }

  private runBackgroundRecompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl: number,
    swrGrace: number
  ): void {
    if (this.inflightPromises.has(key)) return;

    const promise = (async () => {
      try {
        const fresh = await computeFn();
        this.set(key, fresh, ttl, swrGrace);
        logger.debug(`✓ SWR background revalidation complete for [${key}]`);
      } catch (err: any) {
        logger.warn(`SWR background revalidation failed for [${key}]`, { error: err.message });
      } finally {
        this.inflightPromises.delete(key);
      }
    })();

    this.inflightPromises.set(key, promise);
  }

  /**
   * Delete cached key across L1 and L2 Redis
   */
  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.inflightPromises.delete(key);
    if (this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err: any) {
        logger.warn(`Redis del error on [${key}]`, { error: err.message });
      }
    }
    logger.debug(`🗑 Cache DEL: [${key}]`);
  }

  /**
   * Invalidate all keys matching a prefix across L1 in-memory AND L2 Upstash Redis
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    let count = 0;
    // 1. Purge from L1 in-memory cache
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        this.inflightPromises.delete(key);
        count++;
      }
    }

    // 2. Purge from L2 Upstash Redis (Prevents stale Redis entries re-hydrating L1)
    if (this.redisClient) {
      try {
        const matchingKeys = await this.redisClient.keys(`${prefix}*`);
        if (matchingKeys && matchingKeys.length > 0) {
          await this.redisClient.del(...matchingKeys);
          count += matchingKeys.length;
        }
      } catch (err: any) {
        logger.warn(`Redis invalidatePrefix error on [${prefix}]`, { error: err.message });
      }
    }

    logger.debug(`🧹 Invalidated ${count} cache keys across L1/L2 with prefix: [${prefix}]`);
  }

  /**
   * Invalidate all cached data for a user across all modules
   */
  async invalidateUserAll(userId: string, unitId?: string): Promise<void> {
    await Promise.allSettled([
      this.invalidatePrefix(`records:${userId}`),
      this.invalidatePrefix(`timeline:${userId}`),
      this.invalidatePrefix(`todo:today:${userId}`),
      this.invalidatePrefix(`inventory:${userId}`),
      this.invalidatePrefix(`user:profile:${userId}`),
      this.invalidatePrefix(`triage:${userId}`),
      this.invalidatePrefix(`vaidya:${userId}`),
      unitId ? this.invalidatePrefix(`user:unit:${unitId.toUpperCase()}`) : Promise.resolve(),
      unitId ? this.invalidatePrefix(`patient:search:${unitId.toUpperCase()}`) : Promise.resolve(),
    ]);
    logger.info(`🔄 Flushed all L1 & L2 caches for user: ${userId}`);
  }

  async getUserProfile<T = any>(userId: string): Promise<T | null> {
    return this.get<T>(`user:profile:${userId}`);
  }

  setUserProfile<T = any>(userId: string, data: T, ttlSeconds: number = 300): void {
    this.set(`user:profile:${userId}`, data, ttlSeconds);
  }

  invalidateUserProfile(userId: string): void {
    this.del(`user:profile:${userId}`);
  }

  /**
   * User Lookup by Unit ID (Cached for 10 minutes)
   */
  async getUserByUnit<T = any>(unitId: string): Promise<T | null> {
    return this.get<T>(`user:unit:${unitId.toUpperCase()}`);
  }

  setUserByUnit<T = any>(unitId: string, data: T, ttlSeconds: number = 600): void {
    this.set(`user:unit:${unitId.toUpperCase()}`, data, ttlSeconds);
  }

  invalidateUserByUnit(unitId: string): void {
    this.del(`user:unit:${unitId.toUpperCase()}`);
  }
}

export const cacheService = new CacheService();

