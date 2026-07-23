/// Storage management for the achievements contract
use soroban_sdk::{contracttype, symbol_short, Address, String, Symbol};

/// Instance storage key for the admin address set during `initialize`.
pub const KEY_ADMIN: Symbol = symbol_short!("admin");
/// Instance storage key for the platform address set during `initialize`.
pub const KEY_PLATFORM: Symbol = symbol_short!("platform");

/// Parameterized storage key variants.
///
/// Replaces the ad hoc `format!("...:{}", ...)` string keys that used to be
/// built throughout this crate — `soroban_sdk` does not export a `format!`
/// macro, so those calls never compiled. This mirrors the `RegDataKey`
/// pattern already used by `registry` (`contracts/registry/src/lib.rs`).
#[contracttype]
pub enum DataKey {
    /// Total points accumulated by a user.
    Points(Address),
    /// Cached level for a user.
    Level(Address),
    /// Current contribution streak (days) for a user.
    Streak(Address),
    /// Timestamp of a user's last recorded contribution.
    LastContribution(Address),
    /// A single unlocked achievement: (user, achievement_type) -> AchievementNFT.
    Achievement(Address, u32),
    /// A single contribution record: (user, campaign_id) -> amount.
    Contribution(Address, String),
    /// Total number of contributions a user has recorded.
    ContributionCount(Address),
    /// Cumulative contribution amount a user has recorded.
    ContributionTotal(Address),
    /// A single referral record: (referrer, referee) -> timestamp.
    Referral(Address, Address),
    /// Total number of successful referrals a user has recorded.
    ReferralCount(Address),
    /// A user's score on a given leaderboard: (leaderboard_type, user) -> score.
    LeaderboardScore(u32, Address),
    /// Sorted (descending score) membership index for a leaderboard type.
    LeaderboardIndex(u32),
}
