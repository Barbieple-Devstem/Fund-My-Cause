/// Data types and structures for the crowdfund contract.
///
/// This module contains all `#[contracttype]` definitions including enums and structs
/// used throughout the contract for state management and function signatures.
use soroban_sdk::{contracttype, Address, String, Vec};

/// Campaign status enumeration.
///
/// Represents the lifecycle state of a crowdfunding campaign.
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum Status {
    /// Campaign is accepting contributions
    Active,
    /// Campaign deadline passed and goal was reached
    Successful,
    /// Campaign deadline passed and goal was not reached (refunds available)
    Refunded,
    /// Campaign was cancelled by creator (refunds available)
    Cancelled,
    /// Campaign is temporarily paused (no new contributions allowed)
    Paused,
    /// Campaign has been archived for historical reference
    Archived,
}

/// Campaign statistics snapshot.
///
/// Contains aggregated metrics about campaign progress and contributor activity.
/// When `FeeMode::OnContribution` is active, `gross_raised` records the sum of
/// all contributions before fee deduction, while `total_raised` (net) is used
/// for goal-progress calculations.
#[derive(Clone)]
#[contracttype]
pub struct CampaignStats {
    /// Net total raised in stroops (after per-contribution fees, if any)
    pub total_raised: i128,
    /// Gross total raised in stroops (before any fee deductions)
    pub gross_raised: i128,
    /// Campaign funding goal in stroops
    pub goal: i128,
    /// Soft cap — minimum viable funding target (0 = not set, uses goal)
    pub soft_cap: i128,
    /// Stretch goal — over-funding target tracked separately (0 = not set)
    pub stretch_goal: i128,
    /// Progress as basis points (0-10000, where 10000 = 100%) relative to soft_cap (or goal if soft_cap=0)
    pub progress_bps: u32,
    /// Number of unique contributors
    pub contributor_count: u32,
    /// Average contribution amount in stroops (total_raised / contributor_count)
    pub average_contribution: i128,
    /// Largest single contribution amount in stroops
    pub largest_contribution: i128,
}

/// Fee deduction mode for the platform fee.
///
/// - `OnSuccess`: fee is deducted once at withdrawal time (original behaviour).
/// - `OnContribution`: a per-contribution fee is deducted and forwarded to the
///   platform address on every `contribute` call.  The gross amount is tracked
///   separately so `get_stats` can report both gross and net totals.
#[derive(Clone, Copy, PartialEq, Debug)]
#[contracttype]
pub enum FeeMode {
    /// Deduct the platform fee from the creator's payout on withdrawal.
    OnSuccess,
    /// Deduct the platform fee from each contribution immediately.
    OnContribution,
}

/// Platform fee configuration.
///
/// Specifies the address that receives platform fees, the fee percentage, and
/// when the fee is collected (`fee_mode`).
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub struct PlatformConfig {
    /// Address that receives platform fees
    pub address: Address,
    /// Fee percentage in basis points (e.g., 250 = 2.5%)
    pub fee_bps: u32,
    /// When to collect the fee: once at withdrawal or per contribution.
    /// Defaults to `OnSuccess` for backward compatibility.
    pub fee_mode: FeeMode,
}

/// Complete campaign information.
///
/// Contains all metadata and configuration for a campaign.
#[derive(Clone)]
#[contracttype]
pub struct CampaignInfo {
    /// Campaign creator's Stellar address
    pub creator: Address,
    /// Token address for contributions
    pub token: Address,
    /// Funding goal in stroops
    pub goal: i128,
    /// Campaign deadline as Unix timestamp (seconds)
    pub deadline: u64,
    /// Minimum contribution amount in stroops
    pub min_contribution: i128,
    /// Maximum contribution amount per contributor in stroops (0 = no limit)
    pub max_contribution: i128,
    /// Campaign title
    pub title: String,
    /// Campaign description
    pub description: String,
    /// Current campaign status
    pub status: Status,
    /// Whether a platform fee is configured
    pub has_platform_config: bool,
    /// Platform fee in basis points (0 if no config)
    pub platform_fee_bps: u32,
    /// Platform fee recipient address
    pub platform_address: Address,
    /// Campaign category
    pub category: Category,
}

/// Campaign update entry with IPFS hash and timestamp.
#[derive(Clone)]
#[contracttype]
pub struct CampaignUpdate {
    /// IPFS hash of the update content
    pub ipfs_hash: String,
    /// Timestamp when update was posted
    pub timestamp: u64,
}

/// Milestone tracking for campaigns.
#[derive(Clone)]
#[contracttype]
pub struct Milestone {
    /// Target amount in stroops
    pub amount: i128,
    /// Milestone description
    pub description: String,
    /// Whether this milestone has been reached
    pub reached: bool,
}

/// Matching configuration for sponsor contributions.
#[derive(Clone)]
#[contracttype]
pub struct MatchingConfig {
    /// Sponsor address providing matching funds
    pub sponsor: Address,
    /// Match ratio in basis points (e.g., 10000 = 1:1 match)
    pub match_ratio: u32,
    /// Maximum total matching amount in stroops
    pub max_match: i128,
}

/// Campaign template type.
#[derive(Clone, Copy, PartialEq, Debug)]
#[contracttype]
pub enum TemplateType {
    /// Charity/nonprofit fundraising
    Charity,
    /// Product launch or development
    Product,
    /// Event or conference
    Event,
    /// Personal cause
    Personal,
    /// Custom template
    Custom,
}

/// Campaign category.
#[derive(Clone, Copy, PartialEq, Debug)]
#[contracttype]
pub enum Category {
    /// Charity/nonprofit
    Charity,
    /// Technology
    Technology,
    /// Creative
    Creative,
    /// Event
    Event,
    /// Personal
    Personal,
    /// Other
    Other,
}

/// Campaign template configuration.
#[derive(Clone)]
#[contracttype]
pub struct CampaignTemplate {
    /// Template type
    pub template_type: TemplateType,
    /// Template name
    pub name: String,
    /// Template description
    pub description: String,
    /// Suggested minimum contribution
    pub suggested_min: i128,
    /// Suggested goal multiplier (e.g., 10000 = 1x)
    pub goal_multiplier: u32,
}

