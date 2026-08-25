/// Domain types and structures for the crowdfund contract.
///
/// Contains all `#[contracttype]` definitions for state management and
/// function signatures — enums, structs, and the `DataKey` storage key
/// variants.  Event payload types live in the sibling [`super::events`]
/// module.
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

// ── Campaign performance metrics ─────────────────────────────────────────────

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

/// A versioned snapshot of campaign metadata.
#[derive(Clone)]
#[contracttype]
pub struct MetadataVersion {
    pub version: u32,
    pub title: String,
    pub description: String,
    pub timestamp: u64,
}
