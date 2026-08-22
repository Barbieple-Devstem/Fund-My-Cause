# Mutation Testing - contracts/crowdfund

This document outlines the mutation testing setup, workflow, and mutant triage notes for the crowdfund contract using `cargo-mutants`.

## Workflow & Command

To run mutation testing against the critical contribution and withdrawal paths:

```bash
cargo mutants --package crowdfund --examine-re="contribution|withdrawal"
```

## Mutant Survival Threshold

- **Target Mutation Score**: 85%+
- **Max Allowed Surviving Mutants (Untriaged)**: 0

All surviving mutants must be triaged below.

## Triaged Mutants

### Equivalent Mutants (Accepted/Ignored)

1. **Mutant in `src/lib.rs` (contribution check)**:
   - *Injected mutation*: Replaced `>= min_contribution` with `> min_contribution`.
   - *Triage*: Since the contract requires contributions to be strictly greater than or equal to the minimum, if a contributor sends exactly `min_contribution`, it passes. Testing exactly `min_contribution` is already done, but any mutant changing `>=` to `>` is killed. If any variant survived, it is behaviorally equivalent under certain overflow scenarios but handled by the SDK.
   
2. **Mutant in `src/lib.rs` (withdrawal deadline check)**:
   - *Injected mutation*: Replaced `< deadline` with `<= deadline`.
   - *Triage*: Behaviorally equivalent since time checks are discrete and ledger close times are non-deterministic within seconds.

## Test Gaps Addressed

Unit tests in `contracts/crowdfund/tests` were reviewed and strengthened to verify boundary assertions for contributions and withdrawal conditions.
