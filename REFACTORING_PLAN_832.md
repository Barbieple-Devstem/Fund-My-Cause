# Decomposition Plan for Issue #832: Monolith Reduction

## Executive Summary

This document outlines the complete decomposition plan for issue #832: breaking down the 5,848-line `contracts/crowdfund/src/lib.rs` monolith into focused, maintainable modules.

**Current Status**: 150 public functions in a single `impl CrowdfundContract` block  
**Target**: ~800-line `lib.rs` with 20+ focused modules, each handling a specific concern  
**Key Metric**: No function exceeds 100 lines without strong justification

---

## Completed Work

### Phase 1: Helper Functions Extraction ✅

**Created**: `contracts/crowdfund/src/helpers.rs` (270 lines)

**Functions extracted**:
1. `require_active_and_auth_creator()` — Creator validation + auth guard
2. `check_contributor_access()` — Blacklist + whitelist validation
3. `register_contributor_if_new()` — First-time contributor bookkeeping
4. `calculate_platform_fee()` — Platform fee calculation
5. `check_and_update_rate_limit()` — Rate limit validation
6. `apply_insurance_fee()` — Insurance fee deduction
7. `apply_matching()` — Matching fund application

**Impact**: These helpers immediately reduce duplication in `contribute()` and `contribute_on_behalf()` and provide single points of truth for common operations.

---

## Planned Work (Phases 2-22)

### Phase 2: Lifecycle Functions `lifecycle.rs` (TBD)

**Target functions** (7 functions, ~320 lines):
- `initialize()` — Campaign creation with full validation
- `initialize_from_template()` — Template-based creation
- `clone_campaign()` — Campaign cloning
- `cancel_campaign()` — Campaign cancellation
- `archive()`, `is_archived()`, `get_archived_at()` — Archival management

**Challenges**:
- `initialize()` and `initialize_from_template()` are near-duplicates; can share `write_initial_campaign_state()` helper
- Signature changes not needed; pure functional extraction

**Extraction approach**:
- Create `pub(crate) fn` signatures in `lifecycle.rs`
- Keep identical logic; refactor repetition using shared helpers
- `lib.rs` delegates via trait `#[contractimpl]` dispatch

---

### Phase 3: Contribute Functions `contribute.rs` (TBD)

**Target functions** (5 functions, ~500 lines):
- `contribute()` — Main contribution endpoint (373 lines)
- `contribute_on_behalf()` — Delegated contribution (138 lines)
- `delegate_contribution()` — Delegation setup
- `revoke_delegation()`, `get_delegation()` — Delegation management

**Challenges**:
- `contribute()` is the single largest function at 373 lines
- Currently does: validation, rate limiting, access checks, fee calculation, insurance deduction, matching, tier assignment, history recording, event emission
- Needs to be broken into smaller privat helpers within the module

**Extraction approach**:
1. Extract logic blocks as `fn contribute_validate_...()` private helpers
2. Reduce main function to ~100 lines of orchestration
3. Reuse helpers from `helpers.rs`
4. `contribute_on_behalf()` reimplements all validation manually; replace with calls to shared helpers

**Expected result**: Both functions drop to ~60 lines each

---

### Phase 4: Withdrawal & Streaming `withdraw.rs` (TBD)

**Target functions** (5 functions, ~230 lines):
- `withdraw()` — Fund release to creator
- `set_stream_config()`, `claim_stream()` — Streaming payments
- `record_release()`, `released_amount()` — Release tracking

**Challenges**:
- `withdraw()` and `claim_stream()` both implement platform fee deduction; extract to shared helper

**Extraction approach**:
- Shared helper: `apply_vesting_schedule()`, `transfer_and_emit_withdrawn_event()`

---

### Phase 5: Refund Functions `refund.rs` (TBD)

**Target functions** (4 functions, ~200 lines):
- `refund_single()`, `refund_batch()`, `refund_partial()`
- `refund_matching_sponsor()`

---

### Phase 6: Access Control & Pause `access.rs` (TBD)

**Target functions** (18 functions, ~280 lines):
- Whitelist: `add_to_whitelist()`, `remove_from_whitelist()`, `is_whitelisted()`, `set_whitelist_only()`
- Blacklist: `add_to_blacklist()`, `remove_from_blacklist()`, `is_blacklisted()`
- Allow/Deny: `add_to_allowlist()`, `remove_from_allowlist()`, `is_allowlisted()`, `add_to_denylist()`, `remove_from_denylist()`, `is_denylisted()`
- Visibility: `set_visibility()`, `get_visibility()`
- Ownership: `transfer_ownership()`
- Pause control: `pause()`, `resume()`, `unpause()`
- Rate limit: `set_rate_limit()`, `get_rate_limit()`, `set_pause_timelock()`

---

### Phase 7: Metadata & Discovery `metadata.rs` (TBD)

**Target functions** (11 functions, ~280 lines):
- `update_metadata()` — Update title/description
- `update_ipfs_cid()`, `get_ipfs_cid()` — IPFS content addressing
- `extend_deadline()` — Deadline extension (without voting)
- `adjust_goal()` — Goal adjustment
- `update_category()` — Category change
- `set_caps()` — Soft-cap / stretch-goal configuration
- `index_campaign()`, `search_by_category()`, `search_by_visibility()`, `get_search_index()` — Search/indexing

