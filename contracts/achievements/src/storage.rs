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
///
/// # Storage layout changelog
///
/// **v2 (current)** — optimised layout, three redundancies removed:
///
/// * `Level(Address)` **dropped** — level is always `(points/100 + 1).min(100)`
///   so it can be derived from `Points` on every read with no separate write.
///   Any pre-existing `Level` entries left on-ledger are harmless orphans;
///   they will expire naturally and are never read by the new code.
///
/// * `Achievement(Address, u32)` now stores [`AchievementRecord`] instead of
///   the old fat [`AchievementNFT`].  The old struct duplicated `user` (already
///   in the key) and `nft_id` (a 64-byte hex string derivable from the key).
///   Readers that encounter a legacy entry transparently up-cast it.
///   See [`crate::achievements::read_achievement_entry`].
#[contracttype]
pub enum DataKey {
    /// Total points accumulated by a user.
    Points(Address),
    // NOTE: Level(Address) was removed in v2.  Level is now derived on-the-fly
    // from Points via `points::calculate_level_from_points`.  Any legacy
    // Level entries that exist on already-deployed ledgers are safe to ignore;
    // they are never written or read by the current code.
    /// Current contribution streak (days) for a user.
    Streak(Address),
    /// Timestamp of a user's last recorded contribution.
    LastContribution(Address),
    /// A single unlocked achievement: (user, achievement_type) -> AchievementRecord.
    ///
    /// Stored value changed from `AchievementNFT` (v1) to `AchievementRecord`
    /// (v2).  The `user` and `nft_id` fields present in v1 are not stored; they
    /// are re-derived from the key / hash at read time.
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
