# API Autoscaling

## Overview
The Fund-My-Cause API uses multiple autoscaling strategies to handle varying loads efficiently.

## Scaling Policies

### Horizontal Pod Autoscaling (HPA)

| Metric | Target | Threshold | Behavior |
|--------|--------|-----------|----------|
| CPU Utilization | 70% | 70% | Scale up when exceeded |
| Memory Utilization | 80% | 80% | Scale up when exceeded |
| Requests Per Second | 100 | 100 req/s | Scale up when exceeded |

### Scaling Behavior

**Scale Up:**
- Add 2 pods every 30 seconds
- Or increase by 50% every 30 seconds
- No stabilization window (immediate)

**Scale Down:**
- Remove 1 pod every 60 seconds
- 5-minute stabilization window
- Prevents thrashing

### Pod Limits
- **Min:** 2 pods (for high availability)
- **Max:** 10 pods (to prevent over-scaling)

## Load Test Thresholds

### Target Performance

| Metric | Target | Critical |
|--------|--------|----------|
| Response Time (p95) | < 500ms | < 1000ms |
| Error Rate | < 0.5% | < 1% |
| Requests Per Second | > 50 | > 100 |

### Load Test Stages

| Stage | Users | Duration | Purpose |
|-------|-------|----------|---------|
| 1 | 50 | 2m | Ramp up to baseline |
| 2 | 50 | 3m | Steady state |
| 3 | 100 | 2m | Ramp up to medium |
| 4 | 100 | 3m | Medium load |
| 5 | 200 | 2m | Ramp up to peak |
| 6 | 200 | 3m | Peak load |
| 7 | 0 | 2m | Scale down |

## Running Load Tests

### Prerequisites
```bash
# Install k6
brew install k6  # macOS
sudo apt-get install k6  # Ubuntu
# Set environment variables
export API_URL=http://localhost:3000
export API_KEY=your-api-key

# Run load test
./scripts/load-test.sh
# View summary
cat performance/load-test-summary.json | jq '.'

# View detailed results
cat performance/load-test-results.json | jq '.'
kubectl describe hpa fund-my-cause-api-hpa
kubectl top pods
kubectl top nodes
kubectl describe deployment fund-my-cause-api
kubectl logs -f deployment/fund-my-cause-api
resources:
  requests:
    cpu: "500m"
    memory: "1Gi"
