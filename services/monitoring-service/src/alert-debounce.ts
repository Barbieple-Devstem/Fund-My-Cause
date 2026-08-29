/**
 * Debounced / stateful alert evaluation — Issue #1181
 *
 * `alert-rule.ts` evaluates every rule in isolation and is intentionally
 * stateless: a single metric reading that crosses a threshold fires an alert
 * immediately. In production that produces "flapping" — the same underlying
 * incident generates a storm of alerts as a noisy metric oscillates around the
 * threshold, and a momentary blip triggers a page that immediately clears.
 *
 * `DebouncedAlertEvaluator` wraps a set of {@link AlertRule}s and adds the
 * stateful layer the raw rules lack:
 *
 *   ok ──(triggered)──▶ pending ──(sustained ≥ debounceMs)──▶ alerting
 *    ▲                       │                                    │
 *    └────────(resolved)──────┴────────────────────────────────────┘
 *
 *   - pending: the rule has started triggering but has not yet been "on" for
 *     the full debounce window. No transport call is made yet.
 *   - alerting: the rule has been continuously triggering for `debounceMs`.
 *     The transport is notified exactly once, when the transition happens.
 *   - A "resolve" (a non-triggered evaluation) returns the rule to `ok`.
 *
 * Because the trigger→alert transition only happens after the signal is
 * sustained, transient noise (a single blip, or oscillation that keeps
 * resetting the pending timer) never reaches the transport. Once a rule is
 * `alerting`, continued triggering does not re-page; it must first resolve and
 * then debounce again.
 *
 * The evaluator is transport-agnostic: like `AlertRuleEvaluator`, it delegates
 * delivery to the injected {@link AlertTransport}.
 */

import type {
  AlertRule,
  AlertRuleContext,
  AlertRuleResult,
} from "./alert-rule";
import type { AlertTransport, AlertPayload } from "./alert-transport";

/** Lifecycle state of a single rule inside the debounced evaluator. */
export type AlertState = "ok" | "pending" | "alerting";

export interface DebouncedAlertEvaluatorOptions {
  /**
   * Debounce window in milliseconds. A rule must be continuously triggering for
   * at least this long before its alert is dispatched (and before it is
   * reported as `alerting`).
   */
  debounceMs: number;
  /**
   * Clock used to measure the debounce window. Injected so tests can advance
   * time deterministically instead of sleeping. Defaults to `Date.now`.
   */
  now?: () => number;
  /**
   * Invoked whenever a rule's {@link AlertState} changes. Useful for emitting
   * resolve notifications or feeding dashboards without coupling to transport.
   */
  onStateChange?: (
    ruleId: string,
    state: AlertState,
    previous: AlertState,
  ) => void;
}

interface RuleRuntime {
  state: AlertState;
  /** Timestamp (per `now()`) at which the rule entered `pending`. */
  pendingSince: number | null;
}

/**
 * Stateful, debounce-aware wrapper around a list of alert rules.
 *
 * @example
 * const evaluator = new DebouncedAlertEvaluator([cpuRule], transport, {
 *   debounceMs: 5_000,
 * });
 * await evaluator.evaluate({ metric: 'cpu_usage', value: 99, threshold: 80 });
 */
export class DebouncedAlertEvaluator {
  private readonly rules: AlertRule[];
  private readonly transport: AlertTransport;
  private readonly debounceMs: number;
  private readonly now: () => number;
  private readonly onStateChange?: (
    ruleId: string,
    state: AlertState,
    previous: AlertState,
  ) => void;
  private readonly runtime = new Map<string, RuleRuntime>();

  constructor(
    rules: AlertRule[],
    transport: AlertTransport,
    options: DebouncedAlertEvaluatorOptions,
  ) {
    if (options.debounceMs < 0) {
      throw new Error("debounceMs must be non-negative");
    }
    this.rules = rules;
    this.transport = transport;
    this.debounceMs = options.debounceMs;
    this.now = options.now ?? (() => Date.now());
    this.onStateChange = options.onStateChange;
  }

  private getRuntime(ruleId: string): RuleRuntime {
    let rt = this.runtime.get(ruleId);
    if (!rt) {
      rt = { state: "ok", pendingSince: null };
      this.runtime.set(ruleId, rt);
    }
    return rt;
  }

  /** Current lifecycle state of a rule (defaults to `ok` before first eval). */
  getAlertState(ruleId: string): AlertState {
    return this.getRuntime(ruleId).state;
  }

  /**
   * Evaluate every rule against `ctx`, applying the debounce state machine.
   *
   * @returns The raw {@link AlertRuleResult} for every rule (triggered or not),
   *          exactly as the underlying rules produced them.
   */
  async evaluate(ctx: AlertRuleContext): Promise<AlertRuleResult[]> {
    const results: AlertRuleResult[] = [];

    for (const rule of this.rules) {
      const result = rule.evaluate(ctx);
      results.push(result);

      if (!result.triggered) {
        this.resolve(rule.ruleId);
      } else {
        await this.handleTriggered(rule, result, ctx);
      }
    }

    return results;
  }

  /** A non-triggered reading returns the rule to its resting state. */
  private resolve(ruleId: string): void {
    const rt = this.getRuntime(ruleId);
    if (rt.state === "ok") {
      return; // already resting; nothing to do
    }
    const previous = rt.state;
    rt.state = "ok";
    rt.pendingSince = null;
    this.onStateChange?.(ruleId, "ok", previous);
  }

  /**
   * Apply a triggered reading to the debounce state machine and, once the
   * signal has been sustained for `debounceMs`, dispatch exactly one alert.
   */
  private async handleTriggered(
    rule: AlertRule,
    result: AlertRuleResult,
    ctx: AlertRuleContext,
  ): Promise<void> {
    const rt = this.getRuntime(rule.ruleId);
    const t = this.now();

    if (rt.state === "ok") {
      rt.state = "pending";
      rt.pendingSince = t;
      this.onStateChange?.(rule.ruleId, "pending", "ok");
      // A zero (or effectively zero) debounce means "alert on first trigger".
      if (this.debounceMs <= 0) {
        rt.state = "alerting";
        rt.pendingSince = null;
        this.onStateChange?.(rule.ruleId, "alerting", "pending");
        await this.dispatch(result, ctx);
      }
      return;
    }

    if (rt.state === "pending") {
      // Still inside the debounce window → wait, do not page yet.
      if (t - (rt.pendingSince as number) < this.debounceMs) {
        return;
      }
      // Debounce window satisfied → transition to alerting and dispatch once.
      rt.state = "alerting";
      rt.pendingSince = null;
      this.onStateChange?.(rule.ruleId, "alerting", "pending");
      await this.dispatch(result, ctx);
      return;
    }

    // state === 'alerting': sustained trigger, already paged. Do not re-dispatch
    // until the rule resolves and debounces again. This is what stops a
    // continuous incident from generating a stream of duplicate alerts.
  }

  private async dispatch(
    result: AlertRuleResult,
    ctx: AlertRuleContext,
  ): Promise<void> {
    const payload: AlertPayload = {
      ruleId: result.ruleId,
      severity: result.severity,
      message: result.message,
      context: { ...ctx, ...ctx.labels },
      timestamp: new Date().toISOString(),
    };
    await this.transport.deliver(payload);
  }
}
