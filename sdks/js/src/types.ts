/**
 * Wallet signing callback — matches WalletContext.signTx.
 *
 * Receives the prepared transaction as base64 XDR and must resolve with the
 * signed XDR. Every write method takes one of these rather than a secret key,
 * so the SDK never handles private keys itself.
 *
 * @param xdr - The prepared, unsigned transaction as base64 XDR.
 * @returns The signed transaction as base64 XDR.
 */
export type SignFn = (xdr: string) => Promise<string>;

// Canonical source: @fund-my-cause/types. Re-exported here so existing
// `from "./types"` imports throughout this package keep working.
import type { CampaignStatus } from "@fund-my-cause/types";
export type { CampaignStatus };

/**
 * Campaign category, as reported by `getCampaignInfo`.
 *
 * Mirrors the contract's category enum. `"Other"` is the fallback for
 * campaigns created without an explicit category.
 */
export type Category =
  | "Charity"
  | "Technology"
  | "Creative"
  | "Event"
  | "Personal"
  | "Other";

// ── View return types ─────────────────────────────────────────────────────────

/**
 * Live funding metrics for a campaign, returned by `FmcClient.getStats`.
 *
 * Amounts appear twice: as XLM `number`s for display, and as raw stroop
 * `bigint`s where exact arithmetic matters. Prefer the stroop fields for any
 * comparison or sum — the XLM values are lossy above ~15 significant digits.
 */
export interface CampaignStats {
  /** Total raised in XLM */
  raisedXlm: number;
  /** Goal in XLM */
  goalXlm: number;
  /** Progress 0–100 (can exceed 100 with matching) */
  progressPercent: number;
  /** Number of distinct addresses that have contributed. */
  contributorCount: number;
  /** Mean contribution in XLM, or `0` when there are no contributors. */
  avgContributionXlm: number;
  /** Largest single contribution in XLM, or `0` when there are none. */
  largestContributionXlm: number;
  /** Total raised in stroops — the exact on-chain value behind `raisedXlm`. */
  raisedStroops: bigint;
  /** Goal in stroops — the exact on-chain value behind `goalXlm`. */
  goalStroops: bigint;
}

/**
 * A campaign's metadata and configuration, returned by
 * `FmcClient.getCampaignInfo`.
 *
 * This is the state fixed at initialization plus the current status — not live
 * funding progress, which {@link CampaignStats} carries.
 */
export interface CampaignInfo {
  /** Address that created the campaign and may withdraw or cancel it. */
  creator: string;
  /** Contract ID of the token this campaign accepts. */
  token: string;
  /** Funding goal in XLM. */
  goalXlm: number;
  /** Funding goal in stroops — the exact on-chain value behind `goalXlm`. */
  goalStroops: bigint;
  /** Deadline, converted from the contract's Unix seconds. */
  deadline: Date;
  /** Smallest accepted contribution, in XLM. */
  minContributionXlm: number;
  /** Smallest accepted contribution, in stroops. */
  minContributionStroops: bigint;
  /** Per-contributor cap in XLM. `0` means uncapped. */
  maxContributionXlm: number;
  /** Per-contributor cap in stroops. `0` means uncapped. */
  maxContributionStroops: bigint;
  /** Campaign title as stored on-chain. */
  title: string;
  /** Campaign description as stored on-chain. */
  description: string;
  /** Current lifecycle status (active, successful, cancelled, …). */
  status: CampaignStatus;
  /** Campaign category. */
  category: Category;
  /** Whether a platform fee is configured; when `false`, ignore `platformFeeBps`. */
  hasPlatformConfig: boolean;
  /** Platform fee in basis points, deducted from the creator's payout on withdrawal. */
  platformFeeBps: number;
}

/**
 * Derived performance and velocity metrics, returned by
 * `FmcClient.getPerformanceMetrics`.
 *
 * All values are computed on-chain from contribution history. The projections
 * are indicative rather than guaranteed.
 */
export interface PerformanceMetrics {
  /** Success rate in basis points (10 000 = 100%). */
  successRateBps: number;
  /** Recent contribution rate in XLM per day. */
  contributionVelocityXlm: number;  // XLM per day
  /** Trend indicator; positive means contributions are accelerating. */
  trending: number;                  // positive = accelerating
  /** Milestones reached so far. */
  milestonesReached: number;
  /** Milestones defined for this campaign. */
  totalMilestones: number;
  /** Seconds since the campaign started. */
  timeElapsedSeconds: number;
  /**
   * Projected seconds until the goal is met, extrapolated from current
   * velocity. Expect very large values when velocity is near zero.
   */
  estimatedSecondsToGoal: number;
  /** Mean contribution volume per day, in XLM. */
  avgDailyContributionXlm: number;
}

/**
 * A single contribution by one address, as returned in the array from
 * `FmcClient.getContributionHistory`.
 */
