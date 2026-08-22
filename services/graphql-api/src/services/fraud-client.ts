/**
 * HTTP client for the fraud-detection service.
 *
 * Wraps the two endpoints that graphql-api needs to call:
 *  - POST /contributions  (notify of a new contribution for real-time scanning)
 *  - POST /scan           (trigger an async full scan)
 *
 * X-Trace-ID propagation
 * ──────────────────────
 * Pass the current request's traceId when calling any method.  The header is
 * set on the outbound request so the fraud-detection service can bind it to its
 * own log lines — making the same trace ID appear across both services.
 *
 * Failure policy
 * ──────────────
 * Fraud-detection is a best-effort side-effect: a network error or non-2xx
 * response is logged as a warning but never throws, so a fraud-service outage
 * cannot block donation recording.
 */

import { TRACE_ID_HEADER } from "@fund-my-cause/shared-utils";
import type pino from "pino";

const FRAUD_SERVICE_URL =
  process.env.FRAUD_DETECTION_URL || "http://localhost:8000";

/** Minimal shape of a contribution event forwarded to fraud-detection. */
export interface ContributionNotification {
  campaignId: string;
  contributor: string;
  amount: string; // stringified bigint — fraud service treats it as opaque
  transactionHash: string;
  timestamp: number; // Unix epoch seconds
}

/**
 * Notify the fraud-detection service about a new contribution so it can
 * run real-time heuristics synchronously (if it supports that) or queue
 * the data for the next background scan.
 *
 * Never throws — failures are logged at warn level.
 */
export async function notifyContribution(
  payload: ContributionNotification,
  traceId: string,
  log: pino.Logger,
): Promise<void> {
  const url = `${FRAUD_SERVICE_URL}/contributions`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TRACE_ID_HEADER]: traceId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      log.warn(
        { trace_id: traceId, status: res.status, url },
        "fraud-detection: contribution notification returned non-2xx",
      );
    } else {
      log.debug(
        { trace_id: traceId, campaignId: payload.campaignId, url },
        "fraud-detection: contribution notification sent",
      );
    }
  } catch (err) {
    log.warn(
      { trace_id: traceId, err, url },
      "fraud-detection: contribution notification failed (service unreachable)",
    );
  }
}

/**
 * Trigger an asynchronous full fraud scan.
 * Never throws — failures are logged at warn level.
 */
export async function triggerFraudScan(
  traceId: string,
  log: pino.Logger,
): Promise<void> {
  const url = `${FRAUD_SERVICE_URL}/scan`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TRACE_ID_HEADER]: traceId,
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      log.warn(
        { trace_id: traceId, status: res.status, url },
        "fraud-detection: scan trigger returned non-2xx",
      );
    } else {
      log.debug(
        { trace_id: traceId, url },
        "fraud-detection: scan triggered",
      );
    }
  } catch (err) {
    log.warn(
      { trace_id: traceId, err, url },
      "fraud-detection: scan trigger failed (service unreachable)",
    );
  }
}
