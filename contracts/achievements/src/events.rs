/// Event types and handlers for the achievements contract
use soroban_sdk::String;

/// Achievement unlocked event
pub struct AchievementUnlockedEvent {
    pub user: String,
    pub achievement_type: u32,
    pub level: u32,
    pub points_earned: u32,
}

/// Points awarded event
pub struct PointsAwardedEvent {
    pub user: String,
    pub points: u32,
    pub reason: String,
}

/// Level up event
pub struct LevelUpEvent {
    pub user: String,
    pub new_level: u32,
    pub total_points: u32,
}

/// Contribution recorded event
pub struct ContributionRecordedEvent {
    pub user: String,
    pub campaign_id: String,
    pub amount: i128,
}

/// Referral recorded event
pub struct ReferralRecordedEvent {
    pub referrer: String,
    pub referee: String,
    pub points_earned: u32,
}

/// Streak updated event
pub struct StreakUpdatedEvent {
    pub user: String,
    pub new_streak: u32,
}

/// Challenge completed event
pub struct ChallengeCompletedEvent {
    pub user: String,
    pub challenge_id: String,
    pub rank: u32,
    pub reward: i128,
}

/// Milestone reached event
pub struct MilestoneReachedEvent {
    pub user: String,
    pub milestone_type: u32,
    pub value: u32,
}
