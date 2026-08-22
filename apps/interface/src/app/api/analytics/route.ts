/**
 * GET /api/analytics — Issue #676
 *
 * Returns precomputed aggregate rollups for the analytics dashboard.
 *
 * Query params:
 *   period - 'hourly' | 'daily' | 'weekly' | 'monthly' (default: daily)
 *   fresh  - '1' to force recomputation (skip cache)
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAggregationJob, getAggregateSnapshot, type RollupPeriod } from '@/lib/analytics/aggregation';

const VALID_PERIODS: RollupPeriod[] = ['hourly', 'daily', 'weekly', 'monthly'];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const period = (searchParams.get('period') ?? 'daily') as RollupPeriod;
  const forceFresh = searchParams.get('fresh') === '1';

  if (!VALID_PERIODS.includes(period)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PERIOD', message: `period must be one of: ${VALID_PERIODS.join(', ')}` } },
      { status: 400 },
    );
  }

  try {
    // Serve from cache unless fresh=1 or no cache exists
    let snapshot = forceFresh ? null : getAggregateSnapshot(period);

    if (!snapshot) {
      const rollup = await runAggregationJob(period);
      snapshot = { latest: rollup, history: [], lastUpdatedAt: rollup.computedAt };
    }

    return NextResponse.json({
      success: true,
      data: snapshot,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[analytics] error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'ANALYTICS_ERROR', message: 'Failed to compute analytics' } },
      { status: 500 },
    );
  }
}
