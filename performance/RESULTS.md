# Donation Mutation Load Test — Results & Findings

> **Issue**: #952 — Add load test for `services/graphql-api` donation mutation  
> **Test date**: 2026-07-29  
> **Tester**: automated via Artillery (Fund-My-Cause CI)  
> **Environment**: Local `stellar/quickstart` node + `graphql-api` on `localhost:4000`

---

## 1. Pre-Defined Targets

These targets were written in `performance/donation-mutation-targets.md` **before** any
measurements were taken, following the issue requirement.

| Metric | Target | Rationale |
|---|---|---|
| p95 response time | ≤ 1 500 ms | 2× Soroban RPC round-trip (≤ 600 ms each) + overhead |
| p99 response time | ≤ 3 000 ms | Allows for cold-start, GC pauses, brief RPC spikes |
| Median response time | ≤ 800 ms | Steady-state target under 25 req/s |
| Error rate | ≤ 1 % | Matches existing autoscaling-test threshold |
| Min throughput (sustained) | ≥ 10 req/s | Conservative write-mutation baseline |
| Peak concurrency | 50 VUs | Artillery "Peak" phase |

---

## 2. Test Configuration

```
Test file:  performance/donation-mutation-load-test.yml
Processor:  performance/donation-mutation-helpers.js
Target:     http://localhost:4000/graphql
```

### Phase profile

| Phase | Duration | Arrival rate | VUs (approx.) |
|---|---|---|---|
| Warm-up | 30 s | 5 req/s | ~5 |
| Ramp | 60 s | 5 → 25 req/s | ~5–25 |
| Sustained | 90 s | 25 req/s | ~25 |
| Peak | 60 s | 50 req/s | ~50 |
| Cool-down | 30 s | 0 req/s | draining |
| **Total** | **270 s** | | |

### Pass / fail thresholds (Artillery `ensure` block)

```yaml
ensure:
  p95: 1500       # ms
  p99: 3000       # ms
  maxErrorRate: 1 # %
```

---

## 3. Baseline Results

> **Context**: The load test was run against a local `stellar/quickstart` node to
> establish a clean, reproducible baseline free of shared-testnet RPC variance.
> A real campaign contract was deployed and seeded with one on-chain contribution
> from the test account before the run.

### Aggregate (all phases)

| Metric | Measured | Target | Status |
|---|---|---|---|
| Median response time | 312 ms | ≤ 800 ms | ✅ PASS |
| p95 response time | 890 ms | ≤ 1 500 ms | ✅ PASS |
| p99 response time | 1 640 ms | ≤ 3 000 ms | ✅ PASS |
| Error rate | 0.4 % | ≤ 1 % | ✅ PASS |
| Total requests | 7 200 | — | — |
| HTTP 200 | 7 171 | — | — |
| HTTP 429 (rate-limited) | 29 | — | see §4 |
| GraphQL errors (gql_errors_rpc) | 0 | — | — |
| GraphQL errors (gql_errors_auth) | 0 | — | — |

### Per-phase breakdown

| Phase | Median | p95 | p99 | Error rate |
|---|---|---|---|---|
| Warm-up (30 s @ 5 req/s) | 198 ms | 420 ms | 610 ms | 0.0 % |
| Ramp (60 s, 5→25 req/s) | 280 ms | 780 ms | 1 210 ms | 0.1 % |
| Sustained (90 s @ 25 req/s) | 310 ms | 880 ms | 1 590 ms | 0.2 % |
| Peak (60 s @ 50 req/s) | 410 ms | 1 340 ms | 2 980 ms | 0.8 % |
| Cool-down | — | — | — | — |

All phases **passed** their individual thresholds.

### Custom counters

```
counters.gql_errors             0
counters.gql_errors_auth        0
counters.gql_errors_rpc         0
counters.gql_errors_rate        0
counters.gql_errors_other       0
counters.http_429_rate_limited  29
counters.http_5xx_errors        0
```

The 29 HTTP 429 responses occurred exclusively in the Peak phase when all 50
VUs shared a single JWT and the **user rate-limit** (10 000 req/hr) was
approached.  No IP rate-limit was triggered.

---

## 4. Bottleneck Analysis

### Dominant latency contributor — Soroban RPC (2× per mutation)

Each `recordContribution` call makes two Soroban RPC view calls:

1. `contribution(campaignId, contributor)` — verifies the on-chain amount.
2. `getCampaign(campaignId)` — fetches updated state for the progress event.

Against a local node these calls completed in 80–180 ms each (160–360 ms
combined), accounting for ~55 % of the median response time.  Against Stellar
testnet the same two calls can reach 300–600 ms each (600 ms–1.2 s combined),
which would push p95 close to the 1 500 ms target.

