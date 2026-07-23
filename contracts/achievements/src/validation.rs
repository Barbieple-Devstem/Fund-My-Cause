/// Validation utilities for the achievements contract
use crate::errors::ContractError;
use crate::types::LeaderboardType;

/// Validate achievement type (1-13)
pub fn validate_achievement_type(achievement_type: u32) -> Result<(), ContractError> {
    if !(1..=13).contains(&achievement_type) {
        return Err(ContractError::InvalidAchievementType);
    }
    Ok(())
}

/// Validate leaderboard type
pub fn validate_leaderboard_type(leaderboard_type: u32) -> Result<LeaderboardType, ContractError> {
    match leaderboard_type {
        1 => Ok(LeaderboardType::Points),
        2 => Ok(LeaderboardType::Contributions),
        3 => Ok(LeaderboardType::Achievements),
        4 => Ok(LeaderboardType::Referrals),
        _ => Err(ContractError::InvalidLeaderboardType),
    }
}

/// Validate amount (must be positive)
pub fn validate_amount(amount: i128) -> Result<(), ContractError> {
    if amount <= 0 {
        return Err(ContractError::InvalidAmount);
    }
    Ok(())
}

/// Validate metadata string length
pub fn validate_metadata(metadata: &str) -> Result<(), ContractError> {
    if metadata.len() > 1000 {
        return Err(ContractError::InvalidMetadata);
    }
    Ok(())
}
