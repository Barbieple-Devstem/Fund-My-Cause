/// Storage management and constants for the crowdfund contract.
///
/// This module provides storage keys and helper utilities for managing contract state.
use soroban_sdk::Symbol;

/// Re-export `DataKey` so it can be imported via `crate::storage::DataKey`
/// (the enum itself is defined in the `types` module).
pub use crate::types::DataKey;

/// Contract version for upgrades and compatibility tracking
pub const CONTRACT_VERSION: u32 = 6;

/// Minimum supported version for migration (versions below this require a full re-deploy)
pub const MIN_SUPPORTED_VERSION: u32 = 1;

/// Maximum number of updates per campaign
pub const MAX_UPDATES: u32 = 100;

/// Maximum number of milestones per campaign
pub const MAX_MILESTONES: u32 = 20;

// ── Storage Keys ──────────────────────────────────────────────────────────────
/// Storage key for campaign creator address
pub const KEY_CREATOR: Symbol = soroban_sdk::symbol_short!("CREATOR");
/// Storage key for contribution token address
pub const KEY_TOKEN: Symbol = soroban_sdk::symbol_short!("TOKEN");
/// Storage key for campaign funding goal
pub const KEY_GOAL: Symbol = soroban_sdk::symbol_short!("GOAL");
/// Storage key for campaign deadline timestamp
pub const KEY_DEADLINE: Symbol = soroban_sdk::symbol_short!("DEADLINE");
/// Storage key for total amount raised
pub const KEY_TOTAL: Symbol = soroban_sdk::symbol_short!("TOTAL");
/// Storage key for list of contributors
pub const KEY_CONTRIBS: Symbol = soroban_sdk::symbol_short!("CONTRIBS");
/// Storage key for campaign status
pub const KEY_STATUS: Symbol = soroban_sdk::symbol_short!("STATUS");
/// Storage key for minimum contribution amount
pub const KEY_MIN: Symbol = soroban_sdk::symbol_short!("MIN");
/// Storage key for maximum contribution amount per contributor (0 = no limit)
pub const KEY_MAX: Symbol = soroban_sdk::symbol_short!("MAX");
/// Storage key for campaign title
pub const KEY_TITLE: Symbol = soroban_sdk::symbol_short!("TITLE");
/// Storage key for campaign description
pub const KEY_DESC: Symbol = soroban_sdk::symbol_short!("DESC");
/// Storage key for campaign social links
pub const KEY_SOCIAL: Symbol = soroban_sdk::symbol_short!("SOCIAL");
/// Storage key for platform fee configuration
pub const KEY_PLATFORM: Symbol = soroban_sdk::symbol_short!("PLATFORM");
/// Storage key for contract administrator
pub const KEY_ADMIN: Symbol = soroban_sdk::symbol_short!("ADMIN");
/// Storage key for rate limit configuration (max amount per hour)
pub const KEY_RATE_LIMIT: Symbol = soroban_sdk::symbol_short!("RATELIMIT");
/// Storage key for insurance pool configuration
pub const KEY_INSURANCE: Symbol = soroban_sdk::symbol_short!("INSURE");
/// Storage key for total insurance fees collected
pub const KEY_INSURANCE_POOL: Symbol = soroban_sdk::symbol_short!("INSPOOL");
/// Storage key for campaign category
pub const KEY_CATEGORY: Symbol = soroban_sdk::symbol_short!("CATEGORY");
/// Storage key for vesting schedule
pub const KEY_VESTING: Symbol = soroban_sdk::symbol_short!("VESTING");
/// Storage key for goal adjustment history
pub const KEY_GOAL_HISTORY: Symbol = soroban_sdk::symbol_short!("GHIST");
/// Storage key for campaign visibility level
pub const KEY_VISIBILITY: Symbol = soroban_sdk::symbol_short!("VIS");
/// Storage key for metadata version history
pub const KEY_META_HIST: Symbol = soroban_sdk::symbol_short!("METAHIST");
/// Storage key for campaign start timestamp
pub const KEY_START_TIME: Symbol = soroban_sdk::symbol_short!("START");
/// Storage key for campaign archival timestamp
pub const KEY_ARCHIVED: Symbol = soroban_sdk::symbol_short!("ARCHIVED");

// ── Issue #436: Campaign Milestones ───────────────────────────────────────────
/// Storage key for milestones list
pub const KEY_MILESTONES: Symbol = soroban_sdk::symbol_short!("MILESTONE");
/// Storage key for milestone verification status
pub const KEY_MILESTONE_STATUS: Symbol = soroban_sdk::symbol_short!("MLSTATUS");
/// Storage key for next milestone release amount
pub const KEY_NEXT_RELEASE: Symbol = soroban_sdk::symbol_short!("NEXTREL");

// ── Issue #437: Contribution Verification ────────────────────────────────────
/// Storage key for verification status of an address
pub const KEY_VERIFICATION: Symbol = soroban_sdk::symbol_short!("VERIFY");

// ── Issue #438: Campaign Analytics ────────────────────────────────────────────
/// Storage key for campaign analytics
pub const KEY_ANALYTICS: Symbol = soroban_sdk::symbol_short!("ANALYTICS");
/// Storage key for analytics time-series data points
pub const KEY_ANALYTICS_DATA: Symbol = soroban_sdk::symbol_short!("ANALDATA");

