# Load Testing

## Overview

Load tests validate API performance under realistic traffic patterns using Artillery.

## Setup

```bash
cd services/graphql-api
npm install
```

## Running Tests

```bash
# Run load test
npm run test:load

# Generate HTML report
npm run test:load:report
```

## Test Scenarios

| Scenario | Weight | Description |
|----------|--------|-------------|
| List campaigns | 40% | Paginated list query |
| Campaign detail | 30% | Single campaign fetch |
| Search campaigns | 20% | Full-text search |
| Campaign stats | 10% | Aggregated statistics |

## Load Phases

1. **Warm up** (60s): 10 req/s
2. **Sustained** (120s): 50 req/s
3. **Peak** (60s): 100 req/s

## Performance Baselines

### List Campaigns
- **p50**: < 50ms
- **p95**: < 150ms
- **p99**: < 300ms
- **Error rate**: < 0.1%

### Campaign Detail
- **p50**: < 30ms
- **p95**: < 100ms
- **p99**: < 200ms
- **Error rate**: < 0.1%

### Search
- **p50**: < 100ms
- **p95**: < 300ms
- **p99**: < 500ms
- **Error rate**: < 0.5%

## CI Integration

Smoke load test (10s, 5 req/s) runs on PR. Full test runs nightly.

## Troubleshooting

- **High latency**: Check cache hit rate
- **5xx errors**: Review server logs
- **Timeouts**: Increase `timeoutMS` in config
