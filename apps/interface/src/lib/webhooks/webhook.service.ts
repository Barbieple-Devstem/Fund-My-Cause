/**
 * Webhook service — Issue #677
 *
 * Let creators/integrators subscribe to campaign events via webhooks.
 * Features: registration, signing-secret management, signed payload delivery,
 * retries with exponential backoff, dead-letter queue, delivery log.
 *
 * Dead exports removed — Issue #819:
 *   - WebhookSubscription: internal type; not imported by any consumer
 *   - WebhookDelivery:     internal type; not imported by any consumer
 *   - dispatchEvent:       internal delivery mechanism; no route calls it
 */

import * as crypto from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | "campaign.created"
  | "campaign.updated"
  | "campaign.funded"
  | "campaign.successful"
  | "campaign.cancelled"
  | "contribution.received"
  | "milestone.reached";

/** Internal subscription record — not part of the public module API. */
interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  createdAt: string;
  active: boolean;
  /** Owner wallet address */
  ownerId: string;
}

/** Internal delivery record — not part of the public module API. */
interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEventType;
  payload: Record<string, unknown>;
  status: "pending" | "success" | "failed" | "dead";
  attempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  responseCode: number | null;
  error: string | null;
  createdAt: string;
}

// ── In-process store (replace with DB in production) ─────────────────────────

const subscriptions = new Map<string, WebhookSubscription>();
const deliveries = new Map<string, WebhookDelivery>();

// ── Signature helpers ─────────────────────────────────────────────────────────

/**
 * Generate a HMAC-SHA256 signature for payload delivery.
 *
 * Signature = HMAC-SHA256(secret, `${timestamp}.${body}`)
 */
export function signPayload(
  secret: string,
  body: string,
  timestamp: number,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

/**
 * Verify an incoming webhook signature.
 *
 * @param secret    - Webhook signing secret
 * @param signature - Value of x-fmc-signature header
 * @param body      - Raw request body string
 * @param timestamp - Value of x-fmc-timestamp header (Unix ms)
 * @param tolerance - Max age of timestamp in ms (default 5 min)
 */
export function verifySignature(
  secret: string,
  signature: string,
  body: string,
  timestamp: number,
  tolerance = 5 * 60 * 1000,
): boolean {
  if (Math.abs(Date.now() - timestamp) > tolerance) return false;
  const expected = signPayload(secret, body, timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex"),
  );
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register a new webhook subscription.
 * Generates a random signing secret.
 */
export function registerWebhook(
  ownerId: string,
  url: string,
  events: WebhookEventType[],
): WebhookSubscription {
  if (!url.startsWith("https://")) {
    throw new Error("Webhook URL must use HTTPS");
  }
  if (events.length === 0) {
    throw new Error("At least one event type is required");
  }

  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString("hex");

  const sub: WebhookSubscription = {
    id,
    url,
    events,
    secret,
    ownerId,
    active: true,
    createdAt: new Date().toISOString(),
  };

  subscriptions.set(id, sub);
  return sub;
}

/** Update an existing webhook subscription. */
export function updateWebhook(
  id: string,
  ownerId: string,
  updates: Partial<Pick<WebhookSubscription, "url" | "events" | "active">>,
): WebhookSubscription {
  const sub = subscriptions.get(id);
  if (!sub) throw new Error("Webhook not found");
  if (sub.ownerId !== ownerId) throw new Error("Unauthorized");

  Object.assign(sub, updates);
  subscriptions.set(id, sub);
  return sub;
}

/** Delete a webhook subscription. */
export function deleteWebhook(id: string, ownerId: string): void {
  const sub = subscriptions.get(id);
  if (!sub) throw new Error("Webhook not found");
  if (sub.ownerId !== ownerId) throw new Error("Unauthorized");
  subscriptions.delete(id);
}

/** List all webhooks for an owner. */
export function listWebhooks(ownerId: string): WebhookSubscription[] {
  return Array.from(subscriptions.values())
    .filter((s) => s.ownerId === ownerId)
    .map((s) => ({ ...s, secret: s.secret.slice(0, 8) + "..." })); // mask secret
}

/** Rotate the signing secret for a webhook. */
export function rotateSecret(id: string, ownerId: string): string {
  const sub = subscriptions.get(id);
  if (!sub) throw new Error("Webhook not found");
  if (sub.ownerId !== ownerId) throw new Error("Unauthorized");
  sub.secret = crypto.randomBytes(32).toString("hex");
  subscriptions.set(id, sub);
  return sub.secret;
}

// ── Delivery log ──────────────────────────────────────────────────────────────

/** List delivery log for a webhook (newest first). */
export function getDeliveryLog(
  webhookId: string,
  ownerId: string,
  limit = 50,
): WebhookDelivery[] {
  const sub = subscriptions.get(webhookId);
  if (!sub || sub.ownerId !== ownerId) throw new Error("Webhook not found");

  return Array.from(deliveries.values())
    .filter((d) => d.webhookId === webhookId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}

/** List all dead-letter deliveries for a webhook. */
export function getDeadLetterQueue(
  webhookId: string,
  ownerId: string,
): WebhookDelivery[] {
  return getDeliveryLog(webhookId, ownerId, 200).filter(
    (d) => d.status === "dead",
  );
}
