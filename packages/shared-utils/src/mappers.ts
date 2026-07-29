/**
 * Shared DTO mappers for Soroban contract raw data (#903).
 *
 * These functions were extracted from services/graphql-api/src/services/contract.ts
 * and centralised here so that any service needing to map raw Soroban return
 * values to domain DTOs can import a single, tested implementation.
 *
 * Reconciliation notes:
 * - Pre-existing divergence: services/graphql-api had STATUS_MAP inline;
 *   services/indexer stored raw IndexerEvent objects with no DTO mapping.
 *   This module provides the canonical status mapping and campaign mapping
 *   used by graphql-api, and will serve as the reference for future indexer
 *   enrichment as well.
 * - Null / undefined handling: every optional raw field gracefully defaults
 *   (e.g. unknown status → 'Active', missing bigint → 0n, missing string → '').
 * - Field naming: raw Soroban fields use snake_case; mapped DTOs use camelCase.
 * - Bigint values for goal, raised, minContribution, maxContribution are
 *   preserved as bigint throughout (not coerced to number, which would lose
 *   precision for large XLM amounts).
 * - Timestamps: Soroban deadline is a Unix epoch in seconds stored as bigint;
 *   we convert to ISO-8601 strings via new Date(Number(stroops) * 1000).toISOString().
 */

import type { CampaignStatus } from "@fund-my-cause/types";

// ---------------------------------------------------------------------------
// Raw contract return shapes
// ---------------------------------------------------------------------------

/**
 * Raw return type of the crowdfund contract's `get_campaign_info` view.
 * Field names are snake_case, mirroring the Soroban SDK's scValToNative output.
 */
export interface RawCampaignInfo {
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  min_contribution: bigint;
  max_contribution: bigint;
  title: string;
  description: string;
  status: string;
  category: string;
  has_platform_config: boolean;
  platform_fee_bps: number;
  platform_address: string;
}

/**
 * Minimal Campaign DTO shape used by the mappers.
 * This matches the Campaign interface in services/graphql-api/src/types.ts.
 */
export interface MappedCampaign {
  id: string;
  contractId: string;
  title: string;
  description: string;
  creator: string;
  goal: bigint;
  raised: bigint;
  deadline: string;
  status: CampaignStatus;
  category: string;
  image?: string;
  videoUrl?: string;
  minContribution: bigint;
  maxContribution: bigint;
  totalContributors: number;
  token: string;
  platformFeeBps?: number;
  hasRBACEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw stats returned by `get_stats` on the crowdfund contract.
 */
export interface RawCampaignStats {
  total_raised: bigint;
  gross_raised?: bigint;
  goal: bigint;
  progress_bps?: number;
  contributor_count: number;
  average_contribution?: bigint;
  largest_contribution?: bigint;
}

/**
 * Minimal Contribution DTO shape.
 * Matches the Contribution interface in services/graphql-api/src/types.ts.
 */
export interface MappedContribution {
  id: string;
  campaignId: string;
  contributor: string;
  amount: bigint;
  timestamp: string;
  transactionHash: string;
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, CampaignStatus> = {
  Active: "Active",
  Successful: "Successful",
  Refunded: "Refunded",
  Cancelled: "Cancelled",
  Paused: "Paused",
  Archived: "Archived",
};

/**
 * Map a raw Soroban status string to the canonical CampaignStatus type.
 * Unknown values default to 'Active' rather than throwing.
 *
 * Reconciliation note: both sides (graphql-api and any future indexer enricher)
 * must use this function so that a new status added to the contract's Status enum
 * is handled consistently (defaulting to 'Active') until this map is updated.
 */
export function mapCampaignStatus(s: string): CampaignStatus {
  return STATUS_MAP[s] ?? "Active";
}

// ---------------------------------------------------------------------------
// Campaign mapping
// ---------------------------------------------------------------------------

function stroopsToIsoString(stroops: bigint): string {
  return new Date(Number(stroops) * 1000).toISOString();
}

/**
 * Map raw Soroban `get_campaign_info` + `get_stats` results to a Campaign DTO.
 *
 * @param contractId - The Soroban contract address (used as both id and contractId).
 * @param info       - Raw return from `get_campaign_info`.
 * @param stats      - Raw return from `get_stats` (optional; omit when only
 *                     info is available and raised/contributors unknown yet).
 */
export function mapCampaignFromRaw(
  contractId: string,
  info: RawCampaignInfo,
  stats?: Partial<RawCampaignStats>,
): MappedCampaign {
  const now = new Date().toISOString();
  return {
    id: contractId,
    contractId,
    title: info.title ?? "",
    description: info.description ?? "",
    creator: info.creator ?? "",
    goal: stats?.goal ?? info.goal ?? 0n,
    raised: stats?.total_raised ?? 0n,
    deadline: stroopsToIsoString(info.deadline ?? 0n),
    status: mapCampaignStatus(info.status ?? ""),
    category: info.category ?? "",
    minContribution: info.min_contribution ?? 0n,
    maxContribution: info.max_contribution ?? 0n,
    totalContributors: stats?.contributor_count ?? 0,
    token: info.token ?? "",
    platformFeeBps: info.has_platform_config ? info.platform_fee_bps : undefined,
    hasRBACEnabled: info.has_platform_config ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Contribution mapping
// ---------------------------------------------------------------------------

/**
 * Raw contribution event data as it may arrive from various sources
 * (contract events, indexer payloads, GraphQL inputs, etc.).
 */
export interface RawContributionData {
  id?: string;
  campaignId?: string;
  contributor?: string;
  amount?: bigint | string | number;
  timestamp?: string | number | bigint;
  transactionHash?: string;
}

/**
 * Map raw contribution data to a typed Contribution DTO.
 *
 * Null / undefined handling:
 * - id falls back to fallbackId, then 'unknown'
 * - campaignId falls back to ''
 * - contributor falls back to ''
 * - amount is coerced to bigint (0n if unparseable)
 * - timestamp is converted to ISO string (epoch 0 if missing)
 * - transactionHash falls back to ''
 */
export function mapContribution(
  raw: RawContributionData,
  fallbackId?: string,
): MappedContribution {
  let amount: bigint;
  try {
    if (typeof raw.amount === "bigint") {
      amount = raw.amount;
    } else if (raw.amount !== undefined && raw.amount !== null) {
      amount = BigInt(raw.amount);
    } else {
      amount = 0n;
    }
  } catch {
    amount = 0n;
  }

  let timestamp: string;
  if (!raw.timestamp) {
    timestamp = new Date(0).toISOString();
  } else if (typeof raw.timestamp === "string") {
    timestamp = raw.timestamp;
  } else if (typeof raw.timestamp === "bigint") {
    // Soroban timestamps are Unix epoch seconds as bigint
    timestamp = new Date(Number(raw.timestamp) * 1000).toISOString();
  } else {
    // number — could be ms or seconds; treat as ms (JS convention)
    timestamp = new Date(raw.timestamp as number).toISOString();
  }

  return {
    id: raw.id ?? fallbackId ?? "unknown",
    campaignId: raw.campaignId ?? "",
    contributor: raw.contributor ?? "",
    amount,
    timestamp,
    transactionHash: raw.transactionHash ?? "",
  };
}
