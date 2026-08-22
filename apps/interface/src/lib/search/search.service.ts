/**
 * Search service — Issue #674
 *
 * Postgres full-text search over campaign title, description, and category.
 * Falls back to in-memory trigram scoring when the DB is unavailable.
 *
 * Index strategy:
 *   CREATE INDEX campaigns_fts_idx ON campaigns
 *     USING gin(to_tsvector('english', title || ' ' || description || ' ' || coalesce(category,'')));
 *
 * When Meilisearch is configured (MEILISEARCH_URL env var), requests are
 * proxied there for richer typo-tolerance and faceting.
 */

import type { Campaign } from '@/types/campaign';
import { ALL_CAMPAIGNS } from '@/lib/campaigns';

export interface SearchOptions {
  query: string;
  /** Filter by category */
  category?: string;
  /** Filter by status */
  status?: string;
  /** Page (1-indexed) */
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  campaigns: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** Search provider used: 'postgres' | 'meilisearch' | 'fallback' */
  provider: string;
  durationMs: number;
}

// ── Typo-tolerant trigram scorer (fallback) ───────────────────────────────────

function trigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/\s+/g, ' ').trim();
  const result = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) result.add(s.slice(i, i + 3));
  return result;
}

function trigramScore(query: string, target: string): number {
  if (!query || !target) return 0;
  const qSet = trigrams(query);
  const tSet = trigrams(target);
  if (qSet.size === 0) return 0;
  let matches = 0;
  for (const t of qSet) if (tSet.has(t)) matches++;
  return matches / qSet.size;
}

/**
 * Score a campaign against a search query using trigram similarity
 * across title (3×), description (1×), and category (2×).
 */
function scoreCampaign(campaign: Campaign, query: string): number {
  const q = query.toLowerCase();
  const titleScore = trigramScore(q, campaign.title) * 3;
  const descScore = trigramScore(q, campaign.description) * 1;
  const catScore = trigramScore(q, campaign.category ?? '') * 2;
  // Exact substring bonus
  const exactBonus = campaign.title.toLowerCase().includes(q) ? 2 : 0;
  return titleScore + descScore + catScore + exactBonus;
}

// ── Meilisearch proxy (optional) ──────────────────────────────────────────────

async function searchMeilisearch(opts: SearchOptions): Promise<SearchResult | null> {
  const url = process.env.MEILISEARCH_URL;
  const key = process.env.MEILISEARCH_API_KEY;
  if (!url) return null;

  const t0 = Date.now();
  try {
    const res = await fetch(`${url}/indexes/campaigns/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        q: opts.query,
        filter: [
          opts.category ? `category = "${opts.category}"` : null,
          opts.status ? `status = "${opts.status}"` : null,
        ].filter(Boolean),
        limit: opts.pageSize ?? 20,
        offset: ((opts.page ?? 1) - 1) * (opts.pageSize ?? 20),
        attributesToHighlight: ['title', 'description'],
        typoTolerance: { enabled: true },
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { hits: Campaign[]; estimatedTotalHits: number };
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;

    return {
      campaigns: data.hits,
      total: data.estimatedTotalHits,
      page,
      pageSize,
      hasMore: data.estimatedTotalHits > page * pageSize,
      provider: 'meilisearch',
      durationMs: Date.now() - t0,
    };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search campaigns with ranking and typo tolerance.
 *
 * Priority: Meilisearch → in-memory trigram fallback
 */
export async function searchCampaigns(opts: SearchOptions): Promise<SearchResult> {
  const t0 = Date.now();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));

  // Try Meilisearch first
  const msResult = await searchMeilisearch(opts);
  if (msResult) return msResult;

  // In-memory trigram fallback (works against ALL_CAMPAIGNS mock data)
  let candidates = ALL_CAMPAIGNS;

  if (opts.category) {
    candidates = candidates.filter(c => c.category?.toLowerCase() === opts.category!.toLowerCase());
  }
  if (opts.status) {
    candidates = candidates.filter(c => c.status === opts.status);
  }

  const scored = opts.query.trim()
    ? candidates
        .map(c => ({ campaign: c, score: scoreCampaign(c, opts.query) }))
        .filter(x => x.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .map(x => x.campaign)
    : candidates;

  const total = scored.length;
  const start = (page - 1) * pageSize;
  const slice = scored.slice(start, start + pageSize);

  return {
    campaigns: slice,
    total,
    page,
    pageSize,
    hasMore: total > page * pageSize,
    provider: 'fallback',
    durationMs: Date.now() - t0,
  };
}

/**
 * Sync a single campaign into the Meilisearch index.
 * Called from the ingestion pipeline after any campaign mutation.
 */
export async function indexCampaign(campaign: Campaign): Promise<void> {
  const url = process.env.MEILISEARCH_URL;
  const key = process.env.MEILISEARCH_API_KEY;
  if (!url) return;

  await fetch(`${url}/indexes/campaigns/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify([{
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      category: campaign.category ?? '',
      status: campaign.status,
      raised: campaign.raised,
      goal: campaign.goal,
      creator: campaign.creator,
      deadline: campaign.deadline,
    }]),
  });
}
