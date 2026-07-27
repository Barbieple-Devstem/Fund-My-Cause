//! # Fund-My-Cause Registry Contract
//!
//! A lightweight Soroban contract that maintains a deduplicated, paginated list
//! of all deployed [`CrowdfundContract`] campaign addresses on the Stellar network.
//!
//! ## Access Control
//!
//! | Function | Authorization required |
//! |---|---|
//! | `initialize` | `admin.require_auth()` — one-time setup |
//! | `register` | `campaign_id.require_auth()` — campaign signs its own registration |
//! | `register_with_category` | `campaign_id.require_auth()` |
//! | `register_with_status` | `campaign_id.require_auth()` |
//! | `update_status` | stored admin `require_auth()` |
//! | `list` / `list_by_status` / `get_campaigns_by_category` | public read — no auth |
//!
//! ## Storage
//!
//! All campaign addresses are stored in a single instance-storage entry under
//! the `CMPLIST` key as a `Vec<Address>`. Deduplication is enforced on write.
//! The admin address is stored under `ADMIN` and set once during `initialize`.

#![no_std]

mod errors;
mod events;
pub use errors::ContractError;
pub use events::{EventInitialized, EventRegistered};

use common::EVENT_SCHEMA_VERSION;
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec};

// ── Storage keys ──────────────────────────────────────────────────────────────

/// Instance storage key for the list of registered campaign contract addresses.
const KEY_CAMPAIGNS: Symbol = symbol_short!("CMPLIST");

/// Instance storage key for the admin address set during `initialize`.
const KEY_ADMIN: Symbol = symbol_short!("ADMIN");

// ── Types ─────────────────────────────────────────────────────────────────────

/// Campaign status values mirrored from the crowdfund contract for filtering.
///
/// The registry stores a caller-supplied status tag alongside each campaign so
/// that `list_by_status` can filter without cross-contract calls.
/// Status values must be kept in sync by the registrant (typically the deploy script).
///
/// | value | meaning      |
/// |-------|--------------|
/// |  0    | Active       |
/// |  1    | Successful   |
/// |  2    | Failed       |
/// |  3    | Cancelled    |
#[contracttype]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum CampaignStatus {
    Active = 0,
    Successful = 1,
    Failed = 2,
    Cancelled = 3,
}

/// Storage key variants for indexed campaign lists.
#[contracttype]
enum RegDataKey {
    /// Paginated list of campaign addresses for a given numeric category id.
    CategoryList(u32),
    /// List of campaign addresses for a given status (maps to CampaignStatus discriminant).
    StatusList(u32),
}

// ── Contract ──────────────────────────────────────────────────────────────────

