/**
 * CircuitBreaker — Issue #906
 *
 * A three-state circuit breaker that wraps outbound Horizon/RPC calls in
 * services/indexer, preventing cascading failures when the upstream is down.
 *
 * ## States
 *
 * ```
 *          failureThreshold consecutive failures
 *   CLOSED ──────────────────────────────────────► OPEN
 *     ▲                                               │
 *     │  trial succeeds                               │ cooldownMs elapses
 *     │                                               ▼
 *     └──────────────────────────────────────── HALF_OPEN
 *           (trial fails → back to OPEN, reset cooldown)
 * ```
 *
 * ### CLOSED (normal operation)
 * Every call is forwarded to the wrapped function.  On `failureThreshold`
 * consecutive failures the breaker trips to OPEN.  Any success resets the
 * consecutive-failure counter.
 *
 * ### OPEN (tripped)
 * Calls are rejected immediately with `CircuitOpenError` — no network request
 * is made.  After `cooldownMs` milliseconds the breaker moves to HALF_OPEN.
 *
 * ### HALF_OPEN (probing)
 * One trial call is allowed through.
 * - **Success** → CLOSED, reset counters.
 * - **Failure** → OPEN, restart cooldown.
 *
 * ## Configuration
 *
 * | Option           | Default  | Description                                      |
 * |------------------|----------|--------------------------------------------------|
 * | failureThreshold | 5        | Consecutive failures before tripping             |
 * | cooldownMs       | 30_000   | ms to wait before entering HALF_OPEN             |
 * | now              | Date.now | Injectable clock — use in tests to skip delays   |
 *
 * ## Metrics
 *
 * Call `getMetrics()` for Prometheus-compatible counters:
 * totalCalls, successfulCalls, failedCalls, circuitOpenRejections,
 * plus current state and failureCount.
 */

// ── Errors ────────────────────────────────────────────────────────────────────

/** Thrown when a call is rejected because the circuit is currently OPEN. */
export class CircuitOpenError extends Error {
  constructor(message = 'Circuit is open — calls are suspended until cooldown elapses') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** The three states of the circuit breaker state machine. */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /**
   * Number of consecutive failures required to trip the breaker.
   * @default 5
   */
  failureThreshold?: number;
  /**
   * Milliseconds the breaker stays OPEN before transitioning to HALF_OPEN.
   * @default 30_000
   */
  cooldownMs?: number;
  /**
   * Injectable wall-clock provider.
   * @default Date.now
   * Pass a custom function in tests to advance time without fake timers.
   */
  now?: () => number;
}

export interface CircuitBreakerMetrics {
  /** Current circuit state. */
  state: CircuitState;
  /** Number of consecutive failures since the last success (CLOSED) or trial failure (HALF_OPEN). */
  failureCount: number;
  /** Timestamp (ms) when the circuit was most recently tripped to OPEN. null if never opened. */
  openedAt: number | null;
  /** Total number of call() invocations (including OPEN rejections). */
  totalCalls: number;
  /** Number of calls that completed successfully. */
  successfulCalls: number;
  /** Number of calls that threw (excluding OPEN rejections). */
  failedCalls: number;
  /** Number of calls rejected because the circuit was OPEN. */
  circuitOpenRejections: number;
}

// ── CircuitBreaker ────────────────────────────────────────────────────────────

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount  = 0;
  private openedAt: number | null = null;

  // Metrics counters
  private totalCalls            = 0;
  private successfulCalls       = 0;
  private failedCalls           = 0;
  private circuitOpenRejections = 0;

  private readonly failureThreshold: number;
  private readonly cooldownMs:        number;
  private readonly now:               () => number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs       = options.cooldownMs       ?? 30_000;
    this.now              = options.now              ?? Date.now;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** The current state (always up-to-date: evaluates OPEN→HALF_OPEN transition). */
  get currentState(): CircuitState {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  /**
   * Execute `fn` through the circuit breaker.
   *
   * - CLOSED:    runs `fn`; records success or failure.
   * - OPEN:      throws `CircuitOpenError` immediately (no call to `fn`).
   * - HALF_OPEN: runs `fn` as a single trial; transitions on outcome.
   *
   * @throws {CircuitOpenError} when the circuit is OPEN.
   * @throws any error thrown by `fn` after recording the failure.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;
    this.maybeTransitionToHalfOpen();

    if (this.state === 'OPEN') {
      this.circuitOpenRejections++;
      throw new CircuitOpenError();
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      // Re-throw CircuitOpenError without double-counting
      if (err instanceof CircuitOpenError) throw err;
      this.onFailure();
      throw err;
    }
  }

  /** Return a snapshot of the current metrics. */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state:                 this.currentState,
      failureCount:          this.failureCount,
      openedAt:              this.openedAt,
      totalCalls:            this.totalCalls,
      successfulCalls:       this.successfulCalls,
      failedCalls:           this.failedCalls,
      circuitOpenRejections: this.circuitOpenRejections,
    };
  }

  /**
   * Reset the breaker to its initial CLOSED state and zero all counters.
   * Useful for tests and manual operator intervention.
   */
  reset(): void {
    this.state                 = 'CLOSED';
    this.failureCount          = 0;
    this.openedAt              = null;
    this.totalCalls            = 0;
    this.successfulCalls       = 0;
    this.failedCalls           = 0;
    this.circuitOpenRejections = 0;
  }

  // ── Internal state machine ──────────────────────────────────────────────────

  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === 'OPEN' &&
      this.openedAt !== null &&
      this.now() - this.openedAt >= this.cooldownMs
    ) {
      this.state = 'HALF_OPEN';
    }
  }

  private onSuccess(): void {
    this.successfulCalls++;

    if (this.state === 'HALF_OPEN') {
      // Trial succeeded — fully recover.
      this.state        = 'CLOSED';
      this.failureCount = 0;
      this.openedAt     = null;
    } else if (this.state === 'CLOSED') {
      // Reset consecutive-failure counter on any success.
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failedCalls++;

    if (this.state === 'HALF_OPEN') {
      // Trial failed — go back to OPEN and restart cooldown.
      this.state    = 'OPEN';
      this.openedAt = this.now();
      return;
    }

    // CLOSED state: increment and maybe trip.
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state    = 'OPEN';
      this.openedAt = this.now();
    }
  }
}
