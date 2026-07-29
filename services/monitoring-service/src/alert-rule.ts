/**
 * Alert rule evaluation — Issue #907
 *
 * Rule evaluation is entirely decoupled from notification transport.
 * Rules operate on raw metric values; when a rule fires it produces an
 * `AlertRuleResult` and delegates delivery to whatever `AlertTransport` was
 * injected at construction time.
 *
 * Structure:
 *   AlertRuleContext   — metric reading passed to every rule
 *   AlertRuleResult    — outcome of evaluating one rule
 *   AlertRule          — interface that every rule implements
 *   ThresholdAlertRule — fires when a value exceeds a static threshold
 *   RateAlertRule      — fires when a rate of change exceeds a threshold
 *   AlertRuleEvaluator — orchestrates a list of rules and calls transport on trigger
 */

import type { AlertTransport, AlertPayload } from './alert-transport.js';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Metric snapshot passed into every rule for evaluation. */
export interface AlertRuleContext {
  /** Name of the metric (e.g. "cpu_usage", "error_rate"). */
  metric: string;
  /** Current observed value. */
  value: number;
  /** Configured threshold value for this metric. */
  threshold: number;
  /**
   * Optional previous value — required by rate-based rules.
   * Ignored by threshold rules.
   */
  previousValue?: number;
  /**
   * Time window in seconds over which the rate is computed.
   * Required by rate-based rules; ignored by threshold rules.
   */
  windowSeconds?: number;
  /** Arbitrary key/value labels attached to this metric reading. */
  labels?: Record<string, string>;
}

/** Outcome produced by evaluating a single rule. */
export interface AlertRuleResult {
  /** Unique identifier of the rule that was evaluated. */
  ruleId: string;
  /** `true` if the rule conditions were satisfied (alert should fire). */
  triggered: boolean;
  /** Severity to assign when `triggered` is true. */
  severity: 'critical' | 'warning' | 'info';
  /** Human-readable explanation of the outcome. */
  message: string;
  /** The context snapshot that was used for evaluation. */
  context: AlertRuleContext;
}

/** Contract that every alert rule must satisfy. */
export interface AlertRule {
  /** Unique rule identifier. */
  readonly ruleId: string;
  /**
   * Evaluate the rule against a metric context.
   * Must not throw — malformed contexts produce a non-triggered result.
   */
  evaluate(ctx: AlertRuleContext): AlertRuleResult;
}

// ── ThresholdAlertRule ────────────────────────────────────────────────────────

export interface ThresholdAlertRuleOptions {
  /** Unique identifier for this rule instance. */
  ruleId: string;
  /**
   * The comparison direction:
   *   'above' — fires when value > threshold
   *   'below' — fires when value < threshold
   */
  direction: 'above' | 'below';
  /** Severity emitted when the rule fires. */
  severity: 'critical' | 'warning' | 'info';
}

/**
 * Fires when a metric value crosses a static threshold.
 *
 * Examples:
 *   new ThresholdAlertRule({ ruleId: 'cpu-critical', direction: 'above', severity: 'critical' })
 *   → triggers when ctx.value > ctx.threshold
 */
export class ThresholdAlertRule implements AlertRule {
  readonly ruleId: string;
  private readonly direction: 'above' | 'below';
  private readonly severity: 'critical' | 'warning' | 'info';

  constructor(options: ThresholdAlertRuleOptions) {
    this.ruleId = options.ruleId;
    this.direction = options.direction;
    this.severity = options.severity;
  }

  evaluate(ctx: AlertRuleContext): AlertRuleResult {
    const triggered =
      this.direction === 'above' ? ctx.value > ctx.threshold : ctx.value < ctx.threshold;

    const message = triggered
      ? `${ctx.metric} is ${ctx.value} (${this.direction} threshold ${ctx.threshold})`
      : `${ctx.metric} is within bounds (${ctx.value} vs threshold ${ctx.threshold})`;

    return {
      ruleId:    this.ruleId,
      triggered,
      severity:  this.severity,
      message,
      context:   ctx,
    };
  }
}

