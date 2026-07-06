// services/api/client.ts
// Professional API client with caching, retry logic, error handling

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in ms
}

/**
 * API Configuration
 */
const API_CONFIG = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  CACHE_TTL_DEFAULT: 5 * 60 * 1000, // 5 minutes
  CACHE_TTL_SHORT: 1 * 60 * 1000,   // 1 minute
  CACHE_TTL_LONG: 30 * 60 * 1000,   // 30 minutes
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
};

/**
 * Options for a fetch call
 */
interface FetchOptions {
  params?: any;
  cache?: boolean;
  cacheTTL?: number;
  useCache?: boolean;
  skipCache?: boolean;
}

/**
 * Professional API Client Class
 * - Request caching (in-memory)
 * - Automatic retry logic with exponential backoff
 * - Request deduplication (avoids duplicate in-flight requests)
 * - Centralized error handling
 *
 * NOTE: `fetch<T>()` below is a generic wrapper skeleton. In practice,
 * prefer calling `apiClient.getSupabase()` directly for real Supabase
 * queries (`.from('table').select()...`), and use `apiClient.fetch()`
 * only when you want the caching/retry/dedup behavior wrapped around
 * a custom async function (see `fetchWrapped` below for that use case).
 */
export class ApiClient {
  private supabase: SupabaseClient;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    this.supabase = createClient(
      API_CONFIG.SUPABASE_URL,
      API_CONFIG.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      }
    );
  }

  /**
   * Get Supabase client (use this for actual queries)
   */
  getSupabase(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Cache key generator
   */
  private getCacheKey(method: string, endpoint: string, params?: any): string {
    return `${method}:${endpoint}:${JSON.stringify(params || {})}`;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return now - entry.timestamp < entry.ttl;
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (this.isCacheValid(entry)) {
      return entry.data;
    }

    // Expired cache
    this.cache.delete(key);
    return null;
  }

  /**
   * Set in cache
   */
  private setInCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache entries matching a pattern (e.g. table name)
   */
  invalidateCache(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Wrap ANY async function with caching + retry + deduplication.
   * This is the recommended way to use the caching layer with real
   * Supabase calls.
   *
   * @example
   * const products = await apiClient.fetchWrapped(
   *   'products:list',
   *   () => apiClient.getSupabase().from('products').select('*').then(r => r.data),
   *   { cacheTTL: 10 * 60 * 1000 }
   * );
   */
  async fetchWrapped<T>(
    cacheKey: string,
    fn: () => Promise<T>,
    options?: Omit<FetchOptions, 'params'>
  ): Promise<T> {
    // Check cache first
    if (options?.useCache !== false && !options?.skipCache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        console.log(`[API] Cache hit: ${cacheKey}`);
        return cached;
      }
    }

    // Return pending request if one is already in-flight (deduplication)
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    const promise = this.executeWithRetry<T>(fn);
    this.pendingRequests.set(cacheKey, promise);

    try {
      const result = await promise;

      if (options?.cache !== false) {
        const ttl = options?.cacheTTL || API_CONFIG.CACHE_TTL_DEFAULT;
        this.setInCache(cacheKey, result, ttl);
      }

      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Generic fetch placeholder - kept for API symmetry.
   * Prefer `fetchWrapped` with a real Supabase call, or call
   * `getSupabase()` directly for one-off queries without caching.
   */
  async fetch<T>(
    method: string,
    endpoint: string,
    options?: FetchOptions
  ): Promise<T> {
    const cacheKey = this.getCacheKey(method, endpoint, options?.params);

    return this.fetchWrapped<T>(
      cacheKey,
      async () => {
        throw new Error(
          `[API] Generic fetch() not implemented for ${method} ${endpoint}. ` +
          `Use fetchWrapped() with a real Supabase query, or call getSupabase() directly.`
        );
      },
      options
    );
  }

  /**
   * Execute with retry logic (exponential backoff)
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt >= API_CONFIG.RETRY_ATTEMPTS - 1;
      const isRetryable = this.isRetryableError(error);

      if (isRetryable && !isLastAttempt) {
        const delay = API_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`[API] Retrying in ${delay}ms... (attempt ${attempt + 2}/${API_CONFIG.RETRY_ATTEMPTS})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry<T>(fn, attempt + 1);
      }

      throw this.handleError(error);
    }
  }

  /**
   * Check if error is retryable (network issues, rate limits, server errors)
   */
  private isRetryableError(error: any): boolean {
    const retryableStatus = [408, 429, 500, 502, 503, 504];
    return (
      (error?.status && retryableStatus.includes(error.status)) ||
      error?.message?.includes('network') ||
      error?.message?.includes('timeout') ||
      error?.message?.includes('fetch failed')
    );
  }

  /**
   * Handle API errors - normalize into a proper Error object
   */
  private handleError(error: any): Error {
    console.error('[API] Error:', error);

    if (error instanceof Error) {
      return error;
    }

    if (error?.message) {
      return new Error(error.message);
    }

    return new Error('An unknown API error occurred');
  }
}

// Singleton instance - import this everywhere
export const apiClient = new ApiClient();

export default apiClient;