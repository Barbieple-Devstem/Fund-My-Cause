/// Leaderboard management functions
use crate::errors::ContractError;
use crate::storage::DataKey;
use crate::types::{LeaderboardEntry, LeaderboardType};
use soroban_sdk::{Address, Env, Vec};

fn get_score(env: &Env, user: &Address, leaderboard_type: LeaderboardType) -> u32 {
    let key = DataKey::LeaderboardScore(leaderboard_type as u32, user.clone());
    env.storage().instance().get(&key).unwrap_or(0)
}

fn get_index(env: &Env, leaderboard_type: LeaderboardType) -> Vec<Address> {
    let key = DataKey::LeaderboardIndex(leaderboard_type as u32);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

fn set_index(env: &Env, leaderboard_type: LeaderboardType, index: &Vec<Address>) {
    let key = DataKey::LeaderboardIndex(leaderboard_type as u32);
    env.storage().instance().set(&key, index);
}

/// Re-insert `user` into the sorted (descending-score) index for `leaderboard_type`,
/// using the caller-supplied `score` (already just read/written by the caller,
/// so this doesn't re-fetch `DataKey::LeaderboardScore` for `user`).
fn reindex_user(env: &Env, user: &Address, leaderboard_type: LeaderboardType, score: u32) {
    let mut index = get_index(env, leaderboard_type);

    if let Some(pos) = index.first_index_of(user) {
        let _ = index.remove(pos);
    }

    let mut insert_at = index.len();
    for i in 0..index.len() {
        let existing = index.get(i).unwrap();
        if score > get_score(env, &existing, leaderboard_type) {
            insert_at = i;
            break;
        }
    }
    index.insert(insert_at, user.clone());

    set_index(env, leaderboard_type, &index);
}

/// Add `score_delta` to `user`'s cumulative score on `leaderboard_type` and
/// keep the sorted index up to date. Cumulative rather than absolute so that
/// repeated calls (e.g. one per achievement unlocked) accumulate a running
/// total instead of clobbering it with just the latest delta.
pub fn add_leaderboard_entry(
    env: &Env,
    user: &Address,
    score_delta: u32,
    leaderboard_type: LeaderboardType,
) -> Result<(), ContractError> {
    let key = DataKey::LeaderboardScore(leaderboard_type as u32, user.clone());
    let current: u32 = env.storage().instance().get(&key).unwrap_or(0);
    let new_score = current.saturating_add(score_delta);
    env.storage().instance().set(&key, &new_score);
    reindex_user(env, user, leaderboard_type, new_score);
    Ok(())
}

/// Get leaderboard entries, ranked by score descending, up to `limit`.
pub fn get_leaderboard(
    env: &Env,
    leaderboard_type: LeaderboardType,
    limit: usize,
) -> Result<Vec<LeaderboardEntry>, ContractError> {
    let index = get_index(env, leaderboard_type);
    let mut entries = Vec::new(env);

    let take = (limit as u32).min(index.len());
    for i in 0..take {
        let user = index.get(i).unwrap();
        let score = get_score(env, &user, leaderboard_type);
        let achievements = crate::achievements::count_achievements(env, &user).unwrap_or(0);
        let level = crate::points::get_user_level(env, &user).unwrap_or(1);

        entries.push_back(LeaderboardEntry {
            user,
            rank: i + 1,
            score,
            achievements,
            level,
            updated_at: env.ledger().timestamp(),
        });
    }

    Ok(entries)
}

/// Get user rank on leaderboard (1-based). Returns `UserNotFound` if the user
/// has no entry on this leaderboard.
pub fn get_user_rank(
    env: &Env,
    user: &Address,
    leaderboard_type: LeaderboardType,
) -> Result<u32, ContractError> {
    let index = get_index(env, leaderboard_type);
    match index.first_index_of(user) {
        Some(pos) => Ok(pos + 1),
        None => Err(ContractError::UserNotFound),
    }
}

/// Update user on leaderboard
#[allow(dead_code)]
pub fn update_leaderboard_entry(
    env: &Env,
    user: &Address,
    score: u32,
    leaderboard_type: LeaderboardType,
) -> Result<(), ContractError> {
    add_leaderboard_entry(env, user, score, leaderboard_type)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    // All unit tests must call storage through `env.as_contract(&id, || ...)`
    // because `instance()` storage is only accessible from within a contract
    // execution context.  We register a minimal stub contract just to get a
    // valid contract ID to pass to `as_contract`.
    fn make_env() -> (Env, soroban_sdk::Address) {
        let env = Env::default();
        // Register an empty contract so we have a real contract ID.
        let id = env.register(crate::AchievementsContract, ());
        (env, id)
    }

    #[test]
    fn empty_leaderboard_returns_no_entries() {
        let (env, id) = make_env();
        env.as_contract(&id, || {
            let entries = get_leaderboard(&env, LeaderboardType::Points, 10).unwrap();
            assert_eq!(entries.len(), 0);
        });
    }

    #[test]
    fn rank_for_unknown_user_is_not_found() {
        let (env, id) = make_env();
        let user = Address::generate(&env);
        env.as_contract(&id, || {
            assert_eq!(
                get_user_rank(&env, &user, LeaderboardType::Points),
                Err(ContractError::UserNotFound)
            );
        });
    }

    #[test]
    fn single_entry_is_ranked_first() {
        let (env, id) = make_env();
        let user = Address::generate(&env);
        env.as_contract(&id, || {
            add_leaderboard_entry(&env, &user, 100, LeaderboardType::Points).unwrap();

            assert_eq!(get_user_rank(&env, &user, LeaderboardType::Points), Ok(1));
            let entries = get_leaderboard(&env, LeaderboardType::Points, 10).unwrap();
            assert_eq!(entries.len(), 1);
            assert_eq!(entries.get(0).unwrap().score, 100);
        });
    }

    #[test]
    fn entries_are_sorted_descending_by_score() {
        let (env, id) = make_env();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let c = Address::generate(&env);

        env.as_contract(&id, || {
            add_leaderboard_entry(&env, &a, 50, LeaderboardType::Points).unwrap();
            add_leaderboard_entry(&env, &b, 200, LeaderboardType::Points).unwrap();
            add_leaderboard_entry(&env, &c, 100, LeaderboardType::Points).unwrap();

            let entries = get_leaderboard(&env, LeaderboardType::Points, 10).unwrap();
            assert_eq!(entries.len(), 3);
            assert_eq!(entries.get(0).unwrap().user, b);
            assert_eq!(entries.get(1).unwrap().user, c);
            assert_eq!(entries.get(2).unwrap().user, a);

            assert_eq!(get_user_rank(&env, &b, LeaderboardType::Points), Ok(1));
            assert_eq!(get_user_rank(&env, &c, LeaderboardType::Points), Ok(2));
            assert_eq!(get_user_rank(&env, &a, LeaderboardType::Points), Ok(3));
        });
    }

    #[test]
    fn limit_truncates_results() {
        let (env, id) = make_env();
        env.as_contract(&id, || {
            for score in [10u32, 20, 30, 40] {
                let user = Address::generate(&env);
                add_leaderboard_entry(&env, &user, score, LeaderboardType::Points).unwrap();
            }

            let entries = get_leaderboard(&env, LeaderboardType::Points, 2).unwrap();
            assert_eq!(entries.len(), 2);
            assert_eq!(entries.get(0).unwrap().score, 40);
            assert_eq!(entries.get(1).unwrap().score, 30);
        });
    }

    #[test]
    fn additional_score_accumulates_and_reorders_index() {
        let (env, id) = make_env();
        let a = Address::generate(&env);
        let b = Address::generate(&env);

        env.as_contract(&id, || {
            add_leaderboard_entry(&env, &a, 10, LeaderboardType::Points).unwrap();
            add_leaderboard_entry(&env, &b, 20, LeaderboardType::Points).unwrap();
            assert_eq!(get_user_rank(&env, &b, LeaderboardType::Points), Ok(1));

            // `a` earns 25 more (cumulative 35) and overtakes `b`.
            add_leaderboard_entry(&env, &a, 25, LeaderboardType::Points).unwrap();
            assert_eq!(get_user_rank(&env, &a, LeaderboardType::Points), Ok(1));
            assert_eq!(get_user_rank(&env, &b, LeaderboardType::Points), Ok(2));

            let entries = get_leaderboard(&env, LeaderboardType::Points, 10).unwrap();
            assert_eq!(entries.get(0).unwrap().user, a);
            assert_eq!(entries.get(0).unwrap().score, 35);
        });
    }

    #[test]
    fn leaderboard_types_are_independent() {
        let (env, id) = make_env();
        let user = Address::generate(&env);

        env.as_contract(&id, || {
            add_leaderboard_entry(&env, &user, 100, LeaderboardType::Points).unwrap();
            assert_eq!(
                get_user_rank(&env, &user, LeaderboardType::Contributions),
                Err(ContractError::UserNotFound)
            );
        });
    }
}
