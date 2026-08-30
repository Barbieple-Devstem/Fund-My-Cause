/**
 * Unit tests for debounced / stateful alert evaluation — Issue #1181
 *
 * These tests exercise `DebouncedAlertEvaluator`, the stateful layer that wraps
 * the otherwise-stateless threshold/rate rules in `alert-rule.ts`. Time is
 * controlled with jest fake timers so the debounce window is deterministic and
 * no real `sleep()` is used.
 *
 * Transport is a test double — no real email/Slack/PagerDuty calls.
 */

import {
  ThresholdAlertRule,
  RateAlertRule,
  type AlertRuleContext,
} from "../alert-rule";
import { DebouncedAlertEvaluator, type AlertState } from "../alert-debounce";
import type { AlertTransport, AlertPayload } from "../alert-transport";

// ── Test double ───────────────────────────────────────────────────────────────

class MockAlertTransport implements AlertTransport {
  readonly delivered: AlertPayload[] = [];

  async deliver(payload: AlertPayload): Promise<void> {
    this.delivered.push(payload);
  }

  get callCount(): number {
    return this.delivered.length;
  }

  reset(): void {
    this.delivered.length = 0;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<AlertRuleContext> = {}): AlertRuleContext {
  return {
    metric: "cpu_usage",
    value: 50,
    threshold: 80,
    labels: { service: "api" },
    ...overrides,
  };
}

const aboveRule = () =>
  new ThresholdAlertRule({
    ruleId: "cpu-warn",
    direction: "above",
    severity: "warning",
  });

// Captures every state transition observed via `onStateChange`.
function makeStateLog() {
  const log: Array<{
    ruleId: string;
    state: AlertState;
    previous: AlertState;
  }> = [];
  const onStateChange = (
    ruleId: string,
    state: AlertState,
    previous: AlertState,
  ) => log.push({ ruleId, state, previous });
  return { log, onStateChange };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DebouncedAlertEvaluator — threshold trigger / resolve lifecycle", () => {
  let transport: MockAlertTransport;
  const DEBOUNCE = 5_000;

  beforeEach(() => {
    transport = new MockAlertTransport();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reports ok before any evaluation", () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });
    expect(ev.getAlertState("cpu-warn")).toBe("ok");
  });

  it("does not dispatch while the metric stays below threshold", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });
    await ev.evaluate(makeCtx({ value: 70 }));
    await ev.evaluate(makeCtx({ value: 40 }));
    expect(ev.getAlertState("cpu-warn")).toBe("ok");
    expect(transport.callCount).toBe(0);
  });

  it("enters pending but does not dispatch during the debounce window", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    // t=0: metric crosses above threshold.
    await ev.evaluate(makeCtx({ value: 95 }));
    expect(ev.getAlertState("cpu-warn")).toBe("pending");
    expect(transport.callCount).toBe(0);

    // Still inside the window — repeated triggers must not page yet.
    jest.advanceTimersByTime(2_000);
    await ev.evaluate(makeCtx({ value: 99 }));
    await ev.evaluate(makeCtx({ value: 91 }));
    expect(ev.getAlertState("cpu-warn")).toBe("pending");
    expect(transport.callCount).toBe(0);
  });

  it("dispatches exactly once after the debounce window elapses", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    await ev.evaluate(makeCtx({ value: 95 })); // pending @ 0
    jest.advanceTimersByTime(5_000); // total 5000ms → window satisfied
    await ev.evaluate(makeCtx({ value: 95 }));

    expect(ev.getAlertState("cpu-warn")).toBe("alerting");
    expect(transport.callCount).toBe(1);

    const payload = transport.delivered[0];
    expect(payload.ruleId).toBe("cpu-warn");
    expect(payload.severity).toBe("warning");
    expect(payload.message).toContain("cpu_usage");
    expect(typeof payload.timestamp).toBe("string");
  });

  it("does not re-dispatch while the incident remains sustained (alerting)", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    await ev.evaluate(makeCtx({ value: 95 }));
    jest.advanceTimersByTime(5_000);
    await ev.evaluate(makeCtx({ value: 95 })); // dispatches (1)

    // Many more sustained readings must NOT page again.
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(1_000);
      await ev.evaluate(makeCtx({ value: 100 }));
    }
    expect(transport.callCount).toBe(1);
  });

  it("resolves back to ok when the metric falls below threshold", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    await ev.evaluate(makeCtx({ value: 95 }));
    jest.advanceTimersByTime(5_000);
    await ev.evaluate(makeCtx({ value: 95 })); // alerting
    expect(transport.callCount).toBe(1);

    await ev.evaluate(makeCtx({ value: 60 })); // resolved
    expect(ev.getAlertState("cpu-warn")).toBe("ok");
    expect(transport.callCount).toBe(1); // no extra dispatch on resolve
  });

  it("treats a metric exactly at threshold as within bounds (no trigger)", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });
    await ev.evaluate(makeCtx({ value: 80, threshold: 80 })); // equality is not "above"
    expect(ev.getAlertState("cpu-warn")).toBe("ok");
    expect(transport.callCount).toBe(0);
  });

  it("only re-alerts after a full fresh debounce following a resolve", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    // First incident.
    await ev.evaluate(makeCtx({ value: 95 }));
    jest.advanceTimersByTime(5_000);
    await ev.evaluate(makeCtx({ value: 95 })); // dispatch #1
    await ev.evaluate(makeCtx({ value: 60 })); // resolve

    // Second incident begins immediately — must debounce again from scratch.
    await ev.evaluate(makeCtx({ value: 95 })); // pending @ ~5000ms
    expect(ev.getAlertState("cpu-warn")).toBe("pending");
    expect(transport.callCount).toBe(1);

    jest.advanceTimersByTime(5_000);
    await ev.evaluate(makeCtx({ value: 95 })); // dispatch #2
    expect(ev.getAlertState("cpu-warn")).toBe("alerting");
    expect(transport.callCount).toBe(2);
  });
});