// ── RateAlertRule ─────────────────────────────────────────────────────────────

export interface RateAlertRuleOptions {
  /** Unique identifier for this rule instance. */
  ruleId: string;
  /**
   * The rate direction:
   *   'increase' — fires when the rate of change exceeds the threshold
   *   'decrease' — fires when the rate of change falls below -threshold
   */
  direction: 'increase' | 'decrease';
  /** Severity emitted when the rule fires. */
  severity: 'critical' | 'warning' | 'info';
}

/**
 * Fires when the per-second rate of change of a metric exceeds a threshold.
 *
 * Requires `ctx.previousValue` and `ctx.windowSeconds` to be set.
 * Returns a non-triggered result with an explanatory message when they are absent.
 */
export class RateAlertRule implements AlertRule {
  readonly ruleId: string;
  private readonly direction: 'increase' | 'decrease';
  private readonly severity: 'critical' | 'warning' | 'info';

  constructor(options: RateAlertRuleOptions) {
    this.ruleId = options.ruleId;
    this.direction = options.direction;
    this.severity = options.severity;
  }

  evaluate(ctx: AlertRuleContext): AlertRuleResult {
    if (ctx.previousValue === undefined || !ctx.windowSeconds || ctx.windowSeconds <= 0) {
      return {
        ruleId:    this.ruleId,
        triggered: false,
        severity:  this.severity,
        message:   `${ctx.metric}: insufficient data for rate calculation (need previousValue and windowSeconds)`,
        context:   ctx,
      };
    }

    const ratePerSecond = (ctx.value - ctx.previousValue) / ctx.windowSeconds;
    const triggered =
      this.direction === 'increase'
        ? ratePerSecond > ctx.threshold
        : ratePerSecond < -ctx.threshold;

    const direction = this.direction === 'increase' ? 'increased' : 'decreased';
    const message = triggered
      ? `${ctx.metric} ${direction} at ${ratePerSecond.toFixed(4)}/s (threshold ${ctx.threshold}/s)`
      : `${ctx.metric} rate is within bounds (${ratePerSecond.toFixed(4)}/s vs threshold ${ctx.threshold}/s)`;

    return {
      ruleId:    this.ruleId,
      triggered,
      severity:  this.severity,
      message,
      context:   ctx,
    };
  }
}

// ── AlertRuleEvaluator ────────────────────────────────────────────────────────

/**
 * Orchestrates evaluation of a list of alert rules against a metric context.
 *
 * The evaluator has no knowledge of how alerts are delivered — it delegates
 * entirely to the injected `AlertTransport`.  This is the primary decoupling
 * point addressed by Issue #907.
 *
 * Usage:
 *   const transport = new CompositeAlertTransport([emailTransport, slackTransport]);
 *   const evaluator = new AlertRuleEvaluator([rule1, rule2], transport);
 *   await evaluator.evaluate({ metric: 'cpu_usage', value: 92, threshold: 80, labels: {} });
 */
export class AlertRuleEvaluator {
  private readonly rules: AlertRule[];
  private readonly transport: AlertTransport;

  constructor(rules: AlertRule[], transport: AlertTransport) {
    this.rules = rules;
    this.transport = transport;
  }

  /**
   * Evaluate all rules against the supplied context.
   *
   * Rules that trigger cause `transport.deliver()` to be called.
   * Transport failures are surfaced as thrown errors so callers can decide
   * whether to retry or log and continue.
   *
   * @returns All evaluation results (triggered and non-triggered).
   */
  async evaluate(ctx: AlertRuleContext): Promise<AlertRuleResult[]> {
    const results: AlertRuleResult[] = [];

    for (const rule of this.rules) {
      const result = rule.evaluate(ctx);
      results.push(result);

      if (result.triggered) {
        const payload: AlertPayload = {
          ruleId:    result.ruleId,
          severity:  result.severity,
          message:   result.message,
          context:   { ...ctx, ...ctx.labels },
          timestamp: new Date().toISOString(),
        };
        await this.transport.deliver(payload);
      }
    }

    return results;
  }
}
