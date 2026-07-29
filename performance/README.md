# Fund-My-Cause — Performance Load Tests

This directory contains load tests targeting the `graphql-api` service.

| File | Purpose |
|---|---|
| `donation-mutation-load-test.yml` | Full Artillery load test for `recordContribution` mutation |
| `donation-mutation-smoke.yml` | Smoke test (CI / quick sanity check, 20 s) |
| `donation-mutation-helpers.js` | Artillery processor: trace IDs, auth headers, GraphQL error counters |
| `donation-mutation-targets.md` | Pre-defined p95/p99 targets and bottleneck candidates |
| `run-donation-load-test.sh` | Convenience wrapper (sources `.env`, runs test, generates report) |
| `.env.example` | Environment variable template (copy to `.env` before running) |
| `k6-load-test.js` | Existing k6 test for autoscaling validation (REST endpoints) |
| `results/` | Generated Artillery JSON + HTML reports (git-ignored) |
| `RESULTS.md` | Actual test results documented against targets (created after run) |

---

## Prerequisites

1. **Node.js ≥ 18** (already required by the monorepo)
2. **Artillery** installed in `services/graphql-api`:
   ```bash
   cd services/graphql-api
   npm install --save-dev artillery@^2.0.0
   ```
3. **`graphql-api` service running** on port 4000 (or at `$GRAPHQL_URL`).
4. **Redis** running on `localhost:6379` (the rate-limiter requires it).
5. **A real on-chain contribution** from `$CONTRIBUTOR_ADDR` to `$CAMPAIGN_ID`
   (see "Test Environment Setup" below).

---

## Quick Start

```bash
# 1. Copy and fill in environment variables
cp performance/.env.example performance/.env
$EDITOR performance/.env

# 2. Start the graphql-api service
cd services/graphql-api
cp .env.example .env   # set JWT_SECRET, REDIS_URL, RPC_URL
npm install
npm run dev &          # starts on port 4000

# 3. Run the smoke test first (20 s, 5 VUs)
bash performance/run-donation-load-test.sh --smoke

# 4. Run the full load test (270 s total, ramps to 50 VUs)
bash performance/run-donation-load-test.sh
```

Results (JSON + HTML) are written to `performance/results/`.

---

## Test Environment Setup

The `recordContribution` mutation performs an **on-chain view call** to verify
the contribution amount before recording it. For the load test to return
successful GraphQL responses (rather than auth/contract errors), you need:

### Option A: Local `stellar/quickstart` node (recommended)

```bash
# Start the local Stellar node
docker run --rm -it -p 8000:8000 stellar/quickstart:latest \
  --local --enable-soroban-rpc

# Wait for it to be healthy, then deploy a campaign contract
DEADLINE=$(date -d "+30 days" +%s)
./scripts/deploy.sh \
  <CREATOR_ADDRESS> \
  <TOKEN_ADDRESS> \
  1000 \
  $DEADLINE \
  10 \
  "Load Test Campaign" \
  "Artillery perf test" \
  null

# Record the printed Campaign Contract ID as $CAMPAIGN_ID.
# Then call contribute() on it from CONTRIBUTOR_ADDR with at least 1 token.
```

Set in `performance/.env`:
```bash
GRAPHQL_URL=http://localhost:4000
RPC_URL=http://localhost:8000/soroban/rpc    # (set in services/graphql-api/.env)
CAMPAIGN_ID=<printed contract ID>
CONTRIBUTOR_ADDR=<your test key>
AUTH_TOKEN=<JWT from authenticate mutation>
```

### Option B: Stellar testnet

Use the Soroban testnet RPC at `https://soroban-testnet.stellar.org`. Note that
testnet has shared rate limits; p95/p99 results will reflect network conditions
outside your control. Use a dedicated test account funded from Friendbot.

### Option C: No contract state (auth-error mode)

If no real contract state is available, run with `AUTH_TOKEN` unset.
The mutation returns `"Authentication required"` GraphQL errors (HTTP 200).
The load test will fail its error-rate threshold but you can still measure
transport latency. Artillery reports will show `gql_errors_auth` counter
increments rather than `gql_errors_rpc`.

---

## Running the Tests

### Full load test (270 seconds)

```bash
bash performance/run-donation-load-test.sh
```

Phase profile:

| Phase | Duration | Arrival Rate | Purpose |
|---|---|---|---|
| Warm-up | 30 s | 5 req/s | Prime Redis, warm JIT |
| Ramp | 60 s | 5 → 25 req/s | Observe latency growth |
| Sustained | 90 s | 25 req/s | Measure steady-state p95/p99 |
| Peak | 60 s | 50 req/s | Stress rate-limiter + RPC |
| Cool-down | 30 s | 0 req/s | Drain in-flight requests |

### Smoke test (CI / quick sanity, 20 seconds)

