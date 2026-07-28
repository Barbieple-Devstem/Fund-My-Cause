# Gas Regression Benchmarks

This document describes the regression testing suite for the Fund-My-Cause smart contracts (crowdfund, registry, achievements).

## Overview

Gas regression benchmarks ensure that code changes do not unexpectedly increase contract execution costs, which could:
- Increase transaction fees for end users
- Push critical paths over resource limits
- Degrade platform economics

## Quick Start

### Run All Benchmarks

```bash
cd contracts/benchmarks
cargo bench
```

This runs all benchmarks (contract_benchmarks, registry_benchmarks, achievements_benchmarks) and outputs:
- Criterion HTML reports in `target/criterion/`
- Summary table of median CPU cycles and instructions
- Comparative statistics vs. baseline

### Run Specific Benchmark Suite

```bash
# Crowdfund contract only
cargo bench --bench contract_benchmarks

# Registry contract only
cargo bench --bench registry_benchmarks

# Achievements contract only
cargo bench --bench achievements_benchmarks
```

### Run Specific Benchmark

```bash
# Single function from crowdfund
cargo bench --bench contract_benchmarks -- contribute_single

# Multiple related functions (regex matching)
cargo bench --bench contract_benchmarks -- refund
```

## Baseline Snapshot

The baseline snapshot is stored in `baseline-gas-metrics.txt`. This file contains:
- Median instruction counts for each benchmark
- Median CPU cycles
- Notes on what each benchmark tests
- Known coverage gaps

To establish a new baseline:

```bash
# 1. Run benchmarks and capture output
cargo bench 2>&1 | tee full_benchmark_output.txt

# 2. Extract criterion JSON reports (auto-generated)
# Look in: target/criterion/report/base/raw.json

# 3. Update baseline-gas-metrics.txt with new values
# Format: function_name | median_instructions | median_cpu_cycles | notes

# 4. Commit updated baseline
git add baseline-gas-metrics.txt
git commit -m "refactor/fix: update gas baseline after optimization"
```

## Regression Threshold

A **regression** is flagged when:
- **Any function exceeds 15% increase** in CPU instructions vs. baseline
- **Critical paths** (initialize, contribute, withdraw) flagged at 10%

Example:
```
Baseline:   contribute_single = 50,000 instructions
Current:    contribute_single = 59,000 instructions
Δ = (59,000 - 50,000) / 50,000 = 18% → ⚠️  REGRESSION
```

## Interpreting Results

### Criterion Output

```
result:   [51234 51342 51456] cpu_cycles
          time:   [154.12 ms 155.23 ms 156.45 ms]
          change: [-0.53% +0.12% +0.78%] (within noise)
```

**Read as:**
- **Lower/Middle/Upper quartile** (50th percentile ± 25%)
- **time:** Wall-clock milliseconds (less reliable due to OS noise)
- **change:** % delta vs. previous run (if baseline saved)

### HTML Report

Open `target/criterion/report/index.html` for:
- Visual graphs of instruction/CPU cycles over iterations
- Performance variance analysis
- Comparative statistics

## Coverage by Contract

### Crowdfund Contract ✓ CRITICAL PATHS

| Entry Point | Benchmark | Status |
|---|---|---|
| `initialize` | ✓ | Covered |
| `initialize_from_template` | ✓ | Covered (implicit) |
| `contribute` | ✓ | Extensively (single, multiple, repeat, message, fee, matching) |
| `withdraw` | ✓ | Covered (basic, vesting, fee) |
| `refund_single` | ✓ | Covered |
| `refund_batch` | ✓ | Covered (batch-25) |
| `cancel_campaign` | ⚠️ | Coverage gap |
| `extend_deadline` | ⚠️ | Coverage gap |
| `adjust_goal` | ⚠️ | Coverage gap |
| `set_rate_limit` | ⚠️ | Coverage gap |
| `enable_insurance` | ⚠️ | Coverage gap |
| Emergency withdrawal | ⚠️ | Coverage gap |
| Delegation contributions | ⚠️ | Coverage gap |

### Registry Contract ✓ PARTIAL

| Entry Point | Benchmark | Status |
|---|---|---|
| `initialize` | ✓ | Covered (implicit via deploy) |
| `register` | ✓ | Covered |
| `verify` | ✓ | Covered |
| `get` | ✓ | Covered |
| `get_by_creator` | ✓ | Covered |
| `list` | ✓ | Covered (pagination) |
| `update_metadata` | ✓ | Covered |

### Achievements Contract ✓ GOOD

| Entry Point | Benchmark | Status |
|---|---|---|
| `initialize` | ✓ | Covered (implicit) |
| `unlock_achievement` | ✓ | Covered (first, all-13) |
| `record_contribution` | ✓ | Covered (first, repeat, auto-unlock) |
| `get_points` | ✓ | Covered |
| `query_leaderboard` | ✓ | Covered |
| `claim_reward` | ⚠️ | Coverage gap |

## Adding a New Benchmark

### 1. Identify the Entry Point

```rust
pub fn my_new_function(env: Env, param: Address) -> Result<(), ContractError> { ... }
```

