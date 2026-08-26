# ADR-004: Soroban contract module boundaries (`contracts/common` vs `crowdfund` / `registry` / `achievements`)

- **Status:** Active
- **Date:** 2026-07-25
- **Updated:** 2026-08-25 (registry migration complete; `types.rs` split; `ContributorGate` rename; `validate_positive_amount` consolidated)
- **Deciders:** owners of `contracts/crowdfund`, `contracts/registry`, `contracts/achievements`, `contracts/common`

## Context

`contracts/common` was extracted in commit `da3d8d0` (2026-07-20, "feat(contracts): extract shared RBAC & error-handling crate") to hold access-control and error primitives shared across the three deployable contracts. Adoption since then has been partial and, until this ADR, undocumented: only one of the three contracts depends on the crate at all, and only a subset of the crate's exported surface is referenced by anything outside its own unit tests.

This ADR records the verified state of that boundary, why the other two contracts opted out, and what happens next to each part of `contracts/common`.

### Symbol-level adoption inventory

Every symbol re-exported from `contracts/common/src/lib.rs`, and who references it today. "Referenced by" counts only non-test call sites in `crowdfund`, `registry`, and `achievements` — `contracts/common`'s own `#[cfg(test)]` modules are excluded, because a crate exercising its own code is not adoption.

| Symbol | Module | Referenced by | Call sites |
|--------|--------|---------------|------------|
| `CommonError` | `error.rs` | `achievements` | `achievements/src/errors.rs:41-56` (`From<CommonError> for ContractError`), `achievements/src/lib.rs:70` (`CommonError::AlreadyInitialized.into()`) |
| `AccessControl::require_role_auth` | `access_control.rs` | `achievements` | `achievements/src/lib.rs:67`, `achievements/src/lib.rs:148` |
| `AccessControl::require_role` | `access_control.rs` | **nobody** | — |
| `AccessControl::is_member` | `access_control.rs` | **nobody** | — |
| `TeamMember<R>` | `rbac.rs` | **nobody** | — |
| `RolePermissions<R, P>` | `rbac.rs` | **nobody** | — |
| `PermissionResult<R>` | `rbac.rs` | **nobody** | — |
| `find_team_member` | `rbac.rs` | **nobody** | — |
| `check_permission` | `rbac.rs` | **nobody** | — |
| `validate_permission` | `rbac.rs` | **nobody** | — |

Summarised: `achievements` is the only consumer, and it uses exactly two of the ten exported symbols. `crowdfund/Cargo.toml` and `registry/Cargo.toml` declare no `common` dependency at all. The whole of `rbac.rs` — six exported symbols, 256 lines — has zero references anywhere in the workspace.

Two things frequently assumed about this state turn out not to be true, and are corrected here so the decision below rests on facts rather than on the assumption:

1. **`crowdfund` does have an `AccessControl`, but it is not this one.** `crowdfund/src/security.rs:239` defines its own unrelated `pub struct AccessControl` with whitelist/blacklist helpers (`is_whitelisted`, `is_blacklisted`), re-exported from `crowdfund/src/lib.rs:80`. It shares a name with `common::AccessControl` and nothing else. Any future migration must resolve this collision deliberately; a naive `use common::AccessControl` in `crowdfund` would shadow a live, security-relevant type.
2. **`rbac.rs` is not shipping bytes into the `achievements` wasm.** Every item in `rbac.rs` is generic (`TeamMember<R>`, `check_permission::<R, P, M, I>`, …). Rust monomorphises generics only at instantiation, and `achievements` never instantiates them, so no code is generated for them; the release profile's `lto = true` and `opt-level = "z"` would strip any residue regardless. The cost of `rbac.rs` is therefore maintenance and misdirection, not binary size. That distinction matters: "delete it, it is bloating the wasm" would be the wrong reason to act.

### Why `crowdfund` and `registry` opted out

Neither opt-out was a considered rejection of `contracts/common`. Git history shows both are artefacts of ordering.

**`crowdfund` predates the crate by four months.** `crowdfund/src/lib.rs` first landed in `609f13b` (2026-03-15, monorepo scaffold) and `crowdfund/src/errors.rs` in `f0d218b` (2026-04-22). Its `ContractError` then grew to 72 variants across at least ten subsequent feature commits (`8811e43`, `fb6a2ec`, `625ac60`, `42b1194`, `5aa1290`, `969b4f9`, `95b9fd9`, …). By the time `common` existed on 2026-07-20 there was a large, deployed error surface with stable on-chain discriminants and no migration was attempted. `contracts/common/README.md` already records the accompanying decision: the elaborate `crowdfund/src/rbac.rs`, `rbac_access.rs`, and `rbac_validation.rs` files were dead code — never declared via `mod`, and non-compiling against the pinned `soroban-sdk` — so they were deleted in `da3d8d0` and generalised into `common::rbac` rather than migrated. `crowdfund`'s *live* authorization was left untouched, partly because the crate had unrelated pre-existing compile errors at the time.

