import axios from 'axios';
import { emailTransport, slackTransport } from '../notifier';

// Set isolated port before importing app to start the server on it
const TEST_PORT = 9095;
process.env.PORT = String(TEST_PORT);
process.env.PAGERDUTY_API_KEY = 'mock-pd-key';

import app from '../index';

describe('Alert Delivery End-to-End Integration', () => {
  const serverUrl = `http://localhost:${TEST_PORT}`;

  beforeEach(() => {
    emailTransport.clear();
    slackTransport.clear();
    expect(app).toBeDefined();
  });

  afterAll(() => {
    // Give express server a moment to shutdown if needed, or rely on Jest exit
  });

  it('should deliver alerts to Email and Slack transports end-to-end', async () => {
    const payload = {
      alert_name: 'DatabaseConnectionFailure',
      severity: 'warning',
      description: 'Unable to connect to primary database host',
      category: 'database',
      source: 'test-suite',
    };

    const res = await axios.post(`${serverUrl}/incidents`, payload);
    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('id');
    expect(res.data.alert_name).toBe(payload.alert_name);

    // Assert Email delivery
    expect(emailTransport.delivered).toHaveLength(1);
    expect(emailTransport.delivered[0]).toMatchObject({
      title: payload.alert_name,
      description: payload.description,
      severity: payload.severity,
      channel: 'email',
    });

    // Assert Slack delivery
    expect(slackTransport.delivered).toHaveLength(1);
    expect(slackTransport.delivered[0]).toMatchObject({
      title: payload.alert_name,
      description: payload.description,
      severity: payload.severity,
      channel: 'slack',
    });
  });

  it('should handle transport failure gracefully without crashing', async () => {
    // Simulate Email transport throwing an error
    emailTransport.shouldFail = true;

    const payload = {
      alert_name: 'MemoryLeakAlert',
      severity: 'critical',
      description: 'Memory usage exceeds 95%',
      category: 'infrastructure',
      source: 'test-suite',
    };

    // Make request - should succeed despite Email transport failing
    const res = await axios.post(`${serverUrl}/incidents`, payload);
    expect(res.status).toBe(201);

    // Email delivery should have failed (none recorded)
    expect(emailTransport.delivered).toHaveLength(0);

    // Slack delivery should have still succeeded (independent of Email failure)
    expect(slackTransport.delivered).toHaveLength(1);
    expect(slackTransport.delivered[0].title).toBe(payload.alert_name);
  });
});