describe("DebouncedAlertEvaluator — flapping / debounce behavior", () => {
  let transport: MockAlertTransport;
  const DEBOUNCE = 5_000;

  beforeEach(() => {
    transport = new MockAlertTransport();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("never pages for rapid oscillation around the threshold", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    // Oscillate above/below every 500ms for well over the debounce window.
    // Each "below" resolves the pending state, so the rule can never stay
    // triggered for the full 5s window.
    for (let i = 0; i < 30; i++) {
      jest.advanceTimersByTime(500);
      await ev.evaluate(makeCtx({ value: i % 2 === 0 ? 95 : 50 }));
    }

    expect(ev.getAlertState("cpu-warn")).toBe("ok");
    expect(transport.callCount).toBe(0);
  });

  it("ignores repeated trigger attempts during the debounce period", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    await ev.evaluate(makeCtx({ value: 95 })); // pending @ 0
    for (let t = 500; t < 5_000; t += 500) {
      jest.advanceTimersByTime(500);
      await ev.evaluate(makeCtx({ value: 95 }));
    }
    expect(ev.getAlertState("cpu-warn")).toBe("pending");
    expect(transport.callCount).toBe(0);
  });

  it("keeps the alert suppressed through repeated resolve/trigger flaps during debounce", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    await ev.evaluate(makeCtx({ value: 95 })); // pending @ 0
    jest.advanceTimersByTime(2_000);
    await ev.evaluate(makeCtx({ value: 50 })); // resolve → ok @ 2000
    await ev.evaluate(makeCtx({ value: 95 })); // pending again @ 2000
    jest.advanceTimersByTime(2_000);
    await ev.evaluate(makeCtx({ value: 50 })); // resolve → ok @ 4000
    await ev.evaluate(makeCtx({ value: 95 })); // pending again @ 4000

    expect(ev.getAlertState("cpu-warn")).toBe("pending");
    expect(transport.callCount).toBe(0);
  });

  it("dispatches once a stable metric is sustained past the debounce window", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    await ev.evaluate(makeCtx({ value: 95 })); // pending @ 0
    jest.advanceTimersByTime(10_000);
    await ev.evaluate(makeCtx({ value: 96 })); // sustained → alerting

    expect(ev.getAlertState("cpu-warn")).toBe("alerting");
    expect(transport.callCount).toBe(1);
  });

  it("does not produce repeated alerts from a single blip after alerting", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    await ev.evaluate(makeCtx({ value: 95 }));
    jest.advanceTimersByTime(5_000);
    await ev.evaluate(makeCtx({ value: 95 })); // dispatch #1, alerting

    // A single brief dip (blip) then recovery must not re-page.
    await ev.evaluate(makeCtx({ value: 50 })); // resolve → ok
    jest.advanceTimersByTime(1_000);
    await ev.evaluate(makeCtx({ value: 95 })); // pending again, window not elapsed
    expect(ev.getAlertState("cpu-warn")).toBe("pending");
    expect(transport.callCount).toBe(1);
  });

  it("respects the debounce window boundary: dispatches only at/after the full window", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: DEBOUNCE,
    });

    await ev.evaluate(makeCtx({ value: 95 })); // pending @ 0
    jest.advanceTimersByTime(DEBOUNCE - 1);
    await ev.evaluate(makeCtx({ value: 95 }));
    expect(transport.callCount).toBe(0); // one millisecond short

    jest.advanceTimersByTime(1);
    await ev.evaluate(makeCtx({ value: 95 }));
    expect(transport.callCount).toBe(1); // exactly at the boundary
  });
});

