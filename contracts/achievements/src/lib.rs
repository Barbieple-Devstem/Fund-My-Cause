//! # Fund-My-Cause Achievements Contract
//!
//! A Soroban smart contract for managing user achievements, NFT badges, and gamification
//! on the Fund My Cause platform.
//!
//! ## Overview
//!
//! The achievements contract tracks user progress and awards NFT badges for:
//! - Contribution milestones
//! - Social engagement
//! - Referral success
//! - Community support
//! - Campaign goals reached
//!
//! ## Features
//!
//! - **Achievement System** - 12+ unique achievements with tiers (common, uncommon, rare, epic, legendary)
//! - **NFT Badges** - Mint NFTs for achievement milestones
//! - **Points System** - Award points for activities (achievements, contributions, referrals)
//! - **Leaderboards** - Track top contributors, referrers, and achievement collectors
//! - **Contribution Streaks** - Reward consecutive daily contributions
//! - **Level System** - Progress from level 1-100 based on points
//! - **Referral Tracking** - Monitor referral success and rewards
//! - **Challenge Tracking** - Track participation in limited-time challenges
//! - **Audit Trail** - Complete history of achievement unlocks

#![no_std]

mod achievements;
mod errors;
mod events;
mod leaderboard;
mod points;
mod storage;
mod types;
mod validation;

pub use achievements::{get_user_achievements, has_achievement};
pub use errors::ContractError;
pub use events::*;
pub use leaderboard::{add_leaderboard_entry, get_leaderboard};
pub use points::{award_points, get_user_level, get_user_points};
pub use storage::*;
pub use types::*;
pub use validation::*;

use common::{AccessControl, CommonError};
use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, String, Vec};

/// Main achievement contract
#[contract]
pub struct AchievementsContract;

// `env.events().publish(...)` is deprecated in favor of `#[contractevent]`
// typed events; migrating the event system is out of scope here (see the
// still-unused typed event structs in `events.rs`), so the existing
// tuple-based publish calls are kept and the deprecation warning suppressed.
#[allow(deprecated)]
#[contractimpl]
impl AchievementsContract {
    /// Initialize the achievements contract
    pub fn initialize(
        env: Env,
        admin: Address,
        platform_address: Address,
    ) -> Result<(), ContractError> {
        AccessControl::require_role_auth(&admin);

        if env.storage().instance().has(&storage::KEY_ADMIN) {
            return Err(CommonError::AlreadyInitialized.into());
        }

        env.storage().instance().set(&storage::KEY_ADMIN, &admin);
        env.storage()
            .instance()
            .set(&storage::KEY_PLATFORM, &platform_address);

        env.events().publish(
            ("achievements", "initialized"),
            (admin.clone(), platform_address),
        );

        Ok(())
    }

    /// Unlock an achievement for a user.
    ///
    /// Returns `AchievementAlreadyUnlocked` if the user already holds this
    /// achievement type — repeated calls must not re-award points.
    pub fn unlock_achievement(
        env: Env,
        user: Address,
        achievement_type: u32,
        metadata: String,
    ) -> Result<AchievementNFT, ContractError> {
        user.require_auth();

        validate_achievement_type(achievement_type)?;

        if has_achievement(&env, &user, achievement_type)? {
            return Err(ContractError::AchievementAlreadyUnlocked);
        }

        do_unlock(&env, &user, achievement_type, metadata)
    }

    /// Get user achievements
    pub fn get_achievements(env: Env, user: Address) -> Result<Vec<AchievementNFT>, ContractError> {
        get_user_achievements(&env, &user)
    }

    /// Get leaderboard entries
    pub fn get_leaderboard_entries(
        env: Env,
        leaderboard_type: u32,
        limit: u32,
    ) -> Result<Vec<LeaderboardEntry>, ContractError> {
        get_leaderboard(
            &env,
            validate_leaderboard_type(leaderboard_type)?,
            limit as usize,
        )
    }

