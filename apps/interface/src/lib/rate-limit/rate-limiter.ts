/**
 * Rate limiter — Issue #675
 *
 * IP- and token-based sliding-window rate limiting for Next.js API routes.
 * Uses an in-process LRU map; swap for Redis in production.
 */

export interface RateLimitOptions {
  /** Window size in milliseconds */
  windowMs: number;
  /** Max requests per window */
  max: number;
  /** Optional identifier prefix (e.g. 'search:', 'graphql:') */
  prefix?: string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Simple in-process store (replace with Redis for multi-instance deployments)
const store = new Map<string, WindowEntry>();

/** Periodically purge expired entries to prevent memory leaks. */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Check and increment the rate-limit counter for `identifier`.
 *
 * @param identifier - IP address, wallet address, or API key
 * @param opts       - Window and limit configuration
 */
export function checkRateLimit(identifier: string, opts: RateLimitOptions): RateLimitResult {
  const key = `${opts.prefix ?? 'rl'}:${identifier}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, entry);
  }

  entry.count++;
  const allowed = entry.count <= opts.max;
  const remaining = Math.max(0, opts.max - entry.count);

  return { allowed, remaining, resetAt: entry.resetAt, limit: opts.max };
}

// ── Pre-built configs ─────────────────────────────────────────────────────────

/** Public search: 60 req / min per IP */
export const SEARCH_LIMIT: RateLimitOptions = { windowMs: 60_000, max: 60, prefix: 'search' };

/** General API: 120 req / min per IP */
export const GENERAL_LIMIT: RateLimitOptions = { windowMs: 60_000, max: 120, prefix: 'api' };

/** GraphQL: 30 req / min per IP (heavy queries) */
export const GRAPHQL_LIMIT: RateLimitOptions = { windowMs: 60_000, max: 30, prefix: 'gql' };

/** Authenticated users get 3× allowance */
export const AUTH_MULTIPLIER = 3;
