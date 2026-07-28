# `crowdfund`

The Fund-My-Cause crowdfunding campaign contract — contributions, refunds,
withdrawals, delegation, milestones, governance, and related campaign
lifecycle logic.

## Fuzz / Property Testing

Contribution/refund/withdrawal logic is covered by proptest-based property
tests (not cargo-fuzz — see "Why proptest, not cargo-fuzz" below), spread
across:

- `tests/fuzz_tests.rs` — contribute/refund/withdraw properties, cross-function
  multi-contributor interaction, numerical edge cases near `i128::MAX`.
- `tests/arithmetic_safety.rs` — overflow/underflow properties added for
  issue #919 (checked/saturating arithmetic across fee, matching, vesting,
  dispute, and streaming paths).
- `tests/invariants.rs` — fund-conservation invariants (total raised equals
  sum of contributions, refunds never exceed contributions, contract balance
  tracks unrefunded/unwithdrawn funds).
- `tests/fuzz_interleaved.rs` — arbitrary-length, arbitrary-*order* sequences
  of interleaved contribute/refund/withdraw/advance-time calls across
  multiple accounts (issue #922), plus targeted coverage for
  `contribute_on_behalf`'s delegation-amount arithmetic.

### Running normally (CI / local)

```sh
cargo test -p crowdfund
```

Each file's `ProptestConfig::with_cases(N)` controls its own case count
(currently 200–300 per property group, matching the file-local
`#![proptest_config(...)]` attributes) — no special invocation is needed for
day-to-day development.

### Extended pre-release session

Before a release or security-sensitive change, run the interleaved harness
with far more cases than CI uses day-to-day:

```sh
PROPTEST_CASES=10000 cargo test -p crowdfund --release fuzz_interleaved
```

`--release` is worth using for a long run: it's faster than debug, and the
workspace forces `overflow-checks = true` in the release profile (root
`Cargo.toml`), so overflow panics are still caught even in release mode.

Any failing case proptest shrinks to is written to a
`tests/fuzz_interleaved.proptest-regressions` file (the same convention
already used by `tests/fuzz_tests.proptest-regressions`) — commit that file
so the regression is permanently pinned and re-checked on every future run.

### Why proptest, not cargo-fuzz

`cargo-fuzz` (libFuzzer-based) requires a nightly Rust toolchain for its
sanitizer/coverage instrumentation. This workspace pins a stable toolchain
(`rust-toolchain.toml`, currently `1.86.0`) and no CI workflow installs
nightly. `proptest` runs on stable, is already a dev-dependency here and in
`contracts/achievements`, and is the established house pattern across two
prior fuzzing efforts (issues #835 and #919) — so it's the natural choice
for #922 too, rather than introducing a second, heavier fuzzing toolchain
for a codebase that has deliberately avoided one.