/// Per-address rate limit configuration for contributions.
///
/// Limits the total amount a single address can contribute within a configurable
/// time window. The window is tracked per-address from the moment of the first
/// contribution in the window; once `window_seconds` have elapsed without a new
/// contribution, the period resets.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct RateLimit {
    /// Maximum total contribution amount per address within `window_seconds`.
    pub max_amount: i128,
    /// Length of the per-address window in seconds.
    pub window_seconds: u64,
}

/// Campaign visibility level.
///
/// Controls who can contribute and whether the campaign is publicly discoverable.
/// `Private` campaigns restrict contributions to whitelisted addresses; `Public`
/// and `Unlisted` campaigns place no extra access restriction here, but `Unlisted`
/// signals to frontends that the campaign should not appear in discovery feeds.
#[derive(Clone, Copy, Debug, PartialEq)]
#[contracttype]
pub enum Visibility {
    /// Listed publicly; anyone may contribute.
    Public,
    /// Whitelist-only contributions; not listed in discovery.
    Private,
    /// Anyone may contribute; not listed in discovery.
    Unlisted,
}

/// Delegation configuration.
#[derive(Clone)]
#[contracttype]
pub struct Delegation {
    /// Delegated amount in stroops
    pub amount: i128,
    /// Delegate address
    pub delegate: Address,
    /// Whether delegation is active
    pub active: bool,
}

/// Reward tier for contribution amounts.
///
/// Defines a named reward tier that contributors reach based on their total
/// cumulative contribution.  Tiers should be stored sorted by `min_amount`
/// in ascending order.
///
/// # Example
/// ```ignore
/// // Bronze: ≥ 100 stroops, Silver: ≥ 1_000, Gold: ≥ 10_000
/// ```
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub struct RewardTier {
    /// Minimum cumulative contribution required to qualify (in stroops)
    pub min_amount: i128,
    /// Short display name for the tier (e.g. "Bronze", "Silver", "Gold")
    pub name: String,
    /// Human-readable description of what this tier unlocks
    pub description: String,
}

/// An immutable record of a single contribution.
///
/// Appended to each contributor's persistent history every time they call
/// [`contribute`](crate::CrowdfundContract::contribute).
#[derive(Clone)]
#[contracttype]
pub struct ContributionRecord {
    /// Amount transferred in this contribution (in stroops)
    pub amount: i128,
    /// Ledger timestamp at the moment the contribution was accepted
    pub timestamp: u64,
    /// Contributor's cumulative total after this contribution
    pub running_total: i128,
}

/// Storage key variants for contract data.
///
/// Used to organize persistent and instance storage in the contract.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Contribution amount for a specific address
    Contribution(Address),
    /// Whether an address has contributed (presence flag)
    ContributorPresence(Address),
    /// Total number of unique contributors
    ContributorCount,
    /// Largest single contribution amount
    LargestContribution,
    /// Whitelist of accepted token addresses
    AcceptedTokens,
    /// Contribution message for a specific address
    ContributionMessage(Address),
    /// Recurring contribution plan for a specific address
    RecurringPlan(Address),
    /// Recurring contribution history for a specific address
    RecurringHistory(Address),
    /// Extension proposal data
    ExtensionProposal,
    /// Extension votes for a specific address
    ExtensionVote(Address),
    /// Partial refund amount for a specific address
    PartialRefund(Address),
    /// Insurance fee paid by a specific contributor
    InsuranceFee(Address),
    /// Whitelist flag for a specific address
    Whitelist(Address),
    /// Blacklist flag for a specific address
    Blacklist(Address),
    /// Whitelist-only mode flag
    WhitelistOnly,
    /// Delegation for a specific address
    Delegation(Address),
    /// Delegated contribution amount for a specific address
    DelegatedContribution(Address),
    /// Campaign template
    Template,
    /// Emergency lock time
    EmergencyLockTime,
    /// Rate limit timestamp for a specific address
    RateLimitTimestamp(Address),
    /// Rate limit amount for a specific address
    RateLimitAmount(Address),
    /// Matching configuration
    MatchingConfig,
    /// Total matched amount
    TotalMatched,
    /// Escrowed matching pool (tokens held by contract on behalf of sponsor)
    MatchingPool,
    /// Penalty basis points
    PenaltyBps,
    /// Ordered list of reward tiers configured by the creator
    RewardTiers,
    /// Best reward tier currently assigned to a specific contributor
    ContributorTier(Address),
    /// Full contribution history for a specific contributor
    ContributionHistory(Address),
    /// Required number of approvals for emergency withdrawal multi-sig
    EmergencyApproversRequired,
    /// Running approval count for the active emergency withdrawal session
    EmergencyApprovalCount,
    /// Session token (lock_until timestamp) that a specific address last approved
    EmergencyApproval(Address),
    /// Authorized approver addresses for emergency multi-sig
    EmergencyApproversList,
    /// Reward configuration for the campaign
    RewardConfig,
    /// Total rewards distributed
    TotalRewardsDistributed,
    /// Rewards claimed by a specific contributor
    RewardsClaimed(Address),
    /// Search index entry for the campaign
    SearchIndex,
    /// Campaign title index for search
    TitleIndex,
    /// Campaign category index for filtering
    CategoryIndex,
    // #460: per-function performance stats
    /// Performance stats for a named function
    PerfStats(String),
    /// Indexed contributor address — key is the contributor's insertion order (0-based).
    /// Replaces the monolithic KEY_CONTRIBS Vec to give O(1) per-write cost and
    /// O(page_size) pagination instead of O(n) reads of the full list.
    ContributorIndex(u32),
    /// Yield accounting info for a specific contributor
    YieldInfo(Address),
    /// Whether an address is on the campaign allow-list (#697)
    AllowList(Address),
    /// Whether an address is on the campaign deny-list (#697)
    DenyList(Address),
    /// Governance proposal by nonce
    GovernanceProposal(u32),
    /// Records whether a governor (by address) has voted on a proposal (by nonce)
    GovernanceVote(u32, Address),
    /// Emergency pause approval by governor address
    EmergencyPauseApproval(Address),
    /// Running emergency pause approval count
    EmergencyPauseApprovals,
}

