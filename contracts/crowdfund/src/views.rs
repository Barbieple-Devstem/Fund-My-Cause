//! # Read-Only View Functions
//!
//! This module contains pure read-only query functions that have no side effects.
//! These functions return campaign state and contributor information.

use soroban_sdk::{Address, Env, String, Vec};

use crate::{
    storage::{
        DataKey, KEY_CATEGORY, KEY_CREATOR, KEY_DEADLINE, KEY_DESC, KEY_GOAL, KEY_GOAL_HISTORY,
        KEY_MAX, KEY_META_HIST, KEY_MIN, KEY_PLATFORM, KEY_SOCIAL, KEY_STATUS, KEY_TITLE,
        KEY_TOKEN, KEY_TOTAL, KEY_VESTING,
    },
    types::{
        CampaignInfo, Category, ContributionRecord, GoalAdjustment, MetadataVersion, PlatformConfig,
        Status, VestingSchedule, Visibility, FeeMode,
    },
};

/// Returns the total amount raised so far in stroops.
pub(crate) fn total_raised(env: Env) -> i128 {
    env.storage().instance().get(&KEY_TOTAL).unwrap_or(0)
}

/// Returns the campaign creator's Stellar address.
pub(crate) fn creator(env: Env) -> Address {
    // Infallible: KEY_CREATOR is written during `initialize` and never removed, so any
    // successfully-initialized contract always has it. This getter returns a bare value
    // (not a Result), so the post-init invariant is documented rather than propagated.
    env.storage().instance().get(&KEY_CREATOR).unwrap()
}

/// Returns the current campaign status.
pub(crate) fn status(env: Env) -> Status {
    env.storage()
        .instance()
        .get(&KEY_STATUS)
        .unwrap_or(Status::Active)
}

/// Returns the campaign funding goal in stroops.
pub(crate) fn goal(env: Env) -> i128 {
    env.storage().instance().get(&KEY_GOAL).unwrap_or(0)
}

/// Returns the campaign deadline as a Unix timestamp (seconds).
pub(crate) fn deadline(env: Env) -> u64 {
    env.storage().instance().get(&KEY_DEADLINE).unwrap_or(0)
}

/// Returns the total contribution amount for a specific contributor in stroops.
pub(crate) fn contribution(env: Env, contributor: Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Contribution(contributor))
        .unwrap_or(0)
}

/// Checks if an address has made any contributions to the campaign.
pub(crate) fn is_contributor(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, i128>(&DataKey::Contribution(address))
        .unwrap_or(0)
        > 0
}

/// Returns the minimum contribution amount in stroops.
pub(crate) fn min_contribution(env: Env) -> i128 {
    env.storage().instance().get(&KEY_MIN).unwrap_or(0)
}

/// Returns the maximum contribution amount per contributor in stroops (0 = no limit).
pub(crate) fn max_contribution(env: Env) -> i128 {
    env.storage().instance().get(&KEY_MAX).unwrap_or(0)
}

/// Returns the campaign title.
pub(crate) fn title(env: Env) -> String {
    env.storage()
        .instance()
        .get(&KEY_TITLE)
        .unwrap_or_else(|| String::from_str(&env, ""))
}

/// Returns the campaign description.
pub(crate) fn description(env: Env) -> String {
    env.storage()
        .instance()
        .get(&KEY_DESC)
        .unwrap_or_else(|| String::from_str(&env, ""))
}

/// Returns the campaign's social media links.
pub(crate) fn social_links(env: Env) -> Vec<String> {
    env.storage()
        .instance()
        .get(&KEY_SOCIAL)
        .unwrap_or_else(|| Vec::new(&env))
}

