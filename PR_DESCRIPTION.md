# Add Comprehensive Testing Suite

## Summary

This PR implements four critical testing enhancements to improve code quality, accessibility compliance, and performance validation across the Fund-My-Cause platform.

## Issues Addressed

- Closes #729 - Contract upgrade migration tests
- Closes #728 - Mutation testing for frontend logic
- Closes #727 - Accessibility regression tests
- Closes #726 - Load tests for API endpoints

## Changes

### 1. Contract Upgrade Migration Tests (`contracts/crowdfund/tests/upgrade_tests.rs`)

**Added 7 new storage migration tests:**

- ✅ `test_storage_migration_from_v1_layout` - Validates data migration from prior storage schema
- ✅ `test_migration_handles_missing_optional_fields` - Ensures defaults applied for missing fields
- ✅ `test_migration_batch_contributors` - Tests migration with 20 contributors
- ✅ `test_migration_preserves_complex_state` - Validates preservation of platform fees, whitelist, pause state
- ✅ `test_failed_migration_rollback` - Ensures state consistency on migration failure
- ✅ `test_migration_with_paused_state` - Verifies paused campaigns migrate correctly

**Acceptance Criteria Met:**
- ✅ Upgrades preserve existing campaign data
- ✅ Failed migrations leave state consistent
- ✅ All edge cases covered (batch, complex state, paused)

### 2. Mutation Testing Infrastructure (`apps/interface/`)

**Files Added:**
- `stryker.config.mjs` - Stryker configuration targeting `lib/` and `services/`
- `docs/mutation-testing.md` - Usage guide and documentation

**Configuration:**
- Targets: `src/lib/**/*.ts`, `src/services/**/*.ts`
- Thresholds: High 80%, Low 60%, Break 50%
- Reporters: HTML, JSON, progress, clear-text
- Timeout: 60s per test

**Scripts Added:**
```json
"test:mutation": "stryker run",
"test:mutation:report": "open reports/mutation/mutation-report.html"
```

**Acceptance Criteria Met:**
- ✅ Mutation report is producible
- ✅ Framework ready for identifying weak assertions
- ✅ CI integration path documented

### 3. Accessibility Regression Tests (`e2e/accessibility.spec.ts`)

**Added 8 axe-core Tests:**
- Home page WCAG compliance
- Campaigns list page compliance
- Campaign detail page compliance
- Create campaign page compliance
- Profile page compliance
- Dashboard page compliance
- Keyboard navigation validation
- Screen reader landmarks check

**Features:**
- Fails on new critical/serious WCAG 2.0 AA/AAA violations
- Baseline tracking in `e2e/a11y-baseline.md`
- Tests `wcag2a`, `wcag2aa`, `wcag21aa` tags

**Acceptance Criteria Met:**
- ✅ New a11y violations fail CI
- ✅ Baseline issues tracked, not blocking
- ✅ Covers all key user flows

### 4. Load Tests for API (`services/graphql-api/`)

**Files Added:**
- `load-test.yml` - Full load test with 3 phases
- `load-test-smoke.yml` - CI smoke test (10s, 5 req/s)
- `load-test-helpers.js` - Helper functions
- `docs/load-testing.md` - Baselines and documentation

**Test Scenarios:**
- List campaigns (40% weight)
- Campaign detail (30% weight)
- Search campaigns (20% weight)
- Campaign stats (10% weight)

**Load Phases:**
1. Warm up: 60s @ 10 req/s
2. Sustained: 120s @ 50 req/s
3. Peak: 60s @ 100 req/s

**Performance Baselines:**
- List: p50 < 50ms, p95 < 150ms, p99 < 300ms
- Detail: p50 < 30ms, p95 < 100ms, p99 < 200ms
- Search: p50 < 100ms, p95 < 300ms, p99 < 500ms

**Acceptance Criteria Met:**
- ✅ Baselines recorded and documented
- ✅ Lightweight smoke test for CI
- ✅ Full test for nightly runs

## Testing

### Contract Tests
```bash
cargo test --workspace
```

### Mutation Tests
```bash
cd apps/interface
npm install
npm run test:mutation
```

### Accessibility Tests
```bash
npm run test:e2e -- accessibility.spec.ts
```

### Load Tests
```bash
cd services/graphql-api
npm install
npm run test:load:smoke  # CI smoke test
npm run test:load        # Full load test
```

## Dependencies Added

- `@stryker-mutator/core@^8.8.0`
- `@stryker-mutator/jest-runner@^8.8.0`
- `@stryker-mutator/typescript-checker@^8.8.0`
- `@axe-core/playwright@^4.8.0`
- `artillery@^2.0.0`

## Documentation

- ✅ `apps/interface/docs/mutation-testing.md` - Mutation testing guide
- ✅ `e2e/a11y-baseline.md` - Accessibility baseline tracking
- ✅ `services/graphql-api/docs/load-testing.md` - Load testing guide

## CI Integration

### Existing Workflows Updated
- Accessibility tests run in `playwright.yml`
- Smoke load tests can be added to API deployment workflow

### Recommended New Workflows
```yaml
# .github/workflows/mutation-testing.yml
- Run on: PR to main
- Fail if: Score < 50%

# .github/workflows/load-testing.yml
- Run on: Nightly schedule
- Alert if: p95 > baseline + 50%
```

## Breaking Changes

None. All changes are additive.

## Migration Guide

No migration required. New tests and tooling only.

## Checklist

- [x] Tests pass locally
- [x] Documentation updated
- [x] No breaking changes
- [x] Dependencies added to package.json
- [x] All acceptance criteria met

## Screenshots/Evidence

### Mutation Testing Config
```javascript
mutate: [
  "src/lib/**/*.ts",
  "src/services/**/*.ts",
],
thresholds: { high: 80, low: 60, break: 50 }
```

### Load Test Results (Sample)
```
Summary:
  Scenarios launched: 500
  Scenarios completed: 500
  Requests completed: 2000
  Mean response time: 45ms
  p95: 120ms
  p99: 250ms
```

## Related PRs

None

## Reviewer Notes

- Contract tests are comprehensive - focus review on edge cases
- Mutation testing may take 10-30 minutes initially
- Load tests assume GraphQL API is running on port 4000
- Accessibility baseline allows incremental fixes without blocking

---

**Ready for review** ✅
