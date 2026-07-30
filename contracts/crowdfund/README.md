# Crowdfund Smart Contract

This directory contains the Soroban smart contract for campaign creation, contributions, withdrawals, and refunds.

## Local Test Coverage Target
We enforce a minimum **85% line and branch coverage** target for `contracts/crowdfund`.

### Running Coverage Locally
To measure test coverage locally, use `cargo-tarpaulin`:

```bash
cargo tarpaulin --manifest-path contracts/crowdfund/Cargo.toml --out Html
```

## Linting

Run Clippy across the entire contracts workspace with all targets and features:

```bash
cargo clippy --workspace --all-targets --all-features
```

This command checks all contract crates (`crowdfund`, `achievements`, `registry`, `common`) including test code. Fix all warnings before submitting a PR. Use narrowly scoped `#[allow(...)]` attributes only when a warning is intentional, with an explanatory comment.