**`registry` opted out by one day, concurrently.** `registry/src/errors.rs` landed in `5053791` (2026-07-21, "feat(registry): add require_auth(), typed errors, and access-control tests") — the day *after* `common` was created. The two changes were developed in parallel, so `registry`'s author was writing typed errors against a crate that did not yet exist on their branch. The result is visible in the file: its doc comment says it is "mirroring the pattern used in `contracts/crowdfund/src/errors.rs` and `contracts/achievements/src/errors.rs`", and its five variants (`AlreadyInitialized`, `NotInitialized`, `Unauthorized`, `NotFound`, `AlreadyRegistered`) are near-identical in intent to `CommonError`'s five — but it declares them independently and implements no `From<CommonError>`. This is the clearest case of unintended duplication in the workspace.

**`achievements` adopted last and adopted narrowly.** The `common = { path = "../common" }` dependency was added in `cccfb78` (2026-07-23, "feat(achievements): fix compile errors, implement TODOs, add tests, wire CI") — i.e. adoption happened opportunistically while the contract was already being repaired, and stopped at the two symbols that removed immediate duplication.

The honest summary for the record: **`crowdfund` opted out because it predated the crate and nobody circled back; `registry` opted out because it was written in parallel with the crate and nobody noticed the overlap.** Neither team evaluated and rejected `contracts/common` on its merits.

### The `rbac.rs` question

`rbac.rs` is a working, unit-tested, generic team-RBAC engine with no consumer. It is a generalisation of a feature described at length in `RBAC_TEAM_MANAGEMENT_IMPLEMENTATION.md` (five roles, twelve permissions, delegation, multi-sig approval, audit trail) that was **never shipped**: the `crowdfund` files implementing it never compiled and were deleted. No contract in the workspace today has a multi-member authorization requirement — `crowdfund`, `registry`, and `achievements` all authorize against a single stored `creator`/`admin` address. The `TeamMember` type used in the frontend (`apps/interface/src/types/campaign.ts`) is an unrelated marketing/bio type for campaign team cards, not an authorization primitive.

Leaving it in place has a specific, non-hypothetical cost. This repository has already been through one cycle of exactly this failure: a plausible-looking, uncompiled RBAC subsystem sat in `crowdfund/src/` long enough that an issue was filed asking to migrate *to* it. Dead authorization code in a fund-handling contract crate reads as authoritative to the next contributor and invites adoption without review.

## Decision

1. **`error.rs` is the shared primitive; `access_control.rs` is the shared pattern.** Both stay. `contracts/common` remains the home for cross-contract error and access-control primitives, consumed via `From<CommonError> for ContractError` so each contract keeps its own on-chain discriminants.
2. **`rbac.rs` is deleted.** It has no consumer, no pending requirement, and no runtime cost to justify its retention — only maintenance cost and the risk of being mistaken for live authorization logic. The design intent is preserved in `RBAC_TEAM_MANAGEMENT_IMPLEMENTATION.md`, and the implementation itself remains recoverable from commit `da3d8d0` if a genuine multi-member requirement appears. Deletion is tracked as a follow-up cleanup issue (see References) rather than done inside this ADR, so the code change gets its own review.
3. **`registry` migrates to `CommonError` in full; `crowdfund` does not migrate.** The two contracts get deliberately different answers, because their situations are not comparable — see below.
4. **New contracts depend on `contracts/common` from their first commit.** Any contract added to the workspace after this ADR declares `common = { path = "../common" }` and defines its `ContractError` with a `From<CommonError>` impl. This is the mechanism that stops the `registry` failure mode recurring.

### `error.rs` adoption plan

**`registry` (5 variants) — full migration.** Four of `registry`'s five variants (`AlreadyInitialized`, `Unauthorized`, `NotFound`, `AlreadyRegistered` ↔ `AlreadyExists`) map one-to-one onto `CommonError`; only `NotInitialized` is registry-specific. The contract is young (single commit, 2026-07-21), small, and its error surface is precisely what `CommonError` was extracted to cover. Concrete next step: add `common = { path = "../common" }` to `registry/Cargo.toml` and implement `From<CommonError> for ContractError` in `registry/src/errors.rs`, keeping all five existing discriminants unchanged so no on-chain client breaks; then route the `require_auth`/lookup failure paths in `registry/src/lib.rs` through `CommonError`. Tracked as the follow-up issue in References.

**`crowdfund` (72 variants) — not planned, with rationale.** A full migration is rejected, not deferred. The 72 variants are overwhelmingly domain-specific (`CampaignEnded`, `GoalNotReached`, `BelowMinimum`, `VestingCliffNotReached`, …); at most four have a `CommonError` counterpart, so the shared crate would deduplicate roughly 5% of the enum while touching a deployed, fund-handling contract whose discriminants are consumed by the frontend and by `sdks/js/src/errors.ts`'s `ERROR_MESSAGES` map. The risk/benefit does not justify it.

What *is* planned for `crowdfund` is narrower and stated explicitly so this is not an aspiration:

