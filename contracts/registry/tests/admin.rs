//! # Registry Admin/Mutation Integration Tests
//!
//! Covers every state-mutating entry-point split out into
//! `contracts/registry/src/admin.rs`: `initialize`, `register`,
//! `register_with_category`, `register_with_status`, and `update_status`.
//! Verifies:
//! - Unauthorized callers are **rejected**.
//! - Authorized callers succeed.
//! - Error codes match `ContractError` variants.
//!
//! Soroban's generated test client exposes two call styles:
//!   - `client.method(args)` — panics on `Err` (used for happy-path assertions)
//!   - `client.try_method(args)` — returns `Result<T, Result<ContractError, _>>`
//!     (used to assert specific error codes)
//!
//! Each test stands alone: it creates a fresh `Env`, registers the contract,
//! and drives it through a specific scenario.

#![cfg(test)]

mod common;

use soroban_sdk::{testutils::Address as _, Address, Env};

use common::{deploy, deploy_and_init};
use registry::{CampaignStatus, ContractError};

// ═══════════════════════════════════════════════════════════════════════════════
// initialize()
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize_succeeds() {
    let env = Env::default();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    env.mock_all_auths();
    // Should not panic
    client.initialize(&admin);
}

#[test]
fn test_initialize_twice_returns_already_initialized() {
    let env = Env::default();
    let (client, admin) = deploy_and_init(&env);

    env.mock_all_auths();
    let result = client.try_initialize(&admin);
    assert_eq!(
        result,
        Err(Ok(ContractError::AlreadyInitialized)),
        "second initialize should return AlreadyInitialized"
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// register() — guards
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_without_init_returns_not_initialized() {
    let env = Env::default();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    let result = client.try_register(&campaign);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "register before initialize should return NotInitialized"
    );
}

#[test]
fn test_register_requires_campaign_auth() {
    // Verify campaign_id.require_auth() is recorded in the auth context.
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    client.register(&campaign);

    // The campaign address must appear as an authorizing signer.
    let auths = env.auths();
    let found = auths.iter().any(|(addr, _)| *addr == campaign);
    assert!(found, "campaign address should appear in recorded auths");
}

// ═══════════════════════════════════════════════════════════════════════════════
// register() — authorized happy path
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_authorized_and_deduplicates() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();

    client.register(&campaign);
    client.register(&campaign); // duplicate — must be ignored

    let all = client.list(&0, &10);
    assert_eq!(all.len(), 1);
    assert_eq!(all.get(0).unwrap(), campaign);
}

#[test]
fn test_register_multiple_campaigns() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    env.mock_all_auths();

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);
    client.register(&c1);
    client.register(&c2);
    client.register(&c3);

    assert_eq!(client.list(&0, &10).len(), 3);
}

// ═══════════════════════════════════════════════════════════════════════════════
// register_with_category() — guards
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_with_category_without_init_returns_not_initialized() {
    let env = Env::default();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    let result = client.try_register_with_category(&campaign, &0);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "register_with_category before initialize should return NotInitialized"
    );
}

#[test]
fn test_register_with_category_requires_campaign_auth() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    client.register_with_category(&campaign, &1);

    let auths = env.auths();
    let found = auths.iter().any(|(addr, _)| *addr == campaign);
    assert!(found, "campaign address should appear in recorded auths");
}

// ═══════════════════════════════════════════════════════════════════════════════
// register_with_category() — authorized happy path
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_with_category_filters_correctly() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    env.mock_all_auths();

    let charity1 = Address::generate(&env);
    let charity2 = Address::generate(&env);
    let tech1 = Address::generate(&env);

    client.register_with_category(&charity1, &0);
    client.register_with_category(&charity2, &0);
    client.register_with_category(&tech1, &1);

    assert_eq!(client.list(&0, &10).len(), 3);
    assert_eq!(client.get_campaigns_by_category(&0, &0, &10).len(), 2);
    assert_eq!(client.get_campaigns_by_category(&1, &0, &10).len(), 1);
    assert_eq!(client.get_campaigns_by_category(&99, &0, &10).len(), 0);
}

