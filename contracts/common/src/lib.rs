//! Shared access-control (RBAC) and error-handling primitives used across
//! the Fund-My-Cause Soroban contracts (`crowdfund`, `achievements`,
//! `registry`).
//!
//! See `README.md` in this directory for the extraction rationale and the
//! documented decision on `crowdfund`'s migration status.
#![no_std]

mod access_control;
mod error;
mod events;

#[cfg(test)]
pub mod test_utils;

pub use access_control::AccessControl;
pub use error::CommonError;
pub use events::EVENT_SCHEMA_VERSION;
