import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Create a pino logger bound to a module name.
 *
 * Pass a `traceId` to bind `trace_id` as a permanent structured field on
 * every log line emitted by the returned logger.  This is the canonical
 * way to propagate the X-Trace-ID header into log output for a single
 * request — create a child logger at the top of the request handler and
 * thread it through to all downstream calls.
 *
 * Example
 * ───────
 * ```ts
 * const log = createLogger("indexer:rpc-client", traceId);
 * log.info({ ledger: 42 }, "Fetched events");
 * // → { "level":"info", "module":"indexer:rpc-client",
 * //     "trace_id":"fmc-67946a1b-3f8c2a0d9e4b71c2",
 * //     "ledger":42, "msg":"Fetched events" }
 * ```
 *
 * See docs/logging-conventions.md for the project-wide tracing convention.
 */
export function createLogger(module: string, traceId?: string): pino.Logger {
  const base = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: isDev
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  });

  const bindings: Record<string, string> = { module };
  if (traceId) {
    bindings["trace_id"] = traceId;
  }

  return base.child(bindings);
}
