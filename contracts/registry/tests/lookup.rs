//! # Registry Lookup (Read-Only) Integration Tests
//!
//! Covers the three public, unauthenticated query entry-points split out
//! into `contracts/registry/src/lookup.rs`: `list`, `list_by_status`, and
//! `get_campaigns_by_category`. All are read-only and require no auth.

#![cfg(test)]

mod common;

use soroban_sdk::{testutils::Address as _, Address, Env};

use common::deploy_and_init;
use registry::CampaignStatus;

// ═══════════════════════════════════════════════════════════════════════════════
// Read-only queries — no auth required
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_list_pagination() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    env.mock_all_auths();
    for _ in 0..5 {
        client.register(&Address::generate(&env));
    }

    assert_eq!(client.list(&0, &3).len(), 3);
    assert_eq!(client.list(&3, &3).len(), 2);
    assert_eq!(client.list(&5, &3).len(), 0);
    assert_eq!(client.list(&0, &0).len(), 0);
}

#[test]
fn test_list_by_status_pagination() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    env.mock_all_auths();
    for _ in 0..5 {
        client.register_with_status(&Address::generate(&env), &CampaignStatus::Active);
    }

    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &0, &3).len(),
        3
    );
    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &3, &3).len(),
        2
    );
    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &5, &3).len(),
        0
    );
    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &0, &0).len(),
        0
    );
}

#[test]
fn test_get_campaigns_by_category_pagination() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    env.mock_all_auths();
    for _ in 0..4 {
        client.register_with_category(&Address::generate(&env), &2);
    }

    assert_eq!(client.get_campaigns_by_category(&2, &0, &2).len(), 2);
    assert_eq!(client.get_campaigns_by_category(&2, &2, &2).len(), 2);
    assert_eq!(client.get_campaigns_by_category(&2, &4, &2).len(), 0);
    assert_eq!(client.get_campaigns_by_category(&2, &0, &0).len(), 0);
}
