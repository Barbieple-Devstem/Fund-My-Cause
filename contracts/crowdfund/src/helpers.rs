//! # Internal Helper Functions
//!
//! This module contains non-public helper functions extracted from the main contract
//! to reduce complexity of large functions like `contribute()`, `initialize()`, etc.
//!
//! These functions are shared helpers used across multiple contract endpoints.

use soroban_sdk::{Address, Env};

use crate::{
    errors::ContractError,
    storage::{
        DataKey, KEY_PLATFORM, KEY_INSURANCE, KEY_STATUS, KEY_CREATOR, 
        KEY_VISIBILITY, KEY_INSURANCE_POOL, KEY_RATE_LIMIT,
    },
    types::{FeeMode, MatchingConfig, PlatformConfig, RateLimit, Visibility, InsuranceConfig, Status},
};

/// Validates that the campaign is in Active status and that the caller is the creator.
///
/// This is a common pattern used in many functions that require creator authorization.
///
/// # Returns
/// - `Ok(Address)` — The creator's address (already validated)
/// - `Err(ContractError::NotActive)` if campaign status != Active
/// - `Err(ContractError::Unauthorized)` if caller is not the creator
pub(crate) fn require_active_and_auth_creator(env: &Env) -> Result<Address, ContractError> {
    let inst = env.storage().instance();
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);
    if status != Status::Active {
        return Err(ContractError::NotActive);
    }

    let creator: Address = inst.get(&KEY_CREATOR).ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();
    Ok(creator)
}

/// Checks if a contributor is allowed to contribute based on visibility, whitelist, and blacklist.
///
/// This logic is duplicated in `contribute()` and `contribute_on_behalf()` and is extracted
/// to a single source of truth.
///
/// # Arguments
/// * `env` — The Soroban environment
/// * `contributor` — Address to check
///
/// # Returns
/// - `Ok(())` if the contributor is allowed
/// - `Err(ContractError::Blacklisted)` if on the blacklist
/// - `Err(ContractError::NotWhitelisted)` if whitelist is required but contributor is not on it
pub(crate) fn check_contributor_access(
    env: &Env,
    contributor: &Address,
) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let persistent = env.storage().persistent();

    // Check blacklist
    if persistent
        .get::<_, bool>(&DataKey::Blacklist(contributor.clone()))
        .unwrap_or(false)
    {
        return Err(ContractError::Blacklisted);
    }

    // Check whitelist requirement
    let whitelist_only: bool = inst
        .get(&DataKey::WhitelistOnly)
        .unwrap_or(false);
    let visibility: Visibility = inst
        .get(&KEY_VISIBILITY)
        .unwrap_or(Visibility::Public);

    let needs_whitelist = whitelist_only || visibility == Visibility::Private;
    if needs_whitelist
        && !persistent
            .get::<_, bool>(&DataKey::Whitelist(contributor.clone()))
            .unwrap_or(false)
    {
        return Err(ContractError::NotWhitelisted);
    }

    Ok(())
}

