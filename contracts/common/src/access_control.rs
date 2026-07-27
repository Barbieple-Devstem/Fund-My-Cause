//! Address-based access-control primitives shared across contracts.
//!
//! These generalize the "is the caller the one address allowed to do this"
//! checks duplicated across `crowdfund` (`creator.require_auth()` /
//! `admin.require_auth()` throughout `lib.rs`) and `achievements` (ad hoc
//! `admin.require_auth()` calls). They intentionally encode no
//! contract-specific role or permission set.

use soroban_sdk::Address;

/// Address-comparison and `require_auth` access-control helpers.
pub struct AccessControl;

impl AccessControl {
    /// Requires that `role_address` authorized the current invocation.
    ///
    /// Thin wrapper around [`Address::require_auth`] so contracts express
    /// the "only this stored address may call this" pattern the same way
    /// everywhere, rather than re-deriving it inline per contract.
    pub fn require_role_auth(role_address: &Address) {
        role_address.require_auth();
    }
}
