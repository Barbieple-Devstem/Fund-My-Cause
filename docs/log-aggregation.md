# Log Aggregation and Analysis Guide

Centralized logging for all Fund-My-Cause services with structured logging, log shipping, dashboards, and alerts.

## Overview

The logging infrastructure provides:

- **Log Aggregation**: Centralized collection from all services
- **Structured Logging**: JSON-formatted logs with context
- **Log Shipping**: Automatic log forwarding to aggregation service
- **Analysis Dashboards**: Real-time visualization and analysis
- **Log-based Alerts**: Automated alerting on log patterns

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Applications                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Frontend   │  │   Contract   │  │   Backend    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Log Shipper    │
                    │  (Promtail/     │
                    │   Filebeat)     │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───▼────┐          ┌───▼────┐          ┌───▼────┐
    │  Loki  │          │   ELK  │          │Datadog │
    └───┬────┘          └───┬────┘          └───┬────┘
        │                    │                    │
    ┌───▼────┐          ┌───▼────┐          ┌───▼────┐
    │ Grafana │          │ Kibana │          │Datadog │
    │Dashboard│          │Dashboard│         │Dashboard│
    └────────┘          └────────┘          └────────┘
```

## Log Aggregation Backends

### Loki (Recommended for small deployments)

**Pros:**
- Lightweight and efficient
- Native Grafana integration
- Low resource usage
- Easy to deploy

**Cons:**
- Limited query capabilities
- No full-text search
- Smaller ecosystem

**Setup:**
```bash
docker-compose -f docker-compose-logging.yml up -d loki grafana promtail
```

**Query Examples:**
```
# All frontend logs
{service="frontend"}

# Errors in last hour
{service="frontend"} | json | level="error" | __error__=""

# Specific campaign logs
{service="frontend"} | json | campaign_id="abc123"
```

### ELK Stack (Recommended for large deployments)

**Pros:**
- Full-featured search and analysis
- Powerful query language (KQL)
- Rich visualization options
- Large community

**Cons:**
- Higher resource usage
- More complex setup
- Requires tuning

**Setup:**
```bash
docker-compose -f docker-compose-logging.yml up -d elasticsearch logstash kibana
```

**Query Examples:**
```
# All frontend logs
service:frontend

# Errors in last hour
service:frontend AND level:error

# Specific campaign logs
service:frontend AND campaign_id:abc123
```

### Datadog (Recommended for managed service)

**Pros:**
- Fully managed
- Integrated monitoring
- Advanced analytics
- Professional support

**Cons:**
- Requires API key
- Pricing based on volume
- Vendor lock-in

**Setup:**
```bash
export DD_API_KEY=<your-api-key>
docker-compose -f docker-compose-logging.yml up -d datadog-agent
```

## Structured Logging

### Frontend Logging

Use Pino logger for structured logging:

```typescript
import logger from '@/lib/logger';

// Basic logging
logger.info('Campaign created', {
  campaign_id: 'abc123',
  creator: 'user456',
  goal: 1000,
});

// Error logging
logger.error('Failed to fetch campaign', {
  campaign_id: 'abc123',
  error: error.message,
  stack: error.stack,
});

// Debug logging
logger.debug('Wallet connected', {
  address: 'GXXXXXX',
  network: 'testnet',
});
```

### Contract Logging

Use Soroban logging for contract events:

```rust
use soroban_sdk::log;

pub fn contribute(env: Env, contributor: Address, amount: i128) {
    log!(&env, "Contribution received: contributor={}, amount={}", 
         contributor, amount);
    
    // ... contribution logic ...
    
    log!(&env, "Contribution processed successfully");
}
```

### Log Format

All logs follow this structure:

```json
{
  "timestamp": "2024-04-27T14:29:20.123Z",
  "level": "info",
  "service": "frontend",
  "message": "Campaign created",
  "campaign_id": "abc123",
  "creator": "user456",
  "goal": 1000,
  "duration_ms": 245,
  "environment": "production",
  "version": "1.0.0",
  "request_id": "req-789",
  "user_id": "user456"
}
```

## Log Shipping

### Promtail (for Loki)

Automatically ships logs from containers:

```yaml
clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker: {}
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        target_label: 'container'
      - source_labels: ['__meta_docker_container_label_service']
        target_label: 'service'