export interface ContributionRecord {
  /** Amount contributed in this individual contribution, in XLM. */
  amountXlm: number;
  /** When the contribution was made, converted from the contract's Unix seconds. */
  timestamp: Date;
  /** The address's cumulative total after this contribution, in XLM. */
  runningTotalXlm: number;
}

/**
 * An active matching-pool configuration, returned by
 * `FmcClient.getMatchingConfig`.
 *
 * A sponsor commits to matching contributions at `matchRatioBps` until
 * `maxMatchXlm` is exhausted.
 */
export interface MatchingConfig {
  /** Address funding the matching pool. */
  sponsor: string;
  /** Match rate in basis points — 5000 matches 50% of each contribution. */
  matchRatioBps: number;
  /** Maximum the sponsor will match in total, in XLM. */
  maxMatchXlm: number;
  /** Maximum the sponsor will match in total, in stroops. */
  maxMatchStroops: bigint;
}

// ── Options types ─────────────────────────────────────────────────────────────

/**
 * Configuration for {@link FmcClient}, bound to one campaign contract.
 *
 * `networkPassphrase` must match the network `rpcUrl` and `horizonUrl` point
 * at, or signatures will be rejected at submission.
 */
export interface FmcClientConfig {
  /** Contract ID of the campaign this client reads and writes. */
  contractId: string;
  /** Soroban RPC endpoint, used for simulation, submission, and polling. */
  rpcUrl: string;
  /** Network passphrase the transactions are signed against. */
  networkPassphrase: string;
  /** Horizon endpoint, used to load the signing account's sequence number. */
  horizonUrl: string;
}

/** Arguments for `FmcClient.contribute`. */
export interface ContributeOptions {
  /** Address making the contribution; must be the one that signs. */
  contributor: string;
  /** Amount to contribute in XLM, rounded to the nearest stroop. */
  amountXlm: number;
  /** Contract ID of the token to pay with; must be the campaign's token. */
  tokenId: string;
  /** Optional public message, stored on-chain. Maximum 256 characters. */
  message?: string;
  /** Wallet callback that signs the prepared transaction. */
  signTx: SignFn;
}

/** Arguments for `FmcClient.withdraw`. */
export interface WithdrawOptions {
  /** Campaign creator's address; must be the one that signs. */
  creator: string;
  /** Wallet callback that signs the prepared transaction. */
  signTx: SignFn;
}

/** Arguments for `FmcClient.refundSingle`. */
export interface RefundOptions {
  /** Address claiming its own refund; must be the one that signs. */
  contributor: string;
  /** Wallet callback that signs the prepared transaction. */
  signTx: SignFn;
}

/** Arguments for `FmcClient.setupMatching`. */
export interface SetupMatchingOptions {
  /** Address funding the matching pool; must be the one that signs. */
  sponsorAddress: string;
  /** Match rate in basis points; must not exceed 10 000. */
  matchRatioBps: number;
  /** Maximum to match in total, in XLM. */
  maxMatchXlm: number;
  /** Wallet callback that signs the prepared transaction. */
  signTx: SignFn;
}

/**
 * Arguments for `FmcClient.refundMatchingSponsor`.
 *
 * Note this takes the **creator**, not the sponsor: the creator authorises
 * releasing unspent matching funds back to the sponsor.
 */
export interface RefundMatchingSponsorOptions {
  /** Campaign creator's address; must be the one that signs. */
  creatorAddress: string;
  /** Wallet callback that signs the prepared transaction. */
  signTx: SignFn;
}

/** Arguments for `FmcClient.cancelCampaign`. */
export interface CancelOptions {
  /** Campaign creator's address; must be the one that signs. */
  creator: string;
  /** Wallet callback that signs the prepared transaction. */
  signTx: SignFn;
}

/** Pagination arguments for `FmcClient.listContributors`. */
export interface ListContributorsOptions {
  /** 0-based index to start from. */
  offset: number;
  /** Maximum addresses to return in this page. */
  limit: number;
}

/**
 * Configuration for {@link FmcRegistryClient}, bound to a registry contract.
 */
export interface RegistryClientConfig {
  /** Contract ID of the registry — not of a campaign. */
  contractId: string;
  /** Soroban RPC endpoint, used to simulate the view calls. */
  rpcUrl: string;
  /** Network passphrase the simulated transactions are built against. */
  networkPassphrase: string;
  /** Accepted for symmetry with {@link FmcClientConfig}; unused, as this client never submits. */
  horizonUrl: string;
}

/** Pagination arguments for `FmcRegistryClient.list`. */
export interface ListOptions {
  /** 0-based index to start from. */
  offset: number;
  /** Maximum addresses to return in this page. */
  limit: number;
}

/** Pagination and filter arguments for `FmcRegistryClient.getByCampaignCategory`. */
export interface ListByCategoryOptions extends ListOptions {
  /** Contract-assigned category ID to filter by. Unknown IDs yield an empty result. */
  categoryId: number;
}