    /// Get a user's rank on a leaderboard (1-based). Errors with
    /// `UserNotFound` if the user has no entry on that leaderboard.
    pub fn get_rank(env: Env, user: Address, leaderboard_type: u32) -> Result<u32, ContractError> {
        leaderboard::get_user_rank(&env, &user, validate_leaderboard_type(leaderboard_type)?)
    }

    /// Get user points
    pub fn get_points(env: Env, user: Address) -> Result<u32, ContractError> {
        get_user_points(&env, &user)
    }

    /// Get user level
    pub fn get_level(env: Env, user: Address) -> Result<u32, ContractError> {
        get_user_level(&env, &user)
    }

    /// Award points to a user. Admin-only.
    pub fn award_user_points(env: Env, user: Address, points: u32) -> Result<u32, ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&storage::KEY_ADMIN)
            .ok_or(ContractError::Unauthorized)?;
        AccessControl::require_role_auth(&admin);

        award_points(&env, &user, points)?;
        update_level(&env, &user)?;

        let total_points = get_user_points(&env, &user)?;

        env.events()
            .publish(("achievements", "points_awarded"), (user, points));

        Ok(total_points)
    }

    /// Record a contribution for achievement tracking
    pub fn record_contribution(
        env: Env,
        user: Address,
        campaign_id: String,
        amount: i128,
    ) -> Result<(), ContractError> {
        user.require_auth();

        validate_amount(amount)?;

        store_contribution(&env, &user, &campaign_id, amount)?;
        increment_contribution_stats(&env, &user, amount)?;

        let points = calculate_contribution_points(amount);
        award_points(&env, &user, points)?;
        update_level(&env, &user)?;

        check_contribution_achievements(&env, &user)?;

        env.events().publish(
            ("achievements", "contribution_recorded"),
            (user, campaign_id, amount),
        );

        Ok(())
    }

    /// Record a referral success
    pub fn record_referral(
        env: Env,
        referrer: Address,
        referee: Address,
    ) -> Result<(), ContractError> {
        referrer.require_auth();

        store_referral(&env, &referrer, &referee)?;
        increment_referral_count(&env, &referrer)?;

        award_points(&env, &referrer, 50)?;
        update_level(&env, &referrer)?;

        check_referral_achievements(&env, &referrer)?;

        env.events()
            .publish(("achievements", "referral_recorded"), (referrer, referee));

        Ok(())
    }

    /// Update user contribution streak
    pub fn update_streak(env: Env, user: Address) -> Result<u32, ContractError> {
        user.require_auth();

        let current_time = env.ledger().timestamp();
        let last_contribution_key = DataKey::LastContribution(user.clone());
        let streak_key = DataKey::Streak(user.clone());

        let last_contribution: Option<u64> = env.storage().instance().get(&last_contribution_key);
        let current_streak: u32 = env.storage().instance().get(&streak_key).unwrap_or(0);

        let new_streak = if let Some(last_time) = last_contribution {
            let days_since = (current_time - last_time) / 86400;
            if days_since <= 1 {
                current_streak + 1
            } else {
                1
            }
        } else {
            1
        };

        env.storage()
            .instance()
            .set(&last_contribution_key, &current_time);
        env.storage().instance().set(&streak_key, &new_streak);

        if new_streak > 0 && new_streak % 7 == 0 {
            award_points(&env, &user, 100)?; // Bonus for 7-day streak
            update_level(&env, &user)?;
        }

        env.events()
            .publish(("achievements", "streak_updated"), (user, new_streak));

        Ok(new_streak)
    }
}

// ── Helper Functions ────────────────────────────────────────────────────────

/// Achievement type thresholds for the two auto-unlock checks below. Names
/// match the `get_achievement_points` table.
const FIRST_CONTRIBUTION_TYPE: u32 = 1;
const CONSISTENT_CONTRIBUTOR_TYPE: u32 = 4;
const CONSISTENT_CONTRIBUTOR_COUNT: u32 = 5;
const MEGA_DONOR_TYPE: u32 = 3;
const MEGA_DONOR_TOTAL: i128 = 1_000_000_000;
const REFERRAL_CHAMPION_TYPE: u32 = 7;
const REFERRAL_CHAMPION_COUNT: u32 = 3;

