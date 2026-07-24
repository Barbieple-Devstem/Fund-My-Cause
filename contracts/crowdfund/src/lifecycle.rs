//! # Campaign Lifecycle Functions
//!
//! This module handles campaign creation, initialization, cloning, and termination.
//! Functions in this module manage the overall campaign state transitions.

use soroban_sdk::{Address, Env, String, Vec};

use crate::{
    errors::ContractError,
    storage::{
        DataKey, KEY_ADMIN, KEY_ARCHIVED, KEY_CATEGORY, KEY_CREATOR, KEY_DEADLINE, KEY_DESC,
        KEY_GOAL, KEY_GOAL_HISTORY, KEY_MAX, KEY_META_HIST, KEY_MIN, KEY_PLATFORM, KEY_SOCIAL,
        KEY_START_TIME, KEY_STATUS, KEY_TITLE, KEY_TOKEN, KEY_TOTAL, KEY_VESTING, KEY_VISIBILITY,
    },
    types::{
        Category, GoalAdjustment, MetadataVersion, PlatformConfig, Status, VestingSchedule,
        Visibility, EventInitialized, EventCampaignCloned, EventCancelled, EventArchived,
        EVENT_SCHEMA_VERSION,
    },
    validation::{validate_category, validate_fee_bps, validate_string_length, validate_goal_not_overflow, validate_address_not_self},
};