/// Recurring contribution plan.
///
/// Defines a scheduled recurring contribution.
#[derive(Clone)]
#[contracttype]
pub struct RecurringPlan {
    /// Amount to contribute each interval in stroops
    pub amount: i128,
    /// Interval in seconds between contributions
    pub interval: u64,
    /// End date for recurring contributions (Unix timestamp)
    pub end_date: u64,
    /// Timestamp of last execution
    pub last_executed: u64,
}

/// Extension proposal for deadline voting.
///
/// Tracks a proposed deadline extension and voting results.
#[derive(Clone)]
#[contracttype]
pub struct ExtensionProposal {
    /// Proposed new deadline (Unix timestamp)
    pub new_deadline: u64,
    /// Total votes in favor
    pub votes_for: i128,
    /// Total votes against
    pub votes_against: i128,
    /// Proposal creation timestamp
    pub created_at: u64,
    /// Voting period end timestamp
    pub voting_ends_at: u64,
    /// Whether the proposal has been executed
    pub executed: bool,
}

/// Insurance configuration for campaign protection.
///
/// Defines optional insurance parameters for contributor protection.
#[derive(Clone)]
#[contracttype]
pub struct InsuranceConfig {
    /// Insurance fee in basis points (e.g., 100 = 1%)
    pub fee_bps: u32,
    /// Insurance provider address
    pub provider: Address,
    /// Whether insurance is enabled for this campaign
    pub enabled: bool,
}

/// Multi-signature governance configuration.
///
/// Defines the set of authorized governors, minimum approvals required
/// for proposals, and the timelock delay before execution.
#[derive(Clone)]
#[contracttype]
pub struct GovernanceConfig {
    /// List of authorized governor addresses
    pub governors: Vec<soroban_sdk::Address>,
    /// Minimum number of approvals required to pass a proposal
    pub required_approvals: u32,
    /// Timelock delay in seconds before proposal execution
    pub timelock_delay: u64,
}

/// Governance proposal for platform configuration changes.
///
/// Tracks a proposed platform config update with voting and timelock status.
#[derive(Clone)]
#[contracttype]
pub struct GovernanceProposal {
    /// Unique proposal nonce/ID
    pub nonce: u32,
    /// Address of the governor who created the proposal
    pub proposer: soroban_sdk::Address,
    /// Proposed platform fee recipient address
    pub platform_address: soroban_sdk::Address,
    /// Proposed platform fee in basis points
    pub platform_fee_bps: u32,
    /// Timestamp when the proposal was created
    pub created_at: u64,
    /// Timestamp when voting ends
    pub voting_ends_at: u64,
    /// Number of approvals received
    pub approvals: u32,
    /// Timestamp when the timelock expires (0 if not yet met threshold)
    pub timelock_until: u64,
    /// Whether the proposal has been executed
    pub executed: bool,
}

// ── Missing types referenced in lib.rs ───────────────────────────────────────

/// Vesting schedule for campaign withdrawal.
///
/// Defines a cliff-and-duration vesting schedule for creator payouts.
#[derive(Clone)]
#[contracttype]
pub struct VestingSchedule {
    /// Cliff timestamp — no withdrawal before this point (Unix seconds)
    pub cliff: u64,
    /// Duration in seconds over which funds vest linearly after the cliff
    pub duration: u64,
}

/// Records a single goal adjustment for audit history.
#[derive(Clone)]
#[contracttype]
pub struct GoalAdjustment {
    /// Goal value before the adjustment
    pub previous_goal: i128,
    /// Goal value after the adjustment
    pub new_goal: i128,
    /// Ledger timestamp when the adjustment occurred
    pub timestamp: u64,
}

// ── Structured event payloads ─────────────────────────────────────────────────
//
// Each event emitted by the contract carries one of these structs as its data
// payload.  Using typed structs instead of raw tuples makes events indexable,
// self-documenting, and forward-compatible.

/// Emitted when a campaign is successfully initialized.
///
/// Event topic: `("campaign", "initialized")`
#[derive(Clone)]
#[contracttype]
pub struct EventInitialized {
    pub creator: Address,
    pub goal: i128,
    pub deadline: u64,
    pub category: Category,
    pub schema_version: u32,
}

/// Emitted when a contribution is accepted.
///
/// Event topic: `("campaign", "contributed")`
#[derive(Clone)]
#[contracttype]
pub struct EventContributed {
    pub contributor: Address,
    pub amount: i128,
    /// New running total for this contributor after this contribution
    pub new_total: i128,
    /// Matched amount added by a sponsor (0 if no matching configured)
    pub matched_amount: i128,
    pub schema_version: u32,
}

/// Emitted when the creator withdraws funds after a successful campaign.
///
/// Event topic: `("campaign", "withdrawn")`
#[derive(Clone)]
#[contracttype]
pub struct EventWithdrawn {
    pub creator: Address,
    /// Total raised at the time of withdrawal (before fee deduction)
    pub total: i128,
    /// Platform fee deducted (0 if no platform config)
    pub fee: i128,
    /// Net amount transferred to the creator
    pub payout: i128,
    pub schema_version: u32,
}

/// Emitted when a contributor claims a full refund.
///
/// Event topic: `("campaign", "refunded")`
#[derive(Clone)]
#[contracttype]
pub struct EventRefunded {
    pub contributor: Address,
    pub amount: i128,
    pub schema_version: u32,
}

/// Emitted when a contributor claims a partial refund before the deadline.
///
/// Event topic: `("campaign", "partial_refund")`
#[derive(Clone)]
#[contracttype]
pub struct EventPartialRefund {
    pub contributor: Address,
    pub amount: i128,
    /// Remaining contribution balance after the partial refund
    pub remaining: i128,
}

/// Emitted when the campaign status changes.
///
/// Event topic: `("campaign", "status_changed")`
#[derive(Clone)]
#[contracttype]
pub struct EventStatusChanged {
    pub old_status: Status,
    pub new_status: Status,
}

/// Emitted when campaign metadata is updated.
///
/// Event topic: `("campaign", "metadata_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventMetadataUpdated {
    pub updated_title: bool,
    pub updated_description: bool,
    pub updated_social_links: bool,
}

/// Emitted when the campaign deadline is extended directly by the creator.
///
/// Event topic: `("campaign", "deadline_extended")`
#[derive(Clone)]
#[contracttype]
pub struct EventDeadlineExtended {
    pub old_deadline: u64,
    pub new_deadline: u64,
}

