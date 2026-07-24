//! # Fund-My-Cause Crowdfund Contract
//!
//! A Soroban smart contract for decentralised crowdfunding on the Stellar network.
//!
//! ## Overview
//!
//! Each deployed instance of [`CrowdfundContract`] represents a single crowdfunding
//! campaign. The contract lifecycle is:
//!
//! 1. **Initialise** — creator calls [`initialize`](CrowdfundContract::initialize) once.
//! 2. **Contribute** — backers call [`contribute`](CrowdfundContract::contribute) before the deadline.
//! 3. **Withdraw** — if goal is met after deadline, creator calls [`withdraw`](CrowdfundContract::withdraw).
//! 4. **Refund** — if goal is not met (or campaign is cancelled), contributors call
//!    [`refund_single`](CrowdfundContract::refund_single) to reclaim their funds.
//!
//! ## Advanced Features
//!
//! - **Recurring contributions** — [`setup_recurring`](CrowdfundContract::setup_recurring) /
//!   [`execute_recurring`](CrowdfundContract::execute_recurring)
//! - **Delegation** — [`delegate_contribution`](CrowdfundContract::delegate_contribution) /
//!   [`contribute_on_behalf`](CrowdfundContract::contribute_on_behalf)
//! - **Deadline extension voting** — [`propose_extension`](CrowdfundContract::propose_extension) /
//!   [`vote_on_extension`](CrowdfundContract::vote_on_extension) /
//!   [`execute_extension`](CrowdfundContract::execute_extension)
//! - **Whitelist / Blacklist** — [`add_to_whitelist`](CrowdfundContract::add_to_whitelist) /
//!   [`add_to_blacklist`](CrowdfundContract::add_to_blacklist)
//! - **Partial refunds** — [`refund_partial`](CrowdfundContract::refund_partial)
//! - **Emergency withdrawal** — [`initiate_emergency_withdrawal`](CrowdfundContract::initiate_emergency_withdrawal) /
//!   [`execute_emergency_withdrawal`](CrowdfundContract::execute_emergency_withdrawal)
//! - **Insurance** — [`enable_insurance`](CrowdfundContract::enable_insurance)
//! - **Vesting** — configurable cliff + linear vesting on withdrawal
//! - **Matching** — sponsor-funded contribution matching
//!
//! ## Storage Model
//!
//! - **Instance storage** — campaign-wide state (status, goal, deadline, totals).
//! - **Persistent storage** — per-contributor data (balances, plans, flags).
//!
//! ### Initialization invariant (why some `inst.get(&KEY_*).unwrap()` reads are safe)
//!
//! The core campaign keys — `KEY_CREATOR`, `KEY_STATUS`, `KEY_GOAL`, `KEY_DEADLINE`,
//! `KEY_TOKEN`, `KEY_MIN`, `KEY_ADMIN`, `KEY_TOTAL` and friends — are written exactly
//! once by [`initialize`](CrowdfundContract::initialize) and are **never removed**
//! afterwards. Every externally-callable entry point can only run against an
//! already-initialized contract, so reading these keys back is infallible by
//! construction. Such reads use `unwrap()` deliberately; they are the "genuinely
//! infallible" bucket from the unwrap-audit (issue #835) and are documented here in one
//! place rather than annotated at each of the ~120 identical call sites.
//!
//! By contrast, reads whose absence is *reachable* — collection indexing on
//! caller-supplied lengths, optional configuration, or values that may legitimately be
//! unset — return a typed [`ContractError`] via `ok_or(..)?` and never panic.
//!
//! ## Error Handling
//!
//! All mutating functions return `Result<_, ContractError>`. See [`errors::ContractError`]
//! for the full list of error codes.
//!
//! ## Events
//!
//! Every state-changing function publishes a structured event. See the `Event*` types
//! in [`types`] for the full list of event payloads.

#![no_std]
#![allow(clippy::too_many_arguments)]

mod access;
mod errors;
mod helpers;
mod lifecycle;
mod recurring;
mod refund;
mod security;
mod storage;
mod types;
mod validation;
mod views;

pub use errors::ContractError;
pub use security::{ReentrancyGuard, CircuitBreaker, RateLimiter, InputValidator, AccessControl};
pub use storage::{
    CONTRACT_VERSION, MIN_SUPPORTED_VERSION,
    KEY_ADMIN, KEY_ANALYTICS, KEY_ANALYTICS_DATA, KEY_ARCHIVED, KEY_CATEGORY, KEY_CONTRIBS,
    KEY_CREATOR, KEY_DEADLINE, KEY_DESC, KEY_DISPUTE_ID, KEY_DISPUTE_VOTE, KEY_DISPUTES, KEY_GOAL,
    KEY_GOAL_HISTORY, KEY_INSURANCE, KEY_INSURANCE_POOL, KEY_MAX, KEY_META_HIST, KEY_MILESTONE_STATUS,
    KEY_MILESTONES, KEY_MIN, KEY_NEXT_RELEASE, KEY_PLATFORM, KEY_RATE_LIMIT, KEY_SOCIAL,
    KEY_START_TIME, KEY_STATUS, KEY_TITLE, KEY_TOKEN, KEY_TOTAL, KEY_VERIFICATION, KEY_VESTING,
    KEY_VISIBILITY,
    // #457
    KEY_CONTRACT_VERSION, KEY_VERSION_HISTORY,
    // #458
    KEY_LAST_VALIDATION,
    // #459
    KEY_DEBUG_SNAPSHOT,
    // #460
    KEY_PERF_THRESHOLD, KEY_PERF_STATS,
    // Governance
    KEY_GOVERNANCE_CONFIG, KEY_GOVERNANCE_NONCE, KEY_EMERGENCY_PAUSE,
    // #605 Security Hardening
    KEY_REENTRANCY_LOCK,
    // #698 Fee Mode
    KEY_GROSS_TOTAL,
    // #699 IPFS CID
    KEY_IPFS_CID,
    // #694 Soft-cap / stretch-goal
    KEY_SOFT_CAP, KEY_STRETCH_GOAL,
    // #695 Released amount tracking
    KEY_RELEASED,
    // #696 Pause timelock
    KEY_PAUSE_TIMELOCK, KEY_UNPAUSE_AFTER,
    // #704 Withdrawal streaming
    KEY_STREAM,
    // DeFi yield
    KEY_YIELD_CONFIG, KEY_YIELD_TOTAL,
};
pub use types::{
    CampaignAnalytics,
    CampaignInfo,
    CampaignStats,
    CampaignTemplate,
    Category,
    // #416
    ContributionRecord,
    DataKey,
    Delegation,
    Dispute,
    DisputeStatus,
    // #698
    FeeMode,
    // #699
    EventIpfsCidUpdated,
    // #443
    PerformanceMetrics,
    AnalyticsDataPoint,
    EventAnalyticsGenerated,
    EventBatchRefundCompleted,
    EventBlacklistRemoved,
    EventBlacklisted,
    // #416
    EventCampaignCloned,
    EventCampaignIndexed,
    EventCancelled,
    EventCategoryUpdated,
    EventContributed,
    // #419
    EventContributionRecorded,
    EventDeadlineExtended,
    EventDelegatedContribution,
    EventDelegationCreated,
    EventDelegationRevoked,
    EventDisputeFiled,
    EventDisputeResolved,
    EventDisputeVoted,
    EventEmergencyApproved,
    EventEmergencyExecuted,
    EventEmergencyInitiated,
    EventExtensionExecuted,
    EventExtensionProposed,
    EventExtensionVoted,
    // Issue #420
    EventGoalAdjusted,
    // Event payload types
    EventInitialized,
    EventInsuranceEnabled,
    EventInsurancePayout,
    EventMatchingSetup,
    EventMetadataUpdated,
    EventMetadataVersioned,
    EventMilestoneReached,
    EventMilestoneRelease,
    EventMilestoneVerified,
    EventMultiSigConfigured,
    EventPartialRefund,
    EventPaused,
    EventRateLimitHit,
    EventRateLimitUpdated,
    EventRecurringCancelled,
    EventRecurringExecuted,
    EventRecurringSetup,
    EventRefunded,
    // #417
    EventResumed,
    EventRewardsConfigured,
    EventRewardsDistributed,
    EventStatusChanged,
    EventTemplateApplied,
    EventTierAssigned,
    EventTiersSet,
    EventVerificationUpdated,
    EventVisibilityChanged,
    EventWhitelistOnlySet,
    EventWhitelistRemoved,
    EventWhitelisted,
    EventWithdrawn,
    EventOwnershipTransferred,
    EventArchived,
    ExtensionProposal,
    GoalAdjustment,
    InsuranceConfig,
    MatchingConfig,
    // Issue #423
    MetadataVersion,
    Milestone,
    MilestoneStatus,
    PlatformConfig,
    RateLimit,
    RecurringPlan,
    // #418
    RewardConfig,
    RewardTier,
    SearchIndexEntry,
    Status,
    TemplateType,
    VerificationStatus,
    VestingSchedule,
    Visibility,
    // #457
    VersionMigration,
    EventVersionChecked,
    EventContractMigrated,
    // #458
    StateValidationResult,
    EventStateValidated,
    EventInvariantViolated,
    // #459
    ContractStateSnapshot,
    EventDebugSnapshot,
    EventDebugLog,
    // #460
    ExecutionRecord,
    FunctionPerfStats,
    EventExecutionRecorded,
    EventPerfAlert,
    // Governance
    GovernanceConfig,
    GovernanceProposal,
    EventGovernanceProposed,
    EventGovernanceVoted,
    EventGovernanceExecuted,
    EventGovernanceConfigUpdated,
    EventGovernanceEmergencyPaused,
    EventGovernanceEmergencyResumed,
    // DeFi
    YieldConfig,
    YieldInfo,
    EventYieldConfigured,
    EventYieldClaimed,
    // #634 Quadratic-Funding Hooks
    QfContributorInput,
    QfInputs,
    EventQfContribution,
    // #694 Soft-cap / stretch-goal
    EventCapsConfigured,
    // #696 Pause timelock
    EventPausedWithTimelock,
    // #697 Allow/deny list
    EventAllowlisted,
    EventAllowlistRemoved,
    EventDenylisted,
    EventDenylistRemoved,
    // #703 Event schema versioning
    EVENT_SCHEMA_VERSION,
    // #704 Withdrawal streaming
    StreamConfig,
    EventStreamClaimed,
};
pub use validation::*;

