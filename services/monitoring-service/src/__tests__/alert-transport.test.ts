/**
 * Unit tests for alert transport implementations — Issue #907
 *
 * Tests confirm each transport correctly formats and "delivers" (to a test
 * double / captured output) a sample alert payload.
 */

import {
  EmailAlertTransport,
  SlackAlertTransport,
  CompositeAlertTransport,
  type AlertPayload,
} from '../alert-transport';

// ── Sample payload ────────────────────────────────────────────────────────────

const SAMPLE_PAYLOAD: AlertPayload = {
  ruleId:    'cpu-critical',
  severity:  'critical',
  message:   'CPU usage is 95 (above threshold 80)',
  context:   { metric: 'cpu_usage', value: 95, threshold: 80, service: 'api' },
  timestamp: '2026-07-29T15:00:00.000Z',
};

// ── EmailAlertTransport ───────────────────────────────────────────────────────

describe('EmailAlertTransport', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('resolves without throwing for a valid payload', async () => {
    const transport = new EmailAlertTransport({ to: 'ops@example.com' });
    await expect(transport.deliver(SAMPLE_PAYLOAD)).resolves.toBeUndefined();
  });

  it('logs the recipient address', async () => {
    const transport = new EmailAlertTransport({ to: 'ops@example.com' });
    await transport.deliver(SAMPLE_PAYLOAD);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('ops@example.com'),
    );
  });

  it('includes the rule ID and severity in logged output', async () => {
    const transport = new EmailAlertTransport({ to: 'ops@example.com' });
    await transport.deliver(SAMPLE_PAYLOAD);

    const loggedText = consoleSpy.mock.calls.flat().join(' ');
    expect(loggedText).toContain('cpu-critical');
    expect(loggedText).toContain('critical');
  });

  it('uses the default subject prefix when none is specified', async () => {
    const transport = new EmailAlertTransport({ to: 'ops@example.com' });
    await transport.deliver(SAMPLE_PAYLOAD);
    const loggedText = consoleSpy.mock.calls.flat().join(' ');
    expect(loggedText).toContain('[Alert]');
  });

  it('uses a custom subject prefix when provided', async () => {
    const transport = new EmailAlertTransport({ to: 'ops@example.com', subjectPrefix: '[PROD]' });
    await transport.deliver(SAMPLE_PAYLOAD);
    const loggedText = consoleSpy.mock.calls.flat().join(' ');
    expect(loggedText).toContain('[PROD]');
  });

  it('includes the alert message in logged output', async () => {
    const transport = new EmailAlertTransport({ to: 'ops@example.com' });
    await transport.deliver(SAMPLE_PAYLOAD);
    const loggedText = consoleSpy.mock.calls.flat().join(' ');
    expect(loggedText).toContain(SAMPLE_PAYLOAD.message);
  });

  it('includes the ISO timestamp', async () => {
    const transport = new EmailAlertTransport({ to: 'ops@example.com' });
    await transport.deliver(SAMPLE_PAYLOAD);
    const loggedText = consoleSpy.mock.calls.flat().join(' ');
    expect(loggedText).toContain(SAMPLE_PAYLOAD.timestamp);
  });
});

// ── SlackAlertTransport ───────────────────────────────────────────────────────