/// Emitted when a deadline extension proposal is created.
///
/// Event topic: `("campaign", "extension_proposed")`
#[derive(Clone)]
#[contracttype]
pub struct EventExtensionProposed {
    pub new_deadline: u64,
    pub voting_ends_at: u64,
}

/// Emitted when a contributor votes on a deadline extension.
///
/// Event topic: `("campaign", "extension_voted")`
#[derive(Clone)]
#[contracttype]
pub struct EventExtensionVoted {
    pub contributor: Address,
    pub approve: bool,
    pub vote_weight: i128,
}

/// Emitted when a deadline extension is executed after successful voting.
///
/// Event topic: `("campaign", "extension_executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventExtensionExecuted {
    pub new_deadline: u64,
    pub votes_for: i128,
    pub votes_against: i128,
}

/// Emitted when a recurring contribution plan is set up.
///
/// Event topic: `("campaign", "recurring_setup")`
#[derive(Clone)]
#[contracttype]
pub struct EventRecurringSetup {
    pub contributor: Address,
    pub amount: i128,
    pub interval: u64,
    pub end_date: u64,
}

/// Emitted when a recurring contribution is executed.
///
/// Event topic: `("campaign", "recurring_executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventRecurringExecuted {
    pub contributor: Address,
    pub amount: i128,
}

/// Emitted when a recurring plan is cancelled.
///
/// Event topic: `("campaign", "recurring_cancelled")`
#[derive(Clone)]
#[contracttype]
pub struct EventRecurringCancelled {
    pub contributor: Address,
}

/// Emitted when a delegation is created.
///
/// Event topic: `("campaign", "delegation_created")`
#[derive(Clone)]
#[contracttype]
pub struct EventDelegationCreated {
    pub delegator: Address,
    pub delegate: Address,
    pub amount: i128,
}

/// Emitted when a delegated contribution is made.
///
/// Event topic: `("campaign", "delegated_contribution")`
#[derive(Clone)]
#[contracttype]
pub struct EventDelegatedContribution {
    pub delegator: Address,
    pub delegate: Address,
    pub amount: i128,
}

/// Emitted when a delegation is revoked.
///
/// Event topic: `("campaign", "delegation_revoked")`
#[derive(Clone)]
#[contracttype]
pub struct EventDelegationRevoked {
    pub delegator: Address,
}

/// Emitted when an address is added to the whitelist.
///
/// Event topic: `("campaign", "whitelisted")`
#[derive(Clone)]
#[contracttype]
pub struct EventWhitelisted {
    pub address: Address,
}

/// Emitted when an address is removed from the whitelist.
///
/// Event topic: `("campaign", "whitelist_removed")`
#[derive(Clone)]
#[contracttype]
pub struct EventWhitelistRemoved {
    pub address: Address,
}

/// Emitted when an address is added to the blacklist.
///
/// Event topic: `("campaign", "blacklisted")`
#[derive(Clone)]
#[contracttype]
pub struct EventBlacklisted {
    pub address: Address,
}

/// Emitted when an address is removed from the blacklist.
///
/// Event topic: `("campaign", "blacklist_removed")`
#[derive(Clone)]
#[contracttype]
pub struct EventBlacklistRemoved {
    pub address: Address,
}

/// Emitted when whitelist-only mode is toggled.
///
/// Event topic: `("campaign", "whitelist_only_set")`
#[derive(Clone)]
#[contracttype]
pub struct EventWhitelistOnlySet {
    pub enabled: bool,
}

/// Emitted when the rate limit is updated.
///
/// Event topic: `("campaign", "rate_limit_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventRateLimitUpdated {
    /// Maximum total contribution amount per address within `window_seconds`.
    pub max_amount: i128,
    /// Window length in seconds (0 when the rate limit is cleared).
    pub window_seconds: u64,
}

/// Emitted when a contribution is rejected because it would exceed the rate limit.
///
/// Event topic: `("campaign", "rate_limit_hit")`
#[derive(Clone)]
#[contracttype]
pub struct EventRateLimitHit {
    pub contributor: Address,
    /// Amount the contributor attempted to add.
    pub attempted: i128,
    /// Amount already counted toward the contributor's current window.
    pub period_amount: i128,
    /// Configured maximum for the window.
    pub max_amount: i128,
}

/// Emitted when a campaign's visibility level is changed.
///
/// Event topic: `("campaign", "visibility_changed")`
#[derive(Clone)]
#[contracttype]
pub struct EventVisibilityChanged {
    pub old_visibility: Visibility,
    pub new_visibility: Visibility,
}

/// Emitted when an emergency withdrawal is initiated.
///
/// Event topic: `("campaign", "emergency_initiated")`
#[derive(Clone)]
#[contracttype]
pub struct EventEmergencyInitiated {
    pub lock_until: u64,
}

/// Emitted when an emergency withdrawal is executed.
///
/// Event topic: `("campaign", "emergency_executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventEmergencyExecuted {
    pub amount: i128,
}

/// Emitted when insurance is enabled for the campaign.
///
/// Event topic: `("insurance", "enabled")`
#[derive(Clone)]
#[contracttype]
pub struct EventInsuranceEnabled {
    pub fee_bps: u32,
    pub provider: Address,
}

/// Emitted when an insurance payout is processed.
///
/// Event topic: `("insurance", "payout")`
#[derive(Clone)]
#[contracttype]
pub struct EventInsurancePayout {
    pub contributor: Address,
    pub amount: i128,
}

/// Emitted when emergency withdrawal multi-sig is configured.
///
/// Event topic: `("campaign", "multisig_configured")`
#[derive(Clone)]
#[contracttype]
pub struct EventMultiSigConfigured {
    /// Minimum number of approvals required to execute the emergency withdrawal
    pub required_approvals: u32,
    /// Total number of authorised approver addresses
    pub approver_count: u32,
}

/// Emitted when an emergency withdrawal approval is submitted by an approver.
///
/// Event topic: `("campaign", "emergency_approved")`
#[derive(Clone)]
#[contracttype]
pub struct EventEmergencyApproved {
    /// Address of the approver who submitted this approval
    pub approver: Address,
    /// Running approval count for the current session after this approval
    pub approval_count: u32,
}