describe("DebouncedAlertEvaluator — edge cases", () => {
  let transport: MockAlertTransport;

  beforeEach(() => {
    transport = new MockAlertTransport();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns empty results and dispatches nothing for an empty rule list", async () => {
    const ev = new DebouncedAlertEvaluator([], transport, {
      debounceMs: 5_000,
    });
    const results = await ev.evaluate(makeCtx({ value: 99 }));
    expect(results).toEqual([]);
    expect(transport.callCount).toBe(0);
  });

  it("does not dispatch on a single observation when debounce > 0", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: 5_000,
    });
    await ev.evaluate(makeCtx({ value: 99 }));
    expect(ev.getAlertState("cpu-warn")).toBe("pending");
    expect(transport.callCount).toBe(0);
  });

  it("dispatches immediately on a single observation when debounceMs is 0", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: 0,
    });
    await ev.evaluate(makeCtx({ value: 99 }));
    expect(ev.getAlertState("cpu-warn")).toBe("alerting");
    expect(transport.callCount).toBe(1);
  });

  it("does not trigger for a missing (undefined) metric value", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: 5_000,
    });
    await ev.evaluate(makeCtx({ value: undefined as unknown as number }));
    expect(ev.getAlertState("cpu-warn")).toBe("ok");
    expect(transport.callCount).toBe(0);
  });

  it("does not trigger for an invalid (NaN) metric value", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: 5_000,
    });
    await ev.evaluate(makeCtx({ value: Number.NaN }));
    expect(ev.getAlertState("cpu-warn")).toBe("ok");
    expect(transport.callCount).toBe(0);
  });

  it("handles unusual thresholds (zero and negative) correctly", async () => {
    const zeroRule = new ThresholdAlertRule({
      ruleId: "zero",
      direction: "above",
      severity: "info",
    });
    const ev = new DebouncedAlertEvaluator([zeroRule], transport, {
      debounceMs: 0,
    });

    await ev.evaluate(makeCtx({ metric: "count", value: -1, threshold: 0 }));
    expect(ev.getAlertState("zero")).toBe("ok"); // -1 is not above 0

    await ev.evaluate(makeCtx({ metric: "count", value: 1, threshold: 0 }));
    expect(ev.getAlertState("zero")).toBe("alerting"); // 1 is above 0
  });

  it("handles extreme values (Infinity / -Infinity)", async () => {
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: 0,
    });

    await ev.evaluate(
      makeCtx({ value: Number.POSITIVE_INFINITY, threshold: 80 }),
    );
    expect(ev.getAlertState("cpu-warn")).toBe("alerting");

    await ev.evaluate(
      makeCtx({ value: Number.NEGATIVE_INFINITY, threshold: 80 }),
    );
    expect(ev.getAlertState("cpu-warn")).toBe("ok");
  });

  it("works with rate-based rules as the underlying rule", async () => {
    const rateRule = new RateAlertRule({
      ruleId: "error-spike",
      direction: "increase",
      severity: "critical",
    });
    const ev = new DebouncedAlertEvaluator([rateRule], transport, {
      debounceMs: 5_000,
    });

    // value jumps 10→120 in 10s → rate 11/s > threshold 5/s → triggered.
    await ev.evaluate(
      makeCtx({
        metric: "errors",
        value: 120,
        previousValue: 10,
        windowSeconds: 10,
        threshold: 5,
      }),
    );
    expect(ev.getAlertState("error-spike")).toBe("pending");
    jest.advanceTimersByTime(5_000);
    await ev.evaluate(
      makeCtx({
        metric: "errors",
        value: 120,
        previousValue: 10,
        windowSeconds: 10,
        threshold: 5,
      }),
    );
    expect(ev.getAlertState("error-spike")).toBe("alerting");
    expect(transport.callCount).toBe(1);
  });

  it("invokes onStateChange for every transition", async () => {
    const { log, onStateChange } = makeStateLog();
    const ev = new DebouncedAlertEvaluator([aboveRule()], transport, {
      debounceMs: 5_000,
      onStateChange,
    });

    await ev.evaluate(makeCtx({ value: 95 })); // ok → pending
    jest.advanceTimersByTime(5_000);
    await ev.evaluate(makeCtx({ value: 95 })); // pending → alerting
    await ev.evaluate(makeCtx({ value: 50 })); // alerting → ok

    expect(log).toEqual([
      { ruleId: "cpu-warn", state: "pending", previous: "ok" },
      { ruleId: "cpu-warn", state: "alerting", previous: "pending" },
      { ruleId: "cpu-warn", state: "ok", previous: "alerting" },
    ]);
  });

  it("rejects a negative debounceMs", () => {
    expect(
      () =>
        new DebouncedAlertEvaluator([aboveRule()], transport, {
          debounceMs: -1,
        }),
    ).toThrow();
  });
});
