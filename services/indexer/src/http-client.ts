/**
 * Shared HTTP client factory for the indexer service.
 *
 * Documented defaults
 * ───────────────────
 * REQUEST_TIMEOUT_MS   30 000  Total time allowed for a single attempt (AbortSignal.timeout)
 * MAX_RETRIES          3       Attempts after the first failure (4 total calls at most)
 * INITIAL_BACKOFF_MS   500     First inter-attempt delay
 * BACKOFF_MULTIPLIER   2       Each subsequent delay is doubled (500 → 1 000 → 2 000)
 * MAX_BACKOFF_MS       30 000  Upper cap on any single delay
 *
 * Retry policy
 * ────────────
 * Retried:     network / timeout errors, HTTP 429, HTTP 5xx
 * Not retried: HTTP 4xx (except 429) — these are caller errors and won't self-heal
 *
 * Per-call overrides
 * ──────────────────
 * Pass a Partial<HttpClientOptions> as the third argument to `httpFetch` to
 * override any default for that specific call.  This exists for the handful of
 * calls that genuinely need different behaviour (e.g. a longer timeout when
 * streaming large payloads).  Every override should be accompanied by a comment
 * explaining why the default is insufficient.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HttpClientOptions {
  /** Total time (ms) allowed for a single HTTP attempt before it is aborted. */
  requestTimeoutMs: number;
  /** Maximum number of retries after the first failure (0 = no retries). */
  maxRetries: number;
  /** Delay (ms) before the first retry. */
  initialBackoffMs: number;
  /** Multiplier applied to the backoff after each retry. */
  backoffMultiplier: number;
  /** Upper bound (ms) on any single inter-attempt delay. */
  maxBackoffMs: number;
}

export interface HttpClientResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  /** Total attempts made (1 = no retries were needed). */
  attempts: number;
}

// ---------------------------------------------------------------------------
// Defaults (exported so tests and callers can reference them by name)
// ---------------------------------------------------------------------------

export const HTTP_CLIENT_DEFAULTS: Readonly<HttpClientOptions> = {
  requestTimeoutMs: 30_000,
  maxRetries: 3,
  initialBackoffMs: 500,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the error or HTTP status warrants a retry.
 *
 * Network-level errors (TypeError from fetch, AbortError) are always retried.
 * HTTP 429 Too Many Requests and any 5xx server error are retried.
 * All other HTTP errors (4xx) are not retried — they will not self-heal.
 */
function isRetryable(error: unknown, status?: number): boolean {
  if (status !== undefined) {
    return status === 429 || status >= 500;
  }
  // Network / timeout errors thrown by fetch
  return error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError");
}

/**
 * Calculates the capped exponential backoff delay for a given attempt index.
 * attempt=0 → initialBackoffMs, attempt=1 → initialBackoffMs*multiplier, …
 */
export function calcBackoff(attempt: number, opts: Pick<HttpClientOptions, "initialBackoffMs" | "backoffMultiplier" | "maxBackoffMs">): number {
  const raw = opts.initialBackoffMs * Math.pow(opts.backoffMultiplier, attempt);
  return Math.min(raw, opts.maxBackoffMs);
}

/** Promisified sleep, injectable in tests via the `sleep` parameter. */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Executes a fetch request with automatic retry, exponential backoff, and
 * per-attempt timeouts.
 *
 * @param url     Destination URL
 * @param init    Standard RequestInit (method, headers, body, …)
 * @param overrides  Per-call option overrides. Document why in a comment at the call site.
 * @param _sleep  Injectable sleep function — used by unit tests to avoid real delays.
 */
export async function httpFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
  overrides: Partial<HttpClientOptions> = {},
  _sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<HttpClientResult<T>> {
  const opts: HttpClientOptions = { ...HTTP_CLIENT_DEFAULTS, ...overrides };

  let lastError: unknown;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // Each attempt gets its own AbortSignal so a timed-out attempt does not
    // poison subsequent ones.
    const signal = AbortSignal.timeout(opts.requestTimeoutMs);

    try {
      const response = await fetch(url, { ...init, signal });
      lastStatus = response.status;

      if (!isRetryable(undefined, response.status)) {
        // Success or a non-retryable client error — return immediately.
        const data = (await response.json().catch(() => null)) as T;
        return { ok: response.ok, status: response.status, data, attempts: attempt + 1 };
      }

      // Retryable HTTP status — consume body to free the connection, then retry.
      await response.body?.cancel();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
      lastStatus = undefined;

      if (!isRetryable(err)) {
        // Non-retryable fetch error (e.g. invalid URL) — fail fast.
        throw err;
      }
    }

    // Don't sleep after the final attempt.
    if (attempt < opts.maxRetries) {
      const delay = calcBackoff(attempt, opts);
      await _sleep(delay);
    }
  }

  // All attempts exhausted.
  throw lastError ?? new Error(`HTTP request failed after ${opts.maxRetries + 1} attempts (last status: ${lastStatus})`);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a pre-configured fetch wrapper with service-level defaults baked in.
 * Individual calls can still override specific options via the `overrides` parameter.
 *
 * Usage:
 *   const client = createHttpClient({ requestTimeoutMs: 60_000 }); // longer default for this service
 *   const result = await client.fetch<MyType>(url, { method: "POST", body: "…" });
 */
export function createHttpClient(serviceDefaults: Partial<HttpClientOptions> = {}) {
  const merged: HttpClientOptions = { ...HTTP_CLIENT_DEFAULTS, ...serviceDefaults };

  return {
    /** The resolved options this client was created with. */
    options: merged as Readonly<HttpClientOptions>,

    fetch<T = unknown>(
      url: string,
      init: RequestInit = {},
      callOverrides: Partial<HttpClientOptions> = {},
      _sleep?: (ms: number) => Promise<void>,
    ): Promise<HttpClientResult<T>> {
      // Call-level overrides are layered on top of the service-level defaults.
      return httpFetch<T>(url, init, { ...serviceDefaults, ...callOverrides }, _sleep);
    },
  };
}