/// Emitted when a contribution matching pool is configured.
///
/// Event topic: `("campaign", "matching_setup")`
#[derive(Clone)]
#[contracttype]
pub struct EventMatchingSetup {
    /// Sponsor address funding the matching pool
    pub sponsor: Address,
    /// Match ratio in basis points (e.g. 10 000 = 1 : 1)
    pub match_ratio: u32,
    /// Maximum total matching amount in stroops
    pub max_match: i128,
}

/// Emitted when a campaign is initialised via a template.
///
/// Event topic: `("campaign", "template_applied")`
#[derive(Clone)]
#[contracttype]
pub struct EventTemplateApplied {
    /// Template type used to initialise the campaign
    pub template_type: TemplateType,
    /// Minimum contribution derived from the template
    pub suggested_min: i128,
}

/// Emitted when the campaign category is updated by the creator.
///
/// Event topic: `("campaign", "category_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventCategoryUpdated {
    /// Previous category before the update
    pub old_category: Category,
    /// New category after the update
    pub new_category: Category,
}

/// Emitted when the campaign is paused.
///
/// Event topic: `("campaign", "paused")`
#[derive(Clone)]
#[contracttype]
pub struct EventPaused {
    pub timestamp: u64,
}

/// Emitted when the campaign is resumed.
///
/// Event topic: `("campaign", "resumed")`
#[derive(Clone)]
#[contracttype]
pub struct EventResumed {
    pub timestamp: u64,
}

/// Emitted when a campaign is cancelled.
///
/// Event topic: `("campaign", "cancelled")`
#[derive(Clone)]
#[contracttype]
pub struct EventCancelled {
    pub creator: Address,
    pub total_raised: i128,
}

/// Emitted after a batch refund completes.
///
/// Event topic: `("campaign", "batch_refund_completed")`
#[derive(Clone)]
#[contracttype]
pub struct EventBatchRefundCompleted {
    pub total_refunded: u32,
    pub batch_size: u32,
}

/// Emitted when a contributor is assigned a reward tier.
///
/// Event topic: `("campaign", "tier_assigned")`
#[derive(Clone)]
#[contracttype]
pub struct EventTierAssigned {
    pub contributor: Address,
    pub tier_name: String,
    pub min_amount: i128,
}

/// Emitted when reward tiers are configured.
///
/// Event topic: `("campaign", "tiers_set")`
#[derive(Clone)]
#[contracttype]
pub struct EventTiersSet {
    pub tier_count: u32,
}

/// Emitted when a metadata version snapshot is stored.
///
/// Event topic: `("campaign", "metadata_versioned")`
#[derive(Clone)]
#[contracttype]
pub struct EventMetadataVersioned {
    pub version: u32,
    pub timestamp: u64,
}

/// A versioned snapshot of campaign metadata.
#[derive(Clone)]
#[contracttype]
pub struct MetadataVersion {
    pub version: u32,
    pub title: String,
    pub description: String,
    pub timestamp: u64,
}

/// Campaign performance metrics for tracking success rates and indicators.
///
/// Contains aggregated performance data including success rate, contribution velocity,
/// trending information, and milestone achievement tracking.
#[derive(Clone)]
#[contracttype]
pub struct PerformanceMetrics {
    /// Success rate as basis points (0-10000, where 10000 = 100%)
    /// Calculated as (total_raised / goal) * 10000, capped at 10000
    pub success_rate_bps: u32,
    /// Contribution velocity in stroops per day
    /// Calculated based on recent contribution activity
    pub contribution_velocity: i128,
    /// Trending direction: positive = increasing, negative = decreasing, zero = stable
    /// Calculated by comparing recent contributions to earlier ones
    pub trending: i32,
    /// Number of milestones reached
    pub milestones_reached: u32,
    /// Total number of milestones configured
    pub total_milestones: u32,
    /// Time elapsed since campaign start in seconds
    pub time_elapsed: u64,
    /// Estimated time to reach goal in seconds (0 if goal already reached or unreachable)
    pub estimated_time_to_goal: u64,
    /// Average daily contribution amount in stroops
    pub average_daily_contribution: i128,
}

/// Emitted when the campaign goal is adjusted.
///
/// Event topic: `("campaign", "goal_adjusted")`
#[derive(Clone)]
#[contracttype]
pub struct EventGoalAdjusted {
    pub previous_goal: i128,
    pub new_goal: i128,
    pub timestamp: u64,
}

/// Emitted when a contribution is recorded with full detail.
///
/// Event topic: `("campaign", "contribution_recorded")`
#[derive(Clone)]
#[contracttype]
pub struct EventContributionRecorded {
    pub contributor: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub running_total: i128,
}

/// Emitted when a campaign is archived.
///
/// Event topic: `("campaign", "archived")`
#[derive(Clone)]
#[contracttype]
pub struct EventArchived {
    pub creator: Address,
    pub total_raised: i128,
    pub timestamp: u64,
}

/// Emitted when campaign ownership is transferred to a new address.
///
/// Event topic: `("campaign", "ownership_transferred")`
#[derive(Clone)]
#[contracttype]
pub struct EventOwnershipTransferred {
    pub previous_owner: Address,
    pub new_owner: Address,
}

// ── Issue #436: Campaign Milestones ───────────────────────────────────────────

/// Verification status for milestone completion.
#[derive(Clone, Copy, PartialEq, Debug)]
#[contracttype]
pub enum MilestoneStatus {
    /// Milestone not yet reached
    Pending,
    /// Milestone reached and verified
    Verified,
    /// Milestone reached but not yet verified
    Unverified,
}

/// Emitted when a milestone is reached.
///
/// Event topic: `("campaign", "milestone_reached")`
#[derive(Clone)]
#[contracttype]
pub struct EventMilestoneReached {
    pub milestone_index: u32,
    pub amount: i128,
    pub timestamp: u64,
}

/// Emitted when a milestone is verified.
///
/// Event topic: `("campaign", "milestone_verified")`
#[derive(Clone)]
#[contracttype]
pub struct EventMilestoneVerified {
    pub milestone_index: u32,
    pub timestamp: u64,
}

