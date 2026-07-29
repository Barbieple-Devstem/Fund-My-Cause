export interface AlertPayload {
  title: string;
  description: string;
  severity: string;
  channel: string;
  timestamp: string;
}

export class MockTransport {
  public delivered: AlertPayload[] = [];
  public shouldFail = false;

  async send(payload: AlertPayload): Promise<void> {
    if (this.shouldFail) {
      throw new Error(`Transport delivery failed for ${payload.channel}`);
    }
    this.delivered.push(payload);
  }

  clear() {
    this.delivered = [];
    this.shouldFail = false;
  }
}

export const emailTransport = new MockTransport();
export const slackTransport = new MockTransport();
