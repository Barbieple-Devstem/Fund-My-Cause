/**
 * Unit tests for webhook.service.ts — Issue #819
 *
 * Focuses on the signature utilities (signPayload / verifySignature) which
 * were previously untested, and verifies that the full exported surface
 * remains stable so the dead-export script can catch regressions.
 */

import * as crypto from "crypto";
import { signPayload, verifySignature } from "../webhook.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a realistic 32-byte hex signing secret. */
function makeSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ── signPayload ───────────────────────────────────────────────────────────────

describe("signPayload", () => {
  it("returns a 64-character lowercase hex string (SHA-256 output)", () => {
    const sig = signPayload(
      makeSecret(),
      '{"event":"campaign.created"}',
      Date.now(),
    );
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same signature for identical inputs", () => {
    const secret = makeSecret();
    const body = '{"event":"contribution.received","amount":100}';
    const ts = 1_700_000_000_000;

    const sig1 = signPayload(secret, body, ts);
    const sig2 = signPayload(secret, body, ts);
    expect(sig1).toBe(sig2);
  });

  it("produces a different signature when the secret changes", () => {
    const body = '{"event":"campaign.funded"}';
    const ts = 1_700_000_000_000;

    const sig1 = signPayload(makeSecret(), body, ts);
    const sig2 = signPayload(makeSecret(), body, ts);
    // Astronomically unlikely to collide
    expect(sig1).not.toBe(sig2);
  });

  it("produces a different signature when the body changes", () => {
    const secret = makeSecret();
    const ts = 1_700_000_000_000;

    const sig1 = signPayload(secret, '{"event":"campaign.created"}', ts);
    const sig2 = signPayload(secret, '{"event":"campaign.cancelled"}', ts);
    expect(sig1).not.toBe(sig2);
  });

  it("produces a different signature when the timestamp changes", () => {
    const secret = makeSecret();
    const body = '{"event":"milestone.reached"}';

    const sig1 = signPayload(secret, body, 1_000);
    const sig2 = signPayload(secret, body, 2_000);
    expect(sig1).not.toBe(sig2);
  });

  it("uses the format `${timestamp}.${body}` as the HMAC message", () => {
    const secret = makeSecret();
    const body = "hello";
    const ts = 9999;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${ts}.${body}`)
      .digest("hex");

    expect(signPayload(secret, body, ts)).toBe(expected);
  });

  it("accepts an empty body string without throwing", () => {
    expect(() => signPayload(makeSecret(), "", Date.now())).not.toThrow();
  });
});

// ── verifySignature ───────────────────────────────────────────────────────────

describe("verifySignature", () => {
  it("returns true for a valid signature within the default tolerance", () => {
    const secret = makeSecret();
    const body = '{"event":"campaign.created"}';
    const ts = Date.now();
    const sig = signPayload(secret, body, ts);

    expect(verifySignature(secret, sig, body, ts)).toBe(true);
  });

  it("returns false when the signature is tampered", () => {
    const secret = makeSecret();
    const body = '{"event":"campaign.created"}';
    const ts = Date.now();
    const sig = signPayload(secret, body, ts);

    // Flip the first byte
    const tampered =
      (parseInt(sig.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, "0") +
      sig.slice(2);
    expect(verifySignature(secret, tampered, body, ts)).toBe(false);
  });

  it("returns false when the body was modified after signing", () => {
    const secret = makeSecret();
    const originalBody = '{"event":"campaign.created","amount":100}';
    const tamperedBody = '{"event":"campaign.created","amount":999}';
    const ts = Date.now();
    const sig = signPayload(secret, originalBody, ts);

    expect(verifySignature(secret, sig, tamperedBody, ts)).toBe(false);
  });

  it("returns false when the secret is wrong", () => {
    const secret = makeSecret();
    const body = '{"event":"campaign.funded"}';
    const ts = Date.now();
    const sig = signPayload(secret, body, ts);

    expect(verifySignature(makeSecret(), sig, body, ts)).toBe(false);
  });

  it("returns false when the timestamp exceeds the default 5-minute tolerance", () => {
    const secret = makeSecret();
    const body = '{"event":"contribution.received"}';
    const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
    const sig = signPayload(secret, body, sixMinutesAgo);

    expect(verifySignature(secret, sig, body, sixMinutesAgo)).toBe(false);
  });

  it("returns false when the timestamp is in the future beyond tolerance", () => {
    const secret = makeSecret();
    const body = '{"event":"milestone.reached"}';
    const sixMinutesFromNow = Date.now() + 6 * 60 * 1000;
    const sig = signPayload(secret, body, sixMinutesFromNow);

    expect(verifySignature(secret, sig, body, sixMinutesFromNow)).toBe(false);
  });

  it("respects a custom tolerance window", () => {
    const secret = makeSecret();
    const body = '{"event":"campaign.updated"}';
    const tenSecondsAgo = Date.now() - 10_000;
    const sig = signPayload(secret, body, tenSecondsAgo);

    // 5-second tolerance → should fail
    expect(verifySignature(secret, sig, body, tenSecondsAgo, 5_000)).toBe(
      false,
    );
    // 30-second tolerance → should pass
    expect(verifySignature(secret, sig, body, tenSecondsAgo, 30_000)).toBe(
      true,
    );
  });

  it("returns true when timestamp is exactly at the tolerance boundary", () => {
    const secret = makeSecret();
    const body = '{"event":"campaign.cancelled"}';
    const tolerance = 60_000; // 1 minute
    // Use a timestamp slightly within the boundary (1 ms inside)
    const ts = Date.now() - tolerance + 1;
    const sig = signPayload(secret, body, ts);

    expect(verifySignature(secret, sig, body, ts, tolerance)).toBe(true);
  });

  it("round-trips correctly with signPayload for all event types", () => {
    const eventTypes = [
      "campaign.created",
      "campaign.updated",
      "campaign.funded",
      "campaign.successful",
      "campaign.cancelled",
      "contribution.received",
      "milestone.reached",
    ] as const;

    for (const event of eventTypes) {
      const secret = makeSecret();
      const body = JSON.stringify({
        event,
        data: { id: "test-id" },
        timestamp: Date.now(),
      });
      const ts = Date.now();
      const sig = signPayload(secret, body, ts);
      expect(verifySignature(secret, sig, body, ts)).toBe(true);
    }
  });
});

// ── Export surface guard ──────────────────────────────────────────────────────

describe("webhook.service export surface", () => {
  /**
   * This test guards against accidental removal of symbols that ARE part of the
   * public API.  Symbols removed in Issue #819 (WebhookSubscription,
   * WebhookDelivery, dispatchEvent) are intentionally absent from this list —
   * they are internal implementation details with no external consumers.
   */
  it("exports all expected public symbols (regression guard for dead-export removals)", async () => {
    const mod = await import("../webhook.service");
    const expectedExports = [
      "signPayload",
      "verifySignature",
      "registerWebhook",
      "updateWebhook",
      "deleteWebhook",
      "listWebhooks",
      "rotateSecret",
      "getDeliveryLog",
      "getDeadLetterQueue",
    ];
    for (const name of expectedExports) {
      expect(mod).toHaveProperty(name);
      expect(typeof (mod as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("does NOT export previously-dead symbols (Issue #819 regression guard)", async () => {
    const mod = await import("../webhook.service");
    // These were dead exports with no consumers; they are now internal.
    const removedExports = [
      "WebhookSubscription",
      "WebhookDelivery",
      "dispatchEvent",
    ];
    for (const name of removedExports) {
      expect(mod).not.toHaveProperty(name);
    }
  });
});
