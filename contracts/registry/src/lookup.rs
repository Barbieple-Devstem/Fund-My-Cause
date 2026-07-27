//! Public, read-only registry queries. No `require_auth()`, no writes.

use soroban_sdk::{Address, Env, Vec};

use crate::{paginate, CampaignStatus, RegDataKey, KEY_CAMPAIGNS};

/// See [`crate::RegistryContract::list`].
pub(crate) fn list(env: Env, offset: u32, limit: u32) -> Vec<Address> {
    if limit == 0 {
        return Vec::new(&env);
    }

    let campaigns: Vec<Address> = env
        .storage()
        .instance()
        .get(&KEY_CAMPAIGNS)
        .unwrap_or_else(|| Vec::new(&env));

    paginate(&env, &campaigns, offset, limit)
}

/// See [`crate::RegistryContract::list_by_status`].
pub(crate) fn list_by_status(
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

    paginate(&env, &campaigns, offset, limit)
}

/// See [`crate::RegistryContract::get_campaigns_by_category`].
pub(crate) fn get_campaigns_by_category(
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

    paginate(&env, &campaigns, offset, limit)
}