/// Perform the shared "unlock" side effects: store the NFT, award points,
/// refresh the user's level, push a leaderboard entry, and publish an event.
/// Callers are responsible for checking `has_achievement` first.
#[allow(deprecated)]
fn do_unlock(
    env: &Env,
    user: &Address,
    achievement_type: u32,
    metadata: String,
) -> Result<AchievementNFT, ContractError> {
    let unlocked_at = env.ledger().timestamp();

    // Store compact record (v2) — no `user` or `nft_id` on ledger.
    store_achievement(env, user, achievement_type, unlocked_at, metadata.clone())?;

    let points = get_achievement_points(achievement_type);
    award_points(env, user, points)?;
    // update_level now only reads points + derives the level — no Level write.
    let new_level = update_level(env, user)?;

    add_leaderboard_entry(env, user, points, LeaderboardType::Achievements)?;

    env.events().publish(
        ("achievements", "unlocked"),
        (user.clone(), achievement_type, new_level),
    );

    // Reconstruct full public NFT (nft_id derived, not read from ledger).
    let nft = AchievementNFT {
        user: user.clone(),
        achievement_type,
        unlocked_at,
        metadata,
        nft_id: generate_nft_id(env, user, achievement_type),
    };
    Ok(nft)
}

/// Unlock `achievement_type` for `user` if not already unlocked; a no-op
/// otherwise. Used by the automatic contribution/referral achievement checks,
/// which must never fail or double-award just because a milestone was
/// already reached.
fn try_auto_unlock(env: &Env, user: &Address, achievement_type: u32) -> Result<(), ContractError> {
    if has_achievement(env, user, achievement_type)? {
        return Ok(());
    }
    do_unlock(env, user, achievement_type, String::from_str(env, ""))?;
    Ok(())
}

/// Recomputes `user`'s level from their current points (derived, not stored).
/// Returns the computed level.
fn update_level(env: &Env, user: &Address) -> Result<u32, ContractError> {
    let points = get_user_points(env, user)?;
    Ok(points::calculate_level_from_points(points))
}

/// Generate a unique NFT id by hashing the user's address and achievement
/// type, hex-encoded. Purely informational metadata — achievements are
/// looked up by `(user, achievement_type)`, not by this id.
fn generate_nft_id(env: &Env, user: &Address, achievement_type: u32) -> String {
    let mut data: Bytes = user.to_string().to_bytes();
    data.extend_from_array(&achievement_type.to_be_bytes());

    let hash = env.crypto().keccak256(&data);
    let raw: [u8; 32] = hash.into();

    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut hex_buf = [0u8; 64];
    for (i, byte) in raw.iter().enumerate() {
        hex_buf[i * 2] = HEX[(byte >> 4) as usize];
        hex_buf[i * 2 + 1] = HEX[(byte & 0x0f) as usize];
    }

    let hex_str = core::str::from_utf8(&hex_buf).unwrap();
    String::from_str(env, hex_str)
}

/// Store achievement as a compact [`AchievementRecord`] (v2 layout).
fn store_achievement(
    env: &Env,
    user: &Address,
    achievement_type: u32,
    unlocked_at: u64,
    metadata: String,
) -> Result<(), ContractError> {
    achievements::store_achievement_record(env, user, achievement_type, unlocked_at, metadata)
}

/// Get achievement points based on type
fn get_achievement_points(achievement_type: u32) -> u32 {
    match achievement_type {
        1 => 50,   // First Contribution
        2 => 150,  // Super Supporter
        3 => 300,  // Mega Donor
        4 => 200,  // Consistent Contributor
        5 => 100,  // Social Butterfly
        6 => 250,  // Viral Sharer
        7 => 400,  // Referral Champion
        8 => 100,  // Campaign Completionist
        9 => 200,  // Milestone Hunter
        10 => 350, // Community Supporter
        11 => 75,  // Early Bird
        12 => 500, // Goal Crusher
        13 => 600, // Trending Backer
        _ => 50,
    }
}