/// Emitted when funds are released based on milestone completion.
///
/// Event topic: `("campaign", "milestone_release")`
#[derive(Clone)]
#[contracttype]
pub struct EventMilestoneRelease {
    pub milestone_index: u32,
    pub amount: i128,
    pub timestamp: u64,
}

// ── Issue #437: Contribution Verification (KYC/AML) ──────────────────────────

/// Verification status for KYC/AML compliance.
#[derive(Clone, Copy, PartialEq, Debug)]
#[contracttype]
pub enum VerificationStatus {
    /// Not yet verified
    Unverified,
    /// Verification pending
    Pending,
    /// Verification approved
    Approved,
    /// Verification rejected
    Rejected,
}

/// Emitted when a contributor's verification status is updated.
///
/// Event topic: `("campaign", "verification_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventVerificationUpdated {
    pub contributor: Address,
    pub status: VerificationStatus,
    pub timestamp: u64,
}

// ── Issue #438: Campaign Analytics ────────────────────────────────────────────

/// Time-series data point for analytics tracking.
#[derive(Clone)]
#[contracttype]
pub struct AnalyticsDataPoint {
    /// Timestamp of the data point
    pub timestamp: u64,
    /// Total raised at this point
    pub total_raised: i128,
    /// Number of contributors at this point
    pub contributor_count: u32,
    /// Average contribution at this point
    pub average_contribution: i128,
}

/// Campaign analytics with contribution patterns and metrics.
#[derive(Clone)]
#[contracttype]
pub struct CampaignAnalytics {
    /// Total contributions tracked
    pub total_contributions: u32,
    /// Average contribution amount
    pub average_contribution: i128,
    /// Median contribution amount
    pub median_contribution: i128,
    /// Standard deviation of contributions
    pub std_deviation: i128,
    /// Peak contribution amount
    pub peak_contribution: i128,
    /// Lowest contribution amount
    pub lowest_contribution: i128,
    /// Contribution velocity (per day)
    pub contribution_velocity: i128,
    /// Number of data points in time series
    pub data_points_count: u32,
}

/// Emitted when analytics are generated.
///
/// Event topic: `("campaign", "analytics_generated")`
#[derive(Clone)]
#[contracttype]
pub struct EventAnalyticsGenerated {
    pub total_contributions: u32,
    pub average_contribution: i128,
    pub peak_contribution: i128,
    pub timestamp: u64,
}

// ── Issue #439: Dispute Resolution System ─────────────────────────────────────

/// Dispute status enumeration.
#[derive(Clone, Copy, PartialEq, Debug)]
#[contracttype]
pub enum DisputeStatus {
    /// Dispute filed and pending review
    Filed,
    /// Dispute under investigation
    InReview,
    /// Dispute resolved in favor of filer
    ResolvedInFavor,
    /// Dispute resolved against filer
    ResolvedAgainst,
    /// Dispute dismissed
    Dismissed,
}

/// Dispute record for campaign issues.
#[derive(Clone)]
#[contracttype]
pub struct Dispute {
    /// Unique dispute ID
    pub id: u32,
    /// Address that filed the dispute
    pub filer: Address,
    /// Dispute description
    pub description: String,
    /// Current dispute status
    pub status: DisputeStatus,
    /// Timestamp when dispute was filed
    pub filed_at: u64,
    /// Timestamp when dispute was resolved (0 if unresolved)
    pub resolved_at: u64,
    /// Total votes in favor of filer
    pub votes_for: i128,
    /// Total votes against filer
    pub votes_against: i128,
}

/// Emitted when a dispute is filed.
///
/// Event topic: `("campaign", "dispute_filed")`
#[derive(Clone)]
#[contracttype]
pub struct EventDisputeFiled {
    pub dispute_id: u32,
    pub filer: Address,
    pub timestamp: u64,
}

/// Emitted when a vote is cast on a dispute.
///
/// Event topic: `("campaign", "dispute_voted")`
#[derive(Clone)]
#[contracttype]
pub struct EventDisputeVoted {
    pub dispute_id: u32,
    pub voter: Address,
    pub vote_weight: i128,
    pub in_favor: bool,
    pub timestamp: u64,
}

/// Emitted when a dispute is resolved.
///
/// Event topic: `("campaign", "dispute_resolved")`
#[derive(Clone)]
#[contracttype]
pub struct EventDisputeResolved {
    pub dispute_id: u32,
    pub status: DisputeStatus,
    pub votes_for: i128,
    pub votes_against: i128,
    pub timestamp: u64,
}

// ── Issue #457: Contract Versioning ──────────────────────────────────────────

/// Records a contract version migration.
#[derive(Clone)]
#[contracttype]
pub struct VersionMigration {
    /// Version migrated from
    pub from_version: u32,
    /// Version migrated to
    pub to_version: u32,
    /// Timestamp of migration
    pub timestamp: u64,
}

/// Emitted when the contract version is checked.
///
/// Event topic: `("contract", "version_checked")`
#[derive(Clone)]
#[contracttype]
pub struct EventVersionChecked {
    pub current_version: u32,
    pub expected_version: u32,
    pub compatible: bool,
}

/// Emitted when a contract migration is executed.
///
/// Event topic: `("contract", "migrated")`
#[derive(Clone)]
#[contracttype]
pub struct EventContractMigrated {
    pub from_version: u32,
    pub to_version: u32,
    pub timestamp: u64,
}

// ── Issue #458: State Validation ──────────────────────────────────────────────

/// Result of a full state invariant check.
#[derive(Clone)]
#[contracttype]
pub struct StateValidationResult {
    /// Whether all invariants passed
    pub valid: bool,
    /// Number of invariants checked
    pub checks_passed: u32,
    /// Number of invariants that failed
    pub checks_failed: u32,
    /// Timestamp of the validation
    pub timestamp: u64,
}

/// Emitted when state validation is run.
///
/// Event topic: `("contract", "state_validated")`
#[derive(Clone)]
#[contracttype]
pub struct EventStateValidated {
    pub valid: bool,
    pub checks_passed: u32,
    pub checks_failed: u32,
    pub timestamp: u64,
}

/// Emitted when a state invariant violation is detected.
///
/// Event topic: `("contract", "invariant_violated")`
#[derive(Clone)]
#[contracttype]
pub struct EventInvariantViolated {
    pub invariant_id: u32,
    pub timestamp: u64,
}

