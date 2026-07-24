//! # Refund Functions
//!
//! This module handles refunding contributions when campaigns fail to meet their goals
//! or are cancelled. Implements a pull-based refund model where contributors claim their
//! own refunds individually, avoiding gas limits and single points of failure.

use soroban_sdk::{Address, Env, Vec, token};

use crate::{
    errors::ContractError,
    storage::{
        DataKey, KEY_STATUS, KEY_TOTAL, KEY_TOKEN, KEY_DEADLINE,
    },
    types::{Status, EventRefunded, EventBatchRefundCompleted, EventPartialRefund, EVENT_SCHEMA_VERSION},
};

/// Refunds a single contributor's contribution.
///
/// Transfers the contributor's full contribution amount back to them.
/// Can only be called when the campaign has not met its goal (after deadline) or has been cancelled.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `contributor` - The contributor address to refund
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::NotActive)` if campaign is in wrong status for refunds
/// - `Err(ContractError::NothingToRefund)` if contributor has no balance
pub(crate) fn refund_single(
    env: Env,
    contributor: Address,
) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);

    // Can only refund if campaign failed, was cancelled, or insurance is claiming
    match status {
        Status::Refunded | Status::Cancelled => {}
        Status::Active => {
            let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap_or(0);
            if env.ledger().timestamp() < deadline {
                return Err(ContractError::NotActive);
            }
            let total: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
            let goal: i128 = inst.get(&crate::storage::KEY_GOAL).unwrap_or(0);
            if total >= goal {
                return Err(ContractError::GoalReached);
            }
        }
        _ => return Err(ContractError::NotActive),
    }

    let persistent = env.storage().persistent();
    let contrib_key = DataKey::Contribution(contributor.clone());
    let amount: i128 = persistent.get(&contrib_key).unwrap_or(0);

    if amount <= 0 {
        return Err(ContractError::NothingToRefund);
    }

    // Mark as refunded to prevent double-claiming
    persistent.set(&contrib_key, &0i128);

    let token_address: Address = inst.get(&KEY_TOKEN).ok_or(ContractError::InvalidAddress)?;
    token::Client::new(&env, &token_address).transfer(
        &env.current_contract_address(),
        &contributor,
        &amount,
    );

    env.events().publish(
        ("campaign", "refunded"),
        EventRefunded {
            contributor: contributor.clone(),
            amount,
            schema_version: EVENT_SCHEMA_VERSION,
        },
    );

    Ok(())
}

/// Refunds multiple contributors in a single transaction.
///
/// Attempts to refund each contributor in the list. If any individual refund fails,
/// that contributor's error is skipped and the function continues with the next.
/// Returns the count of successful refunds.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `contributors` - Vector of contributor addresses to refund
///
/// # Returns
/// The number of successfully refunded contributors
pub(crate) fn refund_batch(
    env: Env,
    contributors: Vec<Address>,
) -> Result<u32, ContractError> {
    let inst = env.storage().instance();
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);

    match status {
        Status::Refunded | Status::Cancelled => {}
        _ => return Err(ContractError::NotActive),
    }

    let persistent = env.storage().persistent();
    let token_address: Address = inst.get(&KEY_TOKEN).ok_or(ContractError::InvalidAddress)?;
    let token_client = token::Client::new(&env, &token_address);

    let mut refunded_count: u32 = 0;

    for contributor in contributors.iter() {
        let contrib_key = DataKey::Contribution(contributor.clone());
        let amount: i128 = persistent.get(&contrib_key).unwrap_or(0);

        if amount <= 0 {
            continue;
        }

        persistent.set(&contrib_key, &0i128);

        if token_client
            .try_transfer(&env.current_contract_address(), &contributor, &amount)
            .is_err()
        {
            // Roll back the zeroing so the contributor can retry their refund
            persistent.set(&contrib_key, &amount);
            continue;
        }

        refunded_count += 1;
    }

    env.events().publish(
        ("campaign", "batch_refund_completed"),
        EventBatchRefundCompleted {
            total_refunded: refunded_count,
            batch_size: contributors.len() as u32,
        },
    );

    Ok(refunded_count)
}

/// Refunds a partial amount to a contributor.
///
/// This is typically used by insurance policies or dispute resolution.
/// Reduces the contributor's balance by the specified amount.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `contributor` - The contributor address
/// * `amount` - The amount to refund (must be <= current balance)
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::ExceedsMaximum)` if amount > current balance
pub(crate) fn refund_partial(
    env: Env,
    contributor: Address,
    amount: i128,
) -> Result<(), ContractError> {
    let persistent = env.storage().persistent();
    let contrib_key = DataKey::Contribution(contributor.clone());
    let current: i128 = persistent.get(&contrib_key).unwrap_or(0);

    if amount > current {
        return Err(ContractError::ExceedsMaximum);
    }

    let new_balance = current - amount;
    persistent.set(&contrib_key, &new_balance);

    let token_address: Address = env.storage().instance().get(&KEY_TOKEN).ok_or(ContractError::InvalidAddress)?;
    token::Client::new(&env, &token_address).transfer(
        &env.current_contract_address(),
        &contributor,
        &amount,
    );

    env.events().publish(
        ("campaign", "partial_refund"),
        EventPartialRefund {
            contributor,
            amount,
            remaining: new_balance,
        },
    );

    Ok(())
}

/// Refunds unused matching funds back to the sponsor.
///
/// Called after a successful campaign to return any unallocated matching pool funds.
/// Only the matching sponsor (or authorized admin) can call this.
///
/// # Returns
/// - `Ok(())` on success
pub(crate) fn refund_matching_sponsor(env: Env) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let matching_pool: i128 = inst.get(&DataKey::MatchingPool).unwrap_or(0);

    if matching_pool <= 0 {
        return Ok(());
    }

    if let Some(config) = inst.get::<_, crate::types::MatchingConfig>(&DataKey::MatchingConfig) {
        config.sponsor.require_auth();

        let token_address: Address = inst.get(&KEY_TOKEN).ok_or(ContractError::InvalidAddress)?;
        token::Client::new(&env, &token_address).transfer(
            &env.current_contract_address(),
            &config.sponsor,
            &matching_pool,
        );

        inst.set(&DataKey::MatchingPool, &0i128);
    }

    Ok(())
}