```bash
bash performance/run-donation-load-test.sh --smoke
# or directly:
cd /workspaces/Fund-My-Cause/services/graphql-api
npx artillery run ../performance/donation-mutation-smoke.yml
```

### Run manually with Artillery

```bash
cd /workspaces/Fund-My-Cause/services/graphql-api

# Full test
npx artillery run \
  ../performance/donation-mutation-load-test.yml \
  --output ../performance/results/donation-$(date +%Y%m%d-%H%M%S).json

# Generate HTML report from an existing JSON result
npx artillery report ../performance/results/<file>.json \
  --output ../performance/results/<file>.html
```

### Pass / fail thresholds (Artillery `ensure` block)

The test exits with code 1 (fail) if, across all phases:
- `p95` response time > 1 500 ms
- `p99` response time > 3 000 ms
- `maxErrorRate` > 1 %

Individual threshold rationale is in `performance/donation-mutation-targets.md`.

---

## Interpreting Results

Artillery prints a per-phase summary to stdout and writes a JSON report with
the following key fields:

```
http.response_time:
  median   — should be ≤ 800 ms
  p95      — should be ≤ 1 500 ms
  p99      — should be ≤ 3 000 ms

http.codes.200   — successful HTTP responses
http.codes.401   — unauthenticated (AUTH_TOKEN not set or expired)
http.codes.429   — rate-limited (IP or user limiter hit)

counters.gql_errors_auth   — GraphQL auth errors
counters.gql_errors_rpc    — Soroban RPC / contract errors
counters.gql_errors_rate   — rate-limit errors surfaced in GraphQL body
counters.gql_errors_other  — other GraphQL errors
counters.http_429_rate_limited — raw HTTP 429 responses
counters.http_5xx_errors       — server errors
```

### Diagnosing failures

| Symptom | Likely cause | Investigation |
|---|---|---|
| p95 > 1 500 ms | Soroban RPC latency | Check `RPC_URL` reachability; measure `curl` round-trip |
| p99 >> p95 (high variance) | Testnet RPC queue spikes | Switch to local node; check testnet status |
| gql_errors_auth > 0 | Token missing / expired | Re-run `authenticate` mutation; update `AUTH_TOKEN` in `.env` |
| gql_errors_rpc > 0 | Campaign/contributor not on-chain | Re-run setup steps; confirm contribution exists |
| http_429_rate_limited > 0 (full test) | User rate-limit hit (10 000 req/hr) | Use multiple test JWT tokens; reduce VUs; spread test over time |
| http_429_rate_limited > 0 (smoke) | IP rate-limit hit (1 000 req/hr) | Unlikely in smoke; check Redis connectivity |
| p95 OK, error rate > 1 % | Fraud-detection unreachable | Check `backend/fraud_detection` service; note it is fire-and-forget and should not affect response time |

Full bottleneck findings and actual measured metrics are in `performance/RESULTS.md`.

---

## Rate-Limiter Interaction

The `graphql-api` rate-limiter enforces:
- **IP limit**: 1 000 requests / hour per IP address
- **User limit**: 10 000 requests / hour per JWT address

At the peak phase (50 req/s) with all VUs sharing one JWT, the user limiter
will be **exhausted after ~200 seconds**. For a sustained multi-hour regression
test you should either:
1. Use multiple JWT tokens (rotate via `beforeRequest` in the helpers module), or
2. Reduce peak VUs to stay within the hourly budget, or
3. Temporarily raise `RATE_LIMIT_USER_MAX_REQUESTS` in `services/graphql-api/.env`
   for the test run.

---

## CI Integration

Add the smoke test to your CI pipeline to catch regressions early:

```yaml
# .github/workflows/performance.yml (example)
- name: Run donation mutation smoke test
  working-directory: services/graphql-api
  env:
    GRAPHQL_URL: http://localhost:4000
    AUTH_TOKEN: ${{ secrets.PERF_TEST_JWT }}
    CAMPAIGN_ID: ${{ secrets.PERF_TEST_CAMPAIGN_ID }}
    CONTRIBUTOR_ADDR: ${{ secrets.PERF_TEST_CONTRIBUTOR }}
  run: npx artillery run ../../performance/donation-mutation-smoke.yml
```

The smoke test does **not** enforce latency thresholds — it only verifies the
mutation endpoint is reachable and returns valid HTTP status codes.

---

## Re-running for Regression Checks

Each run appends a timestamped file to `performance/results/`.  To compare two
runs:

```bash
# Diff two JSON reports (jq required)
jq '.aggregate.latency' performance/results/donation-mutation-20260601-*.json

# Or open the HTML reports in a browser
open performance/results/donation-mutation-*.html
```

Baseline results and bottleneck findings are preserved in
`performance/RESULTS.md` so future runs can be compared against the first
measured baseline.
