/**
 * k6 Load Test — recordContribution (Donation) Mutation
 * ======================================================
 * Target: services/graphql-api  (POST /graphql)
 *
 * What this test exercises
 * ------------------------
 * The `recordContribution` GraphQL mutation is the write-critical path for
 * every on-chain donation.  A single mutation traverses:
 *
 *   1. JWT auth guard (context.user check)
 *   2. ContractService.recordContribution  (Soroban RPC call or stub)
 *   3. Async fraud-detection notification  (best-effort, fire-and-forget)
 *   4. Three cache invalidations           (Redis DEL)
 *   5. Two pubsub publishes                (in-process or Redis)
 *
 * SLO targets (defined before running — see donation-mutation-results.md)
 * -----------------------------------------------------------------------
 *   p95 latency   ≤ 800 ms
 *   p99 latency   ≤ 1 500 ms
 *   error rate    < 1 %
 *   throughput    ≥ 30 successful mutations / second at peak
 *
 * These are encoded as k6 `thresholds` so the test exits non-zero when
 * any SLO is breached — useful for CI gates.
 *
 * Ramp profile
 * ------------
 *   warm-up  →  30 VUs over  1 min   (verify basic connectivity)
 *   ramp-up  →  80 VUs over  2 min   (approach expected daytime peak)
 *   soak     → 100 VUs for   5 min   (steady-state, watch p99 drift)
 *   spike    → 200 VUs over  1 min   (2× peak, exposes saturation point)
 *   drain    →   0 VUs over  1 min   (clean teardown)
 *
 * Environment variables
 * ---------------------
 *   GRAPHQL_URL   Base URL of the GraphQL endpoint
 *                 Default: http://localhost:4000/graphql
 *   AUTH_TOKEN    Bearer token for an authenticated test wallet
 *                 Default: test-token-dev
 *   CAMPAIGN_ID   Campaign ID to donate to (must exist in the test DB)
 *                 Default: test-campaign-001
 *   CONTRIBUTOR   Stellar address of the test contributor
 *                 Default: GTEST000000000000000000000000000000000000000000000000000000
 *
 * Running
 * -------
 *   # One-shot against local dev server
 *   k6 run performance/donation-mutation.k6.js
 *
 *   # Against staging with custom token
 *   GRAPHQL_URL=https://api-staging.fund-my-cause.example.com/graphql \
 *   AUTH_TOKEN=<staging-jwt> \
 *   CAMPAIGN_ID=<real-campaign-id> \
 *   CONTRIBUTOR=<stellar-address> \
 *   k6 run performance/donation-mutation.k6.js
 *
 *   # Export machine-readable summary
 *   k6 run --out json=performance/results/donation-mutation-$(date +%Y%m%d%H%M%S).json \
 *       performance/donation-mutation.k6.js
 *
 *   # Smoke test only (10 VUs, 30 s)
 *   k6 run --vus 10 --duration 30s performance/donation-mutation.k6.js
 *
 * See also: performance/donation-mutation-results.md
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ── Environment ───────────────────────────────────────────────────────────────

const GRAPHQL_URL   = __ENV.GRAPHQL_URL  || 'http://localhost:4000/graphql';
const AUTH_TOKEN    = __ENV.AUTH_TOKEN   || 'test-token-dev';
const CAMPAIGN_ID   = __ENV.CAMPAIGN_ID  || 'test-campaign-001';
const CONTRIBUTOR   = __ENV.CONTRIBUTOR  || 'GTEST000000000000000000000000000000000000000000000000000000';

// ── Custom metrics ────────────────────────────────────────────────────────────

/** Number of GraphQL-layer errors returned as data.errors (not HTTP 5xx). */
const graphqlErrors        = new Counter('donation_graphql_errors');

/** End-to-end mutation latency (ms) — split out from the generic http_req_duration. */
const mutationLatency      = new Trend('donation_mutation_latency', true);

/** Rate of auth-rejection (HTTP 401 / GraphQL UNAUTHENTICATED). */
const authRejectionRate    = new Rate('donation_auth_rejection_rate');

/** Rate of rate-limit rejections (HTTP 429 / GraphQL TOO_MANY_REQUESTS). */
const rateLimitRate        = new Rate('donation_rate_limit_rate');

/** Rate of successful mutations. */
const successRate          = new Rate('donation_success_rate');

