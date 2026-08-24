/**
 * Scoring-weights configuration for the search service.
 *
 * All weights are loaded once at module initialisation from environment
 * variables, validated against a strict schema, and exported as a frozen
 * object.  Any missing or out-of-range value causes an explicit startup
 * error so misconfiguration is never silently ignored in production.
 *
 * Environment variable names follow the pattern:
 *   NEXT_PUBLIC_SEARCH_WEIGHT_<FIELD>
 *
 * When a variable is absent the built-in default is used, making partial
 * configuration safe for local development while still allowing production
 * overrides.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * All numeric factors used by {@link scoreCampaign} in search.service.ts.
 *
 * Names follow the pattern: <field>_<matchKind>.
 *
 * - `exactPhrase` variants apply when the raw query string appears verbatim.
 * - `token` variants apply for individual query tokens.
 * - `fuzzy` variants apply when edit-distance matches (not exact token hits).
 * - `semantic` variants apply for semantically-expanded tokens only.
 * - `categoryBoostMax` caps the personalisation multiplier.
 * - `categoryBoostRate` controls how steeply each extra category view lifts
 *   the multiplier (multiplier = min(categoryBoostMax, 1 + views * rate)).
 */
export interface ScoringWeights {
  /** Exact phrase match in title */
  titleExactPhrase: number;
  /** Per-token match in title */
  titleToken: number;
  /** Fuzzy (edit-distance) match in title */
  titleFuzzy: number;
  /** Exact phrase match in description */
  descriptionExactPhrase: number;
  /** Per-token match in description */
  descriptionToken: number;
  /** Fuzzy match in description */
  descriptionFuzzy: number;
  /** Token or exact match in category */
  categoryToken: number;
  /** Semantic-expansion match in category */
  categorySemantic: number;
  /** Token match in creator field */
  creatorToken: number;
  /** Semantic-only token matching title */
  semanticTitle: number;
  /** Semantic-only token matching description */
  semanticDescription: number;
  /** Maximum personalisation boost multiplier */
  categoryBoostMax: number;
  /** Per-view increment for personalisation boost */
  categoryBoostRate: number;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

/**
 * Out-of-the-box weights that reproduce the original hard-coded behaviour.
 * These are used verbatim when no environment overrides are present.
 */
export const DEFAULT_SCORING_WEIGHTS: Readonly<ScoringWeights> = Object.freeze({
  titleExactPhrase: 10,
  titleToken: 5,
  titleFuzzy: 2.5,
  descriptionExactPhrase: 4,
  descriptionToken: 2,
  descriptionFuzzy: 1,
  categoryToken: 4,
  categorySemantic: 1.5,
  creatorToken: 1,
  semanticTitle: 2,
  semanticDescription: 0.5,
  categoryBoostMax: 1.5,
  categoryBoostRate: 0.1,
});

/** All field names that must be present in a fully-resolved config. */
const REQUIRED_KEYS = Object.keys(
  DEFAULT_SCORING_WEIGHTS,
) as (keyof ScoringWeights)[];

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validates `weights` and throws a descriptive {@link Error} if any value is
 * missing or falls outside the allowed range.
 *
 * Allowed range:
 *  - every weight must be a finite, non-negative number
 *  - `categoryBoostMax` must be ≥ 1 (a boost below 1× would demote results)
 *  - `categoryBoostRate` must be ≤ 1 (per-view increment > 1 causes runaway
 *    multipliers)
 */
export function validateScoringWeights(weights: Partial<ScoringWeights>): void {
  for (const key of REQUIRED_KEYS) {
    const val = weights[key];
    if (val === undefined || val === null) {
      throw new Error(
        `[search-weights] Missing required weight: "${key}". ` +
          `Set NEXT_PUBLIC_SEARCH_WEIGHT_${key.toUpperCase()} or rely on the built-in default.`,
      );
    }
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(
        `[search-weights] Weight "${key}" must be a finite number, got: ${JSON.stringify(val)}`,
      );
    }
    if (val < 0) {
      throw new Error(
        `[search-weights] Weight "${key}" must be ≥ 0, got: ${val}`,
      );
    }
  }

  const boostMax = weights.categoryBoostMax as number;
  if (boostMax < 1) {
    throw new Error(
      `[search-weights] "categoryBoostMax" must be ≥ 1 (a value < 1 demotes personalised results), got: ${boostMax}`,
    );
  }

  const boostRate = weights.categoryBoostRate as number;
  if (boostRate > 1) {
    throw new Error(
      `[search-weights] "categoryBoostRate" must be ≤ 1 to prevent runaway multipliers, got: ${boostRate}`,
    );
  }
}

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Builds a {@link ScoringWeights} object from an optional environment-variable
 * map (defaults to `process.env`).
 *
 * For every weight key the function looks for the corresponding env var:
 *   `NEXT_PUBLIC_SEARCH_WEIGHT_<KEY_UPPER_SNAKE>`
 *
 * If the var is absent the default value is used silently.  If it is present
 * but not a valid finite number an error is thrown immediately.
 *
 * After merging defaults with overrides the full object is validated and
 * returned frozen.
 *
 * @param env - Map of environment variables (injectable for testing).
 */
export function loadScoringWeights(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): Readonly<ScoringWeights> {
  const resolved: Record<string, number> = {};

  for (const key of REQUIRED_KEYS) {
    const envKey = "NEXT_PUBLIC_SEARCH_WEIGHT_" + camelToUpperSnake(key);
    const rawValue = env[envKey];

    if (rawValue === undefined || rawValue === "") {
      // Fall back to built-in default — partial config is valid
      resolved[key] = DEFAULT_SCORING_WEIGHTS[key];
    } else {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        throw new Error(
          `[search-weights] Environment variable ${envKey} must be a finite number, got: "${rawValue}"`,
        );
      }
      resolved[key] = parsed;
    }
  }

  const weights = resolved as unknown as ScoringWeights;
  // Run the full semantic validator after merging with defaults
  validateScoringWeights(weights);
  return Object.freeze(weights);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a camelCase key (e.g. "titleExactPhrase") to UPPER_SNAKE_CASE
 * (e.g. "TITLE_EXACT_PHRASE") for environment variable lookup.
 */
function camelToUpperSnake(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}

// ── Module-level singleton ─────────────────────────────────────────────────────

/**
 * The application-wide scoring weights, resolved once at module load time.
 *
 * Import this constant wherever you need weights rather than calling
 * `loadScoringWeights()` every time.
 */
export const SCORING_WEIGHTS: Readonly<ScoringWeights> = loadScoringWeights();
