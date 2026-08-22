/**
 * Canonical campaign status values, mirroring the crowdfund contract's
 * `Status` enum (contracts/crowdfund/src/types.rs) exactly — including
 * casing. Exported as a runtime array (not just a type) so consumers can
 * validate untrusted data against it instead of hand-copying the list.
 */
export const CAMPAIGN_STATUS_VALUES = [
  "Active",
  "Successful",
  "Refunded",
  "Cancelled",
  "Paused",
  "Archived",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUS_VALUES)[number];

export interface PlatformConfig {
  address: string;
  feeBps: number;
}

export type StatusVariant = "active" | "success" | "failed" | "cancelled" | "paused";

export interface ContributionRecord {
  contractId: string;
  contributor: string;
  amount: bigint;
  timestamp: number;
  transactionHash?: string;
}

export interface InitializeParams {
  contractId: string;
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  minContribution: bigint;
  title: string;
  description: string;
  socialLinks?: string[];
  acceptedTokens?: string[];
  platformFeeAddress?: string;
  platformFeeBps?: number;
}

export interface CampaignInfo {
  contractId: string;
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  minContribution: bigint;
  maxContribution: bigint;
  title: string;
  description: string;
  status: CampaignStatus;
  hasPlatformConfig: boolean;
  platformFeeBps: number;
  platformAddress: string;
  socialLinks: string[];
  acceptedTokens?: string[];
}

export interface CampaignStats {
  totalRaised: bigint;
  goal: bigint;
  progressBps: number;
  contributorCount: number;
  averageContribution: bigint;
  largestContribution: bigint;
}

export interface CampaignData {
  contractId: string;
  title: string;
  description: string;
  raised: number;
  goal: number;
  deadline: string;
  creator: string;
  socialLinks: string[];
  contributorCount: number;
  averageContribution: number;
  status: CampaignStatus;
}
