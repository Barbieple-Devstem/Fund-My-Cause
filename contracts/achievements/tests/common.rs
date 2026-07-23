//! Shared test fixtures for the achievements contract integration tests.

#![cfg(test)]
#![allow(dead_code)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use achievements::{AchievementsContract, AchievementsContractClient};

/// Deploy a fresh, uninitialized achievements contract.
pub fn deploy(env: &Env) -> AchievementsContractClient {
    let id = env.register_contract(None, AchievementsContract);
    AchievementsContractClient::new(env, &id)
}

/// Deploy and initialize an achievements contract; returns the client, admin,
/// and platform address.
pub fn deploy_and_init(env: &Env) -> (AchievementsContractClient, Address, Address) {
    let client = deploy(env);
    let admin = Address::generate(env);
    let platform = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin, &platform);
    (client, admin, platform)
}
