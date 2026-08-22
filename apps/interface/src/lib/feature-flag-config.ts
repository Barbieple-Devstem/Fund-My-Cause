/**
 * Feature Flag Configuration
 *
 * Defines the feature flags still in flight. A flag belongs here only while its
 * outcome is undecided — that is, while it is partially rolled out or scoped to
 * a target group.
 *
 * Flags that reached 100% rollout (or were switched off permanently) are
 * removed rather than left pinned: a flag that can only ever return one value
 * is dead configuration, and the branch it used to guard should be inlined at
 * the same time. See docs/feature-flags.md for the retirement checklist.
 */

import { FeatureFlag } from "./feature-flags";

/**
 * Feature flag definitions
 */
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // Contribution Features
  RECURRING_CONTRIBUTIONS: {
    name: "recurring_contributions",
    enabled: true,
    rolloutPercentage: 50,
    metadata: {
      description: "Enable recurring contribution feature",
      releaseDate: "2026-05-01",
    },
  },

  CONTRIBUTION_MATCHING: {
    name: "contribution_matching",
    enabled: true,
    rolloutPercentage: 25,
    metadata: {
      description: "Enable sponsor matching feature",
      releaseDate: "2026-05-15",
    },
  },

  ANONYMOUS_CONTRIBUTIONS: {
    name: "anonymous_contributions",
    enabled: true,
    rolloutPercentage: 75,
    metadata: {
      description: "Enable anonymous contribution option",
      releaseDate: "2026-04-27",
    },
  },

  // User Features
  USER_PROFILES: {
    name: "user_profiles",
    enabled: true,
    rolloutPercentage: 50,
    metadata: {
      description: "Enable user profile pages",
      releaseDate: "2026-05-01",
    },
  },

  // Admin Features
  ADVANCED_FILTERS: {
    name: "advanced_filters",
    enabled: true,
    rolloutPercentage: 50,
    metadata: {
      description: "Enable advanced campaign filters",
      releaseDate: "2026-05-01",
    },
  },

  // Experimental Features
  AI_RECOMMENDATIONS: {
    name: "ai_recommendations",
    enabled: true,
    rolloutPercentage: 10,
    metadata: {
      description: "Enable AI-powered campaign recommendations",
      releaseDate: "2026-06-01",
      experimental: true,
    },
  },

  BLOCKCHAIN_VERIFICATION: {
    name: "blockchain_verification",
    enabled: true,
    rolloutPercentage: 5,
    targetGroups: ["beta_testers"],
    metadata: {
      description: "Enable blockchain verification badge",
      releaseDate: "2026-06-15",
      experimental: true,
    },
  },

  // Maintenance Features
  BETA_FEATURES: {
    name: "beta_features",
    enabled: true,
    rolloutPercentage: 0,
    targetGroups: ["beta_testers", "internal"],
    metadata: {
      description: "Enable beta features for testers",
      releaseDate: "2026-04-27",
    },
  },
};

/**
 * Get all feature flag names
 */
export function getFeatureFlagNames(): string[] {
  return Object.keys(FEATURE_FLAGS);
}

/**
 * Get feature flag by name
 */
export function getFeatureFlag(name: string): FeatureFlag | undefined {
  return FEATURE_FLAGS[name];
}

/**
 * Get all enabled feature flags
 */
export function getEnabledFeatureFlags(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter((flag) => flag.enabled);
}

/**
 * Get all experimental feature flags
 */
export function getExperimentalFeatureFlags(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter(
    (flag) => flag.metadata?.experimental === true,
  );
}
