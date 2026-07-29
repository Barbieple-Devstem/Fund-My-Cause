/**
 * Alert transport abstraction — Issue #907
 *
 * Defines a transport-agnostic interface for delivering alerts so that
 * rule-evaluation logic has no knowledge of how alerts are ultimately sent.
 *
 * Implementations:
 *   - EmailAlertTransport   — formats and "sends" an email notification
 *   - SlackAlertTransport   — formats and posts a Slack message
 *   - CompositeAlertTransport — fans out to multiple transports simultaneously
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** The normalized payload that every transport receives. */
export interface AlertPayload {
  /** Identifier of the rule that fired. */
  ruleId: string;
  /** Severity of the alert. */
  severity: 'critical' | 'warning' | 'info';
  /** Human-readable message describing what fired. */
  message: string;
  /** Key/value context captured at evaluation time (metric name, value, threshold, etc.). */
  context: Record<string, unknown>;
  /** ISO-8601 timestamp of when the alert was generated. */
  timestamp: string;
}

/**
 * Transport-agnostic delivery interface.
 *
 * Rule evaluation calls `deliver()` with a fully formed `AlertPayload`.
 * The transport is responsible for formatting and dispatching the payload
 * to its specific channel — email, Slack, PagerDuty, webhook, etc.
 */
export interface AlertTransport {
  /**
   * Deliver an alert payload.
   * Must resolve when delivery is complete (or immediately for fire-and-forget
   * implementations that queue internally).
   */
  deliver(payload: AlertPayload): Promise<void>;
}

// ── Email ─────────────────────────────────────────────────────────────────────

export interface EmailAlertTransportOptions {
  /** Recipient address. */
  to: string;
  /** Optional prefix prepended to every subject line (e.g. "[PROD]"). */
  subjectPrefix?: string;
}

/**
 * Simulated email transport.
 *
 * In production this would call an SMTP library or an email API (e.g. SES,
 * SendGrid).  Here it logs a formatted representation so the service can run
 * without real mail credentials.
 */
export class EmailAlertTransport implements AlertTransport {
  private readonly to: string;
  private readonly subjectPrefix: string;

  constructor(options: EmailAlertTransportOptions) {
    this.to = options.to;
    this.subjectPrefix = options.subjectPrefix ?? '[Alert]';
  }

  async deliver(payload: AlertPayload): Promise<void> {
    const subject = `${this.subjectPrefix} [${payload.severity.toUpperCase()}] ${payload.message}`;
    const body = [
      `Rule:      ${payload.ruleId}`,
      `Severity:  ${payload.severity}`,
      `Message:   ${payload.message}`,
      `Timestamp: ${payload.timestamp}`,
      `Context:   ${JSON.stringify(payload.context, null, 2)}`,
    ].join('\n');

    // Simulated send — replace with real mailer in production.
    console.log(`[EmailAlertTransport] Sending to: ${this.to}`);
    console.log(`[EmailAlertTransport] Subject: ${subject}`);
    console.log(`[EmailAlertTransport] Body:\n${body}`);
  }
}

// ── Slack ─────────────────────────────────────────────────────────────────────

export interface SlackAlertTransportOptions {
  /** Slack channel name or ID (e.g. "#alerts-prod"). */
  channel: string;
  /**
   * Incoming webhook URL.
   * Required in production; may be omitted in tests/dev where delivery is
   * simulated via console output.
   */
  webhookUrl?: string;
}

/** Emoji map for severity levels. */
const SEVERITY_EMOJI: Record<AlertPayload['severity'], string> = {
  critical: '🔴',
  warning:  '🟡',
  info:     '🔵',
};

/**
 * Simulated Slack transport.
 *
 * In production this would POST a Block Kit payload to the configured
 * Incoming Webhook URL.  Here it logs the formatted message.
 */
export class SlackAlertTransport implements AlertTransport {
  private readonly channel: string;
  private readonly webhookUrl: string | undefined;

  constructor(options: SlackAlertTransportOptions) {
    this.channel = options.channel;
    this.webhookUrl = options.webhookUrl;
  }

  async deliver(payload: AlertPayload): Promise<void> {
    const emoji = SEVERITY_EMOJI[payload.severity];
    const text = [
      `${emoji} *[${payload.severity.toUpperCase()}]* ${payload.message}`,
      `*Rule:* ${payload.ruleId}`,
      `*Time:* ${payload.timestamp}`,
      `*Context:* \`${JSON.stringify(payload.context)}\``,
    ].join('\n');

    if (this.webhookUrl) {
      // Production path — POST to Slack Incoming Webhook.
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: this.channel, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`Slack delivery failed: HTTP ${res.status}`);
      }
    } else {
      // Simulated path — log to console.
      console.log(`[SlackAlertTransport] Channel: ${this.channel}`);
      console.log(`[SlackAlertTransport] Message:\n${text}`);
    }
  }
}

// ── Composite ─────────────────────────────────────────────────────────────────

/**
 * Fans out delivery to multiple transports simultaneously via Promise.allSettled.
 *
 * Individual transport failures are logged but do not prevent the other
 * transports from receiving the alert.
 */
export class CompositeAlertTransport implements AlertTransport {
  private readonly transports: AlertTransport[];

  constructor(transports: AlertTransport[]) {
    if (transports.length === 0) {
      throw new Error('CompositeAlertTransport requires at least one transport');
    }
    this.transports = transports;
  }

  async deliver(payload: AlertPayload): Promise<void> {
    const results = await Promise.allSettled(
      this.transports.map((t) => t.deliver(payload)),
    );

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      const messages = failures.map((f) => String(f.reason)).join('; ');
      console.error(
        `[CompositeAlertTransport] ${failures.length}/${results.length} transport(s) failed: ${messages}`,
      );
    }
  }
}
