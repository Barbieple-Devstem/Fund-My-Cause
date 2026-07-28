//! Typed event payloads for the registry contract.
//!
//! Follows the shared convention documented in `common::events` (issue
//! #924): topic = `("registry", event_name)`, named fields (never raw
//! tuples), identifying fields first, `schema_version` last.
use soroban_sdk::{contracttype, Address};

/// Topic: `("registry", "initialized")`
#[derive(Clone)]
#[contracttype]
pub struct EventInitialized {
    pub admin: Address,
    pub schema_version: u32,
}

/// Topic: `("registry", "registered")`
///
/// Emitted from `register`, `register_with_category`, and
/// `register_with_status` — the same event shape regardless of which entry
/// point added the campaign to the global list.
#[derive(Clone)]
#[contracttype]
pub struct EventRegistered {
    pub campaign_id: Address,
    pub schema_version: u32,
}