use soroban_sdk::{contract, contractimpl, token, Address, Env, String, Vec};

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    /// Initializes a new crowdfunding campaign.
    ///
    /// Creates a campaign with the specified parameters. Can only be called once per contract instance.
    /// The creator must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `creator` - The campaign creator's Stellar address (must authorize)
    /// * `token` - The token address for contributions (e.g., native XLM or custom token)
    /// * `goal` - The funding goal in stroops (must be > 0)
    /// * `deadline` - Unix timestamp (seconds) when the campaign ends (must be > current ledger time)
    /// * `min_contribution` - Minimum contribution amount in stroops (must be >= 0)
    /// * `title` - Campaign title
    /// * `description` - Campaign description
    /// * `social_links` - Optional list of social media URLs
    /// * `platform_config` - Optional platform fee configuration (address and fee_bps)
    /// * `accepted_tokens` - Optional whitelist of accepted token addresses
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::AlreadyInitialized)` if campaign already initialized
    /// * `Err(ContractError::InvalidGoal)` if goal <= 0
    /// * `Err(ContractError::InvalidDeadline)` if deadline <= current time
    /// * `Err(ContractError::InvalidFee)` if platform fee_bps > 10,000
    ///
    /// # Example
    /// ```ignore
    /// initialize(
    ///     env,
    ///     creator_address,
    ///     token_address,
    ///     1_000_000_000,  // 100 XLM goal
    ///     1704067200,     // deadline timestamp
    ///     1_000_000,      // 0.1 XLM minimum
    ///     String::from_str(&env, "My Campaign"),
    ///     String::from_str(&env, "Help fund my project"),
    ///     None,
    ///     None,
    ///     None,
    /// )
    /// ```
    pub fn initialize(
        env: Env,
        creator: Address,
        token: Address,
        goal: i128,
        deadline: u64,
        min_contribution: i128,
        max_contribution: i128,
        title: String,
        description: String,
        social_links: Option<Vec<String>>,
        platform_config: Option<PlatformConfig>,
        accepted_tokens: Option<Vec<Address>>,
        category: Category,
        vesting: Option<VestingSchedule>,
        penalty_bps: Option<u32>,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&KEY_CREATOR) {
            return Err(ContractError::AlreadyInitialized);
        }
        creator.require_auth();

        if goal <= 0 {
            return Err(ContractError::InvalidGoal);
        }
        validate_goal_not_overflow(goal)?;
        if deadline <= env.ledger().timestamp() {
            return Err(ContractError::InvalidDeadline);
        }
        if min_contribution < 0 {
            return Err(ContractError::BelowMinimum);
        }
        if max_contribution < 0 || (max_contribution > 0 && max_contribution < min_contribution) {
            return Err(ContractError::ExceedsMaximum);
        }
        validate_string_length(&title, 64)?;
        validate_string_length(&description, 512)?;
        validate_category(&category)?;

        if let Some(ref config) = platform_config {
            validate_fee_bps(config.fee_bps)?;
            validate_address_not_self(&creator, &config.address)?;
            env.storage().instance().set(&KEY_PLATFORM, config);
        }

        // ── Batch all instance writes in one block to minimise storage overhead ──
        let storage = env.storage().instance();
        storage.set(&KEY_ADMIN, &creator);
        storage.set(&KEY_CREATOR, &creator);
        storage.set(&KEY_TOKEN, &token);
        storage.set(&KEY_GOAL, &goal);
        storage.set(&KEY_DEADLINE, &deadline);
        storage.set(&KEY_MIN, &min_contribution);
        storage.set(&KEY_MAX, &max_contribution);
        storage.set(&KEY_TITLE, &title);
        storage.set(&KEY_DESC, &description);
        storage.set(&KEY_TOTAL, &0i128);
        storage.set(&KEY_STATUS, &Status::Active);
        storage.set(&KEY_CATEGORY, &category);
        storage.set(&KEY_VISIBILITY, &Visibility::Public);
        storage.set(&DataKey::ContributorCount, &0u32);
        storage.set(&DataKey::LargestContribution, &0i128);
        storage.set(&KEY_START_TIME, &env.ledger().timestamp());

        if let Some(links) = social_links {
            storage.set(&KEY_SOCIAL, &links);
        }
        if let Some(tokens) = accepted_tokens {
            storage.set(&DataKey::AcceptedTokens, &tokens);
        }
        if let Some(v) = vesting {
            storage.set(&KEY_VESTING, &v);
        }
        if let Some(p) = penalty_bps {
            storage.set(&DataKey::PenaltyBps, &p);
        }

        // Persistent writes (separate storage tier)
        // Contributor list now uses indexed keys (DataKey::ContributorIndex) written
        // per-contributor at O(1) cost; KEY_CONTRIBS Vec is no longer maintained.

        let mut history: Vec<GoalAdjustment> = Vec::new(&env);
        history.push_back(GoalAdjustment {
            previous_goal: 0,
            new_goal: goal,
            timestamp: env.ledger().timestamp(),
        });
        env.storage().persistent().set(&KEY_GOAL_HISTORY, &history);

        // Seed metadata version history with version 0 (initial state)
        let mut meta_hist: Vec<MetadataVersion> = Vec::new(&env);
        meta_hist.push_back(MetadataVersion {
            version: 0,
            title: title.clone(),
            description: description.clone(),
            timestamp: env.ledger().timestamp(),
        });
        env.storage().persistent().set(&KEY_META_HIST, &meta_hist);

        env.events().publish(
            ("campaign", "initialized"),
            EventInitialized {
                creator,
                goal,
                deadline,
                category,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );

        // Index campaign for search
        Self::index_campaign(env)?;

        Ok(())
    }

    /// Submits a contribution to the campaign.
    ///
    /// Allows a contributor to pledge tokens before the campaign deadline.
    /// The contributor must authorize this transaction and have sufficient token balance.
    /// Uses a pull-based refund model: contributors claim refunds individually if the goal is not met.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address (must authorize)
    /// * `amount` - Contribution amount in stroops (must be >= min_contribution)
    /// * `token` - The token address being contributed (must match campaign token or be in whitelist)
    /// * `message` - Optional message/memo attached to the contribution (max 256 chars)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::BelowMinimum)` if amount < min_contribution
    /// * `Err(ContractError::CampaignPaused)` if campaign is paused
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::CampaignEnded)` if current time >= deadline
    /// * `Err(ContractError::TokenNotAccepted)` if token not in whitelist
    /// * `Err(ContractError::Overflow)` if total raised would overflow
    /// * `Err(ContractError::MessageTooLong)` if message exceeds 256 characters
    ///
    /// # Side Effects
    /// - Transfers tokens from contributor to contract
    /// - Updates contributor's total contribution amount
    /// - Stores contribution message if provided
    /// - Increments contributor count if this is their first contribution
    /// - Updates largest contribution if applicable
    /// - Stores anonymity flag if anonymous=true
    /// - Publishes "contributed" event
    pub fn contribute(
        env: Env,
        contributor: Address,
        amount: i128,
        token: Address,
        message: Option<String>,
    ) -> Result<(), ContractError> {
        contributor.require_auth();

        validate_positive_amount(amount)?;

        if let Some(ref msg) = message {
            if msg.len() > 256 {
                return Err(ContractError::MessageTooLong);
            }
        }

        // ── Batch all instance reads up-front to avoid repeated storage lookups ──
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        let min: i128 = inst.get(&KEY_MIN).unwrap();
        let max: i128 = inst.get(&KEY_MAX).unwrap_or(0);
        let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap();
        let default_token: Address = inst.get(&KEY_TOKEN).unwrap();
        let rate_limit: Option<RateLimit> = inst.get(&KEY_RATE_LIMIT);
        let visibility: Visibility = inst.get(&KEY_VISIBILITY).unwrap_or(Visibility::Public);
        let accepted_tokens: Option<Vec<Address>> = inst.get(&DataKey::AcceptedTokens);
        let total: i128 = inst.get(&KEY_TOTAL).unwrap();
        let count: u32 = inst.get(&DataKey::ContributorCount).unwrap();
        let largest: i128 = inst.get(&DataKey::LargestContribution).unwrap();
        // ── Hoist remaining instance reads to avoid re-fetching after transfer ─
        let platform_config: Option<PlatformConfig> = inst.get(&KEY_PLATFORM);
        let gross_total: i128 = inst.get(&KEY_GROSS_TOTAL).unwrap_or(0);
        let insurance_config: Option<InsuranceConfig> = inst.get(&KEY_INSURANCE);
        let matching_config: Option<MatchingConfig> = inst.get(&DataKey::MatchingConfig);

        // ── Validate status ───────────────────────────────────────────────────
        if status == Status::Paused {
            return Err(ContractError::CampaignPaused);
        }
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        // ── Validate deadline ─────────────────────────────────────────────────
        let now = env.ledger().timestamp();
        if now >= deadline {
            return Err(ContractError::CampaignEnded);
        }

        // ── Validate amount (short-circuit before costlier storage reads) ──────
        // Checking min first avoids the blacklist/whitelist persistent reads
        // for the common rejection case of an amount that's too small.
        if amount < min {
            return Err(ContractError::BelowMinimum);
        }

        // Read contributor's existing balance once; reuse below
        let contrib_key = DataKey::Contribution(contributor.clone());
        let prev_contrib: i128 = env.storage().persistent().get(&contrib_key).unwrap_or(0);

        if max > 0 {
            let new_total = prev_contrib
                .checked_add(amount)
                .ok_or(ContractError::Overflow)?;
            if new_total > max {
                return Err(ContractError::ContributorCapExceeded);
            }
        }

        // ── Check blacklist / whitelist (persistent, per-address) ─────────────
        if env
            .storage()
            .persistent()
            .get::<_, bool>(&DataKey::Blacklist(contributor.clone()))
            .unwrap_or(false)
        {
            return Err(ContractError::Blacklisted);
        }
        let whitelist_only: bool = inst.get(&DataKey::WhitelistOnly).unwrap_or(false);
        let needs_whitelist = whitelist_only || visibility == Visibility::Private;
        if needs_whitelist
            && !env
                .storage()
                .persistent()
                .get::<_, bool>(&DataKey::Whitelist(contributor.clone()))
                .unwrap_or(false)
        {
            return Err(ContractError::NotWhitelisted);
        }

        // ── Rate limit check (reuse cached `now`) ─────────────────────────────
        if let Some(rl) = rate_limit {
            if rl.max_amount > 0 && rl.window_seconds > 0 {
                let ts_key = DataKey::RateLimitTimestamp(contributor.clone());
                let amt_key = DataKey::RateLimitAmount(contributor.clone());
                let last_ts: u64 = env.storage().persistent().get(&ts_key).unwrap_or(0);

                let in_window = last_ts > 0 && now.saturating_sub(last_ts) < rl.window_seconds;
                let period_amount: i128 = if in_window {
                    env.storage().persistent().get(&amt_key).unwrap_or(0)
                } else {
                    0
                };
                let new_period = period_amount
                    .checked_add(amount)
                    .ok_or(ContractError::Overflow)?;
                if new_period > rl.max_amount {
                    env.events().publish(
                        ("campaign", "rate_limit_hit"),
                        EventRateLimitHit {
                            contributor: contributor.clone(),
                            attempted: amount,
                            period_amount,
                            max_amount: rl.max_amount,
                        },
                    );
                    return Err(ContractError::RateLimitExceeded);
                }
                if in_window {
                    env.storage().persistent().set(&amt_key, &new_period);
                } else {
                    env.storage().persistent().set(&ts_key, &now);
                    env.storage().persistent().set(&amt_key, &amount);
                }
            }
        }

        // ── Validate token (use cached accepted_tokens) ───────────────────────
        if let Some(ref whitelist) = accepted_tokens {
            if !whitelist.contains(&token) {
                return Err(ContractError::TokenNotAccepted);
            }
        } else if token != default_token {
            return Err(ContractError::TokenNotAccepted);
        }

        // ── Transfer tokens ───────────────────────────────────────────────────
        token::Client::new(&env, &token).transfer(
            &contributor,
            &env.current_contract_address(),
            &amount,
        );

        // ── #698: Per-contribution fee deduction (OnContribution mode) ────────
        // Track gross total regardless of fee mode so stats can report both.
        // Uses the `gross_total` value hoisted from the upfront batch above.
        inst.set(&KEY_GROSS_TOTAL, &(gross_total.checked_add(amount).unwrap_or(gross_total)));

        let contrib_fee: i128 = if let Some(ref config) = platform_config {
            if config.fee_mode == FeeMode::OnContribution {
                let f = amount * config.fee_bps as i128 / 10_000;
                if f > 0 {
                    token::Client::new(&env, &token).transfer(
                        &env.current_contract_address(),
                        &config.address,
                        &f,
                    );
                }
                f
            } else {
                0
            }
        } else {
            0
        };
        // Net amount credited toward goal
        let effective_amount_after_fee = amount - contrib_fee;

        // ── #433: Split out insurance fee if enabled ──────────────────────────
        // The full `amount` is held in the contract, but the insurance portion
        // is bookkept separately: it does not count toward the funding goal
        // and is paid back to the contributor if the campaign fails.
        // Uses the `insurance_config` value hoisted from the upfront batch above.
        let insurance_fee: i128 = insurance_config
            .filter(|c| c.enabled)
            .map(|c| effective_amount_after_fee * c.fee_bps as i128 / 10_000)
            .unwrap_or(0);
        let effective_amount = effective_amount_after_fee - insurance_fee;
        if insurance_fee > 0 {
            let fee_key = DataKey::InsuranceFee(contributor.clone());
            let prev_fee: i128 = env.storage().persistent().get(&fee_key).unwrap_or(0);
            env.storage().persistent().set(&fee_key, &(prev_fee + insurance_fee));
            env.storage().persistent().extend_ttl(&fee_key, 100, 100);

            let pool: i128 = inst.get(&KEY_INSURANCE_POOL).unwrap_or(0);
            inst.set(&KEY_INSURANCE_POOL, &(pool + insurance_fee));
        }

        // ── Update contributor balance (single write) ─────────────────────────
        let new_contrib = prev_contrib
            .checked_add(effective_amount)
            .ok_or(ContractError::Overflow)?;
        env.storage().persistent().set(&contrib_key, &new_contrib);
        env.storage()
            .persistent()
            .extend_ttl(&contrib_key, 100, 100);

        if let Some(msg) = message {
            let msg_key = DataKey::ContributionMessage(contributor.clone());
            env.storage().persistent().set(&msg_key, &msg);
            env.storage().persistent().extend_ttl(&msg_key, 100, 100);
        }

        // ── Apply matching (cached instance read) ─────────────────────────────
        let new_running_total = total
            .checked_add(effective_amount)
            .ok_or(ContractError::Overflow)?;
        let mut matched_amount = 0i128;
        // Uses `matching_config` hoisted from the upfront batch above.
        if let Some(config) = matching_config {
            let match_amount = (effective_amount * config.match_ratio as i128) / 10_000;
            let total_matched: i128 = inst.get(&DataKey::TotalMatched).unwrap_or(0);
            let available_match = config.max_match - total_matched;
            matched_amount = match_amount.min(available_match).max(0);
            if matched_amount > 0 {
                inst.set(&DataKey::TotalMatched, &(total_matched + matched_amount));
                // Deduct from the escrowed pool so the accounting stays correct
                let pool: i128 = inst.get(&DataKey::MatchingPool).unwrap_or(0);
                inst.set(&DataKey::MatchingPool, &(pool - matched_amount).max(0));
            }
        }

        let final_total = new_running_total
            .checked_add(matched_amount)
            .ok_or(ContractError::Overflow)?;
        inst.set(&KEY_TOTAL, &final_total);

        // ── First-time contributor bookkeeping ────────────────────────────────
        let presence_key = DataKey::ContributorPresence(contributor.clone());
        let is_present: bool = env
            .storage()
            .persistent()
            .get(&presence_key)
            .unwrap_or(false);
        if !is_present {
            env.storage().persistent().set(&presence_key, &true);
            env.storage()
                .persistent()
                .extend_ttl(&presence_key, 100, 100);

            // O(1) indexed write: store address at its insertion-order index.
            // Previously used an O(n) Vec append into KEY_CONTRIBS; with many
            // contributors that was reading and re-serialising the entire list
            // on every new contribution.
            let index_key = DataKey::ContributorIndex(count);
            env.storage().persistent().set(&index_key, &contributor);
            env.storage().persistent().extend_ttl(&index_key, 100, 100);

            // Use cached `count` — single write
            inst.set(&DataKey::ContributorCount, &(count + 1));
        }

        // Track updated contributor count for events
        let updated_count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);

        // Use cached `largest` — conditional single write
        if new_contrib > largest {
            inst.set(&DataKey::LargestContribution, &new_contrib);
        }

        // ── #419: Append to per-contributor contribution history ──────────────
        // `now` was captured earlier from env.ledger().timestamp()
        let history_key = DataKey::ContributionHistory(contributor.clone());
        let mut history: Vec<ContributionRecord> = env
            .storage()
            .persistent()
            .get(&history_key)
            .unwrap_or_else(|| Vec::new(&env));
        history.push_back(ContributionRecord {
            amount,
            timestamp: now,
            running_total: new_contrib,
        });
        env.storage().persistent().set(&history_key, &history);
        env.storage()
            .persistent()
            .extend_ttl(&history_key, 100, 100);

        // ── #418: Assign reward tier based on updated cumulative total ────────
        if let Some(tiers) = inst.get::<_, Vec<RewardTier>>(&DataKey::RewardTiers) {
            let mut best: Option<RewardTier> = None;
            for tier in tiers.iter() {
                if new_contrib >= tier.min_amount {
                    best = Some(tier);
                } else {
                    break; // tiers are sorted ascending — no need to continue
                }
            }
            if let Some(tier) = best {
                env.events().publish(
                    ("campaign", "tier_assigned"),
                    EventTierAssigned {
                        contributor: contributor.clone(),
                        tier_name: tier.name.clone(),
                        min_amount: tier.min_amount,
                    },
                );
                env.storage()
                    .persistent()
                    .set(&DataKey::ContributorTier(contributor.clone()), &tier);
                env.storage()
                    .persistent()
                    .extend_ttl(&DataKey::ContributorTier(contributor.clone()), 100, 100);
            }
        }

        inst.extend_ttl(17280, 518400);

        // ── #419: Emit detailed contribution-recorded event ───────────────────
        env.events().publish(
            ("campaign", "contribution_recorded"),
            EventContributionRecorded {
                contributor: contributor.clone(),
                amount,
                timestamp: now,
                running_total: new_contrib,
            },
        );

        env.events().publish(
            ("campaign", "contributed"),
            EventContributed {
                contributor: contributor.clone(),
                amount,
                new_total: new_contrib,
                matched_amount,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );

        // ── #634: Emit quadratic-funding weighting inputs ─────────────────────
        env.events().publish(
            ("campaign", "qf_contribution"),
            EventQfContribution {
                contributor,
                amount,
                cumulative: new_contrib,
                contributor_count: updated_count,
            },
        );
        Ok(())
    }

    /// Withdraws raised funds to the campaign creator after a successful campaign.
    ///
    /// Can only be called after the deadline has passed and the goal has been reached.
    /// The creator must authorize this transaction.
    /// If a platform fee is configured, it is deducted from the total before payout.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::CampaignStillActive)` if current time < deadline
    /// * `Err(ContractError::GoalNotReached)` if total_raised < goal
    ///
    /// # Side Effects
    /// - Transfers platform fee to platform address (if configured)
    /// - Transfers remaining funds to creator
    /// - Sets campaign status to Successful
    /// - Resets total_raised to 0
    /// - Publishes "withdrawn" event
    ///
    /// # Platform Fee Calculation
    /// If platform_config is set:
    /// ```ignore
    /// fee = total_raised * platform_fee_bps / 10_000
    /// creator_payout = total_raised - fee
    /// ```
    pub fn withdraw(env: Env) -> Result<(), ContractError> {
        // ── Batch all instance reads up-front ─────────────────────────────────
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap();
        let goal: i128 = inst.get(&KEY_GOAL).unwrap();
        let total: i128 = inst.get(&KEY_TOTAL).unwrap();
        let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
        let platform_config: Option<PlatformConfig> = inst.get(&KEY_PLATFORM);
        let vesting: Option<VestingSchedule> = inst.get(&KEY_VESTING);
        // #694: use soft_cap as success threshold when set
        let soft_cap: i128 = inst.get(&KEY_SOFT_CAP).unwrap_or(0);
        let success_threshold = if soft_cap > 0 { soft_cap } else { goal };

        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        creator.require_auth();

        let now = env.ledger().timestamp();
        if now < deadline {
            return Err(ContractError::CampaignStillActive);
        }
        if total < success_threshold {
            return Err(ContractError::GoalNotReached);
        }

        let token_client = token::Client::new(&env, &token_address);

        // ── Calculate fee and payout ──────────────────────────────────────────
        // For OnSuccess mode: deduct fee now from the net total.
        // For OnContribution mode: fees were already collected per-contribution;
        // no further deduction is applied here.
        let fee = if let Some(ref config) = platform_config {
            if config.fee_mode == FeeMode::OnContribution {
                0 // already collected per contribution
            } else {
                let f = total * config.fee_bps as i128 / 10_000;
                token_client.transfer(&env.current_contract_address(), &config.address, &f);
                f
            }
        } else {
            0
        };
        let mut payout = total - fee;

        // ── Apply vesting if configured ───────────────────────────────────────
        if let Some(ref v) = vesting {
            if now < v.cliff {
                return Err(ContractError::VestingNotComplete);
            }
            let vested = if now >= v.cliff + v.duration {
                payout
            } else {
                let elapsed = now - v.cliff;
                payout * elapsed as i128 / v.duration as i128
            };
            token_client.transfer(&env.current_contract_address(), &creator, &vested);
            payout = vested;
        } else {
            token_client.transfer(&env.current_contract_address(), &creator, &payout);
        }

        // ── Batch all instance writes ─────────────────────────────────────────
        inst.set(&KEY_TOTAL, &0i128);
        inst.set(&KEY_STATUS, &Status::Successful);
        inst.extend_ttl(17280, 518400);

        // ── Refund unused matching funds to sponsor on completion ─────────────
        let matching_pool: i128 = inst.get(&DataKey::MatchingPool).unwrap_or(0);
        if matching_pool > 0 {
            if let Some(config) = inst.get::<_, MatchingConfig>(&DataKey::MatchingConfig) {
                token_client.transfer(
                    &env.current_contract_address(),
                    &config.sponsor,
                    &matching_pool,
                );
                inst.set(&DataKey::MatchingPool, &0i128);
                env.events().publish(
                    ("campaign", "matching_sponsor_refunded"),
                    (config.sponsor, matching_pool),
                );
            }
        }

        env.events().publish(
            ("campaign", "withdrawn"),
            EventWithdrawn {
                creator,
                total,
                fee,
                payout,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );
        Ok(())
    }

    /// Configures optional streaming / scheduled withdrawal for the creator.
    ///
    /// Must be called before the campaign deadline.  When a `StreamConfig` is
    /// set, the normal `withdraw()` lump-sum path is blocked; the creator must
    /// use `claim_stream()` instead.
    ///
    /// # Arguments
    /// * `start_time` — Unix timestamp when streaming begins (must be >= current time)
    /// * `end_time`   — Unix timestamp when all funds are fully unlocked (must be > start_time)
    pub fn set_stream_config(
        env: Env,
        start_time: u64,
        end_time: u64,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let now = env.ledger().timestamp();
        if start_time <= now || end_time <= start_time {
            return Err(ContractError::InvalidInput);
        }

        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        inst.set(
            &KEY_STREAM,
            &StreamConfig {
                start_time,
                end_time,
                claimed: 0,
            },
        );
        inst.extend_ttl(17280, 518400);
        Ok(())
    }

    /// Claims the portion of streamed funds that has unlocked since the last claim.
    ///
    /// After a successful campaign (goal met, deadline passed) and once
    /// `start_time` has been reached, the creator can call this at any time to
    /// pull whatever fraction of the total has vested linearly.
    ///
    /// # Errors
    /// * `StreamNotConfigured`   — no `StreamConfig` set
    /// * `CampaignStillActive`   — deadline not yet passed
    /// * `GoalNotReached`        — total raised < goal
    /// * `StreamNotYetClaimable` — current time is before `start_time`
    /// * `StreamFullyClaimed`    — nothing left to claim
    pub fn claim_stream(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let mut stream: StreamConfig = inst
            .get(&KEY_STREAM)
            .ok_or(ContractError::StreamNotConfigured)?;

        let now = env.ledger().timestamp();
        let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap();
        let goal: i128 = inst.get(&KEY_GOAL).unwrap();
        let total: i128 = inst.get(&KEY_TOTAL).unwrap();
        let status: Status = inst.get(&KEY_STATUS).unwrap();

        // Campaign must be complete (either still Active past deadline, or Successful)
        if status == Status::Active && now < deadline {
            return Err(ContractError::CampaignStillActive);
        }
        if total < goal && status != Status::Successful {
            return Err(ContractError::GoalNotReached);
        }
        if now < stream.start_time {
            return Err(ContractError::StreamNotYetClaimable);
        }

        // Compute vested fraction linearly between start_time and end_time
        let vested_fraction = if now >= stream.end_time {
            total
        } else {
            let elapsed = now - stream.start_time;
            let duration = stream.end_time - stream.start_time;
            total * elapsed as i128 / duration as i128
        };

        let claimable = vested_fraction - stream.claimed;
        if claimable <= 0 {
            return Err(ContractError::StreamFullyClaimed);
        }

        // Deduct platform fee pro-rata on first claim if configured
        let platform_config: Option<PlatformConfig> = inst.get(&KEY_PLATFORM);
        let fee = if stream.claimed == 0 {
            if let Some(ref config) = platform_config {
                let f = total * config.fee_bps as i128 / 10_000;
                let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
                token::Client::new(&env, &token_address).transfer(
                    &env.current_contract_address(),
                    &config.address,
                    &f,
                );
                f
            } else {
                0
            }
        } else {
            0
        };

        let payout = claimable - fee;
        let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
        token::Client::new(&env, &token_address).transfer(
            &env.current_contract_address(),
            &creator,
            &payout,
        );

        stream.claimed += claimable;
        let remaining = total - stream.claimed;

        inst.set(&KEY_STREAM, &stream);
        if remaining == 0 {
            inst.set(&KEY_STATUS, &Status::Successful);
            inst.set(&KEY_TOTAL, &0i128);
        }
        inst.extend_ttl(17280, 518400);

        env.events().publish(
            ("campaign", "stream_claimed"),
            EventStreamClaimed {
                creator,
                amount: payout,
                remaining,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );
        Ok(())
    }

    /// Updates campaign metadata (title, description, social links).
    ///
    /// Can only be called while the campaign is in Active status.
    /// The creator must authorize this transaction.
    /// Any field can be omitted (None) to leave it unchanged.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `title` - New campaign title (optional)
    /// * `description` - New campaign description (optional)
    /// * `social_links` - New social media links (optional)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    ///
    /// # Side Effects
    /// - Updates specified metadata fields in storage
    /// - Publishes "metadata_updated" event
    pub fn update_metadata(
        env: Env,
        title: Option<String>,
        description: Option<String>,
        social_links: Option<Vec<String>>,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let updated_title = title.is_some();
        let updated_description = description.is_some();
        let updated_social = social_links.is_some();

        // Validate and capture effective values for the version snapshot.
        // Using `if let Some(ref ...)` borrows without moving, letting us clone
        // here and then move the Option into the storage writes below.
        let effective_title: String = if let Some(ref t) = title {
            validate_string_length(t, 64)?;
            t.clone()
        } else {
            inst.get(&KEY_TITLE)
                .unwrap_or_else(|| String::from_str(&env, ""))
        };
        let effective_desc: String = if let Some(ref d) = description {
            validate_string_length(d, 512)?;
            d.clone()
        } else {
            inst.get(&KEY_DESC)
                .unwrap_or_else(|| String::from_str(&env, ""))
        };

        if let Some(t) = title {
            inst.set(&KEY_TITLE, &t);
        }
        if let Some(d) = description {
            inst.set(&KEY_DESC, &d);
        }
        if let Some(l) = social_links {
            inst.set(&KEY_SOCIAL, &l);
        }

        // Issue #423 — store a versioned metadata snapshot
        let now = env.ledger().timestamp();
        let mut meta_hist: Vec<MetadataVersion> = env
            .storage()
            .persistent()
            .get(&KEY_META_HIST)
            .unwrap_or_else(|| Vec::new(&env));
        let version = meta_hist.len();
        meta_hist.push_back(MetadataVersion {
            version,
            title: effective_title,
            description: effective_desc,
            timestamp: now,
        });
        env.storage().persistent().set(&KEY_META_HIST, &meta_hist);
        env.storage()
            .persistent()
            .extend_ttl(&KEY_META_HIST, 100, 100);

        env.events().publish(
            ("campaign", "metadata_updated"),
            EventMetadataUpdated {
                updated_title,
                updated_description,
                updated_social_links: updated_social,
            },
        );
        env.events().publish(
            ("campaign", "metadata_versioned"),
            EventMetadataVersioned { version, timestamp: now },
        );

        // Re-index campaign after metadata update
        Self::index_campaign(env)?;

        Ok(())
    }

    /// Anchors an IPFS content identifier (CID) on-chain for the campaign.
    ///
    /// The CID must be a valid IPFS v0 (Qm…, 46 chars) or v1 (bafy…, 59+ chars)
    /// identifier.  Only the campaign creator may call this while the campaign
    /// is Active.
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not Active
    /// * `Err(ContractError::InvalidInput)` if the CID format is invalid
    pub fn update_ipfs_cid(env: Env, cid: String) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        // Validate CID length: v0 (base58 "Qm…", len 46) or v1 (base32 "bafy…", len >= 59).
        // Byte-level prefix inspection is intentionally omitted: Soroban `String`
        // does not expose content access without an exact-length copy buffer, so we
        // validate the well-known CID lengths instead.
        let len = cid.len();
        let is_v0 = len == 46;
        let is_v1 = len >= 59;
        if !is_v0 && !is_v1 {
            return Err(ContractError::InvalidInput);
        }

        inst.set(&KEY_IPFS_CID, &cid);
        let now = env.ledger().timestamp();
        env.events().publish(
            ("campaign", "ipfs_cid_updated"),
            EventIpfsCidUpdated { cid, timestamp: now },
        );
        Ok(())
    }

    /// Returns the stored IPFS CID for this campaign, if one has been set.
    pub fn get_ipfs_cid(env: Env) -> Option<String> {
        env.storage().instance().get(&KEY_IPFS_CID)
    }

    /// Extends the campaign deadline to a later time.
    ///
    /// Can only be called while the campaign is in Active status.
    /// The creator must authorize this transaction.
    /// The new deadline must be strictly greater than the current deadline.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `new_deadline` - New Unix timestamp (seconds) for campaign end
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::InvalidDeadline)` if new_deadline <= current_deadline
    ///
    /// # Side Effects
    /// - Updates deadline in storage
    /// - Publishes "deadline_extended" event with new deadline
    pub fn extend_deadline(env: Env, new_deadline: u64) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let old_deadline: u64 = inst.get(&KEY_DEADLINE).unwrap();
        if new_deadline <= old_deadline {
            return Err(ContractError::InvalidDeadline);
        }
        inst.set(&KEY_DEADLINE, &new_deadline);
        env.events().publish(
            ("campaign", "deadline_extended"),
            EventDeadlineExtended {
                old_deadline,
                new_deadline,
            },
        );
        Ok(())
    }

    // ── Issue #420 — Dynamic Goal Adjustment ─────────────────────────────────

    /// Adjusts the campaign funding goal mid-campaign.
    ///
    /// Allows the creator to raise or lower the goal while the campaign is
    /// still active.  Every adjustment is appended to the persistent goal
    /// history so the full audit trail is always available via
    /// [`get_goal_history`](CrowdfundContract::get_goal_history).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `new_goal` - New funding goal in stroops (must be > 0)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::InvalidGoal)` if `new_goal` <= 0
    /// * `Err(ContractError::GoalOverflow)` if `new_goal` is dangerously large
    ///
    /// # Side Effects
    /// - Updates `KEY_GOAL` in instance storage
    /// - Appends a [`GoalAdjustment`] entry to persistent `KEY_GOAL_HISTORY`
    /// - Publishes `("campaign", "goal_adjusted")` event
    pub fn adjust_goal(env: Env, new_goal: i128) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        if new_goal <= 0 {
            return Err(ContractError::InvalidGoal);
        }
        validate_goal_not_overflow(new_goal)?;

        let previous_goal: i128 = inst.get(&KEY_GOAL).unwrap();
        inst.set(&KEY_GOAL, &new_goal);

        let now = env.ledger().timestamp();
        let mut history: Vec<GoalAdjustment> = env
            .storage()
            .persistent()
            .get(&KEY_GOAL_HISTORY)
            .unwrap_or_else(|| Vec::new(&env));
        history.push_back(GoalAdjustment {
            previous_goal,
            new_goal,
            timestamp: now,
        });
        env.storage().persistent().set(&KEY_GOAL_HISTORY, &history);
        env.storage()
            .persistent()
            .extend_ttl(&KEY_GOAL_HISTORY, 100, 100);

        inst.extend_ttl(17280, 518400);

        env.events().publish(
            ("campaign", "goal_adjusted"),
            EventGoalAdjusted {
                previous_goal,
                new_goal,
                timestamp: now,
            },
        );
        Ok(())
    }

    /// Cancels the campaign, allowing all contributors to claim refunds.
    ///
    /// Can only be called while the campaign is in Active or Paused status.
    /// The creator must authorize this transaction.
    /// After cancellation, contributors can call `refund_single` or `refund_batch`
    /// to reclaim their tokens at any time, regardless of the deadline.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is already Cancelled, Successful,
    ///   or Refunded
    ///
    /// # Side Effects
    /// - Sets campaign status to `Cancelled`
    /// - Publishes structured `EventCancelled` event with creator and total raised
    /// - Publishes `EventStatusChanged` event
    ///
    /// # Events
    /// ```ignore
    /// ("campaign", "cancelled")      → EventCancelled { creator, total_raised }
    /// ("campaign", "status_changed") → EventStatusChanged { old_status, new_status }
    /// ```
    pub fn cancel_campaign(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        // Allow cancellation from Active or Paused state
        if status == Status::Cancelled
            || status == Status::Successful
            || status == Status::Refunded
        {
            return Err(ContractError::NotActive);
        }
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();
        let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        let old_status = status;
        inst.set(&KEY_STATUS, &Status::Cancelled);
        env.events().publish(
            ("campaign", "cancelled"),
            EventCancelled {
                creator,
                total_raised,
            },
        );
        env.events().publish(
            ("campaign", "status_changed"),
            EventStatusChanged {
                old_status,
                new_status: Status::Cancelled,
            },
        );
        Ok(())
    }

    /// Archives a completed campaign for historical reference.
    ///
    /// Can only be called on campaigns in `Successful`, `Cancelled`, or `Refunded`
    /// status. The creator must authorize this transaction.
    /// Archiving marks the campaign as `Archived` and records the timestamp.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is Active or Paused (not yet completed)
    ///
    /// # Side Effects
    /// - Sets campaign status to `Archived`
    /// - Stores archival timestamp in instance storage
    /// - Publishes `("campaign", "archived")` event
    pub fn archive(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();

        // Only completed campaigns can be archived
        if status == Status::Active
            || status == Status::Paused
            || status == Status::Archived
        {
            return Err(ContractError::NotActive);
        }

        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        let now = env.ledger().timestamp();

        inst.set(&KEY_STATUS, &Status::Archived);
        inst.set(&KEY_ARCHIVED, &now);

        env.events().publish(
            ("campaign", "archived"),
            EventArchived {
                creator,
                total_raised,
                timestamp: now,
            },
        );
        Ok(())
    }

    /// Returns whether this campaign has been archived.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// `true` if the campaign status is `Archived`, `false` otherwise
    pub fn is_archived(env: Env) -> bool {
        env.storage()
            .instance()
            .get::<_, Status>(&KEY_STATUS)
            .map(|s| s == Status::Archived)
            .unwrap_or(false)
    }

    /// Returns the archival timestamp if the campaign has been archived.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// `Some(timestamp)` if archived, `None` otherwise
    pub fn get_archived_at(env: Env) -> Option<u64> {
        env.storage().instance().get(&KEY_ARCHIVED)
    }

    /// Claims a refund for a single contributor (pull-based refund model).
    ///
    /// A contributor can claim their refund if:
    /// - The campaign was cancelled, OR
    /// - The deadline has passed AND the goal was not reached
    ///
    /// This implements a pull-based refund model where each contributor individually
    /// claims their refund, avoiding the gas cost and failure risk of a single
    /// transaction refunding all contributors.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address claiming the refund
    ///
    /// # Returns
    /// * `Ok(())` on success (even if contributor has no refund)
    /// * `Err(ContractError::CampaignStillActive)` if deadline not passed and not cancelled
    /// * `Err(ContractError::GoalReached)` if goal was reached and campaign not cancelled
    ///
    /// # Side Effects
    /// - Transfers refund amount to contributor (if > 0)
    /// - Sets contributor's contribution to 0
    /// - Publishes "refunded" event
    pub fn refund_single(env: Env, contributor: Address) -> Result<(), ContractError> {
        // ── Batch instance reads up-front ─────────────────────────────────────
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();

        if status != Status::Cancelled {
            validate_refund_eligibility(
                env.ledger().timestamp(),
                inst.get(&KEY_DEADLINE).unwrap(),
                inst.get(&KEY_TOTAL).unwrap(),
                inst.get(&KEY_GOAL).unwrap(),
            )?;
        }

        let key = DataKey::Contribution(contributor.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount > 0 {
            // #695: on cancellation, only the unreleased portion is refundable.
            // released_amount is the total already paid out via milestones; each
            // contributor's refund is proportionally reduced.
            let refund_amount = if status == Status::Cancelled {
                let total: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
                let released: i128 = inst.get(&KEY_RELEASED).unwrap_or(0);
                if released > 0 && total > 0 {
                    // unreleased_ratio = (total - released) / total
                    // contributor_refund = amount * unreleased_ratio
                    let unreleased = (total - released).max(0);
                    amount * unreleased / total
                } else {
                    amount
                }
            } else {
                amount
            };

            let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
            if refund_amount > 0 {
                token::Client::new(&env, &token_address).transfer(
                    &env.current_contract_address(),
                    &contributor,
                    &refund_amount,
                );
            }
            env.storage().persistent().set(&key, &0i128);
            env.events().publish(
                ("campaign", "refunded"),
                EventRefunded {
                    contributor,
                    amount: refund_amount,
                    schema_version: EVENT_SCHEMA_VERSION,
                },
            );
        }
        Ok(())
    }

    /// Refunds multiple contributors in a single transaction (batch refund).
    ///
    /// Processes refunds for a list of contributors. Stops early if the batch
    /// limit is reached to avoid exceeding resource limits.
    /// Each contributor is only refunded if eligible (same conditions as `refund_single`).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributors` - List of contributor addresses to refund
    ///
    /// # Returns
    /// * `Ok(u32)` - Number of contributors successfully refunded
    /// * `Err(ContractError::CampaignStillActive)` if deadline not passed and not cancelled
    /// * `Err(ContractError::GoalReached)` if goal was reached and campaign not cancelled
    pub fn refund_batch(env: Env, contributors: Vec<Address>) -> Result<u32, ContractError> {
        // ── Batch instance reads up-front ─────────────────────────────────────
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();

        if status != Status::Cancelled {
            validate_refund_eligibility(
                env.ledger().timestamp(),
                inst.get(&KEY_DEADLINE).unwrap(),
                inst.get(&KEY_TOTAL).unwrap(),
                inst.get(&KEY_GOAL).unwrap(),
            )?;
        }

        // Cache token address once for the whole batch
        let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
        let token_client = token::Client::new(&env, &token_address);

        // Cap batch size to avoid resource exhaustion
        const MAX_BATCH: u32 = 25;
        let limit = contributors.len().min(MAX_BATCH);
        let mut refunded: u32 = 0;

        for contributor in contributors.iter().take(limit as usize) {
            let key = DataKey::Contribution(contributor.clone());
            let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            if amount > 0 {
                token_client.transfer(&env.current_contract_address(), &contributor, &amount);
                env.storage().persistent().set(&key, &0i128);
                env.events().publish(
                    ("campaign", "refunded"),
                    EventRefunded {
                        contributor,
                        amount,
                        schema_version: EVENT_SCHEMA_VERSION,
                    },
                );
                refunded += 1;
            }
        }

        // Issue #422: emit a single batch-level event summarising the run
        env.events().publish(
            ("campaign", "batch_refund_completed"),
            EventBatchRefundCompleted {
                total_refunded: refunded,
                batch_size: limit,
            },
        );

        Ok(refunded)
    }

    /// Sets the per-address contribution rate limit (admin only).
    ///
    /// Configures the maximum amount a single address can contribute within a
    /// rolling window of `window_seconds`. Passing `max_amount = 0` clears the
    /// rate limit (and the window value is then ignored).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `max_amount` - Maximum contribution amount per address per window (0 = disabled)
    /// * `window_seconds` - Length of the per-address window in seconds (must be > 0 when enabling)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidRateLimit)` if `max_amount < 0`, or if enabling
    ///   the limit with `window_seconds == 0`
    ///
    /// # Side Effects
    /// - Updates or clears the stored rate limit configuration
    /// - Publishes a "rate_limit_updated" event
    pub fn set_rate_limit(
        env: Env,
        max_amount: i128,
        window_seconds: u64,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        if max_amount < 0 {
            return Err(ContractError::InvalidRateLimit);
        }
        if max_amount == 0 {
            inst.remove(&KEY_RATE_LIMIT);
            env.events().publish(
                ("campaign", "rate_limit_updated"),
                EventRateLimitUpdated {
                    max_amount: 0,
                    window_seconds: 0,
                },
            );
            return Ok(());
        }
        if window_seconds == 0 {
            return Err(ContractError::InvalidRateLimit);
        }
        inst.set(
            &KEY_RATE_LIMIT,
            &RateLimit {
                max_amount,
                window_seconds,
            },
        );
        env.events().publish(
            ("campaign", "rate_limit_updated"),
            EventRateLimitUpdated {
                max_amount,
                window_seconds,
            },
        );
        Ok(())
    }

    /// Returns the current per-address rate limit configuration, if any.
    pub fn get_rate_limit(env: Env) -> Option<RateLimit> {
        env.storage().instance().get(&KEY_RATE_LIMIT)
    }

    /// Initiates an emergency withdrawal (admin only).
    ///
    /// Starts a time-locked emergency withdrawal process. After the lock period expires,
    /// the admin can call `execute_emergency_withdrawal()` to recover funds.
    /// This requires admin authorization and can be cancelled before execution.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `lock_period` - Time in seconds to lock the withdrawal (e.g., 604800 for 7 days)
    ///
    /// # Returns
    /// * `Ok(())` on success
    ///
    /// # Side Effects
    /// - Sets emergency lock time to current time + lock_period
    /// - Publishes "EmergencyWithdrawalInitiated" event
    pub fn initiate_emergency_withdrawal(env: Env, lock_period: u64) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        let lock_until = env.ledger().timestamp() + lock_period;
        inst.set(&DataKey::EmergencyLockTime, &lock_until);
        // Reset multi-sig approval count for the new session so previous approvals
        // from an older initiation cannot carry over.
        inst.set(&DataKey::EmergencyApprovalCount, &0u32);
        env.events().publish(
            ("campaign", "emergency_initiated"),
            EventEmergencyInitiated { lock_until },
        );
        Ok(())
    }

    /// Executes the emergency withdrawal (admin only).
    ///
    /// Transfers all funds to the admin after the lock period has expired.
    /// Can only be called after the time-lock delay has passed.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::EmergencyLocked)` if lock period has not expired
    ///
    /// # Side Effects
    /// - Transfers all funds to admin
    /// - Clears emergency lock time
    /// - Publishes "EmergencyWithdrawalExecuted" event
    pub fn execute_emergency_withdrawal(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        let lock_time: u64 = inst.get(&DataKey::EmergencyLockTime).unwrap_or(0);
        if lock_time == 0 || env.ledger().timestamp() < lock_time {
            return Err(ContractError::EmergencyLocked);
        }

        // ── Multi-sig check: if a minimum approval count is configured, verify it ─
        let required: u32 = inst
            .get(&DataKey::EmergencyApproversRequired)
            .unwrap_or(0);
        if required > 0 {
            let count: u32 = inst.get(&DataKey::EmergencyApprovalCount).unwrap_or(0);
            if count < required {
                return Err(ContractError::MultiSigNotMet);
            }
        }

        let total: i128 = inst.get(&KEY_TOTAL).unwrap();
        if total > 0 {
            let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
            token::Client::new(&env, &token_address).transfer(
                &env.current_contract_address(),
                &admin,
                &total,
            );
            inst.set(&KEY_TOTAL, &0i128);
        }

        inst.set(&DataKey::EmergencyLockTime, &0u64);
        env.events().publish(
            ("campaign", "emergency_executed"),
            EventEmergencyExecuted { amount: total },
        );
        Ok(())
    }

    /// Cancels a pending emergency withdrawal (admin only).
    ///
    /// Removes the emergency lock, preventing the withdrawal from being executed.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    ///
    /// # Side Effects
    /// - Clears emergency lock time
    /// - Publishes "EmergencyWithdrawalCancelled" event
    pub fn cancel_emergency_withdrawal(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        inst.set(&DataKey::EmergencyLockTime, &0u64);
        env.events()
            .publish(("campaign", "emergency_cancelled"), ());
        Ok(())
    }

    /// Pauses the campaign, preventing new contributions (admin only).
    // ── Emergency Multi-Sig Functions ─────────────────────────────────────────

    /// Configures multi-sig approval requirements for emergency withdrawals (admin only).
    ///
    /// Sets the minimum number of approvals required from a pre-defined list of
    /// approvers before `execute_emergency_withdrawal` can succeed.
    /// If multi-sig is not configured (default), the admin-only timelock model remains.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `required_approvals` - Minimum number of approvals (must be 1–approvers.len())
    /// * `approvers` - List of authorized approver addresses
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if required_approvals is invalid
    pub fn setup_emergency_multisig(
        env: Env,
        required_approvals: u32,
        approvers: Vec<Address>,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        // required_approvals must be between 1 and the total number of approvers
        if required_approvals == 0 || required_approvals > approvers.len() {
            return Err(ContractError::Unauthorized);
        }

        let approver_count = approvers.len();
        inst.set(&DataKey::EmergencyApproversRequired, &required_approvals);
        env.storage()
            .persistent()
            .set(&DataKey::EmergencyApproversList, &approvers);

        env.events().publish(
            ("campaign", "multisig_configured"),
            EventMultiSigConfigured {
                required_approvals,
                approver_count,
            },
        );
        Ok(())
    }

    /// Submits an approval for the active emergency withdrawal (approver only).
    ///
    /// Each authorised approver calls this once per initiated emergency session.
    /// The call is idempotent — a second call from the same approver in the same
    /// session is a silent no-op to avoid double-counting.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `approver` - Approver address (must be in the authorised list and must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success (including idempotent re-call)
    /// * `Err(ContractError::EmergencyLocked)` if no emergency has been initiated
    /// * `Err(ContractError::Unauthorized)` if multi-sig is not configured or approver
    ///   is not in the authorised list
    pub fn approve_emergency_withdrawal(
        env: Env,
        approver: Address,
    ) -> Result<(), ContractError> {
        approver.require_auth();

        let inst = env.storage().instance();

        // An emergency must have been initiated
        let lock_until: u64 = inst.get(&DataKey::EmergencyLockTime).unwrap_or(0);
        if lock_until == 0 {
            return Err(ContractError::EmergencyLocked);
        }

        // Multi-sig must be configured
        let required: u32 = inst
            .get(&DataKey::EmergencyApproversRequired)
            .unwrap_or(0);
        if required == 0 {
            return Err(ContractError::Unauthorized);
        }

        // Approver must be in the authorised list
        let approvers: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::EmergencyApproversList)
            .unwrap_or_else(|| Vec::new(&env));
        if !approvers.contains(&approver) {
            return Err(ContractError::Unauthorized);
        }

        // Idempotency guard: the stored value is the lock_until of the session they
        // last approved.  A matching value means they already voted this session.
        let last_approved: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::EmergencyApproval(approver.clone()))
            .unwrap_or(0);
        if last_approved == lock_until {
            // Already approved this session — idempotent no-op
            return Ok(());
        }

        // Record approval for this session
        env.storage()
            .persistent()
            .set(&DataKey::EmergencyApproval(approver.clone()), &lock_until);

        let count: u32 = inst.get(&DataKey::EmergencyApprovalCount).unwrap_or(0);
        let new_count = count + 1;
        inst.set(&DataKey::EmergencyApprovalCount, &new_count);

        env.events().publish(
            ("campaign", "emergency_approved"),
            EventEmergencyApproved {
                approver,
                approval_count: new_count,
            },
        );
        Ok(())
    }

    // ── Template Functions (extended) ─────────────────────────────────────────

    /// Initialises a new campaign from a pre-configured template.
    ///
    /// Works like [`initialize`](CrowdfundContract::initialize) but derives
    /// `min_contribution` from `template.suggested_min` and the campaign category
    /// from the template type.  The template is stored on-chain for future reference.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `creator` - Campaign creator address (must authorize)
    /// * `token` - Contribution token address
    /// * `goal` - Funding goal in stroops (must be > 0)
    /// * `deadline` - Campaign end timestamp
    /// * `max_contribution` - Per-contributor maximum (0 = no limit)
    /// * `title` - Campaign title (max 64 chars)
    /// * `description` - Campaign description (max 512 chars)
    /// * `template` - Template providing suggested_min and template_type
    /// * `social_links` - Optional social media URLs
    /// * `platform_config` - Optional platform fee configuration
    /// * `accepted_tokens` - Optional whitelist of accepted tokens
    /// * `vesting` - Optional vesting schedule
    /// * `penalty_bps` - Optional early-withdrawal penalty in basis points
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::AlreadyInitialized)` if already initialised
    /// * `Err(ContractError::InvalidTemplate)` if template.goal_multiplier is 0
    pub fn initialize_from_template(
        env: Env,
        creator: Address,
        token: Address,
        goal: i128,
        deadline: u64,
        max_contribution: i128,
        title: String,
        description: String,
        template: CampaignTemplate,
        social_links: Option<Vec<String>>,
        platform_config: Option<PlatformConfig>,
        accepted_tokens: Option<Vec<Address>>,
        vesting: Option<VestingSchedule>,
        penalty_bps: Option<u32>,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&KEY_CREATOR) {
            return Err(ContractError::AlreadyInitialized);
        }
        creator.require_auth();

        // ── Validate template ─────────────────────────────────────────────────
        if template.suggested_min < 0 {
            return Err(ContractError::BelowMinimum);
        }
        if template.goal_multiplier == 0 {
            return Err(ContractError::InvalidTemplate);
        }
        validate_string_length(&template.name, 64)?;
        validate_string_length(&template.description, 512)?;

        // Derive campaign parameters from template
        let min_contribution = template.suggested_min;
        let category = match template.template_type {
            TemplateType::Charity => Category::Charity,
            TemplateType::Product => Category::Technology,
            TemplateType::Event => Category::Event,
            TemplateType::Personal => Category::Personal,
            TemplateType::Custom => Category::Other,
        };

        // ── Validate core parameters ──────────────────────────────────────────
        if goal <= 0 {
            return Err(ContractError::InvalidGoal);
        }
        validate_goal_not_overflow(goal)?;
        if deadline <= env.ledger().timestamp() {
            return Err(ContractError::InvalidDeadline);
        }
        if max_contribution < 0
            || (max_contribution > 0 && max_contribution < min_contribution)
        {
            return Err(ContractError::ExceedsMaximum);
        }
        validate_string_length(&title, 64)?;
        validate_string_length(&description, 512)?;

        if let Some(ref config) = platform_config {
            validate_fee_bps(config.fee_bps)?;
            validate_address_not_self(&creator, &config.address)?;
            env.storage().instance().set(&KEY_PLATFORM, config);
        }

        // Store template for reference
        env.storage().instance().set(&DataKey::Template, &template);

        // ── Batch all instance writes ─────────────────────────────────────────
        let storage = env.storage().instance();
        storage.set(&KEY_ADMIN, &creator);
        storage.set(&KEY_CREATOR, &creator);
        storage.set(&KEY_TOKEN, &token);
        storage.set(&KEY_GOAL, &goal);
        storage.set(&KEY_DEADLINE, &deadline);
        storage.set(&KEY_MIN, &min_contribution);
        storage.set(&KEY_MAX, &max_contribution);
        storage.set(&KEY_TITLE, &title);
        storage.set(&KEY_DESC, &description);
        storage.set(&KEY_TOTAL, &0i128);
        storage.set(&KEY_STATUS, &Status::Active);
        storage.set(&KEY_CATEGORY, &category);
        storage.set(&DataKey::ContributorCount, &0u32);
        storage.set(&DataKey::LargestContribution, &0i128);

        if let Some(links) = social_links {
            storage.set(&KEY_SOCIAL, &links);
        }
        if let Some(tokens) = accepted_tokens {
            storage.set(&DataKey::AcceptedTokens, &tokens);
        }
        if let Some(v) = vesting {
            storage.set(&KEY_VESTING, &v);
        }
        if let Some(p) = penalty_bps {
            storage.set(&DataKey::PenaltyBps, &p);
        }

        // Persistent writes (separate storage tier)
        // Contributor list uses indexed keys (DataKey::ContributorIndex); no Vec initialisation needed.

        let mut history: Vec<GoalAdjustment> = Vec::new(&env);
        history.push_back(GoalAdjustment {
            previous_goal: 0,
            new_goal: goal,
            timestamp: env.ledger().timestamp(),
        });
        env.storage().persistent().set(&KEY_GOAL_HISTORY, &history);

        env.events().publish(
            ("campaign", "initialized"),
            EventInitialized {
                creator,
                goal,
                deadline,
                category,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );
        env.events().publish(
            ("campaign", "template_applied"),
            EventTemplateApplied {
                template_type: template.template_type,
                suggested_min: template.suggested_min,
            },
        );
        Ok(())
    }

    // ── Matching Functions ────────────────────────────────────────────────────

    /// Configures a sponsor-funded contribution matching pool (creator only).
    ///
    /// When matching is active, every qualifying contribution is topped up by the
    /// sponsor at a rate of `match_ratio` basis points, capped at `max_match` total.
    /// Matching is applied automatically inside `contribute`.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `sponsor` - Address of the sponsor funding the match
    /// * `match_ratio` - Match rate in basis points (e.g. 10 000 = 1 : 1, max 10 000)
    /// * `max_match` - Maximum total matching in stroops (must be > 0)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidFee)` if match_ratio > 10 000
    /// * `Err(ContractError::AmountNotPositive)` if max_match ≤ 0
    pub fn setup_matching(
        env: Env,
        sponsor: Address,
        match_ratio: u32,
        max_match: i128,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        if match_ratio > 10_000 {
            return Err(ContractError::InvalidFee);
        }
        if max_match <= 0 {
            return Err(ContractError::AmountNotPositive);
        }

        // Require campaign to be Active before accepting sponsor escrow
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        // ── Escrow matching funds from sponsor into the contract ──────────────
        sponsor.require_auth();
        let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
        token::Client::new(&env, &token_address).transfer(
            &sponsor,
            &env.current_contract_address(),
            &max_match,
        );

        let config = MatchingConfig {
            sponsor: sponsor.clone(),
            match_ratio,
            max_match,
        };

        inst.set(&DataKey::MatchingConfig, &config);
        inst.set(&DataKey::TotalMatched, &0i128);
        inst.set(&DataKey::MatchingPool, &max_match);

        env.events().publish(
            ("campaign", "matching_setup"),
            EventMatchingSetup {
                sponsor,
                match_ratio,
                max_match,
            },
        );
        Ok(())
    }

    /// Returns the active matching configuration, if any.
    pub fn get_matching_config(env: Env) -> Option<MatchingConfig> {
        env.storage().instance().get(&DataKey::MatchingConfig)
    }

    /// Returns the total amount matched by the sponsor so far.
    pub fn get_total_matched(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalMatched)
            .unwrap_or(0)
    }

    /// Returns the remaining unspent balance in the matching pool.
    pub fn get_matching_pool(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::MatchingPool)
            .unwrap_or(0)
    }

    /// Refunds any unspent matching funds back to the sponsor.
    ///
    /// Can only be called after the campaign has ended (Successful, Cancelled,
    /// or Refunded status). The creator or sponsor may trigger this.
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if the campaign is still Active
    pub fn refund_matching_sponsor(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status == Status::Active || status == Status::Paused {
            return Err(ContractError::CampaignStillActive);
        }

        let config: MatchingConfig = match inst.get(&DataKey::MatchingConfig) {
            Some(c) => c,
            None => return Ok(()), // nothing to refund
        };

        let pool: i128 = inst.get(&DataKey::MatchingPool).unwrap_or(0);
        if pool <= 0 {
            return Ok(());
        }

        // Require the sponsor (or creator) to authorise the refund
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
        token::Client::new(&env, &token_address).transfer(
            &env.current_contract_address(),
            &config.sponsor,
            &pool,
        );

        inst.set(&DataKey::MatchingPool, &0i128);
        inst.extend_ttl(17280, 518400);

        env.events().publish(
            ("campaign", "matching_sponsor_refunded"),
            (config.sponsor, pool),
        );
        Ok(())
    }

    // ── Category Functions ────────────────────────────────────────────────────

    /// Updates the campaign category (creator only, Active campaigns only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `category` - New campaign category
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not Active
    pub fn update_category(env: Env, category: Category) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        validate_category(&category)?;
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let old_category: Category = inst.get(&KEY_CATEGORY).unwrap_or(Category::Other);
        inst.set(&KEY_CATEGORY, &category);

        env.events().publish(
            ("campaign", "category_updated"),
            EventCategoryUpdated {
                old_category,
                new_category: category,
            },
        );
        Ok(())
    }

    // ── pause / unpause (admin) ───────────────────────────────────────────────

    /// Verify campaign (admin only).
    ///
    /// Can only be called while the campaign is in Active status.
    /// The admin (creator) must authorize this transaction.
    /// While paused, `contribute` calls are rejected with `CampaignPaused`.
    /// The campaign can be resumed with [`resume`](CrowdfundContract::resume)
    /// (or the legacy [`unpause`](CrowdfundContract::unpause)).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    ///
    /// # Side Effects
    /// - Sets campaign status to `Paused`
    /// - Publishes structured `EventPaused` event
    /// - Publishes `EventStatusChanged` event
    ///
    /// # Events
    /// ```ignore
    /// ("campaign", "paused")         → EventPaused { timestamp }
    /// ("campaign", "status_changed") → EventStatusChanged { old_status, new_status }
    /// ```
    pub fn pause(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        inst.set(&KEY_STATUS, &Status::Paused);
        let now = env.ledger().timestamp();
        // #696: record when unpause is permitted based on configured timelock
        let timelock: u64 = inst.get(&KEY_PAUSE_TIMELOCK).unwrap_or(0);
        let unpause_after = now.saturating_add(timelock);
        inst.set(&KEY_UNPAUSE_AFTER, &unpause_after);
        env.events().publish(
            ("campaign", "paused_with_timelock"),
            EventPausedWithTimelock { timestamp: now, unpause_after },
        );
        env.events().publish(("campaign", "paused"), EventPaused { timestamp: now });
        env.events().publish(
            ("campaign", "status_changed"),
            EventStatusChanged {
                old_status: Status::Active,
                new_status: Status::Paused,
            },
        );
        Ok(())
    }

    /// Resumes a paused campaign, allowing contributions again.
    ///
    /// Can only be called while the campaign is in Paused status.
    /// The admin (creator) must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Paused status
    ///
    /// # Side Effects
    /// - Sets campaign status to `Active`
    /// - Publishes structured `EventResumed` event
    /// - Publishes `EventStatusChanged` event
    ///
    /// # Events
    /// ```ignore
    /// ("campaign", "resumed")        → EventResumed { timestamp }
    /// ("campaign", "status_changed") → EventStatusChanged { old_status, new_status }
    /// ```
    pub fn resume(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Paused {
            return Err(ContractError::NotActive);
        }
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        // #696: enforce timelock — cannot unpause before unpause_after
        let unpause_after: u64 = inst.get(&KEY_UNPAUSE_AFTER).unwrap_or(0);
        let now = env.ledger().timestamp();
        if now < unpause_after {
            return Err(ContractError::EmergencyLocked);
        }
        inst.set(&KEY_STATUS, &Status::Active);
        env.events().publish(("campaign", "resumed"), EventResumed { timestamp: now });
        env.events().publish(
            ("campaign", "status_changed"),
            EventStatusChanged {
                old_status: Status::Paused,
                new_status: Status::Active,
            },
        );
        Ok(())
    }

    /// Resumes a paused campaign (legacy alias for [`resume`](CrowdfundContract::resume)).
    ///
    /// Prefer `resume()` in new integrations; this function is kept for backward
    /// compatibility with existing callers.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Paused status
    pub fn unpause(env: Env) -> Result<(), ContractError> {
        CrowdfundContract::resume(env)
    }

    /// Sets up a recurring contribution plan for a contributor.
    ///
    /// Allows a contributor to schedule automatic contributions at regular intervals.
    /// The contributor must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address (must authorize)
    /// * `amount` - Amount to contribute each interval in stroops
    /// * `interval` - Interval in seconds between contributions
    /// * `end_date` - Unix timestamp when recurring contributions should stop
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidRecurringPlan)` if parameters are invalid
    ///
    /// # Side Effects
    /// - Stores recurring plan in persistent storage
    /// - Publishes "recurring_setup" event
    pub fn setup_recurring(
        env: Env,
        contributor: Address,
        amount: i128,
        interval: u64,
        end_date: u64,
    ) -> Result<(), ContractError> {
        recurring::setup(&env, contributor, amount, interval, end_date)
    }

    /// Executes pending recurring contributions for a contributor.
    ///
    /// Can be called by anyone to trigger scheduled contributions.
    /// Only executes if the interval has passed since last execution.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidRecurringPlan)` if no plan exists or plan expired
    pub fn execute_recurring(env: Env, contributor: Address) -> Result<(), ContractError> {
        recurring::execute(&env, contributor)
    }

    /// Cancels a recurring contribution plan.
    ///
    /// The contributor must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn cancel_recurring(env: Env, contributor: Address) -> Result<(), ContractError> {
        recurring::cancel(&env, contributor)
    }

    /// Proposes a deadline extension and initiates voting.
    ///
    /// Only the creator can propose extensions. Voting period is 7 days.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `new_deadline` - Proposed new deadline (Unix timestamp)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidDeadline)` if new_deadline <= current_deadline
    pub fn propose_extension(env: Env, new_deadline: u64) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let current_deadline: u64 = inst.get(&KEY_DEADLINE).unwrap();
        if new_deadline <= current_deadline {
            return Err(ContractError::InvalidDeadline);
        }

        let now = env.ledger().timestamp();
        let voting_ends_at = now + 604800; // 7 days
        let proposal = ExtensionProposal {
            new_deadline,
            votes_for: 0,
            votes_against: 0,
            created_at: now,
            voting_ends_at,
            executed: false,
        };

        inst.set(&DataKey::ExtensionProposal, &proposal);
        env.events().publish(
            ("campaign", "extension_proposed"),
            EventExtensionProposed {
                new_deadline,
                voting_ends_at,
            },
        );
        Ok(())
    }

    /// Votes on a pending deadline extension.
    ///
    /// Contributors vote with weight equal to their contribution amount.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address (must authorize)
    /// * `approve` - true to vote for, false to vote against
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::VotingEnded)` if voting period has ended
    pub fn vote_on_extension(
        env: Env,
        contributor: Address,
        approve: bool,
    ) -> Result<(), ContractError> {
        contributor.require_auth();

        let inst = env.storage().instance();
        let mut proposal: ExtensionProposal = inst
            .get(&DataKey::ExtensionProposal)
            .ok_or(ContractError::ProposalNotFound)?;

        if env.ledger().timestamp() > proposal.voting_ends_at {
            return Err(ContractError::VotingEnded);
        }

        // Double-vote prevention: store the proposal's `created_at` as the
        // vote marker so a fresh proposal (different created_at) is treated as
        // a fresh ballot and stale markers from prior proposals don't block it.
        let vote_key = DataKey::ExtensionVote(contributor.clone());
        let last_voted: u64 = inst.get(&vote_key).unwrap_or(0);
        if last_voted == proposal.created_at {
            return Err(ContractError::AlreadyVoted);
        }

        let vote_weight: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(contributor.clone()))
            .unwrap_or(0);

        if approve {
            proposal.votes_for = proposal
                .votes_for
                .checked_add(vote_weight)
                .ok_or(ContractError::Overflow)?;
        } else {
            proposal.votes_against = proposal
                .votes_against
                .checked_add(vote_weight)
                .ok_or(ContractError::Overflow)?;
        }

        inst.set(&DataKey::ExtensionProposal, &proposal);
        inst.set(&vote_key, &proposal.created_at);

        env.events().publish(
            ("campaign", "extension_voted"),
            EventExtensionVoted {
                contributor,
                approve,
                vote_weight,
            },
        );
        Ok(())
    }

    /// Executes a deadline extension if voting threshold is met.
    ///
    /// Requires >50% of votes to be in favor. Can only be called after voting period ends.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn execute_extension(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let mut proposal: ExtensionProposal = inst
            .get(&DataKey::ExtensionProposal)
            .ok_or(ContractError::InvalidRecurringPlan)?;

        if env.ledger().timestamp() <= proposal.voting_ends_at {
            return Err(ContractError::VotingEnded);
        }

        if proposal.executed {
            return Ok(());
        }

        let total_votes = proposal
            .votes_for
            .checked_add(proposal.votes_against)
            .ok_or(ContractError::Overflow)?;
        if total_votes > 0 && proposal.votes_for * 2 > total_votes {
            inst.set(&KEY_DEADLINE, &proposal.new_deadline);
            env.events().publish(
                ("campaign", "extension_executed"),
                EventExtensionExecuted {
                    new_deadline: proposal.new_deadline,
                    votes_for: proposal.votes_for,
                    votes_against: proposal.votes_against,
                },
            );
        }

        proposal.executed = true;
        inst.set(&DataKey::ExtensionProposal, &proposal);
        Ok(())
    }

    /// Allows a contributor to request a partial refund before campaign ends.
    ///
    /// Limited to 50% of original contribution. Contributor must authorize.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address (must authorize)
    /// * `amount` - Amount to refund in stroops
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::RefundLimitExceeded)` if amount > 50% of contribution
    pub fn refund_partial(
        env: Env,
        contributor: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        contributor.require_auth();

        let contrib_key = DataKey::Contribution(contributor.clone());
        let total_contrib: i128 = env.storage().persistent().get(&contrib_key).unwrap_or(0);

        validate_partial_refund(amount, total_contrib)?;

        let inst = env.storage().instance();
        let token: Address = inst.get(&KEY_TOKEN).unwrap();
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &contributor,
            &amount,
        );

        let remaining = total_contrib - amount;
        env.storage().persistent().set(&contrib_key, &remaining);

        let total: i128 = inst.get(&KEY_TOTAL).unwrap();
        inst.set(&KEY_TOTAL, &(total - amount));

        env.events().publish(
            ("campaign", "partial_refund"),
            EventPartialRefund {
                contributor,
                amount,
                remaining,
            },
        );
        Ok(())
    }

    // ── Whitelist/Blacklist Functions ─────────────────────────────────────────

    /// Adds an address to the whitelist (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to whitelist
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn add_to_whitelist(env: Env, address: Address) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Whitelist(address.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Whitelist(address.clone()), 100, 100);
        env.events()
            .publish(("campaign", "whitelisted"), EventWhitelisted { address });
        Ok(())
    }

    /// Removes an address from the whitelist (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to remove from whitelist
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn remove_from_whitelist(env: Env, address: Address) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();
        env.storage()
            .persistent()
            .remove(&DataKey::Whitelist(address.clone()));
        env.events().publish(
            ("campaign", "whitelist_removed"),
            EventWhitelistRemoved { address },
        );
        Ok(())
    }

    /// Adds an address to the blacklist (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to blacklist
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn add_to_blacklist(env: Env, address: Address) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Blacklist(address.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Blacklist(address.clone()), 100, 100);
        env.events()
            .publish(("campaign", "blacklisted"), EventBlacklisted { address });
        Ok(())
    }

    /// Removes an address from the blacklist (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to remove from blacklist
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn remove_from_blacklist(env: Env, address: Address) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();
        env.storage()
            .persistent()
            .remove(&DataKey::Blacklist(address.clone()));
        env.events().publish(
            ("campaign", "blacklist_removed"),
            EventBlacklistRemoved { address },
        );
        Ok(())
    }

    /// Enables whitelist-only mode (creator only).
    ///
    /// When enabled, only whitelisted addresses can contribute.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `enabled` - true to enable, false to disable
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn set_whitelist_only(env: Env, enabled: bool) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::WhitelistOnly, &enabled);
        env.events().publish(
            ("campaign", "whitelist_only_set"),
            EventWhitelistOnlySet { enabled },
        );
        Ok(())
    }

    /// Checks if an address is whitelisted.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to check
    ///
    /// # Returns
    /// true if whitelisted, false otherwise
    pub fn is_whitelisted(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::Whitelist(address))
            .unwrap_or(false)
    }

    /// Checks if an address is blacklisted.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to check
    ///
    /// # Returns
    /// true if blacklisted, false otherwise
    pub fn is_blacklisted(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::Blacklist(address))
            .unwrap_or(false)
    }

    // ── Visibility Controls ───────────────────────────────────────────────────

    /// Sets the campaign visibility level (creator only).
    ///
    /// `Public` and `Unlisted` allow anyone to contribute; `Private` restricts
    /// contributions to whitelisted addresses (orthogonal to the legacy
    /// `whitelist_only` flag — either being on requires the contributor to be
    /// whitelisted). The `Unlisted` variant signals that the campaign should
    /// not appear in public discovery feeds but does not restrict contributions.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `visibility` - New visibility level
    pub fn set_visibility(env: Env, visibility: Visibility) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let old: Visibility = inst.get(&KEY_VISIBILITY).unwrap_or(Visibility::Public);
        inst.set(&KEY_VISIBILITY, &visibility);
        env.events().publish(
            ("campaign", "visibility_changed"),
            EventVisibilityChanged {
                old_visibility: old,
                new_visibility: visibility,
            },
        );
        Ok(())
    }

    /// Returns the campaign's current visibility level.
    pub fn get_visibility(env: Env) -> Visibility {
        env.storage()
            .instance()
            .get(&KEY_VISIBILITY)
            .unwrap_or(Visibility::Public)
    }

    /// Transfers campaign ownership to a new address (creator only).
    ///
    /// Updates both the creator and admin to `new_owner`. The current creator
    /// must authorize this transaction. The new owner cannot be the same as
    /// the current owner.
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if `new_owner` equals current creator
    pub fn transfer_ownership(env: Env, new_owner: Address) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        if new_owner == creator {
            return Err(ContractError::Unauthorized);
        }

        inst.set(&KEY_CREATOR, &new_owner);
        inst.set(&KEY_ADMIN, &new_owner);

        env.events().publish(
            ("campaign", "ownership_transferred"),
            EventOwnershipTransferred {
                previous_owner: creator,
                new_owner,
            },
        );
        Ok(())
    }

    // ── Delegation Functions ──────────────────────────────────────────────────

    /// Delegates contribution authority to another address (delegator must authorize).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `delegator` - The address delegating authority (must authorize)
    /// * `delegate` - The address receiving delegation authority
    /// * `amount` - Maximum amount the delegate can contribute on behalf of delegator
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn delegate_contribution(
        env: Env,
        delegator: Address,
        delegate: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        delegator.require_auth();

        validate_delegation(amount)?;

        let delegation = Delegation {
            amount,
            delegate: delegate.clone(),
            active: true,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Delegation(delegator.clone()), &delegation);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Delegation(delegator.clone()), 100, 100);
        env.events().publish(
            ("campaign", "delegation_created"),
            EventDelegationCreated {
                delegator,
                delegate,
                amount,
            },
        );
        Ok(())
    }

    /// Contributes on behalf of a delegator (delegate must authorize).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `delegator` - The address on whose behalf the contribution is made
    /// * `delegate` - The delegate address (must authorize)
    /// * `amount` - Contribution amount in stroops
    /// * `token` - Token address
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn contribute_on_behalf(
        env: Env,
        delegator: Address,
        delegate: Address,
        amount: i128,
        token: Address,
    ) -> Result<(), ContractError> {
        delegate.require_auth();

        let delegation: Delegation = env
            .storage()
            .persistent()
            .get(&DataKey::Delegation(delegator.clone()))
            .ok_or(ContractError::DelegationNotFound)?;

        if !delegation.active || delegation.delegate != delegate {
            return Err(ContractError::InvalidDelegation);
        }

        let delegated_key = DataKey::DelegatedContribution(delegator.clone());
        let delegated_so_far: i128 = env.storage().persistent().get(&delegated_key).unwrap_or(0);
        if delegated_so_far + amount > delegation.amount {
            return Err(ContractError::ExceedsMaximum);
        }

        // Perform the contribution as if delegator is contributing
        let min: i128 = env.storage().instance().get(&KEY_MIN).unwrap();
        if amount < min {
            return Err(ContractError::BelowMinimum);
        }

        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
        if env.ledger().timestamp() >= deadline {
            return Err(ContractError::CampaignEnded);
        }

        // Check whitelist/blacklist
        if env
            .storage()
            .persistent()
            .get::<_, bool>(&DataKey::Blacklist(delegator.clone()))
            .unwrap_or(false)
        {
            return Err(ContractError::Blacklisted);
        }

        let whitelist_only: bool = env
            .storage()
            .instance()
            .get(&DataKey::WhitelistOnly)
            .unwrap_or(false);
        let visibility: Visibility = env
            .storage()
            .instance()
            .get(&KEY_VISIBILITY)
            .unwrap_or(Visibility::Public);
        if (whitelist_only || visibility == Visibility::Private)
            && !env
                .storage()
                .persistent()
                .get::<_, bool>(&DataKey::Whitelist(delegator.clone()))
                .unwrap_or(false)
        {
            return Err(ContractError::NotWhitelisted);
        }

        token::Client::new(&env, &token).transfer(
            &delegate,
            &env.current_contract_address(),
            &amount,
        );

        let key = DataKey::Contribution(delegator.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_amount = prev.checked_add(amount).ok_or(ContractError::Overflow)?;
        env.storage().persistent().set(&key, &new_amount);
        env.storage().persistent().extend_ttl(&key, 100, 100);

        env.storage()
            .persistent()
            .set(&delegated_key, &(delegated_so_far + amount));
        env.storage()
            .persistent()
            .extend_ttl(&delegated_key, 100, 100);

        let total: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap();
        let new_total = total.checked_add(amount).ok_or(ContractError::Overflow)?;
        env.storage().instance().set(&KEY_TOTAL, &new_total);

        let presence_key = DataKey::ContributorPresence(delegator.clone());
        let is_present: bool = env
            .storage()
            .persistent()
            .get(&presence_key)
            .unwrap_or(false);
        if !is_present {
            env.storage().persistent().set(&presence_key, &true);
            env.storage()
                .persistent()
                .extend_ttl(&presence_key, 100, 100);
            let count: u32 = env
                .storage()
                .instance()
                .get(&DataKey::ContributorCount)
                .unwrap();
            // O(1) indexed write, same pattern as contribute()
            let index_key = DataKey::ContributorIndex(count);
            env.storage().persistent().set(&index_key, &delegator);
            env.storage().persistent().extend_ttl(&index_key, 100, 100);
            env.storage()
                .instance()
                .set(&DataKey::ContributorCount, &(count + 1));
        }

        env.events().publish(
            ("campaign", "delegated_contribution"),
            EventDelegatedContribution {
                delegator,
                delegate,
                amount,
            },
        );
        Ok(())
    }

    /// Revokes a delegation (delegator must authorize).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `delegator` - The delegator address (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn revoke_delegation(env: Env, delegator: Address) -> Result<(), ContractError> {
        delegator.require_auth();

        let mut delegation: Delegation = env
            .storage()
            .persistent()
            .get(&DataKey::Delegation(delegator.clone()))
            .ok_or(ContractError::DelegationNotFound)?;

        delegation.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Delegation(delegator.clone()), &delegation);
        env.events().publish(
            ("campaign", "delegation_revoked"),
            EventDelegationRevoked { delegator },
        );
        Ok(())
    }

    /// Gets delegation info for an address.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `delegator` - The delegator address
    ///
    /// # Returns
    /// Optional Delegation info
    pub fn get_delegation(env: Env, delegator: Address) -> Option<Delegation> {
        env.storage()
            .persistent()
            .get(&DataKey::Delegation(delegator))
    }

    // ── Template Functions ────────────────────────────────────────────────────

    /// Sets a campaign template (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `template_type` - The template type
    /// * `name` - Template name
    /// * `description` - Template description
    /// * `suggested_min` - Suggested minimum contribution
    /// * `goal_multiplier` - Goal multiplier in basis points
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn set_template(
        env: Env,
        template_type: TemplateType,
        name: String,
        description: String,
        suggested_min: i128,
        goal_multiplier: u32,
    ) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        validate_string_length(&name, 64)?;
        validate_string_length(&description, 512)?;

        let template = CampaignTemplate {
            template_type,
            name,
            description,
            suggested_min,
            goal_multiplier,
        };

        env.storage().instance().set(&DataKey::Template, &template);
        env.events().publish(("campaign", "template_set"), ());
        Ok(())
    }

    /// Gets the campaign template.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional CampaignTemplate
    pub fn get_template(env: Env) -> Option<CampaignTemplate> {
        env.storage().instance().get(&DataKey::Template)
    }

    // ── Issue #418: Reward Tier Functions ─────────────────────────────────────

    /// Configures reward tiers for the campaign (creator only).
    ///
    /// Tiers must be provided sorted by `min_amount` in **ascending** order.
    /// The contract validates this ordering and rejects unsorted lists.
    /// Up to 10 tiers are supported.
    ///
    /// When a contributor's cumulative total reaches a tier's `min_amount`,
    /// that tier is automatically assigned to them by [`contribute`](CrowdfundContract::contribute).
    ///
    /// # Arguments
    /// * `env`   - The Soroban environment
    /// * `tiers` - Ordered list of `RewardTier` values (ascending `min_amount`)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if caller is not the creator
    /// * `Err(ContractError::InvalidGoal)` if tiers are not sorted or list is empty
    ///
    /// # Side Effects
    /// - Stores tier list in instance storage
    /// - Publishes `EventTiersSet` event
    pub fn set_reward_tiers(env: Env, tiers: Vec<RewardTier>) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        if tiers.len() == 0 {
            return Err(ContractError::InvalidGoal);
        }

        // Validate ascending sort order and positive min_amounts
        let mut prev_min = 0i128;
        for tier in tiers.iter() {
            if tier.min_amount <= 0 || tier.min_amount <= prev_min {
                return Err(ContractError::InvalidGoal);
            }
            prev_min = tier.min_amount;
        }

        let tier_count = tiers.len();
        env.storage().instance().set(&DataKey::RewardTiers, &tiers);
        env.events().publish(
            ("campaign", "tiers_set"),
            EventTiersSet { tier_count },
        );
        Ok(())
    }

    /// Returns the highest reward tier a given amount qualifies for.
    ///
    /// Iterates the configured tiers (ascending) and returns the last one whose
    /// `min_amount` is ≤ `amount`.  Returns `None` if no tiers are configured or
    /// `amount` is below all thresholds.
    ///
    /// # Arguments
    /// * `env`    - The Soroban environment
    /// * `amount` - Cumulative contribution amount to evaluate (in stroops)
    ///
    /// # Returns
    /// * `Some(RewardTier)` — the best qualifying tier
    /// * `None` — no tiers are configured or amount is below all thresholds
    pub fn get_tier_for_amount(env: Env, amount: i128) -> Option<RewardTier> {
        let tiers: Vec<RewardTier> = env
            .storage()
            .instance()
            .get(&DataKey::RewardTiers)
            .unwrap_or_else(|| Vec::new(&env));

        let mut best: Option<RewardTier> = None;
        for tier in tiers.iter() {
            if amount >= tier.min_amount {
                best = Some(tier);
            } else {
                break;
            }
        }
        best
    }

    /// Returns the reward tier currently assigned to a contributor.
    ///
    /// The assignment is updated automatically every time the contributor calls
    /// [`contribute`](CrowdfundContract::contribute).
    ///
    /// # Arguments
    /// * `env`         - The Soroban environment
    /// * `contributor` - Address to query
    ///
    /// # Returns
    /// * `Some(RewardTier)` — current tier
    /// * `None` — contributor has no tier (no tiers configured, or amount below minimum)
    pub fn get_contributor_tier(env: Env, contributor: Address) -> Option<RewardTier> {
        env.storage()
            .persistent()
            .get(&DataKey::ContributorTier(contributor))
    }

    // ── Issue #419: Contribution History Functions ────────────────────────────

    /// Returns the full contribution history for a contributor.
    ///
    /// Each entry is a [`ContributionRecord`] capturing the amount, ledger
    /// timestamp, and running total at the time of the contribution.  Records
    /// are appended chronologically by [`contribute`](CrowdfundContract::contribute).
    ///
    /// # Arguments
    /// * `env`         - The Soroban environment
    /// * `contributor` - Address whose history to retrieve
    ///
    /// # Returns
    /// Ordered `Vec<ContributionRecord>` — empty if the address has never contributed
    pub fn get_contribution_history(env: Env, contributor: Address) -> Vec<ContributionRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::ContributionHistory(contributor))
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ── View functions ────────────────────────────────────────────────────────

    /// Returns the total amount raised so far in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Total raised amount (i128), or 0 if not yet initialized
    pub fn total_raised(env: Env) -> i128 {
        env.storage().instance().get(&KEY_TOTAL).unwrap_or(0)
    }

    /// Returns the campaign creator's Stellar address.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Creator's address
    pub fn creator(env: Env) -> Address {
        env.storage().instance().get(&KEY_CREATOR).unwrap()
    }

    /// Returns the current campaign status.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Current Status (Active, Successful, Refunded, Cancelled, or Paused)
    pub fn status(env: Env) -> Status {
        env.storage().instance().get(&KEY_STATUS).unwrap()
    }

    /// Returns the campaign funding goal in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Goal amount (i128)
    pub fn goal(env: Env) -> i128 {
        env.storage().instance().get(&KEY_GOAL).unwrap()
    }

    /// Returns the campaign deadline as a Unix timestamp (seconds).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Deadline timestamp (u64)
    pub fn deadline(env: Env) -> u64 {
        env.storage().instance().get(&KEY_DEADLINE).unwrap()
    }

    /// Returns the total contribution amount for a specific contributor in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address
    ///
    /// # Returns
    /// Total contribution amount (i128), or 0 if no contributions
    pub fn contribution(env: Env, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(0)
    }

    /// Checks if an address has made any contributions to the campaign.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - The address to check
    ///
    /// # Returns
    /// true if the address has contributed, false otherwise
    pub fn is_contributor(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::Contribution(address))
            .unwrap_or(0)
            > 0
    }

    /// Returns the minimum contribution amount in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Minimum contribution amount (i128)
    pub fn min_contribution(env: Env) -> i128 {
        env.storage().instance().get(&KEY_MIN).unwrap()
    }

    /// Returns the maximum contribution amount per contributor in stroops (0 = no limit).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Maximum contribution amount (i128), or 0 if no limit is set
    pub fn max_contribution(env: Env) -> i128 {
        env.storage().instance().get(&KEY_MAX).unwrap_or(0)
    }

    /// Returns the campaign title.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Campaign title string
    pub fn title(env: Env) -> String {
        env.storage()
            .instance()
            .get(&KEY_TITLE)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    /// Returns the campaign description.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Campaign description string
    pub fn description(env: Env) -> String {
        env.storage()
            .instance()
            .get(&KEY_DESC)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    /// Returns the campaign's social media links.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of social media URLs
    pub fn social_links(env: Env) -> Vec<String> {
        env.storage()
            .instance()
            .get(&KEY_SOCIAL)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Returns the list of accepted token addresses (whitelist).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of accepted token addresses, or a single-element list with the
    /// primary token when no explicit whitelist is configured.
    pub fn accepted_tokens(env: Env) -> Vec<Address> {
        let inst = env.storage().instance();
        if let Some(tokens) = inst.get::<_, Vec<Address>>(&DataKey::AcceptedTokens) {
            return tokens;
        }
        // Fall back to the primary campaign token
        let mut v = Vec::new(&env);
        if let Some(tok) = inst.get::<_, Address>(&KEY_TOKEN) {
            v.push_back(tok);
        }
        v
    }

    /// Returns the platform fee configuration (if set).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional PlatformConfig containing address and fee_bps
    pub fn platform_config(env: Env) -> Option<PlatformConfig> {
        env.storage().instance().get(&KEY_PLATFORM)
    }

    /// Returns the current fee mode (`OnSuccess` or `OnContribution`), defaulting
    /// to `OnSuccess` when no platform config is set.
    pub fn get_fee_mode(env: Env) -> FeeMode {
        env.storage()
            .instance()
            .get::<_, PlatformConfig>(&KEY_PLATFORM)
            .map(|c| c.fee_mode)
            .unwrap_or(FeeMode::OnSuccess)
    }

    /// Returns the contract version number.
    ///
    /// # Arguments
    /// * `_env` - The Soroban environment (unused)
    ///
    /// # Returns
    /// Contract version (u32)
    pub fn version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    /// Returns comprehensive campaign statistics.
    ///
    /// Includes total raised, goal, progress percentage, contributor count,
    /// average contribution, and largest single contribution.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// CampaignStats struct with all metrics
    ///
    /// # Progress Calculation
    /// progress_bps = (total_raised * 10_000) / goal, capped at 10_000 (100%)
    pub fn get_stats(env: Env) -> CampaignStats {
        // Cache the instance storage handle; all four reads target the same
        // ledger entry so a single handle avoids repeated borrow overhead.
        let inst = env.storage().instance();
        let contributor_count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);
        let largest_contribution: i128 = inst.get(&DataKey::LargestContribution).unwrap_or(0);
        let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        let gross_raised: i128 = inst.get(&KEY_GROSS_TOTAL).unwrap_or(total_raised);
        let goal: i128 = inst.get(&KEY_GOAL).unwrap();
        let soft_cap: i128 = inst.get(&KEY_SOFT_CAP).unwrap_or(0);
        let stretch_goal: i128 = inst.get(&KEY_STRETCH_GOAL).unwrap_or(0);

        // Progress is measured against the soft_cap when set, otherwise the hard goal.
        let progress_target = if soft_cap > 0 { soft_cap } else { goal };
        let progress_bps = if progress_target > 0 {
            let raw = (total_raised * 10_000) / progress_target;
            if raw > 10_000 { 10_000 } else { raw as u32 }
        } else {
            0
        };

        let average_contribution = if contributor_count == 0 {
            0
        } else {
            total_raised / contributor_count as i128
        };

        CampaignStats {
            total_raised,
            gross_raised,
            goal,
            soft_cap,
            stretch_goal,
            progress_bps,
            contributor_count,
            average_contribution,
            largest_contribution,
        }
    }

    /// Returns all inputs needed for off-chain quadratic-funding distribution.
    ///
    /// Walks the indexed contributor list and returns each address paired with
    /// its cumulative contribution.  The sqrt-and-sum step is intentionally
    /// left to the off-chain QF calculator so the contract stays lightweight.
    ///
    /// # Returns
    /// `QfInputs` — contributor count and per-contributor amounts
    pub fn get_qf_inputs(env: Env) -> QfInputs {
        let inst = env.storage().instance();
        let count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);

        let mut contributors: soroban_sdk::Vec<QfContributorInput> =
            soroban_sdk::Vec::new(&env);

        for i in 0..count {
            if let Some(addr) = env
                .storage()
                .persistent()
                .get::<_, Address>(&DataKey::ContributorIndex(i))
            {
                let amount: i128 = env
                    .storage()
                    .persistent()
                    .get(&DataKey::Contribution(addr.clone()))
                    .unwrap_or(0);
                contributors.push_back(QfContributorInput {
                    contributor: addr,
                    amount,
                });
            }
        }

        QfInputs {
            contributor_count: count,
            contributors,
        }
    }

    /// Returns comprehensive campaign information.
    ///
    /// Includes creator, token, goal, deadline, minimum contribution, metadata,
    /// status, and platform fee configuration.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// CampaignInfo struct with all campaign details
    pub fn get_campaign_info(env: Env) -> CampaignInfo {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        let token: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();
        let goal: i128 = env.storage().instance().get(&KEY_GOAL).unwrap();
        let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
        let min_contribution: i128 = env.storage().instance().get(&KEY_MIN).unwrap();
        let max_contribution: i128 = env.storage().instance().get(&KEY_MAX).unwrap_or(0);
        let title: String = env
            .storage()
            .instance()
            .get(&KEY_TITLE)
            .unwrap_or_else(|| String::from_str(&env, ""));
        let description: String = env
            .storage()
            .instance()
            .get(&KEY_DESC)
            .unwrap_or_else(|| String::from_str(&env, ""));
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        let category: Category = env
            .storage()
            .instance()
            .get(&KEY_CATEGORY)
            .unwrap_or(Category::Other);

        let (has_platform_config, platform_fee_bps, platform_address) = if let Some(config) = env
            .storage()
            .instance()
            .get::<_, PlatformConfig>(&KEY_PLATFORM)
        {
            (true, config.fee_bps, config.address)
        } else {
            (false, 0, creator.clone())
        };

        CampaignInfo {
            creator,
            token,
            goal,
            deadline,
            min_contribution,
            max_contribution,
            title,
            description,
            status,
            has_platform_config,
            platform_fee_bps,
            platform_address,
            category,
        }
    }

    /// Returns the campaign category.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Campaign category
    pub fn get_category(env: Env) -> Category {
        env.storage()
            .instance()
            .get(&KEY_CATEGORY)
            .unwrap_or(Category::Other)
    }

    /// Returns the vesting schedule (if configured).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional VestingSchedule with cliff and duration
    pub fn get_vesting_info(env: Env) -> Option<VestingSchedule> {
        env.storage().instance().get(&KEY_VESTING)
    }

    /// Returns the amount of the creator payout that is currently vested.
    ///
    /// The vested amount is computed against the current `total_raised`, minus
    /// the configured platform fee (if any). If no vesting schedule is set the
    /// full post-fee payout is reported as vested. Before the cliff, 0 is
    /// returned; after `cliff + duration`, the full post-fee payout; in
    /// between, linear vesting based on elapsed time.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vested portion of the creator payout in stroops
    pub fn get_vested_amount(env: Env) -> i128 {
        let inst = env.storage().instance();
        let total: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        if total <= 0 {
            return 0;
        }

        let platform_fee = inst
            .get::<_, PlatformConfig>(&KEY_PLATFORM)
            .map(|c| total * c.fee_bps as i128 / 10_000)
            .unwrap_or(0);
        let payout = total - platform_fee;

        let vesting: Option<VestingSchedule> = inst.get(&KEY_VESTING);
        let Some(v) = vesting else { return payout };

        let now = env.ledger().timestamp();
        if now < v.cliff {
            return 0;
        }
        if v.duration == 0 || now >= v.cliff + v.duration {
            return payout;
        }
        let elapsed = now - v.cliff;
        payout * elapsed as i128 / v.duration as i128
    }

    /// Returns the goal adjustment history.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of GoalAdjustment entries
    pub fn get_goal_history(env: Env) -> Vec<GoalAdjustment> {
        env.storage()
            .persistent()
            .get(&KEY_GOAL_HISTORY)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Returns comprehensive campaign performance metrics.
    ///
    /// Calculates success rate, contribution velocity, trending direction,
    /// milestone progress, time elapsed, and estimated time to reach goal.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// PerformanceMetrics struct with all performance indicators
    ///
    /// # Calculations
    /// - success_rate_bps: (total_raised * 10000) / goal, capped at 10000
    /// - contribution_velocity: total_raised / days_elapsed (if any time has passed)
    /// - trending: compares recent vs earlier contributions (positive = increasing)
    /// - time_elapsed: current_time - start_time
    /// - estimated_time_to_goal: (goal - total_raised) / daily_velocity
    /// - average_daily_contribution: total_raised / days_elapsed
    pub fn get_performance_metrics(env: Env) -> PerformanceMetrics {
        let inst = env.storage().instance();
        let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        let goal: i128 = inst.get(&KEY_GOAL).unwrap();
        let start_time: u64 = inst.get(&KEY_START_TIME).unwrap_or(env.ledger().timestamp());
        let now = env.ledger().timestamp();

        // Calculate success rate in basis points
        let success_rate_bps = if goal > 0 {
            let raw = (total_raised * 10_000) / goal;
            if raw > 10_000 {
                10_000
            } else {
                raw as u32
            }
        } else {
            0
        };

        // Calculate time elapsed
        let time_elapsed = now.saturating_sub(start_time);
        let days_elapsed = time_elapsed / 86400; // Convert seconds to days

        // Calculate contribution velocity and average daily contribution
        let (contribution_velocity, average_daily_contribution) = if days_elapsed > 0 {
            let daily = total_raised / days_elapsed as i128;
            (daily, daily)
        } else {
            (0, 0)
        };

        // Calculate trending by comparing recent vs earlier contributions.
        // Read contributor count from instance storage (already in footprint),
        // then fetch each contributor by index from persistent storage.
        // Previously read KEY_CONTRIBS from instance storage (a bug — contributors
        // are written to persistent storage), so trending was always 0.
        let contributor_count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);

        let mut recent_sum = 0i128;
        let mut earlier_sum = 0i128;
        let mut recent_count = 0u32;
        let mut earlier_count = 0u32;
        let mid_point = time_elapsed / 2;

        for i in 0..contributor_count {
            let contributor: Address = match env
                .storage()
                .persistent()
                .get::<_, Address>(&DataKey::ContributorIndex(i))
            {
                Some(addr) => addr,
                None => continue,
            };
            let history: Vec<ContributionRecord> = env
                .storage()
                .persistent()
                .get(&DataKey::ContributionHistory(contributor.clone()))
                .unwrap_or_else(|| Vec::new(&env));

            for record in history.iter() {
                let time_since_start = record.timestamp.saturating_sub(start_time);

                if time_since_start > mid_point {
                    recent_sum += record.amount;
                    recent_count += 1;
                } else {
                    earlier_sum += record.amount;
                    earlier_count += 1;
                }
            }
        }

        // Calculate trending: positive if recent > earlier, negative if recent < earlier
        let trending = if earlier_count > 0 && recent_count > 0 {
            let earlier_avg = earlier_sum / earlier_count as i128;
            let recent_avg = recent_sum / recent_count as i128;
            let diff = recent_avg - earlier_avg;
            // Scale to a reasonable range (-100 to 100)
            if diff > 0 {
                ((diff * 100) / earlier_avg.max(1)) as i32
            } else {
                ((diff * 100) / earlier_avg.max(1)) as i32
            }
        } else if recent_count > 0 && earlier_count == 0 {
            50 // Positive trend if only recent contributions
        } else {
            0 // Stable or no data
        };

        // Calculate estimated time to reach goal
        let estimated_time_to_goal: u64 = if contribution_velocity > 0 && total_raised < goal {
            let remaining = goal - total_raised;
            let days_needed = remaining / contribution_velocity;
            (days_needed * 86400).max(0) as u64 // Convert back to seconds
        } else if total_raised >= goal {
            0 // Goal already reached
        } else {
            0 // Cannot estimate (no velocity or already at goal)
        };

        // For now, set milestone tracking to 0 (would need milestone storage)
        // This can be enhanced later when milestone tracking is implemented
        let milestones_reached = 0u32;
        let total_milestones = 0u32;

        PerformanceMetrics {
            success_rate_bps,
            contribution_velocity,
            trending,
            milestones_reached,
            total_milestones,
            time_elapsed,
            estimated_time_to_goal,
            average_daily_contribution,
        }
    }

    // ── Issue #423 — Campaign Metadata Versioning ─────────────────────────────

    /// Returns the full metadata version history for this campaign.
    ///
    /// Version 0 is the initial metadata recorded at initialization.
    /// Subsequent entries are created by every successful call to
    /// [`update_metadata`](CrowdfundContract::update_metadata).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of [`MetadataVersion`] entries in chronological order
    pub fn get_metadata_history(env: Env) -> Vec<MetadataVersion> {
        env.storage()
            .persistent()
            .get(&KEY_META_HIST)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Returns the penalty fee in basis points (if configured).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Penalty fee in basis points, or 0 if not configured
    pub fn get_penalty_bps(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::PenaltyBps)
            .unwrap_or(0)
    }

    /// Returns a paginated list of contributor addresses.
    ///
    /// Useful for iterating through all contributors without loading the entire list.
    /// The limit is capped at 50 to prevent excessive memory usage.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `offset` - Starting index in the contributor list (0-based)
    /// * `limit` - Maximum number of contributors to return (capped at 50)
    ///
    /// # Returns
    /// Vector of contributor addresses for the requested page
    ///
    /// # Example
    /// ```ignore
    /// // Get first 10 contributors
    /// let page1 = contributor_list(env, 0, 10);
    /// // Get next 10 contributors
    /// let page2 = contributor_list(env, 10, 10);
    /// ```
    pub fn contributor_list(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        // Read total count from instance storage (cheap — already in footprint).
        let total_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ContributorCount)
            .unwrap_or(0);

        if offset >= total_count {
            return Vec::new(&env);
        }

        // Cap at 50 per the original contract spec.
        let capped_limit = limit.min(50);
        let end = (offset + capped_limit).min(total_count);

        // O(page_size) reads via individual indexed keys instead of loading and
        // deserialising the entire contributor list each time.
        let mut result = Vec::new(&env);
        for i in offset..end {
            if let Some(addr) = env
                .storage()
                .persistent()
                .get::<_, Address>(&DataKey::ContributorIndex(i))
            {
                result.push_back(addr);
            }
        }
        result
    }

    /// Returns the contribution message for a contributor.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// Optional message string, or None if no message was provided
    pub fn get_contribution_message(env: Env, contributor: Address) -> Option<String> {
        env.storage()
            .persistent()
            .get(&DataKey::ContributionMessage(contributor))
    }

    /// Returns the recurring plan for a contributor.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// Optional RecurringPlan, or None if no plan exists
    pub fn get_recurring_plan(env: Env, contributor: Address) -> Option<RecurringPlan> {
        env.storage()
            .persistent()
            .get(&DataKey::RecurringPlan(contributor))
    }

    /// Returns the current extension proposal.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional ExtensionProposal, or None if no proposal exists
    pub fn get_extension_proposal(env: Env) -> Option<ExtensionProposal> {
        env.storage().instance().get(&DataKey::ExtensionProposal)
    }

    /// Enables insurance for the campaign.
    ///
    /// Allows the creator to set up optional insurance protection for contributors.
    /// Insurance fees are collected during contributions and held in a pool.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `fee_bps` - Insurance fee in basis points (e.g., 100 = 1%)
    /// * `provider` - Address of the insurance provider
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if caller is not the creator
    /// * `Err(ContractError::InvalidFee)` if fee_bps > 10,000
    pub fn enable_insurance(
        env: Env,
        fee_bps: u32,
        provider: Address,
    ) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        validate_fee_bps(fee_bps)?;
        validate_address_not_self(&creator, &provider)?;

        let config = InsuranceConfig {
            fee_bps,
            provider: provider.clone(),
            enabled: true,
        };

        let inst = env.storage().instance();
        inst.set(&KEY_INSURANCE, &config);
        inst.set(&KEY_INSURANCE_POOL, &0i128);
        env.events().publish(
            ("insurance", "enabled"),
            EventInsuranceEnabled { fee_bps, provider },
        );
        Ok(())
    }

    /// Returns the insurance configuration if enabled.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional InsuranceConfig, or None if insurance is not enabled
    pub fn get_insurance_config(env: Env) -> Option<InsuranceConfig> {
        env.storage().instance().get(&KEY_INSURANCE)
    }

    /// Returns the total insurance pool amount.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Total insurance fees collected in stroops
    pub fn get_insurance_pool(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&KEY_INSURANCE_POOL)
            .unwrap_or(0)
    }

    /// Returns the insurance fee paid by a contributor.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// Insurance fee amount in stroops, or 0 if no insurance fee paid
    pub fn get_insurance_fee(env: Env, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::InsuranceFee(contributor))
            .unwrap_or(0)
    }

    /// Claims an insurance payout for a contributor of a failed campaign.
    ///
    /// Can only be called when the campaign is in `Cancelled` status, or when
    /// the deadline has passed and the goal was not reached. Transfers the
    /// per-contributor insurance fee from the contract back to the contributor
    /// and decrements the insurance pool counter.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success (no-op if the contributor has no insurance fee on record)
    /// * `Err(ContractError::CampaignStillActive)` if deadline not passed and not cancelled
    /// * `Err(ContractError::GoalReached)` if goal was reached and campaign not cancelled
    /// * `Err(ContractError::InsufficientFunds)` if the pool is somehow below the fee
    pub fn claim_insurance_payout(env: Env, contributor: Address) -> Result<(), ContractError> {
        contributor.require_auth();

        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Cancelled {
            let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap();
            if env.ledger().timestamp() < deadline {
                return Err(ContractError::CampaignStillActive);
            }
            let goal: i128 = inst.get(&KEY_GOAL).unwrap();
            let total: i128 = inst.get(&KEY_TOTAL).unwrap();
            if total >= goal {
                return Err(ContractError::GoalReached);
            }
        }

        let fee_key = DataKey::InsuranceFee(contributor.clone());
        let insurance_fee: i128 = env.storage().persistent().get(&fee_key).unwrap_or(0);
        if insurance_fee == 0 {
            return Ok(());
        }

        let mut pool: i128 = inst.get(&KEY_INSURANCE_POOL).unwrap_or(0);
        if pool < insurance_fee {
            return Err(ContractError::InsufficientFunds);
        }

        let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
        token::Client::new(&env, &token_address).transfer(
            &env.current_contract_address(),
            &contributor,
            &insurance_fee,
        );

        pool = pool
            .checked_sub(insurance_fee)
            .ok_or(ContractError::Overflow)?;
        inst.set(&KEY_INSURANCE_POOL, &pool);
        env.storage().persistent().set(&fee_key, &0i128);

        env.events().publish(
            ("insurance", "payout"),
            EventInsurancePayout {
                contributor,
                amount: insurance_fee,
            },
        );
        Ok(())
    }

    /// Configures reward distribution for the campaign.
    ///
    /// Sets up NFT or token rewards that contributors will receive based on their contributions.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `reward_token` - The token address for rewards
    /// * `reward_per_unit` - Reward amount per contribution unit (stroops)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotCreator)` if caller is not the creator
    pub fn configure_rewards(
        env: Env,
        reward_token: Address,
        reward_per_unit: i128,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        validate_positive_amount(reward_per_unit)?;

        let config = RewardConfig {
            reward_token: reward_token.clone(),
            reward_per_unit,
            enabled: true,
        };

        inst.set(&DataKey::RewardConfig, &config);
        inst.set(&DataKey::TotalRewardsDistributed, &0i128);

        env.events().publish(
            ("campaign", "rewards_configured"),
            EventRewardsConfigured {
                reward_token,
                reward_per_unit,
            },
        );
        Ok(())
    }

    /// Distributes rewards to a contributor based on their contribution.
    ///
    /// Mints and transfers reward tokens to the contributor proportional to their contribution.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NoRewardsConfigured)` if rewards not configured
    pub fn distribute_rewards(env: Env, contributor: Address) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let reward_config: Option<RewardConfig> = inst.get(&DataKey::RewardConfig);

        let config = reward_config.ok_or(ContractError::NoRewardsConfigured)?;
        if !config.enabled {
            return Err(ContractError::NoRewardsConfigured);
        }

        let contribution: i128 = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::Contribution(contributor.clone()))
            .unwrap_or(0);

        if contribution == 0 {
            return Err(ContractError::BelowMinimum);
        }

        let reward_amount = contribution
            .checked_mul(config.reward_per_unit)
            .ok_or(ContractError::Overflow)?
            .checked_div(1_000_000)
            .ok_or(ContractError::Overflow)?;

        let already_claimed: i128 = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::RewardsClaimed(contributor.clone()))
            .unwrap_or(0);

        if already_claimed > 0 {
            return Ok(());
        }

        token::Client::new(&env, &config.reward_token).transfer(
            &env.current_contract_address(),
            &contributor,
            &reward_amount,
        );

        let mut total: i128 = inst.get(&DataKey::TotalRewardsDistributed).unwrap_or(0);
        total = total
            .checked_add(reward_amount)
            .ok_or(ContractError::Overflow)?;
        inst.set(&DataKey::TotalRewardsDistributed, &total);

        env.storage()
            .persistent()
            .set(&DataKey::RewardsClaimed(contributor.clone()), &reward_amount);

        env.events().publish(
            ("campaign", "rewards_distributed"),
            EventRewardsDistributed {
                contributor,
                contribution_amount: contribution,
                reward_amount,
            },
        );
        Ok(())
    }

    /// Creates or updates the search index for the campaign.
    ///
    /// Indexes campaign metadata for efficient discovery and filtering.
    /// Called automatically on initialization and when metadata is updated.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn index_campaign(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let title: String = inst.get(&KEY_TITLE).unwrap();
        let description: String = inst.get(&KEY_DESC).unwrap();
        let category: Category = inst.get(&KEY_CATEGORY).unwrap();
        let visibility: Visibility = inst.get(&KEY_VISIBILITY).unwrap_or(Visibility::Public);
        let status: Status = inst.get(&KEY_STATUS).unwrap();

        let index = SearchIndexEntry {
            title: title.clone(),
            description,
            category,
            visibility,
            created_at: env.ledger().timestamp(),
            status,
        };

        env.storage()
            .persistent()
            .set(&DataKey::SearchIndex, &index);

        env.events().publish(
            ("campaign", "indexed"),
            EventCampaignIndexed {
                title,
                category,
                visibility,
            },
        );
        Ok(())
    }

    /// Searches campaigns by category.
    ///
    /// Retrieves the search index entry filtered by category.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `category` - The category to filter by
    ///
    /// # Returns
    /// * `Ok(Some(SearchIndexEntry))` if campaign matches category
    /// * `Ok(None)` if campaign doesn't match category
    pub fn search_by_category(
        env: Env,
        category: Category,
    ) -> Result<Option<SearchIndexEntry>, ContractError> {
        let index: Option<SearchIndexEntry> = env
            .storage()
            .persistent()
            .get(&DataKey::SearchIndex);

        match index {
            Some(entry) if entry.category == category => Ok(Some(entry)),
            Some(_) => Ok(None),
            None => Ok(None),
        }
    }

    /// Searches campaigns by visibility.
    ///
    /// Retrieves the search index entry filtered by visibility level.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `visibility` - The visibility level to filter by
    ///
    /// # Returns
    /// * `Ok(Some(SearchIndexEntry))` if campaign matches visibility
    /// * `Ok(None)` if campaign doesn't match visibility
    pub fn search_by_visibility(
        env: Env,
        visibility: Visibility,
    ) -> Result<Option<SearchIndexEntry>, ContractError> {
        let index: Option<SearchIndexEntry> = env
            .storage()
            .persistent()
            .get(&DataKey::SearchIndex);

        match index {
            Some(entry) if entry.visibility == visibility => Ok(Some(entry)),
            Some(_) => Ok(None),
            None => Ok(None),
        }
    }

    /// Retrieves the full search index entry for the campaign.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(Some(SearchIndexEntry))` if index exists
    /// * `Ok(None)` if index not yet created
    pub fn get_search_index(env: Env) -> Result<Option<SearchIndexEntry>, ContractError> {
        let index: Option<SearchIndexEntry> = env
            .storage()
            .persistent()
            .get(&DataKey::SearchIndex);
        Ok(index)
    }

    /// Clones a campaign with new creator and deadline.
    ///
    /// Allows a creator to clone an existing campaign's metadata and settings
    /// while resetting contribution data. The new campaign starts fresh with
    /// zero contributions.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `new_creator` - The new campaign creator's address (must authorize)
    /// * `new_goal` - The funding goal for the cloned campaign
    /// * `new_deadline` - The deadline for the cloned campaign
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotCreator)` if caller is not the original creator
    /// * `Err(ContractError::InvalidGoal)` if new_goal <= 0
    /// * `Err(ContractError::InvalidDeadline)` if new_deadline <= current time
    pub fn clone_campaign(
        env: Env,
        new_creator: Address,
        new_goal: i128,
        new_deadline: u64,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        if new_goal <= 0 {
            return Err(ContractError::InvalidGoal);
        }
        validate_goal_not_overflow(new_goal)?;
        if new_deadline <= env.ledger().timestamp() {
            return Err(ContractError::InvalidDeadline);
        }

        // Copy metadata from current campaign
        let title: String = inst.get(&KEY_TITLE).unwrap();
        let description: String = inst.get(&KEY_DESC).unwrap();
        let token: Address = inst.get(&KEY_TOKEN).unwrap();
        let min_contribution: i128 = inst.get(&KEY_MIN).unwrap();
        let max_contribution: i128 = inst.get(&KEY_MAX).unwrap_or(0);
        let category: Category = inst.get(&KEY_CATEGORY).unwrap();
        let social_links: Option<Vec<String>> = inst.get(&KEY_SOCIAL);
        let platform_config: Option<PlatformConfig> = inst.get(&KEY_PLATFORM);
        let vesting: Option<VestingSchedule> = inst.get(&KEY_VESTING);

        // Reset instance storage for new campaign
        // (Contributor indexed keys are per-address and naturally don't carry over;
        // ContributorCount reset to 0 is sufficient to clear the paginated list.)
        inst.set(&KEY_ADMIN, &new_creator);
        inst.set(&KEY_CREATOR, &new_creator);
        inst.set(&KEY_GOAL, &new_goal);
        inst.set(&KEY_DEADLINE, &new_deadline);
        inst.set(&KEY_TOTAL, &0i128);
        inst.set(&KEY_STATUS, &Status::Active);
        inst.set(&DataKey::ContributorCount, &0u32);
        inst.set(&DataKey::LargestContribution, &0i128);

        // Reset goal history
        let mut history: Vec<GoalAdjustment> = Vec::new(&env);
        history.push_back(GoalAdjustment {
            previous_goal: 0,
            new_goal,
            timestamp: env.ledger().timestamp(),
        });
        env.storage().persistent().set(&KEY_GOAL_HISTORY, &history);

        // Reset metadata version history
        let mut meta_hist: Vec<MetadataVersion> = Vec::new(&env);
        meta_hist.push_back(MetadataVersion {
            version: 0,
            title: title.clone(),
            description: description.clone(),
            timestamp: env.ledger().timestamp(),
        });
        env.storage().persistent().set(&KEY_META_HIST, &meta_hist);

        env.events().publish(
            ("campaign", "cloned"),
            EventCampaignCloned {
                original_creator: creator,
                new_creator,
                new_goal,
                new_deadline,
            },
        );
        Ok(())
    }

    // ── Issue #457: Contract Versioning ──────────────────────────────────────

    /// Returns the current contract version constant.
    pub fn contract_version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    /// Checks whether the on-chain stored version is compatible with the current binary.
    ///
    /// Emits `EventVersionChecked`. Returns `true` if compatible.
    pub fn check_version(env: Env) -> bool {
        let stored: u32 = env
            .storage()
            .instance()
            .get(&KEY_CONTRACT_VERSION)
            .unwrap_or(CONTRACT_VERSION);
        let compatible = stored >= storage::MIN_SUPPORTED_VERSION && stored <= CONTRACT_VERSION;
        env.events().publish(
            ("contract", "version_checked"),
            EventVersionChecked {
                current_version: CONTRACT_VERSION,
                expected_version: stored,
                compatible,
            },
        );
        compatible
    }

    /// Migrates the on-chain version record to the current binary version (admin only).
    ///
    /// Records the migration in persistent history and emits `EventContractMigrated`.
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if caller is not admin
    pub fn migrate_version(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        let from_version: u32 = inst.get(&KEY_CONTRACT_VERSION).unwrap_or(0);
        let now = env.ledger().timestamp();

        inst.set(&KEY_CONTRACT_VERSION, &CONTRACT_VERSION);

        let mut history: Vec<VersionMigration> = env
            .storage()
            .persistent()
            .get(&KEY_VERSION_HISTORY)
            .unwrap_or_else(|| Vec::new(&env));
        history.push_back(VersionMigration {
            from_version,
            to_version: CONTRACT_VERSION,
            timestamp: now,
        });
        env.storage().persistent().set(&KEY_VERSION_HISTORY, &history);
        env.storage().persistent().extend_ttl(&KEY_VERSION_HISTORY, 100, 100);

        env.events().publish(
            ("contract", "migrated"),
            EventContractMigrated {
                from_version,
                to_version: CONTRACT_VERSION,
                timestamp: now,
            },
        );
        Ok(())
    }

    /// Returns the full version migration history.
    pub fn get_version_history(env: Env) -> Vec<VersionMigration> {
        env.storage()
            .persistent()
            .get(&KEY_VERSION_HISTORY)
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ── Issue #458: State Validation ─────────────────────────────────────────

    /// Runs all state invariant checks and returns a validation result.
    ///
    /// Invariants checked:
    /// 1. `total_raised >= 0`
    /// 2. `goal > 0`
    /// 3. `deadline > 0`
    /// 4. `total_raised <= goal * 2` (sanity upper bound)
    /// 5. `contributor_count` is a valid u32 (always true, structural check)
    ///
    /// Emits `EventStateValidated` and `EventInvariantViolated` for each failure.
    pub fn validate_state(env: Env) -> StateValidationResult {
        let inst = env.storage().instance();
        let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        let goal: i128 = inst.get(&KEY_GOAL).unwrap_or(0);
        let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap_or(0);
        let contributor_count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);
        let now = env.ledger().timestamp();

        let mut passed = 0u32;
        let mut failed = 0u32;

        // Invariant 1: total_raised >= 0
        if total_raised >= 0 {
            passed += 1;
        } else {
            failed += 1;
            env.events().publish(
                ("contract", "invariant_violated"),
                EventInvariantViolated { invariant_id: 1, timestamp: now },
            );
        }

        // Invariant 2: goal > 0
        if goal > 0 {
            passed += 1;
        } else {
            failed += 1;
            env.events().publish(
                ("contract", "invariant_violated"),
                EventInvariantViolated { invariant_id: 2, timestamp: now },
            );
        }

        // Invariant 3: deadline > 0
        if deadline > 0 {
            passed += 1;
        } else {
            failed += 1;
            env.events().publish(
                ("contract", "invariant_violated"),
                EventInvariantViolated { invariant_id: 3, timestamp: now },
            );
        }

        // Invariant 4: total_raised <= goal * 2 (overflow-safe)
        let upper_bound = goal.saturating_mul(2);
        if total_raised <= upper_bound {
            passed += 1;
        } else {
            failed += 1;
            env.events().publish(
                ("contract", "invariant_violated"),
                EventInvariantViolated { invariant_id: 4, timestamp: now },
            );
        }

        // Invariant 5: contributor_count structural check (u32 is always >= 0)
        let _ = contributor_count;
        passed += 1;

        let result = StateValidationResult {
            valid: failed == 0,
            checks_passed: passed,
            checks_failed: failed,
            timestamp: now,
        };

        inst.set(&KEY_LAST_VALIDATION, &result);

        env.events().publish(
            ("contract", "state_validated"),
            EventStateValidated {
                valid: result.valid,
                checks_passed: passed,
                checks_failed: failed,
                timestamp: now,
            },
        );

        result
    }

    /// Returns the result of the last `validate_state` call, if any.
    pub fn get_last_validation(env: Env) -> Option<StateValidationResult> {
        env.storage().instance().get(&KEY_LAST_VALIDATION)
    }

    // ── Issue #459: Debugging Utilities ──────────────────────────────────────

    /// Takes a snapshot of the current contract state for debugging.
    ///
    /// Stores the snapshot in instance storage and emits `EventDebugSnapshot`.
    pub fn debug_snapshot(env: Env) -> ContractStateSnapshot {
        let inst = env.storage().instance();
        let now = env.ledger().timestamp();
        let snapshot = ContractStateSnapshot {
            version: CONTRACT_VERSION,
            status: inst.get(&KEY_STATUS).unwrap_or(Status::Active),
            total_raised: inst.get(&KEY_TOTAL).unwrap_or(0),
            goal: inst.get(&KEY_GOAL).unwrap_or(0),
            contributor_count: inst.get(&DataKey::ContributorCount).unwrap_or(0),
            deadline: inst.get(&KEY_DEADLINE).unwrap_or(0),
            timestamp: now,
        };

        inst.set(&KEY_DEBUG_SNAPSHOT, &snapshot);

        env.events().publish(
            ("debug", "snapshot"),
            EventDebugSnapshot {
                version: snapshot.version,
                status: snapshot.status.clone(),
                total_raised: snapshot.total_raised,
                contributor_count: snapshot.contributor_count,
                timestamp: now,
            },
        );

        snapshot
    }

    /// Returns the most recent debug snapshot, if any.
    pub fn get_debug_snapshot(env: Env) -> Option<ContractStateSnapshot> {
        env.storage().instance().get(&KEY_DEBUG_SNAPSHOT)
    }

    /// Emits a debug log event with a custom message (admin only).
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if caller is not admin
    pub fn debug_log(env: Env, message: String) -> Result<(), ContractError> {
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        let now = env.ledger().timestamp();
        env.events().publish(
            ("debug", "log"),
            EventDebugLog { message, timestamp: now },
        );
        Ok(())
    }

    /// Inspects the contribution balance for a specific address (admin only).
    ///
    /// Returns the stored contribution amount without requiring contributor auth.
    pub fn inspect_contribution(env: Env, contributor: Address) -> Result<i128, ContractError> {
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(0))
    }

    // ── Issue #460: Performance Monitoring ───────────────────────────────────

    /// Sets the performance alert threshold in milliseconds (admin only).
    ///
    /// When a recorded execution duration exceeds this threshold, an
    /// `EventPerfAlert` is emitted. Set to 0 to disable alerting.
    pub fn set_perf_threshold(env: Env, threshold_ms: u64) -> Result<(), ContractError> {
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        env.storage().instance().set(&KEY_PERF_THRESHOLD, &threshold_ms);
        Ok(())
    }

    /// Returns the current performance alert threshold in milliseconds.
    pub fn get_perf_threshold(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&KEY_PERF_THRESHOLD)
            .unwrap_or(0)
    }

    /// Records an execution time observation for a named function (admin only).
    ///
    /// Updates the per-function `FunctionPerfStats` in persistent storage and
    /// emits `EventExecutionRecorded`. If the duration exceeds the configured
    /// threshold, also emits `EventPerfAlert`.
    pub fn record_execution(
        env: Env,
        function_name: String,
        duration_ms: u64,
    ) -> Result<(), ContractError> {
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        let now = env.ledger().timestamp();
        let stats_key = DataKey::PerfStats(function_name.clone());

        let mut stats: FunctionPerfStats = env
            .storage()
            .persistent()
            .get(&stats_key)
            .unwrap_or(FunctionPerfStats {
                call_count: 0,
                total_duration_ms: 0,
                max_duration_ms: 0,
            });

        stats.call_count += 1;
        stats.total_duration_ms = stats.total_duration_ms.saturating_add(duration_ms);
        if duration_ms > stats.max_duration_ms {
            stats.max_duration_ms = duration_ms;
        }

        env.storage().persistent().set(&stats_key, &stats);
        env.storage().persistent().extend_ttl(&stats_key, 100, 100);

        env.events().publish(
            ("perf", "execution_recorded"),
            EventExecutionRecorded {
                function_name: function_name.clone(),
                duration_ms,
                timestamp: now,
            },
        );

        // Alert if threshold is set and exceeded
        let threshold: u64 = env
            .storage()
            .instance()
            .get(&KEY_PERF_THRESHOLD)
            .unwrap_or(0);
        if threshold > 0 && duration_ms > threshold {
            env.events().publish(
                ("perf", "alert"),
                EventPerfAlert {
                    function_name,
                    duration_ms,
                    threshold_ms: threshold,
                    timestamp: now,
                },
            );
        }

        Ok(())
    }

    /// Returns the performance stats for a named function.
    pub fn get_perf_stats(env: Env, function_name: String) -> Option<FunctionPerfStats> {
        env.storage()
            .persistent()
            .get(&DataKey::PerfStats(function_name))
    }

    // ── Issue #436: Campaign Milestones ───────────────────────────────────────

    /// Sets up milestones for the campaign.
    ///
    /// Only the creator can call this function. Milestones define target amounts
    /// that trigger fund releases when reached and verified.
    pub fn set_milestones(env: Env, milestones: Vec<Milestone>) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).ok_or(ContractError::NotCreator)?;
        creator.require_auth();

        if milestones.len() > storage::MAX_MILESTONES {
            return Err(ContractError::InvalidGoal);
        }

        env.storage().persistent().set(&KEY_MILESTONES, &milestones);
        Ok(())
    }

    /// Gets all milestones for the campaign.
    pub fn get_milestones(env: Env) -> Result<Vec<Milestone>, ContractError> {
        env.storage()
            .persistent()
            .get(&KEY_MILESTONES)
            .ok_or(ContractError::MilestoneNotFound)
    }

    /// Verifies a milestone has been reached and releases funds accordingly.
    ///
    /// Only the creator can call this function. Verifies that the milestone
    /// amount has been reached and marks it as verified for fund release.
    pub fn verify_milestone(env: Env, milestone_index: u32) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).ok_or(ContractError::NotCreator)?;
        creator.require_auth();

        let mut milestones: Vec<Milestone> = env
            .storage()
            .persistent()
            .get(&KEY_MILESTONES)
            .ok_or(ContractError::MilestoneNotFound)?;

        if milestone_index >= milestones.len() {
            return Err(ContractError::MilestoneNotFound);
        }

        // Bounds are checked above; use typed access rather than a panicking unwrap
        // so an out-of-range index surfaces as a ContractError, not a host panic.
        let mut milestone = milestones
            .get(milestone_index)
            .ok_or(ContractError::MilestoneNotFound)?;

        let total_raised: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap_or(0);
        if total_raised < milestone.amount {
            return Err(ContractError::GoalNotReached);
        }

        if milestone.reached {
            return Err(ContractError::MilestoneAlreadyReached);
        }

        milestone.reached = true;
        milestones.set(milestone_index, milestone);
        env.storage().persistent().set(&KEY_MILESTONES, &milestones);

        env.events().publish(
            ("campaign", "milestone_verified"),
            EventMilestoneVerified {
                milestone_index,
                timestamp: env.ledger().timestamp(),
            },
        );
        Ok(())
    }

    // ── Issue #437: Contribution Verification ─────────────────────────────────

    /// Updates the verification status of a contributor.
    ///
    /// Only the creator can call this function. Sets the KYC/AML verification
    /// status for a contributor address.
    pub fn update_verification(
        env: Env,
        contributor: Address,
        status: VerificationStatus,
    ) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).ok_or(ContractError::NotCreator)?;
        creator.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Contribution(contributor.clone()), &status);

        env.events().publish(
            ("campaign", "verification_updated"),
            EventVerificationUpdated {
                contributor,
                status,
                timestamp: env.ledger().timestamp(),
            },
        );
        Ok(())
    }

    /// Gets the verification status of a contributor.
    pub fn get_verification(env: Env, contributor: Address) -> VerificationStatus {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(VerificationStatus::Unverified)
    }

    // ── Issue #438: Campaign Analytics ────────────────────────────────────────

    /// Generates analytics for the campaign.
    ///
    /// Calculates and returns detailed analytics including contribution patterns,
    /// velocity, and statistical measures.
    pub fn get_analytics(env: Env) -> Result<CampaignAnalytics, ContractError> {
        let total_raised: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap_or(0);
        let contributor_count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::ContributorCount)
            .unwrap_or(0);

        if contributor_count == 0 {
            return Err(ContractError::AnalyticsNotAvailable);
        }

        let average_contribution = total_raised / contributor_count as i128;
        let peak_contribution: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::LargestContribution)
            .unwrap_or(0);

        let start_time: u64 = env.storage().instance().get(&KEY_START_TIME).unwrap_or(0);
        let current_time = env.ledger().timestamp();
        let elapsed_seconds = if current_time > start_time {
            current_time - start_time
        } else {
            1
        };
        let elapsed_days = (elapsed_seconds / 86400).max(1);
        let contribution_velocity = total_raised / elapsed_days as i128;

        Ok(CampaignAnalytics {
            total_contributions: contributor_count,
            average_contribution,
            median_contribution: average_contribution,
            std_deviation: 0,
            peak_contribution,
            lowest_contribution: 0,
            contribution_velocity,
            data_points_count: 0,
        })
    }

    // ── Issue #439: Dispute Resolution ────────────────────────────────────────

    /// Files a new dispute for the campaign.
    ///
    /// Any contributor can file a dispute. Returns the dispute ID.
    pub fn file_dispute(
        env: Env,
        filer: Address,
        description: String,
    ) -> Result<u32, ContractError> {
        filer.require_auth();

        let mut dispute_id: u32 = env
            .storage()
            .persistent()
            .get(&KEY_DISPUTE_ID)
            .unwrap_or(0);
        dispute_id += 1;

        let dispute = Dispute {
            id: dispute_id,
            filer: filer.clone(),
            description,
            status: DisputeStatus::Filed,
            filed_at: env.ledger().timestamp(),
            resolved_at: 0,
            votes_for: 0,
            votes_against: 0,
        };

        let mut disputes: Vec<Dispute> = env
            .storage()
            .persistent()
            .get(&KEY_DISPUTES)
            .unwrap_or_else(|| Vec::new(&env));
        disputes.push_back(dispute);

        env.storage().persistent().set(&KEY_DISPUTES, &disputes);
        env.storage().persistent().set(&KEY_DISPUTE_ID, &dispute_id);

        env.events().publish(
            ("campaign", "dispute_filed"),
            EventDisputeFiled {
                dispute_id,
                filer,
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(dispute_id)
    }

    /// Votes on a dispute.
    ///
    /// Contributors can vote on disputes. Vote weight is based on their contribution amount.
    pub fn vote_on_dispute(
        env: Env,
        voter: Address,
        dispute_id: u32,
        in_favor: bool,
    ) -> Result<(), ContractError> {
        voter.require_auth();
        let vote_weight: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(voter.clone()))
            .unwrap_or(0);

        if vote_weight == 0 {
            return Err(ContractError::Unauthorized);
        }

        let mut disputes: Vec<Dispute> = env
            .storage()
            .persistent()
            .get(&KEY_DISPUTES)
            .ok_or(ContractError::DisputeNotFound)?;

        let mut dispute_found = false;
        for i in 0..disputes.len() {
            let mut dispute = disputes.get(i).ok_or(ContractError::DisputeNotFound)?;
            if dispute.id == dispute_id {
                if dispute.status != DisputeStatus::Filed && dispute.status != DisputeStatus::InReview {
                    return Err(ContractError::DisputeVotingEnded);
                }

                if in_favor {
                    dispute.votes_for += vote_weight;
                } else {
                    dispute.votes_against += vote_weight;
                }
                dispute.status = DisputeStatus::InReview;
                disputes.set(i, dispute);
                dispute_found = true;
                break;
            }
        }

        if !dispute_found {
            return Err(ContractError::DisputeNotFound);
        }

        env.storage().persistent().set(&KEY_DISPUTES, &disputes);

        env.events().publish(
            ("campaign", "dispute_voted"),
            EventDisputeVoted {
                dispute_id,
                voter,
                vote_weight,
                in_favor,
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    /// Resolves a dispute based on voting results.
    ///
    /// Only the creator can call this function. Resolves the dispute and
    /// determines the outcome based on votes.
    pub fn resolve_dispute(env: Env, dispute_id: u32) -> Result<(), ContractError> {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).ok_or(ContractError::NotCreator)?;
        creator.require_auth();

        let mut disputes: Vec<Dispute> = env
            .storage()
            .persistent()
            .get(&KEY_DISPUTES)
            .ok_or(ContractError::DisputeNotFound)?;

        let mut dispute_found = false;
        for i in 0..disputes.len() {
            let mut dispute = disputes.get(i).ok_or(ContractError::DisputeNotFound)?;
            if dispute.id == dispute_id {
                let status = if dispute.votes_for > dispute.votes_against {
                    DisputeStatus::ResolvedInFavor
                } else if dispute.votes_against > dispute.votes_for {
                    DisputeStatus::ResolvedAgainst
                } else {
                    DisputeStatus::Dismissed
                };

                dispute.status = status;
                dispute.resolved_at = env.ledger().timestamp();
                disputes.set(i, dispute.clone());
                dispute_found = true;

                env.events().publish(
                    ("campaign", "dispute_resolved"),
                    EventDisputeResolved {
                        dispute_id,
                        status,
                        votes_for: dispute.votes_for,
                        votes_against: dispute.votes_against,
                        timestamp: env.ledger().timestamp(),
                    },
                );
                break;
            }
        }

        if !dispute_found {
            return Err(ContractError::DisputeNotFound);
        }

        env.storage().persistent().set(&KEY_DISPUTES, &disputes);
        Ok(())
    }

    /// Gets a dispute by ID.
    pub fn get_dispute(env: Env, dispute_id: u32) -> Result<Dispute, ContractError> {
        let disputes: Vec<Dispute> = env
            .storage()
            .persistent()
            .get(&KEY_DISPUTES)
            .ok_or(ContractError::DisputeNotFound)?;

        for dispute in disputes.iter() {
            if dispute.id == dispute_id {
                return Ok(dispute.clone());
            }
        }

        Err(ContractError::DisputeNotFound)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multi-Sig Governance Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// Initializes multi-sig governance for platform configuration changes.
    ///
    /// Sets the governance configuration including the list of authorized governors,
    /// minimum approvals required, and timelock delay. Can only be called by the
    /// contract admin on an uninitialized governance.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governors` - List of authorized governor addresses
    /// * `required_approvals` - Minimum number of approvals required (must be 1 ≤ n ≤ governors.len())
    /// * `timelock_delay` - Timelock delay in seconds (minimum 3600)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::AlreadyInitialized)` if governance already configured
    /// * `Err(ContractError::Unauthorized)` if parameters are invalid
    pub fn initialize_governance(
        env: Env,
        governors: Vec<Address>,
        required_approvals: u32,
        timelock_delay: u64,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        if inst.has(&KEY_GOVERNANCE_CONFIG) {
            return Err(ContractError::AlreadyInitialized);
        }

        validate_governance_config(required_approvals, governors.len(), timelock_delay)?;

        let config = GovernanceConfig {
            governors,
            required_approvals,
            timelock_delay,
        };
        inst.set(&KEY_GOVERNANCE_CONFIG, &config);
        inst.set(&KEY_GOVERNANCE_NONCE, &0u32);

        env.events().publish(
            ("governance", "config_updated"),
            EventGovernanceConfigUpdated {
                required_approvals,
                governor_count: config.governors.len(),
                timelock_delay,
            },
        );
        Ok(())
    }

    /// Proposes a platform configuration update.
    ///
    /// Creates a new governance proposal to change the platform fee address
    /// and/or fee basis points. The proposer must be a designated governor.
    /// Voting lasts for 7 days from creation.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `proposer` - The governor creating the proposal (must authorize)
    /// * `platform_address` - Proposed new platform fee recipient address
    /// * `platform_fee_bps` - Proposed new platform fee in basis points
    ///
    /// # Returns
    /// * `Ok(u32)` - The proposal nonce on success
    /// * `Err(ContractError::GovernanceNotGovernor)` if proposer is not a governor
    pub fn propose_platform_update(
        env: Env,
        proposer: Address,
        platform_address: Address,
        platform_fee_bps: u32,
    ) -> Result<u32, ContractError> {
        proposer.require_auth();
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        if !config.governors.contains(&proposer) {
            return Err(ContractError::GovernanceNotGovernor);
        }

        validate_fee_bps(platform_fee_bps)?;

        let nonce: u32 = inst.get(&KEY_GOVERNANCE_NONCE).unwrap_or(0);
        let new_nonce = nonce + 1;
        let now = env.ledger().timestamp();

        let proposal = GovernanceProposal {
            nonce: new_nonce,
            proposer: proposer.clone(),
            platform_address: platform_address.clone(),
            platform_fee_bps,
            created_at: now,
            voting_ends_at: now + 604800, // 7 days
            approvals: 0,
            timelock_until: 0,
            executed: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::GovernanceProposal(new_nonce), &proposal);
        inst.set(&KEY_GOVERNANCE_NONCE, &new_nonce);

        env.events().publish(
            ("governance", "proposed"),
            EventGovernanceProposed {
                nonce: new_nonce,
                proposer,
                platform_address,
                platform_fee_bps,
                voting_ends_at: proposal.voting_ends_at,
            },
        );
        Ok(new_nonce)
    }

    /// Votes on a governance proposal.
    ///
    /// Governors cast approval votes on a pending proposal. When the required
    /// number of approvals is met, the proposal enters the timelock period.
    /// Voting is idempotent — a second vote from the same governor is a no-op.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governor` - The governor casting the vote (must authorize)
    /// * `proposal_nonce` - Nonce of the proposal to vote on
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::GovernanceProposalNotFound)` if proposal doesn't exist
    /// * `Err(ContractError::GovernanceVotingEnded)` if voting period has ended
    /// * `Err(ContractError::GovernanceAlreadyVoted)` if already voted
    /// * `Err(ContractError::GovernanceNotGovernor)` if governor is not a governor
    pub fn vote_on_proposal(
        env: Env,
        governor: Address,
        proposal_nonce: u32,
    ) -> Result<(), ContractError> {
        governor.require_auth();
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        if !config.governors.contains(&governor) {
            return Err(ContractError::GovernanceNotGovernor);
        }

        let mut proposal: GovernanceProposal = env
            .storage()
            .persistent()
            .get(&DataKey::GovernanceProposal(proposal_nonce))
            .ok_or(ContractError::GovernanceProposalNotFound)?;

        if proposal.executed {
            return Err(ContractError::GovernanceAlreadyExecuted);
        }

        if env.ledger().timestamp() > proposal.voting_ends_at {
            return Err(ContractError::GovernanceVotingEnded);
        }

        // Idempotency check
        let vote_key = DataKey::GovernanceVote(proposal_nonce, governor.clone());
        let has_voted: bool = env
            .storage()
            .persistent()
            .get(&vote_key)
            .unwrap_or(false);
        if has_voted {
            return Err(ContractError::GovernanceAlreadyVoted);
        }

        env.storage()
            .persistent()
            .set(&vote_key, &true);

        proposal.approvals = proposal
            .approvals
            .checked_add(1)
            .ok_or(ContractError::Overflow)?;

        // If threshold met, start timelock
        if proposal.approvals >= config.required_approvals && proposal.timelock_until == 0 {
            proposal.timelock_until =
                env.ledger().timestamp() + config.timelock_delay;
        }

        env.storage()
            .persistent()
            .set(&DataKey::GovernanceProposal(proposal_nonce), &proposal);

        env.events().publish(
            ("governance", "voted"),
            EventGovernanceVoted {
                nonce: proposal_nonce,
                governor,
                approvals: proposal.approvals,
                required: config.required_approvals,
            },
        );
        Ok(())
    }

    /// Executes a governance proposal after voting and timelock have completed.
    ///
    /// Updates the platform configuration to the proposed values. Anyone may
    /// call this once the timelock has expired.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `proposal_nonce` - Nonce of the proposal to execute
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::GovernanceProposalNotFound)` if proposal doesn't exist
    /// * `Err(ContractError::GovernanceAlreadyExecuted)` if already executed
    /// * `Err(ContractError::GovernanceNotEnoughApprovals)` if threshold not met
    /// * `Err(ContractError::GovernanceTimelockPending)` if timelock not expired
    pub fn execute_proposal(env: Env, proposal_nonce: u32) -> Result<(), ContractError> {
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        let mut proposal: GovernanceProposal = env
            .storage()
            .persistent()
            .get(&DataKey::GovernanceProposal(proposal_nonce))
            .ok_or(ContractError::GovernanceProposalNotFound)?;

        if proposal.executed {
            return Err(ContractError::GovernanceAlreadyExecuted);
        }

        if proposal.approvals < config.required_approvals {
            return Err(ContractError::GovernanceNotEnoughApprovals);
        }

        if env.ledger().timestamp() < proposal.timelock_until {
            return Err(ContractError::GovernanceTimelockPending);
        }

        // Execute: update platform config
        let platform = PlatformConfig {
            address: proposal.platform_address.clone(),
            fee_bps: proposal.platform_fee_bps,
            fee_mode: FeeMode::OnSuccess,
        };
        inst.set(&KEY_PLATFORM, &platform);

        proposal.executed = true;
        env.storage()
            .persistent()
            .set(&DataKey::GovernanceProposal(proposal_nonce), &proposal);

        env.events().publish(
            ("governance", "executed"),
            EventGovernanceExecuted {
                nonce: proposal_nonce,
                platform_address: proposal.platform_address,
                platform_fee_bps: proposal.platform_fee_bps,
            },
        );
        Ok(())
    }

    /// Emergency pauses all contract operations via multi-sig governance.
    ///
    /// Requires a majority (>50%) of governors to approve within a single
    /// transaction window. Sets the emergency pause flag which blocks all
    /// mutative operations.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governor` - The governor requesting the pause (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::GovernanceNotGovernor)` if caller is not a governor
    pub fn emergency_pause(env: Env, governor: Address) -> Result<(), ContractError> {
        governor.require_auth();
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        if !config.governors.contains(&governor) {
            return Err(ContractError::GovernanceNotGovernor);
        }

        // Track approvals for this emergency pause
        let approval_key = DataKey::EmergencyPauseApproval(governor.clone());
        let already_approved: bool = env
            .storage()
            .persistent()
            .get(&approval_key)
            .unwrap_or(false);
        if already_approved {
            return Ok(());
        }

        env.storage()
            .persistent()
            .set(&approval_key, &true);

        let count: u32 = inst.get(&DataKey::EmergencyPauseApprovals).unwrap_or(0);
        let new_count = count + 1;
        inst.set(&DataKey::EmergencyPauseApprovals, &new_count);

        // Trigger pause when majority approves
        if new_count > config.governors.len() / 2 {
            inst.set(&KEY_EMERGENCY_PAUSE, &true);
            env.events().publish(
                ("governance", "emergency_paused"),
                EventGovernanceEmergencyPaused {
                    timestamp: env.ledger().timestamp(),
                },
            );
        }
        Ok(())
    }

    /// Resumes contract operations after emergency pause via multi-sig governance.
    ///
    /// Requires a majority (>50%) of governors to approve.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governor` - The governor requesting the resume (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::GovernanceNotGovernor)` if caller is not a governor
    pub fn emergency_resume(env: Env, governor: Address) -> Result<(), ContractError> {
        governor.require_auth();
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        if !config.governors.contains(&governor) {
            return Err(ContractError::GovernanceNotGovernor);
        }

        let approval_key = DataKey::EmergencyPauseApproval(governor.clone());
        let already_approved: bool = env
            .storage()
            .persistent()
            .get(&approval_key)
            .unwrap_or(false);
        if already_approved {
            return Ok(());
        }

        env.storage()
            .persistent()
            .set(&approval_key, &true);

        let count: u32 = inst.get(&DataKey::EmergencyPauseApprovals).unwrap_or(0);
        let new_count = count + 1;
        inst.set(&DataKey::EmergencyPauseApprovals, &new_count);

        // Resume when majority approves
        if new_count > config.governors.len() / 2 {
            inst.set(&KEY_EMERGENCY_PAUSE, &false);
            env.events().publish(
                ("governance", "emergency_resumed"),
                EventGovernanceEmergencyResumed {
                    timestamp: env.ledger().timestamp(),
                },
            );
        }
        Ok(())
    }

    /// Updates the governance configuration.
    ///
    /// Can only be called by the contract admin. Enables changing the governor
    /// set, required approvals, and timelock delay after initial setup.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governors` - New list of authorized governor addresses
    /// * `required_approvals` - New minimum approvals required
    /// * `timelock_delay` - New timelock delay in seconds
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if parameters are invalid
    pub fn update_governance_config(
        env: Env,
        governors: Vec<Address>,
        required_approvals: u32,
        timelock_delay: u64,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        validate_governance_config(required_approvals, governors.len(), timelock_delay)?;

        let config = GovernanceConfig {
            governors,
            required_approvals,
            timelock_delay,
        };
        inst.set(&KEY_GOVERNANCE_CONFIG, &config);

        env.events().publish(
            ("governance", "config_updated"),
            EventGovernanceConfigUpdated {
                required_approvals,
                governor_count: config.governors.len(),
                timelock_delay,
            },
        );
        Ok(())
    }

    /// Returns the current governance configuration.
    pub fn get_governance_config(env: Env) -> Option<GovernanceConfig> {
        env.storage().instance().get(&KEY_GOVERNANCE_CONFIG)
    }

    /// Returns a governance proposal by nonce.
    pub fn get_proposal(env: Env, proposal_nonce: u32) -> Option<GovernanceProposal> {
        env.storage()
            .persistent()
            .get(&DataKey::GovernanceProposal(proposal_nonce))
    }

    /// Returns whether the contract is emergency paused by governance.
    pub fn is_emergency_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&KEY_EMERGENCY_PAUSE)
            .unwrap_or(false)
    }

    // ── DeFi: Yield Generation ────────────────────────────────────────────────

    /// Configures a yield reward pool for the campaign.
    ///
    /// The creator deposits `pool` units of `reward_token` into the contract.
    /// Contributors can then claim yield proportional to their contribution share,
    /// accrued linearly over the campaign period at `rate_bps` annually.
    ///
    /// # Arguments
    /// * `reward_token` - Token address for yield payouts
    /// * `pool` - Total reward tokens to deposit (transferred from creator)
    /// * `rate_bps` - Annual yield rate in basis points (e.g. 500 = 5%)
    ///
    /// # Errors
    /// * `NotCreator` — caller is not the campaign creator
    /// * `NotActive` — campaign is not active
    /// * `AmountNotPositive` — pool or rate is zero
    /// * `InvalidFee` — rate_bps > 10_000
    pub fn configure_yield(
        env: Env,
        reward_token: Address,
        pool: i128,
        rate_bps: u32,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        validate_positive_amount(pool)?;
        if rate_bps == 0 || rate_bps > 10_000 {
            return Err(ContractError::InvalidFee);
        }

        // Transfer reward pool from creator into the contract
        token::Client::new(&env, &reward_token).transfer(
            &creator,
            &env.current_contract_address(),
            &pool,
        );

        let start_time: u64 = inst.get(&KEY_START_TIME).unwrap_or_else(|| env.ledger().timestamp());
        let config = YieldConfig { reward_token: reward_token.clone(), pool, rate_bps, start_time };
        inst.set(&KEY_YIELD_CONFIG, &config);
        inst.set(&KEY_YIELD_TOTAL, &0i128);

        env.events().publish(
            ("defi", "yield_configured"),
            EventYieldConfigured { reward_token, pool, rate_bps },
        );
        Ok(())
    }

    /// Claims accrued yield for the calling contributor.
    ///
    /// Yield accrues linearly over time, proportional to the contributor's share
    /// of total contributions. Callable by any contributor at any time while the
    /// yield pool has remaining balance.
    ///
    /// # Errors
    /// * `NoRewardsConfigured` — yield not configured
    /// * `InsufficientFunds` — pool exhausted
    pub fn claim_yield(env: Env, contributor: Address) -> Result<i128, ContractError> {
        contributor.require_auth();

        let inst = env.storage().instance();
        let config: YieldConfig = inst
            .get(&KEY_YIELD_CONFIG)
            .ok_or(ContractError::NoRewardsConfigured)?;

        let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        if total_raised == 0 {
            return Ok(0);
        }

        let contrib_amount: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(contributor.clone()))
            .unwrap_or(0);
        if contrib_amount == 0 {
            return Ok(0);
        }

        let now = env.ledger().timestamp();
        // Seconds elapsed since yield started (capped at 1 year)
        let elapsed = now.saturating_sub(config.start_time).min(365 * 24 * 3600);

        // Proportional share: contributor_amount / total_raised
        // Accrued = pool * rate_bps/10000 * (elapsed / seconds_per_year) * share
        // Use i128 arithmetic; scale by 1e9 to preserve precision
        let seconds_per_year: i128 = 365 * 24 * 3600;
        let share_numerator = contrib_amount;
        let accrued = config.pool
            .checked_mul(config.rate_bps as i128).ok_or(ContractError::Overflow)?
            .checked_mul(elapsed as i128).ok_or(ContractError::Overflow)?
            .checked_mul(share_numerator).ok_or(ContractError::Overflow)?
            / (10_000 * seconds_per_year * total_raised);

        let yield_key = DataKey::YieldInfo(contributor.clone());
        let info: YieldInfo = env
            .storage()
            .persistent()
            .get(&yield_key)
            .unwrap_or(YieldInfo { claimed: 0, reward_debt: 0 });

        let claimable = accrued.saturating_sub(info.claimed);
        if claimable <= 0 {
            return Ok(0);
        }

        let distributed: i128 = inst.get(&KEY_YIELD_TOTAL).unwrap_or(0);
        let remaining = config.pool.saturating_sub(distributed);
        if remaining <= 0 {
            return Err(ContractError::InsufficientFunds);
        }
        let payout = claimable.min(remaining);

        // Update accounting
        env.storage().persistent().set(
            &yield_key,
            &YieldInfo { claimed: info.claimed + payout, reward_debt: accrued },
        );
        inst.set(&KEY_YIELD_TOTAL, &(distributed + payout));

        // Transfer yield tokens to contributor
        token::Client::new(&env, &config.reward_token).transfer(
            &env.current_contract_address(),
            &contributor,
            &payout,
        );

        env.events().publish(
            ("defi", "yield_claimed"),
            EventYieldClaimed { contributor, amount: payout },
        );
        Ok(payout)
    }

    /// Returns the yield configuration, if set.
    pub fn get_yield_config(env: Env) -> Option<YieldConfig> {
        env.storage().instance().get(&KEY_YIELD_CONFIG)
    }

    /// Returns accrued (unclaimed) yield for a contributor.
    pub fn pending_yield(env: Env, contributor: Address) -> i128 {
        let inst = env.storage().instance();
        let config: YieldConfig = match inst.get(&KEY_YIELD_CONFIG) {
            Some(c) => c,
            None => return 0,
        };
        let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        if total_raised == 0 {
            return 0;
        }
        let contrib_amount: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(contributor.clone()))
            .unwrap_or(0);
        if contrib_amount == 0 {
            return 0;
        }

        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(config.start_time).min(365 * 24 * 3600);
        let seconds_per_year: i128 = 365 * 24 * 3600;

        let accrued = config.pool
            .saturating_mul(config.rate_bps as i128)
            .saturating_mul(elapsed as i128)
            .saturating_mul(contrib_amount)
            / (10_000 * seconds_per_year * total_raised);

        let info: YieldInfo = env
            .storage()
            .persistent()
            .get(&DataKey::YieldInfo(contributor))
            .unwrap_or(YieldInfo { claimed: 0, reward_debt: 0 });

        accrued.saturating_sub(info.claimed).max(0)
    }

    // ── Issue #694: Soft-cap / stretch-goal ──────────────────────────────────

    /// Sets the soft cap and stretch goal for the campaign (creator only).
    ///
    /// - `soft_cap`: minimum viable funding target; campaign succeeds at this amount.
    ///   Pass 0 to leave unset (falls back to the hard goal).
    /// - `stretch_goal`: over-funding target tracked separately.
    ///   Pass 0 to leave unset.
    ///
    /// Must be called while the campaign is `Active`.
    pub fn set_caps(
        env: Env,
        soft_cap: i128,
        stretch_goal: i128,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = inst.get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        if soft_cap < 0 || stretch_goal < 0 {
            return Err(ContractError::InvalidGoal);
        }
        let goal: i128 = inst.get(&KEY_GOAL).unwrap();
        // soft_cap must not exceed the hard goal; stretch_goal must be >= goal
        if soft_cap > 0 && soft_cap > goal {
            return Err(ContractError::InvalidGoal);
        }
        if stretch_goal > 0 && stretch_goal < goal {
            return Err(ContractError::InvalidGoal);
        }

        inst.set(&KEY_SOFT_CAP, &soft_cap);
        inst.set(&KEY_STRETCH_GOAL, &stretch_goal);

        env.events().publish(
            ("campaign", "caps_configured"),
            EventCapsConfigured { soft_cap, stretch_goal },
        );
        Ok(())
    }

    // ── Issue #695: Track released amount; refund only unreleased on cancel ──

    /// Records that `amount` stroops have been released to the creator
    /// (e.g. via a milestone payout). Admin/creator only.
    ///
    /// This is called internally by milestone-release logic so that
    /// `refund_single` knows how much has already left the contract.
    pub fn record_release(env: Env, amount: i128) -> Result<(), ContractError> {
        if amount <= 0 {
            return Err(ContractError::AmountNotPositive);
        }
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        let released: i128 = inst.get(&KEY_RELEASED).unwrap_or(0);
        let new_released = released.checked_add(amount).ok_or(ContractError::Overflow)?;
        inst.set(&KEY_RELEASED, &new_released);
        Ok(())
    }

    /// Returns the total amount already released to the creator.
    pub fn released_amount(env: Env) -> i128 {
        env.storage().instance().get(&KEY_RELEASED).unwrap_or(0)
    }

    // ── Issue #696: Timelocked pause ─────────────────────────────────────────

    /// Sets the timelock duration (in seconds) that must elapse after pausing
    /// before the campaign can be unpaused. Admin only.
    ///
    /// Set to 0 to disable the timelock (instant unpause allowed).
    pub fn set_pause_timelock(env: Env, timelock_seconds: u64) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin: Address = inst.get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        inst.set(&KEY_PAUSE_TIMELOCK, &timelock_seconds);
        Ok(())
    }

    // ── Issue #697: Allow/deny list (clean API over whitelist/blacklist) ──────

    /// Adds an address to the allow list (admin only).
    ///
    /// Alias for `add_to_whitelist` with a dedicated event so indexers can
    /// distinguish the two APIs.
    pub fn add_to_allowlist(env: Env, address: Address) -> Result<(), ContractError> {
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Whitelist(address.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Whitelist(address.clone()), 100, 100);
        env.events()
            .publish(("campaign", "allowlisted"), EventAllowlisted { address });
        Ok(())
    }

    /// Removes an address from the allow list (admin only).
    pub fn remove_from_allowlist(env: Env, address: Address) -> Result<(), ContractError> {
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        env.storage()
            .persistent()
            .remove(&DataKey::Whitelist(address.clone()));
        env.events().publish(
            ("campaign", "allowlist_removed"),
            EventAllowlistRemoved { address },
        );
        Ok(())
    }

    /// Adds an address to the deny list (admin only).
    ///
    /// Alias for `add_to_blacklist` with a dedicated event.
    pub fn add_to_denylist(env: Env, address: Address) -> Result<(), ContractError> {
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Blacklist(address.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Blacklist(address.clone()), 100, 100);
        env.events()
            .publish(("campaign", "denylisted"), EventDenylisted { address });
        Ok(())
    }

    /// Removes an address from the deny list (admin only).
    pub fn remove_from_denylist(env: Env, address: Address) -> Result<(), ContractError> {
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        env.storage()
            .persistent()
            .remove(&DataKey::Blacklist(address.clone()));
        env.events().publish(
            ("campaign", "denylist_removed"),
            EventDenylistRemoved { address },
        );
        Ok(())
    }

    /// Returns `true` if the address is on the allow list.
    pub fn is_allowlisted(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::Whitelist(address))
            .unwrap_or(false)
    }

    /// Returns `true` if the address is on the deny list.
    pub fn is_denylisted(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::Blacklist(address))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod test;
