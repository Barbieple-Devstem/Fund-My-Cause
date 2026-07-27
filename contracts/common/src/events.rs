//! Shared event-emission convention for all Fund-My-Cause contracts.
//!
//! ## Convention (issue #924)
//!
//! 1. **Topic**: every event is published under a two-symbol topic tuple
//!    `(contract_name, event_name)`, e.g. `("campaign", "contributed")`,
//!    `("achievements", "unlocked")`, `("registry", "registered")`.
//!    `contract_name` is fixed per contract; `event_name` is
//!    `snake_case` and describes what happened, not what changed.
//! 2. **Payload**: every event's data payload is a `#[contracttype]` struct
//!    (never a raw tuple), so fields are named and indexers don't have to
//!    guess positional meaning.
//! 3. **Field ordering**: identifying fields first (who/what the event is
//!    about — e.g. `user`, `contributor`, `campaign_id`), then the
//!    event-specific data, then `schema_version` last.
//! 4. **Versioning**: every payload struct's last field is
//!    `pub schema_version: u32`, set to [`EVENT_SCHEMA_VERSION`]. Bump this
//!    constant (per contract, if their schemas diverge in the future) when a
//!    field is added, removed, or reordered in a way that would break an
//!    existing indexer parser.
//!
//! Consumers (e.g. `services/indexer`) can rely on: same topic shape, named
//! fields, and a `schema_version` they can branch on across contracts.

/// Shared starting schema version for all contract events. Each contract
/// re-exports this as its own `EVENT_SCHEMA_VERSION` so a future divergence
/// (one contract's event shapes evolving faster than another's) is a
/// one-line change at the re-export site, not a breaking change to this
/// shared constant.
pub const EVENT_SCHEMA_VERSION: u32 = 1;