```

### Filebeat (for ELK)

Ships logs to Logstash:

```yaml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/fund-my-cause/*.log
    fields:
      service: fund-my-cause

output.logstash:
  hosts: ["logstash:5000"]
```

## Analysis Dashboards

### Grafana Dashboard (Loki)

Access at `http://localhost:3000`

**Panels:**
- Log volume over time
- Error rate trends
- Service-specific logs
- Request latency distribution
- Top errors

### Kibana Dashboard (ELK)

Access at `http://localhost:5601`

**Panels:**
- Log discovery
- Field analysis
- Time series visualization
- Geographic distribution
- Custom visualizations

## Log-based Alerts

### Alert Rules

```yaml
groups:
  - name: fund-my-cause
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(logs_total{level="error"}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
      
      # Contract failures
      - alert: ContractFailure
        expr: rate(logs_total{service="contract", level="error"}[5m]) > 0.01
        for: 2m
        annotations:
          summary: "Contract execution failures"
      
      # Frontend crashes
      - alert: FrontendCrash
        expr: rate(logs_total{service="frontend", message=~".*crash.*"}[5m]) > 0
        for: 1m
        annotations:
          summary: "Frontend service crash"
```

### Alert Channels

Configure notifications:

- **Email**: Send to ops team
- **Slack**: Post to #alerts channel
- **PagerDuty**: Trigger incidents
- **Webhook**: Custom integrations

## Log Retention

### Retention Policies

| Environment | Retention | Sampling |
|---|---|---|
| Development | 7 days | 100% |
| Staging | 30 days | 100% |
| Production | 90 days | 100% |

### Archival

Archive old logs to S3:

```bash
# Daily archival job
0 2 * * * /scripts/archive-logs.sh
```

## Best Practices

### 1. Structured Logging

Always use structured logging with context:

```typescript
// ✓ Good
logger.info('Payment processed', {
  transaction_id: 'txn123',
  amount: 100,
  currency: 'XLM',
  duration_ms: 245,
});

// ✗ Bad
logger.info('Payment processed for 100 XLM');
```

### 2. Log Levels

Use appropriate log levels:

- **DEBUG**: Development and troubleshooting
- **INFO**: Important business events
- **WARN**: Recoverable issues
- **ERROR**: Errors requiring attention
- **FATAL**: System failures

### 3. Sensitive Data

Never log sensitive information:

```typescript
// ✗ Bad - logs secret key
logger.info('User login', { secret_key: user.secret });

// ✓ Good - logs only necessary info
logger.info('User login', { user_id: user.id });
```

### 4. Performance

Avoid excessive logging:

```typescript
// ✗ Bad - logs every iteration
for (let i = 0; i < 1000; i++) {
  logger.debug('Processing item', { index: i });
}

// ✓ Good - logs summary
logger.debug('Processing items', { count: 1000, duration_ms: 245 });
```

### 5. Error Context

Include full error context:

```typescript
// ✓ Good
logger.error('Failed to fetch campaign', {
  campaign_id: 'abc123',
  error: error.message,
  stack: error.stack,
  status_code: error.status,
});
```

## Troubleshooting

### Logs Not Appearing

```bash
# Check log shipper status
docker logs promtail

# Verify connectivity
curl http://loki:3100/loki/api/v1/status

# Check application logs
docker logs fund-my-cause-frontend
```

### High Disk Usage

```bash
# Check log volume
du -sh /var/lib/docker/volumes/*/

# Reduce retention
# Update retention policy in loki-config.yml

# Archive old logs
/scripts/archive-logs.sh
```

### Query Performance

```bash
# Optimize queries
# Use specific time ranges
# Add label filters
# Avoid full-text search on large datasets

# Example optimized query
{service="frontend", level="error"} | __error__="" | duration_ms > 1000
```

## Integration Examples

### Slack Notifications

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# In alertmanager config
route:
  receiver: 'slack'

receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
```

### Custom Webhooks

```typescript
// Send logs to custom endpoint
logger.on('error', (log) => {
  fetch('https://api.example.com/logs', {
    method: 'POST',
    body: JSON.stringify(log),
  });
});
```

## Trace-ID Correlation

All Fund-My-Cause services propagate a `trace_id` field in every structured log
line.  This lets you filter an aggregation backend (Loki, Elasticsearch, Datadog)
to a single trace ID and see the complete cross-service picture for one request.

```
# Loki — all logs for one donation request across every service
{} | json | trace_id="fmc-67946a1b-3f8c2a0d9e4b71c2"

# Elasticsearch / Kibana
trace_id:"fmc-67946a1b-3f8c2a0d9e4b71c2"

# Datadog
@trace_id:fmc-67946a1b-3f8c2a0d9e4b71c2
```

The trace ID is generated once by `graphql-api` (or accepted from the inbound
`X-Trace-ID` header) and forwarded to `fraud_detection` and `indexer` via the
same header on outbound HTTP calls.

See [Logging Conventions](./logging-conventions.md) for the full specification,
including the ID format, generation rules, and how to add propagation to a new
service.

## See Also

- [Logging Conventions](./logging-conventions.md) — trace-ID format, generation, structured field reference
- [Monitoring Guide](./monitoring.md)
- [Deployment Guide](./deployment.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [ELK Stack Documentation](https://www.elastic.co/guide/index.html)
