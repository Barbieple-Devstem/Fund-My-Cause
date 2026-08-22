/**
 * Standalone analytics aggregation job runner — Issue #714
 *
 * Entry point for the containerised scheduled job.
 * Runs the aggregation for all periods, writes results to stdout as JSON,
 * and exits non-zero on failure (allowing k8s to detect and alert).
 *
 * Idempotent: safe to re-run at any time.
 */

import { runAggregationJob, type RollupPeriod } from './aggregation';

const PERIODS: RollupPeriod[] = ['hourly', 'daily', 'weekly', 'monthly'];

async function main(): Promise<void> {
  console.log(JSON.stringify({ level: 'info', msg: 'analytics-job started', ts: new Date().toISOString() }));

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const period of PERIODS) {
    try {
      const rollup = await runAggregationJob(period);
      results[period] = rollup;
      console.log(JSON.stringify({ level: 'info', msg: 'period completed', period, ts: new Date().toISOString() }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${period}: ${message}`);
      console.error(JSON.stringify({ level: 'error', msg: 'period failed', period, error: message, ts: new Date().toISOString() }));
    }
  }

  console.log(JSON.stringify({ level: 'info', msg: 'analytics-job finished', results, ts: new Date().toISOString() }));

  if (errors.length > 0) {
    console.error(JSON.stringify({ level: 'error', msg: 'job completed with errors', errors }));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ level: 'fatal', msg: 'unhandled error', error: String(err) }));
  process.exit(1);
});