// ── Issue #459: Debugging Utilities ──────────────────────────────────────────

/// A snapshot of the full contract state for debugging.
#[derive(Clone)]
#[contracttype]
pub struct ContractStateSnapshot {
    /// Current contract version
    pub version: u32,
    /// Current campaign status
    pub status: Status,
    /// Total raised
    pub total_raised: i128,
    /// Campaign goal
    pub goal: i128,
    /// Number of contributors
    pub contributor_count: u32,
    /// Campaign deadline
    pub deadline: u64,
    /// Snapshot timestamp
    pub timestamp: u64,
}

/// Emitted when a debug state snapshot is taken.
///
/// Event topic: `("debug", "snapshot")`
#[derive(Clone)]
#[contracttype]
pub struct EventDebugSnapshot {
    pub version: u32,
    pub status: Status,
    pub total_raised: i128,
    pub contributor_count: u32,
    pub timestamp: u64,
}

/// Emitted for a debug log entry.
///
/// Event topic: `("debug", "log")`
#[derive(Clone)]
#[contracttype]
pub struct EventDebugLog {
    pub message: String,
    pub timestamp: u64,
}

// ── Issue #460: Performance Monitoring ───────────────────────────────────────

/// Records execution time for a contract function.
#[derive(Clone)]
#[contracttype]
pub struct ExecutionRecord {
    /// Name/identifier of the function
    pub function_name: String,
    /// Ledger timestamp when the call was recorded
    pub timestamp: u64,
    /// Execution duration in ledger time units (approximated)
    pub duration_ms: u64,
}

/// Aggregated performance stats for a function.
#[derive(Clone)]
#[contracttype]
pub struct FunctionPerfStats {
    /// Total number of calls recorded
    pub call_count: u32,
    /// Cumulative duration across all calls
    pub total_duration_ms: u64,
    /// Maximum single-call duration observed
    pub max_duration_ms: u64,
}

/// Emitted when a function execution time is recorded.
///
/// Event topic: `("perf", "execution_recorded")`
#[derive(Clone)]
#[contracttype]
pub struct EventExecutionRecorded {
    pub function_name: String,
    pub duration_ms: u64,
    pub timestamp: u64,
}

/// Emitted when a performance alert threshold is breached.
///
/// Event topic: `("perf", "alert")`
#[derive(Clone)]
#[contracttype]
pub struct EventPerfAlert {
    pub function_name: String,
    pub duration_ms: u64,
    pub threshold_ms: u64,
    pub timestamp: u64,
}

// ── DeFi: Yield Generation ────────────────────────────────────────────────────

/// Yield configuration set by the campaign creator.
///
/// The creator deposits a pool of `reward_token` into the contract.
/// Contributors earn yield proportional to their share of total contributions,
/// accrued linearly over the campaign duration.
#[derive(Clone)]
#[contracttype]
pub struct YieldConfig {
    /// Token used to pay out yield (may be the same as the campaign token or different)
    pub reward_token: Address,
    /// Total reward pool deposited by the creator (in reward token's smallest unit)
    pub pool: i128,
    /// Annual yield rate in basis points (e.g. 500 = 5% APY)
    pub rate_bps: u32,
    /// Timestamp when yield accrual started (set to campaign start time)
    pub start_time: u64,
}

/// Per-contributor yield accounting snapshot.
#[derive(Clone)]
#[contracttype]
pub struct YieldInfo {
    /// Yield already claimed by this contributor (in reward token units)
    pub claimed: i128,
    /// Snapshot of the yield-per-share accumulator at last claim/update
    pub reward_debt: i128,
}

/// Emitted when yield is configured by the creator.
///
/// Event topic: `("defi", "yield_configured")`
#[derive(Clone)]
#[contracttype]
pub struct EventYieldConfigured {
    pub reward_token: Address,
    pub pool: i128,
    pub rate_bps: u32,
}

/// Emitted when a contributor claims their accrued yield.
///
/// Event topic: `("defi", "yield_claimed")`
#[derive(Clone)]
#[contracttype]
pub struct EventYieldClaimed {
    pub contributor: Address,
    pub amount: i128,
}

// ── Governance Events (Multi-Sig) ────────────────────────────────────────────

/// Emitted when a governance proposal is created.
///
/// Event topic: `("governance", "proposed")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceProposed {
    pub nonce: u32,
    pub proposer: soroban_sdk::Address,
    pub platform_address: soroban_sdk::Address,
    pub platform_fee_bps: u32,
    pub voting_ends_at: u64,
}

/// Emitted when a governance vote is cast.
///
/// Event topic: `("governance", "voted")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceVoted {
    pub nonce: u32,
    pub governor: soroban_sdk::Address,
    pub approvals: u32,
    pub required: u32,
}

/// Emitted when a governance proposal is executed after timelock.
///
/// Event topic: `("governance", "executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceExecuted {
    pub nonce: u32,
    pub platform_address: soroban_sdk::Address,
    pub platform_fee_bps: u32,
}

/// Emitted when governance configuration is updated.
///
/// Event topic: `("governance", "config_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceConfigUpdated {
    pub required_approvals: u32,
    pub governor_count: u32,
    pub timelock_delay: u64,
}

/// Emitted when the contract is emergency paused by governance.
///
/// Event topic: `("governance", "emergency_paused")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceEmergencyPaused {
    pub timestamp: u64,
}

/// Emitted when the contract is resumed from emergency pause by governance.
///
/// Event topic: `("governance", "emergency_resumed")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceEmergencyResumed {
    pub timestamp: u64,
}

// ── Issue #634: Quadratic-Funding Hooks ──────────────────────────────────────

/// Per-contributor data used for off-chain quadratic-funding distribution.
///
/// `sqrt(contribution)` is computed off-chain; the contract exposes the raw
/// inputs so any QF calculator can work with them without trusted intermediaries.
#[derive(Clone)]
#[contracttype]
pub struct QfContributorInput {
    /// Contributor address
    pub contributor: Address,
    /// Cumulative amount contributed by this address (in stroops)
    pub amount: i128,
}

