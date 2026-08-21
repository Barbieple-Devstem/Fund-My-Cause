//! # Internal Helper Functions
//!
//! This module contains non-public helper functions extracted from the main contract
//! to reduce complexity of large functions like `contribute()`, `initialize()`, etc.
//!
//! These functions are shared helpers used across multiple contract endpoints.

use soroban_sdk::{Address, Env};

use crate::{
    errors::ContractError,
    storage::KEY_CREATOR,
};

/// Validates that the campaign is in Active status and that the caller is the creator.
///
/// This is a common pattern used in many functions that require creator authorization.
///
/// # Returns
/// - `Ok(Address)` — The creator's address (already validated)
/// Reads the campaign creator and requires their authorization, without any
/// status check.
///
/// Access-control changes (whitelist, blacklist, visibility, ownership) are
/// deliberately allowed on a non-Active campaign: a creator still has to be able
/// to correct an access list after the campaign is paused or has ended. Use
/// [`require_active_and_auth_creator`] only where the original function actually
/// gated on `Status::Active`.
pub(crate) fn require_auth_creator(env: &Env) -> Result<Address, ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();
    Ok(creator)
}