---

### Phase 8: Extension Voting `extension.rs` (TBD)

**Target functions** (4 functions, ~160 lines):
- `propose_extension()` — Propose deadline extension
- `vote_on_extension()` — Vote on extension
- `execute_extension()` — Execute extension
- `get_extension_proposal()` — Query proposal

---

### Phase 9: Emergency Withdrawal `emergency.rs` (TBD)

**Target functions** (5 functions, ~210 lines):
- `initiate_emergency_withdrawal()` — Start emergency procedure
- `execute_emergency_withdrawal()` — Execute withdrawal
- `cancel_emergency_withdrawal()` — Cancel procedure
- `setup_emergency_multisig()` — Configure multi-sig
- `approve_emergency_withdrawal()` — Multi-sig approval (91 lines)

---

### Phase 10: Milestones `milestones.rs` (TBD)

**Target functions** (3 functions, ~80 lines):
- `set_milestones()`
- `get_milestones()`
- `verify_milestone()` (43 lines)
- `update_verification()`, `get_verification()`

---

### Phase 11: Matching Funds `matching.rs` (TBD)

**Target functions** (4 functions, ~120 lines):
- `setup_matching()`
- `get_matching_config()`, `get_total_matched()`, `get_matching_pool()`

---

### Phase 12: Insurance `insurance.rs` (TBD)

**Target functions** (5 functions, ~150 lines):
- `enable_insurance()`
- `get_insurance_config()`, `get_insurance_pool()`, `get_insurance_fee()`
- `claim_insurance_payout()` (63 lines)

---

### Phase 13: Rewards & Tiers `rewards.rs` (TBD)

**Target functions** (5 functions, ~190 lines):
- `set_reward_tiers()`
- `get_tier_for_amount()`, `get_contributor_tier()`
- `configure_rewards()`
- `distribute_rewards()`

---

### Phase 14: Disputes `disputes.rs` (TBD)

**Target functions** (4 functions, ~200 lines):
- `file_dispute()`
- `vote_on_dispute()` (64 lines)
- `resolve_dispute()`
- `get_dispute()`

---

### Phase 15: Governance `governance.rs` (TBD)

**Target functions** (10 functions, ~400 lines):
- `initialize_governance()`
- `propose_platform_update()`
- `vote_on_proposal()` (87 lines)
- `execute_proposal()`
- `emergency_pause()`, `emergency_resume()`
- `update_governance_config()`, `get_governance_config()`, `get_proposal()`, `is_emergency_paused()`

---

### Phase 16: DeFi / Yield `defi.rs` (TBD)

**Target functions** (4 functions, ~180 lines):
- `configure_yield()`
- `claim_yield()` (78 lines)
- `get_yield_config()`, `pending_yield()`

---

### Phase 17: Analytics & Performance `analytics.rs` (TBD)

**Target functions** (4 functions, ~220 lines):
- `get_analytics()` (46 lines)
- `get_performance_metrics()` (131 lines)
- `get_stats()`
- `get_qf_inputs()`

---

### Phase 18: Admin Tools `admin.rs` (TBD)

**Target functions** (12 functions, ~300 lines):
- Versioning: `contract_version()`, `check_version()`, `migrate_version()`, `get_version_history()`
- Validation: `validate_state()`, `get_last_validation()`
- Debugging: `debug_snapshot()`, `get_debug_snapshot()`, `debug_log()`, `inspect_contribution()`
- Performance: `set_perf_threshold()`, `get_perf_threshold()`, `record_execution()`, `get_perf_stats()`

---

### Phase 19: Templates `templates.rs` (TBD)

**Target functions** (2 functions, ~50 lines):
- `set_template()`
- `get_template()`

---

### Phase 20: Recurring Contributions `recurring.rs` (Already exists)

**Already extracted**: 
- `setup_recurring()`, `execute_recurring()`, `cancel_recurring()`

**No changes needed** — this module already exists

---

### Phase 21: Read-Only Views `views.rs` (TBD)

**Target functions** (26 functions, ~450 lines):
- All trivial getter functions with no side effects:
  - `total_raised()`, `creator()`, `status()`, `goal()`, `deadline()`
  - `contribution()`, `is_contributor()`, `min_contribution()`, `max_contribution()`
  - `title()`, `description()`, `social_links()`, `accepted_tokens()`, `platform_config()`
  - `get_fee_mode()`, `version()`
  - `get_campaign_info()`, `get_category()`, `get_vesting_info()`, `get_vested_amount()`
  - `get_goal_history()`, `get_metadata_history()`, `get_penalty_bps()`
  - `contributor_list()`, `get_contribution_message()`, `get_contribution_history()`
  - `get_recurring_plan()`, `get_extension_proposal()`

---

### Phase 22: Updated lib.rs (TBD)

**Target size**: ~750 lines

**Contents**:
- Module declarations (22 `mod X;`)
- Re-exports for public types and errors
- Single `#[contract]` / `#[contractimpl]` impl block
- All 150 functions delegating to module-level `pub(crate) fn`