/// Aggregate QF inputs for the whole campaign.
///
/// Returned by `get_qf_inputs()`.
#[derive(Clone)]
#[contracttype]
pub struct QfInputs {
    /// Total number of unique contributors
    pub contributor_count: u32,
    /// Per-contributor amounts; ordered by first-contribution time
    pub contributors: soroban_sdk::Vec<QfContributorInput>,
}

/// Emitted on every contribution with the per-contributor weighting inputs.
///
/// Event topic: `("campaign", "qf_contribution")`
#[derive(Clone)]
#[contracttype]
pub struct EventQfContribution {
    /// Contributor address
    pub contributor: Address,
    /// Incremental amount added in this contribution (in stroops)
    pub amount: i128,
    /// Contributor's cumulative total after this contribution (in stroops)
    pub cumulative: i128,
    /// Distinct-contributor count after this contribution
    pub contributor_count: u32,
}

// ── Issue #703: Event schema versioning ──────────────────────────────────────

/// Current event schema version.  Bump this when the shape of any emitted
/// event payload changes in a backwards-incompatible way so that indexers can
/// adapt without guessing.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

// ── Issue #704: Withdrawal streaming ─────────────────────────────────────────

/// Optional streaming / scheduled-release configuration for creator withdrawals.
///
/// When set, the creator cannot withdraw as a lump sum after the campaign
/// succeeds.  Instead, funds unlock linearly between `start_time` and
/// `end_time`.  The creator calls `claim_stream()` at any point after
/// `start_time` to pull whatever has vested since their last claim.
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub struct StreamConfig {
    /// Unix timestamp when streaming begins (must be >= campaign deadline)
    pub start_time: u64,
    /// Unix timestamp when all funds are fully unlocked
    pub end_time: u64,
    /// Amount already claimed by the creator (in stroops)
    pub claimed: i128,
}

/// Emitted when a stream claim is executed.
///
/// Event topic: `("campaign", "stream_claimed")`
#[derive(Clone)]
#[contracttype]
pub struct EventStreamClaimed {
    pub creator: Address,
    pub amount: i128,
    pub remaining: i128,
    pub schema_version: u32,
}

// ── Issue #694: Soft-cap / stretch-goal ──────────────────────────────────────

/// Emitted when soft-cap or stretch-goal is configured.
///
/// Event topic: `("campaign", "caps_configured")`
#[derive(Clone)]
#[contracttype]
pub struct EventCapsConfigured {
    /// Soft cap amount in stroops (0 = not set)
    pub soft_cap: i128,
    /// Stretch goal amount in stroops (0 = not set)
    pub stretch_goal: i128,
}

// ── Issue #696: Pause timelock ───────────────────────────────────────────────

/// Emitted when the campaign is paused with a timelock.
///
/// Event topic: `("campaign", "paused_with_timelock")`
#[derive(Clone)]
#[contracttype]
pub struct EventPausedWithTimelock {
    pub timestamp: u64,
    /// Earliest time the campaign can be unpaused
    pub unpause_after: u64,
}

// ── Issue #697: Allow/deny list ──────────────────────────────────────────────

/// Emitted when an address is added to the allow list.
///
/// Event topic: `("campaign", "allowlisted")`
#[derive(Clone)]
#[contracttype]
pub struct EventAllowlisted {
    pub address: Address,
}

/// Emitted when an address is removed from the allow list.
///
/// Event topic: `("campaign", "allowlist_removed")`
#[derive(Clone)]
#[contracttype]
pub struct EventAllowlistRemoved {
    pub address: Address,
}

/// Emitted when an address is added to the deny list.
///
/// Event topic: `("campaign", "denylisted")`
#[derive(Clone)]
#[contracttype]
pub struct EventDenylisted {
    pub address: Address,
}

/// Emitted when an address is removed from the deny list.
///
/// Event topic: `("campaign", "denylist_removed")`
#[derive(Clone)]
#[contracttype]
pub struct EventDenylistRemoved {
    pub address: Address,
}

// ── Issue #418: Contributor rewards ──────────────────────────────────────────

/// Configuration for contributor reward-token distribution.
///
/// When enabled, contributors can claim `reward_token` proportional to their
/// contribution (`contribution * reward_per_unit / 1_000_000`).
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub struct RewardConfig {
    /// The token minted/transferred as a reward
    pub reward_token: Address,
    /// Reward units granted per 1_000_000 stroops contributed
    pub reward_per_unit: i128,
    /// Whether reward distribution is currently active
    pub enabled: bool,
}

/// Emitted when contributor rewards are configured.
///
/// Event topic: `("campaign", "rewards_configured")`
#[derive(Clone)]
#[contracttype]
pub struct EventRewardsConfigured {
    pub reward_token: Address,
    pub reward_per_unit: i128,
}

/// Emitted when rewards are distributed to a contributor.
///
/// Event topic: `("campaign", "rewards_distributed")`
#[derive(Clone)]
#[contracttype]
pub struct EventRewardsDistributed {
    pub contributor: Address,
    pub contribution_amount: i128,
    pub reward_amount: i128,
}

// ── Issue #416: Campaign search index ────────────────────────────────────────

/// A searchable index entry describing a campaign's discoverable metadata.
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub struct SearchIndexEntry {
    pub title: String,
    pub description: String,
    pub category: Category,
    pub visibility: Visibility,
    pub created_at: u64,
    pub status: Status,
}

/// Emitted when a campaign is (re)indexed.
///
/// Event topic: `("campaign", "indexed")`
#[derive(Clone)]
#[contracttype]
pub struct EventCampaignIndexed {
    pub title: String,
    pub category: Category,
    pub visibility: Visibility,
}

/// Emitted when a campaign is cloned into a new campaign.
///
/// Event topic: `("campaign", "cloned")`
#[derive(Clone)]
#[contracttype]
pub struct EventCampaignCloned {
    pub original_creator: Address,
    pub new_creator: Address,
    pub new_goal: i128,
    pub new_deadline: u64,
}

// ── Issue #699: IPFS metadata ────────────────────────────────────────────────

/// Emitted when the campaign's off-chain IPFS CID is updated.
///
/// Event topic: `("campaign", "ipfs_cid_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventIpfsCidUpdated {
    pub cid: String,
    pub timestamp: u64,
}

