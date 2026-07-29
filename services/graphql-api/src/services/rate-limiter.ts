import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import type { RedisClientType } from "redis";

// ---------------------------------------------------------------------------
// Per-mutation limits (#899)
// ---------------------------------------------------------------------------
//
// createCampaign  – relatively low-frequency action; 5 per wallet per hour
//   prevents spam-campaign creation while still supporting legitimate bursts.
//
// recordContribution – higher frequency is expected in normal use, but
//   20 per wallet per 10 minutes caps bot-driven donation floods that would
//   distort QF matching weight.
//
// Both limiters use the authenticated wallet address as the key so each user
// gets an independent bucket.  When no wallet is available the IP is used as
// a fallback (enforced at the call site in resolvers.ts).
//
// These limits are documented in services/graphql-api/README.md.

export const MUTATION_LIMITS = {
  createCampaign: {
    points: 5,      // 5 campaigns
    duration: 3600, // per hour (per wallet)
    keyPrefix: "rl_mut_create:",
  },
  recordContribution: {
    points: 20,     // 20 contributions
    duration: 600,  // per 10 minutes (per wallet)
    keyPrefix: "rl_mut_contrib:",
  },
} as const;

export type MutationName = keyof typeof MUTATION_LIMITS;

/**
 * Rate limiting service with Redis backend
 */
export class RateLimiterService {
  private limiter: RateLimiterRedis | RateLimiterMemory;
  private ipLimiter: RateLimiterRedis | RateLimiterMemory;
  private userLimiter: RateLimiterRedis | RateLimiterMemory;

  /** Per-mutation limiters keyed by mutation name. */
  private mutationLimiters: Map<MutationName, RateLimiterRedis | RateLimiterMemory>;

  constructor(redis?: RedisClientType) {
    if (redis) {
      // Use Redis-based rate limiter for distributed systems
      this.limiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: "rl:",
        points: 100, // Number of requests
        duration: 60, // Per second (sliding window)
      });

      this.ipLimiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: "rl_ip:",
        points: 1000, // Requests per IP
        duration: 3600, // Per hour
      });

      this.userLimiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: "rl_user:",
        points: 10000, // Requests per authenticated user
        duration: 3600, // Per hour
      });

      this.mutationLimiters = new Map(
        (Object.entries(MUTATION_LIMITS) as [MutationName, typeof MUTATION_LIMITS[MutationName]][]).map(
          ([name, cfg]) => [
            name,
            new RateLimiterRedis({
              storeClient: redis,
              keyPrefix: cfg.keyPrefix,
              points: cfg.points,
              duration: cfg.duration,
            }),
          ]
        )
      );
    } else {
      // Use in-memory rate limiter for development
      this.limiter = new RateLimiterMemory({
        points: 100,
        duration: 60,
      });

      this.ipLimiter = new RateLimiterMemory({
        points: 1000,
        duration: 3600,
      });

      this.userLimiter = new RateLimiterMemory({
        points: 10000,
        duration: 3600,
      });

      this.mutationLimiters = new Map(
        (Object.entries(MUTATION_LIMITS) as [MutationName, typeof MUTATION_LIMITS[MutationName]][]).map(
          ([name, cfg]) => [
            name,
            new RateLimiterMemory({
              points: cfg.points,
              duration: cfg.duration,
            }),
          ]
        )
      );
    }
  }

  /**
   * Check per-mutation rate limit.
   *
   * @param mutation - The mutation name (createCampaign | recordContribution).
   * @param key      - The rate-limit key (wallet address, or IP as fallback).
   *
   * Throws a structured error with `retryAfter` (seconds) when the limit is
   * exceeded.  The error carries the mutation name so callers can surface a
   * clear, client-parseable message.
   */
  async checkMutationLimit(mutation: MutationName, key: string): Promise<void> {
    const limiter = this.mutationLimiters.get(mutation);
    if (!limiter) {
      // Unknown mutation — fall through without limiting rather than blocking
      // legitimate traffic for a mis-configured caller.
      return;
    }

    try {
      await limiter.consume(key);
    } catch (error: any) {
      if (error.remainingPoints !== undefined) {
        const cfg = MUTATION_LIMITS[mutation];
        const retryAfter = Math.round(error.msBeforeNext / 1000) || 1;
        const err = new Error(
          `Rate limit exceeded for '${mutation}': max ${cfg.points} per ${cfg.duration}s. Retry after ${retryAfter}s.`
        );
        (err as any).retryAfter = retryAfter;
        (err as any).mutation = mutation;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Check rate limit for a request
   */
  async checkRequestLimit(key: string): Promise<void> {
    try {
      await this.limiter.consume(key);
    } catch (error: any) {
      if (error.remainingPoints !== undefined) {
        const retryAfter = Math.round(error.msBeforeNext / 1000) || 1;
        const err = new Error("Too many requests");
        (err as any).retryAfter = retryAfter;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Check rate limit by IP address
   */
  async checkIpLimit(ip: string): Promise<void> {
    try {
      await this.ipLimiter.consume(ip);
    } catch (error: any) {
      if (error.remainingPoints !== undefined) {
        const retryAfter = Math.round(error.msBeforeNext / 1000) || 1;
        const err = new Error("IP rate limit exceeded");
        (err as any).retryAfter = retryAfter;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Check rate limit by user address
   */
  async checkUserLimit(address: string): Promise<void> {
    try {
      await this.userLimiter.consume(address);
    } catch (error: any) {
      if (error.remainingPoints !== undefined) {
        const retryAfter = Math.round(error.msBeforeNext / 1000) || 1;
        const err = new Error("User rate limit exceeded");
        (err as any).retryAfter = retryAfter;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Get current rate limit status
   */
  async getStatus(key: string): Promise<{
    limit: number;
    current: number;
    remaining: number;
    resetTime: Date;
  }> {
    try {
      const response = await this.limiter.get(key);

      if (!response) {
        return {
          limit: 100,
          current: 0,
          remaining: 100,
          resetTime: new Date(Date.now() + 60000),
        };
      }

      return {
        limit: 100,
        current: response.consumedPoints,
        remaining: 100 - response.consumedPoints,
        resetTime: new Date(Date.now() + response.msBeforeNext),
      };
    } catch (error) {
      console.error("Error getting rate limit status:", error);
      return {
        limit: 100,
        current: 0,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000),
      };
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    try {
      await this.limiter.delete(key);
    } catch (error) {
      console.error("Error resetting rate limit:", error);
    }
  }
}
