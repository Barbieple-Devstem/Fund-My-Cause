/**
 * Trace-ID utilities for Fund-My-Cause services.
 *
 * Convention
 * ──────────
 * Header name : X-Trace-ID  (canonical casing; HTTP/2 lowercases it automatically)
 * Format      : fmc-<timestamp_hex>-<random_hex>
 *               timestamp = 8 hex chars (Unix seconds, 32-bit big-endian)
 *               random    = 16 hex chars (8 random bytes)
 * Example     : fmc-67946a1b-3f8c2a0d9e4b71c2
 * Total length: 28 characters
 *
 * Generation point: the graphql-api generates one trace ID per incoming
 * GraphQL request if the caller did not supply X-Trace-ID. All downstream
 * HTTP calls forward the same value unchanged.
 *
 * See docs/logging-conventions.md for the full specification.
 */

/** The canonical HTTP header name for trace propagation. */
export const TRACE_ID_HEADER = "x-trace-id";

/** Regex that a valid Fund-My-Cause trace ID must match. */
const TRACE_ID_RE = /^fmc-[0-9a-f]{8}-[0-9a-f]{16}$/;

/**
 * Generate a new trace ID.
 *
 * Uses `crypto.getRandomValues` (available in Node ≥ 19 globals and all
 * modern browsers).  Falls back to `Math.random`-based hex when the Web
 * Crypto API is not available so the function is safe in older Node builds.
 */
export function generateTraceId(): string {
  const tsHex = (Math.floor(Date.now() / 1000) >>> 0)
    .toString(16)
    .padStart(8, "0");

  let randomHex: string;
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as any).crypto?.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(8);
    (globalThis as any).crypto.getRandomValues(bytes);
    randomHex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } else {
    // Fallback for environments without Web Crypto (Node < 19 without flag)
    randomHex = Array.from({ length: 8 })
      .map(() =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  }

  return `fmc-${tsHex}-${randomHex}`;
}

/**
 * Returns `true` if `value` is a well-formed Fund-My-Cause trace ID.
 * Use this to validate untrusted inbound `X-Trace-ID` headers before
 * accepting them — fall back to generating a fresh ID if validation fails.
 */
export function isValidTraceId(value: unknown): value is string {
  return typeof value === "string" && TRACE_ID_RE.test(value);
}

/**
 * Extract a trace ID from an HTTP headers object (plain object or a
 * Node `IncomingHttpHeaders` map).  Generates a new ID if the header is
 * absent or malformed.
 *
 * @param headers  A record whose keys are lowercased header names.
 */
export function resolveTraceId(
  headers: Record<string, string | string[] | undefined>,
): string {
  const raw = headers[TRACE_ID_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isValidTraceId(value) ? value : generateTraceId();
}
