import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Root pino logger for the monitoring-service.
 *
 * For request-scoped logging (where a trace_id must appear on every line),
 * call `requestLogger(traceId)` to get a child logger with `trace_id` bound.
 * Pass that child logger into any code that runs within the request lifecycle.
 *
 * See docs/logging-conventions.md for the project-wide tracing convention.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
}).child({ service: "monitoring-service" });

/**
 * Create a request-scoped child logger with `trace_id` bound as a permanent
 * structured field.  Every log line emitted via the returned logger will
 * automatically include `trace_id` without any per-call boilerplate.
 *
 * Usage:
 * ```ts
 * const log = requestLogger(req.headers['x-trace-id']);
 * log.info({ incidentId }, 'incident created');
 * ```
 */
export function requestLogger(traceId: string): pino.Logger {
  return logger.child({ trace_id: traceId });
}
