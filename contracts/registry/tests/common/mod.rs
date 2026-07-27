//! Shared test setup for the registry integration test suite.
//!
//! Lives under `tests/common/mod.rs` (not `tests/common.rs`) so cargo treats
//! it as a shared module rather than its own top-level integration-test
//! binary — both `tests/admin.rs` and `tests/lookup.rs` pull it in via
//! `mod common;`.

#![cfg(test)]
#![allow(dead_code)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use registry::{RegistryContract, RegistryContractClient};

/// Deploy a fresh registry contract and return its client.
/// The contract is **not** initialised — callers must call `initialize` themselves.
pub fn deploy(env: &Env) -> RegistryContractClient {
    let id = env.register_contract(None, RegistryContract);
    RegistryContractClient::new(env, &id)
}

/// Deploy and initialise a registry; returns the client and the admin address.
pub fn deploy_and_init(env: &Env) -> (RegistryContractClient, Address) {
    let client = deploy(env);
    let admin = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin);
    (client, admin)
}
