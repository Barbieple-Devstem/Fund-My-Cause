//! # Read-Only View Functions
//!
//! This module contains pure read-only query functions that have no side effects.
//! These functions return campaign state and contributor information.
//!
//! These getters return bare values rather than `Result`, so they cannot carry a
//! typed error. Core keys written once by `initialize` (see the `lib.rs` module
//! docs) are read with `unwrap()` on that documented post-init invariant; every
//! optional or legitimately-absent key uses a default instead.

use soroban_sdk::{Address, Env, String, Vec};

use crate::{
    storage::{
        DataKey, KEY_CATEGORY, KEY_CREATOR, KEY_DEADLINE, KEY_DESC, KEY_GOAL,
        KEY_GOAL_HISTORY, KEY_MAX, KEY_MIN, KEY_PLATFORM, KEY_SOCIAL, KEY_STATUS,
        KEY_TITLE, KEY_TOKEN, KEY_TOTAL, KEY_VESTING,
    },
    types::{
        CampaignInfo, Category, ContributionRecord, ExtensionProposal, FeeMode, GoalAdjustment, PlatformConfig, RecurringPlan, Status, VestingSchedule,
    },
};

// === Core campaign getters

/// Returns the total amount raised so far in stroops.
pub(crate) fn total_raised(env: Env) -> i128 {
    env.storage().instance().get(&KEY_TOTAL).unwrap_or(0)
}

/// Returns the campaign creator's Stellar address.
pub(crate) fn creator(env: Env) -> Address {
    env.storage().instance().get(&KEY_CREATOR).unwrap()
}

/// Returns the current campaign status.
pub(crate) fn status(env: Env) -> Status {
    env.storage().instance().get(&KEY_STATUS).unwrap()
}

/// Returns the campaign funding goal in stroops.
pub(crate) fn goal(env: Env) -> i128 {
    env.storage().instance().get(&KEY_GOAL).unwrap()
}

/// Returns the campaign deadline as a Unix timestamp (seconds).
pub(crate) fn deadline(env: Env) -> u64 {
    env.storage().instance().get(&KEY_DEADLINE).unwrap()
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
    env.storage().instance().get(&KEY_MIN).unwrap()
}

/// Returns the maximum contribution amount per contributor in stroops (0 = no limit).
pub(crate) fn max_contribution(env: Env) -> i128 {
    env.storage().instance().get(&KEY_MAX).unwrap_or(0)
}

// === Metadata getters

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

/// Returns the list of accepted token addresses, falling back to the primary token.
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

/// Returns the current fee mode, defaulting to `OnSuccess`.
pub(crate) fn get_fee_mode(env: Env) -> FeeMode {
    env.storage()
        .instance()
        .get::<_, PlatformConfig>(&KEY_PLATFORM)
        .map(|c| c.fee_mode)
        .unwrap_or(FeeMode::OnSuccess)
}

/// Returns comprehensive campaign information.
pub(crate) fn get_campaign_info(env: Env) -> CampaignInfo {
    let inst = env.storage().instance();
    let creator: Address = inst.get(&KEY_CREATOR).unwrap();
    let token: Address = inst.get(&KEY_TOKEN).unwrap();
    let goal: i128 = inst.get(&KEY_GOAL).unwrap();
    let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap();
    let min_contribution: i128 = inst.get(&KEY_MIN).unwrap();
    let max_contribution: i128 = inst.get(&KEY_MAX).unwrap_or(0);
    let title: String = inst
        .get(&KEY_TITLE)
        .unwrap_or_else(|| String::from_str(&env, ""));
    let description: String = inst
        .get(&KEY_DESC)
        .unwrap_or_else(|| String::from_str(&env, ""));
    let status: Status = inst.get(&KEY_STATUS).unwrap();
    let category: Category = inst.get(&KEY_CATEGORY).unwrap_or(Category::Other);

    let (has_platform_config, platform_fee_bps, platform_address) =
        if let Some(config) = inst.get::<_, PlatformConfig>(&KEY_PLATFORM) {
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
pub(crate) fn get_category(env: Env) -> Category {
    env.storage()
        .instance()
        .get(&KEY_CATEGORY)
        .unwrap_or(Category::Other)
}

// === Vesting getters

/// Returns the vesting schedule (if configured).
pub(crate) fn get_vesting_info(env: Env) -> Option<VestingSchedule> {
    env.storage().instance().get(&KEY_VESTING)
}

/// Returns the amount of the creator payout that is currently vested.
///
/// The vested amount is computed against the current `total_raised`, minus the
/// configured platform fee (if any). With no vesting schedule the full post-fee
/// payout is reported as vested.
pub(crate) fn get_vested_amount(env: Env) -> i128 {
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

// === History getters

/// Returns the goal adjustment history.
pub(crate) fn get_goal_history(env: Env) -> Vec<GoalAdjustment> {
    env.storage()
        .persistent()
        .get(&KEY_GOAL_HISTORY)
        .unwrap_or_else(|| Vec::new(&env))
}

/// Returns the contribution history for a contributor.
pub(crate) fn get_contribution_history(env: Env, contributor: Address) -> Vec<ContributionRecord> {
    env.storage()
        .persistent()
        .get(&DataKey::ContributionHistory(contributor))
        .unwrap_or_else(|| Vec::new(&env))
}

/// Returns the penalty fee in basis points, or 0 when not configured.
pub(crate) fn get_penalty_bps(env: Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::PenaltyBps)
        .unwrap_or(0)
}

// === Contributor getters

/// Returns a paginated list of contributor addresses (limit capped at 50).
pub(crate) fn contributor_list(env: Env, offset: u32, limit: u32) -> Vec<Address> {
    // Read total count from instance storage (cheap, already in footprint).
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

/// Returns the message attached to a contribution (if any).
pub(crate) fn get_contribution_message(env: Env, contributor: Address) -> Option<String> {
    env.storage()
        .persistent()
        .get(&DataKey::ContributionMessage(contributor))
}

/// Returns the recurring contribution plan for a contributor.
pub(crate) fn get_recurring_plan(env: Env, contributor: Address) -> Option<RecurringPlan> {
    env.storage()
        .persistent()
        .get(&DataKey::RecurringPlan(contributor))
}

/// Returns the active extension proposal (if any).
pub(crate) fn get_extension_proposal(env: Env) -> Option<ExtensionProposal> {
    env.storage().instance().get(&DataKey::ExtensionProposal)
}
