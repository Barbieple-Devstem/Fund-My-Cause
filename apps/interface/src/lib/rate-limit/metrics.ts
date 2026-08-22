/**
 * Throttle metrics — Issue #675
 *
 * Tracks throttled requests for observability.
 * In production, emit to Prometheus / Datadog / CloudWatch.
 */

interface ThrottleEvent {
  identifier: string;
  prefix: string;
  retryAfter: number;
}

// In-process counter (replace with Prometheus Counter in production)
const counters = new Map<string, number>();

export function trackThrottledRequest(event: ThrottleEvent): void {
  const key = `throttled:${event.prefix}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);

  // Structured log for log-based metrics
  console.warn('[rate-limit] throttled', {
    identifier: event.identifier,
    prefix: event.prefix,
    retryAfter: event.retryAfter,
    total: counters.get(key),
  });
}

/** Return current throttle metrics snapshot. */
export function getThrottleMetrics(): Record<string, number> {
  return Object.fromEntries(counters);
}
