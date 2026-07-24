#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

mod common;
use common::setup;

/// Distinct contributor count must be accurate after repeated contributions
/// from the same address (count should not increment on repeat contributions).
#[test]
fn test_qf_distinct_count_no_double_count() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let c = setup(&env, 10_000, deadline, None);

    let alice = Address::generate(&env);
    c.token_admin.mint(&alice, &3_000i128);

    env.ledger().set_timestamp(100);

    // First contribution
    c.client.contribute(&alice, &1_000, &c.token_id, &None);
    assert_eq!(c.client.get_stats().contributor_count, 1);

    // Repeat contribution from same address — count must stay at 1
    c.client.contribute(&alice, &1_000, &c.token_id, &None);
    assert_eq!(c.client.get_stats().contributor_count, 1);
}

/// Distinct contributor count increments for each new address.
#[test]
fn test_qf_distinct_count_multiple_contributors() {
    let env = Env::default();
    env.mock_all_auths();

    let c = setup(&env, 50_000, 2_000, None);

    env.ledger().set_timestamp(100);

    for i in 0..5u32 {
        let addr = Address::generate(&env);
        c.token_admin.mint(&addr, &1_000i128);
        c.client.contribute(&addr, &1_000, &c.token_id, &None);
        assert_eq!(c.client.get_stats().contributor_count, i + 1);
    }
}

/// get_qf_inputs returns correct per-contributor amounts.
#[test]
fn test_qf_inputs_amounts() {
    let env = Env::default();
    env.mock_all_auths();

    let c = setup(&env, 50_000, 2_000, None);
    env.ledger().set_timestamp(100);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    c.token_admin.mint(&alice, &2_000i128);
    c.token_admin.mint(&bob, &3_000i128);

    c.client.contribute(&alice, &1_500, &c.token_id, &None);
    c.client.contribute(&bob, &3_000, &c.token_id, &None);
    // Alice contributes again — cumulative should be 2000 but capped at max
    // (no max set here, so 1500 + 500 = 2000)
    c.client.contribute(&alice, &500, &c.token_id, &None);

    let inputs = c.client.get_qf_inputs();
    assert_eq!(inputs.contributor_count, 2);

    // First contributor indexed is Alice
    let alice_entry = inputs.contributors.get(0).unwrap();
    assert_eq!(alice_entry.amount, 2_000);

    let bob_entry = inputs.contributors.get(1).unwrap();
    assert_eq!(bob_entry.amount, 3_000);
}