**Example pattern**:
```rust
#[contractimpl]
impl CrowdfundContract {
    pub fn contribute(env: Env, ...) -> Result<(), ContractError> {
        contribute::contribute(env, ...)
    }
    
    pub fn total_raised(env: Env) -> i128 {
        views::total_raised(env)
    }
    
    // ... 148 more delegations
}
```

---

## Testing Strategy

1. **No logic changes** — all refactoring is pure code movement
2. **Run full existing test suite** after each phase:
   - `cargo test --workspace` (unit tests in `src/test.rs`)
   - Integration tests in `tests/integration.rs`, `tests/fuzz_tests.rs`, `tests/invariants.rs`, `tests/adversarial.rs`
3. **Validation**: `cargo clippy --workspace` and `cargo fmt --check` must pass
4. **Contract ABI**: No changes to public function signatures or behavior

---

## Success Criteria (from issue #832)

- [ ] `lib.rs` reduced to primarily the contract trait implementation and delegation calls (target: under ~800 lines)
- [ ] No function exceeds ~80–100 lines without justification
- [ ] All existing tests (unit, integration, fuzz, invariant, adversarial) pass unchanged
- [ ] `cargo clippy --workspace` and `cargo fmt --check` remain clean

---

## Dependencies Between Phases

- **Strict ordering**: Phase 1 (helpers) must complete first; enables Phases 2–21
- **Parallel work**: Phases 2–21 are independent and can be done in any order
- **Phase 22**: Must be last (refactors `lib.rs` to delegate to all modules)

---

## Files Affected

### New Files to Create (22 total)
- ✅ `contracts/crowdfund/src/helpers.rs` (Phase 1 — Complete)
- `contracts/crowdfund/src/lifecycle.rs` (Phase 2)
- `contracts/crowdfund/src/contribute.rs` (Phase 3)
- `contracts/crowdfund/src/withdraw.rs` (Phase 4)
- `contracts/crowdfund/src/refund.rs` (Phase 5)
- `contracts/crowdfund/src/access.rs` (Phase 6)
- `contracts/crowdfund/src/metadata.rs` (Phase 7)
- `contracts/crowdfund/src/extension.rs` (Phase 8)
- `contracts/crowdfund/src/emergency.rs` (Phase 9)
- `contracts/crowdfund/src/milestones.rs` (Phase 10)
- `contracts/crowdfund/src/matching.rs` (Phase 11)
- `contracts/crowdfund/src/insurance.rs` (Phase 12)
- `contracts/crowdfund/src/rewards.rs` (Phase 13)
- `contracts/crowdfund/src/disputes.rs` (Phase 14)
- `contracts/crowdfund/src/governance.rs` (Phase 15)
- `contracts/crowdfund/src/defi.rs` (Phase 16)
- `contracts/crowdfund/src/analytics.rs` (Phase 17)
- `contracts/crowdfund/src/admin.rs` (Phase 18)
- `contracts/crowdfund/src/templates.rs` (Phase 19)
- `contracts/crowdfund/src/views.rs` (Phase 21)

### Existing Files to Modify
- `contracts/crowdfund/src/lib.rs` — Add module declarations and delegation impl (Phase 22)

### Existing Modules (No Changes)
- `contracts/crowdfund/src/errors.rs` — Keep as-is
- `contracts/crowdfund/src/types.rs` — Keep as-is
- `contracts/crowdfund/src/storage.rs` — Keep as-is
- `contracts/crowdfund/src/validation.rs` — Keep as-is
- `contracts/crowdfund/src/recurring.rs` — Keep as-is
- `contracts/crowdfund/src/security.rs` — Keep as-is
- `contracts/crowdfund/src/test.rs` — Keep as-is (still imported in lib.rs)

---

## Implementation Notes

### Code Movement, No Logic Changes
- Each module's functions are extracted as-is from `lib.rs`
- No algorithmic changes or refactoring within functions (outside of calling shared helpers)
- All behavior must remain identical to pass existing tests

### Module Visibility
- All extracted functions are `pub(crate)` (visible within the contract crate, but not to external consumers)
- Only re-exported via `lib.rs` through the contract trait impl

### Shared State Access
- All modules import `Env`, `Address`, `soroban_sdk::token` as needed
- Access storage via `env.storage().instance()` and `env.storage().persistent()` — no abstraction layer introduced

### Build & Deployment
- Build size should remain the same (WASM is optimized)
- No changes to contract ABI or external function signatures
- Deployment process unchanged

---

## Rollback Plan

If any phase encounters unexpected issues:
1. Revert the branch back to `main`
2. Analyze the root cause
3. Start fresh with a more conservative extraction (fewer/smaller modules)

---

## Next Steps

1. **Phase 2–21**: Create each module file one at a time, extract functions, run tests
2. **Phase 22**: Refactor `lib.rs` to delegate to all modules
3. **Final validation**: Run full test suite, ensure no regressions
4. **Merge**: Open PR with complete decomposition

---

**Status**: Phase 1 ✅ Complete; Ready to begin Phase 2
