//! # Campaign Metadata Functions
//!
//! This module owns the mutable descriptive state of a campaign: title, description,
//! social links and the anchored IPFS CID. Every metadata update appends a versioned
//! snapshot (issue #423) so the full edit history stays auditable on-chain.

use soroban_sdk::{Address, Env, String, Vec};

use crate::{
    errors::ContractError,
    storage::{
        KEY_CREATOR, KEY_DESC, KEY_IPFS_CID, KEY_META_HIST, KEY_SOCIAL, KEY_STATUS, KEY_TITLE,
        TTL_PERSISTENT_ENTRY,
    },
    types::{EventIpfsCidUpdated, EventMetadataUpdated, EventMetadataVersioned, MetadataVersion, Status},
    validation::validate_string_length,
    CrowdfundContract,
};

/// Updates campaign metadata (title, description, social links).
pub(crate) fn update_metadata(
    env: Env,
    title: Option<String>,
    description: Option<String>,
    social_links: Option<Vec<String>>,
) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let status: Status = inst.get(&KEY_STATUS).unwrap();
    if status != Status::Active {
        return Err(ContractError::NotActive);
    }
    let creator: Address = inst.get(&KEY_CREATOR).unwrap();
    creator.require_auth();

    let updated_title = title.is_some();
    let updated_description = description.is_some();
    let updated_social = social_links.is_some();

    // Validate and capture effective values for the version snapshot.
    // Using `if let Some(ref ...)` borrows without moving, letting us clone
    // here and then move the Option into the storage writes below.
    let effective_title: String = if let Some(ref t) = title {
        validate_string_length(t, 64)?;
        t.clone()
    } else {
        inst.get(&KEY_TITLE)
            .unwrap_or_else(|| String::from_str(&env, ""))
    };
    let effective_desc: String = if let Some(ref d) = description {
        validate_string_length(d, 512)?;
        d.clone()
    } else {
        inst.get(&KEY_DESC)
            .unwrap_or_else(|| String::from_str(&env, ""))
    };

    if let Some(t) = title {
        inst.set(&KEY_TITLE, &t);
    }
    if let Some(d) = description {
        inst.set(&KEY_DESC, &d);
    }
    if let Some(l) = social_links {
        inst.set(&KEY_SOCIAL, &l);
    }

    // Issue #423: store a versioned metadata snapshot
    let now = env.ledger().timestamp();
    let mut meta_hist: Vec<MetadataVersion> = env
        .storage()
        .persistent()
        .get(&KEY_META_HIST)
        .unwrap_or_else(|| Vec::new(&env));
    let version = meta_hist.len();
    meta_hist.push_back(MetadataVersion {
        version,
        title: effective_title,
        description: effective_desc,
        timestamp: now,
    });
    env.storage().persistent().set(&KEY_META_HIST, &meta_hist);
    env.storage()
        .persistent()
        .extend_ttl(&KEY_META_HIST, TTL_PERSISTENT_ENTRY, TTL_PERSISTENT_ENTRY);

    env.events().publish(
        ("campaign", "metadata_updated"),
        EventMetadataUpdated {
            updated_title,
            updated_description,
            updated_social_links: updated_social,
        },
    );
    env.events().publish(
        ("campaign", "metadata_versioned"),
        EventMetadataVersioned {
            version,
            timestamp: now,
        },
    );

    // Re-index campaign after metadata update
    CrowdfundContract::index_campaign(env)?;

    Ok(())
}

/// Anchors an IPFS content identifier (CID) on-chain for the campaign.
pub(crate) fn update_ipfs_cid(env: Env, cid: String) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let status: Status = inst.get(&KEY_STATUS).unwrap();
    if status != Status::Active {
        return Err(ContractError::NotActive);
    }
    let creator: Address = inst.get(&KEY_CREATOR).unwrap();
    creator.require_auth();

    // Validate CID length: v0 (base58 "Qm…", len 46) or v1 (base32 "bafy…", len >= 59).
    // Byte-level prefix inspection is intentionally omitted: Soroban `String`
    // does not expose content access without an exact-length copy buffer, so we
    // validate the well-known CID lengths instead.
    let len = cid.len();
    let is_v0 = len == 46;
    let is_v1 = len >= 59;
    if !is_v0 && !is_v1 {
        return Err(ContractError::InvalidInput);
    }

    inst.set(&KEY_IPFS_CID, &cid);
    let now = env.ledger().timestamp();
    env.events().publish(
        ("campaign", "ipfs_cid_updated"),
        EventIpfsCidUpdated {
            cid,
            timestamp: now,
        },
    );
    Ok(())
}

/// Returns the stored IPFS CID for this campaign, if one has been set.
pub(crate) fn get_ipfs_cid(env: Env) -> Option<String> {
    env.storage().instance().get(&KEY_IPFS_CID)
}

/// Returns the full metadata version history for this campaign.
pub(crate) fn get_metadata_history(env: Env) -> Vec<MetadataVersion> {
    env.storage()
        .persistent()
        .get(&KEY_META_HIST)
        .unwrap_or_else(|| Vec::new(&env))
}
