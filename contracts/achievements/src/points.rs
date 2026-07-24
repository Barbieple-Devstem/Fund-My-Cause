/// Points and level management functions
use crate::errors::ContractError;
use crate::storage::DataKey;
use soroban_sdk::Address;
use soroban_sdk::Env;

/// Award points to a user
pub fn award_points(env: &Env, user: &Address, points: u32) -> Result<(), ContractError> {
    let key = DataKey::Points(user.clone());
    let current_points: u32 = env.storage().instance().get(&key).unwrap_or(0);
    let new_points = current_points.saturating_add(points);
    env.storage().instance().set(&key, &new_points);
    Ok(())
}

/// Get user points
pub fn get_user_points(env: &Env, user: &Address) -> Result<u32, ContractError> {
    let key = DataKey::Points(user.clone());
    Ok(env.storage().instance().get(&key).unwrap_or(0))
}

/// Get user level
pub fn get_user_level(env: &Env, user: &Address) -> Result<u32, ContractError> {
    let key = DataKey::Level(user.clone());
    let level: u32 = env.storage().instance().get(&key).unwrap_or(1);
    Ok(level)
}

/// Update user level
pub fn set_user_level(env: &Env, user: &Address, level: u32) -> Result<(), ContractError> {
    let key = DataKey::Level(user.clone());
    env.storage().instance().set(&key, &level);
    Ok(())
}

/// Calculate level from points
pub fn calculate_level_from_points(points: u32) -> u32 {
    // 100 points per level, max 100
    (points / 100 + 1).min(100)
}

/// Deduct points from user
#[allow(dead_code)]
pub fn deduct_points(env: &Env, user: &Address, points: u32) -> Result<(), ContractError> {
    let key = DataKey::Points(user.clone());
    let current_points: u32 = env.storage().instance().get(&key).unwrap_or(0);

    if current_points < points {
        return Err(ContractError::InsufficientPoints);
    }

    let new_points = current_points - points;
    env.storage().instance().set(&key, &new_points);
    Ok(())
}

/// Reset points (admin only)
#[allow(dead_code)]
pub fn reset_points(env: &Env, user: &Address) -> Result<(), ContractError> {
    let key = DataKey::Points(user.clone());
    env.storage().instance().set(&key, &0u32);
    Ok(())
}
