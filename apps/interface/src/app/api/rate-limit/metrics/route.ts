/**
 * GET /api/rate-limit/metrics — Issue #675
 *
 * Returns throttle metrics for observability.
 * Protect this endpoint in production (admin-only).
 */
import { NextResponse } from 'next/server';
import { getThrottleMetrics } from '@/lib/rate-limit/metrics';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: getThrottleMetrics(),
    timestamp: new Date().toISOString(),
  });
}
