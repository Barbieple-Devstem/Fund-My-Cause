# Local development: `services/graphql-api` and `services/indexer`

How to run each backend service on its own machine, standalone, from a fresh clone.

The two services are independent. They do not talk to each other, share no
process, and neither is required for the other to run. Run whichever one you are
working on.

Every command below was executed against a genuinely fresh clone — new
directory, no cached `node_modules`, no pre-set environment variables — on
Node.js v24. Where a documented step does not work, that is stated explicitly
with the error you will see, rather than omitted.

**Contents**

- [Prerequisites](#prerequisites)
- [`services/indexer`](#servicesindexer)
- [`services/graphql-api`](#servicesgraphql-api)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| | `indexer` | `graphql-api` |
|---|---|---|
| Node.js 20+ | required | required |
| A Soroban RPC endpoint | required | required |
| Redis | **not used** | **required** — see [Redis is mandatory](#redis-is-mandatory-in-practice-despite-the-in-memory-fallback) |
| A database | **none — nothing to provision** | **none — nothing to provision** |

Neither service uses Postgres or any other database. Do not provision one. The
`DATABASE_URL` line in the repository-root `.env.example` belongs to other parts
of the stack and is ignored by both services.

Each service has its own `package.json` and its own lockfile, and **neither is
part of the root npm workspace** (the root `package.json` declares only
`apps/*` and `packages/*`). Always `npm install` from inside the service
directory. Running `npm install` at the repository root does not install these
services' dependencies.

---

## `services/indexer`

Streams Soroban contract events from an RPC endpoint and serves them over a
small REST API.

### There is no database — state is in memory and resets on every restart

The indexer's only data-access layer is `EventStore` (`src/event-store.ts`), a
plain in-process array. There is nothing to provision, nothing to migrate, and
no connection string to configure.

The consequence is worth stating plainly, because it surprises people: **every
event the indexer has ingested is lost when the process stops.** Restart it and
`/events` returns an empty list until it has streamed fresh events again. There
is no backfill or replay. If you are debugging something that depends on
historical events, keep the process running.

This is deliberate, not an oversight. A Postgres/GraphQL layer previously
existed in this service, was never wired into `src/index.ts`, never ran, and was
removed in commit `3700a16`. See the "Data-access decision (#837)" section of
[`services/indexer/README.md`](../services/indexer/README.md) for why it was
deleted rather than repaired. A durable store is future work.

### Environment variables

`src/index.ts` calls `import "dotenv/config"` on its first line, so a `.env`
file in `services/indexer/` **is** loaded automatically. (This is the opposite
of `graphql-api` — see below.)

| Variable | Default | Notes |
|---|---|---|
| `SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org:443` | Include the port. `http://` URLs automatically enable `allowHttp`. |
| `CROWDFUND_CONTRACT_ID` | `""` (empty) | The service starts and connects with this unset, but ingests no events. |
| `PORT` | `3001` | |
| `LOG_LEVEL` | `info` | Any pino level. Use `debug` to log each ingested batch. |

Two names here differ from the repository-root `.env.example`, which lists
`STELLAR_RPC_URL` and `INDEXER_PORT`. **Neither of those is read by this
service.** Use `SOROBAN_RPC_URL` and `PORT`.

### Run it

```bash
cd services/indexer
npm install

cat > .env <<'EOF'
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org:443
CROWDFUND_CONTRACT_ID=<your-deployed-crowdfund-contract-id>
PORT=3001
LOG_LEVEL=info
EOF

npm run build
npm start
```

A successful start logs four lines:

```
{"level":30,...,"port":3001,"msg":"Indexer service listening"}
{"level":30,...,"rpc":"https://soroban-testnet.stellar.org:443","msg":"Starting indexer service"}
{"level":30,...,"ledger":3794035,"msg":"Connected to Soroban RPC"}
{"level":30,...,"msg":"Streaming events from Soroban RPC"}
```

If the RPC connection fails, the service logs `Failed to connect to Soroban RPC.
Retrying in 10 seconds...` and retries indefinitely. The HTTP server stays up
throughout, so `/health` remains reachable while the connection is down.

### Verify

```bash
curl localhost:3001/health          # {"status":"unhealthy","uptime":11528,"lastEventTime":0,...}
curl localhost:3001/ready           # {"ready":true}
curl localhost:3001/stats           # {"eventCount":0,"health":"unhealthy",...}
curl "localhost:3001/events?limit=2" # {"count":0,"events":[]}
```

`/health` reporting `unhealthy` on a fresh start is expected and does not mean
anything is broken. `HealthChecker` derives health from event ingestion, so the
service is "unhealthy" until the first event arrives — which never happens if
`CROWDFUND_CONTRACT_ID` is unset or the contract has had no activity. Use
`/ready`, which flips to `true` once the RPC connection is established, to
confirm the service came up correctly.

`npm run dev` (`ts-node src/index.ts`) is available for iteration.

---

## `services/graphql-api`

Apollo Server over Express, serving a read API backed by direct Soroban RPC
contract calls, with Redis-backed caching and rate limiting and WebSocket
subscriptions.

### `dotenv` is declared but never imported — a `.env` file will not load

`graphql-api/package.json` lists `dotenv` as a dependency, but **no file in
`src/` imports it.** There is no `import "dotenv/config"` anywhere in the
service. Writing a `.env` file in `services/graphql-api/` has no effect; every
`process.env` read will see nothing, and the service will exit immediately
complaining that `JWT_SECRET` is missing.

Do not spend time debugging this. Export the variables into your shell, or
prefix the command, or use a runner that injects them:

```bash
# Works
JWT_SECRET=$(openssl rand -hex 32) npm start

# Also works
set -a; source .env; set +a; npm start

# Does NOT work — .env is never read
npm start
```

The unused dependency is tracked separately as an env-loader code-quality issue;
this guide documents the behaviour as it is today.

### Environment variables

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | none | **Required.** Validated at startup — see below. |
| `REDIS_URL` | `redis://localhost:6379` | Read in `src/redis.ts`. |
| `GRAPHQL_PORT` | `4000` | Note: `GRAPHQL_PORT`, not `PORT`. |
| `RPC_URL` | `https://soroban-testnet.stellar.org` | Note: `RPC_URL`, not `SOROBAN_RPC_URL` — this differs from the indexer. |
| `CONTRACT_NETWORK` | `testnet` | Only `mainnet` selects the public network passphrase; any other value means testnet. |
| `REGISTRY_CONTRACT_ID` | `""` (empty) | Without it, campaign-list queries return empty and log `getCampaigns called without registryContractId configured`. |
| `CORS_ORIGIN` | `http://localhost:3000,http://localhost:5173` | Comma-separated. |
| `NODE_ENV` | `development` | `production` disables GraphQL introspection and hides error details. |

`JWT_SECRET` is validated by four checks in `src/index.ts`, each of which
`process.exit(1)`s with a `FATAL:` message. It must be set and non-empty, must
be at least 32 characters, and must not be one of three known example values —
including `dev-secret-key-change-in-production`, **which is the value in the
repository-root `.env.example`.** Copying that file will not produce a working
secret. Generate one:

```bash
export JWT_SECRET=$(openssl rand -hex 32)
```

### Redis is mandatory in practice, despite the in-memory fallback

`RateLimiterService` (`src/services/rate-limiter.ts`) takes an optional Redis
client and falls back to `RateLimiterMemory` when none is passed — so the
service *looks* like it runs without Redis.

It does not. `src/index.ts` always constructs a real client first:
`createRedisClient()` (`src/redis.ts`) calls `await client.connect()`, which
rejects when nothing is listening. That rejection propagates to `startServer`'s
`catch`, which calls `process.exit(1)`. The process dies before
`RateLimiterService` is ever constructed, so the in-memory branch is unreachable
from the running service.

Without Redis you get:

```
❌ Failed to start server: AggregateError [ECONNREFUSED]
    at async createRedisClient (src/redis.ts:39:3)
    at async startServer (src/index.ts:65:19)
```

So: **start Redis before starting this service.** The memory fallback is
reachable only from unit tests, which construct `RateLimiterService` directly.

```bash
docker run -d --name fmc-redis -p 6379:6379 redis:7-alpine
```

### Run it

```bash
cd services/graphql-api
npm install

docker run -d --name fmc-redis -p 6379:6379 redis:7-alpine

export JWT_SECRET=$(openssl rand -hex 32)
export RPC_URL=https://soroban-testnet.stellar.org
export CONTRACT_NETWORK=testnet
export REGISTRY_CONTRACT_ID=<your-registry-contract-id>

npx tsx src/index.ts
```

**Use `npx tsx src/index.ts`, not `npm start` or `npm run dev`.** Both of the
packaged scripts currently fail before the server starts; the cause and the
error you will see are in
[Neither `npm start` nor `npm run dev` works](#neither-npm-start-nor-npm-run-dev-works-for-graphql-api)
below. `tsx` is already a devDependency of this service, so no extra install is
needed.

A successful start prints:

```
🚀 Starting GraphQL API Server...
   Environment: development
   Port: 4000
Redis Client Connected
Redis Client Ready
✅ Redis connection established
✅ Services initialized
✅ Apollo Server started
✅ WebSocket server configured

🎉 GraphQL API Server is running!
```

### Verify

```bash
curl localhost:4000/health    # {"status":"ok","timestamp":"..."}
curl localhost:4000/status    # per-component health for api / cache / rpc
```

`/health` is a static liveness check. `/status` actively pings Redis and posts a
`getHealth` call to `RPC_URL`, so it is the better check that your configuration
is right — it returns HTTP 207 with `"status":"degraded"` if either dependency
is unreachable.

Note that issuing a GraphQL query against a fresh clone currently crashes the
process — see
[The first GraphQL request crashes the server](#the-first-graphql-request-crashes-the-server)
before you conclude your setup is wrong.

---

## Troubleshooting

### `@stellar/stellar-sdk` version mismatch between the two services

The two services pin different major versions of the same SDK against the same
network, and there is no shared client factory:

| | Declared | Resolves to | Imports the RPC namespace as |
|---|---|---|---|
| `services/graphql-api` | `14.6.1` (exact) | 14.6.1 | `import { rpc as SorobanRpc }` |
| `services/indexer` | `^12.0.0` | 12.3.0 | `import { SorobanRpc }` |

**The two import forms are not interchangeable, and that is the whole risk.**
The SDK renamed its RPC namespace from `SorobanRpc` to `rpc` after v12. In
14.6.1 the old name is gone entirely — `SorobanRpc` is `undefined`, not
deprecated.

Symptoms if the indexer ever resolves a v14 SDK — by hoisting, by a bad
dedupe, by someone "aligning the versions" in `package.json`, or by adding the
service to the root workspace:

```
TypeError: Cannot read properties of undefined (reading 'Server')
    at new SorobanRPCClient (src/rpc-client.ts:26)
```

The import itself does not throw. `SorobanRpc` silently binds to `undefined`,
and the failure surfaces later at `new SorobanRpc.Server(...)` in the
constructor — so the traceback points at the client, not at the version
mismatch that caused it. `tsc` will also report
`Namespace '"@stellar/stellar-sdk"' has no exported member 'SorobanRpc'`, which
is the clearer signal if you build before running.

Conversely, downgrading `graphql-api` to v12 breaks it: `src/services/contract.ts`
and `sdks/js` both use the `rpc as SorobanRpc` alias form, which v12 does not
export.

Practical guidance until a shared client factory exists:

- Do not "fix" the version skew by editing one `package.json` to match the
  other. Upgrading the indexer to v14 requires changing `rpc-client.ts:1` to
  `import { rpc as SorobanRpc }` in the same commit.
- Keep the two services' `node_modules` separate. Install from inside each
  service directory. Neither is in the root workspace today — do not add them
  to it casually, as hoisting is exactly what would surface this.
- After any dependency change, confirm what actually resolved:
  ```bash
  cd services/indexer && node -p "require('./node_modules/@stellar/stellar-sdk/package.json').version"
  ```

### Neither `npm start` nor `npm run dev` works for `graphql-api`

Both fail before the server starts:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../packages/types/src/soroban'
    imported from .../packages/types/src/index.ts
```

`graphql-api` depends on the local `@fund-my-cause/types` package, whose
`package.json` points `main`/`exports` at raw `.ts` source
(`./src/index.ts`) with no build step. That file imports its siblings without
file extensions (`from "./soroban"`), which Node's ESM resolver rejects. This is
a real runtime dependency, not a type-only one — `src/resolvers.ts:3` imports
the `CAMPAIGN_STATUS_VALUES` value.

`npm run dev` fails the same way: its `ts-node/esm` loader hits the identical
unresolved specifier.

**Workaround:** run with `tsx`, which resolves the extensionless TypeScript
imports:

```bash
npx tsx src/index.ts
```

Fixing this properly means giving `@fund-my-cause/types` a build step and
pointing its `exports` at compiled output. That change also affects
`apps/interface` and `sdks/js`, so it is deliberately out of scope for this
guide and left as a separate packaging issue.

### The first GraphQL request crashes the server

With Redis running and the server started, the first POST to `/graphql` takes
down the process with an unhandled rejection:

```
[ErrorReply: ERR Lua redis lib command arguments must be strings or integers
 script: a1de965f42e177aa339706bd580f049065eca79a, on @user_script:1.]
```

Reproduction:

```bash
curl -X POST localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query{__typename}"}'
# → empty response; the server process has exited
```

This is a dependency incompatibility, not a configuration problem.
`rate-limiter-flexible@^2.4.1` (resolving to 2.4.2) targets `node_redis` v3 /
`ioredis`; this service pairs it with `redis@^4.6.0` (resolving to 4.7.1), whose
client passes Lua script arguments in a form the v2 limiter does not produce
correctly. `RateLimiterService.checkIpLimit` runs in Apollo's `context`
function on every `/graphql` request, so the very first query triggers it.

`/health` and `/status` are unaffected — they are plain Express routes that do
not pass through the rate limiter — which is why the service looks healthy right
up until the first real query.

Resolving it requires a dependency decision (upgrade `rate-limiter-flexible` to
v5+, which supports node-redis v4, or pin `redis` to v3) and is out of scope for
this guide. Until then, expect `/graphql` to be unusable from a fresh install.

### `getCampaigns called without registryContractId configured`

Not an error. `REGISTRY_CONTRACT_ID` is unset, so campaign-list resolvers
short-circuit and return empty results. Set it to your deployed registry
contract ID. Single-campaign queries are unaffected, since they take a contract
ID as a query argument.

### Port already in use

Default ports are `3001` (indexer) and `4000` (graphql-api). Note the different
variable names: `PORT` for the indexer, `GRAPHQL_PORT` for graphql-api. Setting
`PORT` for graphql-api does nothing.

### The indexer connects but `/events` stays empty

Expected when `CROWDFUND_CONTRACT_ID` is unset or points at a contract with no
recent activity. The indexer streams events forward from the current ledger
only — it does not backfill history, so a contract whose activity predates your
process start yields nothing. Confirm the RPC side is healthy with `/ready`
(`true`) rather than `/health`.

---

## Related

- [`services/indexer/README.md`](../services/indexer/README.md) — REST endpoint
  reference and the in-memory data-access decision
- [`docs/LOCAL_DEVELOPMENT_QUICKSTART.md`](./LOCAL_DEVELOPMENT_QUICKSTART.md) —
  contracts and frontend setup
- [`docs/service-architecture.md`](./service-architecture.md) — how these
  services fit the wider system
- [ADR-002](./adr/ADR-002-off-chain-indexer-architecture.md),
  [ADR-003](./adr/ADR-003-graphql-api-for-frontend-queries.md) — why each
  service exists