/// Returns the list of accepted token addresses.
pub(crate) fn accepted_tokens(env: Env) -> Vec<Address> {
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
pub(crate) fn platform_config(env: Env) -> Option<PlatformConfig> {
    env.storage().instance().get(&KEY_PLATFORM)
}

/// Returns the current fee mode (OnSuccess or OnContribution), defaulting to OnSuccess.
pub(crate) fn get_fee_mode(env: Env) -> FeeMode {
    env.storage()
        .instance()
        .get(&KEY_PLATFORM)
        .map(|c: PlatformConfig| c.fee_mode)
        .unwrap_or(FeeMode::OnSuccess)
}

/// Returns the contract version number.
pub(crate) fn version(env: Env) -> u32 {
    use crate::storage::CONTRACT_VERSION;
    CONTRACT_VERSION
}

/// Returns comprehensive campaign information.
pub(crate) fn get_campaign_info(env: Env) -> CampaignInfo {
    let inst = env.storage().instance();
    // Infallible: KEY_CREATOR / KEY_TOKEN are written during `initialize` and never
    // removed. This getter returns a bare `CampaignInfo` (not a Result), so the
    // post-init invariant is documented rather than propagated.
    let creator: Address = inst.get(&KEY_CREATOR).unwrap();

    let (has_platform_config, platform_fee_bps, platform_address) =
        if let Some(config) = inst.get::<_, PlatformConfig>(&KEY_PLATFORM) {
            (true, config.fee_bps, config.address)
        } else {
            (false, 0, creator.clone())
        };

    CampaignInfo {
        creator,
        token: inst.get(&KEY_TOKEN).unwrap(),
        goal: inst.get(&KEY_GOAL).unwrap_or(0),
        deadline: inst.get(&KEY_DEADLINE).unwrap_or(0),
        min_contribution: inst.get(&KEY_MIN).unwrap_or(0),
        max_contribution: inst.get(&KEY_MAX).unwrap_or(0),
        title: inst
            .get(&KEY_TITLE)
            .unwrap_or_else(|| String::from_str(&env, "")),
        description: inst
            .get(&KEY_DESC)
            .unwrap_or_else(|| String::from_str(&env, "")),
        status: inst.get(&KEY_STATUS).unwrap_or(Status::Active),
        has_platform_config,
        platform_fee_bps,
        platform_address,
        category: inst.get(&KEY_CATEGORY).unwrap_or(Category::Technology),
    }
}

/// Returns the campaign category.
pub(crate) fn get_category(env: Env) -> Category {
    env.storage()
        .instance()
        .get(&KEY_CATEGORY)
        .unwrap_or(Category::Technology)
}

/// Returns the vesting schedule (if configured).
pub(crate) fn get_vesting_info(env: Env) -> Option<VestingSchedule> {
    env.storage().instance().get(&KEY_VESTING)
}

/// Returns the vested amount available to the creator at the current time.
pub(crate) fn get_vested_amount(env: Env) -> i128 {
    let vesting = match env.storage().instance().get::<_, VestingSchedule>(&KEY_VESTING) {
        Some(v) => v,
        None => return env.storage().instance().get(&KEY_TOTAL).unwrap_or(0),
    };

    let now = env.ledger().timestamp();
    let total = env.storage().instance().get(&KEY_TOTAL).unwrap_or(0);

    if now < vesting.cliff {
        return 0;
    }

    if now >= vesting.cliff + vesting.duration {
        return total;
    }

    let elapsed = now - vesting.cliff;
    total * elapsed as i128 / vesting.duration as i128
}

/// Returns the goal adjustment history.
pub(crate) fn get_goal_history(env: Env) -> Vec<GoalAdjustment> {
    env.storage()
        .persistent()
        .get(&KEY_GOAL_HISTORY)
        .unwrap_or_else(|| Vec::new(&env))
}

/// Returns the metadata version history.
pub(crate) fn get_metadata_history(env: Env) -> Vec<MetadataVersion> {
    env.storage()
        .persistent()
        .get(&KEY_META_HIST)
        .unwrap_or_else(|| Vec::new(&env))
}

/// Returns the penalty amount in basis points (if configured).
pub(crate) fn get_penalty_bps(env: Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::PenaltyBps)
        .unwrap_or(0)
}

/// Returns the list of all contributors (paginated).
pub(crate) fn contributor_list(env: Env, offset: u32, limit: u32) -> Vec<Address> {
    let persistent = env.storage().persistent();
    let inst = env.storage().instance();
    let count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);
    
    let mut result = Vec::new(&env);
    let end = (offset + limit).min(count);
    
    for i in offset..end {
        if let Some(addr) = persistent.get::<_, Address>(&DataKey::ContributorIndex(i)) {
            result.push_back(addr);
        }
    }
    
    result
}

/// Returns the message attached to a contribution (if any).
pub(crate) fn get_contribution_message(env: Env, contributor: Address) -> Option<String> {
    env.storage()
        .persistent()
        .get(&DataKey::ContributionMessage(contributor))
}

/// Returns the contribution history for a contributor.
pub(crate) fn get_contribution_history(env: Env, contributor: Address) -> Vec<ContributionRecord> {
    env.storage()
        .persistent()
        .get(&DataKey::ContributionHistory(contributor))
        .unwrap_or_else(|| Vec::new(&env))
}

/// Returns the recurring contribution plan for a contributor.
pub(crate) fn get_recurring_plan(env: Env, contributor: Address) -> Option<crate::types::RecurringPlan> {
    env.storage()
        .persistent()
        .get(&DataKey::RecurringPlan(contributor))
}

/// Returns the active extension proposal (if any).
pub(crate) fn get_extension_proposal(env: Env) -> Option<crate::types::ExtensionProposal> {
    env.storage()
        .instance()
        .get(&DataKey::ExtensionProposal)
}
