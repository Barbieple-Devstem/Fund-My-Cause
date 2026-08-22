//! Mutating registry operations.
//!
//! Two authorization models coexist here:
//! - **Admin-gated**: [`initialize`], [`update_status`] — require the stored
//!   admin's `require_auth()`.
//! - **Self-authorized**: [`register`], [`register_with_category`],
//!   [`register_with_status`] — require the campaign contract's own
//!   `require_auth()`, not the registry admin's.
//!
//! Both groups live in this file because both groups *write* registry state
//! (`KEY_CAMPAIGNS` and/or the category/status indexes), which is the
//! organizing principle for this module vs. [`crate::lookup`] (read-only,
//! no auth, no writes).

use common::EVENT_SCHEMA_VERSION;
use soroban_sdk::{Address, Env, Vec};

use crate::{
    require_initialized, CampaignStatus, ContractError, EventInitialized, EventRegistered,
    RegDataKey, KEY_ADMIN, KEY_CAMPAIGNS,
};

/// See [`crate::RegistryContract::initialize`].
pub(crate) fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
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

/// See [`crate::RegistryContract::register`].
pub(crate) fn register(env: Env, campaign_id: Address) -> Result<(), ContractError> {
    require_initialized(&env)?;
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

/// See [`crate::RegistryContract::register_with_category`].
pub(crate) fn register_with_category(
    env: Env,
    campaign_id: Address,
    category_id: u32,
) -> Result<(), ContractError> {
    require_initialized(&env)?;
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

/// See [`crate::RegistryContract::register_with_status`].
pub(crate) fn register_with_status(
    env: Env,
    campaign_id: Address,
    status: CampaignStatus,
) -> Result<(), ContractError> {
    require_initialized(&env)?;
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

/// See [`crate::RegistryContract::update_status`].
pub(crate) fn update_status(
    env: Env,
    campaign_id: Address,
    old_status: CampaignStatus,
    new_status: CampaignStatus,
) -> Result<(), ContractError> {
    require_initialized(&env)?;

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
