import type { RedisClientType } from "redis";
import type DataLoader from "dataloader";
import type pino from "pino";
import type { PubSubService } from "./services/pubsub.js";
// Canonical source: @fund-my-cause/types. Values are PascalCase ("Active",
// not "ACTIVE"), matching the crowdfund contract's Status enum. The public
// GraphQL schema still exposes SCREAMING_CASE enum names (see schema.ts) —
// resolvers.ts's CAMPAIGN_STATUS_ENUM_MAP bridges the two.
import type { CampaignStatus } from "@fund-my-cause/types";
export type { CampaignStatus };

// ── Contract types ─────────────────────────────────────────────────────────────

/** Mirrors soroban-sdk Status enum. */
export type ContractStatus =
  | "Active"
  | "Successful"
  | "Refunded"
  | "Cancelled"
  | "Paused"
  | "Archived";

/** Mirrors soroban-sdk Category enum. */
export type ContractCategory =
  | "Charity"
  | "Technology"
  | "Creative"
  | "Event"
  | "Personal"
  | "Other";

/** Raw return type of contract get_campaign_info view. */
export interface RawCampaignInfo {
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  min_contribution: bigint;
  max_contribution: bigint;
  title: string;
  description: string;
  status: ContractStatus;
  category: ContractCategory;
  has_platform_config: boolean;
  platform_fee_bps: number;
  platform_address: string;
}

/** Raw return type of contract get_stats view. */
export interface RawCampaignStats {
  total_raised: bigint;
  gross_raised: bigint;
  goal: bigint;
  soft_cap: bigint;
  stretch_goal: bigint;
  progress_bps: number;
  contributor_count: number;
  average_contribution: bigint;
  largest_contribution: bigint;
}

/** Raw return type of contract get_performance_metrics view. */
export interface RawPerformanceMetrics {
  success_rate_bps: number;
  contribution_velocity: bigint;
  trending: number;
  milestones_reached: number;
  total_milestones: number;
  time_elapsed: bigint;
  estimated_time_to_goal: bigint;
  average_daily_contribution: bigint;
}

/** Raw return type of registry list / list_by_status. */
export type RawCampaignIdList = string[];

/** Campaign as exposed to GraphQL resolvers. */
export interface Campaign {
  /** Soroban contract address of the campaign */
  id: string;
  /** Alias for id (kept for GraphQL schema compat) */
  contractId: string;
  title: string;
  description: string;
  creator: string;
  /** Funding goal in stroops */
  goal: bigint;
  /** Net amount raised in stroops */
  raised: bigint;
  /** ISO-8601 deadline */
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

export interface Contribution {
  id: string;
  campaignId: string;
  contributor: string;
  amount: bigint;
  timestamp: string;
  transactionHash: string;
}

export interface User {
  address: string;
  totalContributed: bigint;
  contributionCount: number;
  campaigns: Campaign[];
  contributions: Contribution[];
  joinedAt: string;
}

export interface CampaignUpdate {
  id: string;
  campaignId: string;
  content: string;
  ipfsHash: string;
  timestamp: string;
}

export interface Milestone {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  targetAmount: bigint;
  releasePercentage: number;
  status: MilestoneStatus;
}

export interface Contributor {
  address: string;
  amount: bigint;
  contributionCount: number;
  isTopContributor: boolean;
}

export interface CampaignProgress {
  campaignId: string;
  raised: bigint;
  percentageFunded: number;
  contributors: number;
  daysRemaining: number;
  timestamp: string;
}

export interface Statistics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalRaised: bigint;
  totalContributors: number;
  averageContribution: bigint;
  successRate: number;
}

export enum MilestoneStatus {
  PENDING = "PENDING",
  REACHED = "REACHED",
  RELEASED = "RELEASED",
}

// DataLoader types
export interface DataLoaders {
  campaigns: DataLoader<string, Campaign | null>;
  contributions: DataLoader<string, Contribution | null>;
  users: DataLoader<string, User | null>;
  campaignContributors: DataLoader<string, Contributor[]>;
  campaignContributions: DataLoader<string, Contribution[]>;
  campaignUpdates: DataLoader<string, CampaignUpdate[]>;
  campaignMilestones: DataLoader<string, Milestone[]>;
  campaignsByStatus: DataLoader<
    { status: CampaignStatus; limit: number },
    Campaign[]
  >;
  userCampaigns: DataLoader<string, Campaign[]>;
  userContributions: DataLoader<string, Contribution[]>;
}

// Context type
export interface Context {
  cache: any; // Redis cache service
  contractService: any; // Contract service
  dataLoader: DataLoaders;
  pubsub: PubSubService;
  authService: any; // Auth service
  user?: {
    address: string;
    isAuthenticated: boolean;
  };
  redis: RedisClientType;
  /** Trace ID for this request — generated once in the Apollo context factory
   *  and forwarded as X-Trace-ID to all downstream HTTP calls. */
  traceId: string;
  /** Request-scoped pino logger with trace_id pre-bound. */
  log: pino.Logger;
}

// API Response types
export interface CampaignFilter {
  status?: CampaignStatus[];
  category?: string[];
  minGoal?: bigint;
  maxGoal?: bigint;
  creator?: string;
  search?: string;
}

export interface PaginationInput {
  limit: number;
  offset: number;
}

export interface CampaignSort {
  field: SortField;
  direction: SortDirection;
}

export enum SortField {
  CREATED_AT = "CREATED_AT",
  RAISED_AMOUNT = "RAISED_AMOUNT",
  GOAL = "GOAL",
  DEADLINE = "DEADLINE",
  CONTRIBUTORS = "CONTRIBUTORS",
}

export enum SortDirection {
  ASC = "ASC",
  DESC = "DESC",
}

export interface GetCampaignsParams {
  filter?: CampaignFilter;
  pagination: PaginationInput;
  sort?: CampaignSort;
}

export interface CreateCampaignInput {
  title: string;
  description: string;
  goal: bigint;
  deadline: string;
  category: string;
  image?: string;
  videoUrl?: string;
  minContribution: bigint;
}

export interface UpdateCampaignInput {
  title?: string;
  description?: string;
  image?: string;
  videoUrl?: string;
}

export interface RecordContributionInput {
  campaignId: string;
  contributor: string;
  amount: bigint;
  transactionHash: string;
}
