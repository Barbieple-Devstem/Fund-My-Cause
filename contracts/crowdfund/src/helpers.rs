//! # Internal Helper Functions
//!
//! Shared helpers used across multiple contract endpoints.

use soroban_sdk::{Address, Env};

use crate::{errors::ContractError, storage::KEY_CREATOR};

/// Reads the campaign creator and requires their authorization, without any
/// status check.
///
/// Access-control changes (whitelist, blacklist, visibility, ownership) are
/// deliberately allowed on a non-Active campaign: a creator still has to be able
/// to correct an access list after the campaign is paused or has ended. Only
/// `pause()` gates on `Status::Active`, and it checks that itself.
///
/// # Returns
/// - `Ok(Address)` with the creator's address, having required their auth
/// - `Err(ContractError::InvalidAddress)` if the contract was never initialized
pub(crate) fn require_auth_creator(env: &Env) -> Result<Address, ContractError> {
    let creator: Address = env
        .storage()
        .instance()
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    creator.require_auth();
    Ok(creator)
}
