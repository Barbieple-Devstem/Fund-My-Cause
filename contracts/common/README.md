# `common`

Shared access-control (RBAC) and error-handling primitives for the
Fund-My-Cause Soroban contracts (`crowdfund`, `achievements`, `registry`).
Extracted per [Issue #834](https://github.com/Fund-My-Cause/Fund-My-Cause/issues/834).

> **Module boundaries and adoption status:** see
> [ADR-004 — Soroban contract module boundaries](../../docs/adr/ADR-004-contract-module-boundaries.md).
> It records, per exported symbol, which contracts actually consume this crate
> today; why `crowdfund` and `registry` are not consumers; and the
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
  address allowed to do this" check duplicated across contracts
  (`require_role_auth`).

`rbac.rs` (the generic team-RBAC engine described in earlier revisions of
this README) has been removed (issue #923): it had zero consumers in the
workspace and no pending requirement, per ADR-004's decision to treat it as
dead code. It remains recoverable from git history (commit `da3d8d0`; also
present as of commit `8dafe5b`) if a multi-member authorization requirement
ever materializes. `AccessControl::require_role` and `AccessControl::is_member`
were removed alongside it for the same reason — no consumer anywhere in the
workspace.

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
That pattern is exactly what `AccessControl::require_role_auth` generalizes
here.

Given that:

- the elaborate team/role/permission model in the dead `rbac*.rs` files had
  no consumer anywhere in the workspace and no pending multi-role
  authorization requirement (ADR-004's finding, later acted on by issue
  #923), and
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