describe('SlackAlertTransport', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('resolves without throwing when no webhookUrl is set (simulated mode)', async () => {
    const transport = new SlackAlertTransport({ channel: '#alerts' });
    await expect(transport.deliver(SAMPLE_PAYLOAD)).resolves.toBeUndefined();
  });

  it('logs the channel name', async () => {
    const transport = new SlackAlertTransport({ channel: '#alerts-prod' });
    await transport.deliver(SAMPLE_PAYLOAD);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('#alerts-prod'));
  });

  it('includes the critical severity emoji for critical alerts', async () => {
    const transport = new SlackAlertTransport({ channel: '#alerts' });
    await transport.deliver(SAMPLE_PAYLOAD);
    const loggedText = consoleSpy.mock.calls.flat().join(' ');
    expect(loggedText).toContain('🔴');
  });

  it('includes the warning emoji for warning severity', async () => {
    const transport = new SlackAlertTransport({ channel: '#alerts' });
    await transport.deliver({ ...SAMPLE_PAYLOAD, severity: 'warning' });
    const loggedText = consoleSpy.mock.calls.flat().join(' ');
    expect(loggedText).toContain('🟡');
  });

  it('includes the info emoji for info severity', async () => {
    const transport = new SlackAlertTransport({ channel: '#alerts' });
    await transport.deliver({ ...SAMPLE_PAYLOAD, severity: 'info' });
    const loggedText = consoleSpy.mock.calls.flat().join(' ');
    expect(loggedText).toContain('🔵');
  });

  it('includes the rule ID in logged output', async () => {
    const transport = new SlackAlertTransport({ channel: '#alerts' });
    await transport.deliver(SAMPLE_PAYLOAD);
    const loggedText = consoleSpy.mock.calls.flat().join(' ');
    expect(loggedText).toContain('cpu-critical');
  });

  it('uses fetch to POST when webhookUrl is provided', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch as unknown as typeof fetch;

    const transport = new SlackAlertTransport({
      channel:    '#alerts',
      webhookUrl: 'https://hooks.slack.com/services/T000/B000/test',
    });
    await transport.deliver(SAMPLE_PAYLOAD);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.slack.com/services/T000/B000/test');
    expect(opts.method).toBe('POST');

    // Restore
    jest.restoreAllMocks();
  });

  it('throws when webhookUrl returns a non-ok response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    global.fetch = mockFetch as unknown as typeof fetch;

    const transport = new SlackAlertTransport({
      channel:    '#alerts',
      webhookUrl: 'https://hooks.slack.com/services/bad',
    });

    await expect(transport.deliver(SAMPLE_PAYLOAD)).rejects.toThrow('HTTP 500');
    jest.restoreAllMocks();
  });
});

// ── CompositeAlertTransport ───────────────────────────────────────────────────

class CaptureTransport {
  readonly received: AlertPayload[] = [];
  async deliver(payload: AlertPayload): Promise<void> {
    this.received.push(payload);
  }
}

class FailingTransport {
  async deliver(_payload: AlertPayload): Promise<void> {
    throw new Error('Simulated transport failure');
  }
}

describe('CompositeAlertTransport', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('throws when constructed with an empty transports array', () => {
    expect(() => new CompositeAlertTransport([])).toThrow();
  });

  it('fans out to all transports', async () => {
    const t1 = new CaptureTransport();
    const t2 = new CaptureTransport();
    const composite = new CompositeAlertTransport([t1, t2]);

    await composite.deliver(SAMPLE_PAYLOAD);

    expect(t1.received).toHaveLength(1);
    expect(t2.received).toHaveLength(1);
    expect(t1.received[0]).toEqual(SAMPLE_PAYLOAD);
    expect(t2.received[0]).toEqual(SAMPLE_PAYLOAD);
  });

  it('delivers to healthy transports even when one fails', async () => {
    const good    = new CaptureTransport();
    const failing = new FailingTransport();
    const composite = new CompositeAlertTransport([failing, good]);

    await composite.deliver(SAMPLE_PAYLOAD);

    expect(good.received).toHaveLength(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('logs failure details when a transport errors', async () => {
    const composite = new CompositeAlertTransport([new FailingTransport()]);
    await composite.deliver(SAMPLE_PAYLOAD);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Simulated transport failure'),
    );
  });

  it('resolves even if all transports fail', async () => {
    const composite = new CompositeAlertTransport([new FailingTransport(), new FailingTransport()]);
    await expect(composite.deliver(SAMPLE_PAYLOAD)).resolves.toBeUndefined();
  });

  it('delivers identical payload object to each transport', async () => {
    const t1 = new CaptureTransport();
    const t2 = new CaptureTransport();
    const composite = new CompositeAlertTransport([t1, t2]);

    await composite.deliver(SAMPLE_PAYLOAD);

    expect(t1.received[0]).toEqual(t2.received[0]);
  });
});
