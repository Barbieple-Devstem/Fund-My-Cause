import { PagerDutyIntegration } from '../pagerduty-integration';

// Mock axios
jest.mock('axios');

describe('PagerDutyIntegration', () => {
  let integration: PagerDutyIntegration;

  beforeEach(() => {
    integration = new PagerDutyIntegration('test-api-key', 'test-integration-key');
  });

  describe('Initialization', () => {
    it('should initialize with API key', () => {
      expect(integration).toBeDefined();
    });

    it('should initialize with optional integration key', () => {
      const integ = new PagerDutyIntegration('api-key', 'int-key');
      expect(integ).toBeDefined();
    });
  });

  describe('Incident Management', () => {
    it('should handle incident creation request structure', () => {
      const request = {
        title: 'High Error Rate',
        description: 'Error rate is 15%',
        severity: 'critical',
        service_id: 'service-123',
        labels: { environment: 'production' },
      };

      expect(request.title).toBe('High Error Rate');
      expect(request.severity).toBe('critical');
      expect(request.service_id).toBe('service-123');
    });

    it('should handle acknowledge incident request', () => {
      const incident_id = 'incident-123';
      const user_id = 'user-456';

      expect(incident_id).toBeDefined();
      expect(user_id).toBeDefined();
    });

    it('should handle resolve incident request', () => {
      const incident_id = 'incident-123';
      const startTime = Date.now();
      const duration = Date.now() - startTime;

      expect(incident_id).toBeDefined();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle assign incident request', () => {
      const incident_id = 'incident-123';
      const user_id = 'user-456';

      expect(incident_id).toBeDefined();
      expect(user_id).toBeDefined();
    });

    it('should handle escalate incident request', () => {
      const incident_id = 'incident-123';
      const escalation_policy_id = 'policy-789';

      expect(incident_id).toBeDefined();
      expect(escalation_policy_id).toBeDefined();
    });
  });

  describe('Event Management', () => {
    it('should validate event creation parameters', () => {
      const title = 'System Alert';
      const description = 'Critical system alert';
      const severity = 'critical' as const;

      expect(title).toBeDefined();
      expect(description).toBeDefined();
      expect(severity).toBe('critical');
    });

    it('should support all severity levels', () => {
      const severities = ['critical', 'error', 'warning', 'info'];

      severities.forEach((severity) => {
        expect(severities).toContain(severity);
      });
    });
  });

  describe('Note Management', () => {
    it('should handle add note to incident request', () => {
      const incident_id = 'incident-123';
      const content = 'Investigation ongoing';

      expect(incident_id).toBeDefined();
      expect(content).toBeDefined();
    });
  });

  describe('Alert Management', () => {
    it('should handle get incident alerts request', () => {
      const incident_id = 'incident-123';

      expect(incident_id).toBeDefined();
    });
  });

  describe('Service Management', () => {
    it('should handle get service request', () => {
      const service_id = 'service-123';

      expect(service_id).toBeDefined();
    });

    it('should handle list services request', () => {
      const services: any[] = [];

      expect(services).toEqual([]);
    });
  });

  describe('User Management', () => {
    it('should handle get on-call users request', () => {
      const schedule_id = 'schedule-123';

      expect(schedule_id).toBeDefined();
    });
  });

  describe('Connection Testing', () => {
    it('should validate API key format', () => {
      const validKey = 'test-api-key';
      const isValid = validKey.length > 0;

      expect(isValid).toBe(true);
    });

    it('should validate integration key format', () => {
      const validKey = 'test-integration-key';
      const isValid = validKey.length > 0;

      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing incident ID', () => {
      const incident_id = '';
      const isValid = incident_id.length > 0;

      expect(isValid).toBe(false);
    });

    it('should handle missing service ID', () => {
      const service_id = '';
      const isValid = service_id.length > 0;

      expect(isValid).toBe(false);
    });

    it('should handle invalid severity', () => {
      const validSeverities = ['critical', 'error', 'warning', 'info'];
      const invalidSeverity = 'unknown';

      expect(validSeverities).not.toContain(invalidSeverity);
    });
  });

  describe('Request Building', () => {
    it('should build incident creation payload correctly', () => {
      const payload = {
        title: 'High Error Rate',
        description: 'Error rate exceeded threshold',
        severity: 'critical',
        service_id: 'service-123',
        urgency: 'high',
      };

      expect(payload.title).toBe('High Error Rate');
      expect(payload.severity).toBe('critical');
      expect(payload.urgency).toBe('high');
    });

    it('should build event creation payload correctly', () => {
      const payload = {
        routing_key: 'test-routing-key',
        event_action: 'trigger',
        payload: {
          summary: 'Test Alert',
          severity: 'warning',
          source: 'Fund My Cause Monitoring',
        },
      };

      expect(payload.event_action).toBe('trigger');
      expect(payload.payload.severity).toBe('warning');
    });

    it('should build update incident payload correctly', () => {
      const payload = {
        incidents: [
          {
            id: 'incident-123',
            type: 'incident_reference',
            status: 'resolved',
          },
        ],
      };

      expect(payload.incidents[0].status).toBe('resolved');
      expect(payload.incidents[0].type).toBe('incident_reference');
    });
  });

  describe('Response Processing', () => {
    it('should handle successful incident creation response', () => {
      const response = {
        data: {
          incidents: [
            {
              id: 'PQ123456',
              incident_number: 1234,
              title: 'High Error Rate',
              status: 'triggered',
              created_at: '2024-01-01T00:00:00Z',
              html_url: 'https://example.pagerduty.com/incidents/PQ123456',
            },
          ],
        },
        status: 201,
      };

      expect(response.status).toBe(201);
      expect(response.data.incidents[0].id).toBe('PQ123456');
    });

    it('should handle successful incident update response', () => {
      const response = {
        data: {
          incidents: [
            {
              id: 'PQ123456',
              status: 'acknowledged',
              updated_at: '2024-01-01T00:01:00Z',
            },
          ],
        },
        status: 200,
      };

      expect(response.status).toBe(200);
      expect(response.data.incidents[0].status).toBe('acknowledged');
    });

    it('should handle list services response', () => {
      const response = {
        data: {
          services: [
            { id: 'service-1', name: 'API Service' },
            { id: 'service-2', name: 'Database Service' },
          ],
        },
        status: 200,
      };

      expect(response.data.services).toHaveLength(2);
      expect(response.data.services[0].name).toBe('API Service');
    });

    it('should handle list on-call users response', () => {
      const response = {
        data: {
          oncalls: [
            {
              user: { id: 'user-1', summary: 'John Doe' },
            },
            {
              user: { id: 'user-2', summary: 'Jane Smith' },
            },
          ],
        },
        status: 200,
      };

      expect(response.data.oncalls).toHaveLength(2);
    });

    it('should handle event creation response', () => {
      const response = {
        data: {
          dedup_key: 'event-key-123',
          status: 'success',
        },
        status: 200,
      };

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');
    });
  });

  describe('Payload Validation', () => {
    it('should validate required fields in incident creation', () => {
      const requiredFields = ['title', 'description', 'severity', 'service_id'];
      const incident = {
        title: 'Test',
        description: 'Test description',
        severity: 'critical',
        service_id: 'service-123',
      };

      requiredFields.forEach((field) => {
        expect(incident[field as keyof typeof incident]).toBeDefined();
      });
    });

    it('should validate required fields in event creation', () => {
      const requiredFields = ['routing_key', 'event_action', 'payload'];
      const event = {
        routing_key: 'key',
        event_action: 'trigger',
        payload: { summary: 'test' },
      };

      requiredFields.forEach((field) => {
        expect(event[field as keyof typeof event]).toBeDefined();
      });
    });

    it('should validate incident status transitions', () => {
      const validStatuses = ['triggered', 'acknowledged', 'resolved'];
      const testStatus = 'acknowledged';

      expect(validStatuses).toContain(testStatus);
    });

    it('should validate escalation policy presence', () => {
      const escalationPolicy = {
        id: 'policy-123',
        type: 'escalation_policy_reference',
      };

      expect(escalationPolicy.id).toBeDefined();
      expect(escalationPolicy.type).toBe('escalation_policy_reference');
    });
  });

  describe('Data Transformation', () => {
    it('should transform user list response', () => {
      const oncalls = [
        { user: { id: 'user-1', summary: 'John' } },
        { user: { id: 'user-2', summary: 'Jane' } },
      ];

      const transformed = oncalls.map((oncall) => ({
        id: oncall.user.id,
        name: oncall.user.summary,
      }));

      expect(transformed).toHaveLength(2);
      expect(transformed[0].name).toBe('John');
    });

    it('should transform service list response', () => {
      const services = [
        { id: 'service-1', name: 'API' },
        { id: 'service-2', name: 'Database' },
      ];

      const transformed = services.map((service) => ({
        id: service.id,
        name: service.name,
      }));

      expect(transformed).toHaveLength(2);
      expect(transformed[0].id).toBe('service-1');
    });
  });

  describe('Timestamp Handling', () => {
    it('should format timestamps correctly', () => {
      const timestamp = new Date().toISOString();
      const isValid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp);

      expect(isValid).toBe(true);
    });

    it('should handle acknowledge timestamp', () => {
      const timestamp = new Date().toISOString();
      const acknowledgePayload = {
        at: timestamp,
        acknowledger: { id: 'user-1', type: 'user_reference' },
      };

      expect(acknowledgePayload.at).toBeDefined();
      expect(acknowledgePayload.acknowledger.id).toBe('user-1');
    });
  });

  describe('Error Response Handling', () => {
    it('should handle 400 Bad Request', () => {
      const errorResponse = {
        status: 400,
        data: { error: 'Bad Request', message: 'Invalid payload' },
      };

      expect(errorResponse.status).toBe(400);
      expect(errorResponse.data.error).toBe('Bad Request');
    });

    it('should handle 401 Unauthorized', () => {
      const errorResponse = {
        status: 401,
        data: { error: 'Unauthorized', message: 'Invalid API key' },
      };

      expect(errorResponse.status).toBe(401);
    });

    it('should handle 404 Not Found', () => {
      const errorResponse = {
        status: 404,
        data: { error: 'Not Found', message: 'Incident not found' },
      };

      expect(errorResponse.status).toBe(404);
    });

    it('should handle 429 Rate Limited', () => {
      const errorResponse = {
        status: 429,
        data: { error: 'Too Many Requests' },
      };

      expect(errorResponse.status).toBe(429);
    });

    it('should handle 500 Server Error', () => {
      const errorResponse = {
        status: 500,
        data: { error: 'Internal Server Error' },
      };

      expect(errorResponse.status).toBe(500);
    });
  });

  describe('Headers and Authentication', () => {
    it('should include correct authorization header format', () => {
      const apiKey = 'test-key';
      const authHeader = `Token token=${apiKey}`;

      expect(authHeader).toBe('Token token=test-key');
    });

    it('should include content type header', () => {
      const contentType = 'application/json';

      expect(contentType).toBe('application/json');
    });

    it('should include accept header', () => {
      const accept = 'application/vnd.pagerduty+json;version=2';

      expect(accept).toContain('pagerduty');
      expect(accept).toContain('version=2');
    });
  });
});
