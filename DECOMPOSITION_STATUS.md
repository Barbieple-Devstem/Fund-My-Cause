# Issue #832 Decomposition - Status Update

## Summary

`contracts/crowdfund/src/lib.rs` is down from 6,041 lines to 4,016 (a 34% reduction),
with 11 focused modules now actually wired into the contract impl.

**Correction to the previous version of this document.** It claimed 5 modules complete
and roughly 1,550 lines removed from `lib.rs`. That was not accurate. The module files
had been written, but Phase 22 (the `lib.rs` delegation pass) was never done, so nothing
in `lib.rs` ever called them. Every one of those modules was dead code sitting beside a
full duplicate of itself in `lib.rs`, and the two copies had already drifted apart in
both directions. Phase 22 is no longer a trailing phase; each module is wired in the
same change that extracts it.

---

## Completed and wired

| Phase | Module | Contents |
|---|---|---|
| 1 | `helpers.rs` | `require_auth_creator()` |
| 2 | `lifecycle.rs` | initialize, initialize_from_template, clone, cancel, archive |
| 3 | `contribute.rs` | contribute, contribute_on_behalf, delegation |
| 4 | `withdraw.rs` | withdraw, streaming, release tracking |
| 5 | `refund.rs` | single, batch, partial, matching-sponsor |
| 6 | `access.rs` | whitelist, blacklist, allow/deny, visibility, ownership, pause, rate limit |
| 7 | `metadata.rs` | update_metadata, IPFS CID, metadata history |
| 17 | `analytics.rs` | performance metrics, analytics, stats, QF inputs, state validation |
| 21 | `views.rs` | read-only getters |
| - | `recurring.rs` | recurring contribution plans (already wired) |
| - | `security.rs`, `storage.rs`, `types.rs`, `validation.rs`, `errors.rs` | shared primitives |

`contribute()` was the headline target at 385 lines. It is now 74 lines of orchestration
over named private helpers in `contribute.rs`: `read_campaign_snapshot`,
`validate_preconditions`, `check_access`, `enforce_rate_limit`, `validate_token`,
`apply_fees`, `apply_matching_and_total`, `record_contributor`, `record_history`,
`assign_reward_tier`, `emit_contribution_events`.

---

## Drift found while wiring

The dead module copies were not stale snapshots of `lib.rs`. Each side held changes the
other lacked, so every function had to be merged rather than moved:

- `refund.rs` lacked the `Status::Successful` guard that stops a second payout after
  `withdraw()` has drained the balance, and lacked the #695 proportional released-amount
  reduction. `lib.rs` lacked the #835 typed-error guards. Both were kept.
- The `access.rs` copy applied a `Status::Active` requirement to six access-control
  functions that never had one, which would have blocked a creator from correcting a
  whitelist on a paused or ended campaign. `require_auth_creator()` was split out from
  `require_active_and_auth_creator()` so only `pause()` gates on status, as before.

---

## Remaining phases

Phases 8-16, 18-20 and 22 are unstarted: extension voting, emergency, milestones,
matching, insurance, rewards, disputes, governance, DeFi, admin, templates. `lib.rs`
still holds 150 `pub fn` entry points, so the contract impl block remains the place to
carve from next.

Out of scope here and worth its own issue: 92 of the crate's 99 remaining build warnings
are `Events::publish` deprecations from the SDK. Migrating them to `#[contractevent]`
changes event encoding, so it is a behaviour change, not a cleanup. Contract CI runs
`clippy -D warnings` and cannot pass until that is resolved.
