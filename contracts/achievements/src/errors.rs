/// Error types for the achievements contract
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum ContractError {
    /// Contract is already initialized
    AlreadyInitialized = 1,
    /// Unauthorized access
    Unauthorized = 2,
    /// Achievement type is invalid
    InvalidAchievementType = 3,
    /// User not found
    UserNotFound = 4,
    /// Achievement already unlocked
    AchievementAlreadyUnlocked = 5,
    /// Invalid amount provided
    InvalidAmount = 6,
    /// Leaderboard type is invalid
    InvalidLeaderboardType = 7,
    /// Challenge not found
    ChallengeNotFound = 8,
    /// Challenge not active
    ChallengeNotActive = 9,
    /// User already joined challenge
    AlreadyJoinedChallenge = 10,
    /// Insufficient points
    InsufficientPoints = 11,
    /// Storage key not found
    KeyNotFound = 12,
    /// Invalid metadata
    InvalidMetadata = 13,
    /// Referral not found
    ReferralNotFound = 14,
    /// Contribution record not found
    ContributionNotFound = 15,
    /// Streak update failed
    StreakUpdateFailed = 16,
    /// Achievement type is auto-unlocked by on-chain activity tracking and
    /// cannot be claimed directly through `unlock_achievement`.
    AchievementNotSelfUnlockable = 17,
}

impl From<common::CommonError> for ContractError {
    /// Folds the shared [`common::CommonError`] variants into this
    /// contract's own error space. Only `Unauthorized` and
    /// `AlreadyInitialized` have a faithful equivalent here; the rest have
    /// no single accurate match against this contract's more specific
    /// variants (e.g. `UserNotFound`/`ChallengeNotFound`/... rather than one
    /// generic `NotFound`) and are mapped to the closest existing variant.
    fn from(err: common::CommonError) -> Self {
        match err {
            common::CommonError::Unauthorized => ContractError::Unauthorized,
            common::CommonError::AlreadyInitialized => ContractError::AlreadyInitialized,
            common::CommonError::NotFound => ContractError::KeyNotFound,
            common::CommonError::InvalidInput => ContractError::InvalidMetadata,
            common::CommonError::AlreadyExists => ContractError::AchievementAlreadyUnlocked,
        }
    }
}