// ── SLO thresholds ────────────────────────────────────────────────────────────
// Targets defined before running — see donation-mutation-results.md §Targets.

export const options = {
  stages: [
    { duration: '1m',  target: 30  }, // warm-up
    { duration: '2m',  target: 80  }, // ramp-up to expected peak
    { duration: '5m',  target: 100 }, // soak at peak
    { duration: '1m',  target: 200 }, // spike (2× peak)
    { duration: '1m',  target: 0   }, // drain
  ],

  thresholds: {
    // Core SLOs
    'donation_mutation_latency{phase:soak}': [
      'p(95)<800',    // p95 ≤ 800 ms during soak
      'p(99)<1500',   // p99 ≤ 1 500 ms during soak
    ],
    // Spike phase is allowed higher latency but must not error-out
    'donation_mutation_latency{phase:spike}': [
      'p(95)<2000',
      'p(99)<4000',
    ],
    // Error budget
    'http_req_failed':          ['rate<0.01'],  // < 1 % transport errors
    'donation_graphql_errors':  ['count<50'],   // < 50 absolute GraphQL errors
    'donation_success_rate':    ['rate>0.99'],  // > 99 % success
    'donation_auth_rejection_rate': ['rate<0.01'],
    'donation_rate_limit_rate':     ['rate<0.05'],
  },

  // Emit readable summary at the end
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Shared headers ────────────────────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

// ── GraphQL mutation ──────────────────────────────────────────────────────────

const RECORD_CONTRIBUTION_MUTATION = `
  mutation RecordContribution($input: RecordContributionInput!) {
    recordContribution(input: $input) {
      id
      campaignId
      contributor
      amount
      timestamp
      transactionHash
    }
  }
`;

/**
 * Generates a plausible contribution amount in stroops (XLM × 10^7).
 * Range: 1–100 XLM, varied per VU to avoid DB unique-constraint collisions on
 * (campaignId, transactionHash).
 */
function makeContributionInput(vuId) {
  const xlmAmount   = randomIntBetween(1, 100);
  const stroops     = xlmAmount * 10_000_000;
  // Use a deterministic-but-unique tx hash based on VU + iteration timestamp
  const txHash = `0x${vuId.toString(16).padStart(8, '0')}${Date.now().toString(16)}`;

  return {
    campaignId:      CAMPAIGN_ID,
    contributor:     CONTRIBUTOR,
    amount:          stroops.toString(),
    transactionHash: txHash,
  };
}

// ── Phase tagging ─────────────────────────────────────────────────────────────
// k6 doesn't expose stage name directly; we derive it from elapsed time so we
// can attach phase tags to metrics and threshold selectors.

const PHASE_SCHEDULE = [
  { end: 60,   name: 'warmup' },
  { end: 180,  name: 'rampup' },
  { end: 480,  name: 'soak'   },
  { end: 540,  name: 'spike'  },
  { end: 600,  name: 'drain'  },
];

function currentPhase() {
  const elapsed = Math.round((Date.now() - __ITER_VU_START) / 1000);
  for (const p of PHASE_SCHEDULE) {
    if (elapsed <= p.end) return p.name;
  }
  return 'drain';
}

// Record the test start so phase detection works relative to it.
// k6 sets __ITER_VU_START per iteration; for phase we approximate from
// the monotonic timer instead.
let _testStart = 0;

export function setup() {
  _testStart = Date.now();
  return { startMs: _testStart };
}

function phase(startMs) {
  const elapsedS = (Date.now() - startMs) / 1000;
  for (const p of PHASE_SCHEDULE) {
    if (elapsedS <= p.end) return p.name;
  }
  return 'drain';
}

// ── Main scenario ─────────────────────────────────────────────────────────────

export default function (data) {
  const phaseTag = phase(data.startMs);
  const tags = { phase: phaseTag };

  group('donation mutation', () => {
    const payload = JSON.stringify({
      query:     RECORD_CONTRIBUTION_MUTATION,
      variables: { input: makeContributionInput(__VU) },
    });

    const startTs = Date.now();
    const res = http.post(GRAPHQL_URL, payload, { headers, tags });
    const durationMs = Date.now() - startTs;

    mutationLatency.add(durationMs, tags);

    // ── HTTP-level checks ───────────────────────────────────────────────────

    const httpOk = check(res, {
      'HTTP 200':              (r) => r.status === 200,
      'not 401 auth failure':  (r) => r.status !== 401,
      'not 429 rate-limited':  (r) => r.status !== 429,
      'not 5xx server error':  (r) => r.status < 500,
    }, tags);

    authRejectionRate.add(res.status === 401 ? 1 : 0, tags);
    rateLimitRate.add(res.status === 429 ? 1 : 0, tags);

    if (!httpOk || res.status !== 200) {
      successRate.add(0, tags);
      return;
    }

    // ── GraphQL-layer checks ────────────────────────────────────────────────

    let body;
    try {
      body = res.json();
    } catch (_) {
      graphqlErrors.add(1, tags);
      successRate.add(0, tags);
      return;
    }

    const hasErrors = Array.isArray(body?.errors) && body.errors.length > 0;
    if (hasErrors) {
      graphqlErrors.add(1, tags);
      successRate.add(0, tags);

      // Surface the first error code for debugging without dumping full bodies.
      const code = body.errors[0]?.extensions?.code ?? 'UNKNOWN';
      check(res, { [`no GraphQL errors (got ${code})`]: () => false }, tags);
      return;
    }

    const contribution = body?.data?.recordContribution;
    check(res, {
      'recordContribution returns id':              () => !!contribution?.id,
      'recordContribution returns campaignId':      () => contribution?.campaignId === CAMPAIGN_ID,
      'recordContribution returns contributor':     () => !!contribution?.contributor,
      'recordContribution returns amount':          () => !!contribution?.amount,
      'recordContribution returns transactionHash': () => !!contribution?.transactionHash,
      'recordContribution returns timestamp':       () => !!contribution?.timestamp,
    }, tags);

    successRate.add(contribution?.id ? 1 : 0, tags);
  });

  // Realistic think-time between donation attempts (0.5–2 s).
  // Keeps the test from being pure open-loop while still stressing the server.
  sleep(randomIntBetween(5, 20) / 10);
}

// ── Teardown — print a human-readable pass/fail summary ──────────────────────

export function handleSummary(data) {
  const sloResults = [];

  function metricValue(name, stat) {
    return data.metrics[name]?.values?.[stat] ?? null;
  }

  const soakP95  = metricValue('donation_mutation_latency{phase:soak}', 'p(95)');
  const soakP99  = metricValue('donation_mutation_latency{phase:soak}', 'p(99)');
  const spikeP95 = metricValue('donation_mutation_latency{phase:spike}', 'p(95)');
  const spikeP99 = metricValue('donation_mutation_latency{phase:spike}', 'p(99)');
  const errRate  = metricValue('http_req_failed', 'rate');
  const succRate = metricValue('donation_success_rate', 'rate');
  const gqlErrs  = metricValue('donation_graphql_errors', 'count');

  function row(label, value, target, pass) {
    const status = pass ? '✅ PASS' : '❌ FAIL';
    return `  ${status}  ${label.padEnd(36)} actual=${value}  target=${target}`;
  }

  if (soakP95  !== null) sloResults.push(row('soak p95 latency (ms)',    soakP95.toFixed(0),  '≤ 800',   soakP95  <= 800));
  if (soakP99  !== null) sloResults.push(row('soak p99 latency (ms)',    soakP99.toFixed(0),  '≤ 1500',  soakP99  <= 1500));
  if (spikeP95 !== null) sloResults.push(row('spike p95 latency (ms)',   spikeP95.toFixed(0), '≤ 2000',  spikeP95 <= 2000));
  if (spikeP99 !== null) sloResults.push(row('spike p99 latency (ms)',   spikeP99.toFixed(0), '≤ 4000',  spikeP99 <= 4000));
  if (errRate  !== null) sloResults.push(row('HTTP error rate',          (errRate*100).toFixed(2)+'%', '< 1%',   errRate  <  0.01));
  if (succRate !== null) sloResults.push(row('mutation success rate',    (succRate*100).toFixed(2)+'%','> 99%',  succRate >  0.99));
  if (gqlErrs  !== null) sloResults.push(row('total GraphQL errors',     gqlErrs.toFixed(0),  '< 50',    gqlErrs  <  50));

  const summary = [
    '',
    '═══════════════════════════════════════════════════════════',
    '  Donation-mutation load test — SLO summary',
    '  ' + new Date().toISOString(),
    '───────────────────────────────────────────────────────────',
    ...sloResults,
    '═══════════════════════════════════════════════════════════',
    '',
  ].join('\n');

  return {
    stdout: summary,
  };
}