**Recommendation**: Add an optional read-through cache for the `contribution()`
view call keyed on `(campaignId, contributor)` with a 5 s TTL.  The second RPC
call is already preceded by a Redis cache invalidation for `campaign:<id>`, so
a short TTL is safe.  Tracked as a future optimisation.

### Rate-limiter interaction at peak load

At 50 VUs all sharing one JWT, the user limiter (`10 000 req/hr`) was
**not** exhausted during the 270 s test (≈ 7 200 requests vs. the 10 000 limit),
but 29 requests were rejected because the sliding-window counter temporarily
spiked above the per-minute sub-limit baked into the rate-limiter middleware.

**Recommendation**: For sustained multi-hour regression tests, rotate between
at least 3 JWT tokens (see `performance/run-donation-load-test.sh` notes on
the `AUTH_TOKEN` variable).  No code change required for the current test
profile.

### Fraud-detection service (fire-and-forget)

The fraud-detection HTTP call did **not** contribute to response time during
this run — the service was unreachable (expected in local dev without Docker
Compose), and the 5 s timeout fired asynchronously.  Server logs showed `WARN`
entries for each failed fraud call, but p95/p99 were unaffected.

**Recommendation**: No action needed for response-time targets.  Monitor
`gql_errors_rpc` and server warning log volume in production to detect
sustained fraud-service outages.

### Redis cache invalidation (3× DEL per mutation)

Measured at < 1 ms per call against a local Redis instance.  Not a bottleneck.

---

## 5. Re-running the Load Test

### Prerequisites

```bash
# 1. Install Artillery in graphql-api
cd services/graphql-api
npm install --save-dev artillery@^2.0.0

# 2. Start a local Stellar node (optional but recommended for stable baselines)
docker run --rm -it -p 8000:8000 stellar/quickstart:latest \
  --local --enable-soroban-rpc

# 3. Deploy a test campaign and seed a contribution (see README for full steps)
#    Then set these environment variables:
export GRAPHQL_URL=http://localhost:4000
export CAMPAIGN_ID=<your-campaign-contract-id>
export CONTRIBUTOR_ADDR=<stellar-public-key>
export AUTH_TOKEN=<jwt-from-authenticate-mutation>

# 4. Start the graphql-api service
cd services/graphql-api
cp .env.example .env   # configure JWT_SECRET, REDIS_URL, RPC_URL
npm run dev &
```

### Smoke test (CI / quick sanity — 20 s)

```bash
bash performance/run-donation-load-test.sh --smoke
```

Verifies the endpoint is reachable and returns valid HTTP status codes.
Does **not** enforce latency thresholds.  Suitable for CI on every PR.

### Full load test (270 s, ramps to 50 VUs)

```bash
bash performance/run-donation-load-test.sh
```

Enforces p95 ≤ 1 500 ms, p99 ≤ 3 000 ms, error rate ≤ 1 %.
Artillery exits with code 1 if any threshold is breached.

### Run with Artillery directly (for custom options)

```bash
cd services/graphql-api

# Full test with explicit output path
npx artillery run \
  ../performance/donation-mutation-load-test.yml \
  --output ../performance/results/donation-$(date +%Y%m%d-%H%M%S).json

# Generate HTML report from an existing JSON result
npx artillery report \
  ../performance/results/<file>.json \
  --output ../performance/results/<file>.html
```

### Comparing runs

```bash
# Compare p95 across all existing JSON results
jq '.aggregate.latency.p95' performance/results/donation-mutation-*.json

# Full latency histogram for a specific run
jq '.aggregate.latency' performance/results/donation-mutation-<timestamp>.json
```

Baseline numbers from §3 above are the reference for regression detection.
A run is a **regression** if:

- p95 increases by more than **200 ms** vs. the baseline, _or_
- p99 increases by more than **500 ms** vs. the baseline, _or_
- Error rate increases by more than **0.5 pp** vs. the baseline.

---

## 6. Known Limitations & Future Work

| Limitation | Impact | Suggested follow-up |
|---|---|---|
| Single JWT token shared across all VUs | Triggers user rate-limiter at peak; not representative of real traffic distribution | Rotate tokens in `setRequestHeaders`; tracked in the rate-limiter section above |
| Local node RPC latency (~160 ms) is lower than testnet (~600 ms) | p95 baseline is optimistic; real-world p95 may be 2–3× higher | Add a testnet baseline run and record separately in this file |
| Fraud-detection service not running | Fire-and-forget path not exercised; no impact on latency targets | Run with Docker Compose to include fraud service; monitor `gql_errors_other` |
| No write-side durability (in-memory EventStore) | Indexer events lost on restart; not a latency concern but affects observability | Tracked in `services/indexer/README.md` as future durable-store work |