/// Calculate contribution points
fn calculate_contribution_points(amount: i128) -> u32 {
    // 1 point per stroop (0.0000001 XLM)
    ((amount / 1_000_000) as u32).clamp(1, 1000)
}

/// Store contribution record
fn store_contribution(
    env: &Env,
    user: &Address,
    campaign_id: &String,
    amount: i128,
) -> Result<(), ContractError> {
    let key = DataKey::Contribution(user.clone(), campaign_id.clone());
    env.storage().instance().set(&key, &amount);
    Ok(())
}

/// Increment the aggregate contribution count/total used by
/// [`check_contribution_achievements`].
fn increment_contribution_stats(
    env: &Env,
    user: &Address,
    amount: i128,
) -> Result<(), ContractError> {
    let count_key = DataKey::ContributionCount(user.clone());
    let count: u32 = env.storage().instance().get(&count_key).unwrap_or(0);
    env.storage()
        .instance()
        .set(&count_key, &(count.saturating_add(1)));

    let total_key = DataKey::ContributionTotal(user.clone());
    let total: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
    env.storage()
        .instance()
        .set(&total_key, &(total.saturating_add(amount)));

    Ok(())
}

/// Store referral record
fn store_referral(env: &Env, referrer: &Address, referee: &Address) -> Result<(), ContractError> {
    let key = DataKey::Referral(referrer.clone(), referee.clone());
    let timestamp = env.ledger().timestamp();
    env.storage().instance().set(&key, &timestamp);
    Ok(())
}

/// Increment the referral count used by [`check_referral_achievements`].
fn increment_referral_count(env: &Env, referrer: &Address) -> Result<(), ContractError> {
    let key = DataKey::ReferralCount(referrer.clone());
    let count: u32 = env.storage().instance().get(&key).unwrap_or(0);
    env.storage()
        .instance()
        .set(&key, &(count.saturating_add(1)));
    Ok(())
}

/// Check for contribution-based achievements: unlocks "First Contribution" on
/// the first recorded contribution, "Consistent Contributor" once the user
/// has contributed `CONSISTENT_CONTRIBUTOR_COUNT` times, and "Mega Donor"
/// once their cumulative contribution total reaches `MEGA_DONOR_TOTAL`.
fn check_contribution_achievements(env: &Env, user: &Address) -> Result<(), ContractError> {
    let count: u32 = env
        .storage()
        .instance()
        .get(&DataKey::ContributionCount(user.clone()))
        .unwrap_or(0);
    let total: i128 = env
        .storage()
        .instance()
        .get(&DataKey::ContributionTotal(user.clone()))
        .unwrap_or(0);

    if count >= 1 {
        try_auto_unlock(env, user, FIRST_CONTRIBUTION_TYPE)?;
    }
    if count >= CONSISTENT_CONTRIBUTOR_COUNT {
        try_auto_unlock(env, user, CONSISTENT_CONTRIBUTOR_TYPE)?;
    }
    if total >= MEGA_DONOR_TOTAL {
        try_auto_unlock(env, user, MEGA_DONOR_TYPE)?;
    }

    Ok(())
}

/// Check for referral-based achievements: unlocks "Referral Champion" once
/// the referrer has `REFERRAL_CHAMPION_COUNT` successful referrals.
fn check_referral_achievements(env: &Env, referrer: &Address) -> Result<(), ContractError> {
    let count: u32 = env
        .storage()
        .instance()
        .get(&DataKey::ReferralCount(referrer.clone()))
        .unwrap_or(0);

    if count >= REFERRAL_CHAMPION_COUNT {
        try_auto_unlock(env, referrer, REFERRAL_CHAMPION_TYPE)?;
    }

    Ok(())
}