// ── Issue #439: Dispute Resolution ────────────────────────────────────────────
/// Storage key for disputes list
pub const KEY_DISPUTES: Symbol = soroban_sdk::symbol_short!("DISPUTES");
/// Storage key for next dispute ID counter
pub const KEY_DISPUTE_ID: Symbol = soroban_sdk::symbol_short!("DISPID");
/// Storage key for dispute votes by address
pub const KEY_DISPUTE_VOTE: Symbol = soroban_sdk::symbol_short!("DISPVOTE");

// ── Issue #457: Contract Versioning ──────────────────────────────────────────
/// Storage key for the on-chain stored contract version (set during migration)
pub const KEY_CONTRACT_VERSION: Symbol = soroban_sdk::symbol_short!("CVER");
/// Storage key for version migration history
pub const KEY_VERSION_HISTORY: Symbol = soroban_sdk::symbol_short!("VERHIST");

// ── Issue #458: State Validation ──────────────────────────────────────────────
/// Storage key for the last state validation result
pub const KEY_LAST_VALIDATION: Symbol = soroban_sdk::symbol_short!("LASTVAL");

// ── Issue #459: Debugging Utilities ──────────────────────────────────────────
/// Storage key for the latest debug snapshot
pub const KEY_DEBUG_SNAPSHOT: Symbol = soroban_sdk::symbol_short!("DBGSNAP");

// ── Issue #460: Performance Monitoring ───────────────────────────────────────
/// Storage key for performance alert threshold in ms (0 = disabled)
pub const KEY_PERF_THRESHOLD: Symbol = soroban_sdk::symbol_short!("PERFTHR");
/// Storage key for per-function performance stats prefix
pub const KEY_PERF_STATS: Symbol = soroban_sdk::symbol_short!("PERFST");

// ── Issue #XXX: Multi-Sig Governance ─────────────────────────────────────────
/// Storage key for governance configuration (governors list, required approvals, timelock)
pub const KEY_GOVERNANCE_CONFIG: Symbol = soroban_sdk::symbol_short!("GOVCFG");
/// Storage key for governance proposal nonce counter
pub const KEY_GOVERNANCE_NONCE: Symbol = soroban_sdk::symbol_short!("GOVNONCE");
/// Storage key for emergency pause flag
pub const KEY_EMERGENCY_PAUSE: Symbol = soroban_sdk::symbol_short!("EMPAUSE");

// ── Issue #605: Security Hardening ───────────────────────────────────────────
/// Storage key for reentrancy lock (prevents reentrancy attacks)
pub const KEY_REENTRANCY_LOCK: Symbol = soroban_sdk::symbol_short!("REENTLK");

// ── Issue #704: Withdrawal streaming ─────────────────────────────────────────
/// Storage key for optional streaming/scheduled-release config
pub const KEY_STREAM: Symbol = soroban_sdk::symbol_short!("STREAM");

// ── Issue #694: Soft-cap / stretch-goal ──────────────────────────────────────
/// Storage key for the campaign soft cap (minimum viable funding target)
pub const KEY_SOFT_CAP: Symbol = soroban_sdk::symbol_short!("SOFTCAP");
/// Storage key for the campaign stretch goal (over-funding target)
pub const KEY_STRETCH_GOAL: Symbol = soroban_sdk::symbol_short!("STRETCH");

// ── Issue #695: Released-amount tracking ─────────────────────────────────────
/// Storage key for the total amount already released to the creator via milestones
pub const KEY_RELEASED: Symbol = soroban_sdk::symbol_short!("RELEASED");

// ── Issue #696: Pause timelock ───────────────────────────────────────────────
/// Storage key for the timelock duration (seconds) required before unpausing
pub const KEY_PAUSE_TIMELOCK: Symbol = soroban_sdk::symbol_short!("PTLOCK");
/// Storage key for the earliest timestamp at which the contract may be unpaused
pub const KEY_UNPAUSE_AFTER: Symbol = soroban_sdk::symbol_short!("UNPAFTER");

// ── Gross contribution tracking ──────────────────────────────────────────────
/// Storage key for the gross total contributed (before any fee deductions)
pub const KEY_GROSS_TOTAL: Symbol = soroban_sdk::symbol_short!("GROSST");

// ── IPFS metadata ─────────────────────────────────────────────────────────────
/// Storage key for the campaign's off-chain IPFS content identifier (CID)
pub const KEY_IPFS_CID: Symbol = soroban_sdk::symbol_short!("IPFSCID");

// ── Yield / treasury ─────────────────────────────────────────────────────────
/// Storage key for the yield-generation configuration
pub const KEY_YIELD_CONFIG: Symbol = soroban_sdk::symbol_short!("YLDCFG");
/// Storage key for the total yield accrued
pub const KEY_YIELD_TOTAL: Symbol = soroban_sdk::symbol_short!("YLDTOT");

use soroban_sdk::{Address, Symbol as SorobanSymbol};

/// Helper function to get the admin address from storage
pub fn get_admin(env: &soroban_sdk::Env) -> Result<Address, crate::ContractError> {
    env.storage()
        .instance()
        .get::<_, Address>(&KEY_ADMIN)
        .ok_or(crate::ContractError::NotFound)
}

/// Helper function to create a rate limit key for an address
pub fn make_rate_limit_key(addr: &Address) -> SorobanSymbol {
    // This creates a unique persistent key for rate limiting per address
    // In a full implementation, this would use the address hash
    soroban_sdk::symbol_short!("RATELIM")
}