/// Registers a contributor as "present" if they're contributing for the first time.
///
/// On first contribution, this function:
/// 1. Sets presence flag
/// 2. Records the contributor's index (for O(1) discovery)
/// 3. Increments the total contributor count
///
/// This logic is duplicated in `contribute()` and `contribute_on_behalf()`.
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::Overflow)` if contributor count would overflow
pub(crate) fn register_contributor_if_new(
    env: &Env,
    contributor: &Address,
) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let persistent = env.storage().persistent();

    let presence_key = DataKey::ContributorPresence(contributor.clone());
    let is_present: bool = persistent.get(&presence_key).unwrap_or(false);

    if !is_present {
        persistent.set(&presence_key, &true);
        persistent.extend_ttl(&presence_key, 100, 100);

        // Store contributor address at insertion-order index
        let count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);
        let index_key = DataKey::ContributorIndex(count);
        persistent.set(&index_key, &contributor);
        persistent.extend_ttl(&index_key, 100, 100);

        // Increment count
        inst.set(&DataKey::ContributorCount, &(count + 1));
    }

    Ok(())
}

/// Calculates the platform fee based on the total amount, configuration, and fee mode.
///
/// - If `fee_mode == OnContribution`: fee is already collected per-contribution; returns 0
/// - If `fee_mode == OnSuccess`: calculates `total * fee_bps / 10_000`
///
/// # Arguments
/// * `total` — The total amount to calculate fee on
/// * `config` — The platform configuration
///
/// # Returns
/// The fee amount to deduct (or 0 if already collected)
pub(crate) fn calculate_platform_fee(total: i128, config: &Option<PlatformConfig>) -> i128 {
    match config {
        Some(ref c) => {
            if c.fee_mode == FeeMode::OnContribution {
                0 // Already collected per contribution
            } else {
                total * c.fee_bps as i128 / 10_000
            }
        }
        None => 0,
    }
}

/// Checks and updates rate limit for a contributor.
///
/// Validates that the contribution doesn't exceed the per-window rate limit.
/// Updates the timestamp and accumulated amount in persistent storage.
///
/// # Returns
/// - `Ok(())` if within rate limit
/// - `Err(ContractError::RateLimitExceeded)` if contribution would exceed window limit
pub(crate) fn check_and_update_rate_limit(
    env: &Env,
    contributor: &Address,
    amount: i128,
) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let rl: Option<RateLimit> = inst.get(&KEY_RATE_LIMIT);

    if let Some(rl) = rl {
        if rl.max_amount > 0 && rl.window_seconds > 0 {
            let persistent = env.storage().persistent();
            let ts_key = DataKey::RateLimitTimestamp(contributor.clone());
            let amt_key = DataKey::RateLimitAmount(contributor.clone());
            let now = env.ledger().timestamp();
            let last_ts: u64 = persistent.get(&ts_key).unwrap_or(0);

            let in_window = last_ts > 0 && now.saturating_sub(last_ts) < rl.window_seconds;
            let period_amount: i128 = if in_window {
                persistent.get(&amt_key).unwrap_or(0)
            } else {
                0
            };

            let new_period = period_amount
                .checked_add(amount)
                .ok_or(ContractError::Overflow)?;
            if new_period > rl.max_amount {
                return Err(ContractError::RateLimitExceeded);
            }

            // Update timestamp and amount
            if in_window {
                persistent.set(&amt_key, &new_period);
            } else {
                persistent.set(&ts_key, &now);
                persistent.set(&amt_key, &amount);
            }
        }
    }

    Ok(())
}

/// Calculates the insurance fee deduction for a contribution.
///
/// If insurance is enabled, deducts `effective_amount * insurance_fee_bps / 10_000`
/// and stores the fee in per-contributor persistent storage.
///
/// # Arguments
/// * `env` — The Soroban environment
/// * `contributor` — The contributor's address
/// * `effective_amount` — The net contribution amount (after platform fees)
///
/// # Returns
/// The insurance fee amount (or 0 if insurance is disabled)
pub(crate) fn apply_insurance_fee(
    env: &Env,
    contributor: &Address,
    effective_amount: i128,
) -> i128 {
    let inst = env.storage().instance();
    let insurance_config: Option<InsuranceConfig> = inst.get(&KEY_INSURANCE);

    let insurance_fee = insurance_config
        .filter(|c| c.enabled)
        .map(|c| effective_amount * c.fee_bps as i128 / 10_000)
        .unwrap_or(0);

    if insurance_fee > 0 {
        let persistent = env.storage().persistent();
        let fee_key = DataKey::InsuranceFee(contributor.clone());
        let prev_fee: i128 = persistent.get(&fee_key).unwrap_or(0);
        persistent.set(&fee_key, &(prev_fee + insurance_fee));
        persistent.extend_ttl(&fee_key, 100, 100);

        let pool: i128 = inst.get(&KEY_INSURANCE_POOL).unwrap_or(0);
        inst.set(&KEY_INSURANCE_POOL, &(pool + insurance_fee));
    }

    insurance_fee
}

/// Applies matching funds to a contribution.
///
/// Calculates matched amount based on `amount * match_ratio / 10_000`,
/// up to the remaining sponsor pool. Updates total matched and deducts from pool.
///
/// # Returns
/// The matched amount applied (or 0 if no matching config)
pub(crate) fn apply_matching(env: &Env, amount: i128) -> Result<i128, ContractError> {
    let inst = env.storage().instance();

    let config: MatchingConfig = match inst.get(&DataKey::MatchingConfig) {
        Some(config) => config,
        None => return Ok(0),
    };
    let match_amount = (amount * config.match_ratio as i128) / 10_000;
    let total_matched: i128 = inst.get(&DataKey::TotalMatched).unwrap_or(0);
    let available_match = config.max_match - total_matched;
    let matched_amount = match_amount.min(available_match).max(0);

    if matched_amount > 0 {
        inst.set(&DataKey::TotalMatched, &(total_matched + matched_amount));
        let pool: i128 = inst.get(&DataKey::MatchingPool).unwrap_or(0);
        inst.set(&DataKey::MatchingPool, &(pool - matched_amount).max(0));
    }

    Ok(matched_amount)
}