/// The Fund-My-Cause registry contract.
///
/// Maintains a deduplicated, append-only list of all deployed campaign contract
/// addresses. Provides paginated read access for frontends and indexers.
/// Every state-mutating function enforces caller authentication via
/// `require_auth()` and returns `Result<_, ContractError>`.
#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    // ── Admin / lifecycle ─────────────────────────────────────────────────────

    /// Initialises the registry and sets the admin address.
    ///
    /// Must be called exactly once immediately after contract deployment.
    /// Subsequent calls return [`ContractError::AlreadyInitialized`].
    ///
    /// # Authorization
    ///
    /// `admin.require_auth()` — the admin must sign the initialisation transaction.
    ///
    /// # Errors
    ///
    /// - [`ContractError::AlreadyInitialized`] if the contract has already been
    ///   initialised.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        admin.require_auth();

        if env.storage().instance().has(&KEY_ADMIN) {
            return Err(ContractError::AlreadyInitialized);
        }

        env.storage().instance().set(&KEY_ADMIN, &admin);
        env.events().publish(
            ("registry", "initialized"),
            EventInitialized {
                admin,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );

        Ok(())
    }

    // ── Registration entry-points ─────────────────────────────────────────────

    /// Registers a campaign contract address in the registry.
    ///
    /// The campaign contract itself must authorise the call — this prevents any
    /// third party from registering arbitrary addresses.
    ///
    /// If the address is already registered the call succeeds without emitting a
    /// duplicate event.
    ///
    /// # Authorization
    ///
    /// `campaign_id.require_auth()` — the campaign contract must sign.
    ///
    /// # Errors
    ///
    /// - [`ContractError::NotInitialized`] if `initialize` has not been called.
    /// - [`ContractError::Unauthorized`] if `campaign_id` did not sign.
    ///   (Soroban surfaces this as a host-level auth failure before the error is
    ///   returned, but the guard is explicit for documentation purposes.)
    pub fn register(env: Env, campaign_id: Address) -> Result<(), ContractError> {
        Self::require_initialized(&env)?;
        campaign_id.require_auth();

        let mut campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&KEY_CAMPAIGNS)
            .unwrap_or_else(|| Vec::new(&env));

        if !campaigns.contains(&campaign_id) {
            campaigns.push_back(campaign_id.clone());
            env.storage().instance().set(&KEY_CAMPAIGNS, &campaigns);
            env.events().publish(
                ("registry", "registered"),
                EventRegistered {
                    campaign_id,
                    schema_version: EVENT_SCHEMA_VERSION,
                },
            );
        }

        Ok(())
    }

    /// Registers a campaign together with its numeric category id.
    ///
    /// Performs all the same deduplication and bookkeeping as [`register`], and
    /// additionally maintains a per-category index so callers can retrieve
    /// campaigns filtered by category via [`get_campaigns_by_category`].
    ///
    /// # Authorization
    ///
    /// `campaign_id.require_auth()` — the campaign contract must sign.
    ///
    /// # Errors
    ///
    /// - [`ContractError::NotInitialized`] if `initialize` has not been called.
    /// - [`ContractError::Unauthorized`] if `campaign_id` did not sign.
    pub fn register_with_category(
        env: Env,
        campaign_id: Address,
        category_id: u32,
    ) -> Result<(), ContractError> {
        Self::require_initialized(&env)?;
        campaign_id.require_auth();

        // ── Global list ───────────────────────────────────────────────────────
        let mut campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&KEY_CAMPAIGNS)
            .unwrap_or_else(|| Vec::new(&env));

        if !campaigns.contains(&campaign_id) {
            campaigns.push_back(campaign_id.clone());
            env.storage().instance().set(&KEY_CAMPAIGNS, &campaigns);
            env.events().publish(
                ("registry", "registered"),
                EventRegistered {
                    campaign_id: campaign_id.clone(),
                    schema_version: EVENT_SCHEMA_VERSION,
                },
            );
        }

        // ── Category-specific list ────────────────────────────────────────────
        let cat_key = RegDataKey::CategoryList(category_id);
        let mut cat_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&cat_key)
            .unwrap_or_else(|| Vec::new(&env));

        if !cat_list.contains(&campaign_id) {
            cat_list.push_back(campaign_id);
            env.storage().instance().set(&cat_key, &cat_list);
        }

        Ok(())
    }

    /// Registers a campaign with a status tag for status-based filtering.
    ///
    /// Performs the same global deduplication as [`register`] and additionally
    /// adds the campaign to the per-status index so it appears in
    /// [`list_by_status`] results.
    ///
    /// # Authorization
    ///
    /// `campaign_id.require_auth()` — the campaign contract must sign.
    ///
    /// # Errors
    ///
    /// - [`ContractError::NotInitialized`] if `initialize` has not been called.
    /// - [`ContractError::Unauthorized`] if `campaign_id` did not sign.
    pub fn register_with_status(
        env: Env,
        campaign_id: Address,
        status: CampaignStatus,
    ) -> Result<(), ContractError> {
        Self::require_initialized(&env)?;
        campaign_id.require_auth();

        let mut campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&KEY_CAMPAIGNS)
            .unwrap_or_else(|| Vec::new(&env));

        if !campaigns.contains(&campaign_id) {
            campaigns.push_back(campaign_id.clone());
            env.storage().instance().set(&KEY_CAMPAIGNS, &campaigns);
            env.events().publish(
                ("registry", "registered"),
                EventRegistered {
                    campaign_id: campaign_id.clone(),
                    schema_version: EVENT_SCHEMA_VERSION,
                },
            );
        }

        let status_key = RegDataKey::StatusList(status as u32);
        let mut status_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&status_key)
            .unwrap_or_else(|| Vec::new(&env));

        if !status_list.contains(&campaign_id) {
            status_list.push_back(campaign_id);
            env.storage().instance().set(&status_key, &status_list);
        }

        Ok(())
    }

    /// Updates the status tag for a registered campaign.
    ///
    /// Removes `campaign_id` from its old status list and adds it to the new one.
    ///
    /// # Authorization
    ///
    /// Only the stored admin address may call this function.
    /// `admin.require_auth()` is enforced.
    ///
    /// # Errors
    ///
    /// - [`ContractError::NotInitialized`] if `initialize` has not been called.
    /// - [`ContractError::Unauthorized`] if the caller is not the admin.
    /// - [`ContractError::NotFound`] if `campaign_id` is not in the global registry.
    pub fn update_status(
        env: Env,
        campaign_id: Address,
        old_status: CampaignStatus,
        new_status: CampaignStatus,
    ) -> Result<(), ContractError> {
        Self::require_initialized(&env)?;

        let admin: Address = env
            .storage()
            .instance()
            .get(&KEY_ADMIN)
            .ok_or(ContractError::NotInitialized)?;
        admin.require_auth();

        // Guard: campaign must already be registered globally
        let campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&KEY_CAMPAIGNS)
            .unwrap_or_else(|| Vec::new(&env));
        if !campaigns.contains(&campaign_id) {
            return Err(ContractError::NotFound);
        }

        // Remove from old status list
        let old_key = RegDataKey::StatusList(old_status as u32);
        let old_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&old_key)
            .unwrap_or_else(|| Vec::new(&env));
        let mut filtered_old = Vec::new(&env);
        for i in 0..old_list.len() {
            let addr = old_list.get(i).unwrap();
            if addr != campaign_id {
                filtered_old.push_back(addr);
            }
        }
        env.storage().instance().set(&old_key, &filtered_old);

        // Add to new status list
        let new_key = RegDataKey::StatusList(new_status as u32);
        let mut new_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&new_key)
            .unwrap_or_else(|| Vec::new(&env));
        if !new_list.contains(&campaign_id) {
            new_list.push_back(campaign_id);
            env.storage().instance().set(&new_key, &new_list);
        }

        Ok(())
    }

    // ── Read-only queries (no auth required) ──────────────────────────────────

    /// Returns a paginated slice of registered campaign contract addresses.
    ///
    /// Pagination is zero-indexed: pass `offset = 0, limit = 20` for the first
    /// page, `offset = 20, limit = 20` for the second, and so on.
    pub fn list(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        if limit == 0 {
            return Vec::new(&env);
        }

        let campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&KEY_CAMPAIGNS)
            .unwrap_or_else(|| Vec::new(&env));

        Self::paginate(&env, &campaigns, offset, limit)
    }

    /// Returns a paginated slice of campaigns filtered by status.
    ///
    /// Only campaigns registered via [`register_with_status`] appear here.
    pub fn list_by_status(
        env: Env,
        status: CampaignStatus,
        offset: u32,
        limit: u32,
    ) -> Vec<Address> {
        if limit == 0 {
            return Vec::new(&env);
        }

        let campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&RegDataKey::StatusList(status as u32))
            .unwrap_or_else(|| Vec::new(&env));

        Self::paginate(&env, &campaigns, offset, limit)
    }

    /// Returns a paginated slice of campaign addresses filtered by category.
    ///
    /// Only campaigns registered via [`register_with_category`] appear here.
    pub fn get_campaigns_by_category(
        env: Env,
        category_id: u32,
        offset: u32,
        limit: u32,
    ) -> Vec<Address> {
        if limit == 0 {
            return Vec::new(&env);
        }

        let campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&RegDataKey::CategoryList(category_id))
            .unwrap_or_else(|| Vec::new(&env));

        Self::paginate(&env, &campaigns, offset, limit)
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// Returns `Err(NotInitialized)` if `initialize` has not been called yet.
    fn require_initialized(env: &Env) -> Result<(), ContractError> {
        if !env.storage().instance().has(&KEY_ADMIN) {
            return Err(ContractError::NotInitialized);
        }
        Ok(())
    }

    /// Returns a sub-slice of `src` starting at `offset` with at most `limit` items.
    fn paginate(env: &Env, src: &Vec<Address>, offset: u32, limit: u32) -> Vec<Address> {
        let total = src.len();
        if offset >= total {
            return Vec::new(env);
        }
        let end = offset.saturating_add(limit).min(total);
        let mut out = Vec::new(env);
        let mut i = offset;
        while i < end {
            if let Some(addr) = src.get(i) {
                out.push_back(addr);
            }
            i += 1;
        }
        out
    }
}