### 2. Add Helper (if needed)

```rust
fn setup_scenario(env: &Env) -> (ContractClient, Address, Address) {
    // Initialize contract and test data
    (client, addr1, addr2)
}
```

### 3. Write Benchmark

```rust
fn benchmark_my_feature(c: &mut Criterion) {
    c.bench_function("my_new_function_happy_path", |b| {
        b.iter(|| {
            let env = Env::default();
            let (client, addr1, addr2) = setup_scenario(&env);

            // Warm up state if needed (cache results in variable, don't black_box)
            
            // Black-box the actual call
            black_box(client.my_new_function(&addr1))
        })
    });

    // Add edge cases
    c.bench_function("my_new_function_worst_case", |b| {
        b.iter(|| {
            // ... test worst-case scenario
        })
    });
}
```

### 4. Register in Criterion

```rust
criterion_group!(
    benches,
    benchmark_contribute,
    benchmark_refund,
    benchmark_my_feature  // ← Add here
);
criterion_main!(benches);
```

### 5. Run and Update Baseline

```bash
cargo bench --bench contract_benchmarks -- my_new_function
# Note median instruction count
# Update baseline-gas-metrics.txt
```

## Automated CI Integration (Roadmap)

The following CI checks are planned but not yet implemented:

### 1. Parse Criterion JSON

```bash
# Script to extract from: target/criterion/*/report/base/raw.json
python scripts/extract_gas_baseline.py
```

### 2. Compare Against Threshold

```bash
# Fail if any function regresses > 15%
python scripts/check_regression.py baseline-gas-metrics.txt current-metrics.json
```

### 3. Generate HTML Report

```bash
# Publish to PR/artifacts for review
python scripts/generate_regression_report.html
```

### 4. GitHub Workflow

```yaml
# .github/workflows/gas-regression.yml
on: [pull_request]
jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - run: cargo bench
      - run: python scripts/check_regression.py
      # Fail if regression detected
```

## Performance Tips

### For Contributors

- **Before optimizing**, establish baseline: `cargo bench --bench <suite>`
- **After change**, re-run same benchmark and compare
- **Document** the optimization in commit message
- **Update baseline** only if regression threshold is intentional

### For Reviewers

- **Check baseline delta** in PR description
- **Ensure coverage** — regression detected should have benchmark
- **Query for intent** — is 5% regression from new feature OK?
- **Approve** only if within threshold or documented exemption

### For Release Management

1. **Tag release** with baseline snapshot
2. **Archive** `baseline-gas-metrics.txt` in release notes
3. **Compare** next release against tag, not main

## Common Patterns

### Testing a Hot Path with State Setup

```rust
c.bench_function("contribute_with_100_existing_contributors", |b| {
    b.iter(|| {
        let env = Env::default();
        let (client, token_id, token_admin) = create_test_campaign(...);

        // Setup: Register 100 contributors (amortized, doesn't count toward benchmark)
        for i in 0..100 {
            let contrib = Address::generate(&env);
            token_admin.mint(&contrib, &1_000);
            client.contribute(&contrib, &1_000, &token_id, &None);
        }

        // Benchmark: The 101st contribution
        let new_contrib = Address::generate(&env);
        token_admin.mint(&new_contrib, &1_000);
        black_box(client.contribute(&new_contrib, &1_000, &token_id, &None))
    })
});
```

### Measuring Variance (Best/Avg/Worst)

```rust
c.bench_function("contribute_best_case", |b| {
    // Minimal state setup
});

c.bench_function("contribute_average_case", |b| {
    // Moderate state setup (50 contributors)
});

c.bench_function("contribute_worst_case", |b| {
    // Heavy state setup (1000 contributors, max fee, insurance, etc.)
});
```

## References

- [Criterion.rs Documentation](https://bheisler.github.io/criterion.rs/book/)
- [Soroban Cost Estimates](https://developers.stellar.org/docs/learn/soroban-gas-metering)
- [GitHub Actions CI/CD](https://docs.github.com/en/actions)

## FAQ

**Q: Why measure CPU instructions instead of gas?**
A: Soroban's test environment provides `env.cost_estimate()` which tracks instruction count and budget. Gas is only computable on-network (Stellar fees depend on network state). Instruction count is a stable proxy for on-chain cost.

**Q: Can I run benchmarks on my laptop?**
A: Yes. Criterion's statistical analysis normalizes for system variance, but for best results use a quiet machine and run multiple times. CI machines are ideal for reproducible baselines.

**Q: What if a benchmark regresses but the feature is worth it?**
A: Document in the commit message: "Performance regression is intentional: feature X worth Y% cost increase." Reviewer approves explicitly in code review. Update baseline with comment explaining trade-off.

**Q: How do I profile a specific hot path?**
A: Use `perf` (Linux) or `Instruments` (macOS):
  ```bash
  cargo bench --bench contract_benchmarks -- --profile-time 10
  ```
  This runs longer, reducing noise and revealing finer details.

## Maintenance

- **Review quarterly** — ensure all critical entry points are benchmarked
- **Update baseline** after major refactors with performance intent
- **Archive old baselines** — keep with release tags for historical comparison
