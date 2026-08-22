/**
 * Analytics aggregation — Issue #676
 *
 * Precomputes daily/hourly rollups for AnalyticsDashboard and PredictiveAnalytics.
 * Aggregates: total_raised, contributor_count, conversion_rate, average_contribution.
 *
 * In production, run as a scheduled job (cron / Vercel cron / BullMQ).
 * Results are cached in-process (swap for Redis/DB in production).
 */

import { ALL_CAMPAIGNS } from '@/lib/campaigns';
import type { Campaign } from '@/types/campaign';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RollupPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface CampaignRollup {
  period: RollupPeriod;
  /** ISO timestamp of period start */
  periodStart: string;
  totalRaised: number;
  contributorCount: number;
  campaignCount: number;
  /** % of active campaigns that reached their goal */
  conversionRate: number;
  averageContribution: number;
  /** Category breakdown */
  byCategory: Record<string, { raised: number; count: number }>;
  /** Status breakdown */
  byStatus: Record<string, number>;
  computedAt: string;
}

export interface AggregateSnapshot {
  latest: CampaignRollup;
  history: CampaignRollup[];
  lastUpdatedAt: string;
}

// ── In-process cache ──────────────────────────────────────────────────────────

const snapshotCache = new Map<RollupPeriod, AggregateSnapshot>();

// ── Aggregation logic ─────────────────────────────────────────────────────────

function roundToPeriodStart(date: Date, period: RollupPeriod): Date {
  const d = new Date(date);
  switch (period) {
    case 'hourly':
      d.setMinutes(0, 0, 0);
      break;
    case 'daily':
      d.setHours(0, 0, 0, 0);
      break;
    case 'weekly': {
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      break;
    }
    case 'monthly':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
  }
  return d;
}

/**
 * Compute a rollup from the given campaigns.
 */
function computeRollup(campaigns: Campaign[], period: RollupPeriod): CampaignRollup {
  const periodStart = roundToPeriodStart(new Date(), period).toISOString();

  let totalRaised = 0;
  let contributorCount = 0;
  let successfulCount = 0;
  let activeCount = 0;
  const byCategory: Record<string, { raised: number; count: number }> = {};
  const byStatus: Record<string, number> = {};

  for (const c of campaigns) {
    totalRaised += c.raised ?? 0;
    contributorCount += c.contributorCount ?? 0;

    if (c.status === 'Successful') successfulCount++;
    if (c.status === 'Active') activeCount++;

    const cat = c.category ?? 'uncategorized';
    if (!byCategory[cat]) byCategory[cat] = { raised: 0, count: 0 };
    byCategory[cat].raised += c.raised ?? 0;
    byCategory[cat].count++;

    const st = c.status ?? 'Unknown';
    byStatus[st] = (byStatus[st] ?? 0) + 1;
  }

  const conversionRate = activeCount + successfulCount > 0
    ? (successfulCount / (activeCount + successfulCount)) * 100
    : 0;

  const averageContribution = contributorCount > 0
    ? totalRaised / contributorCount
    : 0;

  return {
    period,
    periodStart,
    totalRaised,
    contributorCount,
    campaignCount: campaigns.length,
    conversionRate: Math.round(conversionRate * 100) / 100,
    averageContribution: Math.round(averageContribution * 100) / 100,
    byCategory,
    byStatus,
    computedAt: new Date().toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run the aggregation job for the given period.
 *
 * Called by:
 * - The GET /api/analytics route (on-demand)
 * - A Vercel cron job / server-side scheduler
 */
export async function runAggregationJob(
  period: RollupPeriod = 'daily',
  campaigns?: Campaign[],
): Promise<CampaignRollup> {
  const data = campaigns ?? ALL_CAMPAIGNS;
  const rollup = computeRollup(data, period);

  // Update cache
  const existing = snapshotCache.get(period);
  const history = existing ? [...existing.history.slice(-23), existing.latest] : [];
  snapshotCache.set(period, {
    latest: rollup,
    history,
    lastUpdatedAt: new Date().toISOString(),
  });

  return rollup;
}

/**
 * Get the cached aggregate snapshot for a period.
 * Returns null if no aggregation has run yet.
 */
export function getAggregateSnapshot(period: RollupPeriod = 'daily'): AggregateSnapshot | null {
  return snapshotCache.get(period) ?? null;
}

/**
 * Invalidate the cache for a period (call after campaign mutation).
 */
export function invalidateAggregateCache(period?: RollupPeriod): void {
  if (period) {
    snapshotCache.delete(period);
  } else {
    snapshotCache.clear();
  }
}
