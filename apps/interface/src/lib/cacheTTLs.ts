const MIN = 60_000;

/**
 * Per-data-type staleTime / gcTime pairs consumed by ReactQueryProvider via
 * setQueryDefaults.  All queries matching a key prefix inherit these values;
 * individual hooks should NOT repeat them.
 *
 * staleTime → how long cached data is considered fresh (no background refetch)
 * gcTime    → how long unused data stays in memory (serves instant on nav-back)
 *
 * The gap between staleTime and gcTime is the stale-while-revalidate window:
 * data is served from cache immediately while a background fetch runs.
 */
export const CACHE_TTLS = {
  // On-chain live stats (totalRaised, contributorCount…); updated by mutations
  campaign: { staleTime: 30_000, gcTime: 5 * MIN },

  // Static metadata (goal, title, deadline…); never changes post-creation
  campaignInfo: { staleTime: Infinity, gcTime: 60 * MIN },

  // Social content; 30 s fresh window, 10 min in-memory for nav-back
  comments: { staleTime: 30_000, gcTime: 10 * MIN },

  // Discovery list; 60 s fresh window avoids re-fetch on quick page switches
  leaderboard: { staleTime: 60_000, gcTime: 15 * MIN },

  // Achievements only change on explicit unlock events
  achievements: { staleTime: 5 * MIN, gcTime: 30 * MIN },

  // Progress recalculated server-side after contributions
  achievementProgress: { staleTime: 2 * MIN, gcTime: 15 * MIN },

  // Level/rank derived from events; 2 min fresh window
  gamificationProfile: { staleTime: 2 * MIN, gcTime: 15 * MIN },
} as const;
