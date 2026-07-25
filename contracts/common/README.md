# `common`

Shared access-control (RBAC) and error-handling primitives for the
Fund-My-Cause Soroban contracts (`crowdfund`, `achievements`, `registry`).
Extracted per [Issue #834](https://github.com/Fund-My-Cause/Fund-My-Cause/issues/834).

> **Module boundaries and adoption status:** see
> [ADR-004 — Soroban contract module boundaries](../../docs/adr/ADR-004-contract-module-boundaries.md).
> It records, per exported symbol, which contracts actually consume this crate
> today; why `crowdfund` and `registry` are not consumers; the decision to
> **delete `rbac.rs`** (it has no consumer in the workspace); and the
> `CommonError` adoption plan — full migration for `registry`, new-code-only
> for `crowdfund`. Read it before adding to or migrating onto this crate.

## What's here

- **`CommonError`** (`error.rs`) — a small set of base error variants
  (`Unauthorized`, `NotFound`, `InvalidInput`, `AlreadyInitialized`,
  `AlreadyExists`) shared across contracts. Each contract keeps its own
  `#[contracterror] ContractError` — so its domain-specific variants and
  existing on-chain discriminants are undisturbed — and implements
  `From<CommonError> for ContractError` to fold these shared cases into its
  own error space.
- **`AccessControl`** (`access_control.rs`) — the "is the caller the one
  address allowed to do this" checks duplicated across contracts
  (`require_role`, `require_role_auth`, `is_member`).
- **`rbac`** (`rbac.rs`) — a generic, role-set-agnostic team-RBAC engine
  (`TeamMember<R>`, `RolePermissions<R, P>`, `check_permission`,
  `validate_permission`) for contracts that need multi-member, role-based
  access control beyond a single admin address. **Scheduled for deletion —
  do not build on it.** No contract in the workspace instantiates it, and no
  contract has a multi-member authorization requirement; ADR-004 resolves it
  as dead code, recoverable from commit `da3d8d0` if such a requirement
  appears.

## Why `crowdfund` was not migrated

Issue #834 asks that `crowdfund` either migrate to this crate or that the
crate be verified as a strict generalization of `crowdfund`'s existing RBAC
logic, with the decision documented. This is that documentation.

`crowdfund/src/rbac.rs`, `rbac_access.rs`, and `rbac_validation.rs` — the
"full RBAC subsystem" this issue was written against — were **dead code**:
none of the three files were declared via `mod` anywhere in `crowdfund`'s
module tree, so they were never compiled into the contract. They also did
not compile on their own against the pinned `soroban-sdk` version (e.g.
`Vec::new()` calls missing the required `&Env` argument), so they were never
a working reference implementation to migrate *from* in the first place.

`crowdfund`'s actual live authorization is the simple pattern used
throughout `lib.rs`: load a stored address (`creator`, `admin`, etc.) and
call `.require_auth()` on it, occasionally paired with an equality check.
That pattern is exactly what `AccessControl::require_role` /
`require_role_auth` generalize here.

Given that:

- the elaborate team/role/permission model in the dead `rbac*.rs` files has
  been extracted, fixed, and generalized (role/permission types are now
  generic, `R`/`P`, instead of hardcoded to `CampaignRole`/`Permission`) into
  `rbac.rs` in this crate, so it existed as a working shared reference for any
  contract that later needed multi-role team access control (ADR-004 has since
  found no such consumer materialised and scheduled `rbac.rs` for deletion),
  and
- `crowdfund`'s crate currently has pre-existing, unrelated compile errors
  (duplicate symbol definitions from a prior merge, missing types/constants)
  that predate this change and make it unsafe to verify further edits to
  this fund-critical contract in the same change,

the decision is: **`crowdfund`'s live `lib.rs` authorization code is left
untouched.** The now-redundant dead `rbac*.rs` files were removed in favor of
the working, tested equivalent in this crate. Migrating `crowdfund`'s live
`require_auth()` call sites onto `common::AccessControl` is mechanical and
low-risk once `crowdfund`'s existing build is repaired, and is left as
follow-up work.

## Design note: generic, not `#[contracttype]`

Soroban's `#[contracttype]`/storage macros do not support generic types, so
the types in `rbac.rs` (`TeamMember<R>`) are plain Rust structs generic over
a contract-supplied role type, not directly storable. A consuming contract
defines its own concrete, `#[contracttype]`-derived role/member types for
persistence and adapts them into `TeamMember<R>` when calling into this
engine's pure permission-checking logic.
