# Mutation Testing

## Overview

Mutation testing validates the quality of test assertions by introducing small code mutations and checking if tests catch them.

## Setup

Install dependencies:

```bash
npm install
```

## Running Tests

```bash
# Run mutation testing (may take 10-30 minutes)
npm run test:mutation

# View results
npm run test:mutation:report
```

## Thresholds

- **High**: 80% (good test quality)
- **Low**: 60% (acceptable)
- **Break**: 50% (CI will fail)

## Target Areas

- `src/lib/**` - Core utilities and helpers
- `src/services/**` - API and business logic services

## Surviving Mutants

If mutants survive, it indicates weak assertions. Common causes:

1. **No assertion on return value**
2. **Missing edge case tests**
3. **Incomplete error handling tests**

## Addressing Survivors

1. Review the mutation report
2. Identify high-value survivors (critical logic)
3. Strengthen tests with specific assertions
4. Re-run to confirm

## CI Integration

Mutation tests run on PR branches targeting main. A score below 50% blocks merge.