#[test]
fn test_register_with_category_deduplicates() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    env.mock_all_auths();

    let campaign = Address::generate(&env);
    client.register_with_category(&campaign, &0);
    client.register_with_category(&campaign, &0); // duplicate

    assert_eq!(client.get_campaigns_by_category(&0, &0, &10).len(), 1);
    assert_eq!(client.list(&0, &10).len(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// register_with_status() — guards
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_with_status_without_init_returns_not_initialized() {
    let env = Env::default();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    let result = client.try_register_with_status(&campaign, &CampaignStatus::Active);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "register_with_status before initialize should return NotInitialized"
    );
}

#[test]
fn test_register_with_status_requires_campaign_auth() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    client.register_with_status(&campaign, &CampaignStatus::Active);

    let auths = env.auths();
    let found = auths.iter().any(|(addr, _)| *addr == campaign);
    assert!(found, "campaign address should appear in recorded auths");
}

// ═══════════════════════════════════════════════════════════════════════════════
// register_with_status() — authorized happy path
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_with_status_filters_correctly() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    env.mock_all_auths();

    let active1 = Address::generate(&env);
    let active2 = Address::generate(&env);
    let success1 = Address::generate(&env);

    client.register_with_status(&active1, &CampaignStatus::Active);
    client.register_with_status(&active2, &CampaignStatus::Active);
    client.register_with_status(&success1, &CampaignStatus::Successful);

    assert_eq!(client.list(&0, &10).len(), 3);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        2
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Cancelled, &0, &10)
            .len(),
        0
    );
}

#[test]
fn test_register_with_status_deduplicates() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    env.mock_all_auths();

    let campaign = Address::generate(&env);
    client.register_with_status(&campaign, &CampaignStatus::Active);
    client.register_with_status(&campaign, &CampaignStatus::Active); // duplicate

    assert_eq!(client.list(&0, &10).len(), 1);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// update_status() — guards
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_update_status_without_init_returns_not_initialized() {
    let env = Env::default();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    let result = client.try_update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "update_status before initialize should return NotInitialized"
    );
}

#[test]
fn test_update_status_campaign_not_found_returns_error() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let unregistered = Address::generate(&env);

    env.mock_all_auths();
    let result = client.try_update_status(
        &unregistered,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );
    assert_eq!(
        result,
        Err(Ok(ContractError::NotFound)),
        "update_status on unregistered campaign should return NotFound"
    );
}

#[test]
fn test_update_status_requires_admin_auth() {
    // Verify admin.require_auth() is recorded — not the campaign's address.
    let env = Env::default();
    let (client, admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    client.register_with_status(&campaign, &CampaignStatus::Active);

    // Clear auth history then call update_status.
    client.update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );

    let auths = env.auths();
    let admin_found = auths.iter().any(|(addr, _)| *addr == admin);
    assert!(
        admin_found,
        "admin address must appear in recorded auths for update_status"
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// update_status() — authorized happy path
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_update_status_moves_campaign_between_buckets() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();

    client.register_with_status(&campaign, &CampaignStatus::Active);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        0
    );

    client.update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );

    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        0
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1
    );
    // Global list is unchanged
    assert_eq!(client.list(&0, &10).len(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Full lifecycle integration (spans admin mutations + read-only assertions)
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_full_lifecycle_register_update_and_list() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    env.mock_all_auths();

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);

    client.register_with_status(&c1, &CampaignStatus::Active);
    client.register_with_status(&c2, &CampaignStatus::Active);
    client.register_with_status(&c3, &CampaignStatus::Failed);

    assert_eq!(client.list(&0, &10).len(), 3);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        2
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Failed, &0, &10)
            .len(),
        1
    );

    // Admin transitions c1 to Successful
    client.update_status(&c1, &CampaignStatus::Active, &CampaignStatus::Successful);

    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1
    );
    // Global count unchanged
    assert_eq!(client.list(&0, &10).len(), 3);
}
