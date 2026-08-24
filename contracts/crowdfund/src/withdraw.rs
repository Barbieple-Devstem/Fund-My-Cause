//! # Withdrawal Functions
//!
//! This module handles paying campaign funds out to the creator. Two payout shapes
//! are supported: a single lump sum via [`withdraw`] once the campaign has succeeded,
//! and a linearly-unlocking stream via [`set_stream_config`] / [`claim_stream`].
//! It also tracks how much has already been released so the refund path can refund
//! only the unreleased portion.

use soroban_sdk::{token, Address, Env};

use crate::{
    errors::ContractError,
    storage::{
        DataKey, KEY_ADMIN, KEY_CREATOR, KEY_DEADLINE, KEY_GOAL, KEY_PLATFORM, KEY_RELEASED,
        KEY_SOFT_CAP, KEY_STATUS, KEY_STREAM, KEY_TOKEN, KEY_TOTAL, KEY_VESTING,
        TTL_INSTANCE_EXTEND_MAX, TTL_INSTANCE_EXTEND_MIN,
    },
    types::{
        EventStreamClaimed, EventWithdrawn, FeeMode, MatchingConfig, PlatformConfig, Status,
        StreamConfig, VestingSchedule, EVENT_SCHEMA_VERSION,
    },
    validation::validate_deadline_passed,
};

// === Shared helpers

/// Transfers the platform fee out of the campaign balance and returns the fee taken.
///
/// `respect_fee_mode` distinguishes the two callers: the lump-sum path skips the
/// deduction under [`FeeMode::OnContribution`] because those fees were already
/// collected per contribution, whereas the streaming path has no per-contribution
/// collection to account for and always charges the configured bps.
fn deduct_platform_fee(
    env: &Env,
    token_client: &token::Client,
    platform_config: &Option<PlatformConfig>,
    base: i128,
    respect_fee_mode: bool,
) -> i128 {
    match platform_config {
        Some(config) => {
            if respect_fee_mode && config.fee_mode == FeeMode::OnContribution {
                0
            } else {
                let fee = base * config.fee_bps as i128 / 10_000;
                token_client.transfer(&env.current_contract_address(), &config.address, &fee);
                fee
            }
        }
        None => 0,
    }
}

/// Returns the portion of `payout` that has vested at `now` under `vesting`.
///
/// With no schedule configured the whole payout is immediately available. The
/// caller performs the transfer, so the checks-effects-interactions ordering of
/// the withdraw path is unchanged.
fn apply_vesting_schedule(
    now: u64,
    vesting: &Option<VestingSchedule>,
    payout: i128,
) -> Result<i128, ContractError> {
    let v = match vesting {
        Some(v) => v,
        None => return Ok(payout),
    };

    if now < v.cliff {
        return Err(ContractError::VestingNotComplete);
    }

    if now >= v.cliff + v.duration {
        Ok(payout)
    } else {
        let elapsed = now - v.cliff;
        Ok(payout
            .checked_mul(elapsed as i128)
            .ok_or(ContractError::Overflow)?
            / v.duration as i128)
    }
}

// === Lump-sum withdrawal

/// Withdraws the raised funds to the creator after a successful campaign.
///
/// See [`crate::CrowdfundContract::withdraw`] for the full contract-level contract.
pub(crate) fn withdraw(env: Env) -> Result<(), ContractError> {
    // === Batch all instance reads up-front
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
    validate_deadline_passed(now, deadline)?;
    if total < success_threshold {
        return Err(ContractError::GoalNotReached);
    }

    let token_client = token::Client::new(&env, &token_address);

    // === Calculate fee and payout
    let fee = deduct_platform_fee(&env, &token_client, &platform_config, total, true);
    let mut payout = total - fee;

    // === Apply vesting if configured
    let vested = apply_vesting_schedule(now, &vesting, payout)?;
    token_client.transfer(&env.current_contract_address(), &creator, &vested);
    payout = vested;

    // === Batch all instance writes
    inst.set(&KEY_TOTAL, &0i128);
    inst.set(&KEY_STATUS, &Status::Successful);
    inst.extend_ttl(TTL_INSTANCE_EXTEND_MIN, TTL_INSTANCE_EXTEND_MAX);

    // === Refund unused matching funds to sponsor on completion
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

// === Streaming withdrawal

/// Configures optional streaming / scheduled withdrawal for the creator.
pub(crate) fn set_stream_config(
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
    inst.extend_ttl(TTL_INSTANCE_EXTEND_MIN, TTL_INSTANCE_EXTEND_MAX);
    Ok(())
}

/// Claims the portion of streamed funds that has unlocked since the last claim.
pub(crate) fn claim_stream(env: Env) -> Result<(), ContractError> {
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
    let token_address: Address = inst.get(&KEY_TOKEN).unwrap();
    let token_client = token::Client::new(&env, &token_address);
    let fee = if stream.claimed == 0 {
        deduct_platform_fee(&env, &token_client, &platform_config, total, false)
    } else {
        0
    };

    let payout = claimable - fee;
    token_client.transfer(&env.current_contract_address(), &creator, &payout);

    stream.claimed = stream
        .claimed
        .checked_add(claimable)
        .ok_or(ContractError::Overflow)?;
    let remaining = total
        .checked_sub(stream.claimed)
        .ok_or(ContractError::Overflow)?
        .max(0);

    inst.set(&KEY_STREAM, &stream);
    if remaining == 0 {
        inst.set(&KEY_STATUS, &Status::Successful);
        inst.set(&KEY_TOTAL, &0i128);
    }
    inst.extend_ttl(TTL_INSTANCE_EXTEND_MIN, TTL_INSTANCE_EXTEND_MAX);

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

// === Release tracking (#695)

/// Records that `amount` stroops have been released to the creator.
pub(crate) fn record_release(env: Env, amount: i128) -> Result<(), ContractError> {
    if amount <= 0 {
        return Err(ContractError::AmountNotPositive);
    }
    let inst = env.storage().instance();
    let admin: Address = inst.get(&KEY_ADMIN).unwrap();
    admin.require_auth();

    let released: i128 = inst.get(&KEY_RELEASED).unwrap_or(0);
    let new_released = released
        .checked_add(amount)
        .ok_or(ContractError::Overflow)?;
    inst.set(&KEY_RELEASED, &new_released);
    Ok(())
}

/// Returns the total amount already released to the creator.
pub(crate) fn released_amount(env: Env) -> i128 {
    env.storage().instance().get(&KEY_RELEASED).unwrap_or(0)
}
