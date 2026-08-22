# Event Schema Reference

This document is the authoritative reference for every event emitted by the Fund-My-Cause smart contracts. Use it to build consumers, write indexers, or set up event-based alerts.

---

## Table of Contents

1. [Overview](#overview)
2. [Schema Versioning](#schema-versioning)
3. [Subscribing to Events](#subscribing-to-events)
4. [Crowdfund Contract Events](#crowdfund-contract-events)
   - [Core Lifecycle](#core-lifecycle)
   - [Metadata & Management](#metadata--management)
   - [Access Control](#access-control)
   - [Recurring Contributions](#recurring-contributions)
   - [Delegation](#delegation)
   - [Extension Voting](#extension-voting)
   - [Emergency Withdrawal](#emergency-withdrawal)
   - [Matching](#matching)
   - [Rewards & Tiers](#rewards--tiers)
   - [Insurance](#insurance)
   - [Templates & Cloning](#templates--cloning)
5. [Registry Contract Events](#registry-contract-events)
6. [Consumer Snippet](#consumer-snippet)
7. [Indexer Contract](#indexer-contract)
8. [Version Compatibility](#version-compatibility)

---

## Overview

All Fund-My-Cause contracts emit typed events via `soroban_sdk`. Events follow the topic convention:

```
("<contract_type>", "<event_name>")
```

For the crowdfund contract: `("campaign", "<event_name>")`  
For the registry contract: `("registry", "<event_name>")`  
For insurance events: `("insurance", "<event_name>")`

Events are visible via the Soroban RPC `getEvents` method and indexed by the [`services/indexer`](../services/indexer) service.

---

## Schema Versioning

Events that carry a `schema_version` field are explicitly versioned. The current version is **1**.

```
Schema version history
  v1 — initial versioned schema
```

Consumers should:

1. Read `schema_version` from any event that carries it.
2. If the version exceeds what your consumer was written for, log a warning and handle gracefully (e.g. skip unknown fields).
3. Never hard-fail on an unknown field — the schema only adds fields in backwards-compatible increments within a version.

Events without a `schema_version` field have a stable shape and are not versioned.

---

## Subscribing to Events

### TypeScript (Stellar SDK)

```ts
import { rpc as SorobanRpc, nativeToScVal } from "@stellar/stellar-sdk";

const server = new SorobanRpc.Server(process.env.NEXT_PUBLIC_SOROBAN_RPC_URL!);

// Get the current ledger to use as the start cursor
const latestLedger = (await server.getLatestLedger()).sequence;

const response = await server.getEvents({
  startLedger: latestLedger - 1000, // scan the last ~1000 ledgers
  filters: [
    {
      type: "contract",
      contractIds: [CONTRACT_ID],
      topics: [
        // All "campaign" events
        [
          nativeToScVal("campaign", { type: "symbol" }).toXDR("base64"),
          "*",
        ],
      ],
    },
  ],
});

for (const event of response.events) {
  const [contractType, eventName] = event.topic.map((t) =>
    SorobanRpc.scValToNative(t)
  );
  const payload = SorobanRpc.scValToNative(event.value);
  console.log(`${contractType}:${eventName}`, payload);
}
```

### Filtering for a specific event

```ts
// Only "contributed" events
topics: [
  [
    nativeToScVal("campaign", { type: "symbol" }).toXDR("base64"),
    nativeToScVal("contributed", { type: "symbol" }).toXDR("base64"),
  ],
],
```

### Cursor-based polling

```ts
let cursor = "0";

async function poll() {
  const response = await server.getEvents({
    startLedger: cursor === "0" ? latestLedger : undefined,
    cursor: cursor !== "0" ? cursor : undefined,
    filters: [{ type: "contract", contractIds: [CONTRACT_ID] }],
    limit: 200,
  });

  for (const event of response.events) {
    await processEvent(event);
    cursor = event.pagingToken;
  }
}

// Poll every 5 seconds
setInterval(poll, 5000);
```

---

## Crowdfund Contract Events

Topic prefix: `("campaign", ...)`

### Core Lifecycle

These events cover the primary funding flow.

#### `initialized`

Emitted by: `initialize`

| Field | Type | Description |
|-------|------|-------------|
| `creator` | `Address` | Campaign creator's Stellar address |
| `token` | `Address` | Accepted contribution token |
| `goal` | `i128` | Funding goal in token base units |
| `deadline` | `u64` | Unix timestamp of campaign end |
| `category` | `Symbol` | Campaign category (optional) |
| `schema_version` | `u32` | Schema version — currently `1` |

---

#### `contributed`

Emitted by: `contribute`

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address that contributed |
| `amount` | `i128` | Amount contributed in base units |
| `new_total` | `i128` | Updated `total_raised` after this contribution |
| `matched_amount` | `i128` | Matched amount added (0 if no matching sponsor) |
| `schema_version` | `u32` | Schema version — currently `1` |

---

#### `contribution_recorded`

Emitted by: `contribute` (alongside `contributed`)

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address that contributed |
| `amount` | `i128` | Amount of this contribution |
| `timestamp` | `u64` | Ledger timestamp at time of contribution |
| `running_total` | `i128` | Running total raised (same as `new_total` in `contributed`) |

---

#### `withdrawn`

Emitted by: `withdraw`

| Field | Type | Description |
|-------|------|-------------|
| `creator` | `Address` | Campaign creator |
| `total` | `i128` | Total raised before fee deduction |
| `fee` | `i128` | Platform fee deducted (0 if no fee configured) |
| `payout` | `i128` | Net amount transferred to creator (`total - fee`) |
| `schema_version` | `u32` | Schema version — currently `1` |

---

#### `refunded`

Emitted by: `refund_single`

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address receiving the refund |
| `amount` | `i128` | Amount refunded |
| `schema_version` | `u32` | Schema version — currently `1` |

---

#### `partial_refund`

Emitted by: `refund_partial`

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address receiving the partial refund |
| `amount` | `i128` | Amount refunded |
| `reason` | `Symbol` | Reason for partial refund |

---

#### `batch_refund_completed`

Emitted by: `refund_batch`

| Field | Type | Description |
|-------|------|-------------|
| `count` | `u32` | Number of contributors refunded in this batch |

---

#### `status_changed`

Emitted when campaign status transitions.

| Field | Type | Description |
|-------|------|-------------|
| `old_status` | `Symbol` | Previous status (`Active`, `Paused`, etc.) |
| `new_status` | `Symbol` | New status |

---

#### `cancelled`

Emitted by: `cancel_campaign`

| Field | Type | Description |
|-------|------|-------------|
| `creator` | `Address` | Campaign creator |
| `total_raised` | `i128` | Total raised at time of cancellation |

---

### Metadata & Management

#### `metadata_updated`

Emitted by: `update_metadata`

| Field | Type | Description |
|-------|------|-------------|
| `title` | `String` | Updated campaign title |
| `description` | `String` | Updated campaign description |

---

#### `metadata_versioned`

Emitted by: `update_metadata`

| Field | Type | Description |
|-------|------|-------------|
| `version` | `u32` | Metadata version counter (increments with each update) |
| `timestamp` | `u64` | Ledger timestamp of the update |

---

#### `deadline_extended`

Emitted by: `extend_deadline`

| Field | Type | Description |
|-------|------|-------------|
| `old_deadline` | `u64` | Previous deadline timestamp |
| `new_deadline` | `u64` | New deadline timestamp |

---

#### `goal_adjusted`

Emitted by: `adjust_goal`

| Field | Type | Description |
|-------|------|-------------|
| `old_goal` | `i128` | Previous funding goal |
| `new_goal` | `i128` | New funding goal |

---

#### `paused` / `resumed`

| Event | Emitted by | Field | Type | Description |
|-------|-----------|-------|------|-------------|
| `paused` | `pause` | `creator` | `Address` | Creator who paused the campaign |
| `resumed` | `resume` / `unpause` | `creator` | `Address` | Creator who resumed the campaign |

---

#### `archived`

Emitted by: `archive`

| Field | Type | Description |
|-------|------|-------------|
| `creator` | `Address` | Campaign creator |
| `archived_at` | `u64` | Ledger timestamp when archived |

---

### Access Control

#### `whitelisted` / `whitelist_removed`

| Event | Field | Type | Description |
|-------|-------|------|-------------|
| `whitelisted` | `address` | `Address` | Address added to whitelist |
| `whitelist_removed` | `address` | `Address` | Address removed from whitelist |

---

#### `blacklisted` / `blacklist_removed`

| Event | Field | Type | Description |
|-------|-------|------|-------------|
| `blacklisted` | `address` | `Address` | Address added to blacklist |
| `blacklist_removed` | `address` | `Address` | Address removed from blacklist |

---

#### `rate_limit_updated`

Emitted by: `set_rate_limit`

| Field | Type | Description |
|-------|------|-------------|
| `max_amount` | `i128` | Maximum contribution per window |
| `window_seconds` | `u64` | Window duration in seconds |

---

#### `rate_limit_hit`

Emitted by: `contribute` when a contributor exceeds their rate limit.

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address that was rate-limited |
| `attempted` | `i128` | Amount they attempted to contribute |
| `period_amount` | `i128` | Their total in the current window |
| `max_amount` | `i128` | The limit they exceeded |

---

### Recurring Contributions

#### `recurring_setup`

Emitted by: `setup_recurring`

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address setting up recurring contributions |
| `amount` | `i128` | Amount per execution |
| `interval` | `u64` | Seconds between executions |
| `end_date` | `u64` | Unix timestamp when recurring ends |

---

#### `recurring_executed`

Emitted by: `execute_recurring`

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address whose recurring contribution executed |
| `amount` | `i128` | Amount contributed in this execution |
| `next_execution` | `u64` | Unix timestamp of the next scheduled execution |

---

#### `recurring_cancelled`

Emitted by: `cancel_recurring`

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address that cancelled their recurring schedule |

---

### Delegation

#### `delegation_created`

Emitted by: `delegate_contribution`

| Field | Type | Description |
|-------|------|-------------|
| `delegator` | `Address` | Address granting delegation rights |
| `delegate` | `Address` | Address receiving delegation rights |
| `amount` | `i128` | Maximum delegated amount |

---

#### `delegated_contribution`

Emitted by: `contribute_on_behalf`

| Field | Type | Description |
|-------|------|-------------|
| `delegate` | `Address` | Address making the contribution on behalf of delegator |
| `delegator` | `Address` | Address on whose behalf the contribution is made |
| `amount` | `i128` | Amount contributed |

---

#### `delegation_revoked`

Emitted by: `revoke_delegation`

| Field | Type | Description |
|-------|------|-------------|
| `delegator` | `Address` | Address revoking their delegation |

---

### Extension Voting

#### `extension_proposed`

Emitted by: `propose_extension`

| Field | Type | Description |
|-------|------|-------------|
| `new_deadline` | `u64` | Proposed new deadline timestamp |
| `end_time` | `u64` | Unix timestamp when voting ends |

---

#### `extension_voted`

Emitted by: `vote_on_extension`

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address casting the vote |
| `approve` | `bool` | `true` = approve, `false` = reject |
| `weight` | `i128` | Voting weight (proportional to contribution) |

---

#### `extension_executed`

Emitted by: `execute_extension`

| Field | Type | Description |
|-------|------|-------------|
| `new_deadline` | `u64` | The new deadline after successful vote |

---

### Emergency Withdrawal

Topic: `("campaign", "<event_name>")`

#### `emergency_initiated`

Emitted by: `initiate_emergency_withdrawal`

| Field | Type | Description |
|-------|------|-------------|
| `lock_until` | `u64` | Timestamp until which the withdrawal is locked (cooldown) |

---

#### `multisig_configured`

Emitted by: `setup_emergency_multisig`

| Field | Type | Description |
|-------|------|-------------|
| `required_approvals` | `u32` | Number of approvals needed to execute |

---

#### `emergency_approved`

Emitted by: `approve_emergency_withdrawal`

| Field | Type | Description |
|-------|------|-------------|
| `approver` | `Address` | Address that approved |
| `approval_count` | `u32` | Running count of approvals received |

---

#### `emergency_executed`

Emitted by: `execute_emergency_withdrawal`

| Field | Type | Description |
|-------|------|-------------|
| `creator` | `Address` | Campaign creator |
| `amount` | `i128` | Amount withdrawn |

---

### Matching

#### `matching_setup`

Emitted by: `setup_matching`

| Field | Type | Description |
|-------|------|-------------|
| `sponsor` | `Address` | Address providing the matched funds |
| `match_ratio` | `u32` | Match ratio in basis points (e.g. `10000` = 1:1) |
| `max_match` | `i128` | Maximum total matching amount |

---

#### `matching_sponsor_refunded`

Emitted when unmatched sponsor funds are returned.

| Field | Type | Description |
|-------|------|-------------|
| `sponsor` | `Address` | Matching sponsor receiving the refund |
| `amount` | `i128` | Unmatched amount returned |

---

### Rewards & Tiers

#### `tiers_set`

Emitted by: `set_reward_tiers`

| Field | Type | Description |
|-------|------|-------------|
| `count` | `u32` | Number of reward tiers configured |

---

#### `tier_assigned`

Emitted by: `contribute` when a contributor qualifies for a reward tier.

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address that qualified |
| `tier_name` | `String` | Name of the tier earned |
| `min_amount` | `i128` | Minimum contribution required for this tier |

---

#### `rewards_distributed`

Emitted by: `distribute_rewards`

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address receiving the reward |
| `amount` | `i128` | Reward amount distributed |

---

### Insurance

Topic: `("insurance", "<event_name>")`

#### `enabled`

Emitted by: `enable_insurance`

| Field | Type | Description |
|-------|------|-------------|
| `fee_bps` | `u32` | Insurance fee in basis points |
| `provider` | `Address` | Insurance provider address |

---

#### `payout`

Emitted during the refund flow when insurance applies.

| Field | Type | Description |
|-------|------|-------------|
| `contributor` | `Address` | Address receiving the insurance payout |
| `amount` | `i128` | Payout amount |

---

### Templates & Cloning

#### `template_applied`

Emitted by: `initialize_from_template`

| Field | Type | Description |
|-------|------|-------------|
| `template_type` | `Symbol` | Name of the template used |

---

#### `cloned`

Emitted by: `clone_campaign`

| Field | Type | Description |
|-------|------|-------------|
| `new_creator` | `Address` | Creator of the cloned campaign |
| `new_goal` | `i128` | Goal set for the cloned campaign |
| `new_deadline` | `u64` | Deadline set for the cloned campaign |

---

## Registry Contract Events

Topic prefix: `("registry", ...)`

#### `registered`

Emitted by: `register`

| Field | Type | Description |
|-------|------|-------------|
| `campaign_id` | `Address` | Address of the registered crowdfund contract |

---

## Consumer Snippet

The following is a complete, working TypeScript consumer that subscribes to all crowdfund events, decodes payloads, and routes them by event name. Drop it into a Node.js script or a Next.js API route.

```ts
import {
  rpc as SorobanRpc,
  scValToNative,
  nativeToScVal,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID!;

interface CampaignEvent {
  name: string;
  payload: Record<string, unknown>;
  ledger: number;
  txHash: string;
  timestamp: string;
}

async function consumeEvents(startLedger: number): Promise<void> {
  const server = new SorobanRpc.Server(RPC_URL);
  let cursor: string | undefined;

  while (true) {
    const response = await server.getEvents({
      startLedger: cursor ? undefined : startLedger,
      cursor,
      filters: [
        {
          type: "contract",
          contractIds: [CONTRACT_ID],
          topics: [
            [
              nativeToScVal("campaign", { type: "symbol" }).toXDR("base64"),
              "*",
            ],
          ],
        },
      ],
      limit: 200,
    });

    for (const raw of response.events) {
      const [, eventName] = raw.topic.map((t) => scValToNative(t) as string);
      const payload = scValToNative(raw.value) as Record<string, unknown>;

      const event: CampaignEvent = {
        name: eventName,
        payload,
        ledger: raw.ledger,
        txHash: raw.txHash,
        timestamp: raw.ledgerClosedAt,
      };

      handleEvent(event);
      cursor = raw.pagingToken;
    }

    // Poll every 5 seconds
    await new Promise((r) => setTimeout(r, 5000));
  }
}

function handleEvent(event: CampaignEvent): void {
  switch (event.name) {
    case "contributed": {
      const { contributor, amount, new_total } = event.payload;
      console.log(`Contribution: ${contributor} sent ${amount}. Total: ${new_total}`);
      break;
    }
    case "withdrawn": {
      const { creator, payout, fee } = event.payload;
      console.log(`Withdrawal: ${creator} received ${payout} (fee: ${fee})`);
      break;
    }
    case "refunded": {
      const { contributor, amount } = event.payload;
      console.log(`Refund: ${contributor} reclaimed ${amount}`);
      break;
    }
    case "initialized": {
      const { creator, goal, deadline } = event.payload;
      console.log(`New campaign by ${creator}. Goal: ${goal}, Deadline: ${deadline}`);
      break;
    }
    case "cancelled": {
      console.log(`Campaign cancelled. Total raised was: ${event.payload.total_raised}`);
      break;
    }
    default:
      console.log(`Unhandled event: ${event.name}`, event.payload);
  }
}

// Start consuming from 1000 ledgers ago
const server = new SorobanRpc.Server(RPC_URL);
server.getLatestLedger().then(({ sequence }) => {
  consumeEvents(Math.max(0, sequence - 1000));
});
```

A runnable version is available in [`examples/event-listener/index.ts`](../examples/event-listener/index.ts).

---

## Indexer Contract

The [`services/indexer`](../services/indexer) service is a TypeScript daemon that:

1. Connects to the Soroban RPC via cursor-based polling (see `src/ingestor.ts`)
2. Decodes every contract event using `scValToNative`
3. Persists events to an in-process store (see `src/event-store.ts`)
4. Exposes a REST API and a GraphQL endpoint for querying indexed events

### Indexer REST API

The indexer runs on port `3001` by default (configurable via `PORT` env var).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events` | GET | List all indexed events (supports `?type=` and `?contractId=` filters) |
| `/events/:id` | GET | Fetch a single event by ID |
| `/health` | GET | Health check — returns `{ "status": "ok" }` |

### Indexer GraphQL API

Available at `http://localhost:3001/graphql`. See [`src/graphql-schema.ts`](../services/indexer/src/graphql-schema.ts) for the full schema.

```graphql
query GetContributions($contractId: String!) {
  events(contractId: $contractId, type: "contributed") {
    id
    name
    ledger
    txHash
    payload
    timestamp
  }
}
```

### Running the Indexer

```bash
cd services/indexer
cp .env.example .env
# Fill in SOROBAN_RPC_URL and CONTRACT_ID
npm install
npm run dev
```

---

## Version Compatibility

| Event | Introduced | `schema_version` | Notes |
|-------|-----------|-----------------|-------|
| `initialized` | v0.1.0 | 1 | `category` field added in v0.2.0 |
| `contributed` | v0.1.0 | 1 | `matched_amount` added in v0.2.0 |
| `withdrawn` | v0.1.0 | 1 | |
| `refunded` | v0.1.0 | 1 | |
| `stream_claimed` | v0.2.0 | 1 | Vesting stream payouts |
| All other events | v0.1.0–v0.3.0 | — | Stable; no version field |

Consumers should treat `schema_version` as a forward-compatibility hint. Missing fields should be treated as `null`/`undefined`, not as an error.

---

## Related Docs

- [Event Monitoring Guide](./event-monitoring.md) — monitoring, alerting, and dashboards
- [API Events Reference](./api/events.md) — compact event table for quick lookup
- [Contract API Reference](./contract-api.md) — full contract function documentation
- [Indexer Service](../services/indexer/README.md) — running the event indexer locally
- [Event Listener Example](../examples/event-listener/index.ts) — runnable consumer code
