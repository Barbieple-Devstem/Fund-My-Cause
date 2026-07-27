//! # Registry Admin/Mutation Integration Tests
//!
//! Covers every state-mutating entry-point split out into
//! `contracts/registry/src/admin.rs`: `initialize`, `register`,
//! `register_with_category`, `register_with_status`, and `update_status`.
//! Verifies:
//! - Unauthorized callers are **rejected**.
//! - Authorized callers succeed.
//! - Error codes match `ContractError` variants.
//! - The admin-only entry-point (`update_status`) specifically rejects
//!   non-admin and unauthenticated callers with an auth abort — see the
//!   `update_status() — admin-only` section below for the full rationale.
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
use registry::{CampaignStatus, ContractError, RegistryContractClient};

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
// update_status() — admin-only: explicit non-admin / unauthenticated rejection
// ═══════════════════════════════════════════════════════════════════════════════
//
// `update_status` is the registry's *only* entry point gated on the stored
// admin address (see the module doc-comment's Access Control table).
// `initialize` also calls `require_auth()`, but on a caller-supplied address
// with no pre-existing admin to compare against — it isn't a privileged
// "admin-only" check, so it's out of scope here. `register*` functions are
// gated on the campaign's own signature, not the admin's, and are already
// covered by the `*_requires_campaign_auth` tests above.
//
// Soroban enforces `require_auth()` at the host level: a call lacking the
// required signature aborts before the contract's own `Result` logic runs,
// so `try_update_status` surfaces it as `Err(Err(InvokeError::Abort))`
// rather than a `ContractError` variant. Asserting that exact shape (instead
// of a bare `#[should_panic]`) pins the failure down to specifically an auth
// rejection rather than any other panic.
//
// The registry has no role-revocation or admin-transfer entry point (see
// `src/lib.rs` — `KEY_ADMIN` is set once in `initialize` and never
// rewritten), so the "admin whose role was just revoked" boundary case does
// not apply to this contract.

/// Mock exactly one signer for a specific `update_status` invocation, so
/// `admin.require_auth()` inside the contract only succeeds if `signer` is
/// that stored admin.
fn mock_update_status_signer(
    env: &Env,
    client: &RegistryContractClient,
    signer: &Address,
    campaign_id: &Address,
    old_status: CampaignStatus,
    new_status: CampaignStatus,
) {
    use soroban_sdk::testutils::{MockAuth, MockAuthInvoke};
    use soroban_sdk::IntoVal;

    env.set_auths(&[]);
    env.mock_auths(&[MockAuth {
        address: signer,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "update_status",
            args: (campaign_id.clone(), old_status, new_status).into_val(env),
            sub_invokes: &[],
        },
    }]);
}

#[test]
fn test_update_status_rejects_non_admin_signer() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    client.register_with_status(&campaign, &CampaignStatus::Active);

    // A real, distinct address signs the call — but it is not the stored admin.
    let attacker = Address::generate(&env);
    mock_update_status_signer(
        &env,
        &client,
        &attacker,
        &campaign,
        CampaignStatus::Active,
        CampaignStatus::Successful,
    );

    let result = client.try_update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );
    assert_eq!(
        result,
        Err(Err(soroban_sdk::InvokeError::Abort)),
        "update_status must reject a signer that is not the stored admin"
    );

    // The rejected call must have had no effect on state.
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
}

#[test]
fn test_update_status_rejects_campaign_signing_for_itself() {
    // The campaign is a real, registered actor — but it is not the admin, so
    // it must not be able to update its own status by self-authorizing.
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    client.register_with_status(&campaign, &CampaignStatus::Active);

    mock_update_status_signer(
        &env,
        &client,
        &campaign,
        &campaign,
        CampaignStatus::Active,
        CampaignStatus::Successful,
    );

    let result = client.try_update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );
    assert_eq!(
        result,
        Err(Err(soroban_sdk::InvokeError::Abort)),
        "update_status must reject the campaign signing for its own status change"
    );
}

#[test]
fn test_update_status_rejects_unauthenticated_caller() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    client.register_with_status(&campaign, &CampaignStatus::Active);

    // No signature at all — not even a mocked one for a wrong address.
    env.set_auths(&[]);
    let result = client.try_update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );
    assert_eq!(
        result,
        Err(Err(soroban_sdk::InvokeError::Abort)),
        "update_status must reject a call carrying no authorization at all"
    );

    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
}

#[test]
fn test_update_status_admin_only_signer_succeeds() {
    // Dedicated authorized-success test: the *stored admin, and only the
    // stored admin*, signs the invocation (as opposed to the broader
    // `mock_all_auths()` used by `test_update_status_moves_campaign_between_buckets`).
    let env = Env::default();
    let (client, admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    env.mock_all_auths();
    client.register_with_status(&campaign, &CampaignStatus::Active);

    mock_update_status_signer(
        &env,
        &client,
        &admin,
        &campaign,
        CampaignStatus::Active,
        CampaignStatus::Successful,
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
