# Fund-My-Cause — Web Interface

The Next.js frontend. See the [repository README](../../README.md) for
environment setup and how to run the full stack.

```bash
npm run dev      # start the dev server
npm run build    # production build
npm run lint     # ESLint
npm test         # Jest
```

## GraphQL API client

Calls to `services/graphql-api` go through the typed client in
`src/lib/graphql/client.ts`. Request variables and response shapes are checked
at compile time against types generated from the service's own schema — nothing
in the API layer is `any`-typed.

### Regenerating the types

Run this after **any** change to `services/graphql-api/src/schema.ts` or to an
operation under `src/lib/graphql/operations/`:

```bash
npm run codegen --workspace=apps/interface
```

or, from this directory:

```bash
npm run codegen
```

`codegen.ts` reads the schema directly from the service's source, so the
graphql-api server does **not** need to be running.

It writes two files, both generated — do not hand-edit either:

| File | Contents |
| --- | --- |
| `../../packages/types/src/graphql.ts` | Schema-level types, shared with any other TypeScript consumer via `@fund-my-cause/types/graphql` |
| `src/lib/graphql/generated.ts` | This app's typed operations plus a `graphql-request` SDK bound to them |

### Adding an operation

1. Add a `.graphql` file under `src/lib/graphql/operations/`.
2. Run `npm run codegen`.
3. Wrap the generated SDK method in a named function in
   `src/lib/graphql/client.ts` so call sites import a typed helper rather than
   the raw SDK.

If a query drifts from the schema, codegen fails; if a call site drifts from
the generated types, `npx tsc --noEmit` fails. Both run in CI.

## Logging

Never call `console.log` / `console.debug` in `src/` — `no-console` is an
ESLint **error** there, because anything under `src/` ships in the browser
bundle.

Use the structured logger instead:

```ts
import { logger } from "@/lib/logger";

const log = logger.child("checkout");
log.debug("quote requested", { campaignId });
```

`debug` and `info` are compiled out of production builds, so internal state
never reaches a real user's console. `warn` and `error` always emit. For thrown
errors prefer `logError` from `@/lib/errorLogger`, which normalises to an
`AppError` and forwards to the error-tracking service.

Tests, `scripts/`, and the containerised job entrypoint
`src/lib/analytics/run-job.ts` (whose contract is JSON on stdout) are exempt
from the rule.

## Wallet connection

Wallet connect/disconnect/signing lives in the shared
[`@fund-my-cause/sdk/wallet`](../../sdks/js/README.md#wallet-connect) module,
not in this app. `src/lib/walletAdapters.ts` only supplies app-level
configuration (the WalletConnect project ID) and re-exports the SDK adapters.
