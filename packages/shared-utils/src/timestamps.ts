/**
 * UTC timestamp utilities for Fund-My-Cause services.
 *
 * ## Convention
 *
 * All persisted and transported timestamps in Fund-My-Cause services are
 * expressed as **UTC ISO-8601 strings** (e.g. "2024-01-15T12:00:00.000Z").
 *
 * Localisation (display in the user's timezone) is the responsibility of
 * the presentation layer (`apps/interface`) and must never happen inside a
 * service.
 *
 * ## Sources of timestamps in this codebase
 *
 * | Source                     | Raw format               | Utility to use              |
 * |----------------------------|--------------------------|-----------------------------|
 * | `Date.now()` / `new Date()`| ms since epoch (number)  | `nowUtcIso()` or `msToUtcIso()` |
 * | Soroban ledger `close_time`| Unix seconds (number)    | `unixSecondsToUtcIso()`     |
 * | Soroban contract storage   | Unix seconds as BigInt   | `bigintSecondsToUtcIso()`   |
 * | Incoming GraphQL string    | ISO string (untrusted)   | `normaliseToUtcIso()`       |
 *
 * ## DST safety
 *
 * All conversions go through the `Date` constructor which always stores
 * internally as UTC milliseconds.  Calling `.toISOString()` always emits a
 * UTC "Z"-suffixed string regardless of the process timezone, so these
 * helpers are safe across DST boundaries and on servers with non-UTC `TZ`.
 */

// ---------------------------------------------------------------------------
// Current time helpers
// ---------------------------------------------------------------------------

/**
 * Return the current wall-clock instant as a UTC ISO-8601 string.
 *
 * Use this instead of `new Date().toISOString()` everywhere a "now"
 * timestamp is needed so the intent is explicit and the call is easy to
 * search for in the codebase.
 *
 * @example
 * ```ts
 * import { nowUtcIso } from "@fund-my-cause/shared-utils/timestamps";
 * const ts = nowUtcIso(); // "2024-01-15T12:00:00.000Z"
 * ```
 */
export function nowUtcIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Unix timestamp in **milliseconds** to a UTC ISO-8601 string.
 *
 * This is the correct way to convert `Date.now()` or any `number`-typed
 * millisecond timestamp.
 *
 * @throws {RangeError} if `ms` is not a finite number.
 *
 * @example
 * ```ts
 * msToUtcIso(1_700_000_000_000) // "2023-11-14T22:13:20.000Z"
 * ```
 */
export function msToUtcIso(ms: number): string {
  if (!Number.isFinite(ms)) {
    throw new RangeError(`msToUtcIso: expected a finite number, got ${ms}`);
  }
  return new Date(ms).toISOString();
}

/**
 * Convert a Unix timestamp in **seconds** to a UTC ISO-8601 string.
 *
 * Use this for Soroban `close_time` / `ledger_close_time` values which
 * are always expressed in seconds.
 *
 * @throws {RangeError} if `seconds` is not a finite number.
 *
 * @example
 * ```ts
 * unixSecondsToUtcIso(1_700_000_000) // "2023-11-14T22:13:20.000Z"
 * ```
 */
export function unixSecondsToUtcIso(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    throw new RangeError(
      `unixSecondsToUtcIso: expected a finite number, got ${seconds}`,
    );
  }
  return new Date(seconds * 1000).toISOString();
}

/**
 * Convert a BigInt Unix timestamp in **seconds** to a UTC ISO-8601 string.
 *
 * Soroban contract storage frequently returns deadlines and timestamps as
 * `u64` BigInts.  This helper converts them safely without losing precision
 * for dates within the valid JavaScript `Date` range.
 *
 * @throws {RangeError} if the converted millisecond value exceeds
 *   `Number.MAX_SAFE_INTEGER`.
 *
 * @example
 * ```ts
 * bigintSecondsToUtcIso(1_700_000_000n) // "2023-11-14T22:13:20.000Z"
 * ```
 */
export function bigintSecondsToUtcIso(seconds: bigint): string {
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms)) {
    throw new RangeError(
      `bigintSecondsToUtcIso: BigInt ${seconds} overflows a safe JS number`,
    );
  }
  return new Date(ms).toISOString();
}

// ---------------------------------------------------------------------------
// Normalisation helper
// ---------------------------------------------------------------------------

/**
 * Normalise an incoming timestamp string to a UTC ISO-8601 string.
 *
 * Accepts any value parseable by the `Date` constructor — ISO-8601 with or
 * without timezone offset, RFC-2822, etc. — and re-emits it as a canonical
 * UTC "Z"-suffixed string.  Useful for sanitising timestamps received from
 * external sources (user input, GraphQL variables, Horizon API responses).
 *
 * @throws {TypeError} if `value` cannot be parsed as a valid date.
 *
 * @example
 * ```ts
 * // Local-time string → UTC
 * normaliseToUtcIso("2024-01-15T14:00:00+02:00") // "2024-01-15T12:00:00.000Z"
 * // Already UTC — idempotent
 * normaliseToUtcIso("2024-01-15T12:00:00.000Z")   // "2024-01-15T12:00:00.000Z"
 * ```
 */
export function normaliseToUtcIso(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new TypeError(
      `normaliseToUtcIso: cannot parse "${value}" as a valid date`,
    );
  }
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Returns `true` if `value` is a UTC ISO-8601 string (ends with "Z").
 *
 * Use this as a lightweight sanity check before persisting or forwarding
 * a timestamp to ensure the UTC convention is being followed.
 *
 * @example
 * ```ts
 * isUtcIsoString("2024-01-15T12:00:00.000Z") // true
 * isUtcIsoString("2024-01-15T14:00:00+02:00") // false — has offset
 * isUtcIsoString("not a date")                // false
 * ```
 */
export function isUtcIsoString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!value.endsWith("Z")) return false;
  return !isNaN(new Date(value).getTime());
}
