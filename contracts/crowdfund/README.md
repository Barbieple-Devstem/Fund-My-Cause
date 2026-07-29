# Crowdfund Smart Contract

This directory contains the Soroban smart contract for campaign creation, contributions, withdrawals, and refunds.

## Local Test Coverage Target
We enforce a minimum **85% line and branch coverage** target for `contracts/crowdfund`.

### Running Coverage Locally
To measure test coverage locally, use `cargo-tarpaulin`:

```bash
cargo tarpaulin --manifest-path contracts/crowdfund/Cargo.toml --out Html
```
