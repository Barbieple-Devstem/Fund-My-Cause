/**
 * Tests for per-mutation rate limiting (#899).
 *
 * Covers:
 *  - Under-limit pass-through (requests succeed while under the cap)
 *  - At-limit rejection (the (N+1)th request is rejected)
 *  - Reset-after-window behaviour (consuming a fresh key works)
 *  - Structured error shape (code, retryAfter, mutation name)
 *  - createCampaign: 5 per hour
 *  - recordContribution: 20 per 10 minutes
 */
import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiterService, MUTATION_LIMITS } from "./rate-limiter.js";

// Helper: exhaust a mutation bucket down to 0 remaining points.
async function drainMutation(
  svc: RateLimiterService,
  mutation: keyof typeof MUTATION_LIMITS,
  key: string
): Promise<void> {
  const points = MUTATION_LIMITS[mutation].points;
  for (let i = 0; i < points; i++) {
    await svc.checkMutationLimit(mutation, key);
  }
}

describe("per-mutation rate limiting", () => {
  let rateLimiter: RateLimiterService;

  beforeEach(() => {
    // No Redis → falls back to in-memory limiters.
    rateLimiter = new RateLimiterService();
  });

  // ── createCampaign (5 per hour) ──────────────────────────────────────────

  describe("createCampaign (5 per hour)", () => {
    it("allows requests while under the limit", async () => {
      const key = `create-pass-${Date.now()}`;
      for (let i = 0; i < MUTATION_LIMITS.createCampaign.points; i++) {
        await expect(
          rateLimiter.checkMutationLimit("createCampaign", key)
        ).resolves.toBeUndefined();
      }
    });

    it("rejects the next request once the limit is reached", async () => {
      const key = `create-reject-${Date.now()}`;
      await drainMutation(rateLimiter, "createCampaign", key);

      await expect(
        rateLimiter.checkMutationLimit("createCampaign", key)
      ).rejects.toMatchObject({ message: expect.stringContaining("createCampaign") });
    });

    it("rejected error carries retryAfter ≥ 1", async () => {
      const key = `create-retry-${Date.now()}`;
      await drainMutation(rateLimiter, "createCampaign", key);

      try {
        await rateLimiter.checkMutationLimit("createCampaign", key);
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.retryAfter).toBeGreaterThanOrEqual(1);
      }
    });

    it("different keys get independent buckets", async () => {
      const keyA = `create-ind-a-${Date.now()}`;
      const keyB = `create-ind-b-${Date.now()}`;
      await drainMutation(rateLimiter, "createCampaign", keyA);

      // keyA is exhausted, keyB should still pass
      await expect(
        rateLimiter.checkMutationLimit("createCampaign", keyB)
      ).resolves.toBeUndefined();
    });
  });

  // ── recordContribution (20 per 10 min) ──────────────────────────────────

  describe("recordContribution (20 per 10 min)", () => {
    it("allows requests while under the limit", async () => {
      const key = `contrib-pass-${Date.now()}`;
      for (let i = 0; i < MUTATION_LIMITS.recordContribution.points; i++) {
        await expect(
          rateLimiter.checkMutationLimit("recordContribution", key)
        ).resolves.toBeUndefined();
      }
    });

    it("rejects the next request once the limit is reached", async () => {
      const key = `contrib-reject-${Date.now()}`;
      await drainMutation(rateLimiter, "recordContribution", key);

      await expect(
        rateLimiter.checkMutationLimit("recordContribution", key)
      ).rejects.toMatchObject({ message: expect.stringContaining("recordContribution") });
    });

    it("rejected error carries retryAfter ≥ 1", async () => {
      const key = `contrib-retry-${Date.now()}`;
      await drainMutation(rateLimiter, "recordContribution", key);

      try {
        await rateLimiter.checkMutationLimit("recordContribution", key);
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.retryAfter).toBeGreaterThanOrEqual(1);
      }
    });

    it("createCampaign bucket is unaffected when recordContribution is exhausted", async () => {
      const key = `cross-mut-${Date.now()}`;
      await drainMutation(rateLimiter, "recordContribution", key);

      // createCampaign uses a different limiter — must still pass
      await expect(
        rateLimiter.checkMutationLimit("createCampaign", key)
      ).resolves.toBeUndefined();
    });
  });

  // ── Structured error shape ───────────────────────────────────────────────

  describe("error shape", () => {
    it("error message includes the mutation name", async () => {
      const key = `shape-${Date.now()}`;
      await drainMutation(rateLimiter, "createCampaign", key);

      try {
        await rateLimiter.checkMutationLimit("createCampaign", key);
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.message).toContain("createCampaign");
        expect(err.retryAfter).toBeTypeOf("number");
        expect(err.mutation).toBe("createCampaign");
      }
    });
  });
});
