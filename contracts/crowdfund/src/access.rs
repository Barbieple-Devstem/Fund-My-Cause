//! # Access Control Functions
//!
//! This module handles visibility, whitelist, blacklist, allow-list, and deny-list management.
//! It controls who can contribute to a campaign and the campaign's visibility level.

use soroban_sdk::{Address, Env};

use crate::{
    errors::ContractError,
    storage::{
        DataKey, KEY_CREATOR, KEY_VISIBILITY, KEY_RATE_LIMIT, KEY_PAUSE_TIMELOCK,
        KEY_STATUS,
    },
    types::{Visibility, Status, RateLimit, EventWhitelisted, EventBlacklisted,
            EventVisibilityChanged, EventOwnershipTransferred, EventPaused, EventResumed,
            EventRateLimitUpdated, EventPausedWithTimelock},
};

// ── Whitelist Functions ───────────────────────────────────────────────────────

/// Adds an address to the campaign whitelist.
pub(crate) fn add_to_whitelist(env: Env, address: Address) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .persistent()
        .set(&DataKey::Whitelist(address.clone()), &true);

    env.events().publish(
        ("campaign", "whitelisted"),
        EventWhitelisted { address },
    );

    Ok(())
}

/// Removes an address from the campaign whitelist.
pub(crate) fn remove_from_whitelist(env: Env, address: Address) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .persistent()
        .remove(&DataKey::Whitelist(address.clone()));

    env.events().publish(
        ("campaign", "whitelist_removed"),
        (address,),
    );

    Ok(())
}

/// Checks if an address is whitelisted.
pub(crate) fn is_whitelisted(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::Whitelist(address))
        .unwrap_or(false)
}

/// Sets whether the campaign is whitelist-only.
pub(crate) fn set_whitelist_only(env: Env, enabled: bool) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .instance()
        .set(&DataKey::WhitelistOnly, &enabled);

    Ok(())
}

// ── Blacklist Functions ───────────────────────────────────────────────────────

/// Adds an address to the campaign blacklist.
pub(crate) fn add_to_blacklist(env: Env, address: Address) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .persistent()
        .set(&DataKey::Blacklist(address.clone()), &true);

    env.events().publish(
        ("campaign", "blacklisted"),
        EventBlacklisted { address },
    );

    Ok(())
}

/// Removes an address from the campaign blacklist.
pub(crate) fn remove_from_blacklist(env: Env, address: Address) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .persistent()
        .remove(&DataKey::Blacklist(address.clone()));

    env.events().publish(
        ("campaign", "blacklist_removed"),
        (address,),
    );

    Ok(())
}

/// Checks if an address is blacklisted.
pub(crate) fn is_blacklisted(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::Blacklist(address))
        .unwrap_or(false)
}

// ── Allow/Deny List Functions ─────────────────────────────────────────────────

/// Adds an address to the allow-list.
pub(crate) fn add_to_allowlist(env: Env, address: Address) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .persistent()
        .set(&DataKey::AllowList(address.clone()), &true);

    env.events().publish(
        ("campaign", "allowlisted"),
        (address,),
    );

    Ok(())
}

/// Removes an address from the allow-list.
pub(crate) fn remove_from_allowlist(env: Env, address: Address) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .persistent()
        .remove(&DataKey::AllowList(address.clone()));

    env.events().publish(
        ("campaign", "allowlist_removed"),
        (address,),
    );

    Ok(())
}

/// Checks if an address is in the allow-list.
pub(crate) fn is_allowlisted(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::AllowList(address))
        .unwrap_or(false)
}

/// Adds an address to the deny-list.
pub(crate) fn add_to_denylist(env: Env, address: Address) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .persistent()
        .set(&DataKey::DenyList(address.clone()), &true);

    env.events().publish(
        ("campaign", "denylisted"),
        (address,),
    );

    Ok(())
}

