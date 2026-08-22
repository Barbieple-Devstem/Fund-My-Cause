import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiterService } from "./rate-limiter.js";

describe("RateLimiterService", () => {
  let rateLimiter: RateLimiterService;

  beforeEach(() => {
    // No redis client passed -> falls back to in-memory limiters.
    rateLimiter = new RateLimiterService();
  });

  describe("checkRequestLimit (100 requests / 60s)", () => {
    it("allows requests under the limit", async () => {
      await expect(rateLimiter.checkRequestLimit("req-key-1")).resolves.toBeUndefined();
    });

    it("throws once the limit is exceeded, with a retryAfter", async () => {
      const key = "req-key-2";
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkRequestLimit(key);
      }

      await expect(rateLimiter.checkRequestLimit(key)).rejects.toMatchObject({
        message: "Too many requests",
      });

      try {
        await rateLimiter.checkRequestLimit(key);
        expect.unreachable("expected checkRequestLimit to throw");
      } catch (error: any) {
        expect(error.retryAfter).toBeGreaterThanOrEqual(1);
      }
    });

    it("tracks separate keys independently", async () => {
      const key = "req-key-3";
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkRequestLimit(key);
      }
      await expect(rateLimiter.checkRequestLimit(key)).rejects.toThrow("Too many requests");

      // A different key should be unaffected.
      await expect(rateLimiter.checkRequestLimit("req-key-3-other")).resolves.toBeUndefined();
    });
  });

  describe("checkIpLimit (1000 requests / hour)", () => {
    it("allows requests under the limit", async () => {
      await expect(rateLimiter.checkIpLimit("1.2.3.4")).resolves.toBeUndefined();
    });

    it("throws a distinct IP rate limit error once exhausted", async () => {
      const ip = "5.6.7.8";
      // Exhaust the bucket directly through the underlying limiter to avoid
      // looping 1000 times; this still exercises RateLimiterService's own
      // catch/rethrow logic in checkIpLimit via the public API below.
      await (rateLimiter as any).ipLimiter.consume(ip, 1000);

      await expect(rateLimiter.checkIpLimit(ip)).rejects.toMatchObject({
        message: "IP rate limit exceeded",
      });

      try {
        await rateLimiter.checkIpLimit(ip);
        expect.unreachable("expected checkIpLimit to throw");
      } catch (error: any) {
        expect(error.retryAfter).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("checkUserLimit (10000 requests / hour)", () => {
    it("allows requests under the limit", async () => {
      await expect(rateLimiter.checkUserLimit("GUSERADDRESS")).resolves.toBeUndefined();
    });

    it("throws a distinct user rate limit error once exhausted", async () => {
      const address = "GUSERADDRESS2";
      await (rateLimiter as any).userLimiter.consume(address, 10000);

      await expect(rateLimiter.checkUserLimit(address)).rejects.toMatchObject({
        message: "User rate limit exceeded",
      });
    });
  });

  describe("getStatus", () => {
    it("returns default status for a key that has never been consumed", async () => {
      const status = await rateLimiter.getStatus("fresh-key");

      expect(status).toMatchObject({
        limit: 100,
        current: 0,
        remaining: 100,
      });
      expect(status.resetTime).toBeInstanceOf(Date);
    });

    it("reflects consumed points for a key that has been used", async () => {
      const key = "status-key";
      await rateLimiter.checkRequestLimit(key);
      await rateLimiter.checkRequestLimit(key);

      const status = await rateLimiter.getStatus(key);

      expect(status.current).toBe(2);
      expect(status.remaining).toBe(98);
    });
  });

  describe("reset", () => {
    it("clears consumed points for a key so it can be used again after exhaustion", async () => {
      const key = "reset-key";
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkRequestLimit(key);
      }
      await expect(rateLimiter.checkRequestLimit(key)).rejects.toThrow();

      await rateLimiter.reset(key);

      await expect(rateLimiter.checkRequestLimit(key)).resolves.toBeUndefined();
    });

    it("does not throw when resetting a key that was never consumed", async () => {
      await expect(rateLimiter.reset("never-used-key")).resolves.toBeUndefined();
    });
  });
});