- **New code only.** New `crowdfund` entry points added after this ADR that need a generic `Unauthorized` / `NotFound` / `InvalidInput` / `AlreadyInitialized` / `AlreadyExists` return it via `CommonError` and let a `From<CommonError> for ContractError` impl fold it in. Concrete next step, and the whole of the required change: add `common = { path = "../common" }` to `crowdfund/Cargo.toml` and add that one `From` impl to `crowdfund/src/errors.rs`, mapping onto the existing discriminants. Existing variants and call sites are not renumbered or rewritten.
- **The `AccessControl` name collision is resolved at that time**, by importing `common::AccessControl` under an alias (e.g. `use common::AccessControl as CommonAccessControl;`) rather than renaming `crowdfund`'s existing security type.
- **Migrating `crowdfund`'s live `require_auth()` call sites onto `common::AccessControl` remains out of scope** and is not scheduled. `contracts/common/README.md` describes it as "mechanical and low-risk once `crowdfund`'s existing build is repaired"; this ADR does not contradict that, but declines to commit to it without a concrete driver.

## Alternatives considered

| Option | Pros | Cons |
|--------|------|------|
| Keep `error.rs` + `access_control.rs`, delete `rbac.rs`, migrate `registry` only (chosen) | Removes the only genuinely duplicated error enum; removes dead authorization code from a contract crate; leaves the deployed high-variant contract alone | Two contracts remain on different error idioms; `crowdfund` duplication persists by design |
| Migrate all three contracts to `CommonError` fully | One error idiom workspace-wide | Rewrites 72 discriminants in a deployed fund-handling contract for ~5% deduplication; breaks `sdks/js` error-code map and frontend consumers |
| Keep `rbac.rs`, wire it into `achievements` | Gives the engine a consumer; justifies its tests | `achievements` has a single-admin model and no team requirement — this invents a requirement to justify existing code |
| Keep `rbac.rs`, port it into `crowdfund` | Realises the `RBAC_TEAM_MANAGEMENT_IMPLEMENTATION.md` design | Same objection, at higher stakes: adds unrequested multi-member authorization to the contract that holds funds |
| Keep `rbac.rs` as-is, undocumented | No work | This is the status quo that produced this ADR; already failed once with `crowdfund`'s dead `rbac*.rs` |
| Delete `contracts/common` entirely | Removes a partially-adopted abstraction | `achievements` actively depends on it; discards the one real deduplication in place |

## Consequences

**Good:**
- The adoption state of `contracts/common` is written down per-symbol, so the next contributor does not have to re-derive it from `Cargo.toml` files and grep.
- `rbac.rs`'s status stops being ambiguous. No future issue asks to migrate to it.
- `registry`'s duplicated error enum — the one case where the shared crate would have prevented real duplication — gets a concrete, bounded migration with unchanged discriminants.
- The "new contracts depend on `common` from commit one" rule addresses the actual cause of the `registry` divergence (parallel development), rather than the symptom.

**Bad / trade-offs:**
- The workspace deliberately keeps two error idioms: `crowdfund` self-contained, `registry`/`achievements` folding in `CommonError`. Contributors moving between contracts will encounter both, and the ADR is the only thing explaining why.
- Deleting `rbac.rs` discards working, tested code. If a multi-member authorization requirement does appear, it must be recovered from `da3d8d0` and re-reviewed rather than simply used.
- `contracts/common` remains thin — after the `rbac.rs` deletion it is one 5-variant enum and three access-control helpers, two of which (`require_role`, `is_member`) still have no consumer. That is an acceptable outcome for a primitives crate, but it means the crate's value is currently modest and should not be oversold.
- `crowdfund`'s 72-variant enum stays duplicated with respect to its four shared cases. This is accepted permanently, not queued.

## References

- `contracts/common/README.md` — extraction rationale and the pre-existing `crowdfund` non-migration decision; links here
- `contracts/common/src/{error.rs,access_control.rs,rbac.rs}` — the surface inventoried above
- `contracts/crowdfund/src/errors.rs` (72 variants), `contracts/registry/src/errors.rs` (5 variants), `contracts/achievements/src/errors.rs` (`From<CommonError>` impl)
- `contracts/crowdfund/src/security.rs:239` — the colliding `crowdfund` `AccessControl`
- `RBAC_TEAM_MANAGEMENT_IMPLEMENTATION.md` — the never-shipped team-RBAC design that `rbac.rs` generalises
- Commit `da3d8d0` — extraction of `contracts/common`; recovery point for `rbac.rs`
- Commit `5053791` — `registry` typed errors, authored one day after the extraction
- Commit `cccfb78` — `achievements` adopting `common`
- [Issue #834](https://github.com/Fund-My-Cause/Fund-My-Cause/issues/834) — original extraction issue
- [Issue #857](https://github.com/Fund-My-Cause/Fund-My-Cause/issues/857) — this ADR
- Follow-up: delete `contracts/common/src/rbac.rs` (filed against decision 2)
- Follow-up: migrate `registry` to `CommonError`; add `From<CommonError>` to `crowdfund` (filed against decisions 3 and the adoption plan)
