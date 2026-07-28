# Frontend performance benchmarks

Vitest [`bench`](https://vitest.dev/guide/features.html#benchmarking) scripts that measure render performance for
frontend components with large datasets.

## Running

From `apps/interface`:

```sh
npx vitest bench performance/campaign-list-virtualization.bench.tsx
# or
npm run bench
```

## campaign-list-virtualization.bench.tsx

Renders a fixed dataset of 1000 mock campaigns two ways and compares mean render time:

- **unvirtualized** — every `CampaignCard` mounted at once (the pre-#867 behavior).
- **virtualized** — the same dataset mounted through `VirtualizedGrid`, which only renders rows
  in or near the viewport.

A `beforeAll` hook also logs how many `CampaignCard` instances each approach actually mounts, so
the reduction in mounted nodes is visible alongside the timing numbers.