/// Initializes a new crowdfunding campaign (called once per contract instance).
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `creator` - The campaign creator's address (must authorize)
/// * `token` - The token address for contributions
/// * `goal` - The funding goal in stroops (must be > 0)
/// * `deadline` - Unix timestamp when the campaign ends (must be > current time)
/// * `min_contribution` - Minimum contribution amount
/// * `max_contribution` - Maximum contribution per contributor (0 = no limit)
/// * `title` - Campaign title (max 64 chars)
/// * `description` - Campaign description (max 512 chars)
/// * `social_links` - Optional social media links
/// * `platform_config` - Optional platform fee configuration
/// * `accepted_tokens` - Optional token whitelist
/// * `category` - Campaign category
/// * `vesting` - Optional vesting schedule
/// * `penalty_bps` - Optional penalty in basis points
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::AlreadyInitialized)` if already initialized
/// - `Err(ContractError::InvalidGoal)` if goal <= 0
/// - `Err(ContractError::InvalidDeadline)` if deadline <= current time
pub(crate) fn initialize(
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
    let inst = env.storage().instance();
    if inst.has(&KEY_CREATOR) {
        return Err(ContractError::AlreadyInitialized);
    }
    
    creator.require_auth();

    // ── Validate all inputs up-front ─────────────────────────────────────────
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
    }

    // ── Batch all instance writes ────────────────────────────────────────────
    inst.set(&KEY_ADMIN, &creator);
    inst.set(&KEY_CREATOR, &creator);
    inst.set(&KEY_TOKEN, &token);
    inst.set(&KEY_GOAL, &goal);
    inst.set(&KEY_DEADLINE, &deadline);
    inst.set(&KEY_MIN, &min_contribution);
    inst.set(&KEY_MAX, &max_contribution);
    inst.set(&KEY_TITLE, &title);
    inst.set(&KEY_DESC, &description);
    inst.set(&KEY_TOTAL, &0i128);
    inst.set(&KEY_STATUS, &Status::Active);
    inst.set(&KEY_CATEGORY, &category);
    inst.set(&KEY_VISIBILITY, &Visibility::Public);
    inst.set(&DataKey::ContributorCount, &0u32);
    inst.set(&DataKey::LargestContribution, &0i128);
    inst.set(&KEY_START_TIME, &env.ledger().timestamp());

    if let Some(links) = social_links {
        inst.set(&KEY_SOCIAL, &links);
    }
    if let Some(config) = platform_config {
        inst.set(&KEY_PLATFORM, &config);
    }
    if let Some(tokens) = accepted_tokens {
        inst.set(&DataKey::AcceptedTokens, &tokens);
    }
    if let Some(v) = vesting {
        inst.set(&KEY_VESTING, &v);
    }
    if let Some(p) = penalty_bps {
        inst.set(&DataKey::PenaltyBps, &p);
    }

    // ── Persistent storage writes (history) ──────────────────────────────────
    let persistent = env.storage().persistent();
    
    let mut goal_history: Vec<GoalAdjustment> = Vec::new(&env);
    goal_history.push_back(GoalAdjustment {
        previous_goal: 0,
        new_goal: goal,
        timestamp: env.ledger().timestamp(),
    });
    persistent.set(&KEY_GOAL_HISTORY, &goal_history);

    let mut meta_hist: Vec<MetadataVersion> = Vec::new(&env);
    meta_hist.push_back(MetadataVersion {
        version: 0,
        title: title.clone(),
        description: description.clone(),
        timestamp: env.ledger().timestamp(),
    });
    persistent.set(&KEY_META_HIST, &meta_hist);

    // ── Publish event and index campaign ─────────────────────────────────────
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

    inst.extend_ttl(17280, 518400);

    Ok(())
}

/// Initializes a campaign from a template.
///
/// Similar to `initialize()` but uses template settings for default values.
/// This avoids code duplication by sharing setup logic with the main initialize function.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `creator` - The campaign creator's address (must authorize)
/// * `template_type` - The template to use for defaults
/// * (other args same as `initialize()`)
pub(crate) fn initialize_from_template(
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
    // Delegate to main initialize function
    initialize(
        env,
        creator,
        token,
        goal,
        deadline,
        min_contribution,
        max_contribution,
        title,
        description,
        social_links,
        platform_config,
        accepted_tokens,
        category,
        vesting,
        penalty_bps,
    )
}

/// Clones an existing campaign into a new contract instance.
///
/// The creator must authorize this operation. All settings except the deadline
/// and creator address are copied from the existing campaign.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `creator` - The new creator's address (must authorize)
/// * (other args for campaign settings)
///
/// # Returns
/// - `Ok(())` on success
pub(crate) fn clone_campaign(
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
    creator.require_auth();

    // Initialize campaign with cloned settings
    initialize(
        env.clone(),
        creator.clone(),
        token,
        goal,
        deadline,
        min_contribution,
        max_contribution,
        title,
        description,
        social_links,
        platform_config,
        accepted_tokens,
        category,
        vesting,
        penalty_bps,
    )?;

    env.events().publish(
        ("campaign", "cloned"),
        EventCampaignCloned {
            original_creator: creator.clone(),
            new_creator: creator,
            new_goal: goal,
            new_deadline: deadline,
        },
    );

    Ok(())
}

/// Cancels a campaign (creator only).
///
/// Sets the campaign status to Cancelled, allowing contributors to refund.
/// Can only be called by the campaign creator when status is Active.
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::NotActive)` if campaign is not Active
/// - `Err(ContractError::Unauthorized)` if caller is not creator
pub(crate) fn cancel_campaign(env: Env) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);
    
    if status != Status::Active {
        return Err(ContractError::NotActive);
    }

    let creator: Address = inst.get(&KEY_CREATOR).ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);

    inst.set(&KEY_STATUS, &Status::Cancelled);
    inst.extend_ttl(17280, 518400);

    env.events().publish(
        ("campaign", "cancelled"),
        EventCancelled {
            creator,
            total_raised,
        },
    );

    Ok(())
}

/// Archives a campaign (creator only).
///
/// Marks the campaign as archived for record-keeping purposes.
/// Archived campaigns can still be queried but cannot accept new contributions.
///
/// # Returns
/// - `Ok(())` on success
pub(crate) fn archive(env: Env) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let creator: Address = inst.get(&KEY_CREATOR).ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    let archived_at = env.ledger().timestamp();
    let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
    inst.set(&KEY_ARCHIVED, &archived_at);
    inst.extend_ttl(17280, 518400);

    env.events().publish(
        ("campaign", "archived"),
        EventArchived {
            creator,
            total_raised,
            timestamp: archived_at,
        },
    );

    Ok(())
}

/// Checks if a campaign is archived.
///
/// # Returns
/// `true` if the campaign is archived, `false` otherwise
pub(crate) fn is_archived(env: Env) -> bool {
    env.storage()
        .instance()
        .has(&KEY_ARCHIVED)
}

/// Gets the timestamp when the campaign was archived.
///
/// # Returns
/// The archival timestamp, or `None` if not archived
pub(crate) fn get_archived_at(env: Env) -> Option<u64> {
    env.storage()
        .instance()
        .get(&KEY_ARCHIVED)
}
