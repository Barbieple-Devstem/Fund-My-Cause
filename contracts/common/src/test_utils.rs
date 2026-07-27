//! Shared test utilities and fixtures for Fund-My-Cause Soroban contract testing.
//!
//! This module provides common setup helpers to reduce boilerplate across
//! `crowdfund`, `achievements`, and `registry` test files.
//!
//! # Usage
//!
//! In each contract's test module or test files, import and use:
//!
//! ```ignore
//! use common::test_utils::{setup_env, generate_addresses};
//! ```

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

/// Creates and configures a new test environment with mock authentication.
///
/// # Returns
///
/// A fresh `Env` instance with all authentications mocked (`mock_all_auths()`
/// pre-called so authorization checks pass by default).
pub fn setup_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

/// Generates a random address suitable for use in tests.
///
/// # Parameters
///
/// * `env` — The test environment context.
///
/// # Returns
///
/// A freshly generated `Address` guaranteed to be unique per invocation.
pub fn generate_address(env: &Env) -> Address {
    Address::generate(env)
}

/// Generates multiple random addresses for use in tests.
///
/// # Parameters
///
/// * `env` — The test environment context.
/// * `count` — The number of addresses to generate.
///
/// # Returns
///
/// A vector of `count` unique addresses.
pub fn generate_addresses(env: &Env, count: usize) -> Vec<Address> {
    let mut addresses = Vec::new();
    for _ in 0..count {
        addresses.push(Address::generate(env));
    }
    addresses
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_setup_env_creates_environment() {
        let env = setup_env();
        assert_eq!(env.ledger().sequence(), 0);
    }

    #[test]
    fn test_generate_address_creates_unique_addresses() {
        let env = setup_env();
        let addr1 = generate_address(&env);
        let addr2 = generate_address(&env);
        assert_ne!(addr1, addr2);
    }

    #[test]
    fn test_generate_addresses_creates_correct_count() {
        let env = setup_env();
        let addresses = generate_addresses(&env, 5);
        assert_eq!(addresses.len(), 5);

        // Verify uniqueness
        for i in 0..addresses.len() {
            for j in (i + 1)..addresses.len() {
                assert_ne!(addresses[i], addresses[j]);
            }
        }
    }
}
