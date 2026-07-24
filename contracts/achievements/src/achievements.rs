/// Achievement management functions
use crate::errors::ContractError;
use crate::storage::DataKey;
use crate::types::AchievementNFT;
use soroban_sdk::{Address, Env, Vec};

/// Get user achievements
pub fn get_user_achievements(
    env: &Env,
    user: &Address,
) -> Result<Vec<AchievementNFT>, ContractError> {
    let mut achievements = Vec::new(env);

    // Check all possible achievement types (1-13)
    for achievement_type in 1..=13u32 {
        let key = DataKey::Achievement(user.clone(), achievement_type);
        if let Some(nft) = env.storage().instance().get::<_, AchievementNFT>(&key) {
            achievements.push_back(nft);
        }
    }

    Ok(achievements)
}

/// Check if user has specific achievement
pub fn has_achievement(
    env: &Env,
    user: &Address,
    achievement_type: u32,
) -> Result<bool, ContractError> {
    let key = DataKey::Achievement(user.clone(), achievement_type);
    Ok(env.storage().instance().has(&key))
}

/// Get achievement unlock timestamp
#[allow(dead_code)]
pub fn get_achievement_unlock_time(
    env: &Env,
    user: &Address,
    achievement_type: u32,
) -> Result<u64, ContractError> {
    let key = DataKey::Achievement(user.clone(), achievement_type);
    let nft: AchievementNFT = env
        .storage()
        .instance()
        .get(&key)
        .ok_or(ContractError::KeyNotFound)?;
    Ok(nft.unlocked_at)
}

/// Get all users with specific achievement
#[allow(dead_code)]
pub fn get_achievement_holders(
    env: &Env,
    _achievement_type: u32,
) -> Result<Vec<Address>, ContractError> {
    // This would need to be tracked separately in a reverse index.
    // For now, return empty vector.
    Ok(Vec::new(env))
}

/// Count user achievements
pub fn count_achievements(env: &Env, user: &Address) -> Result<u32, ContractError> {
    let achievements = get_user_achievements(env, user)?;
    Ok(achievements.len())
}