/// Removes an address from the deny-list.
pub(crate) fn remove_from_denylist(env: Env, address: Address) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .persistent()
        .remove(&DataKey::DenyList(address.clone()));

    env.events().publish(
        ("campaign", "denylist_removed"),
        (address,),
    );

    Ok(())
}

/// Checks if an address is in the deny-list.
pub(crate) fn is_denylisted(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::DenyList(address))
        .unwrap_or(false)
}

// ── Visibility Functions ──────────────────────────────────────────────────────

/// Sets the campaign visibility level.
pub(crate) fn set_visibility(env: Env, visibility: Visibility) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    let old_visibility: Visibility = env
        .storage()
        .instance()
        .get(&KEY_VISIBILITY)
        .unwrap_or(Visibility::Public);

    env.storage()
        .instance()
        .set(&KEY_VISIBILITY, &visibility);

    env.events().publish(
        ("campaign", "visibility_changed"),
        EventVisibilityChanged {
            old_visibility,
            new_visibility: visibility,
        },
    );

    Ok(())
}

/// Gets the campaign visibility level.
pub(crate) fn get_visibility(env: Env) -> Visibility {
    env.storage()
        .instance()
        .get(&KEY_VISIBILITY)
        .unwrap_or(Visibility::Public)
}

// ── Ownership Functions ───────────────────────────────────────────────────────

/// Transfers campaign ownership to a new creator.
pub(crate) fn transfer_ownership(env: Env, new_owner: Address) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .instance()
        .set(&KEY_CREATOR, &new_owner);

    env.events().publish(
        ("campaign", "ownership_transferred"),
        EventOwnershipTransferred {
            previous_owner: creator,
            new_owner,
        },
    );

    Ok(())
}

// ── Pause/Resume Functions ────────────────────────────────────────────────────

/// Pauses campaign contributions.
pub(crate) fn pause(env: Env) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    let inst = env.storage().instance();
    inst.set(&KEY_STATUS, &Status::Paused);
    inst.extend_ttl(17280, 518400);

    env.events().publish(
        ("campaign", "paused"),
        EventPaused { timestamp: env.ledger().timestamp() },
    );

    Ok(())
}

/// Resumes campaign contributions.
pub(crate) fn resume(env: Env) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    let inst = env.storage().instance();
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);
    if status != Status::Paused {
        return Err(ContractError::NotPaused);
    }

    inst.set(&KEY_STATUS, &Status::Active);
    inst.extend_ttl(17280, 518400);

    env.events().publish(
        ("campaign", "resumed"),
        EventResumed { timestamp: env.ledger().timestamp() },
    );

    Ok(())
}

/// Alias for `resume()`.
pub(crate) fn unpause(env: Env) -> Result<(), ContractError> {
    resume(env)
}

// ── Rate Limit Functions ──────────────────────────────────────────────────────

/// Sets rate limit configuration.
pub(crate) fn set_rate_limit(
    env: Env,
    max_amount: i128,
    window_seconds: u64,
) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    let rate_limit = RateLimit {
        max_amount,
        window_seconds,
    };

    env.storage()
        .instance()
        .set(&KEY_RATE_LIMIT, &rate_limit);

    env.events().publish(
        ("campaign", "rate_limit_updated"),
        EventRateLimitUpdated {
            max_amount,
            window_seconds,
        },
    );

    Ok(())
}

/// Gets the current rate limit configuration.
pub(crate) fn get_rate_limit(env: Env) -> Option<RateLimit> {
    env.storage()
        .instance()
        .get(&KEY_RATE_LIMIT)
}

// ── Pause Timelock Functions ──────────────────────────────────────────────────

/// Sets a timelock for resuming a paused campaign.
pub(crate) fn set_pause_timelock(env: Env, unpause_after: u64) -> Result<(), ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();

    env.storage()
        .instance()
        .set(&KEY_PAUSE_TIMELOCK, &unpause_after);

    env.events().publish(
        ("campaign", "paused_with_timelock"),
        EventPausedWithTimelock {
            timestamp: env.ledger().timestamp(),
            unpause_after,
        },
    );

    Ok(())
}
