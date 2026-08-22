# Bundle Optimization Guide

This document describes the per-route bundle budgets and provides tips for keeping the frontend bundle lean.

## Budgets

Budgets are defined in [`apps/interface/bundle-budgets.json`](../apps/interface/bundle-budgets.json). CI enforces these budgets on every build — exceeding them will fail the `frontend_ci` workflow.

| Route | JS Budget | CSS Budget | Total |
|-------|-----------|------------|-------|
| `/` (landing) | 250 KB | 80 KB | 330 KB |
| `/campaigns` | 300 KB | 90 KB | 390 KB |
| `/campaigns/[id]` | 400 KB | 100 KB | 500 KB |
| `/create` | 350 KB | 90 KB | 440 KB |
| `/dashboard` | 350 KB | 90 KB | 440 KB |
| `/bookmarks` | 200 KB | 70 KB | 270 KB |
| `/settings` | 200 KB | 70 KB | 270 KB |
| `/embed/**` | 100 KB | 30 KB | 130 KB |
| Shared/framework | 180 KB | 50 KB | 230 KB |

## Optimization tips

### Code splitting

- Use **dynamic imports** (`next/dynamic`) for components not needed on initial render (e.g., modals, heavy charts, rich text editors)
- Lazy-load third-party libraries that are only used in specific user flows

```tsx
import dynamic from "next/dynamic";
const HeavyChart = dynamic(() => import("@/components/HeavyChart"), { ssr: false });
```

### Dependency hygiene

- **Audit regularly**: `npm ls --depth=0` to see top-level deps; remove anything unused
- **Prefer smaller alternatives**: e.g., `date-fns` over `moment`, `zod` over `joi`
- **Tree-shake imports**: import only what you need:

```tsx
// Good
import { formatDistance } from "date-fns";
// Bad
import { formatDistance } from "date-fns/formatDistance";
```

### CSS

- Tailwind's JIT compiler strips unused styles automatically — keep purge content paths accurate
- Avoid large CSS-in-JS runtime libraries; prefer Tailwind utility classes
- Keep custom CSS files small; extract repeated patterns into Tailwind components

### Image optimization

- Use `next/image` for automatic responsive images, lazy loading, and WebP/AVIF conversion
- Set explicit `width` and `height` to prevent layout shift and avoid loading oversized images
- Use CDN with image transformation for user-uploaded images

### Route-specific patterns

- **Campaign detail page** (`/campaigns/[id]`): the largest page by budget — keep campaign-specific components code-split
- **Embed widget**: must stay under 130 KB total — avoid any non-essential dependency
- **Shared chunks**: every new page adds framework overhead; consolidate routing where possible

## Local analysis

Run the budget check locally before pushing:

```bash
cd apps/interface
npm run build
node scripts/check-bundle-budgets.js
```

You can also use the built-in `bundleAnalysis.ts` utility for deeper analysis:

```ts
import { analyzeBundleSize, identifyLargeDependencies } from "@/lib/bundleAnalysis";
```

## Troubleshooting budget failures

| Symptom | Likely cause |
|---------|-------------|
| Shared chunk exceeds 180 KB | New large dependency added to `_app.tsx` or a shared layout |
| Route budget spikes without code changes | New import added to a page-level component |
| CSS budget exceeded | Large CSS library imported globally; verify Tailwind purge config |
