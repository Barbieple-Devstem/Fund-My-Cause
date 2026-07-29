# Donation Mutation — Target Performance Metrics

Defined before running any load test. These targets govern whether the
`recordContribution` mutation meets acceptable performance for production use.

---

## Rationale

`recordContribution` is the most write-intensive path in the GraphQL API.
Each invocation involves:

1. **Soroban RPC view call** — `contribution()` to verify the on-chain amount
   (network round-trip to Stellar testnet / mainnet, ~200–500 ms cold).
2. **Best-effort fraud-detection HTTP call** — `POST /contributions` to
   `localhost:8000`, 5 s timeout, fire-and-forget (does not block response
   when the service is up but slow).
3. **Three Redis `DEL` operations** — `campaign:<id>`, `platform:stats`,
   `user:<contributor>` (sub-millisecond locally).
4. **Two PubSub `publish` calls** — in-memory; negligible latency.
5. **Second Soroban RPC view call** — `getCampaign()` to fetch updated state
   for the progress event (same round-trip cost as #1).

The dominant cost is therefore **2× Soroban RPC latency** plus any contention
on the Redis rate-limiter. The fraud-detection call is fire-and-forget and
must not count against the mutation's response time.

---

## Target Metrics

| Metric | Target | Rationale |
|---|---|---|
| **p95 response time** | ≤ 1 500 ms | 2× testnet RPC (≤ 600 ms each) + overhead |
| **p99 response time** | ≤ 3 000 ms | Allows for cold-start, GC pauses, brief RPC spikes |
| **Error rate** | ≤ 1 % | Matches existing autoscaling test threshold |
| **Throughput (steady)** | ≥ 10 req/s | Conservative baseline for a write mutation |
| **Concurrency level (ramp peak)** | 50 VUs | Matches Artillery "Peak load" phase |

> **Note on testnet targets**: Soroban testnet RPC is a shared, rate-limited
> service. Targets above account for typical testnet latency (200–600 ms per
> call). Against a local `stellar/quickstart` node the p95 target may be met
> in < 200 ms. Against mainnet the same targets apply because the 5 s
> fraud-detection timeout is the backstop.

---

## Concurrency Profile

| Phase | VUs (arrival rate) | Duration | Purpose |
|---|---|---|---|
| Warm-up | 5 req/s | 30 s | Seed Redis caches, JIT warm |
| Ramp | 5 → 25 req/s | 60 s | Observe latency growth |
| Sustained | 25 req/s | 90 s | Measure steady-state p95/p99 |
| Peak | 50 req/s | 60 s | Stress rate-limiter + RPC |
| Cool-down | 0 req/s | 30 s | Drain in-flight requests |

---

## Bottleneck Candidates (in priority order)

1. **Soroban RPC round-trip** (2× per mutation, ~200–600 ms each)
   — highest expected contributor to latency; not controllable at the
   GraphQL layer without adding an off-chain write path.

2. **Redis rate-limiter** (`rl_ip:` + `rl_user:` keys)
   — one `consume()` per key per request; at 50 VUs from a single IP the
   IP limiter (1 000 req/hr) will not be exhausted during a short test, but
   all VUs sharing one JWT will exhaust the user limiter (10 000 req/hr)
   after ~200 seconds at 50 req/s — watch for 429s in peak phase.

3. **Fraud-detection HTTP call**
   — fire-and-forget; if the service is unreachable the 5 s timeout fires
   asynchronously and is logged as a warning, not surfaced to the caller.
   Monitor for error log volume rather than response-time impact.

4. **Redis cache invalidation** (3× `DEL`)
   — sub-millisecond; unlikely to be the bottleneck but included for
   completeness.

---

## Pass / Fail Criteria

The load test **passes** if, for the _Sustained_ phase (90 s at 25 req/s):

- `http.response_time.p95` ≤ 1 500 ms  
- `http.response_time.p99` ≤ 3 000 ms  
- `http.response_time.median` ≤ 800 ms  
- `errors` rate ≤ 1 % of all requests  

The load test **fails** if any single criterion above is breached.
In the event of failure, profiling steps are documented in
`performance/RESULTS.md`.
